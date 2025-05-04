import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ApprovalStatus = "pending" | "approved" | "rejected";

const excludeFromState: (keyof ChatState)[] = ["pendingApproval"];

export interface ChatState {
  selectedModelId: string | undefined;

  pendingApproval?: {
    id: string;
    name: string;
    resolve: (approved: boolean) => void;
  };

  updateSelectedModelId: (selectedModelId: string | undefined) => void;

  clearPendingApproval: () => void;
  updatePendingApproval: (
    pendingApproval: ChatState["pendingApproval"],
  ) => void;
  resolvePendingApproval: (approved: boolean) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      selectedModelId: undefined,
      pendingApproval: undefined,
      updateSelectedModelId: (selectedModelId: string | undefined) =>
        set({ selectedModelId }),

      clearPendingApproval: () => set({ pendingApproval: undefined }),
      updatePendingApproval: (pendingApproval: ChatState["pendingApproval"]) =>
        set({ pendingApproval }),
      resolvePendingApproval: (approved: boolean) => {
        set((state) => {
          if (state.pendingApproval) {
            state.pendingApproval.resolve(approved);
          }
          return { pendingApproval: undefined };
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
