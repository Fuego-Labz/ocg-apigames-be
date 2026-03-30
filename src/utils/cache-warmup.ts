import { gameService } from '../services/game.service';
import { logger } from './logger';

/**
 * Pre-calienta el caché al iniciar el servidor con los datos más consultados.
 * Así la primera request de un usuario ya tiene datos en caché.
 */
export async function warmUpCache(): Promise<void> {
  logger.info('[CACHE-WARMUP] Iniciando pre-calentamiento del caché...');

  try {
    await Promise.all([
      gameService.getGames(1, 20, {}),
      gameService.getHomeGames(),
      gameService.getCategories(),
      gameService.getProviders(),
    ]);
    logger.info('[CACHE-WARMUP] Caché pre-calentado exitosamente.');
  } catch (err) {
    logger.warn(`[CACHE-WARMUP] Error al pre-calentar caché (no crítico): ${err}`);
  }
}
