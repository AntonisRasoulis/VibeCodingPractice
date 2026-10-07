// Website glue: connects the page (buttons, score display) to the game.

const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const overlay = document.getElementById("game-overlay");
const message = document.getElementById("game-message");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");

document.getElementById("year").textContent = new Date().getFullYear();

function loadBestScore() {
  try {
    return Number(localStorage.getItem("bestScore")) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem("bestScore", value);
  } catch {
    // Storage unavailable (e.g. private mode) — best score just won't persist
  }
}

let bestScore = loadBestScore();
bestScoreEl.textContent = bestScore;

Game.init(document.getElementById("game-canvas"), {
  onScore(score) {
    scoreEl.textContent = score;
  },
  onGameOver(score) {
    if (score > bestScore) {
      bestScore = score;
      bestScoreEl.textContent = bestScore;
      saveBestScore(bestScore);
    }
    message.textContent = `Game over! You scored ${score}.`;
    startButton.textContent = "Play again";
    overlay.classList.remove("hidden");
    pauseButton.disabled = true;
  },
});

function startGame() {
  overlay.classList.add("hidden");
  pauseButton.disabled = false;
  pauseButton.textContent = "Pause";
  Game.start();
}

function togglePause() {
  const paused = Game.togglePause();
  pauseButton.textContent = paused ? "Resume" : "Pause";
}

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);

window.addEventListener("keydown", (e) => {
  if (e.key === "p" && Game.isRunning()) togglePause();
});
