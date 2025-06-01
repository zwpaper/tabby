import { useChatState } from "../context";

export function useToolEvents() {
  return useChatState().toolEvents;
}
