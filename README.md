# Game Site

A simple website with a game inside. Built with plain HTML, CSS and JavaScript — no frameworks or build tools needed.

## Project structure

```
index.html      The page: header, game area, info sections, footer
css/style.css   All styling (colors are variables at the top)
js/game.js      The game itself (currently a placeholder demo)
js/main.js      Connects the page (buttons, score display) to the game
```

## Run it locally

Just open `index.html` in your browser. Or, for a local server:

```
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Swapping in a real game

`js/game.js` exposes a small API that the website uses:

- `Game.init(canvas, { onScore, onGameOver })`
- `Game.start()`
- `Game.togglePause()`
- `Game.isRunning()`

Keep those functions and replace the game logic inside (`reset`, `update`, `draw`). The rest of the site won't need to change.

## Publish it (free) with GitHub Pages

1. Go to the repo's **Settings → Pages**.
2. Under "Build and deployment", choose **Deploy from a branch**, pick the branch and `/ (root)`.
3. After a minute the site will be live at `https://<username>.github.io/<repo-name>/`.
