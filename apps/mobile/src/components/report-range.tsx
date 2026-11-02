import { useState } from "react";
import { View } from "react-native";
import DateTimePicker from "@expo/ui/community/datetime-picker";
import { Button, Caption, Field, Notice, Panel, Row } from "./ui";
import { ChipTabs, IconButton, SectionHeading } from "./pos-ui";
import {
  localToday,
  periodNames,
  ReportPeriod,
  ReportSelection,
  shiftPeriod,
  validCalendarDay,
} from "@/lib/counter";
import { day } from "@/lib/format";
import { theme } from "@/theme";

export function CalendarField({
  label,
  value,
  onChange,
  minimumYear = 2000,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumYear?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Row>
        <View style={{ flex: 1 }}>
          <Field
            label={label}
            value={value}
            onChangeText={onChange}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
        </View>
        {process.env.EXPO_OS !== "web" ? (
          <IconButton
            name="calendar-month-outline"
            label={"Chọn " + label.toLowerCase()}
            onPress={() => setOpen(true)}
          />
        ) : null}
      </Row>
      {open ? (
        <DateTimePicker
          mode="date"
          value={
            new Date(
              (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
              Number.isFinite(Date.parse(value)) &&
              Number(value.slice(0, 4)) >= minimumYear
                ? value
                : localToday()) + "T12:00:00",
            )
          }
          minimumDate={new Date(minimumYear, 0, 1)}
          maximumDate={new Date(2100, 11, 31)}
          accentColor={theme.colors.primary}
          onDismiss={() => setOpen(false)}
          onValueChange={(_, d) => {
            onChange(
              d.getFullYear() +
                "-" +
                String(d.getMonth() + 1).padStart(2, "0") +
                "-" +
                String(d.getDate()).padStart(2, "0"),
            );
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

export function ReportRangePicker({
  value,
  onChange,
}: {
  value: ReportSelection;
  onChange: (value: ReportSelection) => void;
}) {
  const [open, setOpen] = useState(false),
    [group, setGroup] = useState("DAY");
  const [from, setFrom] = useState(value.from ?? localToday()),
    [through, setThrough] = useState(value.through ?? localToday()),
    [error, setError] = useState("");
  const choose = (period: ReportPeriod, anchor = localToday()) => {
    onChange({ period, anchor });
    setOpen(false);
    setError("");
  };
  const move = (direction: number) => {
    if (value.period !== "CUSTOM") {
      onChange({
        ...value,
        anchor: shiftPeriod(value.anchor, value.period, direction),
      });
      return;
    }
    const count =
      (Date.parse(value.through!) - Date.parse(value.from!)) / 86400000 + 1;
    const shift = (date: string) =>
      new Date(Date.parse(date) + count * direction * 86400000)
        .toISOString()
        .slice(0, 10);
    const next = {
      ...value,
      from: shift(value.from!),
      through: shift(value.through!),
    };
    if (validCalendarDay(next.from) && validCalendarDay(next.through))
      onChange(next);
  };
  const presets =
    group === "DAY"
      ? [
          ["Hôm nay", "DAY", localToday()],
          ["Hôm qua", "DAY", shiftPeriod(localToday(), "DAY", -1)],
        ]
      : group === "WEEK"
        ? [
            ["7 ngày qua", "ROLLING_7", localToday()],
            ["Tuần này", "WEEK", localToday()],
            ["Tuần trước", "WEEK", shiftPeriod(localToday(), "WEEK", -1)],
          ]
        : [
            ["30 ngày qua", "ROLLING_30", localToday()],
            ["Tháng này", "MONTH", localToday()],
            ["Tháng trước", "MONTH", shiftPeriod(localToday(), "MONTH", -1)],
          ];
  return (
    <Panel>
      <SectionHeading
        title="Thời gian"
        action={open ? "Đóng" : "Tùy chỉnh"}
        onPress={() => setOpen(!open)}
      />
      <ChipTabs
        compact
        items={Object.entries(periodNames).map(([period, label]) => ({
          value: period,
          label,
        }))}
        value={value.period}
        onChange={(p) => choose(p as ReportPeriod, value.anchor)}
      />
      <Row>
        <IconButton
          name="chevron-left"
          label="Kỳ báo cáo trước"
          onPress={() => move(-1)}
        />
        <View style={{ flex: 1 }}>
          <Caption>
            {value.period === "CUSTOM"
              ? day(value.from!) + " – " + day(value.through!)
              : value.period === "ROLLING_7"
                ? "7 ngày đến " + day(value.anchor)
                : value.period === "ROLLING_30"
                  ? "30 ngày đến " + day(value.anchor)
                  : day(value.anchor)}
          </Caption>
        </View>
        <IconButton
          name="chevron-right"
          label="Kỳ báo cáo tiếp theo"
          onPress={() => move(1)}
        />
      </Row>
      <Button
        title="Về kỳ hiện tại"
        secondary
        onPress={() => choose(value.period === "CUSTOM" ? "DAY" : value.period)}
      />
      {open ? (
        <>
          <ChipTabs
            compact
            value={group}
            onChange={setGroup}
            items={[
              { value: "DAY", label: "Ngày" },
              { value: "WEEK", label: "Tuần" },
              { value: "MONTH", label: "Tháng" },
              { value: "CUSTOM", label: "Khác" },
            ]}
          />
          {group !== "CUSTOM" ? (
            presets.map(([label, period, anchor]) => (
              <Button
                key={label}
                secondary
                title={label}
                onPress={() => choose(period as ReportPeriod, anchor)}
              />
            ))
          ) : (
            <>
              <CalendarField
                label="Ngày bắt đầu"
                value={from}
                onChange={setFrom}
              />
              <CalendarField
                label="Ngày kết thúc"
                value={through}
                onChange={setThrough}
              />
              <Caption>
                Tối đa 366 ngày, tính cả ngày kết thúc. Ngày theo giờ Việt Nam.
              </Caption>
              <Notice error>{error}</Notice>
              <Button
                title="Áp dụng khoảng ngày"
                onPress={() => {
                  const days =
                    (Date.parse(through) - Date.parse(from)) / 86400000 + 1;
                  if (
                    !validCalendarDay(from) ||
                    !validCalendarDay(through) ||
                    days < 1 ||
                    days > 366
                  ) {
                    setError("Nhập khoảng ngày hợp lệ từ 1 đến 366 ngày.");
                    return;
                  }
                  onChange({ period: "CUSTOM", anchor: from, from, through });
                  setOpen(false);
                  setError("");
                }}
              />
            </>
          )}
        </>
      ) : null}
    </Panel>
  );
}
