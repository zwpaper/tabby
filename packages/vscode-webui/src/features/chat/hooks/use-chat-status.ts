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

  return {
    isExecuting,
    isBusyCore,
    showEditTodos,
    isSubmitDisabled,
    showStopButton,
  };
}
