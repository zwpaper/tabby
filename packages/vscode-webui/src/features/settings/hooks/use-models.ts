import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useSettingsStore } from "../store";
import { useCustomModelSetting } from "./use-custom-model-setting";

export type DisplayModel =
  | {
      type: "hosted";
      id: string;
      name: string;
      contextWindow: number;
      costType: "basic" | "premium";
    }
  | {
      type: "byok";
      id: string;
      name: string;
      contextWindow: number;
      maxTokens: number;
      costType: "basic";
      provider: {
        baseURL: string;
        apiKey?: string;
      };
    };

export function useModels() {
  const { enablePochiModels } = useSettingsStore();
  const { data, isLoading } = useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const res = await apiClient.api.models.$get();
      return await res.json();
    },
  });

  const { customModelSettings, isLoading: isLoadingCustomModelSettings } =
    useCustomModelSetting();

  const customModels = useMemo(() => {
    return customModelSettings?.flatMap((modelSetting) => {
      const { models, ...provider } = modelSetting;
      return models.map<DisplayModel>((model) => {
        return {
          ...model,
          type: "byok" as const,
          name: model.name ?? model.id,
          id: model.id,
          contextWindow: model.contextWindow,
          maxTokens: model.maxTokens,
          costType: "basic",
          provider,
        };
      });
    });
  }, [customModelSettings]);

  const models = useMemo(() => {
    if (!data) {
      return undefined;
    }

    let defaultModels = data.map<DisplayModel>((model) => ({
      type: "hosted" as const,
      name: model.id,
      ...model,
    }));
    if (!enablePochiModels) {
      defaultModels = defaultModels.filter(
        (model) => !model.id.startsWith("pochi/"),
      );
    }

    // Add custom models from OpenAI compatible models if available
    if (customModels && customModels.length > 0) {
      return [...defaultModels, ...customModels];
    }

    return defaultModels;
  }, [data, enablePochiModels, customModels]);

  return {
    models,
    isLoading: !(!isLoading && !isLoadingCustomModelSettings), // make sure hosted model and custom model are all loaded
  };
}

export function useSelectedModels() {
  const { selectedModelId, updateSelectedModelId } = useSettingsStore();
  const { models, isLoading } = useModels();

  useEffect(() => {
    if (!isLoading) {
      // init model
      const validModelId = getModelIdFromModelInfo(selectedModelId, models);
      if (validModelId !== selectedModelId) {
        updateSelectedModelId(validModelId);
      }
    }
  }, [isLoading, models, selectedModelId, updateSelectedModelId]);

  const selectedModel = models?.find((x) => x.id === selectedModelId);

  return {
    isLoading,
    models,
    selectedModel,
    updateSelectedModelId,
  };
}

function getModelIdFromModelInfo(
  modelId: string | undefined,
  models: DisplayModel[] | undefined,
): string | undefined {
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
