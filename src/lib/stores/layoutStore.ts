import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LayoutStore {
  fullWidth: boolean;
  toggleFullWidth: () => void;
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set, get) => ({
      fullWidth: false,
      toggleFullWidth: () => set({ fullWidth: !get().fullWidth }),
    }),
    {
      name: "vinc-layout-store",
    }
  )
);
