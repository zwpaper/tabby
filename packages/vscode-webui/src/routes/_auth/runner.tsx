import { MessageList } from "@/components/message/message-list";
import { buttonVariants } from "@/components/ui/button";
import { ChatContextProvider } from "@/features/chat";
import { apiClient } from "@/lib/auth-client";
import { useResourceURI } from "@/lib/hooks/use-resource-uri";
import { useTaskRunners } from "@/lib/hooks/use-task-runners";
import { cn } from "@/lib/utils";
import { type UIMessage, updateToolCallResult } from "@ai-sdk/ui-utils";
import { toUIMessages } from "@ragdoll/common";
import type { TaskRunnerProgress } from "@ragdoll/runner";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

const searchSchema = z.object({
  uid: z.string(),
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
  const { uid } = Route.useSearch();
  const resourceUri = useResourceURI();
  const { auth: authData } = Route.useRouteContext();
  const taskRunners = useTaskRunners();
  const taskRunner = taskRunners[uid];

  const { status, progress, error } = taskRunner ?? {
    status: null,
    progress: null,
    error: null,
  };

  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);

  const refreshTask = useCallback(async () => {
    setIsLoading(true);
    const resp = await apiClient.api.tasks[":uid"].$get({
      param: {
        uid,
      },
    });
    const task = await resp.json();
    setIsLoading(false);
    setMessages(toUIMessages(task.conversation?.messages ?? []));
  }, [uid]);

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
        <Link to={"/"} search={{ uid }} className={buttonVariants()}>
          Continue in Chat
        </Link>
      </div>
    </div>
  );
}

function asReadableMessage(progress: TaskRunnerProgress): string {
  switch (progress.type) {
    case "loading-task":
      if (progress.phase === "begin") {
        return `[Step ${progress.step}] Loading task...`;
      }
      if (progress.phase === "end") {
        return `[Step ${progress.step}] Task loaded successfully.`;
      }
      break;
    case "executing-tool-call":
      if (progress.phase === "begin") {
        return `[Step ${progress.step}] Executing tool: ${progress.toolName}`;
      }
      if (progress.phase === "end") {
        const error =
          typeof progress.toolResult === "object" &&
          progress.toolResult !== null &&
          "error" in progress.toolResult &&
          progress.toolResult.error
            ? progress.toolResult.error
            : undefined;
        return `[Step ${progress.step}] Tool ${progress.toolName} ${error ? "✗" : "✓"}${error ? ` (${error})` : ""}`;
      }
      break;
    case "sending-result":
      if (progress.phase === "begin") {
        return `[Step ${progress.step}] Sending result...`;
      }
      if (progress.phase === "end") {
        return `[Step ${progress.step}] Result sent successfully.`;
      }
      break;
    case "step-completed":
      return `[Step ${progress.step}] Step completed with status: ${progress.status}`;
    case "runner-stopped":
      return `Task runner stopped with final status: ${progress.status}`;
    default:
      return "";
  }
  return "";
}
