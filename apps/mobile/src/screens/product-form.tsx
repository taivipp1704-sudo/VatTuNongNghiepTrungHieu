import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Caption,
  Denied,
  Field,
  Notice,
  Page,
  Panel,
  Select,
  Toggle,
  confirmAction,
} from "@/components/ui";
import { useApi, useCommand } from "@/lib/api";
import { can } from "@/lib/session";
import { Product } from "@/types";
import { useScan } from "@/lib/scanner";
import { parseRate } from "@/lib/loyalty";

export function ProductForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const query = useApi<Product[]>(
    "/inventory",
    Boolean(id) && can("products.manage"),
  );
  const [form, setForm] = useState({
    sku: "",
    barcode: "",
    name: "",
    category: "Phân bón",
    baseUnit: "kg",
    packUnit: "bao",
    packFactor: "50",
    priceBase: "",
    pricePack: "",
    costBase: "",
    minStock: "",
    trackLots: true,
    technicalInfo: "",
    loyaltyRate: "0",
    imageUrl: "",
  });
  const command = useCommand();
  const scan = useScan();
  useEffect(() => {
    const item = query.data?.find((item) => item.id === id);
    if (item)
      setForm({
        sku: item.sku,
        barcode: item.barcode || "",
        name: item.name,
        category: item.category,
        baseUnit: item.base_unit,
        packUnit: item.pack_unit,
        packFactor: String(item.pack_factor),
        priceBase: String(item.price_base),
        pricePack: String(item.price_pack),
        costBase: String(item.cost_base ?? ""),
        minStock: String(item.min_stock),
        trackLots: item.track_lots,
        technicalInfo: item.technical_info,
        loyaltyRate: String(item.loyalty_rate ?? 0).replace(".", ","),
        imageUrl: item.image_url || "",
      });
  }, [query.data, id]);
  useEffect(() => {
    if (scan.target === "product" && scan.code) {
      setForm((value) => ({ ...value, barcode: scan.code }));
      scan.clear();
    }
  }, [scan.code, scan.target]);
  if (!can("products.manage") || !can("inventory.cost.view")) return <Denied />;
  const field = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    const { loyaltyRate: rateInput, ...details } = form;
    const rate = parseRate(rateInput);
    if (can("loyalty.manage") && rate === undefined) {
      command.setError("Số chấm cần từ 0 đến 100%, tối đa 4 số thập phân.");
      return;
    }
    const body = {
      ...details,
      ...(can("loyalty.manage") ? { loyaltyRate: rate } : {}),
      packFactor: Number(form.packFactor),
      priceBase: Number(form.priceBase),
      pricePack: Number(form.pricePack),
      costBase: Number(form.costBase),
      minStock: Number(form.minStock || 0),
    };
    if (
      !form.sku.trim() ||
      !form.name.trim() ||
      !form.priceBase ||
      !form.pricePack ||
      !form.costBase
    ) {
      command.setError("Nhập mã hàng, tên, giá bán và giá vốn.");
      return;
    }
    if (
      !(await confirmAction(
        id ? "Lưu thay đổi hàng hóa" : "Tạo hàng hóa",
        form.name,
      ))
    )
      return;
    const result = await command.run(
      id ? "/products/" + id : "/products",
      body,
      id ? "PATCH" : "POST",
    );
    if (result) router.back();
  };
  return (
    <Page>
      <Panel>
        <Field
          label="Mã hàng (SKU)"
          value={form.sku}
          onChangeText={(value) => field("sku", value)}
          autoCapitalize="characters"
        />
        <Field
          label="Tên hàng hóa"
          value={form.name}
          onChangeText={(value) => field("name", value)}
        />
        <Select
          label="Nhóm hàng"
          value={form.category}
          onChange={(value) => field("category", value)}
          options={["Phân bón", "Thuốc BVTV", "Hạt giống", "Vật tư"].map(
            (value) => ({ value, label: value }),
          )}
        />
        <Field
          label="Mã vạch"
          value={form.barcode}
          onChangeText={(value) => field("barcode", value)}
        />
        <Button
          title="Quét mã vạch"
          secondary
          onPress={() =>
            router.push({ pathname: "/scan", params: { target: "product" } })
          }
        />
        <Field
          label="Đơn vị cơ sở"
          value={form.baseUnit}
          onChangeText={(value) => field("baseUnit", value)}
          editable={!id}
        />
        <Field
          label="Đơn vị đóng gói"
          value={form.packUnit}
          onChangeText={(value) => field("packUnit", value)}
          editable={!id}
        />
        <Field
          label="Hệ số quy đổi (1 đơn vị đóng gói = ? cơ sở)"
          value={form.packFactor}
          onChangeText={(value) => field("packFactor", value)}
          keyboardType="decimal-pad"
          editable={!id}
        />
        <Field
          label="Giá bán / đơn vị cơ sở (đồng)"
          value={form.priceBase}
          onChangeText={(value) => field("priceBase", value)}
          keyboardType="numeric"
        />
        <Field
          label="Giá bán / đơn vị đóng gói (đồng)"
          value={form.pricePack}
          onChangeText={(value) => field("pricePack", value)}
          keyboardType="numeric"
        />
        <Field
          label="Giá vốn / đơn vị cơ sở (đồng)"
          value={form.costBase}
          onChangeText={(value) => field("costBase", value)}
          keyboardType="numeric"
        />
        {can("loyalty.manage") ? (
          <>
            <Field
              label="Số chấm tích điểm (%)"
              value={form.loyaltyRate}
              onChangeText={(value) => field("loyaltyRate", value)}
              keyboardType="decimal-pad"
            />
            <Caption>
              Nhập 0,1 cho 0,1%; 0,5 cho 0,5%. Nhập 0 để không tích điểm.
            </Caption>
          </>
        ) : null}
        <Field
          label="Mức tồn tối thiểu (đơn vị cơ sở)"
          value={form.minStock}
          onChangeText={(value) => field("minStock", value)}
          keyboardType="decimal-pad"
        />
        <Toggle
          label="Theo dõi số lô và hạn sử dụng"
          value={form.trackLots}
          onChange={(value) => field("trackLots", value)}
          disabled={Boolean(id)}
        />
        <Field
          label="Thông tin kỹ thuật đã kiểm chứng"
          value={form.technicalInfo}
          onChangeText={(value) => field("technicalInfo", value)}
          multiline
        />
        <Field
          label="Đường dẫn ảnh sản phẩm (HTTP/HTTPS)"
          value={form.imageUrl}
          onChangeText={(value) => field("imageUrl", value)}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="https://.../san-pham.jpg"
        />
        <Notice error>{command.error}</Notice>
        <Button
          title={id ? "Lưu hàng hóa" : "Tạo hàng hóa"}
          onPress={save}
          pending={command.pending}
        />
      </Panel>
    </Page>
  );
}
