import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  Button,
  Caption,
  Field,
  Label,
  LinkRow,
  Notice,
  Page,
  Panel,
  Section,
  Toggle,
  confirmAction,
} from "@/components/ui";
import { api, queryClient, useApi, useCommand } from "@/lib/api";
import { can, useSession, userKey } from "@/lib/session";
import { localGet, localSet } from "@/lib/cache";
import { Bootstrap, Warehouse } from "@/types";

export function More() {
  const session = useSession();
  const links = [
    {
      permission: "inventory.view",
      title: "Công việc cần xử lý",
      description: "Phiếu chờ duyệt, lô cận hạn và công nợ",
      route: "/notifications" as const,
    },
    {
      permission: "loyalty.manage",
      title: "Tích điểm khách hàng",
      description: "Số chấm mặt hàng, quy đổi và sử dụng điểm",
      route: "/loyalty" as const,
    },
    {
      permission: "inventory.view",
      title: "Kho hàng",
      description: "Tồn, số lô, hạn sử dụng",
      route: "/inventory" as const,
    },
    {
      permission: "inventory.view",
      title: "Phiếu kho & kiểm kê",
      description: "Nhập, xuất, duyệt và lịch sử",
      route: "/documents" as const,
    },
    {
      permission: "sales.view",
      title: "Đơn bán",
      description: "Theo dõi thu tiền và trả hàng",
      route: "/orders" as const,
    },
    {
      permission: "invoices.view",
      title: "Chứng từ bán hàng",
      description: "In và chia sẻ phiếu PDF",
      route: "/invoices" as const,
    },
    {
      permission: "partners.view",
      title: "Khách hàng & nhà cung cấp",
      description: "Hồ sơ và hạn mức nợ",
      route: "/partners" as const,
    },
    {
      permission: "debts.view",
      title: "Công nợ",
      description: "Phải thu, phải trả và lịch sử",
      route: "/debts" as const,
    },
    {
      permission: "reports.view",
      title: "Báo cáo",
      description: "Doanh số và mặt hàng bán chạy",
      route: "/reports" as const,
    },
    {
      permission: "users.manage",
      title: "Quản trị nội bộ",
      description: "Nhân viên, phân quyền và nhật ký",
      route: "/admin" as const,
    },
  ];
  return (
    <Page>
      <Panel>
        <Label big>{session.user?.name}</Label>
        <Caption>
          {session.user?.username} ·{" "}
          {session.user?.roles.map((role) => role.name).join(" · ")}
        </Caption>
      </Panel>
      <Panel>
        {links
          .filter(
            (link) =>
              can(link.permission) ||
              (link.route === "/admin" &&
                (can("roles.manage") || can("audit.view"))),
          )
          .map((link) => (
            <LinkRow
              key={link.route}
              title={link.title}
              description={link.description}
              onPress={() => router.push(link.route)}
            />
          ))}
        <LinkRow
          title="Kết nối & thiết bị"
          description="In Android, PDF, vận chuyển và kênh bán"
          onPress={() => router.push("/connections")}
        />
        <LinkRow
          title="Cửa hàng & bảo mật"
          description="Thông tin cửa hàng, mật khẩu và nhắc việc"
          onPress={() => router.push("/settings")}
        />
      </Panel>
      <Button
        title="Đăng xuất"
        secondary
        onPress={async () => {
          if (
            await confirmAction(
              "Đăng xuất",
              "Bản nháp vẫn được giữ cho tài khoản này trên thiết bị.",
            )
          ) {
            await session.logout();
            queryClient.clear();
            router.replace("/login");
          }
        }}
      />
    </Page>
  );
}

export function Settings() {
  const bootstrap = useApi<Bootstrap>("/bootstrap");
  const command = useCommand();
  const [store, setStore] = useState({ name: "", address: "", phone: "" });
  const [notifications, setNotifications] = useState(false);
  const [notice, setNotice] = useState("");
  const session = useSession();
  useEffect(() => {
    if (bootstrap.data) setStore(bootstrap.data.store);
  }, [bootstrap.data]);
  useEffect(() => {
    localGet<boolean>(userKey("reminder"))
      .then((value) => setNotifications(value || false))
      .catch(() =>
        setNotice("Không đọc được cài đặt nhắc việc trên thiết bị."),
      );
  }, []);
  const toggleReminder = async (value: boolean) => {
    if (process.env.EXPO_OS === "web") {
      setNotice("Bật nhắc việc trên ứng dụng Android hoặc iOS.");
      return;
    }
    try {
      const Notifications = await import("expo-notifications");
      const identifier = "agristock-daily-" + session.user?.id;
      if (value) {
        if (process.env.EXPO_OS === "android")
          await Notifications.setNotificationChannelAsync("agristock", {
            name: "Nhắc việc cửa hàng",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        const permission = await Notifications.requestPermissionsAsync();
        if (permission.status !== "granted") {
          setNotice(
            "Chưa được cấp quyền thông báo. Bạn có thể cấp quyền trong cài đặt điện thoại.",
          );
          return;
        }
        await Notifications.cancelScheduledNotificationAsync(identifier);
        await Notifications.scheduleNotificationAsync({
          identifier,
          content: {
            title: "AgriStock · Bắt đầu ngày làm việc",
            body: "Mở ứng dụng để kiểm tra lô cận hạn, phiếu chờ duyệt và công nợ.",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 9,
            minute: 0,
            channelId: "agristock",
          },
        });
      } else await Notifications.cancelScheduledNotificationAsync(identifier);
      await localSet(userKey("reminder"), value);
      setNotifications(value);
      setNotice(
        value
          ? "Đã bật nhắc việc hằng ngày lúc 09:00 theo giờ thiết bị."
          : "Đã tắt nhắc việc.",
      );
    } catch {
      setNotice(
        "Không cập nhật được nhắc việc. Kiểm tra quyền thông báo trên thiết bị.",
      );
    }
  };
  return (
    <Page>
      <Section title="Thông tin cửa hàng">
        <Panel>
          <Field
            label="Tên cửa hàng"
            value={store.name}
            onChangeText={(name) => setStore({ ...store, name })}
            editable={can("settings.manage")}
          />
          <Field
            label="Địa chỉ"
            value={store.address}
            onChangeText={(address) => setStore({ ...store, address })}
            editable={can("settings.manage")}
          />
          <Field
            label="Số điện thoại"
            value={store.phone}
            onChangeText={(phone) => setStore({ ...store, phone })}
            editable={can("settings.manage")}
          />
          {can("settings.manage") ? (
            <Button
              title="Lưu thông tin cửa hàng"
              onPress={async () => {
                if (
                  await confirmAction(
                    "Lưu thông tin cửa hàng",
                    "Thông tin này sẽ xuất hiện trên phiếu bán nội bộ.",
                  )
                ) {
                  const result = await command.run("/settings/store", store);
                  if (result) setNotice("Đã lưu thông tin cửa hàng.");
                }
              }}
              pending={command.pending}
            />
          ) : null}
        </Panel>
      </Section>
      {can("settings.manage") ? (
        <WarehouseAdmin warehouses={bootstrap.data?.warehouses || []} />
      ) : null}
      <Section title="Bảo mật & kết nối">
        <Panel>
          <LinkRow
            title="Đổi mật khẩu"
            description="Đăng xuất các thiết bị khác sau khi đổi"
            onPress={() => router.push("/change-password")}
          />
          <Toggle
            label="Nhắc kiểm tra cửa hàng lúc 09:00"
            value={notifications}
            onChange={toggleReminder}
          />
          <Caption>Máy chủ: {session.apiUrl}</Caption>
          <Button
            title="Kiểm tra kết nối"
            secondary
            onPress={() =>
              api("/me")
                .then(() => setNotice("Kết nối máy chủ đang hoạt động."))
                .catch((error) => setNotice(error.message))
            }
          />
        </Panel>
      </Section>
      <Panel>
        <Label>Máy in & hóa đơn điện tử</Label>
        <Caption>
          Phiếu bán dùng PDF/chia sẻ hoặc dịch vụ in của điện thoại. Máy in
          Bluetooth và nhà cung cấp hóa đơn điện tử chưa được cấu hình.
        </Caption>
      </Panel>
      <Notice>{notice}</Notice>
      <Notice error>{command.error}</Notice>
    </Page>
  );
}

function WarehouseAdmin({ warehouses }: { warehouses: Warehouse[] }) {
  const [edit, setEdit] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const command = useCommand();
  const save = async () => {
    if (!name.trim()) {
      command.setError("Nhập tên kho.");
      return;
    }
    if (!(await confirmAction(edit ? "Đổi thông tin kho" : "Tạo kho", name)))
      return;
    const result = await command.run(
      edit ? "/warehouses/" + edit : "/warehouses",
      { name: name.trim(), address: address.trim() },
      edit ? "PATCH" : "POST",
    );
    if (result) {
      setOpen(false);
      setName("");
      setAddress("");
      setEdit("");
      setMessage(
        "Đã lưu kho. Chủ cửa hàng cấp phạm vi kho cho nhân viên trong Quản trị nội bộ.",
      );
    }
  };
  return (
    <Section title="Quản lý kho">
      <Panel>
        {warehouses.map((warehouse) => (
          <LinkRow
            key={warehouse.id}
            title={warehouse.name}
            description={warehouse.address || "Chưa có địa chỉ"}
            onPress={() => {
              setEdit(warehouse.id);
              setName(warehouse.name);
              setAddress(warehouse.address);
              setOpen(true);
            }}
          />
        ))}
        <Button
          title="Thêm kho"
          secondary
          onPress={() => {
            setEdit("");
            setName("");
            setAddress("");
            setOpen(true);
          }}
        />
        {open ? (
          <>
            <Field label="Tên kho" value={name} onChangeText={setName} />
            <Field
              label="Địa chỉ kho"
              value={address}
              onChangeText={setAddress}
            />
            <Notice error>{command.error}</Notice>
            <Button
              title={edit ? "Lưu thông tin kho" : "Tạo kho mới"}
              onPress={save}
              pending={command.pending}
            />
            <Button
              title="Đóng chỉnh kho"
              secondary
              onPress={() => setOpen(false)}
            />
          </>
        ) : null}
        <Notice>{message}</Notice>
        <Caption>
          Không xóa kho có lịch sử giao dịch. Tồn và chứng từ tiếp tục gắn với
          mã kho cũ khi đổi tên.
        </Caption>
      </Panel>
    </Section>
  );
}
