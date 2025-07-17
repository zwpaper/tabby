export class HttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly response: Response;

  constructor(response: Response) {
    super(`${response.status} ${response.statusText}`);
    this.name = "HttpError";
    this.status = response.status;
    this.statusText = response.statusText;
    this.response = response;
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
    (error instanceof HttpError && [408, 499].includes(error.status))
  );
}

export function isCanceledError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof HttpError && [401, 403].includes(error.status);
}

export function isRateLimitExceededError(error: unknown) {
  return error instanceof HttpError && error.status === 429;
}
