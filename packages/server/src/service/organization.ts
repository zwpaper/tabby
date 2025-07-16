import { db } from "../db";

class OrganizationService {
  async readActiveOrganizationByUser(userId: string) {
    const organization = await db
      .selectFrom("member")
      .innerJoin("organization", "organization.id", "member.organizationId")
      .where("member.userId", "=", userId)
      .selectAll("organization")
      .executeTakeFirst();
    return organization;
  }
}

export const organizationService = new OrganizationService();
