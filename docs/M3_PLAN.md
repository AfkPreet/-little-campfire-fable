# M3 plan: mystery, trip end, free play

## Mystery (full depth; `data/mystery.ts` holds the 5 clues and `MYSTERY_RULES`)

| Step | Trigger | What the player sees | State |
| --- | --- | --- | --- |
| 1 | First night, hero outside (not resting), ~6 s | A faint glow drifts far out beyond the snags (Guardian `glowFarOut`) | `setMysteryStep(1)`, journal stamp, toast "Journal updated" |
| 2 | The dawn after the first rainy night | A sparkle on the shore (near the rock pool): tap it → "Glimmering Scale" pop + card | step 2, `scaleFound` |
| 3 | Entering the Shop with the scale | Doddamma's three legend lines (STRINGS.legend) in the bubble, a recipe card pops, Bamboo Steamer and Moon Lily spot unlock (`gearVisibleInShop`, `forageAvailable`) | step 3, `legendHeard` |
| 4 | Cook Moonlight Kadubu (steamer + rice flour + moon lily + firefly catfish) | NEW RECIPE ribbon; the dish glows (dish icon with a glow halo); `guaranteedRainQueued` so the next night rains | step 4, `dumplingsCooked` |
| 5 | Rainy night, tier glowing (70+), carrying the kadubu, at the jetty | Action bubble "Leave an offering" → the finale (~45 s, skippable on replays): rain softens, the glow grows, Bangari rises (`rise`), slow-blinks, nuzzles the jetty, eats with a happy rumble, clouds part to stars and a moonbow, fireflies swirl. Gift: Guardian Lantern (decor, hang, +5 baseline). The next campsite appears on the Trip Album map. | step 5, `finaleDone`, badge `guardian_friend`, moonbow moment recorded |

If unfinished by Day 7 the mystery carries into free play.

## Trip Album (`src/scenes/Album.ts`, `src/art/album.ts`)

After sleeping on Night 7: scrapbook pages, one per day (bloom with the day's peak, best catch, most-cooked dish, moments), the companion's page, the mystery page ("You met the guardian of Manjukere." or "The glow is still out there..."), a postcard teasing Mallige Falls ("Next trip: Mallige Falls. Coming soon."). Buttons: "Stay a little longer" (free play: Day 8, 9...) and "Start a new trip" (`startNewTrip()` keeps journal and badges; resets money, gear and camp). Cover "Little Monsoon: Trip 1".

## Free play and new trip

Days continue past 7 with the same loop; the album is reachable again from the Journal's Trip tab (a button on the last page). "Start a new trip" from the Album or Settings runs the confirm modal and restarts at the Intro's last page ("First, a stop at the shop...").

## Shots (m3)

mystery-glow (night 1), scale-sparkle (dawn), legend (shop), kadubu (cooking result), finale-rise, finale-moonbow, album-day, album-postcard.
