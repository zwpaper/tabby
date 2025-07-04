import { threadSignal } from "@quilted/threads/signals";
import { useEffect, useState } from "react";
import { vscodeHost } from "../vscode";

export const useAutoSaveDisabled = () => {
  const [autoSaveDisabled, setAutoSaveDisabled] = useState(true);

  useEffect(() => {
    const fetchAutoSaveDisabled = async () => {
      const signal = threadSignal(await vscodeHost.readAutoSaveDisabled());
      signal.subscribe((value) => {
        setAutoSaveDisabled(value ?? true);
      });
      setAutoSaveDisabled(signal.value ?? true);
    };

    fetchAutoSaveDisabled();
  }, []);

  return autoSaveDisabled;
};
