# Bắt đầu dùng HTAgri tại cửa hàng

Bản Android 17 dùng dữ liệu thật trên máy chủ hiện tại. Đã dọn hàng hóa, lô, khách/nhà cung cấp, đơn, phiếu kho, công nợ, thanh toán, điểm và ảnh thử. Chỉ giữ tài khoản chủ cửa hàng, tạo kho trống và role Chủ cửa hàng. Các thiết bị phải đăng nhập lại.

1. Cài cập nhật APK HTAgri lên bản trước, không cần gỡ ứng dụng.
2. Đăng nhập bằng tài khoản owner và mật khẩu hiện tại. App yêu cầu tự đổi mật khẩu trước khi truy cập dữ liệu. Không gửi mật khẩu mới qua chat.
3. Vào Quản trị nội bộ: tạo role với quyền cần dùng, tạo tài khoản nhân viên và gán kho/role. Ba tài khoản thử cũ đã bị xóa.
4. Tạo sản phẩm thật: tên, SKU, nhóm, đơn vị, quy đổi, giá và ảnh. Admin cấu hình số chấm và quy tắc tích/đổi điểm nếu sử dụng.
5. Tạo nhà cung cấp và phiếu Nhập hàng. Người có quyền duyệt ghi sổ phiếu để tăng tồn. Không nhập tồn bằng dữ liệu minh họa.
6. Tạo khách hàng nếu cần theo dõi công nợ/điểm. Bán tại quầy, chọn hàng, kiểm tra số tiền nhận rồi ghi nhận đơn.

Lưu thành công thì app đọc lại dữ liệu từ API; thao tác lỗi giữ nội dung để thử lại, không tự báo đã ghi sổ. Các màn đang mở làm mới khi quay lại app và theo nhịp 30 giây; có thể kéo để làm mới ngay. Khi mất mạng chỉ xem dữ liệu đã tải và lưu nháp, chưa ghi nhận thay đổi kho/tiền.

Bản cập nhật phân biệt thế hệ dữ liệu của máy chủ, xóa cache/giỏ nháp của giai đoạn thử khi đăng nhập. Các lệnh ghi vẫn dùng khóa chống trùng. Ảnh sản phẩm/chứng từ lưu trong PostgreSQL; ảnh cánh đồng chỉ là trang trí cục bộ.

## Máy chủ tạm thời

Theo lựa chọn ngày 03/11/2026, tiếp tục dùng Render Free hiện có; không tạo chi phí hay tài nguyên mới. Database hiện hết hạn ngày 30/11/2026. Cần chuyển và đối chiếu dữ liệu **trước 30/11/2026**; đây chưa phải hạ tầng vận hành lâu dài. Free web service có thể ngủ sau thời gian không truy cập.

Bản sao lưu trước khi dọn được giữ riêng trên máy của chủ dự án trong .local/backups, đã khôi phục thử và đối chiếu đủ 21 bảng/các ảnh. Không đưa backup, mật khẩu, token hoặc dữ liệu cá nhân lên trang phát hành.

Phiếu bán PDF là chứng từ nội bộ; nhà cung cấp hóa đơn điện tử và máy in chưa cấu hình. Camera/in trên điện thoại cần nghiệm thu thực tế. iOS chưa có gói ký/phân phối trong lần này.
