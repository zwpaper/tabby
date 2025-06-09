import { useToolCallLifeCycle } from "../lib/chat-state";

interface UseChatStatusProps {
  isTaskLoading: boolean;
  isModelsLoading: boolean;
  isLoading: boolean;
  isEditMode: boolean;
  isInputEmpty: boolean;
  isFilesEmpty: boolean;
  isUploadingImages: boolean;
}

export function useChatStatus({
  isTaskLoading,
  isModelsLoading,
  isLoading,
  isEditMode,
  isInputEmpty,
  isFilesEmpty,
  isUploadingImages,
}: UseChatStatusProps) {
  const { executingToolCalls } = useToolCallLifeCycle();
  const isExecuting = executingToolCalls.length > 0;

  const isBusyCore = isTaskLoading || isModelsLoading;

  const isBusy = isBusyCore || isExecuting || isLoading;

  const showEditTodos = !isBusy;

  const isSubmitDisabled =
    isBusyCore ||
    isEditMode ||
    (!isLoading && isInputEmpty && isFilesEmpty && !isExecuting);

  const showStopButton = isExecuting || isLoading || isUploadingImages;

  return {
    isExecuting,
    isBusyCore,
    isBusy,
    showEditTodos,
    isSubmitDisabled,
    showStopButton,
  };
}
