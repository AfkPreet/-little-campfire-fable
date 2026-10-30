# Music brief: Little Monsoon

The game sounds complete with no files: `src/audio/fallbackScore.ts` plays a generative lo-fi loop (D major, Imaj7 → vi7 → IVmaj7 → V, venu-voiced lead). These four files are an upgrade the game detects at boot and crossfades by time of day and weather (4 s fades). Drop them in `public/audio/` with exactly these names; no code change is needed:

| File | Used | Length |
| --- | --- | --- |
| `public/audio/music_day.mp3` | Dawn through golden hour, clear or misty | 120-150 s loop |
| `public/audio/music_rain.mp3` | Whenever it rains, day or night | 120-150 s loop |
| `public/audio/music_night.mp3` | Dusk and night, clear | 120-150 s loop |
| `public/audio/finale.mp3` | The guardian finale (replaces the loop for ~45 s) | 40-60 s, not a loop |

Shared rules for all four: instrumental, lo-fi, soft; lead instrument is a **venu / bansuri (bamboo flute) in its low, breathy register**; harmony on felt piano or Rhodes; key of **D major** so the files and the code fallback feel like one score; nothing louder than a gentle mix (the game ducks music 30% under the catch fanfare). Loops: **loop-friendly, no fade in or fade out, start and end on the tonic (D) with the same texture so the seam is invisible**; render as MP3 at 192 kbps or better, 44.1 kHz.

## Prompt 1: `music_day.mp3`

> Instrumental lo-fi, 76 BPM, D major. A breathy low bamboo flute (venu) plays a slow, warm pentatonic melody over felt piano chords (Dmaj7, Bm7, Gmaj7, A) with brushed drums and a soft shaker, a quiet upright bass, faint vinyl crackle and a little tape wobble. Distant morning birdsong texture is welcome but subtle. Mood: a quiet lakeside morning on a coffee estate, mist lifting, serene and kind, never busy. Length 140 seconds. Loop-friendly: no intro swell, no fade in or out, ends on the tonic with the same texture it starts with.

## Prompt 2: `music_rain.mp3`

> Instrumental lo-fi, 70 BPM, D major. Sparse felt piano chords (Dmaj7, Bm7, Gmaj7, A) with a low breathy bamboo flute (venu) playing long, slow notes with gentle vibrato, no drums, a soft sub bass, faint vinyl crackle, everything a little muffled and close, as if heard inside a tent while rain drums on the roof. Mood: cozy, sheltered, patient. Length 140 seconds. Loop-friendly: no fade in or out, ends on the tonic with the same texture it starts with.

## Prompt 3: `music_night.mp3`

> Instrumental lo-fi, 64 BPM, D major. Very sparse: soft Rhodes chords with a slow tremolo (Dmaj7, Bm7, Gmaj7, A), occasional plucked veena-like notes on the D major pentatonic, a very quiet low bamboo flute phrase every so often, no drums, faint vinyl crackle, a hint of crickets and fire crackle far in the background. Mood: fireflies over still water, warm firelight, sleepy. Length 150 seconds. Loop-friendly: no fade in or out, ends on the tonic with the same texture it starts with.

## Prompt 4: `finale.mp3`

> Instrumental, 72 BPM, D major, 50 seconds. Begins hushed with rain-soft felt piano and a single low bamboo flute (venu) note, slowly swells over 20 seconds with warm string pads and a gentle choir-like hum as something vast and kind rises from the water, peaks softly with the flute singing a simple pentatonic phrase, then settles into stillness with sparse Rhodes and a soft resolve on the tonic. No drums, nothing loud or dramatic; wonder rather than tension. Ends on a held D major chord that fades naturally in the last 3 seconds.

## Where the files go and how to check

1. Save the four files into `public/audio/` (create the folder if missing; it is served at `/audio/`).
2. Run `npm run dev`, open the game and tap once (audio unlocks on the first tap). In the browser console, `window.__game` has no music helper yet; instead listen: the day loop should replace the generative score within a few seconds.
3. Missing files are detected at boot (a 404 or HTML response counts as missing) and the fallback keeps playing for that mood only.
