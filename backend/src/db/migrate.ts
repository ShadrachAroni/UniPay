import fs from 'fs';
import path from 'path';
import { pool } from './index';
import { rootLogger } from '../utils/logger';

export async function runMigrations(): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '../migrations');
  rootLogger.info('Checking database migrations', { migrationsDir });

  const client = await pool.connect();
  try {
    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _unipay_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows: appliedRows } = await client.query(
      'SELECT name FROM _unipay_migrations'
    );
    const appliedSet = new Set(appliedRows.map((r: { name: string }) => r.name));

    for (const file of files) {
      const migrationName = path.parse(file).name;
      if (!appliedSet.has(migrationName)) {
        rootLogger.info(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO _unipay_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
            [migrationName]
          );
          await client.query('COMMIT');
          rootLogger.info(`Successfully applied migration: ${migrationName}`);
        } catch (migrationErr) {
          await client.query('ROLLBACK');
          rootLogger.error(`Failed to apply migration: ${migrationName}`, {
            error: (migrationErr as Error).message,
          });
          throw migrationErr;
        }
      } else {
        rootLogger.debug(`Migration already applied: ${migrationName}`);
      }
    }

    rootLogger.info('Database migrations are up to date');
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration runner finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration runner failed:', err);
      process.exit(1);
    });
}
