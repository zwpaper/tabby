import { type User, id, init } from "@instantdb/admin";
import type { LanguageModelUsage } from "ai";
import schema from "../../instant.schema";

const { INSTANT_APP_ID: appId = "", INSTANT_APP_ADMIN_TOKEN: adminToken = "" } =
  process.env;

if (process.env.NODE_ENV !== "test") {
  if (!appId || !adminToken) {
    throw new Error("INSTANT_APP_ID and INSTANT_APP_ADMIN_TOKEN must be set");
  }
}

const db = init({ appId, adminToken, schema });

export async function trackUsage(user: User, usage: LanguageModelUsage) {
  const { id: dailyUsageId, data: dailyUsage } = await getDailyUsage(
    user,
    usage,
  );
  db.transact([
    db.tx.chatCompletions[id()]
      .update({
        timestamp: JSON.stringify(new Date()),
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      })
      .link({
        user: user.id,
      }),
    db.tx.dailyUsages[dailyUsageId].update(dailyUsage).link({
      user: user.id,
    }),
  ]);
}

async function getDailyUsage(user: User, usage: LanguageModelUsage) {
  const todayDate = new Date().toISOString().split("T")[0];
  const { dailyUsages } = await db.query({
    dailyUsages: {
      $: {
        where: {
          date: todayDate,
          "user.id": user.id,
        },
        limit: 1,
      },
    },
  });

  const dailyUsage = dailyUsages[0];

  return {
    id: dailyUsage?.id ?? id(),
    data: {
      date: todayDate,
      promptTokens: (dailyUsage?.promptTokens || 0) + usage.promptTokens,
      completionTokens:
        (dailyUsage?.completionTokens || 0) + usage.completionTokens,
    },
  };
}

export async function verifyToken(token: string) {
  const user = await db.auth.verifyToken(token);
  if (!user || !user.email.endsWith("@tabbyml.com")) {
    return null;
  }
  return user;
}
