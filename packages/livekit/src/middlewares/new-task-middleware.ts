import type { InferToolInput, UIMessageChunk } from "@ai-v5-sdk/ai";
import type { ClientToolsV5Type } from "@getpochi/tools";
import type { Store } from "@livestore/livestore";
import { events } from "../livestore/schema";

export function createNewTaskMiddleware(store: Store, parentTaskId: string) {
  return (stream: ReadableStream<UIMessageChunk>) => {
    let toolCallId = "";
    return stream.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          if (
            chunk.type === "tool-input-start" &&
            chunk.toolName === "newTask"
          ) {
            toolCallId = chunk.toolCallId;
            return;
          }

          if (
            chunk.type === "tool-input-delta" &&
            chunk.toolCallId === toolCallId
          ) {
            return;
          }

          if (
            chunk.type === "tool-input-available" &&
            chunk.toolCallId === toolCallId
          ) {
            const arg = chunk.input as InferToolInput<
              ClientToolsV5Type["newTask"]
            >;
            const uid = crypto.randomUUID();
            arg._meta = {
              uid,
            };
            store.commit(
              events.taskInited({
                id: uid,
                parentId: parentTaskId,
                createdAt: new Date(),
                initMessage: {
                  id: crypto.randomUUID(),
                  parts: [
                    {
                      type: "text",
                      text: arg.prompt,
                    },
                  ],
                },
              }),
            );

            controller.enqueue({
              ...chunk,
            });
            toolCallId = "";
            return;
          }

          controller.enqueue(chunk);
        },
      }),
    );
  };
}
