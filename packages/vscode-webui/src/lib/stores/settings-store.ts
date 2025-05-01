import { type ClientToolsType, ToolsByPermission } from "@ragdoll/tools";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const excludeFromState: string[] = ["updateAutoApproveSettings"];

type AutoApprove = {
  read: boolean;
  write: boolean;
  execute: boolean;
};

export interface SettingsState {
  autoApproveSettings: AutoApprove;
  updateAutoApproveSettings: (data: Partial<AutoApprove>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoApproveSettings: {
        read: false,
        write: false,
        execute: false,
      },
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

export function useToolAutoApproval(toolName?: keyof ClientToolsType): boolean {
  const autoApproveSettings = useSettingsStore(
    (state) => state.autoApproveSettings,
  );
  if (!toolName) return false;
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
