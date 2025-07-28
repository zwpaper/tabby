import { createFileRoute } from "@tanstack/react-router";

import { TaskContent } from "@/components/task/content";
import { apiClient } from "@/lib/auth-client";
import { normalizeApiError, toHttpError } from "@/lib/error";
import type { Todo } from "@getpochi/tools";
import { toUIMessages } from "@ragdoll/common";
import { parseTitle } from "@ragdoll/common/message-utils";
import { findTodos, mergeTodos } from "@ragdoll/common/todo-utils";
import type { UIMessage } from "ai";

export const Route = createFileRoute("/clips/$id")({
  loader: async ({ params }) => {
    const { id } = params;
    try {
      const response = await apiClient.api.clips[":id"].$get({
        param: {
          id,
        },
      });
      if (!response.ok) {
        throw toHttpError(response);
      }
      const { data } = await response.json();
      const messages = toUIMessages(data.messages || []);
      const title = createTitle(messages);
      const todos = createTodos(messages);
      return {
        messages,
        title,
        todos,
      };
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  component: ClipView,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData.title,
      },
    ],
  }),
});

function ClipView() {
  const { messages, todos, title } = Route.useLoaderData();

  if (!messages || messages.length === 0) {
    return (
      <div className="p-4">
        <p>No messages in this clip.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 p-4 font-bold text-2xl">{title}</h1>
      <TaskContent
        messages={messages}
        todos={todos}
        title={title}
        user={{
          name: "You",
          image: `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(title)}&scale=150`,
        }}
      />
    </div>
  );
}

function createTodos(messages: UIMessage[]) {
  let todos: Todo[] = [];
  for (const x of messages) {
    const newTodos = findTodos(x);
    if (newTodos) {
      todos = mergeTodos(todos, newTodos);
    }
  }

  if (todos.length > 0) {
    return todos;
  }
}

function createTitle(messages: UIMessage[]) {
  for (const x of messages) {
    if (x.role !== "user") continue;
    for (const part of x.parts) {
      if (part.type === "text") {
        return parseTitle(part.text);
      }
    }
  }
  return "Clip";
}
