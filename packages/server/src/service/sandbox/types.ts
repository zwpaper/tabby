export interface SandboxInfo {
  id: string;
  url: string;
  isRunning: boolean;
}

export interface SandboxLogs {
  initLog: string;
  runnerLog: string;
}

export interface CreateSandboxOptions {
  uid: string;
  envs: Record<string, string>;
}

const SandboxHome = "/home/pochi";
const SandboxLogDir = `${SandboxHome}/.log`;
const RemotePochiHome = `${SandboxHome}/.remote-pochi`;

export const SandboxPath = {
  home: SandboxHome,
  project: `${SandboxHome}/project`,
  init: `${RemotePochiHome}/init.sh`,
  initLog: `${SandboxLogDir}/init.log`,
  runnerLog: `${SandboxLogDir}/runner.log`,
};

export interface SandboxProvider {
  /**
   * Create a new sandbox instance
   */
  create(options: CreateSandboxOptions): Promise<SandboxInfo>;

  /**
   * Connect to an existing sandbox
   */
  connect(sandboxId: string): Promise<SandboxInfo>;

  /**
   * Check if sandbox is running
   */
  isRunning(sandboxId: string): Promise<boolean>;

  /**
   * Resume a paused sandbox
   */
  resume(sandboxId: string, timeoutMs?: number): Promise<void>;

  /**
   * Pause a running sandbox
   */
  pause(sandboxId: string): Promise<void>;

  /**
   * Get sandbox logs
   */
  getLogs(sandboxId: string): Promise<SandboxLogs | null>;

  /**
   * Get sandbox URL for access
   */
  getUrl(sandboxId: string, uid?: string): string;

  /**
   * List all sandboxes (for cleanup/management)
   */
  list(): Promise<{ sandboxId: string }[]>;

  /**
   * Get the provider type identifier
   */
  getProviderType(): string;
}
