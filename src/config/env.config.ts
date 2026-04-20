import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_KEY: z.string().min(10).default('default-secret-api-key-123'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  LUCKY_STREAK_API_URL: z.string().url().default('https://api-stg.ocgames.io/lucky-streak'),
  // TTL para caché de juegos en vivo (ventana fresca): 10 min por defecto
  LIVE_CACHE_TTL_SECONDS: z.coerce.number().int().min(300).max(600).default(600),
  // TTL para backup stale de juegos en vivo: 1h por defecto
  LIVE_STALE_TTL_SECONDS: z.coerce.number().int().min(600).max(7200).default(3600),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
