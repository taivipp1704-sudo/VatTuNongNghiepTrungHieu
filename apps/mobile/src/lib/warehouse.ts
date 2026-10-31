import { create } from "zustand";
import { localGet, localSet } from "./cache";
import { Warehouse } from "@/types";
interface Scope {
  warehouseId: string;
  namespace: string;
  ready: boolean;
  configure: (namespace: string, warehouses: Warehouse[]) => Promise<void>;
  select: (id: string) => Promise<void>;
}
export const useWarehouse = create<Scope>((set, get) => ({
  warehouseId: "",
  namespace: "",
  ready: false,
  configure: async (namespace, warehouses) => {
    if (get().namespace === namespace) {
      if (get().ready && !warehouses.some((w) => w.id === get().warehouseId))
        set({ warehouseId: warehouses[0]?.id || "" });
      return;
    }
    set({ namespace, warehouseId: "", ready: false });
    const stored = await localGet<string>(namespace).catch(() => null);
    if (get().namespace !== namespace) return;
    set({
      warehouseId: warehouses.some((w) => w.id === stored)
        ? stored!
        : warehouses[0]?.id || "",
      ready: true,
    });
  },
  select: async (warehouseId) => {
    const namespace = get().namespace;
    await localSet(namespace, warehouseId);
    if (get().namespace === namespace) set({ warehouseId });
  },
}));
