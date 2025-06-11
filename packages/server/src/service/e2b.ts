import { Sandbox, type SandboxOpts } from "@e2b/code-interpreter";
import { auth } from "../auth";
import { db } from "../db";

interface CreateSandboxOptions {
  userId: string;
  taskId: number;
  githubAccessToken: string;
  githubRepository: {
    owner: string;
    repo: string;
  };
}

const VSCodeToken = "pochi";

class E2B {
  constructor(
    readonly template: string = "4k07y7tv0j1vpssysf3d",
    readonly entrypoint: string = "/home/pochi/init.sh",
    readonly timeout: number = 60 * 60 * 1000, // 1 hour
  ) {}

  async create({
    userId,
    taskId,
    githubAccessToken,
    githubRepository,
  }: CreateSandboxOptions): Promise<
    { sandboxId: string; serverUrl: string } | undefined
  > {
    // create a temp session for the cloud runner
    const session = await (await auth.$context).internalAdapter.createSession(
      userId,
      undefined,
    );

    try {
      const envs = {
        POCHI_OPENVSCODE_TOKEN: VSCodeToken,
        POCHI_SESSION_TOKEN: session.token,
        POCHI_TASK_ID: taskId.toString(),

        GITHUB_TOKEN: githubAccessToken,
        GH_TOKEN: githubAccessToken,
        GH_REPO: `${githubRepository.owner}/${githubRepository.repo}`,
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

      const serverUrl = `${sandbox.getHost(3000)}?tkn=${VSCodeToken}`;
      await db
        .insertInto("minion")
        .values({
          userId,
          e2bSandboxId: sandbox.sandboxId,
        })
        .execute();
      return { sandboxId: sandbox.sandboxId, serverUrl };
    } catch (error) {
      console.error("Error creating or interacting with E2B sandbox:", error);
      return undefined;
    }
  }
}

export const e2b = new E2B();
