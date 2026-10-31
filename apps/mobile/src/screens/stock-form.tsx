import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
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
  Row,
  Section,
  Select,
  confirmAction,
} from "@/components/ui";
import { useApi, useCommand } from "@/lib/api";
import { can, useSession } from "@/lib/session";
import { newKey, useDraft } from "@/lib/drafts";
import { useScan } from "@/lib/scanner";
import { Bootstrap, DataRow, Partner, Product } from "@/types";
import { number } from "@/lib/format";

interface Line {
  productId: string;
  lotId?: string;
  lotCode?: string;
  quantity: number;
  unit: "BASE" | "PACK";
  expiresOn?: string;
  location: string;
  costBase?: number;
}
export default function StockForm() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const draft = useDraft("stock", () => ({
    kind: params.kind || "RECEIPT",
    warehouseId: "",
    destinationId: "",
    partnerId: "",
    reason: "",
    lines: [] as Line[],
    requestKey: newKey(),
  }));
  const { value, setValue } = draft;
  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState("");
  const [lotId, setLotId] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("BASE");
  const [lotCode, setLotCode] = useState("");
  const [expires, setExpires] = useState("");
  const [location, setLocation] = useState("");
  const [cost, setCost] = useState("");
  const [message, setMessage] = useState("");
  const bootstrap = useApi<Bootstrap>("/bootstrap");
  const products = useApi<Product[]>(
    "/inventory" +
      (value.warehouseId ? "?warehouseId=" + value.warehouseId : ""),
    can("inventory.view"),
  );
  const partners = useApi<Partner[]>("/partners", can("partners.view"));
  const command = useCommand();
  const scan = useScan();
  const offline = useSession((state) => state.offline);
  const kinds = [
    ...(can("inventory.receipt.create")
      ? [
          { value: "RECEIPT", label: "Nhập từ nhà cung cấp" },
          { value: "RETURN", label: "Nhận hàng trả về cách ly" },
        ]
      : []),
    ...(can("inventory.issue.create")
      ? [
          { value: "ISSUE", label: "Xuất sử dụng nội bộ" },
          { value: "TRANSFER", label: "Điều chuyển kho" },
          { value: "DISPOSAL", label: "Xuất hủy hàng hỏng/hết hạn" },
        ]
      : []),
    ...(can("inventory.count.create")
      ? [{ value: "COUNT", label: "Kiểm kê số thực tế" }]
      : []),
  ];
  useEffect(() => {
    if (draft.ready && !value.warehouseId && bootstrap.data?.warehouses[0])
      setValue((current) => ({
        ...current,
        warehouseId: bootstrap.data!.warehouses[0].id,
      }));
  }, [draft.ready, bootstrap.data, value.warehouseId]);
  useEffect(() => {
    if (scan.target === "stock" && scan.code && products.data) {
      const product = products.data.find(
        (item) => item.barcode === scan.code || item.sku === scan.code,
      );
      if (product) {
        setProductId(product.id);
        setLotId("");
        setMessage("Đã chọn " + product.name);
      } else setMessage("Không tìm thấy mã " + scan.code);
      scan.clear();
    }
  }, [scan.code, scan.target, products.data]);
  if (!kinds.length) return <Denied />;
  const product = products.data?.find((item) => item.id === productId);
  const incoming = ["RECEIPT", "RETURN"].includes(value.kind);
  const update = (patch: Partial<typeof value>) =>
    setValue((current) => ({ ...current, ...patch }));
  const add = () => {
    const quantity = Number(qty.replace(",", "."));
    if (
      !product ||
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      (value.kind !== "COUNT" && quantity === 0)
    ) {
      command.setError("Chọn hàng hóa và nhập số lượng hợp lệ.");
      return;
    }
    if (!incoming && !lotId) {
      command.setError("Chọn lô hàng.");
      return;
    }
    if (
      incoming &&
      product.track_lots &&
      (!lotCode.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(expires))
    ) {
      command.setError("Nhập số lô và hạn sử dụng dạng YYYY-MM-DD.");
      return;
    }
    const line: Line = {
      productId: product.id,
      quantity,
      unit: unit as Line["unit"],
      location,
    };
    if (incoming) {
      if (lotCode) line.lotCode = lotCode.trim();
      if (expires) line.expiresOn = expires;
      if (cost && can("inventory.cost.view")) line.costBase = Number(cost);
    } else line.lotId = lotId;
    update({ lines: [...value.lines, line] });
    setQty("1");
    command.setError("");
    setMessage("Đã thêm dòng hàng.");
  };
  const submit = async (status: "DRAFT" | "PENDING") => {
    if (
      !(await confirmAction(
        status === "DRAFT"
          ? "Lưu phiếu nháp lên máy chủ"
          : "Gửi phiếu chờ duyệt",
        "Phiếu chưa thay đổi tồn kho. Chủ cửa hàng/người có quyền cần ghi sổ sau.",
      ))
    )
      return;
    if (!(await draft.save())) {
      command.setError(
        "Cần lưu được bản nháp trước khi gửi để có thể kiểm tra lại kết quả.",
      );
      return;
    }
    const input = {
      kind: value.kind,
      warehouseId: value.warehouseId,
      ...(value.kind === "TRANSFER"
        ? { destinationId: value.destinationId }
        : {}),
      ...(value.partnerId ? { partnerId: value.partnerId } : {}),
      lines: value.lines,
      reason: value.reason,
      status,
    };
    const result = await command.run<DataRow>(
      "/documents",
      input,
      "POST",
      value.requestKey,
    );
    if (result) {
      setValue({
        kind: value.kind,
        warehouseId: value.warehouseId,
        destinationId: "",
        partnerId: "",
        reason: "",
        lines: [],
        requestKey: newKey(),
      });
      await draft.save();
      router.replace("/documents");
    }
  };
  return (
    <Page>
      <Row>
        <Badge label={"Bước " + step + " / 3"} />
        <Caption>
          {draft.saved
            ? "Đã lưu nháp trên thiết bị"
            : "Bản nháp tự lưu trên thiết bị"}
        </Caption>
      </Row>
      {step === 1 ? (
        <Panel>
          <Select
            label="Loại nghiệp vụ"
            value={value.kind}
            onChange={(kind) =>
              update({ kind, lines: [], requestKey: newKey() })
            }
            options={kinds}
          />
          <Select
            label="Kho làm việc"
            value={value.warehouseId}
            onChange={(warehouseId) =>
              update({ warehouseId, lines: [], requestKey: newKey() })
            }
            options={(bootstrap.data?.warehouses || []).map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
          {value.kind === "TRANSFER" ? (
            <Select
              label="Kho nhận"
              value={value.destinationId}
              onChange={(destinationId) => update({ destinationId })}
              options={[
                { value: "", label: "Chọn kho nhận" },
                ...(bootstrap.data?.warehouses || [])
                  .filter((item) => item.id !== value.warehouseId)
                  .map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          ) : null}
          {incoming ? (
            <Select
              label="Nhà cung cấp (nếu mua chịu)"
              value={value.partnerId}
              onChange={(partnerId) => update({ partnerId })}
              options={[
                { value: "", label: "Không liên kết nhà cung cấp" },
                ...(partners.data || [])
                  .filter((item) => item.kind === "SUPPLIER")
                  .map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          ) : null}
          <Field
            label="Lý do / nội dung phiếu"
            value={value.reason}
            onChangeText={(reason) => update({ reason })}
            multiline
          />
          <Button
            title="Tiếp tục chọn hàng"
            onPress={() => setStep(2)}
            disabled={
              !value.warehouseId ||
              value.reason.trim().length < 3 ||
              (value.kind === "TRANSFER" && !value.destinationId)
            }
          />
        </Panel>
      ) : null}
      {step === 2 ? (
        <>
          <Panel>
            <Select
              label="Hàng hóa"
              value={productId}
              onChange={(id) => {
                setProductId(id);
                setLotId("");
                setLotCode("");
                setExpires("");
                setCost("");
              }}
              options={[
                { value: "", label: "Chọn sản phẩm" },
                ...(products.data || []).map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
            />
            <Button
              title="Quét mã"
              secondary
              onPress={() =>
                router.push({ pathname: "/scan", params: { target: "stock" } })
              }
            />
            {product ? (
              <>
                <Caption>
                  1 {product.pack_unit} = {number(product.pack_factor)}{" "}
                  {product.base_unit}
                </Caption>
                <Select
                  label="Đơn vị nhập số lượng"
                  value={unit}
                  onChange={setUnit}
                  options={[
                    { value: "BASE", label: product.base_unit },
                    { value: "PACK", label: product.pack_unit },
                  ]}
                />
                {incoming ? (
                  <>
                    <Field
                      label="Số lô"
                      value={lotCode}
                      onChangeText={setLotCode}
                    />
                    <Field
                      label="Hạn sử dụng (YYYY-MM-DD)"
                      value={expires}
                      onChangeText={setExpires}
                      placeholder="2027-12-31"
                    />
                    {can("inventory.cost.view") ? (
                      <Field
                        label={
                          "Giá vốn / " +
                          product.base_unit +
                          " (để trống dùng giá hiện tại)"
                        }
                        value={cost}
                        onChangeText={setCost}
                        keyboardType="numeric"
                      />
                    ) : null}
                    <Field
                      label="Vị trí kệ"
                      value={location}
                      onChangeText={setLocation}
                    />
                  </>
                ) : (
                  <Select
                    label="Lô tại kho"
                    value={lotId}
                    onChange={setLotId}
                    options={[
                      { value: "", label: "Chọn lô" },
                      ...product.lots
                        .filter((lot) => lot.warehouseId === value.warehouseId)
                        .map((lot) => ({
                          value: lot.id,
                          label:
                            lot.code +
                            " · Thực tế " +
                            number(lot.quantity) +
                            " " +
                            product.base_unit,
                        })),
                    ]}
                  />
                )}
                <Field
                  label={
                    value.kind === "COUNT"
                      ? "Số lượng thực tế đếm được"
                      : "Số lượng"
                  }
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="decimal-pad"
                />
                <Button title="Thêm dòng hàng" onPress={add} />
              </>
            ) : null}
            <Notice>{message}</Notice>
          </Panel>
          <Section title={value.lines.length + " dòng hàng"}>
            {value.lines.map((line, index) => (
              <Panel key={index}>
                <Label>
                  {products.data?.find((item) => item.id === line.productId)
                    ?.name || line.productId}
                </Label>
                <Caption>
                  {number(line.quantity)}{" "}
                  {line.unit === "PACK" ? "đơn vị đóng gói" : "đơn vị cơ sở"} ·{" "}
                  {line.lotCode ||
                    products.data
                      ?.flatMap((item) => item.lots)
                      .find((lot) => lot.id === line.lotId)?.code}
                </Caption>
                <Button
                  title="Bỏ dòng"
                  secondary
                  onPress={() =>
                    update({
                      lines: value.lines.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                />
              </Panel>
            ))}
          </Section>
          <Button
            title="Kiểm tra phiếu"
            onPress={() => setStep(3)}
            disabled={!value.lines.length}
          />
        </>
      ) : null}
      {step === 3 ? (
        <Panel>
          <Label big>
            {kinds.find((item) => item.value === value.kind)?.label}
          </Label>
          <Caption>
            {
              bootstrap.data?.warehouses.find(
                (item) => item.id === value.warehouseId,
              )?.name
            }
          </Caption>
          <Label>{value.reason}</Label>
          <Label>{value.lines.length} dòng hàng</Label>
          <Notice>
            Phiếu chỉ làm thay đổi tồn sau khi được duyệt và ghi sổ. Hàng trả về
            vào khu cách ly.
          </Notice>
          <Button
            title="Gửi phiếu chờ duyệt"
            onPress={() => submit("PENDING")}
            disabled={offline || !draft.ready}
            pending={command.pending}
          />
          <Button
            title="Lưu nháp lên máy chủ"
            secondary
            onPress={() => submit("DRAFT")}
            disabled={offline || !draft.ready}
            pending={command.pending}
          />
        </Panel>
      ) : null}
      <Notice error>{command.error || draft.storageError}</Notice>
      {step > 1 ? (
        <Button
          title="Quay lại bước trước"
          secondary
          onPress={() => setStep(step - 1)}
        />
      ) : null}
      <Button
        title="Lưu nháp trên thiết bị"
        secondary
        disabled={!draft.ready}
        onPress={() =>
          draft
            .save()
            .then((saved) =>
              setMessage(
                saved ? "Đã lưu bản nháp. Chưa đồng bộ lên máy chủ." : "",
              ),
            )
        }
      />
    </Page>
  );
}
