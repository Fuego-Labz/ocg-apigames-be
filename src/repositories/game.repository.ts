import { Game, Prisma } from '@prisma/client';
import prisma from '../config/prisma';

// proveedores permitidos para mostrar en el frontend
const ALLOWED_PROVIDER_IDS = ['4', '7', '58', '64']; // PragmaticPlay, Fugaso, TurboGames, PGSoft

// filtro base que aplica a todas las queries de lectura:
// solo providers permitidos o juegos live, y excluir "plinko" del nombre
const BASE_FILTER: Prisma.GameWhereInput = {
  isActive: true,
  OR: [
    { providerId: { in: ALLOWED_PROVIDER_IDS } },
    { isLive: true },
  ],
  NOT: {
    name: { contains: 'plinko', mode: 'insensitive' },
  },
};

// los campos que el esquema prisma conoce
export type GameInput = {
  id: string;
  name: string;
  type: string;
  providerId: string;
  launchUrl: string | null;
  demoUrl: string | null;
  thumbnail: string | null;
  rtp: number | null;
  isLive: boolean;
};

export class GameRepository {
  /**
   * inserta o actualiza múltiples juegos en la base de datos.
   * procesa en chunks para evitar timeouts en transacciones con miles de juegos.
   */
  public async upsertGames(games: GameInput[]): Promise<{ added: number, updated: number }> {
    const CHUNK_SIZE = 100;

    // 1. obtener los proveedores que existen en la base de datos
    const knownProviders = await prisma.provider.findMany({ select: { id: true } });
    const knownProviderIds = new Set(knownProviders.map(p => p.id));

    // filtrar los juegos recibidos para guardar SOLO los que pertenecen a proveedores configurados
    const validGames = games.filter(g => knownProviderIds.has(String(g.providerId)));

    // 2. upsert de juegos en chunks de CHUNK_SIZE
    for (let i = 0; i < validGames.length; i += CHUNK_SIZE) {
      const chunk = validGames.slice(i, i + CHUNK_SIZE);
      await prisma.$transaction(
        chunk.map(game => {
          const payload = {
            id: String(game.id),
            name: String(game.name),
            type: String(game.type),
            providerId: String(game.providerId),
            launchUrl: game.launchUrl ?? null,
            demoUrl: game.demoUrl ?? null,
            thumbnail: game.thumbnail ?? null,
            rtp: game.rtp ?? null,
            isLive: Boolean(game.isLive),
            isActive: true
          };
          return prisma.game.upsert({
            where: { id: payload.id },
            update: payload,
            create: payload,
          });
        })
      );
    }

    // 3. marcar como inactivos los juegos que ya no están en la lista filtrada,
    // pero SOLO para los proveedores que vinieron en este lote de sincronización.
    const syncedProviderIds = [...new Set(games.map(g => String(g.providerId)))];
    const validSyncedProviderIds = syncedProviderIds.filter(id => knownProviderIds.has(id));

    const activeIds = validGames.map(g => String(g.id));
    await prisma.game.updateMany({
      where: { 
        providerId: { in: validSyncedProviderIds },
        id: { notIn: activeIds } 
      },
      data: { isActive: false }
    });

    return { added: validGames.length, updated: 0 };
  }

  /**
   * obtiene juegos con soporte de filtros y paginación.
   */
  public async getGames(filters: { search?: string; type?: string; providerId?: string; isLive?: boolean }, skip: number, take: number): Promise<{ data: Game[], total: number }> {
    const whereClause: Prisma.GameWhereInput = { ...BASE_FILTER };

    // búsqueda por texto en el nombre del juego (case-insensitive)
    if (filters.search) {
      whereClause.AND = {
        name: { contains: filters.search, mode: 'insensitive' },
      };
    }

    // si el tipo es 'live' o 'LIVE', lo tratamos como el flag isLive en lugar de buscar por columna type
    if (filters.type) {
      if (filters.type.toUpperCase() === 'LIVE') {
        whereClause.isLive = true;
      } else {
        whereClause.type = filters.type;
      }
    }

    if (filters.providerId) whereClause.providerId = filters.providerId;

    // si isLive se pasa explícitamente, sobreescribe (útil si envían type=ROULETTE y isLive=true)
    if (filters.isLive !== undefined) whereClause.isLive = filters.isLive;

    const [data, total] = await Promise.all([
      prisma.game.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: [
          { priority: 'desc' },
          { name: 'asc' }
        ],
      }),
      prisma.game.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  /**
   * obtiene una lista única de todas las categorías (tipos) de juegos disponibles en la DB.
   */
  public async getCategories(): Promise<string[]> {
    const categories = await prisma.game.findMany({
      select: { type: true },
      distinct: ['type'],
      where: { ...BASE_FILTER, type: { not: '' } },
      orderBy: { type: 'asc' }
    });
    const list = categories.map(c => c.type);

    // inyectamos la categoría virtual "LIVE" para el frontend si no existe
    if (!list.includes('LIVE')) {
      list.unshift('LIVE');
    }

    return list;
  }

  /**
   * obtiene conjuntos predefinidos de juegos útiles para la página principal del frontend.
   */
  public async getHomeGames(limit: number = 12): Promise<{ live: Game[], recent: Game[], randomSlots: Game[] }> {
    // obtener los últimos juegos agregados
    const recent = await prisma.game.findMany({
      where: { ...BASE_FILTER },
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    // obtener juegos en vivo
    const live = await prisma.game.findMany({
      where: { ...BASE_FILTER, isLive: true },
      take: limit,
      orderBy: [
        { priority: 'desc' },
        { name: 'asc' }
      ]
    });

    // obtener juegos de slots o normales (no en vivo) como ejemplos aleatorios
    // usando un offset aleatorio basado en el total disponible para que cambien
    const slotsFilter = { ...BASE_FILTER, isLive: false };
    const totalSlots = await prisma.game.count({ where: slotsFilter });
    const randomSkip = Math.floor(Math.random() * Math.max(0, totalSlots - limit));

    const randomSlots = await prisma.game.findMany({
      where: slotsFilter,
      take: limit,
      skip: randomSkip,
      orderBy: { id: 'asc' } // el orden determinista sobre un offset aleatorio es más estable
    });

    return { live, recent, randomSlots };
  }

  /**
   * obtiene todos los proveedores con su id y nombre.
   */
  public async getProviders() {
    return await prisma.provider.findMany({
      where: { id: { in: ALLOWED_PROVIDER_IDS } },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * obtiene un juego único por su ID.
   */
  public async getGameById(id: string) {
    const game = await prisma.game.findFirst({
      where: { ...BASE_FILTER, id }
    });
    if (!game) return null;

    // buscar el nombre del proveedor manualmente (sin FK)
    const provider = await prisma.provider.findUnique({ where: { id: game.providerId } });
    return { ...game, providerName: provider?.name ?? null };
  }
}

export const gameRepository = new GameRepository();
