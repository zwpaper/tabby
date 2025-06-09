import { MessageList } from "@/components/message/message-list";
import { buttonVariants } from "@/components/ui/button";
import { ChatContextProvider } from "@/features/chat";
import { apiClient } from "@/lib/auth-client";
import { useResourceURI } from "@/lib/hooks/use-resource-uri";
import { useTaskRunners } from "@/lib/hooks/use-task-runners";
import { cn } from "@/lib/utils";
import { type UIMessage, updateToolCallResult } from "@ai-sdk/ui-utils";
import { toUIMessages } from "@ragdoll/common";
import { asReadableMessage } from "@ragdoll/runner";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

const searchSchema = z.object({
  taskId: z.number(),
});

/**
 * A temporary route for observing task runner status.
 */
export const Route = createFileRoute("/_auth/runner")({
  validateSearch: (search) => searchSchema.parse(search),
  component: () => {
    return (
      <ChatContextProvider>
        <RunnerComponent />
      </ChatContextProvider>
    );
  },
});

function RunnerComponent() {
  const { taskId } = Route.useSearch();
  const resourceUri = useResourceURI();
  const { auth: authData } = Route.useRouteContext();
  const taskRunners = useTaskRunners();
  const taskRunner = taskRunners[taskId];

  const { status, progress, error } = taskRunner ?? {
    status: null,
    progress: null,
    error: null,
  };

  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);

  const refreshTask = useCallback(async () => {
    setIsLoading(true);
    const resp = await apiClient.api.tasks[":id"].$get({
      param: {
        id: taskId.toString(),
      },
    });
    const task = await resp.json();
    setIsLoading(false);
    setMessages(toUIMessages(task.conversation?.messages ?? []));
  }, [taskId]);

  useEffect(() => {
    if (progress?.type === "loading-task") {
      if (progress.phase === "begin") {
        setIsLoading(true);
      } else if (progress.phase === "end") {
        setIsLoading(false);
        setMessages(toUIMessages(progress.task.conversation?.messages ?? []));
      }
    } else if (progress?.type === "executing-tool-call") {
      if (progress.phase === "begin") {
        // FIXME(zhiming): update UI toolcall status icon: isExecuting = true
      } else if (progress.phase === "end") {
        // FIXME(zhiming): update UI toolcall status icon: isExecuting = false
        setMessages((prevMessages) => {
          updateToolCallResult({
            messages: prevMessages,
            toolCallId: progress.toolCallId,
            toolResult: progress.toolResult,
          });
          return prevMessages;
        });
      }
    } else if (progress?.type === "sending-result") {
      if (progress.phase === "begin") {
        setIsLoading(true);
      } else if (progress.phase === "end") {
        // skip
      }
    } else if (progress?.type === "step-completed") {
      setIsLoading(false);
    } else if (progress?.type === "runner-stopped") {
      refreshTask().catch(() => {
        // ignore error
      });
    }
  }, [progress, refreshTask]);

  if (!taskRunner) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p>Task runner not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <MessageList
        messages={messages}
        user={authData?.user}
        logo={resourceUri?.logo128}
        isLoading={isLoading}
      />
      <div className="flex items-center justify-between border-t p-4">
        <div className="flex">
          <Bot
            className={cn("h-5 w-5", {
              "animate-bounce": status === "running",
            })}
          />
          {error ? (
            <div className="px-2 text-error">{error}</div>
          ) : (
            <div className="px-2">
              {progress ? asReadableMessage(progress) : ""}
            </div>
          )}
        </div>
        <Link to={"/"} search={{ taskId }} className={buttonVariants()}>
          Continue in Chat
        </Link>
      </div>
    </div>
  );
}
