function isBrowser() {
  return typeof import.meta !== "undefined";
}

export function readEnv(key: "DEEPINFRA_API_KEY") {
  if (isBrowser()) {
    return import.meta.env[`VITE_${key}`];
  }

  return process.env[key];
}
