# Chức năng quản lý cửa hàng · Android 14

Phạm vi đã chốt: bán trực tiếp tại quầy cho một doanh nghiệp; nhiều nhân viên dùng chung máy chủ. Các ảnh trong thư mục tham khảo chỉ dùng để đối chiếu chức năng. Không đưa ảnh, danh bạ hoặc bản ghi âm riêng tư lên repository hay APK.

| Khu vực mẫu | Chức năng trong AgriStock |
| --- | --- |
| Tổng quan | Doanh thu, thực thu, đơn đang giao dịch/hoàn thành, biểu đồ tuần, cảnh báo kho; bật/tắt thao tác nhanh trên từng tài khoản và thiết bị. |
| Sản phẩm | Trung tâm sản phẩm; tìm tên/SKU/barcode; ảnh sản phẩm; nhóm, đơn vị và quy đổi; giá lẻ/sỉ theo hai đơn vị; khối lượng, quy cách; bật/tắt cho bán tại quầy; số chấm tích điểm. |
| Kho | Nhập, xuất nội bộ, chuyển kho, kiểm kê, nhận trả, cách ly/hủy; duyệt phiếu và nhật ký; tồn thực tế, giữ hàng, khả dụng, hàng đang nhập; vị trí và tồn tối thiểu/tối đa theo kho. |
| Tem mã vạch | Xem trước Code 128 hoặc QR; dùng barcode hoặc SKU; chọn số tem và ba khổ; xuất/chia sẻ PDF A4 hoặc mở trình in của hệ điều hành. Tối đa 200 tem/lần, 100 tem/mặt hàng; QR dùng khổ 50×30 hoặc 70×35 mm. |
| Bán tại quầy | Tìm/quét hàng, chọn khách, bảng giá lẻ/sỉ theo quyền, chỉnh giá theo quyền; chiết khấu số tiền hoặc phần trăm; áp dụng đề xuất của hồ sơ khách bằng thao tác rõ ràng; tích/đổi điểm; tiền mặt/chuyển khoản/ghi nợ; ghi chú; phiếu bán PDF. |
| Giỏ tạm | Lưu tối đa 10 giỏ trên thiết bị, theo tài khoản và kho; mở lại hoặc xóa nháp. Giữ nguyên khóa giao dịch để hạn chế ghi trùng khi thử lại. Bản nháp chưa trừ kho hay ghi doanh thu. |
| Đơn hàng | Tìm mã/tên/SĐT khách ở máy chủ, lọc trạng thái/ngày, sắp xếp, phân trang; thu phần còn thiếu, trả hàng, phiếu PDF và ảnh chứng từ theo quyền. |
| Khách hàng | Tìm tên/SĐT/mã/nhóm, lọc hoạt động, hạng thành viên, sắp xếp theo tên/chi tiêu/dư nợ; hồ sơ cơ bản và ba tab Thông tin–Công nợ–Lịch sử. |
| Thông tin khách | Mã, email, nhóm, ngày sinh, giới tính, MST, địa chỉ, bảng giá/chiết khấu đề xuất, người phụ trách, trạng thái giao dịch, nhiều địa chỉ/người liên hệ. Thay đổi hồ sơ không mở rộng quyền bán sỉ hay giảm giá của nhân viên. |
| Công nợ khách | Sổ bán hàng/thu/hoàn tiền/trả hàng/điều chỉnh, số dư sau từng giao dịch, phân trang và phạm vi kho. Quyền điều chỉnh số dư riêng, bắt buộc lý do và xác nhận. |
| Báo cáo | Ba khu vực Bán hàng–Kho–Tài chính; ngày/tuần/tháng/quý/năm, hôm qua/kỳ trước, 7/30 ngày gần nhất và khoảng tùy chọn 1–366 ngày theo giờ Việt Nam; biểu đồ bán hàng, lãi gộp/biên lãi theo quyền, nhập–xuất–tồn, thu–chi, CSV/PDF. |
| Quản trị | Nhiều role/tài khoản, bật/tắt từng quyền, kho được phép, khóa/mở tài khoản, nhật ký. Giá sỉ, điều chỉnh sổ nợ và báo cáo tài chính có quyền riêng. |

## Quy tắc cần phân biệt

- Tồn khả dụng loại trừ lô hết hạn, cách ly và số lượng đã giữ. Kiểm kê thay số lượng qua phiếu theo lô; không sửa đè tổng tồn. Không cho bán âm kho.
- Giá vốn doanh thu tính từ lô thực tế đã xuất; ưu tiên lô còn hạn theo FEFO. Không chuyển dữ liệu lịch sử sang phương pháp MAC trong ảnh mẫu. Chỉ số giá trị tồn hiện tại dùng giá vốn các lô hiện tại.
- Dư nợ dương là phải thu, âm là ghi có trên sổ. Điều chỉnh sổ nợ không tạo khoản thu/chi, không tất toán từng đơn và không tự trừ tiền giỏ mua tiếp. Thu tiền thật qua đơn hàng hoặc mục Công nợ.
- Tài chính là thu/chi đã ghi trong app. Lũy kế ghi nhận không khẳng định số dư tiền mặt/ngân hàng thực tế. Xuất báo cáo tài chính gồm trang hiện tại; báo cáo kho gồm các dòng đã tải, tối đa 5.000 dòng. Danh sách hàng/khách/đơn phân trang 50 dòng.
- Giỏ tạm và tùy chỉnh thao tác nhanh chỉ lưu trên thiết bị. Hàng, khách, đơn, ảnh và giao dịch đã ghi sổ được đồng bộ qua API.
- Không có bán online, tra cước, vận chuyển hoặc Facebook theo quyết định phạm vi. Không suy đoán quy tắc khuyến mãi tự động từ nút trong ảnh: hiện có chiết khấu thủ công và tích/đổi điểm.
- Phiếu bán nội bộ chưa tính thuế và không phải hóa đơn điện tử. Tích hợp hóa đơn điện tử/máy in chuyên dụng vẫn cần nhà cung cấp và thiết bị cụ thể. Nhập file và kết nối dữ liệu ngoài đang hoãn theo yêu cầu trước.

## Kiểm tra và giới hạn bản thử

Kiểm tra API bao gồm quyền, phạm vi kho, giá sỉ, giữ dữ liệu mới khi APK cũ cập nhật, chống ghi trùng, phân trang, ngày báo cáo và đối chiếu công nợ sau trả/hoàn tiền. Kiểm tra sao lưu–khôi phục gồm ảnh, hồ sơ JSON, thiết lập kho và điều chỉnh công nợ. Code 128/QR đã được giải mã lại bằng bộ đọc độc lập.

Giao diện được kiểm tra trên trình xem web ở chiều rộng 390 và 320 px với dữ liệu QA riêng. Cần nghiệm thu APK trên Android thật, camera, lịch ngày gốc và in giấy với máy in thực tế. Chưa có bản iOS được ký hoặc phát hành.

Máy chủ vẫn là Render Free đã chọn để thử từ xa. Đây không phải xác nhận sẵn sàng vận hành thương mại lâu dài; xem REMOTE_ANDROID.md về thời gian ngủ và hạn cơ sở dữ liệu thử.
