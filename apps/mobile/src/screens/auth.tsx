import { ComponentRef, useRef, useState } from "react";
import { router } from "expo-router";
import { TextInput, View } from "react-native";
import { Image } from "expo-image";
import { AppText as Text } from "@/components/text";
import {
  Button,
  Caption,
  Field,
  Notice,
  Panel,
  Section,
} from "@/components/ui";
import { isLanTestBuild, isOperationalBuild, useSession } from "@/lib/session";
import { useCommand } from "@/lib/api";
import { SessionUser } from "@/types";
import { theme } from "@/theme";
import { AuthPage } from "@/components/auth-page";

export function Login() {
  const session = useSession();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const login = async () => {
    if (pending || !username.trim() || !password || !session.apiUrl) return;
    setPending(true);
    setError("");
    try {
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
    <AuthPage>
      <View style={{ gap: 8, paddingTop: 8, paddingBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image source={require("../../assets/images/htagri-logo.png")} accessible accessibilityLabel="Logo HTAgri" contentFit="contain" style={{ width: 56, height: 56 }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: theme.colors.primary, fontSize: 27, lineHeight: 36, fontWeight: "700" }}>{isLanTestBuild ? "HTAgri Test" : "HTAgri"}</Text>
            <Caption>Quản lý cửa hàng</Caption>
          </View>
        </View>
        <Caption>Đăng nhập để quản lý kho, bán hàng và công nợ.</Caption>
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
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Field
            label="Mật khẩu"
            focusRef={passwordRef}
            returnKeyType="go"
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
            disabled={!username.trim() || !password || !session.apiUrl}
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
      <Notice error>{session.message}</Notice>
      <Caption>
        {isLanTestBuild
          ? "Bản kiểm thử qua Wi-Fi. Máy tính chạy máy chủ cần được bật và cùng mạng với điện thoại."
          : isOperationalBuild
            ? "Chỉ sử dụng tài khoản được cửa hàng cấp."
            : "Chỉ sử dụng tài khoản được cửa hàng cấp. Dữ liệu được cập nhật từ thao tác thực tế tại cửa hàng."}
      </Caption>
    </AuthPage>
  );
}

export function ChangePassword() {
  const nextRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const command = useCommand();
  const user = useSession((state) => state.user);
  const save = async () => {
    if (command.pending || !current || !next || !confirm) return;
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
    <AuthPage headerShown>
      <Notice>
        {user?.mustChangePassword
          ? "Bạn cần đổi mật khẩu khởi tạo trước khi sử dụng."
          : "Đổi mật khẩu sẽ đăng xuất các thiết bị khác."}
      </Notice>
      <Panel>
        <Field
          label="Mật khẩu hiện tại"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => nextRef.current?.focus()}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
        />
        <Field
          label="Mật khẩu mới (ít nhất 12 ký tự)"
          focusRef={nextRef}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
          value={next}
          onChangeText={setNext}
          secureTextEntry
        />
        <Field
          label="Nhập lại mật khẩu mới"
          focusRef={confirmRef}
          returnKeyType="done"
          onSubmitEditing={save}
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
    </AuthPage>
  );
}
