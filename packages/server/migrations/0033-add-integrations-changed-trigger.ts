import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION notify_external_integration_changed()
    RETURNS TRIGGER AS $$
    BEGIN
      IF (TG_OP = 'DELETE') THEN
        PERFORM pg_notify('integrations_changed', row_to_json(OLD)::text);
        RETURN OLD;
      ELSE
        PERFORM pg_notify('integrations_changed', row_to_json(NEW)::text);
        RETURN NEW;
      END IF;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`
    CREATE TRIGGER external_integration_changed_trigger
    AFTER INSERT OR UPDATE OR DELETE ON "externalIntegration"
    FOR EACH ROW
    EXECUTE FUNCTION notify_external_integration_changed();
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    DROP TRIGGER IF EXISTS external_integration_changed_trigger ON "externalIntegration";
  `.execute(db)
  await sql`
    DROP FUNCTION IF EXISTS notify_external_integration_changed()
  `.execute(db);
}
