import { HTTPException } from "hono/http-exception";
import * as jose from "jose";
import { v5 as uuidv5 } from "uuid";
import { auth } from "../better-auth";
import { db, minionIdCoder } from "../db";
import {
  scheduleCreateSandbox,
  signalKeepAliveSandbox,
} from "./background-job";
import { sandboxService } from "./sandbox";

const SandboxTimeoutMs = 60 * 1000 * 60 * 12; // 12 hours
const MinionDomain = process.env.POCHI_MINION_DOMAIN || "runpochi.com";

// UUID namespace for generating port forward IDs from minion IDs
const PORT_FORWARD_NAMESPACE = "25dc4800-5b85-4f19-a88a-9c5934adb535";
const SANDBOX_ID_NAMESPACE = "53b1e0a9-b6c6-4e42-8354-ae76cec87cbd";

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

    // we do not want to expose the fly.io app id to public
    // so we use a hashed port forward ID as the sandbox host for port forwarding,
    // then user can share the port-forwarded URL with others
    const portForwardId = this.hashMinionIdToPortForwardId(minionId);
    const sandboxHostForPortForward = `${portForwardId}.${MinionDomain}`;
    const sandboxId = this.hashPortForwardIdToSandboxId(portForwardId);

    const envs: Record<string, string> = {
      // envs available externally
      POCHI_REMOTE_ENV: "true",

      // envs used internally
      POCHI_SESSION_TOKEN: apiKey.key,
      POCHI_TASK_ID: uid,
      POCHI_MINION_ID: minionId,
      POCHI_SANDBOX_HOST: `${sandboxHostForPortForward}`,

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

    // Schedule background job to create the sandbox
    await scheduleCreateSandbox({
      minionId,
      sandboxId,
      uid,
      envs,
      githubRepository,
    });

    return { ...res, id: minionId };
  }

  private hashMinionIdToPortForwardId(minionId: string) {
    return this.uuidv5Id(minionId, PORT_FORWARD_NAMESPACE);
  }

  private hashPortForwardIdToSandboxId(portForwardId: string) {
    return `pochi-${this.uuidv5Id(portForwardId, SANDBOX_ID_NAMESPACE)}`;
  }

  private uuidv5Id(minionId: string, namespace: string) {
    return uuidv5(minionId, namespace).replace(/-/g, "");
  }

  async verifySandboxOwnership(userId: string, redirectUrl: string) {
    const parsedUrl = new URL(redirectUrl);
    const host = parsedUrl.host;
    const hostParts = host.split(".");
    if (hostParts.length < 2) {
      throw new HTTPException(400, {
        message: "Invalid redirect_url format",
      });
    }

    // only accessing vscode would request jwt token,
    // so the parts0 is always sandboxId
    const sandboxId = hostParts[0];
    const minion = await db
      .selectFrom("minion")
      .selectAll()
      .where("userId", "=", userId)
      .where("sandboxId", "=", sandboxId)
      .executeTakeFirst();

    if (!minion) {
      throw new HTTPException(403, {
        message: "Forbidden",
      });
    }
  }

  async generateJwt(user: { id: string; name: string }, redirectUrl: string) {
    const privateKeyJwkString = process.env.MINION_JWT_PRIVATE_KEY;
    const publicKeyJwkString = process.env.MINION_JWT_PUBLIC_KEY;

    if (!privateKeyJwkString || !publicKeyJwkString) {
      throw new HTTPException(500, {
        message: "MINION_JWT_PRIVATE_KEY or MINION_JWT_PUBLIC_KEY is not set",
      });
    }

    const privateJwk = {
      kty: "OKP",
      crv: "Ed25519",
      d: privateKeyJwkString,
      x: publicKeyJwkString,
    };

    const key = await jose.importJWK(privateJwk, "EdDSA");

    const jwt = await new jose.SignJWT({
      name: user.name,
    })
      .setProtectedHeader({ alg: "EdDSA" })
      .setIssuedAt()
      .setIssuer(`${process.env.BETTER_AUTH_URL || "https://app.getpochi.com"}`)
      .setAudience(new URL(redirectUrl).host)
      .setExpirationTime("7d")
      .sign(key);

    return {
      token: jwt,
    };
  }

  async signalKeepAliveMinion(userId: string, minionId: string) {
    const minion = await this.getMinion(userId, minionId);
    if (!minion.sandboxId) {
      throw new HTTPException(400, {
        message: "Sandbox not found, maybe still being created, please wait",
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

  async get(userId: string, minionId: string) {
    const minion = await this.getMinion(userId, minionId);

    if (!minion.sandboxId) {
      return {
        ...minion,
        id: minionIdCoder.encode(minion.id),
        sandbox: null,
        status: "creating",
      };
    }

    const sandbox = await sandboxService.connect(minion.sandboxId);

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
      status: "ready",
    };
  }

  async redirect(userId: string, minionId: string) {
    const minion = await this.getMinion(userId, minionId);

    if (!minion.sandboxId) {
      throw new HTTPException(400, {
        message: "Sandbox is still being created, please wait",
      });
    }

    const sandbox = await sandboxService.connect(minion.sandboxId);

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

  async redirectByUrl(url: string) {
    try {
      const parsedUrl = new URL(url);
      const host = parsedUrl.host;

      // Parse subdomain for port forwarding
      const hostParts = host.split(".");
      if (hostParts.length < 2) {
        throw new HTTPException(400, {
          message: "Invalid URL format",
        });
      }

      const sandboxId = host.startsWith("pochi-")
        ? hostParts[0]
        : (() => {
            const subdomain = hostParts[0];
            const subdomainParts = subdomain.split("-");
            if (subdomainParts.length < 2) {
              throw new HTTPException(400, {
                message: "Invalid format",
              });
            }

            // Check if the first part can be parsed as a number
            if (Number.isNaN(Number(subdomainParts[0]))) {
              throw new HTTPException(400, {
                message: "Invalid format",
              });
            }

            // Get the part after the first '-'
            const portForwardId = subdomainParts.slice(1).join("-");
            return this.hashPortForwardIdToSandboxId(portForwardId);
          })();

      const result = await db
        .selectFrom("minion")
        .select(db.fn.countAll().as("count"))
        .where("sandboxId", "=", sandboxId)
        .executeTakeFirst();
      if (!result || result.count === 0 || result.count === "0") {
        throw new HTTPException(404, {
          message: "Minion not found or expired",
        });
      }

      // Replace subdomain with sandbox ID and verify vscode URL
      const newHost = `${sandboxId}.${hostParts.slice(1).join(".")}`;
      const newUrl = new URL(url);
      newUrl.host = newHost;
      await verifyMinionUrl(newUrl.toString());

      return url;
    } catch (error) {
      if (error instanceof HTTPException) {
        if (error.status >= 400 && error.status < 500) {
          // if the error is a bad request, redirect to tasks page
          return "/tasks";
        }
        throw error;
      }
      throw new HTTPException(400, {
        message: "Unknown error occurred while redirecting",
      });
    }
  }

  async resumeMinion(userId: string, minionId: string) {
    const minion = await this.getMinion(userId, minionId);

    if (!minion.sandboxId) {
      throw new HTTPException(400, {
        message: "Sandbox is still being created, please wait",
      });
    }

    const sandbox = await sandboxService.connect(minion.sandboxId);

    // Resume the sandbox if it's not running
    if (!sandbox.isRunning) {
      try {
        await sandboxService.resume(sandbox.id);
      } catch (err) {
        if (err instanceof Error && err.name === "NotFoundError") {
          throw new HTTPException(404, {
            message: "Minion not found or expired",
          });
        }
      }
    }
    signalKeepAliveSandbox({ sandboxId: minion.sandboxId });
    return {
      success: true,
    };
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
      10 * 1000,
    ),
  );

  const verifyPromise = (async () => {
    let a = 0;
    let b = 1;
    while (true) {
      try {
        const res = await fetch(url, {
          method: "OPTIONS",
          redirect: "manual",
          headers: {
            "Pochi-Src": "pochi-server",
          },
        });
        // VSCode did not support OPTIONS, will return 405 in this case
        // we treat it as connected to VSCode
        if (res.status === 405) {
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
