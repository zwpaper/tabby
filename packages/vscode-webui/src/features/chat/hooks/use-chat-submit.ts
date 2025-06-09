import type { PendingApproval } from "@/features/approval";
import { apiClient } from "@/lib/auth-client";
import type { useImageUpload } from "@/lib/hooks/use-image-upload";
import type { UseChatHelpers } from "@ai-sdk/react";
import { fromUIMessages } from "@ragdoll/common";
import type React from "react";
import { useCallback } from "react";
import { useAutoApproveGuard, useToolCallLifeCycle } from "../lib/chat-state";

type UseChatReturn = Pick<
  UseChatHelpers,
  "append" | "setInput" | "input" | "messages" | "stop"
>;

type UseImageUploadReturn = ReturnType<typeof useImageUpload>;

interface UseChatSubmitProps {
  chat: UseChatReturn;
  imageUpload: UseImageUploadReturn;
  isSubmitDisabled: boolean;
  isLoading: boolean;
  taskId: React.MutableRefObject<number | undefined>;
  pendingApproval: PendingApproval | undefined;
}

export function useChatSubmit({
  chat,
  imageUpload,
  isSubmitDisabled,
  isLoading,
  taskId,
  pendingApproval,
}: UseChatSubmitProps) {
  const autoApproveGuard = useAutoApproveGuard();
  const { executingToolCalls } = useToolCallLifeCycle();
  const isExecuting = executingToolCalls.length > 0;
  const abortToolCalls = useCallback(() => {
    for (const toolCall of executingToolCalls) {
      toolCall.abort();
    }
  }, [executingToolCalls]);

  const { append, setInput, input, messages, stop: stopChat } = chat;
  const {
    files,
    isUploading,
    upload,
    cancelUpload,
    clearError: clearUploadImageError,
  } = imageUpload;

  const handleStop = useCallback(async () => {
    if (isExecuting) {
      abortToolCalls();
    } else if (isUploading) {
      cancelUpload();
    } else if (isLoading) {
      stopChat();
      if (taskId.current) {
        const lastMessage = messages.at(-1);
        if (lastMessage) {
          await apiClient.api.tasks[":id"].messages.$patch({
            param: {
              id: taskId.current.toString(),
            },
            json: {
              messages: fromUIMessages([lastMessage]),
            },
          });
        }
      }
    } else if (pendingApproval?.name === "retry") {
      pendingApproval.stopCountdown();
    }
  }, [
    isExecuting,
    isUploading,
    isLoading,
    taskId,
    messages,
    pendingApproval,
    abortToolCalls,
    cancelUpload,
    stopChat,
  ]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      autoApproveGuard.current = true;
      e?.preventDefault();

      if (isSubmitDisabled) {
        return;
      }

      await handleStop();

      if (files.length > 0) {
        try {
          const uploadedImages = await upload();

          append({
            role: "user",
            content: !input.trim() ? " " : input,
            experimental_attachments: uploadedImages,
          });

          setInput("");
        } catch (error) {
          // Error is already handled by the hook
          return;
        }
      } else if (input.trim()) {
        clearUploadImageError();
        append({
          role: "user",
          content: input,
        });
        setInput("");
      }
    },
    [
      isSubmitDisabled,
      handleStop,
      files.length,
      input,
      autoApproveGuard,
      upload,
      append,
      setInput,
      clearUploadImageError,
    ],
  );

  return { handleSubmit, handleStop };
}
