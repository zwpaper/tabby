import type { User } from "better-auth";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { readCurrentMonthQuota } from "./billing";
import { AvailableModels, WHITELIST_USERS, getModelById } from "./constants";

export function checkModel(modelId: string) {
  const selectedModel = getModelById(modelId);
  if (!selectedModel) {
    throw new HTTPException(400, {
      message: `Invalid model '${modelId}'`,
    });
  }
  return selectedModel;
}

/**
 * Checks if a user is whitelisted (either tabbyml.com email or in WHITELIST_USERS)
 */
function isWhitelistedUser(user: User) {
  return (
    user.email.endsWith("@tabbyml.com") || WHITELIST_USERS.includes(user.email)
  );
}

/**
 * Validates a user against the whitelist
 * Throws an HTTP exception if the user is not whitelisted
 */
export function checkWhitelist(
  user: User,
  errorMessage = "Internal user only",
): void {
  if (!isWhitelistedUser(user)) {
    throw new HTTPException(400, { message: errorMessage });
  }
}

export async function checkUserQuota(user: User, c: Context, modelId: string) {
  // Skip quota check for test environment
  if (process.env.NODE_ENV === "test") {
    return;
  }

  // Check whitelist - skip quota check for whitelisted users
  if (isWhitelistedUser(user)) {
    return;
  }

  // Check quota
  const quota = await readCurrentMonthQuota(user, c.req);
  const modelCostType = AvailableModels.find(
    (model) => model.id === modelId,
  )?.costType;

  if (!modelCostType) {
    throw new HTTPException(400, { message: "Invalid model" });
  }

  if (quota.limits[modelCostType] - quota.usages[modelCostType] <= 0) {
    throw new HTTPException(400, {
      message: `You have reached the quota limit for ${modelCostType}. Please upgrade your plan or try again later.`,
    });
  }
}
