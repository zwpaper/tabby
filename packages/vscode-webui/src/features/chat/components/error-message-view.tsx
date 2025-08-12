import { ErrorMessage } from "@/components/error-message";
import { ServerErrors } from "@ragdoll/server";
import { ExternalLinkIcon } from "lucide-react";

export function ErrorMessageView({
  error,
}: { error: { message: string } | undefined }) {
  return (
    <ErrorMessage
      error={error}
      formatter={(e) => {
        if (e.message === ServerErrors.ReachedCreditLimit) {
          return (
            <span>
              You have reached the spending limit.{" "}
              <a
                href="https://app.getpochi.com/profile"
                target="_blank"
                rel="noopener noreferrer"
                className="!underline py-1"
              >
                <ExternalLinkIcon className="mx-0.5 inline size-4" />
                See more
              </a>
            </span>
          );
        }

        if (e.message === ServerErrors.ReachedOrgCreditLimit) {
          return (
            <span>
              Your team has reached the spending limit.{" "}
              <a
                href="https://app.getpochi.com/team"
                target="_blank"
                rel="noopener noreferrer"
                className="!underline py-1"
              >
                <ExternalLinkIcon className="mx-0.5 inline size-4" />
                See more
              </a>
            </span>
          );
        }

        if (e.message === ServerErrors.RequireSubscription) {
          return (
            <span>
              You've used all your free credits. To continue, please subscribe
              to Pochi.{" "}
              <a
                href="https://app.getpochi.com/profile"
                target="_blank"
                rel="noopener noreferrer"
                className="!underline py-1"
              >
                <ExternalLinkIcon className="mx-0.5 inline size-4" />
                Subscribe
              </a>
            </span>
          );
        }

        if (e.message === ServerErrors.RequireOrgSubscription) {
          return (
            <span>
              Your team does not have a subscription yet. To continue, please
              subscribe to Pochi.{" "}
              <a
                href="https://app.getpochi.com/team"
                target="_blank"
                rel="noopener noreferrer"
                className="!underline py-1"
              >
                <ExternalLinkIcon className="mx-0.5 inline size-4" />
                Subscribe
              </a>
            </span>
          );
        }

        if (e.message === ServerErrors.RequirePayment) {
          return (
            <span>
              You have unpaid invoices. Please{" "}
              <a
                href="https://app.getpochi.com/profile"
                target="_blank"
                rel="noopener noreferrer"
                className="!underline py-1"
              >
                make a payment
              </a>{" "}
              to continue using Pochi
            </span>
          );
        }

        if (e.message === ServerErrors.RequireOrgPayment) {
          return (
            <span>
              Your team have unpaid invoices. Please{" "}
              <a
                href="https://app.getpochi.com/team"
                target="_blank"
                rel="noopener noreferrer"
                className="!underline py-1"
              >
                make a payment
              </a>{" "}
              to continue using Pochi
            </span>
          );
        }

        return e.message;
      }}
    />
  );
}
