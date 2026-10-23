# Fire Run

A 2-player pixel-art race on one keyboard. The screen is split in two: Red runs on top, Blue on the bottom, through the exact same endless prairie. A wall of fire chases each of you and keeps getting faster. If it catches you, the other player wins.

Built with plain HTML, CSS and JavaScript. No frameworks or build tools are needed.

## Controls

| | Jump | Run | Use ability (wind dash / lightning / hand) |
|---|---|---|---|
| **Red** (top) | `W` | `A` / `D` | `S` |
| **Blue** (bottom) | `↑` | `←` / `→` | `↓` |

**1 Player:** pick it on the start screen to race the fire alone with WASD or the arrow keys. It shows one big view, only dash, wind dash and drone orbs appear (the others need a second player), and your best distance is remembered.

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
- **Built in sections.** The level is stitched together from hand-designed pieces: flat ground, steps, spikes, pits, floating platforms, moving platforms, crumbling platforms, swinging maces, spike shooters, saw blades, a portal shortcut and swap orbs. The prairie also has bear traps and bushes (`TRAP` and `BUSH` in config.js): traps lie flat in the grass; small ones hold you for 1 s, medium for 2 s, large ones (only after 400 m) kill. Each player has their own traps, which re-arm when you respawn. Inside a bush you are hidden on both screens; about 10% of bushes hide a trap, and when it snaps the bush is torn open and stops hiding anyone. Besides their own sections, traps and bushes are sprinkled all over the prairie (`SCATTER`): before pits, near saws and maces, between other dangers. So you never get stuck, a trap only goes where it can always be jumped over (5 tiles of flat ground each side, nothing overhead), never takes the last safe place to stand between two dangers, and the deadly large ones stay out of reach of other dangers; bushes never cover spikes, pits or saw slots. A test jumps every trap on 150 generated courses, from full speed and from a standing start.
- **Desert sinkholes** (`SINK`) are the desert's bear traps: little holes, barely darker than the sand. Step (on the ground) too close and a small or medium one opens into a funnel and pulls you to the bottom; the sand pours in, but stops for 0.2 s every 0.9 s (it sparkles): jump then to get out. A jump at the wrong moment makes you slip back for 0.5 s, so mashing doesn't work. A large one (after 400 m) caves in to a 5-tile gap: jump over the hole or fall. Opened sinkholes stay open for both players (a caved-in one is a real pit). They get their own sections and are scattered over the desert with the same never-get-stuck rules as the traps (and never in a tumbleweed's path); a test jumps over or climbs out of every sinkhole on 100 desert courses. Saw blades come in three sizes (`SAW` in config.js) and slide along a slot in the ground, go up and down a rail (rising right through where a jump takes you, so you can't just always jump them), or rise out of a pit; their speeds were measured with a simulated runner so every saw always leaves a way through. Each piece is designed so it can always be cleared, and the pieces get harder further along.
- **Built just ahead of the leader.** New sections are added on the right whenever the player in front gets close to the end, so the course never runs out.
- **Biomes.** They start out turned off, so new players learn the game in the prairie; the **Biomes** button under the start buttons turns them on (remembered by the browser, `fire-run-biomes`). With biomes on, every 250-450 tiles (about 350 on average) a sign marks a new biome. The first race after opening the website starts in the prairie; later races start in a random biome. In the **snow**, spikes are taller ice spikes, ice patches are slippery (`SNOW.iceAccel`, `SNOW.iceFriction`), icicles under snowy ledges shake and drop when you get close, and snowballs roll at you and grow (up to 17 px across, `SNOW.snowballMaxR`, so they can always be jumped). Like the crumbling platforms, each player gets their own icicles and snowballs.
- **Desert.** Spikes become cactuses (14-18 px tall, only in groups of 1-2). Quicksand pits: you sink in 3 s; about 6 quick jump presses (4+ a second) pull you free, slow pressing or wading doesn't. Tumbleweeds roll at you bouncing up and down. Settings in `DESERT` in config.js.
- **Special dangers start late.** Nothing biome-special comes before 400 m. From 400 m: black missiles, brown and black bears, brown vultures. From 500 m: red-striped missiles, polar bears and black vultures too (`THREATS` in config.js).
- **Each biome has one special danger.** The desert has **vultures**: about every 200 m, a group of 1-3 comes for the leader. Brown ones circle for 2 s, then swoop and skim the ground (jump over them) and snatch you back about 13 tiles if they hit. Black ones dive straight in, faster, and kill. Settings in `VULTURE`. The prairie has the missiles. The snow has **bears**: twice per snow biome (at least 70 m apart, and never two chasing at once) a bear (randomly polar, brown or black) charges in from the left after the leader. Running right nonstop always stays just ahead. Polar: fastest, 5 s, any slowdown is deadly. Brown: 10 s, a short stop is OK. Black: slowest, 15 s, catches you with honey (slowed for 4 s) instead of killing. If the player it's chasing dies to something else, the bear runs (forwards or backwards) to just behind where they'll respawn, waits in view, and carries on the chase; its clock keeps running, so if time runs out while it waits, it gives up. It waits as close as `BEAR.waitBehind` but never so close that it could catch someone running flat out before its time is up. A bear never pops into view on the trailing player's screen: if they're close enough to see where it starts, it starts off the left of their screen instead, charges through (launching them into the air if it runs over them) and only starts its timed chase once it reaches the leader's screen. Tune them in `BEAR` in config.js.
- **Missiles aren't part of the course.** After 400 m, in the prairie only. Each prairie biome gets 2 missiles 75% of the time (1 missile 15%, 3 missiles 10%, `MISSILE.perBiome`), spread out across it; with biomes off, every 350 m of prairie counts as one biome. A missile comes when the leader reaches its spot, and only one is ever in the air at a time. It zooms in from the background on the left or right of a player, locks on for 0.6 s (missiles only ever come for the player in the lead), then fires in a straight line. Red-striped ones (after 500 m) aim where the player is heading.
- **Per-player crumbling platforms.** Each player has their own copy of the crumbling platforms. If one falls under Red, it's still there when Blue arrives.
- **Orbs work once.** When anyone touches a swap orb, the players trade places, including everything about where they are. About half the orbs are freeze orbs in disguise (the arrows in the middle are flipped): they hold whoever touches them still for 3 seconds. Either way the orb disappears for both players. Dash orbs (marked with a ») hold you in the air for a second, then launch you far to the right, wherever that lands you. Light blue orbs are the ones you use with S / Down. The drone orb sends a rescue drone: used by the player behind, it grabs the leader and drops them just in front of you; used by the leader, it catches you once if you fall into a pit. In 1 player the drone starts guarding as soon as you pick it up, no button needed (`DRONE` in config.js). Wind dash orbs (one white arrow, with white wind blowing off them) are the most common: press S (Red) or Down (Blue) to instantly dash about 12 tiles the way you're facing, on the ground or in the air. Lightning orbs (a white zigzag) give you one shot: press S (Red) or Down (Blue) to fire a bolt along the ground in the direction you're facing when you shoot. It travels the shared course until it reaches the other player, who has to jump over it. Hand orbs (a purple hand) give you a short-range mystic hand on the same key: facing right it grabs the other player and suplexes them backwards, facing left it backhands them further back. You hold one power at a time; a new one replaces the old.

**After changing the game:** the script and style links in `index.html` end in `?v=` and a number. Change that number (for example to today's date and time) whenever you publish an update, so browsers load the new files instead of old saved copies.
