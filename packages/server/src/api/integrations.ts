import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth, requireAuth } from "../auth";
import { type DB, db } from "../db";

// Define GithubOauthScopes constant
const GithubOauthScopes = [
  "gist",
  "read:org",
  "read:user",
  "repo",
  "user:email",
  "workflow",
];

const integrations = new Hono()
  .use(requireAuth())
  // Get all integrations for the current user
  .get("/", async (c) => {
    const user = c.get("user");
    try {
      const data = await db
        .selectFrom("externalIntegration")
        .select(["id", "createdAt", "updatedAt", "userId", "vendorData"])
        .where("userId", "=", user.id)
        .execute();
      const userIntegrations = data.map((x) => {
        const vendorData = processVendorData(x.vendorData);
        return {
          ...x,
          vendorData: undefined,
          ...vendorData,
        };
      });
      return c.json(userIntegrations);
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
      throw new HTTPException(500, { message: "Failed to fetch integrations" });
    }
  })
  // Special integration to github oauth is through the better auth.
  .get("/github", async (c) => {
    const userAccounts = await auth.api.listUserAccounts({
      headers: c.req.raw.headers,
    });
    const githubAccount = userAccounts.find((x) => x.provider === "github");
    const missingScopes = new Set(GithubOauthScopes).difference(
      new Set(githubAccount?.scopes),
    );

    let status: "connected" | "missing-scopes" | "not-connected";
    if (!githubAccount) {
      status = "not-connected";
    } else if (missingScopes.size > 0) {
      status = "missing-scopes";
    } else {
      status = "connected";
    }

    return c.json({
      status,
      scopes: GithubOauthScopes,
    });
  })
  // Delete an integration
  .delete("/:id", async (c) => {
    const user = c.get("user");
    const integrationId = Number.parseInt(c.req.param("id"), 10);

    if (Number.isNaN(integrationId)) {
      throw new HTTPException(400, { message: "Invalid integration ID" });
    }

    try {
      const integration = await db
        .selectFrom("externalIntegration")
        .select(["id", "userId"])
        .where("id", "=", integrationId)
        .executeTakeFirst();

      if (!integration) {
        throw new HTTPException(404, { message: "Integration not found" });
      }

      if (integration.userId !== user.id) {
        throw new HTTPException(403, {
          message: "Not authorized to delete this integration",
        });
      }

      await db
        .deleteFrom("externalIntegration")
        .where("id", "=", integrationId)
        .execute();

      return c.json({ success: true });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      console.error("Failed to delete integration:", error);
      throw new HTTPException(500, { message: "Failed to delete integration" });
    }
  });

function processVendorData(
  x: DB["externalIntegration"]["vendorData"]["__select__"],
) {
  if (x.provider === "slack") {
    return {
      provider: "slack" as const,
      vendorIntegrationId: x.integrationId,
      payload: {
        appId: x.payload.appId,
        team: x.payload.team,
        enterprise: x.payload.enterprise,
        enterpriseUrl: x.payload.enterpriseUrl,
      },
    };
  }

  if (x.provider === "github") {
    return {
      provider: "github" as const,
      vendorIntegrationId: x.integrationId,
      payload: x.payload,
    };
  }

  throw new Error("Unknown provider");
}

export default integrations;
