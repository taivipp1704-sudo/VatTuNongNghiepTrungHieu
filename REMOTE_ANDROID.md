# Thử AgriStock Android từ xa — bản 16

[Tải APK](https://github.com/taivipp1704-sudo/VatTuNongNghiepTrungHieu/releases/download/android-landscape-v16/AgriStock-internal-signed-16.apk). App có tên **AgriStock**, Android 7.0+ arm64, bản ký riêng số 16. Đã cài sẵn API cloud `https://agristock-trunghieu-test-1704.onrender.com`. Người nhận dùng Wi-Fi bất kỳ hoặc 4G/5G; laptop của người phát triển có thể tắt. Không cần Expo Go hoặc Metro.

Bản 16 giữ bố cục picture của bản 15 và đưa ảnh cánh đồng chìm về toàn nền Tổng quan. Khối doanh thu dùng xanh trong suốt, các nhóm phía dưới dùng lớp sáng để đọc rõ. Giữ lối tắt bốn cột, chức năng và máy chủ hiện tại. Cài cập nhật trực tiếp, không cần gỡ bản trước.

Bản 15 thiết kế lại bố cục theo bộ ảnh picture, giữ tông xanh lá: tổng quan bốn cột lối tắt, danh sách sản phẩm/đơn phẳng, trung tâm Sản phẩm dạng menu, hồ sơ khách ba tab, POS với thanh thanh toán cố định và báo cáo theo nhóm. Giữ toàn bộ chức năng bản 14. Cài cập nhật trực tiếp bằng cùng khóa ký, không cần gỡ app. Backend cloud hiện tại được giữ. Xem [bố cục](UI_STYLE.md).

Bản 14 đổi chữ sang **Be Vietnam Pro**, giữ Inter cho số tiền; thêm trung tâm Sản phẩm, giá sỉ, thuộc tính hàng, thiết lập tồn theo kho, tem mã vạch/QR, hồ sơ khách bổ sung, sổ công nợ, chiết khấu %, giỏ tạm giữ và báo cáo Kho/Tài chính. Giữ bán tại quầy, ảnh nền chìm và nút cùng tông. Xem [phạm vi chức năng và cách đối chiếu mẫu](FUNCTION_PARITY.md). Cài cập nhật trực tiếp, không cần gỡ bản trước.

Quyền mới: **Bán theo bảng giá sỉ**, **Điều chỉnh số dư sổ nợ khách**, **Xem báo cáo thu chi**. Chủ cửa hàng có đầy đủ quyền; admin bật từng quyền cho role phù hợp trong Quản trị nội bộ. Quyền mới không tự thêm vào các role nhân viên đang có.


Bản 13 đồng bộ nút theo ảnh mẫu: Bán tại quầy là viên trong suốt cùng khối doanh thu; trạng thái dùng chung khung sáng, bỏ nền cam/xanh đặc. Nút lưu/thanh toán, bộ lọc và tab chọn dùng xanh nhạt cùng tông; nút biểu tượng tròn nhẹ. Giữ ảnh nền chìm và toàn bộ chức năng bản 12. Cài cập nhật lên bản trước bằng cùng khóa ký, giữ tài khoản hiện tại.

Bản 12 thêm ảnh cánh đồng chìm sau toàn màn hình tổng quan theo ảnh mẫu người dùng làm rõ. Khối doanh thu dùng lớp xanh bán trong suốt, các nhóm trạng thái/lối tắt/báo cáo có nền sáng bán trong suốt. Ảnh nền được tạo riêng và nhúng trong app, không cần mạng để tải ảnh nền. Các màn nghiệp vụ, ảnh sản phẩm và chức năng bản 11 được giữ. Cài cập nhật lên bản trước, không cần gỡ app hoặc đổi tài khoản.

Bản 11 áp dụng hướng Smart Garden trong [video tham khảo](VIDEO_UI.md): xanh rừng đậm, lime và nền sáng ấm; nút Bán tại quầy nổi bật, thẻ ảnh hàng hóa hai cột, chuyển sang danh sách, ảnh chi tiết lớn và dải Hàng trong kho ở tổng quan. Sửa điểm hàng loạt dùng danh sách; bộ lọc và chức năng cũ được giữ. Hàng chưa có ảnh hiện nhãn rõ, không dùng ảnh minh họa làm ảnh sản phẩm. Xem [bố cục và màu](UI_STYLE.md). Cài cập nhật lên bản trước bằng cùng khóa ký, dùng tài khoản hiện tại.

Bản 10 thiết kế lại theo repo baoyu-design người dùng gửi: xanh cobalt đậm và cam, thanh đầu trang màu đậm, doanh thu và nút Bán tại quầy chung một khối, trạng thái có màu đặc và lối tắt hai cột. Kho gom hai nút Thêm hàng/Sửa số chấm; báo cáo đặt nút Hiện tại cạnh tiêu đề. Xem [bố cục và màu mới](UI_STYLE.md). Cài cập nhật lên bản trước, dùng tài khoản hiện tại.

Bản 9 đổi font sang Inter cho nội dung và số tiền, Manrope cho tiêu đề; phối navy, xanh ngọc, xanh dương và cam. Tiền thực thu, công nợ và trạng thái có màu/nhãn riêng. Tăng độ rõ chữ phụ, nhãn ô nhập, giá bán và nút chính. Xem [font và phối màu](UI_STYLE.md). Cài cập nhật lên bản trước, dùng tài khoản hiện tại.

Bản 8 tập trung **bán tại quầy**, trạng thái theo số tiền đã thanh toán, tổng chi tiêu/lịch sử mua của khách và biểu đồ doanh thu ngày/tuần/tháng/quý/năm. Giao diện xanh lá đậm và cam, bỏ các mục tra cước, vận chuyển và kênh bán ngoài. Giữ quyền nhân viên, ảnh sản phẩm, nhập/sửa/trả hàng và tích điểm tùy chỉnh. Xem [hướng dẫn bán tại quầy](COUNTER_APP.md), gồm cách thu thêm tiền trên đơn còn nợ và phân biệt doanh thu với thực thu. Trả hàng hiện áp dụng toàn bộ đơn.

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


Bản 6 thêm chọn/chụp, thay và xóa ảnh sản phẩm, cùng ảnh xác nhận giao hàng theo đơn và theo quyền nhân viên. Xem [hướng dẫn dùng ảnh](PHOTOS.md). Bố cục hàng hóa vẫn giữ 15 trường, nút quét mã và cấu hình số chấm. Cài cập nhật lên bản AgriStock trước bằng cùng khóa ký. Giữ tài khoản và địa chỉ cloud hiện tại; nếu đã đổi mật khẩu thì dùng mật khẩu đang dùng.

Bản 7 sửa nút **Sửa quyền / khóa tài khoản**, mở riêng đúng biểu mẫu và cho lưu độc lập trạng thái hoạt động, vai trò, kho. Xem [hướng dẫn quản lý nhân viên](EMPLOYEE_ACCESS.md). Các chức năng ảnh và bố cục bản 6 được giữ.
