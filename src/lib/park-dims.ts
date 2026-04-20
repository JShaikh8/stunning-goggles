/**
 * Outfield fence distances for the 30 MLB parks.
 * Keys are best-effort prefix matches against venues.name; {L, C, R} in feet.
 */
export type ParkDims = { L: number; C: number; R: number };

const BY_NAME: Record<string, ParkDims> = {
  'fenway':                  { L: 310, C: 390, R: 302 },
  'yankee':                  { L: 318, C: 408, R: 314 },
  'tropicana':               { L: 315, C: 404, R: 322 },
  'rogers':                  { L: 328, C: 400, R: 328 },   // Toronto
  'camden':                  { L: 333, C: 410, R: 318 },   // Orioles
  'progressive':             { L: 325, C: 410, R: 325 },   // Cleveland
  'guaranteed':              { L: 330, C: 400, R: 335 },   // White Sox
  'comerica':                { L: 345, C: 420, R: 330 },
  'kauffman':                { L: 330, C: 410, R: 330 },
  'target':                  { L: 339, C: 404, R: 328 },
  'daikin':                  { L: 315, C: 436, R: 326 },   // Astros (Minute Maid successor)
  'minute maid':             { L: 315, C: 436, R: 326 },
  'globe life':              { L: 329, C: 407, R: 326 },   // Texas
  'angel':                   { L: 330, C: 396, R: 330 },
  'oakland':                 { L: 330, C: 400, R: 330 },   // Sutter Health / RingCentral
  'sutter':                  { L: 330, C: 400, R: 330 },
  'ringcentral':             { L: 330, C: 400, R: 330 },
  't-mobile':                { L: 331, C: 401, R: 326 },   // Seattle
  'citi':                    { L: 335, C: 408, R: 330 },
  'citizens':                { L: 329, C: 401, R: 330 },   // Philly
  'nationals':               { L: 336, C: 402, R: 335 },
  'trust':                   { L: 335, C: 400, R: 325 },   // Atlanta (Truist)
  'truist':                  { L: 335, C: 400, R: 325 },
  'loandepot':               { L: 344, C: 407, R: 335 },   // Miami
  'marlins':                 { L: 344, C: 407, R: 335 },
  'pnc':                     { L: 325, C: 399, R: 320 },
  'great american':          { L: 328, C: 404, R: 325 },
  'wrigley':                 { L: 355, C: 400, R: 353 },
  'milwaukee':               { L: 344, C: 400, R: 345 },   // American Family Field
  'american family':         { L: 344, C: 400, R: 345 },
  'busch':                   { L: 336, C: 400, R: 335 },
  'dodger':                  { L: 330, C: 395, R: 330 },
  'oracle':                  { L: 339, C: 399, R: 309 },   // SF
  'petco':                   { L: 336, C: 396, R: 322 },
  'chase':                   { L: 330, C: 407, R: 335 },   // D-backs
  'coors':                   { L: 347, C: 415, R: 350 },
};

const DEFAULT: ParkDims = { L: 330, C: 400, R: 330 };

export function parkDimsForVenue(venueName: string | null | undefined): ParkDims {
  if (!venueName) return DEFAULT;
  const lower = venueName.toLowerCase();
  for (const key of Object.keys(BY_NAME)) {
    if (lower.includes(key)) return BY_NAME[key];
  }
  return DEFAULT;
}
