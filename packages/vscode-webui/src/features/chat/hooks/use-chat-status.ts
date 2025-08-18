import { useToolCallLifeCycle } from "../lib/chat-state";

interface UseChatStatusProps {
  isReadOnly: boolean;
  isModelsLoading: boolean;
  isLoading: boolean;
  isInputEmpty: boolean;
  isFilesEmpty: boolean;
  isUploadingImages: boolean;
  isCompacting: boolean;
}

export function useChatStatus({
  isReadOnly,
  isModelsLoading,
  isLoading,
  isInputEmpty,
  isFilesEmpty,
  isUploadingImages,
  isCompacting,
}: UseChatStatusProps) {
  const { executingToolCalls } = useToolCallLifeCycle();
  const isExecuting = executingToolCalls.length > 0;

  const isBusyCore = isModelsLoading || isCompacting;

  const showEditTodos = !isBusyCore;

  const isSubmitDisabled =
    isBusyCore ||
    isReadOnly ||
    (!isLoading && isInputEmpty && isFilesEmpty && !isExecuting);

  const showStopButton = isExecuting || isLoading || isUploadingImages;

  const showPreview = !isBusyCore;

  const showApproval = !isLoading;

  return {
    isExecuting,
    isBusyCore,
    showEditTodos,
    isSubmitDisabled,
    showStopButton,
    showPreview,
    showApproval,
  };
}
