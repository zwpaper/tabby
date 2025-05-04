import { S3Client } from "@aws-sdk/client-s3";
import { HonoS3Storage } from "@hono-storage/s3";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { requireAuth } from "../auth";

const app = new Hono();
export default app;

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "R2_ACCESS_KEY_ID is not set",
    secretAccessKey:
      process.env.R2_SECRET_ACCESS_KEY || "R2_SECRET_ACCESS_KEY is not set",
  },
});

const storage = new HonoS3Storage({
  key: (_, file) =>
    `${file.originalname}-${new Date().getTime()}.${file.extension}`,
  bucket: process.env.R2_BUCKET_NAME || "R2_BUCKET_NAME is not set",
  client,
});

// FIXME: add rate limiter https://github.com/rhinobase/hono-rate-limiter
app.post(
  "/",
  requireAuth,
  bodyLimit({
    maxSize: 1024 * 1024 * 10, // 10Mb
    onError: (c) => c.text("overflow :(", 413),
  }),
  // Expires in 1 year
  storage.single("image", { sign: { expiresIn: 60 * 60 * 24 * 365 } }),
  (c) => {
    return c.json({
      image: c.var.signedURLs.image,
    });
  },
);
