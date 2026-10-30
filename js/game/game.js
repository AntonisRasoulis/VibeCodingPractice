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
    "portalCooldown", "safeSpots", "fallState", "icicleState", "coconutState", "snowballs", "snowballStarted", "onIce", "biome",
    "inQuick", "sink", "quickSurface", "tumbleweeds", "tumbleStarted", "trapState", "trapped", "trapId", "lastWiggle", "wiggleHeld", "hiddenIn", "inSink", "sinkT", "sinkFrom", "inPond", "pondHits", "onPond", "inRiver", "eatenBy"];

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
  let biomeList = ["prairie"]; // the biomes this race goes through (biomes off: just the prairie)
  let wild = false;     // Wild mode: the hard one

  function newWorld(startBiome = "prairie") {
    const level = new Level(Math.floor(Math.random() * 1e9), startBiome, { solo, biomes: biomeList.length > 1, biomeList, wild });
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
      jaguars: [],  // jaguars and black panthers hunting the leader (jungle only)
      decoys: [],   // harmless eyes blinking in the jungle's bushes
      arrows: [],   // arrows shot by the jungle's ancient turrets
      sandstorm: null, // the desert's sandstorm orb, blowing: { t, owner }
      snowstorm: null, // the snow's snowstorm orb, blowing: { t }
      thrownSnowballs: [], // snowballs thrown with the snowball orb
      monsoon: null,   // the jungle's monsoon orb, flooding the course: { t, logs }
      monkeys: [],     // monkeys swinging in on their vines (the monkey orb)
      nextCatchup: null, // when (world time) the next purple orb comes for whoever's fallen behind
      warps: [],       // portal gun: someone going into a portal and out of another one far ahead
      grapples: [],    // grapple hooks flying out to the leader, or reeling them back
      vines: [],       // vines swinging someone far forward (wherever they land)
      hawks: [],    // firehawks: flying out to drop a burning stick, or (alone) circling you
      sticks: [],   // burning sticks falling from a firehawk
      burns: [],    // a puff of fire where a firehawk burned an animal
      nextDecoy: null,
      vultures: [], // vultures circling, diving and skimming the ground (desert only)
      drones: [],   // rescue drones: guarding a player, or flying to grab the leader
      nextVulture: null, // the leader's distance (meters) when the next group comes
      wild,              // Wild mode (the hard one)
      nextWildMissile: null, // Wild: when (world time) the next missile comes in the prairie
      nextWildVulture: null, // Wild: when the next group of vultures comes in the desert
      nextWildBear: null,    // Wild: when the next bear charges in, in the snow
      nextWildJaguar: null,  // Wild: when the next jaguar comes, in the jungle
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
    updateMonsoon(dt);
    const flooded = world.monsoon !== null; // (while it's flooded, every danger waits)
    updateDrones(dt);
    updateBolts(dt);
    updateHands(dt);
    if (!flooded) {
      updateMissiles(dt);
      updateBears(dt);
      updateVultures(dt);
      updateFlytraps(dt);
      updateTurrets(dt);
      updateArrows(dt);
    }
    updateMonkeys(dt);
    updateWarps(dt);
    updateGrapples(dt);
    updateVines(dt);
    updateCatchup();
    updateSandstorm(dt);
    updateSnowstorm(dt);
    updateThrownSnowballs(dt);
    updateHawks(dt);
    if (!flooded) {
      updateSticks(dt);
      updateFires(dt);
      updateJaguars(dt);
      updateDecoys(dt);
    }
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
      if (orb.purple && world.monsoon) continue; // (not while it's flooded)
      for (const p of world.players) {
        const other = p === a ? b : a;
        if (p.dead || p.held || (orb.kind === "swap" && other.dead)) continue;
        if (overlaps(p.x, p.y, HITBOX_W, HITBOX_H, orb.x, orb.y, orb.w, orb.h)) {
          orb.used = true;
          if (orb.kind === "zap" || orb.kind === "hand" || orb.kind === "wind" || orb.kind === "drone" || orb.kind === "firehawk" || orb.kind === "snowball" || orb.kind === "monkey") {
            p.sparkle({ zap: "#bff4ff", hand: "#c9a3ff", wind: "#ffffff", drone: "#4fc0ff", firehawk: "#ff7a1a", snowball: "#e8f8ff", monkey: "#c8946a" }[orb.kind]);
            Sound.play({ zap: "gotZap", hand: "gotHand", wind: "gotWind", drone: "gotDrone", firehawk: "gotHawk", snowball: "gotSnowball", monkey: "gotMonkey" }[orb.kind]);
            // Alone, the drone (and the firehawk) start guarding you right away with no button press,
            // and the snowball (with nobody to throw it at) gives you skates
            if (world.solo && orb.kind === "drone") launchDrone(p);
            else if (world.solo && orb.kind === "firehawk") launchHawk(p);
            else if (world.solo && orb.kind === "snowball") { p.skate = SNOWBALL.skate; p.showHit("SKATES!", "#a8e0ff"); }
            else p.power = orb.kind; // holding one power at a time: the newest replaces the old
            return;
          }
          if (orb.purple) {
            p.sparkle("#d9a3ff");
            Sound.play("gotCatchup");
            if (orb.kind === "vine") launchVine(p);
            else p.power = orb.kind; // the portal gun and the grapple: used with S / Down
            return;
          }
          if (orb.kind === "monsoon") {
            if (!world.monsoon) startMonsoon();
            for (const q of world.players) if (!q.caught) q.showHit("MONSOON! STAY ON THE LOGS!", "#9fe0e8");
            Sound.play("monsoon");
            return;
          }
          if (orb.kind === "snowstorm") {
            world.snowstorm = { t: world.snowstorm ? Math.min(world.snowstorm.t, SNOWSTORM.fade) : 0 };
            for (const q of world.players) if (!q.caught) q.showHit("SNOWSTORM! KEEP MOVING!", "#e8f8ff");
            Sound.play("snowstorm");
            return;
          }
          if (orb.kind === "sandstorm") {
            world.sandstorm = { t: world.sandstorm ? Math.min(world.sandstorm.t, SANDSTORM.fade) : 0, owner: p };
            for (const q of world.players) if (!q.caught) q.showHit("SANDSTORM!", "#f0d8a0");
            Sound.play("sandstorm");
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
          for (const f of world.level.flytraps) f.victim = f.victim === a ? b : f.victim === b ? a : f.victim; // (and a flytrap, who it's chewing)
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
    else if (p.power === "firehawk") launchHawk(p);
    else if (p.power === "snowball") throwSnowball(p);
    else if (p.power === "monkey") launchMonkey(p);
    else if (p.power === "portalgun" || p.power === "grapple") {
      if (world.monsoon || p.flood) return; // (keep it for after the flood)
      if (!(p.power === "portalgun" ? firePortalGun(p) : throwGrapple(p))) return; // (nothing happened: keep it)
    }
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
          target.inRiver = null;
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
    const striped = leaderMeters > (world.wild ? 0 : MISSILE.stripedAt) && Math.random() < 0.5;
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
    if (world.wild) {
      // Wild: one at the leader the whole time they're in the prairie, the next as soon as the last
      // one has exploded or flown off
      const leader = players.filter((p) => !p.dead && !p.caught).sort((a, b) => b.x - a.x)[0];
      if (!leader || level.biomeAt(Math.floor((leader.x + HITBOX_W / 2) / TILE)) !== "prairie" || world.missiles.length) world.nextWildMissile = null;
      else if (world.nextWildMissile === null) world.nextWildMissile = world.time + WILD.missileEvery[0] + Math.random() * (WILD.missileEvery[1] - WILD.missileEvery[0]);
      else if (world.time >= world.nextWildMissile) {
        spawnMissile();
        world.nextWildMissile = null;
      }
    } else {
      for (const spot of level.missileSpots) {
        if (spot.used || leaderMeters < spot.col || world.missiles.length) continue;
        spot.used = true;
        if (spot.col >= MISSILE.startAt) spawnMissile();
      }
    }

    // You died (to something else) before the missile coming for you got there: it carries on and
    // fires anyway, at wherever you are by then, and a fresh one comes for you once you're back
    for (const p of players) if (!p.dead) p.missileDeath = false;
    for (const m of world.missiles) {
      const p = m.state === "approach" ? m.anchor : m.target;
      if (world.wild) break; // (in Wild they keep coming anyway)
      if (!p || !p.dead || p.caught || p.missileDeath || m.state === "boom" || m.owedFor === p) continue;
      p.missileOwed = true;
      m.owedFor = p;
    }
    for (const p of players) {
      if (!p.missileOwed || p.dead) continue;
      if (p.caught) { p.missileOwed = false; continue; }
      if (world.missiles.some((m) => !m.done && m.state !== "fly" && m.state !== "boom")) continue; // one at a time
      p.missileOwed = false;
      const striped = p.x / TILE > (world.wild ? 0 : MISSILE.stripedAt) && Math.random() < 0.5;
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
      let busy = world.bears.some((bb) => bb.state !== "leave"); // one chase at a time
      const inSnow = level.biomeAt(Math.floor(leader.x / TILE)) === "snow";
      if (world.wild) {
        // Wild: always a bear after you in the snow: when one gives up, the next charges in
        if (!inSnow || busy) world.nextWildBear = null;
        else if (world.nextWildBear === null) world.nextWildBear = world.time + WILD.bearGap;
        else if (world.time >= world.nextWildBear) {
          world.nextWildBear = null;
          spawnBear(leader, ["polar", "brown", "black"][Math.floor(Math.random() * 3)]);
        }
      }
      for (const spot of world.wild ? [] : level.bearSpots) {
        if (spot.used || leader.x / TILE < spot.col) continue;
        if (busy) continue; // wait for the other bear
        spot.used = true;
        if (!inSnow) continue;
        const meters = leader.x / TILE;
        if (meters < level.baseAt) continue; // no bears this early
        let kindName = spot.kind;
        if (kindName === "polar" && meters < level.specialAt) kindName = Math.random() < 0.5 ? "brown" : "black"; // polar bears come later
        spawnBear(leader, kindName);
        busy = true;
      }
    }
    updateBearMoves(dt);
  }

  // A bear charges in from the left after the leader
  function spawnBear(leader, kindName) {
    const kind = BEAR[kindName];
    const bear = { kind: kindName, target: leader, x: leader.x - BEAR.startBehind, y: leader.y + HITBOX_H,
      state: "chase", t: 0, speed: kind.speed, chase: kind.chase, anim: 0, stepTimer: 0, lift: 0, trampled: new Set() };
    // Never pop into view on the other player's screen: if they're close enough behind to see
    // the spot, start just off the left of THEIR screen and charge through to the leader first.
    for (const q of world.players) {
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

  function updateBearMoves(dt) {
    const { level, players } = world;
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
            q.inRiver = null;
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
            p.inRiver = null;
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
          q.inRiver = null;
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

  // ---- Flytraps (jungle) ----

  // A flytrap is shared: it rears back when anyone comes close, then snaps at everyone in its bite.
  // It eats the nearest; while it's chewing (someone, or nothing after a miss) it ignores everybody.
  function updateFlytraps(dt) {
    const { level, players } = world;
    const free = (p) => !p.dead && !p.caught && !p.held && !p.eatenBy && !p.inRiver;
    const inBite = (f, p) => {
      const reach = level.flytrapReach(f);
      return free(p) && p.x + HITBOX_W > f.x - reach && p.x < f.x + reach && p.y + HITBOX_H > f.gy - FLYTRAP.lunge && p.y < f.gy;
    };
    const snap = (f) => {
      const victim = players.filter((p) => inBite(f, p)).sort((p, q) => Math.abs(p.x - f.x) - Math.abs(q.x - f.x))[0];
      f.t = 0;
      if (victim) {
        f.state = "chew";
        f.victim = victim;
        victim.eatenBy = f;
        victim.vx = victim.vy = 0;
        victim.from = victim.x + HITBOX_W / 2 < f.x ? -1 : 1; // spat back out the way they came
        victim.showHit("CHOMP!", "#ff6a8a");
        Sound.play("flytrapChomp");
      } else {
        f.state = "chewNothing";
        Sound.play("flytrapSnap");
      }
    };
    for (const f of level.flytraps) {
      if (!players.some((p) => Math.abs(p.x - f.x) < VIEW_W * 1.5)) continue;
      f.t += dt;
      if (f.state === "open") {
        if (players.some((p) => inBite(f, p))) snap(f); // (right in front of it as it opens: no warning)
        else if (players.some((p) => free(p) && Math.abs(p.x + HITBOX_W / 2 - f.x) < level.flytrapSense(f) && p.y + HITBOX_H > f.gy - 60)) {
          f.state = "windup";
          f.t = 0;
          Sound.play("flytrapHiss");
        }
      } else if (f.state === "windup") {
        if (f.t >= level.flytrapWindup()) snap(f);
      } else if (f.state === "chew") {
        const v = f.victim;
        if (v && v.eatenBy === f && f.t > FLYTRAP.chew - 0.4 && f.big && !f.gulped) { f.gulped = true; Sound.play("flytrapGulp"); }
        if (f.t >= FLYTRAP.chew) {
          if (v && v.eatenBy === f) {
            v.eatenBy = null;
            if (f.big) {
              v.showHit("EATEN!", "#ff4d3d");
              v.die();
            } else {
              // spat out, back the way they came
              const dir = v.from || -1;
              v.x = f.x + dir * (level.flytrapReach(f) + 2) - HITBOX_W / 2;
              v.y = f.gy - HITBOX_H - 12;
              v.vx = dir * FLYTRAP.spit[0];
              v.vy = -FLYTRAP.spit[1];
              v.onGround = false;
              v.stun = FLYTRAP.spitStun;
              v.noCut = 0.5;
              v.showHit("SPAT OUT!", "#9be07a");
              Sound.play("flytrapSpit");
            }
          }
          f.victim = null;
          f.gulped = false;
          f.state = "opening";
          f.t = 0;
        }
      } else if (f.state === "chewNothing") {
        if (f.t >= (level.wild ? WILD.flytrapChewNothing : FLYTRAP.chewNothing)) { f.state = "opening"; f.t = 0; }
      } else if (f.state === "opening" && f.t >= FLYTRAP.open) {
        f.state = "open";
        f.t = 0;
      }
    }
  }

  // ---- The desert's orbs: sandstorm and firehawk ----

  // How hard the sandstorm is blowing (0 to 1): it builds up, blows, then dies down
  function sandstormStrength() {
    const st = world.sandstorm;
    if (!st) return 0;
    return Math.max(0, Math.min(1, st.t / SANDSTORM.fade, (SANDSTORM.time - st.t) / SANDSTORM.fade));
  }

  function updateSandstorm(dt) {
    const st = world.sandstorm;
    if (st) {
      st.t += dt;
      if (st.t >= SANDSTORM.time) world.sandstorm = null;
    }
    const s = sandstormStrength();
    for (const p of world.players) p.windPush = s * SANDSTORM.push * (st && p === st.owner ? SANDSTORM.ownPush : 1);
  }

  // ---- The jungle's orbs: monsoon and monkey ----

  // How high the water is (its surface, pixels from the top): rising up out of the ground, staying
  // up over everything, then draining away
  function floodSurface() {
    const m = world.monsoon;
    if (!m) return null;
    const low = VIEW_H + 4, high = MONSOON.surface;
    const up = Math.min(1, m.t / MONSOON.rise), down = Math.max(0, (m.t - (MONSOON.time - MONSOON.drain)) / MONSOON.drain);
    const ease = (u) => u * u * (3 - 2 * u);
    return low + (high - low) * ease(up) + (low - high) * ease(down);
  }

  // The water's coming: the dangers are washed away (or wait it out), everyone stuck in something
  // is let go, and a log rises up under everyone's feet
  function startMonsoon() {
    const { level, players } = world;
    world.monsoon = { t: 0, logs: [], draining: false };
    for (const v of world.vultures) v.done = true;
    for (const bear of world.bears) bear.done = true;
    for (const j of world.jaguars) j.done = true;
    world.missiles = [];
    world.arrows = [];
    world.sticks = [];
    level.fires = []; // (the rain puts them out)
    for (const tu of level.turrets) if (tu.state !== "hidden") { tu.state = "done"; tu.h = 0; tu.moving = false; }
    for (const p of players) {
      p.inRiver = null;
      p.inQuick = false;
      p.inSink = null;
      if (p.inPond) { p.inPond.frozen = p.inPond.frozen.filter((q) => q !== p); p.inPond = null; }
      p.trapped = 0;
      if (p.eatenBy) { p.eatenBy.victim = null; p.eatenBy.state = "opening"; p.eatenBy.t = 0; p.eatenBy = null; }
    }
    for (const p of players) if (!p.dead && !p.caught) addFloodLog(p.x + HITBOX_W / 2 - 20, 40);
    fillFloodLogs();
  }

  function addFloodLog(x, w) {
    const log = { kind: "flood", id: world.level.nextId++, x, y: (floodSurface() ?? VIEW_H) - 2, w, dx: 0 };
    world.monsoon.logs.push(log);
    world.level.platforms.push(log);
    return log;
  }

  // Logs all along the water, from well behind the last player to well ahead of the first, with an
  // easy hop between each
  function fillFloodLogs() {
    const m = world.monsoon, xs = world.players.map((p) => p.x);
    const from = Math.min(...xs) - VIEW_W, to = Math.max(...xs) + VIEW_W * 1.5;
    const gap = () => MONSOON.gap[0] + Math.random() * (MONSOON.gap[1] - MONSOON.gap[0]);
    const width = () => MONSOON.logWidths[Math.floor(Math.random() * MONSOON.logWidths.length)];
    const have = m.logs.slice().sort((a, c) => a.x - c.x);
    // walk along from behind everyone to out ahead, adding logs wherever there's room for one
    let x = Math.min(from, have.length ? have[0].x : from);
    for (const log of [...have, null]) {
      const end = log ? log.x - MONSOON.gap[0] : to;
      while (true) {
        const w = width();
        if (x + w > end) break;
        addFloodLog(x, w);
        x += w + gap();
      }
      if (log) x = Math.max(x, log.x + log.w + gap());
    }
  }

  function updateMonsoon(dt) {
    const m = world.monsoon, { level, players } = world;
    if (!m) { for (const p of players) p.flood = null; return; }
    m.t += dt;
    const surf = floodSurface();
    const riders = (log) => players.filter((p) => p.standingOn === log && !p.dead);
    if (!m.draining && m.t >= MONSOON.time - MONSOON.drain) {
      // draining away: each log someone's riding drifts them down onto the nearest safe ground
      m.draining = true;
      for (const log of m.logs) {
        const p = riders(log)[0];
        if (!p) continue;
        const a = level.safeSpotBefore(p.x + 1, 480), c = level.safeSpotAfter(p.x, 480);
        const spot = !a ? c : !c ? a : (p.x - a.x <= c.x - p.x ? a : c);
        if (spot) log.land = { x0: log.x, y0: log.y, dx: spot.x - p.x, y1: spot.y + HITBOX_H, t: 0 };
      }
    }
    for (const log of m.logs) {
      const ox = log.x, oy = log.y;
      if (log.land) {
        const L = log.land, u = Math.min(1, (L.t += dt) / MONSOON.drain), e = u * u * (3 - 2 * u);
        log.x = L.x0 + L.dx * e;
        log.y = L.y0 + (L.y1 - L.y0) * e;
      } else {
        if (m.t >= MONSOON.rise) log.x -= MONSOON.logSpeed * dt; // (they only start drifting once the water's all the way up)
        // (lying on the ground until the water reaches them and lifts them, bobbing)
        const rest = level.groundTop(log.x + log.w / 2) ?? VIEW_H + 4;
        log.y = Math.min(rest, surf - 2 + Math.sin(world.time * 3 + log.id) * 0.6);
      }
      log.dx = log.x - ox;
      // Rising up out of the ground, it scoops up whoever's standing there (the water mustn't beat it
      // to them); sinking as the water drains, it takes whoever's on it down with it (so they go
      // wherever it goes)
      if (log.y !== oy) for (const p of players) {
        if (p.dead || p.caught || p.held || p.inFlood || p.vy < 0 || p.x + HITBOX_W <= log.x || p.x >= log.x + log.w) continue;
        const feet = p.y + HITBOX_H;
        const on = log.y < oy ? feet >= log.y - 0.5 && feet <= oy + 2 : feet >= oy - 1 && feet <= oy + 3;
        if (on) { p.y = log.y - HITBOX_H; p.vy = 0; p.onGround = true; p.standingOn = log; }
      }
    }
    if (m.t >= MONSOON.time) {
      // gone: everyone's back on the ground (or wherever they were)
      level.platforms = level.platforms.filter((p) => p.kind !== "flood");
      for (const p of players) { if (p.standingOn && p.standingOn.kind === "flood") { p.standingOn = null; p.onGround = false; } p.flood = null; p.inFlood = false; }
      world.monsoon = null;
      return;
    }
    // logs drift off behind everyone and new ones come in ahead
    const minX = Math.min(...players.map((p) => p.x));
    const gone = m.logs.filter((l) => l.x + l.w < minX - VIEW_W * 1.5 && !riders(l).length);
    if (gone.length) {
      m.logs = m.logs.filter((l) => !gone.includes(l));
      level.platforms = level.platforms.filter((p) => !gone.includes(p));
    }
    if (!m.draining) fillFloodLogs();
    for (const p of players) p.flood = { surface: surf };
  }

  // The monkey swings in from the top of the screen on its vine, sweeping through the other player
  // (it aims for where they'll be at the bottom of its swing). Alone, it swings you forward instead.
  function launchMonkey(p) {
    const target = world.players.find((q) => q !== p && !q.caught);
    Sound.play("monkeySwing");
    if (!target || world.solo) {
      const spot = world.level.safeSpotAfter(p.x + MONKEY.ferryAhead * TILE, 480) || landingAfter(p.x + MONKEY.ferryAhead * TILE);
      if (!spot) return;
      world.monkeys.push({ mode: "fetch", owner: p, target: p, spot, t: 0, x: p.x - 60, y: -14, frame: "hang" });
      return;
    }
    const bottomT = MONKEY.swing / 2;
    const bx = target.x + HITBOX_W / 2 + target.vx * bottomT, by = target.y + HITBOX_H / 2;
    world.monkeys.push({ mode: "swing", owner: p, target, t: 0, ax: bx, ay: by - MONKEY.radius, x: bx + MONKEY.radius, y: by - MONKEY.radius, frame: "hang", facing: -1 });
  }

  function updateMonkeys(dt) {
    const { level } = world;
    for (const mk of world.monkeys) {
      mk.t += dt;
      const q = mk.target;
      const gone = q.dead || q.caught;
      if (mk.mode === "swing" || mk.mode === "carry") {
        // round the swing: from the right, down through the bottom (fastest) and up the left
        const u = Math.min(1, mk.t / MONKEY.swing), a = Math.PI * (1 - Math.cos(Math.PI * u)) / 2;
        if (mk.mode === "swing") {
          mk.x = mk.ax + Math.cos(a) * MONKEY.radius;
          mk.y = mk.ay + Math.sin(a) * MONKEY.radius;
        }
        mk.facing = -1;
        if (mk.mode === "swing" && !gone && !q.held && mk.y > mk.ay + MONKEY.radius - 8 && overlaps(q.x, q.y, HITBOX_W, HITBOX_H, mk.x - 4, mk.y - 4, 8, 8)) {
          mk.mode = "carry";
          mk.caughtAt = mk.t;
          q.held = true;
          q.vx = q.vy = 0;
          q.inQuick = false;
          q.trapped = 0;
          q.showHit("GRABBED BY A MONKEY!", "#c8946a");
          Sound.play("monkeyGrab");
        }
        if (mk.mode === "carry") {
          // swept up off their feet (a short way: the swing is fast)
          const c = Math.min(1, (mk.t - mk.caughtAt) / MONKEY.carry);
          if (!mk.from) mk.from = { x: q.x, y: q.y };
          mk.frame = "carry";
          q.x = mk.from.x - 14 * c;
          q.y = mk.from.y - 18 * c;
          mk.x = q.x + HITBOX_W / 2;
          mk.y = q.y - 6;
          if (mk.t - mk.caughtAt >= MONKEY.carry || gone) {
            // fling them back, and leap off after them
            q.held = false;
            q.vx = -MONKEY.fling[0];
            q.vy = -MONKEY.fling[1];
            q.onGround = false;
            q.standingOn = null;
            q.stun = 0.35;
            q.noCut = 0.5;
            mk.mode = "leap";
            mk.vx = -MONKEY.fling[0] * 0.6;
            mk.vy = -120;
          }
        } else if (u >= 0.62) {
          // missed: it lets go of its vine and comes after them anyway
          mk.mode = "leap";
          mk.vx = -60;
          mk.vy = -40;
        }
      } else if (mk.mode === "leap" || mk.mode === "chase") {
        mk.frame = mk.mode === "leap" ? "leap" : "hang";
        if (gone || mk.t > MONKEY.giveUp + MONKEY.swing) { mk.mode = "leave"; continue; }
        if (mk.mode === "leap") {
          mk.vy += PHYSICS.gravity * dt;
          mk.x += mk.vx * dt;
          mk.y += mk.vy * dt;
          const g = level.groundTop(mk.x) ?? VIEW_H;
          if (mk.y >= g - 6 && mk.vy > 0) { mk.y = g - 6; mk.mode = "chase"; }
        } else {
          // scamper after them at running speed, along the ground (or the logs)
          const dir = Math.sign(q.x + HITBOX_W / 2 - mk.x) || 1;
          mk.facing = dir;
          mk.x += dir * MONKEY.chaseSpeed * dt;
          const g = level.groundTop(mk.x);
          mk.y = g !== null ? g - 6 : Math.min(mk.y + 200 * dt, VIEW_H);
          mk.frame = Math.floor(mk.t * 10) % 2 ? "leap" : "hang";
        }
        // close enough: it jumps up onto their head
        if (!q.held && Math.abs(mk.x - (q.x + HITBOX_W / 2)) < 9 && Math.abs(mk.y - (q.y + 2)) < 22) {
          mk.mode = "ride";
          mk.t = 0;
          q.blind = MONKEY.blind;
          q.showHit("CAN'T SEE!", "#c8946a");
          Sound.play("monkeyHoot");
        }
      } else if (mk.mode === "ride") {
        mk.frame = "sit";
        mk.x = q.x + HITBOX_W / 2;
        mk.y = q.y - 4;
        if (gone || q.blind <= 0) { q.blind = 0; mk.mode = "leave"; mk.t = 0; }
      } else if (mk.mode === "fetch") {
        // alone: swing down to you, then carry you along an arc to the safe spot ahead
        const down = 0.35;
        if (mk.t < down) {
          const u = mk.t / down;
          mk.x = q.x + HITBOX_W / 2 - 60 * (1 - u);
          mk.y = -14 + (q.y - 4 + 14) * u * u;
          mk.frame = "hang";
          mk.facing = 1;
        } else {
          if (!mk.from) { mk.from = { x: q.x, y: q.y }; q.held = true; q.vx = q.vy = 0; Sound.play("monkeyGrab"); }
          const u = Math.min(1, (mk.t - down) / MONKEY.ferry), e = u * u * (3 - 2 * u);
          q.x = mk.from.x + (mk.spot.x - mk.from.x) * e;
          q.y = mk.from.y + (mk.spot.y - mk.from.y) * e - Math.sin(Math.PI * u) * 46;
          mk.x = q.x + HITBOX_W / 2;
          mk.y = q.y - 10;
          mk.frame = "carry";
          if (u >= 1) {
            q.held = false;
            q.x = mk.spot.x;
            q.y = mk.spot.y;
            q.vx = q.vy = 0;
            q.onGround = true;
            mk.mode = "leave";
            mk.t = 0;
          }
        }
      } else {
        // off it goes, up out of sight
        mk.frame = "leap";
        mk.y -= 180 * dt;
        mk.x += (mk.facing || 1) * 60 * dt;
        if (mk.y < -30 || mk.t > 3) mk.done = true;
      }
    }
    world.monkeys = world.monkeys.filter((mk) => !mk.done);
  }

  // ---- Purple catch-up orbs: portal gun, grapple and vine ----

  // Someone who's fallen off the leader's screen (alone: who has the fire on their screen) gets purple
  // orbs now and then, out of sight of both of you, ahead of them. The further behind, the more often.
  function updateCatchup() {
    const { level, players, fire } = world;
    const runners = players.filter((p) => !p.caught);
    let behind = null, far = 0, lo = 0, hi = 0;
    if (world.solo) {
      const p = runners[0];
      if (p && !p.dead && p.x - fire.x < CATCHUP.fireNear) {
        behind = p;
        far = 1 - Math.max(0, p.x - fire.x) / CATCHUP.fireNear;
        lo = p.x + VIEW_W * 0.65 + CATCHUP.margin;
        hi = lo + VIEW_W;
      }
    } else if (runners.length === 2) {
      const [trail, lead] = [...runners].sort((p, q) => p.trackX - q.trackX);
      const leadScreen = lead.x - VIEW_W * 0.35; // the left edge of the leader's screen
      if (!trail.dead && !lead.dead && trail.x + HITBOX_W < leadScreen) {
        behind = trail;
        far = Math.min(1, (leadScreen - trail.x - HITBOX_W) / CATCHUP.far);
        lo = trail.x + VIEW_W * 0.65 + CATCHUP.margin;
        hi = leadScreen - CATCHUP.margin - 8;
      }
    }
    if (!behind || world.monsoon) { world.nextCatchup = null; return; }
    const wait = CATCHUP.every[0] + (CATCHUP.every[1] - CATCHUP.every[0]) * far;
    if (world.nextCatchup === null) world.nextCatchup = world.time + wait;
    if (world.time < world.nextCatchup) return;
    world.nextCatchup = world.time + wait;
    const waiting = level.orbs.filter((o) => o.purple && !o.used && o.x > behind.x).length;
    if (waiting >= CATCHUP.maxWaiting || hi - lo < TILE * 2) return;
    // somewhere safe to stand under it, out of both screens, away from other orbs
    for (let from = lo; from < hi - TILE; from += 4 * TILE) {
      const spot = level.safeSpotAfter(from, hi - from - TILE);
      if (!spot) return;
      if (level.orbs.some((o) => !o.used && Math.abs(o.x - spot.x) < 6 * TILE)) { from = spot.x; continue; }
      const kinds = { ...CATCHUP.kinds };
      if (world.solo) delete kinds.grapple;
      level.orbs.push({ x: spot.x, y: spot.y + HITBOX_H - 32, w: 8, h: 8, used: false, kind: pickWeighted(kinds), purple: true });
      return;
    }
  }

  // Where the next `n` obstacles ahead of x end: pits, dangers (maces, saws, traps, turrets...) and
  // long runs of spikes or quicksand. A single spike doesn't count. Dangers close together count as one.
  function obstaclesEnd(x, n) {
    const { level } = world;
    let count = 0, cur = null;
    const close = () => {
      if (cur && (cur.big || cur.cols >= PORTAL_GUN.bigRun)) count++;
      return count >= n;
    };
    const first = Math.floor(x / TILE) + 1;
    for (let c = first; c < first + 800 && c < level.cols.length - 2; c++) {
      const g = level.groundTop(c * TILE);
      let big = false, small = false;
      if (g === null) big = true;
      else {
        if (level.tile(c, g / TILE - 1) === T_SPIKE || level.isQuick(c)) small = true;
        if (level.threatened(c * TILE + TILE / 2 - HITBOX_W / 2, g - HITBOX_H)) big = true;
      }
      if (!big && !small) {
        if (cur && c - cur.end > PORTAL_GUN.merge) { if (close()) return (cur.end + 1) * TILE; cur = null; }
        continue;
      }
      if (!cur) cur = { end: c, cols: 0, big: false };
      cur.end = c;
      cur.cols++;
      cur.big ||= big;
    }
    return close() ? (cur.end + 1) * TILE : null;
  }

  // The portal gun: a portal opens right in front of you, you're pulled in, and you come out
  // of another one on safe ground past the next 3 obstacles
  function firePortalGun(p) {
    const { level } = world;
    level.ensure(p.x + VIEW_W * 8);
    const end = obstaclesEnd(p.x + HITBOX_W, PORTAL_GUN.passes);
    const spot = end !== null && (level.safeSpotAfter(end) || landingAfter(end));
    if (!spot) return false;
    world.warps.push({ owner: p, from: { x: p.x, y: p.y }, door: p.x + HITBOX_W / 2 + 10, to: spot, t: 0, out: false });
    grab(p);
    p.facing = 1;
    Sound.play("portal");
    return true;
  }

  // Taken out of whatever they were doing: something else is moving them now
  function grab(p) {
    p.held = true;
    p.vx = p.vy = 0;
    p.inQuick = false;
    p.inRiver = null;
    p.trapped = 0;
    p.standingOn = null;
    p.dashHold = 0;
  }

  function updateWarps(dt) {
    for (const w of world.warps) {
      w.t += dt;
      if (w.done) continue; // (its portals fading away)
      const p = w.owner;
      if (p.caught || p.dead) { w.done = true; w.t = 0; p.warp = null; continue; }
      if (!w.out) {
        // sucked in, shrinking
        const u = Math.min(1, w.t / PORTAL_GUN.inTime);
        p.x = w.from.x + (w.door - HITBOX_W / 2 - w.from.x) * u;
        p.y = w.from.y;
        p.warp = { scale: 1 - u };
        if (u >= 1) { w.out = true; w.t = 0; p.x = w.to.x; p.y = w.to.y; Sound.play("portal"); }
      } else {
        const u = Math.min(1, w.t / PORTAL_GUN.outTime);
        p.warp = { scale: u };
        if (u >= 1) {
          w.done = true;
          w.t = 0;
          p.warp = null;
          p.held = false;
          p.onGround = false;
          p.safeSpots.push({ x: w.to.x, y: w.to.y });
        }
      }
    }
    world.warps = world.warps.filter((w) => !w.done || w.t < 0.5);
  }

  // The grapple: a hook flies to whoever is ahead and reels them back, halfway to you
  function throwGrapple(p) {
    const target = world.players.find((q) => q !== p && !q.caught && !q.dead && q.trackX > p.trackX);
    if (!target) { p.showHit("NOBODY AHEAD", "#d9a3ff"); return false; }
    world.grapples.push({ owner: p, target, x: p.x + HITBOX_W / 2, y: p.y + 4, mode: "fly", t: 0 });
    Sound.play("grappleThrow");
    return true;
  }

  function updateGrapples(dt) {
    const { level } = world;
    for (const g of world.grapples) {
      g.t += dt;
      const p = g.owner, q = g.target;
      if (g.mode === "fly") {
        if (q.caught || q.dead || p.caught || g.t > 6) { g.mode = "back"; continue; }
        const tx = q.x + HITBOX_W / 2, ty = q.y + 3;
        const dist = Math.hypot(tx - g.x, ty - g.y), step = GRAPPLE.speed * dt;
        if (dist > step) { g.x += ((tx - g.x) / dist) * step; g.y += ((ty - g.y) / dist) * step; continue; }
        g.x = tx;
        g.y = ty;
        if (q.held) continue; // (something else has them: hang on until it lets go)
        // hooked: reel them back to safe ground halfway between you
        const mid = (p.x + q.x) / 2;
        const spot = level.safeSpotBefore(mid) || level.safeSpotAfter(mid, q.x - mid);
        if (!spot || spot.x >= q.x) { g.mode = "back"; continue; }
        grab(q);
        q.eatenBy = null;
        q.hiddenIn = null;
        g.mode = "reel";
        g.from = { x: q.x, y: q.y };
        g.spot = spot;
        g.u = 0;
        q.showHit("HOOKED!", "#d9a3ff");
        Sound.play("grappleHook");
      } else if (g.mode === "reel") {
        if (q.caught || q.dead) { q.held = false; g.mode = "back"; continue; }
        const len = Math.max(1, Math.hypot(g.spot.x - g.from.x, g.spot.y - g.from.y));
        g.u = Math.min(1, g.u + (GRAPPLE.reel * dt) / len);
        q.x = g.from.x + (g.spot.x - g.from.x) * g.u;
        q.y = g.from.y + (g.spot.y - g.from.y) * g.u - Math.sin(Math.PI * g.u) * GRAPPLE.arc;
        g.x = q.x + HITBOX_W / 2;
        g.y = q.y + 3;
        if (g.u >= 1) {
          q.held = false;
          q.x = g.spot.x;
          q.y = g.spot.y;
          q.onGround = false;
          q.safeSpots.push({ x: g.spot.x, y: g.spot.y });
          g.mode = "back";
        }
      } else {
        // the rope zips back
        const tx = p.x + HITBOX_W / 2, ty = p.y + 4;
        const dist = Math.hypot(tx - g.x, ty - g.y), step = GRAPPLE.speed * 1.5 * dt;
        if (dist <= step || p.caught) g.done = true;
        else { g.x += ((tx - g.x) / dist) * step; g.y += ((ty - g.y) / dist) * step; }
      }
    }
    world.grapples = world.grapples.filter((g) => !g.done);
  }

  // The vine: it drops down, swings you up and flings you to where the player ahead of you was when you
  // grabbed it (whatever's there by then). Alone, or in the lead: far ahead, wherever.
  function launchVine(p) {
    world.level.ensure(p.x + VINE.distance[1] + VIEW_W * 2);
    const r = Math.max(60, p.y + 20); // (it hangs from just above the top of the screen)
    const dist = VINE.distance[0] + Math.random() * (VINE.distance[1] - VINE.distance[0]);
    const target = world.players.find((q) => q !== p && !q.caught && q.trackX > p.trackX) || null;
    const spot = target && vineLanding(target); // (where they are right now: it doesn't follow them)
    world.vines.push({ owner: p, spot, t: 0, mode: "drop", ax: p.x + HITBOX_W / 2, ay: p.y - r, r, dist, from: { x: p.x, y: p.y } });
    grab(p);
    p.facing = 1;
    p.spin = 0;
    Sound.play("vineSwing");
  }

  // Just above the player the vine takes you to (dead: where they'll come back), when you grab it
  function vineLanding(q) {
    return q.dead ? { x: q.respawnX, y: q.respawnY - 20 } : { x: q.x, y: q.y - 20 };
  }

  function updateVines(dt) {
    const { level } = world;
    for (const v of world.vines) {
      v.t += dt;
      const p = v.owner;
      if (p.caught || (p.dead && v.mode !== "gone")) { v.mode = "gone"; v.t = 0; }
      if (v.mode === "drop") {
        p.x = v.from.x;
        p.y = v.from.y;
        if (v.t >= VINE.drop) { v.mode = "swing"; v.t = 0; }
      } else if (v.mode === "swing") {
        const u = Math.min(1, v.t / VINE.swing), a = (Math.PI * 0.42) * u * u;
        p.x = v.ax + Math.sin(a) * v.r - HITBOX_W / 2;
        p.y = v.ay + Math.cos(a) * v.r;
        if (u >= 1) {
          v.mode = "fly";
          v.t = 0;
          v.start = { x: p.x, y: p.y };
          const lx = v.from.x + v.dist, g = level.groundTop(lx + HITBOX_W / 2);
          v.land = { x: lx, y: (g ?? VIEW_H - 20) - HITBOX_H - 20 };
          if (v.spot) v.land = v.spot;
          // (a long way takes longer: never faster than the camera can follow)
          v.flyTime = Math.max(VINE.fly, Math.abs(v.land.x - p.x) / VINE.topSpeed);
          Sound.play("vineFling");
        }
      } else if (v.mode === "fly") {
        const u = Math.min(1, v.t / v.flyTime);
        const mid = (v.start.y + v.land.y) / 2, h = mid - VINE.peak;
        p.x = v.start.x + (v.land.x - v.start.x) * u;
        p.y = v.start.y + (v.land.y - v.start.y) * u - h * 4 * u * (1 - u);
        p.spin = u * Math.PI * 2; // one somersault on the way
        if (u >= 1) {
          // let go: fall onto whatever's there
          p.held = false;
          p.spin = 0;
          p.vx = PHYSICS.runSpeed;
          p.vy = 60;
          p.onGround = false;
          v.mode = "gone";
          v.t = 0;
        }
      } else if (v.t > 0.5) v.done = true;
    }
    world.vines = world.vines.filter((v) => !v.done);
  }

  // ---- The snow's orbs: snowstorm and snowball ----

  function snowstormStrength() {
    const st = world.snowstorm;
    if (!st) return 0;
    return Math.max(0, Math.min(1, st.t / SNOWSTORM.fade, (SNOWSTORM.time - st.t) / SNOWSTORM.fade));
  }

  // While it blows (past its first half second), standing still freezes you (see Player.update)
  function updateSnowstorm(dt) {
    const st = world.snowstorm;
    if (st) {
      st.t += dt;
      if (st.t >= SNOWSTORM.time) world.snowstorm = null;
    }
    const on = snowstormStrength() >= 0.5;
    for (const p of world.players) p.snowstorm = on;
  }

  // Thrown the way you face, from about shoulder height, in a short low arc
  function throwSnowball(p) {
    const dir = p.facing;
    world.thrownSnowballs.push({ owner: p, x: p.x + HITBOX_W / 2 + dir * 4, y: p.y + 3, vx: dir * SNOWBALL.vx, vy: -SNOWBALL.vy });
    Sound.play("throwSnowball");
  }

  function updateThrownSnowballs(dt) {
    const { level, players } = world;
    for (const sb of world.thrownSnowballs) {
      sb.vy += SNOWBALL.gravity * dt;
      sb.x += sb.vx * dt;
      sb.y += sb.vy * dt;
      const half = SNOWBALL.size / 2;
      const hit = players.find((q) => q !== sb.owner && !q.dead && !q.caught && !q.held && !q.eatenBy &&
        overlaps(q.x, q.y, HITBOX_W, HITBOX_H, sb.x - half, sb.y - half, SNOWBALL.size, SNOWBALL.size));
      if (hit) {
        hit.iceLock = SNOWBALL.freeze;
        hit.stormIce = false; // (a snowstorm's ice gives way to the snowball's)
        hit.vx = 0;
        hit.showHit("FROZEN SOLID!", "#a8e0ff");
        hit.sparkle("#e8f8ff");
        Sound.play("freeze");
        sb.done = true;
      } else if (level.isSolid(Math.floor(sb.x / TILE), Math.floor((sb.y + half) / TILE)) || sb.y > VIEW_H + 10) {
        sb.done = true; // splat
        world.burns.push({ x: sb.x, y: sb.y - 1, t: 0, snow: true }); // (a puff of snow, drawn like a firehawk's burst)
      }
    }
    world.thrownSnowballs = world.thrownSnowballs.filter((sb) => !sb.done);
  }

  // Off it goes: out to the other player with a burning stick, or (alone) to circle you
  function launchHawk(p) {
    const other = world.players.find((q) => q !== p);
    const guard = world.solo || !other;
    world.hawks.push({ mode: guard ? "guard" : "attack", owner: p, target: other, x: p.x + HITBOX_W / 2, y: p.y - 6, t: 0, angle: -Math.PI / 2, facing: 1, flap: 0 });
    Sound.play("hawkScreech");
  }

  // The animals coming for p that a guarding firehawk will go for (once they're close)
  function preyFor(p) {
    const out = [];
    for (const v of world.vultures) if (v.target === p && ["circle", "diving", "skim", "carry"].includes(v.state)) out.push({ who: v, list: "vultures", x: v.x, y: v.y });
    for (const bear of world.bears) if (bear.target === p && bear.state !== "leave") out.push({ who: bear, list: "bears", x: bear.x - BEAR_W / 2, y: bear.y - 10 });
    for (const j of world.jaguars) if (j.target === p && ["leap", "run", "wait", "crouch", "attack"].includes(j.state)) out.push({ who: j, list: "jaguars", x: j.x, y: j.y - 6 });
    // ...and a missile locked on to you (it's not an animal, but it's coming for you all the same)
    for (const m of world.missiles) if (m.target === p && (m.state === "lock" || m.state === "fly")) out.push({ who: m, list: "missiles", x: m.x, y: m.y });
    return out.filter((a) => Math.abs(a.x - (p.x + HITBOX_W / 2)) < (a.list === "missiles" ? FIREHAWK.missileSense : FIREHAWK.guardSense));
  }

  function updateHawks(dt) {
    const { level } = world;
    for (const h of world.hawks) {
      h.t += dt;
      h.flap += dt * (h.mode === "dive" ? 4 : 8);
      const px = h.x, py = h.y;
      const steer = (tx, ty, speed) => {
        const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy);
        if (d <= speed * dt) { h.x = tx; h.y = ty; return true; }
        h.x += (dx / d) * speed * dt;
        h.y += (dy / d) * speed * dt;
        return false;
      };
      if (h.mode === "attack") {
        // fly to where the stick, dropped now, would land on them
        const q = h.target;
        const g = level.groundTop(q.x + HITBOX_W / 2) ?? q.y + HITBOX_H;
        const dropY = g - FIREHAWK.height;
        const fall = Math.sqrt((2 * Math.max(10, q.y + HITBOX_H / 2 - dropY)) / FIREHAWK.gravity);
        const aimX = q.x + HITBOX_W / 2 + (q.dead ? 0 : q.vx * fall);
        steer(aimX, dropY, FIREHAWK.speed);
        if (Math.abs(h.x - aimX) < 4 && Math.abs(h.y - dropY) < 6) {
          world.sticks.push({ x: h.x, y: h.y + 6, vy: 0, t: 0 });
          Sound.play("stickDrop");
          h.mode = "leave";
          h.t = 0;
        }
        if (h.t > 6) h.mode = "leave"; // (never caught up)
      } else if (h.mode === "guard") {
        const p = h.owner;
        h.angle += dt * 3;
        steer(p.x + HITBOX_W / 2 + Math.cos(h.angle) * FIREHAWK.guardRadius, p.y - 16 + Math.sin(h.angle) * 6, 200);
        if (!p.dead && !p.caught) {
          const prey = preyFor(p)[0];
          if (prey) { h.mode = "dive"; h.prey = prey; Sound.play("hawkScreech"); }
        }
      } else if (h.mode === "dive") {
        const prey = h.prey, who = prey.who;
        if (who.done || !world[prey.list].includes(who)) { h.mode = "guard"; continue; }
        const now = prey.list === "bears" ? [who.x - BEAR_W / 2, who.y - 10] : prey.list === "jaguars" ? [who.x, who.y - 6] : [who.x, who.y];
        if (steer(now[0], now[1], FIREHAWK.diveSpeed) || Math.hypot(now[0] - h.x, now[1] - h.y) < 8) {
          // burned up!
          if (prey.list === "vultures" && who.state === "carry") { const p = who.target; p.held = false; p.vx = p.vy = 0; p.onGround = false; p.stun = 0.3; }
          who.done = true;
          world.burns.push({ x: now[0], y: now[1], t: 0 });
          h.owner.showHit("FIREHAWK!", "#ff7a1a");
          Sound.play("hawkBurn");
          h.mode = "leave";
          h.t = 0;
        }
      } else {
        // off it goes, up and away
        h.x += h.facing * 160 * dt;
        h.y -= 110 * dt;
        if (h.y < -40 || h.t > 4) h.done = true;
      }
      if (h.mode !== "leave" && Math.abs(h.x - px) > 0.2) h.facing = h.x > px ? 1 : -1;
    }
    world.hawks = world.hawks.filter((h) => !h.done);
    for (const b of world.burns) b.t += dt;
    world.burns = world.burns.filter((b) => b.t < 0.8);
  }

  // A burning stick tumbling down: it kills whoever it hits, and sets the ground alight where it lands
  function updateSticks(dt) {
    const { level, players } = world;
    for (const st of world.sticks) {
      st.t += dt;
      st.vy += FIREHAWK.gravity * dt;
      st.y += st.vy * dt;
      for (const p of players) {
        if (p.dead || p.caught || p.held || p.eatenBy || !overlaps(p.x, p.y, HITBOX_W, HITBOX_H, st.x - 2, st.y - 2, 4, 4)) continue;
        p.showHit("BURNED!", "#ff7a1a");
        p.die();
      }
      const g = level.groundTop(st.x);
      if (g !== null && st.y >= g - 1) {
        level.fires.push({ x: st.x, gy: g, t: 0 });
        Sound.play("fireIgnite");
        st.done = true;
      } else if (st.y > VIEW_H + 10) st.done = true; // (down a pit)
    }
    world.sticks = world.sticks.filter((st) => !st.done);
  }

  // Burning ground: touch the flames and you die (they're low: jump over them)
  function updateFires(dt) {
    const { level, players } = world;
    for (const f of level.fires) {
      f.t += dt;
      const half = FIREHAWK.fireHalf * Math.min(1, f.t / FIREHAWK.spread);
      for (const p of players) {
        if (p.dead || p.caught || p.held || p.eatenBy) continue;
        if (p.x + HITBOX_W > f.x - half + 2 && p.x < f.x + half - 2 && p.y + HITBOX_H > f.gy - FIREHAWK.fireTall && p.y < f.gy + 2) {
          p.showHit("BURNED!", "#ff7a1a");
          p.die();
        }
      }
    }
    level.fires = level.fires.filter((f) => f.t < FIREHAWK.fireTime);
  }

  // ---- Ancient turrets (jungle) ----

  // A turret is shared: whoever comes first sets it off, and its arrows hit anyone in the way
  function updateTurrets(dt) {
    const { level, players } = world;
    const free = (p) => !p.dead && !p.caught && !p.held && !p.eatenBy && !p.inRiver;
    // Which arrows it'll shoot, picked when it wakes up: a sleep dart always goes first (so the next
    // arrow finds you asleep) and a blunt one always last (it knocks you out of reach of the rest)
    const ORDER = { sleep: 0, arrow: 1, poison: 1, blunt: 2 };
    const plan = (tu) => {
      const kinds = [];
      for (let i = 0; i < tu.shotsLeft; i++) kinds.push(Math.floor(tu.x / TILE) < level.baseAt ? "arrow" : pickWeighted(TURRET.kinds));
      tu.plan = kinds.sort((a, b) => ORDER[a] - ORDER[b]);
    };
    // what it shoots next: low or regular, and the next arrow in its plan
    const load = (tu) => {
      tu.low = Math.random() < 0.5;
      tu.kind = tu.plan.shift() || "arrow";
    };
    for (const tu of level.turrets) {
      if (tu.state === "done" || !players.some((p) => Math.abs(p.x - tu.x) < VIEW_W * 1.5)) continue;
      tu.t += dt;
      const shot = tu.low ? "low" : "regular";
      const want = tu.state === "sink" || tu.state === "hidden" || tu.state === "rumble" ? 0 : TURRET.heights[shot];
      tu.moving = tu.h !== want; // (it shakes while it grinds up or down)
      tu.h = approach(tu.h, want, (TURRET.heights.regular / (tu.state === "sink" ? TURRET.sink : TURRET.rise[shot])) * dt);
      if (tu.state === "hidden") {
        const near = (p) => free(p) && Math.abs(p.y + HITBOX_H - tu.gy) < 40 &&
          (tu.dir < 0 ? tu.x - p.x > 0 && tu.x - p.x < TURRET.sense : p.x - tu.x > tu.wait && p.x - tu.x < tu.wait + 60);
        if (players.some(near)) {
          tu.state = "rumble";
          tu.t = 0;
          tu.shotsLeft = level.wild ? WILD.turretShots : 1 + Math.floor(Math.random() * TURRET.shots[1]);
          plan(tu);
          load(tu);
          Sound.play("turretRumble");
        }
      } else if (tu.state === "rumble") {
        if (tu.t >= TURRET.rumble) { tu.state = "aim"; tu.t = 0; Sound.play("turretRise"); }
      } else if (tu.state === "aim") {
        // (the glow only starts once it's up)
        if (tu.h === want && tu.t >= TURRET.rise[shot] + (level.wild ? WILD.turretAim : TURRET.aim)[shot]) {
          world.arrows.push({ x: tu.x + tu.dir * 8, y: tu.gy - tu.h + 13, dir: tu.dir, kind: tu.kind, vx: tu.dir * TURRET.speed[shot], vy: 0, t: 0 });
          Sound.play("arrowShoot");
          tu.shotsLeft--;
          tu.state = tu.shotsLeft > 0 ? "reload" : "sink";
          tu.t = 0;
          if (tu.state === "sink") Sound.play("turretRise");
        }
      } else if (tu.state === "reload") {
        if (tu.t >= (level.wild ? WILD.turretReload : TURRET.reload)) {
          load(tu);
          // another shot, but only at someone still a fair way out in front of it (never point-blank)
          const next = tu.low ? "low" : "regular";
          const room = TURRET.closest + PHYSICS.runSpeed * (level.wild ? WILD.turretAim : TURRET.aim)[next];
          const mouth = tu.x + tu.dir * 8;
          if (players.some((p) => free(p) && (tu.dir < 0 ? mouth - (p.x + HITBOX_W) : p.x - mouth) > room)) { tu.state = "aim"; tu.t = TURRET.rise[next]; }
          else { tu.state = "sink"; tu.t = 0; Sound.play("turretRise"); }
        }
      } else if (tu.state === "sink" && tu.h === 0) {
        tu.state = "done";
        tu.moving = false; // (back in the ground: no more shaking or dust)
      }
    }
  }

  // Arrows fly fast along the ground, dropping a little as they go, until they hit someone or a
  // wall, or stick in the ground (where they stay a moment, harmless, then fade)
  function updateArrows(dt) {
    const { level, players } = world;
    for (const a of world.arrows) {
      a.t += dt;
      if (a.stuck) { if (a.t >= TURRET.stuck) a.done = true; continue; }
      a.vy += TURRET.drop * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.y > VIEW_H || level.isSolid(Math.floor(a.x / TILE), Math.floor((a.y + 1) / TILE))) {
        const g = level.groundTop(a.x);
        if (g !== null && a.y + 1 >= g - 1 && a.y < g + 2) { a.stuck = true; a.y = g; a.t = 0; } // its tip digs into the ground
        else a.done = true; // (a wall, or down a pit)
        continue;
      }
      const bx = a.dir < 0 ? a.x : a.x - 12; // its tip is at a.x
      const p = players.find((q) => !q.dead && !q.caught && !q.held && !q.eatenBy && !q.inRiver && overlaps(q.x, q.y, HITBOX_W, HITBOX_H, bx, a.y, 12, 3));
      if (!p) continue;
      a.done = true;
      if (a.kind === "arrow") {
        p.showHit("ARROW!", "#ff4d3d");
        p.die();
      } else if (a.kind === "poison") {
        p.poison = TURRET.poison;
        p.showHit("POISONED!", "#7dff4a");
        Sound.play("poisoned");
      } else if (a.kind === "sleep") {
        p.asleep = TURRET.sleep;
        p.vx = 0;
        p.showHit("SLEEPY...", "#6ac8ff");
        Sound.play("sleepDart");
      } else {
        throwPlayer(p); // knocked back, as far as the hand's backhand
        p.dizzy = TURRET.bluntDizzy;
        p.showHit("THWACK!", "#ffd23f");
        p.sparkle("#ffd23f");
        Sound.play("smack");
      }
    }
    world.arrows = world.arrows.filter((a) => !a.done);
  }

  // ---- Jaguars (jungle) ----

  // Its box: [x, y, w, h], with (j.x, j.y) the middle of its feet
  const jaguarBox = (j) => [j.x - 12, j.y - 13, 24, 12];

  // It hides in one of the background bushes ahead (false: there isn't one there yet)
  function spawnJaguar(leader, kindName) {
    const bush = hidingBush(leader.x + JAGUAR.ahead[0], leader.x + JAGUAR.ahead[1]);
    if (!bush) return false;
    const ey = bush.y - Math.round(JUNGLE.backBushes[bush.v][1] * 0.6);
    world.jaguars.push({ kind: kindName, target: leader, state: "eyes", t: 0, ex: bush.x, ey, x: bush.x, y: bush.y - 6, dir: -1, attacks: JAGUAR[kindName].attacks, anim: 0 });
    return true;
  }

  // A background bush between x0 and x1 that nothing is peering out of already
  function hidingBush(x0, x1) {
    const taken = [...world.jaguars, ...world.decoys].map((e) => e.ex);
    const bushes = world.level.backBushes(x0, x1).filter((bu) => bu.x >= x0 && bu.x <= x1 && !taken.some((x) => Math.abs(x - bu.x) < 20));
    return bushes.length ? bushes[Math.floor(Math.random() * bushes.length)] : null;
  }

  // Harmless eyes that blink in a bush now and then, so you can never be sure (they never narrow)
  function updateDecoys(dt) {
    const runners = world.players.filter((p) => !p.dead && !p.caught);
    for (const d of world.decoys) d.t += dt;
    world.decoys = world.decoys.filter((d) => d.t < d.life);
    if (!runners.length) return;
    const p = runners[Math.floor(Math.random() * runners.length)];
    if (world.level.biomeAt(Math.floor(p.x / TILE)) !== "jungle") { world.nextDecoy = null; return; }
    if (world.nextDecoy === null) world.nextDecoy = world.time + rand(JAGUAR.decoys[0], JAGUAR.decoys[1]);
    if (world.time < world.nextDecoy) return;
    world.nextDecoy = null;
    const bush = hidingBush(p.x + 60, p.x + 240);
    if (!bush) return;
    const kinds = world.level.wild || p.x / TILE >= world.level.specialAt ? ["jaguar", "panther"] : ["jaguar"];
    world.decoys.push({ kind: kinds[Math.floor(Math.random() * kinds.length)], ex: bush.x, ey: bush.y - Math.round(JUNGLE.backBushes[bush.v][1] * 0.6), t: 0, life: rand(1.6, 2.8), blink: rand(0.6, 1.2) });
  }

  // Where it lands near x: the nearest firm ground (never in a pit or a river)
  function jaguarGround(x, fallbackY) {
    const { level } = world;
    for (let d = 0; d < 80; d += 4) for (const s of [1, -1]) {
      const g = level.groundTop(x + s * d);
      if (g !== null && !level.riverAt(x + s * d)) return { x: x + s * d, y: g };
    }
    return { x, y: fallbackY };
  }

  function updateJaguars(dt) {
    const { level, players } = world;
    const runners = players.filter((p) => !p.dead && !p.caught);
    if (runners.length) {
      const leader = runners.reduce((a, b) => (b.x > a.x ? b : a));
      const busy = world.jaguars.some((j) => j.state !== "leave");
      const inJungle = level.biomeAt(Math.floor(leader.x / TILE)) === "jungle";
      const pick = (meters) => (meters >= level.specialAt && Math.random() < 0.5 ? "panther" : "jaguar"); // black panthers come later
      if (world.wild) {
        // Wild: always one hunting you in the jungle: when one gives up, the next comes
        if (!inJungle || busy) world.nextWildJaguar = null;
        else if (world.nextWildJaguar === null) world.nextWildJaguar = world.time + WILD.jaguarGap;
        else if (world.time >= world.nextWildJaguar && spawnJaguar(leader, pick(leader.x / TILE))) world.nextWildJaguar = null;
      }
      let taken = busy;
      for (const spot of world.wild ? [] : level.jaguarSpots) {
        if (spot.used || leader.x / TILE < spot.col || taken) continue;
        if (!inJungle || leader.x / TILE < level.baseAt) { spot.used = true; continue; }
        if (spawnJaguar(leader, pick(leader.x / TILE))) { spot.used = true; taken = true; } // (else: the next bush ahead)
      }
    }

    for (const j of world.jaguars) {
      const k = JAGUAR[j.kind], p = j.target;
      j.t += dt;
      const pcx = p.x + HITBOX_W / 2;
      if (p.caught && j.state !== "leave") { j.state = "leave"; j.t = 0; }
      if (j.state === "eyes") {
        // glowing in the trees (it can't be got at here), then it leaps out at where you'll be
        if (j.t >= JAGUAR.eyes) {
          const side = Math.sign(j.ex - pcx) || 1; // the side it comes at you from
          Object.assign(j, { state: "leap", t: 0, fromX: j.ex, fromY: j.ey + 6, side, toX: pcx, toY: p.y + HITBOX_H, lunging: false });
          j.dir = -side;
          Sound.play("jaguarRoar");
        }
      } else if (j.state === "leap") {
        // Out of the bush and through the air at you, following you wherever you go (changing speed
        // won't help)...
        const where = p.dead ? p.respawnX + HITBOX_W / 2 : pcx;
        const ground = level.groundTop(where) ?? p.y + HITBOX_H;
        if (j.t < k.leap) {
          const u = j.t / k.leap;
          j.toX = where;
          j.toY = ground;
          const tx = where + j.side * 30, ty = ground - 3; // ...coming in low, just short of you...
          j.x = j.fromX + (tx - j.fromX) * u;
          j.y = j.fromY + (ty - j.fromY) * u - 22 * 4 * u * (1 - u);
          j.scale = 0.45 + 0.55 * u; // (coming out of the background towards you)
        } else {
          // ...then a low lunge straight through where you are: JUMP it
          if (!j.lunging) {
            const cross = where + p.vx * k.lunge * 0.5;
            const land = jaguarGround(cross + (cross - j.x), ground);
            Object.assign(j, { lunging: true, lx0: j.x, ly0: j.y, lx1: land.x, ly1: land.y, scale: 1 });
          }
          const u = Math.min(1, (j.t - k.leap) / k.lunge);
          j.x = j.lx0 + (j.lx1 - j.lx0) * u;
          j.y = j.ly0 + (j.ly1 - j.ly0) * u;
          if (jaguarHits(j)) continue;
          if (u >= 1) { j.state = j.attacks > 0 ? "run" : "leave"; j.t = 0; Sound.play("land"); }
        }
      } else if (j.state === "run" || j.state === "wait") {
        if (p.dead) {
          // you died to something else: it goes to wait just in front of where you'll come back
          const spot = jaguarGround(p.respawnX + HITBOX_W / 2 + JAGUAR.waitAhead, j.y);
          const d = spot.x - j.x;
          j.dir = Math.sign(d) || j.dir;
          if (Math.abs(d) > 2) { j.x += j.dir * Math.min(Math.abs(d), k.run * dt); j.anim += dt; }
          else j.dir = -1;
          const g = level.groundTop(j.x);
          if (g !== null) j.y = g;
          j.state = "wait";
          continue;
        }
        j.state = "run";
        const d = pcx - j.x;
        j.dir = Math.sign(d) || j.dir;
        // How far apart you'd be when it springs, if it crouched now. Too close (you're running at it,
        // or it landed right by you): it backs off first, so you always get a fair look at its crouch.
        const gap = Math.abs(d + p.vx * k.crouch);
        let move = 0;
        if (gap < JAGUAR.room) move = -j.dir;
        else if (Math.abs(d) < JAGUAR.strike || gap < JAGUAR.strike) {
          j.state = "crouch";
          j.t = 0;
          j.high = Math.random() < 0.5; // leap over you, or pounce at you
          Sound.play(j.high ? "jaguarGrowl" : "jaguarSnarl");
        } else move = j.dir;
        if (move) {
          j.x += move * k.run * dt;
          j.anim += dt;
          j.backing = move !== j.dir;
          const g = level.groundTop(j.x);
          if (g !== null) j.y = g;
        }
      } else if (j.state === "crouch") {
        // you're running right into it: it breaks off and backs away (then crouches again)
        if (Math.abs(pcx - j.x + p.vx * Math.max(0, k.crouch - j.t)) < JAGUAR.room - 6) { j.state = "run"; continue; }
        if (j.t >= k.crouch) {
          // spring: it passes over (or through) where you'll be 55% of the way through, and lands past you
          j.dur = j.high ? k.over : k.pounce;
          const cross = pcx + p.vx * j.dur * 0.55;
          const dir = Math.sign(cross - j.x) || j.dir;
          const far = Math.max(Math.abs(cross - j.x) / 0.55, Math.abs(cross - j.x) + JAGUAR.overshoot);
          const land = jaguarGround(j.x + dir * far, j.y);
          const under = level.groundTop(cross) ?? j.y;
          const mid = j.y + (land.y - j.y) * 0.55;
          const lift = j.high ? Math.max(JAGUAR.over, mid - (under - JAGUAR.over)) / 0.99 : 3;
          Object.assign(j, { state: "attack", t: 0, fromX: j.x, fromY: j.y, toX: land.x, toY: land.y, lift, crossX: cross });
          j.dir = land.x >= j.x ? 1 : -1;
          Sound.play("jaguarRoar");
        }
      } else if (j.state === "attack") {
        const u = Math.min(1, j.t / j.dur);
        j.x = j.fromX + (j.toX - j.fromX) * u;
        j.y = j.fromY + (j.toY - j.fromY) * u - j.lift * 4 * u * (1 - u);
        if (jaguarHits(j)) continue;
        if (u >= 1) {
          j.attacks--;
          j.state = j.attacks > 0 ? "run" : "leave";
          j.t = 0;
          Sound.play("land");
        }
      } else if (j.state === "leave") {
        // gives up and slinks off, away from you (gone once nobody can see it)
        j.dir = j.x >= pcx ? 1 : -1;
        j.x += j.dir * k.run * dt;
        j.anim += dt;
        const g = level.groundTop(j.x);
        if (g !== null) j.y = g;
        if (j.t > 8 || players.every((q) => Math.abs(j.x - (q.x + HITBOX_W / 2)) > VIEW_W)) j.done = true;
      }
    }
    world.jaguars = world.jaguars.filter((j) => !j.done);
  }

  // Did it get the player it's after? (Only them: it ignores anyone else.)
  function jaguarHits(j) {
    const p = j.target;
    if (p.dead || p.caught || p.held || p.eatenBy || p.inRiver) return false;
    if (!overlaps(p.x, p.y, HITBOX_W, HITBOX_H, ...jaguarBox(j))) return false;
    p.showHit("POUNCED!", "#ff4d3d");
    p.die();
    Sound.play("maul");
    j.state = "leave"; // got you: it's done
    j.t = 0;
    return true;
  }

  // ---- Vultures (desert) ----

  function spawnVultures(leader) {
    const n = Number(pickWeighted(VULTURE.groupSizes));
    const blackAllowed = leader.x / TILE >= world.level.specialAt; // black vultures come later
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
      if (world.wild) {
        // Wild: vultures the whole time in the desert: when a group is done, the next comes in
        const busy = world.vultures.some((v) => v.state !== "leave");
        if (level.biomeAt(Math.floor(meters)) !== "desert" || busy) world.nextWildVulture = null;
        else if (world.nextWildVulture === null) world.nextWildVulture = world.time + WILD.vultureGap;
        else if (world.time >= world.nextWildVulture) {
          world.nextWildVulture = null;
          spawnVultures(leader);
        }
      } else if (level.biomeAt(Math.floor(meters)) === "desert" && meters >= level.baseAt) {
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
          p.inRiver = null;
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
    sandstormStrength,
    floodSurface,
    monsoonStrength: () => (world.monsoon ? Math.max(0, Math.min(1, world.monsoon.t / 0.6, (MONSOON.time - world.monsoon.t) / 0.6)) : 0),
    snowstormStrength,
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
      const picked = (options.biomeList || BIOMES).filter((b) => BIOMES.includes(b));
      biomeList = options.biomes === true && picked.length ? picked : ["prairie"];
      wild = options.wild === true;
      canvas.height = (solo ? VIEW_H : VIEW_H * 2 + DIVIDER) * SCALE;
      canvas.style.aspectRatio = `auto ${canvas.width} / ${canvas.height}`;
      Sound.unlock(); // the Start click lets the browser play sound
      // the first race after opening the website starts in the prairie (if it's one of them)
      const first = racesStarted++ === 0 && biomeList.includes("prairie");
      newWorld(first ? "prairie" : biomeList[Math.floor(Math.random() * biomeList.length)]);
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
