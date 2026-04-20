"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameRepository = exports.GameRepository = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
// proveedores permitidos para mostrar en el frontend
const ALLOWED_PROVIDER_IDS = ['4', '7', '58', '64']; // PragmaticPlay, Fugaso, TurboGames, PGSoft
// filtro base que aplica a todas las queries de lectura:
// solo providers permitidos, activos, y excluir "plinko" del nombre.
// los juegos live ya NO se consultan desde la DB (se sirven vía cache/API).
const BASE_FILTER = {
    isActive: true,
    providerId: { in: ALLOWED_PROVIDER_IDS },
    NOT: {
        name: { contains: 'plinko', mode: 'insensitive' },
    },
};
class GameRepository {
    /**
     * inserta o actualiza múltiples juegos en la base de datos.
     * procesa en chunks para evitar timeouts en transacciones con miles de juegos.
     */
    async upsertGames(games) {
        const CHUNK_SIZE = 100;
        // 1. obtener los proveedores que existen en la base de datos
        const knownProviders = await prisma_1.default.provider.findMany({ select: { id: true } });
        const knownProviderIds = new Set(knownProviders.map(p => p.id));
        // filtrar los juegos recibidos para guardar SOLO los que pertenecen a proveedores configurados
        const validGames = games.filter(g => knownProviderIds.has(String(g.providerId)));
        // 2. upsert de juegos en chunks de CHUNK_SIZE
        for (let i = 0; i < validGames.length; i += CHUNK_SIZE) {
            const chunk = validGames.slice(i, i + CHUNK_SIZE);
            await prisma_1.default.$transaction(chunk.map(game => {
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
                return prisma_1.default.game.upsert({
                    where: { id: payload.id },
                    update: payload,
                    create: payload,
                });
            }));
        }
        // 3. marcar como inactivos los juegos que ya no están en la lista filtrada,
        // pero SOLO para los proveedores que vinieron en este lote de sincronización.
        const syncedProviderIds = [...new Set(games.map(g => String(g.providerId)))];
        const validSyncedProviderIds = syncedProviderIds.filter(id => knownProviderIds.has(id));
        const activeIds = validGames.map(g => String(g.id));
        await prisma_1.default.game.updateMany({
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
    async getGames(filters, skip, take) {
        const whereClause = { ...BASE_FILTER };
        // búsqueda por texto en el nombre del juego (case-insensitive)
        if (filters.search) {
            whereClause.AND = {
                name: { contains: filters.search, mode: 'insensitive' },
            };
        }
        // filtro por tipo de juego (los live ya no están en DB, se manejan en el service)
        if (filters.type) {
            whereClause.type = filters.type;
        }
        if (filters.providerId)
            whereClause.providerId = filters.providerId;
        // si isLive se pasa explícitamente, sobreescribe (útil si envían type=ROULETTE y isLive=true)
        if (filters.isLive !== undefined)
            whereClause.isLive = filters.isLive;
        const [data, total] = await Promise.all([
            prisma_1.default.game.findMany({
                where: whereClause,
                skip,
                take,
                orderBy: [
                    { priority: 'desc' },
                    { name: 'asc' }
                ],
            }),
            prisma_1.default.game.count({ where: whereClause }),
        ]);
        return { data, total };
    }
    /**
     * obtiene una lista única de todas las categorías (tipos) de juegos disponibles en la DB.
     */
    async getCategories() {
        const categories = await prisma_1.default.game.findMany({
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
    async getHomeGames(limit = 12) {
        // obtener los últimos juegos agregados (solo normales, los live vienen del cache/API)
        const recent = await prisma_1.default.game.findMany({
            where: { ...BASE_FILTER },
            take: limit,
            orderBy: { createdAt: 'desc' }
        });
        // obtener juegos de slots o normales como ejemplos aleatorios
        // usando un offset aleatorio basado en el total disponible para que cambien
        const totalSlots = await prisma_1.default.game.count({ where: BASE_FILTER });
        const randomSkip = Math.floor(Math.random() * Math.max(0, totalSlots - limit));
        const randomSlots = await prisma_1.default.game.findMany({
            where: BASE_FILTER,
            take: limit,
            skip: randomSkip,
            orderBy: { id: 'asc' } // el orden determinista sobre un offset aleatorio es más estable
        });
        return { recent, randomSlots };
    }
    /**
     * obtiene todos los proveedores con su id y nombre.
     */
    async getProviders() {
        return await prisma_1.default.provider.findMany({
            where: { id: { in: ALLOWED_PROVIDER_IDS } },
            orderBy: { name: 'asc' }
        });
    }
    /**
     * obtiene un juego único por su ID.
     */
    async getGameById(id) {
        const game = await prisma_1.default.game.findFirst({
            where: { ...BASE_FILTER, id }
        });
        if (!game)
            return null;
        // buscar el nombre del proveedor manualmente (sin FK)
        const provider = await prisma_1.default.provider.findUnique({ where: { id: game.providerId } });
        return { ...game, providerName: provider?.name ?? null };
    }
}
exports.GameRepository = GameRepository;
exports.gameRepository = new GameRepository();
