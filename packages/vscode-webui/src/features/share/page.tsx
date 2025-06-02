import { MessageList } from "@/components/message/message-list";
import { VSCodeWebProvider } from "@/components/vscode-web-provider";
import { ChatContextProvider } from "@/features/chat";
import type { UIMessage } from "ai";

export function SharePage({ messages }: { messages: UIMessage[] }) {
  return (
    <VSCodeWebProvider>
      <ChatContextProvider>
        <MessageList messages={messages} isLoading={false} />
      </ChatContextProvider>
    </VSCodeWebProvider>
  );
}
