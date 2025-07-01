import { vscodeHost } from "@/lib/vscode";
import type { ExtendedStepStartPart } from "@ragdoll/common";
import { RotateCcw } from "lucide-react";
import { useSettingsStore } from "../features/settings/store";

export const StepStartPartUI: React.FC<{
  part: ExtendedStepStartPart;
}> = ({ part }) => {
  const { enableCheckpoint } = useSettingsStore();
  const commit = part?.checkpoint?.commit;

  if (!commit || !enableCheckpoint) {
    return null;
  }

  const handleRestoreCheckpoint = () => {
    vscodeHost.restoreCheckpoint(commit);
  };

  return (
    <div className="group relative flex cursor-pointer items-center py-0.5">
      <div className="h-px w-full border-border border-t border-dashed transition-colors group-hover:border-foreground" />

      <button
        type="button"
        onClick={handleRestoreCheckpoint}
        className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 rounded-sm border-1 bg-background px-1 py-0.5 text-muted-foreground opacity-0 transition-all hover:scale-105 hover:bg-accent hover:text-accent-foreground group-hover:opacity-100"
      >
        <span className="flex items-center">
          <RotateCcw className="mr-1 inline size-3" />
          <span className="text-xs">Restore</span>
        </span>
      </button>
    </div>
  );
};
