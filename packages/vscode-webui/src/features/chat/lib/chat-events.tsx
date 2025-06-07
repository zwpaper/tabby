import { type ReactNode, createContext, useContext } from "react";

interface SendMessagePayload {
  prompt: string;
}

type AppendMessage = (message: { content: string; role: "user" }) => void;

interface ChatEventContextState {
  append: AppendMessage;
}

const ChatEventContext = createContext<ChatEventContextState | undefined>(
  undefined,
);

interface ChatEventProviderProps {
  children: ReactNode;
  append: AppendMessage;
}

export function ChatEventProvider({
  children,
  append,
}: ChatEventProviderProps) {
  const value: ChatEventContextState = {
    append,
  };

  return (
    <ChatEventContext.Provider value={value}>
      {children}
    </ChatEventContext.Provider>
  );
}

function useChatEventContext(): ChatEventContextState {
  const context = useContext(ChatEventContext);
  if (context === undefined) {
    throw new Error(
      "useChatEventContext must be used within a ChatEventProvider",
    );
  }
  return context;
}

export function useSendMessage() {
  const { append } = useChatEventContext();

  const sendMessage = (payload: SendMessagePayload) => {
    append({
      content: payload.prompt,
      role: "user",
    });
  };

  return sendMessage;
}
