import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useApi } from "@/lib/api";
import { useWarehouse } from "@/lib/warehouse";
import { money, day, number } from "@/lib/format";
import { counterStatus } from "@/lib/counter";
import { DataRow } from "@/types";
import { theme } from "@/theme";
import { Badge, Button, Caption, Label, Panel, QueryState, Row } from "./ui";

export function CustomerPurchases({ customerId }: { customerId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const warehouseId = useWarehouse((state) => state.warehouseId);
  const query = useApi<DataRow>(
    "/partners/" + customerId + "/purchases?page=" + page,
  );
  useEffect(() => {
    setPage(1);
    setExpanded(false);
  }, [customerId, warehouseId]);
  const data = query.data;
  return (
    <View style={{ gap: 12 }}>
      <QueryState query={query}>
        {data ? (
          <>
            <View
              style={{
                backgroundColor: theme.colors.soft,
                borderRadius: theme.radius.md,
                padding: 16,
                gap: 10,
              }}
            >
              <Caption>TỔNG TIỀN KHÁCH ĐÃ MUA</Caption>
              <Label big>{money(data.summary.spent)}</Label>
              <Caption>
                {number(data.summary.orders)} đơn sau trả hàng · Trong phạm vi
                tài khoản và kho đang chọn
              </Caption>
              <Row>
                <Caption>Đã trả tiền</Caption>
                <Label>{money(data.summary.paid)}</Label>
              </Row>
              <Row>
                <Caption>Còn phải thu</Caption>
                <Label>{money(data.summary.outstanding)}</Label>
              </Row>
            </View>
            <Button
              title={
                expanded
                  ? "Ẩn lịch sử mua hàng"
                  : "Xem lịch sử mua hàng (" + data.summary.count + ")"
              }
              secondary
              onPress={() => setExpanded((value) => !value)}
            />
            {expanded ? (
              <>
                {data.orders.map((order: DataRow) => (
                  <Panel key={order.id}>
                    <Row>
                      <Label>{order.code}</Label>
                      <Badge
                        label={counterStatus(order as any)}
                        tone={
                          order.returned
                            ? "danger"
                            : order.paid >= order.total
                              ? "positive"
                              : "warning"
                        }
                      />
                    </Row>
                    <Caption>
                      {day(order.created_at)} ·{" "}
                      {new Date(order.created_at).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Caption>
                    <Label>{money(order.total)}</Label>
                    <Caption>
                      Đã trả {money(order.paid)} · Còn{" "}
                      {money(
                        order.returned
                          ? 0
                          : Math.max(0, order.total - order.paid),
                      )}
                    </Caption>
                    {order.lines.map((line: DataRow, index: number) => (
                      <Caption key={index}>
                        {line.name} · {number(line.quantity)} {line.unitLabel}
                      </Caption>
                    ))}
                  </Panel>
                ))}
                {!data.orders.length ? (
                  <Caption>Chưa có đơn mua hàng trong phạm vi này.</Caption>
                ) : null}
                {data.summary.count > 30 ? (
                  <Row>
                    <Button
                      title="Trang trước"
                      secondary
                      disabled={page <= 1}
                      onPress={() => setPage((value) => value - 1)}
                    />
                    <Caption>Trang {page}</Caption>
                    <Button
                      title="Trang tiếp"
                      secondary
                      disabled={page * 30 >= data.summary.count}
                      onPress={() => setPage((value) => value + 1)}
                    />
                  </Row>
                ) : null}
                <Button
                  title="Mở các đơn của khách"
                  secondary
                  onPress={() =>
                    router.push({ pathname: "/orders", params: { customerId } })
                  }
                />
              </>
            ) : null}
          </>
        ) : null}
      </QueryState>
    </View>
  );
}
