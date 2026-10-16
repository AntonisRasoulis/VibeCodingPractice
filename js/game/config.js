// Tunable numbers for the game. Change these to adjust how it feels.
// Distances are in game pixels; one tile is 8 pixels (about "1 meter").

const TILE = 8;                 // size of one tile
const VIEW_W = 400;             // width of each player's view
const VIEW_H = 120;             // height of each player's view (15 tiles)
const ROWS = VIEW_H / TILE;     // tiles from top to bottom of the level
const DIVIDER = 2;              // gap between the top and bottom views
const SCALE = 2;                // how much the pixel art is enlarged on screen

const PHYSICS = {
  gravity: 900,
  maxFall: 320,
  runSpeed: 96,
  groundAccel: 900,
  airAccel: 650,
  friction: 1100,
  jumpSpeed: 265,
  jumpCut: 0.45,     // letting go of jump early cuts the jump short
  coyoteTime: 0.08,  // can still jump this long after running off a ledge
  jumpBuffer: 0.1,   // a jump pressed this long before landing still counts
};

const FIRE = {
  startOffset: 120,  // how far behind the start the fire begins
  startSpeed: 35,    // pixels per second at the start
  speedGain: 0.9,    // added to its speed every second (players run at 96)
};

const DEATH = {
  respawnDelay: 1.0, // seconds before you come back
  respawnBehind: 40, // how far behind the death spot you come back (5 tiles)
};

const FREEZE_TIME = 3;   // seconds a freeze orb holds you in place
const FREEZE_CHANCE = 0.5; // share of orbs that freeze instead of swap

const DASH = {
  chance: 0.2,  // share of orbs that are dash orbs
  hold: 1.0,    // seconds you hang in the air before launching
  speed: 480,   // launch speed (normal running is 96)
  time: 0.65,   // seconds the launch lasts: about 310px, plus your fall afterwards
};

const ZAP = {
  chance: 0.16, // share of orbs that are lightning orbs
  speed: 320,   // how fast a bolt travels (normal running is 96)
  length: 48,   // bolt length: 6 tiles, short enough to jump over
  height: 5,    // how high above the ground the bolt runs
  range: 2400,  // how far a bolt travels before fizzling out
};

// Orb shares: wind 26%, dash 20%, lightning 16%, hand 16%, and the rest (22%)
// split between swap and freeze by FREEZE_CHANCE (11% each).

const WIND = {
  chance: 0.26, // share of orbs that are wind dash orbs (the most common)
  speed: 420,   // dash speed (normal running is 96)
  time: 0.23,   // seconds the dash lasts: about 12 tiles
};

const HAND = {
  chance: 0.16,     // share of orbs that are hand orbs
  speed: 300,       // how fast the hand flies (normal running is 96)
  range: 128,       // how far it flies before fading out (16 tiles)
  size: 10,         // the part of the hand that catches someone (pixels)
  throwX: 400,      // throw speed backwards: about 27 tiles (30 with the suplex swing)
  throwUp: 250,     // how high the throw goes: about 4 tiles at the top
  stun: 0.5,        // seconds the thrown player can't control themselves
  suplexRadius: 10, // how wide the grab swings the player up and over
  grabTime: 0.45,   // grab: close the fist, then swing up and over
  swatTime: 0.24,   // backhand: wind up, then swat
};

const MISSILE = {
  startAt: 300,    // meters before the first black missile can come
  stripedAt: 400,  // meters before red-striped missiles can come too
  every: [160, 240], // random meters run (by the leader) between missiles: about 1 per 200m
  approach: 1.4,   // seconds zooming in from far away in the background
  lock: 0.6,       // seconds aiming (red target + aim line) before it fires
  speed: 340,      // how fast it flies once fired (normal running is 96)
  blast: 9,        // explosion radius: about a tile around the hit
  blastTime: 0.3,  // how long the explosion shows
  lethalTime: 0.15, // the explosion can kill during this first part
  range: 700,      // how far it flies before giving up
};

// Biomes: the course changes scenery (and some rules) as you go.
// The first race after opening the website always starts in the prairie;
// after that a race can start in any biome.
const BIOMES = ["prairie", "snow"];
const BIOME_LENGTH = [250, 450]; // random length of each biome, in tiles (meters): about 350 on average

const SNOW = {
  iceAccel: 260,       // how quickly you speed up on ice (normal ground is 900)
  iceFriction: 140,    // how quickly you stop on ice when you let go (normal ground is 1100)
  icicleTrigger: 60,   // an icicle starts shaking when you're this close (pixels) to running under it
  icicleShake: 0.4,    // seconds it shakes before it drops
  icicleGravity: 400,  // how fast it falls
  snowballSpeed: 80,   // how fast snowballs roll towards you
  snowballGrow: 18,    // a snowball gets 1 pixel bigger (radius) every this many pixels it rolls
  snowballMaxR: 7,     // biggest a snowball gets (15 pixels across: always jumpable, even from standing still)
  snowballAhead: 230,  // a snowball starts rolling when you're this far from where it starts
};

const SHOOTER = {
  speed: 80,    // how fast its spikes fly
  range: 160,   // how far a spike flies before it's gone
  warn: 0.45,   // seconds the shooter glows and shakes before each volley
};

const MACE_RADIUS = 5;   // how close a mace's ball can get before it hits you

const FALLING = {
  shakeTime: 0.5,    // seconds a crumbling platform shakes before it drops
  gravity: 600,
};
