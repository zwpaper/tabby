import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("chatCompletion")
    .addColumn("organizationId", "text", (col) =>
      col.references("organization.id"),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("chatCompletion").dropColumn("organizationId").execute();
}

