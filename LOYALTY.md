# Cấu hình tích điểm khách hàng

Dùng **AgriStock Test** bản 3 trở lên. Đăng nhập bằng chủ cửa hàng hoặc vai trò có quyền **Cấu hình % số chấm và quy đổi điểm**. Chương trình khởi đầu ở trạng thái tắt; hàng hóa sẵn có giữ tỷ lệ 0 cho đến khi bạn chỉnh.

## Bật và chọn quy tắc

Mở **Thêm → Tích điểm khách hàng**. Chọn các tùy chỉnh, rồi bấm **Lưu cấu hình tích điểm**:

| Tùy chỉnh | Cách hoạt động |
|---|---|
| Bật tích điểm khách hàng | Áp dụng cho đơn mới có chọn khách hàng có hồ sơ |
| Giá trị 1 điểm | Số đồng tương ứng với 1 điểm, dùng để tính điểm mới và khi đổi điểm |
| Thời điểm cộng | Khi thu đủ tiền; theo tỷ lệ tiền đã thu; hoặc ngay khi ghi nhận đơn, kể cả ghi nợ |
| Tiền làm căn cứ | Sau chiết khấu hoặc trước chiết khấu; cả hai đều loại phần tiền giảm bằng điểm |
| Làm tròn | Xuống điểm nguyên; gần nhất, từ 0,5 làm tròn lên; hoặc luôn làm tròn lên |
| Đổi điểm giảm tiền | Tắt để chỉ theo dõi tích lũy; bật để dùng điểm trong lần mua tiếp theo |
| Điểm tối thiểu mỗi lần đổi | Chặn những lần đổi nhỏ hơn mức bạn đặt |
| Giới hạn giảm bằng điểm | Tối đa 0–100% số tiền đơn sau chiết khấu |
| Thu hồi điểm khi trả | Bật để thu hồi điểm đơn đã cộng khi trả toàn bộ đơn |
| Hoàn điểm đã dùng khi trả | Bật để trả lại số điểm đã dùng giảm tiền của đơn |
| Hạng thành viên | Bật/tắt xếp hạng; đặt tên và ngưỡng từ thấp đến cao, hạng đầu bắt đầu ở 0 |

Khi chọn cộng theo tỷ lệ thu tiền, hệ thống tính tổng điểm đã đủ điều kiện từ số tiền đã thu, làm tròn xuống; khi thu đủ sẽ cộng phần còn lại của đơn. Chọn **Khi thu đủ tiền đơn** nếu bạn muốn chờ thanh toán xong mới cộng toàn bộ.

Quy tắc cộng được giữ theo thời điểm bán: thay tỷ lệ mặt hàng, giá trị điểm, hoặc tắt chương trình không tính lại đơn cũ. Khoản thu nợ của đơn cũ vẫn dùng quy tắc đã lưu của đơn đó. Đơn được bán trước khi có tính năng này không tự phát sinh điểm.

**Thay Giá trị 1 điểm cũng thay giá trị khi đổi số điểm khách đang có.** Màn hình xác nhận nhắc điều này trước khi lưu. Số điểm đã cộng và tiền của đơn cũ được giữ nguyên.

## Đặt số chấm cho từng mặt hàng

Trong **Thêm → Kho hàng**, tìm mặt hàng theo tên hoặc SKU, bấm biểu tượng bút chì cạnh số chấm hoặc mở chi tiết hàng. Trong **Tích điểm của mặt hàng**, nhập **Số chấm (%)**, rồi bấm **Lưu số chấm**. Bạn cũng có thể nhập tỷ lệ khi tạo hoặc sửa hàng hóa.

- Phân bón: nhập `0,1` để áp dụng **0,1%**.
- Thuốc trừ sâu: nhập `0,5` để áp dụng **0,5%**.
- Nhập `0` để mặt hàng không tích điểm.

Bạn có thể dùng dấu phẩy hoặc dấu chấm, tối đa 4 chữ số thập phân. Tỷ lệ lưu riêng cho từng SKU; chọn nhóm “Phân bón” không tự đặt tỷ lệ cho mọi mặt hàng cùng nhóm. Nhân viên không có quyền cấu hình không thể sửa tỷ lệ, kể cả qua API. Để đặt cùng tỷ lệ cho nhiều SKU, dùng **Sửa hàng loạt**, chọn tối đa 100 mặt hàng, nhập tỷ lệ và xác nhận; không tự áp dụng cho mặt hàng chưa chọn.

Ví dụ bạn đặt **1 điểm = 1.000đ**, làm tròn xuống và cộng khi thu đủ:

| Đơn hàng, chưa chiết khấu | Điểm khi thu đủ |
|---|---:|
| 1.000.000đ phân bón ở mức 0,1% | 1 điểm |
| 1.000.000đ thuốc ở mức 0,5% | 5 điểm |
| Cả hai mặt hàng trên | 6 điểm |

Đổi Giá trị 1 điểm thành 1đ thì hai dòng đầu tương ứng 1.000 và 5.000 điểm. Bạn tự chọn mức quy đổi phù hợp.

## Tích và dùng điểm khi bán

1. Mở **Bán hàng**, thêm hàng và chọn khách trong **Khách hàng**. Khách lẻ không có hồ sơ không tích hoặc đổi điểm.
2. Xem điểm khả dụng và điểm dự kiến. Tổng điểm cả đơn được tính theo tỷ lệ của từng dòng, không lấy một tỷ lệ chung cho giỏ.
3. Nếu admin bật đổi điểm và nhân viên có quyền **Đổi điểm giảm tiền khi bán hàng**, bật **Dùng điểm trừ tiền**, nhập **Số điểm dùng giảm tiền**. App tính lại **Giảm bằng điểm** và **Tổng thanh toán**. Nếu cấu hình hoặc số dư đổi trong khi bán, tải lại tổng trước khi xác nhận.
4. Bấm **Ghi nhận đơn bán**. Chỉ sau khi máy chủ xác nhận, điểm mới được cộng/trừ và tồn kho, công nợ được ghi nhận.

Điểm dự kiến cả đơn có thể khác số điểm vừa được cộng nếu đơn chưa thu đủ. Các khoản thu trong **Công nợ** tiếp tục cộng theo quy tắc của đơn. Hai điện thoại cùng đổi điểm sẽ được kiểm tra số dư trên máy chủ, không được dùng trùng cùng số điểm.

## Xem lịch sử và xử lý trả hàng

Mở **Khách hàng → Lịch sử điểm** tại hồ sơ khách. Số dư dùng chung toàn cửa hàng; lịch sử hiển thị tối đa 100 giao dịch gần nhất thuộc phạm vi kho của tài khoản.

Trả toàn bộ đơn áp dụng hai tùy chọn thu hồi điểm đã cộng và hoàn điểm đã dùng được lưu lúc bán. Mặc định cả hai được bật. Đơn cũ trước khi có tùy chọn vẫn thu hồi/hoàn như trước; thay cấu hình hôm nay không thay quy tắc của đơn đã bán. Tiền hoàn chỉ là phần tiền đã thực thu, không quy đổi lại số điểm đã dùng thành tiền mặt. Nếu khách đã dùng điểm của đơn gốc ở lần mua khác, thu hồi điểm có thể làm số dư âm; các lần tích sau bù số âm trước khi khách được đổi tiếp.

Phiếu PDF hiển thị khoản giảm bằng điểm riêng với chiết khấu và số điểm đã cộng theo đơn. Lịch sử giữ các bút toán trả điểm để đối chiếu, không xóa giao dịch cũ.


## Chỉnh điểm và hạng thành viên

Tại **Khách hàng**, người có quyền **Điều chỉnh điểm thưởng thủ công** chọn **Chỉnh điểm tay (Admin)**, nhập số nguyên dương để cộng hoặc âm để trừ, ghi lý do rồi xác nhận. Lịch sử giữ người thực hiện, thời điểm và lý do; không sửa hoặc xóa bút toán cũ. Điều chỉnh tay được kiểm tra số dư trên máy chủ và không làm tăng hạng thành viên.

Hạng dựa trên tổng điểm mua hàng đã cộng, trừ điểm mua hàng bị thu hồi khi trả. Dùng điểm giảm tiền không làm hạ hạng. Ngưỡng và tên hạng áp dụng theo cấu hình hiện tại; tắt xếp hạng không xóa điểm khách.
