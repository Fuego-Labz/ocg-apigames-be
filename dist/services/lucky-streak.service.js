"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.luckyStreakService = exports.LuckyStreakService = void 0;
const axios_1 = __importDefault(require("axios"));
const env_config_1 = require("../config/env.config");
class LuckyStreakService {
    apiClient = axios_1.default.create({
        baseURL: env_config_1.env.LUCKY_STREAK_API_URL,
        timeout: 10000,
    });
    /**
     * obtiene los juegos normales y slots desde el proveedor.
     * @returns lista de juegos normalizados marcados como no en vivo.
     */
    async getNormalGames(environment) {
        const baseURL = environment === 'production'
            ? 'https://api.ocgames.io/lucky-streak'
            : 'https://api-stg.ocgames.io/lucky-streak';
        try {
            const response = await this.apiClient.get('/games', {
                baseURL,
                params: { providerGames: true }
            });
            return response.data;
        }
        catch (error) {
            // axios maneja respuestas no 2xx y lanza automáticamente
            throw error;
        }
    }
    /**
     * obtiene los juegos de casino en vivo desde el proveedor.
     * @returns lista de juegos normalizados marcados como en vivo.
     */
    async getLiveGames(environment) {
        const baseURL = environment === 'production'
            ? 'https://api.ocgames.io/lucky-streak'
            : 'https://api-stg.ocgames.io/lucky-streak';
        try {
            const response = await this.apiClient.get('/games', {
                baseURL,
                params: { providerGames: false }
            });
            return response.data;
        }
        catch (error) {
            throw error;
        }
    }
}
exports.LuckyStreakService = LuckyStreakService;
exports.luckyStreakService = new LuckyStreakService();
