import { create } from "zustand";
import { persist } from "zustand/middleware";

const excludeFromState: string[] = [];

export interface ChatState {
  selectedModelId: string | undefined;
}

const initialState: ChatState = {
  selectedModelId: undefined,
};

export const useChatStore = create<ChatState>()(
  persist(
    () => ({
      ...initialState,
    }),
    {
      name: "ragdoll-chat-storage",
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => !excludeFromState.includes(key),
          ),
        ),
    },
  ),
);

const set = useChatStore.setState;

export const updateSelectedModelId = (id: string | undefined) => {
  set(() => ({ selectedModelId: id }));
};
