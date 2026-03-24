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
    const baseURL = environment === 'production' 
      ? 'https://api.ocgames.io/lucky-streak' 
      : 'https://api-stg.ocgames.io/lucky-streak';

    try {
      const response = await this.apiClient.get<LuckyStreakGame[]>('/games', {
        baseURL,
        params: { providerGames: true }
      });
      return response.data;
    } catch (error) {
      // axios maneja respuestas no 2xx y lanza automáticamente
      throw error;
    }
  }

  /**
   * obtiene los juegos de casino en vivo desde el proveedor.
   * @returns lista de juegos normalizados marcados como en vivo.
   */
  public async getLiveGames(environment?: string): Promise<LuckyStreakGame[]> {
    const baseURL = environment === 'production' 
      ? 'https://api.ocgames.io/lucky-streak' 
      : 'https://api-stg.ocgames.io/lucky-streak';

    try {
      const response = await this.apiClient.get<LuckyStreakGame[]>('/games', {
        baseURL,
        params: { providerGames: false }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export const luckyStreakService = new LuckyStreakService();
