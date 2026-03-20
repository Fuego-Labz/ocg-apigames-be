"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireApiKey = void 0;
const env_config_1 = require("../config/env.config");
const logger_1 = require("../utils/logger");
/**
 middleware para verificar que la petición entrante contiene la API Key correcta.
 se usa para proteger endpoints administrativos como /sync.
 */
const requireApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== env_config_1.env.API_KEY) {
        logger_1.logger.warn(`Unauthorized access attempt to ${req.url} from IP: ${req.ip}`);
        res.status(401).json({
            success: false,
            message: 'Unauthorized. Valid x-api-key header is required.'
        });
        return;
    }
    next();
};
exports.requireApiKey = requireApiKey;
