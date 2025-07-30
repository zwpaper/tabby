import type { LanguageModelV1Middleware, LanguageModelV1StreamPart } from "ai";
import { getPotentialStartIndex } from "./tool-call-middleware/utils";

function createReasoningTransformStream(
  tagStart: string,
  tagEnd: string,
): TransformStream<LanguageModelV1StreamPart, LanguageModelV1StreamPart> {
  let buffer = "";
  let isFirstText = true;
  let isFirstReasoning = true;
  let isReasoning = false;
  return new TransformStream<
    LanguageModelV1StreamPart,
    LanguageModelV1StreamPart
  >({
    transform(chunk, controller) {
      if (chunk.type !== "text-delta") {
        controller.enqueue(chunk);
        return;
      }

      buffer += chunk.textDelta;

      function publish(text: string) {
        const isEmptyText = text.trim().length === 0;
        if (isReasoning) {
          if (isFirstReasoning && isEmptyText) {
            // Skip
          } else {
            controller.enqueue({
              type: "reasoning",
              textDelta: text,
            });
          }
          isFirstReasoning = false;
        } else {
          if (isFirstText && isEmptyText) {
            // Skip
          } else {
            controller.enqueue({
              type: "text-delta",
              textDelta: text,
            });
          }
          isFirstText = false;
        }
      }

      do {
        if (isReasoning) {
          const endIndex = getPotentialStartIndex(buffer, tagEnd);
          if (endIndex === null) {
            publish(buffer);
            buffer = "";
            break;
          }

          publish(buffer.slice(0, endIndex));

          const foundFullEndMatch = endIndex + tagEnd.length <= buffer.length;

          if (foundFullEndMatch) {
            buffer = buffer.slice(endIndex + tagEnd.length);
            isReasoning = false;
          } else {
            buffer = buffer.slice(endIndex);
            break;
          }
        } else {
          const startIndex = getPotentialStartIndex(buffer, tagStart);
          if (startIndex === null) {
            publish(buffer);
            buffer = "";
            break;
          }
          publish(buffer.slice(0, startIndex));
          const foundFullStartMatch =
            startIndex + tagStart.length <= buffer.length;
          if (foundFullStartMatch) {
            buffer = buffer.slice(startIndex + tagStart.length);
            isReasoning = true;
          } else {
            buffer = buffer.slice(startIndex);
            break;
          }
        }

        // biome-ignore lint/correctness/noConstantCondition: This loop intentionally runs indefinitely, processing the buffer in chunks until no more complete tags can be found. The loop breaks internally based on buffer content and parsing progress.
      } while (true);
    },
  });
}

export function createReasoningMiddleware(
  tag = "think",
): LanguageModelV1Middleware {
  return {
    middlewareVersion: "v1",
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream();
      const transformStream = createReasoningTransformStream(
        `<${tag}>`,
        `</${tag}>`,
      );
      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      };
    },
  };
}
