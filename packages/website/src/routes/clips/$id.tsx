import { createFileRoute } from "@tanstack/react-router";

import { TaskContent } from "@/components/task/content";
import { TaskHeader } from "@/components/task/header";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiClient } from "@/lib/auth-client";
import { normalizeApiError, toHttpError } from "@/lib/error";
import { cn } from "@/lib/utils";
import type { Todo } from "@getpochi/tools";
import { toUIMessages } from "@ragdoll/common";
import { parseTitle } from "@ragdoll/common/message-utils";
import { findTodos, mergeTodos } from "@ragdoll/common/todo-utils";
import type { UIMessage } from "ai";
import { useEffect, useState } from "react";

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
      const { data, updatedAt } = await response.json();
      const messages = toUIMessages(data.messages || []);
      const title = createTitle(messages);
      const todos = createTodos(messages);
      return {
        messages,
        title,
        todos,
        updatedAt,
      };
    } catch (error) {
      throw normalizeApiError(error);
    }
  },
  component: ThemeWrapped,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData.title,
      },
    ],
  }),
});

function ThemeWrapped() {
  return (
    <ThemeProvider storageKey="pochi-clip-theme" defaultTheme="light">
      <ClipView />
    </ThemeProvider>
  );
}

function ClipView() {
  const { theme } = useTheme();
  const { messages, todos, title, updatedAt } = Route.useLoaderData();

  if (!messages || messages.length === 0) {
    return (
      <div className="p-4">
        <p>No messages in this clip.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-4 flex max-w-6xl flex-1 flex-col space-y-8 md:mt-6">
      <TaskHeader>
        <TaskHeader.Title title={title}>
          <ThemeToggle />
        </TaskHeader.Title>
        <TaskHeader.Subtitle updatedAt={updatedAt}>
          {false && <GetPochiButton />}
        </TaskHeader.Subtitle>
      </TaskHeader>
      <TaskContent
        messages={messages}
        todos={todos}
        title={title}
        user={{
          name: "You",
          image: `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(title)}&scale=150`,
        }}
        theme={theme}
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

function GetPochiButton() {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowButton(true);
    }, 2_000); // 2 seconds

    return () => clearTimeout(timer);
  }, []);

  if (!showButton) return;

  return (
    <a
      href="https://app.getpochi.com"
      target="_blank"
      className={cn(
        "font-medium text-xs",
        "fade-in-0 slide-in-from-bottom-2 animate-in",
        "transition-all duration-500 ease-out",
        "opacity-80 hover:opacity-100",
      )}
      rel="noreferrer"
    >
      ✨ Get Pochi!
    </a>
  );
}
