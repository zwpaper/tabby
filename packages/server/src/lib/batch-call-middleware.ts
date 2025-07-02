import { BatchCallTools, ServerTools } from "@ragdoll/tools";
import type { LanguageModelV1Middleware, LanguageModelV1StreamPart } from "ai";

function createBatchCallTransformStream(): TransformStream<
  LanguageModelV1StreamPart,
  LanguageModelV1StreamPart
> {
  return new TransformStream<
    LanguageModelV1StreamPart,
    LanguageModelV1StreamPart
  >({
    transform(chunk, controller) {
      if (chunk.type === "tool-call-delta" && chunk.toolName === "batchCall") {
        return;
      }

      if (chunk.type !== "tool-call") {
        controller.enqueue(chunk);
        return;
      }

      if (chunk.toolName !== "batchCall") {
        controller.enqueue(chunk);
        return;
      }

      const parameters = ServerTools.batchCall.parameters.safeParse(
        JSON.parse(chunk.args),
      );

      if (parameters.error) {
        controller.enqueue({
          type: "error",
          error: parameters.error,
        });
        return;
      }

      const { invocations } = parameters.data;
      for (const [index, invocation] of invocations.entries()) {
        if (!BatchCallTools.includes(invocation.toolName)) {
          continue;
        }
        controller.enqueue({
          type: "tool-call",
          toolCallType: "function",
          toolCallId: `batch-${chunk.toolCallId}-${index}`,
          args: JSON.stringify(invocation.args),
          toolName: invocation.toolName,
        });
      }
    },
  });
}

export function createBatchCallMiddleware(): LanguageModelV1Middleware {
  return {
    middlewareVersion: "v1",
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream();
      const transformStream = createBatchCallTransformStream();
      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      };
    },
  };
}
