import type { UIMessageChunk } from "@ai-v5-sdk/ai";
import { getPotentialStartIndex } from "./utils";

export function createReasoningMiddleware(tag = "think") {
  const tagStart = `<${tag}>`;
  const tagEnd = `</${tag}>`;
  let countReasoning = 0;
  let textId = "";
  let buffer = "";
  let isFirstText = true;
  let pendingTextStart: UIMessageChunk | undefined = undefined;
  let isFirstReasoning = true;
  let isReasoning = false;

  function getReasoningId() {
    return `reasoning-${countReasoning}`;
  }

  return (stream: ReadableStream<UIMessageChunk>) => {
    return stream.pipeThrough(
      new TransformStream<UIMessageChunk, UIMessageChunk>({
        transform(chunk, controller) {
          if (chunk.type === "text-start") {
            textId = chunk.id;
            pendingTextStart = chunk;
            return;
          }

          if (chunk.type === "text-end") {
            textId = "";
          }

          if (chunk.type !== "text-delta") {
            controller.enqueue(chunk);
            return;
          }

          buffer += chunk.delta;

          function publish(text: string) {
            const isEmptyText = text.trim().length === 0;
            if (isReasoning) {
              if (isFirstReasoning && isEmptyText) {
                // Skip
              } else {
                controller.enqueue({
                  id: getReasoningId(),
                  type: "reasoning-delta",
                  delta: text,
                });
              }
              isFirstReasoning = false;
            } else {
              if (isFirstText && isEmptyText) {
                // Skip
              } else {
                if (pendingTextStart) {
                  controller.enqueue(pendingTextStart);
                  pendingTextStart = undefined;
                }
                controller.enqueue({
                  id: textId,
                  type: "text-delta",
                  delta: text,
                });
                isFirstText = false;
              }
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

              const foundFullEndMatch =
                endIndex + tagEnd.length <= buffer.length;

              if (foundFullEndMatch) {
                buffer = buffer.slice(endIndex + tagEnd.length);
                isReasoning = false;
                controller.enqueue({
                  type: "reasoning-end",
                  id: getReasoningId(),
                });
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
                countReasoning++;
                controller.enqueue({
                  type: "reasoning-start",
                  id: getReasoningId(),
                });
              } else {
                buffer = buffer.slice(startIndex);
                break;
              }
            }

            // biome-ignore lint/correctness/noConstantCondition: This loop intentionally runs indefinitely, processing the buffer in chunks until no more complete tags can be found. The loop breaks internally based on buffer content and parsing progress.
          } while (true);
        },
      }),
    );
  };
}
