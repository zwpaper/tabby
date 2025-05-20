import { useSettingsStore } from "@/lib/stores/settings-store";
import type { Message, UIMessage } from "@ai-sdk/ui-utils";
import type { Todo } from "@ragdoll/server";
import { useCallback, useEffect, useState } from "react";

function mergeTodos(todos: Todo[], newTodos: Todo[]): Todo[] {
  const todoMap = new Map(todos.map((todo) => [todo.id, todo]));
  for (const newTodo of newTodos) {
    todoMap.set(newTodo.id, newTodo);
  }

  const ret = Array.from(todoMap.values());
  ret.sort((a, b) => {
    const priorityOrder = { low: 0, medium: 1, high: 2 };
    // Sort by priority first, then by content for stable sort
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority]; // Higher priority first
    }
    return a.content.localeCompare(b.content);
  });
  return ret;
}

function findTodos(message: UIMessage) {
  if (message.role !== "assistant") {
    return;
  }
  const lastStepStartIndex = message.parts.reduce((lastIndex, part, index) => {
    return part.type === "step-start" ? index : lastIndex;
  }, -1);

  const todos = message.parts
    .slice(lastStepStartIndex + 1)
    .reduce((acc, part) => {
      if (
        part.type === "tool-invocation" &&
        part.toolInvocation.toolName === "todoWrite" &&
        part.toolInvocation.state === "call"
      ) {
        return mergeTodos(acc, part.toolInvocation.args.todos);
      }
      return acc;
    }, [] as Todo[]);

  return todos;
}

export function useTodos({
  initialTodos,
  messages,
  todosRef,
}: {
  initialTodos?: Todo[];
  messages: Message[];
  todosRef: React.MutableRefObject<Todo[] | undefined>;
}) {
  const enableTodos = useSettingsStore((state) => state.enableTodos);
  const [todos, setTodosImpl] = useState<Todo[] | undefined>(
    enableTodos ? [] : undefined,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies(todosRef): todosRef is a ref
  const setTodos = useCallback((newTodos: Todo[] | undefined) => {
    todosRef.current = newTodos;
    setTodosImpl(newTodos);
  }, []);

  useEffect(() => {
    if (enableTodos && initialTodos) {
      setTodos(initialTodos);
    }
  }, [enableTodos, initialTodos, setTodos]);

  // biome-ignore lint/correctness/useExhaustiveDependencies(todosRef.current): todosRef is a ref
  const updateTodos = useCallback(
    (message: UIMessage) => {
      const newTodos = findTodos(message);
      if (newTodos !== undefined) {
        setTodos(mergeTodos(todosRef.current || [], newTodos));
      }
    },
    [setTodos],
  );

  const lastMessage = messages.at(-1);
  useEffect(() => {
    if (lastMessage && lastMessage.parts !== undefined) {
      updateTodos(lastMessage as UIMessage);
    }
  }, [lastMessage, updateTodos]);

  return {
    todosRef,
    todos,
  };
}
