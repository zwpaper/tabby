import type { ToolInvocation } from "ai";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ApprovalStatus = "pending" | "approved" | "rejected";

const excludeFromState: (keyof ChatState)[] = ["pendingToolApproval"];

export interface ChatState {
  selectedModelId: string | undefined;

  pendingToolApproval?: {
    tool: ToolInvocation;
    resolve: (approved: boolean) => void;
  };

  updateSelectedModelId: (selectedModelId: string | undefined) => void;

  clearPendingToolApproval: () => void;
  updatePendingToolApproval: (
    pendingToolApproval: ChatState["pendingToolApproval"],
  ) => void;
  resolvePendingToolApproval: (approved: boolean) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      selectedModelId: undefined,
      pendingToolApproval: undefined,
      updateSelectedModelId: (selectedModelId: string | undefined) =>
        set({ selectedModelId }),

      clearPendingToolApproval: () => set({ pendingToolApproval: undefined }),
      updatePendingToolApproval: (
        pendingToolApproval: ChatState["pendingToolApproval"],
      ) => set({ pendingToolApproval }),
      resolvePendingToolApproval: (approved: boolean) => {
        set((state) => {
          if (state.pendingToolApproval) {
            state.pendingToolApproval.resolve(approved);
          }
          return { pendingToolApproval: undefined };
        });
      },
    }),
    {
      name: "ragdoll-chat-storage",
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => !excludeFromState.includes(key as keyof ChatState),
          ),
        ),
    },
  ),
);
