import { vscodeHost } from "@/lib/vscode";
import { threadSignal } from "@quilted/threads/signals";
import type { CustomModelSetting } from "@ragdoll/vscode-webui-bridge";
import { useEffect, useState } from "react";

const isValidCustomModelSettings = (
  settings: CustomModelSetting[],
): settings is CustomModelSetting[] => {
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

export const useCustomModelSetting = () => {
  const [customModelSettings, setCustomModelSettings] = useState<
    CustomModelSetting[] | undefined
  >(undefined);

  useEffect(() => {
    const updateCustomModelSetting = (
      settings: CustomModelSetting[] | undefined,
    ) => {
      if (settings && isValidCustomModelSettings(settings)) {
        setCustomModelSettings(settings);
      } else {
        setCustomModelSettings(undefined);
      }
    };
    const fetchCustomModelSetting = async () => {
      const signal = threadSignal(await vscodeHost.readCustomModelSetting());
      signal.subscribe((value) => {
        updateCustomModelSetting(value);
      });
      updateCustomModelSetting(signal.value);
    };
    fetchCustomModelSetting();
  }, []);

  return customModelSettings;
};
