import { apiClient } from "@/lib/auth-client";
import { useChatStore } from "@/lib/stores/chat-store";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useStore } from "zustand/react";

export type Models = ReturnType<typeof useModels>["data"];

export function useModels() {
  const result = useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const res = await apiClient.api.models.$get();
      return await res.json();
    },
  });
  return result;
}

export function useSelectedModels() {
  const selectedModelId = useStore(
    useChatStore,
    (state) => state.selectedModelId,
  );
  const { data, isLoading, ...rest } = useModels();
  const updateSelectedModelId = useChatStore((x) => x.updateSelectedModelId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: watching isLoading is sufficient
  useEffect(() => {
    if (!isLoading) {
      // init model
      const validModelId = getModelIdFromModelInfo(selectedModelId, data);
      updateSelectedModelId(validModelId);
    }
  }, [isLoading]);

  const selectedModel = data?.find((x) => x.id === selectedModelId);

  return {
    ...rest,
    isLoading,
    models: data,
    selectedModel,
  };
}

function getModelIdFromModelInfo(modelId: string | undefined, models: Models) {
  if (!models?.length) return undefined;

  const targetModel = modelId
    ? models.find((x) => x.id === modelId)
    : undefined;

  if (targetModel) {
    return targetModel.id;
  }

  // return the first model by default
  return models[0].id;
}
