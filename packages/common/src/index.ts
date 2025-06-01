import type { DB } from "@ragdoll/db";

export type UserEvent =
  | {
      type: "website:new-project";
      data: {
        requestId: string;
        name?: string;
        prompt: string;
        attachments?: {
          url: string;
          name?: string;
          contentType?: string;
        }[];
        githubTemplateUrl?: string;
      };
    }
  | {
      type: "batch:evaluation";
      data: {
        batchId: string;
        githubTemplateUrl: string;
        prompt: string;
        startedAt: string;
        projectDirectory: string;
      };
    }
  | {
      type: string;
      data: unknown;
    };

export type UserEventDataHelper<T extends UserEvent["type"]> = Extract<
  UserEvent,
  { type: T }
>["data"];

export type TaskEvent = {
  type: "task:status-changed";
  data: {
    taskId: number;
    status: DB["task"]["statusMigrate"]["__select__"];
  };
};

export type { Todo } from "./todo";
export { ZodTodo } from "./todo";
export {
  ZodEnvironment,
  type Environment,
  type GitStatus,
} from "./environment";
export {
  type DBMessage,
  type DataPart,
  appendDataPart,
  toUIMessage,
  toUIMessages,
  fromUIMessage,
  fromUIMessages,
} from "./message";

export { prompts } from "./prompts";
export { formatters } from "./formatters";
