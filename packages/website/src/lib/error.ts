export class HttpError extends Error {
  status: number;

  constructor(status: number, message?: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message?: string) {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message?: string) {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message?: string) {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

export class InternalServerError extends HttpError {
  constructor(message?: string) {
    super(500, message);
    this.name = "InternalServerError";
  }
}

export class ClientError extends Error {
  cause: "network" | "syntax" | "aborted" | "unknown";

  constructor(message?: string, cause: ClientError["cause"] = "unknown") {
    super(message);
    this.name = "ClientError";
    this.cause = cause;
  }
}

export function toHttpError(resp: Response): HttpError {
  switch (resp.status) {
    case 401:
      return new UnauthorizedError();
    case 403:
      return new ForbiddenError();
    case 404:
      return new NotFoundError();
    case 500:
      return new InternalServerError();
    default:
      return new HttpError(resp.status);
  }
}

export function normalizeApiError(error: unknown): Error {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof SyntaxError) {
    return new ClientError(error.message, "syntax");
  }

  // NOTE: We can be reasonably sure that an AbortError is a timeout because
  // we are the ones calling controller.abort() inside a setTimeout.
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ClientError(error.message, "aborted");
  }

  if (error instanceof TypeError) {
    return new ClientError(error.message, "network");
  }

  return error as Error;
}

export function getBetterAuthErrorMessage(
  // biome-ignore lint/suspicious/noExplicitAny: Better auth error
  error: any,
  defaultErrorMessage?: string,
) {
  if (typeof error === "string") {
    error;
  }

  if (error?.error) {
    return (
      error.error.message ||
      error.error.code ||
      error.error.statusText ||
      defaultErrorMessage
    );
  }

  return error?.message || defaultErrorMessage;
}
