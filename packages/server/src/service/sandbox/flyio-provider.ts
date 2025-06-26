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
    const { uid, githubAccessToken, githubRepository, envs = {} } = options;

    const sandboxEnvs: Record<string, string> = {
      ...envs,
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
          cpu_kind: "shared",
          cpus: 2,
          memory_mb: 2048,
        },
      },
      region: this.region,
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
    const app = await this.client.getApp(sandboxId);
    const url = this.getUrl(sandboxId);

    return {
      id: sandboxId,
      url,
      isRunning: app.status === "deployed",
    };
  }

  async isRunning(sandboxId: string): Promise<boolean> {
    try {
      const app = await this.client.getApp(sandboxId);
      return app.status === "deployed";
    } catch (error) {
      return false;
    }
  }

  async resume(
    sandboxId: string,
    _timeoutMs = SandboxTimeoutMs,
  ): Promise<void> {
    try {
      const appName = await this.getAppNameForMachine(sandboxId);
      await this.client.startMachine(appName, sandboxId);
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
    const appName = await this.getAppNameForMachine(sandboxId);
    await this.client.stopMachine(appName, sandboxId);
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
    // Fly.io machines get URLs like: https://{app-name}.fly.dev
    // We need to get the app name from the machine
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
    const machines: { sandboxId: string }[] = [];

    for (const app of appsResponse.apps || []) {
      if (app.name?.startsWith("pochi-")) {
        const appMachines = await this.client.listMachines(app.name);
        machines.push(...appMachines.map((m) => ({ sandboxId: m.id || "" })));
      }
    }

    return machines;
  }

  getProviderType(): string {
    return "flyio";
  }

  async runInitScript(
    sandboxId: string,
    _envs: Record<string, string>,
    _minionId: string,
  ): Promise<void> {
    // Execute the init script in the Fly.io machine
    const appName = await this.getAppNameForMachine(sandboxId);
    await this.client.execInMachine(appName, sandboxId, {
      command: [
        "/bin/bash",
        "-c",
        `${SandboxPath.init} 2>&1 | tee ${SandboxPath.initLog}`,
      ],
    });
  }

  private async getAppNameForMachine(machineId: string): Promise<string> {
    const appsResponse = await this.client.listApps(this.orgSlug);

    for (const app of appsResponse.apps || []) {
      if (app.name?.startsWith("pochi-")) {
        try {
          const machines = await this.client.listMachines(app.name);
          if (machines.some((m) => m.id === machineId)) {
            return app.name;
          }
        } catch (error) {
          // Continue searching
        }
      }
    }

    throw new Error(`App for machine ${machineId} not found`);
  }

  private async readFileFromMachine(
    machineId: string,
    filePath: string,
  ): Promise<string> {
    // This would need to be implemented using exec to cat the file
    // For now, return empty string as placeholder
    try {
      const appName = await this.getAppNameForMachine(machineId);
      await this.client.execInMachine(appName, machineId, {
        command: ["cat", filePath],
      });
      // In a real implementation, you'd capture the output
      return "";
    } catch (error) {
      return "";
    }
  }
}
