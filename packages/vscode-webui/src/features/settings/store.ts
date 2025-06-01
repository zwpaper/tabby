import { DefaultModelId } from "@/lib/constants";
import type { ToolsByPermission } from "@ragdoll/tools";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AutoApprove = Record<
  Exclude<keyof typeof ToolsByPermission, "default">,
  boolean
> & {
  retry: number;
  mcp: boolean;
};

export interface SettingsState {
  selectedModelId: string | undefined;
  autoApproveActive: boolean;
  autoApproveSettings: AutoApprove;

  isDevMode: boolean;
  enableReasoning: boolean;

  updateAutoApproveSettings: (data: Partial<AutoApprove>) => void;
  updateSelectedModelId: (selectedModelId: string | undefined) => void;
  updateAutoApproveActive: (value: boolean) => void;
  updateIsDevMode: (value: boolean) => void;
  updateEnableReasoning: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      selectedModelId: DefaultModelId,
      autoApproveActive: true,
      autoApproveSettings: {
        read: true,
        write: true,
        execute: true,
        retry: 0,
        mcp: false,
      },
      isDevMode: false,
      enableReasoning: false,

      updateSelectedModelId: (selectedModelId: string | undefined) =>
        set({ selectedModelId }),

      updateAutoApproveSettings: (data) =>
        set((state) => ({
          autoApproveSettings: { ...state.autoApproveSettings, ...data },
        })),

      updateAutoApproveActive: (value: boolean) =>
        set(() => ({ autoApproveActive: value })),

      updateIsDevMode: (value: boolean) => set(() => ({ isDevMode: value })),
      updateEnableReasoning: (value: boolean) =>
        set(() => ({ enableReasoning: value })),
    }),
    {
      name: "ragdoll-settings-storage",
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([_, v]) => typeof v !== "function"),
        ),
    },
  ),
);
