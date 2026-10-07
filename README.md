# Fire Run

A 2-player pixel-art race on one keyboard. The screen is split in two: Red runs on top, Blue on the bottom, through the exact same endless prairie. A wall of fire chases each of you and keeps getting faster. If it catches you, the other player wins.

Built with plain HTML, CSS and JavaScript. No frameworks or build tools are needed.

## Controls

| | Jump | Run |
|---|---|---|
| **Red** (top) | `W` | `A` / `D` |
| **Blue** (bottom) | `↑` | `←` / `→` |

`P` or `Esc` pauses.

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
js/game/level.js      The endless level generator
js/game/player.js     A runner: running, jumping, collisions, dying and respawning
js/game/sprites.js    The pixel art (drawn as text, one letter per pixel)
js/game/render.js     Draws everything
js/game/game.js       The game loop: keyboard, fire, swap orbs, who wins
```

## How the endless level works

- **One level, two cameras.** There's only one level in memory. Each half of the screen follows one player through it, which is why both courses are always identical.
- **Built in sections.** The level is stitched together from hand-designed pieces: flat ground, steps, spikes, pits, floating platforms, moving platforms, crumbling platforms, a portal shortcut and swap orbs. Each piece is designed so it can always be cleared, and the pieces get harder further along.
- **Built just ahead of the leader.** New sections are added on the right whenever the player in front gets close to the end, so the course never runs out.
- **Per-player crumbling platforms.** Each player has their own copy of the crumbling platforms. If one falls under Red, it's still there when Blue arrives.
- **Swap orbs work once.** When anyone touches one, the players trade places, including everything about where they are, and the orb disappears for both.
