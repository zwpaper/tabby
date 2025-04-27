import type { Endpoints } from "@octokit/types";
import type { Installation } from "@slack/bolt";

interface SlackProvider {
  provider: "slack";
  payload: Installation<"v2", boolean>;
}

interface GithubProvider {
  provider: "github";
  payload: Endpoints["GET /user/installations"]["response"]["data"]["installations"][number];
}

export type ExternalIntegrationVendorData = {
  integrationId: string;
} & (SlackProvider | GithubProvider);
