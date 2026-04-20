"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Cargar variables .env
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('3000'),
    DATABASE_URL: zod_1.z.string().url(),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    API_KEY: zod_1.z.string().min(10).default('default-secret-api-key-123'),
    FRONTEND_URL: zod_1.z.string().url().default('http://localhost:5173'),
    LUCKY_STREAK_API_URL: zod_1.z.string().url().default('https://api-stg.ocgames.io/lucky-streak'),
    // TTL para caché de juegos en vivo (ventana fresca): 10 min por defecto
    LIVE_CACHE_TTL_SECONDS: zod_1.z.coerce.number().int().min(300).max(600).default(600),
    // TTL para backup stale de juegos en vivo: 1h por defecto
    LIVE_STALE_TTL_SECONDS: zod_1.z.coerce.number().int().min(600).max(7200).default(3600),
});
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    console.error('Invalid environment variables:', parsedEnv.error.format());
    process.exit(1);
}
exports.env = parsedEnv.data;
