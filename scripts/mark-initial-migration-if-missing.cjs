/**
 * Registers InitialSchema1776594176196 when the DB was created under another
 * migration timestamp. Run once if `migration:run` tries to re-apply InitialSchema.
 */
require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'ntu_study',
    ...(process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });
  await client.connect();
  try {
    const r = await client.query(
      `INSERT INTO "migrations"("timestamp", "name")
       SELECT 1776594176196, 'InitialSchema1776594176196'
       WHERE NOT EXISTS (
         SELECT 1 FROM "migrations" WHERE "name" = 'InitialSchema1776594176196'
       )
       RETURNING *`,
    );
    if (r.rowCount > 0) {
      console.log(
        'Registered InitialSchema1776594176196 in migrations table:',
        r.rows[0],
      );
    } else {
      console.log(
        'InitialSchema1776594176196 already present in migrations table.',
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
