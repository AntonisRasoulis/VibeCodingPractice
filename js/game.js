// Demo game: catch the falling squares.
//
// This is a placeholder. Replace the contents of reset(), update() and draw()
// with your real game — the website (main.js) only uses the Game API below:
//   Game.init(canvas, callbacks), Game.start(), Game.togglePause()

const Game = (() => {
  let canvas, ctx, callbacks;
  let running = false;
  let paused = false;
  let lastTime = 0;

  const keys = {};

  // Game state
  let player, items, score, lives, spawnTimer;

  function reset() {
    player = { x: canvas.width / 2 - 40, y: canvas.height - 30, w: 80, h: 14, speed: 420 };
    items = [];
    score = 0;
    lives = 3;
    spawnTimer = 0;
    callbacks.onScore(score);
  }

  function update(dt) {
    // Move player
    if (keys.ArrowLeft || keys.a) player.x -= player.speed * dt;
    if (keys.ArrowRight || keys.d) player.x += player.speed * dt;
    player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));

    // Spawn falling items, faster as score grows
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      items.push({ x: Math.random() * (canvas.width - 20), y: -20, size: 20, speed: 120 + score * 4 });
      spawnTimer = Math.max(0.35, 1 - score * 0.02);
    }

    // Move items and check collisions
    for (const item of items) {
      item.y += item.speed * dt;

      const caught =
        item.y + item.size >= player.y &&
        item.y <= player.y + player.h &&
        item.x + item.size >= player.x &&
        item.x <= player.x + player.w;

      if (caught) {
        item.done = true;
        score++;
        callbacks.onScore(score);
      } else if (item.y > canvas.height) {
        item.done = true;
        lives--;
      }
    }
    items = items.filter((item) => !item.done);

    if (lives <= 0) {
      running = false;
      callbacks.onGameOver(score);
    }
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(player.x, player.y, player.w, player.h);

    ctx.fillStyle = "#4fd1c5";
    for (const item of items) {
      ctx.fillRect(item.x, item.y, item.size, item.size);
    }

    ctx.fillStyle = "#fff";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("Lives: " + "♥".repeat(lives), 10, 22);
  }

  function loop(time) {
    if (!running) return;
    // Cap dt so switching tabs doesn't teleport everything
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    if (!paused) {
      update(dt);
      draw();
    }
    requestAnimationFrame(loop);
  }

  return {
    init(canvasElement, cb) {
      canvas = canvasElement;
      ctx = canvas.getContext("2d");
      callbacks = cb;

      window.addEventListener("keydown", (e) => {
        keys[e.key] = true;
        if (running && e.key.startsWith("Arrow")) e.preventDefault();
      });
      window.addEventListener("keyup", (e) => {
        keys[e.key] = false;
      });

      reset();
      draw();
    },

    start() {
      reset();
      running = true;
      paused = false;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    },

    togglePause() {
      if (!running) return paused;
      paused = !paused;
      return paused;
    },

    isRunning() {
      return running;
    },
  };
})();
