import type { PendingApproval } from "@/features/approval";
import type { useImageUpload } from "@/lib/hooks/use-image-upload";
import type { UseChatHelpers } from "@ai-sdk/react";
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
  pendingApproval: PendingApproval | undefined;
}

export function useChatSubmit({
  chat,
  imageUpload,
  isSubmitDisabled,
  isLoading,
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

  const { append, setInput, input, stop: stopChat } = chat;
  const {
    files,
    isUploading,
    upload,
    cancelUpload,
    clearError: clearUploadImageError,
  } = imageUpload;

  const handleStop = useCallback(() => {
    if (isExecuting) {
      abortToolCalls();
    } else if (isUploading) {
      cancelUpload();
    } else if (isLoading) {
      stopChat();
    } else if (pendingApproval?.name === "retry") {
      pendingApproval.stopCountdown();
    }
  }, [
    isExecuting,
    isUploading,
    isLoading,
    pendingApproval,
    abortToolCalls,
    cancelUpload,
    stopChat,
  ]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>, prompt?: string) => {
      autoApproveGuard.current = true;
      e?.preventDefault();

      if (isSubmitDisabled && !prompt) {
        return;
      }

      handleStop();

      const content = prompt || input.trim();
      if (files.length > 0) {
        try {
          const uploadedImages = await upload();

          append({
            role: "user",
            content: content.length === 0 ? " " : content,
            experimental_attachments: uploadedImages,
          });

          setInput("");
        } catch (error) {
          // Error is already handled by the hook
          return;
        }
      } else if (content.length > 0) {
        clearUploadImageError();
        append({
          role: "user",
          content,
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
