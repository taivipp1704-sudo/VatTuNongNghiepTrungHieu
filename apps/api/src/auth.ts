import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { Request } from "express";
import { Database, audit } from "./db";

const scrypt = promisify(scryptCallback);
export const permissionCatalog = [
  "inventory.view",
  "inventory.receipt.create",
  "inventory.issue.create",
  "inventory.count.create",
  "inventory.approve",
  "inventory.cost.view",
  "products.manage",
  "loyalty.manage",
  "loyalty.adjust",
  "loyalty.redeem",
  "sales.fulfillment",
  "sales.create",
  "sales.view",
  "sales.price.edit",
  "sales.wholesale",
  "sales.discount",
  "sales.return",
  "partners.view",
  "partners.manage",
  "partners.credit.manage",
  "partners.balance.adjust",
  "debts.view",
  "payments.create",
  "invoices.view",
  "invoices.issue",
  "reports.view",
  "reports.profit",
  "reports.finance",
  "users.manage",
  "roles.manage",
  "audit.view",
  "settings.manage",
] as const;
export type Permission = (typeof permissionCatalog)[number];
export interface User {
  id: string;
  username: string;
  name: string;
  owner: boolean;
  active: boolean;
  mustChangePassword: boolean;
  warehouseIds: string[];
  permissions: string[];
  roles: { id: string; name: string }[];
}
export type AuthRequest = Request & { user: User; tokenHash: string };
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return (
    salt + ":" + ((await scrypt(password, salt, 64)) as Buffer).toString("hex")
  );
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function requirePermission(user: User, permission: Permission) {
  if (!user.owner && !user.permissions.includes(permission))
    throw new ForbiddenException("Bạn chưa được cấp quyền cho thao tác này.");
}

export function requireWarehouse(user: User, warehouseId: string) {
  if (!user.owner && !user.warehouseIds.includes(warehouseId))
    throw new ForbiddenException("Kho này nằm ngoài phạm vi tài khoản.");
}

@Injectable()
export class AuthService {
  constructor(private readonly db: Database) {}

  async user(id: string): Promise<User> {
    const result = await this.db.pool.query(
      "SELECT id,username,name,owner,active,must_change_password,warehouse_ids FROM users WHERE id=$1",
      [id],
    );
    const row = result.rows[0];
    if (!row?.active)
      throw new UnauthorizedException("Tài khoản đã bị vô hiệu hóa.");
    const roles = (
      await this.db.pool.query(
        "SELECT r.id,r.name,r.permissions FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1",
        [id],
      )
    ).rows;
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      owner: row.owner,
      active: row.active,
      mustChangePassword: row.must_change_password,
      warehouseIds: row.warehouse_ids,
      roles: roles.map((role) => ({ id: role.id, name: role.name })),
      permissions: row.owner
        ? [...permissionCatalog]
        : [...new Set<string>(roles.flatMap((role) => role.permissions))],
    };
  }

  async login(username: string, password: string) {
    const row = (
      await this.db.pool.query(
        "SELECT id,password_hash,active FROM users WHERE username=$1",
        [username.toLowerCase()],
      )
    ).rows[0];
    const valid = await verifyPassword(
      password,
      row?.password_hash ??
        "no-user:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    );
    if (!row?.active || !valid) {
      await audit(this.db.pool, null, "LOGIN_FAILED", null, { username });
      throw new UnauthorizedException(
        "Tên đăng nhập hoặc mật khẩu không đúng.",
      );
    }
    const token = randomBytes(32).toString("base64url");
    await this.db.pool.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
      [tokenHash(token), row.id],
    );
    await audit(this.db.pool, row.id, "LOGIN", row.id);
    return { token, user: await this.user(row.id), expiresIn: 28800 };
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly db: Database,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.headers.authorization?.match(
      /^Bearer ([A-Za-z0-9_-]{40,100})$/,
    )?.[1];
    if (!token) throw new UnauthorizedException("Vui lòng đăng nhập.");
    request.tokenHash = tokenHash(token);
    const session = (
      await this.db.pool.query(
        "SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()",
        [request.tokenHash],
      )
    ).rows[0];
    if (!session)
      throw new UnauthorizedException("Phiên đã hết hạn hoặc bị thu hồi.");
    request.user = await this.auth.user(session.user_id);
    const path = request.path.replace(/\/$/, "");
    if (
      request.user.mustChangePassword &&
      !["/api/me", "/api/auth/password", "/api/auth/logout"].includes(path)
    ) {
      throw new ForbiddenException("Bạn cần đổi mật khẩu trước khi sử dụng.");
    }
    return true;
  }
}
