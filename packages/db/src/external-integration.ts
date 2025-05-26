import type { Installation } from "@slack/bolt";

interface SlackProvider {
  provider: "slack";
  payload: Installation<"v2", boolean>;
}

interface GithubProvider {
  provider: "github";
  payload: {
    accessToken: string;
    scopes: string[];
  };
}

export type ExternalIntegrationVendorData = {
  integrationId: string;
} & (SlackProvider | GithubProvider);
