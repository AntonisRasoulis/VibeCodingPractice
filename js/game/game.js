// The game itself: sets up a race, runs the game loop, reads the keyboard,
// moves the fire and decides who wins. The website (main.js) only uses:
//   Game.init(canvas, { onGameOver, onPauseChange })
//   Game.start(), Game.togglePause(), Game.isRunning()

const Game = (() => {
  const STEP = 1 / 120; // physics runs in small fixed steps so it's the same on every computer
  const CONTROLS = [
    { left: "KeyA", right: "KeyD", jump: "KeyW" },
    { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp" },
  ];
  const GAME_KEYS = new Set(CONTROLS.flatMap((c) => Object.values(c)));
  // Everything that makes up "where a player is" gets swapped by a swap orb
  const SWAP_FIELDS = ["x", "y", "vx", "vy", "facing", "onGround", "standingOn", "coyote",
    "portalCooldown", "safeSpots", "fallState"];

  let canvas, ctx, callbacks;
  let world;
  let lastTime = 0;
  let accumulator = 0;
  const keys = new Set();
  const jumpQueued = [false, false];

  function newWorld() {
    const level = new Level(Math.floor(Math.random() * 1e9));
    level.ensure(VIEW_W * 2);
    const startX = 4 * TILE;
    const startY = level.groundRow * TILE - HITBOX_H;
    world = {
      level,
      players: [
        new Player("RED", PALETTES.red, startX, startY),
        new Player("BLUE", PALETTES.blue, startX, startY),
      ],
      fire: { x: -FIRE.startOffset, speed: FIRE.startSpeed },
      state: "menu", // menu, countdown, playing, paused, ending, over
      countdown: 3,
      endTimer: 0,
      time: 0,
      swapFlash: 0,
      winner: null,
    };
    for (const p of world.players) p.onGround = true;
    Renderer.resetCameras(startX);
  }

  function readInput(i) {
    const c = CONTROLS[i];
    const input = {
      left: keys.has(c.left),
      right: keys.has(c.right),
      jump: keys.has(c.jump),
      jumpPressed: jumpQueued[i],
    };
    jumpQueued[i] = false;
    return input;
  }

  const NO_INPUT = { left: false, right: false, jump: false, jumpPressed: false };

  function step(dt) {
    if (world.swapFlash > 0) world.swapFlash -= dt * 2;

    if (world.state === "countdown") {
      world.countdown -= dt;
      if (world.countdown <= 0) world.state = "playing";
      jumpQueued[0] = jumpQueued[1] = false;
      return;
    }

    world.time += dt;
    const { fire, level, players } = world;
    fire.speed = FIRE.startSpeed + FIRE.speedGain * world.time;
    fire.x += fire.speed * dt;

    level.ensure(Math.max(players[0].x, players[1].x) + VIEW_W * 2);
    level.update(world.time);

    if (world.state === "ending") {
      for (const p of players) p.update(dt, NO_INPUT, level);
      world.endTimer -= dt;
      if (world.endTimer <= 0) {
        world.state = "over";
        callbacks.onGameOver(world.winner);
      }
      return;
    }

    players.forEach((p, i) => p.update(dt, readInput(i), level));
    checkOrbs();
    checkFire();
  }

  function checkOrbs() {
    const [a, b] = world.players;
    for (const orb of world.level.orbs) {
      if (orb.used) continue;
      for (const p of world.players) {
        const other = p === a ? b : a;
        if (p.dead || other.dead) continue;
        if (overlaps(p.x, p.y, HITBOX_W, HITBOX_H, orb.x, orb.y, orb.w, orb.h)) {
          orb.used = true;
          for (const f of SWAP_FIELDS) [a[f], b[f]] = [b[f], a[f]];
          Renderer.swapCameras();
          world.swapFlash = 1;
          a.sparkle("#ffd23f");
          b.sparkle("#ffd23f");
          return;
        }
      }
    }
  }

  function checkFire() {
    const caught = world.players.filter((p) => world.fire.x >= p.trackX + 2);
    if (caught.length === 0) return;

    for (const p of caught) p.burnUp();
    world.winner = caught.length === 2 ? null : world.players.find((p) => !p.caught).name;
    world.state = "ending";
    world.endTimer = 1.5;
  }

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (["countdown", "playing", "ending"].includes(world.state)) {
      accumulator += dt;
      while (accumulator >= STEP) {
        step(STEP);
        accumulator -= STEP;
      }
    }
    Renderer.render(ctx, world, dt);
    requestAnimationFrame(frame);
  }

  function setPaused(paused) {
    if (paused && world.state === "playing") world.state = "paused";
    else if (!paused && world.state === "paused") world.state = "playing";
    else return;
    callbacks.onPauseChange(world.state === "paused");
  }

  return {
    init(canvasElement, cb) {
      canvas = canvasElement;
      canvas.width = VIEW_W * SCALE;
      canvas.height = (VIEW_H * 2 + DIVIDER) * SCALE;
      ctx = canvas.getContext("2d");
      callbacks = cb;
      Renderer.init();
      newWorld();

      // Load the pixel font so the canvas can use it
      if (document.fonts) document.fonts.load('12px "Press Start 2P"').catch(() => {});

      window.addEventListener("keydown", (e) => {
        if (GAME_KEYS.has(e.code) && this.isRunning()) e.preventDefault(); // stop arrows scrolling the page
        if (!e.repeat) {
          CONTROLS.forEach((c, i) => {
            if (e.code === c.jump) jumpQueued[i] = true;
          });
        }
        keys.add(e.code);
      });
      window.addEventListener("keyup", (e) => keys.delete(e.code));
      window.addEventListener("blur", () => {
        keys.clear();
        setPaused(true);
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) setPaused(true);
      });

      lastTime = performance.now();
      requestAnimationFrame(frame);
    },

    start() {
      newWorld();
      world.state = "countdown";
      accumulator = 0;
    },

    togglePause() {
      setPaused(world.state !== "paused");
    },

    isRunning() {
      return ["countdown", "playing", "paused", "ending"].includes(world.state);
    },

    // Handy for poking at the game from the browser console: Game.world
    get world() {
      return world;
    },
  };
})();
