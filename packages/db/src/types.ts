import type { UIMessage } from "ai";
import type { DB } from ".";

export type DBMessage = {
  id: string;
  createdAt: string;
  role: UIMessage["role"];
  parts: Array<Exclude<UIMessage["parts"][number], { type: "source" }>>;
  experimental_attachments?: UIMessage["experimental_attachments"];
};

export type TaskCreateEvent =
  | {
      type: "slack:new-task";
      data: {
        slackUserId?: string;
        channel: string;
        ts: string;
        prompt: string;
      };
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
        promptIndex: number;
        totalPrompts: number;
      };
    };

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

export type TaskEvent = {
  type: "task:status-changed";
  data: {
    uid: string;
    status: DB["task"]["status"]["__select__"];
  };
};
