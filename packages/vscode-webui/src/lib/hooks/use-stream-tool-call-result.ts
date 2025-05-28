import type { AddToolResultFunctionType } from "@/features/approval/components/tool-call-approval-button";
import { useState } from "react";
import { debounceWithCachedValue } from "../debounce";

export type ToolCallStreamResult = {
  toolCallId: string;
  result: unknown;
};

/**
 * Custom hook to manage and stream the results of tool calls(eg. executeCommand).
 *
 * The tool call state is 'call' and the tool call result stored in the state by call updateToolStreamResult
 * when streaming is complete, the result is stored back in the tool call result object and the tool call state is set to 'result'.
 * tool call ui component will have streamResult and result properties.
 *
 */
export const useStreamToolCallResult = () => {
  const [toolCallStreamResults, setStreamResults] = useState<
    ToolCallStreamResult[]
  >([]);

  const removeToolStreamResult = (toolCallId: string) => {
    setStreamResults((prev) =>
      prev.filter((item) => item.toolCallId !== toolCallId),
    );
  };

  const addToolStreamResult: AddToolResultFunctionType =
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
    );

  return {
    toolCallStreamResults,
    addToolStreamResult,
    removeToolStreamResult,
  };
};
