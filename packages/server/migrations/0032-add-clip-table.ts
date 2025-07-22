import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('clip')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('data', 'jsonb', col => col.notNull())
    .addColumn('createdAt', 'timestamptz', col =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn('updatedAt', 'timestamptz', col =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('clip').ifExists().execute();
}

