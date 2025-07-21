import { zValidator } from "@hono/zod-validator";
import { generateId } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth";
import { db } from "../db";

const invitation = new Hono()
  .use(requireAuth())
  .get(
    "/me",
    zValidator(
      "query",
      z.object({
        status: z.string().optional(),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      const { status } = c.req.valid("query");

      let query = db
        .selectFrom("invitation")
        .innerJoin(
          "organization",
          "organization.id",
          "invitation.organizationId",
        )
        .where("email", "=", user.email)
        .select([
          "invitation.id as id",
          "invitation.status as status",
          "invitation.role as role",
          "invitation.expiresAt as expiresAt",
          "organization.name as organizationName",
          "organization.slug as organizationSlug",
        ]);

      if (status) {
        query = query.where("status", "=", status);
      }

      const invitations = await query.execute();

      return c.json({ invitations });
    },
  )
  .post("/:id/accept", async (c) => {
    const user = c.get("user");
    const invitationId = c.req.param("id");

    const invitation = await db
      .selectFrom("invitation")
      .where("id", "=", invitationId)
      .selectAll()
      .executeTakeFirst();

    if (!invitation || invitation.email !== user.email) {
      return c.json({ error: "Invitation not found" }, 404);
    }

    if (invitation.status !== "pending") {
      return c.json({ error: "Invitation is not pending" }, 400);
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("invitation")
        .set({ status: "accepted" })
        .where("id", "=", invitationId)
        .execute();

      await trx
        .insertInto("member")
        .values({
          id: generateId(),
          createdAt: new Date(),
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role || "member",
        })
        .execute();
    });

    return c.json({ success: true });
  })
  .post("/:id/decline", async (c) => {
    const user = c.get("user");
    const invitationId = c.req.param("id");

    const invitation = await db
      .selectFrom("invitation")
      .where("id", "=", invitationId)
      .selectAll()
      .executeTakeFirst();

    if (!invitation || invitation.email !== user.email) {
      return c.json({ error: "Invitation not found" }, 404);
    }

    if (invitation.status !== "pending") {
      return c.json({ error: "Invitation is not pending" }, 400);
    }

    await db
      .updateTable("invitation")
      .set({ status: "declined" })
      .where("id", "=", invitationId)
      .execute();

    return c.json({ success: true });
  });

export default invitation;
