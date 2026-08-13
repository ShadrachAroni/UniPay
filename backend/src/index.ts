import { createApp } from './app';
import { env } from './config/env';
import { rootLogger } from './utils/logger';
import { pool } from './db';
import { runMigrations } from './db/migrate';

async function startServer(): Promise<void> {
  const app = createApp();

  // Attempt baseline migration check on startup
  try {
    if (env.DATABASE_URL || env.DATABASE_DIRECT_URL) {
      await runMigrations();
    } else {
      rootLogger.warn('No DATABASE_URL configured; skipping startup migration check');
    }
  } catch (err) {
    rootLogger.error('Failed to run startup migrations', { error: (err as Error).message });
  }

  const server = app.listen(env.PORT, () => {
    rootLogger.info(`UniPay Backend API Server listening on port ${env.PORT}`, {
      port: env.PORT,
      environment: env.NODE_ENV,
      healthEndpoint: `http://localhost:${env.PORT}/health`,
    });
  });

  const shutdown = async (signal: string) => {
    rootLogger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      rootLogger.info('HTTP server closed.');
      try {
        await pool.end();
        rootLogger.info('Database pool drained.');
      } catch (err) {
        rootLogger.error('Error draining database pool', { error: (err as Error).message });
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  rootLogger.error('Fatal error starting server', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});
