"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameService = exports.GameService = void 0;
const lucky_streak_service_1 = require("./lucky-streak.service");
const game_repository_1 = require("../repositories/game.repository");
const logger_1 = require("../utils/logger");
const cache_1 = require("../utils/cache");
class GameService {
    /**
     * sincroniza los juegos desde la API externa hacia la base de datos.
     * al finalizar, limpia todo el caché para que las próximas consultas traigan datos frescos.
     */
    async syncGames(environment) {
        logger_1.logger.info(`Starting game synchronization process (environment: ${environment || 'staging'})...`);
        try {
            // obtener datos de forma concurrente
            const [normalGames, liveGames] = await Promise.all([
                lucky_streak_service_1.luckyStreakService.getNormalGames(environment),
                lucky_streak_service_1.luckyStreakService.getLiveGames(environment)
            ]);
            logger_1.logger.info(`Fetched ${normalGames.length} normal games and ${liveGames.length} live games from API.`);
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
            const result = await game_repository_1.gameRepository.upsertGames(allGames);
            // invalidar todo el caché después de sincronizar
            (0, cache_1.flushCache)();
            logger_1.logger.info(`Synchronization complete. Processed ${result.added} games.`);
            return {
                success: true,
                message: `Successfully synchronized ${result.added} games.`
            };
        }
        catch (error) {
            logger_1.logger.error('Error synchronizing games:', error);
            throw error;
        }
    }
    /**
     * obtiene juegos según filtros y paginación.
     * las consultas con los mismos parámetros se cachean por 5 minutos.
     */
    async getGames(page = 1, limit = 20, filters) {
        const cacheKey = `games:${page}:${limit}:${JSON.stringify(filters)}`;
        return (0, cache_1.getOrSet)(cacheKey, async () => {
            const skip = (page - 1) * limit;
            const { data, total } = await game_repository_1.gameRepository.getGames(filters, skip, limit);
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
    async getCategories() {
        return (0, cache_1.getOrSet)('categories', () => game_repository_1.gameRepository.getCategories(), 600);
    }
    /**
     * obtiene los conjuntos de juegos para la página principal: en vivo, recientes y slots.
     * se cachea por 2 minutos (para que los slots aleatorios varíen con frecuencia).
     */
    async getHomeGames(limit) {
        const cacheKey = `home:${limit ?? 12}`;
        return (0, cache_1.getOrSet)(cacheKey, () => game_repository_1.gameRepository.getHomeGames(limit), 120);
    }
    /**
     * obtiene los proveedores únicos de juegos.
     * se cachea por 10 minutos (cambian muy poco).
     */
    async getProviders() {
        return (0, cache_1.getOrSet)('providers', () => game_repository_1.gameRepository.getProviders(), 600);
    }
    /**
     * obtiene un juego único por su ID.
     * se cachea por 5 minutos.
     */
    async getGameById(id) {
        return (0, cache_1.getOrSet)(`game:${id}`, () => game_repository_1.gameRepository.getGameById(id));
    }
}
exports.GameService = GameService;
exports.gameService = new GameService();
