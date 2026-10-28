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

// Light blue coin for the orbs that give you an ability to use with S / Down
const ABILITY_ORB_PALETTE = { o: "#0d3f66", y: "#4fc0ff", w: "#ffffff" }; // dark outline so it stands out on the sky

// ---- Rescue drone (white) ----
const DRONE_FRAMES = {
  a: ["oooo........oooo", ".dd..........dd.", "..o..oooooo..o..", "..oooggwwgggooo.", "....ogwwbbwgo...", "....oggwwwggo...", ".....oooooo.....", "......k..k......", ".....kk..kk....."],
  b: [".oo..........oo.", "dd............dd", "..o..oooooo..o..", "..oooggwwgggooo.", "....ogwwbbwgo...", "....oggwwwggo...", ".....oooooo.....", "......k..k......", ".....k....k....."],
  grab: ["oooo........oooo", ".dd..........dd.", "..o..oooooo..o..", "..oooggwwgggooo.", "....ogwwrrwgo...", "....oggwwwggo...", ".....oooooo.....", ".....k....k.....", ".....kk..kk....."],
};
const DRONE_PALETTE = { o: "#1c2633", w: "#ffffff", g: "#c9d4df", d: "#8a9aab", b: "#4fc0ff", r: "#ff4d6d", k: "#3a4656" };
// The drone orb: a little white drone on the light blue coin
const DRONE_ORB_ROWS = ["..oooo..", ".oyyyyo.", "oywwwwyo", "owywwywo", "oyywwyyo", "oywyywyo", ".oyyyyo.", "..oooo.."];

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
  } else if (biome === "desert") {
    // a blazing sun
    px(g, "#ffcc33", 8, 3, 4, 4);
    px(g, "#ffcc33", 9, 2, 2, 6);
    px(g, "#ffcc33", 7, 4, 6, 2);
    for (const [x, y] of [[6, 2], [13, 2], [6, 7], [13, 7], [10, 0], [10, 9], [5, 5], [14, 5]]) px(g, "#ffe28a", x, y);
  } else if (biome === "jungle") {
    // a big jungle leaf, and a vine wound round the post
    for (const [x, y] of [[6, 3], [7, 2], [8, 2], [9, 3], [10, 3], [11, 4], [12, 5], [7, 3], [8, 3], [8, 4], [9, 4], [10, 4], [9, 5], [10, 5], [11, 5], [7, 4], [8, 5], [13, 6]]) px(g, "#4fb04a", x, y);
    px(g, "#2d6b25", 8, 4);
    px(g, "#2d6b25", 10, 5);
    px(g, "#2d6b25", 12, 6);
    for (const [x, y] of [[9, 12], [10, 13], [11, 14], [9, 15], [10, 16], [11, 17], [9, 18], [10, 19]]) px(g, "#3f8f2f", x, y);
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

// ---- Desert biome ----

function makeSandTile(variant, top) {
  const c = makeCanvas(TILE, TILE);
  const g = c.getContext("2d");
  px(g, "#c98a4b", 0, 0, TILE, TILE);
  if (top) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const n = hash(x + variant * 31, y + variant * 17);
      if (n < 0.1) px(g, "#a86b36", x, y);
      else if (n > 0.92) px(g, "#e0a868", x, y);
    }
    px(g, "#f2d091", 0, 0, TILE, 2);
    px(g, "#e3b673", 0, 2, TILE, 1);
    for (let x = 0; x < TILE; x++) if (hash(x, variant + 2) < 0.3) px(g, "#fbe3b0", x, 0);
  } else {
    // layered sandstone
    px(g, "#b57a3f", 0, 3, TILE, 1);
    px(g, "#b57a3f", 0, 7, TILE, 1);
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (hash(x + variant * 13, y + variant * 7) < 0.07) px(g, "#a86b36", x, y);
  }
  return c;
}

// Quicksand: dark, wet sand with swirls that slowly turn (4 frames)
function makeQuicksand(frame, variant) {
  const c = makeCanvas(TILE, TILE);
  const g = c.getContext("2d");
  px(g, "#9c6a36", 0, 0, TILE, TILE);
  px(g, "#7d5226", 0, 5, TILE, 3);
  px(g, "#b88247", 0, 0, TILE, 1);
  for (let k = 0; k < 3; k++) {
    const x = (variant * 3 + k * 3 + frame * 2) % TILE;
    px(g, "#c9955a", x, 1 + k, 2, 1);           // swirl ripples drifting along
    px(g, "#6b4420", (x + 4) % TILE, 2 + k * 2, 1, 1);
  }
  if ((frame + variant) % 4 === 0) px(g, "#d9a96a", (variant * 5) % 6 + 1, 0, 2, 1); // a bubble popping
  return c;
}

// Saguaro cactus, h pixels tall. arms: 0 = left arm, 1 = right arm, 2 = both
function makeCactus(h, arms) {
  const c = makeCanvas(12, h);
  const g = c.getContext("2d");
  const x0 = 4;
  const armL = arms !== 1 ? Math.round(h * 0.55) : 0;
  const armR = arms !== 0 ? Math.round(h * 0.45) : 0;
  if (armL) { px(g, "#3f8a3a", 1, armL, 3, 2); px(g, "#3f8a3a", 1, armL - 4, 2, 5); px(g, "#5fb357", 1, armL - 4, 1, 5); px(g, "#f6f0d8", 0, armL - 3); }
  if (armR) { px(g, "#3f8a3a", 8, armR, 3, 2); px(g, "#3f8a3a", 9, armR - 5, 2, 6); px(g, "#2d6a2b", 10, armR - 5, 1, 6); px(g, "#f6f0d8", 11, armR - 4); }
  px(g, "#3f8a3a", x0, 1, 4, h - 1);
  px(g, "#2d6a2b", x0 + 3, 1, 1, h - 1);
  px(g, "#5fb357", x0, 1, 1, h - 1);
  px(g, "#3f8a3a", x0 + 1, 0, 2, 1);
  for (let y = 2; y < h - 1; y += 3) { px(g, "#f6f0d8", x0 - 1, y); px(g, "#f6f0d8", x0 + 4, y + 1); } // spines
  px(g, "#ff6b9a", x0 + 1, 0, 2, 1); // a flower on top
  return c;
}

// Tumbleweed: a tangled ball of dry twigs (drawn turning as it rolls)
function makeTumbleweed() {
  const d = DESERT.tumbleR * 2 + 1;
  const c = makeCanvas(d, d);
  const g = c.getContext("2d");
  const r = DESERT.tumbleR;
  for (let k = 0; k < 70; k++) {
    const a = hash(k, 1) * Math.PI * 2;
    const rr = (k < 30 ? r - 0.5 : hash(k, 2) * (r - 1));
    px(g, k % 4 === 0 ? "#5e3d1d" : k % 3 ? "#a3743f" : "#c99a5e", Math.round(r + Math.cos(a) * rr), Math.round(r + Math.sin(a) * rr));
  }
  // a few twigs poking out
  for (const [x, y] of [[0, r - 2], [d - 1, r + 1], [r + 1, 0], [r - 2, d - 1]]) px(g, "#7a5228", x, y);
  return c;
}

// ---- Jungle biome ----

// Dark soil, with a mossy top if it's the surface
function makeJungleTile(variant, top) {
  const c = makeCanvas(TILE, TILE);
  const g = c.getContext("2d");
  px(g, "#4a2f22", 0, 0, TILE, TILE);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const n = hash(x + variant * 31, y + variant * 17);
    if (n < 0.1) px(g, "#36211a", x, y);
    else if (n > 0.93) px(g, "#6a4632", x, y);
  }
  if (top) {
    px(g, "#3f8f2f", 0, 0, TILE, 3);
    px(g, "#2d6b25", 0, 3, TILE, 1);
    for (let x = 0; x < TILE; x++) {
      if (hash(x, variant + 3) < 0.45) px(g, "#2d6b25", x, 4);
      if (hash(x, variant + 7) < 0.3) px(g, "#6bc24a", x, 0);
    }
  }
  return c;
}

// A bamboo stake, h pixels tall, with a sharpened slanted top (one of the jungle's spikes)
function makeBamboo(h) {
  const c = makeCanvas(5, h);
  const g = c.getContext("2d");
  for (let y = 0; y < h; y++) {
    if (y < 4) {
      const w = y < 1 ? 1 : y < 2 ? 2 : 3;
      px(g, y < 3 ? "#e8e2a0" : "#9fcf5a", 4 - w, y, w, 1);
      if (y >= 2) px(g, "#5f8f2a", 4 - w, y);
      continue;
    }
    px(g, "#7fbf3f", 1, y, 3, 1);
    px(g, "#b7e07a", 1, y);
    px(g, "#4f7f24", 3, y);
    if ((h - y) % 7 === 3) { // the joints
      px(g, "#3f6a1c", 1, y, 3, 1);
      px(g, "#4f7f24", 0, y, 5, 1);
    }
  }
  return c;
}

// A thorn bush `tiles` wide (the jungle's other spike): a low tangle of bramble with long thorns
// sticking out all along its top and sides. It overhangs its tiles by 3 pixels each side.
function makeThorns(tiles) {
  const w = tiles * TILE, h = 9, pad = 3, W = w + pad * 2, H = h + pad + 1;
  const c = makeCanvas(W, H);
  const g = c.getContext("2d");
  const top = (x) => pad + 2 + Math.round(1.5 * Math.sin(x * 0.9) + Math.sin(x * 0.37 + 1));
  const body = [];
  for (let x = pad; x < W - pad; x++) for (let y = top(x); y < H; y++) body.push([x, y]);
  const inside = new Set(body.map(([x, y]) => x + "," + y));
  for (const [x, y] of body) px(g, "#2c5428", x, y);
  // twisted brown stems through the leaves
  for (let k = 0; k < w / 4; k++) {
    const x0 = pad + hash(k, 11) * w, x1 = x0 + (hash(k, 12) - 0.5) * 12, y1 = pad + 3 + hash(k, 13) * 3;
    for (let u = 0; u <= 1; u += 0.05) {
      const x = Math.round(x0 + (x1 - x0) * u), y = Math.round(H - 1 + (y1 - H + 1) * u);
      if (inside.has(x + "," + y)) px(g, "#5a3a20", x, y);
    }
  }
  for (let x = pad + 1; x < W - pad - 1; x++) if (hash(x, 4) < 0.3) px(g, "#3f7a34", x, top(x) + 2 + Math.floor(hash(x, 5) * 4));
  // dark outline
  for (const [x, y] of body) for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) if (!inside.has(x + dx + "," + (y + dy))) px(g, "#122812", x + dx, y + dy);
  const thorn = (x, y, dx, dy, len) => { for (let i = 1; i <= len; i++) px(g, i === len ? "#ffd8c8" : "#b82a2a", x + dx * i, y + dy * i); };
  for (let x = pad; x < W - pad; x += 2) {
    const r = hash(x, 21);
    thorn(x, top(x), r < 0.33 ? -1 : r < 0.66 ? 0 : 1, -1, r > 0.8 ? 3 : 2);
  }
  for (let y = pad + 3; y < H - 1; y += 2) {
    const up = y % 4 === 1 ? -1 : 0;
    thorn(pad, y, -1, up, 2);
    thorn(W - pad - 1, y, 1, up, 2);
  }
  return c;
}

// A log floating down a jungle river, `tiles` long: bark, cut ends, a little moss
function makeLog(tiles) {
  const w = tiles * TILE;
  const c = makeCanvas(w, 7);
  const g = c.getContext("2d");
  px(g, "#3a2414", 0, 0, w, 7);
  px(g, "#7a4e2a", 1, 1, w - 2, 5);
  px(g, "#9a6a3a", 1, 1, w - 2, 1);
  px(g, "#5e3a1e", 1, 4, w - 2, 1);
  for (let x = 4; x < w - 4; x += 5) px(g, "#5e3a1e", x + (x % 3), 2, 2, 1); // bark
  px(g, "#c99a5a", w - 3, 1, 2, 5); // cut ends with rings
  px(g, "#9a6a3a", w - 2, 3);
  px(g, "#c99a5a", 1, 1, 2, 5);
  px(g, "#9a6a3a", 1, 3);
  if (tiles > 3) {
    px(g, "#3f8f2f", Math.floor(w * 0.4), 0, 3, 1);
    px(g, "#6bc24a", Math.floor(w * 0.4) + 1, 0);
  }
  return c;
}

// Palm trees (without their coconuts), in the 5 kinds of PALMS: a classic one curving gently, one
// leaning hard with a pale crosshatched trunk, a tall straight royal palm with a green crownshaft
// and fronds arching up, a short fat fan palm with a shaggy skirt of dead fronds, and a windswept
// one with an S-bent trunk and every frond blown one way. The trunk's foot is at (PALM_FOOT_X,
// bottom) and its crown (where the coconuts hang) at (PALM_FOOT_X + lean, PALM_CROWN_Y).
const PALM_FOOT_X = 28, PALM_CROWN_Y = 24;
function makePalm(h, kind) {
  const P = PALMS[kind];
  const T = Math.round(h * P.tall) - 9; // trunk height
  const W = 56, H = T + PALM_CROWN_Y;
  const c = makeCanvas(W, H);
  const g = c.getContext("2d");
  const cx = PALM_FOOT_X + P.lean, cy = PALM_CROWN_Y;
  // the trunk: x at height u (0 = foot, 1 = crown)
  const trunkX = [
    (u) => P.lean * Math.sin((u * Math.PI) / 2),
    (u) => P.lean * u * u,
    () => 0,
    (u) => P.lean * u,
    (u) => P.lean * u + 4 * Math.sin(u * Math.PI * 2),
  ][kind];
  const width = [4, 4, 4, 6, 4][kind];
  const bark = [
    ["#8a5a32", "#b07a48", "#5e3a1e"],
    ["#b08a5a", "#d4b07a", "#7a5a34"],
    ["#a89c84", "#cfc4aa", "#7e7462"],
    ["#5e3a1e", "#7a4e2a", "#3e2414"],
    ["#8a4a32", "#b06a48", "#5e2a1e"],
  ][kind];
  for (let y = cy; y < H; y++) {
    const u = (H - 1 - y) / (H - 1 - cy);
    const x = Math.round(PALM_FOOT_X + trunkX(u) - width / 2);
    px(g, bark[0], x, y, width, 1);
    px(g, bark[1], x, y);
    px(g, bark[2], x + width - 1, y);
    if (kind === 1) { if ((y + x) % 3 === 0) px(g, bark[2], x + 1 + (y % 2), y); } // crosshatch
    else if (kind === 2) { // smooth and pale, faint rings, a green crownshaft at the top
      if (y < cy + 9) { px(g, y < cy + 8 ? "#5f9a3a" : "#3f6a2a", x, y, width, 1); px(g, "#7fba5a", x, y); }
      else if (y % 6 === 0) px(g, bark[2], x, y, width, 1);
    }
    else if (y % (kind === 3 ? 3 : 4) === 0) px(g, bark[2], x, y, width, 1); // rings
  }
  // a frond: out from the crown at angle a (degrees, 0 = right, -90 = up), drooping as it goes
  const frond = (a, len, droop, cols, thick = 1) => {
    const r = (a * Math.PI) / 180;
    for (let k = 0; k < len; k++) {
      const u = k / len;
      const x = Math.round(cx + Math.cos(r) * k), y = Math.round(cy + Math.sin(r) * k + droop * u * u * len);
      px(g, cols[0], x, y, 1 + thick, 1);
      if (k % 2 && k > 1) { px(g, cols[1], x, y + 1); px(g, cols[2], x + 1, y + 2); }
    }
  };
  const green = ["#2f8a3a", "#4fb04a", "#1f6a2a"], dark = ["#1f6a3a", "#3f8f4a", "#154a22"];
  const light = ["#5fae3a", "#8fd05a", "#3f7a24"], dead = ["#8a6a3a", "#b08a4a", "#5e4424"];
  if (kind === 0) for (const [a, l, d] of [[-15, 16, 0.6], [195, 16, 0.6], [10, 13, 0.6], [170, 13, 0.6], [-70, 9, 0.6], [-110, 9, 0.6]]) frond(a, l, d, green);
  if (kind === 1) for (const [a, l, d] of [[-5, 20, 0.85], [185, 19, 0.85], [20, 15, 0.8], [160, 15, 0.8], [-60, 12, 0.9], [-120, 12, 0.9], [60, 10, 0.5]]) frond(a, l, d, dark);
  if (kind === 2) for (const [a, l, d] of [[-30, 20, 0.5], [-150, 20, 0.5], [-5, 18, 0.65], [-175, 18, 0.65], [-55, 17, 0.4], [-125, 17, 0.4], [-78, 14, 0.25], [-102, 14, 0.25], [15, 13, 0.8], [165, 13, 0.8]]) frond(a, l, d, green);
  if (kind === 3) {
    // a skirt of dead fronds hanging under the crown, then round fans of stiff leaves
    for (let k = -6; k <= 6; k++) for (let y = 0; y < 13 - Math.abs(k); y++) {
      if (k % 2 && y > 2) continue; // hanging in strands
      px(g, y > 8 ? dead[2] : y > 4 ? dead[0] : dead[1], cx + k, cy + 1 + y);
    }
    for (const [fa, l] of [[-160, 12], [-20, 12], [-90, 11], [-125, 11], [-55, 11]]) for (let ray = -24; ray <= 24; ray += 12) frond(fa + ray, l - Math.abs(ray) / 10, 0.04, light, 0);
  }
  if (kind === 4) {
    for (const [a, l, d] of [[-10, 18, 0.5], [10, 17, 0.6], [30, 14, 0.8], [-35, 15, 0.45], [-60, 11, 0.6], [160, 9, 0.9]]) frond(a, l, d, green);
    frond(100, 10, 0.2, dead); // a couple of dead ones hanging down
    frond(80, 8, 0.2, dead);
  }
  c.footX = PALM_FOOT_X;
  return c;
}

// A coconut (5x5), and its two halves once it has cracked open on the ground
function makeCoconut(half) {
  const c = makeCanvas(5, 5);
  const g = c.getContext("2d");
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const dx = x - 2, dy = y - 2;
    if (dx * dx + dy * dy > 5) continue;
    if (half && y < 2) continue;
    px(g, "#6a4024", x, y);
  }
  if (half) {
    px(g, "#f4eedc", 1, 2, 3, 1); // the white inside
  } else {
    px(g, "#9a6a3e", 1, 1);
    px(g, "#8a5a32", 2, 1);
    px(g, "#4a2a16", 3, 3);
  }
  return c;
}

// A giant flytrap: two jaws hinged at the bottom (red insides, teeth along the rims) on a stem with
// leaves. `angle`: how far each jaw tips out from upright (0 = shut into a pod). `lift`: how much
// higher its head is (lunging). `chew`: squashed wide (chewing). `gulp`: a lump going down the stem.
// The canvas is FLYTRAP_H tall with the ground at the bottom; .mouthY is the top of its head.
const FLYTRAP_H = 50;
function makeFlytrap(big, angle, lift = 0, chew = false, gulp = false) {
  const C = big
    ? { out: "#3a0c2a", back: "#7a2a6a", hi: "#a24a92", inner: "#e8304e", inner2: "#ff8aa0", tooth: "#f8e8f0", stem: "#4a1a3a", leaf: "#6a2a5a" }
    : { out: "#1a3412", back: "#4f9a2f", hi: "#86c85a", inner: "#d8364a", inner2: "#ff8a9a", tooth: "#f0f6c8", stem: "#3f7a24", leaf: "#4f9a2f" };
  const shut = angle === 0;
  const L = big ? 12 : 8.5, T = (big ? 7 : 5) * (shut ? 1.15 : 1);
  const W = big ? 36 : 26, H = FLYTRAP_H;
  const hinge = H - (big ? 12 : 9) - lift;
  const cx = W / 2;
  const sqL = chew ? 0.85 : 1, sqT = chew ? 1.22 : 1;
  const grid = new Map();
  const set = (x, y, col) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) grid.set(x + "," + y, col); };
  const ell = (ex, ey, rx, ry, ang, col) => {
    const ca = Math.cos(ang), sa = Math.sin(ang), R = Math.max(rx, ry) + 1;
    for (let y = Math.floor(ey - R); y <= ey + R; y++) for (let x = Math.floor(ex - R); x <= ex + R; x++) {
      const u = ((x - ex) * ca + (y - ey) * sa) / rx, v = (-(x - ex) * sa + (y - ey) * ca) / ry;
      if (u * u + v * v <= 1.05) set(x, y, col);
    }
  };
  // leaves and the stem
  for (const sd of [-1, 1]) ell(cx + sd * (big ? 6 : 4.5), H - 2, big ? 6 : 4.5, 1.6, sd * 0.25, C.leaf);
  for (let y = hinge; y < H; y++) for (let k = 0; k < (big ? 3 : 2); k++) set(cx - 1 + k, y, C.stem);
  if (gulp) ell(cx, (hinge + H) / 2 + 1, big ? 3 : 2.5, big ? 3 : 2.5, 0, C.stem);
  // the jaws
  const teeth = [];
  for (const sd of [-1, 1]) {
    const ux = sd * Math.sin(angle), uy = -Math.cos(angle), nx = sd * Math.cos(angle), ny = Math.sin(angle);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const rx = x + 0.5 - cx, ry = y + 0.5 - hinge;
      const a = (rx * ux + ry * uy) / sqL, d = rx * nx + ry * ny + (shut ? 0.5 : 0);
      if (a < 0 || a > L) continue;
      const th = T * Math.pow(Math.sin(Math.PI * Math.min(1, (a / L) * 0.85 + 0.12)), 0.45) * sqT;
      if (d < 0 || d > th) continue;
      const u = d / th;
      set(x, y, !shut && u < 0.32 ? (a > L * 0.3 && a < L * 0.75 && u < 0.16 ? C.inner2 : C.inner)
        : u > 0.45 && u < 0.7 && a > L * 0.25 && a < L * 0.8 ? C.hi : C.back);
    }
    const n = big ? 6 : 4;
    for (let k = 1; k <= n; k++) {
      const a = L * (0.18 + (0.8 * k) / n) * sqL;
      teeth.push([cx + ux * a, hinge + uy * a, -nx, -ny, sd, k]);
    }
  }
  const c = makeCanvas(W, H);
  const g = c.getContext("2d");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = grid.get(x + "," + y);
    if (v) px(g, v, x, y);
    else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid.has(x + dx + "," + (y + dy)))) px(g, C.out, x, y);
  }
  for (const [bx, by, dx, dy, sd, k] of teeth) {
    const len = shut ? 1.5 : 2.5, off = shut ? (k % 2 ? 0.5 : -0.5) * sd : 0; // (shut, they interlock)
    for (let i = 1; i <= len; i++) px(g, C.tooth, Math.floor(bx + dx * i - dx * 0.5), Math.floor(by + dy * i + off));
  }
  if (shut) px(g, C.out, Math.floor(cx), Math.round(hinge - L * sqL), 1, Math.round(L * sqL)); // the seam
  c.mouthY = Math.round(hinge - L * sqL - 1);
  return c;
}

function makeFlytrapFrames(big) {
  return {
    open: makeFlytrap(big, 0.62),
    windup: makeFlytrap(big, 1.05, -2),   // rearing back, jaws wide
    lunge: makeFlytrap(big, 0.25, 26),    // snapping: up high, nearly shut
    shut: makeFlytrap(big, 0),
    chew: makeFlytrap(big, 0, 0, true),
    gulp: makeFlytrap(big, 0, 0, false, true),
    half: makeFlytrap(big, 0.3),          // opening up again
  };
}

// ---- Jaguars and black panthers (jungle) ----

const JAGUAR_W = 46, JAGUAR_H = 24; // sprite size; its feet are on the bottom row but one, its middle at x = 23
const CAT_PALETTES = {
  jaguar: { out: "#1e1206", body: "#d8962e", shade: "#a8661a", belly: "#f2d49a", spot: "#2a1606", spot2: "#7a4410", eye: "#ffd21a", glow: "#ff9a1a", mouth: "#5a0a0a" },
  panther: { out: "#000000", body: "#24202c", shade: "#16131c", belly: "#302b39", spot: "#19161f", spot2: "#1d1a24", eye: "#b6ff3a", glow: "#6aff2a", mouth: "#3a0612" },
};

// Big, muscular and snarling, facing right. Poses: run1, run2, crouchLow (flat to the ground: about
// to pounce AT you), crouchHigh (rear and tail up: about to leap OVER you), leap.
function makeCat(kind, pose) {
  const C = CAT_PALETTES[kind];
  const W = JAGUAR_W, H = JAGUAR_H, base = H - 2;
  const grid = new Map();
  const set = (x, y, col) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) grid.set(x + "," + y, col); };
  const get = (x, y) => grid.get(x + "," + y);
  const ell = (cx, cy, rx, ry, col) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy <= 1.05) set(x, y, col); } };
  const line = (x0, y0, x1, y1, t, col) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1; for (let k = 0; k <= n; k++) { const u = k / n; for (let j = 0; j < t; j++) for (let i = 0; i < t; i++) set(x0 + (x1 - x0) * u + i - (t - 1) / 2, y0 + (y1 - y0) * u + j - (t - 1) / 2, col); } };
  // Each pose: where its body (bx, by) and head (hx, hy) are, its legs ([hip x, y, paw x, y]: back
  // two, then front two) and tail, how far its rear is raised (rear), flat to the ground (flat), how
  // wide its mouth is open (jaw), and its chest / haunches raised or lowered (tilting the body)
  const POSES = {
    run1: { legs: [[13, 14, 8, base], [16, 14, 18, base - 1], [26, 14, 30, base - 1], [28, 14, 33, base]], tail: [[10, 10], [5, 8], [2, 5], [1, 3]] },
    run2: { by: 13, hy: 11, legs: [[13, 15, 15, base], [16, 15, 12, base], [26, 15, 26, base], [28, 15, 24, base]], tail: [[10, 11], [5, 11], [2, 10], [0, 8]] },
    // sinking into a crouch (halfway), then crouched; B: the same with its tail twitching
    crouchLowHalf: { by: 14, hy: 13, hx: 35.5, flat: 0.5, jaw: 2, legs: [[13, 15, 9, base], [16, 15, 14, base], [26, 16, 29, base], [29, 16, 33, base]], tail: [[10, 13], [5, 14], [2, 14], [0, 12]] },
    crouchLow: { by: 15.5, hy: 15, hx: 36, flat: 1, jaw: 2.5, legs: [[13, 16, 9, base], [16, 16, 13, base], [26, 17, 30, base], [29, 17, 34, base]], tail: [[10, 16], [5, 17], [2, 18], [0, 17]] },
    crouchLowB: { by: 15.5, hy: 15, hx: 36, flat: 1, jaw: 2.5, legs: [[13, 16, 9, base], [16, 16, 13, base], [26, 17, 30, base], [29, 17, 34, base]], tail: [[10, 16], [5, 17], [2, 16], [1, 14]] },
    crouchHighHalf: { by: 12.5, hy: 12.5, rear: 0.5, legs: [[13, 13, 11, base], [16, 13, 15, base], [27, 15, 29, base], [29, 15, 32, base]], tail: [[10, 9], [6, 6], [5, 3], [6, 1]] },
    crouchHigh: { by: 13, hy: 14, rear: 1, legs: [[13, 12, 12, base], [16, 12, 15, base], [27, 15, 29, base], [29, 15, 32, base]], tail: [[10, 8], [7, 4], [7, 1], [9, 0]] },
    crouchHighB: { by: 13, hy: 14, rear: 1, legs: [[13, 12, 12, base], [16, 12, 15, base], [27, 15, 29, base], [29, 15, 32, base]], tail: [[10, 8], [7, 4], [6, 1], [4, 0]] },
    // a leap: pushing off (back legs driving, front reaching up), flying (stretched out), landing
    // (front paws reaching for the ground, back legs tucked in)
    push: { by: 12, hx: 37, hy: 6, jaw: 2, chest: -3, haunch: 2, legs: [[12, 14, 5, base], [14, 15, 8, base], [27, 11, 32, 15], [29, 11, 35, 13]], tail: [[9, 13], [5, 15], [2, 17], [0, 18]] },
    leap: { by: 10, hx: 37, hy: 8, jaw: 3, legs: [[11, 11, 4, 14], [13, 12, 6, 16], [29, 11, 40, 15], [30, 12, 41, 12]], tail: [[8, 10], [4, 12], [1, 15], [0, 18]] },
    land: { by: 12, hx: 36, hy: 14, jaw: 2, chest: 2, haunch: -3, legs: [[12, 10, 9, 15], [14, 11, 13, 16], [27, 15, 32, base], [29, 15, 35, base]], tail: [[9, 8], [5, 5], [2, 4], [0, 6]] },
    // turning round: head swung to face you, body bunched up
    turn: { bx: 22, hx: 25, hy: 9, front: 1, legs: [[15, 14, 14, base], [18, 14, 18, base], [25, 14, 25, base], [28, 14, 29, base]], tail: [[13, 10], [9, 7], [8, 4], [10, 2]] },
  };
  const P = { bx: 20, by: 12, hx: 35, hy: 10, rear: 0, flat: 0, jaw: 1.5, chest: 0, haunch: 0, front: 0, ...POSES[pose] };
  const { bx, by, hx, hy, legs, tail, rear, flat, jaw, chest, haunch } = P;
  let [tx, ty] = [bx - 9, by - 1 + haunch];
  for (const [x, y] of tail) { line(tx, ty, x, y, 2, C.body); [tx, ty] = [x, y]; }
  set(tx, ty, C.spot);
  set(tx + 1, ty, C.spot);
  for (const [x0, y0, x1, y1] of legs) { line(x0, y0, x1, y1, 3, C.body); for (let j = 0; j < 2; j++) for (let i = -1; i <= 1; i++) set(x1 + i, y1 - 1 + j, C.body); }
  const long = P.front ? 8 : 11;
  ell(bx, by + (chest + haunch) / 2, long, 4.6 - flat, C.body);
  ell(bx - 7, by - 0.5 - 2.5 * rear + haunch, 5, 4.5 + 0.5 * rear, C.body);
  ell(bx + (P.front ? 4 : 7), by - 0.5 + chest, 5.5, 5.2 - 1.2 * flat, C.body);
  ell(bx + 1, by + 3.5 - flat + (chest + haunch) / 2, long - 3, 1.2, C.belly);
  if (P.front) {
    // the head from the front: ears both sides, muzzle in the middle
    ell(hx, hy, 5, 4.6, C.body);
    for (const sx of [-1, 1]) { set(hx + sx * 3, hy - 4.6, C.body); set(hx + sx * 4, hy - 4.6, C.body); set(hx + sx * 4, hy - 5.4, C.body); }
    ell(hx, hy + 2, 2.6, 1.8, C.belly);
    for (let i = -1; i <= 1; i++) set(hx + i, hy + 3.5, C.mouth);
  } else {
    ell(hx, hy, 5.2, 4.4, C.body);
    set(hx - 4, hy - 4, C.body);
    set(hx - 5, hy - 4, C.body);
    set(hx - 3, hy - 4.6, C.body);
    ell(hx + 4.5, hy + 0.5, 2.6, 2, C.belly);
    for (let j = 0; j < Math.ceil(jaw); j++) for (let i = 0; i < 6; i++) set(hx + 2 + i, hy + 2 + j, C.mouth);
    ell(hx + 4, hy + 2.5 + jaw, 3, 1.1, C.body);
  }
  for (let k = 0; k < 26; k++) {
    const x = Math.round(bx - 15 + hash(k, 3) * 30), y = Math.round(by - 4 + hash(k, 4) * 7);
    if (get(x, y) === C.body && get(x + 1, y) === C.body && get(x, y + 1) === C.body) { set(x, y, C.spot); set(x + 1, y, C.spot); set(x, y + 1, C.spot); set(x + 1, y + 1, C.spot2); }
  }
  for (let x = bx - 12; x < bx + 12; x++) if (get(x, Math.round(by - 4)) === C.body && hash(x, 9) < 0.5) set(x, Math.round(by - 4), C.shade);
  const c = makeCanvas(W, H);
  const g = c.getContext("2d");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = get(x, y);
    if (v) px(g, v, x, y);
    else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(x + dx, y + dy))) px(g, C.out, x, y);
  }
  const X = Math.round(hx), Y = Math.round(hy);
  if (P.front) {
    // two angry eyes looking right at you, a nose, a snarl
    for (const sx of [-1, 1]) { px(g, C.out, X + sx * 2 - (sx < 0 ? 1 : 0), Y - 2, 2, 1); px(g, C.eye, X + sx * 2 - (sx < 0 ? 1 : 0), Y - 1, 2, 1); px(g, "#000000", X + sx * 2, Y - 1); }
    px(g, C.out, X, Y + 1);
    px(g, "#ffffff", X - 1, Y + 3);
    px(g, "#ffffff", X + 1, Y + 3);
    return c;
  }
  // an angry slanted eye with a slit pupil, the nose, fangs, and claws out when it attacks
  for (const [x, y] of [[-1, -3], [0, -3], [1, -2], [2, -2], [3, -1]]) px(g, C.out, X + x, Y + y);
  px(g, C.eye, X, Y - 2);
  px(g, C.eye, X + 1, Y - 1, 2, 1);
  px(g, "#000000", X + 1, Y - 1);
  px(g, C.out, X + 7, Y, 2, 1);
  px(g, "#ffffff", X + 3, Y + 2, 1, 2);
  px(g, "#ffffff", X + 6, Y + 2, 1, 2);
  px(g, "#ffffff", X + 4, Y + 1 + Math.ceil(jaw));
  px(g, "#ffffff", X + 6, Y + 1 + Math.ceil(jaw));
  if (["leap", "push", "land", "crouchLow", "crouchLowB"].includes(pose)) for (const [, , x1, y1] of legs.slice(2)) { px(g, "#ffffff", x1 + 2, y1 - 1); px(g, "#ffffff", x1 + 2, y1 + 1); px(g, "#ffffff", x1 + 3, y1); }
  return c;
}

// Its eyes, small and glowing softly in a bush: two slanted, angry eyes. `narrow`: about to leap.
const EYE_ROWS = { open: ["EE.", "EEE", ".EE"], narrow: ["...", "EEB", ".EE"] };
function makeCatEyes(kind, narrow) {
  const C = CAT_PALETTES[kind];
  const W = 15, H = 9;
  const c = makeCanvas(W, H);
  const g = c.getContext("2d");
  for (const ex of [5, 10]) {
    const gr = g.createRadialGradient(ex, 4.5, 0, ex, 4.5, 4);
    gr.addColorStop(0, C.glow + "66");
    gr.addColorStop(1, C.glow + "00");
    g.fillStyle = gr;
    g.fillRect(ex - 5, 0, 10, H);
  }
  EYE_ROWS[narrow ? "narrow" : "open"].forEach((row, y) => [...row].forEach((ch, x) => {
    const col = { E: C.eye, B: "#000000" }[ch];
    if (!col) return;
    px(g, col, 3 + x, 3 + y);         // left eye (slanting down towards the nose)
    px(g, col, W - 4 - x, 3 + y);     // right eye, mirrored
  }));
  if (!narrow) { px(g, "#000000", 5, 4); px(g, "#000000", W - 6, 4); } // slit pupils
  return c;
}

// Low jungle bushes in the background (all along the jungle): something could be hiding in any of them
function makeBackBush(v) {
  const [w, h] = JUNGLE.backBushes[v];
  const c = makeCanvas(w, h);
  const g = c.getContext("2d");
  const lumps = [[0.3, 0.55, 0.3], [0.65, 0.5, 0.33], [0.5, 0.3, 0.28], [0.15, 0.75, 0.18], [0.85, 0.72, 0.18]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let inside = false;
    for (const [lx, ly, r] of lumps) { const dx = (x - lx * w) / (r * w), dy = (y - ly * h) / (r * w * 0.8); if (dx * dx + dy * dy < 1) inside = true; }
    if (y > h * 0.6 && x > 1 && x < w - 2) inside = true;
    if (!inside) continue;
    const n = hash(x + v * 50, y + v * 7);
    px(g, n < 0.15 ? "#2a5e30" : n > 0.9 ? "#4a8a44" : "#356f38", x, y);
  }
  return c;
}

// A fern rooted on the ground at x (in a layer 420 wide that repeats): a fan of five fronds,
// the two at the back darker. s scales it (1 is about 18 pixels tall).
function makeFern(g, x, s) {
  const dot = (c, fx, fy) => px(g, c, ((Math.round(fx) % 420) + 420) % 420, Math.round(fy));
  // one frond: a long tapered leaf curving along an arc, jagged edges, a light vein down the middle
  const frond = (x0, len, ang, bend, back) => {
    const body = back ? "#33703a" : "#3f8a40", edge = back ? "#2a5e30" : "#2f6e33", vein = back ? "#3f7f42" : "#6fb85a";
    let fx = x0, fy = 96, a = ang;
    const pts = [];
    for (let i = 0; i < len * 2; i++) {
      pts.push([fx, fy, a, i / (len * 2)]);
      fx += Math.cos(a) * 0.5;
      fy -= Math.sin(a) * 0.5;
      a -= bend * 0.5 / len * Math.sign(Math.cos(ang));
    }
    for (const [x1, y1, a1, t] of pts) {
      const w = 3.2 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.8) * Math.min(1, t / 0.12);
      for (let d = -w; d <= w; d += 0.5) {
        const rim = Math.abs(d) > w - 1;
        if (rim && Math.floor(t * len * 1.5) % 2 === 0) continue; // the jagged edge
        dot(rim ? edge : body, x1 + Math.sin(a1) * d, y1 + Math.cos(a1) * d);
      }
    }
    for (const [x1, y1, , t] of pts) if (t > 0.08 && t < 0.85) dot(vein, x1, y1);
  };
  const L = (n) => Math.round(n * s);
  frond(x - 2, L(13), Math.PI * 0.82, 1.1, true);
  frond(x + 2, L(13), Math.PI * 0.18, 1.1, true);
  frond(x - 1, L(16), Math.PI * 0.68, 0.9, false);
  frond(x + 1, L(16), Math.PI * 0.32, 0.9, false);
  frond(x, L(18), Math.PI * (hash(x, 9) < 0.5 ? 0.55 : 0.45), 0.5, false);
}

// The jungle's background, in three layers that each repeat sideways (drawn with parallax):
// far canopy, tree trunks with hanging vines, and undergrowth and ferns along the ground with the canopy edge above
function makeJungleLayers() {
  const far = makeCanvas(400, VIEW_H);
  let g = far.getContext("2d");
  for (let x = 0; x < 400; x++) {
    const h = 30 + 6 * Math.sin(x * Math.PI * 2 / 100) + 4 * Math.sin(x * Math.PI * 2 / 40 + 2);
    px(g, "#5f9f5a", x, 0, 1, Math.round(h));
    px(g, "#5f9f5a", x, 70 + Math.round(4 * Math.sin(x * Math.PI * 2 / 200)), 1, 60);
  }
  const mid = makeCanvas(480, VIEW_H);
  g = mid.getContext("2d");
  for (const [x, w] of [[30, 6], [118, 9], [205, 5], [260, 8], [350, 7], [430, 6]]) {
    px(g, "#5a4030", x, 10, w, VIEW_H);
    px(g, "#6e5240", x + 1, 10, 1, VIEW_H);
  }
  for (const x of [20, 70, 140, 190, 240, 320, 375, 450]) {
    const len = 20 + Math.floor(hash(x, 2) * 30);
    for (let y = 18; y < 18 + len; y++) px(g, "#3f7f3f", x + Math.round(Math.sin(y * 0.3 + x)), y);
    for (let y = 22; y < 18 + len; y += 5) px(g, "#5fb04f", x + 1, y, 2, 1);
  }
  const near = makeCanvas(420, VIEW_H);
  g = near.getContext("2d");
  for (let x = 0; x < 420; x++) {
    const h = 16 + 5 * Math.sin(x * Math.PI * 2 / 60 + 1) + 3 * Math.sin(x * Math.PI * 2 / 20);
    px(g, "#3f7f3f", x, 0, 1, Math.round(h));
  }
  // a low band of leafy undergrowth along the ground, bumpy on top...
  for (let x = 0; x < 420; x++) {
    const h = 7 + 3 * Math.sin(x * Math.PI * 2 / 35) + 2 * Math.sin(x * Math.PI * 2 / 12 + 1) + (hash(x, 7) < 0.3 ? 1 : 0);
    px(g, "#4a8c44", x, 96 - Math.round(h), 1, VIEW_H);
    if (hash(x, 8) < 0.35) px(g, "#56994c", x, 93 - Math.floor(hash(x, 6) * 4));
  }
  // ...with big ferns growing out of it here and there
  for (let x = 20; x < 420; x += 60 + Math.floor(hash(x, 4) * 50)) makeFern(g, x, 0.85 + hash(x, 5) * 0.35);
  return { far, mid, near };
}

// ---- The jungle's orbs ----

// The monsoon orb: a gold coin with blue raindrops falling on a wave
const MONSOON_ORB_ROWS = ["..oooo..", ".oybyyo.", "oyybyyyo", "oybyybyo", "oyyybyyo", "owwwwwwo", ".obbbbo.", "..oooo.."];
// The monkey orb: a light blue coin with a monkey's face (big brown muzzle, pink ears sticking out)
const MONKEY_ORB_ROWS = ["..oooo..", ".obbbbo.", "obfbbfbo", "pbkbbkbp", "obffffbo", "obfnnfbo", ".obmmbo.", "..oooo.."];
// The monkey, facing right: hanging from its vine, carrying someone, leaping, sitting on a head.
// b fur, d dark fur (hands, feet, tail), f face and belly, k eyes, m mouth
const MONKEY_FRAMES = {
  hang: [".....dd.....", "....b..b....", "....b..b....", "...bbbbbb...", "..bbffffbb..", "..bfkffkfb..", "...ffmmff...", "....bffb....", "...bbffbb...", "...bbffbb..d", "....bbbb..d.", "....b..b.dd.", "...dd..dd..."],
  carry: [".....dd.....", "....b.......", "....b.......", "...bbbbbb...", "..bbffffbb..", "..bfkffkfb..", "...ffmmff...", "....bffbb...", "...bbffb.b..", "...bbffb..b.", "....bbbb..dd", "....b..b..d.", "...dd..dd.dd"],
  leap: ["............", "d..........d", ".b..bbbb..b.", "..bbbbbbbb..", "...bffffb...", "...fkffkf...", "...ffmmff...", "....bffb....", "...bbffbb...", "..bb.bb.bb..", ".dd......dd.", "....dddd....", "............"],
  sit: ["...bbbbbb...", "..bbffffbb..", "..bfkffkfb..", "...ffmmff...", "..b.bffb.b..", ".bb.bffb.bb.", ".d..bbbb..d.", "...bb..bb.dd", "...dd..dd..d"],
};
const MONKEY_PALETTE = { b: "#7a4a2a", d: "#4a2a14", f: "#e8c090", k: "#1a0e06", m: "#c87a5a" };
// One of its big hands over your eyes (right hand, fingers up), drawn small and blown up into big chunky pixels.
// o outline, b fur on the back of the hand, t palm, p finger pads, c creases
const MONKEY_HAND_ROWS = [
  "...oo.oo.oo.oo.....",
  "..obpobpobpobpo....",
  "..obtobtobtobto....",
  "..obtobtobtobto....",
  "..obtobtobtobto.oo.",
  "..obtbbtbbtbbtoobpo",
  "..obttttttttttobtto",
  "..obtttttttttttttbo",
  "..obtccccttttttttbo",
  "..obttttcccttttbbo.",
  "..obtttttttttttbo..",
  "..obttccccttttbbo..",
  "...obtttttttttbo...",
  "...obbttttttbbbo...",
  "....obbbbbbbbbo....",
  "....obbbbbbbbbo....",
  "....obbbbbbbbbo....",
];
const MONKEY_HAND_PALETTE = { o: "#2a160a", b: "#7a4a2a", t: "#d8a878", p: "#e8c098", c: "#b8885a" };

// ---- The snow's orbs ----

// The snowstorm orb: a gold coin with a white snowflake
const STORM_ORB_ROWS = [
  "..oooo..",
  ".oywyyo.",
  "oywwwywo",
  "oyywwwyo",
  "oywwwyyo",
  "owywwwyo",
  ".oyywyo.",
  "..oooo..",
];
// The snowball orb: a light blue coin with a snowball
const SNOWBALL_ORB_ROWS = [
  "..oooo..",
  ".oyyyyo.",
  "oyywwyyo",
  "oywwwsyo",
  "oywwssyo",
  "oyysyyyo",
  ".oyyyyo.",
  "..oooo..",
];
// The thrown snowball: tiny
const THROWN_SNOWBALL_ROWS = [".ww.", "wwws", "wwss", ".ss."];

// ---- The desert's orbs ----

// The sandstorm orb: a gold coin with streaks of blowing sand
const SAND_ORB_ROWS = [
  "..oooo..",
  ".oyyyyo.",
  "oysssyyo",
  "oyyyysso",
  "osssyyyo",
  "oyyyssso",
  ".oyyyyo.",
  "..oooo..",
];
// The firehawk orb: a light blue coin with a little orange bird, wings spread
const HAWK_ORB_ROWS = [
  "..oooo..",
  ".oyyyyo.",
  "ofyyyyfo",
  "offyyffo",
  "oyfrrfyo",
  "oyyrryyo",
  ".oyfyyo.",
  "..oooo..",
];

// The firehawk: drawn like the vultures (both wings spread), in fire colours, facing right.
// o outline, f flame orange, d deep red, b red, l light orange, y yellow, w white-hot, h head, k beak, e eye
const HAWK_FRAMES = {
  glide: [
    "w..................w",
    "yfoo............oofy",
    ".yffdoo......oodffy.",
    "..yfdbboo..oobbdfy..",
    "...yfdbbbobhhbbdfy..",
    "....llbbbbbheekko...",
    ".....llbbbbbbhk.....",
    "......ofybyfo.......",
    ".......y.w.y........",
  ],
  up: [
    ".w..............w...",
    "yfo............ofy..",
    ".yfdo.........odfy..",
    "..yfdoo.....oodfy...",
    "...ofdbbo..obbdfo...",
    "....lfbbbobhhbbo....",
    ".....llbbbbheekko...",
    "......ofbbbbbhk.....",
    ".......ofyfyfo......",
    "........y.w.y.......",
  ],
  down: [
    "....................",
    "......oobbobhho.....",
    "....oodbbbbbheekko..",
    "...ofdbbbbbbbbhk....",
    "..ofdffbbbbbbffdfo..",
    ".ofdfo.ofyfyfo.ofdfo",
    "ofyfo...y.w.y...ofyf",
    "yfy..............yfy",
    "w..................w",
  ],
};
const HAWK_PALETTE = (flick) => ({ o: "#2a0a04", f: "#ff7a1a", d: "#8c1c10", b: "#c8301a", l: "#ffb347", y: flick ? "#fff3b0" : "#ffd23f", w: flick ? "#ffd23f" : "#fff3b0", h: "#e04020", k: "#f0c050", e: "#1a0602" });

// { up: [[flicker 0 right, left], [flicker 1 right, left]], glide: ..., down: ... }
function makeHawks() {
  const out = {};
  for (const [wing, rows] of Object.entries(HAWK_FRAMES)) out[wing] = [0, 1].map((f) => { const img = spriteFromRows(rows, HAWK_PALETTE(f)); return [img, flipped(img)]; });
  return out;
}

// The burning stick, tumbling: 8 turns, 2 flickers
function makeSticks() {
  const out = [];
  for (let turn = 0; turn < 8; turn++) out.push([0, 1].map((flick) => {
    const c = makeCanvas(12, 12), g = c.getContext("2d");
    const a = turn * Math.PI / 4, at = (i) => [Math.round(6 + Math.cos(a) * i), Math.round(6 + Math.sin(a) * i)];
    for (let i = -4; i <= 2; i++) px(g, "#6a3a1a", ...at(i));
    const [ex, ey] = at(4), [mx, my] = at(3);
    px(g, "#ff7a1a", mx, my); px(g, "#ff7a1a", ex, ey);
    px(g, flick ? "#ffd23f" : "#ff7a1a", ex, ey - 1); px(g, "#ffd23f", ex + (flick ? 1 : -1), ey - 2); px(g, "#fff3b0", ex, ey - 2);
    return c;
  }));
  return out;
}

// A patch of burning ground, w pixels wide, 4 flickering frames: hottest (white-yellow) at the bottom
function makeFirePatch(w, frame) {
  const h = 18, c = makeCanvas(w, h), g = c.getContext("2d");
  for (let x = 0; x < w; x++) {
    const edge = Math.min(1, Math.min(x, w - 1 - x) / 6);
    const t = Math.round((5 + 4 * Math.abs(Math.sin(x * 0.55 + frame * 1.7)) + 2 * Math.abs(Math.sin(x * 1.3 - frame * 2.3))) * (0.45 + 0.55 * edge));
    for (let y = 0; y < t; y++) {
      const u = y / t;
      px(g, u > 0.8 ? "#c8301a" : u > 0.55 ? "#ff7a1a" : u > 0.25 ? "#ffd23f" : "#fff3b0", x, h - 1 - y);
    }
    if ((x + frame * 3) % 7 === 0 && t > 6) px(g, "#ffd23f", x, h - 2 - t - ((frame + x) % 3)); // sparks
  }
  return c;
}

// ---- The ancient turret (jungle) ----
// A carved stone idol head, facing left (its mouth, where the arrows come out, is on the left).
// Letters: o outline, S light stone, s stone, d / D dark stone, m / M moss, k inside its mouth,
// W teeth, e / E its eyes (dark, or glowing the color of the arrow it's about to shoot)
const IDOL_ROWS = [
  "...ooooooooooo..",
  "..oMMmmMMmmSSSo.",
  ".oSSMmSSSSSSSdso",
  ".oSSSSSSSSSSSSdo",
  "oddddddddSSdSSdo",
  "oDDeeEDDdSSSdSdo",
  ".oDeeeDdSSdSSSdo",
  "..odddddSSdSSsdo",
  "..oSSSSSSSSdSsdo",
  ".oSSsSSSSSdSSsdo",
  "osSSssSSSSSdSsdo",
  "oddddsSSSSdSSsdo",
  "oSSSSSSSSSSdSsdo",
  "oWkWkWkoSSSdSsdo",
  "okkkkkkoSSdSSsdo",
  "oWkWkWkoSSdSSsdo",
  ".oSSSSSSSdSSsddo",
  ".osssssssssssddo",
  ".omdssmsssmssddo",
  ".oDDDDDDDDDDDDDo",
];
const IDOL_H = IDOL_ROWS.length, IDOL_W = IDOL_ROWS[0].length, IDOL_MOUTH = 13; // its mouth: rows 13-15

// Its arrows (flying left): a colored tip (T, t darker), a wooden shaft and fletching. The blunt one
// has a round knob (B, b) instead of a point.
const ARROW_ROWS = {
  pointed: [".t..........f.f", "tTsssssssssssff", ".t..........f.f"],
  blunt: [".bb.........f.f", "bBBssssssssssff", ".bb.........f.f"],
};
const ARROW_KINDS = {
  arrow: { rows: "pointed", T: "#ff3b3b", t: "#8a1010", f: "#e8e0c8" },  // obsidian, glowing red: deadly
  poison: { rows: "pointed", T: "#7dff4a", t: "#2f8a1a", f: "#b8f090" },
  sleep: { rows: "pointed", T: "#6ac8ff", t: "#1f5aa6", f: "#cfe8ff" },
  blunt: { rows: "blunt", B: "#ffd23f", b: "#b07a10", f: "#e8e0c8" },
};

function flipped(img) {
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext("2d");
  g.translate(img.width, 0);
  g.scale(-1, 1);
  g.drawImage(img, 0, 0);
  return c;
}

// The idol, asleep (eyes dark) or glowing the color of each arrow: { none: [left, right], arrow: ... }
function makeIdols() {
  const out = {};
  for (const kind of ["none", ...Object.keys(ARROW_KINDS)]) {
    const a = ARROW_KINDS[kind];
    const glow = a ? [a.T || a.B, a.t || a.b] : ["#3a3830", "#2a2820"];
    const img = spriteFromRows(IDOL_ROWS, { o: "#2b2a22", S: "#a9a585", s: "#8b876a", d: "#6b6852", D: "#4d4a3a", m: "#3f7a34", M: "#63a84a", k: "#15140f", W: "#d8d4b4", E: glow[0], e: glow[1] });
    out[kind] = [img, flipped(img)];
  }
  return out;
}

function makeArrows() {
  const out = {};
  for (const [kind, a] of Object.entries(ARROW_KINDS)) {
    const img = spriteFromRows(ARROW_ROWS[a.rows], { T: a.T, t: a.t, B: a.B, b: a.b, s: "#8a5a2b", f: a.f });
    out[kind] = [img, flipped(img)];
  }
  return out;
}

// ---- Vultures (desert) ----
// Facing right. Letters: o outline, b body, d dark feathers, w wing tips, r head, y beak, n neck ruff
const VULTURE_FRAMES = {
  glide: [
    "....................",
    "oooo............oooo",
    "ddddoo........oodddd",
    ".dddbbooo..ooobbddd.",
    "..ddbbbbbonnbbbbdd..",
    "...wdbbbbbnnrrro....",
    ".....wwbbbbbbryy....",
    ".......ooobbbo.y....",
    "..........o.o.......",
  ],
  up: [
    "..oo............oo..",
    ".oddo..........oddo.",
    "..oddo........oddo..",
    "...oddoo....oodd....",
    "....odbbo..obbdo....",
    "....wdbbbonnbbo.....",
    ".....wwbbbnnrrro....",
    ".......obbbbbryy....",
    "........ooobbo.y....",
  ],
  down: [
    "....................",
    "....................",
    "......oooonnoo......",
    "....obbbbbnnrrro....",
    "..odbbbbbbbbbryy....",
    ".oddbbbbbbbbbo.y....",
    "oddddoobbbbbdoo.....",
    "oddo....ooooddddo...",
    ".oo..........oddddo.",
  ],
  dive: [
    "..........oo........",
    "........oodbo.......",
    "......oodbbbo.......",
    "....oodbbbbbo.......",
    "...odbbbbbnnro......",
    "..owbbbbbbnnrro.....",
    ".owwbbbbbbbbryyo....",
    "..oooooooobbbo.y....",
    "............oo......",
  ],
};
const VULTURE_PALETTES = {
  brown: { o: "#1d120c", b: "#6b4a32", d: "#4a3020", w: "#a88a6a", r: "#e88a8a", y: "#f2e6c8", n: "#f4efe6" },
  black: { o: "#120c0c", b: "#2e2a30", d: "#1b181d", w: "#6b6670", r: "#c8424a", y: "#f2e6c8", n: "#4a4450" },
};

// ---- The bear (snow biome) ----
// Built on a grid of color letters, then outlined. Facing right.
// Frames 0-2: galloping. Frame 3: rearing up to swipe.
const BEAR_W = 34;
const BEAR_H = 22;
const BEAR_PALETTES = (() => {
  const base = { o: "#120c0c", r: "#a3202a", t: "#fffdf2", e: "#ff3b2f", k: "#e8e2d0" };
  return {
    brown: { ...base, m: "#7a4a2e", d: "#56321e", l: "#a46c44", s: "#3a2418", e: "#5dff8a" },
    polar: { ...base, m: "#e6ecf2", d: "#b8c6d6", l: "#ffffff", s: "#28232a", o: "#3a4252" },
    black: { ...base, m: "#2e2b36", d: "#1d1b22", l: "#4b4757", s: "#b58b62", e: "#ffd23f" },
  };
})();

function makeBear(pal, frame) {
  const W = BEAR_W, H = BEAR_H;
  const g = Array.from({ length: H }, () => Array(W).fill("."));
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
  const ell = (cx, cy, rx, ry, c) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, c);
    }
  };
  const limb = (x0, y0, x1, y1, w, c) => {
    for (let i = 0; i <= 12; i++) for (let k = 0; k < w; k++) set(x0 + ((x1 - x0) * i) / 12 + k, y0 + ((y1 - y0) * i) / 12, c);
  };
  const claws = (x, y, dir = 1) => { set(x + dir, y, "k"); set(x + dir * 2, y, "k"); set(x + dir * 3, y - 1, "k"); };
  if (frame === 3) {
    // Rearing up, roaring, claws raised
    limb(9, 15, 8, 20, 3, "d"); limb(13, 15, 14, 20, 3, "m"); claws(8, 21, -1); claws(15, 21);
    ell(12, 11, 6, 7, "m"); ell(12, 14, 5, 3, "d");
    for (let y = 5; y < 17; y += 2) set(5, y, "m");
    limb(15, 8, 22, 2, 3, "m"); set(23, 1, "k"); set(25, 1, "k"); set(25, 3, "k"); set(24, 0, "k");
    limb(9, 9, 6, 4, 3, "d"); set(5, 3, "k"); set(6, 2, "k"); set(8, 2, "k");
    ell(16, 5, 4, 3.5, "m"); set(13, 2, "m"); set(14, 1, "d");
    for (let x = 17; x <= 21; x++) set(x, 4, "m");
    for (let x = 17; x <= 20; x++) { set(x, 5, "r"); set(x, 6, "r"); }
    for (let x = 16; x <= 20; x++) set(x, 7, "m");
    set(18, 5, "t"); set(20, 5, "t"); set(19, 6, "t"); set(21, 4, "s"); set(21, 3, "o");
    set(16, 3, "e"); set(15, 2, "o"); set(16, 2, "o");
  } else {
    const bob = frame === 1 ? -1 : 0;
    const legs = [
      [[5, 12, 1, 18], [7, 12, 4, 19], [19, 13, 24, 18], [21, 13, 27, 19]],
      [[6, 12, 8, 19], [8, 12, 10, 19], [18, 13, 15, 19], [20, 13, 17, 19]],
      [[5, 12, 0, 17], [7, 12, 2, 18], [19, 13, 22, 19], [21, 13, 24, 19]],
    ][frame];
    legs.forEach(([a, b, c, d], i) => { limb(a, b + bob, c, d, 3, i % 2 ? "m" : "d"); claws(c + 2, d); });
    ell(12, 9 + bob, 10, 5, "m");   // body
    ell(15, 6 + bob, 6, 4, "m");    // shoulder hump
    ell(12, 12 + bob, 9, 2, "d");   // dark belly
    for (let x = 4; x <= 19; x += 2) set(x, (x > 10 ? 2 : 4) + bob + (x > 13 && x < 18 ? 0 : 1), "m"); // shaggy back
    set(1, 8 + bob, "m"); set(2, 7 + bob, "m");
    const hy = 10 + bob; // head lowered and pushed forward, jaws open
    ell(25, hy - 1, 4, 3.5, "m"); set(22, hy - 5, "m"); set(23, hy - 5, "d");
    for (let x = 26; x <= 32; x++) set(x, hy - 1, "m");
    for (let x = 27; x <= 32; x++) set(x, hy - 2, x > 30 ? "s" : "m");
    set(32, hy - 3, "o");
    for (let x = 26; x <= 31; x++) { set(x, hy, "r"); if (x < 30) set(x, hy + 1, "r"); }
    for (let x = 25; x <= 30; x++) set(x, hy + 2, "m");
    [27, 29, 31].forEach((x) => set(x, hy, "t"));
    [28, 30].forEach((x) => set(x, hy + 1, "t"));
    set(26, hy - 3, "e"); set(25, hy - 4, "o"); set(26, hy - 4, "o"); set(27, hy - 3, "o"); // glowing eye, angry brow
  }
  // Dark outline, then light fur along the top of the back
  const out = g.map((r) => r.slice());
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== ".") continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const n = g[y + dy] && g[y + dy][x + dx]; return n && n !== "." && n !== "k"; })) out[y][x] = "o";
  }
  for (let x = 0; x < W; x++) for (let y = 1; y < H; y++) {
    if (out[y][x] === "m") { if (out[y - 1][x] === "o" && x % 3) out[y][x] = "l"; break; }
  }
  return spriteFromRows(out.map((r) => r.join("")), pal);
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
    // Orbs you use with S / Down (abilities) are light blue; the others are gold
    zapOrb: spriteFromRows(ZAP_ORB_ROWS, ABILITY_ORB_PALETTE),
    windOrb: spriteFromRows(WIND_ORB_ROWS, ABILITY_ORB_PALETTE),
    droneOrb: spriteFromRows(DRONE_ORB_ROWS, ABILITY_ORB_PALETTE),
    drone: Object.fromEntries(Object.entries(DRONE_FRAMES).map(([f, rows]) => [f, spriteFromRows(rows, DRONE_PALETTE)])),
    monsoonOrb: spriteFromRows(MONSOON_ORB_ROWS, { o: "#b8860b", y: "#ffd23f", b: "#3f8fd0", w: "#2a7f8f" }),
    monkeyOrb: spriteFromRows(MONKEY_ORB_ROWS, { o: ABILITY_ORB_PALETTE.o, y: ABILITY_ORB_PALETTE.y, b: "#7a4a2a", f: "#e8c090", k: "#1a0e06", m: "#8a3a2a", p: "#d89878", n: "#5a3018" }),
    monkeys: Object.fromEntries(Object.entries(MONKEY_FRAMES).map(([f, rows]) => { const img = spriteFromRows(rows, MONKEY_PALETTE); return [f, [img, flipped(img)]]; })),
    monkeyHand: spriteFromRows(MONKEY_HAND_ROWS, MONKEY_HAND_PALETTE),
    stormOrb: spriteFromRows(STORM_ORB_ROWS, { o: "#b8860b", y: "#ffd23f", w: "#ffffff" }),
    snowballOrb: spriteFromRows(SNOWBALL_ORB_ROWS, { o: ABILITY_ORB_PALETTE.o, y: ABILITY_ORB_PALETTE.y, w: "#ffffff", s: "#a8d4f0" }),
    thrownSnowball: spriteFromRows(THROWN_SNOWBALL_ROWS, { w: "#ffffff", s: "#a8d4f0" }),
    sandOrb: spriteFromRows(SAND_ORB_ROWS, { o: "#b8860b", y: "#ffd23f", s: "#a86a2a" }),
    hawkOrb: spriteFromRows(HAWK_ORB_ROWS, { o: ABILITY_ORB_PALETTE.o, y: ABILITY_ORB_PALETTE.y, f: "#ff7a1a", r: "#c8301a" }),
    hawks: makeHawks(),
    sticks: makeSticks(),
    firePatch: [0, 1, 2, 3].map((f) => makeFirePatch(FIREHAWK.fireHalf * 2, f)),
    handOrb: spriteFromRows(HAND_ORB_ROWS, { g: ABILITY_ORB_PALETTE.o, y: ABILITY_ORB_PALETTE.y, v: "#7b3fd0", l: "#c9a3ff" }),
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
    signs: Object.fromEntries(BIOMES.map((biome) => [biome, makeSign(biome)])),
    pines: [12, 14, 16, 18].map((h, i) => makePine(h, i)),
    sandTop: [0, 1, 2, 3].map((v) => makeSandTile(v, true)),
    sandstone: [0, 1, 2, 3].map((v) => makeSandTile(v + 4, false)),
    quicksand: [0, 1, 2, 3].map((f) => [0, 1, 2, 3].map((v) => makeQuicksand(f, v))),
    cactus: Object.fromEntries(DESERT.cactusHeights.map((h) => [h, [0, 1, 2].map((a) => makeCactus(h, a))])),
    tumbleweed: makeTumbleweed(),
    mossTop: [0, 1, 2, 3].map((v) => makeJungleTile(v, true)),
    soil: [0, 1, 2, 3].map((v) => makeJungleTile(v + 4, false)),
    bamboo: Object.fromEntries(JUNGLE.bambooHeights.map((h) => [h, makeBamboo(h)])),
    thorns: [1, 2, 3, 4, 5, 6, 7, 8].map(makeThorns), // thorns[n - 1] is n tiles wide
    jungle: makeJungleLayers(),
    flytraps: [makeFlytrapFrames(false), makeFlytrapFrames(true)], // small, big
    idols: makeIdols(),   // the ancient turret: [facing left, facing right] for each glow
    arrows: makeArrows(), // its arrows: [flying left, flying right]
    cats: Object.fromEntries(Object.keys(CAT_PALETTES).map((kind) => [kind, Object.fromEntries(["run1", "run2", "crouchLowHalf", "crouchLow", "crouchLowB", "crouchHighHalf", "crouchHigh", "crouchHighB", "push", "leap", "land", "turn"].map((pose) => [pose, makeCat(kind, pose)]))])),
    catEyes: Object.fromEntries(Object.keys(CAT_PALETTES).map((kind) => [kind, { open: makeCatEyes(kind, false), narrow: makeCatEyes(kind, true) }])),
    backBushes: [0, 1, 2, 3].map(makeBackBush),
    palms: PALMS.map((_, kind) => Object.fromEntries([48, 54, 60].map((h) => [h, makePalm(h, kind)]))), // palms[kind][height]
    coconut: makeCoconut(false),
    coconutHalf: makeCoconut(true),
    logs: Object.fromEntries([3, 4, 5].map((t) => [t * TILE, makeLog(t)])), // by width in pixels
    vultures: Object.fromEntries(Object.entries(VULTURE_PALETTES).map(([kind, pal]) =>
      [kind, Object.fromEntries(Object.entries(VULTURE_FRAMES).map(([f, rows]) => [f, spriteFromRows(rows, pal)]))])),
    bears: Object.fromEntries(Object.entries(BEAR_PALETTES).map(([kind, pal]) => [kind, [0, 1, 2, 3].map((f) => makeBear(pal, f))])),
  };
}
