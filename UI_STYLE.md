# Bố cục và phối màu AgriStock — Android 13

AgriStock dùng xanh rừng đậm và lime, nền sáng ấm và chữ đậm, áp dụng hướng Smart Garden từ [video người dùng gửi](VIDEO_UI.md). Hệ thống màu và font nằm trong `apps/mobile/src/theme.ts`; các màn hình dùng chung AppText, Label, Panel và các nút hiện có.

| Vai trò | Màu |
| --- | --- |
| Chữ chính / số liệu | Xanh đen `#1C2E23` |
| Thẻ doanh thu | Xanh rừng bán trong suốt, chữ trắng |
| Thanh đầu trang | Xanh đậm `#0B3224`, chữ trắng |
| Giá bán / tiền thực thu | Xanh đậm `#224E3B` |
| Đang giao dịch trên tổng quan | Chữ xanh đen, biểu tượng cam `#8D4500` trên khung sáng |
| Hoàn thành trên tổng quan | Chữ xanh đen, biểu tượng xanh `#08673E` trên khung sáng |
| Lỗi / giá trị âm | Đỏ `#B51F3D` |
| Nút lưu / thanh toán / tab được chọn | Xanh nhạt `#E6EDD9`, chữ xanh rừng `#164B35` |
| Nút Bán tại quầy | Nền trắng 8% trong suốt, chữ trắng, biểu tượng trên vòng xanh nhạt |
| Dữ liệu biểu đồ | Xanh `#22834C`, mốc chọn có viền đậm |

Nhãn chữ, biểu tượng và số tiền đi kèm màu để tránh phải đoán trạng thái chỉ qua màu sắc. Các cặp chữ chính đo được từ 5,18:1 trở lên; chữ trên lime 9,92:1; đường viền ô nhập 3,91:1 trên nền trắng.

Tổng quan có ảnh cánh đồng phủ phía sau toàn màn hình, cố định khi cuộn. Khối doanh thu/thực thu dùng lớp xanh bán trong suốt; các nhóm thông tin bên dưới dùng lớp sáng bán trong suốt, nút Bán tại quầy dạng viên trong suốt cùng tông với thẻ. Đây là ảnh nền được tạo riêng bằng image_gen, nhúng cục bộ trong APK, không phải ảnh sản phẩm hoặc vị trí thật của cửa hàng. Ảnh và prompt nằm trong `apps/mobile/assets/images/agri-landscape-v1.png` và tệp `.source.json` đi kèm. Không dùng blur native hoặc chụp màn hình mẫu làm nền.

Lớp phủ nền 26%, thẻ xanh 76% và thẻ sáng 95%. Đo bảo thủ cả hai cực ảnh đen/trắng: chữ trắng trên thẻ xanh đạt 8,24:1, chữ phụ 6,26:1; các cặp chữ trên thẻ sáng từ 5,65:1. Kết quả trong `artifacts/landscape-contrast.json`. Trạng thái đang tải ở tổng quan cũng có nền sáng để chữ không nằm trực tiếp trên ảnh.

Android 13 đồng bộ nút với khung theo ảnh tham khảo: bỏ các mảng cam/xanh đặc của trạng thái, dùng hai vùng bấm trong cùng panel với đường chia mảnh. Lối tắt bỏ viền hộp lồng nhau và nền biểu tượng đậm; chuyển sang vòng xanh nhạt, nhãn rõ. Nút biểu tượng đầu trang dạng tròn trong suốt. Nút lưu/thanh toán dùng nền xanh nhạt; bộ lọc và điều hướng dùng cùng họ màu. Nút native dùng container trong suốt và màu nền từ theme, tránh lớp nền đặc mặc định của nền tảng phủ lên màu đã chọn.

Tương phản mới: chữ trên nút xanh nhạt 8,36:1, trạng thái nhấn 7,38:1, chữ trắng trên nút trong suốt ở cực ảnh sáng nhất 6,63:1; viền nút trên xanh nhạt 3,26:1. Kết quả `artifacts/soft-controls-contrast.json`.

Tám lối tắt theo quyền được giữ; dải Hàng trong kho dùng cùng API đã giới hạn theo kho/quyền. Kho có thẻ ảnh hai cột hoặc danh sách; khi sửa điểm hàng loạt hoặc cỡ chữ hệ thống trên 1,3, dùng danh sách. Chi tiết sản phẩm hiển thị ảnh lớn; ảnh dùng chế độ contain để không cắt bao bì. Chưa có ảnh thì hiển thị biểu tượng và nhãn rõ. Biểu đồ một chỉ số dùng một màu; mốc đang chọn có viền và giá trị/ngày bên dưới.

Tiếp tục dùng công cụ của repo `D:/baoyu-design-main`: kiểm tra màu bằng `skills/dataviz/scripts/validate_palette.js` và xuất tham chiếu bằng `node scripts/export-design-system.mjs`. Thư mục `design-system/agristock/project` được sinh từ theme thật; công cụ check design-system đạt 0 lỗi cấu trúc, không kiểm tra render cover. Bản xuất này không thay nguồn theme của app. Không đưa mã editor, icon font hoặc ảnh mockup từ nguồn tham khảo vào APK.

**Inter** dùng cho nội dung, ô nhập và số tiền; **Manrope** dùng cho tiêu đề. Cỡ nội dung 16, chú thích chung 14; số tiền quan trọng dùng chữ đậm và chữ số có độ rộng đều. Font được nhúng sẵn, không tải từ Google khi mở app. Không tắt cơ chế phóng to chữ của hệ điều hành.

Nguồn font: [Inter](https://github.com/google/fonts/tree/main/ofl/inter), [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope). Tạo các bản TTF tĩnh từ variable font bằng fontTools 4.60.1: Inter 400/500/600/700 với optical size 14, Manrope 600/700. Đối chiếu đủ chữ tiếng Việt và ký hiệu đồng; thông tin tệp và SHA-256 trong `apps/mobile/assets/fonts/ui-sources.json`. Giấy phép OFL đi kèm mã nguồn và APK tại thư mục licenses.

Theo hướng tham khảo người dùng đề xuất: giữ bố cục POS cho bán hàng/sản phẩm/chứng từ, hàng hóa có ảnh–SKU–barcode, số liệu tài chính có phân cấp rõ, trạng thái công việc có nhãn, thao tác chính xuất hiện trực tiếp. Đây là hệ thống giao diện AgriStock, không đưa logo hay tài sản của Shopify POS, Sortly, Revolut, Linear hoặc Things 3 vào app.

Kiểm tra web áp dụng cho cùng mã màn hình; camera, in, chữ cỡ lớn hệ thống và thao tác native vẫn cần nghiệm thu trên điện thoại. Kết quả của từng bản trong VALIDATION.md.
