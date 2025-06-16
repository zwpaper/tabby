import { Sandbox, type SandboxOpts } from "@e2b/code-interpreter";
import { HTTPException } from "hono/http-exception";
import Sqids from "sqids";
import { auth } from "../better-auth";
import { db } from "../db";
import { signalKeepAliveSandbox } from "./background-job";

const VSCodeToken = "pochi";

const SandboxHome = "/home/user";
const SandboxLogDir = `${SandboxHome}/.log`;
const RemotePochiHome = `${SandboxHome}/.remote-pochi`;
const SandboxPath = {
  home: SandboxHome,
  project: `${SandboxHome}/project`,
  init: `${RemotePochiHome}/init.sh`,
  initLog: `${SandboxLogDir}/init.log`,
  runnerLog: `${SandboxLogDir}/runner.log`,
};

const TemplateId = process.env.E2B_TEMPLATE_ID || "4kfoc92tmo1x9igbf6qp";
const SandboxTimeoutMs = 60 * 1000 * 60 * 12; // 12 hours

interface CreateMinionOptions {
  userId: string;
  uid: string;
  githubAccessToken: string;
  githubRepository?: {
    owner: string;
    repo: string;
  };
}

const { idEncode, idDecode } = (() => {
  const alphabet =
    "iMypeAm79qGcLfO8jtXTk1d5xPE2bUW0H6awuYoCgzVlhQnBsF3ZRJDvKN4IrS";
  const coder = new Sqids({ minLength: 8, alphabet });
  return {
    idEncode: (id: number) => coder.encode([id]),
    idDecode: (id: string) => coder.decode(id)[0],
  };
})();

class MinionService {
  async create({
    userId,
    uid,
    githubAccessToken,
    githubRepository,
  }: CreateMinionOptions) {
    const apiKey = await auth.api.createApiKey({
      body: {
        userId,
        name: `API Key for task ${uid}`,
        expiresIn: 60 * 60 * 24 * 30, // 30 days, match with the sandbox timeout
        prefix: "pk_minion_",
        metadata: {
          uid,
        },
        rateLimitEnabled: false,
      },
    });

    const envs: Record<string, string> = {
      POCHI_OPENVSCODE_TOKEN: VSCodeToken,
      POCHI_SESSION_TOKEN: apiKey.key,
      POCHI_TASK_ID: uid,

      GITHUB_TOKEN: githubAccessToken,
      GH_TOKEN: githubAccessToken,
    };

    if (githubRepository) {
      envs.GH_REPO = `${githubRepository.owner}/${githubRepository.repo}`;
    }

    const opts: SandboxOpts = {
      envs: envs,
    };

    const sandbox = await Sandbox.create(TemplateId, opts);
    const res = await db
      .insertInto("minion")
      .values({
        userId,
        e2bSandboxId: sandbox.sandboxId,
        url: getUrl(sandbox, !!githubRepository, uid),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    sandbox.commands.run(
      `mkdir -p ${SandboxLogDir} && ${SandboxPath.init} 2>&1 | tee ${SandboxPath.initLog}`,
      {
        envs: {
          ...envs,
          POCHI_MINION_ID: idEncode(res.id),
        },
        background: true,
        cwd: SandboxPath.home,
      },
    );

    signalKeepAliveSandbox({ sandboxId: sandbox.sandboxId });
    return { ...res, id: idEncode(res.id) };
  }

  async signalKeepAliveMinion(userId: string, minionId: string) {
    const minion = await this.getMinion(userId, minionId);
    signalKeepAliveSandbox({ sandboxId: minion.e2bSandboxId });
  }

  async list(userId: string) {
    const minions = await db
      .selectFrom("minion")
      .selectAll()
      .where("userId", "=", userId)
      .execute();

    return minions.map((minion) => ({
      ...minion,
      id: idEncode(minion.id),
    }));
  }

  private async getMinion(userId: string, minionId: string) {
    return await db
      .selectFrom("minion")
      .selectAll()
      .where("userId", "=", userId)
      .where("id", "=", idDecode(minionId))
      .executeTakeFirstOrThrow();
  }

  private async getSandbox(userId: string, minionId: string) {
    const minion = await this.getMinion(userId, minionId);
    const sandbox = await Sandbox.connect(minion.e2bSandboxId);
    return { minion, sandbox };
  }

  async get(userId: string, minionId: string) {
    const { minion, sandbox } = await this.getSandbox(userId, minionId);
    const isRunning = await sandbox.isRunning();
    return {
      ...minion,
      id: idEncode(minion.id),
      sandbox: isRunning
        ? {
            initLog: await sandbox.files.read(SandboxPath.initLog),
            runnerLog: await sandbox.files.read(SandboxPath.runnerLog),
          }
        : null,
    };
  }

  async redirect(userId: string, minionId: string) {
    const { minion, sandbox } = await this.getSandbox(userId, minionId);
    if (!(await sandbox.isRunning())) {
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
    }

    signalKeepAliveSandbox({ sandboxId: minion.e2bSandboxId });
    return minion.url;
  }
}

function getUrl(sandbox: Sandbox, hasRepository: boolean, uid: string) {
  const url = new URL(`https://${sandbox.getHost(3000)}`);
  url.searchParams.append("tkn", VSCodeToken);
  if (hasRepository) {
    url.searchParams.append("folder", SandboxPath.project);
  } else {
    url.searchParams.append(
      "callback",
      encodeURIComponent(
        JSON.stringify({
          authority: "tabbyml.pochi",
          query: `task=${uid}`,
        }),
      ),
    );
  }
  return url.toString();
}

export const minionService = new MinionService();
