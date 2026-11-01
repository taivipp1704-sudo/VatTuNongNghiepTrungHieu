# Kết quả kiểm tra AgriStock

Kiểm tra ngày 27–31/10/2026 trên Windows, Node 24, Java 21 (thêm toolchain Java 17), PostgreSQL 18. Dữ liệu kiểm thử là dữ liệu riêng của dự án; các kiểm thử UI chạy trên React Native Web, chưa nghiệm thu điện thoại thật.

| Hạng mục | Kết quả và phạm vi |
|---|---|
| TypeScript | API và mobile qua `npm run check` |
| Nghiệp vụ API | 24/24 bài kiểm thử qua `npm test`, gồm PostgreSQL thật, các luồng tích/đổi/hoàn điểm, tương thích gửi lại đơn của APK cũ, khởi tạo cửa hàng trống và từ chối ghi đè |
| Đồng thời | Hai thiết bị tranh đơn vị tồn cuối; gửi lại cùng mã; đổi nội dung cùng mã bị từ chối |
| Kho | Nháp không đổi tồn, ghi sổ đúng một lần, FEFO loại lô hết hạn, rollback khi phiếu nhiều dòng thất bại |
| Phân quyền | Phạm vi kho, che giá vốn, hợp quyền nhiều role, thu hồi quyền và khóa tài khoản |
| Tiền | Giá/chiết khấu/hạn mức, thu nợ từng phần, chống thu trùng, trả hàng vào cách ly, chọn hình thức hoàn tiền |
| Sao lưu | Khôi phục sang database trống khác; đối chiếu mọi bảng, số lượng, ngày; không khôi phục phiên đăng nhập |
| UI chủ cửa hàng | Đăng nhập/đổi mật khẩu, tìm hàng, đơn bán qua API thật, giỏ nháp dùng chung, quản trị nhân viên |
| UI nhân viên | Kho, bán hàng, kế toán: đổi mật khẩu đầu, menu theo quyền, ẩn quản trị, không tràn ngang tại 390 × 844 |
| Lỗi trình duyệt | Không có lỗi JavaScript trong các luồng UI đã chạy |
| Android JavaScript | `expo export --platform android` tạo bundle Hermes thành công |
| Cấu hình phát hành | 4/4 bài kiểm thử: chặn địa chỉ máy ảo trên điện thoại thật, endpoint HTTPS, cấu hình phiên bản, không nhúng thông tin ký vào app config, app Test riêng cho HTTP qua LAN và chặn trộn với bản phát hành |
| Mở đầu bản phát hành | UI yêu cầu cấu hình máy chủ; chặn HTTP trước khi gửi thông tin đăng nhập; không lỗi JavaScript |
| Android native | Gradle release build thành công; APK arm64 đã ký riêng, xác minh chữ ký và fingerprint; chưa kiểm thử trên thiết bị |
| iOS | Đã có profile phân phối nội bộ; EAS chưa đăng nhập, chưa có IPA hoặc provisioning/UDID được xác nhận |
| VPS | Đã chuẩn bị deploy/vps với API, PostgreSQL, Caddy HTTPS và đường dẫn tải APK; `docker compose config --quiet` qua, 11 kiểm thử API qua với cấu hình proxy một hop. Chưa build/chạy container trên VPS hoặc kiểm tra TLS bằng tên miền thật |

Ảnh thực tế của bản xem trước nằm trong `artifacts/`: `home-mobile.png`, `inventory-mobile.png`, `pos-mobile.png`, `admin-mobile.png` và `home-kho.png`, `home-banhang.png`, `home-ketoan.png`.

## Phần cần xác nhận trên Android

- Cài APK đã tạo và mở app trên thiết bị arm64 Android 7.0 trở lên.
- Camera quét mã, SecureStore, SQLite qua khởi động lại, quyền thông báo và nhắc việc.
- Xuất/chia sẻ PDF và dịch vụ in Android trên thiết bị thật.
- Kết nối điện thoại đến API trong mạng cửa hàng và thử mất mạng khi gửi giao dịch.

Hóa đơn điện tử và in Bluetooth trực tiếp chưa cấu hình vì chưa có nhà cung cấp/model máy in. Các chức năng này không giả lập thành công. Giao diện đã có phiếu bán nội bộ để xuất PDF.

## Trạng thái build Android cục bộ

Ngày 28/10 đã tạo `artifacts/AgriStock-internal-signed-1.apk` (43.291.394 byte), phiên bản 1.0.0, versionCode 1, package `vn.agristock.internal`, minSdk 24, targetSdk 36, kiến trúc arm64. Đây là gói cài đã ký riêng; chưa xác nhận vận hành trên điện thoại hoặc backend thật của cửa hàng.

SHA-256 APK: `23bb4bb4451ee894725e28c85a06f763b8719db7daac66538ebdce2382c8909a`.

Fingerprint SHA-256 chứng chỉ ký: `c104ec8b387a753bfd21f8cf01397486504c00544adb8a929e3dd52468995bb4`.

Đã xác minh bằng apksigner, đối chiếu với chứng chỉ của keystore riêng. Đã đọc manifest: không bật debuggable, `usesCleartextTraffic=false`, `allowBackup=false`; app config nhúng có cờ phát hành và yêu cầu nhập máy chủ. Không có tệp keystore hoặc mật khẩu ký trong các assets của APK.

Nhật ký build: `artifacts/android-internal-release-build.log`; thông tin checksum/chứng chỉ: `artifacts/AgriStock-internal-signed-1.apk.json`. Ngày 27 bị chặn tải SDK; ngày 28 đã tải và đối chiếu checksum, cài platform 37.0, build-tools 36/37, NDK 27.1.12297006, CMake 3.22.1, Ninja 1.13.2 và JDK 17. Lỗi đường dẫn dài của Ninja 1.10.2 đã được xử lý bằng bản công cụ mới có checksum từ nhà phát hành.

Hướng dẫn ký cập nhật, cài iOS, cấu hình backend và dữ liệu cửa hàng trống nằm trong `INTERNAL_RELEASE.md`. Ảnh mở đầu bản phát hành: `artifacts/release-first-launch-web.png`.

## Chẩn đoán kết nối trên điện thoại

Địa chỉ người dùng báo lại là `http://10.0.2.2:3001`. Đây là alias truy cập máy phát triển từ máy ảo Android, không phải endpoint cloud để điện thoại thật đăng nhập. Backend vận hành chưa được triển khai lên VPS; tài khoản minh họa trong database phát triển chưa tồn tại trên một máy chủ vận hành mới.

Đã sửa kiểm tra địa chỉ để từ chối alias máy ảo trên điện thoại thật trước khi gửi đăng nhập, bỏ mặc định alias này trên điện thoại và hiển thị địa chỉ trong lỗi kết nối. Cảnh báo mất mạng chỉ hiện khi đã đăng nhập, với vùng an toàn phía trên để tránh chồng thanh trạng thái. TypeScript và 3 bài kiểm thử cấu hình đều qua. Chưa xác minh giao diện sửa trên thiết bị thật hoặc đăng nhập qua backend cloud.

Ngày 29/10 đã build thành công `artifacts/AgriStock-internal-signed-2.apk`, versionCode 2; xác minh chữ ký cùng chứng chỉ bản 1 và đọc lại manifest/config trong APK: arm64, minSdk 24, targetSdk 36, `release=true`, chưa gán API mặc định. SHA-256 APK: `0b0e83c36f5be6afd84374001e00f7c7cd7b5ef871bf92a81a58912c3d48b9ea`. Nhật ký: `artifacts/android-signed-2-build.log`; metadata: `artifacts/AgriStock-internal-signed-2.apk.json`. APK này cải thiện kiểm tra và thông báo; vẫn cần máy chủ HTTPS được triển khai và tài khoản được tạo trên máy chủ đó.

## Kiểm thử Android qua HTTP trong mạng nội bộ

Theo yêu cầu thử trước khi triển khai thương mại, ngày 29/10/2026 đã tạo `artifacts/AgriStock-lan-test-1.apk` (43.299.494 byte). App có tên AgriStock Test, package `vn.agristock.internal.lantest`, versionCode 1, cài song song với bản AgriStock. Đã xác minh chữ ký thử bằng apksigner, manifest cho phép cleartext HTTP, không bật debuggable, arm64 và minSdk 24. Config nhúng: `release=false`, `lanTest=true`, API `http://192.168.1.63:3001`.

SHA-256 APK: `2be3dc4971b1baca45b4f1ac5f1954d36ae317ab55bfdfcae794c264615d1080`. Nhật ký: `artifacts/android-lan-test-1-build.log`; metadata: `artifacts/AgriStock-lan-test-1.apk.json`.

API đang lắng nghe `0.0.0.0:3001`, PostgreSQL chỉ lắng nghe loopback. Đã gọi health qua địa chỉ LAN từ laptop và đăng nhập/đọc phiên/đăng xuất thành công với `owner`, `kho`; không đặt lại mật khẩu hoặc khởi tạo lại dữ liệu. TypeScript qua, 4/4 bài kiểm tra cấu hình qua. Windows đã có quy tắc cho phép Node.js trên profile Wi-Fi Public; không thay đổi firewall. Script cấp quyền truy cập LAN được chuẩn bị cho trường hợp cần, chưa chạy vì phiên PowerShell không có quyền Administrator.

Chưa có điện thoại nối ADB, chưa xác nhận truy cập từ điện thoại, cài/mở APK hoặc các chức năng native. Hướng dẫn kiểm tra kết nối và các luồng trên hai điện thoại ở `LAN_TEST.md`. HTTP qua LAN vẫn cần laptop bật trong khi thử; không yêu cầu VPS, HTTPS, Expo Go hoặc Metro.

## Tích điểm khách hàng — 31/10/2026

Đã bổ sung tỷ lệ `loyalty_rate` riêng từng hàng (0–100%, tối đa 4 số thập phân), quyền `loyalty.manage` kiểm tra tại API và nhật ký sửa. Admin chọn giá trị một điểm, thời điểm cộng (xác nhận đơn/thu đủ/theo tỷ lệ thu), căn cứ trước hoặc sau chiết khấu, làm tròn, chế độ theo dõi hoặc đổi điểm, số điểm tối thiểu và trần giảm tiền. Giao dịch lưu snapshot quy tắc, sổ điểm và số dư khách; trả toàn bộ đơn thu hồi điểm đã cộng và hoàn điểm đã dùng. Các phép tính tỷ lệ dùng BigInt để tránh sai số tiền do số thực.

18/18 kiểm thử API qua, bao gồm hai thiết bị tranh số điểm còn lại, rollback tồn khi đổi điểm thất bại, chống gửi trùng, thu nợ/đổi cấu hình vẫn dùng snapshot cũ, thu đủ và thu theo tỷ lệ, thu tiền đồng thời trả hàng, số dư âm khi thu hồi điểm đã dùng, đổi điểm 100% không tạo tiền mặt giả, kiểm tra tổng tiền đã báo và gửi lại đơn của APK trước tính năng này. TypeScript và 4 kiểm thử cấu hình phát hành qua. Khôi phục backup đã đối chiếu thêm số dư, bút toán điểm và snapshot quy tắc/điểm/giảm tiền của từng đơn.

Trước nâng cấp database thử hiện có, đã lưu `.local/backups/pre-loyalty-1793447256856.json.gz`. Backend tại `http://192.168.100.106:3001` đã được khởi động lại và xác nhận đăng nhập owner, API cấu hình tích điểm, cột tỷ lệ sản phẩm và số dư khách hoạt động. Chương trình vẫn tắt, không tự đặt tỷ lệ hoặc tạo giao dịch điểm trên dữ liệu hiện có. Kiểm thử nghiệp vụ chạy riêng trong `agristock_test`.

APK: `artifacts/AgriStock-lan-test-2.apk`, 43.321.342 byte, versionCode 2, package `vn.agristock.internal.lantest`. Đã xác minh chữ ký khớp bản Test 1, HTTP bật, `release=false`, `lanTest=true`, API mặc định `http://192.168.100.106:3001`. Bundle Hermes có màn hình cấu hình và API báo giá điểm. SHA-256 APK: `d27525dc35378bc4de84211036bbd60b718c2b6d8e043600068856b9cb36c780`. Log: `artifacts/android-lan-test-2-build.log`; metadata: `artifacts/AgriStock-lan-test-2.apk.json`.

Chưa kiểm tra giao diện tích điểm lúc chạy: hệ thống duyệt tự động từ chối lệnh khởi động bản xem trước web với thông báo `blocked by policy`. ADB chưa có thiết bị, nên chưa xác nhận cài APK, nhập dấu phẩy, bố cục, đổi điểm hoặc PDF trên điện thoại thật. Hướng dẫn thao tác và các ví dụ quy đổi nằm trong `LOYALTY.md`; app vẫn dùng HTTP qua Wi-Fi và cần laptop chạy backend.

## Chạy lại các kiểm tra

```powershell
npm run check
npm test
node scripts/check-backup.mjs
node scripts/check-ui.cjs
node scripts/check-role-ui.cjs
node --test apps/mobile/config/release.test.cjs
node scripts/check-release-entry.cjs
```

PostgreSQL phải chạy trước các kiểm thử. UI cần API tại cổng 3001 và Metro web tại cổng 8081. Hai script UI dùng Playwright có sẵn trên máy này và đọc mật khẩu từ tệp riêng `.local/initial-accounts.json`; luồng POS tạo đơn thật trong dữ liệu minh họa. Không chạy các script này với dữ liệu vận hành.

`check-release-entry.cjs` dùng riêng Metro tại cổng 8082, khởi động với `AGRISTOCK_RELEASE=1`, không đặt `EXPO_PUBLIC_API_URL`, và `expo start --web --port 8082 --clear`. Script này chỉ kiểm tra mở đầu và từ chối HTTP, không tạo giao dịch.


## Giao diện Stitch, Test 3 — 31/10/2026

Triển khai lại 7 màn hình từ hai ZIP người dùng gửi: tổng quan, POS, hàng hóa/số chấm, cài đặt điểm, đơn/trả hàng, khách hàng và phân quyền. Màu xanh, nền sáng, thẻ bo góc, Be Vietnam Pro, chọn kho và điều hướng 5 tab. Bổ sung ảnh hàng hóa, sửa tỷ lệ hàng loạt, làm tròn lên, chỉnh điểm có lý do, hạng tùy chỉnh, quyền đổi điểm riêng, quy tắc điểm khi trả và theo dõi giao hàng nội bộ.

- API 24/24 bài kiểm thử qua: giữ các luồng tồn/tiền/đồng thời/RBAC, bổ sung tỷ lệ hàng loạt, chỉnh điểm, CEIL, tương thích cấu hình cũ, quyền đổi điểm sau khởi động lại, giao hàng, kho và ảnh hàng hóa. TypeScript và 4/4 kiểm thử cấu hình qua; backup/restore đối chiếu thành công.
- UI Edge headless tại 390 × 844, API và PostgreSQL thật trong database riêng `agristock_stitch_ui`: đăng nhập/tổng quan; cấu hình sai giữ nháp rồi lưu đúng; nhập tỷ lệ bằng dấu phẩy; mô phỏng lỗi 503 rồi gửi lại giữ dữ liệu; bán có đổi điểm; đối chiếu tiền/tồn/ví; trả đơn hoàn/thu hồi điểm; tải CSV chứa mã đơn thật; chỉnh ví có lý do; lưu quyền vai trò xuống API; bảo vệ vai trò owner. Không có lỗi JavaScript hoặc tràn ngang. Không có yêu cầu đến API chính trong các kiểm thử UI này.
- Ảnh thực tế: `artifacts/stitch-{overview,inventory,pos,loyalty,orders,customers,roles}-web.png`. Kết quả máy đọc được: `artifacts/stitch-ui-validation.json`. Đây là kiểm thử web của cùng mã màn hình, chưa thay thế kiểm thử Android native.
- Sao lưu dữ liệu chính trước cập nhật: `.local/backups/agristock-2026-10-31T13-14-03-163Z.json.gz`. API đã cập nhật, health qua LAN, owner đăng nhập/đọc phiên/bootstrap/hàng hóa/cấu hình điểm thành công. Đối chiếu 11 bảng nghiệp vụ, 44 dòng cũ và mọi cấu hình cũ giữ nguyên; không tạo đơn hay thay tỷ lệ trên database chính. Kết quả: `artifacts/stitch-main-upgrade-validation.json`.
- Plugin Sleek/Bilt/Appllama không gọi được trong phiên (`Unknown tool`); không tính kết quả plugin chưa chạy thành kết quả kiểm thử. Nguồn Stitch được đọc cục bộ, không chạy HTML đi kèm.

HĐĐT, in Bluetooth trực tiếp, Facebook và báo cước vận chuyển chưa cấu hình. Chia sẻ/in phiếu nội bộ bằng hệ thống Android và xuất CSV/PDF đã có mã thực thi; camera, in/chia sẻ và lưu trữ native vẫn cần thử trên điện thoại. ADB chưa có thiết bị kết nối.


APK Test 3 đã tạo: `artifacts/AgriStock-lan-test-3.apk` (44,453,984 byte), versionCode 3, package `vn.agristock.internal.lantest`, arm64, minSdk 24, targetSdk 36. Gradle `assembleRelease` thành công trong 5 phút 8 giây, lintVitalRelease qua. `apksigner verify` qua, cùng chứng chỉ Test 1/2 (`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`). Manifest: HTTP được phép, backup tắt, không bật debuggable. Config nhúng: `release=false`, `lanTest=true`, API `http://192.168.100.106:3001`. Đã đối chiếu đủ 4 font thiết kế theo SHA-256 và giấy phép OFL trong APK; không có tệp khóa ký hoặc mật khẩu tài khoản thử trong bundle. APK chứa JavaScript, không cần Metro/Expo Go.

SHA-256 APK: `88f6ad808e0c0a7fee6217bb10336564fa04b5fe00d117d9e671f4034d728495`. Nhật ký `artifacts/android-lan-test-3-build.log`; kiểm tra APK `artifacts/stitch-apk-validation.json`; metadata `artifacts/AgriStock-lan-test-3.apk.json`. ADB chưa có thiết bị: chưa xác nhận cài/mở hoặc camera/in/lưu trữ trên điện thoại thật. Bản Test dùng HTTP/LAN, chưa phải bản thương mại triển khai trên máy chủ độc lập.


## APK ký riêng 3 và thử từ mạng khác — 31/10/2026

Đã build `artifacts/AgriStock-internal-signed-3.apk`, versionCode 3, package `vn.agristock.internal`, tên AgriStock, 44.453.932 byte. `assembleRelease` thành công trong 4 phút 9 giây. apksigner xác minh cùng chứng chỉ phát hành 1/2 (`c104ec8b387a753bfd21f8cf01397486504c00544adb8a929e3dd52468995bb4`). Manifest minSdk 24, targetSdk 36, arm64, cleartext HTTP tắt, backup tắt, không bật debuggable. App config `release=true`, `lanTest=false`, chưa có API mặc định. Có giao diện Stitch và các chức năng của Test 3; giấy phép font kèm APK. Không có mật khẩu tài khoản thử hoặc mật khẩu ký trong bundle.

SHA-256: `29b6529bcd43e2afc871d04a690645482b664cfe16a0e71c94344c7d4aebc9f3`. Kết quả `artifacts/android-signed-3-validation.json`; nhật ký `artifacts/android-signed-3-build.log`. Không chạy lại kiểm thử local theo yêu cầu người dùng; các kiểm tra đóng gói/chữ ký không xác nhận nghiệm thu thiết bị hoặc server online.

Đã đóng gói `artifacts/AgriStock-server-release-3.zip` với backend, Docker/Caddy/PostgreSQL, hướng dẫn và APK; whitelist tệp nguồn, không đưa `.local`, database thử hoặc khóa ký vào gói. Backend online chưa triển khai. Render đã kết nối, thấy workspace BookingReview; còn chờ người dùng xác nhận workspace đích. GitHub CLI đã xác thực, chưa có repository AgriStock và chưa đẩy mã nguồn. Hướng dẫn: REMOTE_ANDROID.md.


## Bố cục hàng hóa gọn — 01/11/2026, APK 5

Giữ 15 trường và payload tạo/sửa, phân quyền, quét mã, ảnh URL, quy đổi khóa sau tạo, số chấm, lô/hạn và thông tin kỹ thuật. Gom thẻ, cột thích ứng, header đóng/lưu và footer Lưu cố định. Không sửa API hoặc dữ liệu cloud. Kiểm tra kiểu API/mobile qua npm run check. Kiểm tra web 390×844, 375×844, 320×740, 844×390 không tràn ngang; Lưu nằm trong viewport. Chọn nhóm bằng BottomSheet, nhập số chấm dấu phẩy, cảnh báo trường bắt buộc, quay lại từ nhập mã thủ công, tải hàng cũ, khóa quy đổi khi sửa và giữ nội dung khi đổi kho được kiểm tra trên database QA riêng. Không có lỗi JavaScript trong trang sửa.

Hộp xác nhận lưu của trình duyệt xem trước chặn điều khiển CDP; chưa hoàn thành kiểm thử lưu cuối qua giao diện web. Logic lưu/payload API gốc được giữ. Chưa nghiệm thu bản Android 5 trên thiết bị. Ảnh trong artifacts/product-compact-*.jpg; kiểm tra artifacts/product-compact-validation.json.

APK 5 build thành công 4 phút 7 giây, đã xác minh chữ ký cùng khóa phát hành trước, manifest và cloud URL. SHA-256: c7d5eedc4f599b2368c21565d9cb5883c6407b3b554518e5514cdbb46da5686c.
# Ảnh sản phẩm và xác nhận giao hàng — APK 6

- `npm run check`: đạt. 26/26 kiểm thử API và 4/4 kiểm thử cấu hình release đạt.
- API kiểm tra ảnh giả/hỏng, quyền upload, ảnh riêng tư, gắn ảnh đúng sản phẩm, thay/xóa trong giao dịch, giữ ảnh khi client bỏ qua trường ảnh, quyền kho và quyền xem đơn, gửi lại không tạo trùng, tối đa 5 ảnh/đơn, khóa thêm ảnh cho đơn đã trả.
- Sao lưu/khôi phục: thêm bảng ảnh, kiểm tra từng byte ảnh và liên kết sau khôi phục; đạt trên database kiểm thử riêng.
- Trình duyệt 390×844: chọn tệp bằng bộ chọn hệ thống, nén và tải ảnh sản phẩm, hiển thị ảnh riêng tư, xóa ảnh khỏi bản nháp; chọn ảnh giao hàng, ghi chú, gửi ảnh và xác nhận Đã giao, xem ảnh cùng người gửi/thời gian. Không tràn ngang, không lỗi JavaScript. Ảnh thử là biểu tượng app, ghi nhãn TEST.
- Render triển khai `0f3417d803d6d4d72e2fa1d159e12b7880f87604`, deploy `dep-dbj531navr4c73bnbvsg` đã live. `cloud-photo-validation.json`: upload/thay/xóa ảnh sản phẩm, ảnh giao hàng + trạng thái, gửi lại, chặn người chưa đăng nhập, giữ ảnh sau trả hàng đều đạt qua HTTPS. Chỉ thao tác dữ liệu TEST.
- APK 6: cùng package và chứng chỉ ký APK 5, API cloud, HTTPS, không debuggable/backup, có camera và bộ chọn ảnh, không yêu cầu microphone. SHA-256 và kích thước trong metadata APK.
- Giới hạn nghiệm thu: chưa cài APK 6, mở camera, xử lý quyền camera hoặc chọn thư viện trên Android/iOS thật. iOS chưa build. Việc xem/chọn ảnh trong trình duyệt không thay cho nghiệm thu camera native.
- Lưu trữ ảnh thử trong PostgreSQL chung, tối đa 350 KB/ảnh và 128 MB tổng ảnh. Không dùng ổ tạm của Render, không tạo tài nguyên trả phí. Database Free vẫn có hạn 30/11/2026.
- Audit phụ thuộc API còn cảnh báo ở multer 2.4.0 kéo theo Nest platform-express; endpoint ảnh dùng JSON giới hạn 512 KB, không sử dụng multipart/Multer. Không tuyên bố đã kiểm toán bảo mật toàn app.

# Sửa quyền nhân viên và lưu độc lập — APK 7

- TypeScript API/mobile đạt. 28/28 kiểm thử API và 4/4 kiểm thử cấu hình release đạt.
- Kiểm tra 8 tổ hợp trạng thái hoạt động, có/không vai trò, có/không kho. Tạo và cập nhật tài khoản chưa gán đều hợp lệ; quyền rỗng không thành toàn quyền, kho rỗng không thành tất cả kho, phiên cũ bị thu hồi. Chủ cửa hàng được bảo vệ. Admin nhân viên có thể tự giảm quyền hoặc tự khóa, không được tự cấp vai trò vượt quyền.
- Web 390×844: bấm Sửa ở nhân viên cuối danh sách mở riêng biểu mẫu đúng người. Đầu biểu mẫu nằm trong viewport. Tắt vai trò, tắt kho, tắt cả hai và khóa tài khoản vẫn có nút Lưu được bật; không lỗi JavaScript. Thao tác Lưu sau hộp xác nhận web không tự động hóa trong IAB; đường ghi máy chủ được kiểm thử bằng API. Chưa nghiệm thu thao tác trên điện thoại thật.
- Cloud: API commit `f3ccd0012f74aa3bb7319c6adc75fa30802dae5a`, deploy `dep-dbjbn45g1s2s73fqoii0` live. Tạo tài khoản QA mới không có vai trò, lưu có/không kho và bật/tắt hoạt động qua HTTPS thành công. Tài khoản QA kết thúc ở trạng thái khóa; không thay đổi quyền tài khoản owner/tester đang dùng.
- APK 7 build thành công, cùng package/chứng chỉ APK 6, API cloud HTTPS; metadata lưu hash và source commit `70937ad4473da229bfd797d5e19c79397b8ba574`. Giữ chức năng ảnh, tích điểm và bố cục hàng hóa.

## Bán tại quầy, khách hàng và biểu đồ — APK 8, 01/11/2026

- TypeScript API/mobile đạt; 31/31 bài kiểm thử API, 4/4 kiểm thử cấu hình release và đối chiếu sao lưu/khôi phục kể cả byte ảnh đạt.
- Bổ sung kiểm thử tuần bắt đầu thứ Hai, tháng nhuận, biên giờ Việt Nam, ngày/tuần/tháng/quý/năm, khách/kho/quyền và ẩn giá vốn. Đơn bán tháng 12, thu nợ tháng 1, trả tháng 2 được ghi đúng kỳ; tiền thu nợ không tăng doanh thu kỳ thu.
- Web ở 390×844, 375×844 và 320×740: tổng quan, năm kỳ báo cáo, đổi kỳ, chạm cột/chọn mốc, đổi doanh thu/thực thu, tải CSV, hồ sơ khách và ba đơn đúng khách. Không tràn ngang hoặc lỗi JavaScript trong các màn đã kiểm tra. Cả năm tab kỳ hiển thị ở chiều rộng 320. Chưa tự động hóa xác nhận thu tiền cuối qua hộp thoại IAB; đường ghi API được kiểm thử riêng.
- Dữ liệu QA riêng cho hồ sơ khách: tổng mua 108.000đ, đã trả 72.000đ, còn nợ 36.000đ; lịch sử ba đơn khớp. Ảnh giao diện trong `artifacts/counter-home-390.jpg`, `counter-report-chart-390.jpg`, `counter-customer-summary-390.jpg`; CSV đã tải trong `counter-report-export.csv`.
- Render API commit `4faa884f650d0e68b0c6c97f2f1a54c173eea75f`, deploy `dep-dbjie1mq1p3s73ap5f50` live. HTTPS kiểm tra năm kỳ, lịch sử khách, UNPAID → thu một phần → PAID và trả đơn thành công. Chỉ dùng bản ghi TEST mới; đơn thử đã trả, không sửa mật khẩu/quyền tài khoản đang dùng. Kết quả `artifacts/cloud-counter-validation.json`.
- Ghi âm 189 giây được xử lý cục bộ để phân tích yêu cầu. Không công bố âm thanh, ảnh tham khảo hay bản chép riêng. Ý chưa rõ và câu cuối bị ngắt không được suy diễn; hướng dẫn dùng tại `COUNTER_APP.md`.
- Bản 8 giữ luồng trả toàn bộ đơn. Chưa nghiệm thu cài/mở, biểu đồ cảm ứng, camera, in/chia sẻ trên Android thật; iOS chưa build. Kiểm thử web/API không thay cho nghiệm thu thiết bị.

