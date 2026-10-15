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
    handOrb: spriteFromRows(HAND_ORB_ROWS, { g: "#b8860b", y: "#ffd23f", v: "#9b5de5", l: "#c9a3ff" }),
    handOpen: spriteFromRows(HAND_OPEN_ROWS, HAND_PALETTE),
    handBack: spriteFromRows(HAND_BACK_ROWS, HAND_PALETTE),
    handFist: spriteFromRows(HAND_FIST_ROWS, HAND_PALETTE),
    cloud: spriteFromRows(CLOUD_ROWS, { w: "#ffffff", b: "#d6eefc" }),
  };
}
