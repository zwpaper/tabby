import { type Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("task")
    .addColumn("isDeleted", "boolean", (col) => col.defaultTo(false).notNull())
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema
    .alterTable("task")
    .dropColumn("isDeleted")
    .execute();
}
