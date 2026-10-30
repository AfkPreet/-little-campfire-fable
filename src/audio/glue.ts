/**
 * glue.ts: the few bindings between the UI kit's events and the audio layer, plus the music-mood rule.
 * Nothing else lives here (the Camp systems own ambience).
 */
import { audio } from '@/audio';
import { UI_EVENTS, onUi } from '@/ui/events';
import type { Mood } from '@/audio/music';

/** dayT at or past which the night mood plays. */
const NIGHT_MOOD_FROM = 0.82;

let installed: (() => void) | null = null;

/** ui:press -> squish, ui:nope -> nope. Idempotent; returns an uninstaller. */
export function installAudioGlue(): () => void {
  if (installed) return installed;
  const offPress = onUi(UI_EVENTS.press, () => audio.sfx.play('squish'));
  const offNope = onUi(UI_EVENTS.nope, () => audio.sfx.play('nope'));
  installed = () => {
    offPress();
    offNope();
    installed = null;
  };
  return installed;
}

/** Music mood for a time of day: night past dusk, rain while it rains, day otherwise. */
export function moodFor(dayT: number, raining: boolean): Mood {
  if (dayT >= NIGHT_MOOD_FROM) return 'night';
  if (raining) return 'rain';
  return 'day';
}

/** Choose and apply the music mood. */
export function setMoodFor(dayT: number, raining: boolean): Mood {
  const mood = moodFor(dayT, raining);
  audio.music.setMood(mood);
  return mood;
}
