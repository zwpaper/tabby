import type { apiClient } from "@/lib/auth-client";
import { formatRelativeTime } from "@/lib/utils/ui";

import type { InferResponseType } from "hono/client";
import { Calendar, HardDrive } from "lucide-react";

type Minion = InferResponseType<
  (typeof apiClient.api.minions)["$get"]
>["data"][number];

export function MinionRow({ minion }: { minion: Minion }) {
  return (
    <a
      href={`/api/minions/${minion.id}/redirect`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block cursor-pointer rounded-lg border transition-colors duration-200 hover:bg-muted/50 hover:text-muted-foreground"
    >
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2 overflow-hidden">
            <div className="font-medium text-foreground">
              Minion #{minion.id}
            </div>
            <div className="flex min-h-4 flex-col gap-3 text-muted-foreground text-xs md:mt-3 md:flex-row md:items-center">
              <div className="flex items-center gap-1">
                <HardDrive className="h-4 w-4" />
                <span>{minion.sandboxId}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatRelativeTime(minion.createdAt, "Created")}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Open</span>
          </div>
        </div>
      </div>
    </a>
  );
}
