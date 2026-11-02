import { useEffect, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SvgXml } from "react-native-svg";
import {
  Button,
  Caption,
  Denied,
  Field,
  Label,
  Notice,
  Panel,
  QueryState,
  Row,
  Select,
  Toggle,
} from "@/components/ui";
import { useApi } from "@/lib/api";
import { can } from "@/lib/session";
import { Product } from "@/types";
import { barcodeSvg, labelSizes, printLabels } from "@/lib/barcode-labels";
import { theme } from "@/theme";

export default function BarcodeLabels() {
  const params = useLocalSearchParams<{ id?: string; sku?: string }>();
  const [search, setSearch] = useState(params.sku ?? ""),
    [size, setSize] = useState<keyof typeof labelSizes>("medium"),
    [format, setFormat] = useState<"code128" | "qrcode">("code128"),
    [price, setPrice] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<
    Record<string, { product: Product; quantity: number }>
  >({});
  const query = useApi<Product[]>(
    "/inventory?search=" + encodeURIComponent(search),
    can("inventory.view"),
  );
  const seeded = useRef(false);
  useEffect(() => {
    const p = query.data?.find((p) => p.id === params.id);
    if (p && !seeded.current) {
      seeded.current = true;
      setSelected((s) => ({ ...s, [p.id]: { product: p, quantity: 1 } }));
    }
  }, [query.data, params.id]);
  if (!can("inventory.view")) return <Denied />;
  const items = Object.values(selected),
    count = items.reduce((sum, r) => sum + r.quantity, 0);
  let preview = "",
    previewError = "";
  try {
    if (items[0])
      preview = barcodeSvg(items[0].product, format, labelSizes[size].width);
  } catch (e) {
    previewError = e instanceof Error ? e.message : "Không tạo được mã.";
  }
  return (
    <FlatList
      data={query.data ?? []}
      keyExtractor={(r) => r.id}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.colors.canvas }}
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        maxWidth: 720,
        width: "100%",
        alignSelf: "center",
        paddingBottom: 40,
      }}
      ListHeaderComponent={
        <View style={{ gap: 14 }}>
          <Label big>In tem mã vạch</Label>
          <Caption>
            Chọn hàng và số tem. Tệp PDF khổ A4, dùng chia sẻ hoặc trình in của
            điện thoại.
          </Caption>
          <Select
            label="Khổ tem"
            value={size}
            onChange={(v) => setSize(v as keyof typeof labelSizes)}
            options={Object.entries(labelSizes).map(([value, r]) => ({
              value,
              label: r.name,
            }))}
          />
          <Select
            label="Loại mã"
            value={format}
            onChange={(v) => setFormat(v as "code128" | "qrcode")}
            options={[
              { value: "code128", label: "Mã vạch Code 128" },
              { value: "qrcode", label: "Mã QR" },
            ]}
          />
          <Toggle
            label="Hiện giá bán theo đơn vị đóng gói"
            value={price}
            onChange={setPrice}
          />
          <Caption>
            {items.length} mặt hàng · {count}/200 tem
          </Caption>
          <Notice error>{error || previewError}</Notice>
          {preview ? (
            <Panel>
              <Label>Xem trước mã đầu tiên</Label>
              <Caption>{items[0].product.name}</Caption>
              <SvgXml xml={preview} width="100%" height={100} />
              <Caption>
                {items[0].product.barcode || items[0].product.sku}
              </Caption>
            </Panel>
          ) : null}
          {items.map(({ product, quantity }) => (
            <Panel key={product.id}>
              <Caption>
                {product.sku} · {product.name}
              </Caption>
              <View style={{ gap: 8 }}>
                <View>
                  <Field
                    label={"Số tem " + product.sku}
                    keyboardType="numeric"
                    value={String(quantity)}
                    onChangeText={(v) =>
                      setSelected((s) => ({
                        ...s,
                        [product.id]: { product, quantity: Number(v) },
                      }))
                    }
                  />
                </View>
                <Button
                  secondary
                  title="Bỏ"
                  onPress={() =>
                    setSelected((s) => {
                      const next = { ...s };
                      delete next[product.id];
                      return next;
                    })
                  }
                />
              </View>
            </Panel>
          ))}
          <Button
            title="Tạo PDF / In tem"
            pending={busy}
            disabled={
              !count ||
              count > 200 ||
              items.some(
                (r) =>
                  !Number.isInteger(r.quantity) ||
                  r.quantity < 1 ||
                  r.quantity > 100,
              ) ||
              Boolean(previewError)
            }
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                await printLabels(items, size, format, price);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Không tạo được tem.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
          <Field
            label="Tìm sản phẩm để thêm tem"
            value={search}
            onChangeText={setSearch}
            placeholder="Tên, SKU hoặc barcode"
          />
          <QueryState query={query}>{null}</QueryState>
        </View>
      }
      renderItem={({ item }) => (
        <Panel>
          <Toggle
            label={item.sku + " · " + item.name}
            value={Boolean(selected[item.id])}
            onChange={(on) =>
              setSelected((s) => {
                const next = { ...s };
                if (on) next[item.id] = { product: item, quantity: 1 };
                else delete next[item.id];
                return next;
              })
            }
          />
        </Panel>
      )}
    />
  );
}
