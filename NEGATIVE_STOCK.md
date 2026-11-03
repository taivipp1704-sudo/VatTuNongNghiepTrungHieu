# HTAgri Android 21 - Thuốc BVTV và bán âm tồn kho

## Thêm thuốc BVTV

Trong **Sản phẩm → Thêm sản phẩm → Chọn nhóm hàng**, chọn **Thuốc BVTV** (gồm thuốc trừ sâu, trừ bệnh, diệt cỏ). Danh sách nhóm mở ngay trong biểu mẫu. Khi đơn vị chưa được tự sửa, app gợi ý **chai / chai / quy đổi 1**. Nếu bán thùng, đổi đóng gói thành thùng và điền đúng số chai/thùng. Quy đổi được giữ cố định sau khi tạo.

Nhập giá bán và giá vốn theo đơn vị cơ sở. Khi cùng đơn vị và quy đổi 1, có thể bỏ trống giá đóng gói để dùng giá cơ sở. Giá 25000 hoặc 25.000 đều được đọc là 25.000 đồng. Lỗi giá/quy đổi hiển thị rõ trước khi gửi; lỗi gửi giữ nguyên biểu mẫu để thử lại. Các nhóm Phân bón, Hạt giống, Vật tư vẫn hoạt động.

## Bật bán âm

1. Chủ cửa hàng/admin có quyền cấu hình mở **Thêm → Cửa hàng & bảo mật → Bán hàng & tồn kho**.
2. Bật **Cho phép bán âm tồn kho**, nhấn **Lưu cài đặt bán âm** và xác nhận.
3. Nếu nhân viên cần dùng, cấp thêm quyền **Cho phép bán âm tồn kho** cho role, cùng quyền Tạo đơn bán và đúng phạm vi kho. Chủ cửa hàng có quyền này sẵn.
4. Bán tại quầy như bình thường. Với mặt hàng hết tồn, app cho chọn khi có đủ cài đặt/quyền; bước thanh toán và hộp xác nhận nêu tồn sau bán.
5. Khi nhập hàng, lập phiếu theo lô thật và duyệt ghi sổ. App tự bù tồn âm trong đúng kho. Ví dụ 100 → bán 100 còn 0 → bán 1 còn -1 → nhập và ghi sổ 10 còn 9. Phiếu nháp/chờ duyệt chưa tăng tồn.

Tắt cài đặt chỉ ngăn bán âm mới, không xóa số âm cũ. Hàng nhập bù vẫn bù số âm khi cài đặt đã tắt. Các lô thật giữ giới hạn không âm; phần thiếu nằm ở mục Tồn bán âm riêng. Không xuất/chuyển/hủy từ mục này. Khi đối chiếu kiểm kê, chỉ được đưa mục tồn bán âm về 0 với lý do và ghi sổ có kiểm soát, không nhập số hàng thực vào mục này.

Lô hết hạn/cách ly không được cấp phát khi bán. Hàng trả đơn về cách ly, chỉ tham gia bù sau khi người có quyền kiểm tra và mở bán. Ảnh xác nhận, tiền, công nợ và tích điểm tiếp tục theo quy trình đã có.

Giá vốn phần bán âm dùng giá vốn cơ sở của hàng tại thời điểm bán; đơn lưu giá vốn đó. Nhập bù có giá khác không tự sửa giá vốn/lãi gộp của đơn cũ. Thẻ kho giữ các dòng bù; các dòng chuyển nội bộ để bù không bị tính trùng vào tổng nhập/xuất trên báo cáo.

## Kiểm tra

- API build và mobile typecheck đạt.
- 40 kiểm thử tự động API đạt, gồm 4 nhóm hàng, cài đặt/quyền/phạm vi kho, 100→0→-1→9, gửi lại không trùng, nhập bù một phần, hai thiết bị đồng thời, hàng trả cách ly và loại trừ lô hết hạn/cách ly.
- Kiểm tra giao diện với API được chặn/mô phỏng trong trình duyệt: chọn/lưu thuốc BVTV, đơn vị chai, giá có dấu phân cách, lưu lỗi/thử lại, thêm 3 nhóm khác, bán mặt hàng tồn 0 có cảnh báo.
- Dữ liệu kiểm thử chỉ nằm ở database riêng trên máy và trình duyệt; không tạo hàng/đơn thử trên dữ liệu vận hành.
- Cần nghiệm thu thao tác trên điện thoại Android thật sau khi cài cập nhật. Cài đè, giữ package và khóa ký cũ. Không có bản iOS ký trong lần này.
