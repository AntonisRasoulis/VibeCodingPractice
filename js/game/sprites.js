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
    cloud: spriteFromRows(CLOUD_ROWS, { w: "#ffffff", b: "#d6eefc" }),
  };
}
