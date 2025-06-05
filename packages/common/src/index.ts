import type { DB } from "@ragdoll/db";
import type { KnownEventFromType } from "@slack/bolt";

export type UserEvent =
  | {
      type: "slack:new-task";
      data: KnownEventFromType<"message">;
    }
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
    status: DB["task"]["status"]["__select__"];
  };
};

export {
  ZodEnvironment,
  type Environment,
  type GitStatus,
} from "./environment";
export {
  appendDataPart,
  fromUIMessage,
  fromUIMessages,
  toUIMessage,
  toUIMessages,
  type DataPart,
  type DBMessage,
} from "./message";
export { ZodTodo } from "./todo";
export type { Todo } from "./todo";

export { formatters } from "./formatters";
export { attachTransport, getLogger } from "./logger";
export { prompts } from "./prompts";

export type TaskError = {
  message: string;
} & (
  | {
      kind: "InternalError";
    }
  | {
      kind: "APICallError";
      requestBodyValues: unknown;
    }
  | {
      kind: "AbortError";
    }
);

export { SocialLinks } from "./social";
