import { useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { View } from "react-native";
import { pickPhoto, PhotoDraft } from "@/lib/photos";
import { useCommand } from "@/lib/api";
import { Button, Caption, Field, Notice } from "./ui";
import { ProductPicture } from "./pos-ui";
import { PhotoImage } from "./private-photo";

export function ProductImageEditor({ value, onChange, name, category, disabled, onBusyChange }: {
  value: string; onChange: (value: string) => void; name: string; category: string; disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const command = useCommand();
  const [draft, setDraft] = useState<PhotoDraft>();
  const [picking, setPicking] = useState(false);
  const uploadKey = useRef("");
  const pickingRef = useRef(false);
  const busy = disabled || command.pending || picking;
  useEffect(() => { onBusyChange(command.pending || picking || Boolean(draft)); }, [command.pending, picking, draft, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);
  const upload = async (photo: PhotoDraft) => {
    const result = await command.run<{ imageUrl: string }>("/photos/product", { base64: photo.base64 }, "POST", uploadKey.current);
    if (result) { onChange(result.imageUrl); setDraft(undefined); }
  };
  const choose = async (camera: boolean) => {
    if (busy || pickingRef.current) return;
    pickingRef.current = true;
    setPicking(true);
    command.setError("");
    try {
      const photo = await pickPhoto(camera);
      if (photo) { setDraft(photo); uploadKey.current = Crypto.randomUUID(); await upload(photo); }
    } catch (error) { command.setError(error instanceof Error ? error.message : "Không mở được ảnh. Vui lòng thử lại."); }
    finally { setPicking(false); pickingRef.current = false; }
  };
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      {draft ? <PhotoImage uri={draft.uri} label="Ảnh hàng hóa vừa chọn" width={80} height={80} /> : <ProductPicture product={{ name, category, image_url: value }} size={80} />}
      <View style={{ flex: 1, gap: 6 }}>
        <Caption>{picking || command.pending ? "Đang xử lý và tải ảnh…" : value ? "Ảnh hàng hóa" : "Thêm ảnh để dễ nhận biết hàng hóa"}</Caption>
        <Caption>Nhấn Lưu để áp dụng thay đổi ảnh vào hàng hóa.</Caption>
      </View>
    </View>
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}><Button title={value ? "Thay ảnh" : "Chọn ảnh"} secondary disabled={busy} onPress={() => void choose(false)} /></View>
      <View style={{ flex: 1 }}><Button title="Chụp ảnh" secondary disabled={busy} onPress={() => void choose(true)} /></View>
    </View>
    {value || draft ? <Button title="Xóa ảnh sản phẩm" secondary disabled={busy} onPress={() => { onChange(""); setDraft(undefined); command.setError(""); }} /> : null}
    {command.error ? <><Notice error>{command.error}</Notice>{draft ? <Button title="Thử tải ảnh lại" disabled={busy} onPress={() => void upload(draft)} /> : null}</> : null}
    <Field label="Hoặc dùng đường dẫn ảnh" accessibilityLabel="Đường dẫn ảnh sản phẩm (HTTP/HTTPS)" value={value.startsWith("/api/photos/") ? "" : value}
      onChangeText={url => { setDraft(undefined); onChange(url); }} editable={!busy} autoCapitalize="none" keyboardType="url" placeholder={value.startsWith("/api/photos/") ? "Đang dùng ảnh đã tải lên" : "Dán đường dẫn HTTP/HTTPS"} />
  </View>;
}
