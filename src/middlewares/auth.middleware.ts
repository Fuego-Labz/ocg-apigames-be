import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.config';
import { logger } from '../utils/logger';

/**
 middleware para verificar que la petición entrante contiene la API Key correcta.
 se usa para proteger endpoints administrativos como /sync.
 */
export const requireApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== env.API_KEY) {
    logger.warn(`Unauthorized access attempt to ${req.url} from IP: ${req.ip}`);
    res.status(401).json({
      success: false,
      message: 'Unauthorized. Valid x-api-key header is required.'
    });
    return;
  }

  next();
};
