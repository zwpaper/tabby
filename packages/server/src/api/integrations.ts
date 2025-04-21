import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "../auth";
import { db } from "../db";

const integrations = new Hono()
  // Get all integrations for the current user
  .get("/", requireAuth, async (c) => {
    const user = c.get("user");
    try {
      const userIntegrations = await db
        .selectFrom("externalIntegration")
        .select([
          "id",
          "provider",
          "vendorIntegrationId",
          "createdAt",
          "updatedAt",
          "userId",
          "payload",
        ])
        .where("userId", "=", user.id)
        .execute();
      return c.json(userIntegrations);
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
      throw new HTTPException(500, { message: "Failed to fetch integrations" });
    }
  })
  // Delete an integration
  .delete("/:id", requireAuth, async (c) => {
    const user = c.get("user");
    const integrationId = Number.parseInt(c.req.param("id"), 10);

    if (Number.isNaN(integrationId)) {
      throw new HTTPException(400, { message: "Invalid integration ID" });
    }

    try {
      // First verify that this integration belongs to the user
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

      // Delete the integration
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

export default integrations;
