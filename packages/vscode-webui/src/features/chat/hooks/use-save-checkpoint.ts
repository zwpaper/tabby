import { vscodeHost } from "@/lib/vscode";
import type { ExtendedStepStartPart } from "@ragdoll/common";
import type { Message, UIMessage } from "ai";
import { useCallback } from "react";
import { useSettingsStore } from "../../settings/store";

export const useSaveCheckpoint = (
  messages: UIMessage[],
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[]),
  ) => void,
  uid: React.MutableRefObject<string | undefined>,
) => {
  const { enableCheckpoint } = useSettingsStore();
  const saveCheckpoint = useCallback(
    async (toolCallId: string) => {
      if (!enableCheckpoint) {
        return;
      }

      const lastMessage = messages.at(-1);

      if (!lastMessage) {
        return;
      }

      if (lastMessage.role !== "assistant") {
        return;
      }

      // find latest "step-start" parts before current tool call and check if the checkpoint exists
      const toolCallIndex = lastMessage.parts.findIndex(
        (part) =>
          part.type === "tool-invocation" &&
          part.toolInvocation.toolCallId === toolCallId,
      );

      if (toolCallIndex === -1) {
        return;
      }

      const latestStepStartIndex = lastMessage.parts.findLastIndex(
        (part, index) => part.type === "step-start" && index < toolCallIndex,
      );

      if (latestStepStartIndex === -1) {
        return;
      }

      const latestStepStart = lastMessage.parts[latestStepStartIndex];
      // Check if the checkpoint exists
      const checkpointExists =
        (latestStepStart as ExtendedStepStartPart | undefined)?.checkpoint
          ?.commit !== undefined;

      if (checkpointExists) {
        return;
      }

      // Save the checkpoint
      const commitHash = await vscodeHost.saveCheckpoint(`task-${uid.current}`);

      const stepWithCheckpoint: ExtendedStepStartPart = {
        type: "step-start",
        checkpoint: { commit: commitHash },
      };

      lastMessage.parts = lastMessage.parts.map((part, index) => {
        if (index === latestStepStartIndex) {
          return stepWithCheckpoint;
        }
        return part;
      });

      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        updatedMessages[updatedMessages.length - 1] = lastMessage;
        return updatedMessages;
      });
    },
    [enableCheckpoint, messages, setMessages, uid],
  );

  return saveCheckpoint;
};
