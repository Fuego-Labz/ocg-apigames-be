// mapa consumer -> lista de provider IDs permitidos.
// "default" es OCG (cuando no se envía ?consumer= o se envía uno desconocido).
// agregar nuevos consumers aquí sin tocar el resto del código.
export const CONSUMER_PROVIDERS: Record<string, string[]> = {
  default: ['4', '7', '8', '12', '58', '64'], // PragmaticPlay, Fugaso, BGaming, Yggdrasil, TurboGames, PGSoft
  '777vault': [
    '1',   // BetSoft
    '3',   // TomHorn
    '4',   // PragmaticPlay
    '7',   // Fugaso
    '8',   // BGaming
    '12',  // Yggdrasil
    '30',  // Ruby Play
    '58',  // TurboGames
    '64',  // PGSoft
    '70',  // Rogue
    '72',  // Ethereal
    '76',  // AvatarUX
    '81',  // Eurasian
    '92',  // Blaze (no existe en DB todavía)
    '93',  // Peter And Sons
    '101', // InOut Games
    '102', // 77 Gaming
    '110', // Aviator LLC
  ],
};

// resuelve la lista de providers para un consumer. si el consumer es desconocido
// o no se especifica, devuelve la lista del consumer "default" (OCG).
export function resolveProviderIds(consumer?: string): string[] {
  if (!consumer) return CONSUMER_PROVIDERS.default;
  return CONSUMER_PROVIDERS[consumer] ?? CONSUMER_PROVIDERS.default;
}
