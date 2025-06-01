import { useChatState } from "../context";

export function useStreamToolCallResult() {
  const state = useChatState();
  return {
    addToolStreamResult: state.toolStreamResults.add,
    removeToolStreamResult: state.toolStreamResults.remove,
    findToolStreamResult: state.toolStreamResults.find,
  };
}
