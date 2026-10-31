# Thêm ảnh hàng hóa và xác nhận giao hàng

Cài AgriStock Android bản 6 để dùng các nút chọn và chụp ảnh. Ảnh đã gửi được lưu chung trên máy chủ; các điện thoại có quyền xem cùng dữ liệu sau khi tải lại. Cần có mạng để gửi ảnh.

## Thêm, thay hoặc xóa ảnh hàng hóa

Tài khoản cần quyền **Quản lý hàng hóa** và quyền xem giá vốn như màn hình thêm/sửa hàng hóa đang yêu cầu.

1. Mở **Thêm → Kho hàng**, thêm hàng hóa hoặc mở hàng hóa rồi chọn sửa.
2. Nhấn **Chọn ảnh** để lấy ảnh trong điện thoại, hoặc **Chụp ảnh** để mở camera.
3. Chờ ảnh tải xong và kiểm tra ảnh xem trước. Có thể nhấn **Thay ảnh** hoặc **Xóa ảnh sản phẩm**.
4. Nhấn **Lưu** để áp dụng thay đổi vào hàng hóa. Nếu rời màn hình trước khi lưu, ảnh của hàng hóa vẫn giữ như trước.

Xóa ảnh rồi lưu sẽ gỡ ảnh khỏi hàng hóa và xóa tệp ảnh đã tải lên đó. Bạn cần chọn lại tệp gốc nếu muốn khôi phục.

Ô **Hoặc dùng đường dẫn ảnh** vẫn nhận URL HTTP/HTTPS. Khi đang dùng ảnh tải lên, ô này để trống và có chữ **Đang dùng ảnh đã tải lên**.

## Chụp ảnh khi giao hàng xong

Admin cấp cho role nhân viên quyền **Xem đơn hàng** và **Đóng gói, giao hàng và ảnh xác nhận**, đồng thời chọn kho nhân viên được làm việc.

1. Vào **Đơn hàng**, tìm đơn và mở **Chi tiết đơn / trả hàng**.
2. Tại **Ảnh xác nhận giao hàng**, nhấn **Chụp ảnh giao hàng**. Nếu đã chụp trước, chọn **Chọn ảnh chụp sẵn**.
3. Kiểm tra ảnh, nhập **Ghi chú ảnh** nếu cần.
4. Nhấn **Lưu ảnh và xác nhận đã giao**. Với đơn đã có trạng thái Đã giao, nút có tên **Lưu ảnh xác nhận**.
5. Chờ ảnh xuất hiện kèm tên nhân viên và thời gian gửi rồi mới rời đơn.

Mỗi đơn lưu tối đa 5 ảnh. Nhân viên không sửa hoặc xóa ảnh đã gửi. Đơn trả hàng vẫn giữ ảnh cũ và không nhận thêm ảnh giao hàng. Nút **Lưu giao hàng** vẫn cập nhật trạng thái độc lập; ảnh xác nhận được gửi bằng nút lưu ảnh.

## Khi ảnh chưa gửi được

- **Chưa có quyền camera:** vào Cài đặt của điện thoại → Ứng dụng → AgriStock → Quyền, cho phép Camera rồi thử lại.
- **Mất kết nối:** giữ nguyên màn hình và nhấn lưu lại khi có mạng. Ảnh chưa gửi chưa được lưu trên máy chủ và sẽ mất nếu rời màn hình hoặc đóng app. Nội dung lần gửi chưa rõ kết quả được giữ nguyên để gửi lại không tạo trùng.
- **Ảnh hỏng hoặc quá lớn:** chọn ảnh JPG/PNG/WebP khác. App tự thu nhỏ và nén ảnh trước khi tải lên.
- **Chưa tải được ảnh:** nhấn **Tải lại ảnh** hoặc **Tải lại danh sách ảnh**.
- **Kho ảnh thử nghiệm đã đầy:** liên hệ quản trị viên. Môi trường thử giới hạn tổng dung lượng ảnh 128 MB; mỗi ảnh sau xử lý tối đa 350 KB. Các ảnh nằm cùng dữ liệu thử, có cùng hạn lưu trữ được ghi trong [hướng dẫn cài Android](REMOTE_ANDROID.md).

Ảnh giao hàng ghi nhận thời gian gửi lên máy chủ. App không xác minh địa điểm, thời điểm chụp hay người nhận từ nội dung ảnh.
