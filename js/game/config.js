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

const FALLING = {
  shakeTime: 0.5,    // seconds a crumbling platform shakes before it drops
  gravity: 600,
};
