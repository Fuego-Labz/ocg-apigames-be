import app from './app';
import { env } from './config/env.config';
import { logger } from './utils/logger';
import { registerCronJobs } from './config/cron';

const startServer = async () => {
  try {
    app.listen(env.PORT, () => {
      logger.info(`🚀 Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      registerCronJobs();
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
