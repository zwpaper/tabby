import { PochiApiErrors } from "@ragdoll/common";
import { HTTPException } from "hono/http-exception";
import { type User, isInternalOrganization } from "../auth";
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

export async function checkUserQuota(user: User, modelId: string) {
  // Skip quota check for test environment
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const modelCostType = AvailableModels.find(
    (model) => model.id === modelId,
  )?.costType;

  if (!modelCostType) {
    throw new HTTPException(400, { message: "Invalid model" });
  }

  const orgQuota = await usageService.readCurrentMonthOrganizationQuotaByUser(
    user.id,
  );

  // If a user joins an organization, then only check the organization's quota
  if (orgQuota) {
    const { organization, quota } = orgQuota;
    if (!isInternalOrganization(organization)) {
      if (quota.credit.isUnpaid) {
        throw new HTTPException(422, {
          message: PochiApiErrors.RequireOrgPayment,
        });
      }

      if (!quota.plan) {
        throw new HTTPException(422, {
          message: PochiApiErrors.RequireOrgSubscription,
        });
      }

      if (quota.credit.isLimitReached) {
        throw new HTTPException(422, {
          message: PochiApiErrors.ReachedOrgCreditLimit,
        });
      }
    }

    return;
  }

  // otherwise, check user quota
  const userQuota = await usageService.readCurrentMonthQuota(user);
  const userOutOfFreeCredit =
    userQuota.credit.remainingFreeCredit <= 0 && userQuota.plan === "Community";

  if (userQuota.credit.isUnpaid) {
    throw new HTTPException(422, {
      message: PochiApiErrors.RequirePayment,
    });
  }

  if (userOutOfFreeCredit) {
    throw new HTTPException(422, {
      message: PochiApiErrors.RequireSubscription,
    });
  }

  const userLimitReached = userQuota.credit.isLimitReached;
  if (userLimitReached) {
    throw new HTTPException(422, {
      message: PochiApiErrors.ReachedCreditLimit,
    });
  }

  return {
    remainingFreeCredit: userQuota.credit.remainingFreeCredit,
  };
}

export async function checkUserCodeCompletionQuota(user: User) {
  if (process.env.NODE_ENV === "test") {
    // Skip quota check for test environment
    return;
  }

  const orgQuota = await usageService.readCurrentMonthOrganizationQuotaByUser(
    user.id,
  );

  if (orgQuota) {
    const { organization, quota } = orgQuota;
    if (isInternalOrganization(organization)) {
      // internal organization are not subject to quota
      return;
    }

    // check organization quota
    if (quota.credit.isUnpaid) {
      throw new HTTPException(422, {
        message: PochiApiErrors.RequireOrgPayment,
      });
    }

    if (!quota.plan) {
      throw new HTTPException(422, {
        message: PochiApiErrors.RequireOrgSubscription,
      });
    }

    // covered by org plan
    return;
  }

  // check user quota
  const usage = await usageService.readCodeCompletionUsage(user);
  if (!usage.isSubscriptionRequired) {
    // covered by free tier
    return;
  }

  if (usage.isUnpaid) {
    throw new HTTPException(422, {
      message: PochiApiErrors.RequirePayment,
    });
  }

  if (usage.plan === "Community") {
    // free plan
    throw new HTTPException(422, {
      message: PochiApiErrors.RequireSubscription,
    });
  }

  // covered by Pro plan
  return;
}
