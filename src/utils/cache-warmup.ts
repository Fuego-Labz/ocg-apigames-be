import { gameService } from '../services/game.service';
import { logger } from './logger';

/**
 * Pre-calienta el caché al iniciar el servidor con los datos más consultados.
 * Incluye juegos live desde la API de OCG (llena tanto fresh como stale backup).
 * Así la primera request de un usuario ya tiene datos en caché.
 */
export async function warmUpCache(): Promise<void> {
  logger.info('[CACHE-WARMUP] Iniciando pre-calentamiento del caché...');

  try {
    // getHomeGames internamente llama a getLiveGamesCached(),
    // lo que pre-carga live:all (fresh + stale) desde la API de OCG.
    await Promise.all([
      gameService.getHomeGames(),
      gameService.getGames(1, 20, {}),
      gameService.getCategories(),
      gameService.getProviders(),
    ]);
    logger.info('[CACHE-WARMUP] Caché pre-calentado exitosamente (incluye live games).');
  } catch (err) {
    logger.warn(`[CACHE-WARMUP] Error al pre-calentar caché (no crítico): ${err}`);
  }
}
