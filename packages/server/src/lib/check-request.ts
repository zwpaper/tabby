import { HTTPException } from "hono/http-exception";
import { ServerErrors } from "..";
import { type User, isInternalOrganization } from "../auth";
import { organizationService } from "../service/organization";
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

  const organization = await organizationService.readActiveOrganizationByUser(
    user.id,
  );
  const orgQuota = organization
    ? await usageService.readCurrentMonthOrganizationQuota(organization.id)
    : undefined;
  const userQuota = await usageService.readCurrentMonthQuota(user);

  // If a user joins an organization, then only check the organization's quota
  if (organization) {
    if (!isInternalOrganization(organization)) {
      if (orgQuota?.credit?.isUnpaid) {
        throw new HTTPException(400, {
          message: ServerErrors.RequireOrgPayment,
        });
      }

      if (!orgQuota?.plan) {
        throw new HTTPException(400, {
          message: ServerErrors.RequireOrgSubscription,
        });
      }

      if (orgQuota?.credit.isLimitReached) {
        throw new HTTPException(400, {
          message: ServerErrors.ReachedOrgCreditLimit,
        });
      }
    }

    return;
  }

  const userOutOfFreeCredit =
    userQuota.credit.remainingFreeCredit <= 0 && userQuota.plan === "Community";

  if (userQuota.credit.isUnpaid) {
    throw new HTTPException(400, {
      message: ServerErrors.RequirePayment,
    });
  }

  if (userOutOfFreeCredit) {
    throw new HTTPException(400, {
      message: ServerErrors.RequireSubscription,
    });
  }

  const userLimitReached = userQuota.credit.isLimitReached;
  if (userLimitReached) {
    throw new HTTPException(400, {
      message: ServerErrors.ReachedCreditLimit,
    });
  }
}

export async function checkUserCodeCompletionQuota(user: User) {
  if (process.env.NODE_ENV === "test") {
    // Skip quota check for test environment
    return;
  }

  const usage = await usageService.readCodeCompletionUsage(user);
  if (!usage.isSubscriptionRequired) {
    // covered by free tier
    return;
  }

  const organization = await organizationService.readActiveOrganizationByUser(
    user.id,
  );
  if (organization && isInternalOrganization(organization)) {
    // internal organization
    return;
  }

  const orgQuota = organization
    ? await usageService.readCurrentMonthOrganizationQuota(organization.id)
    : undefined;

  if (organization) {
    if (orgQuota?.credit?.isUnpaid) {
      throw new HTTPException(400, {
        message: ServerErrors.RequireOrgPayment,
      });
    }

    if (!orgQuota?.plan) {
      throw new HTTPException(400, {
        message: ServerErrors.RequireOrgSubscription,
      });
    }

    // covered by org plan
    return;
  }

  const userQuota = await usageService.readCurrentMonthQuota(user);
  if (userQuota.credit.isUnpaid) {
    throw new HTTPException(400, {
      message: ServerErrors.RequirePayment,
    });
  }
  if (userQuota.plan === "Community") {
    // free plan
    throw new HTTPException(400, {
      message: ServerErrors.RequireSubscription,
    });
  }

  // covered by Pro plan
  return;
}
