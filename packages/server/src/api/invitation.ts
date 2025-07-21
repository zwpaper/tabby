import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth";
import { db } from "../db";

const invitation = new Hono().use(requireAuth()).get(
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
      .innerJoin("organization", "organization.id", "invitation.organizationId")
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
);

export default invitation;
