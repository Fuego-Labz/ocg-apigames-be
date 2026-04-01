"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameController = exports.GameController = void 0;
const game_service_1 = require("../services/game.service");
const zod_1 = require("zod");
const getGamesSchema = zod_1.z.object({
    page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default(20),
    search: zod_1.z.string().optional(),
    type: zod_1.z.string().optional(),
    providerId: zod_1.z.string().optional(),
    isLive: zod_1.z.enum(['true', 'false']).transform(val => val === 'true').optional(),
});
class GameController {
    async syncGames(req, res, next) {
        try {
            const environment = (req.query.env || req.body?.env);
            const result = await game_service_1.gameService.syncGames(environment);
            res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    }
    async getGames(req, res, next) {
        try {
            const query = getGamesSchema.parse(req.query);
            const filters = {
                search: query.search,
                type: query.type,
                providerId: query.providerId,
                isLive: query.isLive
            };
            const result = await game_service_1.gameService.getGames(query.page, query.limit, filters);
            res.status(200).json({
                success: true,
                ...result
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getCategories(req, res, next) {
        try {
            const categories = await game_service_1.gameService.getCategories();
            res.status(200).json({
                success: true,
                data: categories
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getHomeGames(req, res, next) {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 12;
            const homeGames = await game_service_1.gameService.getHomeGames(limit);
            res.status(200).json({
                success: true,
                data: homeGames
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getProviders(req, res, next) {
        try {
            const providers = await game_service_1.gameService.getProviders();
            res.status(200).json({
                success: true,
                data: providers
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getGameById(req, res, next) {
        try {
            const id = req.params.id;
            const game = await game_service_1.gameService.getGameById(id);
            if (!game) {
                res.status(404).json({ success: false, message: 'Game not found' });
                return;
            }
            res.status(200).json({
                success: true,
                data: game
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.GameController = GameController;
exports.gameController = new GameController();
