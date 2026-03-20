import axios from 'axios';

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
    baseURL: 'https://api-stg.ocgames.io/lucky-streak',
    timeout: 10000, // tiempo de espera de 10 segundos
  });

  /**
   * obtiene los juegos normales y slots desde el proveedor.
   * @returns lista de juegos normalizados marcados como no en vivo.
   */
  public async getNormalGames(): Promise<LuckyStreakGame[]> {
    try {
      const response = await this.apiClient.get<LuckyStreakGame[]>('/games', {
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
  public async getLiveGames(): Promise<LuckyStreakGame[]> {
    try {
      const response = await this.apiClient.get<LuckyStreakGame[]>('/games', {
        params: { providerGames: false }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export const luckyStreakService = new LuckyStreakService();
