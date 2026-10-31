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
export function DeliveryPhotos({ orderId, returned, delivered, carrier, trackingCode, onDelivered }: {
  orderId: string; returned: boolean; delivered: boolean; carrier: string; trackingCode: string; onDelivered: () => void;
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
  const canAdd = can("sales.fulfillment") && !returned && (query.data?.length || 0) < 5;
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
    submitted.current ??= { base64: draft.base64, note, confirmDelivered: true, carrier, trackingCode };
    const result = await command.run("/orders/" + orderId + "/photos", submitted.current, "POST", key.current);
    if (result) { setDraft(undefined); setNote(""); submitted.current = undefined; onDelivered(); }
    else if (command.errorStatus.current !== 0) { submitted.current = undefined; key.current = Crypto.randomUUID(); }
  };
  return <Panel>
    <Label>Ảnh xác nhận giao hàng</Label>
    <Caption>Ảnh được lưu theo đơn, kèm nhân viên và thời gian gửi. Tối đa 5 ảnh/đơn.</Caption>
    {query.isPending ? <Caption>Đang tải danh sách ảnh…</Caption> : query.error ? <><Notice error>Chưa tải được ảnh của đơn hàng.</Notice><Button title="Tải lại danh sách ảnh" secondary onPress={() => void query.refetch()} /></> : query.data?.length ? query.data.map(photo => <View key={photo.id} style={{ gap: 6 }}>
      <PhotoImage uri={"/api/photos/" + photo.id} label="Ảnh giao hàng" width="100%" height={260} contain />
      <Caption>{photo.actor} · {day(photo.created_at)} · {new Date(photo.created_at).toLocaleTimeString("vi-VN")}</Caption>
      {photo.note ? <Caption>{photo.note}</Caption> : null}
    </View>) : <Caption>Chưa có ảnh xác nhận.</Caption>}
    {canAdd ? <>
      <Button title={draft ? "Chụp lại ảnh giao hàng" : "Chụp ảnh giao hàng"} secondary disabled={busy} onPress={() => void choose(true)} />
      <Button title="Chọn ảnh chụp sẵn" secondary disabled={busy} onPress={() => void choose(false)} />
      {draft ? <>
        <PhotoImage uri={draft.uri} label="Ảnh giao hàng chuẩn bị gửi" width="100%" height={260} contain />
        <Field label="Ghi chú ảnh" value={note} onChangeText={setNote} maxLength={500} editable={!busy && !submitted.current} placeholder="Ví dụ: Đã giao đủ hàng cho khách" />
        {submitted.current ? <Caption>Nội dung lần gửi trước được giữ nguyên để thử lại an toàn.</Caption> : null}
        <Caption>Ảnh chưa gửi chỉ được giữ trên màn hình này. Nhấn Lưu và chờ xác nhận trước khi rời đơn.</Caption>
        <Button title={delivered ? "Lưu ảnh xác nhận" : "Lưu ảnh và xác nhận đã giao"} pending={command.pending} disabled={picking} onPress={() => void save()} />
        <Button title="Bỏ ảnh chưa gửi" secondary disabled={busy || Boolean(submitted.current)} onPress={() => setDraft(undefined)} />
      </> : null}
      {picking ? <Caption>Đang xử lý ảnh…</Caption> : null}
    </> : null}
    {query.data?.length === 5 ? <Caption>Đơn này đã đủ 5 ảnh xác nhận.</Caption> : null}
    {offline && draft ? <Notice>Đang mất kết nối. Giữ màn hình này và thử gửi lại khi có mạng.</Notice> : null}
    {command.error ? <Notice error>{command.error}</Notice> : null}
  </Panel>;
}
