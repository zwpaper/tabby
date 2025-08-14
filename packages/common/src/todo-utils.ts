import type { UIMessage as UIMessageNext } from "@ai-v5-sdk/ai";
import type { Todo } from "@getpochi/tools";
import type { DBMessage } from "@ragdoll/db";

export function mergeTodos(todos: Todo[], newTodos: Todo[]): Todo[] {
  // If newTodos is empty, return existing todos
  if (newTodos.length === 0) {
    return todos;
  }

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

  return ret;
}

export function findTodos(message: DBMessage): Todo[] | undefined {
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
        (part.toolInvocation.state === "call" ||
          part.toolInvocation.state === "result")
      ) {
        return mergeTodos(acc, part.toolInvocation.args.todos);
      }
      return acc;
    }, [] as Todo[]);

  return todos;
}

export function findTodosNext(message: UIMessageNext): Todo[] | undefined {
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
        part.type === "tool-todoWrite" &&
        (part.state === "input-available" || part.state === "output-available")
      ) {
        const input = part.input as { todos: Todo[] };
        return mergeTodos(acc, input.todos);
      }
      return acc;
    }, [] as Todo[]);

  return todos;
}
