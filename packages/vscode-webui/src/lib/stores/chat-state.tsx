import type React from "react";
import { type ReactNode, createContext, useContext, useRef } from "react";

interface ChatState {
  autoApproveGuard: React.MutableRefObject<boolean>;
}

const ChatStateContext = createContext<ChatState | undefined>(undefined);

interface ChatStateProviderProps {
  children: ReactNode;
}

export function ChatStateProvider({ children }: ChatStateProviderProps) {
  const autoApproveGuard = useRef(false);

  const value: ChatState = {
    autoApproveGuard,
  };

  return (
    <ChatStateContext.Provider value={value}>
      {children}
    </ChatStateContext.Provider>
  );
}

export function useChatState(): ChatState {
  const context = useContext(ChatStateContext);
  if (context === undefined) {
    throw new Error("useChatState must be used within a ChatStateProvider");
  }
  return context;
}
