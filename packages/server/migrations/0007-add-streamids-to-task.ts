import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("task")
    .addColumn("streamIds", sql`text[]`)
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.alterTable("task").dropColumn("streamIds").execute();
}

