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

// A palm tree h pixels tall (without its coconuts): a gently curving ringed trunk and a crown of
// drooping fronds. Its base is at (PALM_BASE_X, bottom); the crown at (PALM_CROWN_X, PALM_CROWN_Y).
const PALM_BASE_X = 20, PALM_CROWN_X = 24, PALM_CROWN_Y = 9;
function makePalm(h) {
  const c = makeCanvas(40, h + 2);
  const g = c.getContext("2d");
  for (let y = 8; y < h + 2; y++) {
    const x = 18 + Math.round(4 * Math.sin(((h - y) / h) * 1.6));
    px(g, "#8a5a32", x, y, 4, 1);
    px(g, "#b07a48", x, y);
    if (y % 4 === 0) px(g, "#5e3a1e", x, y, 4, 1);
  }
  const tx = PALM_CROWN_X - 2, ty = PALM_CROWN_Y;
  const frond = (dx, dy, len) => {
    for (let k = 0; k < len; k++) {
      const u = k / len;
      const x = Math.round(tx + 2 + dx * k), y = Math.round(ty + dy * k + u * u * len * 0.6);
      px(g, "#2f8a3a", x, y, 2, 1);
      if (k % 2) {
        px(g, "#4fb04a", x, y + 1);
        px(g, "#1f6a2a", x + 1, y + 2);
      }
    }
  };
  frond(1, -0.3, 16);
  frond(-1, -0.3, 16);
  frond(0.8, 0.15, 13);
  frond(-0.8, 0.15, 13);
  frond(0.3, -0.7, 9);
  frond(-0.3, -0.7, 9);
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

// The jungle's background, in three layers that each repeat sideways (drawn with parallax):
// far canopy, tree trunks with hanging vines, and ferns along the horizon with the canopy edge above
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
  for (let x = 0; x < 420; x += 7) {
    const fx = x + Math.floor(hash(x, 3) * 4);
    for (let k = 0; k < 6; k++) {
      px(g, "#3f7f3f", (fx - k + 420) % 420, 92 - k);
      px(g, "#3f7f3f", (fx + k) % 420, 92 - k);
      px(g, "#3f7f3f", fx % 420, 90 - k);
    }
  }
  return { far, mid, near };
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
    palms: Object.fromEntries([48, 54, 60].map((h) => [h, makePalm(h)])),
    coconut: makeCoconut(false),
    coconutHalf: makeCoconut(true),
    logs: Object.fromEntries([3, 4, 5].map((t) => [t * TILE, makeLog(t)])), // by width in pixels
    vultures: Object.fromEntries(Object.entries(VULTURE_PALETTES).map(([kind, pal]) =>
      [kind, Object.fromEntries(Object.entries(VULTURE_FRAMES).map(([f, rows]) => [f, spriteFromRows(rows, pal)]))])),
    bears: Object.fromEntries(Object.entries(BEAR_PALETTES).map(([kind, pal]) => [kind, [0, 1, 2, 3].map((f) => makeBear(pal, f))])),
  };
}
