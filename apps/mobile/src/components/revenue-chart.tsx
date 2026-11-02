import { ComponentRef, useEffect, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { AppText } from "./text";
import { Caption, Row } from "./ui";
import { IconButton } from "./pos-ui";
import { bucketLabel } from "@/lib/counter";
import { money } from "@/lib/format";
import { theme } from "@/theme";

type Point = { bucket: string; revenue: number; collected: number };
const compact = (value: number) => {
  const abs = Math.abs(value),
    divisor = abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : abs >= 1e3 ? 1e3 : 1;
  return (
    (value / divisor).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) +
    (divisor === 1e9
      ? " tỷ"
      : divisor === 1e6
        ? " tr"
        : divisor === 1e3
          ? " k"
          : "")
  );
};
export function RevenueChart({
  points,
  metric = "revenue",
  period,
}: {
  points: Point[];
  metric?: "revenue" | "collected";
  period: string;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(720, screenWidth) - 64,
    height = 220,
    left = 52,
    right = 8,
    top = 12,
    bottom = 35;
  const [selected, setSelected] = useState(0);
  const chartRef = useRef<ComponentRef<typeof View>>(null);
  useEffect(
    () =>
      setSelected(
        Math.max(
          0,
          points.findLastIndex((point) => point[metric] !== 0),
        ),
      ),
    [points, metric],
  );
  const values = points.map((p) => p[metric]);
  const max = Math.max(1, ...values),
    min = Math.min(0, ...values);
  const y = (value: number) =>
    top + ((max - value) / (max - min)) * (height - top - bottom);
  const plotWidth = width - left - right,
    step = plotWidth / Math.max(points.length, 1);
  const current = points[Math.min(selected, points.length - 1)];
  const ticks = [max, (max + min) / 2, min];
  return (
    <View style={{ gap: 8 }}>
      <Caption>Chạm biểu đồ hoặc dùng nút trước/sau để xem từng mốc.</Caption>
      <Pressable
        ref={chartRef}
        accessibilityRole="adjustable"
        accessibilityLabel="Biểu đồ doanh thu"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, points.length - 1)}
        aria-valuenow={selected}
        aria-valuetext={
          current
            ? bucketLabel(current.bucket, period) +
              ": " +
              money(current[metric])
            : "Chưa có dữ liệu"
        }
        accessibilityValue={{
          min: 0,
          max: Math.max(0, points.length - 1),
          now: selected,
          text: current
            ? bucketLabel(current.bucket, period) +
              ": " +
              money(current[metric])
            : "Chưa có dữ liệu",
        }}
        onAccessibilityAction={(event) =>
          setSelected((i) =>
            Math.max(
              0,
              Math.min(
                points.length - 1,
                i + (event.nativeEvent.actionName === "increment" ? 1 : -1),
              ),
            ),
          )
        }
        accessibilityActions={[
          { name: "increment", label: "Mốc tiếp theo" },
          { name: "decrement", label: "Mốc trước" },
        ]}
        onPress={(event) => {
          const pageX = event.nativeEvent.pageX;
          const locationX = event.nativeEvent.locationX;
          chartRef.current?.measureInWindow((chartX) => {
            const localX = Number.isFinite(pageX) ? pageX - chartX : locationX;
            if (!Number.isFinite(localX)) return;
            setSelected(
              Math.max(
                0,
                Math.min(points.length - 1, Math.floor((localX - left) / step)),
              ),
            );
          });
        }}
      >
        <Svg
          pointerEvents="none"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
        >
          {ticks.map((value, index) => (
            <Line
              key={"line" + index}
              x1={left}
              x2={width - right}
              y1={y(value)}
              y2={y(value)}
              stroke={theme.colors.border}
              strokeWidth={1}
            />
          ))}
          {ticks.map((value, index) => (
            <SvgText
              key={"tick" + index}
              x={left - 7}
              y={y(value) + 4}
              textAnchor="end"
              fontSize={11}
              fill={theme.colors.muted}
            >
              {compact(value)}
            </SvgText>
          ))}
          <Line
            x1={left}
            x2={width - right}
            y1={y(0)}
            y2={y(0)}
            stroke={theme.colors.control}
          />
          {points.map((point, index) => (
            <Rect
              key={point.bucket}
              x={left + index * step + step * 0.16}
              y={Math.min(y(point[metric]), y(0))}
              width={Math.max(1, step * 0.68)}
              height={Math.max(1, Math.abs(y(point[metric]) - y(0)))}
              rx={Math.min(4, step * 0.2)}
              fill={
                point[metric] < 0
                  ? theme.colors.danger
                  : theme.colors.chartSeries
              }
              stroke={index === selected ? theme.colors.text : "none"}
              strokeWidth={index === selected ? 2 : 0}
              opacity={1}
            />
          ))}
          {points.map((point, index) =>
            index === points.length - 1 ||
            index % Math.max(1, Math.ceil(points.length / 5)) === 0 ? (
              <SvgText
                key={"label" + point.bucket}
                x={left + (index + 0.5) * step}
                y={height - 9}
                textAnchor="middle"
                fontSize={11}
                fill={theme.colors.muted}
              >
                {bucketLabel(point.bucket, period)}
              </SvgText>
            ) : null,
          )}
        </Svg>
      </Pressable>
      <Row>
        <IconButton
          name="chevron-left"
          label="Mốc biểu đồ trước"
          disabled={selected <= 0}
          onPress={() => setSelected((i) => Math.max(0, i - 1))}
        />
        <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
          <Caption>
            {current ? bucketLabel(current.bucket, period) : "Chưa có dữ liệu"}
          </Caption>
          <AppText
            variant="amount"
            style={{
              fontSize: 19,
              fontWeight: "700",
              color: theme.colors.text,
            }}
          >
            {money(current?.[metric] || 0)}
          </AppText>
        </View>
        <IconButton
          name="chevron-right"
          label="Mốc biểu đồ tiếp theo"
          disabled={selected >= points.length - 1}
          onPress={() => setSelected((i) => Math.min(points.length - 1, i + 1))}
        />
      </Row>
    </View>
  );
}
