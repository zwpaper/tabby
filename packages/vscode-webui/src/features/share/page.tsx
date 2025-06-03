import { MessageList } from "@/components/message/message-list";
import { type Theme, useTheme } from "@/components/theme-provider";
import { VSCodeWebProvider } from "@/components/vscode-web-provider";
import { ChatContextProvider } from "@/features/chat";
import { formatters } from "@ragdoll/common";
import type { UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";

export function SharePage() {
  const { setTheme } = useTheme();
  const searchParams = new URLSearchParams(location.search);
  const theme = searchParams.get("theme") || "light";
  const logo = searchParams.get("logo") ?? undefined;
  useEffect(() => {
    setTheme(theme as Theme);
  }, [theme, setTheme]);

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [user, setUser] = useState<{ name: string; image?: string | null }>();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.data === "object" && event.data?.type === "share") {
        const shareMessage = event.data as ShareMessage;
        setMessages(shareMessage.messages);
        setUser(shareMessage.user);
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  const renderMessages = useMemo(() => formatters.ui(messages), [messages]);

  return (
    <VSCodeWebProvider>
      <ChatContextProvider>
        <MessageList
          logo={logo}
          user={user}
          messages={renderMessages}
          isLoading={false}
        />
      </ChatContextProvider>
    </VSCodeWebProvider>
  );
}

type ShareMessage = {
  type: "share";
  messages: UIMessage[]; // Array of messages to be displayed
  user: {
    name: string;
    image?: string | null;
  };
};
