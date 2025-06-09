import type { UIMessage } from "ai";

export type DBMessage = {
  id: string;
  createdAt: string;
  role: UIMessage["role"];
  parts: Array<Exclude<UIMessage["parts"][number], { type: "source" }>>;
  experimental_attachments?: UIMessage["experimental_attachments"];
};

export type UserEvent =
  | {
      type: "slack:new-task";
      data: {
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
        startedAt: string;
        projectDirectory: string;
      };
    }
  | {
      type: string;
      data: unknown;
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
