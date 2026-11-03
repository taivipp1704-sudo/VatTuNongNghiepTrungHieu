# HTAgri — máy chủ dùng tạm cho cửa hàng

Ngày 03/11/2026: đã sao lưu logic toàn database (trừ phiên đăng nhập), khôi phục vào database QA riêng và đối chiếu toàn bộ 21 bảng/các ảnh. Sau đó dọn dữ liệu thử theo yêu cầu người dùng trong một giao dịch; giữ một chủ cửa hàng, một kho trống và role chủ. Các bảng nghiệp vụ đều bằng 0; phiên cũ bị thu hồi, chủ cần đổi mật khẩu. Chức năng chuyển thử đã khóa sau hoàn tất. Kết quả không chứa bí mật tại artifacts/htagri-cloud-go-live-validation.json.

Người dùng chọn dùng tạm hạ tầng hiện tại và chuyển trước 30/11/2026; không tạo tài nguyên trả phí. API source 74842201a795e7b5927af3ea7cf172bed05c4137, Render deployment dep-dbko4kss728c738tfjp0. Sao lưu trước dọn nằm riêng trong .local/backups, không công bố lên GitHub.

Xem [cách bắt đầu](HTAGRI_START.md). Các đoạn bên dưới là lịch sử giai đoạn thử, không mô tả dữ liệu hiện tại.

---

# Môi trường thử AgriStock từ xa

API: `https://agristock-trunghieu-test-1704.onrender.com`.

Đây là môi trường Render Free trong workspace BookingReview đã được chọn để thử. Điện thoại dùng Internet riêng; máy tính phát triển có thể tắt. Không cần Expo Go, Metro hoặc cùng Wi-Fi.

Ngày 02/11/2026, API quản lý cửa hàng đã triển khai thành công từ commit `2a6956c7f06fe90d1e916f2e1d6b5c19b1e8b864`. Đã kiểm tra qua HTTPS: báo cáo kho/thu chi, thông tin tồn và lịch sử sản phẩm, sổ công nợ khách, danh mục quyền mới, tìm kiếm và phân trang. Đối chiếu trạng thái API trước/sau: 4 hàng hóa, 2 đối tác, 3 đơn, 1 phiếu kho, 1 khoản nợ và 3 phiếu bán giữ nguyên các thông tin nghiệp vụ được kiểm tra. Không tạo giao dịch bán thử trên cloud trong lần cập nhật này.

Kiểm tra trạng thái: [API health](https://agristock-trunghieu-test-1704.onrender.com/api/health). Sau khi dừng API, Metro và PostgreSQL QA cục bộ, API cloud vẫn trả `status: ok`. Không tạo thêm tài nguyên hoặc nâng gói trả phí.

Giữ tài khoản và mật khẩu hiện tại. Quyền bán sỉ, điều chỉnh sổ nợ và xem báo cáo tài chính cần được chủ cửa hàng/admin bật cho role phù hợp; không tự thêm vào role nhân viên đang có. Không công bố mật khẩu ở trang tải hoặc trong APK.

## Giới hạn môi trường thử

- Render Free có thể ngủ khi không có truy cập. Nếu lần đầu đăng nhập chờ lâu, mở trang health, chờ `ok` rồi thử lại.
- PostgreSQL Free hiện hết hạn ngày **30/11/2026**. Chuyển hoặc sao lưu dữ liệu trước hạn nếu cần giữ để vận hành tiếp.
- Kết nối database từ bên ngoài đang bị chặn. Bản đối chiếu trạng thái API không thay cho sao lưu toàn database; lần cập nhật này không thay quy tắc mạng. Sao lưu–khôi phục đầy đủ đã kiểm tra trên database QA riêng, gồm ảnh và các bảng mới.
- Phiếu bán nội bộ chưa tính thuế; nhà cung cấp hóa đơn điện tử vẫn chưa cấu hình. Chưa nghiệm thu camera, lịch native và máy in trên điện thoại thật.

Xem [cài APK Android](REMOTE_ANDROID.md) và [phạm vi chức năng](FUNCTION_PARITY.md). APK dành cho Android; iOS cần bản ký và cách phân phối riêng.
