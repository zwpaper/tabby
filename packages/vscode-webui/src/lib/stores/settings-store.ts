import { ToolsByPermission } from "@ragdoll/tools";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type AutoApprove = Record<keyof typeof ToolsByPermission, boolean>;

export interface SettingsState {
  selectedModelId: string | undefined;
  autoApproveActive: boolean;
  autoApproveSettings: AutoApprove;

  updateAutoApproveSettings: (data: Partial<AutoApprove>) => void;
  updateSelectedModelId: (selectedModelId: string | undefined) => void;
  updateAutoApproveActive: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      selectedModelId: undefined,
      autoApproveActive: false,
      autoApproveSettings: {
        read: false,
        write: false,
        execute: false,
      },
      updateSelectedModelId: (selectedModelId: string | undefined) =>
        set({ selectedModelId }),

      updateAutoApproveSettings: (data) =>
        set((state) => ({
          autoApproveSettings: { ...state.autoApproveSettings, ...data },
        })),

      updateAutoApproveActive: (value: boolean) =>
        set(() => ({ autoApproveActive: value })),
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

export function useToolAutoApproval(toolName: string): boolean {
  const { autoApproveActive, autoApproveSettings } = useSettingsStore();
  if (!autoApproveActive) {
    return false;
  }

  if (autoApproveSettings.read && ToolsByPermission.read.includes(toolName)) {
    return true;
  }

  if (autoApproveSettings.write && ToolsByPermission.write.includes(toolName)) {
    return true;
  }

  if (
    autoApproveSettings.execute &&
    ToolsByPermission.execute.includes(toolName)
  ) {
    return true;
  }

  return false;
}
