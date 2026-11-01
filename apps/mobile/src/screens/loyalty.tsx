import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Badge,
  Button,
  Caption,
  Denied,
  Empty,
  Field,
  Label,
  LinkRow,
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
import { useApi, useCommand } from "@/lib/api";
import { can, useSession } from "@/lib/session";
import { day, fold, money, number } from "@/lib/format";
import { parseRate, rateLabel } from "@/lib/loyalty";
import { DataRow, LoyaltySettings, Product } from "@/types";
import { ChoiceList, Icon } from "@/components/pos-ui";
import { View } from "react-native";
import { theme } from "@/theme";

export function LoyaltyAdmin() {
  const query = useApi<LoyaltySettings>(
    "/loyalty/settings",
    can("loyalty.manage"),
  );
  const products = useApi<Product[]>(
    "/inventory",
    can("loyalty.manage") && can("inventory.view"),
  );
  const [form, setForm] = useState<LoyaltySettings | null>(null);
  const [value, setValue] = useState("");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const command = useCommand();
  const offline = useSession((state) => state.offline);
  useEffect(() => {
    if (query.data && !dirty) {
      setForm(query.data);
      setValue(String(query.data.pointValue));
      setMinimum(String(query.data.minRedeemPoints));
      setMaximum(String(query.data.maxRedeemPercent).replace(".", ","));
    }
  }, [query.data, dirty]);
  if (!can("loyalty.manage")) return <Denied />;
  const change = (patch: Partial<LoyaltySettings>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
    setSaved(false);
  };
  const textChange = (setter: (value: string) => void, next: string) => {
    setter(next);
    setDirty(true);
    setSaved(false);
  };
  const save = async () => {
    const pointValue = Number(value),
      minRedeemPoints = Number(minimum),
      maxRedeemPercent = parseRate(maximum);
    if (
      !form ||
      !value.trim() ||
      !Number.isSafeInteger(pointValue) ||
      pointValue < 1 ||
      pointValue > 1_000_000_000 ||
      !minimum.trim() ||
      !Number.isSafeInteger(minRedeemPoints) ||
      minRedeemPoints < 0 ||
      minRedeemPoints > 1_000_000_000_000 ||
      maxRedeemPercent === undefined
    ) {
      command.setError(
        "Kiểm tra giá trị một điểm, điểm tối thiểu và giới hạn đổi từ 0 đến 100%.",
      );
      return;
    }
    if (
      !(await confirmAction(
        "Lưu chương trình tích điểm",
        "Quy tắc cộng điểm áp dụng cho đơn mới. Giá trị quy đổi mới cũng áp dụng khi dùng số điểm đang có.",
      ))
    )
      return;
    const result = await command.run<LoyaltySettings>(
      "/loyalty/settings",
      { ...form, pointValue, minRedeemPoints, maxRedeemPercent },
      "PATCH",
    );
    if (result) {
      setForm(result);
      setDirty(false);
      setSaved(true);
    }
  };
  const preview =
    Number(value) > 0
      ? (form?.rounding === "CEIL"
          ? Math.ceil
          : form?.rounding === "NEAREST"
            ? Math.round
            : Math.floor)(1000 / Number(value))
      : 0;
  return (
    <Page
      footer={
        form ? (
          <Button
            title="LƯU CẤU HÌNH TÍCH ĐIỂM"
            onPress={save}
            pending={command.pending}
            disabled={!dirty || offline}
          />
        ) : undefined
      }
    >
      <Row>
        <View style={{ flex: 1 }}>
          <Label big>Cài đặt tích điểm</Label>
          <Caption>Quy tắc tích lũy & tiêu điểm toàn hệ thống</Caption>
        </View>
        <Badge
          label={form?.enabled ? "Đang áp dụng" : "Đang tắt"}
          tone={form?.enabled ? "positive" : "neutral"}
        />
      </Row>
      <QueryState query={query}>
        {form ? (
          <>
            <Panel>
              <Toggle
                label="Bật chương trình tích điểm"
                value={form.enabled}
                onChange={(enabled) => change({ enabled })}
                disabled={command.pending}
              />
              <Caption>
                Chỉ tích và đổi điểm cho khách có hồ sơ. Đơn cũ giữ quy tắc đã
                bán.
              </Caption>
            </Panel>
            <Panel>
              <View
                style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
              >
                <Icon name="cached" />
                <View>
                  <Label>Quy đổi giá trị điểm thưởng</Label>
                  <Caption>Tỷ lệ quy đổi điểm sang tiền</Caption>
                </View>
              </View>
              <Field
                label="Giá trị quy đổi 1 điểm (VNĐ)"
                value={value}
                onChangeText={(next) => textChange(setValue, next)}
                keyboardType="numeric"
                editable={!command.pending}
              />
              <Caption>
                1.000.000đ hàng ở mức 0,1% tạo {number(preview)} điểm trước
                chiết khấu với quy tắc đang chọn.
              </Caption>
              <Label>Cách làm tròn điểm</Label>
              <ChoiceList
                label="Cách làm tròn điểm"
                value={form.rounding}
                onChange={(v) =>
                  change({ rounding: v as LoyaltySettings["rounding"] })
                }
                disabled={command.pending}
                options={[
                  {
                    value: "NEAREST",
                    title: "Làm tròn chuẩn (từ 0,5 lên)",
                    description: "Ví dụ 12,6 điểm thành 13 điểm",
                  },
                  {
                    value: "FLOOR",
                    title: "Làm tròn xuống (bỏ số lẻ)",
                    description: "Ví dụ 12,9 điểm thành 12 điểm",
                  },
                  {
                    value: "CEIL",
                    title: "Làm tròn lên",
                    description: "Ví dụ 12,1 điểm thành 13 điểm",
                  },
                ]}
              />
            </Panel>
            <Panel>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Icon name="calculator-variant-outline" />
                <View>
                  <Label>Công thức & thời điểm tích</Label>
                  <Caption>Quy chuẩn tính điểm theo giá trị đơn</Caption>
                </View>
              </View>
              <Label>Cơ sở tính điểm</Label>
              <ChoiceList
                label="Cơ sở tính điểm"
                value={form.earningBase}
                onChange={(v) =>
                  change({ earningBase: v as LoyaltySettings["earningBase"] })
                }
                disabled={command.pending}
                options={[
                  {
                    value: "AFTER_DISCOUNT",
                    title: "Tính sau chiết khấu",
                    description: "Điểm tính trên số tiền khách cần thanh toán",
                  },
                  {
                    value: "BEFORE_DISCOUNT",
                    title: "Tính trước chiết khấu",
                    description:
                      "Theo giá niêm yết; vẫn loại phần giảm bằng điểm",
                  },
                ]}
              />
              <Label>Thời điểm ghi nhận cộng điểm</Label>
              <Caption>
                Bán tại quầy: chọn thu đủ 100% tiền để đơn đang giao dịch chỉ
                theo dõi điểm chờ, chưa cộng vào ví khách.
              </Caption>
              <ChoiceList
                label="Thời điểm ghi nhận cộng điểm"
                value={form.earningTiming}
                onChange={(v) =>
                  change({
                    earningTiming: v as LoyaltySettings["earningTiming"],
                  })
                }
                disabled={command.pending}
                options={[
                  {
                    value: "FULL_PAYMENT",
                    title: "Khi thu đủ 100% tiền",
                    description: "Đơn ghi nợ chưa phát điểm cho đến khi thu đủ",
                  },
                  {
                    value: "PROPORTIONAL",
                    title: "Cộng theo tỷ lệ tiền thực thu",
                    description:
                      "Cộng dần theo phần đã thu, thu đủ cộng phần còn lại",
                  },
                  {
                    value: "ORDER",
                    title: "Cộng ngay khi tạo đơn",
                    description: "Ghi nhận ngay, kể cả đơn chưa thu tiền",
                  },
                ]}
              />
            </Panel>
            <Panel>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Icon name="gift-outline" />
                <Label>Quy tắc tiêu điểm & đổi thưởng</Label>
              </View>
              <Toggle
                label="Cho phép đổi điểm trừ tiền"
                value={form.redeemEnabled}
                onChange={(redeemEnabled) => change({ redeemEnabled })}
                disabled={command.pending}
              />
              <Caption>
                {form.redeemEnabled
                  ? "Thu ngân cần được cấp quyền Đổi điểm giảm tiền khi bán hàng."
                  : "Chỉ theo dõi điểm và xếp hạng, không trừ vào tiền đơn."}
              </Caption>
              <Field
                label="Số điểm tối thiểu để đổi"
                value={minimum}
                onChangeText={(next) => textChange(setMinimum, next)}
                keyboardType="numeric"
                editable={!command.pending}
              />
              <Field
                label="Giới hạn giảm tối đa mỗi đơn (%)"
                value={maximum}
                onChangeText={(next) => textChange(setMaximum, next)}
                keyboardType="decimal-pad"
                editable={!command.pending}
              />
            </Panel>
            <Panel>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Icon name="undo-variant" />
                <Label>Trả hàng & hoàn điểm tự động</Label>
              </View>
              <Toggle
                label="Thu hồi điểm khi khách trả hàng"
                value={form.reverseEarnOnReturn}
                onChange={(reverseEarnOnReturn) =>
                  change({ reverseEarnOnReturn })
                }
                disabled={command.pending}
              />
              <Caption>
                {form.reverseEarnOnReturn
                  ? "Trừ lại điểm đã cộng của đơn trả. Nếu điểm đã dùng, số dư có thể âm."
                  : "Đơn mới sẽ giữ điểm đã cộng khi trả hàng theo lựa chọn này."}
              </Caption>
              <Toggle
                label="Hoàn điểm đã dùng khi trả đơn"
                value={form.refundSpentOnReturn}
                onChange={(refundSpentOnReturn) =>
                  change({ refundSpentOnReturn })
                }
                disabled={command.pending}
              />
              <Caption>
                Tiền hoàn là số tiền thực thu. Hai lựa chọn này được lưu theo
                từng đơn.
              </Caption>
            </Panel>
            <Panel>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Icon name="crown-outline" />
                <Label>Hạng thành viên VIP</Label>
              </View>
              <Toggle
                label="Bật xếp hạng thành viên"
                value={form.tiersEnabled}
                onChange={(tiersEnabled) => change({ tiersEnabled })}
                disabled={command.pending}
              />
              <Caption>
                Dựa trên tổng điểm mua hàng đã cộng sau khi trừ điểm thu hồi;
                không tính điểm chỉnh tay.
              </Caption>
              {form.tiersEnabled
                ? form.tiers.map((tier, index) => (
                    <View
                      key={index}
                      style={{
                        gap: 8,
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderTopColor: theme.colors.border,
                      }}
                    >
                      <Field
                        label={"Tên hạng " + (index + 1)}
                        value={tier.name}
                        onChangeText={(name) =>
                          change({
                            tiers: form.tiers.map((item, i) =>
                              i === index ? { ...item, name } : item,
                            ),
                          })
                        }
                        editable={!command.pending}
                      />
                      <Field
                        label="Điểm tích lũy tối thiểu của hạng"
                        value={String(tier.minimumPoints)}
                        keyboardType="numeric"
                        onChangeText={(text) =>
                          change({
                            tiers: form.tiers.map((item, i) =>
                              i === index
                                ? { ...item, minimumPoints: Number(text) }
                                : item,
                            ),
                          })
                        }
                        editable={index !== 0 && !command.pending}
                      />
                      {index > 0 ? (
                        <Button
                          title="Xóa hạng này"
                          secondary
                          onPress={() =>
                            change({
                              tiers: form.tiers.filter((_, i) => i !== index),
                            })
                          }
                          disabled={command.pending}
                        />
                      ) : null}
                    </View>
                  ))
                : null}
              {form.tiersEnabled && form.tiers.length < 6 ? (
                <Button
                  title="Thêm hạng thành viên"
                  secondary
                  onPress={() =>
                    change({
                      tiers: [
                        ...form.tiers,
                        {
                          name: "Hạng mới",
                          minimumPoints:
                            (form.tiers.at(-1)?.minimumPoints || 0) + 1000,
                        },
                      ],
                    })
                  }
                  disabled={command.pending}
                />
              ) : null}
            </Panel>
            <Notice error>{command.error}</Notice>
            <Notice>{saved ? "Đã lưu chương trình tích điểm." : ""}</Notice>
            <Caption>
              Thay giá trị 1 điểm cũng thay giá trị quy đổi số điểm đang có. Đơn
              cũ không bị tính lại.
            </Caption>
            <Button
              title="Chỉnh số chấm từng mặt hàng"
              secondary
              onPress={() => router.push("/inventory")}
              disabled={!can("inventory.view")}
            />
          </>
        ) : null}
      </QueryState>
    </Page>
  );
}

export function CustomerLoyalty() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApi<{
    customer: { name: string };
    balance: number;
    entries: DataRow[];
  }>("/loyalty/customers/" + id, Boolean(id) && can("partners.view"));
  if (!can("partners.view")) return <Denied />;
  const labels: Record<string, string> = {
    EARN: "Cộng điểm",
    REDEEM: "Đổi điểm",
    RETURN_EARN: "Thu hồi điểm khi trả hàng",
    RETURN_REDEEM: "Hoàn điểm đã đổi",
    ADJUST: "Điều chỉnh bởi quản trị viên",
  };
  return (
    <Page>
      <QueryState query={query}>
        {query.data ? (
          <>
            <Panel>
              <Label big>{query.data.customer.name}</Label>
              <Caption>Số dư tích lũy toàn cửa hàng</Caption>
              <Label big>{number(query.data.balance)} điểm</Label>
              {query.data.balance < 0 ? (
                <Notice>
                  Điểm đã dùng được thu hồi do trả hàng. Các lần tích sau sẽ bù
                  số dư âm trước khi đổi tiếp.
                </Notice>
              ) : null}
            </Panel>
            <Section title="Lịch sử điểm trong phạm vi kho của bạn">
              {!query.data.entries.length ? (
                <Empty message="Chưa có giao dịch điểm trong phạm vi kho của bạn." />
              ) : null}
              {query.data.entries.map((entry) => (
                <Panel key={entry.id}>
                  <Row>
                    <Label>{labels[entry.kind] || entry.kind}</Label>
                    <Label>
                      {entry.delta > 0 ? "+" : ""}
                      {number(entry.delta)} điểm
                    </Label>
                  </Row>
                  <Caption>
                    {entry.order_code} · {entry.note || ""} ·{" "}
                    {day(entry.created_at)} · Số dư sau giao dịch{" "}
                    {number(entry.balance)}
                  </Caption>
                </Panel>
              ))}
              {query.data.entries.length === 100 ? (
                <Caption>Hiển thị 100 giao dịch gần nhất.</Caption>
              ) : null}
            </Section>
          </>
        ) : null}
      </QueryState>
    </Page>
  );
}
