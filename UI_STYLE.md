# Bố cục AgriStock — Android 16

Bản 16 giữ ảnh cánh đồng chìm toàn màn Tổng quan theo ảnh người dùng gửi; thẻ doanh thu xanh trong suốt, các nhóm sáng 95%. Bố cục bốn cột và các màn nghiệp vụ bản 15 được giữ.

Theo lựa chọn người dùng ngày 03/11/2026: **bố cục giống thư mục picture, giữ tông xanh lá**. Ảnh mẫu dùng để đối chiếu khoảng cách, nhóm nội dung và thao tác. Không sao chép logo, dữ liệu cá nhân hay ảnh màn hình mẫu vào app.

| Khu vực | Bố cục áp dụng |
| --- | --- |
| Tổng quan | Thanh đầu xanh, thẻ doanh thu xanh trong suốt/số trắng, ba chỉ số nhỏ, nút bán tại quầy, tám lối tắt bốn cột, các dòng chờ xử lý. Ảnh cánh đồng cục bộ phủ toàn nền, cố định khi cuộn. |
| Sản phẩm | Ô thêm sản phẩm lớn và danh mục chức năng dạng hàng phẳng; thanh điều hướng năm mục. |
| Hàng hóa | Mặc định danh sách phẳng: ảnh/tên/SKU bên trái, giá/tồn bên phải; tìm kiếm, bộ lọc, nút thêm nổi. Chế độ lưới và sửa điểm hàng loạt giữ trong công cụ. |
| Chi tiết và sửa hàng | Ảnh lớn, nhãn–giá trị gọn, giá hai cột, nhóm kho/tích điểm/kỹ thuật; ô nhập gạch dưới. Giữ tất cả trường đang có. |
| Đơn bán | Tìm kiếm, tab trạng thái gạch dưới, bộ lọc, hàng mã/khách/ngày và tiền/trạng thái; chạm để mở thu tiền/trả hàng/chứng từ. |
| Bán tại quầy | Thanh tìm kiếm riêng; nhóm hàng/chiết khấu/khách/bảng giá/hóa đơn/ghi chú; tổng tiền và Lưu tạm–Thanh toán cố định đáy. Thanh toán mở hộp xác nhận, sau đó mới ghi nhận đơn. |
| Khách hàng | Danh sách phẳng; hồ sơ có mã ở thanh đầu, avatar vàng, ba tab Thông tin–Công nợ–Lịch sử và các hàng thông tin. Bút sửa mở chung thông tin cơ bản và bổ sung. |
| Báo cáo | Thanh đầu xanh, ba nhóm Bán hàng/Kho/Tài chính, kỳ/kho gọn, thẻ chỉ số trắng và danh mục báo cáo chi tiết. Biểu đồ, bảng và xuất dữ liệu vẫn hoạt động. |

Màu chính `#087C4C`, thanh đầu `#16845B`, chữ `#292B30`, chữ phụ `#626963`, nền `#F5F5F9`, hàng/thẻ trắng, đường chia `#E4E5E9`, ô tìm `#EDEDF1`. Nút thao tác nền xanh nhạt `#E6EDD9`, chữ xanh; góc bo 6–12 thay cho viên lớn. Trạng thái luôn có nhãn chữ.

Be Vietnam Pro 400/500/600/700 cho chữ; Inter 400/700 cho tiền và số. Sáu font nhúng cục bộ, đủ dấu Việt, giữ phóng to chữ hệ thống và giấy phép OFL. Ảnh nền được tạo riêng từ bản trước, nhúng trong APK; hàng chưa có ảnh dùng biểu tượng và nhãn rõ.

Theme thật nằm trong apps/mobile/src/theme.ts. Tham chiếu design-system được sinh bằng node scripts/export-design-system.mjs. Bán tại quầy, quyền, tích điểm và API của bản 14 được giữ; không thêm bán online hay vận chuyển. Kiểm tra web không thay thế nghiệm thu camera/in/lịch và cỡ chữ hệ thống trên điện thoại thật. Xem VALIDATION.md.
