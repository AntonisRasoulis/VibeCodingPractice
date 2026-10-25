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
    "portalCooldown", "safeSpots", "fallState", "icicleState", "snowballs", "snowballStarted", "onIce", "biome",
    "inQuick", "sink", "quickSurface", "tumbleweeds", "tumbleStarted", "trapState", "trapped", "trapId", "lastWiggle", "wiggleHeld", "hiddenIn", "inSink", "sinkT", "sinkFrom", "inPond", "pondHits", "onPond"];

  let canvas, ctx, callbacks;
  let world;
  let lastTime = 0;
  let accumulator = 0;
  const keys = new Set();
  const jumpQueued = [false, false];
  const fireQueued = [false, false];
  let nextBoltId = 1;
  let racesStarted = 0; // the first race after opening the website always starts in the prairie
  let solo = false;     // 1-player mode: one runner, one big view, WASD or the arrow keys
  let biomes = false;   // snow and desert too? Off: the whole race is in the prairie

  function newWorld(startBiome = "prairie") {
    const level = new Level(Math.floor(Math.random() * 1e9), startBiome, { solo, biomes });
    level.ensure(VIEW_W * 2);
    const startX = 4 * TILE;
    const startY = level.groundRow * TILE - HITBOX_H;
    world = {
      level,
      players: solo
        ? [new Player("RED", PALETTES.red, startX, startY)]
        : [new Player("RED", PALETTES.red, startX, startY), new Player("BLUE", PALETTES.blue, startX, startY)],
      solo,
      fire: { x: -FIRE.startOffset, speed: FIRE.startSpeed },
      state: "menu", // menu, countdown, playing, paused, ending, over
      countdown: 3,
      endTimer: 0,
      time: 0,
      swapFlash: 0,
      bolts: [], // lightning bolts flying along the course
      hands: [], // mystic hands flying, grabbing or swatting
      missiles: [], // missiles zooming in, locking on, flying or exploding
      bears: [],    // bears chasing a player (snow only)
      vultures: [], // vultures circling, diving and skimming the ground (desert only)
      drones: [],   // rescue drones: guarding a player, or flying to grab the leader
      nextVulture: null, // the leader's distance (meters) when the next group comes
      winner: null,
    };
    for (const p of world.players) {
      p.onGround = true;
      p.biome = startBiome; // no "new biome" banner for the one you start in
    }
    Renderer.resetCameras(startX);
  }

  function readInput(i) {
    // In 1-player mode both sets of keys (WASD and the arrows) work
    const sets = solo ? [0, 1] : [i];
    const input = { left: false, right: false, jump: false, jumpPressed: false, firePressed: false };
    for (const k of sets) {
      const c = CONTROLS[k];
      input.left ||= keys.has(c.left);
      input.right ||= keys.has(c.right);
      input.jump ||= keys.has(c.jump);
      input.jumpPressed ||= jumpQueued[k];
      input.firePressed ||= fireQueued[k];
      jumpQueued[k] = false;
      fireQueued[k] = false;
    }
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

    level.ensure(Math.max(...players.map((p) => p.x)) + VIEW_W * 2);
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

    const inputs = players.map((p, i) => readInput(i));
    players.forEach((p, i) => p.update(dt, inputs[i], level));
    players.forEach((p, i) => { if (inputs[i].firePressed) usePower(p, i); });
    updateDrones(dt);
    updateBolts(dt);
    updateHands(dt);
    updateMissiles(dt);
    updateBears(dt);
    updateVultures(dt);
    checkOrbs();
    checkThinIce();
    checkTrapRescue();
    levelSounds();
    checkFire();
  }

  // Running into someone stuck in a bear trap knocks them out of it... and you're caught in it instead
  function checkTrapRescue() {
    const { players, level } = world;
    for (const p of players) {
      if (p.trapped <= 0 || p.dead) continue;
      const t = level.traps.find((tt) => tt.id === p.trapId);
      if (!t) continue;
      for (const q of players) {
        if (q === p || q.dead || q.caught || q.held || q.trapped > 0 || q.rescueBlock > 0) continue;
        if (Math.abs(q.vx) < 20 || !overlaps(p.x, p.y, HITBOX_W, HITBOX_H, q.x, q.y, HITBOX_W, HITBOX_H)) continue; // has to run into them
        p.escapeTrap(level, "FREED!");
        p.rescueBlock = 1; // (so they can't knock it straight back onto you)
        q.trapped = TRAP.wiggles[t.size];
        q.trapId = t.id;
        q.lastWiggle = q.facing;
        q.wiggleHeld = q.facing;
        q.vx = 0;
        q.x = t.x - HITBOX_W / 2;
        q.showHit("TRAPPED!", "#d6dbe2");
        Sound.play("trapSnap");
        return;
      }
    }
  }

  // Both players standing on the same thin ice at once: too heavy, it breaks
  function checkThinIce() {
    const { players, level } = world;
    if (players.length < 2) return;
    for (const pond of level.ponds) {
      if (pond.state !== "ice") continue;
      const on = players.filter((p) => !p.dead && !p.caught && p.onGround && !p.standingOn && level.pondAt(p.x + HITBOX_W / 2) === pond);
      if (on.length === players.length) {
        level.breakPond(pond, (on[0].x + on[1].x) / 2 + HITBOX_W / 2);
        for (const p of on) p.freezeIn(pond); // both go in together: one block of ice
      }
    }
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
          if (orb.kind === "zap" || orb.kind === "hand" || orb.kind === "wind" || orb.kind === "drone") {
            p.sparkle({ zap: "#bff4ff", hand: "#c9a3ff", wind: "#ffffff", drone: "#4fc0ff" }[orb.kind]);
            Sound.play({ zap: "gotZap", hand: "gotHand", wind: "gotWind", drone: "gotDrone" }[orb.kind]);
            // Alone, the drone starts guarding right away with no button press
            if (world.solo && orb.kind === "drone") launchDrone(p);
            else p.power = orb.kind; // holding one power at a time: the newest replaces the old
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
          // (a pond remembers who's frozen in it: that moves with the swap too)
          for (const pond of world.level.ponds) pond.frozen = pond.frozen.map((q) => (q === a ? b : q === b ? a : q));
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
    if (p.power === "wind" && (p.stun > 0 || p.inQuick)) return; // can't dash out of a hand's throw or quicksand
    if (p.power === "zap") fireBolt(p, owner);
    else if (p.power === "hand") throwHand(p, owner);
    else if (p.power === "wind") p.windDash();
    else if (p.power === "drone") launchDrone(p);
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
          target.inQuick = false;
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
    // Missiles only come for the player in the lead, and only in the prairie
    const alive = players.filter((p) => !p.dead && !p.caught);
    if (!alive.length) return;
    const near = alive.reduce((a, b) => (b.x > a.x ? b : a));
    if (world.level.biomeAt(Math.floor((near.x + HITBOX_W / 2) / TILE)) !== "prairie") return;
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
    // When the leader reaches one of the prairie's missile spots (past 400 m), a missile comes.
    // One at a time: if one is still in the air, the next waits for it.
    const leaderMeters = Math.max(...players.map((p) => p.x)) / TILE;
    for (const spot of level.missileSpots) {
      if (spot.used || leaderMeters < spot.col || world.missiles.length) continue;
      spot.used = true;
      if (spot.col >= MISSILE.startAt) spawnMissile();
    }

    // You died (to something else) before the missile coming for you got there: it carries on and
    // fires anyway, at wherever you are by then, and a fresh one comes for you once you're back
    for (const p of players) if (!p.dead) p.missileDeath = false;
    for (const m of world.missiles) {
      const p = m.state === "approach" ? m.anchor : m.target;
      if (!p || !p.dead || p.caught || p.missileDeath || m.state === "boom" || m.owedFor === p) continue;
      p.missileOwed = true;
      m.owedFor = p;
    }
    for (const p of players) {
      if (!p.missileOwed || p.dead) continue;
      if (p.caught) { p.missileOwed = false; continue; }
      if (world.missiles.some((m) => !m.done && m.state !== "fly" && m.state !== "boom")) continue; // one at a time
      p.missileOwed = false;
      const striped = p.x / TILE > MISSILE.stripedAt && Math.random() < 0.5;
      world.missiles.push(makeMissile(p, striped, Math.random() < 0.5 ? -1 : 1));
      Sound.play("glint");
      Sound.play("incoming");
    }

    for (const m of world.missiles) {
      m.t += dt;
      if (m.state === "approach") {
        const ax = m.anchor.x; // (if they've died, it stays over where they were)
        const e = Math.min(1, m.t / MISSILE.approach) ** 2; // slow at first, rushing in at the end
        m.x = ax + m.sx + (m.ox - m.sx) * e;
        m.y = m.sy + (m.oy - m.sy) * e;
        m.scale = 0.15 + 0.85 * e;
        m.angle = Math.atan2(m.oy - m.sy, m.ox - m.sx);
        // drop a puff of smoke every few frames; it's thicker the closer (bigger) the missile is
        if ((m.smokeTimer = (m.smokeTimer || 0) + dt) > 0.025) {
          m.smokeTimer = 0;
          m.smoke.push({ rx: m.x - ax, y: m.y, s: m.scale, t: world.time });
        }
        if (m.t >= MISSILE.approach) {
          m.smokeAnchorX = ax; // from here the trail stays put in the world
          m.state = "lock";
          m.t = 0;
          Sound.play("lockOn");
          // Lock on to whoever is closest right now (if nobody's alive, at the spot its player died)
          const alive = players.filter((p) => !p.dead && !p.caught);
          if (!alive.length) {
            if (m.anchor.caught) { m.done = true; continue; }
            m.target = m.anchor;
          } else m.target = alive.reduce((best, p) =>
            Math.hypot(p.x - m.x, p.y - m.y) < Math.hypot(best.x - m.x, best.y - m.y) ? p : best);
        }
      } else if (m.state === "lock") {
        if (m.target.caught) { m.done = true; continue; }
        m.aim = missileAim(m, m.target); // (still dead: where they were; already back: where they are now)
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
              p.missileDeath = true; // (a missile got them: that doesn't send another one)
              p.die();
            }
          }
        }
        if (m.t >= MISSILE.blastTime) m.done = true;
      }
    }
    world.missiles = world.missiles.filter((m) => !m.done);
  }

  // ---- Bears (snow biome) ----

  // Where the bear's feet go: the highest ground under its body. Over a pit it
  // keeps its height (it leaps across), and it bounds over spikes.
  function bearGround(bear) {
    const { level } = world;
    let top = null;
    let leaping = false;
    for (let x = bear.x - BEAR_W + 4; x <= bear.x; x += 6) {
      let g = level.groundTop(x);
      if (g === null) { leaping = true; continue; }
      if (level.tile(Math.floor(x / TILE), g / TILE - 1) === T_SPIKE) { g -= TILE + 2; leaping = true; }
      if (top === null || g < top) top = g;
    }
    return { top, leaping };
  }

  // Could anyone see this bear? (each screen shows from a little behind its player)
  function bearOnScreen(bear) {
    return world.players.some((p) => {
      const left = p.x - VIEW_W * 0.35 - 8, right = left + VIEW_W + 16;
      return bear.x > left && bear.x - BEAR_W < right;
    });
  }

  function updateBears(dt) {
    const { level, players } = world;
    // Once per snow biome, when the leader reaches the bear's spot, it charges in from the left
    const runners = players.filter((p) => !p.dead && !p.caught);
    if (runners.length) {
      const leader = runners.reduce((a, b) => (b.x > a.x ? b : a));
      for (const spot of level.bearSpots) {
        if (spot.used || leader.x / TILE < spot.col) continue;
        if (world.bears.some((bb) => bb.state !== "leave")) continue; // one chase at a time: wait for the other bear
        spot.used = true;
        if (level.biomeAt(Math.floor(leader.x / TILE)) !== "snow") continue;
        const meters = leader.x / TILE;
        if (meters < THREATS.baseAt) continue; // no bears this early
        let kindName = spot.kind;
        if (kindName === "polar" && meters < THREATS.specialAt) kindName = Math.random() < 0.5 ? "brown" : "black"; // polar bears come later
        const kind = BEAR[kindName];
        const bear = { kind: kindName, target: leader, x: leader.x - BEAR.startBehind, y: leader.y + HITBOX_H,
          state: "chase", t: 0, speed: kind.speed, chase: kind.chase, anim: 0, stepTimer: 0, lift: 0, trampled: new Set() };
        // Never pop into view on the other player's screen: if they're close enough behind to see
        // the spot, start just off the left of THEIR screen and charge through to the leader first.
        for (const q of players) {
          if (q === leader || q.dead || q.caught) continue;
          const left = q.x - VIEW_W * 0.35;
          if (bear.x - BEAR_W < left + VIEW_W && bear.x > left - 4) {
            bear.x = Math.min(bear.x, left - 4);
            bear.state = "approach";
          }
        }
        const g = bearGround(bear).top;
        if (g !== null) bear.y = g;
        world.bears.push(bear);
        Sound.play("roar");
      }
    }

    for (const bear of world.bears) {
      bear.t += dt;
      const p = bear.target;
      const dir = bear.state === "leave" ? -1 : 1;
      if (bear.state === "approach" && bear.x >= p.x - BEAR.startBehind) {
        bear.state = "chase"; // reached the leader's screen: the chase starts now
        bear.t = 0;
      }
      if (bear.state === "chase" || bear.state === "leave" || bear.state === "approach") {
        const speed = bear.state === "leave" ? bear.speed * 0.7 : bear.state === "approach" ? BEAR.approachSpeed : bear.speed;
        bear.x += dir * speed * dt;
        bear.anim += speed * dt;
        const { top, leaping } = bearGround(bear);
        if (top !== null) bear.y += (top - bear.y) * Math.min(1, dt * 12);
        bear.lift = leaping ? Math.min(6, bear.lift + dt * 40) : Math.max(0, bear.lift - dt * 40);
        // heavy footsteps when someone is close enough to hear
        if ((bear.stepTimer -= dt) <= 0) {
          bear.stepTimer = 0.24;
          if (players.some((q) => Math.abs(q.x - bear.x) < VIEW_W * 0.6)) Sound.play("bearStep");
        }
      }
      // Running over the player it isn't chasing launches them high into the air
      if (bear.state === "chase" || bear.state === "approach") {
        for (const q of players) {
          if (q === p || q.dead || q.caught || q.held || bear.trampled.has(q)) continue;
          if (overlaps(q.x, q.y, HITBOX_W, HITBOX_H, bear.x - BEAR_W + 6, bear.y - 16, BEAR_W - 6, 16)) {
            bear.trampled.add(q);
            q.inQuick = false;
            q.vy = -BEAR.tramplePop;
            q.onGround = false;
            q.standingOn = null;
            q.stun = 0.6; // tumbles, no control for a moment
            q.showHit("TRAMPLED!", "#ffb347");
            q.sparkle("#ffffff");
            Sound.play("trample");
          }
        }
      }
      if (p.caught && (bear.state === "approach" || bear.state === "chase" || bear.state === "regroup")) {
        bear.state = "leave"; // the fire got them: nothing left to chase
        bear.t = 0;
      } else if (p.dead && (bear.state === "approach" || bear.state === "chase")) {
        // They died to something else: go and wait where they'll come back, then carry on
        bear.resume = bear.state;
        bear.state = "regroup";
      }
      if (bear.state === "regroup") {
        // Run (forwards or backwards) to wait just behind where they'll come back, where you can see it.
        // Never so close that it could catch someone who runs flat out before its time is up.
        const left = bear.resume === "chase" ? Math.max(0, bear.chase - bear.t) : bear.chase;
        const behind = clamp((bear.speed - PHYSICS.runSpeed) * left + 16, BEAR.waitBehind, BEAR.startBehind);
        const goal = (p.dead ? p.respawnX : p.x) - behind;
        const step = BEAR.approachSpeed * dt;
        if (Math.abs(goal - bear.x) > step) {
          bear.facing = goal > bear.x ? 1 : -1;
          bear.x += bear.facing * step;
          bear.anim += step;
          const { top, leaping } = bearGround(bear);
          if (top !== null) bear.y += (top - bear.y) * Math.min(1, dt * 12);
          bear.lift = leaping ? Math.min(6, bear.lift + dt * 40) : Math.max(0, bear.lift - dt * 40);
        } else {
          bear.x = goal;
          bear.facing = 1;
          bear.lift = Math.max(0, bear.lift - dt * 40);
          if (!p.dead) {
            bear.state = bear.resume; // back on the chase (the clock kept running)
            Sound.play("roar");
          }
        }
        if (bear.resume === "chase" && bear.t >= bear.chase) {
          bear.state = "leave"; // time's up, even while waiting
          bear.t = 0;
          Sound.play("grumble");
        }
      } else if (bear.state === "chase") {
        if (bear.x >= p.x + 2 && p.y + HITBOX_H > bear.y - 34) {
          // Caught!
          bear.state = "swipe";
          bear.t = 0;
          if (bear.kind === "black") {
            p.honey = BEAR.honeyTime;
            p.showHit("HONEY!", "#ffb627");
            Sound.play("honey");
          } else {
            p.showHit("MAULED!", "#ff4d3d");
            Sound.play("maul");
            p.die();
          }
        } else if (bear.t >= bear.chase) {
          bear.state = "leave"; // gives up and heads back
          bear.t = 0;
          Sound.play("grumble");
        }
      } else if (bear.state === "swipe") {
        if (bear.t >= BEAR.swipeTime) { bear.state = "leave"; bear.t = 0; }
      } else if (bear.state === "leave") {
        // Heading home: it only disappears once nobody can see it (it runs out past the left
        // edge of every screen, including the player behind's, instead of vanishing in front of them)
        if (!bearOnScreen(bear) || bear.t > 30) bear.done = true;
      } else if (bear.state === "approach" && bear.t > 15) {
        bear.state = "leave"; // never caught up with the leader: give up (and leave out of sight)
        bear.t = 0;
      }
    }
    world.bears = world.bears.filter((b) => !b.done);
  }

  // ---- Rescue drone ----

  // Used by the player behind: fly to the leader and bring them back. Used by the leader
  // (or on your own): follow them and catch them once if they fall into a pit.
  function launchDrone(p) {
    const others = world.players.filter((q) => q !== p && !q.caught);
    const leader = others.find((q) => q.trackX > p.trackX);
    const drone = { owner: p, x: p.x + HITBOX_W / 2, y: p.y - 10, t: 0, done: false };
    if (leader) {
      Object.assign(drone, { mode: "hunt", target: leader });
    } else {
      // only one guard drone at a time: a new one replaces it
      world.drones = world.drones.filter((d) => !(d.mode === "guard" && d.owner === p));
      Object.assign(drone, { mode: "guard" });
    }
    world.drones.push(drone);
    p.sparkle("#4fc0ff");
    Sound.play("droneLaunch");
  }

  // The first firm, spike-free, quicksand-free ground ahead (two tiles wide)
  function landingAfter(x) {
    const { level } = world;
    for (let c = Math.floor(x / TILE) + 1; c < Math.floor(x / TILE) + 200 && c < level.cols.length - 2; c++) {
      const g = level.groundTop(c * TILE);
      if (g === null || level.groundTop((c + 1) * TILE) !== g || level.isQuick(c) || level.isQuick(c + 1)) continue;
      if (level.tile(c, g / TILE - 1) !== T_EMPTY || level.tile(c + 1, g / TILE - 1) !== T_EMPTY) continue;
      return { x: c * TILE + 1, y: g - HITBOX_H };
    }
    return null;
  }

  // Where a pulled-back leader is dropped: safe ground a little in front of the player behind,
  // but always at least two tiles behind where they were grabbed (never forward)
  function pullBackSpot(d) {
    const { level } = world;
    const limit = d.fromX - 2 * TILE;
    const from = Math.min(d.owner.x + DRONE.dropAhead, limit);
    return (limit - from > TILE && level.safeSpotAfter(from, limit - from)) || level.safeSpotBefore(from);
  }

  function updateDrones(dt) {
    const { level } = world;
    for (const d of world.drones) {
      d.t += dt;
      if (d.mode === "guard") {
        const p = d.owner;
        if (p.caught) { d.mode = "leave"; continue; }
        // hover just above and behind the player
        const hx = p.x + HITBOX_W / 2 - 10 * p.facing;
        const hy = Math.max(6, p.y - 14 + Math.sin(d.t * 4) * 2);
        d.x += (hx - d.x) * Math.min(1, dt * 8);
        d.y += (hy - d.y) * Math.min(1, dt * 8);
        // Falling into a pit? Catch them and carry them past it
        if (!p.dead && !p.held && !p.onGround && p.vy > 0 && p.y > VIEW_H - 14 && level.groundTop(p.x + HITBOX_W / 2) === null) {
          // Past the pit on safe ground; if there's none nearby (e.g. a shooter right there),
          // the next firm ground ahead will do: it never lets you fall
          const spot = level.safeSpotAfter(p.x + HITBOX_W) || landingAfter(p.x + HITBOX_W);
          if (spot) {
            d.mode = "carry";
            d.target = p;
            d.spot = spot;
            p.held = true;
            p.inQuick = false;
            p.vx = p.vy = 0;
            p.showHit("SAVED!", "#4fc0ff");
            Sound.play("droneGrab");
          }
        }
      } else if (d.mode === "hunt") {
        const q = d.target;
        if (q.caught) { d.mode = "leave"; continue; }
        if (q.dead || q.held) { d.y += (20 - d.y) * Math.min(1, dt * 3); continue; } // wait for them
        // if the owner has caught up and passed them, there's no one to bring back
        if (d.owner.trackX >= q.trackX) { d.mode = "leave"; continue; }
        const tx = q.x + HITBOX_W / 2, ty = q.y - 3;
        const dist = Math.hypot(tx - d.x, ty - d.y);
        const step = DRONE.flySpeed * dt;
        if (dist <= step + 2) {
          d.mode = "carry";
          d.target = q;
          d.fromX = q.x; // where they were grabbed: they always end up behind this
          q.held = true;
          q.inQuick = false;
          q.vx = q.vy = 0;
          q.showHit("PULLED BACK!", "#4fc0ff");
          Sound.play("droneGrab");
        } else {
          d.x += ((tx - d.x) / dist) * step;
          d.y += ((ty - d.y) / dist) * step;
        }
      } else if (d.mode === "carry") {
        const q = d.target;
        // Leader being pulled back: drop them safely a little in front of the player behind
        // (recomputed as that player moves). Guard save: drop them past the pit.
        if (d.target !== d.owner) d.spot = pullBackSpot(d) || d.spot;
        const spot = d.spot || { x: q.x, y: q.y };
        const tx = spot.x + HITBOX_W / 2, ty = Math.min(spot.y - 6, d.y);
        const dist = Math.hypot(tx - d.x, ty - d.y);
        const step = DRONE.carrySpeed * dt;
        if (dist > step) { d.x += ((tx - d.x) / dist) * step; d.y += ((ty - d.y) / dist) * step; }
        else { d.x = tx; d.y = ty; }
        q.x = d.x - HITBOX_W / 2;
        q.y = d.y + 5;
        if (dist <= step + 1) {
          // set them down gently on the safe spot
          q.held = false;
          q.x = spot.x;
          q.y = spot.y;
          q.vx = q.vy = 0;
          q.onGround = false;
          q.safeSpots.push({ x: spot.x, y: spot.y });
          Sound.play("droneDrop");
          d.mode = "leave";
          d.t = 0;
        }
      } else if (d.mode === "leave") {
        d.y -= 90 * dt;
        d.x += 60 * dt;
        if (d.y < -20) d.done = true;
      }
    }
    world.drones = world.drones.filter((d) => !d.done);
  }

  // ---- Vultures (desert) ----

  function spawnVultures(leader) {
    const n = Number(pickWeighted(VULTURE.groupSizes));
    const blackAllowed = leader.x / TILE >= THREATS.specialAt; // black vultures come later
    for (let i = 0; i < n; i++) {
      const kind = blackAllowed && Math.random() < 0.5 ? "black" : "brown";
      world.vultures.push({ kind, target: leader, state: "wait", t: -i * VULTURE.stagger, x: leader.x + 270, y: -12, angle: Math.random() * 6.28, facing: -1 });
    }
  }

  function pickWeighted(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (const [key, w] of Object.entries(weights)) if ((roll -= w) < 0) return key;
    return Object.keys(weights)[0];
  }

  // The height a skimming vulture flies at: just above the ground, at your feet
  function skimY(x, fallback) {
    const g = world.level.groundTop(x);
    return g === null ? fallback : g - 5;
  }

  function updateVultures(dt) {
    const { players, level } = world;
    const runners = players.filter((p) => !p.dead && !p.caught);
    if (runners.length) {
      const leader = runners.reduce((a, b) => (b.x > a.x ? b : a));
      const meters = leader.x / TILE;
      if (level.biomeAt(Math.floor(meters)) === "desert" && meters >= THREATS.baseAt) {
        if (world.nextVulture === null) world.nextVulture = meters + rand(20, VULTURE.every[1]);
        if (meters >= world.nextVulture) {
          spawnVultures(leader);
          world.nextVulture = meters + rand(VULTURE.every[0], VULTURE.every[1]);
        }
      }
    }

    for (const v of world.vultures) {
      v.t += dt;
      const p = v.target;
      const kind = VULTURE[v.kind];
      const lost = p.dead || p.caught;
      if (v.state === "wait") {
        if (v.t < 0) continue;
        if (p.dead && !p.caught) { v.t = 0; continue; } // not here yet: wait for them to come back
        v.t = 0;
        if (v.kind === "brown") { v.state = "circle"; Sound.play("vultureCry"); }
        else { v.state = "diving"; v.sx = p.x + 260; v.sy = 8; v.facing = -1; Sound.play("vultureScreech"); }
      }
      // Circling vultures don't give up when you die: they find where you come back and carry on.
      // (The fire getting you, or dying mid-dive, sends them off.)
      if ((p.caught || (p.dead && v.state !== "circle")) && v.state !== "leave" && v.state !== "carry" && v.state !== "wait") { v.state = "leave"; v.t = 0; }

      if (v.state === "circle") {
        // Glides in from the top right, then circles above the leader
        v.angle += dt * 3;
        if (p.dead) v.t -= dt; // the clock waits while they're gone
        const cx = (p.dead ? p.respawnX : p.x) + 50 + Math.cos(v.angle) * 34;
        const cy = 24 + Math.sin(v.angle) * 9;
        const ease = Math.min(1, v.t / 0.6);
        const px = v.x;
        v.x += (cx - v.x) * Math.min(1, dt * (2 + ease * 8));
        v.y += (cy - v.y) * Math.min(1, dt * (2 + ease * 8));
        v.facing = v.x >= px ? 1 : -1;
        if (v.t >= kind.circle) { v.state = "diving"; v.t = 0; v.sx = v.x; v.sy = v.y; Sound.play("vultureScreech"); }
      }
      if (v.state === "diving") {
        // Swoops down to the ground just in front of the leader (aiming for where they'll be)
        if (v.t < dt * 1.5) { v.ex = p.x + PHYSICS.runSpeed * kind.dive + 50; v.ey = skimY(v.ex, p.y + HITBOX_H - 5); }
        const u = Math.min(1, v.t / kind.dive);
        v.x = v.sx + (v.ex - v.sx) * u;
        v.y = v.sy + (v.ey - v.sy) * u * u;
        v.facing = -1;
        if (u >= 1) { v.state = "skim"; v.t = 0; }
      }
      if (v.state === "skim") {
        v.x -= kind.skim * dt;
        v.y = skimY(v.x, v.y);
        if (v.x < p.x - VIEW_W * 0.6) { v.state = "leave"; v.t = 0; }
      }
      if ((v.state === "diving" || v.state === "skim") && !p.held && !lost &&
          overlaps(p.x, p.y, HITBOX_W, HITBOX_H, v.x - 6, v.y - 3, 12, 6)) {
        if (v.kind === "black") {
          p.showHit("PECKED!", "#ff4d3d");
          Sound.play("vultureScreech");
          p.die();
          v.state = "leave";
        } else {
          p.showHit("SNATCHED!", "#e88a8a");
          Sound.play("vultureCry");
          p.held = true;
          p.inQuick = false;
          p.vx = p.vy = 0;
          v.state = "carry";
        }
        v.t = 0;
      }
      if (v.state === "carry") {
        // Carries the player up and back, then drops them
        v.x -= VULTURE.carrySpeed * dt;
        const g = level.groundTop(v.x);
        v.y += ((g === null ? v.y : g - 34) - v.y) * Math.min(1, dt * 4);
        v.facing = -1;
        p.x = v.x - HITBOX_W / 2;
        p.y = v.y + 3;
        if (v.t >= VULTURE.carryTime && level.groundTop(v.x) !== null) {
          p.held = false;
          p.vx = 0;
          p.vy = 0;
          p.onGround = false;
          p.stun = 0.3;
          v.state = "leave";
          v.t = 0;
        }
      }
      if (v.state === "leave") {
        v.x -= 120 * dt;
        v.y -= 90 * dt;
        v.facing = -1;
        if (v.y < -30) v.done = true;
      }
    }
    world.vultures = world.vultures.filter((v) => !v.done);
  }

  function checkFire() {
    const caught = world.players.filter((p) => world.fire.x >= p.trackX + 2);
    if (caught.length === 0) return;

    for (const p of caught) p.burnUp();
    if (world.solo) {
      world.winner = { solo: true, meters: Math.floor(world.players[0].trackX / TILE) };
      Sound.play("draw");
    } else {
      world.winner = caught.length === 2 ? null : world.players.find((p) => !p.caught).name;
      Sound.play(world.winner ? "win" : "draw");
    }
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

    // mode: 1 or 2 players
    start(players = 2, options = {}) {
      solo = players === 1;
      biomes = options.biomes === true;
      canvas.height = (solo ? VIEW_H : VIEW_H * 2 + DIVIDER) * SCALE;
      canvas.style.aspectRatio = `auto ${canvas.width} / ${canvas.height}`;
      Sound.unlock(); // the Start click lets the browser play sound
      newWorld(racesStarted++ === 0 || !biomes ? "prairie" : BIOMES[Math.floor(Math.random() * BIOMES.length)]);
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
