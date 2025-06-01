import { useChatState } from "../context";

export function useExecutingToolCallIds() {
  const state = useChatState();

  return {
    addExecutingToolCall: state.executingToolCalls.add,
    removeExecutingToolCall: state.executingToolCalls.remove,
    isExecuting: state.executingToolCalls.isExecuting,
  };
}
