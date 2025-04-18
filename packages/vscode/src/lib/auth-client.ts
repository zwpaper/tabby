import type * as vscode from "vscode";

import { deviceLinkClient } from "@ragdoll/server";
import { createAuthClient as createAuthClientImpl } from "better-auth/react";

const DevBaseUrl = "http://localhost:4111";
const ProdBaseUrl = "https://app.getpochi.com";

function isDev() {
  return !!process.env.POCHI_DEV_SERVER;
}

export function createAuthClient(context: vscode.ExtensionContext) {
  const updateSession = (
    session:
      | ReturnType<typeof createAuthClientImpl>["$Infer"]["Session"]
      | null,
  ) => {
    context.globalState.update("session", session);
  };

  const getToken = () => {
    const session =
      context.globalState.get<
        ReturnType<typeof createAuthClientImpl>["$Infer"]["Session"]
      >("session") || null;
    return session?.session.token || "";
  };

  const authClient = createAuthClientImpl({
    baseURL: isDev() ? DevBaseUrl : ProdBaseUrl,
    plugins: [deviceLinkClient()],

    fetchOptions: {
      auth: {
        type: "Bearer",
        token: getToken,
      },
    },
  });

  if (getToken()) {
    authClient.getSession().then((session) => {
      // Refresh session if it exists.
      updateSession(session.data);
    });
  }

  return new Proxy(authClient, {
    get(target, prop, receiver) {
      if (prop === "updateSession") {
        return updateSession;
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as unknown as typeof authClient & {
    updateSession: typeof updateSession;
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;
