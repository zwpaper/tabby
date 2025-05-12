import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { User } from "../auth";
import { readCurrentMonthQuota } from "./billing";
import { AvailableModels, getModelById } from "./constants";

export function checkModel(modelId: string) {
  const selectedModel = getModelById(modelId);
  if (!selectedModel) {
    throw new HTTPException(400, {
      message: `Invalid model '${modelId}'`,
    });
  }
  return selectedModel;
}

export function checkWaitlist(user: User, errorMessage = "Internal user only") {
  if (!user.email.endsWith("@tabbyml.com") && !user.isWaitlistApproved) {
    throw new HTTPException(400, { message: errorMessage });
  }
  return true;
}

export async function checkUserQuota(user: User, c: Context, modelId: string) {
  // Skip quota check for test environment
  if (process.env.NODE_ENV === "test") {
    return;
  }

  if (checkWaitlist(user)) {
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
