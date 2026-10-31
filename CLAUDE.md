# Fire Run: guide for working on this game

Read this first. It covers what the game is, how it's built, the rules of thumb the game follows,
how the owner likes to work, and what's still to do. The README has the detailed numbers for every
mechanic (keep it up to date when you change one).

## What the game is

**Fire Run** is a pixel-art endless runner in the browser, for 2 players on one keyboard (or 1 player).
The screen is split: Red runs on top (W A S D), Blue on the bottom (arrow keys). Both race through the
**same** endless course while a wall of fire chases them and keeps speeding up (35 px/s, +0.9 px/s every
second; runners do 96 px/s). The fire catching you ends your race; the last one left wins. Dying to a
danger is not the end: you respawn a little behind (1 s later, 40 px back, on a safe spot), so dying
costs ground to the fire. 1 Player: one big view, race the fire for distance (best is remembered).

- Plain HTML, CSS and JavaScript. No frameworks, no build step, no sound or image files: the sounds
  are synthesized (sound.js) and the art is drawn in code (sprites.js).
- Repo: `AntonisRasoulis/VibeCodingPractice`. Development branch: `claude/nice-meitner-muga6l`
  (a fresh chat may be given a different branch: use the one you're told).
- Published as a claude.ai Artifact (a single bundled HTML file):
  **https://claude.ai/artifact/Uh5CKSPymdWERadhojnY7P** (Version 86 at the time of writing). Always
  republish to this same URL (pass it as `url`); never create a new artifact for the game.

## Style

- **Look:** chunky pixel art. Each view is 400 x 120 game pixels (a tile is 8 px, 15 rows), drawn at 2x.
  Font: "Press Start 2P". Sprites are rows of letters (one per pixel) turned into canvases
  (`spriteFromRows`), or drawn pixel by pixel in code. Glows are pre-made soft circles (`makeGlow`,
  `drawGlowAt`), drawn in steps so they still look like pixels.
- **Feel:** fast, readable, a bit silly, always fair. Every danger gives you a warning and a way out.
- **Words in the game:** short, shouty pop-ups ("ZAPPED!", "HOOKED!", "FLOATING!"), and the
  How to play section in index.html in plain, friendly English.
- **Code:** comments in plain, simple English that explain *why*, matching the style around them. All
  tunable numbers live in `config.js` as named objects with a comment on every value (e.g. `SAW`,
  `TURRET`, `SPORES`). Keep functions near their siblings and follow the existing patterns.

## How the code fits together

Scripts load in this order (all globals, no modules), each with a `?v=` cache-busting stamp in index.html:
`config.js` → `sound.js` → `level.js` → `player.js` → `sprites.js` → `render.js` → `game.js` → `main.js`.

- **config.js:** every number worth tweaking. Also `BIOMES` (the normal rotation), `SECRET_BIOMES`
  (`forest`), `BIOME_NAMES`.
- **level.js (`Level`):** the endless course, built in sections just ahead of the leader (`ensure`,
  `addSection`, `SECTIONS.*`). `cols[col][row]` holds tiles (`T_EMPTY`, `T_GROUND`, `T_SPIKE`,
  `T_SHOOTER`). Obstacles are arrays on the level (`maces`, `saws`, `shooters`, `platforms`, `orbs`,
  `turrets`, `flytraps`, `sporeShrooms`, `sleepShrooms`, ...). Seeded random (`this.rng`), so a level
  can be rebuilt from its seed. Biome changes come at a wooden sign (`newBiome`), every 250-450 tiles.
  Key helpers: `groundTop(x)`, `threatened(x, y)` (could anything hurt someone standing here?),
  `safeSpotBefore/After(x)`, `biomeAt(col)`.
- **player.js (`Player`):** running, jumping, collisions, hazards (`checkHazards`), dying and respawning.
  `update(dt, input, level)` gets the course the player is on. Hitbox 6 x 11.
- **game.js (`Game`):** the loop (fixed step of 1/120 s), input, the fire, and everything that isn't
  part of the course: orbs and powers, missiles, bears, vultures, jaguars, turrets' arrows, hands,
  drones, monkeys, loose saws, the sleep mushroom and forest trips. `Game.world` holds all live state.
  `Game.start(players, { biomes, biomeList, wild })`.
- **render.js (`Renderer`):** draws each player's view (`drawView`) and the text on top (`drawText`).
- **sprites.js:** all pixel art, built once at start (`buildSprites`).
- **main.js:** the page around the game: Start buttons, Biomes on/off and the biome picker, Mode
  (Normal / Wild), Sound, Pause, win counters, best distance (all remembered in `localStorage`).

### Important patterns

- **Shared dangers are worked out from the clock.** Maces, saws, shooters' spikes, moving platforms,
  river logs, spore and sleep-mushroom spores: positions come from `world.time` (or `level.time`), not
  stored state, so both players' views always agree and nothing drifts.
- **Per-player copies** where each player should face it themselves: crumbling platforms, icicles,
  coconuts, bear traps, tumbleweeds, rolling snowballs (`fallState`, `icicleState`, ... on the player).
- **"Caught" means out of the race.** Nearly every system skips players with `caught` (and usually
  `dead` / `held`). The forest trick below relies on this.
- **Realms (the enchanted forest).** A player in the forest has `p.realm` = a separate `Level` (biome
  `forest`, with `realmEnd`) that covers the same x positions as the main course, so distance and the
  fire carry over naturally. Each step: every player updates on `p.realm || world.level`; then
  `onCourse(level, fn)` runs the main course's systems with everyone who's elsewhere temporarily
  marked `caught`, and each forest gets its own (loose saws, spores, sounds). Each view draws its
  player's course (`render`: a `view` object with `level` swapped and the main course's creatures
  emptied). Particles that belong to a course carry `level` so they only show there. Getting in and
  out: `p.dream` ({ kind: "sleep" | "fireflies", t }), `moveTo`, `makeForest`, `dreamDark`.
- **Powers:** an orb sets `p.power` (one at a time); S / Down calls `usePower`. Solo mode swaps some
  powers for helpful versions (drone and firehawk guard you, snowball gives skates, monkey ferries you
  forward). The HUD label maps in `drawText` need an entry for every power (missing ones showed
  "undefined" once).

## What's in the game now

- **Shared obstacles:** steps, spike groups, pits, floating / moving / crumbling platforms, blue-to-orange
  portals, swinging maces, diagonal spike shooters, saw blades (in a ground slot, on a pole, in a pit).
- **Biomes** (off by default, turned on with the Biomes button; the arrow picks which): **prairie**
  (missiles, bear traps, bushes to hide in), **snow** (ice, icicles, rolling snowballs, thin ice over
  ponds, bears), **desert** (cactuses, quicksand, tumbleweeds, sinkholes, vultures), **jungle** (bamboo
  and thorn bushes, rivers with drifting logs, palms dropping coconuts, flytraps, jaguars and panthers,
  ancient turrets shooting arrows: plain, poison, sleep and blunt). Biome dangers start at 400 m
  (some at 500 m). **Wild mode** brings everything from the start, faster, and more of it.
- **Orbs** (about 3 per biome): **gold** works at once (swap places, freeze, dash; sandstorm, snowstorm,
  monsoon in their biomes). **Light blue** is used with S / Down (wind dash, lightning, mystic hand,
  rescue drone; firehawk, snowball, monkey in their biomes). **Purple** catch-up orbs appear only for
  whoever has fallen off the leader's screen (alone: when the fire is on your screen), out of sight of
  both: portal gun, grapple (2 players only), vine.
- **The enchanted forest** (a hidden biome, never in the normal rotation): reached by falling asleep
  under a **sleep mushroom** (purple, spore-mushroom style, on the main course about once per biome from
  400 m; a slow light rain of spores for 3-10 s, then 10 s rest; its cap glows just before). You wake in
  a twilight forest 100-250 tiles long (fireflies, glowing mushrooms, thorn-vine spikes, all obstacles
  restyled in dark purple wood: no brown). The forest is "secretly out to get you": 1 in 5 saws breaks
  loose with a faint magic, bursts out and rolls at you half-buried with a magic trail; spike shooters
  float left and right (rideable), sometimes stacked 2-3 high; **spore mushrooms** (curvy S stems; red =
  faster, blue = higher jumps, green = poison screen, 10 s; pink = float up for 5 s; they stack). At the
  end, fireflies (the background's too) swarm you into a ball of light and you wake on the main course
  at the same distance. No orbs in the forest; you can't use powers there (you keep them).
- **Magic feet** (the forest's gift, `MAGIC_FEET`): coming out of the forest, you have it for the rest of
  the race. Magic holds you up over every hole: pits and rivers get a magic bridge as you get near
  (`updateBridges`); quicksand, sinkholes and thin ice still go off, then a bridge catches you
  (`Player.magicCatch`). A bridge is an invisible platform (kind `bridge`, first in `level.platforms`);
  all you see is the floating shooters' magic in a little stretch under whoever stands on it. Anyone can
  use it: 2 s after you've left it (then a 1 s fade), never from under someone. Bear traps unchanged.

## Rules of thumb for designing

- **Always fair.** Every danger can be dodged by a normal player: jumpable heights, warnings before
  things fire or break, and there's always a safe spot to stand and wait between two dangers (tested).
  Respawn spots are never somewhere a danger reaches (`threatened`).
- **New players first:** biomes start off; special dangers wait until 400 m (except Wild mode).
- **Both players get the same course;** whatever affects "the other player" needs a sensible 1-player
  version (or is left out alone).
- **Check the numbers with tests,** then write them in the README (e.g. "caught 9 times in 10",
  "always lands at least 74 px from a pit").
- **Keep it readable at 400 x 120:** strong outlines and contrast against the background (dark things
  on dark purple vanish), glows for magic, warnings that read at a glance.

## How the owner likes to work

- **Before a big feature: ask questions first,** as lettered options in plain text (A / B / C), several
  numbered questions in one message. Don't use the AskUserQuestion tool: the owner couldn't see its
  options. Give a recommendation when you have one.
- **Show sprites before building art:** draw mockups / drafts (an HTML page with canvases, screenshot
  with Playwright, send the image) and get them approved. Expect a few rounds of "make it curvier",
  "no brown", "more subtle".
- **Make a captioned video** of each new feature on a test course and send it (record with Playwright's
  `recordVideo`, add captions as page overlays, crop with ffmpeg: 2 players `crop=800:484:50:6`,
  1 player `crop=800:240:50:2` after skipping the first ~3.4 s). Videos and mockups go in the
  scratchpad only, never in the repo. Check them with contact sheets of frames before sending.
- **Answer questions with numbers** when asked ("how many orbs per biome?" → a measured number).
- **Shipping every change:** test → bump the `?v=` stamp on all 8 script tags in index.html → bundle
  (`python3 tools/bundle.py . <scratchpad>/fire-run.html`) → smoke test the bundle
  (`node tools/smoke-test.mjs <absolute path>`) → commit (with the attribution lines the session asks
  for) → push to the branch → republish the artifact to the same URL. Update the README and the
  How to play section (index.html) for any new mechanic.
- Commit when asked to (a stop hook may ask you to commit outstanding work).
- Use they/them for the owner.

## Testing

- Playwright is at `/opt/node22/lib/node_modules/playwright/index.mjs` (Chromium pre-installed).
- Use `page.clock.install()` and `page.clock.runFor(ms)` for exact, fast tests. Errors thrown inside the
  game loop can be silent: wrap `requestAnimationFrame` to catch and log them.
- Common setup: `Game.start(...)`, hide `#game-overlay`, set `world.state = "playing"`,
  `world.countdown = 0`, build a test course (`new Level(seed, biome, { biomes: false, solo })`, then
  `l.flat(n)`, clear arrays you don't want, `l.addSection = function () { this.flat(40); }`), and drive
  players by wrapping `Player.prototype.update` with your own input.
- A 1-player test level must be made with `{ solo: true }` (otherwise it has swap orbs, which need a
  second player).
- Screenshots can advance the game a few frames, so a state can move on between your check and the
  picture.
- Worth re-running after changes: "a safe waiting spot between every pair of dangers" across many seeds
  and biomes, respawn distances, orbs per biome (about 3), and a full 2-player race with biomes on.

## Still to do / ideas parked

- Maybe the forest's own two orbs (one gold, one light blue) and an animal / chaser.
- The floating shooters' stumps and thorns are small and dark: could be made easier to see.
- An **arcane ruins** biome (aurora sky, stone ruins with glowing runes, teal magic flames) was mocked
  up and liked; saved for a later "secret" biome reached the same way as the forest.
- Ideas offered for more "the forest is out to get you": maces that swing harder when you're close,
  eyes blinking in tree trunks, shooters turning to face you.
