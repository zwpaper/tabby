import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/auth-client";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import type { Message } from "ai";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
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
  const router = useRouter();
  // @ts-expect-error
  const messages = toAiMessages(data.conversation?.messages || []);
  return (
    <div className="flex flex-col p-4 space-y-4">
      <Button onClick={() => router.history.back()} className="self-start">
        Back
      </Button>
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div key={index}>
            <div className="flex flex-row items-center space-x-2 p-4">
              <div className="text-sm font-semibold">
                {message.role === "user" ? "You" : "Assistant"}
              </div>
            </div>
            <div className="p-4 pt-0">
              <p className="text-sm text-wrap">{message.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function toAiMessage(
  message: Omit<Message, "createdAt"> & { createdAt?: Date | string },
): Message {
  return {
    ...message,
    createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
  };
}

function toAiMessages(
  messages: (Omit<Message, "createdAt"> & { createdAt?: Date | string })[],
): Message[] {
  return messages.map(toAiMessage);
}
