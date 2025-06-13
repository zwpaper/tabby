import { Sandbox, type SandboxOpts } from "@e2b/code-interpreter";
import { HTTPException } from "hono/http-exception";
import { auth } from "../auth";
import { db } from "../db";

const VSCodeToken = "pochi";

const SandboxHome = "/home/pochi";
const SandboxPath = {
  home: SandboxHome,
  project: `${SandboxHome}/project`,
  init: `${SandboxHome}/init.sh`,
  initLog: `${SandboxHome}/init.log`,
  runnerLog: `${SandboxHome}/runner.log`,
};

const TemplateId = process.env.E2B_TEMPLATE_ID || "4kfoc92tmo1x9igbf6qp";
const SandboxTimeoutMs = 60 * 1000 * 10; // 10 minutes

interface CreateMinionOptions {
  userId: string;
  uid: string;
  githubAccessToken: string;
  githubRepository: {
    owner: string;
    repo: string;
  };
}
class MinionService {
  async create({
    userId,
    uid,
    githubAccessToken,
    githubRepository,
  }: CreateMinionOptions) {
    const session = await (await auth.$context).internalAdapter.createSession(
      userId,
      undefined,
    );

    const envs = {
      POCHI_OPENVSCODE_TOKEN: VSCodeToken,
      POCHI_SESSION_TOKEN: session.token,
      POCHI_TASK_ID: uid,

      GITHUB_TOKEN: githubAccessToken,
      GH_TOKEN: githubAccessToken,
      GH_REPO: `${githubRepository.owner}/${githubRepository.repo}`,
    };
    const opts: SandboxOpts = {
      timeoutMs: SandboxTimeoutMs,
      envs: envs,
    };
    const sandbox = await Sandbox.create(TemplateId, opts);
    sandbox.commands.run(
      `${SandboxPath.init} 2>&1 | tee ${SandboxPath.initLog}`,
      {
        envs: envs,
        background: true,
        cwd: SandboxPath.home,
      },
    );
    const res = await db
      .insertInto("minion")
      .values({
        userId,
        e2bSandboxId: sandbox.sandboxId,
        url: getUrl(sandbox),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return res;
  }

  async list(userId: string) {
    const minions = await db
      .selectFrom("minion")
      .selectAll()
      .where("userId", "=", userId)
      .execute();

    return minions;
  }

  private async getMinion(userId: string, minionId: number) {
    return await db
      .selectFrom("minion")
      .selectAll()
      .where("userId", "=", userId)
      .where("id", "=", minionId)
      .executeTakeFirstOrThrow();
  }

  private async getSandbox(userId: string, minionId: number) {
    const minion = await this.getMinion(userId, minionId);
    const sandbox = await Sandbox.connect(minion.e2bSandboxId);
    return { minion, sandbox };
  }

  async get(userId: string, minionId: number) {
    const { minion, sandbox } = await this.getSandbox(userId, minionId);
    const isRunning = await sandbox.isRunning();
    return {
      ...minion,
      sandbox: isRunning
        ? {
            initLog: await sandbox.files.read(SandboxPath.initLog),
            runnerLog: await sandbox.files.read(SandboxPath.runnerLog),
          }
        : null,
    };
  }

  async resume(userId: string, minionId: number) {
    const minion = await this.getMinion(userId, minionId);
    try {
      await Sandbox.resume(minion.e2bSandboxId, {
        timeoutMs: SandboxTimeoutMs,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "NotFoundError") {
        throw new HTTPException(404, {
          message: "Minion not found or expired",
        });
      }
    }
    return { success: true };
  }
}

function getUrl(sandbox: Sandbox) {
  return `https://${sandbox.getHost(3000)}?tkn=${VSCodeToken}&folder=${encodeURIComponent(
    SandboxPath.project,
  )}`;
}

export const minionService = new MinionService();
