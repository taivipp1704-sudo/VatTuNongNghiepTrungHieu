import { create } from "zustand";
export const useScan = create<{
  target: string;
  code: string;
  set: (target: string, code: string) => void;
  clear: () => void;
}>((set) => ({
  target: "",
  code: "",
  set: (target, code) => set({ target, code }),
  clear: () => set({ target: "", code: "" }),
}));
