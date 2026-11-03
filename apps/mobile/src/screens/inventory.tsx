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
import { ListPager } from "@/components/list-pager";
import { SearchBar, FloatingAdd } from "@/components/store-ui";
import { ProductStock } from "@/components/product-stock";
import { ProductLoyalty } from "@/components/product-loyalty";

export default function Inventory() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState(params.filter || "all");
  const [bulk, setBulk] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layout, setLayout] = useState<"tiles" | "list">("list");
  const { width, fontScale } = useWindowDimensions();
  const tiles = layout === "tiles" && !bulk && fontScale <= 1.3;
  const tileWidth = (Math.min(width, 720) - 44) / 2;
  const [selected, setSelected] = useState<string[]>([]);
  const [rate, setRate] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [search, category, filter]);
  const query = useApi<Product[]>(
    "/inventory?limit=50&page=" +
      page +
      "&search=" +
      encodeURIComponent(search) +
      "&category=" +
      encodeURIComponent(category) +
      "&filter=" +
      filter,
    can("inventory.view"),
  );
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
    <View style={{ flex: 1, backgroundColor: theme.colors.paper }}>
      <FlatList
        key={tiles ? "tiles" : "list"}
        numColumns={tiles ? 2 : 1}
        columnWrapperStyle={
          tiles ? { gap: 12, paddingHorizontal: 12 } : undefined
        }
        contentContainerStyle={{
          paddingBottom: 96,
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
          <View style={{ backgroundColor: theme.colors.paper }}>
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 8,
              }}
            >
              <SearchBar
                label="Tìm tên hàng, SKU hoặc mã vạch"
                value={search}
                onChange={setSearch}
                placeholder="Tìm tên, SKU hoặc mã vạch"
                onScan={() =>
                  router.push({
                    pathname: "/scan",
                    params: { target: "inventory" },
                  })
                }
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <AppText
                style={{
                  flex: 1,
                  color: theme.colors.primary,
                  fontSize: 16,
                  fontWeight: "500",
                }}
              >
                {category === "all" ? "Tất cả sản phẩm" : category}
              </AppText>
              <IconButton
                name={filtersOpen ? "close" : "filter-variant"}
                label={filtersOpen ? "Đóng bộ lọc" : "Lọc và công cụ sản phẩm"}
                onPress={() => setFiltersOpen(!filtersOpen)}
              />
            </View>
            {filtersOpen ? (
              <View
                style={{
                  padding: 16,
                  gap: 12,
                  backgroundColor: theme.colors.canvas,
                }}
              >
                <Select
                  label="Nhóm hàng"
                  value={category}
                  onChange={setCategory}
                  options={[
                    { value: "all", label: "Tất cả" },
                    ...["Phân bón", "Thuốc BVTV", "Hạt giống", "Vật tư"].map(
                      (value) => ({ value, label: value }),
                    ),
                  ]}
                />
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
                <Row>
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
                  {can("loyalty.manage") ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Sửa số chấm hàng loạt"
                      onPress={() => {
                        setBulk(!bulk);
                        setSelected([]);
                      }}
                      style={{ minHeight: 44, justifyContent: "center" }}
                    >
                      <AppText style={{ color: theme.colors.primary }}>
                        {bulk ? "Đóng sửa điểm" : "Sửa số chấm"}
                      </AppText>
                    </Pressable>
                  ) : null}
                </Row>
              </View>
            ) : null}
            {bulk ? (
              <Panel>
                <Button
                  secondary
                  title="Chọn kết quả đang lọc (tối đa 100)"
                  onPress={() =>
                    setSelected(rows.slice(0, 100).map((p) => p.id))
                  }
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
            {query.data ? (
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: theme.colors.canvas,
                }}
              >
                <Caption>
                  {number(query.data[0]?.list_total ?? 0)} sản phẩm · Giá theo
                  đơn vị đóng gói
                </Caption>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.data ? (
            <Empty message={search.trim() || category !== "all" || filter !== "all" ? "Không có hàng hóa phù hợp với bộ lọc." : can("products.manage") && can("inventory.cost.view") ? "Chưa có hàng hóa. Bấm dấu + để thêm sản phẩm đầu tiên." : "Chưa có hàng hóa trong kho được cấp quyền."} />
          ) : undefined
        }
        ListFooterComponent={
          (query.data?.[0]?.list_total ?? 0) > 50 ? (
            <View style={{ paddingHorizontal: 16 }}>
              <ListPager
                page={page}
                total={query.data?.[0]?.list_total ?? 0}
                onChange={setPage}
              />
            </View>
          ) : undefined
        }
        renderItem={({ item }) =>
          tiles ? (
            <View style={{ width: tileWidth, paddingVertical: 8 }}>
              <ProductCard
                product={item}
                onPress={() =>
                  router.push({ pathname: "/product", params: { id: item.id } })
                }
              />
            </View>
          ) : (
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
              style={({ pressed }) => ({
                minHeight: 100,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
                backgroundColor: pressed
                  ? theme.colors.soft
                  : theme.colors.paper,
                flexDirection: "row",
                gap: 12,
                alignItems: "flex-start",
              })}
            >
              {bulk ? (
                <Icon
                  name={
                    selected.includes(item.id)
                      ? "checkbox-marked"
                      : "checkbox-blank-outline"
                  }
                />
              ) : null}
              <ProductPicture product={item} size={58} />
              <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                <AppText
                  numberOfLines={2}
                  style={{ fontSize: 15, fontWeight: "600", lineHeight: 22 }}
                >
                  {item.name}
                </AppText>
                <AppText
                  style={{
                    fontSize: 12,
                    color: theme.colors.muted,
                    lineHeight: 18,
                  }}
                >
                  SKU: {item.sku}
                  {rules.data?.enabled
                    ? " · " + rateLabel(item.loyalty_rate)
                    : ""}
                </AppText>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6, maxWidth: 104 }}>
                <AppText
                  variant="amount"
                  style={{ fontSize: 15, lineHeight: 22 }}
                >
                  {money(item.price_pack)}
                </AppText>
                <AppText
                  style={{
                    fontSize: 12,
                    lineHeight: 18,
                    color:
                      item.available < item.min_stock
                        ? theme.colors.warning
                        : theme.colors.muted,
                  }}
                >
                  {number(item.available / item.pack_factor)} {item.pack_unit}
                </AppText>
              </View>
            </Pressable>
          )
        }
      />
      {can("products.manage") && can("inventory.cost.view") ? (
        <FloatingAdd
          label="Thêm hàng"
          onPress={() => router.push("/product-form")}
        />
      ) : null}
    </View>
  );
}

export function ProductDetail() {
  const command = useCommand();
  const offline = useSession((state) => state.offline);
  const [releaseReason, setReleaseReason] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApi<Product[]>(
    "/inventory?search=" + encodeURIComponent(id ?? ""),
    can("inventory.view"),
  );
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
            <ProductCover product={product} height={210} />
            <Panel>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <AppText
                  style={{
                    flex: 1,
                    fontSize: 18,
                    lineHeight: 26,
                    fontWeight: "500",
                  }}
                >
                  {product.name}
                </AppText>
                {can("products.manage") ? (
                  <IconButton
                    name="pencil-outline"
                    label="Chỉnh sửa hàng hóa"
                    onPress={() =>
                      router.push({
                        pathname: "/product-form",
                        params: { id: product.id },
                      })
                    }
                  />
                ) : null}
              </View>
              {[
                ["SKU", product.sku],
                ["Barcode", product.barcode || "---"],
                [
                  "Khối lượng",
                  number(product.details?.weightGrams ?? 0) + " g",
                ],
                ["Đơn vị tính", product.base_unit + " / " + product.pack_unit],
                ["Kích thước", product.details?.dimensions || "Mặc định"],
              ].map(([label, value]) => (
                <View key={label} style={{ flexDirection: "row", gap: 12 }}>
                  <AppText
                    style={{
                      width: "35%",
                      color: theme.colors.muted,
                      fontSize: 14,
                      lineHeight: 23,
                    }}
                  >
                    {label}
                  </AppText>
                  <AppText style={{ flex: 1, fontSize: 14, lineHeight: 23 }}>
                    : {value}
                  </AppText>
                </View>
              ))}
            </Panel>
            <Panel>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Icon name="tag" color={theme.colors.muted} />
                <Label>Giá sản phẩm</Label>
              </View>
              <Caption>Chưa áp dụng thuế · Giá theo đơn vị đóng gói</Caption>
              <View style={{ flexDirection: "row", gap: 16 }}>
                <View style={{ flex: 1, gap: 5 }}>
                  <Caption>Giá bán lẻ</Caption>
                  <Label numeric>{money(product.price_pack)}</Label>
                </View>
                {can("sales.wholesale") || can("products.manage") ? (
                  <View style={{ flex: 1, gap: 5 }}>
                    <Caption>Giá bán sỉ</Caption>
                    <Label numeric>
                      {money(
                        product.details?.wholesalePack ?? product.price_pack,
                      )}
                    </Label>
                  </View>
                ) : null}
              </View>
              {can("inventory.cost.view") && product.cost_base !== undefined ? (
                <>
                  <View
                    style={{ height: 1, backgroundColor: theme.colors.border }}
                  />
                  <Caption>
                    Giá vốn / {product.base_unit}: {money(product.cost_base)}
                  </Caption>
                </>
              ) : null}
              <Caption>
                1 {product.pack_unit} = {number(product.pack_factor)}{" "}
                {product.base_unit} · Giá lẻ cơ sở {money(product.price_base)}
              </Caption>
            </Panel>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thao tác sản phẩm"
              onPress={() => setActionsOpen(!actionsOpen)}
              style={{
                minHeight: 48,
                paddingHorizontal: 16,
                backgroundColor: theme.colors.paper,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <AppText style={{ flex: 1, fontSize: 16 }}>
                Thao tác sản phẩm
              </AppText>
              <Icon
                name={actionsOpen ? "chevron-up" : "chevron-down"}
                color={theme.colors.muted}
              />
            </Pressable>
            {actionsOpen ? (
              <>
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
                <Button
                  secondary
                  title="In tem mã vạch"
                  onPress={() =>
                    router.push({
                      pathname: "/barcode-labels",
                      params: { id: product.id, sku: product.sku },
                    })
                  }
                />
              </>
            ) : null}
            <Panel>
              <Row>
                <Icon name="warehouse" color={theme.colors.muted} />
                <Label>Kho hàng</Label>
              </Row>
              <Caption>
                {product.details?.sellable === false
                  ? "Tạm ngừng bán"
                  : "Cho phép bán tại quầy"}
              </Caption>
            </Panel>
            <ProductStock product={product} />
            <ProductLoyalty key={product.id} product={product} />
            {product.technical_info ? (
              <Panel>
                <Label>Thông tin kỹ thuật</Label>
                <Caption>{product.technical_info}</Caption>
              </Panel>
            ) : null}
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
