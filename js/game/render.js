// Drawing. The game is drawn small (pixel-art size) onto a hidden canvas,
// then enlarged onto the real canvas so the pixels stay sharp. Text is drawn
// after enlarging so it stays crisp too.

const Renderer = (() => {
  const BUFFER_H = VIEW_H * 2 + DIVIDER;
  const PIXEL_FONT = '"Press Start 2P", monospace';
  const cams = [0, 0];
  let sprites, buffer, b;

  function init() {
    sprites = buildSprites();
    buffer = makeCanvas(VIEW_W, BUFFER_H);
    b = buffer.getContext("2d");
  }

  function resetCameras(x) {
    cams[0] = cams[1] = x - VIEW_W * 0.35;
  }

  function swapCameras() {
    [cams[0], cams[1]] = [cams[1], cams[0]];
  }

  function render(ctx, world, dt) {
    for (let i = 0; i < 2; i++) {
      const p = world.players[i];
      const target = p.x - VIEW_W * 0.35;
      cams[i] += (target - cams[i]) * Math.min(1, dt * 6);
      const camX = Math.round(Math.max(-8, cams[i]));

      b.save();
      b.translate(0, i * (VIEW_H + DIVIDER));
      b.beginPath();
      b.rect(0, 0, VIEW_W, VIEW_H);
      b.clip();
      drawView(world, p, world.players[1 - i], camX);
      b.restore();
    }
    b.fillStyle = "#1b1b2f";
    b.fillRect(0, VIEW_H, VIEW_W, DIVIDER);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buffer, 0, 0, VIEW_W * SCALE, BUFFER_H * SCALE);
    drawText(ctx, world);
  }

  // ---- One player's half of the screen ----

  function drawView(world, player, other, camX) {
    drawBackground(camX);
    drawTiles(world.level, camX);
    drawPlatforms(world.level, player, camX, world.time);
    drawPortals(world.level, camX, world.time);
    drawOrbs(world.level, camX, world.time);

    if (!other.dead && !other.caught) {
      b.globalAlpha = 0.35; // the other runner shows as a ghost
      drawRunner(other, camX);
      b.globalAlpha = 1;
    }
    if (!player.dead && !player.caught && !(player.blink > 0 && Math.floor(player.blink * 12) % 2)) {
      drawDashEffects(player, camX, world.time);
      drawRunner(player, camX);
      if (player.frozen > 0) drawIce(player, camX);
    }
    drawMaces(world.level, camX, world.time);
    drawShooters(world.level, camX, world.time);
    if (player.hasZap && !player.dead) drawCrackle(player, camX, world.time);
    for (const bolt of world.bolts) drawBolt(bolt, world.level, camX, world.time);
    drawBoltWarnings(world, player, camX);
    drawParticles(player, camX);
    drawFire(world.fire, player, camX, world.time);
  }

  function drawBackground(camX) {
    b.fillStyle = "#b5e6ff";
    b.fillRect(0, 0, VIEW_W, VIEW_H);
    b.fillStyle = "#8fd6ff";
    b.fillRect(0, 0, VIEW_W, 70);
    b.fillStyle = "#6ec6f5";
    b.fillRect(0, 0, VIEW_W, 30);

    // Clouds drift slowly (parallax): they move at 1/5 of the camera speed
    const cloudCam = camX * 0.2;
    const first = Math.floor(cloudCam / 120) - 1;
    for (let k = first; k < first + 6; k++) {
      const x = k * 120 + hash(k, 1) * 60 - cloudCam;
      const y = 6 + Math.floor(hash(k, 2) * 30);
      b.drawImage(sprites.cloud, Math.round(x), y);
    }

    drawHills(camX * 0.35, 78, 10, "#9fdba0", 0.021);
    drawHills(camX * 0.6, 92, 8, "#7cc77a", 0.033);
  }

  function drawHills(offset, base, height, color, freq) {
    b.fillStyle = color;
    for (let x = 0; x < VIEW_W; x += 2) {
      const wx = x + offset;
      const h = base - height * (Math.sin(wx * freq) * 0.6 + Math.sin(wx * freq * 2.3 + 1) * 0.4);
      b.fillRect(x, Math.round(h), 2, VIEW_H);
    }
  }

  function drawTiles(level, camX) {
    const firstCol = Math.floor(camX / TILE);
    for (let c = firstCol; c <= firstCol + VIEW_W / TILE + 1; c++) {
      const sx = c * TILE - camX;
      for (let r = 0; r < ROWS; r++) {
        const t = level.tile(c, r);
        const sy = r * TILE;
        if (t === T_SPIKE) {
          b.drawImage(sprites.spike, sx, sy);
        } else if (t === T_GROUND) {
          const variant = Math.floor(hash(c, r) * 4);
          const above = level.tile(c, r - 1);
          if (above === T_GROUND) {
            b.drawImage(sprites.dirt[variant], sx, sy);
          } else {
            b.drawImage(sprites.grass[variant], sx, sy);
            if (above === T_EMPTY) drawDecoration(c, sx, sy);
          }
        }
      }
    }
  }

  // Flowers and grass tufts on the prairie
  function drawDecoration(c, sx, sy) {
    const n = hash(c, 99);
    if (n < 0.15) {
      const colors = ["#feae34", "#ffffff", "#f6757a", "#c283ff"];
      const fx = sx + 1 + Math.floor(hash(c, 5) * 5);
      b.fillStyle = "#3e8948";
      b.fillRect(fx, sy - 2, 1, 2);
      b.fillStyle = colors[Math.floor(hash(c, 7) * colors.length)];
      b.fillRect(fx - 1, sy - 3, 3, 1);
      b.fillRect(fx, sy - 4, 1, 1);
    } else if (n < 0.4) {
      const fx = sx + Math.floor(hash(c, 3) * 6);
      b.fillStyle = "#63c74d";
      b.fillRect(fx, sy - 1, 1, 1);
      b.fillRect(fx + 2, sy - 2, 1, 2);
    }
  }

  function drawPlatforms(level, player, camX, time) {
    for (const p of level.platforms) {
      const sx = Math.round(p.x - camX);
      if (sx > VIEW_W || sx + p.w < 0) continue;

      let y = p.y;
      let shake = 0;
      if (p.kind === "fall") {
        const top = player.platformTop(p);
        if (top === null) continue;
        y = top;
        const s = player.fallState.get(p.id);
        if (s && s.t < FALLING.shakeTime) shake = Math.floor(time * 40) % 2 ? 1 : -1;
      }
      const colors = {
        static: ["#e8b37a", "#a0663a", "#6e4325"],
        move: ["#dfe9f2", "#7a8fa6", "#4d5d70"],
        fall: ["#f0d29a", "#c9a26b", "#7a5a2a"],
      }[p.kind];
      const x = sx + shake;
      const sy = Math.round(y);

      b.fillStyle = colors[1];
      b.fillRect(x, sy, p.w, 5);
      b.fillStyle = colors[0];
      b.fillRect(x, sy, p.w, 1);
      b.fillStyle = colors[2];
      b.fillRect(x, sy + 4, p.w, 1);
      for (let px = 0; px < p.w; px += 8) {
        if (p.kind === "static") b.fillRect(x + px, sy + 1, 1, 3);     // plank edges
        if (p.kind === "move") b.fillRect(x + px + 2, sy + 2, 1, 1);   // rivets
        if (p.kind === "fall") {                                       // cracks
          b.fillRect(x + px + 3, sy + 1, 1, 2);
          b.fillRect(x + px + 4, sy + 3, 1, 1);
        }
      }
    }
  }

  function drawPortal(x, y, outer, inner, time) {
    for (let r = 0; r < 16; r++) {
      const half = Math.round(4 * Math.sqrt(1 - ((r - 7.5) / 8) ** 2));
      b.fillStyle = outer;
      b.fillRect(x + 4 - half, y + r, half * 2, 1);
      if (half > 1) {
        b.fillStyle = "#1b2a4a";
        b.fillRect(x + 5 - half, y + r, half * 2 - 2, 1);
      }
    }
    b.fillStyle = inner;
    for (let k = 0; k < 3; k++) {
      const sy = (Math.floor(time * 20) + k * 5) % 12;
      b.fillRect(x + 3 + (k % 2), y + 2 + sy, 1, 1);
    }
  }

  function drawPortals(level, camX, time) {
    for (const p of level.portals) {
      const sx = Math.round(p.x - camX);
      if (sx > -10 && sx < VIEW_W) drawPortal(sx, p.y, "#3fa9f5", "#a6e1ff", time);
    }
    for (const e of level.exits) {
      const sx = Math.round(e.x - camX);
      if (sx > -10 && sx < VIEW_W) drawPortal(sx, e.y, "#ff8c1a", "#ffd27a", time);
    }
  }

  function drawOrbs(level, camX, time) {
    for (const o of level.orbs) {
      if (o.used) continue;
      const sx = Math.round(o.x - camX);
      if (sx < -10 || sx > VIEW_W) continue;
      const bob = Math.round(Math.sin(time * 3 + o.x) * 1.5);
      if (Math.floor(time * 4) % 2) {
        b.fillStyle = "rgba(255, 240, 150, 0.5)";
        b.fillRect(sx - 1, o.y + bob + 1, 10, 6);
        b.fillRect(sx + 1, o.y + bob - 1, 6, 10);
      }
      const sprite = { freeze: sprites.freezeOrb, dash: sprites.dashOrb, zap: sprites.zapOrb }[o.kind] || sprites.orb;
      b.drawImage(sprite, sx, o.y + bob);
    }
  }

  // Charging glow while hanging before a dash, and after-images + speed lines during it
  function drawDashEffects(p, camX, time) {
    const x = Math.round(p.x - camX);
    const y = Math.round(p.y);
    if (p.dashHold > 0) {
      // A ring that shrinks in as the launch gets closer
      const r = 3 + Math.round(10 * (p.dashHold / DASH.hold));
      b.fillStyle = "rgba(255, 210, 63, 0.8)";
      for (let k = 0; k < 8; k++) {
        const a = time * 6 + (k * Math.PI) / 4;
        b.fillRect(Math.round(x + 3 + Math.cos(a) * r), Math.round(y + 5 + Math.sin(a) * r), 1, 1);
      }
    } else if (p.dashTime > 0) {
      const frame = sprites.runners[p.palette.name].jump;
      for (let k = 3; k >= 1; k--) {
        b.globalAlpha = 0.12 * (4 - k);
        b.drawImage(frame, x - 1 - k * 7, y - 1);
      }
      b.globalAlpha = 1;
      b.fillStyle = "rgba(255, 255, 255, 0.8)";
      for (let k = 0; k < 4; k++) {
        const ly = y + 1 + ((k * 3 + Math.floor(time * 30)) % 10);
        b.fillRect(x - 30 + ((k * 11) % 12), ly, 10, 1);
      }
    }
  }

  // ---- Spike shooters ----

  function drawShooters(level, camX, time) {
    for (const s of level.shooters) {
      const sx = s.x - camX;
      if (sx < -SHOOTER.range - 8 || sx > VIEW_W + SHOOTER.range + 8) continue;
      for (const spike of level.shooterSpikes(s, time)) drawFlyingSpike(spike.x - camX, spike.y, spike.dx, spike.dy);
      drawShooterBlock(s, Math.round(sx), level.shooterCharge(s, time), time);
    }
  }

  // A stone block with a nozzle on each corner and a core that glows red before it fires
  function drawShooterBlock(s, cx, charge, time) {
    const shake = charge > 0.3 ? (Math.floor(time * 50) % 2 ? 1 : -1) : 0;
    const x = cx - 4 + shake;
    const y = s.row * TILE;
    b.fillStyle = "#3a3d44";
    b.fillRect(x, y, 8, 8);
    b.fillStyle = "#6b707a";
    b.fillRect(x + 1, y + 1, 6, 6);
    b.fillStyle = "#8a8f99";
    b.fillRect(x + 1, y + 1, 6, 1);
    b.fillRect(x + 1, y + 1, 1, 6);
    // nozzles poking out of each corner
    b.fillStyle = "#cfd4dc";
    for (const [dx, dy] of SHOOTER_DIRS) b.fillRect(x + (dx > 0 ? 7 : 0) + dx, y + (dy > 0 ? 7 : 0) + dy, 1, 1);
    // core: dark red at rest, glowing orange-red while charging
    const glow = Math.round(80 + 175 * charge);
    b.fillStyle = `rgb(${glow}, ${Math.round(30 + 90 * charge)}, 30)`;
    b.fillRect(x + 3, y + 3, 2, 2);
    if (charge > 0) {
      b.fillStyle = `rgba(255, 120, 40, ${0.35 * charge})`;
      b.fillRect(x - 2, y - 2, 12, 12);
    }
  }

  // A metal spike flying diagonally: a 2-pixel-thick shaft with a dark edge and a bright point
  function drawFlyingSpike(x, y, dx, dy) {
    const tx = Math.round(x);
    const ty = Math.round(y);
    for (let k = 5; k >= 1; k--) {
      b.fillStyle = "#3a3d44"; // dark edge so it shows against the sky and the grass
      b.fillRect(tx - k * dx, ty - (k - 1) * dy, 1, 1);
      b.fillStyle = k > 3 ? "#7d828c" : "#b8bdc6";
      b.fillRect(tx - k * dx, ty - k * dy, 1, 1);
    }
    b.fillStyle = "#ffffff";
    b.fillRect(tx, ty, 1, 1);
  }

  // ---- Lightning ----

  // The bolt is redrawn with a new random zigzag 25 times a second so it crackles.
  // hash() keeps the shape the same in both halves of the screen at the same moment.
  function drawBolt(bolt, level, camX, time) {
    const tail = bolt.x - bolt.dir * ZAP.length;
    const left = Math.min(tail, bolt.x) - camX;
    if (left > VIEW_W + 4 || left + ZAP.length < -4) return; // not in this view
    const tick = Math.floor(time * 25);

    // Points along the bolt, following the ground, each nudged up or down at random
    const pts = [];
    for (let k = 0; k <= ZAP.length; k += 4) {
      const wx = bolt.x - bolt.dir * k;
      const ground = level.groundTop(wx);
      const baseY = ground === null ? bolt.y : ground - ZAP.height;
      const jitter = k === 0 ? 0 : Math.round((hash(bolt.id * 31 + k, tick) - 0.5) * 7);
      pts.push({ x: Math.round(wx - camX), y: Math.round(baseY) + jitter });
    }
    const fade = Math.max(0, 1 - bolt.traveled / ZAP.range);

    // Deep purple edge (so it stands out against the sky), electric blue glow, white-hot core
    pixelPath(pts, `rgba(70, 30, 160, ${0.6 * fade})`, 2);
    pixelPath(pts, `rgba(40, 170, 255, ${0.95 * fade})`, 1);
    pixelPath(pts, Math.floor(time * 30) % 3 ? "#ffffff" : "#d8f6ff", 0);

    // Two little forks branching off
    for (let f = 0; f < 2; f++) {
      const p = pts[1 + Math.floor(hash(bolt.id + f * 7, tick) * (pts.length - 2))];
      const up = hash(bolt.id + f, tick + 3) < 0.5 ? -1 : 1;
      const back = -bolt.dir;
      const fork = [p, { x: p.x + back * 3, y: p.y + up * 3 }, { x: p.x + back * 5, y: p.y + up * 6 }];
      pixelPath(fork, `rgba(40, 170, 255, ${0.9 * fade})`, 0);
    }

    // Blazing head with sparks flying off it
    const head = pts[0];
    b.fillStyle = `rgba(70, 30, 160, ${0.45 * fade})`;
    b.fillRect(head.x - 4, head.y - 4, 9, 9);
    b.fillStyle = `rgba(40, 170, 255, ${0.8 * fade})`;
    b.fillRect(head.x - 2, head.y - 2, 5, 5);
    b.fillStyle = "#ffffff";
    b.fillRect(head.x - 1, head.y - 1, 3, 3);
    for (let s = 0; s < 4; s++) {
      const sx = head.x + Math.round((hash(bolt.id + s * 3, tick) - 0.5) * 12);
      const sy = head.y + Math.round((hash(bolt.id + s * 5, tick + 1) - 0.5) * 10);
      b.fillStyle = s % 2 ? "#fff27a" : "#28aaff";
      b.fillRect(sx, sy, 1, 1);
    }
  }

  // Draws a pixel-sharp line through the points; `thick` adds rows above and below
  function pixelPath(pts, color, thick) {
    b.fillStyle = color;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const c = pts[i];
      const steps = Math.max(Math.abs(c.x - a.x), Math.abs(c.y - a.y), 1);
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(a.x + ((c.x - a.x) * s) / steps);
        const y = Math.round(a.y + ((c.y - a.y) * s) / steps);
        b.fillRect(x, y - thick, 1, 1 + thick * 2);
      }
    }
  }

  // Flashing warning at the edge of the screen when a bolt is coming at you from off-screen
  function drawBoltWarnings(world, player, camX) {
    if (Math.floor(world.time * 8) % 2) return;
    for (const bolt of world.bolts) {
      if (world.players[bolt.owner] === player) continue;
      const sx = bolt.x - camX;
      const coming = (bolt.dir > 0 && sx < 0 && sx > -260) || (bolt.dir < 0 && sx > VIEW_W && sx < VIEW_W + 260);
      if (!coming) continue;
      const y = Math.round(Math.min(VIEW_H - 8, Math.max(8, bolt.y)));
      const x = bolt.dir > 0 ? 2 : VIEW_W - 9;
      // a little lightning symbol
      b.fillStyle = "#ffd23f";
      [[4, -4], [3, -3], [2, -2], [3, -1], [4, -1], [5, -1], [4, 0], [3, 1], [2, 2]].forEach(([dx, dy]) =>
        b.fillRect(x + (bolt.dir > 0 ? dx : 7 - dx), y + dy, 1, 1));
      b.fillStyle = "rgba(255, 210, 63, 0.35)";
      b.fillRect(bolt.dir > 0 ? 0 : VIEW_W - 3, y - 6, 3, 12);
    }
  }

  // Little sparks dancing around a runner who is holding a lightning shot
  function drawCrackle(p, camX, time) {
    const tick = Math.floor(time * 20);
    const cx = Math.round(p.x - camX) + HITBOX_W / 2;
    const cy = Math.round(p.y) + HITBOX_H / 2;
    for (let k = 0; k < 4; k++) {
      const a = hash(k, tick) * Math.PI * 2;
      const r = 6 + hash(k + 9, tick) * 3;
      b.fillStyle = ["#ffffff", "#28aaff", "#5a2bd0", "#28aaff"][k];
      b.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
  }

  // A block of ice around a frozen runner, with a bar showing how long is left
  function drawIce(p, camX) {
    const x = Math.round(p.x - camX) - 2;
    const y = Math.round(p.y) - 2;
    b.fillStyle = "rgba(170, 225, 255, 0.55)";
    b.fillRect(x, y, HITBOX_W + 4, HITBOX_H + 3);
    b.fillStyle = "#e8f8ff";
    b.fillRect(x, y, HITBOX_W + 4, 1);
    b.fillRect(x, y, 1, HITBOX_H + 3);
    b.fillRect(x + 2, y + 2, 1, 3);
    b.fillStyle = "#6cc4f0";
    b.fillRect(x + HITBOX_W + 3, y + 1, 1, HITBOX_H + 2);
    b.fillRect(x + 1, y + HITBOX_H + 2, HITBOX_W + 3, 1);
    // time left
    const w = Math.ceil((HITBOX_W + 4) * (p.frozen / FREEZE_TIME));
    b.fillStyle = "#1b2a4a";
    b.fillRect(x, y - 3, HITBOX_W + 4, 2);
    b.fillStyle = "#a6e1ff";
    b.fillRect(x, y - 3, w, 2);
  }

  // ---- Swinging maces ----

  function drawMaces(level, camX, time) {
    for (const m of level.maces) {
      const sx = m.x - camX;
      if (sx < -m.length - 10 || sx > VIEW_W + m.length + 10) continue;
      const now = level.macePoints(m, time);

      // Bolt in the sky the chain hangs from
      b.fillStyle = "#3a3d44";
      b.fillRect(Math.round(sx) - 3, m.y - 5, 7, 5);
      b.fillStyle = "#8a8f99";
      b.fillRect(Math.round(sx) - 2, m.y - 4, 5, 3);
      b.fillStyle = "#cfd4dc";
      b.fillRect(Math.round(sx) - 1, m.y - 4, 2, 1);

      // Chain: alternating light and dark links
      now.links.slice(0, -1).forEach((p, i) => {
        b.fillStyle = i % 2 ? "#5c616b" : "#9aa0aa";
        b.fillRect(Math.round(p.x - camX) - 1, Math.round(p.y) - 1, 2, 2);
      });

      // Faint after-images when it's swinging fast, so the swing reads as motion
      if (now.speed > 0.5) {
        for (const [delay, alpha] of [[0.06, 0.18], [0.03, 0.3]]) {
          const ghost = level.macePoints(m, time - delay);
          b.globalAlpha = alpha * now.speed;
          drawMaceBall(ghost.ball.x - camX, ghost.ball.y, ghost.spin);
        }
        b.globalAlpha = 1;
      }
      drawMaceBall(now.ball.x - camX, now.ball.y, now.spin);
    }
  }

  // A grey ball covered in spikes, rotated by `spin`
  function drawMaceBall(cx, cy, spin) {
    const x0 = Math.round(cx);
    const y0 = Math.round(cy);

    // Spikes all the way around, drawn first so the ball sits on top of their bases
    for (let k = 0; k < 8; k++) {
      const a = spin + (k * Math.PI * 2) / 8;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      // Wide dark base, narrowing to a bright point
      b.fillStyle = "#3a3d44";
      b.fillRect(Math.round(x0 + dx * 4.5 - 1), Math.round(y0 + dy * 4.5 - 1), 2, 2);
      b.fillStyle = "#5c616b";
      b.fillRect(Math.round(x0 + dx * 5.6), Math.round(y0 + dy * 5.6), 1, 1);
      b.fillRect(Math.round(x0 + dx * 6.4), Math.round(y0 + dy * 6.4), 1, 1);
      b.fillStyle = "#b8bdc6";
      b.fillRect(Math.round(x0 + dx * 7.3), Math.round(y0 + dy * 7.3), 1, 1);
    }

    // The ball: outline, body, light from the top-left, shadow bottom-right
    for (let y = -4; y <= 4; y++) {
      for (let x = -4; x <= 4; x++) {
        const d = x * x + y * y;
        if (d > 19) continue;
        if (d > 13) b.fillStyle = "#3a3d44";
        else if (x + y <= -3) b.fillStyle = "#cfd4dc";
        else if (x + y >= 3) b.fillStyle = "#6b707a";
        else b.fillStyle = "#9aa0aa";
        b.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
    // Studs on the ball's face that turn with the spin, so you can see it rotating
    b.fillStyle = "#e8ebef";
    for (let k = 0; k < 3; k++) {
      const a = spin * 1.0 + (k * Math.PI * 2) / 3;
      b.fillRect(Math.round(x0 + Math.cos(a) * 2), Math.round(y0 + Math.sin(a) * 2), 1, 1);
    }
  }

  function drawRunner(p, camX) {
    const frames = sprites.runners[p.palette.name];
    let frame = frames.idle;
    if (!p.onGround) frame = frames.jump;
    else if (Math.abs(p.vx) > 10) frame = [frames.run1, frames.idle, frames.run2, frames.idle][Math.floor(p.animDist / 6) % 4];

    const shake = p.dashHold > 0 ? Math.round(Math.sin(p.dashHold * 90)) : 0; // trembling before a dash
    const x = Math.round(p.x - camX) - 1 + shake;
    const y = Math.round(p.y) - 1;
    if (p.facing < 0) {
      b.save();
      b.translate(x + 8, y);
      b.scale(-1, 1);
      b.drawImage(frame, 0, 0);
      b.restore();
    } else {
      b.drawImage(frame, x, y);
    }
  }

  function drawParticles(p, camX) {
    for (const q of p.particles) {
      b.fillStyle = q.color;
      b.fillRect(Math.round(q.x - camX), Math.round(q.y), q.size, q.size);
    }
  }

  // The wall of fire, with wavy flickering flames along its front edge
  function drawFire(fire, player, camX, time) {
    const front = fire.x - camX;
    const gap = player.trackX - fire.x;

    // Red glow at the left edge when the fire is close behind
    if (gap < 140) {
      const strength = 1 - Math.max(0, gap) / 140;
      for (let i = 0; i < 6; i++) {
        b.fillStyle = `rgba(230, 60, 20, ${0.08 * strength})`;
        b.fillRect(0, 0, 8 + i * 6, VIEW_H);
      }
    }
    if (front < -12) return;

    for (let y = 0; y < VIEW_H; y += 2) {
      const wave = Math.sin(y * 0.3 + time * 9) * 3 + Math.sin(y * 0.11 - time * 5) * 4;
      const edge = Math.round(front + wave);
      b.fillStyle = "#7a1a12";
      b.fillRect(0, y, edge - 12, 2);
      b.fillStyle = "#d1361e";
      b.fillRect(edge - 12, y, 6, 2);
      b.fillStyle = "#f77f00";
      b.fillRect(edge - 6, y, 4, 2);
      b.fillStyle = "#fcbf49";
      b.fillRect(edge - 2, y, 2, 2);
    }
    // Embers floating ahead of the flames
    b.fillStyle = "#ffd166";
    for (let k = 0; k < 14; k++) {
      const ex = front + ((k * 13) % 18) + Math.sin(time * 4 + k) * 3;
      const ey = VIEW_H - ((time * 35 + k * 29) % VIEW_H);
      b.fillRect(Math.round(ex), Math.round(ey), 1, 1);
    }
  }

  // ---- Text, drawn at full size ----

  function text(ctx, str, x, y, color, size, align = "left") {
    ctx.font = `${size}px ${PIXEL_FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillText(str, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawText(ctx, world) {
    const W = VIEW_W * SCALE;
    const viewH = VIEW_H * SCALE;

    world.players.forEach((p, i) => {
      const top = i * (VIEW_H + DIVIDER) * SCALE;
      const meters = Math.max(0, Math.floor(p.trackX / TILE));
      const gap = Math.max(0, Math.floor((p.trackX - world.fire.x) / TILE));
      const gapColor = gap < 10 ? "#ff4d3d" : gap < 25 ? "#ffb347" : "#ffffff";
      text(ctx, `${p.name} ${meters}m`, 12, top + 16, p.palette.c, 12);
      text(ctx, `FIRE ${gap}m`, W - 12, top + 16, gapColor, 12, "right");
      if (p.hasZap) {
        const key = i === 0 ? "S" : "DOWN";
        const arrow = p.facing > 0 ? ">>" : "<<"; // follows the way you're facing
        text(ctx, `ZAP ${arrow} press ${key}`, 12, top + 36, "#fff27a", 10);
      }
      if (p.flash > 0) {
        ctx.fillStyle = `rgba(220, 245, 255, ${Math.min(1, p.flash) * 0.45})`;
        ctx.fillRect(0, top, W, viewH);
      }

      const mid = top + viewH / 2;
      if (p.caught) text(ctx, "CAUGHT!", W / 2, mid, "#ff4d3d", 24, "center");
      else if (p.zappedText > 0) text(ctx, "ZAPPED!", W / 2, mid, "#bff4ff", 24, "center");
      else if (p.frozen > FREEZE_TIME - 0.8) text(ctx, "FROZEN!", W / 2, mid, "#a6e1ff", 24, "center");
      else if (p.dashHold > 0 || p.dashTime > 0) text(ctx, "DASH!", W / 2, mid, "#ffd23f", 24, "center");
      else if (world.swapFlash > 0) text(ctx, "SWAP!", W / 2, mid, "#ffd23f", 24, "center");
    });

    if (world.swapFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${world.swapFlash * 0.5})`;
      ctx.fillRect(0, 0, W, (VIEW_H * 2 + DIVIDER) * SCALE);
    }

    const center = (VIEW_H + DIVIDER / 2) * SCALE;
    if (world.state === "countdown") {
      text(ctx, String(Math.ceil(world.countdown)), W / 2, center, "#ffffff", 40, "center");
    } else if (world.state === "playing" && world.time < 0.6) {
      text(ctx, "GO!", W / 2, center, "#ffffff", 40, "center");
    } else if (world.state === "paused") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, W, (VIEW_H * 2 + DIVIDER) * SCALE);
      text(ctx, "PAUSED", W / 2, center, "#ffffff", 28, "center");
    }
  }

  return { init, render, resetCameras, swapCameras };
})();
