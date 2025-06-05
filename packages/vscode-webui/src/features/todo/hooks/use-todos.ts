import type { Message, UIMessage } from "@ai-sdk/ui-utils";
import { type Todo, findTodos, mergeTodos } from "@ragdoll/common";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftTodos, setDraftTodos] = useState<Todo[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies(todosRef): todosRef is a ref
  const setTodos = useCallback((newTodos: Todo[]) => {
    todosRef.current = newTodos;
    setTodosImpl(newTodos);
  }, []);

  const enterEditMode = useCallback(() => {
    setDraftTodos([...todos]);
    setIsEditMode(true);
  }, [todos]);

  const exitEditMode = useCallback(() => {
    setIsEditMode(false);
    setDraftTodos([]);
  }, []);

  const saveTodos = useCallback(() => {
    setTodos(draftTodos);
    setIsEditMode(false);
    setDraftTodos([]);
  }, [draftTodos, setTodos]);

  const updateTodoStatus = useCallback(
    (todoId: string, newStatus: Todo["status"]) => {
      setDraftTodos(
        draftTodos.map((todo) => {
          if (todo.id === todoId) {
            return { ...todo, status: newStatus };
          }
          return todo;
        }),
      );
    },
    [draftTodos],
  );

  // Check if there are dirty changes between original todos and draft todos
  const hasDirtyChanges = useMemo(() => {
    if (!isEditMode) return false;

    // Compare the two arrays for differences
    if (todos.length !== draftTodos.length) return true;

    // Create maps for easier comparison
    const todosMap = new Map(todos.map((todo) => [todo.id, todo]));
    const draftTodosMap = new Map(draftTodos.map((todo) => [todo.id, todo]));

    // Check if all todos exist in draft and have same status
    for (const [id, todo] of todosMap) {
      const draftTodo = draftTodosMap.get(id);
      if (!draftTodo || draftTodo.status !== todo.status) {
        return true;
      }
    }

    // Check if draft has any todos not in original
    for (const [id] of draftTodosMap) {
      if (!todosMap.has(id)) {
        return true;
      }
    }

    return false;
  }, [isEditMode, todos, draftTodos]);

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
    isEditMode,
    draftTodos,
    hasDirtyChanges,
    enterEditMode,
    exitEditMode,
    saveTodos,
    updateTodoStatus,
  };
}
