import type { DataPart } from "@ragdoll/common";
import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect } from "react";

import { vscodeHost } from "@/lib/vscode";

export function useNewTaskHandler({
  data,
  taskId,
  uid,
}: {
  data: unknown[] | undefined;
  taskId: React.MutableRefObject<number | undefined>;
  uid: React.MutableRefObject<string | undefined>;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!data || data.length === 0) return;

    const dataParts = data as DataPart[];
    for (const part of dataParts) {
      if (taskId.current === undefined && part.type === "append-id") {
        vscodeHost.capture({
          event: "newTask",
        });
        taskId.current = part.id;
        uid.current = part.uid;

        queryClient.invalidateQueries({ queryKey: ["tasks"] });

        vscodeHost.setSessionState({
          lastVisitedRoute: `/?taskId=${taskId.current}`,
        });
      }
    }
  }, [data, queryClient, taskId, uid]);
}
