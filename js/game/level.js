// Endless level generator.
//
// There is only ONE level in memory. Both players run through the same data,
// so their courses are always exact copies: each half of the screen is just a
// camera following one player through it. New sections are added on the right
// whenever the leading player gets near the end, so the level never runs out.
//
// The level is stitched together from hand-designed sections (a gap, some
// spikes, a moving platform...). Each section is built so it can always be
// cleared with a normal jump, and the sections get harder the further you go.

const T_EMPTY = 0;
const T_GROUND = 1;
const T_SPIKE = 2;
const T_SHOOTER = 3; // a solid block that fires spikes diagonally

// The four diagonal directions a shooter fires in
const SHOOTER_DIRS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

const MIN_GROUND_ROW = 8;  // highest the ground surface can go
const MAX_GROUND_ROW = 12; // lowest the ground surface can go

// Small random number generator that gives the same numbers for the same seed,
// so a level can be recreated exactly.
function makeRng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// How tall a bush is in each of its columns: tops[x] = the first leafy row from the top
// (or null if that column is empty). Shared by drawing and hiding, so what you see is what hides you.
function bushShape(w, h, seed) {
  const bumps = 3 + Math.round(w / 6);
  const ph = seed * 1.7;
  return (x, y) => {
    const nx = (x + 0.5 - w / 2) / (w / 2), ny = (h - (y + 0.5)) / h; // nx -1..1, ny 0 (ground)..1 (top)
    if (ny < 0 || Math.abs(nx) > 1.05) return false;
    const a = Math.atan2(ny, nx);
    const lumpy = 1 + 0.09 * Math.sin(a * bumps + ph) + 0.05 * Math.sin(a * bumps * 2.3 + ph * 2);
    return Math.sqrt(nx * nx + ny * ny) <= lumpy && !(ny < 0.12 && Math.abs(nx) > 0.92);
  };
}

function bushTops(w, h, seed) {
  const inside = bushShape(w, h, seed);
  const tops = [];
  for (let x = 0; x < w; x++) {
    let top = null;
    for (let y = 0; y < h && top === null; y++) if (inside(x, y)) top = y;
    tops.push(top);
  }
  return tops;
}

// Where you stand on a river log (null: it's under water, or too far under to hold you)
function logTop(p) {
  return p.hidden || p.sinkY > 3 ? null : p.y + p.sinkY;
}

class Level {
  constructor(seed, startBiome = "prairie", options = {}) {
    this.rng = makeRng(seed);
    this.solo = options.solo === true; // 1 player: only orbs that help you on your own
    this.wild = options.wild === true; // Wild mode: dangers from the start, faster obstacles, more big traps
    this.baseAt = this.wild ? 0 : THREATS.baseAt;       // where the dangers start (meters)
    this.specialAt = this.wild ? 0 : THREATS.specialAt; // ...and the worse ones
    this.pace = this.wild ? WILD.speedUp : 1;           // obstacles' timing (smaller = faster)
    this.biome = startBiome;  // the biome new columns are built in
    this.colBiome = [];       // colBiome[x] = which biome each column is in
    this.ice = [];            // ice[x] = true where the ground's surface is slippery ice
    this.signs = [];          // wooden signs where a new biome starts
    this.sleepShrooms = [];   // giant sleep mushrooms (the way into the enchanted forest): { id, x (its foot), gy, seed, forest }
    this.realmEnd = options.realmEnd; // (an enchanted forest you're sent to: where it ends, pixels)
    this.icicles = [];        // icicles hanging under snowy ledges
    this.snowballSpots = [];  // where snowballs start rolling from
    this.bearSpots = [];      // twice per snow biome: when the leader gets here, a bear charges in
    this.jaguarSpots = [];    // once or twice per jungle biome: when the leader gets here, a jaguar's eyes appear
    this.missileSpots = [];   // in the prairie: when the leader gets here, a missile comes
    this.quick = [];          // quick[x] = true where the ground's surface is quicksand
    this.spikeKind = [];      // jungle: spikeKind[x] = "thorn" (a thorn bush) or a bamboo stake's height in pixels
    this.tumbleSpots = [];    // where tumbleweeds start rolling from
    this.cols = [];      // cols[x][row] = tile type
    this.platforms = []; // { kind: "static" | "move" | "fall", x, y, w }
    this.portals = [];   // entrances, each with the exit it leads to
    this.exits = [];     // where portals come out (drawn only)
    this.orbs = [];      // swap orbs
    this.maces = [];     // spiked balls swinging on chains
    this.shooters = [];  // blocks that fire spikes diagonally
    this.saws = [];      // spinning saw blades: sliding along a slot in the ground, or up and down a rail
    this.traps = [];     // bear traps in the prairie grass: { id, x (middle), size, bush }
    this.bushes = [];    // bushes you can hide in: { x0, w, h, gy, seed, berries, tops, torn }
    this.scatterFrom = 0; // traps, bushes and sinkholes have been sprinkled over the course up to here
    this.sinkholes = [];  // desert sinkholes: { id, x (middle), col, size, gy, state: idle | open, openedAt }
    this.pending = [];    // sinkholes and thin ice a section wants: put in once the ground round them is built and checked
    this.ponds = [];      // snow: thin ice over water: { id, x0, x1 (pixels), gy, state: ice | water, frozen: players stuck in it }
    this.sporeShrooms = []; // forest: big spore mushrooms { id, x (its foot), gy, kind, seed, lean (-1 left, 1 right) }
    this.flytraps = [];   // jungle: giant flytraps { id, x (middle), gy, big, state: open | windup | chew | chewNothing | opening, t, victim }
    this.fires = [];      // desert: ground set alight by a firehawk's stick { x (middle), gy, t }
    this.turrets = [];    // jungle: ancient turrets buried in the ground { id, x (middle), gy, dir (-1 shoots left, 1 right), wait, state, t, h (how far up) }
    this.palms = [];      // jungle: palm trees { id, x (trunk's foot), gy, h, kind, cx, cy (its crown), nuts: [[dx, dy]] (from the crown), drop: [dx, dy] (the one that falls) or null }
    this.lastPalm = 0;
    this.rivers = [];     // jungle: { id, x0, x1 (pixels), gy (the banks' top), wy (the water's surface) }; its logs are platforms
    this.time = 0;
    this.groundRow = MAX_GROUND_ROW;
    this.lastOrbCol = 0;
    this.nextId = 1;
    this.biomes = options.biomes !== false; // off: the whole course stays in the starting biome
    this.biomeList = options.biomeList || BIOMES; // the biomes it can change to
    this.biomeEnd = this.biomes ? this.rand(BIOME_LENGTH[0], BIOME_LENGTH[1]) : Infinity;
    this.biomeStart = 0;
    this.pondTarget = this.rand(THIN_ICE.perBiome[0], THIN_ICE.perBiome[1]); // thin ice patches this snow biome gets (at least)
    // With biomes off it's all prairie: every MISSILE.stretch meters counts as one "biome" for the missiles
    this.stretchEnd = this.biomes ? Infinity : MISSILE.stretch;
    this.addBiomeEvents(this.biomes ? this.biomeEnd : MISSILE.stretch);
    this.flat(30); // calm start
  }

  // ---- Reading the level ----

  tile(col, row) {
    if (col < 0) return T_GROUND; // invisible wall behind the start line
    if (row < 0 || row >= ROWS || col >= this.cols.length) return T_EMPTY;
    return this.cols[col][row];
  }

  isSolid(col, row) {
    const t = this.tile(col, row);
    return t === T_GROUND || t === T_SHOOTER;
  }

  // Make sure the level is generated at least up to this x position.
  ensure(x) {
    while (this.cols.length * TILE < x) this.addSection();
  }

  // Move the moving platforms. `time` is seconds since the race started.
  update(time) {
    this.time = time;
    for (const p of this.platforms) {
      if (p.kind === "log") { this.moveLog(p, time); continue; }
      if (p.kind !== "move") continue;
      const t = 0.5 - 0.5 * Math.cos(2 * Math.PI * (time / p.period + p.phase));
      const newX = p.x0 + (p.x1 - p.x0) * t;
      p.dx = newX - p.x;
      p.x = newX;
    }
    // the forest's floating shooters, and the platform on top of each that carries you along
    for (const s of this.shooters) {
      if (!s.float) continue;
      s.x = this.shooterX(s, time);
      const p = s.float.top, newX = s.x - TILE / 2;
      p.dx = newX - p.x;
      p.x = newX;
    }
  }

  // Where a shooter is at time t: most stay put, but in the forest they float left and right
  shooterX(s, t) {
    return s.float ? s.x0 + s.float.amp * Math.sin(2 * Math.PI * (t / s.float.period + s.float.phase)) : s.x;
  }

  // A log on a river: worked out from the clock (like the moving platforms), so both players see the
  // same one. u = how far it has drifted since it bobbed up at the far bank.
  moveLog(p, time) {
    const r = p.river;
    const u = (((time * r.speed + p.k * r.spacing + r.phase) % r.loop) + r.loop) % r.loop;
    const travel = r.x1 - r.x0 - p.w, riseU = r.speed * RIVER.rise, sinkU = r.speed * RIVER.sink;
    let x, sink = 0;
    p.hidden = false;
    if (u < travel) {
      x = r.x1 - p.w - u;
      if (u < riseU) sink = 5 * (1 - u / riseU); // still bobbing up
    } else if (u < travel + sinkU) {
      x = r.x0;                                   // bumped into the near bank: going under
      sink = 6 * (u - travel) / sinkU;
    } else {
      x = r.x1 - p.w;                             // under water, on its way back round
      p.hidden = true;
    }
    p.dx = p.hidden || Math.abs(x - p.x) > 8 ? 0 : x - p.x;
    p.x = x;
    p.sinkY = sink;
  }

  riverAt(x) {
    return this.rivers.find((r) => x >= r.x0 && x < r.x1) || null;
  }

  // Where a saw blade's center is at a given time. It glides from (x0, y0) to (x1, y1)
  // and back, slowing down at each end. Worked out from the clock like the maces.
  sawPos(s, time) {
    if (s.loose) return { x: s.loose.x, y: s.loose.y }; // (a forest saw that broke loose: it moves itself)
    if (s.gone) return { x: -1e6, y: -1e6 };
    const t = 0.5 - 0.5 * Math.cos(2 * Math.PI * (time / s.period + s.phase));
    return { x: s.x0 + (s.x1 - s.x0) * t, y: s.y0 + (s.y1 - s.y0) * t };
  }

  // Where a mace's chain links and ball are at a given time. Used both for
  // drawing and for hitting players, so what you see is exactly what hurts.
  //
  // It swings like a pendulum (fast at the bottom, slowing at each end). Each
  // link further down the chain lags slightly behind the one above it, so the
  // chain bends like a whip instead of swinging as a stiff stick.
  macePoints(m, time) {
    const links = [];
    const steps = Math.max(4, Math.round(m.length / 5));
    const seg = m.length / steps;
    const phase = 2 * Math.PI * (time / m.period + m.phase);
    let x = m.x;
    let y = m.y;
    let angle = 0;
    for (let i = 1; i <= steps; i++) {
      const lag = (i / steps) * 0.55;
      angle = m.amplitude * Math.sin(phase - lag) + 0.05 * Math.sin(2 * (phase - lag)); // small wobble
      x += Math.sin(angle) * seg;
      y += Math.cos(angle) * seg;
      links.push({ x, y });
    }
    // Spin follows the swing (like it's rolling through the air) plus a steady twirl
    const spin = angle * 2.5 + time * m.spin;
    return { links, ball: { x, y }, spin, speed: Math.abs(Math.cos(phase)) };
  }

  // Top of the ground at an x position, or null over a pit. Lightning bolts run along this.
  // (Searched from the bottom up, so a ledge in the sky doesn't count as the ground.)
  groundTop(x) {
    const col = this.cols[Math.floor(x / TILE)];
    if (!col || col[ROWS - 1] !== T_GROUND) return null;
    let row = ROWS - 1;
    while (row > 0 && col[row - 1] === T_GROUND) row--;
    return row * TILE;
  }

  // Which biome a column is in
  biomeAt(col) {
    return this.colBiome[clamp(col, 0, this.colBiome.length - 1)] || this.biome;
  }

  // The closest place at or before x (looking back up to `range` pixels) where a runner can
  // safely come back after dying: firm, flat ground two tiles wide, with nothing dangerous
  // nearby (spikes, quicksand, pits, maces, shooter spikes or icicles about to drop).
  safeSpotBefore(x, range = 480) {
    return this.findSafeSpot(x, -1, range);
  }

  // The same, but looking forward (used to drop someone past a pit or in front of a player)
  safeSpotAfter(x, range = 480) {
    return this.findSafeSpot(x, 1, range);
  }

  findSafeSpot(x, dir, range) {
    const safeCol = (c) => {
      const col = this.cols[c];
      const g = this.groundTop(c * TILE);
      if (!col || g === null || this.isQuick(c)) return false;
      const row = g / TILE;
      for (let r = Math.max(0, row - 2); r < row; r++) if (col[r] !== T_EMPTY) return false; // room to stand (no spikes, no ledge)
      return true;
    };
    for (let c = Math.floor(x / TILE) + (dir > 0 ? 1 : 0); dir < 0 ? c * TILE > x - range && c > 0 : c * TILE < x + range && c < this.cols.length - 2; c += dir) {
      if (!safeCol(c) || !safeCol(c + 1) || !safeCol(c - 1)) continue;
      const g = this.groundTop(c * TILE);
      if (this.groundTop((c + 1) * TILE) !== g) continue;
      const px = c * TILE + 1;
      if (this.threatened(px, g - HITBOX_H)) continue;
      return { x: px, y: g - HITBOX_H };
    }
    return null;
  }

  // How big a trap or sinkhole at column c is: small, medium or (past baseAt) large.
  // Wild mode makes the large ones more likely.
  bigSize(c) {
    if (c < this.baseAt) return this.rand(0, 1);
    return this.wild ? Number(this.pickWeighted(WILD.bigOdds)) : this.rand(0, 2);
  }

  // A bear trap with its middle at column `col` (large ones only after 400 m)
  addTrap(col, bush) {
    const size = this.bigSize(this.col);
    this.traps.push({ id: this.nextId++, x: Math.round(col * TILE) + 0.5, size, bush });
  }

  // Could a hazard get someone standing still at (x, y)? A mace swinging through,
  // a shooter's spikes, or icicles that would drop on them.
  threatened(x, y, ignoreTraps = false) {
    if (this.maces.some((m) => Math.abs(m.x - (x + HITBOX_W / 2)) < this.maceReach(m) + HITBOX_W / 2)) return true;
    if (this.saws.some((s) => x + HITBOX_W > Math.min(s.x0, s.x1) - s.r - 10 && x < Math.max(s.x0, s.x1) + s.r + 10)) return true;
    if (!ignoreTraps && this.traps.some((t) => Math.abs(t.x - (x + HITBOX_W / 2)) < TRAP.sizes[t.size] + HITBOX_W)) return true;
    if (!ignoreTraps && this.ponds.some((p) => x + HITBOX_W > p.x0 - 2 && x < p.x1 + 2)) return true;
    if (!ignoreTraps && this.flytraps.some((f) => Math.abs(f.x - (x + HITBOX_W / 2)) < this.flytrapReach(f) + HITBOX_W / 2 + 2)) return true;
    if (!ignoreTraps && this.sinkholes.some((s) => Math.abs(s.x - (x + HITBOX_W / 2)) < (s.size === 2 ? (SINK.gap + 1) * TILE : Math.max(SINK.catch[s.size], SINK.funnel[s.size][0])) + HITBOX_W)) return true;
    if (this.shooters.some((s) => s.float ? this.floatThreat(s, x, y) : Math.abs(s.x - x) < SHOOTER.range && this.shooterHits(s, x, y))) return true;
    if (this.turrets.some((t) => this.inTurretZone(t, x + HITBOX_W / 2))) return true;
    if (this.onFire(x + HITBOX_W / 2, HITBOX_W / 2 + 4)) return true;
    if (this.sleepShrooms.some((g) => Math.abs(g.x + SLEEP_SHROOM.lean - (x + HITBOX_W / 2)) < SLEEP_SHROOM.cloudW + HITBOX_W)) return true; // (no waiting in its cloud)
    return this.icicles.some((ic) => ic.x - x > -10 && ic.x - x < SNOW.icicleTrigger + 16);
  }

  // A sleep mushroom's cloud right now: { strength (0 none .. 1 full), warn (its eyes open: about to puff) }.
  // Its puffs (3-10 s each, with a 10 s rest after) are worked out from the clock, so both players see the same.
  sleepCloud(g, time) {
    const S = SLEEP_SHROOM, len = (k) => S.puff[0] + hash(k, g.id) * (S.puff[1] - S.puff[0]);
    const T = time + g.seed * (S.puff[1] + S.rest); // (each mushroom at its own point in its cycle)
    let m = g.memo && g.memo.start <= T ? g.memo : { k: 0, start: 0 }; // (where the current puff started: time only goes forward)
    while (T >= m.start + len(m.k) + S.rest) m = { k: m.k + 1, start: m.start + len(m.k) + S.rest };
    g.memo = m;
    const t = T - m.start, on = len(m.k);
    const strength = t < on ? Math.min(1, t / S.grow) : Math.max(0, 1 - (t - on) / S.fade);
    return { strength, warn: t < on || t > on + S.rest - S.warn };
  }

  // Is (x, y) in a sleep mushroom's cloud, as it is now?
  inSleepCloud(g, x, y, time) {
    const c = this.sleepCloud(g, time);
    if (c.strength < 0.35) return false;
    const r = c.strength, cx = g.x + SLEEP_SHROOM.lean, cy = g.gy - SLEEP_SHROOM.cloudH;
    return ((x - cx) / (SLEEP_SHROOM.cloudW * r)) ** 2 + ((y - cy) / (SLEEP_SHROOM.cloudH * r)) ** 2 <= 1;
  }

  // The spores drifting down from under a spore mushroom's cap right now: [{x, y, f (0 at the cap, 1 at the ground)}].
  // Worked out from the clock, so both players see the same ones.
  sporesOf(m, time) {
    const out = [], top = m.gy - SPORES.stem;
    for (let n = 0; n < SPORES.count; n++) {
      // (each falls at its own pace, from its own start: not an even curtain, so there are gaps)
      const u = (time / SPORES.fall) * (0.75 + hash(n, m.id + 5) * 0.5) + hash(n, m.id + 9) + m.seed, cycle = Math.floor(u), f = u - cycle;
      const x = m.x + (m.lean || 0) * SPORES.lean + (hash(n + cycle * 7, m.id) - 0.5) * (SPORES.capW - 8) + Math.sin(f * 6 + n) * 2; // (under the cap, which leans over)
      out.push({ x, y: top + 2 + f * (m.gy - top - 2), f });
    }
    return out;
  }

  // Could a floating shooter's spikes reach someone standing at (x, y), from anywhere it floats to?
  // (Its spikes fly diagonally: they reach you if you're as far off to the side as above or below it.)
  floatThreat(s, x, y) {
    const cx = x + HITBOX_W / 2;
    const near = Math.max(0, Math.abs(cx - s.x0) - s.float.amp) - 8, far = Math.abs(cx - s.x0) + s.float.amp + 8;
    const top = y - 4 - s.y, bottom = y + HITBOX_H + 4 - s.y;
    const dyMin = top <= 0 && bottom >= 0 ? 0 : Math.min(Math.abs(top), Math.abs(bottom)), dyMax = Math.max(Math.abs(top), Math.abs(bottom));
    return dyMin < SHOOTER.range * Math.SQRT1_2 && near <= dyMax && far >= dyMin;
  }

  // Does any of a shooter's 4 spike paths pass through someone standing at (x, y)? (with room to spare)
  shooterHits(s, x, y) {
    const dist = this.shooterReach(s);
    return SHOOTER_DIRS.some(([dx, dy], i) => {
      for (let d = 0; d < dist[i]; d += 2) {
        const step = 4 + d * Math.SQRT1_2;
        const sx = s.x + dx * step, sy = s.y + dy * step;
        if (sx > x - 4 && sx < x + HITBOX_W + 4 && sy > y - 4 && sy < y + HITBOX_H + 4) return true;
      }
      return false;
    });
  }

  // Is the ground's surface in this column quicksand?
  isQuick(col) {
    return this.quick[col] === true;
  }

  // The part of the spike in this tile that hurts: [x, y, w, h]. Spikes only hurt in their pointy
  // part, not the whole tile. Ice spikes (in the snow) are taller and a little thinner; a cactus is
  // tall, but only its trunk hurts; a bamboo stake is thin and very tall; a thorn bush fills its tile.
  spikeBox(c, r) {
    const biome = this.biomeAt(c);
    if (biome === "desert") { const h = this.cactusHeight(c); return [c * TILE + 2, (r + 1) * TILE - h + 2, 4, h - 2]; }
    if (biome === "snow") return [c * TILE + 1.5, r * TILE + 1, 5, 7];
    if (biome === "forest") return [c * TILE + 2, r * TILE + 2, 4, 6]; // a thorny vine: its stem and barbs
    if (biome === "jungle") {
      const kind = this.spikeKind[c];
      if (typeof kind === "number") return [c * TILE + 3, (r + 1) * TILE - kind + 1, 3, kind - 1];
      return [c * TILE + 0.5, r * TILE + 1, 7, 7];
    }
    return [c * TILE + 1, r * TILE + 3, 6, 5];
  }

  // ---- Bushes in the jungle's background (where a jaguar hides) ----

  // The background bushes between x0 and x1: about one every 8 tiles, worked out from where they
  // are (not stored), sitting on the ground behind the course. { x (middle), y (bottom), v (look) }
  backBushes(x0, x1) {
    const out = [];
    for (let k = Math.floor(x0 / (8 * TILE)) - 1; k <= Math.floor(x1 / (8 * TILE)) + 1; k++) {
      if (k < 0 || hash(k, 311) > 0.72) continue;
      const x = (k * 8 + 1 + hash(k, 312) * 6) * TILE;
      if (this.biomeAt(Math.floor(x / TILE)) !== "jungle") continue;
      const g = this.groundTop(x);
      if (g === null || this.groundTop(x - 12) !== g || this.groundTop(x + 12) !== g) continue;
      out.push({ x, y: g + 1, v: Math.floor(hash(k, 313) * 4) });
    }
    return out;
  }

  // ---- Fire (from a firehawk's stick) ----

  // Is x within `margin` of ground that's burning?
  onFire(x, margin = 0) {
    return this.fires.some((f) => f.t < FIREHAWK.fireTime && Math.abs(f.x - x) < FIREHAWK.fireHalf + margin);
  }

  // ---- Ancient turrets ----

  // The stretch of ground a turret's arrows fly along while you're on it: in front of one that
  // shoots back at you, or after one that rises up behind you
  inTurretZone(t, x) {
    return t.dir < 0 ? x > t.x - 26 * TILE && x < t.x + 2 * TILE : x > t.x - 2 * TILE && x < t.x + 30 * TILE;
  }

  addTurret(c, dir) {
    this.turrets.push({ id: this.nextId++, x: c * TILE + TILE / 2, gy: this.groundRow * TILE, dir, wait: this.rand(TURRET.behind[0], TURRET.behind[1]), state: "hidden", t: 0, h: 0 });
  }

  // ---- Flytraps ----

  flytrapReach(f) {
    return FLYTRAP.reach[f.big ? 1 : 0];
  }

  // How long it rears back before snapping, and how close (to its middle) you set it off: just far
  // enough that someone running straight in at full speed is in its bite when it snaps
  flytrapWindup() {
    return this.wild ? WILD.flytrapWindup : FLYTRAP.windup;
  }

  flytrapSense(f) {
    return PHYSICS.runSpeed * this.flytrapWindup() + this.flytrapReach(f) + HITBOX_W / 2 - 4;
  }

  // A flytrap needs flat, open ground all round: room to bait it and back off on one side, room to be
  // spat out onto on both, and nothing else dangerous in reach while you do
  flytrapFits(c) {
    const add = () => this.flytraps.push({ x: c * TILE + TILE / 2, big: true }), remove = () => this.flytraps.pop();
    if (!this.spotFits(c, 9, true, "jungle", 0, add, remove)) return false;
    const x = c * TILE + TILE / 2;
    if (this.flytraps.some((f) => Math.abs(f.x - x) < 24 * TILE)) return false;
    if (this.rivers.some((r) => x > r.x0 - 12 * TILE && x < r.x1 + 12 * TILE)) return false;
    if (this.palms.some((p) => p.drop && Math.abs(p.cx + p.drop[0] - x) < 9 * TILE)) return false;
    for (let k = -9; k <= 9; k++) for (let r = this.groundTop(x) / TILE - 6; r < this.groundTop(x) / TILE; r++) if (this.tile(c + k, r) !== T_EMPTY) return false;
    // nothing else dangerous anywhere you might bait it from or be spat out onto
    for (let k = -9; k <= 9; k++) if (this.threatened(x - HITBOX_W / 2 + k * TILE, this.groundTop(x) - HITBOX_H)) return false;
    return true;
  }

  addFlytrap(c) {
    this.flytraps.push({ id: this.nextId++, x: c * TILE + TILE / 2, gy: this.groundTop(c * TILE), big: this.bigSize(c) === 2, state: "open", t: 0, victim: null });
  }

  tryFlytrap(c) {
    if (!this.flytrapFits(c)) return false;
    this.addFlytrap(c);
    return true;
  }

  // How tall the cactus in this column is (cactuses are the desert's spikes)
  cactusHeight(col) {
    return DESERT.cactusHeights[Math.floor(hash(col, 77) * DESERT.cactusHeights.length)];
  }

  // Is the ground's surface in this column slippery ice?
  isIce(col) {
    return this.ice[col] === true;
  }

  // ---- Spike shooters ----
  //
  // Spikes aren't stored anywhere. A shooter fires a volley every `period`
  // seconds, so where every spike is can be worked out from the clock alone.
  // That keeps them cheap, and both halves of the screen always agree.

  // How far each of the 4 spikes can fly before hitting the ground (worked out once)
  shooterReach(s) {
    if (s.dist) return s.dist;
    const dist = this.reachFrom(s.x, s.y, s);
    // Only remember it once the ground it flies over has been built
    if (Math.floor((s.x + SHOOTER.range) / TILE) < this.cols.length) s.dist = dist;
    return dist;
  }

  reachFrom(x0, y0, s) {
    return SHOOTER_DIRS.map(([dx, dy]) => {
      for (let d = 0; d < SHOOTER.range; d++) {
        const x = x0 + dx * (4 + d * Math.SQRT1_2);
        const y = y0 + dy * (4 + d * Math.SQRT1_2);
        if (y < -8 || y > VIEW_H) return d;
        const col = Math.floor(x / TILE);
        const row = Math.floor(y / TILE);
        if (col === s.col && row === s.row) continue; // its own block
        if (this.isSolid(col, row)) return d;
      }
      return SHOOTER.range;
    });
  }

  // A floating shooter fires each volley from wherever it was at the time: how far that volley's
  // spikes go (remembered for the last few volleys)
  volleyReach(s, k, x) {
    const memo = (s.reaches ||= new Map());
    if (memo.has(k)) return memo.get(k);
    const dist = this.reachFrom(x, s.y, s);
    if (Math.floor((x + SHOOTER.range) / TILE) < this.cols.length) {
      memo.set(k, dist);
      if (memo.size > 6) memo.delete(memo.keys().next().value);
    }
    return dist;
  }

  // Every spike in the air from this shooter right now: [{x, y, dx, dy}]
  shooterSpikes(s, time) {
    const out = [];
    const life = SHOOTER.range / SHOOTER.speed;
    let k = Math.floor(time / s.period - s.phase);
    for (; ; k--) {
      const fired = (k + s.phase) * s.period, age = time - fired;
      if (age > life) break;
      const x0 = this.shooterX(s, fired); // (where it was when it fired)
      const dist = s.float ? this.volleyReach(s, k, x0) : this.shooterReach(s);
      const d = age * SHOOTER.speed;
      SHOOTER_DIRS.forEach(([dx, dy], i) => {
        if (d >= dist[i]) return;
        const step = 4 + d * Math.SQRT1_2;
        out.push({ x: x0 + dx * step, y: s.y + dy * step, dx, dy });
      });
    }
    return out;
  }

  // 0..1 as a shooter gets ready to fire (1 = about to fire)
  shooterCharge(s, time) {
    const untilNext = s.period - (((time / s.period - s.phase) % 1 + 1) % 1) * s.period;
    return untilNext < SHOOTER.warn ? 1 - untilNext / SHOOTER.warn : 0;
  }

  // How far left and right of its bolt a mace can reach
  maceReach(m) {
    return Math.sin(m.amplitude) * m.length + MACE_RADIUS + 4;
  }

  // ---- Building blocks ----

  // Forest: n spike shooters floating left and right above the ground (in a stack if n > 1), each with a
  // platform on top that carries you along. Flat ground under all of it, with room to wait on either side.
  floatingShooters(d, n) {
    const heights = n === 1 ? [this.pickFrom([1, 2, 3, 4, 5, 6])] : this.pickFrom(n === 2 ? [[1, 4], [2, 5], [3, 6], [2, 6]] : [[1, 3, 5], [2, 4, 6], [1, 4, 7]]);
    const amps = heights.map(() => this.rand(FOREST.floatAmp[0], FOREST.floatAmp[1]));
    const reach = Math.max(...amps) + Math.max(4, Math.max(...heights) + 4);
    this.flat(reach);
    const col = this.col;
    this.flat(1);
    heights.forEach((height, i) => {
      const row = this.groundRow - height;
      if (row < 1) return;
      const amp = amps[i] * TILE, x0 = col * TILE + TILE / 2;
      const s = {
        col: -1, row, x: x0, x0, y: row * TILE + TILE / 2,
        period: (2.1 + this.rng() * 0.7 - d * 0.4) * this.pace,
        phase: this.rng(),
        float: { amp, period: (2 * Math.PI * amp) / FOREST.floatSpeed, phase: this.rng() },
      };
      s.float.top = this.addPlatform("float", 0, row, 1, { x: x0 - TILE / 2 });
      this.shooters.push(s);
    });
    this.flat(reach + 1);
  }

  get col() {
    return this.cols.length;
  }

  rand(min, max) {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  pickFrom(list) {
    return list[Math.floor(this.rng() * list.length)];
  }

  // [a, b] or [b, a], at random
  shuffleTwo(a, b) {
    return this.rng() < 0.5 ? [a, b] : [b, a];
  }

  pickWeighted(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let roll = this.rng() * total;
    for (const [name, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll < 0) return name;
    }
    return Object.keys(weights)[0];
  }

  column(groundRow, icy = false) {
    const c = new Uint8Array(ROWS);
    if (groundRow !== null) c.fill(T_GROUND, groundRow);
    this.colBiome.push(this.biome);
    this.ice.push(icy && groundRow !== null);
    this.quick.push(false);
    this.spikeKind.push(null);
    this.cols.push(c);
    return c;
  }

  flat(n, icy = this.iceBias) {
    for (let i = 0; i < n; i++) this.column(this.groundRow, icy);
  }

  empty(n) {
    for (let i = 0; i < n; i++) this.column(null);
  }

  // In the jungle, spikes are thorn bushes unless `bamboo` gives each stake's height
  spikes(n, bamboo = null) {
    for (let i = 0; i < n; i++) {
      this.column(this.groundRow, this.iceBias)[this.groundRow - 1] = T_SPIKE;
      if (this.biome === "jungle") this.spikeKind[this.cols.length - 1] = bamboo ? bamboo[i] : "thorn";
    }
  }

  addPlatform(kind, col, row, widthTiles, extra = {}) {
    const p = { id: this.nextId++, kind, x: col * TILE, y: row * TILE, w: widthTiles * TILE, dx: 0, ...extra };
    this.platforms.push(p);
    return p;
  }

  // 0 at the start, rising to 1 after about 900 tiles.
  difficulty() {
    return Math.min(1, this.col / 900);
  }

  // ---- Sections ----

  addSection() {
    if (this.realmEnd !== undefined && this.col * TILE >= this.realmEnd) return this.flat(20, false); // (the forest's over: the fireflies come)
    if (this.sleepAt !== undefined && this.col >= this.sleepAt) {
      this.sleepAt = undefined;
      if (this.col >= SLEEP_SHROOM.from) return SECTIONS.sleepShroom.call(this);
    }
    if (this.col >= this.stretchEnd) {
      this.addBiomeEvents(MISSILE.stretch);
      this.stretchEnd += MISSILE.stretch;
    }
    if (this.col >= this.biomeEnd) return this.newBiome();
    // In the snow, many sections are built on ice: the run-up, the ground under the danger and the landing
    this.iceBias = this.biome === "snow" && this.rng() < SNOW.iceSections;

    const weights = { flat: 1, step: 2, spikes: 4, gap: 4, floating: 2, moving: 2, falling: 2, portal: 1, mace: 4 };
    if (this.col > 60) Object.assign(weights, { shooter: 5, saw: 5 });
    if (this.col > 60 && this.biome === "prairie") Object.assign(weights, { trap: 1, bush: 2 });
    if (this.col > 120 && this.col - this.lastOrbCol > ORBS.gap && this.realmEnd === undefined) weights.orb = ORBS.weight[this.biome]; // about 3 orbs per biome (none in the forest)
    if (this.biome === "snow") Object.assign(weights, { ice: 4, icicles: 5, snowball: 3 });
    if (this.biome === "snow" && this.col > 60) weights.thinIce = 4;
    if (this.biome === "desert") Object.assign(weights, { quicksand: 5, tumbleweed: 4 });
    if (this.biome === "desert" && this.col > 60) weights.sinkhole = 3;
    if (this.biome === "jungle" && this.col > 40) weights.river = 4;
    if (this.biome === "jungle" && this.col > 60) Object.assign(weights, { flytrap: 7, turret: 5 });
    if (this.biome === "forest" && this.col > 60) weights.shooterStack = FOREST.stackWeight;
    if (this.biome === "forest") weights.sporeShroom = SPORES.weight;

    let type = this.pickWeighted(weights);
    // Snow: make sure this biome gets its thin ice before it ends
    if (this.biome === "snow" && this.col > 60) {
      const have = this.ponds.filter((p) => p.x0 >= this.biomeStart * TILE).length + this.pending.filter((w) => w.kind === "pond" && w.c >= this.biomeStart).length;
      if (have < this.pondTarget && this.biomeEnd - this.col < (this.pondTarget - have) * 40 + 30) type = "thinIce";
    }
    SECTIONS[type].call(this, this.difficulty());
    this.flat(this.rand(1, 3), false); // breathing room between sections (never icy)
    this.scatter();
  }

  // Prairie: sprinkle bear traps and bushes all over the course, not just in their own sections.
  // Done a little behind the newest section, so everything around a spot is already built.
  scatter() {
    const until = this.col - SCATTER.behind;
    // what sinkhole and thin ice sections asked for, now that there's room round them to check
    this.pending = this.pending.filter((want) => {
      if (want.c + 15 >= until) return true;
      if (want.kind === "pond") {
        const mid = want.c + Math.floor(want.tiles / 2), half = Math.ceil(want.tiles / 2) + 5;
        if (this.spotFits(mid, half, false, "snow", 0, () => this.ponds.push({ x0: want.c * TILE, x1: (want.c + want.tiles) * TILE, state: "ice" }), () => this.ponds.pop())) this.addPond(want.c, want.tiles);
      } else if (want.kind === "flytrap") {
        if (this.flytrapFits(want.c)) this.addFlytrap(want.c);
      } else {
        let size = want.size;
        if (size === 2 && !this.sinkFits(want.c, 2)) size = this.rand(0, 1);
        if (this.sinkFits(want.c, size)) this.addSinkhole(want.c, size);
      }
      return false;
    });
    for (const bush of this.bushes) {
      if (!bush.wantsTrap || bush.x0 + bush.w >= until * TILE) continue;
      bush.wantsTrap = false;
      this.tryTrap(Math.floor((bush.x0 + bush.w / 2) / TILE), bush);
    }
    for (let c = Math.max(this.scatterFrom, 61); c < until; c++) {
      if (this.colBiome[c] === "jungle") {
        if (this.rng() < SCATTER.flytrap) this.tryFlytrap(c);
        if (c - this.lastPalm >= COCONUT.every[0] && this.rng() < 3 / (COCONUT.every[1] - COCONUT.every[0])) this.tryPalm(c);
        continue;
      }
      if (this.colBiome[c] === "snow") {
        if (this.rng() < SCATTER.pond) this.tryPond(c);
        continue;
      }
      if (this.colBiome[c] === "desert") {
        if (this.rng() < SCATTER.sink) this.trySink(c);
        continue;
      }
      if (this.colBiome[c] !== "prairie") continue;
      const roll = this.rng();
      if (roll < SCATTER.trap) this.tryTrap(c, null);
      else if (roll < SCATTER.trap + SCATTER.bush) this.tryBush(c);
    }
    this.scatterFrom = Math.max(this.scatterFrom, until);
  }

  // A scattered trap only goes where it can always be jumped over: 5 tiles of flat ground on
  // each side, nothing overhead in the way of a jump, no spikes, pits
  // edges, saw slots, portals or other traps close by. The deadly large ones also stay out of
  // reach of other dangers, so you never have to dodge two things at once to get past one.
  trapFits(c, size) {
    return this.spotFits(c, 5, size === 2, "prairie", TRAP.sizes[size] + TILE, () => this.traps.push({ x: c * TILE + TILE / 2 + 0.5, size }), () => this.traps.pop());
  }

  // Desert sinkholes get the same rules. A large one caves in to a gap SINK.gap tiles either side,
  // so it needs that much more flat ground around it.
  sinkFits(c, size) {
    const half = size === 2 ? SINK.gap + 5 : 5;
    return this.spotFits(c, half, size === 2, "desert", SINK.catch[size], () => this.sinkholes.push({ x: c * TILE + TILE / 2 + 0.5, size, state: "idle" }), () => this.sinkholes.pop());
  }

  // Shared by traps and sinkholes: `half` tiles of flat ground on each side, nothing overhead,
  // nothing else in the way; `deadly` ones also out of every other danger's reach. `reach` is
  // how far out it can get you (for keeping clear of bushes); add/remove try it out for a moment.
  spotFits(c, half, deadly, biome, reach, add, remove) {
    const g = this.groundTop(c * TILE);
    if (g === null) return false;
    const row = g / TILE;
    for (let k = -half; k <= half; k++) {
      const col = this.cols[c + k], gk = this.groundTop((c + k) * TILE);
      if (!col || gk === null || this.isQuick(c + k) || this.isIce(c + k) || this.colBiome[c + k] !== biome) return false;
      if (gk !== g) return false; // flat all round: no hopping up a step straight onto it
      for (let r = row - 6; r < gk / TILE; r++) if (this.tile(c + k, r) !== T_EMPTY) return false; // spikes, shooters, ledges
    }
    const x = c * TILE + TILE / 2 + 0.5, near = (px, tiles) => Math.abs(px - x) < tiles * TILE;
    if (this.traps.some((t) => near(t.x, half + 3))) return false;
    if (this.sinkholes.some((s) => near(s.x, half + 3 + (s.size === 2 ? SINK.gap : 0)))) return false;
    if (this.ponds.some((p) => p.x1 > x - (half + 3) * TILE && p.x0 < x + (half + 3) * TILE)) return false;
    // never hidden by some other bush by accident
    if (this.bushes.some((bu) => bu !== this.trapBush && x > bu.x0 - reach - TILE && x < bu.x0 + bu.w + reach + TILE)) return false;
    if (this.saws.some((s) => s.kind !== "pit" && x > Math.min(s.x0, s.x1) - s.r - TILE && x < Math.max(s.x0, s.x1) + s.r + TILE)) return false;
    if (this.portals.some((p) => x > p.x - 8 * TILE && x < p.toX + 4 * TILE)) return false;
    if (this.platforms.some((p) => x + 5 * TILE > p.x && x - 5 * TILE < p.x + p.w && p.y > g - 7 * TILE)) return false;
    if (this.orbs.some((o) => near(o.x, 3))) return false;
    // not in the open stretch a tumbleweed or snowball rolls along (stuck there, you couldn't dodge it)
    if ([...this.tumbleSpots, ...this.snowballSpots].some((r) => x > r.x - 26 * TILE && x < r.x + 7 * TILE)) return false;
    if (deadly) for (let k = -half; k <= half; k += 2) if (this.threatened(x - HITBOX_W / 2 + k * TILE / 2, g - HITBOX_H)) return false;
    // Between two dangers there must still be somewhere safe to stand and wait for your moment
    const edge = (dir) => {
      for (let k = 1; k <= 20; k++) {
        const ex = x - HITBOX_W / 2 + dir * k * TILE / 2, eg = this.groundTop(ex + HITBOX_W / 2);
        if (eg !== null && this.threatened(ex, eg - HITBOX_H, true)) return ex;
      }
      return null;
    };
    const left = edge(-1), right = edge(1);
    if (left !== null && right !== null) {
      add();
      let run = 0; // safe spots in a row: a 2-pixel gap is too tight to stop in, so ask for a few
      for (let sx = left + 1; sx + HITBOX_W < right && run < 4; sx += 2) {
        const sg = this.groundTop(sx);
        const safe = sg !== null && sg === this.groundTop(sx + HITBOX_W - 1) && !this.isQuick(Math.floor(sx / TILE)) && !this.threatened(sx, sg - HITBOX_H);
        run = safe ? run + 1 : 0;
      }
      remove();
      if (run < 4) return false;
    }
    return true;
  }

  // A palm tree at column c: on flat, firm jungle ground with open sky above (for its crown, and for
  // a coconut to fall through). A coconut that falls only goes where being stunned can't leave you
  // in another danger's reach.
  tryPalm(c) {
    const g = this.groundTop(c * TILE);
    if (g === null) return false;
    const id = this.nextId; // (its kind comes from its id, so the course is the same whatever kinds there are)
    const kind = Math.floor(hash(id, 7) * PALMS.length), lean = PALMS[kind].lean;
    for (let k = Math.min(-1, Math.floor(lean / TILE) - 1); k <= Math.max(1, Math.ceil(lean / TILE) + 1); k++) {
      if (!this.cols[c + k] || this.groundTop((c + k) * TILE) !== g || this.colBiome[c + k] !== "jungle") return false;
      for (let r = 0; r < g / TILE; r++) if (this.tile(c + k, r) !== T_EMPTY) return false; // spikes, ledges, shooters
    }
    const x = c * TILE + TILE / 2;
    if (this.rivers.some((r) => x > r.x0 - 2 * TILE && x < r.x1 + 2 * TILE)) return false;
    if (this.platforms.some((p) => x + 3 * TILE > p.x && x - 3 * TILE < p.x + p.w)) return false;
    if (this.portals.some((p) => x > p.x - 4 * TILE && x < p.toX + 4 * TILE)) return false;
    const h = this.pickFrom([48, 54, 60]);
    const cx = x + lean, cy = g - Math.round(h * PALMS[kind].tall) + 9;
    const nuts = [[-3, 1], [2, 2], [-1, 4], [3, 0]].slice(0, this.rand(2, 4));
    let drop = null;
    if (this.rng() < COCONUT.dropChance) {
      drop = nuts.pop();
      const lx = cx + drop[0];
      let risky = false;
      for (let k = -16; k <= 16; k += 4) if (this.threatened(lx - HITBOX_W / 2 + k, g - HITBOX_H)) risky = true;
      // bonked in the middle of a jump, you drop straight down: so no spikes, pits or rivers anywhere near
      for (let k = -8; k <= 8; k++) {
        const gk = this.groundTop((c + k) * TILE);
        if (gk === null || this.tile(c + k, gk / TILE - 1) === T_SPIKE) risky = true;
      }
      if (this.rivers.some((r) => x > r.x0 - 9 * TILE && x < r.x1 + 9 * TILE)) risky = true;
      if (risky) { nuts.push(drop); drop = null; }
    }
    this.palms.push({ id: this.nextId++, x, gy: g, h, kind, cx, cy, nuts, drop });
    this.lastPalm = c;
    return true;
  }

  // Thin ice from column c, `tiles` long: flat snow all round, like the traps, so you can always
  // walk across, jump over it, or climb out and carry on
  tryPond(c) {
    const tiles = this.rand(THIN_ICE.widths[0], THIN_ICE.widths[1]);
    const mid = c + Math.floor(tiles / 2), half = Math.ceil(tiles / 2) + 5;
    if (!this.spotFits(mid, half, false, "snow", 0, () => this.ponds.push({ x0: c * TILE, x1: (c + tiles) * TILE, state: "ice" }), () => this.ponds.pop())) return false;
    this.addPond(c, tiles);
    return true;
  }

  addPond(c, tiles) {
    // (a thin ice section adds it just before building the ground under it: that ground will be at groundRow)
    const gy = this.groundTop(c * TILE) ?? this.groundRow * TILE;
    this.ponds.push({ id: this.nextId++, x0: c * TILE, x1: (c + tiles) * TILE, gy, state: "ice", frozen: [], cracked: false, cracks: [] });
  }

  // The thin ice gives way: from now on it's open icy water (for everyone)
  breakPond(p, x) {
    p.state = "water";
    p.brokeAt = this.time;
    p.breakX = clamp(x ?? (p.x0 + p.x1) / 2, p.x0 + 1, p.x1 - 2); // where it gave way (the cracks race out from here)
    Sound.play("iceBreak");
  }

  // Someone walks on thin ice: fresh cracks spread out from under their feet (and stay)
  crackPond(p, x) {
    p.cracked = true;
    if (p.cracks.some((c) => Math.abs(c.x - x) < 11)) return;
    p.cracks.push({ x, t: this.time, seed: p.id * 31 + Math.round(x) }); // (not this.rng(): that's for building the course)
  }

  // The pond (if any) under the middle of someone standing at x
  pondAt(x) {
    return this.ponds.find((p) => x >= p.x0 && x < p.x1) || null;
  }

  trySink(c) {
    let size = this.bigSize(c);
    if (size === 2 && !this.sinkFits(c, 2)) size = this.rand(0, 1); // too risky here for a deadly one
    if (!this.sinkFits(c, size)) return false;
    this.addSinkhole(c, size);
    return true;
  }

  addSinkhole(c, size) {
    // (a sinkhole section adds it just before building the ground under it: that ground will be at groundRow)
    const gy = this.groundTop(c * TILE) ?? this.groundRow * TILE;
    this.sinkholes.push({ id: this.nextId++, x: c * TILE + TILE / 2 + 0.5, col: c, size, gy, state: "idle", openedAt: 0 });
  }

  // A large sinkhole caves in: the ground falls away, leaving a gap for everyone
  collapseSinkhole(s) {
    s.state = "open";
    s.openedAt = this.time;
    for (let k = -SINK.gap; k <= SINK.gap; k++) {
      this.cols[s.col + k] = new Array(ROWS).fill(T_EMPTY);
      this.quick[s.col + k] = false;
    }
  }

  // Stuck in a small or medium sinkhole: the sand keeps pouring in, but stops for a moment every so often
  sinkCalm(s) {
    const t = (this.time - s.openedAt) % SINK.period;
    return t > SINK.period - SINK.calm;
  }

  tryTrap(c, bush) {
    this.trapBush = bush; // (a trap may sit in its own bush)
    let size = this.bigSize(Math.min(c, this.col));
    if (size === 2 && !this.trapFits(c, 2)) size = this.rand(0, 1); // too risky here for a deadly one
    if (!this.trapFits(c, size)) return false;
    this.traps.push({ id: this.nextId++, x: c * TILE + TILE / 2 + 0.5, size, bush });
    return true;
  }

  // A scattered bush: flat ground under all of it (and a tile either side), nothing in the way
  // above, and it never covers spikes, saw slots, pits or other traps, so it can't hide a danger.
  tryBush(c) {
    const [w, h] = this.pickFrom(BUSH.sizes);
    const x0 = c * TILE + 2, c1 = Math.ceil((x0 + w) / TILE);
    const g = this.groundTop(c * TILE);
    if (g === null) return false;
    for (let k = c - 1; k <= c1; k++) {
      if (!this.cols[k] || this.groundTop(k * TILE) !== g || this.isQuick(k) || this.isIce(k) || this.colBiome[k] !== "prairie") return false;
      for (let r = g / TILE - Math.ceil(h / TILE) - 1; r < g / TILE; r++) if (this.tile(k, r) !== T_EMPTY) return false;
    }
    const left = x0 - TILE, right = x0 + w + TILE;
    if (this.bushes.some((bu) => bu.x0 < right + TILE && bu.x0 + bu.w > left - TILE)) return false;
    if (this.traps.some((t) => t.x > left - 2 * TILE && t.x < right + 2 * TILE)) return false;
    if (this.saws.some((s) => s.kind !== "pit" && Math.max(s.x0, s.x1) + s.r > left && Math.min(s.x0, s.x1) - s.r < right)) return false;
    if (this.portals.some((p) => right > p.x - 4 * TILE && left < p.toX + 4 * TILE)) return false;
    if (this.platforms.some((p) => right > p.x && left < p.x + p.w && p.y > g - h - TILE)) return false;
    if (this.orbs.some((o) => o.x > left - TILE && o.x < right + TILE)) return false;
    const bush = { x0, w, h, gy: g, seed: this.rng() * 100, berries: this.rng() < 0.35, torn: false };
    bush.tops = bushTops(w, h, bush.seed);
    this.bushes.push(bush);
    if (this.rng() < TRAP.inBush) this.tryTrap(Math.floor((x0 + w / 2) / TILE), bush);
    return true;
  }

  // A river from x0 to x1 (pixels), its water just below banks at gy, with its logs
  addRiver(x0, x1, gy, d) {
    let speed = RIVER.speed[0] + this.rng() * (RIVER.speed[1] - RIVER.speed[0]) * (0.5 + d * 0.5);
    // Logs and gaps that always leave a way across, with time to spare. On a wide river, the next log
    // is up and steady a good second before the one you're on reaches the near bank. On a narrow one a
    // single log does: for at least 2.5 s it's close enough to both banks to hop on and off (RIVER.hop tiles).
    const W = (x1 - x0) / TILE;
    const oneLog = (len) => { // seconds a single log is up, steady, and an easy hop from both banks
      const from = Math.max(0, W - RIVER.hop - len), to = Math.min(RIVER.hop, W - len); // where its left end can be (tiles from the near bank)
      if (to < from) return 0;
      return ((to - from) * TILE) / speed + (from === 0 ? RIVER.sink / 2 : 0) - (to === W - len ? RIVER.rise * 0.6 : 0);
    };
    const works = (len, gap) => W - len >= len + gap + (speed * (RIVER.rise + 1.2)) / TILE || oneLog(len) >= 2.5;
    let len = this.rand(RIVER.logTiles[0], RIVER.logTiles[1]), gap = this.rand(RIVER.gap[0], RIVER.gap[1]);
    while (!works(len, gap)) {
      const options = [];
      for (let l = RIVER.logTiles[0]; l <= RIVER.logTiles[1]; l++) for (let g = RIVER.gap[0]; g <= RIVER.gap[1]; g++) if (works(l, g)) options.push([l, g]);
      if (options.length) [len, gap] = this.pickFrom(options);
      else speed *= 0.85; // nothing fits at this speed: a slower current
    }
    len *= TILE;
    const spacing = len + gap * TILE;
    const visible = x1 - x0 - len + speed * RIVER.sink; // how far a log drifts from bobbing up to gone
    const n = Math.ceil(visible / spacing);
    const r = { id: this.nextId++, x0, x1, gy, wy: gy + RIVER.surface, speed, spacing, loop: n * spacing, phase: this.rng() * n * spacing };
    this.rivers.push(r);
    for (let k = 0; k < n; k++) {
      const log = { id: this.nextId++, kind: "log", river: r, k, x: x1 - len, y: gy, w: len, dx: 0, sinkY: 0, hidden: false };
      this.moveLog(log, 0);
      this.platforms.push(log);
    }
  }

  // A calm stretch, then a sign, and from there on a different biome
  newBiome() {
    this.iceBias = false;
    this.flat(4);
    this.biome = this.pickFrom(this.biomeList.filter((b) => b !== this.biome));
    this.signs.push({ x: this.col * TILE + 2, biome: this.biome });
    this.flat(8);
    const length = this.rand(BIOME_LENGTH[0], BIOME_LENGTH[1]);
    this.biomeEnd = this.col + length;
    this.biomeStart = this.col;
    this.pondTarget = this.rand(THIN_ICE.perBiome[0], THIN_ICE.perBiome[1]);
    this.addBiomeEvents(length);
  }

  // Each biome's special danger. Snow: two bears, at random spots in the biome (at least 70 m apart).
  addBiomeEvents(length) {
    // somewhere in it, a giant sleep mushroom (not in the forest itself)
    if (this.realmEnd === undefined && this.biome !== "forest") this.sleepAt = this.col + this.rand(30, Math.max(31, length - 60));
    if (this.biome === "prairie") {
      // Missiles: usually 2 (MISSILE.perBiome), spread out across the biome
      const n = Number(this.pickWeighted(MISSILE.perBiome));
      const part = length / n;
      for (let i = 0; i < n; i++) this.missileSpots.push({ col: this.col + Math.round(part * (i + 0.25 + this.rng() * 0.5)), used: false });
      return;
    }
    if (this.biome === "jungle") {
      const n = this.rand(1, 2), part = (length - 80) / n;
      for (let i = 0; i < n; i++) this.jaguarSpots.push({ col: this.col + 30 + Math.round(part * (i + 0.2 + this.rng() * 0.6)), used: false });
      return;
    }
    if (this.biome !== "snow") return;
    const last = Math.max(110, length - 140); // the chases should be over before the snow ends
    const first = this.rand(40, Math.max(40, last - 70));
    const second = this.rand(first + 70, Math.max(first + 70, last));
    for (const at of [first, second]) {
      this.bearSpots.push({ col: this.col + at, kind: this.pickFrom(["polar", "brown", "black"]), used: false });
    }
  }
}

const SECTIONS = {
  flat() {
    this.flat(this.rand(3, 6));
  },

  // The ground steps up or down.
  step() {
    const change = this.pickFrom([-2, -1, 1, 2]);
    this.groundRow = clamp(this.groundRow - change, MIN_GROUND_ROW, MAX_GROUND_ROW);
    this.flat(this.rand(2, 5));
  },

  spikes(d) {
    this.flat(2);
    if (this.biome === "jungle") {
      // Either a wide thorn bush (with a run-up to jump it), or one or two very tall bamboo stakes
      if (this.rng() < 0.5) {
        this.flat(2);
        this.spikes(this.rand(JUNGLE.thornWidths[0], JUNGLE.thornWidths[1] - (d < 0.3 ? 1 : 0)));
      } else {
        const tall = this.pickFrom(JUNGLE.bambooHeights);
        const pair = this.rng() < 0.4; // a shorter one next to it
        this.spikes(pair ? 2 : 1, pair ? this.shuffleTwo(tall, this.pickFrom(JUNGLE.bambooHeights.slice(0, 2))) : [tall]);
      }
      this.flat(this.rand(8, 9), false); // room to land
      return;
    }
    const clusters = this.rand(1, 2);
    for (let i = 0; i < clusters; i++) {
      // Ice spikes come in longer rows: anywhere from 1 to 5 tiles, so you never know what's next
      // Cactuses are much taller, so they only come one or two at a time
      const n = this.biome === "snow" ? this.pickWeighted({ 1: 1, 2: 2, 3: 4, 4: 4, 5: 2 + d * 2 }) | 0
        : this.biome === "desert" ? this.pickWeighted({ 1: 3, 2: 2 }) | 0
        : this.rand(1, 2 + Math.round(d * 2));
      this.spikes(n);
      this.flat(this.biome === "desert" ? this.rand(8, 10) : this.rand(7 - Math.round(d * 2), 8), false); // room to land a full jump (less later on), never icy
    }
  },

  // A pit. The far side may be one tile higher or lower.
  gap(d) {
    this.flat(2);
    this.empty(this.rand(2, 3 + Math.round(d * 2)));
    if (this.rng() < 0.4) {
      this.groundRow = clamp(this.groundRow + this.pickFrom([-1, 1]), MIN_GROUND_ROW, MAX_GROUND_ROW);
    }
    this.flat(3, false); // a landing you can stop on
  },

  // A wide pit with floating platforms to hop across.
  floating(d) {
    this.flat(2);
    const count = this.rand(2, 3);
    for (let i = 0; i < count; i++) {
      this.empty(this.rand(2, 3 + Math.round(d)));
      const w = this.rand(2, 4);
      this.addPlatform("static", this.col, this.groundRow - this.rand(0, 2), w);
      this.empty(w);
    }
    this.empty(this.rand(2, 3));
    this.flat(3, false); // a landing you can stop on
  },

  // A wide pit with a platform sliding back and forth across it.
  moving(d) {
    this.flat(2);
    const gap = this.rand(7, 10);
    const start = this.col;
    const w = 3;
    this.empty(gap);
    this.addPlatform("move", start, this.groundRow, w, {
      x0: start * TILE,
      x1: (start + gap - w) * TILE,
      period: 3.2 - d,
      phase: this.rng(),
    });
    this.flat(3, false); // a landing you can stop on
  },

  // Platforms that crumble a moment after you land on them.
  falling() {
    this.flat(2);
    const count = this.rand(3, 4);
    for (let i = 0; i < count; i++) {
      this.empty(2);
      this.addPlatform("fall", this.col, this.groundRow - this.rand(0, 1), 4);
      this.empty(4);
    }
    this.empty(2);
    this.flat(3, false); // a landing you can stop on
  },

  // Two routes: the low road is a long spiky stretch. A portal on a high
  // ledge at the start skips straight to the end of it.
  portal(d) {
    this.iceBias = false; // its low road needs tight hops: never on ice
    this.flat(3);
    const start = this.col;
    const ledgeRow = this.groundRow - 4;
    this.addPlatform("static", start, ledgeRow, 3);
    const entrance = { x: (start + 1) * TILE, y: ledgeRow * TILE - 16, w: 8, h: 16 };

    this.flat(4);
    for (let i = 0; i < 3; i++) {
      if (this.biome === "desert") { // one tall cactus at a time, with room to land
        this.spikes(1);
        this.flat(this.rand(6, 7));
      } else {
        this.spikes(this.rand(2, 3));
        this.flat(this.rand(4, 5)); // tight: you need short hops here
      }
      if (i === 1) {
        this.empty(this.rand(3, 3 + Math.round(d)));
        this.flat(2);
      }
    }
    this.flat(5);

    const exit = { x: (this.col - 3) * TILE, y: this.groundRow * TILE - 16 };
    entrance.toX = exit.x;
    entrance.toY = exit.y;
    this.portals.push(entrance);
    this.exits.push(exit);
  },

  // One or two spiked maces swinging on chains from bolts in the sky. The ball
  // sweeps through at running height, so time your run (or jump over it).
  // A block that fires spikes in 4 diagonal directions. It can sit on the
  // ground, float at head height (jump over it) or hang higher up (run under it).
  shooter(d) {
    if (this.biome === "forest") return this.floatingShooters(d, 1);
    const height = this.pickFrom([1, 1, 2, 3, 4, 5, 6]); // tiles above the ground
    // Its downward spikes land further out the higher it is: leave room to wait on either side
    this.flat(Math.max(4, height + 4));
    const row = this.groundRow - height;
    const col = this.col;
    this.column(this.groundRow)[row] = T_SHOOTER;
    this.shooters.push({
      col,
      row,
      x: col * TILE + TILE / 2,
      y: row * TILE + TILE / 2,
      period: (2.1 + this.rng() * 0.7 - d * 0.4) * this.pace, // each shooter fires at its own pace
      phase: this.rng(),
    });
    this.flat(Math.max(6, height + 5));
  },

  // The way into the enchanted forest: a giant sleep mushroom, with flat ground all round it
  sleepShroom() {
    this.flat(14, false);
    this.sleepShrooms.push({ id: this.nextId++, x: this.col * TILE + TILE / 2, gy: this.groundRow * TILE, seed: this.rng(), forest: null });
    this.flat(16, false);
  },

  // The forest's: a big mushroom dropping spores (red: faster, blue: jump higher, green: poison, pink: float)
  sporeShroom() {
    this.flat(4);
    this.sporeShrooms.push({ id: this.nextId++, x: this.col * TILE + TILE / 2, gy: this.groundRow * TILE, kind: this.pickFrom(SPORES.kinds), seed: this.rng(), lean: this.rng() < 0.5 ? -1 : 1 });
    this.flat(6);
  },

  // The forest's: a stack of floating shooters, each drifting its own way
  shooterStack(d) {
    this.floatingShooters(d, this.rand(FOREST.stack[0], FOREST.stack[1]));
  },

  // A spinning saw blade. Sizes and speeds are random (a little faster later on), and
  // like the maces there may be two in a row later. The speed ranges were measured to
  // always leave a way through (see the README).
  saw(d) {
    this.flat(3, false);
    const count = d > 0.4 && this.rng() < 0.5 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const r = this.pickFrom(SAW.sizes);
      const gy = this.groundRow * TILE;
      const kind = this.pickWeighted({ slot: 3, rail: 2, pit: 2 });
      const saw = { kind, r, gy, phase: this.rng(), spinDir: this.rng() < 0.5 ? -1 : 1 };
      if (this.biome === "forest") saw.breaks = this.rng() < FOREST.sawBreaks; // (it'll break loose and roll at you)
      if (kind === "slot") {
        // slides left and right in a slot cut into the ground: only its top half shows
        const len = this.rand(3, 8) * TILE; // how far it slides
        const x0 = this.col * TILE + r;
        this.flat(Math.ceil((len + 2 * r) / TILE) + 1, false);
        Object.assign(saw, { x0, x1: x0 + len, y0: gy + 1, y1: gy + 1, period: (1.6 + this.rng() * 1.2 + len / 80 - d * 0.2) * this.pace });
      } else if (kind === "rail") {
        // goes up and down a rail: from sunk in the ground (jump it) up high into the air (run under it).
        // On the way it sweeps right through where a jump takes you, so jumping isn't always safe.
        const x = this.col * TILE + TILE * 2;
        this.flat(4, false);
        const top = this.rand(Math.min(44, r + 30), 44); // how high its center rises above the ground
        Object.assign(saw, { x0: x, x1: x, y0: gy + 1, y1: gy - top, period: (1.5 + this.rng() * 1.1 - d * 0.2) * this.pace });
      } else {
        // rises up out of a pit and sinks back down: jump across while it's down
        const x = this.col * TILE + TILE * 2;
        this.empty(4);
        Object.assign(saw, { x0: x, x1: x, y0: VIEW_H + r + 2, y1: gy - 40, period: (2.2 + this.rng() * 1.0 - d * 0.2) * this.pace });
      }
      this.saws.push(saw);
      this.flat(i + 1 < count ? 12 : 3, false); // room to stop safely between two saws
    }
  },

  // Bear traps lying in the grass: one, or later two in a row. Small and medium ones hold you
  // for a moment; large ones (only after 400 m) kill.
  // (5+ tiles of flat ground on each side of every trap, so it can always be jumped over)
  trap(d) {
    this.flat(6, false);
    const count = d > 0.4 && this.rng() < 0.4 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      this.addTrap(this.col, null);
      this.flat(i + 1 < count ? 9 : 6, false);
    }
  },

  // A few bushes to hide in. Each one might have a trap hidden inside (TRAP.inBush).
  bush() {
    this.flat(3, false);
    for (let i = this.rand(1, 3); i > 0; i--) {
      const [w, h] = this.pickFrom(BUSH.sizes);
      const bush = { x0: this.col * TILE + 2, w, h, gy: this.groundRow * TILE, seed: this.rng() * 100, berries: this.rng() < 0.35, torn: false };
      bush.tops = bushTops(w, h, bush.seed);
      bush.wantsTrap = this.rng() < TRAP.inBush; // put in later (scatter), once there's room around it to check
      this.bushes.push(bush);
      this.flat(Math.ceil((w + 4) / TILE) + this.rand(1, 4), false);
    }
  },

  mace(d) {
    this.flat(6);
    const count = d > 0.4 && this.rng() < 0.5 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      // These ranges were measured to always leave a gap to run through:
      // longer chains and faster swings quickly become impossible.
      const length = this.rand(38, 55);
      this.maces.push({
        x: this.col * TILE + TILE / 2,
        y: this.groundRow * TILE - 9 - length,       // ball passes at body height
        length,
        amplitude: (55 + this.rng() * 20) * Math.PI / 180,
        period: (1.9 + this.rng() * 1.3 - d * 0.1) * this.pace, // each mace swings at its own speed
        phase: this.rng(),
        spin: (this.rng() < 0.5 ? -1 : 1) * (3 + this.rng() * 4),
      });
      this.flat(i + 1 < count ? 18 : 12); // room to stop safely between two maces (even if the next section starts with one)
    }
  },

  // ---- Snow only ----

  // A slippery stretch of ice. Later on there may be spikes in the middle of it.
  ice(d) {
    this.flat(2);
    this.flat(this.rand(9, 15), true);
    if (d > 0.3 && this.rng() < 0.6) {
      for (let i = this.rand(1, 3); i > 0; i--) this.column(this.groundRow, true)[this.groundRow - 1] = T_SPIKE;
      this.flat(this.rand(9, 13), true); // room to land and slide
    }
    this.flat(2);
  },

  // A snowy rock ledge overhead with icicles under it. Get close and they shake, then drop.
  icicles() {
    this.flat(4);
    const ledgeRow = this.groundRow - 5; // its underside is 4 tiles up: you can walk under the icicles
    const width = this.rand(4, 7);
    for (let i = 0; i < width; i++) {
      this.column(this.groundRow, this.iceBias)[ledgeRow] = T_GROUND;
      if (i % 2 === 1 || (i === 0 && this.rng() < 0.5)) {
        this.icicles.push({ id: this.nextId++, x: (this.col - 1) * TILE + 1, y: (ledgeRow + 1) * TILE, len: this.rand(10, 13) });
      }
    }
    this.flat(5);
  },

  // A long open stretch. When you get close, a snowball comes rolling at you from the far end, growing as it rolls.
  snowball() {
    this.flat(this.rand(16, 22));
    this.snowballSpots.push({ id: this.nextId++, x: (this.col - 2) * TILE });
    this.flat(2);
  },

  // ---- Desert only ----

  // A sinkhole or two: little holes in the sand that open up when you step too close
  // (with flat ground all round, so you can always jump over them or out of them)
  sinkhole(d) {
    this.flat(SINK.gap + 6, false);
    const count = d > 0.4 && this.rng() < 0.4 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const size = this.bigSize(this.col);
      this.pending.push({ kind: "sink", c: this.col, size });
      this.flat(i + 1 < count ? 2 * SINK.gap + 9 : SINK.gap + 6, false);
    }
  },

  // Jungle: a giant flytrap in the open, with room in front to bait it and room behind to land
  flytrap() {
    this.iceBias = false;
    this.flat(11, false);
    this.pending.push({ kind: "flytrap", c: this.col });
    this.flat(11, false);
  },

  // Jungle: an ancient turret buried in open ground, with room to dodge its arrows where they fly:
  // in front of one that rises up ahead of you, after one that rises up behind you
  turret() {
    this.iceBias = false;
    const dir = this.rng() < 0.5 ? -1 : 1;
    this.flat(dir < 0 ? 26 : 3, false);
    this.addTurret(this.col, dir);
    this.flat(dir < 0 ? 3 : 30, false);
  },

  // Jungle: a river too wide to jump. Hop across on the drifting logs, or the current carries you back.
  river(d) {
    this.iceBias = false;
    this.flat(5);
    const [a, b] = RIVER.widths[this.pickFrom(["small", "medium", "big"])];
    const x0 = this.col * TILE, gy = this.groundRow * TILE;
    this.empty(this.rand(a, b));
    const x1 = this.col * TILE;
    this.flat(5);
    this.addRiver(x0, x1, gy, d);
  },

  // A patch of thin ice over a pond, with flat snow all round
  thinIce() {
    this.iceBias = false;
    this.flat(6, false);
    const tiles = this.rand(THIN_ICE.widths[0], THIN_ICE.widths[1]);
    this.pending.push({ kind: "pond", c: this.col, tiles });
    this.flat(tiles + 6, false);
  },

  // A pit of quicksand: step in and you sink. Spam jump to pull yourself out (or jump over it).
  quicksand(d) {
    this.flat(3);
    const width = this.rand(3, 5 + Math.round(d));
    for (let i = 0; i < width; i++) { this.column(this.groundRow); this.quick[this.col - 1] = true; }
    this.flat(4);
  },

  // A long open stretch. When you get close, a tumbleweed comes bouncing at you.
  tumbleweed() {
    this.flat(this.rand(16, 22));
    this.tumbleSpots.push({ id: this.nextId++, x: (this.col - 2) * TILE });
    this.flat(2);
  },

  // A floating orb that swaps the two players' positions. You have to jump
  // to reach it, so the player in front can choose to run underneath.
  orb() {
    this.flat(4);
    // Some orbs are freeze orbs in disguise: only the arrows in the middle are flipped
    const roll = this.rng();
    // On your own, swap / freeze / lightning / hand orbs would do nothing (or nothing good): only dashes
    const soloTotal = WIND.chance + DASH.chance + DRONE.chance; // (on your own, the drone saves you from pits)
    let kind = this.solo ? (roll < WIND.chance / soloTotal ? "wind" : roll < (WIND.chance + DASH.chance) / soloTotal ? "dash" : "drone")
      : roll < WIND.chance ? "wind"
      : roll < WIND.chance + DASH.chance ? "dash"
      : roll < WIND.chance + DASH.chance + ZAP.chance ? "zap"
      : roll < WIND.chance + DASH.chance + ZAP.chance + HAND.chance ? "hand"
      : roll < WIND.chance + DASH.chance + ZAP.chance + HAND.chance + DRONE.chance ? "drone"
      : this.rng() < FREEZE_CHANCE ? "freeze" : "swap";
    // each biome's own orbs: monsoon or monkey (jungle), snowstorm or snowball (snow), sandstorm or firehawk (desert)
    if (this.biome === "jungle") {
      const r = this.rng();
      if (r < MONSOON.chance) kind = "monsoon";
      else if (r < MONSOON.chance + MONKEY.chance) kind = "monkey";
    }
    if (this.biome === "snow") {
      const r = this.rng();
      if (r < SNOWSTORM.chance) kind = "snowstorm";
      else if (r < SNOWSTORM.chance + SNOWBALL.chance) kind = "snowball";
    }
    if (this.biome === "desert") {
      const r = this.rng();
      if (r < SANDSTORM.chance) kind = "sandstorm";
      else if (r < SANDSTORM.chance + FIREHAWK.chance) kind = "firehawk";
    }
    this.orbs.push({ x: this.col * TILE, y: this.groundRow * TILE - 32, w: 8, h: 8, used: false, kind });
    this.lastOrbCol = this.col;
    this.flat(6);
  },
};
