import Pending from "@/components/pending";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/auth-client";
import { type Message, useChat } from "@ai-sdk/react";
import type { ChatRequest as RagdollChatRequest } from "@ragdoll/server";
import { fromUIMessage, toUIMessages } from "@ragdoll/server/message-utils";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { type MutableRefObject, useEffect, useRef } from "react";
import { z } from "zod";

const searchSchema = z.object({
  taskId: z.number().optional(),
});

export const Route = createFileRoute("/chat")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (deps.taskId) {
      const resp = await apiClient.api.tasks[":id"].$get({
        param: {
          id: deps.taskId?.toString(),
        },
      });
      return resp.json();
    }

    return null;
  },
  component: RouteComponent,
  pendingComponent: Pending,
});

function RouteComponent() {
  const loaderData = Route.useLoaderData();
  const taskId = useRef<number | undefined>(loaderData?.id);
  const { auth: authData } = Route.useRouteContext();
  const initialMessages = toUIMessages(
    loaderData?.conversation?.messages || [],
  );
  const {
    data,
    error,
    messages,
    handleSubmit,
    input,
    handleInputChange,
    status,
  } = useChat({
    initialMessages,
    api: apiClient.api.chat.stream.$url().toString(),
    experimental_prepareRequestBody: (req) => prepareRequestBody(taskId, req),
    headers: {
      Authorization: `Bearer ${authData.session.token}`,
    },
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (
      taskId.current === undefined &&
      typeof data?.[0] === "object" &&
      data[0] &&
      "id" in data[0] &&
      typeof data[0].id === "number"
    ) {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      taskId.current = data[0].id;
    }
  }, [data, queryClient]);

  const isLoading = status === "streaming" || status === "submitted";

  const { history } = useRouter();
  return (
    <div className="flex flex-col h-screen p-4">
      <Button onClick={() => history.back()}>Back</Button>
      <div className="flex gap-2 items-center">
        {taskId.current} - {status}
        {isLoading && <Loader2 className="size-4 animate-spin" />}
      </div>
      <div className="text-destructive">{error?.message}</div>
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="p-2 rounded-lg">
              <strong>{m.role === "user" ? "You" : "Assistant"}: </strong>
              {m.parts.map((part, index) => {
                if (part.type === "text") {
                  return <span key={index}>{part.text}</span>;
                }
                return null;
              })}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
          className="flex-1"
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}

function prepareRequestBody(
  taskId: MutableRefObject<number | undefined>,
  request: {
    messages: Message[];
  },
): RagdollChatRequest | null {
  return {
    id: taskId.current?.toString(),
    message: fromUIMessage(request.messages[request.messages.length - 1]),
  };
}
