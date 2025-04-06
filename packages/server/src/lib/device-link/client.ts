import type { BetterAuthClientPlugin } from "better-auth";
import type { deviceLink } from ".";

export const deviceLinkClient = () => {
  return {
    id: "device-link",
    $InferServerPlugin: {} as ReturnType<typeof deviceLink>,
    pathMethods: {
      "/sign-in/device-link": "POST",
    },
  } satisfies BetterAuthClientPlugin;
};
