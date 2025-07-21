import { vscodeHost } from "@/lib/vscode";
import { threadSignal } from "@quilted/threads/signals";
import type { CustomModelSetting } from "@ragdoll/vscode-webui-bridge";
import { useEffect, useState } from "react";

export const useCustomModelSetting = () => {
  const [customModelSettings, setCustomModelSettings] = useState<
    CustomModelSetting[] | undefined
  >(undefined);

  useEffect(() => {
    const fetchCustomModelSetting = async () => {
      const signal = threadSignal(await vscodeHost.readCustomModelSetting());
      signal.subscribe((value) => {
        setCustomModelSettings(value);
      });
      setCustomModelSettings(signal.value);
    };
    fetchCustomModelSetting();
  }, []);

  return customModelSettings;
};
