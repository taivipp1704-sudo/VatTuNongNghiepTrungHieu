# Ảnh xác nhận đơn hàng - HTAgri Android 20

Mở **Đơn hàng → chọn đơn → Ảnh xác nhận đơn hàng**. Chọn **Chụp ảnh xác nhận** hoặc **Chọn ảnh chụp sẵn**, kiểm tra ảnh, thêm ghi chú rồi nhấn **Lưu ảnh xác nhận**. Ảnh chỉ được gửi sau khi bấm lưu; giữ màn hình đến khi ảnh xuất hiện kèm nhân viên và thời gian gửi.

Admin cấp **Xem đơn bán** và **Quản lý đơn và ảnh xác nhận trong kho**. Quyền thứ hai dùng quyền hiện có `sales.fulfillment`, cũng cho phép xem đơn của đồng nghiệp trong các kho được cấp. Quyền thu tiền và trả hàng được cấp riêng. Không thay đổi quyền phía API hoặc dữ liệu đang vận hành.

Mỗi đơn tối đa 5 ảnh, ghi chú tối đa 500 ký tự. Đơn đã trả chỉ xem ảnh cũ. Không có nút sửa/xóa ảnh đã gửi. Lưu ảnh tại quầy không gửi `confirmDelivered`, không sửa thông tin vận chuyển, trạng thái thanh toán hoặc số tiền. Khi kết quả gửi chưa rõ do mất mạng, giữ nguyên ảnh/nội dung/khóa gửi để thử lại an toàn; chưa cho thay ảnh hoặc ghi chú đến khi xác định kết quả.

Đã kiểm tra:

- `npm run check`: API build và mobile TypeScript đạt.
- `node scripts/check-order-photos-ui.cjs`: 5 tình huống giao diện với dữ liệu giả được chặn hoàn toàn trong trình duyệt: chọn ảnh và lưu sau lỗi mạng, giữ nguyên nội dung/khóa khi thử lại, thiếu quyền, đơn đã trả, giới hạn 5 ảnh, lỗi tải danh sách và tải lại. Không ghi dữ liệu thử lên máy chủ vận hành.
- APK versionCode 20 build và kiểm tra chữ ký phát hành, package `vn.agristock.internal`, nhãn HTAgri, Android 7+/arm64. Giữ khóa ký cũ để cài đè.
- Hướng dẫn PDF 39 trang, 36 mục, 36 bookmark; mục lục có liên kết. Đã kiểm tra trích xuất tiếng Việt và ảnh render toàn bộ trang.

Chưa nghiệm thu camera thực tế trên điện thoại Android. Cần cài cập nhật và thử cấp quyền camera, chụp ảnh thật, gửi rồi mở lại đơn trên một thiết bị có quyền. Không coi ảnh xem trước là đã gửi thành công.

File hướng dẫn: `output/pdf/HTAgri-Huong-dan-su-dung.pdf`. Tài liệu không chứa mật khẩu. iOS chưa có bản ký/phân phối trong lần cập nhật này. Database dùng tạm cần được chuyển trước 30/11/2026 theo lựa chọn đã chốt.
