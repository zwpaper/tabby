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
    const statusOrder = {
      cancelled: -1,
      completed: 0,
      pending: 1,
      "in-progress": 1,
    };
    const priorityOrder = { low: 0, medium: 1, high: 2 };

    // Higher status order first (in-progress, then pending, then completed)
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[b.status] - statusOrder[a.status];
    }

    // If statuses are the same, sort by priority (higher priority first)
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }

    return 0;
  });

  // Filter out cancelled todos
  return ret.filter((todo) => todo.status !== "cancelled");
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
  const [todos, setTodosImpl] = useState<Todo[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies(todosRef): todosRef is a ref
  const setTodos = useCallback((newTodos: Todo[]) => {
    todosRef.current = newTodos;
    setTodosImpl(newTodos);
  }, []);

  useEffect(() => {
    if (initialTodos) {
      setTodos(initialTodos);
    }
  }, [initialTodos, setTodos]);

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
