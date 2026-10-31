import { useEffect, useState } from "react";
import {
  Button,
  Caption,
  Field,
  Notice,
  Panel,
  Section,
  confirmAction,
} from "@/components/ui";
import { useCommand } from "@/lib/api";
import { can, useSession } from "@/lib/session";
import { parseRate, rateLabel } from "@/lib/loyalty";
import { Product } from "@/types";

export function ProductLoyalty({ product }: { product: Product }) {
  const [rate, setRate] = useState(
    String(product.loyalty_rate ?? 0).replace(".", ","),
  );
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const command = useCommand();
  const offline = useSession((state) => state.offline);
  useEffect(() => {
    if (!dirty) setRate(String(product.loyalty_rate ?? 0).replace(".", ","));
  }, [product.id, product.loyalty_rate, dirty]);
  if (!can("loyalty.manage"))
    return (
      <Caption>Số chấm tích điểm: {rateLabel(product.loyalty_rate)}</Caption>
    );
  const save = async () => {
    const parsed = parseRate(rate);
    if (parsed === undefined) {
      command.setError("Nhập tỷ lệ từ 0 đến 100%, tối đa 4 số thập phân.");
      return;
    }
    if (
      !(await confirmAction(
        "Lưu số chấm tích điểm",
        product.name + ": " + rateLabel(parsed),
      ))
    )
      return;
    const result = await command.run(
      "/products/" + product.id + "/loyalty",
      { rate: parsed },
      "PATCH",
    );
    if (result) {
      setDirty(false);
      setSaved(true);
    }
  };
  return (
    <Section title="Tích điểm của mặt hàng">
      <Panel>
        <Field
          label="Số chấm (%)"
          value={rate}
          onChangeText={(value) => {
            setRate(value);
            setDirty(true);
            setSaved(false);
          }}
          keyboardType="decimal-pad"
          editable={!command.pending}
        />
        <Caption>
          Ví dụ 0,1 = 0,1%; 0,5 = 0,5%. Nhập 0 để mặt hàng không tích điểm.
        </Caption>
        <Notice error>{command.error}</Notice>
        <Notice>{saved ? "Đã lưu tỷ lệ tích điểm." : ""}</Notice>
        <Button
          title="Lưu số chấm"
          onPress={save}
          pending={command.pending}
          disabled={!dirty || offline}
        />
      </Panel>
    </Section>
  );
}
