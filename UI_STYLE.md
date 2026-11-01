# Font và phối màu AgriStock — Android 9

AgriStock dùng nền sáng, chữ navy và màu nhấn theo nội dung. Hệ thống màu và font nằm trong `apps/mobile/src/theme.ts`; các màn hình dùng chung AppText, Label, Panel và các nút hiện có.

| Vai trò | Màu |
| --- | --- |
| Chữ chính / số liệu | Navy `#182C45` |
| Thẻ doanh thu chính | Navy đậm `#112B4A`, chữ trắng |
| Nút thao tác chính | Xanh ngọc `#0F766E`, chữ trắng |
| Giá bán / tiền thực thu | Xanh dương `#1D4ED8` |
| Chưa thanh toán | Cam nâu `#9A5200`, nền vàng nhạt |
| Hoàn thành / lãi dương | Xanh lá `#087443` |
| Lỗi / giá trị âm | Đỏ `#B4233A` |
| Điểm nhấn / cột biểu đồ được chọn | Cam `#C04B0A` |

Nhãn chữ, biểu tượng và số tiền đi kèm màu để tránh phải đoán trạng thái chỉ qua màu sắc. Chữ phụ dùng xám xanh đậm, không dùng xám nhạt trên nền trắng. Các cặp chữ chính đo được từ 4,87:1 trở lên; đường viền ô nhập 3,49:1 trên nền trắng.

**Inter** dùng cho nội dung, ô nhập và số tiền; **Manrope** dùng cho tiêu đề. Cỡ nội dung 16, chú thích chung 14; số tiền quan trọng dùng chữ đậm và chữ số có độ rộng đều. Font được nhúng sẵn, không tải từ Google khi mở app. Không tắt cơ chế phóng to chữ của hệ điều hành.

Nguồn font: [Inter](https://github.com/google/fonts/tree/main/ofl/inter), [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope). Tạo các bản TTF tĩnh từ variable font bằng fontTools 4.60.1: Inter 400/500/600/700 với optical size 14, Manrope 600/700. Đối chiếu đủ chữ tiếng Việt và ký hiệu đồng; thông tin tệp và SHA-256 trong `apps/mobile/assets/fonts/ui-sources.json`. Giấy phép OFL đi kèm mã nguồn và APK tại thư mục licenses.

Theo hướng tham khảo người dùng đề xuất: giữ bố cục POS cho bán hàng/sản phẩm/chứng từ, hàng hóa có ảnh–SKU–barcode, số liệu tài chính có phân cấp rõ, trạng thái công việc có nhãn, thao tác chính xuất hiện trực tiếp. Đây là hệ thống giao diện AgriStock, không đưa logo hay tài sản của Shopify POS, Sortly, Revolut, Linear hoặc Things 3 vào app.

Kiểm tra web: tổng quan/báo cáo/hàng hóa ở 390 hoặc 375 px; báo cáo, giỏ hàng, biểu mẫu ở 320 px; giỏ hàng ngang 844×390. Đã kiểm tra điều hướng, lọc hàng, thêm/bỏ hàng trong giỏ, nhãn trạng thái và vị trí nút chính. Đây là kiểm tra cùng mã màn hình trên web; camera, in, chữ cỡ lớn hệ thống và thao tác native vẫn cần nghiệm thu trên điện thoại.
