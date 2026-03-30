import app from './app';
import { env } from './config/env.config';
import { logger } from './utils/logger';
import { registerCronJobs } from './config/cron';
import { warmUpCache } from './utils/cache-warmup';
import { startKeepAlive } from './utils/keep-alive';

const startServer = async () => {
  try {
    app.listen(env.PORT, async () => {
      logger.info(`🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      registerCronJobs();

      // pre-calentar el caché con los datos más consultados
      await warmUpCache();

      // self-ping para evitar que Render apague el servidor por inactividad
      if (env.NODE_ENV === 'production') {
        startKeepAlive();
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
