import { HTTPException } from "hono/http-exception";
import { ServerErrors } from "..";
import type { User } from "../auth";
import { usageService } from "../service/usage";
import { type AvailableModelId, AvailableModels } from "./constants";

export function checkModel(modelId: string): AvailableModelId {
  const found = AvailableModels.find((model) => model.id === modelId);
  if (!found) {
    throw new HTTPException(400, {
      message: `Invalid model '${modelId}'`,
    });
  }
  return modelId as AvailableModelId;
}

export function checkWaitlist(
  user: User,
  errorMessage = "Your waitlist request is still pending. Please wait for approval before using this feature.",
) {
  if (!user.email.endsWith("@tabbyml.com") && !user.isWaitlistApproved) {
    throw new HTTPException(400, { message: errorMessage });
  }
  return true;
}

export async function checkUserQuota(user: User, modelId: string) {
  // Skip quota check for test environment
  if (process.env.NODE_ENV === "test") {
    return;
  }

  // Check quota
  const quota = await usageService.readCurrentMonthQuota(user);

  const modelCostType = AvailableModels.find(
    (model) => model.id === modelId,
  )?.costType;

  if (!modelCostType) {
    throw new HTTPException(400, { message: "Invalid model" });
  }

  const reachQuotaLimit =
    quota.limits[modelCostType] - quota.usages[modelCostType] <= 0;

  // biome-ignore lint/correctness/noConstantCondition: disable this check for now
  if (false && reachQuotaLimit) {
    throw new HTTPException(400, {
      message: `You have reached the quota limit for ${modelCostType}. Please upgrade your plan or try again later.`,
    });
  }

  const isInternalUser =
    user.email.endsWith("@tabbyml.com") && user.emailVerified;

  if (!isInternalUser) {
    if (quota.credit.remainingFreeCredit <= 0 && quota.plan === "Community") {
      throw new HTTPException(400, {
        message: ServerErrors.RequireSubscription,
      });
    }

    if (quota.credit.isLimitReached) {
      throw new HTTPException(400, {
        message: ServerErrors.ReachedCreditLimit,
      });
    }
  }
}
