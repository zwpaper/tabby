import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/auth-client";
import { type Message, useChat } from "@ai-sdk/react";
import type { ChatRequest as RagdollChatRequest } from "@ragdoll/server";
import { fromUIMessage, toUIMessages } from "@ragdoll/server/message-utils";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/tasks/$id")({
  loader: async ({ params }) => {
    const resp = await apiClient.api.tasks[":id"].$get({
      param: {
        id: params.id.toString(),
      },
    });
    return resp.json();
  },
  component: RouteComponent,
});

function RouteComponent() {
  const data = Route.useLoaderData();
  const { auth: authData } = Route.useRouteContext();
  const initialMessages = toUIMessages(data.conversation?.messages || []);
  const {
    reload,
    error,
    messages,
    handleSubmit,
    input,
    handleInputChange,
    status,
  } = useChat({
    id: data.id.toString(),
    initialMessages,
    api: apiClient.api.chat.stream.$url().toString(),
    experimental_prepareRequestBody: prepareRequestBody,
    headers: {
      Authorization: `Bearer ${authData.session.token}`,
    },
  });

  useEffect(() => {
    if (
      messages.length === 1 &&
      messages[0].role === "user" &&
      status === "ready"
    ) {
      reload();
    }
  }, [messages, status, reload]);

  return (
    <div className="flex flex-col h-screen p-4">
      <div>{status}</div>
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

function prepareRequestBody(request: {
  id: string;
  messages: Message[];
}): RagdollChatRequest | null {
  return {
    id: request.id,
    message: fromUIMessage(request.messages[request.messages.length - 1]),
  };
}
