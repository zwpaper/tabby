import { vscodeHost } from "@/lib/vscode";
import { CustomModelSetting } from "@getpochi/common/vscode-webui-bridge";
import { threadSignal } from "@quilted/threads/signals";
import { useQuery } from "@tanstack/react-query";

const isValidCustomModelSetting = (setting: unknown) => {
  return CustomModelSetting.safeParse(setting).success;
};

const getValidCustomModelSettings = (
  settings: CustomModelSetting[] | undefined,
): CustomModelSetting[] | undefined => {
  if (settings === undefined) {
    return undefined;
  }
  return settings.filter(isValidCustomModelSetting);
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
