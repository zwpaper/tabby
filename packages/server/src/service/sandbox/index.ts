import { FlyioSandboxProvider } from "./flyio-provider";

export const sandboxService = new FlyioSandboxProvider();

// Re-export types and providers for convenience
export type {
  SandboxInfo,
  SandboxLogs,
  CreateSandboxOptions,
} from "./types";
