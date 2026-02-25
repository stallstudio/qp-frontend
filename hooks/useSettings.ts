import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { UserSettings, defaultSettings } from "@/types/settings";

interface SettingsStore extends UserSettings {
  setCompactMode: (compactMode: boolean) => void;
  toggleCompactMode: () => void;
  resetSettings: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setCompactMode: (compactMode: boolean) =>
        set({ compactMode }),
      toggleCompactMode: () =>
        set((state) => ({ compactMode: !state.compactMode })),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: "user-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
