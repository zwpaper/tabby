import { Pool } from "pg";
import { parse } from "pg-connection-string";

export const pool = (() => {
  const conn = parse(process.env.DATABASE_URL || "");
  return new Pool({
    database: conn.database ?? undefined,
    password: conn.password,
    user: conn.user,
    host: conn.host ?? undefined,
    port: Number.parseInt(conn.port ?? "5432", 10),
    ssl: !!conn.ssl,
  });
})();
