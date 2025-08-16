import { getLogger } from "@getpochi/common";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAuth } from "../auth";
import { db } from "../db";

const logger = getLogger("AdminApi");

const admin = new Hono().get(
  "/searchUsers",
  zValidator(
    "query",
    z.object({
      query: z.string().min(1),
      limit: z
        .string()
        .optional()
        .transform((val) => (val ? Number.parseInt(val, 10) : 100)),
    }),
  ),
  requireAuth("admin"),
  async (c) => {
    const { query, limit } = c.req.valid("query");

    try {
      const searchTerm = `%${query.toLowerCase()}%`;

      const users = await db
        .selectFrom("user")
        .selectAll()
        .where((eb) =>
          eb.or([
            eb("email", "ilike", searchTerm),
            eb("name", "ilike", searchTerm),
          ]),
        )
        .orderBy("createdAt", "desc")
        .limit(limit)
        .execute();

      return c.json({
        users,
        total: users.length,
      });
    } catch (error) {
      logger.error("Search users error", error);
      throw new HTTPException(500, {
        message: "Failed to search users",
      });
    }
  },
);

export default admin;
