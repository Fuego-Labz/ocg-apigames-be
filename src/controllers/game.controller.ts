import { Request, Response, NextFunction } from 'express';
import { gameService } from '../services/game.service';
import { z } from 'zod';

const getGamesSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
  search: z.string().optional(),
  type: z.string().optional(),
  providerId: z.string().optional(),
  isLive: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  hasBuyFeature: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  consumer: z.string().optional(),
});

export class GameController {
  public async syncGames(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const environment = (req.query.env || req.body?.env) as string;
      const result = await gameService.syncGames(environment);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public async getGames(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = getGamesSchema.parse(req.query);

      const filters = {
        search: query.search,
        type: query.type,
        providerId: query.providerId,
        isLive: query.isLive,
        hasBuyFeature: query.hasBuyFeature
      };

      const result = await gameService.getGames(query.page, query.limit, filters, query.consumer);

      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  public async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consumer = req.query.consumer as string | undefined;
      const categories = await gameService.getCategories(consumer);
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }

  public async getHomeGames(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 12;
      const consumer = req.query.consumer as string | undefined;
      const homeGames = await gameService.getHomeGames(limit, consumer);
      res.status(200).json({
        success: true,
        data: homeGames
      });
    } catch (error) {
      next(error);
    }
  }

  public async getProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consumer = req.query.consumer as string | undefined;
      const providers = await gameService.getProviders(consumer);
      res.status(200).json({
        success: true,
        data: providers
      });
    } catch (error) {
      next(error);
    }
  }

  public async getGameById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const consumer = req.query.consumer as string | undefined;
      const game = await gameService.getGameById(id, consumer);

      if (!game) {
        res.status(404).json({ success: false, message: 'Game not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: game
      });
    } catch (error) {
      next(error);
    }
  }
}

export const gameController = new GameController();
