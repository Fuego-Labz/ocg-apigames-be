import { Router } from 'express';
import { gameController } from '../controllers/game.controller';
import { requireApiKey } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', gameController.getGames);
router.get('/home', gameController.getHomeGames);
router.get('/categories', gameController.getCategories);
router.get('/providers', gameController.getProviders);
router.post('/sync', requireApiKey, gameController.syncGames);
router.get('/:id', gameController.getGameById);

export default router;
