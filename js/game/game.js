// The game itself: sets up a race, runs the game loop, reads the keyboard,
// moves the fire and decides who wins. The website (main.js) only uses:
//   Game.init(canvas, { onGameOver, onPauseChange })
//   Game.start(), Game.togglePause(), Game.isRunning()

const Game = (() => {
  const STEP = 1 / 120; // physics runs in small fixed steps so it's the same on every computer
  const CONTROLS = [
    { left: "KeyA", right: "KeyD", jump: "KeyW", fire: "KeyS" },
    { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp", fire: "ArrowDown" },
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
  const fireQueued = [false, false];
  let nextBoltId = 1;

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
      bolts: [], // lightning bolts flying along the course
      hands: [], // mystic hands flying, grabbing or swatting
      missiles: [], // missiles zooming in, locking on, flying or exploding
      nextMissile: null, // the leader's distance (meters) when the next missile comes (set once someone passes 300m)
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
      firePressed: fireQueued[i],
    };
    jumpQueued[i] = false;
    fireQueued[i] = false;
    return input;
  }

  const NO_INPUT = { left: false, right: false, jump: false, jumpPressed: false };

  function step(dt) {
    if (world.swapFlash > 0) world.swapFlash -= dt * 2;

    if (world.state === "countdown") {
      const before = Math.ceil(world.countdown);
      world.countdown -= dt;
      if (world.countdown <= 0) {
        world.state = "playing";
        Sound.play("go");
      } else if (Math.ceil(world.countdown) < before) Sound.play("beep");
      jumpQueued[0] = jumpQueued[1] = false;
      fireQueued[0] = fireQueued[1] = false;
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

    const inputs = [readInput(0), readInput(1)];
    players.forEach((p, i) => p.update(dt, inputs[i], level));
    players.forEach((p, i) => { if (inputs[i].firePressed) usePower(p, i); });
    updateBolts(dt);
    updateHands(dt);
    updateMissiles(dt);
    checkOrbs();
    levelSounds();
    checkFire();
  }

  // Shooters firing and maces swooshing past, if a player is close enough to hear them
  function levelSounds() {
    const { level, players } = world;
    const near = (x) => players.some((p) => !p.dead && !p.caught && Math.abs(x - p.x) < VIEW_W * 0.6);
    for (const s of level.shooters) {
      if (!near(s.x)) continue;
      const volley = Math.floor(level.time / s.period - s.phase);
      if (s.lastVolley !== undefined && volley !== s.lastVolley) Sound.play("shooterFire");
      s.lastVolley = volley;
    }
    for (const m of level.maces) {
      if (!near(m.x)) continue;
      const half = Math.floor(2 * (level.time / m.period + m.phase)); // changes as it swings through the bottom
      if (m.lastHalf !== undefined && half !== m.lastHalf) Sound.play("maceSwoosh");
      m.lastHalf = half;
    }
  }

  // The fire roars louder the closer it gets to whoever is nearest to it
  function fireLoudness() {
    if (world.state !== "playing") return 0;
    const runners = world.players.filter((p) => !p.caught);
    if (!runners.length) return 0;
    const gap = Math.min(...runners.map((p) => (p.trackX - world.fire.x) / TILE));
    return 0.12 + 0.88 * clamp(1 - gap / 40, 0, 1);
  }

  function checkOrbs() {
    const [a, b] = world.players;
    for (const orb of world.level.orbs) {
      if (orb.used) continue;
      for (const p of world.players) {
        const other = p === a ? b : a;
        if (p.dead || (orb.kind === "swap" && other.dead)) continue;
        if (overlaps(p.x, p.y, HITBOX_W, HITBOX_H, orb.x, orb.y, orb.w, orb.h)) {
          orb.used = true;
          if (orb.kind === "zap" || orb.kind === "hand" || orb.kind === "wind") {
            p.power = orb.kind; // holding one power at a time: the newest replaces the old
            p.sparkle({ zap: "#bff4ff", hand: "#c9a3ff", wind: "#ffffff" }[orb.kind]);
            Sound.play({ zap: "gotZap", hand: "gotHand", wind: "gotWind" }[orb.kind]);
            return;
          }
          if (orb.kind === "dash") {
            p.dashHold = DASH.hold;
            Sound.play("dashCharge");
            p.x = orb.x + 1;
            p.y = orb.y + 4 - HITBOX_H / 2;
            p.vx = 0;
            p.vy = 0;
            p.jumpBuffer = 0;
            return;
          }
          if (orb.kind === "freeze") {
            p.frozen = FREEZE_TIME;
            p.vx = 0;
            p.sparkle("#a6e1ff");
            Sound.play("freeze");
            return;
          }
          for (const f of SWAP_FIELDS) [a[f], b[f]] = [b[f], a[f]];
          Renderer.swapCameras();
          world.swapFlash = 1;
          Sound.play("swap");
          a.sparkle("#ffd23f");
          b.sparkle("#ffd23f");
          return;
        }
      }
    }
  }

  // ---- Lightning bolts ----

  // S (Red) or Down (Blue): use whatever power you're holding
  function usePower(p, owner) {
    if (!p.power || p.dead || p.caught || p.held || p.frozen > 0 || p.dashHold > 0) return;
    if (p.power === "wind" && p.stun > 0) return; // can't dash out of a hand's throw
    if (p.power === "zap") fireBolt(p, owner);
    else if (p.power === "hand") throwHand(p, owner);
    else if (p.power === "wind") p.windDash();
    p.power = null;
  }

  function fireBolt(p, owner) {
    const dir = p.facing; // fires whichever way you're facing right now
    const ground = world.level.groundTop(p.x + HITBOX_W / 2);
    world.bolts.push({
      id: nextBoltId++,
      owner,
      dir,
      x: dir > 0 ? p.x + HITBOX_W : p.x, // the bolt's head
      y: (ground ?? p.y + HITBOX_H) - ZAP.height,
      traveled: 0,
      born: world.time,
    });
    p.flash = 0.35;
    p.sparkle("#ffffff");
    p.sparkle("#bff4ff");
    Sound.play("zapFire");
  }

  function updateBolts(dt) {
    const { level, players } = world;
    for (const bolt of world.bolts) {
      const move = ZAP.speed * dt;
      bolt.x += bolt.dir * move;
      bolt.traveled += move;
      // Hug the ground: climb steps and drop down them, glide straight over pits
      const ground = level.groundTop(bolt.x);
      if (ground !== null) bolt.y += (ground - ZAP.height - bolt.y) * Math.min(1, dt * 40);

      // Only the other player can be hit, and only if they're touching the bolt
      const target = players[1 - bolt.owner];
      if (target.dead || target.caught) continue;
      const tail = bolt.x - bolt.dir * ZAP.length;
      const left = Math.min(tail, bolt.x);
      if (target.x + HITBOX_W < left || target.x > left + ZAP.length) continue;
      const groundThere = level.groundTop(target.x + HITBOX_W / 2);
      const boltY = groundThere === null ? bolt.y : groundThere - ZAP.height;
      if (overlaps(target.x, target.y, HITBOX_W, HITBOX_H, left, boltY - 1, ZAP.length, 3)) {
        target.zap();
        bolt.done = true;
      }
    }
    world.bolts = world.bolts.filter((b) => !b.done && b.traveled < ZAP.range);
  }

  // ---- Mystic hands ----

  function throwHand(p, owner) {
    const dir = p.facing;
    world.hands.push({
      owner,
      dir,
      x: p.x + HITBOX_W / 2 + dir * 6, // centre of the hand
      y: p.y + HITBOX_H / 2,           // flies straight at the height it was thrown from
      traveled: 0,
      state: "fly",                    // fly, then grab or swat if it catches someone, then fade
      t: 0,
    });
    p.sparkle("#c9a3ff");
    Sound.play("handThrow");
  }

  // Does a runner standing at (x, y) overlap the ground?
  function bodyInWall(x, y) {
    const lv = world.level;
    return lv.isSolid(Math.floor(x / TILE), Math.floor(y / TILE)) ||
      lv.isSolid(Math.floor((x + HITBOX_W - 0.01) / TILE), Math.floor(y / TILE)) ||
      lv.isSolid(Math.floor(x / TILE), Math.floor((y + HITBOX_H - 0.01) / TILE)) ||
      lv.isSolid(Math.floor((x + HITBOX_W - 0.01) / TILE), Math.floor((y + HITBOX_H - 0.01) / TILE));
  }

  // Let go of a caught player and fling them backwards (always to the left)
  function throwPlayer(target) {
    target.held = false;
    target.spin = 0;
    target.vx = -HAND.throwX;
    target.vy = -HAND.throwUp;
    target.onGround = false;
    target.standingOn = null;
    target.stun = HAND.stun;
  }

  function updateHands(dt) {
    const { level, players } = world;
    for (const h of world.hands) {
      h.t += dt;
      const target = players[1 - h.owner];

      if (h.state === "fly") {
        const move = HAND.speed * dt;
        h.x += h.dir * move;
        h.traveled += move;
        if (h.traveled >= HAND.range || level.isSolid(Math.floor(h.x / TILE), Math.floor(h.y / TILE))) {
          h.state = "fade";
          h.t = 0;
          continue;
        }
        const half = HAND.size / 2;
        if (!target.dead && !target.caught && !target.held &&
            overlaps(target.x, target.y, HITBOX_W, HITBOX_H, h.x - half, h.y - half, HAND.size, HAND.size)) {
          // Caught! Facing right it's a grab-and-suplex, facing left it's a backhand
          h.state = h.dir > 0 ? "grab" : "swat";
          h.t = 0;
          h.tx = target.x;
          h.ty = target.y;
          target.held = true;
          target.vx = target.vy = 0;
          target.dashHold = target.dashTime = target.windTime = 0;
          target.standingOn = null;
          target.flash = 0.3;
          target.showHit(h.dir > 0 ? "GRABBED!" : "SMACKED!", "#c9a3ff");
          Sound.play(h.dir > 0 ? "grab" : "windUp");
        }
      } else if (h.state === "grab") {
        // The fist closes, then swings them up and back over the top, like a suplex
        const close = 0.1;
        if (h.t > close) {
          const a = Math.min(1, (h.t - close) / (HAND.grabTime - close)) * Math.PI;
          const r = HAND.suplexRadius;
          const nx = h.tx - r + r * Math.cos(a);
          const ny = h.ty - r * Math.sin(a);
          if (!bodyInWall(nx, ny)) {
            target.x = nx;
            target.y = ny;
          }
          target.spin = -a;
          h.angle = -a;
        }
        if (h.t >= HAND.grabTime) {
          throwPlayer(target);
          target.sparkle("#c9a3ff");
          Sound.play("slam");
          h.state = "fade";
          h.t = 0;
        }
      } else if (h.state === "swat") {
        if (h.t >= HAND.swatTime) {
          throwPlayer(target);
          Sound.play("smack");
          target.sparkle("#ffffff");
          target.sparkle("#ffd23f");
          h.smackX = target.x + HITBOX_W / 2;
          h.smackY = target.y + HITBOX_H / 2;
          h.state = "fade";
          h.swatted = true;
          h.t = 0;
        }
      } else if (h.t > 0.3) {
        h.done = true;
      }
    }
    // If the caught player dies or is caught by the fire, let the hand go
    for (const h of world.hands) {
      if ((h.state === "grab" || h.state === "swat") && !players[1 - h.owner].held) { h.state = "fade"; h.t = 0; }
    }
    world.hands = world.hands.filter((h) => !h.done);
  }

  // ---- Missiles ----
  //
  // After 300m, a missile comes every so often (randomly). It zooms in from far
  // away in the background on the left or right of a player, locks on to the
  // closest player for a moment, then fires in a straight line. The black one
  // aims where you are; the red-striped one (after 400m) aims where you'll be.

  const rand = (a, b) => a + Math.random() * (b - a);

  function spawnMissile() {
    const { players } = world;
    const alive = players.filter((p) => !p.dead && !p.caught);
    if (!alive.length) return;
    const near = alive[Math.floor(Math.random() * alive.length)];
    const leaderMeters = Math.max(...players.map((p) => p.x)) / TILE;
    const striped = leaderMeters > MISSILE.stripedAt && Math.random() < 0.5;
    const side = Math.random() < 0.5 ? -1 : 1; // comes in on the left or the right of the player
    world.missiles.push(makeMissile(near, striped, side));
    Sound.play("glint");
    Sound.play("incoming");
  }

  // While it zooms in, a missile is positioned relative to the player it came for,
  // so the whole entrance stays on their screen even while they run. It starts small
  // near the middle of their sky (far away) and grows out to where it arrives.
  // The player sits 35% across their view, so the view runs from 140px behind them
  // to 260px ahead; every point here stays well inside that.
  function makeMissile(near, striped, side) {
    const ox = side < 0 ? -rand(75, 110) : rand(90, 195); // arrival spot, left or right of the player
    const oy = rand(12, 24);                              // high in the sky: 60-75px above a runner on the ground
    const centre = VIEW_W * 0.5 - VIEW_W * 0.35;            // middle of their screen, relative to them
    return {
      striped,
      side,
      state: "approach",
      t: 0,
      anchor: near,
      ox, oy,
      sx: centre + (ox - centre) * 0.25,                   // start: far away, near the middle of the sky
      sy: Math.max(12, oy - 6),                           // (below the distance counters at the top)
      x: near.x + ox, y: oy,
      scale: 0.15,
      angle: 0,
      trail: [],
      smoke: [],     // smoke left behind while it zooms in (kept relative to the player, like the missile)
    };
  }

  function missileAim(m, target) {
    const tx = target.x + HITBOX_W / 2;
    const ty = target.y + HITBOX_H / 2;
    if (!m.striped) return { x: tx, y: ty };
    // Lead the target: where will they be by the time the missile gets there?
    let px = tx, py = ty;
    for (let i = 0; i < 3; i++) {
      const time = Math.hypot(px - m.x, py - m.y) / MISSILE.speed;
      px = tx + target.vx * time;
      py = ty + (target.onGround ? 0 : target.vy * time);
    }
    return { x: px, y: Math.min(py, VIEW_H) };
  }

  function explodeMissile(m) {
    m.state = "boom";
    m.t = 0;
    Sound.play("boom");
  }

  function updateMissiles(dt) {
    const { players, level } = world;
    // Once anyone passes 300m, a missile comes about every 200m the leader runs
    const leaderMeters = Math.max(...players.map((p) => p.x)) / TILE;
    if (leaderMeters > MISSILE.startAt) {
      if (world.nextMissile === null) world.nextMissile = leaderMeters + rand(20, MISSILE.every[1]);
      if (leaderMeters >= world.nextMissile) {
        spawnMissile();
        world.nextMissile = leaderMeters + rand(MISSILE.every[0], MISSILE.every[1]);
      }
    }

    for (const m of world.missiles) {
      m.t += dt;
      if (m.state === "approach") {
        const e = Math.min(1, m.t / MISSILE.approach) ** 2; // slow at first, rushing in at the end
        m.x = m.anchor.x + m.sx + (m.ox - m.sx) * e;
        m.y = m.sy + (m.oy - m.sy) * e;
        m.scale = 0.15 + 0.85 * e;
        m.angle = Math.atan2(m.oy - m.sy, m.ox - m.sx);
        // drop a puff of smoke every few frames; it's thicker the closer (bigger) the missile is
        if ((m.smokeTimer = (m.smokeTimer || 0) + dt) > 0.025) {
          m.smokeTimer = 0;
          m.smoke.push({ rx: m.x - m.anchor.x, y: m.y, s: m.scale, t: world.time });
        }
        if (m.t >= MISSILE.approach) {
          m.smokeAnchorX = m.anchor.x; // from here the trail stays put in the world
          m.state = "lock";
          m.t = 0;
          Sound.play("lockOn");
          // Lock on to whoever is closest right now
          const alive = players.filter((p) => !p.dead && !p.caught);
          if (!alive.length) { m.done = true; continue; }
          m.target = alive.reduce((best, p) =>
            Math.hypot(p.x - m.x, p.y - m.y) < Math.hypot(best.x - m.x, best.y - m.y) ? p : best);
        }
      } else if (m.state === "lock") {
        m.aim = missileAim(m, m.target);
        m.angle = Math.atan2(m.aim.y - m.y, m.aim.x - m.x);
        if (m.t >= MISSILE.lock) {
          // Fire! From here on it flies in a straight line and never turns
          m.state = "fly";
          m.t = 0;
          Sound.play("launch");
          m.vx = Math.cos(m.angle) * MISSILE.speed;
          m.vy = Math.sin(m.angle) * MISSILE.speed;
          m.traveled = 0;
        }
      } else if (m.state === "fly") {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.traveled += MISSILE.speed * dt;
        m.trail.push({ x: m.x, y: m.y, t: world.time });
        if (m.trail.length > 14) m.trail.shift();
        // the nose is a few pixels ahead of the middle
        const nx = m.x + Math.cos(m.angle) * 8;
        const ny = m.y + Math.sin(m.angle) * 8;
        if (level.isSolid(Math.floor(nx / TILE), Math.floor(ny / TILE))) explodeMissile(m);
        else if (players.some((p) => !p.dead && !p.caught && overlaps(p.x, p.y, HITBOX_W, HITBOX_H, nx - 2, ny - 2, 4, 4))) explodeMissile(m);
        else if (m.traveled > MISSILE.range || ny > VIEW_H + 20) m.done = true;
        if (m.state === "boom") { m.x = nx; m.y = ny; }
      } else if (m.state === "boom") {
        // The blast can catch anyone close by, for a moment
        if (m.t < MISSILE.lethalTime) {
          for (const p of players) {
            if (p.dead || p.caught) continue;
            const cx = clamp(m.x, p.x, p.x + HITBOX_W);
            const cy = clamp(m.y, p.y, p.y + HITBOX_H);
            if ((m.x - cx) ** 2 + (m.y - cy) ** 2 < MISSILE.blast ** 2) {
              p.showHit("BOOM!", "#f77f00");
              p.die();
            }
          }
        }
        if (m.t >= MISSILE.blastTime) m.done = true;
      }
    }
    world.missiles = world.missiles.filter((m) => !m.done);
  }

  function checkFire() {
    const caught = world.players.filter((p) => world.fire.x >= p.trackX + 2);
    if (caught.length === 0) return;

    for (const p of caught) p.burnUp();
    world.winner = caught.length === 2 ? null : world.players.find((p) => !p.caught).name;
    Sound.play(world.winner ? "win" : "draw");
    world.state = "ending";
    world.endTimer = 1.5;
  }

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    const isActive = () => ["countdown", "playing", "ending"].includes(world.state);
    if (isActive()) {
      accumulator += dt;
      // Stop as soon as the round is over, so leftover steps can't restart the ending
      while (accumulator >= STEP && isActive()) {
        step(STEP);
        accumulator -= STEP;
      }
    }
    if (!isActive()) accumulator = 0;
    Sound.setFire(fireLoudness(), dt);
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
            if (e.code === c.fire) fireQueued[i] = true;
          });
        }
        keys.add(e.code);
        if (GAME_KEYS.has(e.code)) Sound.unlock();
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
      Sound.unlock(); // the Start click lets the browser play sound
      newWorld();
      world.state = "countdown";
      Sound.play("beep");
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
