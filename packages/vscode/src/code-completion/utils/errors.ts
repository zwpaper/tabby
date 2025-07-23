import { ServerErrors } from "@ragdoll/server";

export class HttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly text;

  constructor({
    status,
    statusText,
    text,
  }: {
    status: number;
    statusText: string;
    text?: string | undefined;
  }) {
    super(
      `${status} ${statusText}: ${text?.trim() || "No additional details."}`,
    );
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.text = text;
  }
}

export class AbortError extends Error {
  constructor(message?: string) {
    super(message || "Request aborted.");
    this.name = "AbortError";
  }
}

export class TimeoutError extends Error {
  constructor(message?: string) {
    super(message || "Request timed out.");
    this.name = "TimeoutError";
  }
}

export function isTimeoutError(error: unknown) {
  return (
    (error instanceof Error && error.name === "TimeoutError") ||
    (error instanceof HttpError && error.status === 408)
  );
}

export function isCanceledError(error: unknown) {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (error instanceof HttpError && error.status === 499)
  );
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof HttpError && [401, 403].includes(error.status);
}

export function isRateLimitExceededError(error: unknown) {
  return error instanceof HttpError && error.status === 429;
}

export function checkSubscriptionRequiredError(
  error: unknown,
): undefined | "user" | "team" {
  if (error instanceof HttpError && error.status === 400) {
    if (error.text === ServerErrors.RequireSubscription) {
      return "user";
    }
    if (error.text === ServerErrors.RequireOrgSubscription) {
      return "team";
    }
  }
  return undefined;
}

export function checkPaymentRequiredError(
  error: unknown,
): undefined | "user" | "team" {
  if (error instanceof HttpError && error.status === 400) {
    if (error.text === ServerErrors.RequirePayment) {
      return "user";
    }
    if (error.text === ServerErrors.RequireOrgPayment) {
      return "team";
    }
  }
  return undefined;
}
