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
      drawRunner(player, camX);
    }
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
      b.drawImage(sprites.orb, sx, o.y + bob);
    }
  }

  function drawRunner(p, camX) {
    const frames = sprites.runners[p.palette.name];
    let frame = frames.idle;
    if (!p.onGround) frame = frames.jump;
    else if (Math.abs(p.vx) > 10) frame = [frames.run1, frames.idle, frames.run2, frames.idle][Math.floor(p.animDist / 6) % 4];

    const x = Math.round(p.x - camX) - 1;
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

      const mid = top + viewH / 2;
      if (p.caught) text(ctx, "CAUGHT!", W / 2, mid, "#ff4d3d", 24, "center");
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
