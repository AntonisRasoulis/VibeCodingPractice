// Website glue: connects the page (buttons, win counters) to the game.

const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const overlay = document.getElementById("game-overlay");
const message = document.getElementById("game-message");
const canvas = document.getElementById("game-canvas");
const gameWrapper = document.querySelector(".game-wrapper");
const fullscreenButton = document.getElementById("fullscreen-button");
const scoreLine = document.getElementById("score-line");
const wins = { RED: 0, BLUE: 0 };
let gameLoaded = false;

document.getElementById("year").textContent = new Date().getFullYear();

const gameCallbacks = {
  onGameOver(winner) {
    if (winner) {
      wins[winner]++;
      document.getElementById(winner === "RED" ? "red-wins" : "blue-wins").textContent = wins[winner];
      message.textContent = `${winner === "RED" ? "Red" : "Blue"} wins!`;
      message.className = "game-message " + winner.toLowerCase();
    } else {
      message.textContent = "It's a draw!";
      message.className = "game-message";
    }
    // The win counters are hidden in fullscreen, so show the score on the game-over screen too
    scoreLine.innerHTML = `<span class="red">Red ${wins.RED}</span> &middot; <span class="blue">Blue ${wins.BLUE}</span>`;
    scoreLine.hidden = false;
    startButton.textContent = "Play again";
    overlay.classList.remove("hidden");
    pauseButton.disabled = true;
    startButton.focus();
  },
  onPauseChange(paused) {
    pauseButton.textContent = paused ? "Resume" : "Pause";
  },
};

// If the game's files are missing or broken, say so instead of leaving a dead Start button.
// (The button starts out disabled in index.html and is only switched on here.)
try {
  Game.init(canvas, gameCallbacks);
  gameLoaded = true;
  startButton.disabled = false;
} catch (error) {
  const box = document.getElementById("game-error");
  box.textContent = "The game couldn't load. Make sure the whole folder was downloaded and unzipped, " +
    `then open index.html again. (Details: ${error.message})`;
  box.hidden = false;
}

function startGame() {
  overlay.classList.add("hidden");
  pauseButton.disabled = false;
  pauseButton.textContent = "Pause";
  startButton.blur();
  canvas.scrollIntoView({ behavior: "smooth", block: "center" });
  Game.start();
}

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", () => {
  Game.togglePause();
  pauseButton.blur(); // so the space bar / Enter don't press it again
});

window.addEventListener("keydown", (e) => {
  if (gameLoaded && (e.code === "KeyP" || e.code === "Escape") && Game.isRunning()) Game.togglePause();
  if (e.code === "KeyF" && document.fullscreenEnabled) toggleFullscreen();
});

// ---- Fullscreen ----

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    gameWrapper.requestFullscreen().catch(() => {}); // e.g. blocked by the browser
  }
}

if (document.fullscreenEnabled) {
  fullscreenButton.hidden = false;
  fullscreenButton.addEventListener("click", () => {
    toggleFullscreen();
    fullscreenButton.blur(); // so the space bar / Enter don't press it again
  });
  document.addEventListener("fullscreenchange", () => {
    const isFullscreen = document.fullscreenElement === gameWrapper;
    fullscreenButton.textContent = isFullscreen ? "Exit fullscreen" : "Fullscreen";
    // Leaving fullscreen with Esc mid-race pauses the game, so nobody gets caught by surprise
    if (!isFullscreen && gameLoaded && Game.isRunning() && Game.world.state === "playing") Game.togglePause();
  });
}
