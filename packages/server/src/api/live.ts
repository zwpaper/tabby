import { type AuthToken, GoogleGenAI } from "@google/genai";
import { Hono } from "hono";
import { requireAuth } from "../auth";

const live = new Hono().get(
  "/ephemeral-token",
  requireAuth({ internal: true }),
  async (c) => {
    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const token: AuthToken = await client.authTokens.create({
      config: {
        uses: 1, // The default
        expireTime: expireTime, // Default is 30 mins
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    return c.json({ token: token.name });
  },
);

export default live;
