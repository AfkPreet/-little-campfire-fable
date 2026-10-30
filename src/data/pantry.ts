/** pantry.ts: staples, 1 portion each. Prices from spec section 6 (locked). */
import type { PantryId, PantryItem } from './types';

export const PANTRY: readonly PantryItem[] = [
  { id: 'rice', tab: 'pantry', price: 4, portions: 1, name: 'Red Rice', flavor: 'A small paper twist of pearly grains.' },
  { id: 'flour', tab: 'pantry', price: 4, portions: 1, name: 'Rice Flour', flavor: 'Soft and powdery; good for anything fluffy.' },
  { id: 'tea', tab: 'pantry', price: 5, portions: 1, name: 'Kaapi Powder', flavor: 'Dried leaves that smell like a warm afternoon.' },
  { id: 'honey', tab: 'pantry', price: 6, portions: 1, name: 'Estate Honey', flavor: 'Golden and slow. Sweetens everything it touches.' },
  { id: 'spice', tab: 'pantry', price: 3, portions: 1, name: 'Spice Pouch', flavor: 'A little pouch of warmth for the toes.' },
];

export const PANTRY_BY_ID: Record<PantryId, PantryItem> = PANTRY.reduce(
  (acc, p) => ((acc[p.id] = p), acc),
  {} as Record<PantryId, PantryItem>,
);
export function isPantryId(id: string): id is PantryId { return id in PANTRY_BY_ID; }
