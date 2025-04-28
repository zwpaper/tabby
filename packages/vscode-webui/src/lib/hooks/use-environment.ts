import { vscodeHost } from "@/lib/vscode";
import type { Environment } from "@ragdoll/server";
import { useCallback, useEffect, useRef } from "react";

/**
 * A hook that provides environment information for the VSCode webview UI.
 * Uses the VSCode webview bridge to communicate with the extension host.
 *
 * @param customRuleFiles Array of paths to custom rule files (not used in webview context)
 * @returns An object containing the environment reference and a reload function
 */
export function useEnvironment() {
  const environment = useRef<Environment | null>(null);
  const reload = useCallback(async () => {
    try {
      environment.current = await vscodeHost.readEnvironment();
    } catch (error) {
      environment.current = null;
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { environment, reload };
}
