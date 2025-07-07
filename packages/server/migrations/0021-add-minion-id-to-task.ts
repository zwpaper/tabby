import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("task")
    .addColumn("minionId", "integer", (col) =>
      col.references("minion.id").onDelete("set null")
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("task")
    .dropColumn("minionId")
    .execute();
}
