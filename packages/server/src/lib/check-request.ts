import { HTTPException } from "hono/http-exception";
import { ServerErrors } from "..";
import type { User } from "../auth";
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

  const isInternalUser =
    user.email.endsWith("@tabbyml.com") && user.emailVerified;

  if (!isInternalUser) {
    // if joined an organization, only check the orgQuota
    if (orgQuota?.credit.isLimitReached) {
      if (!orgQuota?.plan) {
        throw new HTTPException(400, {
          message: ServerErrors.RequireSubscription,
        });
      }

      throw new HTTPException(400, {
        message: ServerErrors.ReachedCreditLimit,
      });
    }

    const userOutOfFreeCredit =
      userQuota.credit.remainingFreeCredit <= 0 &&
      userQuota.plan === "Community";

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
}
