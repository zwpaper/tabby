import type { ToolInvocationUIPart, UIMessage } from "@ai-sdk/ui-utils";
import type { TextPart } from "ai";
import { Loader2, UserIcon } from "lucide-react";
import type React from "react";

import { ReasoningPartUI } from "@/components/reasoning-part.tsx";
import { ToolInvocationPart } from "@/components/tool-invocation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToolCallLifeCycle } from "@/features/chat";
import { useDebounceState } from "@/lib/hooks/use-debounce-state";
import { cn } from "@/lib/utils";
import { isVSCodeEnvironment } from "@/lib/vscode";
import type { CheckpointPart, ExtendedUIMessage } from "@ragdoll/db";
import { useEffect } from "react";
import { CheckpointUI } from "../checkpoint-ui";
import { MessageAttachments } from "./attachments";
import { MessageMarkdown } from "./markdown";

export const MessageList: React.FC<{
  messages: UIMessage[];
  user?: { name: string; image?: string | null };
  logo?: string;
  isLoading: boolean;
  containerRef?: React.RefObject<HTMLDivElement>;
  showUserAvatar?: boolean;
  className?: string;
}> = ({
  messages: renderMessages,
  isLoading,
  user = { name: "You" },
  logo,
  containerRef,
  showUserAvatar = true,
  className,
}) => {
  const [debouncedIsLoading, setDebouncedIsLoading] = useDebounceState(
    isLoading,
    300,
  );

  useEffect(() => {
    setDebouncedIsLoading(isLoading);
  }, [isLoading, setDebouncedIsLoading]);

  const { executingToolCalls } = useToolCallLifeCycle();
  const isExecuting = executingToolCalls.length > 0;

  return (
    <ScrollArea
      className={cn("mb-2 flex-1 overflow-y-auto px-4", className)}
      ref={containerRef}
    >
      {renderMessages.map((m, messageIndex) => (
        <div key={m.id} className="flex flex-col">
          <div className={cn(showUserAvatar && "py-2")}>
            {showUserAvatar && (
              <div className="flex items-center gap-2">
                {m.role === "user" ? (
                  <Avatar className="size-7">
                    <AvatarImage src={user?.image ?? undefined} />
                    <AvatarFallback
                      className={cn(
                        "bg-[var(--vscode-chat-avatarBackground)] text-[var(--vscode-chat-avatarForeground)] text-xs uppercase",
                      )}
                    >
                      {user?.name.slice(0, 2) || (
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
                <strong>{m.role === "user" ? user?.name : "Pochi"}</strong>
              </div>
            )}
            <div className={cn("ml-1 flex flex-col", showUserAvatar && "mt-3")}>
              {m.parts.map((part, index) => (
                <Part
                  role={m.role}
                  key={index}
                  isLastPartInMessages={
                    index === m.parts.length - 1 &&
                    messageIndex === renderMessages.length - 1
                  }
                  partIndex={index}
                  part={part}
                  isLoading={isLoading}
                  isExecuting={isExecuting}
                  messages={renderMessages}
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
            <SeparatorWithCheckpoint
              message={m}
              isLoading={isLoading || isExecuting}
            />
          )}
        </div>
      ))}
      {debouncedIsLoading && (
        <div className="py-2">
          <Loader2 className="mx-auto size-6 animate-spin" />
        </div>
      )}
    </ScrollArea>
  );
};

function Part({
  role,
  part,
  partIndex,
  isLastPartInMessages,
  isLoading,
  isExecuting,
  messages,
}: {
  role: UIMessage["role"];
  partIndex: number;
  part: NonNullable<ExtendedUIMessage["parts"]>[number];
  isLastPartInMessages: boolean;
  isLoading: boolean;
  isExecuting: boolean;
  messages: UIMessage[];
}) {
  const paddingClass = partIndex === 0 ? "" : "mt-2";
  if (part.type === "text") {
    return <TextPartUI className={paddingClass} part={part} />;
  }

  if (part.type === "reasoning") {
    return (
      <ReasoningPartUI
        className={paddingClass}
        part={part}
        isLoading={isLastPartInMessages}
      />
    );
  }

  if (part.type === "step-start") {
    return;
  }

  if (part.type === "checkpoint") {
    if (role === "assistant" && isVSCodeEnvironment()) {
      return (
        <CheckpointUI
          checkpoint={part.checkpoint}
          isLoading={isLoading || isExecuting}
        />
      );
    }
    return null;
  }

  if (part.type === "tool-invocation") {
    return (
      <ToolInvocationPart
        className={paddingClass}
        tool={part.toolInvocation}
        isLoading={isLoading}
        changes={getToolCallCheckpoint(part, messages)}
      />
    );
  }

  return <div>{JSON.stringify(part)}</div>;
}

function TextPartUI({
  className,
  part,
}: { part: TextPart; className?: string }) {
  if (part.text.trim().length === 0) {
    return null; // Skip empty text parts
  }
  return <MessageMarkdown className={className}>{part.text}</MessageMarkdown>;
}

const SeparatorWithCheckpoint: React.FC<{
  message: ExtendedUIMessage;
  isLoading: boolean;
}> = ({ message, isLoading }) => {
  const sep = <Separator className="mt-1 mb-2" />;
  if (message.role === "assistant") return sep;
  const part = message.parts.at(-1);
  if (part && part.type === "checkpoint" && isVSCodeEnvironment()) {
    return (
      <div className="mt-1 mb-2">
        <CheckpointUI
          checkpoint={part.checkpoint}
          isLoading={isLoading}
          hideBorderOnHover={false}
          className="max-w-full"
        />
      </div>
    );
  }

  return sep;
};

export interface ToolCallCheckpoint {
  origin?: string;
  modified?: string;
}

const getToolCallCheckpoint = (
  part: ToolInvocationUIPart,
  messages: ExtendedUIMessage[],
): ToolCallCheckpoint => {
  const allParts = messages.flatMap((msg) => msg.parts);

  const currentIndex = allParts.findIndex(
    (p) =>
      p.type === "tool-invocation" &&
      p.toolInvocation.toolCallId === part.toolInvocation.toolCallId,
  );

  const beforeCheckpoint = allParts.findLast(
    (item, index) => item.type === "checkpoint" && index < currentIndex,
  ) as CheckpointPart | undefined;

  const afterCheckpoint = allParts.find(
    (item, index) => item.type === "checkpoint" && index > currentIndex,
  ) as CheckpointPart | undefined;

  return {
    origin: beforeCheckpoint?.checkpoint.commit,
    modified: afterCheckpoint?.checkpoint.commit,
  };
};
