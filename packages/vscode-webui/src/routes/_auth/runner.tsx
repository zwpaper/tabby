import { MessageList } from "@/components/message/message-list";
import { buttonVariants } from "@/components/ui/button";
import { VSCodeWebProvider } from "@/components/vscode-web-provider";
import { ChatContextProvider } from "@/features/chat";
import { apiClient } from "@/lib/auth-client";
import { useResourceURI } from "@/lib/hooks/use-resource-uri";
import { useTaskRunners } from "@/lib/hooks/use-task-runners";
import { toUIMessages } from "@ragdoll/common";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Bot, CheckCircle, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";

const searchSchema = z.object({
  taskId: z.number(),
});

/**
 * A temporary route for observing task runner status.
 */
export const Route = createFileRoute("/_auth/runner")({
  validateSearch: (search) => searchSchema.parse(search),
  component: RunnerComponent,
});

function RunnerComponent() {
  const { taskId } = Route.useSearch();
  const resourceUri = useResourceURI();
  const { auth: authData } = Route.useRouteContext();
  const taskRunners = useTaskRunners();
  const taskRunner = taskRunners.find((runner) => runner.taskId === taskId);

  const queryClient = useQueryClient();
  const { data: taskData, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const resp = await apiClient.api.tasks[":id"].$get({
        param: {
          id: taskId.toString(),
        },
      });
      return resp.json();
    },
    refetchOnWindowFocus: false,
  });

  const { status, error } = taskRunner ?? { status: null, error: null };

  useEffect(() => {
    // reload task
    if (status === "completed" || status === "error") {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    }
  }, [status, taskId, queryClient]);

  if (!taskRunner) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p>Task runner not found</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!taskData) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p>Task not found</p>
      </div>
    );
  }

  const messages = toUIMessages(taskData.conversation?.messages || []);

  return (
    <VSCodeWebProvider>
      <ChatContextProvider>
        <div className="flex h-screen flex-col">
          <MessageList
            messages={messages}
            user={authData?.user}
            logo={resourceUri?.logo128}
            isLoading={false}
          />
          {!isLoading && (
            <div className="flex items-center justify-between border-t p-4">
              {status === "running" && (
                <Bot className="h-5 w-5 animate-bounce" />
              )}
              {status === "completed" && (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <Link
                    to={"/"}
                    search={{ taskId }}
                    className={buttonVariants()}
                  >
                    Continue in Chat
                  </Link>
                </>
              )}
              {status === "error" && (
                <>
                  {error && <div>{error}</div>}
                  <Link
                    to={"/"}
                    search={{ taskId }}
                    className={buttonVariants()}
                  >
                    Continue in Chat
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </ChatContextProvider>
    </VSCodeWebProvider>
  );
}
