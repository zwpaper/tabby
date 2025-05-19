import type { UseChatHelpers } from "@ai-sdk/react";
import { isAssistantMessageWithCompletedToolCalls } from "@ai-sdk/ui-utils";
import type { Message, UIMessage } from "ai";
import { useEffect, useRef } from "react";
import type { DataPart } from "../utils/message";

export interface Props {
  autoResume: boolean;
  initialMessages: Message[];
  experimental_resume: UseChatHelpers["experimental_resume"];
  data: UseChatHelpers["data"];
  setMessages: UseChatHelpers["setMessages"];
}

export function useAutoResume({
  autoResume,
  initialMessages,
  experimental_resume,
  data,
  setMessages,
}: Props) {
  const executed = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once.
  useEffect(() => {
    if (!autoResume || executed.current) return;

    const lastMessage = initialMessages.at(-1);
    if (!lastMessage) return;

    if (
      lastMessage.role === "user" ||
      isAssistantMessageWithCompletedToolCalls(lastMessage as UIMessage)
    ) {
      executed.current = true;
      experimental_resume();
    }
  }, [autoResume]);

  useEffect(() => {
    if (!data || data.length === 0) return;
    const dataParts = data as DataPart[];

    for (const part of dataParts) {
      if (part.type === "append-message") {
        const message = JSON.parse(part.message) as Message;
        setMessages([...initialMessages, message]);
        return;
      }
    }
  }, [data, initialMessages, setMessages]);
}
