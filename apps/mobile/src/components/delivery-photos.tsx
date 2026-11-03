import { useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { View } from "react-native";
import { pickPhoto, PhotoDraft } from "@/lib/photos";
import { useApi, useCommand } from "@/lib/api";
import { can, useSession } from "@/lib/session";
import { day } from "@/lib/format";
import { Button, Caption, Field, Label, Notice, Panel } from "./ui";
import { PhotoImage } from "./private-photo";

type DeliveryPhoto = { id: string; note: string; created_at: string; actor: string };
export function OrderConfirmationPhotos({ orderId, returned }: {
  orderId: string; returned: boolean;
}) {
  const query = useApi<DeliveryPhoto[]>("/orders/" + orderId + "/photos");
  const command = useCommand();
  const offline = useSession(state => state.offline);
  const [draft, setDraft] = useState<PhotoDraft>();
  const [note, setNote] = useState("");
  const [picking, setPicking] = useState(false);
  const lock = useRef(false);
  const key = useRef("");
  const submitted = useRef<Record<string, unknown> | undefined>(undefined);
  const busy = command.pending || picking;
  const canAdd = can("sales.fulfillment") && !returned && query.isSuccess && (query.data?.length || 0) < 5;
  const choose = async (camera: boolean) => {
    if (busy || lock.current) return;
    lock.current = true; setPicking(true); command.setError("");
    try {
      const photo = await pickPhoto(camera);
      if (photo) { setDraft(photo); key.current = Crypto.randomUUID(); submitted.current = undefined; }
    } catch (error) { command.setError(error instanceof Error ? error.message : "Không mở được camera. Vui lòng thử lại."); }
    finally { lock.current = false; setPicking(false); }
  };
  const save = async () => {
    if (!draft || busy) return;
    // Retain exactly the same payload/key after an ambiguous network failure.
    // Counter-sale evidence does not change delivery or payment status.
    submitted.current ??= { base64: draft.base64, note };
    const result = await command.run("/orders/" + orderId + "/photos", submitted.current, "POST", key.current);
    if (result) { setDraft(undefined); setNote(""); submitted.current = undefined; }
    else if (command.errorStatus.current !== 0) { submitted.current = undefined; key.current = Crypto.randomUUID(); }
  };
  return <Panel>
    <Label>Ảnh xác nhận đơn hàng</Label>
    <Caption>Ảnh được lưu theo đơn, kèm nhân viên và thời gian gửi. Tối đa 5 ảnh/đơn.</Caption>
    {query.isPending ? <Caption>Đang tải danh sách ảnh…</Caption> : query.error ? <><Notice error>Chưa tải được ảnh của đơn hàng.</Notice><Button title="Tải lại danh sách ảnh" secondary onPress={() => void query.refetch()} /></> : query.data?.length ? query.data.map(photo => <View key={photo.id} style={{ gap: 6 }}>
      <PhotoImage uri={"/api/photos/" + photo.id} label="Ảnh xác nhận đơn hàng" width="100%" height={260} contain />
      <Caption>{photo.actor} · {day(photo.created_at)} · {new Date(photo.created_at).toLocaleTimeString("vi-VN")}</Caption>
      {photo.note ? <Caption>{photo.note}</Caption> : null}
    </View>) : <Caption>Chưa có ảnh xác nhận.</Caption>}
    {canAdd ? <>
      <Button title={draft ? "Chụp lại ảnh xác nhận" : "Chụp ảnh xác nhận"} secondary disabled={busy || Boolean(submitted.current)} onPress={() => void choose(true)} />
      <Button title="Chọn ảnh chụp sẵn" secondary disabled={busy || Boolean(submitted.current)} onPress={() => void choose(false)} />
      {draft ? <>
        <PhotoImage uri={draft.uri} label="Ảnh xác nhận chuẩn bị gửi" width="100%" height={260} contain />
        <Field label="Ghi chú ảnh" value={note} onChangeText={setNote} maxLength={500} editable={!busy && !submitted.current} placeholder="Ví dụ: Khách xác nhận đã nhận đủ hàng tại quầy" />
        {submitted.current ? <Caption>Nội dung lần gửi trước được giữ nguyên để thử lại an toàn.</Caption> : null}
        <Caption>Ảnh chưa gửi chỉ được giữ trên màn hình này. Nhấn Lưu và chờ xác nhận trước khi rời đơn.</Caption>
        <Button title="Lưu ảnh xác nhận" pending={command.pending} disabled={picking} onPress={() => void save()} />
        <Button title="Bỏ ảnh chưa gửi" secondary disabled={busy || Boolean(submitted.current)} onPress={() => setDraft(undefined)} />
      </> : null}
      {picking ? <Caption>Đang xử lý ảnh…</Caption> : null}
    </> : null}
    {!can("sales.fulfillment") && !returned ? <Caption>Admin cần bật quyền Quản lý đơn và ảnh xác nhận trong kho để nhân viên thêm ảnh.</Caption> : null}
    {returned ? <Caption>Đơn đã trả hàng chỉ xem lại ảnh đã lưu, không thêm ảnh mới.</Caption> : null}
    {query.data?.length === 5 ? <Caption>Đơn này đã đủ 5 ảnh xác nhận.</Caption> : null}
    {offline && draft ? <Notice>Đang mất kết nối. Giữ màn hình này và thử gửi lại khi có mạng.</Notice> : null}
    {command.error ? <Notice error>{command.error}</Notice> : null}
  </Panel>;
}
