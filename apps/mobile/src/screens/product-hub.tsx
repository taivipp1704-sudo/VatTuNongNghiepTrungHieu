import { router } from "expo-router";
import {
  Button,
  Caption,
  Denied,
  Label,
  LinkRow,
  Page,
  Panel,
} from "@/components/ui";
import { can } from "@/lib/session";
export default function ProductHub() {
  if (!can("inventory.view")) return <Denied />;
  return (
    <Page>
      <Label big>Sản phẩm & kho hàng</Label>
      <Caption>
        Quản lý hàng hóa, nhập và kiểm kho, nhà cung cấp, tem mã vạch.
      </Caption>
      {can("products.manage") && can("inventory.cost.view") ? (
        <Button
          title="Thêm sản phẩm"
          onPress={() => router.push("/product-form")}
        />
      ) : null}
      <Panel>
        <LinkRow
          title="Danh sách sản phẩm"
          description="Ảnh, giá, tồn kho và số chấm"
          onPress={() => router.push("/inventory")}
        />
        {can("inventory.receipt.create") ? (
          <LinkRow
            title="Nhập hàng"
            description="Tạo phiếu nhập từ nhà cung cấp"
            onPress={() => router.push("/stock-form?kind=RECEIPT")}
          />
        ) : null}
        {can("inventory.count.create") ? (
          <LinkRow
            title="Kiểm hàng"
            description="Ghi nhận kiểm kê theo lô, duyệt và lưu nhật ký"
            onPress={() => router.push("/stock-form?kind=COUNT")}
          />
        ) : null}
        <LinkRow
          title="Phiếu kho & lịch sử"
          onPress={() => router.push("/documents")}
        />
        {can("partners.view") ? (
          <LinkRow
            title="Nhà cung cấp"
            onPress={() => router.push("/partners?kind=SUPPLIER")}
          />
        ) : null}
        <LinkRow
          title="In tem mã vạch"
          description="Chọn mặt hàng, số tem và khổ giấy; xem trước, chia sẻ PDF hoặc in"
          onPress={() => router.push("/barcode-labels")}
        />
        {can("reports.view") ? (
          <LinkRow
            title="Báo cáo nhập xuất tồn"
            onPress={() => router.push("/reports?section=inventory")}
          />
        ) : null}
      </Panel>
    </Page>
  );
}
