export function toError(e: unknown): Error {
  if (e instanceof Error) {
    return e;
  }
  if (typeof e === "string") {
    return new Error(e);
  }
  return new Error(JSON.stringify(e));
}

export function toErrorString(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  if (typeof e === "string") {
    return e;
  }
  return JSON.stringify(e);
}
