import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useApi } from "@/lib/api";
import { useWarehouse } from "@/lib/warehouse";
import { money, day, number } from "@/lib/format";
import { counterStatus } from "@/lib/counter";
import { DataRow } from "@/types";
import { theme } from "@/theme";
import { Button, Caption, Label, QueryState } from "./ui";
import { AppText } from "./text";
import { ListPager } from "./list-pager";
export function CustomerPurchases({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1),
    warehouseId = useWarehouse((v) => v.warehouseId);
  const query = useApi<DataRow>(
    "/partners/" + customerId + "/purchases?page=" + page,
  );
  useEffect(() => setPage(1), [customerId, warehouseId]);
  const data = query.data;
  return (
    <View style={{ gap: 12 }}>
      <QueryState query={query}>
        {data ? (
          <>
            <Caption>
              {number(data.summary.orders)} đơn sau trả hàng · Trong phạm vi tài
              khoản/kho
            </Caption>
            <Label numeric>Tổng đã mua: {money(data.summary.spent)}</Label>
            {data.orders.map((order: DataRow) => (
              <Pressable
                key={order.id}
                accessibilityRole="button"
                accessibilityLabel={"Xem đơn " + order.code}
                onPress={() =>
                  router.push({
                    pathname: "/orders",
                    params: { customerId, search: order.code },
                  })
                }
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                  backgroundColor: pressed
                    ? theme.colors.soft
                    : theme.colors.paper,
                  flexDirection: "row",
                  gap: 12,
                })}
              >
                <View style={{ flex: 1, gap: 5 }}>
                  <AppText style={{ fontSize: 15, fontWeight: "600" }}>
                    {order.code}
                  </AppText>
                  <Caption>{day(order.created_at)}</Caption>
                  <AppText
                    numberOfLines={1}
                    style={{ fontSize: 12, color: theme.colors.muted }}
                  >
                    {order.lines.map((l: DataRow) => l.name).join(", ")}
                  </AppText>
                </View>
                <View style={{ alignItems: "flex-end", gap: 7 }}>
                  <AppText variant="amount" style={{ fontSize: 15 }}>
                    {money(order.total)}
                  </AppText>
                  <AppText
                    style={{
                      fontSize: 12,
                      color: order.returned
                        ? theme.colors.danger
                        : order.paid < order.total
                          ? theme.colors.warning
                          : theme.colors.muted,
                    }}
                  >
                    {counterStatus(order as any)}
                  </AppText>
                </View>
              </Pressable>
            ))}
            {!data.orders.length ? (
              <Caption>Chưa có đơn mua hàng trong phạm vi này.</Caption>
            ) : null}
            {data.summary.count > 30 ? (
              <ListPager
                page={page}
                total={data.summary.count}
                size={30}
                onChange={setPage}
              />
            ) : null}
            <Button
              secondary
              title="Mở các đơn của khách"
              onPress={() =>
                router.push({ pathname: "/orders", params: { customerId } })
              }
            />
          </>
        ) : null}
      </QueryState>
    </View>
  );
}
