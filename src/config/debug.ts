/**
 * Debug hooks (dev builds, or ?debug=1 in production).
 * ?scene=  ?time=dawn|day|golden|dusk|night  ?weather=clear|rain|mist  ?day=  ?seed=  ?state=fresh|midtrip|finale  ?tab=fish|recipes|moments|friends|mystery|trip
 * Scenes read DEBUG rather than parsing the URL themselves.
 */
const params = new URLSearchParams(window.location.search);
const isDev = import.meta.env.DEV;

export const DEBUG = {
  enabled: isDev || params.get('debug') === '1',
  scene: params.get('scene') ?? undefined,
  board: params.get('board') ?? undefined,
  time: params.get('time') ?? undefined,
  weather: params.get('weather') ?? undefined,
  day: params.get('day') ? Number(params.get('day')) : undefined,
  seed: params.get('seed') ? Number(params.get('seed')) : undefined,
  state: params.get('state') ?? undefined,
  /** Trigger a rare moment 1 s after Camp settles (screenshots): ?moment=rainbow */
  moment: params.get('moment') ?? undefined,
  /** Journal tab to open on (?scene=journal&tab=fish). */
  tab: params.get('tab') ?? undefined,
  /** Force the companion to peek once Camp settles (screenshots): ?peek=1 */
  peek: params.get('peek') === '1',
  /** Enter decor mode once Camp settles (screenshots): ?decor=1 */
  decor: params.get('decor') === '1',
  /** Freeze all animation time at a fixed value (screenshots): ?freeze=1 */
  freeze: params.get('freeze') === '1',
  /** Skip the audio-unlock gate and title (headless scripts). */
  noAudio: params.get('noaudio') === '1',
};
