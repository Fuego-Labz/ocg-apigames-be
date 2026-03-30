import { logger } from './logger';

// render apaga los servicios free tras 15 min de inactividad.
// este self-ping cada 14 minutos mantiene el servidor activo.
const INTERVAL_MS = 14 * 60 * 1000;

export function startKeepAlive(): void {
  const url = process.env.RENDER_EXTERNAL_URL;

  if (!url) {
    logger.warn('[KEEP-ALIVE] RENDER_EXTERNAL_URL no definida. Self-ping desactivado.');
    return;
  }

  const healthUrl = `${url}/health`;

  setInterval(async () => {
    try {
      const res = await fetch(healthUrl);
      logger.debug(`[KEEP-ALIVE] Ping ${healthUrl} -> ${res.status}`);
    } catch (err) {
      logger.warn(`[KEEP-ALIVE] Ping fallido: ${err}`);
    }
  }, INTERVAL_MS);

  logger.info(`[KEEP-ALIVE] Self-ping activado cada 14 min -> ${healthUrl}`);
}
