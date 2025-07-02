import { vscodeHost } from "@/lib/vscode";
import type { ExtendedPartMixin } from "@ragdoll/common";
import { GitCommitVertical, RotateCcw } from "lucide-react";
import { useSettingsStore } from "../features/settings/store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export const CheckpointUI: React.FC<{
  checkpoint: NonNullable<ExtendedPartMixin["checkpoint"]>;
}> = ({ checkpoint }) => {
  const { enableCheckpoint } = useSettingsStore();
  const commit = checkpoint.commit;

  if (!commit || !enableCheckpoint) {
    return null;
  }

  const handleRestoreCheckpoint = () => {
    vscodeHost.restoreCheckpoint(commit);
  };

  return (
    <div className="group flex min-h-5 w-full select-none items-center text-xs">
      <Border />
      <span className="flex items-center text-muted-foreground group-hover:text-foreground ">
        <GitCommitVertical className="mr-0.5 size-4 text-muted-foreground/80" />
        <span className="hidden items-center group-hover:flex">
          Checkpoint
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRestoreCheckpoint}
                  className="ml-1 rounded-md bg-transparent p-1 hover:bg-accent"
                  type="button"
                >
                  <RotateCcw className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Restore to this checkpoint</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
      </span>
      <Border />
    </div>
  );
};

function Border() {
  return (
    <div className="flex-1 border-border border-t transition-colors duration-200 group-hover:border-foreground/50" />
  );
}
