import { useEffect, useState } from "react";
import { BottomSheet } from "@expo/ui";
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
      packFactor: Number(form.packFactor),
      priceBase: Number(form.priceBase),
      pricePack: Number(form.pricePack),
      costBase: Number(form.costBase),
      minStock: Number(form.minStock || 0),
      details: {
        wholesaleBase:
          extra.wholesaleBase.trim() === ""
            ? null
            : Number(extra.wholesaleBase),
        wholesalePack:
          extra.wholesalePack.trim() === ""
            ? null
            : Number(extra.wholesalePack),
        weightGrams: Number(extra.weightGrams || 0),
        dimensions: extra.dimensions,
        sellable: extra.sellable,
      },
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
              required
              value={form.pricePack}
              onChangeText={(value) => field("pricePack", value)}
              keyboardType="numeric"
              placeholder="0"
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
      <BottomSheet
        isPresented={categoryOpen}
        onDismiss={() => setCategoryOpen(false)}
        containerColor={theme.colors.paper}
        contentPadding={{ left: 16, right: 16, top: 8, bottom: 24 }}
      >
        <View style={{ gap: 12 }}>
          <AppText
            accessibilityRole="header"
            style={{ fontSize: 18, fontWeight: "600" }}
          >
            Nhóm hàng
          </AppText>
          <ChoiceList
            label="Chọn nhóm hàng hóa"
            value={form.category}
            onChange={(value) => {
              field("category", value);
              setCategoryOpen(false);
            }}
            options={["Phân bón", "Thuốc BVTV", "Hạt giống", "Vật tư"].map(
              (value) => ({ value, title: value }),
            )}
          />
          <Button
            title="Đóng chọn nhóm"
            secondary
            onPress={() => setCategoryOpen(false)}
          />
        </View>
      </BottomSheet>
    </View>
  );
}
