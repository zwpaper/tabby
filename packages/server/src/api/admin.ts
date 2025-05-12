import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAuth } from "../auth";
import { db } from "../db";

const admin = new Hono().post(
  "/approveWaitlist",
  zValidator(
    "query",
    z.object({
      userId: z.string(),
    }),
  ),
  requireAuth,
  async (c) => {
    const { userId } = c.req.valid("query");
    const user = c.get("user");

    if (!user || user.role !== "admin") {
      throw new HTTPException(403, {
        message: "Forbidden: Admin access required",
      });
    }

    try {
      const result = await db
        .updateTable("user")
        .set({ isWaitlistApproved: true })
        .where("id", "=", userId)
        .returning("id")
        .executeTakeFirst();

      if (!result) {
        throw new HTTPException(404, {
          message: "User not found",
        });
      }

      return c.json({
        message: `User ${userId} approved and status set to active.`,
      });
    } catch (error) {
      throw new HTTPException(500, {
        message: "Failed to approve user",
      });
    }
  },
);

export default admin;
