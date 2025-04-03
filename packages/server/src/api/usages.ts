import { Hono } from "hono";
import { authRequest } from "../auth";
import { db } from "../db";

const usages = new Hono().get("/today", authRequest, async (c) => {
  const date = new Date(new Date().toISOString().split("T")[0]);
  const user = c.get("user");

  const dailyUsage = await db
    .selectFrom("dailyUsage")
    .selectAll()
    .where("userId", "=", user.id)
    .where("date", "=", date)
    .executeTakeFirst();

  return c.json({
    date: dailyUsage?.date || date,
    completionTokens: dailyUsage?.completionTokens || 0,
    promptTokens: dailyUsage?.promptTokens || 0,
  });
});

export default usages;
