import { zValidator } from "@hono/zod-validator";
import type { ClipData } from "@ragdoll/db";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { clipService } from "../service/clip";

const ZodClipDataType: z.ZodType<ClipData> = z.any();

const ClipCreateSchema = z.object({
  data: ZodClipDataType,
});

const clips = new Hono()
  .post(
    "/",
    zValidator("json", ClipCreateSchema),
    rateLimiter({
      windowMs: 60 * 1000,
      limit: 5,
      standardHeaders: "draft-6",
      keyGenerator(c) {
        const ipAddress =
          c.req.header("x-real-ip") ||
          c.req.header("x-forwarded-for") ||
          "default";
        return ipAddress;
      },
    }),
    async (c) => {
      const { data } = c.req.valid("json");
      const id = await clipService.create(data);
      return c.json({ id });
    },
  )
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const clip = await clipService.get(id);
    if (!clip) {
      throw new HTTPException(404, { message: "Clip not found" });
    }
    c.header("Cache-Control", "public, immutable, max-age=604800");
    return c.json(clip);
  });

export default clips;
