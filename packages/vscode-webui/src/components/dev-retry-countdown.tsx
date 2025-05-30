import type { PendingApproval } from "@/features/approval/hooks/use-pending-approval";
import { useIsDevMode } from "@/lib/hooks/use-is-dev-mode";
import { Bug } from "lucide-react";

interface DevRetryCountdownProps {
  pendingApproval: PendingApproval | null | undefined;
  status: string;
}

export function DevRetryCountdown({
  pendingApproval,
  status,
}: DevRetryCountdownProps) {
  const [isDevMode] = useIsDevMode();
  if (!isDevMode) return null;
  return (
    <span className="absolute top-1 right-2 text-foreground/80 text-xs">
      <span className="flex items-center gap-1">
        <Bug className="inline size-3" />
        <span>{status}</span>
        {pendingApproval?.name === "retry" ? (
          <div>
            <span>Attempts: {pendingApproval.attempts}</span> /{" "}
            <span>Countdown: {pendingApproval.countdown}</span> /{" "}
            <span>Delay: {pendingApproval.delay}</span>
          </div>
        ) : undefined}
      </span>
    </span>
  );
}
