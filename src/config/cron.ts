import cron from 'node-cron';
import { gameService } from '../services/game.service';
import { logger } from '../utils/logger';
import { env } from './env.config';

// intervalo configurable: por defecto cada 6 horas
const SYNC_INTERVAL = process.env.SYNC_CRON || '0 */6 * * *';

/**
 * registra la tarea programada de sincronización de juegos.
 * solo se activa en producción. en desarrollo se usa el endpoint manual POST /sync.
 */
export function registerCronJobs() {
  if (env.NODE_ENV !== 'production') {
    logger.info('Cron jobs desactivados en modo desarrollo. Usa POST /api/games/sync para sincronizar manualmente.');
    return;
  }

  cron.schedule(SYNC_INTERVAL, async () => {
    logger.info('[CRON] Iniciando sincronización automática de juegos...');
    try {
      const result = await gameService.syncGames();
      logger.info(`[CRON] Sincronización completada: ${result.message}`);
    } catch (error) {
      logger.error('[CRON] Error durante la sincronización automática:', error);
    }
  });

  logger.info(`[CRON] Tarea de sincronización registrada con intervalo: ${SYNC_INTERVAL}`);
}
