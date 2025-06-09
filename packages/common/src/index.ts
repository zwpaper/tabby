import type { DB, UserEvent } from "@ragdoll/db";
export { type Todo, ZodTodo } from "@ragdoll/db";

export type UserEventDataHelper<T extends UserEvent["type"]> = Extract<
  UserEvent,
  { type: T }
>["data"];

export type TaskEvent = {
  type: "task:status-changed";
  data: {
    taskId: number;
    status: DB["task"]["status"]["__select__"];
  };
};

export {
  ZodEnvironment,
  type Environment,
  type GitStatus,
  type UserEvent,
  type TaskError,
} from "@ragdoll/db";
export {
  appendDataPart,
  fromUIMessage,
  fromUIMessages,
  toUIMessage,
  toUIMessages,
  type DataPart,
  type DBMessage,
} from "./message";
export { mergeTodos, findTodos } from "./todo-utils";

export { formatters } from "./formatters";
export { attachTransport, getLogger } from "./logger";
export { prompts } from "./prompts";

export { SocialLinks } from "./social";
