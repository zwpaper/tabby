import { vscodeHost } from "@/lib/vscode";
import type { ExtendedPartMixin } from "@ragdoll/common";
import { useMutation } from "@tanstack/react-query";
import { Check, GitCommitHorizontal, Loader2 } from "lucide-react";
import { useSettingsStore } from "../features/settings/store";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "./ui/button";

export const CheckpointUI: React.FC<{
  checkpoint: ExtendedPartMixin["checkpoint"];
  isLoading: boolean;
}> = ({ checkpoint, isLoading }) => {
  const { enableCheckpoint } = useSettingsStore();

  const [showSuccessIcon, setShowSuccessIcon] = useState(false);

  const { mutate: restoreCheckpoint, isPending } = useMutation({
    mutationFn: async (commitId: string) => {
      await Promise.all([
        vscodeHost.restoreCheckpoint(commitId),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
    },
    onSuccess: () => {
      setShowSuccessIcon(true);
      setTimeout(() => setShowSuccessIcon(false), 2000);
    },
  });

  const handleRestoreCheckpoint = () => {
    if (checkpoint?.commit) {
      return restoreCheckpoint(checkpoint.commit);
    }
  };

  const showCheckpoint = enableCheckpoint && checkpoint?.commit;

  return (
    <div
      className={cn(
        "relative w-full opacity-0 transition-opacity duration-200",
        showCheckpoint && "opacity-100",
      )}
    >
      <div
        className={cn(
          "-translate-x-1/2 -top-1 group absolute left-1/2 mx-auto flex min-h-5 w-full max-w-[72px] select-none items-center hover:max-w-full",
          isLoading && "pointer-events-none",
        )}
      >
        <Border hide={isPending || showSuccessIcon} />
        {checkpoint?.commit && (
          <span className="flex items-center text-muted-foreground/80 group-hover:text-foreground">
            {isPending ? (
              <Loader2 className="size-3 animate-spin " />
            ) : showSuccessIcon ? (
              <Check className="size-4 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <GitCommitHorizontal className="size-5" />
            )}
            {!showSuccessIcon && (
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={handleRestoreCheckpoint}
                className="hidden h-5 items-center gap-1 rounded-md px-1 py-0.5 text-xs hover:bg-transparent group-hover:flex dark:hover:bg-transparent"
              >
                {isPending ? "Restoring..." : "Restore"}
              </Button>
            )}
          </span>
        )}
        <Border hide={isPending || showSuccessIcon} />
      </div>
    </div>
  );
};

function Border({ hide }: { hide: boolean }) {
  return (
    <div
      className={cn(
        "flex-1 border-foreground/20 border-t group-hover:opacity-0",
        hide && "opacity-0",
      )}
    />
  );
}
