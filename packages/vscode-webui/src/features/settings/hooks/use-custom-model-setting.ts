import { vscodeHost } from "@/lib/vscode";
import { threadSignal } from "@quilted/threads/signals";
import type { CustomModelSetting } from "@ragdoll/vscode-webui-bridge";
import { useQuery } from "@tanstack/react-query";

const isValidCustomModelSettings = (
  settings: CustomModelSetting[] | undefined,
): settings is CustomModelSetting[] => {
  if (settings === undefined) {
    return false;
  }
  return (
    Array.isArray(settings) &&
    settings.every((setting) => {
      return (
        typeof setting.baseURL === "string" &&
        Array.isArray(setting.models) &&
        setting.models.every((model) => {
          return (
            typeof model.id === "string" &&
            typeof model.contextWindow === "number" &&
            typeof model.maxTokens === "number"
          );
        })
      );
    })
  );
};

/** @useSignals this comment is needed to enable signals in this hook */
export const useCustomModelSetting = () => {
  const { data: customModelSettingsSignal, isLoading } = useQuery({
    queryKey: ["customModelSetting"],
    queryFn: fetchCustomModelSetting,
  });

  if (customModelSettingsSignal === undefined) {
    return { customModelSettings: undefined, isLoading };
  }

  const settings = customModelSettingsSignal.value;

  if (!isValidCustomModelSettings(settings)) {
    return { customModelSettings: undefined, isLoading };
  }

  return { customModelSettings: settings, isLoading };
};

async function fetchCustomModelSetting() {
  const signal = threadSignal(await vscodeHost.readCustomModelSetting());
  return signal;
}
