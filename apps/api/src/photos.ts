import { BadRequestException, Body, ConflictException, Controller, Get, Header, Headers, Injectable, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { PoolClient } from "pg";
import { z } from "zod";
import { AuthRequest, SessionGuard, User, requirePermission, requireWarehouse } from "./auth";
import { Database, audit } from "./db";
import { Operations, has } from "./operations";
import { parse, uuid } from "./validation";

export const photoPath = /^\/api\/photos\/([0-9a-f-]{36})$/;
const imageInput = z.object({ base64: z.string().min(16).max(466668).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict();

@Injectable()
export class Photos {
  constructor(private readonly db: Database, private readonly operations: Operations) {}

  async decode(base64: string) {
    const input = Buffer.from(base64, "base64");
    if (input.length > 350000 || input.toString("base64") !== base64)
      throw new BadRequestException("Ảnh quá lớn hoặc không hợp lệ. Chọn lại ảnh để nén trước khi gửi.");
    try {
      const image = sharp(input, { limitInputPixels: 4_000_000, failOn: "warning" });
      const meta = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format || "") || (meta.pages || 1) !== 1) throw new Error();
      // Decode/re-encode rather than trust MIME or EXIF supplied by the client.
      const data = await image.rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
      if (data.length > 350000) throw new Error();
      return data;
    } catch {
      throw new BadRequestException("Ảnh hỏng, quá lớn hoặc không được hỗ trợ. Dùng ảnh JPG, PNG hoặc WebP.");
    }
  }

  async budget(client: PoolClient, bytes: number) {
    await this.operations.locks(client, ["photo-storage"]);
    await client.query("DELETE FROM photos WHERE product_id IS NULL AND order_id IS NULL AND created_at < now()-interval '24 hours'");
    const used = (await client.query("SELECT COALESCE(sum(octet_length(data)),0)::int bytes FROM photos")).rows[0].bytes;
    if (used + bytes > 128 * 1024 * 1024) throw new ConflictException("Kho ảnh thử nghiệm đã đầy. Liên hệ quản trị viên để sao lưu và mở rộng lưu trữ.");
  }

  async bindProduct(client: PoolClient, user: User, productId: string, imageUrl?: string, oldUrl = "") {
    const match = imageUrl?.match(photoPath);
    if (match) {
      const photo = (await client.query("SELECT * FROM photos WHERE id=$1 FOR UPDATE", [parse(uuid, match[1])])).rows[0];
      if (!photo || photo.kind !== "PRODUCT" || (photo.product_id ? photo.product_id !== productId : photo.created_by !== user.id))
        throw new BadRequestException("Ảnh không thuộc hàng hóa hoặc phiên tải lên này. Vui lòng chọn lại ảnh.");
      await client.query("UPDATE photos SET product_id=$2 WHERE id=$1", [photo.id, productId]);
    }
    if (imageUrl !== undefined && oldUrl !== imageUrl && oldUrl.match(photoPath))
      await client.query("DELETE FROM photos WHERE id=$1 AND product_id=$2", [oldUrl.match(photoPath)![1], productId]);
  }

  async order(client: Pick<PoolClient, "query">, user: User, id: string, write = false) {
    requirePermission(user, write ? "sales.fulfillment" : "sales.view");
    const order = (await client.query("SELECT * FROM orders WHERE id=$1" + (write ? " FOR UPDATE" : ""), [id])).rows[0];
    if (!order) throw new NotFoundException("Không tìm thấy đơn hàng.");
    requireWarehouse(user, order.warehouse_id);
    if (!write && !has(user, "reports.view") && !has(user, "sales.fulfillment") && order.created_by !== user.id)
      throw new NotFoundException("Không tìm thấy đơn hàng trong phạm vi tài khoản.");
    if (write && order.returned) throw new ConflictException("Không thêm ảnh giao hàng cho đơn đã trả.");
    return order;
  }

  async read(user: User, id: string) {
    const photo = (await this.db.pool.query("SELECT * FROM photos WHERE id=$1", [id])).rows[0];
    if (!photo) throw new NotFoundException("Không tìm thấy ảnh.");
    if (photo.order_id) await this.order(this.db.pool, user, photo.order_id);
    else {
      requirePermission(user, "inventory.view");
      if (!photo.product_id && photo.created_by !== user.id) throw new NotFoundException("Không tìm thấy ảnh.");
    }
    return { dataUrl: "data:image/jpeg;base64," + photo.data.toString("base64") };
  }
}

@Controller("api")
@UseGuards(SessionGuard)
export class PhotoController {
  constructor(private readonly db: Database, private readonly photos: Photos, private readonly operations: Operations) {}

  @Get("photos/:id")
  @Header("Cache-Control", "private, no-store")
  read(@Req() request: AuthRequest, @Param("id") id: string) { return this.photos.read(request.user, parse(uuid, id)); }

  @Post("photos/product")
  async upload(@Req() request: AuthRequest, @Body() body: unknown, @Headers("idempotency-key") key?: string) {
    requirePermission(request.user, "products.manage");
    requirePermission(request.user, "inventory.cost.view");
    const input = parse(imageInput, body);
    const data = await this.photos.decode(input.base64);
    return this.operations.once(request.user, key, "photos.product", { hash: createHash("sha256").update(input.base64).digest("hex") }, async client => {
      await this.photos.budget(client, data.length);
      const id = randomUUID();
      await client.query("INSERT INTO photos(id,kind,data,created_by) VALUES($1,'PRODUCT',$2,$3)", [id, data, request.user.id]);
      await audit(client, request.user.id, "PRODUCT_PHOTO_UPLOADED", id, { bytes: data.length });
      return { id, imageUrl: "/api/photos/" + id };
    });
  }

  @Get("orders/:id/photos")
  async list(@Req() request: AuthRequest, @Param("id") rawId: string) {
    const id = parse(uuid, rawId);
    await this.photos.order(this.db.pool, request.user, id);
    return (await this.db.pool.query("SELECT p.id,p.note,p.created_at,u.name actor FROM photos p JOIN users u ON u.id=p.created_by WHERE p.order_id=$1 ORDER BY p.created_at", [id])).rows;
  }

  @Post("orders/:id/photos")
  async delivery(@Req() request: AuthRequest, @Param("id") rawId: string, @Body() body: unknown, @Headers("idempotency-key") key?: string) {
    requirePermission(request.user, "sales.fulfillment");
    const id = parse(uuid, rawId);
    // Authorize before decoding an untrusted image.
    await this.photos.order(this.db.pool, request.user, id);
    const input = parse(imageInput.extend({ note: z.string().trim().max(500).default(""), confirmDelivered: z.boolean().default(false), carrier: z.string().trim().max(100).optional(), trackingCode: z.string().trim().max(100).optional() }), body);
    const data = await this.photos.decode(input.base64);
    const { base64, ...details } = input;
    return this.operations.once(request.user, key, "photos.delivery", { orderId: id, ...details, hash: createHash("sha256").update(base64).digest("hex") }, async client => {
      const order = await this.photos.order(client, request.user, id, true);
      const count = (await client.query("SELECT count(*)::int count FROM photos WHERE order_id=$1", [id])).rows[0].count;
      if (count >= 5) throw new ConflictException("Mỗi đơn lưu tối đa 5 ảnh xác nhận giao hàng.");
      await this.photos.budget(client, data.length);
      const photoId = randomUUID();
      await client.query("INSERT INTO photos(id,kind,data,created_by,order_id,note) VALUES($1,'DELIVERY',$2,$3,$4,$5)", [photoId, data, request.user.id, id, input.note]);
      if (input.confirmDelivered) await client.query("UPDATE orders SET delivery_status='DELIVERED',carrier=$2,tracking_code=$3 WHERE id=$1", [id, input.carrier ?? order.carrier, input.trackingCode ?? order.tracking_code]);
      await audit(client, request.user.id, "DELIVERY_PHOTO_ADDED", id, { photoId, ...details, previousStatus: order.delivery_status });
      return { id: photoId, orderId: id, delivered: input.confirmDelivered };
    });
  }
}
