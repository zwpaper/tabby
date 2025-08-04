import type { UseChatHelpers } from "@ai-sdk/react";
import { type DataPart, toUIMessage } from "@ragdoll/common";
import type { DBMessage } from "@ragdoll/db";
import { type MutableRefObject, useEffect, useState } from "react";

export const useForceCompactTask = ({
  forceCompact,
  append,
  enabled,
  data,
  setMessages,
}: {
  forceCompact: MutableRefObject<boolean>;
  append: UseChatHelpers["append"];
  enabled: boolean;
  data: unknown[] | undefined;
  setMessages: UseChatHelpers["setMessages"];
}) => {
  const [isCompactingTask, setIsCompactingTask] = useState(false);
  const handleCompactTask = async () => {
    if (isCompactingTask || !enabled) {
      return;
    }
    setIsCompactingTask(true);
    forceCompact.current = true;
    try {
      await append({
        role: "user",
        content:
          "I've summarized the task and please analysis the current status, and use askFollowUpQuestion with me to confirm the next steps",
      });
    } finally {
      forceCompact.current = false;
      setIsCompactingTask(false);
    }
  };

  useEffect(() => {
    if (!data || data.length === 0) return;

    const dataParts = data as DataPart[];
    for (const part of dataParts) {
      if (part.type === "compact") {
        try {
          setIsCompactingTask(false);
          const message = JSON.parse(part.message) as DBMessage;
          setMessages((messages) => {
            const existingIndex = messages.findIndex(
              (msg) => msg.id === message.id,
            );

            if (existingIndex !== -1) {
              // Update existing message
              const updatedMessages = [...messages];
              updatedMessages[existingIndex] = {
                ...updatedMessages[existingIndex],
                ...toUIMessage(message),
              };
              return updatedMessages;
            }
            return messages;
          });
        } catch (error) {
          console.error("Error parsing compact message", error);
        }
      }
    }
  }, [data, setMessages]);

  return { isCompactingTask, handleCompactTask };
};
