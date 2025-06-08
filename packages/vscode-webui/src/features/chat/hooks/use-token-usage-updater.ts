import type { DataPart } from "@ragdoll/common";
import type React from "react";
import { useEffect } from "react";

export function useTokenUsageUpdater({
  data,
  setTotalTokens,
}: {
  data: unknown[] | undefined;
  setTotalTokens: React.Dispatch<React.SetStateAction<number>>;
}) {
  useEffect(() => {
    if (!data || data.length === 0) return;

    const dataParts = data as DataPart[];
    for (const part of dataParts) {
      if (part.type === "update-usage") {
        setTotalTokens(part.totalTokens);
      }
    }
  }, [data, setTotalTokens]);
}
