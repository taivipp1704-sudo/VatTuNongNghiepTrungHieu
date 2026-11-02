import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Caption,
  Denied,
  Field,
  Label,
  Notice,
  Page,
  Panel,
  QueryState,
  Row,
  Section,
  Select,
  Toggle,
  confirmAction,
} from "@/components/ui";
import { api, useApi, useCommand } from "@/lib/api";
import { can, useSession, userKey } from "@/lib/session";
import { newKey, useDraft } from "@/lib/drafts";
import { fold, money, number } from "@/lib/format";
import { useScan } from "@/lib/scanner";
import {
  Bootstrap,
  CartLine,
  DataRow,
  LoyaltyQuote,
  LoyaltySettings,
  Partner,
  Product,
} from "@/types";
import { parseRate, rateLabel, productPoints, memberTier } from "@/lib/loyalty";
import { AppText } from "@/components/text";
import {
  Avatar,
  Icon,
  IconButton,
  ProductPicture,
  RateChip,
  SectionHeading,
} from "@/components/pos-ui";
import { theme } from "@/theme";
import { useWarehouse } from "@/lib/warehouse";
import { shareReceipt } from "@/lib/receipt";

export default function Pos() {
  const params = useLocalSearchParams<{
    customerId?: string;
    delivery?: string;
    search?: string;
  }>();
  const warehouse = useWarehouse((state) => state.warehouseId);
  const appliedContext = useRef("");
  const [showCustomer, setShowCustomer] = useState(false);
  const [editLine, setEditLine] = useState("");
  const [autoPrint, setAutoPrint] = useState(false);
  const [discountMode, setDiscountMode] = useState("AMOUNT"),
    [percent, setPercent] = useState("");
  const [showHeld, setShowHeld] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const rules = useApi<LoyaltySettings>("/loyalty/settings");
  const draft = useDraft("sale", () => ({
    warehouseId: "",
    customerId: "",
    lines: [] as CartLine[],
    priceBook: "RETAIL",
    discount: "",
    redeemPoints: "",
    paid: "",
    method: "CASH",
    note: "",
    deliveryStatus: "DELIVERED",
    requestKey: newKey(),
  }));
  const { value, setValue } = draft;
  const held = useDraft("held-sales", () => ({
    items: [] as { id: string; label: string; cart: typeof value }[],
  }));
  const book = value.priceBook || "RETAIL";
  const priceOf = (product: Product | undefined, unit: string, fallback = 0) =>
    !product
      ? fallback
      : book === "WHOLESALE"
        ? unit === "PACK"
          ? (product.details?.wholesalePack ?? product.price_pack)
          : (product.details?.wholesaleBase ?? product.price_base)
        : unit === "PACK"
          ? product.price_pack
          : product.price_base;
  const changeBook = async (priceBook: string) => {
    if (
      value.lines.length &&
      !(await confirmAction(
        "Đổi bảng giá",
        "Áp dụng lại giá của bảng vừa chọn cho các mặt hàng đang có trong giỏ?",
      ))
    )
      return;
    const missing = value.lines.some(
      (l) => !inventory.data?.some((p) => p.id === l.productId),
    );
    if (missing) {
      command.setError("Tải lại danh sách hàng trước khi đổi bảng giá.");
      return;
    }
    update({
      priceBook,
      lines: value.lines.map((l) => {
        const p = inventory.data!.find((p) => p.id === l.productId)!;
        return {
          ...l,
          unitPrice:
            priceBook === "WHOLESALE"
              ? l.unit === "PACK"
                ? (p.details?.wholesalePack ?? p.price_pack)
                : (p.details?.wholesaleBase ?? p.price_base)
              : l.unit === "PACK"
                ? p.price_pack
                : p.price_base,
        };
      }),
    });
  };
  const bootstrap = useApi<Bootstrap>("/bootstrap");
  const [search, setSearch] = useState(""),
    [customerSearch, setCustomerSearch] = useState("");
  const inventory = useApi<Product[]>(
    "/inventory?search=" +
      encodeURIComponent(search) +
      "&ids=" +
      value.lines.map((l) => l.productId).join(",") +
      (value.warehouseId ? "&warehouseId=" + value.warehouseId : ""),
    can("sales.create"),
  );
  const partners = useApi<Partner[]>(
    "/partners?kind=CUSTOMER&search=" +
      encodeURIComponent(customerSearch) +
      (value.customerId ? "&includeId=" + value.customerId : ""),
    can("partners.view"),
  );

  const [result, setResult] = useState<DataRow | null>(null);
  const command = useCommand();
  const scan = useScan();
  const offline = useSession((state) => state.offline);
  useEffect(() => {
    if (draft.ready && !value.warehouseId && bootstrap.data?.warehouses[0])
      setValue((current) => ({
        ...current,
        warehouseId: warehouse || bootstrap.data!.warehouses[0].id,
      }));
  }, [draft.ready, value.warehouseId, bootstrap.data]);
  useEffect(() => {
    if (params.search) setSearch(params.search);
  }, [params.search]);
  useEffect(() => {
    if (scan.target === "pos" && scan.code) {
      setSearch(scan.code);
      scan.clear();
    }
  }, [scan.code, scan.target]);
  useEffect(() => {
    const key = (params.customerId || "") + ":" + (params.delivery || "");
    if (!draft.ready || key === ":" || appliedContext.current === key) return;
    appliedContext.current = key;
    const apply = async () => {
      if (
        value.lines.length &&
        params.customerId &&
        value.customerId !== params.customerId &&
        !(await confirmAction(
          "Đổi khách cho giỏ nháp",
          "Giữ các mặt hàng và chuyển sang khách vừa chọn?",
        ))
      )
        return;
      setValue((current) => ({
        ...current,
        ...(params.customerId
          ? { customerId: params.customerId, redeemPoints: "" }
          : {}),
        deliveryStatus: "DELIVERED",
      }));
    };
    void apply();
  }, [draft.ready, params.customerId, params.delivery]);
  const update = (patch: Partial<typeof value>) => {
    setValue((current) => ({ ...current, ...patch }));
    setResult(null);
  };
  const subtotal = value.lines.reduce(
    (total, line) => total + Math.round(line.quantity * line.unitPrice),
    0,
  );
  const discount =
    discountMode === "PERCENT"
      ? Math.round((subtotal * (parseRate(percent || "0") ?? NaN)) / 100)
      : Number(value.discount || 0);
  useEffect(() => {
    if (
      discountMode === "PERCENT" &&
      Number.isFinite(discount) &&
      discount >= 0 &&
      discount <= subtotal
    )
      setValue((v) => ({ ...v, discount: String(discount) }));
  }, [discountMode, discount, subtotal]);
  const quoteInput = {
    priceBook: book,
    warehouseId: value.warehouseId,
    ...(value.customerId ? { customerId: value.customerId } : {}),
    lines: value.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unit: line.unit,
      ...(can("sales.price.edit") ? { unitPrice: line.unitPrice } : {}),
    })),
    discount,
    redeemPoints: Number(value.redeemPoints || 0),
  };
  const quoteFingerprint = JSON.stringify(quoteInput);
  const [quoteRequest, setQuoteRequest] = useState<typeof quoteInput | null>(
    null,
  );
  useEffect(() => {
    const timeout = setTimeout(() => setQuoteRequest(quoteInput), 300);
    return () => clearTimeout(timeout);
  }, [quoteFingerprint]);
  const quote = useQuery<LoyaltyQuote>({
    queryKey: [userKey("loyalty-quote"), quoteRequest],
    enabled:
      can("sales.create") &&
      draft.ready &&
      Boolean(quoteRequest?.warehouseId && quoteRequest.lines.length),
    queryFn: ({ signal }) =>
      api<LoyaltyQuote>("/loyalty/quote", { body: quoteRequest, signal }),
    staleTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  const quoteCurrent =
    quote.data &&
    JSON.stringify(quoteRequest) === quoteFingerprint &&
    !quote.isError;
  const total = quoteCurrent ? quote.data!.total : subtotal - discount;
  const paid =
    value.method === "CREDIT"
      ? 0
      : value.paid === ""
        ? total
        : Number(value.paid);
  const debt = total - paid;
  const filtered = (inventory.data || [])
    .filter((item) => item.details?.sellable !== false)
    .filter((item) =>
      fold(item.name + " " + item.sku + " " + item.barcode).includes(
        fold(search),
      ),
    )
    .slice(0, 5);
  const add = (product: Product) => {
    const existing = value.lines.find((line) => line.productId === product.id);
    const quantity = (existing?.quantity || 0) + 1;
    const unit = existing?.unit || "PACK";
    const factor = unit === "PACK" ? product.pack_factor : 1;
    if (quantity * factor > product.available) {
      command.setError("Không đủ tồn khả dụng cho " + product.name);
      return;
    }
    const lines = existing
      ? value.lines.map((line) =>
          line === existing ? { ...line, quantity } : line,
        )
      : [
          ...value.lines,
          {
            productId: product.id,
            name: product.name,
            quantity: 1,
            unit: "PACK" as const,
            unitLabel: product.pack_unit,
            unitPrice: priceOf(product, "PACK"),
          },
        ];
    update({ lines });
    command.setError("");
  };
  const changeLine = (index: number, patch: Partial<CartLine>) =>
    update({
      lines: value.lines.map((line, position) =>
        position === index ? { ...line, ...patch } : line,
      ),
    });
  const checkout = async () => {
    if (
      !Number.isFinite(total) ||
      total < 0 ||
      !Number.isFinite(paid) ||
      paid < 0 ||
      paid > total
    ) {
      command.setError("Kiểm tra tổng tiền và số tiền đã thu.");
      return;
    }
    if (!quoteCurrent || quote.isFetching) {
      command.setError(
        "Chờ máy chủ xác nhận tổng tiền và điểm, hoặc bấm Tính lại điểm và tổng tiền.",
      );
      return;
    }
    if (debt > 0 && !value.customerId) {
      command.setError("Chọn khách hàng có hồ sơ để ghi nhận khoản nợ.");
      return;
    }
    if (
      !(await confirmAction(
        "Ghi nhận đơn bán",
        "Xuất kho theo lô còn hạn. Thu " +
          money(paid) +
          (debt > 0 ? ", ghi nợ " + money(debt) : "") +
          ".",
      ))
    )
      return;
    if (!(await draft.save())) {
      command.setError(
        "Cần lưu được giỏ nháp trước khi gửi để có thể kiểm tra lại kết quả.",
      );
      return;
    }
    const input = {
      priceBook: book,
      warehouseId: value.warehouseId,
      ...(value.customerId ? { customerId: value.customerId } : {}),
      lines: value.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unit: line.unit,
        ...(can("sales.price.edit") ? { unitPrice: line.unitPrice } : {}),
      })),
      discount,
      redeemPoints: Number(value.redeemPoints || 0),
      expectedTotal: total,
      ...(value.note ? { note: value.note } : {}),
      deliveryStatus: "DELIVERED",
      paid,
      method: value.method,
    };
    const response = await command.run<DataRow>(
      "/sales",
      input,
      "POST",
      value.requestKey,
    );
    if (response) {
      setResult(response);
      setDiscountMode("AMOUNT");
      setPercent("");
      setValue({
        priceBook: book,
        warehouseId: value.warehouseId,
        customerId: "",
        lines: [],
        discount: "",
        redeemPoints: "",
        paid: "",
        method: "CASH",
        note: "",
        deliveryStatus: "DELIVERED",
        requestKey: newKey(),
      });
      await draft.save();
      if (autoPrint && can("invoices.view")) void printOrder(response);
    }
  };
  const printOrder = async (order: DataRow) => {
    if (printBusy) return;
    setPrintBusy(true);
    try {
      const invoices = await api<DataRow[]>("/invoices");
      const invoice = invoices.find((item) => item.id === order.invoiceId);
      if (!invoice || !bootstrap.data)
        throw new Error("Không tải được phiếu của đơn vừa ghi nhận.");
      await shareReceipt(
        invoice,
        bootstrap.data.store,
        autoPrint ? "print" : "share",
      );
    } catch (error) {
      command.setError(
        "Đơn đã ghi nhận. " +
          (error instanceof Error
            ? error.message
            : "Chưa mở được phiếu, thử lại tại Đơn hàng."),
      );
    } finally {
      setPrintBusy(false);
    }
  };
  if (!can("sales.create")) return <Denied />;
  const customer = partners.data?.find((item) => item.id === value.customerId);
  const settings = quote.data?.settings || rules.data;
  const wallet = quoteCurrent
    ? quote.data!.availablePoints
    : customer?.loyalty_balance || 0;
  const disabled =
    !draft.ready ||
    !value.lines.length ||
    offline ||
    !value.warehouseId ||
    !quoteCurrent ||
    quote.isFetching ||
    command.pending;
  const footer = (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
        maxWidth: 720,
        width: "100%",
        alignSelf: "center",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lưu giỏ nháp trên thiết bị"
        disabled={!draft.ready}
        onPress={() => void draft.save()}
        style={{
          width: 60,
          minHeight: 62,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.soft,
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
        }}
      >
        <Icon name="content-save-outline" />
        <AppText style={{ fontSize: 10, lineHeight: 16 }}>Lưu tạm</AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        testID="checkout-submit"
        accessibilityLabel="Ghi nhận đơn bán"
        disabled={disabled}
        onPress={() => void checkout()}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 62,
          borderRadius: theme.radius.pill,
          borderWidth: 1,
          borderColor: disabled ? theme.colors.border : theme.colors.control,
          backgroundColor: disabled
            ? theme.colors.neutral
            : pressed
              ? theme.colors.buttonPressed
              : theme.colors.buttonFill,
          paddingHorizontal: 16,
          paddingVertical: 9,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        })}
      >
        <View style={{ flex: 1 }}>
          <AppText
            style={{
              fontSize: 11,
              fontWeight: "600",
              lineHeight: 18,
              color: disabled ? theme.colors.muted : theme.colors.primary,
            }}
          >
            {command.pending
              ? "ĐANG XỬ LÝ…"
              : autoPrint && can("invoices.view")
                ? "THANH TOÁN & IN"
                : "GHI NHẬN ĐƠN BÁN"}
          </AppText>
          <AppText
            variant="amount"
            style={{
              fontSize: 21,
              fontWeight: "700",
              lineHeight: 28,
              color: disabled ? theme.colors.muted : theme.colors.primary,
            }}
          >
            {money(Math.max(total, 0))}
          </AppText>
        </View>
        <Icon
          name={autoPrint ? "printer-outline" : "arrow-right"}
          color={disabled ? theme.colors.muted : theme.colors.primary}
        />
      </Pressable>
    </View>
  );
  const clear = async () => {
    if (
      !(await confirmAction(
        "Làm mới giỏ hàng",
        "Bỏ các dòng đang nhập? Nếu đã gửi đơn mà chưa nhận xác nhận, hãy kiểm tra Đơn hàng trước khi tạo giỏ khác.",
      ))
    )
      return;
    setDiscountMode("AMOUNT");
    setPercent("");
    update({
      lines: [],
      discount: "",
      paid: "",
      redeemPoints: "",
      requestKey: newKey(),
    });
  };
  const toggleRedeem = (on: boolean) => {
    if (!on) {
      update({ redeemPoints: "" });
      return;
    }
    if (!settings) return;
    const maximum = Math.min(
      Math.max(0, wallet),
      Math.floor(
        (Math.max(0, subtotal - discount) * settings.maxRedeemPercent) /
          100 /
          settings.pointValue,
      ),
    );
    if (maximum < settings.minRedeemPoints) {
      command.setError(
        "Chưa đủ điểm hoặc giá trị đơn chưa đạt mức đổi tối thiểu.",
      );
      return;
    }
    update({ redeemPoints: String(maximum) });
  };
  return (
    <Page footer={footer}>
      <Notice error>{draft.storageError}</Notice>
      {result ? (
        <Panel>
          <Badge label="Đã ghi nhận đơn" tone="positive" />
          <Label>
            {result.code} · {money(result.total)}
          </Label>
          <Caption>
            Cộng {number(result.loyalty_earned || 0)} điểm
            {result.loyalty_potential > result.loyalty_earned
              ? " · Còn điểm chờ thu tiền"
              : ""}{" "}
            · Còn nợ {money(result.debt)}
          </Caption>
          {can("invoices.view") ? (
            <Button
              title="In / chia sẻ lại phiếu"
              secondary
              onPress={() => void printOrder(result)}
              pending={printBusy}
            />
          ) : null}
        </Panel>
      ) : null}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Tìm hàng hoặc mã vạch"
            value={search}
            onChangeText={setSearch}
            placeholder="Tên SP, mã SKU hoặc quét mã"
          />
        </View>
        <IconButton
          name="barcode-scan"
          label="Quét mã sản phẩm"
          onPress={() =>
            router.push({ pathname: "/scan", params: { target: "pos" } })
          }
        />
      </View>
      {!value.lines.length || search.trim() ? (
        <Panel>
          <QueryState query={inventory}>
            {filtered.map((product) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={"Thêm " + product.sku}
                key={product.id}
                onPress={() => {
                  add(product);
                  setSearch("");
                }}
                disabled={!draft.ready || product.available <= 0}
                style={{
                  flexDirection: "row",
                  gap: 12,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <ProductPicture product={product} size={48} />
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontSize: 14, fontWeight: "600" }}>
                    {product.name}
                  </AppText>
                  <Caption>
                    {money(product.price_pack)} / {product.pack_unit} · Tồn{" "}
                    {number(product.available / product.pack_factor)}
                  </Caption>
                </View>
                <Icon name="plus-circle-outline" />
              </Pressable>
            ))}
          </QueryState>
          {inventory.data && !filtered.length ? (
            <Caption>Không có mặt hàng phù hợp.</Caption>
          ) : null}
        </Panel>
      ) : null}
      <Panel>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn hoặc đổi khách hàng"
          onPress={() => setShowCustomer(!showCustomer)}
          style={{
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
            minHeight: 48,
          }}
        >
          <Avatar name={customer?.name || "Khách lẻ"} />
          <View style={{ flex: 1 }}>
            <Row>
              <AppText style={{ fontSize: 14, fontWeight: "600" }}>
                {customer?.name || "Khách lẻ"}
              </AppText>
              {customer ? (
                <Badge label={memberTier(customer, settings)} />
              ) : null}
            </Row>
            <Caption>
              {customer?.phone || "Chọn hồ sơ để tích điểm hoặc ghi nợ"}
            </Caption>
          </View>
          <Icon name="swap-horizontal" />
        </Pressable>
        <Panel>
          <Select
            label="Bảng giá bán"
            value={book}
            onChange={(v) => void changeBook(v)}
            options={[
              { value: "RETAIL", label: "Giá bán lẻ" },
              ...(can("sales.wholesale")
                ? [{ value: "WHOLESALE", label: "Giá bán sỉ" }]
                : []),
            ]}
          />
          {customer?.profile?.priceBook === "WHOLESALE" &&
          book !== "WHOLESALE" &&
          can("sales.wholesale") ? (
            <Button
              secondary
              title="Dùng bảng giá sỉ theo hồ sơ khách"
              onPress={() => void changeBook("WHOLESALE")}
            />
          ) : null}
          <Button
            secondary
            title={
              showHeld
                ? "Đóng giỏ tạm giữ"
                : "Giỏ tạm giữ (" +
                  (held.value.items ?? []).filter(
                    (x) => x.cart.warehouseId === value.warehouseId,
                  ).length +
                  ")"
            }
            onPress={() => setShowHeld(!showHeld)}
          />
          {showHeld ? (
            <>
              <Button
                secondary
                title="Tạm giữ giỏ này, tạo giỏ mới"
                disabled={
                  !draft.ready ||
                  !held.ready ||
                  !value.lines.length ||
                  command.pending ||
                  (held.value.items ?? []).length >= 10
                }
                onPress={async () => {
                  const snapshot = { ...value, discount: String(discount) };
                  held.setValue((v) => ({
                    items: [
                      ...v.items,
                      {
                        id: snapshot.requestKey,
                        label:
                          partners.data?.find(
                            (p) => p.id === snapshot.customerId,
                          )?.name || "Khách lẻ",
                        cart: snapshot,
                      },
                    ].filter(
                      (x, i, a) => a.findIndex((y) => y.id === x.id) === i,
                    ),
                  }));
                  if (!(await held.save())) {
                    command.setError("Không lưu được giỏ tạm giữ.");
                    return;
                  }
                  setDiscountMode("AMOUNT");
                  setPercent("");
                  setValue({
                    ...value,
                    lines: [],
                    customerId: "",
                    discount: "",
                    redeemPoints: "",
                    paid: "",
                    note: "",
                    requestKey: newKey(),
                  });
                  await draft.save();
                  setShowHeld(true);
                }}
              />
              <Caption>
                Giữ tối đa 10 giỏ trên thiết bị này. Giỏ tạm chưa trừ kho, chưa
                ghi doanh thu.
              </Caption>
              <Notice error>{held.storageError}</Notice>
              {(held.value.items ?? [])
                .filter((x) => x.cart.warehouseId === value.warehouseId)
                .map((item) => (
                  <Panel key={item.id}>
                    <Label>
                      {item.label} · {item.cart.lines.length} mặt hàng
                    </Label>
                    <Button
                      secondary
                      title="Mở giỏ tạm"
                      disabled={command.pending || !draft.ready}
                      onPress={async () => {
                        if (
                          value.lines.length &&
                          !(await confirmAction(
                            "Mở giỏ tạm",
                            "Thay giỏ đang nhập bằng giỏ đã giữ? Lưu tạm giữ giỏ hiện tại trước nếu cần.",
                          ))
                        )
                          return;
                        setDiscountMode("AMOUNT");
                        setPercent("");
                        setValue(item.cart);
                        if (await draft.save()) {
                          held.setValue((v) => ({
                            items: v.items.filter((x) => x.id !== item.id),
                          }));
                          await held.save();
                          setShowHeld(false);
                        }
                      }}
                    />
                    <Button
                      secondary
                      title="Xóa giỏ tạm"
                      disabled={command.pending}
                      onPress={async () => {
                        if (
                          await confirmAction(
                            "Xóa giỏ tạm",
                            "Chỉ xóa bản nháp trên thiết bị. Nếu đã gửi đơn mà chưa nhận kết quả, kiểm tra Đơn hàng trước.",
                          )
                        ) {
                          held.setValue((v) => ({
                            items: v.items.filter((x) => x.id !== item.id),
                          }));
                          await held.save();
                        }
                      }}
                    />
                  </Panel>
                ))}
            </>
          ) : null}
        </Panel>
        {showCustomer ? (
          <View style={{ gap: 10 }}>
            <Field
              label="Tìm tên, SĐT hoặc mã khách"
              value={customerSearch}
              onChangeText={setCustomerSearch}
            />
            <Select
              label="Khách hàng"
              value={value.customerId}
              onChange={(customerId) => {
                update({ customerId, redeemPoints: "" });
                setShowCustomer(false);
              }}
              options={[
                { value: "", label: "Khách lẻ — thanh toán đủ" },
                ...(partners.data || [])
                  .filter(
                    (item) =>
                      item.kind === "CUSTOMER" &&
                      item.profile?.active !== false,
                  )
                  .map((item) => ({
                    value: item.id,
                    label: item.name + " · " + item.phone,
                  })),
              ]}
            />
          </View>
        ) : null}
        {customer ? (
          <View
            style={{
              backgroundColor: theme.colors.soft,
              padding: 10,
              borderRadius: 10,
            }}
          >
            <Row>
              <View
                style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
              >
                <Icon
                  name="tag-outline"
                  color={theme.colors.success}
                  size={17}
                />
                <AppText style={{ fontSize: 12, color: theme.colors.success }}>
                  Khả dụng: {number(Math.max(wallet, 0))} điểm
                </AppText>
              </View>
              <AppText style={{ fontSize: 11, color: theme.colors.muted }}>
                ≈ {money(Math.max(wallet, 0) * (settings?.pointValue || 0))}
              </AppText>
            </Row>
          </View>
        ) : null}
      </Panel>
      <SectionHeading
        title={"Giỏ hàng · " + value.lines.length + " mặt hàng"}
        action="Làm mới"
        onPress={() => void clear()}
      />
      {!value.lines.length ? (
        <Caption>Chọn hoặc quét hàng hóa để bắt đầu đơn bán.</Caption>
      ) : null}
      {value.lines.map((line, index) => {
        const product = inventory.data?.find(
          (item) => item.id === line.productId,
        );
        const lineTotal = Math.round(line.quantity * line.unitPrice);
        return (
          <Panel key={line.productId}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ProductPicture
                product={product || { name: line.name, category: "Vật tư" }}
                size={56}
              />
              <View style={{ flex: 1 }}>
                <AppText
                  style={{ fontSize: 14, fontWeight: "600", lineHeight: 22 }}
                >
                  {line.name}
                </AppText>
                <Caption>
                  {line.unitLabel} · Tồn {number(product?.available || 0)}{" "}
                  {product?.base_unit}
                </Caption>
              </View>
              <IconButton
                name="close"
                label={"Bỏ " + line.name}
                onPress={() =>
                  update({ lines: value.lines.filter((_, i) => i !== index) })
                }
              />
            </View>
            <Row>
              <RateChip rate={product?.loyalty_rate || 0}>
                {product?.loyalty_rate
                  ? " (+" +
                    money(
                      Math.round((lineTotal * product.loyalty_rate) / 100),
                    ) +
                    ")"
                  : " (không tích điểm)"}
              </RateChip>
              <AppText
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: theme.colors.primary,
                }}
              >
                {money(lineTotal)}
              </AppText>
            </Row>
            <Caption>
              {money(line.unitPrice)} / {line.unitLabel} · Giá trị tích lũy
              trước chiết khấu
            </Caption>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 8,
                backgroundColor: theme.colors.soft,
                borderRadius: 10,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={"Chỉnh dòng " + line.name}
                onPress={() =>
                  setEditLine(editLine === line.productId ? "" : line.productId)
                }
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <AppText style={{ fontSize: 12, color: theme.colors.muted }}>
                  Số lượng / đơn vị <Icon name="pencil-outline" size={13} />
                </AppText>
              </Pressable>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <IconButton
                  name="minus"
                  label={"Giảm " + line.name}
                  onPress={() =>
                    changeLine(index, {
                      quantity: Math.max(1, line.quantity - 1),
                    })
                  }
                />
                <AppText style={{ fontSize: 16, fontWeight: "700" }}>
                  {number(line.quantity)}
                </AppText>
                <IconButton
                  name="plus"
                  label={"Tăng " + line.name}
                  onPress={() =>
                    product
                      ? add(product)
                      : changeLine(index, { quantity: line.quantity + 1 })
                  }
                />
              </View>
            </View>
            {editLine === line.productId ? (
              <>
                <Select
                  label="Đơn vị bán"
                  value={line.unit}
                  onChange={(unit) =>
                    changeLine(index, {
                      unit: unit as CartLine["unit"],
                      unitLabel:
                        unit === "PACK"
                          ? product?.pack_unit
                          : product?.base_unit,
                      unitPrice: priceOf(product, unit, line.unitPrice),
                      quantity: 1,
                    })
                  }
                  options={[
                    { value: "PACK", label: product?.pack_unit || "Đóng gói" },
                    { value: "BASE", label: product?.base_unit || "Cơ sở" },
                  ]}
                />
                <Field
                  label={"Số lượng " + line.name}
                  value={String(line.quantity)}
                  onChangeText={(text) =>
                    changeLine(index, { quantity: Number(text) })
                  }
                  keyboardType="decimal-pad"
                />
                {can("sales.price.edit") ? (
                  <Field
                    label={"Giá bán " + line.name}
                    value={String(line.unitPrice)}
                    onChangeText={(text) =>
                      changeLine(index, { unitPrice: Number(text) })
                    }
                    keyboardType="numeric"
                  />
                ) : null}
              </>
            ) : null}
          </Panel>
        );
      })}
      {customer && settings?.enabled ? (
        <Panel>
          {settings.redeemEnabled && can("loyalty.redeem") ? (
            <>
              <Toggle
                label="Dùng điểm trừ tiền"
                value={Number(value.redeemPoints) > 0}
                onChange={toggleRedeem}
              />
              {Number(value.redeemPoints) > 0 ? (
                <Field
                  label="Số điểm dùng giảm tiền"
                  value={value.redeemPoints || ""}
                  onChangeText={(redeemPoints) => update({ redeemPoints })}
                  keyboardType="numeric"
                />
              ) : null}
              <Caption>
                1 điểm = {money(settings.pointValue)} · Tối đa{" "}
                {rateLabel(settings.maxRedeemPercent)} giá trị đơn
              </Caption>
            </>
          ) : (
            <Caption>
              {settings.redeemEnabled
                ? "Tài khoản chưa được cấp quyền đổi điểm."
                : "Theo dõi tích lũy / hạng VIP, chưa đổi điểm trừ tiền."}
            </Caption>
          )}
          <View
            style={{
              backgroundColor: theme.colors.successBg,
              padding: 10,
              borderRadius: 8,
            }}
          >
            <Row>
              <AppText style={{ fontSize: 12, color: theme.colors.success }}>
                Tích lũy dự kiến cả đơn
              </AppText>
              <AppText
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: theme.colors.success,
                }}
              >
                +{number(quoteCurrent ? quote.data!.potentialPoints : 0)} điểm
              </AppText>
            </Row>
          </View>
        </Panel>
      ) : Number(value.redeemPoints) > 0 ? (
        <Field
          label="Số điểm dùng giảm tiền"
          value={value.redeemPoints}
          onChangeText={(redeemPoints) => update({ redeemPoints })}
          keyboardType="numeric"
        />
      ) : null}
      <Panel>
        <Row>
          <Caption>Tạm tính ({value.lines.length} mã)</Caption>
          <Label numeric>{money(subtotal)}</Label>
        </Row>
        {can("sales.discount") ? (
          <View style={{ gap: 10 }}>
            <Select
              label="Chiết khấu / Ưu đãi"
              value={discountMode}
              onChange={(mode) => {
                setDiscountMode(mode);
                setPercent("");
                update({ discount: "" });
              }}
              options={[
                { value: "AMOUNT", label: "Số tiền (đồng)" },
                { value: "PERCENT", label: "Phần trăm (%)" },
              ]}
            />
            <Field
              label={
                discountMode === "PERCENT"
                  ? "Chiết khấu toàn đơn (%)"
                  : "Chiết khấu toàn đơn (đồng)"
              }
              value={discountMode === "PERCENT" ? percent : value.discount}
              onChangeText={(v) =>
                discountMode === "PERCENT"
                  ? setPercent(v)
                  : update({ discount: v })
              }
              keyboardType="decimal-pad"
              placeholder="0"
            />
            {customer?.profile?.discountPercent &&
            customer.profile.discountPercent > 0 ? (
              <Button
                secondary
                title={
                  "Áp dụng đề xuất khách: " +
                  customer.profile.discountPercent +
                  "%"
                }
                onPress={() => {
                  setDiscountMode("PERCENT");
                  setPercent(String(customer.profile!.discountPercent));
                }}
              />
            ) : null}
          </View>
        ) : (
          <Row>
            <Caption>Chiết khấu hóa đơn</Caption>
            <Label numeric>{money(discount)}</Label>
          </Row>
        )}
        <Row>
          <Caption>Điểm thưởng giảm</Caption>
          <AppText style={{ color: theme.colors.success, fontWeight: "600" }}>
            −{money(quoteCurrent ? quote.data!.loyaltyDiscount : 0)}
          </AppText>
        </Row>
        <View
          style={{
            backgroundColor: theme.colors.soft,
            padding: 12,
            borderRadius: 10,
          }}
        >
          <Row>
            <Label>Khách phải trả</Label>
            <AppText
              variant="amount"
              style={{
                fontSize: 25,
                fontWeight: "700",
                lineHeight: 34,
                color: theme.colors.primary,
              }}
            >
              {money(Math.max(total, 0))}
            </AppText>
          </Row>
        </View>
      </Panel>
      <Panel>
        <SectionHeading title="Phương thức thu tiền & tích điểm" />
        <Select
          label="Thanh toán"
          value={value.method}
          onChange={(method) => update({ method, paid: "" })}
          options={[
            { value: "CASH", label: "Tiền mặt" },
            { value: "TRANSFER", label: "Chuyển khoản" },
            { value: "CREDIT", label: "Ghi nợ toàn bộ" },
          ]}
        />
        {value.method !== "CREDIT" ? (
          <Field
            label="Đã thu (để trống = thu đủ)"
            value={value.paid}
            onChangeText={(paid) => update({ paid })}
            keyboardType="numeric"
            placeholder={String(Math.max(total, 0))}
          />
        ) : null}
        <Row>
          <Caption>Công nợ phát sinh</Caption>
          <Label numeric tone="warning">
            {money(Math.max(debt, 0))}
          </Label>
        </Row>
        <Caption>
          Điểm cộng theo quy tắc admin đã chọn; đơn ghi nợ có thể có điểm đang
          chờ thu tiền.
        </Caption>
        <Field
          label="Ghi chú đơn / mã chứng từ liên kết"
          value={value.note || ""}
          onChangeText={(note) => update({ note })}
          multiline
        />
        {can("invoices.view") ? (
          <Toggle
            label="Mở hộp thoại in sau khi thanh toán"
            value={autoPrint}
            onChange={setAutoPrint}
          />
        ) : null}
        <Caption>
          {draft.saved
            ? "Đã lưu giỏ nháp trên thiết bị"
            : "Giỏ tự lưu theo tài khoản"}{" "}
          · Kho xuất:{" "}
          {bootstrap.data?.warehouses.find(
            (item) => item.id === value.warehouseId,
          )?.name || "Chưa chọn"}
        </Caption>
        <Select
          label="Xuất từ kho"
          value={value.warehouseId}
          onChange={async (warehouseId) => {
            if (
              value.lines.length &&
              !(await confirmAction(
                "Đổi kho",
                "Bỏ các dòng hàng để chọn lại trong kho mới?",
              ))
            )
              return;
            update({ warehouseId, lines: [], requestKey: newKey() });
          }}
          options={(bootstrap.data?.warehouses || []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
      </Panel>
      <Notice error>{quote.error?.message || command.error}</Notice>
      {value.lines.length > 0 && (!quoteCurrent || quote.isError) ? (
        <Button
          title="Tính lại điểm và tổng tiền"
          secondary
          pending={quote.isFetching}
          onPress={() => void quote.refetch()}
        />
      ) : null}
      <Caption>
        Máy chủ xác nhận mới ghi nhận kho, tiền và điểm. Phiếu bán nội bộ chưa
        áp dụng thuế và không thay hóa đơn điện tử.
      </Caption>
    </Page>
  );
}
