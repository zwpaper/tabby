import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('minion')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('createdAt', 'timestamptz', col =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('updatedAt', 'timestamptz', col =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('userId', 'text', col =>
      col.references('user.id').onDelete('cascade').notNull()
    )
    .addColumn('e2bSandboxId', 'text', col => col.notNull())
    .addColumn('url', 'text', col => col.notNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('minion').execute()
}

