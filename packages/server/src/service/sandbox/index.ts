import { E2BSandboxProvider } from "./e2b-provider";
import { FlyioSandboxProvider } from "./flyio-provider";
import type { SandboxProvider } from "./types";

/**
 * Returns the appropriate sandbox provider based on the POCHI_MINION_PROVIDER environment variable.
 * Defaults to E2B provider if the environment variable is not set or has an unsupported value.
 */
export function getSandboxProvider(): SandboxProvider {
  const provider = process.env.POCHI_MINION_PROVIDER;

  switch (provider) {
    case "flyio":
      return new FlyioSandboxProvider();
    default:
      return new E2BSandboxProvider();
  }
}

// Re-export types and providers for convenience
export type {
  SandboxProvider,
  SandboxInfo,
  SandboxLogs,
  CreateSandboxOptions,
} from "./types";
