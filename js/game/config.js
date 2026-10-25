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
  chance: 0.185, // share of orbs that are dash orbs
  hold: 1.0,    // seconds you hang in the air before launching
  speed: 480,   // launch speed (normal running is 96)
  time: 0.65,   // seconds the launch lasts: about 310px, plus your fall afterwards
};

const ZAP = {
  chance: 0.152, // share of orbs that are lightning orbs
  speed: 320,   // how fast a bolt travels (normal running is 96)
  length: 48,   // bolt length: 6 tiles, short enough to jump over
  height: 5,    // how high above the ground the bolt runs
  range: 2400,  // how far a bolt travels before fizzling out
};

// Orb shares: wind 25%, dash 18.5%, lightning 15.2%, hand 15.2%, drone 15.2%, and the
// rest (10.9%) split between swap and freeze by FREEZE_CHANCE (5.45% each). With about
// 5.8 orbs every 1000 m: wind ~1.45, dash ~1.07, lightning / hand / drone ~0.88 each,
// swap and freeze ~0.33 each.

// The rescue drone (an ability orb). Used by the player behind, it flies to the leader,
// grabs them and drops them a little in front of you. Used by the leader (or in 1-player
// mode), it follows you and saves you once if you fall into a pit.
const DRONE = {
  chance: 0.152,     // share of orbs that are drone orbs (same as lightning and hand)
  flySpeed: 330,     // how fast it flies to the leader (normal running is 96)
  carrySpeed: 360,   // how fast it carries someone
  dropAhead: 24,     // how far in front of the player behind it drops the leader
};

const WIND = {
  chance: 0.25, // share of orbs that are wind dash orbs (the most common)
  speed: 420,   // dash speed (normal running is 96)
  time: 0.23,   // seconds the dash lasts: about 12 tiles
};

const HAND = {
  chance: 0.152,    // share of orbs that are hand orbs
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

// When each biome's special dangers can start showing up (meters run by the leader).
// Base: black missile, brown & black bear, brown vulture. Special: red-striped missile, polar bear, black vulture.
const THREATS = {
  baseAt: 400,
  specialAt: 500,
};

const MISSILE = {
  startAt: THREATS.baseAt,      // meters before the first black missile can come
  stripedAt: THREATS.specialAt, // meters before red-striped missiles can come too
  perBiome: { 1: 15, 2: 75, 3: 10 }, // how many come in each prairie biome (in %): usually 2
  stretch: 350,      // with biomes off, every this many meters counts as one prairie "biome"
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
const BIOMES = ["prairie", "snow", "desert"];
const BIOME_LENGTH = [250, 450]; // random length of each biome, in tiles (meters): about 350 on average

const SNOW = {
  iceSections: 0.55,   // share of snow sections that have icy ground (in front of, under and after the danger)
  iceAccel: 100,       // how quickly you speed up or turn on ice (normal ground is 900, and turning is 2x faster there)
  iceFriction: 45,     // how quickly you stop on ice when you let go (normal ground is 1100): slides about 12 tiles
  icicleTrigger: 60,   // an icicle starts shaking when you're this close (pixels) to running under it
  icicleShake: 0.4,    // seconds it shakes before it drops
  icicleGravity: 400,  // how fast it falls
  snowballSpeed: 80,   // how fast snowballs roll towards you
  snowballGrow: 18,    // a snowball gets 1 pixel bigger (radius) every this many pixels it rolls
  snowballMaxR: 8,     // biggest a snowball gets (17 pixels across: always jumpable, even from standing still)
  snowballAhead: 230,  // a snowball starts rolling when you're this far from where it starts
};

// Wild mode: the hard mode. These change from normal while it's on.
const WILD = {
  missileEvery: [3, 8], // prairie: seconds between missiles at the leader (normal: about 2 per biome)
  vultureGap: 0.6,      // desert: the next group comes this soon after the last one is gone
  bearGap: 0.5,         // snow: the next bear charges in this soon after one gives up
  sinkTime: 1.6,        // quicksand: seconds to sink all the way (normal 3): mash jump!
  struggleFade: 3.2,    // ...and your presses wear off faster (normal 2.4)
  speedUp: 0.85,        // saws, maces and shooters: their swings / volleys take this much of the normal time
  bigOdds: { 0: 1, 1: 1, 2: 2 }, // traps and sinkholes: small / medium / large odds (normal: all even)
};

const DESERT = {
  sinkTime: 3,        // seconds to sink all the way into quicksand if you do nothing
  jumpsToEscape: 6,   // this many jump presses pull you out (each one also lifts you up a little)
  struggleFade: 2.4,  // presses "wear off" this fast (per second), so you have to press quickly
  wadeSpeed: 6,       // how slowly you can push through quicksand (normal running is 96)
  cactusHeights: [14, 16, 18], // cactuses are the tallest spikes (prairie 5, ice 8)
  tumbleSpeed: 90,    // tumbleweeds roll towards you (snowballs: 80)
  tumbleR: 5,         // 11 pixels across (the biggest snowball is 15)
  tumbleBounce: [7, 15], // how high each tumbleweed bounces (random for each one)
  tumbleAhead: 240,   // a tumbleweed starts rolling when you're this far from where it starts
};

// The desert's special danger: vultures come for the player in the lead, in groups of 1-3,
// about as often as the prairie's missiles. They skim the ground at your feet: jump over them.
const VULTURE = {
  every: [160, 240],   // random meters run (by the leader) between groups
  groupSizes: { 1: 3, 2: 2, 3: 1 }, // how likely each group size is
  stagger: 0.8,        // seconds between the vultures in a group
  brown: { circle: 2, dive: 0.6, skim: 140 }, // circles above you first; grabs you and carries you back
  black: { dive: 0.45, skim: 230 },           // faster, straight in for the kill
  carryTime: 0.8,      // how long a brown vulture carries you backwards
  carrySpeed: 140,     // ...and how fast (about 14 tiles back in all)
};

// The snow biome's special danger: once per snow biome a bear comes charging in from
// the left after the player in the lead. Keep running right and you stay just ahead.
const BEAR = {
  startBehind: 150, // how far behind the player its nose starts (just off the left of their screen)
  waitBehind: 60,   // the closest it waits behind someone it's chasing who died and is coming back
  polar: { speed: 124, chase: 5 },  // deadliest: slow down at all and it gets you
  brown: { speed: 102, chase: 10 }, // you can afford a short stop now and then
  black: { speed: 100, chase: 15 }, // slowest: it doesn't kill, it covers you in honey
  honeyTime: 4,     // seconds a honey-covered player is slowed down
  honeySpeed: 0.5,  // how fast you can run while covered in honey (compared to normal)
  swipeTime: 0.35,  // the swipe when it catches you
  approachSpeed: 170, // charging through the player behind's screen to get to the leader
  tramplePop: 370,  // how hard it launches a player it runs over (that it isn't chasing) straight up
};

const SHOOTER = {
  speed: 80,    // how fast its spikes fly
  range: 160,   // how far a spike flies before it's gone
  warn: 0.45,   // seconds the shooter glows and shakes before each volley
};

// Prairie: bear traps lying in the grass, and bushes to hide in (some with a trap inside)
const TRAP = {
  sizes: [4, 6, 8],  // jaw radius in pixels: small, medium, large
  wiggles: [4, 8],   // small / medium: wiggles (left, right, left...) to get free (a large one kills)
  inBush: 0.18,      // chance to try hiding a trap in a bush (some have no room for one: about 10% end up with one)
};
const SCATTER = {   // traps and bushes sprinkled all over the prairie, not just in their own sections
  trap: 0.028,      // chance per column to try a trap there (most spots don't fit)
  bush: 0.03,       // ...and a bush
  sink: 0.05,       // desert: chance per column to try a sinkhole there
  pond: 0.04,       // snow: ...and thin ice
  behind: 24,       // done this many tiles behind the newest section, once its neighbours are built
};
// Desert: little holes in the sand. Step too close and it spins open and pulls you in.
const SINK = {
  hole: [3, 5, 7],          // half width of the little hole you can see: small, medium, large
  catch: [8, 11, 12],       // step (on the ground) this close to its middle and it gets you
  funnel: [[11, 9], [16, 13]], // [half width, depth] of the hole a small / medium one opens into
  gap: 2,                   // a large one caves in to a gap this many tiles either side (5 wide)
  period: 0.9,              // stuck inside: the sand pours in, but stops every this many seconds...
  calm: 0.2,                // ...for this long: jump then to get out
  pull: 0.3,                // seconds to slide down to the bottom
  slip: 0.5,                // jump at the wrong moment and you slide back: no getting out for this long
};
// Snow: patches of thin ice over a frozen pond. Walk on it and it holds; jump on (or off) it,
// or both stand on it at once, and it breaks: you're frozen in the icy water.
const THIN_ICE = {
  widths: [3, 5],    // how many tiles long a patch is (random in this range)
  perBiome: [2, 3],  // every snow biome gets at least this many patches (random in this range)
  crackGrow: 0.6,    // seconds a fresh crack takes to spread out
  breakTime: 0.8,    // seconds the ice takes to crack all over and break up when it gives way
  jumpsToBreak: 3,   // frozen in: jumps it takes to break out of the block of ice
  sink: 4,           // how far into the water you sink (pixels)
};
const BUSH = {
  sizes: [[16, 14], [22, 15], [30, 17], [40, 20]], // [width, height] in pixels
};

const SAW = {
  sizes: [6, 9, 12], // blade radius in pixels: small, medium, large
  spin: 14,          // how fast the blades spin (radians per second)
};

const MACE_RADIUS = 5;   // how close a mace's ball can get before it hits you

const FALLING = {
  shakeTime: 0.5,    // seconds a crumbling platform shakes before it drops
  gravity: 600,
};
