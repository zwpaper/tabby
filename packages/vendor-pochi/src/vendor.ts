import type { UserInfo } from "@getpochi/common/configuration";
import { deviceLinkClient } from "@getpochi/common/device-link/client";
import type { PochiApi, PochiApiClient } from "@getpochi/common/pochi-api";
import {
  type AuthOutput,
  type ModelOptions,
  VendorBase,
} from "@getpochi/common/vendor";
import { getServerBaseUrl } from "@getpochi/common/vscode-webui-bridge";
import { createAuthClient as createAuthClientImpl } from "better-auth/react";
import { hc } from "hono/client";
import { funnel } from "remeda";
import { getPochiCredentials, updatePochiCredentials } from "./credentials";
import { type PochiCredentials, VendorId } from "./types";

export class Pochi extends VendorBase {
  private cachedModels?: Record<string, ModelOptions>;

  constructor() {
    super(VendorId);
  }

  override authenticate(): Promise<AuthOutput> {
    throw new Error(
      "Please use the VSCode Extension UI to authenticate with Pochi.",
    );
  }

  override async fetchModels(): Promise<Record<string, ModelOptions>> {
    if (!this.cachedModels) {
      const apiClient: PochiApiClient = hc<PochiApi>(getServerBaseUrl());
      const resp = await apiClient.api.models.$get();
      const data = await resp.json();
      this.cachedModels = Object.fromEntries(
        data.map((x) => [
          x.id,
          {
            contextWindow: x.contextWindow,
            useToolCallMiddleware: x.id.includes("google/"),
            label: x.costType === "basic" ? "swift" : "super",
          } satisfies ModelOptions,
        ]),
      );
    }

    return this.cachedModels;
  }

  protected override async renewCredentials(
    credentials: PochiCredentials,
  ): Promise<PochiCredentials> {
    return credentials;
  }

  protected override async fetchUserInfo(
    _credentials: PochiCredentials,
  ): Promise<UserInfo> {
    const session = await authClient.getSession();
    if (!session.data) {
      throw new Error(session.error.message);
    }

    return {
      name: session.data.user.name,
      email: session.data.user.email,
      image: session.data.user.image || undefined,
    };
  }
}

function createAuthClient() {
  // JWT is populated for every getSession request, thus we need to apply certain throttling.
  const updateJwtToken = funnel(
    (jwt: string) => {
      updatePochiCredentials({
        jwt,
      });
    },
    {
      minGapMs: 30_000, // Every 30 seconds
      triggerAt: "start",
      reducer: (_, rhs: string) => rhs,
    },
  );

  const authClient = createAuthClientImpl({
    baseURL: getServerBaseUrl(),
    plugins: [deviceLinkClient()],

    fetchOptions: {
      customFetchImpl: buildCustomFetchImpl(),
      onResponse: (ctx) => {
        const token = ctx.response.headers.get("set-auth-token"); // get the token from the response headers
        if (token) {
          updatePochiCredentials({
            token,
          });
        }

        const jwt = ctx.response.headers.get("set-auth-jwt");
        if (jwt) {
          updateJwtToken.call(jwt);
        }
      },
    },
  });

  return authClient;
}

const buildCustomFetchImpl = () => {
  return async (input: string | URL | Request, requestInit?: RequestInit) => {
    const token = getPochiCredentials()?.token;
    const headers = new Headers(requestInit?.headers);
    if (token) {
      headers.append("Authorization", `Bearer ${token}`);
    }
    return fetch(input, {
      ...requestInit,
      headers,
    });
  };
};

export const authClient = createAuthClient();
