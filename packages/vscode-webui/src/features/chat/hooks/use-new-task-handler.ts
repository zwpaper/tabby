import type { DataPart } from "@ragdoll/common";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { vscodeHost } from "@/lib/vscode";

export function useNewTaskHandler({
  data,
  setUid,
  enabled,
}: {
  data: unknown[] | undefined;
  setUid: (uid: string) => void;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !data || data.length === 0) return;

    const dataParts = data as DataPart[];
    for (const part of dataParts) {
      if (part.type === "append-id") {
        vscodeHost.capture({
          event: "newTask",
        });
        setUid(part.uid);

        queryClient.invalidateQueries({ queryKey: ["tasks"] });

        vscodeHost.setSessionState({
          lastVisitedRoute: `/?uid=${part.uid}`,
        });
      }
    }
  }, [enabled, data, queryClient, setUid]);
}
