import { vscodeHost } from "@/lib/vscode";
import type { ExtendedPartMixin } from "@ragdoll/common";
import { useMutation } from "@tanstack/react-query";
import { Check, GitCommitVertical, Loader2 } from "lucide-react";
import { useSettingsStore } from "../features/settings/store";

import { useState } from "react";
import { Button } from "./ui/button";

export const CheckpointUI: React.FC<{
  checkpoint: NonNullable<ExtendedPartMixin["checkpoint"]>;
}> = ({ checkpoint }) => {
  const { enableCheckpoint } = useSettingsStore();
  const commit = checkpoint.commit;

  if (!commit || !enableCheckpoint) {
    return null;
  }

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
    restoreCheckpoint(commit);
  };

  return (
    <div className="group flex min-h-5 w-full select-none items-center text-sm">
      <Border />
      <span className="flex items-center px-2 text-muted-foreground/80 group-hover:text-foreground">
        {isPending ? (
          <Loader2 className="size-3 animate-spin " />
        ) : showSuccessIcon ? (
          <Check className="size-4 text-emerald-700 dark:text-emerald-300" />
        ) : (
          <GitCommitVertical className="size-4 " />
        )}
        {!showSuccessIcon && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={handleRestoreCheckpoint}
            className="hidden h-5 items-center gap-1 rounded-md px-1 py-0.5 hover:bg-transparent group-hover:flex dark:hover:bg-transparent"
          >
            {isPending ? "Restoring..." : "Restore Checkpoint"}
          </Button>
        )}
      </span>
      <Border />
    </div>
  );
};

function Border() {
  return <div className="flex-1 border-border border-t" />;
}
