/**
 * save.ts: localStorage persistence under one versioned key, with migrations and a debounced autosave.
 * Every call is safe when storage is missing or throws (private mode, quota): it fails quietly and returns null/false.
 *
 * The store binds itself as the save source (bindSaveSource) so this module never imports the store.
 */
import { STATE_VERSION, type GameState } from './GameState';
import { createFreshState } from './defaults';

export const SAVE_KEY = 'little-campfire:save';
/** Debounce between markDirty() and the write. */
export const AUTOSAVE_DEBOUNCE_MS = 500;

export interface SaveEnvelope {
  version: number;
  state: GameState;
}

/** Migrations keyed by the version they upgrade FROM; each returns the state at version + 1. */
type Migration = (state: Record<string, unknown>) => Record<string, unknown>;
export const MIGRATIONS: Record<number, Migration> = {
  // 0 -> 1: pre-release saves had no version field; nothing to move yet.
  0: (s) => ({ ...s, version: 1 }),
};

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Fill any key missing from a loaded state with the fresh default (loaded values win; arrays are kept as saved). */
function repair<T>(defaults: T, loaded: unknown): T {
  if (Array.isArray(defaults)) return (Array.isArray(loaded) ? loaded : defaults) as T;
  if (isObject(defaults)) {
    const src = isObject(loaded) ? loaded : {};
    const out: Record<string, unknown> = { ...src };
    for (const k of Object.keys(defaults as Record<string, unknown>)) {
      out[k] = repair((defaults as Record<string, unknown>)[k], src[k]);
    }
    return out as T;
  }
  return (loaded === undefined || loaded === null ? defaults : loaded) as T;
}

/** Upgrade a raw envelope to STATE_VERSION, or null when it is unusable (corrupt, or from the future). */
export function migrate(raw: unknown): GameState | null {
  if (!isObject(raw) || !isObject(raw.state)) return null;
  let version = typeof raw.version === 'number' ? raw.version : 0;
  let state: Record<string, unknown> = { ...raw.state };
  if (version > STATE_VERSION) return null;
  while (version < STATE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return null;
    state = step(state);
    version++;
  }
  if (typeof state.day !== 'number' || typeof state.seed !== 'number') return null;
  const fixed = repair(createFreshState(state.seed), state);
  fixed.version = STATE_VERSION;
  return fixed;
}

export function hasSave(): boolean {
  const st = storage();
  if (!st) return false;
  try {
    return st.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Write the state now. Returns false when storage is unavailable. */
export function save(state: GameState): boolean {
  const st = storage();
  if (!st) return false;
  try {
    state.meta.updatedAt = Date.now();
    const env: SaveEnvelope = { version: STATE_VERSION, state };
    st.setItem(SAVE_KEY, JSON.stringify(env));
    dirty = false;
    return true;
  } catch {
    return false;
  }
}

/** Read and migrate the save, or null when there is none or it is unusable. */
export function load(): GameState | null {
  const st = storage();
  if (!st) return null;
  try {
    const text = st.getItem(SAVE_KEY);
    if (!text) return null;
    return migrate(JSON.parse(text));
  } catch {
    return null;
  }
}

export function clearSave(): void {
  const st = storage();
  if (!st) return;
  try {
    st.removeItem(SAVE_KEY);
  } catch {
    /* storage refused; nothing to clear */
  }
  dirty = false;
}

// ---------- autosave ----------
let source: (() => GameState) | null = null;
let dirty = false;
let timer: ReturnType<typeof setTimeout> | null = null;

/** The store calls this once so flush() knows what to write. */
export function bindSaveSource(getState: () => GameState): void {
  source = getState;
}

/** Call after every meaningful change; the write happens 500 ms later (coalescing bursts). */
export function markDirty(): void {
  dirty = true;
  if (timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, AUTOSAVE_DEBOUNCE_MS);
}

/** Write immediately if anything changed. */
export function flush(): boolean {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (!dirty || !source) return false;
  return save(source());
}

export function isDirty(): boolean {
  return dirty;
}

/** Flush when the tab hides or unloads. Returns an uninstall function. */
export function installAutosave(win: Window = window): () => void {
  const onVisibility = (): void => {
    if (win.document.visibilityState === 'hidden') flush();
  };
  const onHide = (): void => {
    flush();
  };
  win.document.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('pagehide', onHide);
  return () => {
    win.document.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('pagehide', onHide);
  };
}
