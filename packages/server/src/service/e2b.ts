import crypto from "node:crypto";
import { Sandbox, type SandboxOpts } from "@e2b/code-interpreter";

interface SandboxOptions {
  taskId: string;
  githubAccessToken: string;
  githubRepository: {
    owner: string;
    repo: string;
  };
}

class E2B {
  constructor(
    readonly template: string = "4k07y7tv0j1vpssysf3d",
    readonly entrypoint: string = "/home/pochi/init.sh",
    readonly timeout: number = 60 * 60 * 1000, // 1 hour
  ) {}

  public async create(
    token: string,
    options: SandboxOptions,
  ): Promise<{ sandboxId: string; serverURL: string } | undefined> {
    const vscodeToken = crypto.randomUUID();

    try {
      const envs = {
        POCHI_OPENVSCODE_TOKEN: vscodeToken,
        POCHI_SESSION_TOKEN: token,
        POCHI_TASK_ID: options.taskId,

        GITHUB_TOKEN: options.githubAccessToken,
        GH_TOKEN: options.githubAccessToken,
        GH_REPO: `${options.githubRepository.owner}/${options.githubRepository.repo}`,
      };

      // although we pass the envs, the startCommand is E2B does not use them
      const opts: SandboxOpts = {
        timeoutMs: this.timeout,
        envs: envs,
      };
      const sandbox = await Sandbox.create(this.template, opts);

      // must use the sandbox.commands to run entrypoint script,
      // so that it can gain access to the environment variables
      sandbox.commands.run(this.entrypoint, {
        envs: envs,
        background: true,
        cwd: "/home/pochi",
      });

      const serverURL = `${sandbox.getHost(3000)}?tkn=${vscodeToken}`;
      return { sandboxId: sandbox.sandboxId, serverURL };
    } catch (error) {
      console.error("Error creating or interacting with E2B sandbox:", error);
      return undefined;
    }
  }
}

export const e2b = new E2B();
