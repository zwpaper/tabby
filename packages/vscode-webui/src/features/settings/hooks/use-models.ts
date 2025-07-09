import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useSettingsStore } from "../store";

export type Models = ReturnType<typeof useModels>["data"];

export function useModels() {
  const { enablePochiModels } = useSettingsStore();
  const { data, ...rest } = useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const res = await apiClient.api.models.$get();
      return await res.json();
    },
  });

  const models = useMemo(() => {
    if (!data) {
      return undefined;
    }
    if (enablePochiModels) {
      return data;
    }
    return data.filter((model) => !model.id.startsWith("pochi/"));
  }, [data, enablePochiModels]);

  return { data: models, ...rest };
}

export function useSelectedModels() {
  const { selectedModelId, updateSelectedModelId } = useSettingsStore();
  const { data: models, isLoading, ...rest } = useModels();

  useEffect(() => {
    if (!isLoading) {
      // init model
      const validModelId = getModelIdFromModelInfo(selectedModelId, models);
      updateSelectedModelId(validModelId);
    }
  }, [isLoading, models, selectedModelId, updateSelectedModelId]);

  const selectedModel = models?.find((x) => x.id === selectedModelId);

  return {
    ...rest,
    isLoading,
    models,
    selectedModel,
    updateSelectedModelId,
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
