import { useSettingsStore } from "../store";

export function useAllowEditTodos() {
  return useSettingsStore((state) => state.allowEditTodos);
}
