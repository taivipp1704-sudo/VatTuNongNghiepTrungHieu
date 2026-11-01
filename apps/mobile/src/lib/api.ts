import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useRef, useState } from "react";
import { localGet, localSet } from "./cache";
import { useSession, userKey } from "./session";
import { useWarehouse } from "./warehouse";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<Result>(
  path: string,
  options: {
    body?: unknown;
    method?: string;
    key?: string;
    signal?: AbortSignal;
  } = {},
): Promise<Result> {
  const { apiUrl, token } = useSession.getState();
  let response: Response;
  try {
    response = await fetch(apiUrl + "/api" + path, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal ?? AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    useSession.getState().setOffline(true);
    throw new ApiError(
      "Chưa nhận được xác nhận từ máy chủ. Giữ nguyên nội dung và thử lại để tránh tạo trùng.",
      0,
    );
  }
  useSession.getState().setOffline(false);
  const result = await response
    .json()
    .catch(() => ({ message: "Máy chủ trả về dữ liệu không hợp lệ." }));
  if (response.status === 401) {
    await useSession.getState().logout();
    queryClient.clear();
    throw new ApiError(
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      401,
    );
  }
  if (!response.ok)
    throw new ApiError(
      result.message || "Không thể hoàn tất thao tác.",
      response.status,
    );
  return result as Result;
}

function cacheSafe(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (key, item) =>
      /^(cost_base|costBase|profit|grossProfit|margin)$/.test(key)
        ? undefined
        : item,
    ),
  );
}

export function useApi<Result>(path: string, enabled = true) {
  const warehouseId = useWarehouse((state) => state.warehouseId);
  const scopeReady = useWarehouse((state) => state.ready);
  const scopeNamespace = useWarehouse((state) => state.namespace);
  const scoped =
    [
      "/inventory",
      "/dashboard",
      "/orders",
      "/documents",
      "/debts",
      "/reports",
      "/partners",
      "/invoices",
    ].includes(path.split("?")[0]) ||
    path.startsWith("/loyalty/customers/") ||
    (path.startsWith("/partners/") && path.includes("/purchases")) ||
    path === "/loyalty/ledger";
  if (scoped && warehouseId && !/[?&]warehouseId=/.test(path))
    path += (path.includes("?") ? "&" : "?") + "warehouseId=" + warehouseId;
  const user = useSession((state) => state.user);
  const namespace = userKey("cache:");
  return useQuery<Result>({
    queryKey: [namespace, path, user?.permissions.join(",")],
    enabled:
      Boolean(user) &&
      enabled &&
      (!scoped ||
        (scopeReady && scopeNamespace === userKey("active-warehouse"))),
    queryFn: async ({ signal }) => {
      try {
        const data = await api<Result>(path, { signal });
        if (!path.startsWith("/admin"))
          await localSet(namespace + path, cacheSafe(data)).catch(() => {});
        return data;
      } catch (error) {
        if (error instanceof ApiError && error.status === 0) {
          const cached = await localGet<Result>(namespace + path);
          if (cached !== null) return cached;
        }
        throw error;
      }
    },
  });
}

export function useCommand() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const errorStatus = useRef<number | undefined>(undefined);
  const requestKey = useRef<string | null>(null);
  const busy = useRef(false);
  const queries = useQueryClient();
  const run = async <Result>(
    path: string,
    body?: unknown,
    method = "POST",
    stableKey?: string,
  ): Promise<Result | undefined> => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    errorStatus.current = undefined;
    requestKey.current = stableKey ?? requestKey.current ?? Crypto.randomUUID();
    try {
      const result = await api<Result>(path, {
        body,
        method,
        key: requestKey.current,
      });
      requestKey.current = null;
      await queries.invalidateQueries();
      return result;
    } catch (error) {
      errorStatus.current =
        error instanceof ApiError ? error.status : undefined;
      setError(
        error instanceof Error ? error.message : "Không thể lưu dữ liệu.",
      );
      return;
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return { run, pending, error, setError, errorStatus };
}
