import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { notificationService } from './modules/notifications/notification.service';
import { connectDatabase, disconnectDatabase } from './db/mongoose';

async function bootstrap() {
  await connectDatabase();

  const server = createApp().listen(env.PORT, () => {
    logger.info(`API ready at http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
  });

  // Tell assignees about open tasks that have gone past their due time.
  if (env.NODE_ENV !== 'test') {
    const check = () => void notificationService.notifyOverdueTasks();
    setTimeout(check, 10_000).unref();
    setInterval(check, 5 * 60_000).unref();
  }

  // Graceful shutdown: stop accepting requests, then close the DB connection.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
