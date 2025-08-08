import { EmptyChatPlaceholder } from "@/components/empty-chat-placeholder";
import { MessageList } from "@/components/message/message-list";
import { useResourceURI } from "@/lib/hooks/use-resource-uri";
// FIXME(meng): migrate this to v5
// ast-grep-ignore: no-ai-sdk-v4
import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import type React from "react";

interface ChatAreaProps {
  messages: UIMessage[];
  isTaskLoading: boolean;
  isLoading: boolean;
  isCompactingNewTask: boolean;
  user: { name: string; image?: string | null };
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatArea({
  messages,
  isTaskLoading,
  isLoading,
  isCompactingNewTask,
  user,
  messagesContainerRef,
}: ChatAreaProps) {
  const resourceUri = useResourceURI();
  return (
    <>
      {messages.length === 0 &&
        (isTaskLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <EmptyChatPlaceholder />
        ))}
      {messages.length > 0 && <div className="h-4" />}
      <MessageList
        messages={messages}
        user={user}
        assistant={{
          name: "Pochi",
          image: resourceUri?.logo128,
        }}
        isLoading={isLoading || isTaskLoading}
        containerRef={messagesContainerRef}
        isCompactingNewTask={isCompactingNewTask}
      />
    </>
  );
}
