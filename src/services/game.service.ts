import { Game } from '@prisma/client';
import { luckyStreakService, LuckyStreakGame } from './lucky-streak.service';
import { gameRepository } from '../repositories/game.repository';
import { logger } from '../utils/logger';
import { getOrSet, getOrSetWithFallback, flushCache } from '../utils/cache';
import { env } from '../config/env.config';
import prisma from '../config/prisma';
import { resolveProviderIds } from '../config/consumers.config';

/**
 * convierte un juego de la API de LuckyStreak a la forma Game que espera el frontend.
 * los campos de DB como createdAt, updatedAt y priority se generan sintéticamente.
 */
function mapLiveGameToGameShape(game: LuckyStreakGame): Game {
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

export class GameService {
  /**
   * sincroniza los juegos desde la API externa hacia la base de datos.
   * SOLO sincroniza juegos normales; los live se sirven directo desde cache/API.
   * al finalizar, limpia todo el caché para que las próximas consultas traigan datos frescos.
   */
  public async syncGames(environment?: string): Promise<{ success: boolean; message: string }> {
    logger.info(`Starting game synchronization process (environment: ${environment || 'staging'})...`);

    try {
      // solo obtener juegos normales — los live ya no se persisten en DB
      const normalGames = await luckyStreakService.getNormalGames(environment);

      logger.info(`Fetched ${normalGames.length} normal games from API. (Live games excluded from DB sync)`);

      // mapear juegos normales
      const mappedNormal = normalGames.map(g => ({
        ...g,
        id: String(g.id),
        providerId: String(g.providerId),
        isLive: false,
        rtp: g.rtp ?? null,
      }));

      // insertar o actualizar en la base de datos (solo normales)
      const result = await gameRepository.upsertGames(mappedNormal);

      // invalidar todo el caché después de sincronizar (incluido live:all y stale)
      flushCache();

      logger.info(`Synchronization complete. Processed ${result.added} normal games.`);

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
   * obtiene los juegos live desde cache con fallback stale-on-error.
   * usa getOrSetWithFallback: fresh TTL (10 min) + stale TTL (1h).
   * si la API falla y hay stale, lo sirve; si no hay stale, propaga el error.
   */
  private async getLiveGamesCached(): Promise<Game[]> {
    const rawGames = await getOrSetWithFallback<LuckyStreakGame[]>(
      'live:all',
      () => luckyStreakService.getLiveGames(),
      env.LIVE_CACHE_TTL_SECONDS,
      env.LIVE_STALE_TTL_SECONDS,
    );
    return rawGames.map(mapLiveGameToGameShape);
  }

  /**
   * filtra juegos live en memoria aplicando los mismos filtros del endpoint.
   * el filtro type='LIVE' es virtual (no se aplica; todos los live ya son live);
   * cualquier otro valor de type filtra por subtipo (ROULETTE, BLACKJACK, etc.).
   */
  private filterLiveGames(
    games: Game[],
    filters: { search?: string; providerId?: string; type?: string }
  ): Game[] {
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
  public async getGames(
    page: number = 1,
    limit: number = 20,
    filters: { search?: string; type?: string; providerId?: string; isLive?: boolean },
    consumer?: string
  ) {
    const providerIds = resolveProviderIds(consumer);
    const consumerKey = consumer ?? 'default';
    const isLiveRequest = filters.isLive === true || filters.type?.toUpperCase() === 'LIVE';
    const isNormalRequest = filters.isLive === false;

    // ── caso 1: solo live (cache/API) ──
    if (isLiveRequest) {
      const cacheKey = `games:live:${consumerKey}:${page}:${limit}:${JSON.stringify(filters)}`;
      return getOrSet(cacheKey, async () => {
        // si la API externa falla, devolvemos lista vacía en vez de 500
        const allLive = await this.getLiveGamesCached().catch(err => {
          logger.warn(`[GameService] live games unavailable, returning empty: ${err?.message}`);
          return [] as Game[];
        });
        const filtered = this.filterLiveGames(allLive, filters);
        const total = filtered.length;

        const skip = (page - 1) * limit;
        const data = filtered.slice(skip, skip + limit);

        return {
          data,
          meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
      }, env.LIVE_CACHE_TTL_SECONDS);
    }

    // ── caso 2: solo normales (DB) ──
    if (isNormalRequest) {
      const cacheKey = `games:normal:${consumerKey}:${page}:${limit}:${JSON.stringify(filters)}`;
      return getOrSet(cacheKey, async () => {
        const skip = (page - 1) * limit;
        const { data, total } = await gameRepository.getGames(providerIds, filters, skip, limit);
        return {
          data,
          meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
      });
    }

    // ── caso 3: merge live + normales (sin filtro isLive) ──
    const cacheKey = `games:merged:${consumerKey}:${page}:${limit}:${JSON.stringify(filters)}`;
    return getOrSet(cacheKey, async () => {
      // si la API externa falla, el merge sigue con solo normales (DB)
      const allLive = await this.getLiveGamesCached().catch(err => {
        logger.warn(`[GameService] live games unavailable, merging DB only: ${err?.message}`);
        return [] as Game[];
      });
      const filteredLive = this.filterLiveGames(allLive, filters);

      const dbFilters = { ...filters };
      const totalLive = filteredLive.length;

      // calcular la ventana de paginación considerando live primero
      const skip = (page - 1) * limit;

      if (skip < totalLive) {
        // la página incluye algo de live
        const liveSlice = filteredLive.slice(skip, skip + limit);
        const remaining = limit - liveSlice.length;

        let dbData: Game[] = [];
        let dbTotal = 0;
        if (remaining > 0) {
          const result = await gameRepository.getGames(providerIds, dbFilters, 0, remaining);
          dbData = result.data;
          dbTotal = result.total;
        } else {
          dbTotal = (await gameRepository.getGames(providerIds, dbFilters, 0, 0)).total;
        }

        const total = totalLive + dbTotal;
        return {
          data: [...liveSlice, ...dbData],
          meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
      } else {
        // la página ya pasó todos los live, solo DB
        const dbSkip = skip - totalLive;
        const { data: dbData, total: dbTotal } = await gameRepository.getGames(providerIds, dbFilters, dbSkip, limit);
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
  public async getCategories(consumer?: string) {
    const providerIds = resolveProviderIds(consumer);
    const consumerKey = consumer ?? 'default';
    return getOrSet(`categories:${consumerKey}`, async () => {
      const [dbCategories, liveGames] = await Promise.all([
        gameRepository.getCategories(providerIds),
        this.getLiveGamesCached().catch(() => [] as Game[]),
      ]);

      const liveTypes = [...new Set(
        liveGames
          .filter(g => providerIds.includes(g.providerId))
          .map(g => g.type)
          .filter((t): t is string => Boolean(t))
      )];

      return [...new Set([...dbCategories, ...liveTypes])];
    }, 600);
  }

  /**
   * obtiene los conjuntos de juegos para la página principal: en vivo, recientes y slots.
   * live viene del cache/API; recent y randomSlots del repositorio (DB).
   * se cachea por 2 minutos (para que los slots aleatorios varíen con frecuencia).
   */
  public async getHomeGames(limit?: number, consumer?: string) {
    const effectiveLimit = limit ?? 12;
    const providerIds = resolveProviderIds(consumer);
    const consumerKey = consumer ?? 'default';
    const cacheKey = `home:${consumerKey}:${effectiveLimit}`;

    return getOrSet(cacheKey, async () => {
      const [liveGames, repoData] = await Promise.all([
        // si la API externa falla, seguimos con recent + randomSlots y live vacío
        this.getLiveGamesCached().catch(err => {
          logger.warn(`[GameService] live games unavailable for home, skipping: ${err?.message}`);
          return [] as Game[];
        }),
        gameRepository.getHomeGames(providerIds, effectiveLimit),
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
  public async getProviders(consumer?: string) {
    const providerIds = resolveProviderIds(consumer);
    const consumerKey = consumer ?? 'default';
    return getOrSet(`providers:${consumerKey}`, () => gameRepository.getProviders(providerIds), 600);
  }

  /**
   * obtiene un juego único por su ID.
   * primero busca en el cache de live games; si no lo encuentra, cae al repo (DB).
   * se cachea por 5 minutos.
   */
  public async getGameById(id: string, consumer?: string) {
    const providerIds = resolveProviderIds(consumer);
    const consumerKey = consumer ?? 'default';
    return getOrSet(`game:${consumerKey}:${id}`, async () => {
      // 1. buscar en los live games cacheados (restringido a providers del consumer)
      try {
        const liveGames = await this.getLiveGamesCached();
        const liveMatch = liveGames.find(g => g.id === id && providerIds.includes(g.providerId));
        if (liveMatch) {
          // resolver providerName desde la tabla Provider
          const provider = await prisma.provider.findUnique({ where: { id: liveMatch.providerId } });
          return { ...liveMatch, providerName: provider?.name ?? null };
        }
      } catch {
        // si falla la obtención de live, seguir con DB
        logger.debug(`[GameService] No se pudieron obtener live games para buscar id=${id}, intentando DB`);
      }

      // 2. fallback a DB
      return gameRepository.getGameById(providerIds, id);
    });
  }
}

export const gameService = new GameService();
