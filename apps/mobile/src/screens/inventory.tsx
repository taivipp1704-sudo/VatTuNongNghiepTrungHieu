import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ProductCard, ProductCover } from "@/components/product-card";
import {
  Badge,
  Button,
  Caption,
  Denied,
  Empty,
  Field,
  Label,
  Notice,
  Page,
  Panel,
  QueryState,
  Row,
  Section,
  Select,
  confirmAction,
} from "@/components/ui";
import { useApi, useCommand } from "@/lib/api";
import { can, useSession } from "@/lib/session";
import { day, daysUntil, fold, money, number } from "@/lib/format";
import { useScan } from "@/lib/scanner";
import { Bootstrap, DataRow, LoyaltySettings, Product } from "@/types";
import { theme } from "@/theme";
import { AppText } from "@/components/text";
import {
  ChipTabs,
  Icon,
  IconButton,
  ProductPicture,
} from "@/components/pos-ui";
import { parseRate, rateLabel, productPoints } from "@/lib/loyalty";
import { ProductLoyalty } from "@/components/product-loyalty";

export default function Inventory() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState(params.filter || "all");
  const [bulk, setBulk] = useState(false);
  const [layout, setLayout] = useState<"tiles" | "list">("tiles");
  const { width, fontScale } = useWindowDimensions();
  const tiles = layout === "tiles" && !bulk && fontScale <= 1.3;
  const tileWidth = (Math.min(width, 720) - 44) / 2;
  const [selected, setSelected] = useState<string[]>([]);
  const [rate, setRate] = useState("");
  const [notice, setNotice] = useState("");
  const query = useApi<Product[]>("/inventory", can("inventory.view"));
  const rules = useApi<LoyaltySettings>("/loyalty/settings");
  const command = useCommand();
  const scan = useScan();
  const offline = useSession((state) => state.offline);
  useEffect(() => {
    if (scan.target === "inventory" && scan.code) {
      setSearch(scan.code);
      scan.clear();
    }
  }, [scan.code, scan.target]);
  if (!can("inventory.view")) return <Denied />;
  const rows = (query.data || [])
    .filter((p) =>
      fold(p.name + " " + p.sku + " " + p.barcode).includes(fold(search)),
    )
    .filter((p) => category === "all" || p.category === category)
    .filter(
      (p) =>
        filter === "all" ||
        (filter === "low" && p.available < p.min_stock) ||
        (filter === "soon" &&
          p.lots.some(
            (l) =>
              daysUntil(l.expiresOn) >= 0 &&
              daysUntil(l.expiresOn) <= 90 &&
              l.quantity > 0,
          )) ||
        (filter === "expired" &&
          p.lots.some((l) => daysUntil(l.expiresOn) < 0 && l.quantity > 0)),
    );
  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id)
        ? ids.filter((x) => x !== id)
        : ids.length < 100
          ? [...ids, id]
          : ids,
    );
  const apply = async () => {
    const parsed = parseRate(rate);
    if (parsed === undefined || !selected.length) {
      command.setError(
        "Chọn hàng và nhập tỷ lệ 0–100%, tối đa 4 số thập phân.",
      );
      return;
    }
    if (
      !(await confirmAction(
        "Sửa số chấm hàng loạt",
        selected.length +
          " mặt hàng sẽ đổi sang " +
          rateLabel(parsed) +
          ". Đơn cũ giữ quy tắc đã bán.",
      ))
    )
      return;
    const result = await command.run<DataRow>(
      "/products/loyalty/bulk",
      { ids: selected, rate: parsed },
      "PATCH",
    );
    if (result) {
      setNotice("Đã cập nhật " + result.updated + " mặt hàng.");
      setSelected([]);
      setBulk(false);
    }
  };
  return (
    <FlatList
      key={tiles ? "tiles" : "list"}
      numColumns={tiles ? 2 : 1}
      columnWrapperStyle={
        tiles ? { gap: 12, alignItems: "stretch" } : undefined
      }
      style={{ backgroundColor: theme.colors.canvas }}
      contentContainerStyle={{
        padding: 16,
        gap: 14,
        paddingBottom: 40,
        maxWidth: 720,
        width: "100%",
        alignSelf: "center",
      }}
      data={query.data ? rows : []}
      keyExtractor={(p) => p.id}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 14, paddingBottom: 4 }}>
          <View
            style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}
          >
            <View style={{ flex: 1 }}>
              <Field
                label="Tìm tên hàng, SKU hoặc mã vạch"
                value={search}
                onChangeText={setSearch}
                placeholder="Tên hàng hoặc mã SKU"
              />
            </View>
            <IconButton
              name="barcode-scan"
              label="Quét mã hàng hóa"
              onPress={() =>
                router.push({
                  pathname: "/scan",
                  params: { target: "inventory" },
                })
              }
            />
          </View>
          <ChipTabs
            value={category}
            onChange={setCategory}
            items={[
              {
                value: "all",
                label: "Tất cả (" + (query.data?.length || 0) + ")",
              },
              ...["Phân bón", "Thuốc BVTV", "Hạt giống", "Vật tư"].map((v) => ({
                value: v,
                label: v,
              })),
            ]}
          />
          <View
            style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}
          >
            <View style={{ flex: 1 }}>
              <Select
                label="Lọc tồn kho"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "Tất cả trạng thái" },
                  { value: "low", label: "Tồn thấp" },
                  { value: "soon", label: "Lô cận hạn" },
                  { value: "expired", label: "Lô hết hạn" },
                ]}
              />
            </View>
            <IconButton
              name="view-grid-outline"
              label="Hiển thị thẻ ảnh"
              selected={tiles}
              disabled={bulk || fontScale > 1.3}
              onPress={() => setLayout("tiles")}
            />
            <IconButton
              name="format-list-bulleted"
              label="Hiển thị danh sách"
              selected={!tiles}
              onPress={() => setLayout("list")}
            />
          </View>
          {can("loyalty.manage") || can("products.manage") ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              {can("products.manage") ? (
                <View style={{ flex: 1 }}>
                  <Button
                    title="Thêm hàng"
                    onPress={() => router.push("/product-form")}
                  />
                </View>
              ) : null}
              {can("loyalty.manage") ? (
                <View style={{ flex: 1 }}>
                  <Button
                    title={bulk ? "Đóng sửa điểm" : "Sửa số chấm"}
                    secondary
                    onPress={() => {
                      setBulk(!bulk);
                      setSelected([]);
                    }}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
          {bulk ? (
            <Panel>
              <Button
                title="Chọn kết quả đang lọc (tối đa 100)"
                secondary
                onPress={() => setSelected(rows.slice(0, 100).map((p) => p.id))}
              />
              <Caption>Đã chọn {selected.length} mặt hàng</Caption>
              <Field
                label="Tỷ lệ mới cho các hàng đã chọn (%)"
                value={rate}
                onChangeText={setRate}
                keyboardType="decimal-pad"
              />
              <Notice error>{command.error}</Notice>
              <Button
                title="Áp dụng số chấm"
                onPress={apply}
                pending={command.pending}
                disabled={offline || !selected.length}
              />
            </Panel>
          ) : null}
          <Notice>{notice}</Notice>
          <QueryState query={query}>{null}</QueryState>
        </View>
      }
      ListEmptyComponent={
        query.data ? (
          <Empty message="Không có hàng hóa phù hợp với bộ lọc." />
        ) : undefined
      }
      renderItem={({ item }) =>
        tiles ? (
          <View style={{ width: tileWidth }}>
            <ProductCard
              product={item}
              onPress={() =>
                router.push({ pathname: "/product", params: { id: item.id } })
              }
              onEditRate={
                can("loyalty.manage")
                  ? () =>
                      router.push({
                        pathname: "/product",
                        params: { id: item.id },
                      })
                  : undefined
              }
            />
          </View>
        ) : (
          <View>
            <Panel>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  bulk ? "Chọn " + item.name : "Xem " + item.name
                }
                onPress={() =>
                  bulk
                    ? toggle(item.id)
                    : router.push({
                        pathname: "/product",
                        params: { id: item.id },
                      })
                }
              >
                <View style={{ flexDirection: "row", gap: 12 }}>
                  {bulk ? (
                    <View style={{ justifyContent: "center" }}>
                      <Icon
                        name={
                          selected.includes(item.id)
                            ? "checkbox-marked"
                            : "checkbox-blank-outline"
                        }
                      />
                    </View>
                  ) : null}
                  <ProductPicture product={item} size={70} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Row>
                      <Caption>{item.sku}</Caption>
                      <Badge
                        label={
                          "Tồn: " +
                          number(item.available / item.pack_factor) +
                          " " +
                          item.pack_unit
                        }
                        tone={
                          item.available < item.min_stock
                            ? "warning"
                            : "positive"
                        }
                      />
                    </Row>
                    <AppText
                      numberOfLines={2}
                      style={{ fontWeight: "600", fontSize: 16 }}
                    >
                      {item.name}
                    </AppText>
                    <AppText
                      variant="amount"
                      style={{
                        fontSize: 22,
                        lineHeight: 31,
                        fontWeight: "700",
                        color: theme.colors.info,
                      }}
                    >
                      {money(item.price_pack)}
                    </AppText>
                    <Caption>
                      / {item.pack_unit} · {number(item.actual)}{" "}
                      {item.base_unit} thực tế
                    </Caption>
                  </View>
                </View>
              </Pressable>
              <View
                style={{
                  backgroundColor: theme.colors.soft,
                  padding: 12,
                  borderRadius: 12,
                  gap: 6,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <Icon
                    name={
                      item.loyalty_rate
                        ? "star-circle-outline"
                        : "minus-circle-outline"
                    }
                    color={
                      item.loyalty_rate
                        ? theme.colors.success
                        : theme.colors.muted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <AppText
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: item.loyalty_rate
                          ? theme.colors.success
                          : theme.colors.muted,
                      }}
                    >
                      Tích điểm: {rateLabel(item.loyalty_rate)}
                    </AppText>
                    <Caption>
                      {rules.data?.enabled
                        ? "Mua 1 " +
                          item.pack_unit +
                          " dự kiến " +
                          number(
                            productPoints(
                              item.price_pack,
                              item.loyalty_rate,
                              rules.data,
                            ),
                          ) +
                          " điểm"
                        : "Chương trình tích điểm đang tắt"}
                    </Caption>
                  </View>
                  {can("loyalty.manage") && !bulk ? (
                    <IconButton
                      name="pencil-outline"
                      label={"Sửa số chấm " + item.sku}
                      onPress={() =>
                        router.push({
                          pathname: "/product",
                          params: { id: item.id },
                        })
                      }
                    />
                  ) : null}
                </View>
              </View>
            </Panel>
          </View>
        )
      }
    />
  );
}

export function ProductDetail() {
  const command = useCommand();
  const offline = useSession((state) => state.offline);
  const [releaseReason, setReleaseReason] = useState("");
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApi<Product[]>("/inventory", can("inventory.view"));
  const [lotId, setLotId] = useState("");
  const ledger = useApi<DataRow[]>(
    "/ledger/" + lotId,
    Boolean(lotId) && can("inventory.view"),
  );
  const product = query.data?.find((item) => item.id === id);
  if (!can("inventory.view")) return <Denied />;
  return (
    <Page>
      <Notice error>{command.error}</Notice>
      <QueryState query={query}>
        {product ? (
          <>
            <Panel>
              <ProductCover product={product} height={210} />
              <Badge label={product.category} />
              <Label big>{product.name}</Label>
              <Caption>
                {product.sku} · {product.barcode}
              </Caption>
              <Label>
                Khả dụng: {number(product.available)} {product.base_unit}
              </Label>
              <Caption>
                1 {product.pack_unit} = {number(product.pack_factor)}{" "}
                {product.base_unit}
              </Caption>
              <Row>
                <Label>
                  {money(product.price_pack)} / {product.pack_unit}
                </Label>
                <Caption>
                  {money(product.price_base)} / {product.base_unit}
                </Caption>
              </Row>
              {can("inventory.cost.view") && product.cost_base !== undefined ? (
                <Caption>
                  Giá vốn: {money(product.cost_base)} / {product.base_unit}
                </Caption>
              ) : null}
              {product.technical_info ? (
                <Caption>{product.technical_info}</Caption>
              ) : null}
            </Panel>
            <Row>
              {can("inventory.receipt.create") ? (
                <Button
                  title="Nhập hàng"
                  secondary
                  onPress={() => router.push("/stock-form?kind=RECEIPT")}
                />
              ) : null}
              {can("sales.create") ? (
                <Button
                  title="Bán sản phẩm này"
                  onPress={() =>
                    router.push({
                      pathname: "/pos",
                      params: { search: product.sku },
                    })
                  }
                />
              ) : null}
              {can("sales.return") ? (
                <Button
                  title="Mở đơn để trả hàng"
                  secondary
                  onPress={() => router.push("/orders")}
                />
              ) : null}
            </Row>
            {can("products.manage") ? (
              <Button
                title="Chỉnh sửa hàng hóa"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/product-form",
                    params: { id: product.id },
                  })
                }
              />
            ) : null}
            <ProductLoyalty key={product.id} product={product} />
            <Section title="Lô & hạn sử dụng">
              {product.lots.map((lot) => (
                <Panel key={lot.id}>
                  <Row>
                    <Label>{lot.code}</Label>
                    <Badge
                      label={
                        lot.state === "QUARANTINE"
                          ? "Cách ly"
                          : daysUntil(lot.expiresOn) < 0
                            ? "Hết hạn"
                            : daysUntil(lot.expiresOn) <= 90
                              ? "Cận hạn"
                              : "Còn hàng"
                      }
                      tone={
                        lot.state === "QUARANTINE" ||
                        daysUntil(lot.expiresOn) < 0
                          ? "danger"
                          : daysUntil(lot.expiresOn) <= 90
                            ? "warning"
                            : "neutral"
                      }
                    />
                  </Row>
                  <Caption>
                    {lot.warehouseName} · {lot.location || "Chưa đặt vị trí"}
                  </Caption>
                  <Label>
                    Thực tế {number(lot.quantity)} · Khả dụng{" "}
                    {number(lot.available)} {product.base_unit}
                  </Label>
                  <Caption>Hạn sử dụng: {day(lot.expiresOn)}</Caption>
                  {lot.state === "QUARANTINE" &&
                  daysUntil(lot.expiresOn) >= 0 &&
                  can("inventory.approve") ? (
                    <>
                      <Field
                        label="Kết quả kiểm tra lô cách ly"
                        value={releaseReason}
                        onChangeText={setReleaseReason}
                      />
                      <Button
                        title="Cho phép bán lại lô"
                        secondary
                        pending={command.pending}
                        disabled={offline || releaseReason.trim().length < 3}
                        onPress={async () => {
                          if (
                            await confirmAction(
                              "Mở bán lại lô " + lot.code,
                              "Xác nhận đã kiểm tra chất lượng thực tế và lô đủ điều kiện bán lại.",
                            )
                          ) {
                            const result = await command.run(
                              "/lots/" + lot.id + "/release",
                              { reason: releaseReason },
                            );
                            if (result) setReleaseReason("");
                          }
                        }}
                      />
                    </>
                  ) : null}
                  <Button
                    title={lotId === lot.id ? "Ẩn thẻ kho" : "Xem thẻ kho"}
                    secondary
                    onPress={() => setLotId(lotId === lot.id ? "" : lot.id)}
                  />
                  {lotId === lot.id ? (
                    <QueryState query={ledger}>
                      {ledger.data?.length ? (
                        ledger.data.map((entry) => (
                          <View
                            key={entry.id}
                            style={{
                              gap: theme.space.xs,
                              paddingVertical: theme.space.sm,
                            }}
                          >
                            <Caption>
                              {day(entry.created_at)} · {entry.actor}
                            </Caption>
                            <Label>
                              {entry.delta > 0 ? "+" : ""}
                              {number(entry.delta)} → Tồn{" "}
                              {number(entry.balance)}
                            </Label>
                            <Caption>{entry.reason}</Caption>
                          </View>
                        ))
                      ) : (
                        <Caption>Chưa có giao dịch.</Caption>
                      )}
                    </QueryState>
                  ) : null}
                </Panel>
              ))}
            </Section>
          </>
        ) : query.data ? (
          <Empty message="Sản phẩm không còn trong phạm vi tài khoản." />
        ) : null}
      </QueryState>
    </Page>
  );
}
