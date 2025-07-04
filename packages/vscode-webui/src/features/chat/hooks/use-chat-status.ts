import { useDebounceState } from "@/lib/hooks/use-debounce-state";
import { useEffect } from "react";
import { useToolCallLifeCycle } from "../lib/chat-state";

interface UseChatStatusProps {
  isTaskLoading: boolean;
  isModelsLoading: boolean;
  isLoading: boolean;
  isInputEmpty: boolean;
  isFilesEmpty: boolean;
  isUploadingImages: boolean;
}

export function useChatStatus({
  isTaskLoading,
  isModelsLoading,
  isLoading,
  isInputEmpty,
  isFilesEmpty,
  isUploadingImages,
}: UseChatStatusProps) {
  const { executingToolCalls } = useToolCallLifeCycle();
  const isExecuting = executingToolCalls.length > 0;

  const isBusyCore = isTaskLoading || isModelsLoading;

  const showEditTodos = !isBusyCore;

  const isSubmitDisabled =
    isBusyCore || (!isLoading && isInputEmpty && isFilesEmpty && !isExecuting);

  const showStopButton = isExecuting || isLoading || isUploadingImages;

  const showPreview = !isBusyCore;

  const [debouncedShowApproval, setDebouncedShowApproval] = useDebounceState(
    false,
    300,
  );

  const showApproval = !(isLoading || isTaskLoading);
  useEffect(() => {
    setDebouncedShowApproval(showApproval);
  }, [showApproval, setDebouncedShowApproval]);

  return {
    isExecuting,
    isBusyCore,
    showEditTodos,
    isSubmitDisabled,
    showStopButton,
    showPreview,
    showApproval: debouncedShowApproval,
  };
}
