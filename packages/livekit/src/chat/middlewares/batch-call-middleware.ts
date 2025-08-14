import { InvalidToolInputError } from "@ai-v5-sdk/ai";
import type {
  LanguageModelV2Middleware,
  LanguageModelV2StreamPart,
} from "@ai-v5-sdk/provider";
import { safeParseJSON } from "@ai-v5-sdk/provider-utils";
import { BatchCallTools, ClientTools } from "@getpochi/tools";

export function createBatchCallMiddleware(): LanguageModelV2Middleware {
  return {
    middlewareVersion: "v2",
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

function createBatchCallTransformStream(): TransformStream<
  LanguageModelV2StreamPart,
  LanguageModelV2StreamPart
> {
  let batchCallId = "";
  return new TransformStream<
    LanguageModelV2StreamPart,
    LanguageModelV2StreamPart
  >({
    async transform(chunk, controller) {
      if (chunk.type === "tool-input-delta" && chunk.id === batchCallId) {
        return;
      }

      if (chunk.type === "tool-input-start" && chunk.toolName === "batchCall") {
        batchCallId = chunk.id;
        return;
      }

      if (chunk.type === "tool-input-end" && chunk.id === batchCallId) {
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

      const parsedResult = await safeParseJSON({
        text: chunk.input,
        schema: ClientTools.batchCall.inputSchema,
      });
      if (!parsedResult.success) {
        throw new InvalidToolInputError({
          toolName: "batchCall",
          toolInput: chunk.input,
          cause: parsedResult.error,
        });
      }

      const parameters = parsedResult.value;

      const { invocations } = parameters;
      for (const [index, invocation] of invocations.entries()) {
        if (!BatchCallTools.includes(invocation.toolName)) {
          continue;
        }
        controller.enqueue({
          type: "tool-call",
          toolCallId: `batch-${chunk.toolCallId}-${index}`,
          input: JSON.stringify(invocation.args),
          toolName: invocation.toolName,
        });
      }
    },
  });
}
