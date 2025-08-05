function isBrowser() {
  return typeof process === "undefined";
}

export function readEnv(key: "DEEPINFRA_API_KEY") {
  if (isBrowser()) {
    // biome-ignore lint/suspicious/noExplicitAny: silent error for non-node
    return (import.meta as any).env[`VITE_${key}`];
  }

  return process.env[key];
}
