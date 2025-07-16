import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("member")
    .addUniqueConstraint("member_organizationId_userId_unique", [
      "organizationId",
      "userId"
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("member").dropConstraint("membership_organizationId_userId_unique").execute();
}

