const { Pool } = require("pg");

// Railway injects DATABASE_URL automatically when you attach a Postgres
// plugin to this service. Locally, put it in a .env file (see .env.example).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("railway")
    ? { rejectUnauthorized: false }
    : false,
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      date DATE,
      priority TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  `);
}

module.exports = { pool, initSchema };
