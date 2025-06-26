import { Sandbox, type SandboxOpts } from "@e2b/code-interpreter";
import { HTTPException } from "hono/http-exception";
import type {
  CreateSandboxOptions,
  SandboxInfo,
  SandboxLogs,
  SandboxProvider,
} from "./types";
import { SandboxPath } from "./types";

const TemplateId = process.env.E2B_TEMPLATE_ID || "4kfoc92tmo1x9igbf6qp";
const SandboxTimeoutMs = 60 * 1000 * 60 * 12; // 12 hours

export class E2BSandboxProvider implements SandboxProvider {
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
      GITHUB_TOKEN: githubAccessToken,
      GH_TOKEN: githubAccessToken,
    };

    if (githubRepository) {
      sandboxEnvs.GH_REPO = `${githubRepository.owner}/${githubRepository.repo}`;
    }

    const opts: SandboxOpts = {
      envs: sandboxEnvs,
      timeoutMs,
    };

    const sandbox = await Sandbox.create(TemplateId, opts);
    const url = this.getUrl(sandbox.sandboxId, uid);

    sandbox.commands.run(
      `${SandboxPath.init} 2>&1 | tee ${SandboxPath.initLog}`,
      {
        envs: {
          ...envs,
          POCHI_MINION_ID: minionId,
        },
        background: true,
        cwd: SandboxPath.home,
      },
    );

    return {
      id: sandbox.sandboxId,
      url,
      isRunning: true,
    };
  }

  async connect(sandboxId: string): Promise<SandboxInfo> {
    const sandbox = await Sandbox.connect(sandboxId);
    const isRunning = await sandbox.isRunning();
    const url = this.getUrl(sandboxId);

    return {
      id: sandboxId,
      url,
      isRunning,
    };
  }

  async isRunning(sandboxId: string): Promise<boolean> {
    const sandbox = await Sandbox.connect(sandboxId);
    return await sandbox.isRunning();
  }

  async resume(
    sandboxId: string,
    timeoutMs: number = SandboxTimeoutMs,
  ): Promise<void> {
    try {
      await Sandbox.resume(sandboxId, { timeoutMs });
    } catch (err) {
      if (err instanceof Error && err.name === "NotFoundError") {
        throw new HTTPException(404, {
          message: "Minion not found or expired",
        });
      }
      throw err;
    }
  }

  async pause(sandboxId: string): Promise<void> {
    const sandbox = await Sandbox.connect(sandboxId);
    await sandbox.pause();
  }

  async getLogs(sandboxId: string): Promise<SandboxLogs | null> {
    const sandbox = await Sandbox.connect(sandboxId);
    const isRunning = await sandbox.isRunning();

    if (!isRunning) {
      return null;
    }

    try {
      const [initLog, runnerLog] = await Promise.all([
        sandbox.files.read(SandboxPath.initLog),
        sandbox.files.read(SandboxPath.runnerLog),
      ]);

      return { initLog, runnerLog };
    } catch (error) {
      // If files don't exist or can't be read, return empty logs
      return { initLog: "", runnerLog: "" };
    }
  }

  getUrl(sandboxId: string, uid?: string): string {
    const url = new URL(`https://9080-${sandboxId}.e2b.app`);

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
    const paginator = Sandbox.list();
    const sandboxes: { sandboxId: string }[] = [];

    while (paginator.hasNext) {
      const items = await paginator.nextItems();
      sandboxes.push(...items.map((item) => ({ sandboxId: item.sandboxId })));
    }

    return sandboxes;
  }

  getProviderType(): string {
    return "e2b";
  }
}
