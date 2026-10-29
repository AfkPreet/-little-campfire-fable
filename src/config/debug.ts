/**
 * Debug hooks (dev builds, or ?debug=1 in production).
 * ?scene=  ?time=dawn|day|golden|dusk|night  ?weather=clear|rain|mist  ?day=  ?seed=  ?state=fresh|midtrip|finale
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
  /** Freeze all animation time at a fixed value (screenshots): ?freeze=1 */
  freeze: params.get('freeze') === '1',
  /** Skip the audio-unlock gate and title (headless scripts). */
  noAudio: params.get('noaudio') === '1',
};
