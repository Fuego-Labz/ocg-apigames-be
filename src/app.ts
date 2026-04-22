import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middlewares/error.middleware';
import { logger } from './utils/logger';
import gameRoutes from './routes/game.routes';

const app = express();

// cabeceras de seguridad HTTP
app.use(helmet());

// limitación de tasa (100 peticiones por minuto por IP)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});
app.use('/api', apiLimiter);

// CORS abierto (protegido por rate limit + API key)
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de registro de peticiones (filtra ruido de socket.io)
app.use((req, res, next) => {
  if (!req.url.startsWith('/socket.io')) {
    logger.info(`[${req.method}] ${req.url}`);
  }
  next();
});

// las rutas se muestran acá
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

app.use('/api/games', gameRoutes);

// manejador global de errores
app.use(errorHandler);

export default app;
