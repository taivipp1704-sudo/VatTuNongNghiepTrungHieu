import { ComponentRef, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppText } from "@/components/text";
import { ChipTabs, Icon, IconName } from "@/components/pos-ui";
import { theme } from "@/theme";
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
  QueryState,
  Row,
  Section,
  Select,
  Toggle,
  confirmAction,
} from "@/components/ui";
import { queryClient, useApi, useCommand } from "@/lib/api";
import { can, useSession } from "@/lib/session";
import { newKey } from "@/lib/drafts";
import { day } from "@/lib/format";
import { Bootstrap, DataRow } from "@/types";

const labels: Record<string, string> = {
  "inventory.view": "Xem tồn kho",
  "inventory.receipt.create": "Tạo phiếu nhập",
  "inventory.issue.create": "Tạo phiếu xuất",
  "inventory.count.create": "Tạo kiểm kê",
  "inventory.approve": "Duyệt và ghi sổ phiếu kho",
  "inventory.cost.view": "Xem/nhập giá vốn",
  "products.manage": "Quản lý hàng hóa",
  "loyalty.manage": "Cấu hình % số chấm và quy đổi điểm",
  "loyalty.adjust": "Điều chỉnh điểm thưởng thủ công",
  "loyalty.redeem": "Đổi điểm giảm tiền khi bán hàng",
  "sales.fulfillment": "Quản lý đơn và ảnh xác nhận trong kho",
  "sales.create": "Tạo đơn bán",
  "sales.negative": "Cho phép bán âm tồn kho",
  "sales.view": "Xem đơn bán",
  "sales.price.edit": "Sửa giá bán",
  "sales.wholesale": "Bán theo bảng giá sỉ",
  "sales.discount": "Chiết khấu đơn",
  "sales.return": "Trả toàn bộ đơn và hoàn tiền",
  "partners.view": "Xem đối tác",
  "partners.manage": "Thêm đối tác",
  "partners.credit.manage": "Cấp và sửa hạn mức công nợ",
  "partners.balance.adjust": "Điều chỉnh số dư công nợ có lý do",
  "debts.view": "Xem công nợ",
  "payments.create": "Ghi nhận thu/chi công nợ",
  "invoices.view": "Xem và in chứng từ",
  "invoices.issue": "Phát hành hóa đơn điện tử",
  "reports.view": "Xem báo cáo toàn phạm vi kho",
  "reports.profit": "Xem lãi gộp",
  "reports.finance": "Xem báo cáo thu/chi đã ghi nhận",
  "users.manage": "Quản lý nhân viên",
  "roles.manage": "Quản lý vai trò và quyền",
  "audit.view": "Xem nhật ký",
  "settings.manage": "Cấu hình cửa hàng",
};
const groups = [
  {
    title: "Bán hàng & thanh toán quầy",
    icon: "cash-register",
    permissions: [
      "sales.create",
      "sales.negative",
      "sales.view",
      "invoices.view",
      "loyalty.redeem",
      "sales.discount",
      "sales.price.edit",
      "sales.wholesale",
      "sales.return",
      "sales.fulfillment",
    ],
  },
  {
    title: "Quản trị tích điểm & số chấm",
    icon: "shield-lock-outline",
    permissions: ["loyalty.manage", "loyalty.adjust"],
  },
  {
    title: "Kho hàng & nhà cung cấp",
    icon: "warehouse",
    permissions: [
      "inventory.view",
      "inventory.receipt.create",
      "inventory.issue.create",
      "inventory.count.create",
      "inventory.approve",
      "inventory.cost.view",
      "products.manage",
      "partners.view",
      "partners.manage",
      "partners.credit.manage",
      "partners.balance.adjust",
    ],
  },
  {
    title: "Báo cáo & dòng tiền",
    icon: "chart-bar",
    permissions: [
      "reports.view",
      "reports.profit",
      "reports.finance",
      "debts.view",
      "payments.create",
      "invoices.issue",
    ],
  },
  {
    title: "Quản trị cửa hàng",
    icon: "account-cog-outline",
    permissions: [
      "users.manage",
      "roles.manage",
      "audit.view",
      "settings.manage",
    ],
  },
];
const descriptions: Record<string, string> = {
  "sales.create": "Xuất kho và ghi nhận tiền theo đơn bán",
  "sales.negative": "Bán vượt tồn khi cửa hàng đã bật bán âm. Nhập hàng được ghi sổ sẽ tự bù số âm trong đúng kho.",
  "loyalty.redeem": "Khấu trừ theo số dư và giới hạn admin đã cấu hình",
  "sales.discount": "Cho phép nhập chiết khấu toàn đơn",
  "sales.price.edit": "Thay giá bán so với bảng giá hàng hóa",
  "loyalty.manage": "Quy tắc tích điểm, quy đổi và số chấm từng mặt hàng",
  "loyalty.adjust": "Cộng hoặc trừ điểm, bắt buộc có lý do và nhật ký",
  "reports.profit": "Bao gồm giá vốn và lãi gộp",
  "sales.fulfillment":
    "Xem đơn của nhân viên và thêm ảnh xác nhận trong kho được cấp. Cần kèm quyền xem đơn bán. Quyền nhận tiền và trả hàng được thiết lập riêng.",
};
export default function Admin() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState(
    params.tab === "roles" && can("roles.manage")
      ? "roles"
      : can("users.manage")
        ? "users"
        : can("roles.manage")
          ? "roles"
          : "audit",
  );
  const bootstrap = useApi<Bootstrap>("/bootstrap");
  const users = useApi<DataRow[]>("/admin/users", can("users.manage"));
  const roles = useApi<DataRow[]>(
    "/admin/roles",
    can("users.manage") || can("roles.manage"),
  );
  const audit = useApi<DataRow[]>(
    "/admin/audit",
    tab === "audit" && can("audit.view"),
  );
  const command = useCommand();
  const owner = useSession((state) => state.user?.owner);
  const currentUserId = useSession((state) => state.user?.id);
  const [editUser, setEditUser] = useState("");
  const [showForm, setShowForm] = useState(false);
  const pageScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (showForm && tab === "users")
      pageScroll.current?.scrollTo({ y: 0, animated: false });
  }, [showForm, editUser, tab]);
  const [form, setForm] = useState({
    username: "",
    name: "",
    password: "",
    active: true,
    roleIds: [] as string[],
    warehouseIds: [] as string[],
  });
  const [roleId, setRoleId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const initialRole = useRef(false);
  useEffect(() => {
    if (tab !== "roles" || initialRole.current || !roles.data?.length) return;
    initialRole.current = true;
    const role =
      roles.data.find(
        (item) => !item.protected && item.permissions.includes("sales.create"),
      ) || roles.data.find((item) => !item.protected);
    if (role) {
      setRoleId(role.id);
      setRoleName(role.name);
      setPermissions(role.permissions);
    }
  }, [tab, roles.data]);
  useEffect(() => {
    if (params.tab === "roles" && can("roles.manage")) setTab("roles");
  }, [params.tab]);
  const lockedRole =
    roles.data?.find((role) => role.id === roleId)?.protected === true;
  if (!can("users.manage") && !can("roles.manage") && !can("audit.view"))
    return <Denied />;
  const toggleArray = (items: string[], id: string) =>
    items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
  const saveUser = async () => {
    const editingSelf = Boolean(editUser && editUser === currentUserId);
    if (
      !(await confirmAction(
        editUser ? "Cập nhật nhân viên" : "Tạo tài khoản nội bộ",
        editUser
          ? editingSelf
            ? "Bạn đang sửa tài khoản đang đăng nhập. Lưu xong sẽ đăng xuất; đăng nhập lại bằng quyền mới hoặc nhờ chủ cửa hàng mở lại nếu bạn khóa tài khoản."
            : "Các phiên đăng nhập của nhân viên sẽ bị thu hồi."
          : "Nhân viên cần đổi mật khẩu ở lần đăng nhập đầu.",
      ))
    )
      return;
    const body = editUser
      ? {
          active: form.active,
          roleIds: form.roleIds,
          warehouseIds: form.warehouseIds,
        }
      : {
          username: form.username,
          name: form.name,
          password: form.password,
          roleIds: form.roleIds,
          warehouseIds: form.warehouseIds,
        };
    const result = await command.run(
      editUser ? "/admin/users/" + editUser : "/admin/users",
      body,
      editUser ? "PATCH" : "POST",
    );
    if (result) {
      if (editingSelf) {
        await useSession.getState().logout();
        queryClient.clear();
        useSession.setState({
          message:
            "Đã lưu tài khoản. Đăng nhập lại để sử dụng quyền mới; tài khoản bị khóa cần chủ cửa hàng mở lại.",
        });
        return;
      }
      setShowForm(false);
      setForm({
        username: "",
        name: "",
        password: "",
        active: true,
        roleIds: [],
        warehouseIds: [],
      });
      setNotice("Đã lưu tài khoản và phạm vi kho.");
    }
  };
  const selectRole = (id: string) => {
    setRoleId(id);
    const role = roles.data?.find((item) => item.id === id);
    setRoleName(role?.name || "");
    setPermissions(
      role?.protected
        ? bootstrap.data?.permissions || []
        : role?.permissions || [],
    );
  };
  const saveRole = async () => {
    if (
      !(await confirmAction(
        "Lưu quyền truy cập",
        roleName +
          " · " +
          permissions.length +
          " quyền. Quyền mới được kiểm tra tại mọi yêu cầu tiếp theo.",
      ))
    )
      return;
    const result = await command.run("/admin/roles", {
      ...(roleId ? { id: roleId } : {}),
      name: roleName,
      permissions,
    });
    if (result) {
      setNotice("Đã lưu role. Nhật ký thay đổi được ghi nhận.");
      selectRole("");
    }
  };
  return (
    <Page scrollRef={pageScroll}>
      <Select
        label="Khu vực quản trị"
        value={tab}
        onChange={setTab}
        options={[
          ...(can("users.manage")
            ? [{ value: "users", label: "Nhân viên" }]
            : []),
          ...(can("roles.manage")
            ? [{ value: "roles", label: "Vai trò & phân quyền" }]
            : []),
          ...(can("audit.view")
            ? [{ value: "audit", label: "Nhật ký hoạt động" }]
            : []),
        ]}
      />
      <Notice>{notice}</Notice>
      <Notice error>{command.error}</Notice>
      {tab === "users" && can("users.manage") ? (
        <>
          <Button
            title={showForm ? "Đóng biểu mẫu" : "Tạo nhân viên"}
            onPress={() => {
              setEditUser("");
              setForm({
                username: "",
                name: "",
                password: newKey(),
                active: true,
                roleIds: [],
                warehouseIds: [],
              });
              setShowForm(!showForm);
            }}
          />
          {showForm ? (
            <Panel testID="employee-editor">
              <Section
                title={editUser ? "Sửa quyền nhân viên" : "Nhân viên mới"}
              >
                {editUser ? (
                  <Caption>
                    Đang sửa: {form.name} · {form.username}
                  </Caption>
                ) : null}
                {!editUser ? (
                  <>
                    <Field
                      label="Tên đăng nhập"
                      value={form.username}
                      onChangeText={(username) =>
                        setForm({ ...form, username })
                      }
                      autoCapitalize="none"
                    />
                    <Field
                      label="Họ và tên"
                      value={form.name}
                      onChangeText={(name) => setForm({ ...form, name })}
                    />
                    <Field
                      label="Mật khẩu khởi tạo (ít nhất 12 ký tự)"
                      secureTextEntry
                      value={form.password}
                      onChangeText={(password) =>
                        setForm({ ...form, password })
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Caption>
                      Chuyển mật khẩu cho đúng nhân viên qua kênh riêng.
                    </Caption>
                  </>
                ) : (
                  <Toggle
                    label="Tài khoản đang hoạt động"
                    value={form.active}
                    onChange={(active) => setForm({ ...form, active })}
                  />
                )}
                <Caption>
                  Có thể gán nhiều vai trò hoặc bỏ chọn tất cả. Không có vai trò
                  thì nhân viên chưa có quyền chức năng.
                </Caption>
                {roles.data
                  ?.filter((role) => !role.protected)
                  .map((role) => (
                    <Toggle
                      key={role.id}
                      label={role.name}
                      value={form.roleIds.includes(role.id)}
                      onChange={() =>
                        setForm({
                          ...form,
                          roleIds: toggleArray(form.roleIds, role.id),
                        })
                      }
                    />
                  ))}
                <Label>Kho được phép thao tác</Label>
                <Caption>
                  Có thể bỏ chọn tất cả kho và vẫn lưu. Nhân viên chưa được gán
                  kho sẽ không thể thao tác dữ liệu kho.
                </Caption>
                {bootstrap.data?.warehouses.map((warehouse) => (
                  <Toggle
                    key={warehouse.id}
                    label={warehouse.name}
                    value={form.warehouseIds.includes(warehouse.id)}
                    onChange={() =>
                      setForm({
                        ...form,
                        warehouseIds: toggleArray(
                          form.warehouseIds,
                          warehouse.id,
                        ),
                      })
                    }
                  />
                ))}
                <Button
                  title="Lưu tài khoản"
                  testID="employee-save"
                  onPress={saveUser}
                  pending={command.pending}
                  disabled={
                    !editUser &&
                    (!form.username || !form.name || form.password.length < 12)
                  }
                />
              </Section>
            </Panel>
          ) : null}
          {!showForm ? (
            <QueryState query={users}>
              {users.data?.map((user) => (
                <Panel key={user.id}>
                  <Row>
                    <Label big>{user.name}</Label>
                    <Badge
                      label={
                        user.owner
                          ? "Chủ cửa hàng"
                          : user.active
                            ? "Hoạt động"
                            : "Đã khóa"
                      }
                      tone={user.active ? "neutral" : "danger"}
                    />
                  </Row>
                  <Caption>
                    {user.username} ·{" "}
                    {user.role_ids
                      .map(
                        (id: string) =>
                          roles.data?.find((role) => role.id === id)?.name,
                      )
                      .filter(Boolean)
                      .join(" · ") || "Chưa gán vai trò"}
                  </Caption>
                  <Caption>
                    {user.warehouse_ids
                      .map(
                        (id: string) =>
                          bootstrap.data?.warehouses.find(
                            (item) => item.id === id,
                          )?.name,
                      )
                      .filter(Boolean)
                      .join(" · ") || "Chưa gán kho"}
                  </Caption>
                  {!user.owner ? (
                    <>
                      <Button
                        title="Sửa quyền / khóa tài khoản"
                        testID={"employee-edit-" + user.id}
                        secondary
                        disabled={command.pending}
                        onPress={() => {
                          setEditUser(user.id);
                          setForm({
                            username: user.username,
                            name: user.name,
                            password: "",
                            active: user.active,
                            roleIds: user.role_ids,
                            warehouseIds: user.warehouse_ids,
                          });
                          setShowForm(true);
                          pageScroll.current?.scrollTo({
                            y: 0,
                            animated: false,
                          });
                        }}
                      />
                      {owner ? (
                        <Button
                          title="Đặt lại mật khẩu"
                          secondary
                          onPress={async () => {
                            if (
                              !(await confirmAction(
                                "Đặt lại mật khẩu " + user.name,
                                "Thu hồi mọi phiên đăng nhập. Mật khẩu tạm sẽ hiển thị một lần.",
                              ))
                            )
                              return;
                            const result = await command.run<DataRow>(
                              "/admin/users/" + user.id + "/reset-password",
                              {},
                            );
                            if (result)
                              setNotice(
                                "Mật khẩu tạm cho " +
                                  user.username +
                                  ": " +
                                  result.temporaryPassword,
                              );
                          }}
                          pending={command.pending}
                        />
                      ) : null}
                    </>
                  ) : null}
                </Panel>
              ))}
            </QueryState>
          ) : null}
        </>
      ) : null}
      {tab === "roles" && can("roles.manage") ? (
        <>
          <Row>
            <Label big>Phân quyền & vai trò</Label>
            <Badge label="Admin thiết lập" />
          </Row>
          <Caption>
            Chọn nhóm vai trò để cấu hình · Quyền được kiểm tra tại máy chủ
          </Caption>
          <QueryState query={roles}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
            >
              {roles.data?.map((role) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={"Chọn vai trò " + role.name}
                  key={role.id}
                  onPress={() => selectRole(role.id)}
                  style={{
                    width: 126,
                    minHeight: 104,
                    padding: 12,
                    borderRadius: 14,
                    gap: 6,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      roleId === role.id
                        ? theme.colors.primary
                        : theme.colors.paper,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                >
                  <Icon
                    name={
                      role.protected
                        ? "shield-account-outline"
                        : role.permissions.includes("sales.create")
                          ? "cash-register"
                          : "account-group-outline"
                    }
                    color={
                      roleId === role.id
                        ? theme.colors.onPrimary
                        : theme.colors.primary
                    }
                  />
                  <AppText
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      textAlign: "center",
                      lineHeight: 19,
                      color:
                        roleId === role.id
                          ? theme.colors.onPrimary
                          : theme.colors.text,
                    }}
                  >
                    {role.name}
                  </AppText>
                  <AppText
                    style={{
                      fontSize: 10,
                      lineHeight: 16,
                      color:
                        roleId === role.id
                          ? theme.colors.onPrimary
                          : theme.colors.muted,
                    }}
                  >
                    {users.data
                      ? users.data.filter((user) =>
                          user.role_ids.includes(role.id),
                        ).length + " nhân sự"
                      : role.protected
                        ? "Toàn quyền"
                        : "Nhóm quyền"}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </QueryState>
          <Button
            title="Tạo vai trò mới"
            secondary
            onPress={() => selectRole("")}
          />
          <Panel>
            <Field
              label="Tên vai trò"
              value={roleName}
              onChangeText={setRoleName}
              editable={!lockedRole && !command.pending}
            />
            <Badge
              label={
                lockedRole
                  ? "Chủ cửa hàng được bảo vệ"
                  : roleId
                    ? "Đang sửa vai trò"
                    : "Tạo vai trò mới"
              }
              tone={lockedRole ? "warning" : "neutral"}
            />
          </Panel>
          {groups.map((group) => (
            <View key={group.title} style={{ gap: 10 }}>
              <Row>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "center",
                    flex: 1,
                  }}
                >
                  <Icon name={group.icon as IconName} size={20} />
                  <AppText style={{ fontSize: 14, fontWeight: "700", flex: 1 }}>
                    {group.title}
                  </AppText>
                </View>
                <Caption>
                  {
                    group.permissions.filter((permission) =>
                      permissions.includes(permission),
                    ).length
                  }
                  /{group.permissions.length} quyền
                </Caption>
              </Row>
              <Panel>
                {group.title === "Quản trị tích điểm & số chấm" ? (
                  <Notice>
                    Chỉ cấp các quyền này cho người quản trị. Nhân viên bán hàng
                    thông thường chỉ cần quyền đổi điểm.
                  </Notice>
                ) : null}
                {group.permissions
                  .filter((permission) =>
                    bootstrap.data?.permissions.includes(permission),
                  )
                  .map((permission) => (
                    <View
                      key={permission}
                      style={{
                        paddingBottom: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border,
                      }}
                    >
                      <Toggle
                        label={labels[permission] || permission}
                        value={permissions.includes(permission)}
                        onChange={() =>
                          setPermissions(toggleArray(permissions, permission))
                        }
                        disabled={
                          lockedRole ||
                          command.pending ||
                          (!owner && !can(permission))
                        }
                      />
                      {descriptions[permission] ? (
                        <Caption>{descriptions[permission]}</Caption>
                      ) : null}
                    </View>
                  ))}
              </Panel>
            </View>
          ))}
          <Notice error>{command.error}</Notice>
          <Button
            title="Lưu phân quyền vai trò"
            onPress={saveRole}
            pending={command.pending}
            disabled={lockedRole || !roleName.trim()}
          />
          {can("users.manage") ? (
            <Button
              title="Thêm nhân viên vào nhóm"
              secondary
              onPress={() => {
                setTab("users");
                setEditUser("");
                setForm({
                  username: "",
                  name: "",
                  password: "",
                  active: true,
                  roleIds: roleId && !lockedRole ? [roleId] : [],
                  warehouseIds: bootstrap.data?.warehouses[0]
                    ? [bootstrap.data.warehouses[0].id]
                    : [],
                });
                setShowForm(true);
              }}
            />
          ) : null}
        </>
      ) : null}
      {tab === "audit" ? (
        <QueryState query={audit}>
          {audit.data?.map((entry) => (
            <Panel key={entry.id}>
              <Label>{entry.action}</Label>
              <Caption>
                {entry.actor || "Đăng nhập chưa xác thực"} ·{" "}
                {day(entry.created_at)}
              </Caption>
              <Caption>{entry.entity_id || "Hoạt động hệ thống"}</Caption>
            </Panel>
          ))}
        </QueryState>
      ) : null}
    </Page>
  );
}
