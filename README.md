# Vật tư nông nghiệp Trung Hiếu — AgriStock

Ứng dụng mobile React Native/Expo cho Android và iOS; API NestJS/PostgreSQL. Môi trường Render hiện dùng để thử từ xa, không dùng dữ liệu vận hành thật.

- `apps/mobile`: mã giao diện, kho, bán hàng, khách hàng, số chấm và phân quyền.
- `apps/api`: backend giao dịch và kiểm tra quyền trên server.
- `STITCH_APP_GUIDE.md`: hướng dẫn các chức năng đã triển khai.
- `LOYALTY.md`: quy tắc tích/đổi/hoàn điểm.

Render: Dockerfile `apps/api/Dockerfile`, build context `apps/api`, command `node cloud-start.cjs`, region Singapore, plan Free. `DATABASE_URL`, `AGRISTOCK_OWNER_PASSWORD` và các cấu hình riêng đặt trong Render Environment, không commit. `cloud-start.cjs` chỉ tạo cửa hàng trống khi chưa có tài khoản, không reseed hoặc ghi đè dữ liệu đã có. Đăng nhập đầu cần đổi mật khẩu.

Gói Free có thời gian ngủ khi không truy cập; PostgreSQL Free hết hạn sau 30 ngày. Giữ bản sao lưu riêng trước ngày hết hạn. Không dùng tài khoản/mật khẩu trên laptop để đăng nhập database cloud mới.

APK phát hành được ký riêng; khóa ký không nằm trong repository. iOS cần build và phân phối Apple riêng.

## Tải và thử từ xa

Xem [hướng dẫn Android](REMOTE_ANDROID.md). API thử: https://agristock-trunghieu-test-1704.onrender.com. Tài khoản do chủ cửa hàng cấp qua kênh riêng; không có mật khẩu trong repository.
