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

class Level {
  constructor(seed) {
    this.rng = makeRng(seed);
    this.cols = [];      // cols[x][row] = tile type
    this.platforms = []; // { kind: "static" | "move" | "fall", x, y, w }
    this.portals = [];   // entrances, each with the exit it leads to
    this.exits = [];     // where portals come out (drawn only)
    this.orbs = [];      // swap orbs
    this.groundRow = MAX_GROUND_ROW;
    this.lastOrbCol = 0;
    this.nextId = 1;
    this.flat(30); // calm start
  }

  // ---- Reading the level ----

  tile(col, row) {
    if (col < 0) return T_GROUND; // invisible wall behind the start line
    if (row < 0 || row >= ROWS || col >= this.cols.length) return T_EMPTY;
    return this.cols[col][row];
  }

  isSolid(col, row) {
    return this.tile(col, row) === T_GROUND;
  }

  // Make sure the level is generated at least up to this x position.
  ensure(x) {
    while (this.cols.length * TILE < x) this.addSection();
  }

  // Move the moving platforms. `time` is seconds since the race started.
  update(time) {
    for (const p of this.platforms) {
      if (p.kind !== "move") continue;
      const t = 0.5 - 0.5 * Math.cos(2 * Math.PI * (time / p.period + p.phase));
      const newX = p.x0 + (p.x1 - p.x0) * t;
      p.dx = newX - p.x;
      p.x = newX;
    }
  }

  // ---- Building blocks ----

  get col() {
    return this.cols.length;
  }

  rand(min, max) {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  pickFrom(list) {
    return list[Math.floor(this.rng() * list.length)];
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

  column(groundRow) {
    const c = new Uint8Array(ROWS);
    if (groundRow !== null) c.fill(T_GROUND, groundRow);
    this.cols.push(c);
    return c;
  }

  flat(n) {
    for (let i = 0; i < n; i++) this.column(this.groundRow);
  }

  empty(n) {
    for (let i = 0; i < n; i++) this.column(null);
  }

  spikes(n) {
    for (let i = 0; i < n; i++) this.column(this.groundRow)[this.groundRow - 1] = T_SPIKE;
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
    const weights = { flat: 2, step: 3, spikes: 4, gap: 4, floating: 2, moving: 2, falling: 2, portal: 1 };
    if (this.col > 120 && this.col - this.lastOrbCol > 160) weights.orb = 4;

    const type = this.pickWeighted(weights);
    SECTIONS[type].call(this, this.difficulty());
    this.flat(this.rand(2, 4)); // breathing room between sections
  }
}

const SECTIONS = {
  flat() {
    this.flat(this.rand(4, 8));
  },

  // The ground steps up or down.
  step() {
    const change = this.pickFrom([-2, -1, 1, 2]);
    this.groundRow = clamp(this.groundRow - change, MIN_GROUND_ROW, MAX_GROUND_ROW);
    this.flat(this.rand(3, 6));
  },

  spikes(d) {
    this.flat(2);
    const clusters = this.rand(1, 2);
    for (let i = 0; i < clusters; i++) {
      this.spikes(this.rand(1, 2 + Math.round(d * 2)));
      this.flat(this.rand(7 - Math.round(d * 2), 8)); // room to land a full jump (less later on)
    }
  },

  // A pit. The far side may be one tile higher or lower.
  gap(d) {
    this.flat(2);
    this.empty(this.rand(2, 3 + Math.round(d * 2)));
    if (this.rng() < 0.4) {
      this.groundRow = clamp(this.groundRow + this.pickFrom([-1, 1]), MIN_GROUND_ROW, MAX_GROUND_ROW);
    }
    this.flat(3);
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
    this.flat(3);
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
    this.flat(3);
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
    this.flat(3);
  },

  // Two routes: the low road is a long spiky stretch. A portal on a high
  // ledge at the start skips straight to the end of it.
  portal(d) {
    this.flat(3);
    const start = this.col;
    const ledgeRow = this.groundRow - 4;
    this.addPlatform("static", start, ledgeRow, 3);
    const entrance = { x: (start + 1) * TILE, y: ledgeRow * TILE - 16, w: 8, h: 16 };

    this.flat(4);
    for (let i = 0; i < 3; i++) {
      this.spikes(this.rand(2, 3));
      this.flat(this.rand(4, 5)); // tight: you need short hops here
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

  // A floating orb that swaps the two players' positions. You have to jump
  // to reach it, so the player in front can choose to run underneath.
  orb() {
    this.flat(4);
    this.orbs.push({ x: this.col * TILE, y: this.groundRow * TILE - 32, w: 8, h: 8, used: false });
    this.lastOrbCol = this.col;
    this.flat(6);
  },
};
