"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameService = exports.GameService = void 0;
const lucky_streak_service_1 = require("./lucky-streak.service");
const game_repository_1 = require("../repositories/game.repository");
const logger_1 = require("../utils/logger");
const cache_1 = require("../utils/cache");
const env_config_1 = require("../config/env.config");
const prisma_1 = __importDefault(require("../config/prisma"));
/**
 * convierte un juego de la API de LuckyStreak a la forma Game que espera el frontend.
 * los campos de DB como createdAt, updatedAt y priority se generan sintéticamente.
 */
function mapLiveGameToGameShape(game) {
    return {
        id: String(game.id),
        name: String(game.name),
        type: String(game.type),
        providerId: String(game.providerId),
        launchUrl: game.launchUrl ?? null,
        demoUrl: game.demoUrl ?? null,
        thumbnail: game.thumbnail ?? null,
        rtp: game.rtp ?? null,
        isLive: true,
        isActive: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}
class GameService {
    /**
     * sincroniza los juegos desde la API externa hacia la base de datos.
     * SOLO sincroniza juegos normales; los live se sirven directo desde cache/API.
     * al finalizar, limpia todo el caché para que las próximas consultas traigan datos frescos.
     */
    async syncGames(environment) {
        logger_1.logger.info(`Starting game synchronization process (environment: ${environment || 'staging'})...`);
        try {
            // solo obtener juegos normales — los live ya no se persisten en DB
            const normalGames = await lucky_streak_service_1.luckyStreakService.getNormalGames(environment);
            logger_1.logger.info(`Fetched ${normalGames.length} normal games from API. (Live games excluded from DB sync)`);
            // mapear juegos normales
            const mappedNormal = normalGames.map(g => ({
                ...g,
                id: String(g.id),
                providerId: String(g.providerId),
                isLive: false,
                rtp: g.rtp ?? null,
            }));
            // insertar o actualizar en la base de datos (solo normales)
            const result = await game_repository_1.gameRepository.upsertGames(mappedNormal);
            // invalidar todo el caché después de sincronizar (incluido live:all y stale)
            (0, cache_1.flushCache)();
            logger_1.logger.info(`Synchronization complete. Processed ${result.added} normal games.`);
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
     * obtiene los juegos live desde cache con fallback stale-on-error.
     * usa getOrSetWithFallback: fresh TTL (10 min) + stale TTL (1h).
     * si la API falla y hay stale, lo sirve; si no hay stale, propaga el error.
     */
    async getLiveGamesCached() {
        const rawGames = await (0, cache_1.getOrSetWithFallback)('live:all', () => lucky_streak_service_1.luckyStreakService.getLiveGames(), env_config_1.env.LIVE_CACHE_TTL_SECONDS, env_config_1.env.LIVE_STALE_TTL_SECONDS);
        return rawGames.map(mapLiveGameToGameShape);
    }
    /**
     * filtra juegos live en memoria aplicando los mismos filtros del endpoint.
     * el filtro type='LIVE' es virtual (no se aplica; todos los live ya son live);
     * cualquier otro valor de type filtra por subtipo (ROULETTE, BLACKJACK, etc.).
     */
    filterLiveGames(games, filters) {
        let filtered = games;
        if (filters.search) {
            const term = filters.search.toLowerCase();
            filtered = filtered.filter(g => g.name.toLowerCase().includes(term));
        }
        if (filters.providerId) {
            filtered = filtered.filter(g => g.providerId === filters.providerId);
        }
        if (filters.type && filters.type.toUpperCase() !== 'LIVE') {
            filtered = filtered.filter(g => g.type === filters.type);
        }
        return filtered;
    }
    /**
     * obtiene juegos según filtros y paginación.
     * - isLive === true o type === 'LIVE': fuente = cache/API (filtro + paginación in-memory).
     * - isLive === false: fuente = DB (como antes).
     * - sin filtro isLive: merge live (cache) + normales (DB), paginación manual.
     */
    async getGames(page = 1, limit = 20, filters) {
        const isLiveRequest = filters.isLive === true || filters.type?.toUpperCase() === 'LIVE';
        const isNormalRequest = filters.isLive === false;
        // ── caso 1: solo live (cache/API) ──
        if (isLiveRequest) {
            const cacheKey = `games:live:${page}:${limit}:${JSON.stringify(filters)}`;
            return (0, cache_1.getOrSet)(cacheKey, async () => {
                const allLive = await this.getLiveGamesCached();
                const filtered = this.filterLiveGames(allLive, filters);
                const total = filtered.length;
                const skip = (page - 1) * limit;
                const data = filtered.slice(skip, skip + limit);
                return {
                    data,
                    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
                };
            }, env_config_1.env.LIVE_CACHE_TTL_SECONDS);
        }
        // ── caso 2: solo normales (DB) ──
        if (isNormalRequest) {
            const cacheKey = `games:normal:${page}:${limit}:${JSON.stringify(filters)}`;
            return (0, cache_1.getOrSet)(cacheKey, async () => {
                const skip = (page - 1) * limit;
                const { data, total } = await game_repository_1.gameRepository.getGames(filters, skip, limit);
                return {
                    data,
                    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
                };
            });
        }
        // ── caso 3: merge live + normales (sin filtro isLive) ──
        const cacheKey = `games:merged:${page}:${limit}:${JSON.stringify(filters)}`;
        return (0, cache_1.getOrSet)(cacheKey, async () => {
            // obtener live filtrados
            const allLive = await this.getLiveGamesCached();
            const filteredLive = this.filterLiveGames(allLive, filters);
            const dbFilters = { ...filters };
            const totalLive = filteredLive.length;
            // calcular la ventana de paginación considerando live primero
            const skip = (page - 1) * limit;
            if (skip < totalLive) {
                // la página incluye algo de live
                const liveSlice = filteredLive.slice(skip, skip + limit);
                const remaining = limit - liveSlice.length;
                let dbData = [];
                let dbTotal = 0;
                if (remaining > 0) {
                    const result = await game_repository_1.gameRepository.getGames(dbFilters, 0, remaining);
                    dbData = result.data;
                    dbTotal = result.total;
                }
                else {
                    dbTotal = (await game_repository_1.gameRepository.getGames(dbFilters, 0, 0)).total;
                }
                const total = totalLive + dbTotal;
                return {
                    data: [...liveSlice, ...dbData],
                    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
                };
            }
            else {
                // la página ya pasó todos los live, solo DB
                const dbSkip = skip - totalLive;
                const { data: dbData, total: dbTotal } = await game_repository_1.gameRepository.getGames(dbFilters, dbSkip, limit);
                const total = totalLive + dbTotal;
                return {
                    data: dbData,
                    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
                };
            }
        }, 120); // cache 2 min para el merge
    }
    /**
     * obtiene las categorías únicas de juegos.
     * combina los tipos de la DB (normales) con los subtipos de los live games
     * cacheados (ROULETTE, BLACKJACK, BACCARAT, etc.). se cachea por 10 minutos.
     */
    async getCategories() {
        return (0, cache_1.getOrSet)('categories', async () => {
            const [dbCategories, liveGames] = await Promise.all([
                game_repository_1.gameRepository.getCategories(),
                this.getLiveGamesCached().catch(() => []),
            ]);
            const liveTypes = [...new Set(liveGames.map(g => g.type).filter((t) => Boolean(t)))];
            return [...new Set([...dbCategories, ...liveTypes])];
        }, 600);
    }
    /**
     * obtiene los conjuntos de juegos para la página principal: en vivo, recientes y slots.
     * live viene del cache/API; recent y randomSlots del repositorio (DB).
     * se cachea por 2 minutos (para que los slots aleatorios varíen con frecuencia).
     */
    async getHomeGames(limit) {
        const effectiveLimit = limit ?? 12;
        const cacheKey = `home:${effectiveLimit}`;
        return (0, cache_1.getOrSet)(cacheKey, async () => {
            const [liveGames, repoData] = await Promise.all([
                this.getLiveGamesCached(),
                game_repository_1.gameRepository.getHomeGames(effectiveLimit),
            ]);
            return {
                live: liveGames.slice(0, effectiveLimit),
                recent: repoData.recent,
                randomSlots: repoData.randomSlots,
            };
        }, 120);
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
     * primero busca en el cache de live games; si no lo encuentra, cae al repo (DB).
     * se cachea por 5 minutos.
     */
    async getGameById(id) {
        return (0, cache_1.getOrSet)(`game:${id}`, async () => {
            // 1. buscar en los live games cacheados
            try {
                const liveGames = await this.getLiveGamesCached();
                const liveMatch = liveGames.find(g => g.id === id);
                if (liveMatch) {
                    // resolver providerName desde la tabla Provider
                    const provider = await prisma_1.default.provider.findUnique({ where: { id: liveMatch.providerId } });
                    return { ...liveMatch, providerName: provider?.name ?? null };
                }
            }
            catch {
                // si falla la obtención de live, seguir con DB
                logger_1.logger.debug(`[GameService] No se pudieron obtener live games para buscar id=${id}, intentando DB`);
            }
            // 2. fallback a DB
            return game_repository_1.gameRepository.getGameById(id);
        });
    }
}
exports.GameService = GameService;
exports.gameService = new GameService();
