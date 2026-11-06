// Website glue: connects the page (buttons, win counters) to the game.

const startButton = document.getElementById("start-button");
const soloButton = document.getElementById("solo-button");
const pauseButton = document.getElementById("pause-button");
const overlay = document.getElementById("game-overlay");
const message = document.getElementById("game-message");
const canvas = document.getElementById("game-canvas");
const gameWrapper = document.querySelector(".game-wrapper");
const fullscreenButton = document.getElementById("fullscreen-button");
const scoreLine = document.getElementById("score-line");
const soundButton = document.getElementById("sound-button");
const wins = { RED: 0, BLUE: 0 };
let gameLoaded = false;
let lastMode = 2;
let biomes = false; // snow, desert and jungle biomes: off until you turn them on (remembered by the browser)
try { biomes = localStorage.getItem("fire-run-biomes") === "1"; } catch (e) { /* storage blocked */ }
let biomeList = BIOMES.slice(); // ...and which ones you get with them on (picked with the arrow next to the button)
// (read further down, once the secret biomes are known: at least one of all of them has to be on)
try {
  const saved = JSON.parse(localStorage.getItem("fire-run-biome-list"));
  const known = Array.isArray(saved) ? saved.filter((b) => BIOMES.includes(b)) : [];
  if (Array.isArray(saved)) biomeList = known; // (it can be empty now, if a secret biome is on)
} catch (e) { /* storage blocked, or nothing saved */ }
// The secret biomes (reached in special ways, like the enchanted forest through a sleep mushroom): which are on.
// Turn every regular biome off and the race is in the secret ones instead.
let secretList = SECRET_BIOMES.slice();
try {
  const saved = JSON.parse(localStorage.getItem("fire-run-secret-list"));
  if (Array.isArray(saved)) secretList = saved.filter((b) => SECRET_BIOMES.includes(b));
} catch (e) { /* storage blocked, or nothing saved */ }
if (!biomeList.length && !secretList.length) biomeList = BIOMES.slice();
let wild = false; // Wild mode (the hard one): off until you pick it (remembered by the browser)
try { wild = localStorage.getItem("fire-run-mode") === "wild"; } catch (e) { /* storage blocked */ }
// best distance in 1-player mode, one for each mode (remembered by the browser)
const bestKey = () => (wild ? "fire-run-best-wild" : "fire-run-best");
let best = 0;
function loadBest() {
  best = 0;
  try { best = Number(localStorage.getItem(bestKey())) || 0; } catch (e) { /* storage blocked */ }
}
loadBest();

document.getElementById("year").textContent = new Date().getFullYear();
document.getElementById("game-version").textContent = "v" + GAME_VERSION; // (set in config.js)

const gameCallbacks = {
  onGameOver(winner) {
    if (winner && winner.solo) {
      // 1 player: how far did you get?
      const record = winner.meters > best;
      if (record) {
        best = winner.meters;
        try { localStorage.setItem(bestKey(), String(best)); } catch (e) { /* storage blocked */ }
      }
      message.textContent = record ? `New record: ${winner.meters} m!` : `You reached ${winner.meters} m`;
      message.className = "game-message red";
      scoreLine.textContent = `Best${wild ? " (Wild)" : ""}: ${best} m`;
      scoreLine.hidden = false;
      showOverlay();
      return;
    }
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
    showOverlay();
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
  soloButton.disabled = false;
} catch (error) {
  const box = document.getElementById("game-error");
  box.textContent = "The game couldn't load. Make sure the whole folder was downloaded and unzipped, " +
    `then open index.html again. (Details: ${error.message})`;
  box.hidden = false;
}

function showOverlay() {
  startButton.textContent = lastMode === 2 ? "Play again" : "2 Players";
  soloButton.textContent = lastMode === 1 ? "Play again (1 Player)" : "1 Player";
  overlay.classList.remove("hidden");
  pauseButton.disabled = true;
  (lastMode === 1 ? soloButton : startButton).focus();
}

function startGame(players) {
  lastMode = players;
  overlay.classList.add("hidden");
  pauseButton.disabled = false;
  pauseButton.textContent = "Pause";
  startButton.blur();
  soloButton.blur();
  canvas.scrollIntoView({ behavior: "smooth", block: "center" });
  Game.start(players, { biomes, biomeList, secretList, wild });
}

startButton.addEventListener("click", () => startGame(2));

const biomesButton = document.getElementById("biomes-button");
const biomeArrow = document.getElementById("biome-arrow");
const biomePanel = document.getElementById("biome-panel");
function showBiomes() {
  biomesButton.textContent = `Biomes: ${biomes ? "on" : "off"}`;
  biomesButton.setAttribute("aria-pressed", String(biomes));
  biomeArrow.hidden = !biomes; // the arrow to pick which biomes is only there with them on
  if (!biomes) openBiomePanel(false);
  const total = biomeList.length + secretList.length;
  for (const chip of biomePanel.querySelectorAll(".biome-choice")) {
    const on = (chip.dataset.secret ? secretList : biomeList).includes(chip.dataset.biome);
    chip.setAttribute("aria-pressed", String(on));
    if (!chip.dataset.secret) chip.title = on && total === 1 ? "At least one biome has to be on" : "";
  }
}
function openBiomePanel(open) {
  biomePanel.hidden = !open;
  biomeArrow.setAttribute("aria-expanded", String(open));
}
biomesButton.addEventListener("click", () => {
  biomes = !biomes;
  try { localStorage.setItem("fire-run-biomes", biomes ? "1" : "0"); } catch (e) { /* storage blocked */ }
  showBiomes();
});
biomeArrow.addEventListener("click", () => openBiomePanel(biomePanel.hidden));
biomePanel.addEventListener("click", (e) => {
  const chip = e.target.closest(".biome-choice");
  if (!chip) return;
  const biome = chip.dataset.biome, secret = !!chip.dataset.secret;
  const list = secret ? secretList : biomeList, all = secret ? SECRET_BIOMES : BIOMES;
  let next;
  if (list.includes(biome)) {
    if (biomeList.length + secretList.length === 1) return; // always at least one (a secret one counts)
    next = list.filter((b) => b !== biome);
  } else next = all.filter((b) => b === biome || list.includes(b));
  if (secret) secretList = next; else biomeList = next;
  try {
    localStorage.setItem("fire-run-biome-list", JSON.stringify(biomeList));
    localStorage.setItem("fire-run-secret-list", JSON.stringify(secretList));
  } catch (e) { /* storage blocked */ }
  showBiomes();
});
// click anywhere else (or press Escape) to close it
document.addEventListener("click", (e) => { if (!biomePanel.hidden && !e.target.closest(".biome-picker")) openBiomePanel(false); });
document.addEventListener("keydown", (e) => { if (e.code === "Escape") openBiomePanel(false); });
showBiomes();

const modeButton = document.getElementById("mode-button");
function showMode() {
  modeButton.textContent = `Mode: ${wild ? "Wild" : "Normal"}`;
  modeButton.setAttribute("aria-pressed", String(wild));
  modeButton.classList.toggle("wild", wild);
}
modeButton.addEventListener("click", () => {
  wild = !wild;
  try { localStorage.setItem("fire-run-mode", wild ? "wild" : "normal"); } catch (e) { /* storage blocked */ }
  loadBest();
  showMode();
});
showMode();
soloButton.addEventListener("click", () => startGame(1));
pauseButton.addEventListener("click", () => {
  Game.togglePause();
  pauseButton.blur(); // so the space bar / Enter don't press it again
});

window.addEventListener("keydown", (e) => {
  if (gameLoaded && (e.code === "KeyP" || e.code === "Escape") && Game.isRunning()) Game.togglePause();
  if (gameLoaded && e.code === "KeyM") toggleSound();
  if (e.code === "KeyF" && document.fullscreenEnabled) toggleFullscreen();
});

// ---- Sound ----

function showSoundState() {
  soundButton.textContent = Sound.muted ? "Sound: off" : "Sound: on";
}

function toggleSound() {
  Sound.unlock();
  Sound.toggleMute();
  showSoundState();
}

showSoundState();
soundButton.addEventListener("click", () => {
  toggleSound();
  soundButton.blur(); // so the space bar / Enter don't press it again
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
