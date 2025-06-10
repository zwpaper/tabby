import { sql } from "kysely";
import { db } from "../db";

class GithubService {
  /**
   * Check if user has GitHub integration connected
   */
  async checkConnection(userId: string): Promise<boolean> {
    const githubIntegration = await db
      .selectFrom("externalIntegration")
      .select("id")
      .where("userId", "=", userId)
      .where(sql`"vendorData"->>'provider'`, "=", "github")
      .executeTakeFirst();
    return !!githubIntegration;
  }

  /**
   * Get user's GitHub access token
   */
  async getAccessToken(userId: string): Promise<string | null> {
    const githubIntegration = await db
      .selectFrom("externalIntegration")
      .select("vendorData")
      .where("userId", "=", userId)
      .where(sql`"vendorData"->>'provider'`, "=", "github")
      .executeTakeFirst();

    if (!githubIntegration) {
      return null;
    }

    const vendorData = githubIntegration.vendorData;
    if (vendorData.provider === "github" && vendorData.payload?.accessToken) {
      return vendorData.payload.accessToken as string;
    }

    return null;
  }
}

export const githubService = new GithubService();
