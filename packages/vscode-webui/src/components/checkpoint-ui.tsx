import { vscodeHost } from "@/lib/vscode";
import type { ExtendedPartMixin } from "@ragdoll/common";
import { useMutation } from "@tanstack/react-query";
import { Check, GitCommitHorizontal, Loader2 } from "lucide-react";

import { useEnableCheckpoint } from "@/features/settings";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "./ui/button";

export const CheckpointUI: React.FC<{
  checkpoint: ExtendedPartMixin["checkpoint"];
  isLoading: boolean;
  className?: string;
  hideBorderOnHover?: boolean;
}> = ({ checkpoint, isLoading, className, hideBorderOnHover = true }) => {
  const enableCheckpoint = useEnableCheckpoint();

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
          className,
        )}
      >
        <Border
          hide={isPending || showSuccessIcon}
          hideOnHover={hideBorderOnHover}
        />
        {checkpoint?.commit && (
          <span
            className={cn(
              "flex items-center text-muted-foreground/60 group-hover:px-2.5 group-hover:text-foreground",
              (isPending || showSuccessIcon) && "px-2.5",
            )}
          >
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
        <Border
          hide={isPending || showSuccessIcon}
          hideOnHover={hideBorderOnHover}
        />
      </div>
    </div>
  );
};

function Border({
  hide,
  hideOnHover,
}: { hide: boolean; hideOnHover?: boolean }) {
  return (
    <div
      className={cn(
        "flex-1 border-border border-t",
        hideOnHover && "group-hover:opacity-0",
        hideOnHover && hide && "opacity-0",
      )}
    />
  );
}
