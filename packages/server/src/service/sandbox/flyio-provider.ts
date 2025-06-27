import { HTTPException } from "hono/http-exception";
import {
  type FlyioClient,
  createAuthenticatedFlyioClient,
} from "./flyio-client";
import type {
  CreateSandboxOptions,
  SandboxInfo,
  SandboxLogs,
  SandboxProvider,
} from "./types";
import { SandboxPath } from "./types";

// Remove interfaces as they are now imported from flyio-client

const FlyApiToken = process.env.FLY_API_TOKEN;
const FlyOrgSlug = process.env.FLY_ORG_SLUG || "tabbyml";
const FlyImage =
  process.env.FLY_SANDBOX_IMAGE || "ghcr.io/kweizh/pochi-minion:v0.2.0";
const FlyRegion = process.env.FLY_REGION || "lax";
const SandboxTimeoutMs = 60 * 1000 * 60 * 12; // 12 hours

export class FlyioSandboxProvider implements SandboxProvider {
  private client: FlyioClient;
  private orgSlug: string;
  private image: string;
  private region: string;

  constructor() {
    if (!FlyApiToken) {
      throw new Error(
        "FLY_API_TOKEN environment variable is required for Fly.io provider",
      );
    }
    this.client = createAuthenticatedFlyioClient(FlyApiToken);
    this.orgSlug = FlyOrgSlug;
    this.image = FlyImage;
    this.region = FlyRegion;
  }

  async create(options: CreateSandboxOptions): Promise<SandboxInfo> {
    const {
      minionId,
      uid,
      githubAccessToken,
      githubRepository,
      envs = {},
      timeoutMs = SandboxTimeoutMs,
    } = options;

    const sandboxEnvs: Record<string, string> = {
      ...envs,

      POCHI_MINION_ID: minionId,

      GITHUB_TOKEN: githubAccessToken,
      GH_TOKEN: githubAccessToken,
    };

    if (githubRepository) {
      sandboxEnvs.GH_REPO = `${githubRepository.owner}/${githubRepository.repo}`;
    }

    // Create a unique app name for this sandbox
    const uuid = crypto.randomUUID();
    if (!uuid) {
      throw new Error("Failed to generate unique identifier for Fly app");
    }
    const appName = `pochi-${uuid.slice(0, 18)}`;

    // Create Fly app
    await this.client.createApp({
      app_name: appName,
      org_slug: this.orgSlug,
    });

    // Create machine in the app
    const machine = await this.client.createMachine(appName, {
      config: {
        image: this.image,
        env: sandboxEnvs,
        services: [
          {
            autostart: false,
            ports: [
              {
                port: 443,
                handlers: ["tls", "http"],
              },
            ],
            protocol: "tcp",
            internal_port: 9080,
          },
        ],
        auto_destroy: true,
        restart: {
          policy: "no",
        },
        guest: {
          cpu_kind: "performance",
          cpus: 8,
          memory_mb: 16 * 1024,
        },
      },
      region: this.region,
      stop_config: {
        timeout: timeoutMs / 1000, // Fly.io uses seconds for timeout
      },
    });

    await this.client.allocateIp({ appId: appName });

    const url = this.getUrl(appName, uid);

    return {
      id: appName,
      url,
      isRunning: machine.state === "started",
    };
  }

  async connect(sandboxId: string): Promise<SandboxInfo> {
    const url = this.getUrl(sandboxId);
    const isRunning = await this.isRunning(sandboxId);

    return {
      id: sandboxId,
      url,
      isRunning,
    };
  }

  async isRunning(sandboxId: string): Promise<boolean> {
    const machines = await this.client.listMachines(sandboxId);
    if (machines.length === 0) {
      return false;
    }

    return machines[0].state === "started";
  }

  async resume(
    sandboxId: string,
    _timeoutMs = SandboxTimeoutMs,
  ): Promise<void> {
    try {
      const machineId = await this.getMachineForApp(sandboxId);
      await this.client.startMachine(sandboxId, machineId);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw new HTTPException(404, {
          message: "Minion not found or expired",
        });
      }
      throw error;
    }
  }

  async pause(sandboxId: string): Promise<void> {
    try {
      const machineId = await this.getMachineForApp(sandboxId);
      await this.client.suspendMachine(sandboxId, machineId);
    } catch (error) {
      console.error(`Failed to pause sandbox ${sandboxId}:`, error);
    }
  }

  async getLogs(sandboxId: string): Promise<SandboxLogs | null> {
    const isRunning = await this.isRunning(sandboxId);

    if (!isRunning) {
      return null;
    }

    try {
      // For Fly.io, we would need to implement log reading via exec or log streaming
      // This is a simplified implementation - in practice, you'd need to exec into the machine
      // or use Fly's log streaming API to read the specific log files
      const [initLog, runnerLog] = await Promise.all([
        this.readFileFromMachine(sandboxId, SandboxPath.initLog),
        this.readFileFromMachine(sandboxId, SandboxPath.runnerLog),
      ]);

      return { initLog, runnerLog };
    } catch (error) {
      // If files don't exist or can't be read, return empty logs
      return { initLog: "", runnerLog: "" };
    }
  }

  getUrl(sandboxId: string, uid?: string): string {
    // Fly.io get URLs like: https://{app-name}.fly.dev
    const url = new URL(`https://${sandboxId}.fly.dev`);

    if (uid) {
      url.searchParams.append(
        "callback",
        encodeURIComponent(
          JSON.stringify({
            authority: "tabbyml.pochi",
            query: `task=${uid}`,
          }),
        ),
      );
    } else {
      url.searchParams.append("folder", SandboxPath.project);
    }

    return url.toString();
  }

  async list(): Promise<{ sandboxId: string }[]> {
    const appsResponse = await this.client.listApps(this.orgSlug);
    const sandboxes: { sandboxId: string }[] = [];

    for (const app of appsResponse.apps || []) {
      if (app.name?.startsWith("pochi-")) {
        sandboxes.push({ sandboxId: app.name || "" });
      }
    }

    return sandboxes;
  }

  getProviderType(): string {
    return "flyio";
  }

  private async getMachineForApp(appName: string): Promise<string> {
    try {
      const machines = await this.client.listMachines(appName);
      if (machines.length === 0) {
        throw new Error(`No machines found for app ${appName}`);
      }
      // Return the first machine ID (assuming one machine per app for pochi sandboxes)
      const machineId = machines[0].id;
      if (!machineId) {
        throw new Error(`Machine ID not found for app ${appName}`);
      }
      return machineId;
    } catch (error) {
      console.log(`Error getting machine for app ${appName}:`, error);
      throw new Error(`Failed to get machine for app ${appName}: ${error}`);
    }
  }

  private async readFileFromMachine(
    appName: string,
    filePath: string,
  ): Promise<string> {
    try {
      const machineId = await this.getMachineForApp(appName);
      const output = await this.client.execInMachine(appName, machineId, {
        command: ["cat", filePath],
      });
      return output.stdout || "";
    } catch (error) {
      console.log(
        `Error reading file from machine ${appName}:${filePath}:`,
        error,
      );
      return "";
    }
  }
}
