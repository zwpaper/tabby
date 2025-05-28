import { useCallback, useState } from "react";
import { debounceWithCachedValue } from "../../debounce";

export type ToolCallStreamResult = {
  toolCallId: string;
  result: unknown;
};

// Helper hook to manage tool stream results
export function useToolStreamResults() {
  const [toolCallStreamResults, setStreamResults] = useState<
    ToolCallStreamResult[]
  >([]);

  const removeToolStreamResult = useCallback((toolCallId: string): void => {
    setStreamResults((prev) =>
      prev.filter((item) => item.toolCallId !== toolCallId),
    );
  }, []);

  const addToolStreamResult = useCallback(
    debounceWithCachedValue(
      (result: ToolCallStreamResult) => {
        setStreamResults((prev) => {
          const hasExisting = prev.some(
            (item) => item.toolCallId === result.toolCallId,
          );
          if (!hasExisting) {
            return [...prev, result];
          }
          return prev.map((item) =>
            item.toolCallId === result.toolCallId
              ? {
                  ...item,
                  result: result.result,
                }
              : item,
          );
        });
      },
      100,
      { trailing: true, leading: true },
    ),
    [],
  );

  return {
    toolCallStreamResults,
    addToolStreamResult,
    removeToolStreamResult,
  };
}
