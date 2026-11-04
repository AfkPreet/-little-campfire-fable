# Little Monsoon: 90-second trailer

One trip, Day 1 to the guardian. 16:9, 1280x720 captures from the live game, handwritten captions on screen, a voice-over script for Higgsfield underneath. Sixteen beats.

## Beat sheet

| # | Time | Footage (live capture unless noted) | Caption (on screen) | Voice-over |
| --- | --- | --- | --- | --- |
| 1 | 0:00-0:05 | The camp at dusk, fireflies rising from the bamboo (hero idle by the fire) | Seven days. A quiet lake. | Seven days at a quiet lake in the hills. |
| 2 | 0:05-0:11 | Doddamma's shop: the greeting, then buying the tent, the rod and the kettle (the cards squash, the money ticks down) | (none: the shop sign carries it) | First, a stop at the shop. A tent, a rod, something to cook in. The rest is just nice to have. |
| 3 | 0:11-0:17 | Chikki walks to the clearing, taps a spot, taps the four pegs, the tent springs up | Home sweet home | Pick a spot. Tap the pegs. Home sweet home. |
| 4 | 0:17-0:22 | Foraging the jamun thicket; berries arc into the bag with a sparkle trail | Jamun, mushrooms, lemongrass | The clearing is full of small things worth picking. |
| 5 | 0:22-0:29 | Fishing from the jetty: the cast, the bobber, the "!", the reel, the catch card | Tap when it bites | Cast off the jetty, wait for the nibble, and tap when it bites. |
| 6 | 0:29-0:36 | Cooking: ingredients dragged into the kettle, the stir, steam and sizzle, "NEW RECIPE!" | Stir twice | Cook by the fire. Every dish you discover goes in the journal. |
| 7 | 0:36-0:41 | Time-lapse from golden hour to night over the camp, fire lit, moon path appears | Night keeps its own time | Night comes when it comes. Sleep when you like. |
| 8 | 0:41-0:46 | Decor at night: a paper lantern glows, the toran flutters, fairy lights twinkle on the tent | Make it yours | Hang a lantern. String some lights. Make the camp yours. |
| 9 | 0:46-0:51 | Puttu peeks from the thicket, then nibbles a shared dish and wiggles | Someone shy | Someone shy has been watching you eat. |
| 10 | 0:51-0:56 | The journal: fish page, recipes page, stamps, a page flip | 36 stamps to find | Thirty-six stamps. Fish, recipes, moments, a friend, and a mystery. |
| 11 | 0:56-1:01 | A rainy afternoon: rings on the water, Chikki resting in the tent doorway | Rain on the tent is a reward | When it rains, you rest. |
| 12 | 1:01-1:06 | Dawn after the rain: the rainbow moment with its banner | The morning says thank you | And sometimes the morning says thank you. |
| 13 | 1:06-1:12 | Night one: a faint glow far out on the water; the next dawn, a sparkle on the shore, the Glimmering Scale card | Too big for any fish I know | On the first night there was a glow, far out on the water. And in the morning, a scale too big for any fish. |
| 14 | 1:12-1:24 | The finale, trimmed: the offering at the jetty, Bangari rises, slow blink, eats, the moonbow | (none) | On a rainy night, if you are truly content, carry the dumplings to the jetty. |
| 15 | 1:24-1:28 | The album's last page: the Mallige Falls postcard | Seven days go by fast | Seven days go by faster than you think. |
| 16 | 1:28-1:30 | Title card over the dusk camp: Little Monsoon, a tiny camping trip, coming soon | (none: the title card carries it) | Little Monsoon. A tiny camping trip. Coming soon. |

Caption rules: Patrick Hand, cream with an ink shadow, bottom-left, one line, fades in 300 ms after the beat starts and out 300 ms before it ends. No caption during the finale; the moonbow banner is the game's own.

## Voice-over script (for Higgsfield; about 150 words, 90 s at a slow, warm pace)

Voice: a gentle, unhurried adult, a slight smile in it, like reading to someone at bedtime. Indian English is welcome. Leave the pauses; the music fills them.

> [0:00] Seven days at a quiet lake in the hills.
> [0:05] First, a stop at the shop. A tent, a rod, something to cook in. The rest is just nice to have.
> [0:11] Pick a spot. Tap the pegs. Home sweet home.
> [0:17] The clearing is full of small things worth picking.
> [0:22] Cast off the jetty, wait for the nibble, and tap when it bites.
> [0:29] Cook by the fire. Every dish you discover goes in the journal.
> [0:36] Night comes when it comes. Sleep when you like.
> [0:41] Hang a lantern. String some lights. Make the camp yours.
> [0:46] Someone shy has been watching you eat.
> [0:51] Thirty-six stamps. Fish, recipes, moments, a friend, and a mystery.
> [0:56] When it rains, you rest.
> [1:01] And sometimes the morning says thank you.
> [1:06] On the first night there was a glow, far out on the water. And in the morning, a scale too big for any fish.
> [1:12] On a rainy night, if you are truly content, carry the dumplings to the jetty.
> [1:24] Seven days go by faster than you think.
> [1:28] Little Monsoon. A tiny camping trip. Coming soon.

## Music

Use `music_day.mp3` from `MUSIC_BRIEF.md` for 0:00-0:36, cross to `music_night.mp3` at 0:36, and `finale.mp3` from 1:12 to the end. Duck the music 6 dB under the voice.

## Files

- `npm run trailer:capture` renders the whole trailer in one pass (about 7 minutes headless): 2700 frames at 30 fps from the live game, two encodes.
- `marketing/trailer/render/little-monsoon-trailer-16x9.webm`: the 90 s master, VP9 at 4 Mbps, 40.7 MB, captions burned in, silent. Not in git (sent from the session; re-render to recreate).
- `marketing/trailer/render/little-monsoon-trailer-16x9-web.webm`: the same cut at 1.1 Mbps, 13.3 MB, in git.
- Player page: https://claude.ai/artifact/7XUyoTwSkBaj9TbCXzQu1v (private until shared; `marketing/trailer/index.html`, the web copy uploaded as its asset).
- `marketing/trailer/checks/beat-NN.png`: a still from each beat's midpoint, written during the render; `--verify --at=46,49.5` seeks any time in the finished web file.
- Convert the master to MP4 locally, then lay the voice-over and music under it:
  `ffmpeg -i little-monsoon-trailer-16x9.webm -c:v libx264 -pix_fmt yuv420p -crf 18 little-monsoon-trailer-16x9.mp4`
