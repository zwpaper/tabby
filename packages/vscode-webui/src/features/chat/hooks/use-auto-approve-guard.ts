import { useChatState } from "../context";

export function useAutoApproveGuard() {
  return useChatState().autoApproveGuard;
}
