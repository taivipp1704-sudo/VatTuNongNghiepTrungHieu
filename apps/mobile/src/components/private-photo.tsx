import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { api } from "@/lib/api";
import { useSession, userKey } from "@/lib/session";
import { Caption, Button } from "./ui";

export function PhotoImage({ uri, label, width, height, contain = false, onError }: {
  uri: string; label: string; width: number | `${number}%`; height: number; contain?: boolean; onError?: () => void;
}) {
  const privatePath = /^\/api\/photos\/[0-9a-f-]{36}$/.test(uri);
  const token = useSession(state => state.token);
  const user = useSession(state => state.user);
  const query = useQuery({
    queryKey: [userKey("photo"), uri, user?.permissions.join(","), user?.warehouseIds.join(",")],
    enabled: privatePath && Boolean(token),
    queryFn: () => api<{ dataUrl: string }>(uri.slice(4)),
    staleTime: 0,
    gcTime: 60000,
    retry: 1,
  });
  if (privatePath && !query.data) return <View style={{ width, minHeight: height, justifyContent: "center" }}>
    <Caption>{query.isError ? "Chưa tải được ảnh." : "Đang tải ảnh…"}</Caption>
    {query.isError ? <Button title="Tải lại ảnh" secondary onPress={() => void query.refetch()} /> : null}
  </View>;
  return <Image source={{ uri: privatePath ? query.data!.dataUrl : uri }} accessibilityLabel={label}
    style={{ width, height }} contentFit={contain ? "contain" : "cover"} cachePolicy={privatePath ? "none" : "memory-disk"} onError={onError} />;
}
