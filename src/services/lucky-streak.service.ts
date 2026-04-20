import axios from 'axios';
import { env } from '../config/env.config';

export interface LuckyStreakGame {
  id: string;
  name: string;
  type: string;
  providerId: string;
  launchUrl: string | null;
  demoUrl: string | null;
  thumbnail: string | null;
  rtp?: number;
}

// permite override explícito del endpoint (útil para /sync?env=staging|production);
// si no se pasa environment, usa env.LUCKY_STREAK_API_URL.
function resolveBaseURL(environment?: string): string | undefined {
  if (environment === 'production') return 'https://api.ocgames.io/lucky-streak';
  if (environment === 'staging') return 'https://api-stg.ocgames.io/lucky-streak';
  return undefined; // deja que axios use el baseURL default del client
}

export class LuckyStreakService {
  private apiClient = axios.create({
    baseURL: env.LUCKY_STREAK_API_URL,
    timeout: 10000,
  });

  /**
   * obtiene los juegos normales y slots desde el proveedor.
   * @returns lista de juegos normalizados marcados como no en vivo.
   */
  public async getNormalGames(environment?: string): Promise<LuckyStreakGame[]> {
    const response = await this.apiClient.get<LuckyStreakGame[]>('/games', {
      baseURL: resolveBaseURL(environment),
      params: { providerGames: true },
    });
    return response.data;
  }

  /**
   * obtiene los juegos de casino en vivo desde el proveedor.
   * @returns lista de juegos normalizados marcados como en vivo.
   */
  public async getLiveGames(environment?: string): Promise<LuckyStreakGame[]> {
    const response = await this.apiClient.get<LuckyStreakGame[]>('/games', {
      baseURL: resolveBaseURL(environment),
      params: { providerGames: false },
    });
    return response.data;
  }
}

export const luckyStreakService = new LuckyStreakService();
