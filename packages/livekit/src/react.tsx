import { Chat } from "@ai-v5-sdk/react";
import type { Store } from "@livestore/livestore";
import type { ReactApi } from "@livestore/react";
import { type ReactNode, createContext, useContext, useMemo } from "react";
import { LiveChatKitBase } from "./chat/live-chat-kit";
import { makeMessagesQuery, makeTaskQuery } from "./livestore/queries";
import type { Message } from "./types";

class LiveChatKit extends LiveChatKitBase<Chat<Message>> {
  constructor(options: { taskId: string; store: Store & ReactApi }) {
    super({
      ...options,
      chatClass: Chat,
    });
  }

  private get reactApi() {
    return this.store as unknown as ReactApi;
  }

  readonly useTask = () => {
    return this.reactApi.useQuery(makeTaskQuery(this.taskId));
  };

  readonly useMessages = () => {
    return this.reactApi.useQuery(makeMessagesQuery(this.taskId));
  };
}

export const LiveChatKitContext = createContext<LiveChatKit | null>(null);

export interface LiveChatKitProviderProps {
  children: ReactNode;
  taskId: string;
  store: Store & ReactApi;
}

export function LiveChatKitProvider({
  taskId,
  store,
  children,
}: LiveChatKitProviderProps) {
  const value = useMemo(
    () => new LiveChatKit({ store, taskId }),
    [store, taskId],
  );

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
