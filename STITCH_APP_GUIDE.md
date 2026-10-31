# Dùng AgriStock Test 3

Cài [APK Android](artifacts/AgriStock-lan-test-3.apk) và làm theo [kết nối Wi-Fi](LAN_TEST.md). Bản Test 3 dùng chung máy chủ và dữ liệu của bản Test trước. Không cần Expo Go hoặc Metro. Chưa có kết quả nghiệm thu trên điện thoại thật; bảng thử trong hướng dẫn Wi-Fi giúp bạn kiểm tra camera, in và mất mạng trên thiết bị.

## Tổng quan và chọn kho

Chạm tên kho trên đầu màn hình để chọn nơi làm việc. Tồn kho, báo cáo, đơn và công nợ theo phạm vi tài khoản và kho đang chọn. Chủ cửa hàng thêm/đổi tên kho trong **Thêm → Cửa hàng & bảo mật**; cấp kho cho nhân viên trong **Quản trị nội bộ**. Không đổi tên kho để thay thế thao tác chuyển kho.

Tổng quan hiển thị doanh thu ngày và các công việc chờ. Các thẻ nhanh mở bán hàng, nhập hàng, hàng hóa, chứng từ, công nợ, điểm thưởng và báo cáo. Biểu tượng chuông mở cảnh báo thực tế về phiếu chờ, công nợ và hạn sử dụng theo quyền.

## Bán hàng

1. Chọn **Bán tại quầy** hoặc **Bán giao hàng**, chọn khách và tìm/quét hàng.
2. Bấm thêm, tăng/giảm số lượng. Mở phần số lượng/đơn vị để đổi đơn vị; sửa giá hoặc chiết khấu cần đúng quyền.
3. Nếu chương trình cho phép, bật **Dùng điểm trừ tiền**, nhập số điểm; xem số dư, giảm bằng điểm và tổng thanh toán do máy chủ tính.
4. Chọn tiền mặt, chuyển khoản hoặc ghi nợ; đơn ghi nợ cần khách có hồ sơ và hạn mức. Có thể ghi chú đơn và chọn bước giao hàng ban đầu.
5. Chọn **Lưu tạm** để giữ nháp hoặc **Ghi nhận đơn bán** để trừ tồn và ghi sổ. Sau xác nhận, có thể xuất phiếu PDF/chia sẻ hoặc in qua dịch vụ Android đã cài.

Khi mất mạng chỉ lưu nháp, chưa ghi nhận kho và tiền. Không tạo đơn mới để thay một giao dịch đang chờ kết quả; thử lại cùng nháp để tránh nhân đôi. Quét mã cần điện thoại có camera và cấp quyền cho app.

## Hàng hóa và kho

Mở **Thêm → Kho hàng** để tìm theo tên, SKU, mã vạch; lọc nhóm hàng, thiếu tồn, cận/hết hạn. Thêm hoặc sửa hàng gồm đơn vị quy đổi, giá, thông tin kỹ thuật, đường dẫn ảnh và số chấm. Chưa có ảnh sẽ hiện biểu tượng nhóm hàng.

Số chấm từng SKU là tỷ lệ phần trăm: `0,1` là 0,1%; `0,5` là 0,5%. Bút chì mở chỉnh tỷ lệ; **Sửa hàng loạt** áp dụng cho các SKU đã chọn. Chương trình cần được bật và cấu hình trước khi phát sinh điểm.

Các mục nhập, xuất, kiểm kê, chuyển kho và hủy hàng nằm trong **Thêm → Phiếu kho & kiểm kê**. Nháp chưa đổi tồn; người có quyền duyệt ghi sổ. Chi tiết hàng có lô, hạn dùng và lịch sử tồn. Hàng trả về cách ly; chỉ mở bán lại lô đủ điều kiện sau khi người có quyền kiểm tra và ghi lý do.

## Đơn hàng, giao hàng và công nợ

**Đơn hàng** tìm theo mã đơn, khách hoặc vận đơn và lọc theo trạng thái. Trong chi tiết, người có quyền cập nhật bước đóng gói, bàn giao, đang giao, đã giao, tên hãng và mã vận đơn. Đây là theo dõi nội bộ; chưa gọi dịch vụ báo cước/hãng vận chuyển.

Trả toàn bộ đơn cần lý do và quyền trả hàng. App hoàn phần tiền thực thu, đưa hàng vào cách ly, xử lý điểm theo cấu hình lưu lúc bán và giữ lịch sử. Bản hiện tại xử lý trả toàn bộ, chưa có trả một phần dòng hàng.

Xuất dữ liệu đơn đang lọc thành CSV để mở bằng Excel hoặc PDF; tối đa 200 đơn gần nhất theo phạm vi tài khoản. Báo cáo cũng có xuất CSV/PDF. Công nợ hỗ trợ xem dư và ghi khoản thu từng phần, cộng điểm theo quy tắc của đơn gốc nếu đủ điều kiện.

## Khách hàng và điểm thưởng

Tab **Khách hàng** có tìm kiếm, nhóm hạng, hồ sơ, ví điểm, tiền quy đổi, chi tiêu, điểm chờ và công nợ. Từ hồ sơ có thể xem lịch sử, chỉnh hồ sơ hoặc tạo đơn cho đúng khách. Người có quyền điều chỉnh điểm phải nhập số điểm và lý do; mọi lần chỉnh đều được lưu nhật ký.

**Thêm → Tích điểm khách hàng** dành cho admin: bật chương trình, đặt giá trị điểm, căn cứ tính, thời điểm cộng, cách làm tròn, giới hạn đổi, quy tắc khi trả và ngưỡng hạng. Xem [hướng dẫn điểm thưởng](LOYALTY.md) với ví dụ tính tiền.

## Nhân viên và phân quyền

**Thêm → Quản trị nội bộ** gồm nhân viên, vai trò và nhật ký. Tạo nhân viên, gán một hoặc nhiều vai trò và các kho được dùng; tài khoản mới phải đổi mật khẩu. Nhóm quyền bán hàng, kho, tài chính, điểm và quản trị được bật/tắt riêng. Vai trò Chủ cửa hàng được bảo vệ. Máy chủ kiểm tra quyền tại mỗi thao tác; ẩn menu không thay thế việc cấp quyền.

Quyền cấu hình số chấm, chỉnh điểm tay và đổi điểm khi bán là ba quyền riêng. Khi thu hồi quyền, thay đổi áp dụng cho các yêu cầu tiếp theo. Khóa tài khoản hoặc đổi quyền/phạm vi nhân viên thu hồi phiên để họ đăng nhập lại theo cấu hình mới.

## In và tích hợp

**Thêm → Kết nối & thiết bị** mô tả trạng thái từng kết nối. Phiếu bán nội bộ PDF, chia sẻ, CSV và in qua hệ thống Android đã được triển khai. Hóa đơn điện tử, in Bluetooth trực tiếp, Facebook và kết nối báo cước tự động chưa cấu hình vì thiếu nhà cung cấp/tài khoản/model. Phiếu PDF nội bộ không phải hóa đơn điện tử đã phát hành.
