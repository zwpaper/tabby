import { Chat } from "@ai-v5-sdk/react";
import type { Store } from "@livestore/livestore";
import type { ReactApi } from "@livestore/react";
import { type ReactNode, createContext, useContext, useMemo } from "react";
import { LiveChatKitBase } from "./chat/live-chat-kit";
import { messages$, task$ } from "./store/queries";
import type { Message } from "./types";

class LiveChatKit extends LiveChatKitBase<Chat<Message>> {
  constructor(store: Store & ReactApi) {
    super({
      store,
      chatClass: Chat,
    });
  }

  private get reactApi() {
    return this.store as unknown as ReactApi;
  }

  readonly useTask = () => {
    const task = this.reactApi.useQuery(task$);
    return this.getTaskWithId(task);
  };

  readonly useMessages = () => {
    return this.reactApi.useQuery(messages$);
  };
}

export const LiveChatKitContext = createContext<LiveChatKit | null>(null);

export interface LiveChatKitProviderProps {
  children: ReactNode;
  store: Store & ReactApi;
}

export function LiveChatKitProvider({
  store,
  children,
}: LiveChatKitProviderProps) {
  const value = useMemo(() => new LiveChatKit(store), [store]);

  return (
    <LiveChatKitContext.Provider value={value}>
      {children}
    </LiveChatKitContext.Provider>
  );
}

export function useLiveChatKit() {
  const context = useContext(LiveChatKitContext);
  if (!context) {
    throw new Error("useLiveChatKit must be used within a LiveChatKitProvider");
  }
  return context;
}

export type { LiveChatKit };
