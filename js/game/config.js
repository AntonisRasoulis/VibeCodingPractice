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
// rest (10.9%) split between swap and freeze by FREEZE_CHANCE (5.45% each). In the desert, snow and
// jungle, 30% of the orbs are that biome's own two instead. With about 3 orbs per biome (ORBS),
// that's about 8 orbs every 1000 m.

// The rescue drone (an ability orb). Used by the player behind, it flies to the leader,
// grabs them and drops them a little in front of you. Used by the leader (or in 1-player
// mode), it follows you and saves you once if you fall into a pit.
const DRONE = {
  chance: 0.152,     // share of orbs that are drone orbs (same as lightning and hand)
  flySpeed: 330,     // how fast it flies to the leader (normal running is 96)
  carrySpeed: 360,   // how fast it carries someone
  dropAhead: 24,     // how far in front of the player behind it drops the leader
};

// The desert's own two orbs (only found in the desert): about 15% of its orbs each.
// Sandstorm (gold): works at once. For 10 seconds sand blows across everyone's screen (a little
// harder to see) and slowly pushes everyone left; whoever grabbed it is pushed 10% less.
const SANDSTORM = {
  chance: 0.15,
  time: 10,          // seconds it blows
  push: 34,          // how hard it pushes left (pixels per second; running is 96)
  ownPush: 0.9,      // the one who grabbed it is pushed this much as hard
  fade: 1,           // seconds it takes to blow up, and to die down at the end
};
// Firehawk (light blue, S / Down): it flies out over the other player and drops a burning stick
// where they'll be. The stick kills if it hits, and the ground it lands on burns for 10 seconds
// (touch the flames and you die; jump over them). Alone, it circles you instead, and the first
// animal that comes for you (a vulture, bear or jaguar), or missile, it dives on and burns.
const FIREHAWK = {
  chance: 0.15,
  speed: 300,        // flying out to the other player (normal running is 96)
  height: 48,        // how high above the ground it drops the stick from
  gravity: 520,      // how fast the stick falls
  fireTime: 10,      // seconds the ground burns where the stick lands
  fireHalf: 16,      // the flames reach this far each side of it (4 tiles across: a running jump clears it)
  fireTall: 8,       // ...and burn you below this height
  spread: 0.4,       // seconds the fire takes to spread out
  guardRadius: 26,   // alone: it circles you this far out...
  guardSense: 150,   // ...and dives on an animal coming for you once it's this close
  missileSense: 230, // ...or on a missile locked on to you, from further out (it locks on from up to 195 px away)
  diveSpeed: 420,
};

// The jungle's own two orbs (only found in the jungle): about 15% of its orbs each.
// Monsoon (gold): works at once. Pouring rain, and a fast river rises up out of the ground over
// everything, above the tallest obstacle, for 10 seconds. Nothing can hurt you while it's flooded:
// just stay on the logs drifting along it. Fall in and the current sweeps you back, fast, until you
// catch a log again. When it drains, the log you're on carries you down onto safe ground.
const MONSOON = {
  chance: 0.15,
  time: 10,          // seconds it lasts (rising and draining included)
  rise: 1.2,         // seconds the water takes to rise...
  drain: 1.2,        // ...and to drain away at the end
  surface: 30,       // how high it rises (the water's surface, pixels from the top: above every obstacle)
  logSpeed: 42,      // the logs drift left this fast (twice a jungle river's speed)
  logWidths: [32, 40],
  gap: [24, 32],     // water between one log and the next (3-4 tiles: an easy hop)
  sweep: 240,        // fall in and the current carries you left this fast (running is 96)...
  sweepFor: 0.8,     // ...for at least this long, then you grab the first log you come to
};
// Monkey (light blue, S / Down): it swings in fast from the top of the screen on a vine, sweeping
// through the other player. If it catches them it carries them up and flings them a little back;
// either way it then jumps off its vine after them (at running speed) and once it gets them it sits
// on their head and covers their eyes with two big hands for 4 seconds. Jump the swing to dodge it.
// Alone, it swings you forward to the next safe spot instead.
const MONKEY = {
  chance: 0.15,
  radius: 100,       // its vine: the swing's radius (the vine hangs from above the top of the screen)
  swing: 0.7,        // seconds for the whole swing (fastest at the bottom, where it sweeps through you)
  carry: 0.18,       // caught: swept up off your feet for this long...
  fling: [70, 160],  // ...then flung back (and up): about 6 tiles in all
  chaseSpeed: 96,    // jumping off its vine, it chases at running speed
  giveUp: 8,         // ...for this long at most
  blind: 4,          // seconds it covers your eyes
  ferry: 0.9,        // alone: seconds to swing you to the next safe spot
  ferryAhead: 8,     // ...at least this many tiles ahead
};

// The snow's own two orbs (only found in the snow): about 15% of its orbs each.
// Snowstorm (gold): works at once. For 10 seconds a blizzard whites out everyone's screen, and
// anyone who isn't holding left or right (jumping doesn't count) freezes solid within half a second,
// in a block of ice like thin ice: jump 3 times to break out.
const SNOWSTORM = {
  chance: 0.15,
  time: 10,          // seconds it blows
  fade: 1,           // seconds it takes to blow up, and to die down at the end
  freezeAfter: 0.5,  // seconds of not moving before you freeze solid
  jumpsToBreak: 3,   // frozen: jumps it takes to break out
};
// Snowball (light blue, S / Down): thrown the way you're facing, in a short low arc. It's small and
// hard to hit, but if it hits the other player they're frozen for 7 seconds, with no way out.
// Alone, it gives you skates instead: 20 seconds of running faster on ice.
const SNOWBALL = {
  chance: 0.15,
  vx: 160,           // how fast it's thrown (it lands about 7 tiles away)
  vy: 70,            // ...and how high (a low lob: it can hit you anywhere along the way)
  gravity: 600,
  size: 3,           // the part of it that hits (pixels: it's tiny)
  freeze: 7,         // seconds a hit freezes you (no escape)
  skate: 20,         // alone: seconds of skating
  skateSpeed: 1.5,   // ...running this much faster on ice
  skateAccel: 4,     // ...and speeding up / turning this much quicker on it
};

// How often orbs come: never closer than `gap` tiles apart, and each section after that has this
// chance weight of being an orb (each biome has its own, as each has a different mix of sections):
// about 3 orbs per biome
const ORBS = {
  gap: 30,
  weight: { prairie: 11, snow: 17, desert: 13, jungle: 16, forest: 12 },
};

// Purple catch-up orbs: they appear for a runner who has fallen off the leader's screen (alone: when
// the fire is on your screen), ahead of them but out of sight of both. Further behind, they come more often.
const CATCHUP = {
  every: [9, 3],      // seconds between orbs: just off the screen ... `far` or more behind
  far: 1200,          // (pixels behind the leader's screen; alone: how close the fire is, see fireNear)
  fireNear: 140,      // alone: the fire within this many pixels of you counts as falling behind
  margin: 24,         // how far outside both screens it has to be
  maxWaiting: 2,      // never more than this many waiting ahead of you
  kinds: { portalgun: 1, grapple: 1, vine: 1 }, // (alone, no grapple: there's nobody to pull)
};

const PORTAL_GUN = {
  passes: 3,          // you come out past this many obstacles (big ones: a single spike doesn't count)
  bigRun: 3,          // a run of spikes or quicksand counts once it's this many tiles long
  merge: 4,           // dangers closer than this many tiles count as one obstacle
  inTime: 0.4,        // seconds being pulled into the portal
  outTime: 0.35,      // ...and coming out of the other one
};

const GRAPPLE = {
  speed: 1400,        // how fast the hook flies to the leader
  reel: 700,          // how fast it reels them back
  arc: 30,            // how high they're swung while reeled in
  wave: 5,            // the rope's sine wave while it flies out
};

const VINE = {
  distance: [1300, 1600], // alone (or in the lead): how far forward it flings you. Otherwise it lands you where the other player is
  drop: 0.25,         // seconds for the vine to come down to you
  swing: 0.35,        // ...to swing you up
  fly: 1.4,           // ...and flying through the air (at least)
  topSpeed: 1100,     // ...never faster than this (pixels a second), so the camera keeps up
  peak: -40,          // the top of the flight (above the top of the screen)
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
const BIOMES = ["prairie", "snow", "desert", "jungle"];
// Hidden biomes: never in the normal rotation (you'll only get there through a magic portal)
const SECRET_BIOMES = ["forest"];
const BIOME_NAMES = { forest: "enchanted forest" }; // (the rest are shown as they are)
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
  missileEvery: [0, 0], // prairie: the next missile comes as soon as the last one is gone (normal: about 2 per biome)
  vultureGap: 0.6,      // desert: the next group comes this soon after the last one is gone
  bearGap: 0.5,         // snow: the next bear charges in this soon after one gives up
  sinkTime: 1.6,        // quicksand: seconds to sink all the way (normal 3): mash jump!
  struggleFade: 3.2,    // ...and your presses wear off faster (normal 2.4)
  speedUp: 0.85,        // saws, maces and shooters: their swings / volleys take this much of the normal time
  bigOdds: { 0: 1, 1: 1, 2: 2 }, // traps, sinkholes and flytraps: small / medium / large odds (normal: all even)
  flytrapWindup: 0.28,  // flytraps snap quicker (normal 0.35)...$
  flytrapChewNothing: 0.9, // ...and get over a miss quicker (normal 1.2)
  jaguarGap: 0.6,       // jungle: the next jaguar comes this soon after the last one gives up
  turretShots: 3,       // jungle: turrets fire 3 arrows before they sink back (normal 1-2)...
  turretAim: { regular: 0.3, low: 0.14 }, // ...with less warning (normal 0.45 and 0.2)...
  turretReload: 0.45,   // ...and less time between them (normal 0.7)
};

// The jungle's spikes come in two kinds: thin bamboo stakes, very tall (a jump lifts your feet
// about 38 pixels), and low thorn bushes, really wide
const JUNGLE = {
  bambooHeights: [20, 24, 28, 32], // pixels (prairie spikes are 5, cactuses 14-18)
  thornWidths: [2, 5],             // tiles: 5 is about the widest a full-speed jump clears
  backBushes: [[26, 13], [32, 15], [38, 17], [30, 12]], // the low bushes in the background: [width, height]
};

// Jungle rivers: too wide to jump, with logs drifting along them. The current runs left (back the
// way you came): logs bob up at the far bank, drift left and sink at the near bank. They're evenly
// spaced, so the hop from one log to the next is always the same easy gap.
const RIVER = {
  widths: { small: [8, 12], medium: [13, 19], big: [20, 28] }, // tiles of water
  logTiles: [3, 5],  // how long each log is
  gap: [2, 3],       // tiles of water between one log and the next
  speed: [16, 26],   // how fast the logs drift left (pixels per second; normal running is 96)
  rise: 0.5,         // seconds a new log takes to bob up at the far bank
  sink: 0.9,         // seconds a log takes to sink at the near bank (you can still stand on it for the first half)
  sweep: 110,        // fall in, and the current carries you back to the near bank this fast
  surface: 3,        // the water is this many pixels below the banks
  hop: 4,            // tiles: the longest hop a river ever asks for (a full-speed jump is about 7)
};

// Jungle palm trees, all hung with coconuts. Most never fall, but about one palm in five has one
// that does when you run towards it: it wobbles (its shadow shows where it'll land), then drops.
// Like the icicles, each player gets their own coconuts.
const COCONUT = {
  every: [8, 22],     // tiles between palm trees (they're common)
  dropChance: 0.6,    // share of palms with a coconut that falls (where it's safe to: about a third of them)
  trigger: 72,        // it starts wobbling when you're this close (pixels) to running under it
  shake: 0.35,        // seconds it wobbles before it drops
  gravity: 600,       // how fast it falls
  stun: 1,            // seconds you're dizzy (can't move) if it bonks you
};
// The 5 kinds of palm tree: how far (pixels) its crown is from the foot of its trunk, and how tall it
// is (times its height): classic, leaning, royal, fan, windswept
const PALMS = [{ lean: 4, tall: 1 }, { lean: -9, tall: 0.95 }, { lean: 0, tall: 1.15 }, { lean: 2, tall: 0.62 }, { lean: 7, tall: 0.95 }];

// The jungle's trap: a giant flytrap. It never closes on its own: get close and it rears back,
// then snaps at everything in its bite (even high in the air: you can't jump it). Fake it out:
// step into its range and back off, and it snaps on nothing and chews air for a moment. Run past then.
// If it gets you, it chews you for a bit, then the small (green) one spits you back; the big
// (purple) one, only after 400 m, swallows you.
const FLYTRAP = {
  windup: 0.35,       // seconds it rears back before it snaps (Wild: WILD.flytrapWindup)
  reach: [12, 16],    // its bite: this far each side of its middle (small, big), in pixels
  lunge: 44,          // ...and this high up (higher than any jump)
  chew: 1.5,          // seconds it chews someone it caught
  chewNothing: 1.2,   // seconds it chews on nothing after a miss (Wild: WILD.flytrapChewNothing)
  open: 0.35,         // seconds it takes to open up again
  spit: [120, 170],   // the small one spits you back this fast (sideways, up): about 5 tiles
  spitStun: 0.8,      // ...and you're dazed this long
};

// The jungle's ancient turret: a stone idol head buried under the course, with no sign of it at all.
// Come close and the ground rumbles, it rises and shoots arrows along the ground: low ones at your
// feet, or regular ones at body height (it rises a little higher for those). A jump clears either.
// Some rise up ahead of you and shoot back at you; some wait until you've run over them and rise up
// behind you. Just before each shot, the arrow's tip (and the idol's eyes) glow its color. Before
// 400 m it only shoots plain arrows. It's shared: its arrows hit anyone in the way.
const TURRET = {
  sense: 260,          // one ahead of you rumbles when someone coming towards it is this close (pixels)
  behind: [16, 40],    // one behind you rumbles once someone has run this far past it
  rumble: 0.45,        // seconds the ground rumbles before it rises
  // A low shot comes out quicker, with less warning, and flies faster than a regular one:
  rise: { regular: 0.35, low: 0.2 },   // seconds it takes to come up
  aim: { regular: 0.45, low: 0.2 },    // seconds the tip glows in its mouth before each shot (Wild: WILD.turretAim)
  speed: { regular: 420, low: 520 },   // how fast its arrows fly (normal running is 96)
  drop: 28,            // gravity on its arrows: a regular one lands about 270 pixels away, a low one about 200
  stuck: 1.5,          // seconds an arrow stays stuck in the ground before it fades away
  reload: 0.7,         // seconds between shots (Wild: WILD.turretReload)
  closest: 60,         // it only fires again at someone who'll still be this far (pixels) from its mouth when it shoots
  shots: [1, 2],       // shots before it sinks back into the ground for good (Wild: WILD.turretShots)
  sink: 0.5,           // seconds it takes to sink back
  heights: { low: 16, regular: 20 }, // how far it rises for each kind of shot (its mouth is 13-15 pixels below its top)
  kinds: { arrow: 1, poison: 1, sleep: 1, blunt: 1 }, // after 400 m: how likely each arrow is
  poison: 6,           // seconds a poison dart messes with your screen (worse and worse, then it clears)
  sleep: 3,            // seconds a sleep dart sends you to sleep on the spot
  bluntDizzy: 0.8,     // a blunt arrow knocks you back as far as the hand's backhand, and you're dizzy this long
};

// The jungle's special danger: once or twice per jungle biome a jaguar (or, from 500 m, a black
// panther) comes for the player in the lead. Its eyes fade in, glowing, in a bush ahead, narrow, and it
// leaps out at you, following you through the air, and lunges low right through you: jump it. Then it
// runs at you and attacks again: crouched flat, it pounces low AT you (jump!); rear and tail up, it
// leaps OVER you (keep going, don't jump). A jaguar attacks 3 times, a panther once but faster.
const JAGUAR = {
  // leap: its first leap out of the trees (seconds); crouch: how long it shows you which attack is
  // coming; over / pounce: how long a leap over you and a low pounce at you take
  // lunge: the end of that leap, low along the ground straight through where you are (jump it!)
  jaguar: { leap: 0.6, lunge: 0.3, attacks: 3, run: 140, crouch: 0.4, over: 0.5, pounce: 0.32 },
  panther: { leap: 0.45, lunge: 0.24, attacks: 1, run: 170, crouch: 0.32, over: 0.42, pounce: 0.28 },
  eyes: 1.8,          // seconds from when its eyes start to fade in (in a bush ahead) to when it leaps (narrowed for the last 0.5)
  fadeIn: 0.8,        // ...they take this long to fade in
  decoys: [4, 10],    // harmless eyes blink in some bush every 4-10 seconds while you're in the jungle (they never narrow)
  ahead: [170, 210],  // how far ahead of the leader its eyes appear (pixels)
  strike: 46,         // it crouches to attack when it's this close to you
  room: 36,           // ...but never closer than this when it springs (if you're running at it, it backs off first)
  overshoot: 34,      // an attack carries it this far past you
  over: 17,           // leaping over you, its feet clear the ground under you by this much (you're 11 tall)
  waitAhead: 70,      // if you die, it waits this far in front of where you'll come back
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

// The giant sleep mushroom: the way into the enchanted forest. It stands on the main course (from 500 m
// on, about once per biome), and now and then lets a slow, light rain of sleep spores fall: one touches you
// and you fall asleep, and wake up in the forest. When it's resting you can slip past.
const SLEEP_SHROOM = {
  from: 500,           // not before this many meters
  puff: [3, 10],       // it puffs for a random 3 to 10 seconds...
  rest: 10,            // ...then rests this long, then picks again
  warn: 0.8,           // its cap starts to glow this long before it puffs
  capW: 42,            // like the spore mushrooms, a bit bigger: its cap's width...
  height: 48,          // ...how tall it is...
  stem: 32,            // ...how high the cap's underside is...
  lean: 9,             // ...and how far over its stem winds
  rate: 12,            // while it puffs, spores drop from under its cap (this many a second)...
  fall: 14,            // ...and float slowly down (pixels a second)...
  drift: 9,            // ...drifting off to one side (left or right, each puff its own way)
  forest: [100, 250],  // how long the forest it sends you to is (tiles)
  sleep: 0.75,         // falling asleep: seconds to fade to dark (with Zs)...
  wake: 0.75,          // ...then waking up in the forest, lying down at first
  fireflies: 1.3,      // the way out: fireflies swarm round you until there's nothing left but them...
};

// The enchanted forest's twists on the usual obstacles
const FOREST = {
  sawBreaks: 0.2,        // share of its saws that break loose...
  sawDelay: [0.8, 3],    // ...a while (seconds) after someone first comes near
  sawWarn: 0.6,          // seconds it shakes and creaks first
  sawSpeed: 140,         // then it rolls at you, half in the ground (you run at 96: jump it!)
  sawGravity: 600,       // (falling off its pole, or out of its pit, first)
  sawJolt: { slot: 170, rail: 120, pit: 230 }, // how hard it jerks up as it breaks (pixels a second, upwards)
  sawClear: 96,          // it only breaks once it would land on ground with at least this far to roll (never straight into a pit)
  sawRollFor: 1400,      // pixels it rolls before it's gone, if no pit stops it first
  floatAmp: [2, 10],     // tiles each way a floating shooter drifts
  floatSpeed: 36,        // its top speed (pixels a second)
  stack: [2, 3],         // shooters in a stack
  stackWeight: 3,        // how often a stack comes, as a section (a single shooter is 5)
};

// The forest's spore mushrooms: spores drift down from under the cap all the time, and running
// under one you'll most likely catch one on your head (about 9 times in 10). Each color does something different (they stack).
const SPORES = {
  weight: 12,          // how often one comes, as a section (about 4 per forest)
  kinds: ["red", "blue", "green", "pink"],
  time: 10,            // seconds red, blue and green last...
  floatTime: 5,        // ...and pink
  speed: 1.4,          // red: you run this much faster
  jump: 1.5,           // blue: you jump this much higher
  floatRise: 14,       // pink: you drift up this fast (pixels a second), still moving left and right
  count: 5,            // spores falling under a cap at once
  fall: 2.2,           // seconds a spore takes to fall from the cap to the ground
  capW: 34,            // the cap's width (pixels)
  stem: 27,            // how high the cap's underside is
  height: 40,          // how tall it is
  lean: 9,             // how far over its curved stem leans (the cap is this far to one side of its foot)
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
  flytrap: 0.02,    // jungle: ...and a flytrap
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
  widths: [7, 12],   // how many tiles long a patch is (random in this range)
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
