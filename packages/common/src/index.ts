import type { DB } from "@ragdoll/db";

export type UserEvent = {
  type: string;
  data: unknown;
};

export type TaskEvent = {
  type: "task:status-changed";
  data: {
    taskId: number;
    status: DB["task"]["status"]["__select__"];
  };
};

export type { Todo } from "./todo";
export { ZodTodo } from "./todo";
export { ZodEnvironment, type Environment } from "./environment";
export {
  type DBMessage,
  toUIMessage,
  toUIMessages,
  fromUIMessage,
  fromUIMessages,
} from "./message";

export { prompts } from "./prompts";
export { formatters } from "./formatters";
