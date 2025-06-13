import { Sandbox, type SandboxOpts } from "@e2b/code-interpreter";
import { auth } from "../auth";
import { db } from "../db";

const VSCodeToken = "pochi";
const RepoFolder = "/home/pochi/project";
const TemplateId = process.env.E2B_TEMPLATE_ID || "4kfoc92tmo1x9igbf6qp";

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
      timeoutMs: 60 * 60 * 1000,
      envs: envs,
    };
    const sandbox = await Sandbox.create(TemplateId, opts);
    sandbox.commands.run(
      "/home/pochi/init.sh 2>&1 | tee /home/pochi/init.log",
      {
        envs: envs,
        background: true,
        cwd: "/home/pochi",
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

  private async getSandbox(userId: string, minionId: number) {
    const minion = await db
      .selectFrom("minion")
      .selectAll()
      .where("userId", "=", userId)
      .where("id", "=", minionId)
      .executeTakeFirstOrThrow();
    const sandbox = await Sandbox.connect(minion.e2bSandboxId);
    return { minion: { ...minion, e2bSandboxId: undefined }, sandbox };
  }

  async get(userId: string, minionId: number) {
    const { minion, sandbox } = await this.getSandbox(userId, minionId);
    const sandboxInfo = await sandbox.getInfo();
    return {
      ...minion,
      sandboxInfo: {
        ...sandboxInfo,
        isRunning: await sandbox.isRunning(),
      },
    };
  }
}

function getUrl(sandbox: Sandbox) {
  return `https://${sandbox.getHost(3000)}?tkn=${VSCodeToken}&folder=${encodeURIComponent(
    RepoFolder,
  )}`;
}

export const minionService = new MinionService();
