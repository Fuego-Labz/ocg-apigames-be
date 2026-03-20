"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const zod_1 = require("zod");
const errorHandler = (err, req, res, next) => {
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: err.issues,
        });
        return;
    }
    logger_1.logger.error(`Error: ${err.message}`, { stack: err.stack });
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : (err.message || 'Internal Server Error'),
    });
};
exports.errorHandler = errorHandler;
