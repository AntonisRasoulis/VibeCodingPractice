// One runner: movement, jumping, collisions, dying and respawning.

const HITBOX_W = 6;
const HITBOX_H = 11;

function approach(value, target, amount) {
  return value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
}

function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

class Player {
  constructor(name, palette, x, y) {
    this.name = name;
    this.palette = palette;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.standingOn = null;  // the platform under our feet, if any
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.animDist = 0;
    this.portalCooldown = 0;
    this.dead = false;
    this.deadTimer = 0;
    this.caught = false;     // caught by the fire: game over for this player
    this.blink = 0;
    this.frozen = 0;         // seconds left frozen by a freeze orb
    this.dashHold = 0;       // seconds left hanging in the air before a dash
    this.dashTime = 0;       // seconds left in a dash
    this.windTime = 0;       // seconds left in a wind dash
    this.windDir = 1;        // which way the wind dash goes
    this.power = null;       // the power stored for S / Down ("zap", "wind", "drone", "portalgun"...): one at a time, the newest replaces the old
    this.held = false;       // caught by a mystic hand: the hand moves us, not physics
    this.spin = 0;           // how far the runner is turned while being swung or thrown
    this.stun = 0;           // seconds of no control after being thrown
    this.hitText = "";       // "ZAPPED!", "GRABBED!" or "SMACKED!" on this player's screen
    this.hitColor = "#ffffff";
    this.hitTextTime = 0;
    this.flash = 0;          // white flash on this player's half of the screen
    this.respawnX = x;
    this.respawnY = y;
    this.safeSpots = [{ x, y }]; // recent places we stood safely, used for respawning
    this.fallState = new Map();  // crumbling platforms *this* player has stepped on
    this.icicleState = new Map(); // icicles *this* player has set off (each player gets their own, like the platforms)
    this.coconutState = new Map(); // jungle coconuts *this* player has set off (the same)
    this.dizzy = 0;               // seconds of stars round your head (bonked by a coconut)
    this.trapState = new Set();   // bear traps that have snapped on *this* player
    this.rescueBlock = 0;         // just got knocked free of a trap: can't knock anyone else in for a moment
    this.trapped = 0;             // wiggles (left, right, left...) still needed to get out of a bear trap
    this.lastWiggle = 0;          // the way we last wiggled
    this.wiggleHeld = 0;          // the way we're pushing right now (holding doesn't count as a wiggle)
    this.trapShake = 0;           // the trap jolts each time we wiggle
    this.trapId = null;           // ...which one
    this.hiddenIn = null;         // the bush we're hiding in (nobody can see us)
    this.inSink = null;           // the sinkhole we're stuck in
    this.sinkT = 0;               // ...for how long
    this.sinkFrom = null;         // where we were when it got us (we slide down from there)
    this.inPond = null;           // the icy pond we're frozen in (thin ice broke under us)
    this.onPond = null;           // the thin ice we're standing on right now
    this.pondHits = 0;            // ...and how many jumps we've cracked our block of ice with
    this.snowballs = [];          // snowballs rolling at this player
    this.snowballStarted = new Set();
    this.onIce = false;
    this.biome = null;            // the biome we're in, to notice when it changes
    this.biomeBanner = 0;         // seconds left showing the new biome's name
    this.honey = 0;               // seconds left slowed down by a black bear's honey
    this.poison = 0;              // seconds left of a poison dart messing with your screen (jungle turrets)
    this.asleep = 0;              // seconds left asleep on the spot (a sleep dart)
    this.windPush = 0;            // a sandstorm pushing us left (pixels per second)
    this.snowstorm = false;       // a snowstorm is blowing: stand still and you freeze
    this.chill = 0;               // ...seconds we've stood still in it so far
    this.stormIce = false;        // ...frozen solid by it (jump to break out)
    this.stormHits = 0;           // ...and how many jumps we've cracked the ice with
    this.iceLock = 0;             // seconds left frozen by a snowball (no way out)
    this.skate = 0;               // seconds left on skates (faster on ice)
    this.realm = null;            // the enchanted forest we're in (null: the main course)
    this.dream = null;            // falling asleep (to the forest), the fireflies taking us out, or waking up: { kind, t }
    this.lying = false;           // just woken up, still lying down
    this.spores = { red: 0, blue: 0, pink: 0 }; // seconds left of each spore mushroom's effect (forest): faster, higher jumps, floating
    this.poisonMax = TURRET.poison; // how long the poison we have lasts in all (for how it looks)
    this.flood = null;            // a monsoon's flood: { surface } (nothing can hurt us while it's up)
    this.inFlood = false;         // ...fell in: swept back by the current until we catch a log
    this.floodT = 0;
    this.blind = 0;               // seconds left with a monkey's hands over our eyes
    this.inQuick = false;         // stuck in quicksand
    this.inRiver = null;          // fell in a jungle river: the current is carrying us back to its near bank
    this.eatenBy = null;          // inside a jungle flytrap that's chewing us
    this.sink = 0;                // how deep (pixels) we've sunk into it
    this.quickSurface = 0;        // the quicksand's surface (y)
    this.noCut = 0;               // a jump out of quicksand isn't cut short when you let go
    this.tumbleweeds = [];        // tumbleweeds bouncing at this player
    this.tumbleStarted = new Set();
    this.particles = [];
  }

  // How far along the course this player counts as being (for the fire).
  // While dead, that's where they will respawn.
  get trackX() {
    return this.dead ? this.respawnX : this.x;
  }

  update(dt, input, level) {
    this.level = level; // remembered so dying can look for a place to come back
    this.updateParticles(dt);
    this.updateFallingPlatforms(dt);
    this.updateSnow(dt, level);
    this.updateCoconuts(dt, level);
    if (this.dizzy > 0) this.dizzy -= dt;
    if (this.biomeBanner > 0) this.biomeBanner -= dt;
    if (this.rescueBlock > 0) this.rescueBlock -= dt;
    if (this.honey > 0) this.honey -= dt;
    if (this.poison > 0) this.poison -= dt;
    for (const k in this.spores) if (this.spores[k] > 0) this.spores[k] -= dt;
    if (this.blind > 0) this.blind -= dt;
    if (this.blink > 0) this.blink -= dt;
    if (this.flash > 0) this.flash -= dt * 2;
    if (this.hitTextTime > 0) this.hitTextTime -= dt;
    if (this.caught) return;
    if (this.held) { this.trapped = 0; this.eatenBy = null; return; } // being carried by a hand (it pulls you out of a trap, or a flytrap)
    if (this.eatenBy && !this.dead) { // being chewed: stuck inside it, can't do a thing
      this.x = this.eatenBy.x - HITBOX_W / 2;
      this.y = this.eatenBy.gy - HITBOX_H;
      this.vx = this.vy = 0;
      return;
    }

    if (this.dead) {
      this.deadTimer -= dt;
      if (this.deadTimer <= 0) this.respawn();
      return;
    }
    this.portalCooldown -= dt;

    // Dash orb, part 1: hang in the air, charging up. No control, no gravity.
    if (this.dashHold > 0) {
      this.dashHold -= dt;
      this.vx = 0;
      this.vy = 0;
      if (Math.random() < dt * 12) this.sparkle("#ffd23f");
      if (this.dashHold <= 0) {
        this.dashTime = DASH.time;
        this.facing = 1;
        Sound.play("dashLaunch");
      }
      return;
    }

    // Dash orb, part 2: shoot straight right, ready or not
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.vx = DASH.speed;
      this.vy = 0;
      this.onGround = false;
      this.standingOn = null;
      this.moveX(this.vx * dt, level);
      if (this.vx === 0) this.dashTime = 0;        // hit a wall
      if (this.dashTime <= 0) this.vx = PHYSICS.runSpeed;
      this.checkHazards(level);
      if (!this.dead) this.checkPortals(level);
      return;
    }

    // Wind dash: a quick straight burst the way you were facing
    if (this.windTime > 0) {
      this.windTime -= dt;
      this.vx = this.windDir * WIND.speed;
      this.vy = 0;
      this.onGround = false;
      this.standingOn = null;
      this.moveX(this.vx * dt, level);
      if (this.vx === 0) this.windTime = 0;        // hit a wall
      if (this.windTime <= 0) this.vx = this.windDir * PHYSICS.runSpeed;
      this.checkHazards(level);
      if (!this.dead) this.checkPortals(level);
      return;
    }

    // Stuck in quicksand: sinking, unless you keep pressing jump
    if (this.inQuick) return this.updateQuicksand(dt, input, level);
    if (this.inRiver) return this.updateRiver(dt, level);
    if (this.inFlood) return this.updateFlood(dt, level);
    if (this.inSink) return this.updateSink(dt, input, level);
    if (this.inPond) return this.updatePond(dt, input, level);

    // Snowstorm: stand still (not holding left or right) for a second and you freeze solid.
    // Frozen, each jump cracks the ice; the third breaks you out.
    if (this.stormIce) {
      if (input.jumpPressed) {
        this.stormHits++;
        if (this.stormHits >= SNOWSTORM.jumpsToBreak) {
          this.stormIce = false;
          this.chill = 0;
          this.sparkle("#e8f8ff");
          Sound.play("iceBreak");
        } else Sound.play("iceCrack");
      }
      if (this.stormIce) {
        input = { left: false, right: false, jump: false, jumpPressed: false };
        this.jumpBuffer = 0;
        this.vx = 0;
      }
    } else if (this.snowstorm && this.stun <= 0 && this.frozen <= 0 && this.asleep <= 0 && this.iceLock <= 0) {
      if (input.left || input.right) this.chill = 0;
      else if ((this.chill += dt) >= SNOWSTORM.freezeAfter) {
        this.stormIce = true;
        this.stormHits = 0;
        this.vx = 0;
        Sound.play("freeze");
      }
    } else this.chill = 0;

    // Hit by a snowball: frozen solid, no way out until it thaws
    if (this.iceLock > 0) {
      this.iceLock -= dt;
      if (this.iceLock <= 0) Sound.play("thaw");
      input = { left: false, right: false, jump: false, jumpPressed: false };
      this.jumpBuffer = 0;
      this.vx = 0;
    }
    if (this.skate > 0) this.skate -= dt;

    // Thrown by a hand: no control until we recover (gravity and momentum still work)
    if (this.stun > 0) {
      this.stun -= dt;
      input = { left: false, right: false, jump: false, jumpPressed: false };
      this.jumpBuffer = 0;
    }

    // Frozen by a freeze orb: no running or jumping, but gravity still works
    if (this.frozen > 0) {
      this.frozen -= dt;
      if (this.frozen <= 0) Sound.play("thaw");
      input = { left: false, right: false, jump: false, jumpPressed: false };
      this.jumpBuffer = 0;
    }

    // Hit by a sleep dart: fast asleep, no running or jumping
    if (this.asleep > 0) {
      this.asleep -= dt;
      input = { left: false, right: false, jump: false, jumpPressed: false };
      this.jumpBuffer = 0;
    }

    // Caught in a bear trap: can't move until it lets go
    // Caught in a bear trap: wiggle free by pressing left and right, back and forth
    if (this.trapped > 0) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (dir && dir !== this.wiggleHeld && dir !== this.lastWiggle) {
        this.trapped--;
        this.lastWiggle = dir;
        this.facing = dir;
        this.trapShake = 0.12;
        if (this.trapped > 0) Sound.play("trapWiggle");
        else this.escapeTrap(level);
      }
      this.wiggleHeld = dir;
      if (this.trapShake > 0) this.trapShake -= dt;
      input = { left: false, right: false, jump: false, jumpPressed: false };
      this.jumpBuffer = 0;
      this.vx = 0;
    }

    // Running
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      const skating = this.skate > 0 && this.onGround && this.onIce;
      let accel = this.onGround ? (this.onIce ? SNOW.iceAccel * (skating ? SNOWBALL.skateAccel : 1) : PHYSICS.groundAccel) : PHYSICS.airAccel;
      if (Math.sign(this.vx) === -dir && !(this.onGround && this.onIce)) accel *= 2; // turn around quickly (not on ice)
      const fast = this.spores.red > 0 ? SPORES.speed : 1; // a red spore makes you faster
      accel *= fast;
      const top = PHYSICS.runSpeed * fast * (this.honey > 0 ? BEAR.honeySpeed : 1) * (skating ? SNOWBALL.skateSpeed : 1); // sticky honey slows you down; skates speed you up on ice
      this.vx = clamp(this.vx + dir * accel * dt, -top, top);
      this.facing = dir;
    } else if (this.onGround) {
      this.vx = approach(this.vx, 0, (this.onIce ? SNOW.iceFriction : PHYSICS.friction) * dt); // ice: you keep sliding
    }

    // Jumping
    this.coyote = this.onGround ? PHYSICS.coyoteTime : this.coyote - dt;
    this.jumpBuffer = input.jumpPressed ? PHYSICS.jumpBuffer : this.jumpBuffer - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      // jumping off thin ice breaks it
      const pond = this.onGround && !this.standingOn && level.pondAt(this.x + HITBOX_W / 2);
      if (pond && pond.state === "ice") level.breakPond(pond, this.x + HITBOX_W / 2);
      this.vy = -PHYSICS.jumpSpeed * this.jumpBoost();
      this.jumpBuffer = 0;
      this.coyote = 0;
      Sound.play("jump");
    }
    const minRise = -PHYSICS.jumpSpeed * this.jumpBoost() * PHYSICS.jumpCut;
    // (a thrown player isn't holding jump, so don't cut their throw short)
    if (this.noCut > 0) this.noCut -= dt;
    if (!input.jump && this.vy < minRise && this.stun <= 0 && this.noCut <= 0) this.vy = minRise;

    // Ride moving platforms
    if (this.standingOn && this.vy >= 0) this.moveX(this.standingOn.dx, level);

    // Gravity and movement (a pink spore: no gravity, you drift slowly up instead)
    if (this.spores.pink > 0) {
      this.vy = this.y > 2 ? -SPORES.floatRise : 0;
      this.onGround = false;
      this.standingOn = null;
    } else this.vy = Math.min(this.vy + PHYSICS.gravity * dt, PHYSICS.maxFall);
    this.moveX(this.vx * dt, level);
    if (this.windPush > 0) this.moveX(-this.windPush * dt, level); // a sandstorm blowing us back
    const prevBottom = this.y + HITBOX_H;
    const wasOnGround = this.onGround;
    const fallSpeed = this.vy;
    this.onGround = false;
    this.standingOn = null;
    this.moveY(this.vy * dt, level);
    if (this.vy >= 0) this.landOnPlatforms(level, prevBottom);
    this.onIce = this.onGround && !this.standingOn && level.isIce(Math.floor((this.x + HITBOX_W / 2) / TILE));
    // A monsoon's flood: off the logs and into the water, and the current takes you
    if (this.flood && !(this.onGround && this.standingOn && this.standingOn.kind === "flood") && this.y + HITBOX_H > this.flood.surface + 3) {
      this.inFlood = true;
      this.floodT = 0;
      this.vx = this.vy = 0;
      this.onGround = false;
      this.standingOn = null;
      this.sparkle("#bfe9ff");
      Sound.play("splash");
      return;
    }
    if (this.flood) return; // (nothing can hurt you while it's flooded)
    // Stepped into quicksand
    if (this.onGround && !this.standingOn && level.isQuick(Math.floor((this.x + HITBOX_W / 2) / TILE))) {
      this.inQuick = true;
      this.sink = 1;
      this.struggle = 0;
      this.quickSurface = this.y + HITBOX_H;
      this.onGround = false; // (so we never respawn here)
      this.vx = 0;
      Sound.play("sandSink");
    }
    // Fell in a river: the current takes you
    if (!this.onGround) {
      const river = level.riverAt(this.x + HITBOX_W / 2);
      if (river && this.y + HITBOX_H > river.wy + 3) {
        this.inRiver = river;
        this.vx = this.vy = 0;
        this.sparkle("#bfe9ff");
        this.sparkle("#5fc0d0");
        Sound.play("splash");
        return;
      }
    }
    if (this.onGround && !wasOnGround && fallSpeed > 120) Sound.play(this.onIce ? "iceLand" : "land");
    // Thin ice: it cracks the first time anyone walks on it, and the cracks stay. Land a jump on it,
    // or step back onto it once it's cracked, and it gives way.
    const onPond = this.onGround && !this.standingOn ? level.pondAt(this.x + HITBOX_W / 2) : null;
    if (onPond && onPond.state === "ice") {
      if (!wasOnGround || (onPond !== this.onPond && onPond.cracked)) level.breakPond(onPond, this.x + HITBOX_W / 2);
      else {
        if (!onPond.cracked) Sound.play("iceCrack");
        level.crackPond(onPond, this.x + HITBOX_W / 2);
      }
    }
    if (onPond && onPond.state === "water") this.freezeIn(onPond);
    this.onPond = onPond;

    if (this.onGround && !this.standingOn && !this.inQuick) this.checkTraps(level);
    if (this.onGround && !this.standingOn && !this.inQuick && !this.dead) this.checkSinkholes(level);
    if (this.dead) return;
    this.checkHazards(level);
    if (this.dead) return;
    this.checkPortals(level);
    this.checkBushes(level);

    if (this.onGround && !this.standingOn) this.rememberSafeSpot(level);
    this.animDist += Math.abs(this.vx * dt);

    // Entering a new biome: show its name for a moment
    const biome = level.biomeAt(Math.floor((this.x + HITBOX_W / 2) / TILE));
    if (biome !== this.biome) {
      if (this.biome) {
        this.biomeBanner = 2;
        Sound.play("biome");
      }
      this.biome = biome;
    }
  }

  // ---- Desert: quicksand ----

  updateQuicksand(dt, input, level) {
    if (this.stun > 0) this.stun -= dt;
    if (this.frozen > 0) {
      this.frozen -= dt;
      input = { left: false, right: false, jump: false, jumpPressed: false };
    }
    const full = HITBOX_H;
    const wild = level.wild; // (Wild: you sink much faster, and your presses wear off faster: mash!)
    this.sink += (full / (wild ? WILD.sinkTime : DESERT.sinkTime)) * dt;
    this.struggle = Math.max(0, this.struggle - (wild ? WILD.struggleFade : DESERT.struggleFade) * dt); // slow pressing doesn't add up
    if (input.jumpPressed) {
      this.struggle++;                                    // each press gets you closer to breaking free
      this.sink = Math.max(0.5, this.sink - full / 18);   // ...and pulls you up a bit
      Sound.play("sandPull");
      this.sparkle("#e3b673");
    }
    // You can push through it, very slowly
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) this.facing = dir;
    this.vx = dir * DESERT.wadeSpeed;
    this.vy = 0;
    this.x += this.vx * dt;
    this.y = this.quickSurface - HITBOX_H + Math.max(0, this.sink);
    this.animDist += Math.abs(this.vx * dt);

    if (this.struggle >= DESERT.jumpsToEscape) {
      // Pulled free: a full jump out, carried forward
      this.inQuick = false;
      this.y = this.quickSurface - HITBOX_H - 0.5;
      this.vy = -PHYSICS.jumpSpeed;
      this.vx = this.facing * PHYSICS.runSpeed * 0.6;
      this.noCut = 0.3;
      Sound.play("jump");
      return;
    }
    if (!level.isQuick(Math.floor((this.x + HITBOX_W / 2) / TILE))) {
      // waded out onto firm ground
      this.inQuick = false;
      this.y = this.quickSurface - HITBOX_H;
      this.onGround = true;
      return;
    }
    if (this.sink >= full) {
      this.showHit("SUNK!", "#f2d091");
      this.die();
      return;
    }
    this.checkHazards(level);
  }

  // ---- Jungle: coconuts ----

  // A coconut that can fall starts wobbling when you run towards it, then drops. Bonk: you're dizzy.
  updateCoconuts(dt, level) {
    const cx = this.x + HITBOX_W / 2;
    for (const palm of level.palms) {
      if (!palm.drop || Math.abs(palm.x - cx) > VIEW_W) continue;
      const nx = palm.cx + palm.drop[0];
      let s = this.coconutState.get(palm.id);
      if (!s) {
        const ahead = nx - cx;
        if (!this.dead && !this.caught && ahead > -4 && ahead < COCONUT.trigger) {
          this.coconutState.set(palm.id, { t: 0, y: palm.cy + palm.drop[1], vy: 0, landed: false, landT: 0 });
          Sound.play("coconutWobble");
        }
        continue;
      }
      s.t += dt;
      if (s.landed) { s.landT += dt; continue; }
      if (s.t < COCONUT.shake) continue;
      s.vy += COCONUT.gravity * dt;
      s.y += s.vy * dt;
      if (s.y + 5 >= palm.gy) {
        s.y = palm.gy - 5;
        s.landed = true;
        if (Math.abs(nx - cx) < VIEW_W * 0.7) Sound.play("coconutCrack");
      } else if (!this.dead && !this.held && !this.inRiver && this.dizzy <= 0 && overlaps(this.x, this.y, HITBOX_W, HITBOX_H, nx - 2.5, s.y, 5, 5)) {
        s.landed = true; // it bounces off and splits
        s.y = palm.gy - 5;
        this.bonk();
      }
    }
  }

  bonk() {
    this.stun = COCONUT.stun;
    this.dizzy = COCONUT.stun;
    this.vx = 0;
    this.showHit("BONK!", "#c99a5a");
    Sound.play("bonk");
  }

  // ---- Jungle: swept along a river ----

  // No control: the current carries you back to the near bank, where you climb out
  // Swept along by a monsoon's flood, up to our neck: carried back, fast, until we've been in a moment
  // and a log comes under us. (When the water drains away, we drop wherever we are.)
  updateFlood(dt, level) {
    if (!this.flood) { this.inFlood = false; this.onGround = false; return; }
    this.floodT += dt;
    this.stun = 0;
    this.facing = -1;
    this.vx = -MONSOON.sweep;
    this.vy = 0;
    this.x = Math.max(0, this.x - MONSOON.sweep * dt);
    this.y = this.flood.surface - 5;
    if (this.floodT < MONSOON.sweepFor) return;
    const mid = this.x + HITBOX_W / 2;
    const log = level.platforms.find((p) => p.kind === "flood" && mid > p.x + 2 && mid < p.x + p.w - 2);
    if (log) {
      this.inFlood = false;
      this.y = log.y - HITBOX_H;
      this.vx = 0;
      this.onGround = true;
      this.standingOn = log;
      Sound.play("land");
    }
  }

  updateRiver(dt, level) {
    const r = this.inRiver;
    if (this.x + HITBOX_W / 2 >= r.x1) { this.inRiver = null; return; } // (thrown out of it somehow)
    this.riverT = (this.riverT || 0) + dt;
    this.stun = 0;
    this.frozen = 0;
    this.facing = -1;
    this.vx = -RIVER.sweep;
    this.vy = 0;
    this.x += this.vx * dt;
    this.y = r.wy - HITBOX_H + 6 + Math.round(Math.sin(this.riverT * 9)); // bobbing, head above water
    this.animDist += RIVER.sweep * dt * 0.3;
    if (Math.random() < dt * 10) this.sparkle("#bfe9ff");
    if (this.x + HITBOX_W / 2 < r.x0) {
      this.inRiver = null;
      this.x = r.x0 - HITBOX_W - 1;
      this.y = r.gy - HITBOX_H;
      this.vx = 0;
      this.onGround = true;
      this.sparkle("#bfe9ff");
      Sound.play("land");
    }
  }

  // ---- Snow: icicles and snowballs (each player has their own) ----

  updateSnow(dt, level) {
    const cx = this.x + HITBOX_W / 2;
    for (const ic of level.icicles) {
      if (Math.abs(ic.x - cx) > VIEW_W) continue;
      const s = this.icicleState.get(ic.id);
      if (!s) {
        // Starts shaking when you get close to running under it
        const ahead = ic.x + 3 - cx;
        if (!this.dead && !this.caught && ahead > -6 && ahead < SNOW.icicleTrigger && this.y > ic.y - 6) {
          this.icicleState.set(ic.id, { t: 0, dy: 0, vy: 0, gone: false, goneT: 0 });
          Sound.play("icicleShake");
        }
        continue;
      }
      s.t += dt;
      if (s.gone) { s.goneT += dt; continue; }
      if (s.t > SNOW.icicleShake) {
        s.vy += SNOW.icicleGravity * dt;
        s.dy += s.vy * dt;
        const tip = ic.y + s.dy + ic.len;
        const ground = level.groundTop(ic.x + 3);
        if ((ground !== null && tip >= ground) || tip > VIEW_H + 20) {
          s.gone = true;
          if (ground !== null && Math.abs(ic.x - cx) < VIEW_W * 0.7) Sound.play("icicleShatter");
        }
      }
    }

    for (const spot of level.snowballSpots) {
      if (this.dead || this.caught || this.snowballStarted.has(spot.id)) continue;
      if (spot.x > this.x && spot.x - this.x < SNOW.snowballAhead) {
        this.snowballStarted.add(spot.id);
        const ground = level.groundTop(spot.x);
        if (ground === null) continue;
        this.snowballs.push({ x: spot.x, y: ground - 2.5, r: 2.5, rolled: 0, vy: 0, spin: 0, broke: false, brokeT: 0 });
        Sound.play("snowball");
      }
    }
    for (const ball of this.snowballs) {
      if (ball.broke) { ball.brokeT += dt; continue; }
      const move = SNOW.snowballSpeed * dt;
      ball.x -= move;
      ball.rolled += move;
      ball.spin -= move / ball.r;
      ball.r = Math.min(SNOW.snowballMaxR, 2.5 + ball.rolled / SNOW.snowballGrow);
      const ground = level.groundTop(ball.x);
      const bottom = ball.y + ball.r;
      if (ground !== null && ground < bottom - 3) {
        ball.broke = true; // rolled into a step: it bursts
        Sound.play("snowballBreak");
      } else if (ground === null || ground > bottom + 1) {
        ball.vy += FALLING.gravity * dt; // rolling off an edge
        ball.y += ball.vy * dt;
        if (ground !== null && ball.y + ball.r >= ground) { ball.y = ground - ball.r; ball.vy = 0; }
      } else {
        ball.y = ground - ball.r;
        ball.vy = 0;
      }
    }
    this.snowballs = this.snowballs.filter((ball) =>
      (ball.broke ? ball.brokeT < 0.35 : ball.y < VIEW_H + 20) && ball.x > this.x - VIEW_W);

    // Tumbleweeds: like snowballs, but small and bouncing up and down
    for (const spot of level.tumbleSpots) {
      if (this.dead || this.caught || this.tumbleStarted.has(spot.id)) continue;
      if (spot.x > this.x && spot.x - this.x < DESERT.tumbleAhead) {
        this.tumbleStarted.add(spot.id);
        const ground = level.groundTop(spot.x);
        if (ground === null) continue;
        const [lo, hi] = DESERT.tumbleBounce;
        this.tumbleweeds.push({ x: spot.x, y: ground - DESERT.tumbleR, base: ground - DESERT.tumbleR, vy: 0,
          bounce: lo + Math.random() * (hi - lo), period: 0.45 + Math.random() * 0.2, t: Math.random(), spin: 0, broke: false, brokeT: 0 });
        Sound.play("tumble");
      }
    }
    for (const tw of this.tumbleweeds) {
      if (tw.broke) { tw.brokeT += dt; continue; }
      const move = DESERT.tumbleSpeed * dt;
      tw.x -= move;
      tw.t += dt;
      tw.spin -= move / DESERT.tumbleR;
      const ground = level.groundTop(tw.x);
      const bottom = tw.base + DESERT.tumbleR;
      if (ground !== null && ground < bottom - 3) {
        tw.broke = true; // smashed into a step
        Sound.play("tumbleBreak");
        continue;
      }
      if (ground === null || ground > bottom + 1) {
        tw.vy += FALLING.gravity * dt;
        tw.base += tw.vy * dt;
        if (ground !== null && tw.base + DESERT.tumbleR >= ground) { tw.base = ground - DESERT.tumbleR; tw.vy = 0; }
      } else {
        tw.base = ground - DESERT.tumbleR;
        tw.vy = 0;
      }
      // the bounce: up and down like a ball skipping along
      tw.y = tw.base - tw.bounce * Math.abs(Math.sin((tw.t / tw.period) * Math.PI));
    }
    this.tumbleweeds = this.tumbleweeds.filter((tw) =>
      (tw.broke ? tw.brokeT < 0.35 : tw.base < VIEW_H + 20) && tw.x > this.x - VIEW_W);
  }

  // ---- Collisions ----

  moveX(dx, level) {
    this.x += dx;
    const top = Math.floor(this.y / TILE);
    const bottom = Math.floor((this.y + HITBOX_H - 0.01) / TILE);
    if (dx > 0) {
      const c = Math.floor((this.x + HITBOX_W - 0.01) / TILE);
      for (let r = top; r <= bottom; r++) {
        if (level.isSolid(c, r)) {
          this.x = c * TILE - HITBOX_W;
          this.vx = 0;
          return;
        }
      }
    } else if (dx < 0) {
      const c = Math.floor(this.x / TILE);
      for (let r = top; r <= bottom; r++) {
        if (level.isSolid(c, r)) {
          this.x = (c + 1) * TILE;
          this.vx = 0;
          return;
        }
      }
    }
  }

  moveY(dy, level) {
    this.y += dy;
    const left = Math.floor(this.x / TILE);
    const right = Math.floor((this.x + HITBOX_W - 0.01) / TILE);
    if (dy > 0) {
      const r = Math.floor((this.y + HITBOX_H - 0.01) / TILE);
      for (let c = left; c <= right; c++) {
        if (level.isSolid(c, r)) {
          this.y = r * TILE - HITBOX_H;
          this.vy = 0;
          this.onGround = true;
          return;
        }
      }
    } else if (dy < 0) {
      const r = Math.floor(this.y / TILE);
      for (let c = left; c <= right; c++) {
        if (level.isSolid(c, r)) {
          this.y = (r + 1) * TILE;
          this.vy = 0;
          return;
        }
      }
    }
  }

  // Platforms can be jumped through from below and landed on from above.
  landOnPlatforms(level, prevBottom) {
    const bottom = this.y + HITBOX_H;
    for (const p of level.platforms) {
      if (p.x >= this.x + HITBOX_W || p.x + p.w <= this.x) continue;
      const top = this.platformTop(p);
      if (top === null) continue;
      if (prevBottom <= top + 1 && bottom >= top) {
        this.y = top - HITBOX_H;
        this.vy = 0;
        this.onGround = true;
        this.standingOn = p;
        if (p.kind === "fall" && !this.fallState.has(p.id)) {
          this.fallState.set(p.id, { t: 0, dy: 0, vy: 0 });
          Sound.play("crumble");
        }
        return;
      }
    }
  }

  // Each player has their own copy of the crumbling platforms, so what falls
  // under one player is still there for the other.
  platformTop(p) {
    if (p.kind === "log") return logTop(p);
    if (p.kind !== "fall") return p.y;
    const s = this.fallState.get(p.id);
    if (!s) return p.y;
    return s.dy > VIEW_H ? null : p.y + s.dy;
  }

  updateFallingPlatforms(dt) {
    for (const s of this.fallState.values()) {
      s.t += dt;
      if (s.t > FALLING.shakeTime && s.dy <= VIEW_H) {
        s.vy += FALLING.gravity * dt;
        s.dy += s.vy * dt;
      }
    }
  }

  checkHazards(level) {
    if (this.y > VIEW_H + 8) return this.die(); // fell into a pit

    const c0 = Math.floor(this.x / TILE);
    const c1 = Math.floor((this.x + HITBOX_W - 0.01) / TILE);
    const r0 = Math.floor(this.y / TILE);
    const r1 = Math.floor((this.y + HITBOX_H - 0.01) / TILE);
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= Math.min(r1 + 4, ROWS - 1); r++) { // (cactuses and bamboo reach up past their own tile)
        if (level.tile(c, r) === T_SPIKE && overlaps(this.x, this.y, HITBOX_W, HITBOX_H, ...level.spikeBox(c, r))) return this.die();
      }
    }

    // Swinging maces: hit if the ball touches the body
    const cx = this.x + HITBOX_W / 2;
    for (const m of level.maces) {
      if (Math.abs(m.x - cx) > m.length + 10) continue;
      const ball = level.macePoints(m, level.time).ball;
      const nearX = clamp(ball.x, this.x, this.x + HITBOX_W);
      const nearY = clamp(ball.y, this.y, this.y + HITBOX_H);
      if ((ball.x - nearX) ** 2 + (ball.y - nearY) ** 2 < MACE_RADIUS ** 2) return this.die();
    }

    // Saw blades: hit if the blade touches the body (the very tips of the teeth are forgiven)
    for (const s of level.saws) {
      if (s.gone) continue;
      if (!s.loose && (cx < Math.min(s.x0, s.x1) - s.r - 8 || cx > Math.max(s.x0, s.x1) + s.r + 8)) continue;
      const c = level.sawPos(s, level.time);
      const nearX = clamp(c.x, this.x, this.x + HITBOX_W);
      const nearY = clamp(c.y, this.y, this.y + HITBOX_H);
      if ((c.x - nearX) ** 2 + (c.y - nearY) ** 2 < (s.r - 1.5) ** 2) return this.die();
    }

    // Flying spikes from shooters
    for (const s of level.shooters) {
      if (Math.abs(s.x - cx) > SHOOTER.range + 16 + (s.float ? 2 * s.float.amp : 0)) continue; // (a floating one fired from wherever it was)
      for (const spike of level.shooterSpikes(s, level.time)) {
        if (overlaps(this.x, this.y, HITBOX_W, HITBOX_H, spike.x - 1.5, spike.y - 1.5, 3, 3)) return this.die();
      }
    }

    // Icicles: hanging or falling, touching one hurts
    for (const ic of level.icicles) {
      if (Math.abs(ic.x - cx) > 16) continue;
      const s = this.icicleState.get(ic.id);
      if (s && s.gone) continue;
      const dy = s ? s.dy : 0;
      if (overlaps(this.x, this.y, HITBOX_W, HITBOX_H, ic.x + 1, ic.y + dy, 4, ic.len - 1)) return this.die();
    }

    // Tumbleweeds
    for (const tw of this.tumbleweeds) {
      if (tw.broke) continue;
      const nearX = clamp(tw.x, this.x, this.x + HITBOX_W);
      const nearY = clamp(tw.y, this.y, this.y + HITBOX_H);
      if ((tw.x - nearX) ** 2 + (tw.y - nearY) ** 2 < (DESERT.tumbleR - 1) ** 2) {
        tw.broke = true;
        Sound.play("tumbleBreak");
        return this.die();
      }
    }

    // Snowballs
    for (const ball of this.snowballs) {
      if (ball.broke) continue;
      const nearX = clamp(ball.x, this.x, this.x + HITBOX_W);
      const nearY = clamp(ball.y, this.y, this.y + HITBOX_H);
      if ((ball.x - nearX) ** 2 + (ball.y - nearY) ** 2 < (ball.r - 1) ** 2) {
        ball.broke = true;
        Sound.play("snowballBreak");
        return this.die();
      }
    }
  }

  // Stepping on an open bear trap: it snaps shut. Large ones kill; the others hold you for a bit.
  checkTraps(level) {
    const cx = this.x + HITBOX_W / 2;
    for (const t of level.traps) {
      // once a trap has snapped on anyone it stays shut: nobody else can step in it
      if (t.sprung || Math.abs(cx - t.x) > TRAP.sizes[t.size] - 1) continue;
      t.sprung = true;
      this.trapState.add(t.id);
      this.trapId = t.id;
      if (t.bush) { t.bush.torn = true; t.bush.tornAt = level.time; } // the snap knocks the bush's top off: no more hiding in it
      Sound.play("trapSnap");
      this.sparkle("#ffffff");
      if (t.size === 2) {
        this.showHit("SNAP!", "#ff4d3d");
        return this.die();
      }
      this.trapped = TRAP.wiggles[t.size]; // wiggles left to get free
      this.lastWiggle = this.facing;        // (holding the way you were running doesn't count)
      this.wiggleHeld = this.facing;
      this.vx = 0;
      this.x = t.x - HITBOX_W / 2; // the jaws grab you right in the middle
      this.showHit("TRAPPED!", "#d6dbe2");
      return;
    }
  }

  // Too close to a sinkhole: small and medium ones spin open and pull you in; a large one caves
  // in under you (and you fall, unless you jumped it). Once open, they stay open for everyone.
  checkSinkholes(level) {
    const cx = this.x + HITBOX_W / 2;
    for (const s of level.sinkholes) {
      const d = Math.abs(cx - s.x);
      if (s.size === 2) {
        if (s.state === "idle" && d < SINK.catch[2]) {
          level.collapseSinkhole(s);
          Sound.play("sinkCollapse");
          this.showHit("CAVE-IN!", "#ffb347");
        }
        continue;
      }
      if (d > (s.state === "open" ? SINK.funnel[s.size][0] - 3 : SINK.catch[s.size])) continue;
      if (s.state === "idle") {
        s.state = "open";
        s.openedAt = level.time;
      }
      this.inSink = s;
      this.sinkT = 0;
      this.sinkSlip = 0;
      this.sinkFrom = { x: this.x, y: this.y };
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.hiddenIn = null;
      Sound.play("sinkOpen");
      this.showHit("SINKHOLE!", "#ffb347");
      return;
    }
  }

  // Stuck at the bottom of a sinkhole: slide down, then jump out when the sand stops for a moment
  updateSink(dt, input, level) {
    const s = this.inSink;
    const [, depth] = SINK.funnel[s.size];
    if (this.stun > 0) this.stun -= dt;
    if (this.frozen > 0) {
      this.frozen -= dt;
      input = { left: false, right: false, jump: false, jumpPressed: false };
    }
    this.sinkT += dt;
    const f = Math.min(1, this.sinkT / SINK.pull);
    const ease = f * (2 - f);
    this.x = this.sinkFrom.x + (s.x - HITBOX_W / 2 - this.sinkFrom.x) * ease;
    this.y = this.sinkFrom.y + (s.gy + depth - HITBOX_H - this.sinkFrom.y) * ease;
    this.vx = 0;
    this.vy = 0;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) this.facing = dir;
    if (this.sinkSlip > 0) this.sinkSlip -= dt;
    if (input.jumpPressed && f >= 1) {
      if (level.sinkCalm(s) && this.sinkSlip <= 0) {
        // Out! Up to the rim and a full jump onward
        this.inSink = null;
        this.y = s.gy - HITBOX_H - 0.5;
        this.vy = -PHYSICS.jumpSpeed;
        this.vx = this.facing * PHYSICS.runSpeed * 0.7;
        this.noCut = 0.3;
        Sound.play("jump");
        return;
      }
      Sound.play("sinkSlip"); // wrong moment: the sand drags you back down (and mashing won't help)
      this.sparkle("#e3b673");
      this.sinkSlip = SINK.slip;
    }
    this.checkHazards(level);
  }

  // Into the icy water: frozen solid in a block of ice. Everyone frozen in the same pond is
  // stuck in the same ice: the first to break out cracks it, and the others shatter with it.
  freezeIn(pond) {
    this.inPond = pond;
    this.pondHits = 0;
    pond.frozen.push(this);
    this.x = clamp(this.x, pond.x0 - HITBOX_W / 2 + 1, pond.x1 - HITBOX_W / 2 - 1);
    this.y = pond.gy - HITBOX_H + THIN_ICE.sink;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.hiddenIn = null;
    Sound.play("splash");
    Sound.play("freeze");
    this.showHit("FROZEN!", "#a6e1ff");
  }

  updatePond(dt, input, level) {
    const pond = this.inPond;
    if (this.stun > 0) this.stun -= dt;
    if (this.frozen > 0) {
      this.frozen -= dt;
      input = { left: false, right: false, jump: false, jumpPressed: false };
    }
    this.vx = 0;
    this.vy = 0;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) this.facing = dir;
    if (input.jumpPressed) {
      this.pondHits++;
      Sound.play("iceCrack");
      this.sparkle("#e8f8ff");
      if (this.pondHits >= THIN_ICE.jumpsToBreak) {
        // Broke out! Whoever else was frozen in with us shatters with the ice
        pond.frozen = pond.frozen.filter((q) => q !== this);
        for (const q of pond.frozen.slice()) {
          q.showHit("SHATTERED!", "#a6e1ff");
          q.die();
        }
        this.inPond = null;
        this.y = pond.gy - HITBOX_H - 0.5;
        this.vy = -PHYSICS.jumpSpeed;
        this.vx = this.facing * PHYSICS.runSpeed * 0.7;
        this.noCut = 0.3;
        Sound.play("iceBreak");
        Sound.play("jump");
        return;
      }
    }
    this.checkHazards(level);
  }

  // Out of a bear trap: the jaws spring apart and we hop out of it
  escapeTrap(level, text = "FREE!") {
    this.trapped = 0;
    const t = level.traps.find((tt) => tt.id === this.trapId);
    if (t) t.poppedAt = level.time;
    this.vy = -150; // a little hop
    this.noCut = 0.2;
    this.onGround = false;
    this.standingOn = null;
    for (let i = 0; i < 6; i++) {
      this.particles.push({ x: this.x + HITBOX_W / 2 + (Math.random() - 0.5) * 8, y: this.y + HITBOX_H - 1, vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 30, life: 0.35, size: 1, color: i % 2 ? "#c9a87a" : "#e8d9b5" });
    }
    Sound.play("trapOpen");
    this.showHit(text, "#d6dbe2");
  }

  // Inside a bush (every column of us under its leaves)? Then nobody can see us.
  checkBushes(level) {
    const was = this.hiddenIn;
    this.hiddenIn = null;
    for (const bush of level.bushes) {
      if (bush.torn || this.x < bush.x0 || this.x + HITBOX_W > bush.x0 + bush.w || this.y + HITBOX_H > bush.gy + 1) continue;
      let covered = true;
      for (let x = Math.floor(this.x - bush.x0); x < Math.ceil(this.x + HITBOX_W - bush.x0) && covered; x++) {
        const top = bush.tops[x];
        if (top === null || top === undefined || this.y < bush.gy - bush.h + top + 1) covered = false;
      }
      if (covered) { this.hiddenIn = bush; break; }
    }
    if (this.hiddenIn && this.hiddenIn !== was) Sound.play("rustle");
  }

  checkPortals(level) {
    if (this.portalCooldown > 0) return;
    for (const portal of level.portals) {
      if (overlaps(this.x, this.y, HITBOX_W, HITBOX_H, portal.x, portal.y, portal.w, portal.h)) {
        this.sparkle("#3fa9f5");
        this.x = portal.toX + 1;
        this.y = portal.toY + portal.h - HITBOX_H;
        this.vy = 0;
        this.portalCooldown = 0.5;
        this.sparkle("#ff8c1a");
        Sound.play("portal");
        return;
      }
    }
  }

  // ---- Dying and respawning ----

  rememberSafeSpot(level) {
    const last = this.safeSpots[this.safeSpots.length - 1];
    if (Math.abs(last.x - this.x) < 4) return;
    // Never respawn somewhere a mace, a shooter's spikes or icicles can reach
    if (level.threatened(this.x, this.y)) return;
    this.safeSpots.push({ x: this.x, y: this.y });
    if (this.safeSpots.length > 300) this.safeSpots.shift();
  }

  die() {
    if (this.dead || this.flood) return; // (nothing can hurt you while it's flooded)
    this.onPond = null;
    this.trapped = 0;
    this.inSink = null;
    if (this.inPond) this.inPond.frozen = this.inPond.frozen.filter((q) => q !== this);
    this.inPond = null;
    this.hiddenIn = null;
    this.held = false;
    this.stun = 0;
    this.asleep = 0;
    this.stormIce = false;
    this.chill = 0;
    this.iceLock = 0;
    this.blind = 0;
    this.spores = { red: 0, blue: 0, pink: 0 };
    this.inFlood = false;
    this.spin = 0;
    this.dashHold = 0;
    this.dashTime = 0;
    this.windTime = 0;
    this.inQuick = false;
    this.dead = true;
    this.deadTimer = DEATH.respawnDelay;
    this.burst();
    Sound.play("die");

    // Come back at the nearest safe spot a little behind where we died: one we stood on,
    // or safe ground on the course (after a dash, or across platforms, we may not have stood nearby)
    const target = this.x - DEATH.respawnBehind;
    let spot = null;
    const firm = (s) => !this.level || (this.level.groundTop(s.x + 1) !== null && this.level.groundTop(s.x + HITBOX_W - 1) !== null); // (a sinkhole may have caved in there since)
    const burning = (s) => this.level && this.level.onFire(s.x + HITBOX_W / 2, HITBOX_W / 2 + 4); // (a firehawk's fire may be there now)
    for (const s of this.safeSpots) if (s.x <= target && firm(s) && !burning(s) && (!spot || s.x > spot.x)) spot = s;
    const near = this.level && this.level.safeSpotBefore(target);
    if (near && (!spot || near.x > spot.x)) spot = near;
    // Nothing behind (say, just carried far back by a drone): look further back,
    // or else use the remembered spot closest to where we died
    if (!spot) spot = this.level && this.level.safeSpotBefore(target, 4000);
    if (!spot) for (const s of this.safeSpots) if (firm(s) && (!spot || Math.abs(s.x - target) < Math.abs(spot.x - target))) spot = s;
    if (!spot) spot = this.safeSpots[0];
    this.respawnX = spot.x;
    this.respawnY = spot.y;
    this.vx = 0;
    this.vy = 0;
    this.standingOn = null;
  }

  respawn() {
    this.dead = false;
    this.frozen = 0;
    this.x = this.respawnX;
    this.y = this.respawnY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.jumpBuffer = 0;
    this.blink = 0.6;
    this.fallState.clear(); // crumbled platforms come back
    this.icicleState.clear(); // ...and so do icicles
    this.coconutState.clear(); // ...and coconuts
    this.dizzy = 0;
    this.trapState.clear();
    this.trapped = 0;
    this.hiddenIn = null;
    this.honey = 0;
    this.inQuick = false;
    this.inRiver = null;
    this.eatenBy = null;
    this.tumbleweeds = [];
    this.tumbleStarted.clear();
    this.snowballs = [];
    this.snowballStarted.clear();
    Sound.play("respawn");
  }

  // Hit by a lightning bolt
  zap() {
    this.sparkle("#bff4ff");
    this.sparkle("#c792ff");
    this.flash = 0.8;
    this.showHit("ZAPPED!", "#bff4ff");
    Sound.play("zapped");
    this.die();
  }

  // A blue spore: jumps start faster, so they go SPORES.jump times as high
  jumpBoost() {
    return this.spores.blue > 0 ? Math.sqrt(SPORES.jump) : 1;
  }

  showHit(text, color) {
    this.hitText = text;
    this.hitColor = color;
    this.hitTextTime = 1;
  }

  burnUp() {
    if (!this.caught) Sound.play("caught");
    if (!this.dead) this.burst();
    this.caught = true;
  }

  // ---- Particles ----

  burst() {
    const colors = [this.palette.c, this.palette.c, this.palette.s, this.palette.p];
    for (let i = 0; i < 16; i++) {
      this.particles.push({
        x: this.x + HITBOX_W / 2,
        y: this.y + HITBOX_H / 2,
        vx: (Math.random() - 0.5) * 160,
        vy: -30 - Math.random() * 140,
        life: 0.6 + Math.random() * 0.4,
        size: Math.random() < 0.5 ? 1 : 2,
        color: colors[i % colors.length],
      });
    }
  }

  // Use a wind dash orb's power: whoosh the way you're facing
  windDash() {
    this.windDir = this.facing;
    this.windTime = WIND.time;
    this.jumpBuffer = 0;
    this.sparkle("#ffffff");
    Sound.play("windDash");
  }

  sparkle(color) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: this.x + HITBOX_W / 2,
        y: this.y + HITBOX_H / 2,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        life: 0.4,
        size: 1,
        color,
        floaty: true,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      if (!p.floaty) p.vy += 500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }
}
