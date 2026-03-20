import { luckyStreakService } from './lucky-streak.service';
import { gameRepository } from '../repositories/game.repository';
import { logger } from '../utils/logger';
import { getOrSet, flushCache } from '../utils/cache';

export class GameService {
  /**
   * sincroniza los juegos desde la API externa hacia la base de datos.
   * al finalizar, limpia todo el caché para que las próximas consultas traigan datos frescos.
   */
  public async syncGames(): Promise<{ success: boolean; message: string }> {
    logger.info('Starting game synchronization process...');

    try {
      // obtener datos de forma concurrente
      const [normalGames, liveGames] = await Promise.all([
        luckyStreakService.getNormalGames(),
        luckyStreakService.getLiveGames()
      ]);

      logger.info(`Fetched ${normalGames.length} normal games and ${liveGames.length} live games from API.`);

      // mapear y marcar juegos en vivo - convertir id/providerId a string ya que la API puede devolver números
      const mappedNormal = normalGames.map(g => ({
        ...g,
        id: String(g.id),
        providerId: String(g.providerId),
        isLive: false,
        rtp: g.rtp ?? null,
      }));
      const mappedLive = liveGames.map(g => ({
        ...g,
        id: String(g.id),
        providerId: String(g.providerId),
        isLive: true,
        rtp: g.rtp ?? null,
      }));

      const allGames = [...mappedNormal, ...mappedLive];

      // insertar o actualizar en la base de datos
      const result = await gameRepository.upsertGames(allGames);

      // invalidar todo el caché después de sincronizar
      flushCache();

      logger.info(`Synchronization complete. Processed ${result.added} games.`);

      return {
        success: true,
        message: `Successfully synchronized ${result.added} games.`
      };
    } catch (error) {
      logger.error('Error synchronizing games:', error);
      throw error;
    }
  }

  /**
   * obtiene juegos según filtros y paginación.
   * las consultas con los mismos parámetros se cachean por 5 minutos.
   */
  public async getGames(
    page: number = 1,
    limit: number = 20,
    filters: { search?: string; type?: string; providerId?: string; isLive?: boolean }
  ) {
    const cacheKey = `games:${page}:${limit}:${JSON.stringify(filters)}`;

    return getOrSet(cacheKey, async () => {
      const skip = (page - 1) * limit;
      const { data, total } = await gameRepository.getGames(filters, skip, limit);

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    });
  }

  /**
   * obtiene las categorías únicas de juegos.
   * se cachea por 10 minutos (cambian poco).
   */
  public async getCategories() {
    return getOrSet('categories', () => gameRepository.getCategories(), 600);
  }

  /**
   * obtiene los conjuntos de juegos para la página principal: en vivo, recientes y slots.
   * se cachea por 2 minutos (para que los slots aleatorios varíen con frecuencia).
   */
  public async getHomeGames(limit?: number) {
    const cacheKey = `home:${limit ?? 12}`;
    return getOrSet(cacheKey, () => gameRepository.getHomeGames(limit), 120);
  }

  /**
   * obtiene los proveedores únicos de juegos.
   * se cachea por 10 minutos (cambian muy poco).
   */
  public async getProviders() {
    return getOrSet('providers', () => gameRepository.getProviders(), 600);
  }

  /**
   * obtiene un juego único por su ID.
   * se cachea por 5 minutos.
   */
  public async getGameById(id: string) {
    return getOrSet(`game:${id}`, () => gameRepository.getGameById(id));
  }
}

export const gameService = new GameService();
