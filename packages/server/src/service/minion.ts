import { HTTPException } from "hono/http-exception";
import { auth } from "../better-auth";
import { db, minionIdCoder } from "../db";
import { signalKeepAliveSandbox } from "./background-job";
import { type CreateSandboxOptions, sandboxService } from "./sandbox";

const SandboxTimeoutMs = 60 * 1000 * 60 * 12; // 12 hours
const MinionDomain = process.env.POCHI_MINION_DOMAIN || "runpochi.com";

interface CreateMinionOptions {
  user: { id: string; name: string; email: string };
  uid: string;
  githubAccessToken: string;
  githubRepository?: {
    owner: string;
    repo: string;
  };
}

class MinionService {
  async create({
    user,
    uid,
    githubAccessToken,
    githubRepository,
  }: CreateMinionOptions) {
    const apiKey = await auth.api.createApiKey({
      body: {
        userId: user.id,
        name: `API Key for task ${uid}`,
        expiresIn: 60 * 60 * 24 * 30, // 30 days, match with the sandbox timeout
        prefix: "pk_minion_",
        metadata: {
          uid,
        },
        rateLimitEnabled: false,
      },
    });

    const res = await db
      .insertInto("minion")
      .values({
        userId: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const minionId = minionIdCoder.encode(res.id);

    const uuid = crypto.randomUUID();
    const sandboxId = `pochi-${uuid.slice(0, 18)}`;
    const sandboxHost = `${sandboxId}.${MinionDomain}`;

    const envs: Record<string, string> = {
      POCHI_SESSION_TOKEN: apiKey.key,
      POCHI_TASK_ID: uid,
      POCHI_MINION_ID: minionId,
      POCHI_SANDBOX_HOST: `${sandboxHost}`,

      GIT_AUTHOR_NAME: user.name || "Pochi",
      GIT_AUTHOR_EMAIL: user.email || "noreply@getpochi.com",
      GIT_COMMITTER_NAME: "Pochi",
      GIT_COMMITTER_EMAIL: "noreply@getpochi.com",

      GITHUB_TOKEN: githubAccessToken,
      GH_TOKEN: githubAccessToken,
      GH_REPO: githubRepository
        ? `${githubRepository.owner}/${githubRepository.repo}`
        : "",
    };

    const opts: CreateSandboxOptions = {
      id: sandboxId,
      uid,
      envs,
    };
    const sandbox = await sandboxService.create(opts);

    const url = new URL(`https://${sandboxHost}`);

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
      url.searchParams.append("folder", sandbox.projectDir);
    }

    // Update the minion with the sandbox ID
    await db
      .updateTable("minion")
      .where("id", "=", res.id)
      .set({
        sandboxId: sandbox.id,
        url: url.toString(),
      })
      .execute();

    signalKeepAliveSandbox({ sandboxId: sandbox.id });
    return { ...res, id: minionIdCoder.encode(res.id) };
  }

  async signalKeepAliveMinion(userId: string, minionId: string) {
    const minion = await this.getMinion(userId, minionId);
    if (!minion.sandboxId) {
      throw new HTTPException(404, {
        message: "Minion not found or does not have a sandbox",
      });
    }
    signalKeepAliveSandbox({ sandboxId: minion.sandboxId });
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
    if (!minion.sandboxId) {
      throw new HTTPException(404, {
        message: "Minion not found or does not have a sandbox",
      });
    }
    const sandbox = await sandboxService.connect(minion.sandboxId);
    return { minion, sandbox };
  }

  async get(userId: string, minionId: string) {
    const { minion, sandbox } = await this.getSandbox(userId, minionId);

    return {
      ...minion,
      id: minionIdCoder.encode(minion.id),
      sandbox: sandbox.isRunning
        ? await (async () => {
            const logs = await sandboxService.getLogs(sandbox.id);
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
    if (!minion.sandboxId) {
      throw new HTTPException(404, {
        message: "Sandbox has not been created or is not available",
      });
    }

    if (!sandbox.isRunning) {
      try {
        await sandboxService.resume(sandbox.id, SandboxTimeoutMs);
      } catch (err) {
        if (err instanceof Error && err.name === "NotFoundError") {
          throw new HTTPException(404, {
            message: "Minion not found or expired",
          });
        }
      }
    }

    signalKeepAliveSandbox({ sandboxId: minion.sandboxId });

    if (!minion.url) {
      throw new HTTPException(404, {
        message: "Minion URL is not available",
      });
    }

    await verifyMinionUrl(minion.url);

    return minion.url;
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
