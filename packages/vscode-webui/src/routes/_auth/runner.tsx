import { MessageList } from "@/components/message/message-list";
import { buttonVariants } from "@/components/ui/button";
import { ChatContextProvider } from "@/features/chat";
import { useResourceURI } from "@/lib/hooks/use-resource-uri";
import { useTaskRunners } from "@/lib/hooks/use-task-runners";
import { cn } from "@/lib/utils";
import type { UIMessage } from "@ai-sdk/ui-utils";
import type { TaskRunnerState } from "@ragdoll/runner";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { useEffect, useState } from "react";
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

  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);

  useEffect(() => {
    if (taskRunner) {
      if (taskRunner.state !== "initial") {
        setMessages(taskRunner.messages);
      }

      if (taskRunner.state === "running") {
        const progress = taskRunner.progress;
        if (progress.type === "loading-task") {
          if (progress.phase === "begin") {
            setIsLoading(true);
          } else if (progress.phase === "end") {
            setIsLoading(false);
          }
        } else if (progress.type === "executing-tool-call") {
          if (progress.phase === "begin") {
            // FIXME(zhiming): update UI toolcall status icon: isExecuting = true
          } else if (progress.phase === "end") {
            // FIXME(zhiming): update UI toolcall status icon: isExecuting = false
          }
        } else if (progress.type === "sending-message") {
          if (progress.phase === "begin") {
            setIsLoading(true);
          } else if (progress.phase === "end") {
            setIsLoading(false);
          }
        }
      }
    }
  }, [taskRunner]);

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
              "animate-bounce": taskRunner.state === "running",
            })}
          />
          <div className="px-2">
            {taskRunner ? asReadableMessage(taskRunner) : ""}
          </div>
        </div>
        <Link to={"/"} search={{ uid }} className={buttonVariants()}>
          Continue in Chat
        </Link>
      </div>
    </div>
  );
}

function asReadableMessage(runner: TaskRunnerState): string {
  if (runner.state === "running") {
    const progress = runner.progress;
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
          if (error) {
            return `[Step ${progress.step}] Tool ${progress.toolName} ✗ (${error})`;
          }
          return `[Step ${progress.step}] Tool ${progress.toolName} ✓`;
        }
        break;
      case "sending-message":
        if (progress.phase === "begin") {
          return `[Step ${progress.step}] Sending message...`;
        }
        if (progress.phase === "end") {
          return `[Step ${progress.step}] Message sent successfully.`;
        }
        break;
    }
  } else if (runner.state === "stopped") {
    return "Task runner stopped with result submitted.";
  } else if (runner.state === "error") {
    return `Task runner failed with error: ${runner.error.message}`;
  }
  return "";
}
