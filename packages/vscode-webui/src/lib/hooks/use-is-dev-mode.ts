import { useSettingsStore } from "../stores/settings-store";

export const useIsDevMode = () => {
  const { isDevMode, updateIsDevMode } = useSettingsStore();
  return [isDevMode, updateIsDevMode] as const;
};
