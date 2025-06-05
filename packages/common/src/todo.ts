import type { UIMessage } from "ai";
import { z } from "zod";

export const ZodTodo = z.object({
  id: z
    .string()
    .describe('The unique identifier of the task, e.g "collect-information".'),
  content: z.string().describe("The content of the task."),
  status: z
    .enum(["pending", "in-progress", "completed", "cancelled"])
    .describe("The status of the task."),
  priority: z
    .enum(["low", "medium", "high"])
    .describe("The priority of the task."),
});

export type Todo = z.infer<typeof ZodTodo>;

export function mergeTodos(todos: Todo[], newTodos: Todo[]): Todo[] {
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

export function findTodos(message: UIMessage) {
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
