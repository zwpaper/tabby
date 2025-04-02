import { init } from "@instantdb/admin";
import schema from "../../instant.schema";

let dbInstance: ReturnType<typeof init> | null = null;

export function db() {
  if (dbInstance) {
    return dbInstance;
  }

  const { INSTANT_APP_ID: appId, INSTANT_APP_ADMIN_TOKEN: adminToken } =
    process.env;

  if (!appId || !adminToken) {
    throw new Error("Missing INSTANT_APP_ID or INSTANT_APP_ADMIN_TOKEN");
  }

  dbInstance = init({ appId, adminToken, schema });
  return dbInstance;
}
