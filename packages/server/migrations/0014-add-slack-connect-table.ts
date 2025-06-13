import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('slackConnect')
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
    .addColumn('vendorIntegrationId', 'text', col => col.notNull())
    .execute()

  // Create unique index on userId to ensure one-to-one mapping
  await db.schema
    .createIndex('slackConnect_userId_unique_idx')
    .unique()
    .on('slackConnect')
    .column('userId')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('slackConnect_userId_unique_idx').execute()
  await db.schema.dropTable('slackConnect').execute()
} 