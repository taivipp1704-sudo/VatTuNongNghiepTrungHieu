import { useEffect, useRef, type SetStateAction } from "react";
import { create } from "zustand";
import * as Crypto from "expo-crypto";
import { localGet, localSet } from "./cache";
import { userKey } from "./session";

type Entry = {
  value: unknown;
  ready: boolean;
  saved: boolean;
  storageError: string;
  revision: number;
};
const useDrafts = create<{ entries: Record<string, Entry> }>(() => ({
  entries: {},
}));
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const writes = new Map<string, Promise<boolean>>();
const read = (key: string) => useDrafts.getState().entries[key];
function patch(key: string, change: Partial<Entry>) {
  useDrafts.setState(({ entries }) => ({
    entries: { ...entries, [key]: { ...entries[key], ...change } },
  }));
}
function saveKey(key: string): Promise<boolean> {
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);
  const snapshot = read(key);
  if (!snapshot?.ready) return Promise.resolve(false);
  const write = (writes.get(key) || Promise.resolve(true)).then(async () => {
    try {
      await localSet(key, snapshot.value);
      if (read(key).revision === snapshot.revision)
        patch(key, { saved: true, storageError: "" });
      return true;
    } catch {
      patch(key, {
        saved: false,
        storageError: "Không lưu được bản nháp. Kiểm tra dung lượng thiết bị.",
      });
      return false;
    }
  });
  writes.set(key, write);
  void write.then(() => {
    if (writes.get(key) === write) writes.delete(key);
  });
  return write;
}
export function useDraft<Value>(name: string, initial: () => Value) {
  const key = userKey("draft:" + name);
  const initialValue = useRef<Value>(undefined as Value);
  const initialKey = useRef<string | null>(null);
  if (initialKey.current !== key) {
    initialKey.current = key;
    initialValue.current = initial();
  }
  const entry = useDrafts((state) => state.entries[key]);
  useEffect(() => {
    if (read(key)) return;
    patch(key, {
      value: initialValue.current,
      ready: false,
      saved: false,
      storageError: "",
      revision: 0,
    });
    void localGet<Value>(key)
      .then((stored) => {
        patch(key, {
          ...(stored == null ? {} : { value: stored }),
          ready: true,
          saved: true,
        });
      })
      .catch(() =>
        patch(key, {
          ready: true,
          storageError: "Không đọc được bản nháp trên thiết bị.",
        }),
      );
  }, [key]);
  const setValue = (next: SetStateAction<Value>) => {
    const current = read(key);
    if (!current?.ready) return;
    const value =
      typeof next === "function"
        ? (next as (previous: Value) => Value)(current.value as Value)
        : next;
    patch(key, { value, saved: false, revision: current.revision + 1 });
    const timer = timers.get(key);
    if (timer) clearTimeout(timer);
    timers.set(
      key,
      setTimeout(() => {
        void saveKey(key);
      }, 500),
    );
  };
  return {
    value: (entry?.value ?? initialValue.current) as Value,
    setValue,
    ready: entry?.ready ?? false,
    saved: entry?.saved ?? false,
    storageError: entry?.storageError ?? "",
    save: () => saveKey(key),
  };
}
export const newKey = () => Crypto.randomUUID();
