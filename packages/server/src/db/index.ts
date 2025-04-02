import { type User, id, init } from "@instantdb/admin";
import type { LanguageModelUsage } from "ai";
import schema from "../../instant.schema";

let dbInstance: ReturnType<typeof init> | null = null;

export function db() {
  if (dbInstance) {
    return dbInstance;
  }

  const { INSTANT_APP_ID: appId, INSTANT_APP_ADMIN_TOKEN: adminToken } =
    process.env;

  if (!appId || !adminToken) {
    throw new Error("Missing INSTANT_APP_ID or INSTANT_APP_ADMIN_TOKEN");
  }

  dbInstance = init({ appId, adminToken, schema });
  return dbInstance;
}

export async function trackUsage(user: User, usage: LanguageModelUsage) {
  const { id: dailyUsageId, data: dailyUsage } = await getDailyUsage(
    user,
    usage,
  );
  db().transact([
    db().tx.chatCompletions[id()].update({
      timestamp: JSON.stringify(new Date()),
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      user: user.id,
    }),
    db().tx.dailyUsages[dailyUsageId].update(dailyUsage),
  ]);
}

async function getDailyUsage(user: User, usage: LanguageModelUsage) {
  const todayDate = new Date().toISOString().split("T")[0];
  const { dailyUsages } = await db().query({
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

  const dailyUsage = dailyUsages[0] as
    | {
        id: string;
        promptTokens: number;
        completionTokens: number;
      }
    | undefined;

  return {
    id: dailyUsage?.id ?? id(),
    data: {
      date: todayDate,
      user: user.id,
      promptTokens: (dailyUsage?.promptTokens || 0) + usage.promptTokens,
      completionTokens:
        (dailyUsage?.completionTokens || 0) + usage.completionTokens,
    },
  };
}
