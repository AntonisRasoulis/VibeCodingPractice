// Pixel art. Each sprite is drawn as text: every character is one pixel and
// the letter picks a color from the palette ("." is see-through).

const PALETTES = {
  red: { name: "red", c: "#e43b44", d: "#a22633", s: "#f4c08c", k: "#2a1d1a", p: "#3e2f5b" },
  blue: { name: "blue", c: "#3a8dde", d: "#1f5aa6", s: "#f4c08c", k: "#2a1d1a", p: "#3e2f5b" },
};

const HEAD = [
  "..kkkk..",
  ".kkkkkk.",
  "dcccccc.",
  "..sssks.",
  "..sssss.",
];

const RUNNER_FRAMES = {
  idle: HEAD.concat([
    "..cccc..",
    ".cccccc.",
    ".sccccs.",
    "..pppp..",
    "..pppp..",
    "..p..p..",
    "..kk.kk.",
  ]),
  run1: HEAD.concat([
    "..cccc..",
    ".ccccccs",
    "sccccc..",
    "..pppp..",
    ".pp..pp.",
    ".p....p.",
    "kk....kk",
  ]),
  run2: HEAD.concat([
    "..cccc..",
    ".cccccc.",
    ".sccccs.",
    "..pppp..",
    "...pp...",
    "...pp...",
    "...kkk..",
  ]),
  jump: HEAD.concat([
    "..cccc.s",
    ".cccccc.",
    "s.cccc..",
    "..pppp..",
    "..pp.pp.",
    ".kk...p.",
    "......kk",
  ]),
};

const SPIKE_ROWS = [
  "........",
  "........",
  "........",
  ".l...l..",
  ".lg..lg.",
  "llg.llg.",
  "llggllgg",
  "oooooooo",
];

const ORB_ROWS = [
  "..oooo..",
  ".oyyyyo.",
  "oyw..yyo",
  "oywwwwyo",
  "oywwwwyo",
  "oyy..wyo",
  ".oyyyyo.",
  "..oooo..",
];

// The freeze orb is the swap orb with its middle (the arrows) flipped upside down
const FREEZE_ORB_ROWS = [ORB_ROWS[0], ORB_ROWS[1], ...ORB_ROWS.slice(2, 6).reverse(), ORB_ROWS[6], ORB_ROWS[7]];

// The dash orb has a "»" (double arrow pointing right) in the middle
const DASH_ORB_ROWS = [
  "..oooo..",
  ".oyyyyo.",
  "oywyywyo",
  "oyywyywo",
  "oyywyywo",
  "oywyywyo",
  ".oyyyyo.",
  "..oooo..",
];

// The lightning orb has a white zigzag bolt in the middle
const ZAP_ORB_ROWS = [
  "..oooo..",
  ".oyyywo.",
  "oyyywyyo",
  "oyywwwyo",
  "oywwwyyo",
  "oyywyyyo",
  ".owyyyo.",
  "..oooo..",
];

// The wind dash orb has one bold white arrow (the big dash orb has a »).
// Its white wind wisps are drawn separately so they can blow off it.
const WIND_ORB_ROWS = [
  "..oooo..",
  ".oyyyyo.",
  "oyyyywyo",
  "oywwwwwo",
  "oywwwwwo",
  "oyyyywyo",
  ".oyyyyo.",
  "..oooo..",
];

// ---- Mystic hand (purple) ----

// Open hand flying right, reaching to grab (wispy glowing wrist on the left)
const HAND_OPEN_ROWS = [
  ".........oo.......",
  "........oplo......",
  ".......opplo......",
  "..ooooopplooooo...",
  ".opppppppllllllo..",
  "owppppppoooooooo..",
  ".oppwpppplllllllo.",
  "owppppppoooooooo..",
  ".opppppplllllllo..",
  "owppppppooooooo...",
  ".oppppplllllo.....",
  "..oppppooooo......",
  "...oooo...........",
];

// Back of the hand flying left, for the backhand swat (knuckle marks in light purple)
const HAND_BACK_ROWS = [
  ".......oo.........",
  "......odpo........",
  "......odppo.......",
  "...ooooodppooooo..",
  "..oddddddkppppppo.",
  "..oooooooopppppppo",
  ".odddddddkppppppo.",
  "..oooooooopppppppo",
  "..oddddddkppppppo.",
  "...ooooooopppppppo",
  ".....oddddkpppppo.",
  "......oooooppppo..",
  "...........oooo...",
];

// Fist closed around the other player, knuckles to the right
const HAND_FIST_ROWS = [
  "...oooooo...",
  "..opppllloo.",
  ".oppwppllllo",
  "oppppoooooo.",
  "oppppllllllo",
  "oppppoooooo.",
  "oppppllllllo",
  "oppppoooooo.",
  "oppppllllllo",
  ".oppppppppo.",
  "..oooooooo..",
];

// The hand orb: gold coin with a purple raised hand and a light-purple highlight
const HAND_ORB_ROWS = [
  "..gggg..",
  ".gvyvyg.",
  "gyvyvyvg",
  "gyvlvvyg",
  "gvvvvvyg",
  "gyvvvvyg",
  ".gyvvyg.",
  "..gggg..",
];

const HAND_PALETTE = { o: "#3b1f5e", p: "#9b5de5", l: "#c9a3ff", w: "#f5e8ff", d: "#6a3fb0", k: "#c9a3ff" };

// ---- Missiles (pointing right; rotated to aim when drawn) ----

// Black missile: fires straight at where you are
const MISSILE_ROWS = [
  "..kk..............",
  "..kkk.............",
  "oykkkkkkkkkkkkkkh.",
  "yykhhhhhhhhhhhhhhk",
  "oykgggggggggggggk.",
  "..kkk.............",
  "..kk..............",
];

// Red-striped missile: aims at where you're going to be
const MISSILE_STRIPED_ROWS = [
  "..rr..............",
  "..kkk.............",
  "oykkkkkkkkkrrkkkh.",
  "yykhhhhhhhhrrhhhhk",
  "oykggggggggRRgggk.",
  "..kkk.............",
  "..rr..............",
];

const MISSILE_PALETTE = { k: "#1b1b22", g: "#3a3d44", h: "#6b707a", r: "#e43b44", R: "#a22633", y: "#ffd23f", o: "#f77f00" };

const CLOUD_ROWS = [
  "....wwww......",
  "..wwwwwwww.ww.",
  ".wwwwwwwwwwwww",
  "wwwwwwwwwwwwww",
  ".bbbbbbbbbbbb.",
];

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function spriteFromRows(rows, palette) {
  const c = makeCanvas(rows[0].length, rows.length);
  const g = c.getContext("2d");
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === ".") continue;
      g.fillStyle = palette[row[x]];
      g.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

// A number from 0 to 1 that is always the same for the same inputs.
// Used to scatter flowers, speckles and clouds without them flickering.
function hash(a, b = 0) {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function makeGroundTile(variant, grassy) {
  const c = makeCanvas(TILE, TILE);
  const g = c.getContext("2d");
  g.fillStyle = "#b86f50";
  g.fillRect(0, 0, TILE, TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash(x + variant * 31, y + variant * 17);
      if (n < 0.08) g.fillStyle = "#8f4f36";
      else if (n > 0.94) g.fillStyle = "#d08b62";
      else continue;
      g.fillRect(x, y, 1, 1);
    }
  }
  if (grassy) {
    g.fillStyle = "#63c74d";
    g.fillRect(0, 0, TILE, 2);
    g.fillStyle = "#3e8948";
    for (let x = 0; x < TILE; x++) {
      if (hash(x, variant) < 0.5) g.fillRect(x, 2, 1, 1);
    }
    g.fillStyle = "#8be070";
    g.fillRect(Math.floor(hash(variant, 9) * 6), 0, 2, 1);
  }
  return c;
}

// ---- Snow biome ----

function px(g, color, x, y, w = 1, h = 1) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

// Frozen dirt, with snow on top if it's the surface
function makeSnowTile(variant, top) {
  const c = makeCanvas(TILE, TILE);
  const g = c.getContext("2d");
  px(g, "#6e5f6b", 0, 0, TILE, TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = hash(x + variant * 31, y + variant * 17);
      if (n < 0.08) px(g, "#53465a", x, y);
      else if (n > 0.93) px(g, "#a9b9cf", x, y); // frost
    }
  }
  if (top) {
    px(g, "#ffffff", 0, 0, TILE, 3);
    px(g, "#d6e6f5", 0, 3, TILE, 1);
    for (let x = 0; x < TILE; x++) if (hash(x, variant + 3) < 0.4) px(g, "#ffffff", x, 3); // little drips
    px(g, "#e9f3fb", Math.floor(hash(variant, 9) * 6), 1, 2, 1);
  }
  return c;
}

// The slippery ice surface
function makeIceTile(variant) {
  const c = makeCanvas(TILE, TILE);
  const g = c.getContext("2d");
  px(g, "#8fd3f0", 0, 0, TILE, TILE);
  px(g, "#e8fbff", 0, 0, TILE, 1);
  px(g, "#bfefff", 0, 1, TILE, 1);
  px(g, "#5fb0d8", 0, 7, TILE, 1);
  const s = (variant * 3) % TILE;
  for (let k = 0; k < 3; k++) px(g, "#ffffff", (s + k) % TILE, 2 + k); // shine streak
  return c;
}

// Ice spikes: shards of ice, taller and thinner than regular spikes. Each tile
// is either a couple of thin shards or a cluster (a tall one with small ones beside it).
const ICE_SPIKE_SHARDS = [
  [[0, 3, 7], [4, 3, 8]], [[1, 3, 8], [5, 3, 6]], [[0, 3, 8], [4, 3, 7]],                  // thin shards
  [[0, 2, 5], [2, 3, 8], [5, 2, 6]], [[0, 2, 6], [2, 4, 8], [6, 2, 5]], [[1, 2, 6], [3, 3, 8], [5, 2, 5]], // clusters
];

function makeIceSpike(shards) {
  const c = makeCanvas(TILE, TILE);
  const g = c.getContext("2d");
  for (const [x, w, h] of shards) {
    for (let y = 0; y < h; y++) {
      const ww = Math.max(1, Math.round(w * (y + 1) / h));
      const sx = x + Math.floor((w - ww) / 2);
      const sy = TILE - h + y;
      px(g, "#6cc4ef", sx, sy, ww, 1);
      px(g, y < 2 ? "#ffffff" : "#d4f4ff", sx, sy);
      if (ww > 1) px(g, "#2b6fa8", sx + ww - 1, sy);
    }
  }
  px(g, "#2b6fa8", 0, TILE - 1, TILE, 1);
  return c;
}

// An icicle: a chunk of ice at the top, tapering to a sharp point
function makeIcicle(len) {
  const c = makeCanvas(6, len);
  const g = c.getContext("2d");
  for (let y = 0; y < len; y++) {
    const w = y < 2 ? 6 : Math.max(1, Math.round(5 * (1 - (y - 2) / (len - 2))));
    const x = Math.floor((6 - w) / 2);
    px(g, "#9ee2fb", x, y, w, 1);
    if (w > 1) px(g, "#ffffff", x, y);
    if (w > 2) px(g, "#4f9fcf", x + w - 1, y);
  }
  px(g, "#ffffff", 0, 0, 6, 1);
  return c;
}

function makeSnowball(r) {
  const d = r * 2 + 1;
  const c = makeCanvas(d, d);
  const g = c.getContext("2d");
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const dx = x - r, dy = y - r, q = dx * dx + dy * dy;
      if (q > r * r + r * 0.5) continue;
      const edge = q > (r - 1) * (r - 1);
      px(g, edge ? "#9fb7cf" : dx + dy < -r * 0.5 ? "#ffffff" : dx + dy > r * 0.6 ? "#cfe0ef" : "#f2f8fd", x, y);
    }
  }
  return c;
}

// The wooden sign at the start of a biome
function makeSign(biome) {
  const c = makeCanvas(20, 22);
  const g = c.getContext("2d");
  px(g, "#7a4a2e", 9, 10, 2, 12);
  px(g, "#c28b5a", 0, 0, 20, 11);
  px(g, "#8f563b", 0, 10, 20, 1);
  px(g, "#8f563b", 19, 0, 1, 11);
  if (biome === "snow") {
    px(g, "#ffffff", 0, 0, 20, 2);
    px(g, "#ffffff", 2, 2, 3, 1);
    px(g, "#ffffff", 13, 2, 4, 1);
    for (const [x, y] of [[10, 3], [10, 4], [10, 5], [10, 6], [10, 7], [8, 5], [9, 5], [11, 5], [12, 5], [8, 3], [12, 3], [8, 7], [12, 7]]) px(g, "#e8f6ff", x, y);
  } else {
    // a little green sprout with a flower
    for (const [x, y] of [[10, 4], [10, 5], [10, 6], [10, 7], [9, 6], [11, 5]]) px(g, "#3e8948", x, y);
    for (const [x, y] of [[8, 5], [12, 4]]) px(g, "#63c74d", x, y);
    px(g, "#feae34", 9, 2, 3, 1);
    px(g, "#feae34", 10, 1, 1, 3);
    px(g, "#ffffff", 10, 2);
  }
  return c;
}

// A pine tree with a snowy cap on top (for the background)
function makePine(h, variant) {
  const w = Math.round(h * 0.75) | 1;
  const c = makeCanvas(w, h + 3);
  const g = c.getContext("2d");
  const mid = (w - 1) / 2;
  for (let tier = 0; tier < 3; tier++) {
    const top = Math.round((tier * h) / 4);
    const bot = Math.round(top + h / 2);
    for (let y = top; y < Math.min(bot, h); y++) {
      const half = Math.round(((y - top) / (bot - top)) * (w / 2));
      px(g, "#2f5e4e", mid - half, y, half * 2 + 1, 1);
      if (half > 0) px(g, "#447a66", mid - half, y);
    }
  }
  // The snow cap: thick on top, uneven where it ends, with a soft blue shadow underneath
  const capTop = Math.round(h / 2);
  for (let x = 0; x < w; x++) {
    let depth = Math.round(capTop * 0.55) + (hash(x, variant) < 0.4 ? 1 : 0) - Math.round(Math.abs(x - mid) * 0.35);
    for (let y = 0; y < depth; y++) {
      const half = Math.round((y / capTop) * (w / 2));
      if (Math.abs(x - mid) > half) continue;
      px(g, y === depth - 1 ? "#cfe0ef" : x < mid && y > 0 ? "#ffffff" : "#eef5fb", x, y);
    }
  }
  px(g, "#ffffff", mid, 0);
  px(g, "#5a3d2b", mid - 1, h, 2, 3);
  return c;
}

function buildSprites() {
  const runners = {};
  for (const [name, palette] of Object.entries(PALETTES)) {
    runners[name] = {};
    for (const [frame, rows] of Object.entries(RUNNER_FRAMES)) {
      runners[name][frame] = spriteFromRows(rows, palette);
    }
  }
  const grass = [0, 1, 2, 3].map((v) => makeGroundTile(v, true));
  const dirt = [0, 1, 2, 3].map((v) => makeGroundTile(v + 4, false));
  return {
    runners,
    grass,
    dirt,
    spike: spriteFromRows(SPIKE_ROWS, { l: "#e8e8f0", g: "#9a9ab0", o: "#5a5a70" }),
    orb: spriteFromRows(ORB_ROWS, { o: "#b8860b", y: "#ffd23f", w: "#ffffff" }),
    freezeOrb: spriteFromRows(FREEZE_ORB_ROWS, { o: "#b8860b", y: "#ffd23f", w: "#ffffff" }),
    dashOrb: spriteFromRows(DASH_ORB_ROWS, { o: "#b8860b", y: "#ffd23f", w: "#ffffff" }),
    zapOrb: spriteFromRows(ZAP_ORB_ROWS, { o: "#b8860b", y: "#ffd23f", w: "#ffffff" }),
    windOrb: spriteFromRows(WIND_ORB_ROWS, { o: "#b8860b", y: "#ffd23f", w: "#ffffff" }),
    handOrb: spriteFromRows(HAND_ORB_ROWS, { g: "#b8860b", y: "#ffd23f", v: "#9b5de5", l: "#c9a3ff" }),
    handOpen: spriteFromRows(HAND_OPEN_ROWS, HAND_PALETTE),
    handBack: spriteFromRows(HAND_BACK_ROWS, HAND_PALETTE),
    handFist: spriteFromRows(HAND_FIST_ROWS, HAND_PALETTE),
    missile: spriteFromRows(MISSILE_ROWS, MISSILE_PALETTE),
    missileStriped: spriteFromRows(MISSILE_STRIPED_ROWS, MISSILE_PALETTE),
    cloud: spriteFromRows(CLOUD_ROWS, { w: "#ffffff", b: "#d6eefc" }),
    snowTop: [0, 1, 2, 3].map((v) => makeSnowTile(v, true)),
    snowDirt: [0, 1, 2, 3].map((v) => makeSnowTile(v + 4, false)),
    ice: [0, 1, 2, 3].map(makeIceTile),
    iceSpikes: ICE_SPIKE_SHARDS.map(makeIceSpike),
    icicles: Object.fromEntries([10, 11, 12, 13].map((len) => [len, makeIcicle(len)])),
    snowballs: [2, 3, 4, 5, 6, 7, 8, 9].map(makeSnowball),
    signs: { snow: makeSign("snow"), prairie: makeSign("prairie") },
    pines: [12, 14, 16, 18].map((h, i) => makePine(h, i)),
  };
}
