// Simple SQL migration runner
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://itsm:itsm_dev_pw@localhost:5433/itsm';

(async () => {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const done = await client.query('SELECT 1 FROM public.schema_migrations WHERE filename=$1', [f]);
    if (done.rowCount) { console.log('skip', f); continue; }
    console.log('apply', f);
    await client.query('BEGIN');
    try {
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query('INSERT INTO public.schema_migrations (filename) VALUES ($1)', [f]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('FAILED', f, e.message);
      process.exit(1);
    }
  }
  await client.end();
  console.log('migrations complete');
})();
