import { ClientTools } from "@getpochi/tools";
import type { LanguageModelV1Middleware, LanguageModelV1StreamPart } from "ai";
import { taskService } from "../service/task";

export interface NewTaskMiddlewareContext {
  userId: string;
  parentId: string;
}

function createNewTaskTransformStream(
  context: NewTaskMiddlewareContext,
): TransformStream<LanguageModelV1StreamPart, LanguageModelV1StreamPart> {
  return new TransformStream<
    LanguageModelV1StreamPart,
    LanguageModelV1StreamPart
  >({
    async transform(chunk, controller) {
      if (chunk.type === "tool-call-delta" && chunk.toolName === "newTask") {
        return;
      }

      if (chunk.type !== "tool-call") {
        controller.enqueue(chunk);
        return;
      }

      if (chunk.toolName !== "newTask") {
        controller.enqueue(chunk);
        return;
      }

      const parameters = ClientTools.newTask.parameters.safeParse(
        JSON.parse(chunk.args),
      );

      if (parameters.error) {
        controller.enqueue({
          type: "error",
          error: parameters.error,
        });
        return;
      }

      const { prompt } = parameters.data;
      const uid = await taskService.createWithUserMessage(
        context.userId,
        prompt,
        undefined, // event
        context.parentId,
      );
      controller.enqueue({
        ...chunk,
        args: JSON.stringify({
          ...parameters.data,
          _meta: {
            uid,
          },
        } satisfies typeof parameters.data),
      });
    },
  });
}

export function createNewTaskMiddleware(
  context: NewTaskMiddlewareContext,
): LanguageModelV1Middleware {
  return {
    middlewareVersion: "v1",
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream();
      const transformStream = createNewTaskTransformStream(context);
      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      };
    },
    transformParams: async ({ params }) => {
      const tools =
        (params.mode.type === "regular" ? params.mode.tools : []) ?? [];
      for (const x of tools) {
        if (x.name !== "newTask") continue;
        if (x.type === "function") {
          if (x.parameters?.properties) {
            // biome-ignore lint/performance/noDelete: type safe
            delete x.parameters.properties._meta;
          }
        }
      }

      return {
        ...params,
      };
    },
  };
}
