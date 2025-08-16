import { getLogger } from "@getpochi/common";
import { zValidator } from "@hono/zod-validator";
import type { DB, ExternalIntegrationsEvent } from "@ragdoll/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { requireAuth } from "../auth";
import { db } from "../db";
import { setIdleTimeout } from "../server";
import { userIntegrationsEvents } from "../service/user-integrations-events";

const EventsQuerySchema = z
  .object({
    heartbeat: z.coerce.boolean().optional(),
  })
  .optional();

const logger = getLogger("IntegrationsApi");

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
      logger.error("Failed to fetch integrations", error);
      throw new HTTPException(500, { message: "Failed to fetch integrations" });
    }
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
      logger.error("Failed to delete integration", error);
      throw new HTTPException(500, { message: "Failed to delete integration" });
    }
  })
  .get(
    "/events",
    zValidator("query", EventsQuerySchema),
    requireAuth(),
    async (c) => {
      const { heartbeat } = c.req.valid("query") || {};
      const user = c.get("user");

      return streamSSE(c, async (stream) => {
        const unsubscribe = userIntegrationsEvents.subscribe(user.id, (e) => {
          stream.writeSSE({
            data: JSON.stringify(e),
          });
        });

        stream.onAbort(() => {
          unsubscribe();
        });

        // Let client know connection is established.
        // The client should refetch integrations upon receiving this.
        await stream.writeSSE({
          data: JSON.stringify({
            type: "integrations:changed",
            data: {
              userId: user.id,
            },
          } satisfies ExternalIntegrationsEvent),
        });

        while (true) {
          setIdleTimeout(c.req.raw, 120);
          await new Promise((resolve) => setTimeout(resolve, 15 * 1000));
          if (heartbeat) {
            await stream.writeSSE({
              data: JSON.stringify({
                type: "heartbeat",
                data: {
                  timestamp: Date.now(),
                },
              }),
            });
          }
        }
      });
    },
  );

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
