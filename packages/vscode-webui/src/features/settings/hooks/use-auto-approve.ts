import { useSettingsStore } from "../store";

export function useAutoApprove(guard: boolean) {
  const { autoApproveActive, autoApproveSettings } = useSettingsStore();
  return {
    autoApproveActive: autoApproveActive && guard,
    autoApproveSettings,
  };
}
