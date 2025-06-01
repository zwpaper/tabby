import { useLatest } from "@/lib/hooks/use-latest";
import { useSettingsStore } from "../store";

export function useEnableReasoning() {
  return useLatest(useSettingsStore((x) => x.enableReasoning));
}
