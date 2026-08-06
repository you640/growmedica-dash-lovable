import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getDbPool(): mysql.Pool {
  if (!pool) {
    const host = process.env.WP_DB_HOST || "db.r1.websupport.sk";
    const port = Number(process.env.WP_DB_PORT || 3306);
    const database = process.env.WP_DB_NAME || "8RJ89UpxAbjaP4mR";
    const user = process.env.WP_DB_USER || "5GckMhNYkGYDr2JK";
    const password = process.env.WP_DB_PASSWORD || "Lr1Y7e(o[B";

    pool = mysql.createPool({
      host,
      port,
      database,
      user,
      password,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
    });
  }
  return pool;
}

export async function testDbConnection(): Promise<{ ok: boolean; error: string | null }> {
  try {
    const db = getDbPool();
    const [rows] = await db.query("SELECT 1 AS alive");
    return { ok: Array.isArray(rows) && rows.length > 0, error: null };
  } catch (e) {
    console.error("[mysql:testDbConnection]", (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}
