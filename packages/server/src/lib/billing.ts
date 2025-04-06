import { type HonoRequest } from "hono";
import moment from "moment";
import { sql } from "kysely";
import { auth } from "../auth";
import { db } from "../db";
import { AvailableModels, StripePlans } from "./constants";
import type { User } from "better-auth";

export async function readActiveSubscriptionLimits(user: User, r: HonoRequest) {
    const activeSubscription = await auth.api.listActiveSubscriptions({
        query: {
            referenceId: user.id
        },
        headers: r.raw.headers,
    }).then(r => r[0]);

    return {
        plan: activeSubscription?.plan ?? StripePlans[0].name,
        limits: activeSubscription?.limits ?? StripePlans[0].limits,
    }
}

export async function readCurrentMonthQuota(user: User, r: HonoRequest) {
    // Calculate the start of the current month (UTC)
    const now = moment.utc();
    const startOfMonth = now.startOf("month").startOf("hour").toDate()

    const { plan, limits } = await readActiveSubscriptionLimits(user, r);

    // Query the total usage count for the current month.
    // Ensure the timestamp comparison works correctly with the database timezone (assuming UTC)
    const results = await db
        .selectFrom("monthlyUsage")
        .select([
            "modelId",
            "count",
        ])
        .where("userId", "=", user.id)
        // Compare the timestamp column directly with the Date object
        .where(sql`"startDayOfMonth" AT TIME ZONE 'UTC'`, "=", startOfMonth)
        .execute(); // Use executeTakeFirstOrThrow() if you expect a result or want an error

    const usages = {
        basic: 0,
        premium: 0,
    };

    for (const x of results) {
        const model = AvailableModels.find((m) => m.id === x.modelId);
        if (model) {
            usages[model.costType] += x.count;
        }
    }

    return {
        plan,
        usages,
        limits,
    }
}
