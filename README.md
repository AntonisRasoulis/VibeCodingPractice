# Fire Run

A 2-player pixel-art race on one keyboard. The screen is split in two: Red runs on top, Blue on the bottom, through the exact same endless prairie. A wall of fire chases each of you and keeps getting faster. If it catches you, the other player wins.

Built with plain HTML, CSS and JavaScript. No frameworks or build tools are needed.

## Controls

| | Jump | Run | Use ability (wind dash / lightning / hand) |
|---|---|---|---|
| **Red** (top) | `W` | `A` / `D` | `S` |
| **Blue** (bottom) | `↑` | `←` / `→` | `↓` |

`P` or `Esc` pauses. `M` (or the Sound button) turns the sound off and on.

## Run it locally

Open `index.html` in your browser. Or start a local server:

```
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Project structure

```
index.html            The page: header, game area, how-to-play, footer
css/style.css         Styling for the page
js/main.js            Connects the page (Start/Pause buttons, win counters) to the game
js/game/config.js     Numbers you can tweak: speeds, jump height, fire speed, respawn time
js/game/sound.js      Sound effects, made by the browser's synthesizer (no sound files)
js/game/level.js      The endless level generator
js/game/player.js     A runner: running, jumping, collisions, dying and respawning
js/game/sprites.js    The pixel art (drawn as text, one letter per pixel)
js/game/render.js     Draws everything
js/game/game.js       The game loop: keyboard, fire, swap orbs, who wins
```

## How the endless level works

- **One level, two cameras.** There's only one level in memory. Each half of the screen follows one player through it, which is why both courses are always identical.
- **Built in sections.** The level is stitched together from hand-designed pieces: flat ground, steps, spikes, pits, floating platforms, moving platforms, crumbling platforms, swinging maces, spike shooters, a portal shortcut and swap orbs. Each piece is designed so it can always be cleared, and the pieces get harder further along.
- **Built just ahead of the leader.** New sections are added on the right whenever the player in front gets close to the end, so the course never runs out.
- **Biomes.** Every 250-450 tiles (about 350 on average) a sign marks a new biome. The first race after opening the website starts in the prairie; later races start in a random biome. In the **snow**, spikes are taller ice spikes, ice patches are slippery (`SNOW.iceAccel`, `SNOW.iceFriction`), icicles under snowy ledges shake and drop when you get close, and snowballs roll at you and grow (up to 17 px across, `SNOW.snowballMaxR`, so they can always be jumped). Like the crumbling platforms, each player gets their own icicles and snowballs.
- **Desert.** Spikes become cactuses (14-18 px tall, only in groups of 1-2). Quicksand pits: you sink in 3 s; about 6 quick jump presses (4+ a second) pull you free, slow pressing or wading doesn't. Tumbleweeds roll at you bouncing up and down. Settings in `DESERT` in config.js.
- **Special dangers start late.** Nothing biome-special comes before 400 m. From 400 m: black missiles, brown and black bears, brown vultures. From 500 m: red-striped missiles, polar bears and black vultures too (`THREATS` in config.js).
- **Each biome has one special danger.** The desert has **vultures**: about every 200 m (like the missiles), a group of 1-3 comes for the leader. Brown ones circle for 2 s, then swoop and skim the ground (jump over them) and snatch you back about 13 tiles if they hit. Black ones dive straight in, faster, and kill. Settings in `VULTURE`. The prairie has the missiles. The snow has **bears**: once per snow biome a bear (randomly polar, brown or black) charges in from the left after the leader. Running right nonstop always stays just ahead. Polar: fastest, 5 s, any slowdown is deadly. Brown: 10 s, a short stop is OK. Black: slowest, 15 s, catches you with honey (slowed for 4 s) instead of killing. A bear never pops into view on the trailing player's screen: if they're close enough to see where it starts, it starts off the left of their screen instead, charges through (launching them into the air if it runs over them) and only starts its timed chase once it reaches the leader's screen. Tune them in `BEAR` in config.js.
- **Missiles aren't part of the course.** After 400 m, in the prairie only, a missile comes about every 200 m (randomly 160-240 m apart, measured by the leader). It zooms in from the background on the left or right of a player, locks on for 0.6 s (missiles only ever come for the player in the lead), then fires in a straight line. Red-striped ones (after 500 m) aim where the player is heading.
- **Per-player crumbling platforms.** Each player has their own copy of the crumbling platforms. If one falls under Red, it's still there when Blue arrives.
- **Orbs work once.** When anyone touches a swap orb, the players trade places, including everything about where they are. About half the orbs are freeze orbs in disguise (the arrows in the middle are flipped): they hold whoever touches them still for 3 seconds. Either way the orb disappears for both players. Dash orbs (marked with a ») hold you in the air for a second, then launch you far to the right, wherever that lands you. Wind dash orbs (one white arrow, with white wind blowing off them) are the most common: press S (Red) or Down (Blue) to instantly dash about 12 tiles the way you're facing, on the ground or in the air. Lightning orbs (a white zigzag) give you one shot: press S (Red) or Down (Blue) to fire a bolt along the ground in the direction you're facing when you shoot. It travels the shared course until it reaches the other player, who has to jump over it. Hand orbs (a purple hand) give you a short-range mystic hand on the same key: facing right it grabs the other player and suplexes them backwards, facing left it backhands them further back. You hold one power at a time; a new one replaces the old.
