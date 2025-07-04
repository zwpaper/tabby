import type { DataPart } from "@ragdoll/common";
import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect } from "react";

import { vscodeHost } from "@/lib/vscode";

export function useNewTaskHandler({
  data,
  uid,
  updateTaskLock,
}: {
  data: unknown[] | undefined;
  uid: React.MutableRefObject<string | undefined>;
  updateTaskLock: () => void;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!data || data.length === 0) return;

    const dataParts = data as DataPart[];
    for (const part of dataParts) {
      if (uid.current === undefined && part.type === "append-id") {
        vscodeHost.capture({
          event: "newTask",
        });
        uid.current = part.uid;
        updateTaskLock();

        queryClient.invalidateQueries({ queryKey: ["tasks"] });

        vscodeHost.setSessionState({
          lastVisitedRoute: `/?uid=${uid.current}`,
        });
      }
    }
  }, [data, queryClient, uid, updateTaskLock]);
}
