"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrSet = getOrSet;
exports.getOrSetWithFallback = getOrSetWithFallback;
exports.invalidateByPrefix = invalidateByPrefix;
exports.flushCache = flushCache;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("./logger");
// TTL por defecto: 5 minutos (300 segundos)
// checkperiod: cada 60 segundos revisa y limpia claves expiradas
const cache = new node_cache_1.default({ stdTTL: 300, checkperiod: 60 });
/**
 * obtiene un valor del caché. si no existe, ejecuta la función fetchFn,
 * guarda el resultado en caché y lo devuelve.
 * @param key - clave única del caché
 * @param fetchFn - función asíncrona que obtiene los datos si no están en caché
 * @param ttl - tiempo de vida en segundos (opcional, usa el default si no se pasa)
 */
async function getOrSet(key, fetchFn, ttl) {
    const cached = cache.get(key);
    if (cached !== undefined) {
        logger_1.logger.debug(`[CACHE] HIT -> ${key}`);
        return cached;
    }
    logger_1.logger.debug(`[CACHE] MISS -> ${key}`);
    const data = await fetchFn();
    cache.set(key, data, ttl ?? 300);
    return data;
}
/**
 * obtiene un valor del caché con fallback a datos stale.
 * patrón "fresh window + stale backup":
 * - si existe en ventana fresca → devuelve directo.
 * - si no, llama a fetchFn y guarda en fresh + stale.
 * - si fetchFn falla y hay valor stale → lo sirve con log warn.
 * - si no hay stale → propaga el error (503).
 */
async function getOrSetWithFallback(key, fetchFn, freshTtl, staleTtl) {
    const fresh = cache.get(key);
    if (fresh !== undefined) {
        logger_1.logger.debug(`[CACHE] HIT (fresh) -> ${key}`);
        return fresh;
    }
    try {
        logger_1.logger.debug(`[CACHE] MISS -> ${key}, fetching from source...`);
        const data = await fetchFn();
        cache.set(key, data, freshTtl);
        cache.set(`${key}:stale`, data, staleTtl);
        return data;
    }
    catch (err) {
        const stale = cache.get(`${key}:stale`);
        if (stale !== undefined) {
            logger_1.logger.warn(`[CACHE] Fetch falló para "${key}", sirviendo stale backup`);
            return stale;
        }
        throw err;
    }
}
/**
 * invalida todas las claves que empiezan con el prefijo dado.
 * útil para limpiar el caché después de una sincronización.
 */
function invalidateByPrefix(prefix) {
    const keys = cache.keys().filter(k => k.startsWith(prefix));
    if (keys.length > 0) {
        cache.del(keys);
        logger_1.logger.info(`[CACHE] Invalidadas ${keys.length} claves con prefijo "${prefix}"`);
    }
}
/**
 * limpia todo el caché.
 */
function flushCache() {
    cache.flushAll();
    logger_1.logger.info('[CACHE] Caché completo limpiado');
}
exports.default = cache;
