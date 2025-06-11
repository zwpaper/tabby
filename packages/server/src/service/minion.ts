import { Sandbox, type SandboxOpts } from "@e2b/code-interpreter";
import { auth } from "../auth";
import { db } from "../db";

const VSCodeToken = "pochi";
const RepoFolder = "/home/pochi/project";

interface CreateMinionOptions {
  userId: string;
  taskId: number;
  githubAccessToken: string;
  githubRepository: {
    owner: string;
    repo: string;
  };
}
class MinionService {
  async create({
    userId,
    taskId,
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
      POCHI_TASK_ID: taskId.toString(),

      GITHUB_TOKEN: githubAccessToken,
      GH_TOKEN: githubAccessToken,
      GH_REPO: `${githubRepository.owner}/${githubRepository.repo}`,
    };
    const opts: SandboxOpts = {
      timeoutMs: 60 * 60 * 1000,
      envs: envs,
    };
    const sandbox = await Sandbox.create("4k07y7tv0j1vpssysf3d", opts);
    sandbox.commands.run("/home/pochi/init.sh", {
      envs: envs,
      background: true,
      cwd: "/home/pochi",
    });
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
}

function getUrl(sandbox: Sandbox) {
  return `${sandbox.getHost(3000)}?tkn=${VSCodeToken}&folder=${encodeURIComponent(
    RepoFolder,
  )}`;
}

export const minionService = new MinionService();
