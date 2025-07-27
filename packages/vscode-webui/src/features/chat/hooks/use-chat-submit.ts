import type { PendingApproval } from "@/features/approval";
import type { useImageUpload } from "@/lib/hooks/use-image-upload";
import type { UseChatHelpers } from "@ai-sdk/react";
import type React from "react";
import { type MutableRefObject, useCallback } from "react";
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
  recentAborted: MutableRefObject<boolean>;
}

export function useChatSubmit({
  chat,
  imageUpload,
  isSubmitDisabled,
  isLoading,
  pendingApproval,
  recentAborted,
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
      recentAborted.current = true;
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
    recentAborted,
  ]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>, prompt?: string) => {
      e?.preventDefault();
      if (recentAborted.current) {
        return;
      }
      autoApproveGuard.current = true;

      if (isSubmitDisabled && !prompt) {
        return;
      }

      handleStop();
      if (recentAborted.current) {
        // break isLoading, we need to wait for some time to avoid racing between stop and submit.
        await new Promise((resolve) => setTimeout(resolve, 25));
      }

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
      recentAborted,
    ],
  );

  return { handleSubmit, handleStop };
}
