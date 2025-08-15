import { formatters, prompts } from "@ragdoll/common";
import type { Message, RequestData } from "../types";
import { requestLLM } from "./llm";

export async function compactTask({
  getLLM,
  messages,
  overwrite,
}: {
  getLLM: () => RequestData["llm"];
  messages: Message[];
  overwrite: boolean;
}): Promise<string | undefined> {
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    return;
  }

  if (lastMessage.role === "user") {
    if (lastMessage.metadata?.kind === "user" && lastMessage.metadata.compact) {
      // DO Nothing.
    } else {
      return;
    }
  }

  const llm = getLLM();
  try {
    const text = prompts.inlineCompact(
      await createSummary(llm, messages.slice(0, -1)),
      messages.length - 1,
    );
    if (overwrite) {
      lastMessage.parts.unshift({
        type: "text",
        text,
      });
    }
    return text;
  } catch (err) {
    console.warn("Failed to create summary", err);
  }
}

async function createSummary(
  llm: RequestData["llm"],
  inputMessages: Message[],
) {
  const messages: Message[] = formatters.llm([
    ...inputMessages,
    {
      id: crypto.randomUUID(),
      role: "user",
      parts: [
        {
          type: "text",
          text: "Please provide a concise summary of the conversation above, focusing on key topics, decisions, and important context that should be preserved. It shall contains no more than 2000 words",
        },
      ],
    },
  ]);

  const stream = await requestLLM(undefined, llm, {
    messages,
    system: prompts.compact(),
  });

  const reader = stream.getReader();
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();

      // If 'done' is true, the stream has finished.
      if (done) {
        break;
      }

      if (value.type === "text-delta") {
        text += value.delta;
      }
    }
  } finally {
    // It's important to release the lock on the reader
    // so the stream can be used elsewhere if needed.
    reader.releaseLock();
  }

  return text;
}
