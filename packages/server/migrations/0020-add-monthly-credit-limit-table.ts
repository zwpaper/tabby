import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("monthlyCreditLimit")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn('createdAt', 'timestamptz', col =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('updatedAt', 'timestamptz', col =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("userId", "text", (col) =>
      col.references("user.id").onDelete("cascade").notNull(),
    )
    .addColumn("limit", "integer", (col) => col.notNull())
    .addUniqueConstraint("monthly_credit_limit_userId_unique", ["userId"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("monthlyCreditLimit").ifExists().execute();
}
