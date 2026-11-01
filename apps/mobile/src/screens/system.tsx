import { useState } from "react";
import { router } from "expo-router";
import { Linking, Pressable, View } from "react-native";
import {
  Badge,
  Button,
  Caption,
  Label,
  LinkRow,
  Notice,
  Page,
  Panel,
  QueryState,
  Section,
} from "@/components/ui";
import { Icon } from "@/components/pos-ui";
import { useApi } from "@/lib/api";
import { can } from "@/lib/session";
import { useWarehouse } from "@/lib/warehouse";
import { Bootstrap, DataRow } from "@/types";
import { theme } from "@/theme";
export function WarehousePicker() {
  const query = useApi<Bootstrap>("/bootstrap");
  const scope = useWarehouse();
  const [error, setError] = useState("");
  return (
    <Page>
      <Caption>
        Dữ liệu tổng quan và danh sách sẽ lọc theo kho này. Phiếu và giỏ đang
        nhập vẫn giữ kho đã chọn trong bản nháp.
      </Caption>
      <Notice error>{error}</Notice>
      <QueryState query={query}>
        {query.data?.warehouses.map((warehouse) => (
          <Pressable
            key={warehouse.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: scope.warehouseId === warehouse.id }}
            onPress={async () => {
              try {
                await scope.select(warehouse.id);
                router.back();
              } catch {
                setError(
                  "Không lưu được kho làm việc. Kiểm tra bộ nhớ và thử lại.",
                );
              }
            }}
          >
            <Panel>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Icon
                  name={
                    scope.warehouseId === warehouse.id
                      ? "radiobox-marked"
                      : "radiobox-blank"
                  }
                />
                <View style={{ flex: 1 }}>
                  <Label>{warehouse.name}</Label>
                  <Caption>{warehouse.address}</Caption>
                </View>
              </View>
            </Panel>
          </Pressable>
        ))}
      </QueryState>
    </Page>
  );
}
export function Notifications() {
  const query = useApi<DataRow>("/dashboard");
  return (
    <Page
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <QueryState query={query}>
        <Section title="Công việc tại kho đang chọn">
          <Panel>
            {can("inventory.view") ? (
              <>
                <LinkRow
                  title={String(query.data?.pending || 0) + " phiếu chờ duyệt"}
                  onPress={() => router.push("/documents")}
                />
                <LinkRow
                  title={
                    String(query.data?.stock?.expiring || 0) + " lô cận hạn"
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/inventory",
                      params: { filter: "soon" },
                    })
                  }
                />
                <LinkRow
                  title={
                    String(query.data?.stock?.expired || 0) + " lô hết hạn"
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/inventory",
                      params: { filter: "expired" },
                    })
                  }
                />
              </>
            ) : null}
            {can("debts.view") ? (
              <LinkRow
                title={
                  String(query.data?.debts?.overdue || 0) + " khoản nợ quá hạn"
                }
                onPress={() => router.push("/debts")}
              />
            ) : null}
            {can("sales.view") ? (
              <LinkRow
                title={
                  String(query.data?.jobs?.unpaid || 0) + " đơn đang giao dịch"
                }
                onPress={() =>
                  router.push({
                    pathname: "/orders",
                    params: { filter: "UNPAID" },
                  })
                }
              />
            ) : null}
          </Panel>
        </Section>
      </QueryState>
    </Page>
  );
}
export function Connections() {
  const query = useApi<Bootstrap>("/bootstrap");
  return (
    <Page>
      <Section title="Thiết bị & chứng từ">
        <Panel>
          <Badge label="PDF / in qua Android" tone="positive" />
          <Caption>
            Mở đơn hoặc chứng từ để xuất PDF, chia sẻ hoặc chọn dịch vụ in đã
            cài trên điện thoại. Máy in Bluetooth trực tiếp cần driver/model phù
            hợp; app chưa có cấu hình model máy in.
          </Caption>
          <Button
            title="Mở chứng từ bán hàng"
            onPress={() => router.push("/invoices")}
            disabled={!can("invoices.view")}
          />
        </Panel>
        <Panel>
          <Label>Hóa đơn điện tử</Label>
          <Badge label="Chưa cấu hình nhà cung cấp" tone="warning" />
          <Caption>
            Phiếu PDF là chứng từ nội bộ. Cần nhà cung cấp HĐĐT và tài khoản
            được cấp để phát hành hóa đơn điện tử thật.
          </Caption>
        </Panel>
      </Section>
      {query.data?.store.phone ? (
        <Button
          title="Gọi số liên hệ cửa hàng"
          secondary
          onPress={() => {
            void Linking.openURL("tel:" + query.data!.store.phone);
          }}
        />
      ) : null}
    </Page>
  );
}
