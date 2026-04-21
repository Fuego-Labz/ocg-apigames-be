// mapa consumer -> lista de provider IDs permitidos.
// "default" es OCG (cuando no se envía ?consumer= o se envía uno desconocido).
// agregar nuevos consumers aquí sin tocar el resto del código.
export const CONSUMER_PROVIDERS: Record<string, string[]> = {
  default: ['4', '7', '8', '12', '58', '64'], // PragmaticPlay, Fugaso, BGaming, Yggdrasil, TurboGames, PGSoft
  '777vault': [
    '0',  // Lucky Streak (Live)
    '3',  // TomHorn
    '4',  // PragmaticPlay
    '12', // Yggdrasil
    '30', // Ruby Play
  ],
};

// resuelve la lista de providers para un consumer. si el consumer es desconocido
// o no se especifica, devuelve la lista del consumer "default" (OCG).
export function resolveProviderIds(consumer?: string): string[] {
  if (!consumer) return CONSUMER_PROVIDERS.default;
  return CONSUMER_PROVIDERS[consumer] ?? CONSUMER_PROVIDERS.default;
}
