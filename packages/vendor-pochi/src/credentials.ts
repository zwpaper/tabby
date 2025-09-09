import { getLogger } from "@getpochi/common";
import { pochiConfig, updatePochiConfig } from "@getpochi/common/configuration";
import type { PochiCredentials } from "./types";

const logger = getLogger("PochiCredentials");

export function getPochiCredentials() {
  return pochiConfig.value.vendors?.pochi?.credentials as
    | PochiCredentials
    | undefined;
}

export function updatePochiCredentials(
  credentials: Partial<PochiCredentials> | null,
) {
  if (credentials) {
    logger.debug("update pochi credentials", Object.keys(credentials));
  }
  updatePochiConfig({
    vendors: {
      pochi: credentials === null ? null : { credentials },
    },
  });
}
