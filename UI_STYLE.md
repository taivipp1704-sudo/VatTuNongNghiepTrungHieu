# Bố cục và phối màu AgriStock — Android 10

AgriStock dùng xanh cobalt đậm cho nhận diện và thao tác chính, cam cho điểm nhấn, nền sáng và chữ navy cho nội dung. Hệ thống màu và font nằm trong `apps/mobile/src/theme.ts`; các màn hình dùng chung AppText, Label, Panel và các nút hiện có.

| Vai trò | Màu |
| --- | --- |
| Chữ chính / số liệu | Navy `#102346` |
| Thẻ doanh thu / nút chính | Cobalt `#1457E6`, chữ trắng |
| Thanh đầu trang | Xanh đậm `#103DA8`, chữ trắng |
| Giá bán / tiền thực thu | Xanh dương `#1648B6` |
| Đang giao dịch trên tổng quan | Cam đậm `#A64E04`, chữ trắng |
| Hoàn thành trên tổng quan | Xanh lá `#08764C`, chữ trắng |
| Lỗi / giá trị âm | Đỏ `#B51F3D` |
| Bán tại quầy / cột biểu đồ được chọn | Cam `#C7470D` |

Nhãn chữ, biểu tượng và số tiền đi kèm màu để tránh phải đoán trạng thái chỉ qua màu sắc. Chữ phụ dùng xám xanh đậm. Các cặp chữ chính đo được từ 4,84:1 trở lên; đường viền ô nhập 4,08:1 trên nền trắng.

Tổng quan gom doanh thu, thực thu, số đơn trong ngày và nút Bán tại quầy vào một khối. Hai trạng thái đơn dùng thẻ màu đậm, ghi rõ phạm vi 90 ngày. Tám lối tắt theo quyền chia hai cột, biểu tượng có nền màu đặc và nhãn đầy đủ. Kho gom Thêm hàng và Sửa số chấm vào một hàng; báo cáo đặt nút Hiện tại cạnh tiêu đề để rút ngắn phần điều khiển. Không thêm số tăng trưởng hay dữ liệu minh họa vào API thật.

Áp dụng quy trình của repo người dùng cung cấp tại `D:/baoyu-design-main`: đọc hướng dẫn design-system/dashboard, kiểm tra palette bằng `skills/dataviz/scripts/validate_palette.js`, và xuất bản tham chiếu bằng `node scripts/export-design-system.mjs`. Thư mục `design-system/agristock/project` được sinh từ theme thật; kiểm tra bằng `skills/claude-design-system/scripts/artifact.mjs check` đạt 0 lỗi cấu trúc. Bản xuất này không thay nguồn theme của app. Không đưa mã editor hoặc icon font của repo tham khảo vào APK.

**Inter** dùng cho nội dung, ô nhập và số tiền; **Manrope** dùng cho tiêu đề. Cỡ nội dung 16, chú thích chung 14; số tiền quan trọng dùng chữ đậm và chữ số có độ rộng đều. Font được nhúng sẵn, không tải từ Google khi mở app. Không tắt cơ chế phóng to chữ của hệ điều hành.

Nguồn font: [Inter](https://github.com/google/fonts/tree/main/ofl/inter), [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope). Tạo các bản TTF tĩnh từ variable font bằng fontTools 4.60.1: Inter 400/500/600/700 với optical size 14, Manrope 600/700. Đối chiếu đủ chữ tiếng Việt và ký hiệu đồng; thông tin tệp và SHA-256 trong `apps/mobile/assets/fonts/ui-sources.json`. Giấy phép OFL đi kèm mã nguồn và APK tại thư mục licenses.

Theo hướng tham khảo người dùng đề xuất: giữ bố cục POS cho bán hàng/sản phẩm/chứng từ, hàng hóa có ảnh–SKU–barcode, số liệu tài chính có phân cấp rõ, trạng thái công việc có nhãn, thao tác chính xuất hiện trực tiếp. Đây là hệ thống giao diện AgriStock, không đưa logo hay tài sản của Shopify POS, Sortly, Revolut, Linear hoặc Things 3 vào app.

Kiểm tra web áp dụng cho cùng mã màn hình; camera, in, chữ cỡ lớn hệ thống và thao tác native vẫn cần nghiệm thu trên điện thoại. Kết quả của từng bản trong VALIDATION.md.
