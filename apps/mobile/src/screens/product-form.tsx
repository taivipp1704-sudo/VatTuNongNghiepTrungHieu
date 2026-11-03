import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Caption,
  Denied,
  Notice,
  Page,
  Toggle,
  confirmAction,
} from "@/components/ui";
import { useApi, useCommand } from "@/lib/api";
import { can, userKey } from "@/lib/session";
import { Bootstrap, Product } from "@/types";
import { theme } from "@/theme";
import { AppText } from "@/components/text";
import { ChoiceList, Icon } from "@/components/pos-ui";
import {
  ProductFormCard,
  ProductFormColumns,
  ProductFormField as Field,
} from "@/components/product-form-ui";
import { useWarehouse } from "@/lib/warehouse";
import { useScan } from "@/lib/scanner";
import { ProductImageEditor } from "@/components/product-image-editor";
import { parseRate } from "@/lib/loyalty";

const unitDefaults: Record<string,[string,string,string]> = {
  "Phân bón":["kg","bao","50"], "Thuốc BVTV":["chai","chai","1"],
  "Hạt giống":["gói","gói","1"], "Vật tư":["cái","cái","1"],
};
function moneyInput(raw: string) {
  const value=raw.trim().replace(/\s/g,"");
  if (/^\d{1,3}([.,]\d{3})+$/.test(value)) return Number(value.replace(/[.,]/g,""));
  return /^\d+$/.test(value)?Number(value):NaN;
}
const decimalInput=(raw:string)=>Number(raw.trim().replace(",","."));

export function ProductForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const query = useApi<Product[]>(
    "/inventory?search=" + encodeURIComponent(id ?? ""),
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
  const [loadedId, setLoadedId] = useState("");
  const [extra, setExtra] = useState({
    wholesaleBase: "",
    wholesalePack: "",
    weightGrams: "0",
    dimensions: "",
    sellable: true,
  });
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const bootstrap = useApi<Bootstrap>("/bootstrap");
  const warehouseId = useWarehouse((state) => state.warehouseId);
  const warehouseNamespace = userKey("active-warehouse");
  useEffect(() => {
    if (bootstrap.data)
      void useWarehouse
        .getState()
        .configure(warehouseNamespace, bootstrap.data.warehouses);
  }, [bootstrap.data, warehouseNamespace]);
  const command = useCommand();
  const scan = useScan();
  useEffect(() => {
    const item = query.data?.find((item) => item.id === id);
    if (item && loadedId !== id) {
      setLoadedId(id || "");
      setExtra({
        wholesaleBase:
          item.details?.wholesaleBase == null
            ? ""
            : String(item.details.wholesaleBase),
        wholesalePack:
          item.details?.wholesalePack == null
            ? ""
            : String(item.details.wholesalePack),
        weightGrams: String(item.details?.weightGrams ?? 0),
        dimensions: item.details?.dimensions ?? "",
        sellable: item.details?.sellable !== false,
      });
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
    }
  }, [query.data, id, loadedId]);
  useEffect(() => {
    if (scan.target === "product" && scan.code) {
      setForm((value) => ({ ...value, barcode: scan.code }));
      scan.clear();
    }
  }, [scan.code, scan.target]);
  if (!can("products.manage") || !can("inventory.cost.view")) return <Denied />;
  const field = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const chooseCategory = (category: string) => {
    setForm(current=>{
      const preset=unitDefaults[current.category];
      const usePreset=!id && preset && current.baseUnit===preset[0] && current.packUnit===preset[1] && current.packFactor===preset[2];
      const next=unitDefaults[category];
      return {...current,category,...(usePreset&&next?{baseUnit:next[0],packUnit:next[1],packFactor:next[2]}:{})};
    });
    setCategoryOpen(false);
  };
  const ready = !id || loadedId === id;
  const warehouse = bootstrap.data?.warehouses.find(
    (item) => item.id === warehouseId,
  );
  const save = async () => {
    if (!ready || command.pending || imageBusy) return;
    const { loyaltyRate: rateInput, ...details } = form;
    const rate = parseRate(rateInput);
    if (can("loyalty.manage") && rate === undefined) {
      command.setError("Số chấm cần từ 0 đến 100%, tối đa 4 số thập phân.");
      return;
    }
    const body = {
      ...details,
      ...(can("loyalty.manage") ? { loyaltyRate: rate } : {}),
      packFactor: decimalInput(form.packFactor),
      priceBase: moneyInput(form.priceBase),
      pricePack: moneyInput(form.pricePack || (form.baseUnit.trim()===form.packUnit.trim() && decimalInput(form.packFactor)===1 ? form.priceBase : "")),
      costBase: moneyInput(form.costBase),
      minStock: decimalInput(form.minStock || "0"),
      details: {
        wholesaleBase:
          extra.wholesaleBase.trim() === ""
            ? null
            : moneyInput(extra.wholesaleBase),
        wholesalePack:
          extra.wholesalePack.trim() === ""
            ? null
            : moneyInput(extra.wholesalePack),
        weightGrams: decimalInput(extra.weightGrams || "0"),
        dimensions: extra.dimensions,
        sellable: extra.sellable,
      },
    };
    if (
      !form.sku.trim() ||
      !form.name.trim() ||
      !form.priceBase ||
      !form.costBase
    ) {
      command.setError("Nhập mã hàng, tên, giá bán và giá vốn.");
      return;
    }
    if (!form.baseUnit.trim() || !form.packUnit.trim() || !Number.isFinite(body.packFactor) || body.packFactor<=0 || body.packFactor>1000000 || Math.abs(body.packFactor*1000-Math.round(body.packFactor*1000))>0.00001) {
      command.setError("Nhập đơn vị và quy đổi lớn hơn 0, tối đa 3 số thập phân. Bán lẻ chai/gói: dùng cùng đơn vị, quy đổi 1.");return;
    }
    for (const [label,amount] of [["Giá bán cơ sở",body.priceBase],["Giá bán đóng gói",body.pricePack],["Giá vốn",body.costBase],["Giá sỉ cơ sở",body.details.wholesaleBase],["Giá sỉ đóng gói",body.details.wholesalePack]] as const) {
      if(amount!==null && (!Number.isSafeInteger(amount)||amount<0||amount>1000000000000)) {command.setError(label+" cần là số đồng nguyên không âm. Có thể nhập 25000 hoặc 25.000.");return;}
    }
    if(!Number.isFinite(body.minStock)||body.minStock<0||body.minStock>1000000||!Number.isFinite(body.details.weightGrams)||body.details.weightGrams<0||body.details.weightGrams>100000000) {command.setError("Kiểm tra tồn tối thiểu và khối lượng: nhập số không âm.");return;}
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
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        edges={["top"]}
        style={{ backgroundColor: theme.colors.paper }}
      >
        <View
          style={{
            minHeight: 56,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 8,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={() => router.back()}
            style={({ pressed }) => ({
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name="close" color={theme.colors.muted} size={26} />
          </Pressable>
          <AppText
            accessibilityRole="header"
            style={{
              flex: 1,
              fontSize: 18,
              fontWeight: "600",
              color: theme.colors.text,
              textAlign: "center",
            }}
          >
            {id ? "Sửa hàng hóa" : "Thêm hàng hóa"}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lưu hàng hóa trên thanh tiêu đề"
            accessibilityState={{
              disabled: command.pending || imageBusy || !ready,
            }}
            disabled={command.pending || imageBusy || !ready}
            onPress={save}
            style={({ pressed }) => ({
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              opacity:
                command.pending || imageBusy || !ready
                  ? 0.4
                  : pressed
                    ? 0.6
                    : 1,
            })}
          >
            <Icon name="check" size={27} color={theme.colors.muted} />
          </Pressable>
        </View>
      </SafeAreaView>
      <Page
        footer={
          <View style={{ gap: 6 }}>
            <Notice error>{command.error}</Notice>
            <Button
              title="Lưu"
              testID="product-save"
              onPress={save}
              pending={command.pending}
              disabled={!ready || imageBusy}
            />
          </View>
        }
      >
        {id && !ready ? (
          <Notice>
            {query.error
              ? "Chưa tải được hàng hóa. Thử tải lại trước khi chỉnh sửa."
              : query.isPending
                ? "Đang tải thông tin hàng hóa…"
                : "Không tìm thấy hàng hóa trong phạm vi kho hiện tại."}
          </Notice>
        ) : null}
        {id && query.error ? (
          <Button
            secondary
            title="Thử tải lại hàng hóa"
            onPress={() => {
              void query.refetch();
            }}
          />
        ) : null}
        <ProductImageEditor
          value={form.imageUrl}
          onChange={(value) => field("imageUrl", value)}
          name={form.name}
          category={form.category}
          disabled={command.pending || !ready}
          onBusyChange={setImageBusy}
        />
        <ProductFormCard>
          <Field
            label="Tên hàng hóa"
            required
            value={form.name}
            onChangeText={(value) => field("name", value)}
            placeholder="Nhập tên hàng hóa"
          />
          <ProductFormColumns>
            <Field
              label="Mã hàng (SKU)"
              required
              value={form.sku}
              onChangeText={(value) => field("sku", value)}
              autoCapitalize="characters"
              placeholder="Nhập mã hàng"
            />
            <View
              style={{ flexDirection: "row", gap: 4, alignItems: "flex-end" }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Field
                  label="Mã vạch"
                  value={form.barcode}
                  onChangeText={(value) => field("barcode", value)}
                  placeholder="Nhập hoặc quét"
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quét mã vạch"
                onPress={() =>
                  router.push({
                    pathname: "/scan",
                    params: { target: "product" },
                  })
                }
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Icon name="barcode-scan" size={25} />
              </Pressable>
            </View>
          </ProductFormColumns>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn nhóm hàng"
            onPress={() => setCategoryOpen(true)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              minHeight: 48,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.control,
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <AppText
              style={{ color: theme.colors.muted, fontSize: 13, flex: 1 }}
            >
              Nhóm hàng
            </AppText>
            <AppText style={{ fontSize: 15 }}>{form.category}</AppText>
            <Icon name="chevron-down" color={theme.colors.muted} size={20} />
          </Pressable>
          {categoryOpen ? <View style={{gap:8}}>
            <ChoiceList label="Chọn nhóm hàng hóa" value={form.category} onChange={chooseCategory}
              options={Object.keys(unitDefaults).map(value=>({value,title:value,description:value==="Thuốc BVTV"?"Thuốc trừ sâu, trừ bệnh, diệt cỏ và thuốc bảo vệ thực vật":""}))} />
            <Button title="Đóng chọn nhóm" secondary onPress={()=>setCategoryOpen(false)} />
          </View> : null}
          <ProductFormColumns columns={3}>
            <Field
              label="Đơn vị cơ sở"
              value={form.baseUnit}
              onChangeText={(value) => field("baseUnit", value)}
              editable={!id}
            />
            <Field
              label="Đóng gói"
              accessibilityLabel="Đơn vị đóng gói"
              value={form.packUnit}
              onChangeText={(value) => field("packUnit", value)}
              editable={!id}
            />
            <Field
              label="Quy đổi"
              accessibilityLabel="Hệ số quy đổi (1 đơn vị đóng gói = ? cơ sở)"
              value={form.packFactor}
              onChangeText={(value) => field("packFactor", value)}
              keyboardType="decimal-pad"
              editable={!id}
            />
          </ProductFormColumns>
          <Caption>
            1 {form.packUnit || "đơn vị đóng gói"} = {form.packFactor || "…"}{" "}
            {form.baseUnit || "đơn vị cơ sở"}
            {id ? " · Quy đổi được giữ cố định sau khi tạo." : ""}
          </Caption>
          {form.category==="Thuốc BVTV" ? <Caption>Bán từng chai: cơ sở chai, đóng gói chai, quy đổi 1. Nếu bán thùng, đổi đóng gói thành thùng và nhập đúng số chai/thùng trên nhãn.</Caption> : null}
        </ProductFormCard>
        <ProductFormCard title="Giá bán" icon="tag-outline">
          <ProductFormColumns>
            <Field
              label={"Giá bán / " + (form.baseUnit || "cơ sở")}
              accessibilityLabel="Giá bán / đơn vị cơ sở (đồng)"
              required
              value={form.priceBase}
              onChangeText={(value) => field("priceBase", value)}
              keyboardType="numeric"
              placeholder="0"
            />
            <Field
              label={"Giá bán / " + (form.packUnit || "đóng gói")}
              accessibilityLabel="Giá bán / đơn vị đóng gói (đồng)"
              required={!(form.baseUnit.trim()===form.packUnit.trim() && decimalInput(form.packFactor)===1)}
              value={form.pricePack}
              onChangeText={(value) => field("pricePack", value)}
              keyboardType="numeric"
              placeholder={form.baseUnit.trim()===form.packUnit.trim() && decimalInput(form.packFactor)===1?"Dùng giá cơ sở":"0"}
            />
          </ProductFormColumns>
          <ProductFormColumns>
            <Field
              label={"Giá sỉ / " + (form.baseUnit || "cơ sở")}
              value={extra.wholesaleBase}
              onChangeText={(wholesaleBase) =>
                setExtra({ ...extra, wholesaleBase })
              }
              keyboardType="numeric"
              placeholder="Dùng giá lẻ"
            />
            <Field
              label={"Giá sỉ / " + (form.packUnit || "đóng gói")}
              value={extra.wholesalePack}
              onChangeText={(wholesalePack) =>
                setExtra({ ...extra, wholesalePack })
              }
              keyboardType="numeric"
              placeholder="Dùng giá lẻ"
            />
          </ProductFormColumns>
          <Caption>
            Đơn vị giá: đồng (VNĐ). Để trống giá sỉ để dùng giá lẻ; nhập 0 nghĩa
            là miễn phí.
          </Caption>
        </ProductFormCard>
        <ProductFormCard title="Kho hàng" icon="warehouse">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chọn kho làm việc"
            onPress={() => router.push("/warehouse-picker")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              minHeight: 48,
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <AppText style={{ flex: 1, fontSize: 14 }}>
              {warehouse?.name || "Chọn kho làm việc"}
            </AppText>
            <Icon name="chevron-right" color={theme.colors.muted} size={20} />
          </Pressable>
          <ProductFormColumns>
            <Field
              label={"Giá vốn / " + (form.baseUnit || "cơ sở")}
              accessibilityLabel="Giá vốn / đơn vị cơ sở (đồng)"
              required
              value={form.costBase}
              onChangeText={(value) => field("costBase", value)}
              keyboardType="numeric"
              placeholder="0"
            />
            <Field
              label="Tồn tối thiểu"
              accessibilityLabel="Mức tồn tối thiểu (đơn vị cơ sở)"
              value={form.minStock}
              onChangeText={(value) => field("minStock", value)}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          </ProductFormColumns>
          <Toggle
            label="Theo dõi số lô và hạn sử dụng"
            value={form.trackLots}
            onChange={(value) => field("trackLots", value)}
            disabled={Boolean(id)}
          />
        </ProductFormCard>
        {can("loyalty.manage") ? (
          <ProductFormCard
            title="Tích điểm khách hàng"
            icon="star-circle-outline"
          >
            <Field
              label="Số chấm (%)"
              accessibilityLabel="Số chấm tích điểm (%)"
              value={form.loyaltyRate}
              onChangeText={(value) => field("loyaltyRate", value)}
              keyboardType="decimal-pad"
            />
            <Caption>0,1 là 0,1% · 0,5 là 0,5% · 0 để không tích điểm.</Caption>
          </ProductFormCard>
        ) : null}
        <ProductFormCard
          title="Thuộc tính sản phẩm"
          icon="package-variant-closed"
        >
          <ProductFormColumns>
            <Field
              label="Khối lượng (g)"
              value={extra.weightGrams}
              keyboardType="decimal-pad"
              onChangeText={(weightGrams) =>
                setExtra({ ...extra, weightGrams })
              }
            />
            <Field
              label="Kích thước / Quy cách"
              value={extra.dimensions}
              onChangeText={(dimensions) => setExtra({ ...extra, dimensions })}
            />
          </ProductFormColumns>
          <Toggle
            label="Cho phép bán tại quầy"
            value={extra.sellable}
            onChange={(sellable) => setExtra({ ...extra, sellable })}
          />
        </ProductFormCard>
        <ProductFormCard title="Thông tin kỹ thuật" icon="text-box-outline">
          <Field
            label="Thông tin đã kiểm chứng"
            accessibilityLabel="Thông tin kỹ thuật đã kiểm chứng"
            value={form.technicalInfo}
            onChangeText={(value) => field("technicalInfo", value)}
            multiline
            placeholder="Thành phần, hướng dẫn và thông tin của hàng hóa"
          />
        </ProductFormCard>
        <Caption>* Trường bắt buộc</Caption>
      </Page>
    </View>
  );
}
