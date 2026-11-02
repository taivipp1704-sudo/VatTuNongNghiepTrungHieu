import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Caption,
  Field,
  Label,
  Notice,
  Panel,
  QueryState,
  Row,
} from "./ui";
import { useApi, useCommand } from "@/lib/api";
import { can, useSession } from "@/lib/session";
import { useWarehouse } from "@/lib/warehouse";
import { DataRow, Product } from "@/types";
import { day, money, number } from "@/lib/format";

export function ProductStock({ product }: { product: Product }) {
  const [history, setHistory] = useState(false),
    [page, setPage] = useState(1);
  const stock = useApi<DataRow>(`/management/products/${product.id}/stock`);
  const ledger = useApi<DataRow>(
    `/management/products/${product.id}/history?page=${page}`,
    history,
  );
  const warehouse = useWarehouse((s) => s.warehouseId);
  useEffect(() => setPage(1), [warehouse, product.id]);
  return (
    <View style={{ gap: 16 }}>
      <QueryState query={stock}>
        {stock.data?.warehouses.map((row: DataRow) => (
          <StockSettings key={row.id} row={row} product={product} />
        ))}
      </QueryState>
      <Button
        secondary
        title={
          history
            ? "Ẩn lịch sử nhập xuất"
            : "Lịch sử nhập · bán · kiểm kê · trả hàng"
        }
        onPress={() => setHistory(!history)}
      />
      {history ? (
        <QueryState query={ledger}>
          {ledger.data ? (
            <>
              {ledger.data.items.map((r: DataRow) => (
                <Panel key={r.id}>
                  <Row>
                    <Label>{r.reference || r.reason}</Label>
                    <Label numeric tone={r.delta >= 0 ? "success" : "warning"}>
                      {r.delta > 0 ? "+" : ""}
                      {number(r.delta)} {r.unit}
                    </Label>
                  </Row>
                  <Caption>
                    {day(r.created_at)} · {r.employee}
                  </Caption>
                  <Caption>
                    {r.warehouse} · Lô {r.lot} · {r.reason}
                  </Caption>
                  <Caption>
                    Tồn lô sau giao dịch: {number(r.balance)} {r.unit}
                  </Caption>
                </Panel>
              ))}
              {!ledger.data.items.length ? (
                <Caption>Chưa có giao dịch kho.</Caption>
              ) : null}
              <Caption>Trang {page}</Caption>
              <Row>
                <View style={{ flex: 1 }}>
                  <Button
                    secondary
                    title="Trước"
                    disabled={page === 1}
                    onPress={() => setPage((p) => p - 1)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    secondary
                    title="Tiếp"
                    disabled={page * 30 >= ledger.data.total}
                    onPress={() => setPage((p) => p + 1)}
                  />
                </View>
              </Row>
            </>
          ) : null}
        </QueryState>
      ) : null}
    </View>
  );
}
function StockSettings({ row, product }: { row: DataRow; product: Product }) {
  const [editing, setEditing] = useState(false),
    [location, setLocation] = useState(""),
    [minimum, setMinimum] = useState("0"),
    [maximum, setMaximum] = useState("");
  const command = useCommand(),
    offline = useSession((s) => s.offline);
  const begin = () => {
    setLocation(row.location);
    setMinimum(String(row.min_stock));
    setMaximum(row.max_stock == null ? "" : String(row.max_stock));
    setEditing(true);
  };
  const save = async () => {
    const result = await command.run(
      `/management/products/${product.id}/warehouse`,
      {
        warehouseId: row.id,
        location,
        minStock: Number(minimum),
        maxStock: maximum.trim() === "" ? null : Number(maximum),
      },
      "PATCH",
    );
    if (result) setEditing(false);
  };
  return (
    <Panel>
      <Label big>{row.name}</Label>
      <Caption>Đơn vị cơ sở: {product.base_unit}</Caption>
      <Row>
        <Caption>Tồn thực tế / Đã giữ</Caption>
        <Label numeric>
          {number(row.actual)} / {number(row.reserved)}
        </Label>
      </Row>
      <Row>
        <Caption>Có thể bán / Đang nhập</Caption>
        <Label numeric>
          {number(row.available)} / {number(row.incoming)}
        </Label>
      </Row>
      {can("inventory.cost.view") && row.costBase !== undefined ? (
        <Row>
          <Caption>Giá vốn bình quân các lô hiện tại</Caption>
          <Label numeric>{money(row.costBase)}</Label>
        </Row>
      ) : null}
      <Caption>
        Vị trí: {row.location || "Chưa đặt"} · Tối thiểu {number(row.min_stock)}{" "}
        · Tối đa {row.max_stock == null ? "Chưa đặt" : number(row.max_stock)}
      </Caption>
      <Caption>
        Khả dụng loại trừ hàng cách ly, hết hạn và số lượng đã giữ.
      </Caption>
      {can("products.manage") ? (
        <Button
          secondary
          title={editing ? "Đóng thiết lập kho" : "Sửa vị trí và ngưỡng tồn"}
          disabled={command.pending}
          onPress={() => (editing ? setEditing(false) : begin())}
        />
      ) : null}
      {editing ? (
        <>
          <Field
            label="Vị trí lưu hàng"
            value={location}
            onChangeText={setLocation}
          />
          <Row>
            <View style={{ flex: 1 }}>
              <Field
                label="Tồn tối thiểu"
                value={minimum}
                onChangeText={setMinimum}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Tồn tối đa"
                value={maximum}
                onChangeText={setMaximum}
                keyboardType="decimal-pad"
                placeholder="Không giới hạn"
              />
            </View>
          </Row>
          <Notice error>{command.error}</Notice>
          <Button
            title="Lưu thiết lập kho"
            disabled={
              offline ||
              !Number.isFinite(Number(minimum)) ||
              Number(minimum) < 0 ||
              (maximum !== "" &&
                (!Number.isFinite(Number(maximum)) ||
                  Number(maximum) < Number(minimum)))
            }
            pending={command.pending}
            onPress={() => void save()}
          />
        </>
      ) : null}
      {can("inventory.count.create") ? (
        <Button
          secondary
          title="Kiểm kê số lượng theo lô"
          onPress={() =>
            router.push({
              pathname: "/stock-form",
              params: {
                kind: "COUNT",
                productId: product.id,
                warehouseId: row.id,
              },
            })
          }
        />
      ) : null}
    </Panel>
  );
}
