import { Sandbox, type SandboxOpts } from "@e2b/code-interpreter";
import { HTTPException } from "hono/http-exception";
import { auth } from "../better-auth";
import { db, idCoders } from "../db";
import { signalKeepAliveSandbox } from "./background-job";

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

const { encode: idEncode, decode: idDecode } = idCoders.minion;

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
      timeoutMs: SandboxTimeoutMs,
    };

    const sandbox = await Sandbox.create(TemplateId, opts);
    const res = await db
      .insertInto("minion")
      .values({
        userId,
        e2bSandboxId: sandbox.sandboxId,
        url: getUrl(sandbox, uid),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    sandbox.commands.run(
      `${SandboxPath.init} 2>&1 | tee ${SandboxPath.initLog}`,
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

  async list(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const minionsQuery = db
      .selectFrom("minion")
      .selectAll()
      .where("userId", "=", userId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset);

    const totalCountQuery = db
      .selectFrom("minion")
      .select(db.fn.count("id").as("count"))
      .where("userId", "=", userId);

    const [minions, totalCountResult] = await Promise.all([
      minionsQuery.execute(),
      totalCountQuery.executeTakeFirstOrThrow(),
    ]);

    const totalCount = Number(totalCountResult.count);
    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: minions.map((minion) => ({
        ...minion,
        id: idEncode(minion.id),
      })),
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
      },
    };
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

    const url = getUrl(sandbox);
    await verifyMinionUrl(url);

    return url;
  }
}

async function verifyMinionUrl(url: string) {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new HTTPException(503, {
            message: "Service Unavailable, please try again later",
          }),
        ),
      9 * 1000,
    ),
  );

  const verifyPromise = (async () => {
    let a = 0;
    let b = 1;
    while (true) {
      try {
        const res = await fetch(url, {
          method: "GET",
          redirect: "manual",
        });
        if (res.status === 200) {
          return;
        }
      } catch (err) {
        // Ignore error, wait for next iteration
      }
      const delay = b * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      [a, b] = [b, a + b];
    }
  })();

  await Promise.race([timeoutPromise, verifyPromise]);
}

function getUrl(sandbox: Sandbox, uid?: string) {
  const url = new URL(`https://${sandbox.getHost(9080)}`);
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

export const minionService = new MinionService();
