"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const error_middleware_1 = require("./middlewares/error.middleware");
const logger_1 = require("./utils/logger");
const game_routes_1 = __importDefault(require("./routes/game.routes"));
const app = (0, express_1.default)();
// 1. cabeceras de seguridad HTTP
app.use((0, helmet_1.default)());
// 2. limitación de tasa (100 peticiones por minuto por IP)
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});
app.use('/api', apiLimiter);
// 3. CORS abierto (protegido por rate limit + API key)
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Middleware de registro de peticiones (filtra ruido de socket.io)
app.use((req, res, next) => {
    if (!req.url.startsWith('/socket.io')) {
        logger_1.logger.info(`[${req.method}] ${req.url}`);
    }
    next();
});
// las rutas se muestran acá
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date() });
});
app.use('/api/games', game_routes_1.default);
// manejador global de errores
app.use(error_middleware_1.errorHandler);
exports.default = app;
