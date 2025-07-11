import { useSettingsStore } from "./store";

// Settings feature barrel export
export { useIsDevMode } from "./hooks/use-is-dev-mode";
export { useModels, useSelectedModels, type Models } from "./hooks/use-models";
export { useAutoApprove } from "./hooks/use-auto-approve";
export { useToolAutoApproval } from "./hooks/use-tool-auto-approval";

export { AutoApproveMenu } from "./components/auto-approve-menu";
export { SettingsPage } from "./components/page";

export function useEnableCheckpoint() {
  return useSettingsStore((x) => x.enableCheckpoint);
}
