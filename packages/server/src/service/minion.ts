import { HTTPException } from "hono/http-exception";
import { auth } from "../better-auth";
import { db, minionIdCoder } from "../db";
import { signalKeepAliveSandbox } from "./background-job";
import { type CreateSandboxOptions, getSandboxProvider } from "./sandbox";

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

class MinionService {
  private sandboxProvider: ReturnType<typeof getSandboxProvider>;

  constructor() {
    this.sandboxProvider = getSandboxProvider();
  }

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

    const opts: CreateSandboxOptions = {
      userId,
      uid,
      githubAccessToken,
      githubRepository: githubRepository
        ? {
            owner: githubRepository.owner,
            repo: githubRepository.repo,
          }
        : undefined,
      envs: envs,
      timeoutMs: SandboxTimeoutMs,
    };

    const sandbox = await this.sandboxProvider.create(opts);
    const res = await db
      .insertInto("minion")
      .values({
        userId,
        e2bSandboxId: sandbox.id,
        url: this.sandboxProvider.getUrl(sandbox.id, uid),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    signalKeepAliveSandbox({ sandboxId: sandbox.id });
    return { ...res, id: minionIdCoder.encode(res.id) };
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
        id: minionIdCoder.encode(minion.id),
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
      .where("id", "=", minionIdCoder.decode(minionId))
      .executeTakeFirstOrThrow();
  }

  private async getSandbox(userId: string, minionId: string) {
    const minion = await this.getMinion(userId, minionId);
    const sandbox = await this.sandboxProvider.connect(minion.e2bSandboxId);
    return { minion, sandbox };
  }

  async get(userId: string, minionId: string) {
    const { minion, sandbox } = await this.getSandbox(userId, minionId);

    return {
      ...minion,
      id: minionIdCoder.encode(minion.id),
      sandbox: sandbox.isRunning
        ? await (async () => {
            const logs = await this.sandboxProvider.getLogs(sandbox.id);
            return {
              initLog: logs ? logs.initLog : "",
              runnerLog: logs ? logs.runnerLog : "",
            };
          })()
        : null,
    };
  }

  async redirect(userId: string, minionId: string) {
    const { minion, sandbox } = await this.getSandbox(userId, minionId);
    if (!sandbox.isRunning) {
      try {
        await this.sandboxProvider.resume(sandbox.id, SandboxTimeoutMs);
      } catch (err) {
        if (err instanceof Error && err.name === "NotFoundError") {
          throw new HTTPException(404, {
            message: "Minion not found or expired",
          });
        }
      }
    }

    signalKeepAliveSandbox({ sandboxId: minion.e2bSandboxId });

    const url = this.sandboxProvider.getUrl(sandbox.id);
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

export const minionService = new MinionService();
