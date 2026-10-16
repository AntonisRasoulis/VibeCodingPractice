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
    this.power = null;       // stored power for S / Down: "zap" or "hand" (newest replaces old)
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
    this.snowballs = [];          // snowballs rolling at this player
    this.snowballStarted = new Set();
    this.onIce = false;
    this.biome = null;            // the biome we're in, to notice when it changes
    this.biomeBanner = 0;         // seconds left showing the new biome's name
    this.particles = [];
  }

  // How far along the course this player counts as being (for the fire).
  // While dead, that's where they will respawn.
  get trackX() {
    return this.dead ? this.respawnX : this.x;
  }

  update(dt, input, level) {
    this.updateParticles(dt);
    this.updateFallingPlatforms(dt);
    this.updateSnow(dt, level);
    if (this.biomeBanner > 0) this.biomeBanner -= dt;
    if (this.blink > 0) this.blink -= dt;
    if (this.flash > 0) this.flash -= dt * 2;
    if (this.hitTextTime > 0) this.hitTextTime -= dt;
    if (this.caught) return;
    if (this.held) return; // being carried by a hand

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

    // Running
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      let accel = this.onGround ? (this.onIce ? SNOW.iceAccel : PHYSICS.groundAccel) : PHYSICS.airAccel;
      if (Math.sign(this.vx) === -dir) accel *= 2; // turn around quickly
      this.vx = clamp(this.vx + dir * accel * dt, -PHYSICS.runSpeed, PHYSICS.runSpeed);
      this.facing = dir;
    } else if (this.onGround) {
      this.vx = approach(this.vx, 0, (this.onIce ? SNOW.iceFriction : PHYSICS.friction) * dt); // ice: you keep sliding
    }

    // Jumping
    this.coyote = this.onGround ? PHYSICS.coyoteTime : this.coyote - dt;
    this.jumpBuffer = input.jumpPressed ? PHYSICS.jumpBuffer : this.jumpBuffer - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -PHYSICS.jumpSpeed;
      this.jumpBuffer = 0;
      this.coyote = 0;
      Sound.play("jump");
    }
    const minRise = -PHYSICS.jumpSpeed * PHYSICS.jumpCut;
    // (a thrown player isn't holding jump, so don't cut their throw short)
    if (!input.jump && this.vy < minRise && this.stun <= 0) this.vy = minRise;

    // Ride moving platforms
    if (this.standingOn && this.vy >= 0) this.moveX(this.standingOn.dx, level);

    // Gravity and movement
    this.vy = Math.min(this.vy + PHYSICS.gravity * dt, PHYSICS.maxFall);
    this.moveX(this.vx * dt, level);
    const prevBottom = this.y + HITBOX_H;
    const wasOnGround = this.onGround;
    const fallSpeed = this.vy;
    this.onGround = false;
    this.standingOn = null;
    this.moveY(this.vy * dt, level);
    if (this.vy >= 0) this.landOnPlatforms(level, prevBottom);
    this.onIce = this.onGround && !this.standingOn && level.isIce(Math.floor((this.x + HITBOX_W / 2) / TILE));
    if (this.onGround && !wasOnGround && fallSpeed > 120) Sound.play(this.onIce ? "iceLand" : "land");

    this.checkHazards(level);
    if (this.dead) return;
    this.checkPortals(level);

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
      for (let r = r0; r <= r1; r++) {
        // Spikes only hurt in their pointy part, not the whole tile.
        // Ice spikes (in the snow) are taller and a little thinner.
        if (level.tile(c, r) === T_SPIKE) {
          const icy = level.biomeAt(c) === "snow";
          if (icy ? overlaps(this.x, this.y, HITBOX_W, HITBOX_H, c * TILE + 1.5, r * TILE + 1, 5, 7)
                  : overlaps(this.x, this.y, HITBOX_W, HITBOX_H, c * TILE + 1, r * TILE + 3, 6, 5)) {
            return this.die();
          }
        }
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

    // Flying spikes from shooters
    for (const s of level.shooters) {
      if (Math.abs(s.x - cx) > SHOOTER.range + 16) continue;
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
    // Never respawn somewhere a mace can swing through
    for (const m of level.maces) if (Math.abs(m.x - this.x) < level.maceReach(m)) return;
    // ...or where a shooter's spikes can reach
    for (const s of level.shooters) if (Math.abs(s.x - this.x) < SHOOTER.range * Math.SQRT1_2 + 12) return;
    // ...or just before icicles (they'd drop the moment you came back)
    for (const ic of level.icicles) if (ic.x - this.x > -10 && ic.x - this.x < SNOW.icicleTrigger + 16) return;
    this.safeSpots.push({ x: this.x, y: this.y });
    if (this.safeSpots.length > 300) this.safeSpots.shift();
  }

  die() {
    if (this.dead) return;
    this.held = false;
    this.stun = 0;
    this.spin = 0;
    this.dashHold = 0;
    this.dashTime = 0;
    this.windTime = 0;
    this.dead = true;
    this.deadTimer = DEATH.respawnDelay;
    this.burst();
    Sound.play("die");

    // Come back at the most recent safe spot a little behind where we died
    const target = this.x - DEATH.respawnBehind;
    let spot = this.safeSpots[0];
    for (const s of this.safeSpots) if (s.x <= target) spot = s;
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
