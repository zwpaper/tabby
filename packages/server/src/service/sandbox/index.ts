import { FlyioSandboxProvider } from "./flyio-provider";

export const sandboxService = new FlyioSandboxProvider();

// Re-export types for convenience
export type {
  SandboxInfo,
  SandboxLogs,
  CreateSandboxOptions,
} from "./types";
