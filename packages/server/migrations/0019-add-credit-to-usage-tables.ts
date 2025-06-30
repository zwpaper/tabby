import { type Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("monthlyUsage")
    .addColumn("credit", "integer", (cb) => cb.notNull().defaultTo(0))
    .execute();

  await db.schema
    .alterTable("chatCompletion")
    .addColumn("credit", "integer", (cb) => cb.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.alterTable("monthlyUsage").dropColumn("credit").execute();
  await db.schema.alterTable("chatCompletion").dropColumn("credit").execute();
}
