import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { Image } from "expo-image";
import { AppText as Text } from "@/components/text";
import {
  Button,
  Caption,
  Field,
  Notice,
  Page,
  Panel,
  Section,
} from "@/components/ui";
import { isLanTestBuild, isOperationalBuild, useSession } from "@/lib/session";
import { useCommand } from "@/lib/api";
import { SessionUser } from "@/types";
import { theme } from "@/theme";

export function Login() {
  const session = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState(session.apiUrl);
  const [showServer, setShowServer] = useState(!session.apiUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const login = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      if (server !== session.apiUrl) await session.configure(server);
      await session.login(username.trim(), password);
      setPassword("");
      router.replace(
        useSession.getState().user?.mustChangePassword
          ? "/change-password"
          : "/",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể đăng nhập.");
    } finally {
      setPending(false);
    }
  };
  return (
    <Page>
      <View
        style={{
          paddingTop: theme.space.huge,
          gap: theme.space.md,
          paddingBottom: theme.space.xl,
        }}
      >
        <Image source={require("../../assets/images/htagri-logo.png")} accessible accessibilityLabel="Logo HTAgri" contentFit="contain" style={{ width: 96, height: 96 }} />
        <View
          style={{
            backgroundColor: theme.colors.soft,
            borderRadius: theme.radius.lg,
            padding: theme.space.lg,
            alignSelf: "flex-start",
          }}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontWeight: "700",
              fontSize: theme.type.title,
            }}
          >
            {isLanTestBuild ? "HTAgri Test" : "HTAgri"}
          </Text>
        </View>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.type.display,
            fontWeight: "600",
          }}
        >
          Một cửa hàng.{"\n"}Cùng một nhịp làm việc.
        </Text>
        <Caption>
          Kho hàng, bán hàng và công nợ trong một ứng dụng nội bộ.
        </Caption>
      </View>
      <Panel>
        <Section title="Đăng nhập">
          <Field
            label="Tên đăng nhập"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
          />
          <Field
            label="Mật khẩu"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            onSubmitEditing={login}
          />
          <Notice error>{error}</Notice>
          <Button
            title="Đăng nhập"
            testID="login-submit"
            onPress={login}
            pending={pending}
            disabled={!username.trim() || !password || !server.trim()}
          />
          <Button
            title="Quên mật khẩu?"
            secondary
            onPress={() => setHelp(!help)}
          />
          {help ? (
            <Notice>
              Liên hệ chủ cửa hàng để đặt lại mật khẩu. Tài khoản nhân viên do
              Admin cấp, không đăng ký công khai.
            </Notice>
          ) : null}
        </Section>
      </Panel>
      <Button
        title={showServer ? "Ẩn cấu hình kết nối" : "Cấu hình kết nối cửa hàng"}
        secondary
        onPress={() => setShowServer(!showServer)}
      />
      {showServer ? (
        <Field
          label="Địa chỉ máy chủ"
          value={server}
          onChangeText={setServer}
          autoCapitalize="none"
          keyboardType="url"
          placeholder={
            isLanTestBuild
              ? "http://192.168.1.63:3001"
              : "https://api.cuahang.vn"
          }
        />
      ) : null}
      <Notice error>{session.message}</Notice>
      <Caption>
        {isLanTestBuild
          ? "Bản kiểm thử qua Wi-Fi. Máy tính chạy máy chủ cần được bật và cùng mạng với điện thoại."
          : isOperationalBuild
            ? "Chỉ sử dụng tài khoản được cửa hàng cấp."
            : "Chỉ sử dụng tài khoản được cửa hàng cấp. Dữ liệu được cập nhật từ thao tác thực tế tại cửa hàng."}
      </Caption>
    </Page>
  );
}

export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const command = useCommand();
  const user = useSession((state) => state.user);
  const save = async () => {
    if (next.length < 12 || next !== confirm) {
      command.setError(
        "Mật khẩu mới cần ít nhất 12 ký tự và nhập lại phải khớp.",
      );
      return;
    }
    const result = await command.run<SessionUser>("/auth/password", {
      currentPassword: current,
      newPassword: next,
    });
    if (result) {
      useSession.getState().setUser(result);
      router.replace("/");
    }
  };
  return (
    <Page>
      <Notice>
        {user?.mustChangePassword
          ? "Bạn cần đổi mật khẩu khởi tạo trước khi sử dụng."
          : "Đổi mật khẩu sẽ đăng xuất các thiết bị khác."}
      </Notice>
      <Panel>
        <Field
          label="Mật khẩu hiện tại"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
        />
        <Field
          label="Mật khẩu mới (ít nhất 12 ký tự)"
          value={next}
          onChangeText={setNext}
          secureTextEntry
        />
        <Field
          label="Nhập lại mật khẩu mới"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
        <Notice error>{command.error}</Notice>
        <Button
          title="Lưu mật khẩu mới"
          onPress={save}
          pending={command.pending}
          disabled={!current || !next || !confirm}
        />
      </Panel>
      <Button
        title="Đăng xuất"
        secondary
        onPress={() => useSession.getState().logout()}
      />
    </Page>
  );
}
