"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_config_1 = require("./config/env.config");
const logger_1 = require("./utils/logger");
const cron_1 = require("./config/cron");
const startServer = async () => {
    try {
        app_1.default.listen(env_config_1.env.PORT, () => {
            logger_1.logger.info(`🚀 Server running on port ${env_config_1.env.PORT} in ${env_config_1.env.NODE_ENV} mode`);
            (0, cron_1.registerCronJobs)();
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
