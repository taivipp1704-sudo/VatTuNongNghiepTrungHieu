# Thử AgriStock Android từ xa — bản 4

[Tải APK](https://github.com/taivipp1704-sudo/VatTuNongNghiepTrungHieu/releases/download/android-remote-test-v4/AgriStock-internal-signed-4.apk). App có tên **AgriStock**, Android 7.0+ arm64, bản ký riêng số 4. Đã cài sẵn API cloud `https://agristock-trunghieu-test-1704.onrender.com`. Người nhận dùng Wi-Fi bất kỳ hoặc 4G/5G; laptop của người phát triển có thể tắt. Không cần Expo Go hoặc Metro.

## Cài và đăng nhập

1. Tải APK bằng trình duyệt điện thoại, mở tệp và cho phép trình duyệt cài ứng dụng khi Android yêu cầu.
2. Mở **AgriStock**. Nếu đã cài bản AgriStock trước và app giữ địa chỉ cũ, mở **Cấu hình kết nối cửa hàng**, nhập `https://agristock-trunghieu-test-1704.onrender.com`; không thêm `/api`.
3. Chủ cửa hàng cấp tài khoản `tester` và mật khẩu qua kênh riêng. Đổi mật khẩu lần đầu, tối thiểu 12 ký tự. Không dùng mật khẩu từ database trên laptop.
4. Có 3 hàng mẫu, tồn thử và khách hàng thử điểm mang nhãn `[TEST]`. Cấu hình mặc định của môi trường thử: phân bón 0,1%, thuốc 0,5%, 1 điểm = 1.000đ. Admin có thể đổi các giá trị trong app.
5. Thử nhập/duyệt phiếu, bán hàng, dùng điểm, thu nợ, trả hàng, chia sẻ PDF và phân quyền trên dữ liệu thử. Các điện thoại cùng xem dữ liệu cloud sau khi tải lại.

Tài khoản `tester` có vai trò quản trị thử nghiệm trên kho thử; chủ cửa hàng có thể giảm quyền hoặc khóa tài khoản trong Quản trị nội bộ. Mật khẩu không nằm trong APK, mã nguồn hoặc trang tải.

## Khi máy chủ Free đang ngủ

Render Free có thể ngủ sau 15 phút không truy cập. Lần đầu mở có thể chờ khoảng một phút. Nếu app báo lỗi kết nối ở lần đầu, mở [trang kiểm tra máy chủ](https://agristock-trunghieu-test-1704.onrender.com/api/health), chờ đến khi thấy `status: ok`, rồi quay lại đăng nhập. Không chạy công cụ giữ máy chủ luôn thức.

API và PostgreSQL đều chọn gói Free, không tự nâng cấp gói trả phí. Database thử hiện hết hạn ngày **30/11/2026**. Đây là môi trường thử; sao lưu/chuyển dữ liệu trước ngày hết hạn nếu muốn giữ. Giới hạn: https://render.com/docs/free

Đã kiểm tra nghiệp vụ trực tiếp qua HTTPS và xác minh APK. Chưa nghiệm thu cài/mở, camera và in trên điện thoại thật. iPhone cần bản build và phân phối Apple riêng; APK này dành cho Android.
