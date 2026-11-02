# Dùng AgriStock để bán tại quầy

Bản Android hiện tại tập trung vào bán trực tiếp ở cửa hàng, giữ quản lý nhân viên, phân quyền, ảnh sản phẩm và tích điểm. Các mục bán giao hàng, tra cước, vận chuyển và kênh bán ngoài được bỏ khỏi giao diện. Bản 11 dùng [font Inter/Manrope, xanh rừng–lime và thẻ ảnh](UI_STYLE.md) để làm rõ thông tin và thao tác.

## Nhập, bán, sửa và trả hàng

- **Nhập hàng:** mở nút Nhập hàng, chọn kho, nhà cung cấp, sản phẩm, số lượng và giá vốn; lưu và duyệt phiếu theo quyền được cấp.
- **Bán hàng:** chọn Bán tại quầy, thêm hàng và chọn khách. Nhân viên có quyền Sửa giá bán được sửa giá ngay trên dòng hàng; giá vốn vẫn dùng để tính lãi theo phân quyền.
- **Sửa hàng hóa:** mở Hàng hóa → chọn sản phẩm → Chỉnh sửa hàng hóa. Giữ ảnh, mã hàng, giá, số chấm và các trường đang có. Đơn vị/quy đổi đã sử dụng vẫn được bảo vệ để không làm sai lịch sử kho.
- **Trả hàng:** mở đơn và chọn trả toàn bộ. App hoàn số tiền đã thu, xử lý nợ và điểm theo quy tắc của đơn, đưa hàng về cách ly. Bản này giữ luồng trả toàn bộ đơn; chưa thêm trả riêng một phần dòng hàng.

## Theo dõi đơn chưa thanh toán

**Đang giao dịch** là đơn còn tiền phải thu, kể cả đã nhận một phần. **Hoàn thành** là đơn đã thanh toán đủ. Trạng thái được tính theo tiền của đơn, không dùng trạng thái giao hàng.

Nhân viên có quyền **Ghi nhận thu/chi công nợ** mở chi tiết đơn, nhập Số tiền nhận thêm và xác nhận. Khi nhận đủ tiền, đơn tự chuyển Hoàn thành. Đơn đã trả có nhãn riêng và vẫn giữ lịch sử.

## Xem khách đã mua bao nhiêu

Vào Khách hàng, chọn đúng người. Màn hình hiển thị tổng tiền hàng sau trả hàng, số tiền khách đã trả, số còn phải thu và số đơn. Nhấn Xem lịch sử mua hàng để xem ngày mua, các mặt hàng và trạng thái từng đơn; có thể mở danh sách đơn đúng khách đó.

Các số liệu giới hạn theo kho và quyền của tài khoản. Nhân viên chỉ được xem đơn mình có quyền truy cập. Điểm thưởng có lịch sử riêng trong hồ sơ khách hàng.

## Xem biểu đồ doanh thu

Vào Báo cáo và chọn **Ngày, Tuần, Tháng, Quý hoặc Năm**. Dùng mũi tên để đổi kỳ hoặc nhấn Hiện tại cạnh tiêu đề. Tuần bắt đầu vào thứ Hai; các mốc dùng giờ Việt Nam.

- **Doanh thu thuần:** tiền hàng sau giảm giá của đơn lập trong kỳ, trừ giá trị hàng trả trong kỳ. Trả hàng ở kỳ sau ghi giảm ở kỳ trả, không xóa doanh thu của kỳ bán trước đó.
- **Thực thu:** tiền nhận từ bán hàng/thu nợ, trừ tiền hoàn trong kỳ, theo ngày nhận hoặc hoàn tiền. Không gộp chi trả nhà cung cấp vào doanh thu bán hàng.
- **Chưa thanh toán:** số tiền còn phải thu trên các đơn lập trong kỳ.
- **Giá vốn và lãi gộp:** chỉ hiển thị khi được cấp quyền Xem lãi gộp. Đây là lãi gộp từ hàng bán, chưa phải lợi nhuận sau mọi chi phí vận hành.

Đổi giữa Doanh thu và Thực thu trên biểu đồ. Chạm cột hoặc dùng nút trước/sau để xem từng mốc. Xuất Excel (CSV) hoặc PDF để lấy số liệu của kỳ đang chọn.

## Thiết lập tích điểm theo từng mặt hàng

Admin đặt số chấm riêng cho từng sản phẩm; **0** là không tích điểm. Vào Tích điểm khách hàng, chọn **Khi thu đủ 100% tiền** để đơn còn nợ chỉ có điểm chờ và chưa cộng vào ví. Quy tắc mới áp dụng cho đơn mới; đơn cũ giữ quy tắc đã lưu khi bán. Các lựa chọn chương trình điểm khác vẫn do admin quyết định.

## Các ý bổ sung từ ghi âm

Phần ghi âm được chuyển thành bản chép để đối chiếu với ảnh tham khảo. Các ý áp dụng: sửa giá lúc bán, giữ giá vốn để xem lãi; theo dõi chi tiêu/lịch sử mua của khách; cho phép loại từng mặt hàng khỏi tích điểm; dùng chế độ thu đủ mới cộng điểm. Số tiền ví dụ nghe chưa rõ không được đưa vào dữ liệu hay cấu hình. Đoạn cuối dừng giữa câu nên không suy diễn thêm quy tắc.

Ảnh và ghi âm tham khảo không được nhập thành dữ liệu thật của cửa hàng. APK vẫn kết nối môi trường thử cloud; hướng dẫn cài và hạn lưu dữ liệu nằm trong [Thử Android từ xa](REMOTE_ANDROID.md).
