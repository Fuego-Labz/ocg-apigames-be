"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCronJobs = registerCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const game_service_1 = require("../services/game.service");
const logger_1 = require("../utils/logger");
const env_config_1 = require("./env.config");
// intervalo configurable: por defecto cada 6 horas
const SYNC_INTERVAL = process.env.SYNC_CRON || '0 */6 * * *';
/**
 * registra la tarea programada de sincronización de juegos.
 * solo se activa en producción. en desarrollo se usa el endpoint manual POST /sync.
 */
function registerCronJobs() {
    if (env_config_1.env.NODE_ENV !== 'production') {
        logger_1.logger.info('Cron jobs desactivados en modo desarrollo. Usa POST /api/games/sync para sincronizar manualmente.');
        return;
    }
    node_cron_1.default.schedule(SYNC_INTERVAL, async () => {
        logger_1.logger.info('[CRON] Iniciando sincronización automática de juegos...');
        try {
            const result = await game_service_1.gameService.syncGames();
            logger_1.logger.info(`[CRON] Sincronización completada: ${result.message}`);
        }
        catch (error) {
            logger_1.logger.error('[CRON] Error durante la sincronización automática:', error);
        }
    });
    logger_1.logger.info(`[CRON] Tarea de sincronización registrada con intervalo: ${SYNC_INTERVAL}`);
}
