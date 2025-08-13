import { vscodeHost } from "@/lib/vscode";
import { threadSignal } from "@quilted/threads/signals";
import type { CustomModelSetting } from "@ragdoll/vscode-webui-bridge";
import { useQuery } from "@tanstack/react-query";

const isValidCustomModel = (model: CustomModelSetting["models"][number]) => {
  return (
    typeof model.id === "string" &&
    typeof model.contextWindow === "number" &&
    typeof model.maxTokens === "number"
  );
};

const isValidCustomModelSetting = (setting: CustomModelSetting) => {
  return (
    typeof setting.id === "string" &&
    typeof setting.baseURL === "string" &&
    Array.isArray(setting.models)
  );
};

const getValidCustomModelSettings = (
  settings: CustomModelSetting[] | undefined,
): CustomModelSetting[] | undefined => {
  if (settings === undefined) {
    return undefined;
  }
  return settings.filter(isValidCustomModelSetting).map((setting) => {
    return {
      ...setting,
      models: setting.models.filter(isValidCustomModel),
    };
  });
};

/** @useSignals this comment is needed to enable signals in this hook */
export const useCustomModelSetting = () => {
  const { data: customModelSettingsSignal, isLoading } = useQuery({
    queryKey: ["customModelSetting"],
    queryFn: fetchCustomModelSetting,
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (customModelSettingsSignal === undefined) {
    return { customModelSettings: undefined, isLoading };
  }

  const settings = getValidCustomModelSettings(customModelSettingsSignal.value);

  return { customModelSettings: settings, isLoading };
};

async function fetchCustomModelSetting() {
  const signal = threadSignal(await vscodeHost.readCustomModelSetting());
  return signal;
}
