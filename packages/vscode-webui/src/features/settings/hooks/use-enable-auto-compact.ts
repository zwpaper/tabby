import { useSettingsStore } from "../store";

export function useEnableAutoCompact() {
  return useSettingsStore((state) => state.enableAutoCompact);
}
