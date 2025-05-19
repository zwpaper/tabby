import { type Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("task")
    .addColumn("totalTokens", "integer")
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.alterTable("task").dropColumn("totalTokens").execute();
}

