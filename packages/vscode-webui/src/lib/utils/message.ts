import type { UIMessage } from "@ai-sdk/ui-utils";
import type { CoreMessage } from "ai";
import { convertToCoreMessages } from "ai";

export function createCoreMessagesForCopy(
  messages: UIMessage[],
): CoreMessage[] {
  return convertToCoreMessages(
    messages.map((message) => {
      const ret = {
        ...message,
      };

      if (message.role === "assistant") {
        ret.parts = message.parts.filter(
          (part) =>
            part.type !== "tool-invocation" ||
            part.toolInvocation.state === "result",
        );
      }
      return ret;
    }),
  );
}

export type DataPart =
  | {
      type: "append-message";
      message: string;
    }
  | {
      type: "append-id";
      id: number;
    };
