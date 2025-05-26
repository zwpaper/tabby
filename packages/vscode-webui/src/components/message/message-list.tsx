import type { UIMessage } from "@ai-sdk/ui-utils";
import type { ChatRequestOptions, CreateMessage, Message, TextPart } from "ai";
import { Loader2, UserIcon } from "lucide-react";
import type React from "react";

import { ReasoningPartUI } from "@/components/reasoning-part.tsx";
import { ToolInvocationPart } from "@/components/tool-invocation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { isAutoInjectTool } from "@ragdoll/tools";

import { MessageAttachments } from "./attachments";
import { MessageMarkdown } from "./markdown";

export const MessageList: React.FC<{
  messages: UIMessage[];
  user: { name: string; image?: string | null };
  logo?: string;
  sendMessage: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isLoading: boolean;
  executingToolCallId?: string;
  containerRef?: React.RefObject<HTMLDivElement>;
}> = ({
  messages: renderMessages,
  isLoading,
  user,
  logo,
  sendMessage,
  executingToolCallId,
  containerRef,
}) => {
  return (
    <ScrollArea className="mb-2 flex-1 overflow-y-auto px-4" ref={containerRef}>
      {renderMessages.map((m, messageIndex) => (
        <div key={m.id} className="flex flex-col">
          <div className="rounded-lg py-2">
            <div className="flex items-center gap-2">
              {m.role === "user" ? (
                <Avatar className="size-7">
                  <AvatarImage src={user.image ?? undefined} />
                  <AvatarFallback
                    className={cn(
                      "bg-[var(--vscode-chat-avatarBackground)] text-[var(--vscode-chat-avatarForeground)] text-xs uppercase",
                    )}
                  >
                    {user.name.slice(0, 2) || (
                      <UserIcon className={cn("size-[50%]")} />
                    )}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="size-7">
                  <AvatarImage src={logo} className="scale-110" />
                  <AvatarFallback className="bg-[var(--vscode-chat-avatarBackground)] text-[var(--vscode-chat-avatarForeground)]" />
                </Avatar>
              )}
              <strong>{m.role === "user" ? user.name : "Pochi"}</strong>
            </div>
            <div className="mt-3 ml-1 flex flex-col gap-2">
              {m.parts.map((part, index) => (
                <Part
                  key={index}
                  message={m}
                  isLastPartInMessages={
                    index === m.parts.length - 1 &&
                    messageIndex === renderMessages.length - 1
                  }
                  part={part}
                  isLoading={isLoading}
                  sendMessage={sendMessage}
                  executingToolCallId={executingToolCallId}
                />
              ))}
            </div>
            {/* Display attachments at the bottom of the message */}
            {m.role === "user" && !!m.experimental_attachments?.length && (
              <div className="mt-3">
                <MessageAttachments attachments={m.experimental_attachments} />
              </div>
            )}
          </div>
          {messageIndex < renderMessages.length - 1 && (
            <Separator className="mt-1 mb-2" />
          )}
        </div>
      ))}
      {isLoading && (
        <div className="pb-4">
          <Loader2 className="mx-auto size-6 animate-spin" />
        </div>
      )}
    </ScrollArea>
  );
};

function Part({
  message,
  part,
  executingToolCallId,
  sendMessage,
  isLoading,
  isLastPartInMessages,
}: {
  message: UIMessage;
  part: NonNullable<UIMessage["parts"]>[number];
  sendMessage: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  executingToolCallId: string | undefined;
  isLoading: boolean;
  isLastPartInMessages: boolean;
}) {
  if (part.type === "text") {
    return <TextPartUI message={message} part={part} />;
  }

  if (part.type === "reasoning") {
    return <ReasoningPartUI part={part} isLoading={isLastPartInMessages} />;
  }

  if (part.type === "step-start") {
    return null;
  }

  if (part.type === "tool-invocation") {
    if (isAutoInjectTool(part.toolInvocation.toolName)) {
      return null;
    }

    return (
      <ToolInvocationPart
        tool={part.toolInvocation}
        sendMessage={sendMessage}
        executingToolCallId={executingToolCallId}
        isLoading={isLoading}
      />
    );
  }

  return <div>{JSON.stringify(part)}</div>;
}

function TextPartUI({ message, part }: { message: UIMessage; part: TextPart }) {
  return (
    <MessageMarkdown
      className={message.role === "user" ? "max-w-[80vw]" : undefined}
    >
      {part.text}
    </MessageMarkdown>
  );
}
