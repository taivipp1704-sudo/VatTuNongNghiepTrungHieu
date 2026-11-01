# Chạy AgriStock

Để gửi APK Android bản 8 cho người ở mạng khác, xem [Thử từ xa](REMOTE_ANDROID.md). Backend và PostgreSQL đã chạy trên Render Free; laptop có thể tắt. Xem [bán tại quầy và biểu đồ doanh thu](COUNTER_APP.md). Kết quả triển khai nằm trong [môi trường cloud](CLOUD_TEST.md).

Bản Android Test 3 đã cập nhật 7 màn hình theo mẫu Stitch. Xem [Hướng dẫn sử dụng](STITCH_APP_GUIDE.md) và [Phạm vi chức năng](STITCH_IMPLEMENTATION.md).

Để cài APK kiểm thử trên điện thoại, dùng HTTP qua Wi-Fi và chưa cần VPS, xem [Thử APK Android trong mạng nội bộ](LAN_TEST.md).

Để admin đặt số chấm cho từng mặt hàng, quy đổi điểm và chọn cách tích/đổi điểm khách hàng, xem [Cấu hình tích điểm](LOYALTY.md).

Để đóng gói bản ký riêng và chuẩn bị dùng tại cửa hàng, xem [Phát hành nội bộ](INTERNAL_RELEASE.md). Hướng dẫn bên dưới mô tả môi trường phát triển và dữ liệu minh họa.

Để dùng nhiều điện thoại và tắt được laptop, xem [Đưa backend và link tải APK lên VPS](deploy/vps/README.md).

AgriStock là app nội bộ cho cửa hàng vật tư nông nghiệp. Nhân viên dùng chung dữ liệu qua một máy chủ; tài khoản và chức năng được chủ cửa hàng cấp quyền.

Bản HTML trong thư mục cha được giữ nguyên làm tài liệu tham khảo. App được phát triển riêng trong `apps/mobile`, máy chủ trong `apps/api`.

## Khởi động trên máy Windows này

Cần Node.js 24 và kết nối Internet ở lần cài đầu. Mở PowerShell tại `D:\QuanLyKhoHangUI\agristock`.

```powershell
npm install
```

Mở cửa sổ PowerShell thứ nhất, chạy dữ liệu trung tâm và giữ cửa sổ mở:

```powershell
npm run db:start
```

Khi thấy PostgreSQL sẵn sàng, mở cửa sổ thứ hai:

```powershell
npm run api:build
npm run db:seed
npm run api:start
```

Chỉ chạy `db:seed` ở lần đầu. Dữ liệu khởi tạo là dữ liệu minh họa. Lệnh này không ghi đè dữ liệu hoặc mật khẩu khi cửa hàng đã có tài khoản.

Mở cửa sổ thứ ba:

```powershell
npm run mobile
```

Mật khẩu khởi tạo nằm trong `.local/initial-accounts.json`, gồm các tài khoản `owner`, `kho`, `banhang`, `ketoan`. Mỗi tài khoản cần đổi mật khẩu khi đăng nhập lần đầu. Giữ tệp này riêng và bỏ bản sao mật khẩu cũ sau khi bàn giao đúng người.

## Kết nối điện thoại

Điện thoại và máy chạy máy chủ cần cùng mạng nội bộ. Trên màn hình đăng nhập, chọn **Cấu hình kết nối cửa hàng** và nhập địa chỉ máy chủ, ví dụ `http://192.168.1.20:3001`. Dùng địa chỉ IP thực tế của máy Windows, không dùng địa chỉ ví dụ.

Máy ảo Android dùng `http://10.0.2.2:3001`. Bản xem trước trên chính máy tính dùng `http://localhost:3001`.

Máy chủ phải tiếp tục chạy để các điện thoại xem dữ liệu mới và xác nhận giao dịch. Kết nối HTTP trong mạng nội bộ dành cho kiểm thử. Khi đưa vào vận hành, dùng HTTPS và thay dữ liệu minh họa bằng dữ liệu đã đối chiếu.

## Nhập hàng và ghi tăng tồn

1. Mở **Kho**, chọn **Nhập kho**.
2. Chọn kho, nhà cung cấp nếu mua chịu, rồi nhập nội dung phiếu.
3. Thêm từng sản phẩm, số lượng, đơn vị và thông tin lô/hạn sử dụng nếu sản phẩm yêu cầu.
4. Kiểm tra và chọn **Gửi phiếu chờ duyệt**.
5. Người có quyền mở **Phiếu kho & kiểm kê**, chọn **Duyệt & ghi sổ**.

Phiếu nháp hoặc chờ duyệt chưa làm tăng tồn. Phiếu nhập có nhà cung cấp tạo khoản phải trả khi được ghi sổ. Các khoản thanh toán tiếp theo ghi nhận trong **Công nợ**.

## Xuất hàng và kiểm kê

Mở **Kho → Xuất kho** hoặc **Phiếu kho & kiểm kê → Kiểm kê thực tế**. Với kiểm kê, nhập số lượng đếm được, không nhập số chênh lệch. Sau khi duyệt, tồn được điều chỉnh theo số thực tế đã ghi trong phiếu.

Điều chuyển cần hai kho khác nhau và bạn phải được cấp quyền ở cả hai kho. Hàng hết hạn hoặc cách ly bị chặn xuất thông thường. Chọn loại **Xuất hủy hàng hỏng/hết hạn** để lập phiếu xử lý và gửi người có quyền duyệt.

Phiếu đã ghi sổ được giữ nguyên trong lịch sử. Khi sai số, lập phiếu kiểm kê/điều chỉnh có nội dung giải thích; không xóa lịch sử đã ghi nhận.

## Bán hàng và ghi nợ

1. Mở **Bán hàng**, chọn kho và tìm hoặc quét sản phẩm.
2. Thêm hàng, chọn đơn vị bán và kiểm tra số lượng.
3. Chọn khách hàng và hình thức thanh toán.
4. Nếu thu một phần, nhập số tiền đã thu. Nếu ghi nợ toàn bộ, chọn **Ghi nợ toàn bộ**.
5. Chọn **Ghi nhận đơn bán** và xác nhận.

Đơn chưa thu đủ phải liên kết khách hàng có hồ sơ và còn trong hạn mức nợ. Số lượng khả dụng và quyền sửa giá được kiểm tra lại khi máy chủ nhận đơn. Lô còn hạn có hạn dùng gần nhất được ưu tiên xuất.

Nếu mất kết nối sau khi bấm xác nhận, giữ nguyên nội dung và thử lại. Yêu cầu gửi lại dùng cùng mã để kiểm tra kết quả cũ, không tự tạo thêm giao dịch.

## Thu nợ hoặc trả nhà cung cấp

Trong **Công nợ**, chọn sổ phải thu/phải trả, mở khoản cần xử lý, nhập số tiền và hình thức. Bạn có thể thanh toán nhiều lần, mỗi lần không vượt số nợ còn lại. Lịch sử từng lần thanh toán được giữ lại.

## In hoặc gửi phiếu bán

Mở **Chứng từ bán hàng**, chọn **In / chia sẻ phiếu PDF**. Trên Android, bạn có thể chia sẻ tệp PDF hoặc chọn dịch vụ in đã cài trên điện thoại.

Đây là phiếu bán nội bộ. Phát hành hóa đơn điện tử chưa được cấu hình và không được báo thành công giả. Máy in Bluetooth cần kiểm tra đúng model trước khi bổ sung kết nối trực tiếp.

## Cấp tài khoản và phân quyền

Chủ cửa hàng mở **Khác → Quản trị nội bộ**. Tạo nhân viên, chọn một hoặc nhiều vai trò và các kho được thao tác. Quyền của các vai trò được hợp nhất.

Các quyền xem giá vốn, xem lãi gộp, sửa giá, chiết khấu, duyệt phiếu và phát hành hóa đơn là các quyền riêng. Thay role có hiệu lực ở các yêu cầu tiếp theo; app cũng cập nhật quyền định kỳ. Khóa tài khoản hoặc sửa phân công nhân viên sẽ thu hồi các phiên đăng nhập của nhân viên đó.

Nhân viên không tự duyệt phiếu do mình lập. Chủ cửa hàng có thể lập và ghi sổ khi cửa hàng chỉ có một người, và thao tác này được lưu trong nhật ký.

## Khi mất mạng

Khi đang đăng nhập, bạn có thể lưu giỏ hàng và phiếu kho nháp trên thiết bị. Bản nháp tách theo tài khoản và máy chủ. Kết nối lại để gửi và được kiểm tra lại trước khi xác nhận. Khởi động lại app khi mất mạng có thể yêu cầu kết nối để kiểm tra phiên đăng nhập trước khi mở bản nháp.

App không tự chốt tồn kho, thu tiền hoặc phát hành chứng từ khi offline. Dữ liệu đã lưu trước đó có thể được dùng để tra cứu; xem cảnh báo kết nối trước khi quyết định.

## Kiểm tra và đóng gói

```powershell
npm run check
npm test
```

Các bài kiểm thử dùng riêng cơ sở dữ liệu `agristock_test`, không dùng dữ liệu cửa hàng.

Để build APK cục bộ trên Windows, cần Java 21 và Android SDK. Tại thư mục gốc chạy:

```powershell
.\scripts\setup-android.ps1 -WithNdk
.\scripts\build-android.ps1
```

Lần đầu cần tải platform 37.0, build-tools 37.0.0, NDK 27.1.12297006 và phụ thuộc Gradle. Nếu mạng báo timeout, chạy lại sau khi kết nối ổn định; dữ liệu cửa hàng không bị ảnh hưởng. Script dùng SDK trong `.local/android-sdk` hoặc `ANDROID_HOME` nếu đã cấu hình.

Khi build thành công, APK nằm tại `artifacts/AgriStock-internal-release.apk`. Đây là bản kiểm thử nội bộ arm64 dùng khóa ký thử nghiệm. Chỉ có thể cài sau khi tệp thực sự được tạo. Xem `VALIDATION.md` để biết phần đã kiểm tra và phần còn chờ kiểm tra trên Android.

## Sao lưu và vận hành

Dữ liệu PostgreSQL phát triển nằm trong `.local/postgres`. Khi chuyển sang máy chủ, dùng cấu hình Docker Compose, cấp mật khẩu riêng qua biến môi trường và đặt HTTPS ở phía trước API. Không công khai cổng PostgreSQL.

Chạy `npm run backup` để tạo tệp sao lưu trong `.local/backups`. Sao lưu trước khi nâng cấp; khi vận hành cần lên lịch sao lưu định kỳ. Giữ ít nhất một bản sao ngoài máy đang chạy và kiểm tra khôi phục vào cơ sở dữ liệu khác. `npm run restore -- <duong-dan-tep>` chỉ khôi phục khi cơ sở dữ liệu đích trống và khác cơ sở dữ liệu nguồn; đặt `DATABASE_URL` đến đích trước khi chạy. Thư mục `.local` chứa mật khẩu và dữ liệu riêng, không đưa lên Git hoặc chia sẻ công khai.

## Khi không kết nối được

- Kiểm tra cửa sổ PostgreSQL và API còn chạy.
- Trên máy Windows, mở `http://localhost:3001/api/health`. Kết quả phải có `service: AgriStock` và `status: ok`.
- Kiểm tra điện thoại cùng Wi-Fi và địa chỉ IP máy chủ chưa thay đổi.
- Kiểm tra tường lửa có cho phép kết nối tới cổng API trong mạng cửa hàng.
- Nếu bị báo phiên hết hạn hoặc thu hồi, đăng nhập lại bằng tài khoản được chủ cửa hàng cấp.
- Nếu phiếu báo thiếu tồn, tải lại kho và kiểm tra lô. Bản nháp chưa làm tăng tồn.
