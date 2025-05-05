import { ToolsByPermission } from "@ragdoll/tools";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const excludeFromState: string[] = ["updateAutoApproveSettings"];

type AutoApprove = Record<keyof typeof ToolsByPermission, boolean>;

export interface SettingsState {
  selectedModelId: string | undefined;
  autoApproveSettings: AutoApprove;

  updateAutoApproveSettings: (data: Partial<AutoApprove>) => void;
  updateSelectedModelId: (selectedModelId: string | undefined) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      selectedModelId: undefined,
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
    }),
    {
      name: "ragdoll-settings-storage",
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => !excludeFromState.includes(key as keyof SettingsState),
          ),
        ),
    },
  ),
);

export function useToolAutoApproval(toolName: string): boolean {
  const autoApproveSettings = useSettingsStore(
    (state) => state.autoApproveSettings,
  );
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
