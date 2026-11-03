import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export type PhotoDraft = { uri: string; base64: string };
export async function pickPhoto(camera = false): Promise<PhotoDraft | undefined> {
  if (camera) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Chưa có quyền camera. Vào Cài đặt > Ứng dụng > HTAgri > Quyền để cho phép Camera rồi thử lại.");
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.85, allowsEditing: false, exif: false };
  const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1024 || asset.height > 1024) context.resize(asset.width >= asset.height ? { width: 1024 } : { height: 1024 });
  const rendered = await context.renderAsync();
  try {
    for (const compress of [0.7, 0.45, 0.25]) {
      const photo = await rendered.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
      if (photo.base64 && photo.base64.length <= 440000) return { uri: photo.uri, base64: photo.base64 };
    }
    throw new Error("Ảnh còn quá lớn sau khi nén. Chọn ảnh khác hoặc chụp gần nội dung đơn hàng hơn.");
  } finally {
    rendered.release();
    context.release();
  }
}
