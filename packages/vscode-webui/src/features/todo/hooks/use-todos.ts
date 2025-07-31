import type { Message } from "@ai-sdk/react";
import type { UIMessage } from "@ai-sdk/ui-utils";
import type { Todo } from "@getpochi/tools";
import { prompts } from "@ragdoll/common";
import { hasAttemptCompletion } from "@ragdoll/common/message-utils";
import { findTodos, mergeTodos } from "@ragdoll/common/todo-utils";
import { useCallback, useEffect, useState } from "react";

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

  // biome-ignore lint/correctness/useExhaustiveDependencies(todosRef.current): todosRef is a ref
  useEffect(() => {
    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      lastMessage.parts !== undefined
    ) {
      updateTodos(lastMessage as UIMessage);

      // Auto-mark todos as completed if this message has attempt completion
      if (hasAttemptCompletion(lastMessage as UIMessage)) {
        const currentTodos = todosRef.current || [];
        if (currentTodos.length > 0) {
          const updatedTodos = currentTodos.map((todo) => {
            if (todo.status !== "cancelled") {
              return { ...todo, status: "completed" as const };
            }
            return todo;
          });

          const hasChanges = updatedTodos.some(
            (todo, index) => todo.status !== currentTodos[index]?.status,
          );

          if (hasChanges) {
            setTodos(updatedTodos);
          }
        }
      }
    }

    if (
      lastMessage &&
      lastMessage.role === "user" &&
      !prompts.isSystemReminder(lastMessage.content)
    ) {
      const todos = todosRef.current || [];
      // Check if all todos is canceled or done.
      const allTodosDoneOrCanceled = todos.every(
        (todo) => todo.status === "completed" || todo.status === "cancelled",
      );

      if (allTodosDoneOrCanceled) {
        setTodos([]);
      }
    }
  }, [lastMessage, updateTodos, setTodos]);

  return {
    todosRef,
    todos,
  };
}
