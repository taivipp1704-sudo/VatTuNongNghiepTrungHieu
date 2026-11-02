import { View } from "react-native";
import { Button, Caption, Row } from "./ui";
export function ListPager({
  page,
  total,
  size = 50,
  onChange,
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (page: number) => void;
}) {
  return (
    <View style={{ gap: 10, paddingVertical: 12 }}>
      <Caption>
        Trang {page} · {total} kết quả · {size} dòng/trang
      </Caption>
      <Row>
        <View style={{ flex: 1 }}>
          <Button
            secondary
            title="Trang trước"
            disabled={page <= 1}
            onPress={() => onChange(page - 1)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            secondary
            title="Trang sau"
            disabled={page * size >= total}
            onPress={() => onChange(page + 1)}
          />
        </View>
      </Row>
    </View>
  );
}
