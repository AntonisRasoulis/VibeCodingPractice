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
    b.imageSmoothingEnabled = false; // keep rotated sprites (the hand) pixel-sharp
  }

  function resetCameras(x) {
    cams[0] = cams[1] = x - VIEW_W * 0.35;
  }

  function swapCameras() {
    [cams[0], cams[1]] = [cams[1], cams[0]];
  }

  function render(ctx, world, dt) {
    for (let i = 0; i < world.players.length; i++) {
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
    const height = world.players.length === 1 ? VIEW_H : BUFFER_H; // 1 player: just the one view
    if (world.players.length > 1) {
      b.fillStyle = "#1b1b2f";
      b.fillRect(0, VIEW_H, VIEW_W, DIVIDER);
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buffer, 0, 0, VIEW_W, height, 0, 0, VIEW_W * SCALE, height * SCALE);
    drawText(ctx, world);
  }

  // ---- One player's half of the screen ----

  function drawView(world, player, other, camX) {
    // Each biome's scenery, faded together near a border
    const mix = biomeMix(world.level, camX);
    const snow = mix.snow || 0;
    const shown = Object.entries(mix).filter(([, amount]) => amount > 0).sort((a, c) => c[1] - a[1]);
    shown.forEach(([biome, amount], i) => {
      b.globalAlpha = i === 0 ? 1 : amount;
      if (biome === "snow") drawSnowBackground(camX);
      else if (biome === "desert") drawDesertBackground(camX, world.time);
      else if (biome === "jungle") drawJungleBackground(camX);
      else drawBackground(camX);
    });
    b.globalAlpha = 1;
    for (const m of world.missiles) if (m.state === "approach") drawMissile(m, world, camX); // still far away, behind the course
    drawTiles(world.level, camX);
    drawSawTracks(world.level, camX);
    drawSigns(world.level, camX);
    drawIcicles(world.level, player, camX, world.time);
    drawSnowballs(player, camX);
    drawTumbleweeds(player, camX);
    for (const bear of world.bears) drawBear(bear, camX, world.time);
    for (const v of world.vultures) drawVultureShadow(v, world.level, camX);
    drawPlatforms(world.level, player, camX, world.time);
    drawPortals(world.level, camX, world.time);
    drawOrbs(world.level, camX, world.time);
    drawTraps(world.level, player, other, camX);
    drawSinkholes(world.level, camX, world.time);
    drawPonds(world.level, world.players, camX, world.time);
    drawBushes(world.level, camX, true); // bushes torn open by a trap: behind the runners

    // (someone hiding in a bush can't be seen, on either screen)
    if (other && !other.dead && !other.caught && !other.hiddenIn) {
      b.globalAlpha = 0.35; // the other runner shows as a ghost
      drawRunner(other, camX);
      b.globalAlpha = 1;
    }
    if (!player.dead && !player.caught && !player.hiddenIn && !(player.blink > 0 && Math.floor(player.blink * 12) % 2)) {
      drawDashEffects(player, camX, world.time);
      drawRunner(player, camX);
      if (player.frozen > 0) drawIce(player, camX);
      if (player.honey > 0) drawHoney(player, camX, world.time);
    }
    for (const p of [player, other]) {
      if (!p || p.trapped <= 0 || p.dead) continue; // the jaws in front of someone's legs
      const t = world.level.traps.find((tt) => tt.id === p.trapId);
      const jolt = p.trapShake > 0 ? (p.lastWiggle > 0 ? 1 : -1) : 0; // it jerks the way you wiggle
      if (t) drawTrap(t.x - camX + jolt, world.level.groundTop(t.x) ?? p.y + HITBOX_H, t.size, "shut");
      if (!p.hiddenIn) drawWiggleHint(p, camX, world.time);
    }
    drawBushes(world.level, camX, false); // whole bushes: in front, so they hide whoever is inside
    for (const p of [player, other]) if (p && p.inSink && !p.dead) drawSinkPile(p.inSink, camX); // sand round their legs
    drawIceBlocks(world.level, camX); // anyone frozen in a pond, in their block of ice
    drawQuicksand(world.level, camX, world.time); // on top, so anyone stuck in it looks half sunk
    drawSaws(world.level, camX, world.time);
    drawMaces(world.level, camX, world.time);
    drawShooters(world.level, camX, world.time);
    if (player.power && !player.dead && !player.hiddenIn) drawCrackle(player, camX, world.time);
    for (const h of world.hands) drawHand(h, world, camX);
    for (const m of world.missiles) if (m.state !== "approach") drawMissile(m, world, camX);
    for (const bolt of world.bolts) drawBolt(bolt, world.level, camX, world.time);
    drawBoltWarnings(world, player, camX);
    for (const v of world.vultures) drawVulture(v, camX, world.time);
    for (const d of world.drones) drawDrone(d, camX, world.time);
    drawParticles(player, camX);
    if (snow > 0) drawSnowfall(camX, world.time, snow);
    drawFire(world.fire, player, camX, world.time);
  }

  // ---- Snow biome ----

  // How much of this view is in each biome (0 to 1), looking a little either side
  // of the middle of the screen, so the scenery fades smoothly at a border.
  function biomeMix(level, camX) {
    const mid = Math.floor((camX + VIEW_W / 2) / TILE);
    const mix = {};
    for (let k = -5; k <= 5; k++) {
      const biome = level.biomeAt(mid + k * 5);
      mix[biome] = (mix[biome] || 0) + 1 / 11;
    }
    return mix;
  }

  // ---- Jungle biome ----

  function drawJungleBackground(camX) {
    b.fillStyle = "#d9f0b8";
    b.fillRect(0, 0, VIEW_W, VIEW_H);
    b.fillStyle = "#b8e09a";
    b.fillRect(0, 0, VIEW_W, 60);
    b.fillStyle = "#9fd08a";
    b.fillRect(0, 0, VIEW_W, 22);
    const layer = (img, speed) => {
      const off = ((camX * speed) % img.width + img.width) % img.width;
      for (let x = -Math.round(off); x < VIEW_W; x += img.width) b.drawImage(img, x, 0);
    };
    layer(sprites.jungle.far, 0.15);
    // Sunlight slanting down through the canopy
    const fade = b.globalAlpha;
    b.globalAlpha = fade * 0.18;
    b.fillStyle = "#fff8c0";
    for (const x0 of [60, 150, 290]) {
      const x = ((x0 - camX * 0.25) % 480 + 480) % 480 - 40;
      for (let y = 20; y < 96; y += 2) b.fillRect(Math.round(x + (y - 20) * 0.5), y, 10, 2);
    }
    b.globalAlpha = fade;
    layer(sprites.jungle.mid, 0.4);
    layer(sprites.jungle.near, 0.6);
  }

  // ---- Desert biome ----

  function drawDesertBackground(camX, time) {
    b.fillStyle = "#ffd9a0";
    b.fillRect(0, 0, VIEW_W, VIEW_H);
    b.fillStyle = "#ffc27a";
    b.fillRect(0, 0, VIEW_W, 70);
    b.fillStyle = "#f7a35c";
    b.fillRect(0, 0, VIEW_W, 30);
    b.fillStyle = "#fff3c4";
    b.fillRect(330, 12, 14, 14); // the sun
    b.fillStyle = "#ffffff";
    b.fillRect(333, 15, 8, 8);

    // Red rock mesas, far away
    const far = camX * 0.2;
    const first = Math.floor(far / 140) - 1;
    for (let k = first; k < first + VIEW_W / 140 + 3; k++) {
      if (hash(k, 51) < 0.25) continue;
      const w = 40 + Math.floor(hash(k, 52) * 60);
      const h = 16 + Math.floor(hash(k, 53) * 16);
      const x = Math.round(k * 140 + hash(k, 54) * 40 - far);
      b.fillStyle = "#d98e5e";
      b.fillRect(x, 78 - h, w, h + 50);
      b.fillStyle = "#e8a575";
      b.fillRect(x, 78 - h, w, 2);
      b.fillStyle = "#c27a4e";
      b.fillRect(x, 78 - h + 6, w, 2);
    }
    // Near sand dunes
    const near = camX * 0.45;
    b.fillStyle = "#e9b878";
    for (let x = 0; x < VIEW_W; x += 2) {
      const wx = x + near;
      const h = 86 - 8 * (Math.sin(wx * 0.025) * 0.6 + Math.sin(wx * 0.061 + 2) * 0.4);
      b.fillRect(x, Math.round(h), 2, VIEW_H);
    }
    // Heat shimmering in the air (faint)
    const fade = b.globalAlpha;
    b.globalAlpha = fade * 0.3;
    b.fillStyle = "#ffffff";
    for (let k = 0; k < 7; k++) {
      const x = ((k * 61 - camX * 0.3 + Math.sin(time * 2 + k) * 4) % VIEW_W + VIEW_W) % VIEW_W;
      b.fillRect(Math.round(x), 56 + (k % 3) * 7 + Math.round(Math.sin(time * 3 + k) * 1.5), 10, 1);
    }
    b.globalAlpha = fade;
  }

  // Quicksand surfaces, swirling (drawn over anyone stuck in it)
  function drawQuicksand(level, camX, time) {
    const firstCol = Math.floor(camX / TILE);
    const frame = Math.floor(time * 4) % 4;
    for (let c = firstCol; c <= firstCol + VIEW_W / TILE + 1; c++) {
      if (!level.isQuick(c)) continue;
      const top = level.groundTop(c * TILE);
      if (top === null) continue;
      const sx = c * TILE - camX;
      b.drawImage(sprites.quicksand[frame][c % 4], sx, top);
      b.drawImage(sprites.quicksand[(frame + 2) % 4][(c + 1) % 4], sx, top + TILE);
    }
  }

  function drawTumbleweeds(player, camX) {
    const r = DESERT.tumbleR;
    for (const tw of player.tumbleweeds) {
      const sx = tw.x - camX;
      if (sx < -12 || sx > VIEW_W + 12) continue;
      if (tw.broke) {
        b.fillStyle = "#a3743f";
        const t = tw.brokeT;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          b.globalAlpha = Math.max(0, 1 - t / 0.35);
          b.fillRect(Math.round(sx + Math.cos(a) * (r + t * 30)), Math.round(tw.y + Math.sin(a) * (r + t * 30)), 2, 1);
        }
        b.globalAlpha = 1;
        continue;
      }
      drawRotated(sprites.tumbleweed, Math.round(sx), Math.round(tw.y), tw.spin, r + 0.5, r + 0.5);
      // a little dust puff each time it lands
      if (tw.base - tw.y < 1.5) {
        b.fillStyle = "#e3b673";
        b.fillRect(Math.round(sx) + r - 1, Math.round(tw.base + r), 3, 1);
      }
    }
  }

  function drawSnowBackground(camX) {
    b.fillStyle = "#dfe7ef";
    b.fillRect(0, 0, VIEW_W, VIEW_H);
    b.fillStyle = "#cbd7e4";
    b.fillRect(0, 0, VIEW_W, 70);
    b.fillStyle = "#b4c3d6";
    b.fillRect(0, 0, VIEW_W, 30);

    // Far mountains with snowy tops (move slowly)
    const far = camX * 0.2;
    for (let x = 0; x < VIEW_W; x++) {
      const wx = x + far;
      const tri = 1 - Math.abs((((wx + 40) % 110) + 110) % 110 / 55 - 1);
      const tri2 = 1 - Math.abs((((wx + 95) % 70) + 70) % 70 / 35 - 1);
      const h = Math.round(78 - Math.max(30 * tri, 20 * tri2));
      b.fillStyle = "#a8b9d2";
      b.fillRect(x, h, 1, VIEW_H - h);
      const cap = Math.round(Math.max(0, 64 - h) * 0.7);
      if (cap > 0) {
        b.fillStyle = "#f4f8fc";
        b.fillRect(x, h, 1, cap);
      }
    }

    // Near snowy hills with pine trees
    const near = camX * 0.45;
    b.fillStyle = "#e9f1f8";
    for (let x = 0; x < VIEW_W; x += 2) {
      const wx = x + near;
      const h = 84 - 7 * (Math.sin(wx * 0.03) * 0.6 + Math.sin(wx * 0.069 + 1) * 0.4);
      b.fillRect(x, Math.round(h), 2, VIEW_H);
    }
    const first = Math.floor(near / 32) - 1;
    for (let k = first; k < first + VIEW_W / 32 + 3; k++) {
      if (hash(k, 41) < 0.35) continue;
      const tree = sprites.pines[Math.floor(hash(k, 42) * sprites.pines.length)];
      const wx = k * 32 + Math.floor(hash(k, 43) * 20);
      const hill = 84 - 7 * (Math.sin(wx * 0.03) * 0.6 + Math.sin(wx * 0.069 + 1) * 0.4);
      b.drawImage(tree, Math.round(wx - near), Math.round(hill - tree.height + 3));
    }
  }

  // A bear galloping (facing the way it runs), or rearing up to swipe
  function drawBear(bear, camX, time) {
    const frames = sprites.bears[bear.kind];
    const nose = Math.round(bear.x - camX);
    if (nose < -BEAR_W - 4 || nose > VIEW_W + BEAR_W) return;
    const frame = bear.state === "swipe" ? frames[3] : frames[Math.floor(bear.anim / 9) % 3];
    const y = Math.round(bear.y - (BEAR_H - 1) - bear.lift);
    if (bear.state === "leave" || (bear.state === "regroup" && bear.facing < 0)) {
      b.save();
      b.translate(nose + 1, y);
      b.scale(-1, 1); // heading back to the left (flipped in place, so it doesn't jump when it turns)
      b.drawImage(frame, 0, 0);
      b.restore();
    } else {
      b.drawImage(frame, nose - (BEAR_W - 1), y);
    }
    if (bear.state === "swipe" && bear.kind !== "black") {
      // claw marks slashing through the air
      b.fillStyle = "#ffffff";
      const t = Math.min(1, bear.t / 0.15);
      for (let k = 0; k < 3; k++) {
        for (let i = 0; i < 8 * t; i++) b.fillRect(nose - 4 + i, y + 2 + k * 3 + Math.round(i * 0.6), 1, 1);
      }
    }
  }

  // The rescue drone: propellers spinning, red light while it's carrying someone
  function drawDrone(d, camX, time) {
    const x = Math.round(d.x - camX) - 8;
    if (x < -20 || x > VIEW_W + 4) return;
    const f = d.mode === "carry" ? sprites.drone.grab : Math.floor(time * 20) % 2 ? sprites.drone.a : sprites.drone.b;
    b.drawImage(f, x, Math.round(d.y) - 7);
  }

  // A vulture: flapping while it circles or carries you, wings tucked as it dives, spread as it skims
  function drawVulture(v, camX, time) {
    if (v.state === "wait") return;
    const x = Math.round(v.x - camX);
    if (x < -24 || x > VIEW_W + 24) return;
    const frames = sprites.vultures[v.kind];
    const flap = ["up", "glide", "down", "glide"][Math.floor(time * 10) % 4];
    const img = v.state === "diving" ? frames.dive : v.state === "skim" ? frames.glide : v.state === "circle" ? (Math.floor(time * 3) % 3 ? frames.glide : frames[flap]) : frames[flap];
    const y = Math.round(v.y) - 5;
    if (v.facing < 0) {
      b.save();
      b.translate(x + 10, y);
      b.scale(-1, 1);
      b.drawImage(img, 0, 0);
      b.restore();
    } else {
      b.drawImage(img, x - 10, y);
    }
  }

  // Its shadow on the ground while it dives and skims, to help you time your jump
  function drawVultureShadow(v, level, camX) {
    if (v.state !== "diving" && v.state !== "skim") return;
    const g = level.groundTop(v.x);
    if (g === null) return;
    const x = Math.round(v.x - camX);
    const size = Math.max(2, 8 - Math.round((g - v.y) / 10));
    b.fillStyle = "rgba(60, 30, 10, 0.35)";
    b.fillRect(x - size, g - 1, size * 2, 1);
  }

  // Honey dripping off a player who got caught by a black bear
  function drawHoney(p, camX, time) {
    const x = Math.round(p.x - camX);
    const y = Math.round(p.y);
    b.fillStyle = "#ffb627";
    b.fillRect(x - 1, y - 1, 3, 2);
    b.fillRect(x + 3, y + 3, 3, 2);
    b.fillRect(x, y + 7, 2, 2);
    b.fillStyle = "#e08a00";
    for (let k = 0; k < 3; k++) {
      const drop = ((time * 18 + k * 5) % 10);
      b.fillRect(x + 1 + k * 2, y + 4 + Math.round(drop), 1, 2);
    }
  }

  // Snowflakes drifting down and sideways, in front of everything
  function drawSnowfall(camX, time, amount) {
    b.fillStyle = "#ffffff";
    for (let k = 0; k < 60; k++) {
      const speed = 10 + hash(k, 11) * 14;
      const y = (hash(k, 12) * VIEW_H + time * speed) % VIEW_H;
      const x = ((hash(k, 13) * VIEW_W * 1.5 - camX * (0.6 + hash(k, 14) * 0.5) + Math.sin(time * 1.5 + k) * 6) % VIEW_W + VIEW_W) % VIEW_W;
      b.globalAlpha = amount * (0.55 + hash(k, 15) * 0.45);
      b.fillRect(Math.round(x), Math.round(y), hash(k, 16) < 0.25 ? 2 : 1, 1);
    }
    b.globalAlpha = 1;
  }

  function drawSigns(level, camX) {
    for (const s of level.signs) {
      const sx = Math.round(s.x - camX);
      if (sx < -24 || sx > VIEW_W) continue;
      const ground = level.groundTop(s.x + 10);
      if (ground !== null) b.drawImage(sprites.signs[s.biome], sx, ground - 22);
    }
  }

  // Icicles under snowy ledges: still, shaking, falling, or shattered (each player sees their own)
  function drawIcicles(level, player, camX, time) {
    for (const ic of level.icicles) {
      const sx = Math.round(ic.x - camX);
      if (sx < -8 || sx > VIEW_W) continue;
      const s = player.icicleState.get(ic.id);
      if (s && s.gone) {
        if (s.goneT > 0.35) continue;
        // little shards bursting out where it hit the ground
        const ground = level.groundTop(ic.x + 3) ?? VIEW_H;
        b.fillStyle = "#bfefff";
        for (let k = 0; k < 6; k++) {
          const dir = k < 3 ? -1 : 1;
          const t = s.goneT;
          b.fillRect(sx + 3 + dir * Math.round((4 + k * 3) * t * 4), Math.round(ground - 2 - (8 + k * 4) * t * 4 + 60 * t * t * 4), 1, 1);
        }
        continue;
      }
      let x = sx, y = ic.y;
      if (s) {
        if (s.t < SNOW.icicleShake) x += Math.floor(time * 40) % 2 ? 1 : -1; // shaking
        y += Math.round(s.dy);
      }
      b.drawImage(sprites.icicles[ic.len], x, y);
    }
  }

  function drawSnowballs(player, camX) {
    for (const ball of player.snowballs) {
      const sx = ball.x - camX;
      if (sx < -12 || sx > VIEW_W + 12) continue;
      if (ball.broke) {
        // a puff of snow
        b.fillStyle = "#ffffff";
        const t = ball.brokeT;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const d = ball.r + t * 30;
          b.globalAlpha = Math.max(0, 1 - t / 0.35);
          b.fillRect(Math.round(sx + Math.cos(a) * d), Math.round(ball.y + Math.sin(a) * d * 0.7), 2, 2);
        }
        b.globalAlpha = 1;
        continue;
      }
      const r = clamp(Math.round(ball.r), 2, 9);
      b.drawImage(sprites.snowballs[r - 2], Math.round(sx - r), Math.round(ball.y - r));
      // a couple of specks turning as it rolls
      b.fillStyle = "#9fb7cf";
      for (const off of [0, Math.PI]) {
        b.fillRect(Math.round(sx + Math.cos(ball.spin + off) * r * 0.55), Math.round(ball.y + Math.sin(ball.spin + off) * r * 0.55), 1, 1);
      }
    }
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
        const biome = level.biomeAt(c);
        const snowy = biome === "snow";
        if (t === T_SPIKE) {
          if (biome === "jungle") {
            const kind = level.spikeKind[c];
            if (typeof kind === "number") b.drawImage(sprites.bamboo[kind], sx + 2, sy + TILE - kind);
            else if (level.tile(c - 1, r) !== T_SPIKE || level.spikeKind[c - 1] !== "thorn") {
              // a whole thorn bush, drawn once from its first tile
              let n = 1;
              while (n < 8 && level.tile(c + n, r) === T_SPIKE && level.spikeKind[c + n] === "thorn") n++;
              const img = sprites.thorns[n - 1];
              b.drawImage(img, sx - 3, sy + TILE - img.height);
            }
          } else if (biome === "desert") {
            const h = level.cactusHeight(c);
            b.drawImage(sprites.cactus[h][Math.floor(hash(c, 78) * 3)], sx - 2, sy + TILE - h);
          } else {
            b.drawImage(snowy ? sprites.iceSpikes[Math.floor(hash(c, 77) * sprites.iceSpikes.length)] : sprites.spike, sx, sy);
          }
        } else if (t === T_GROUND && biome === "jungle") {
          const variant = Math.floor(hash(c, r) * 4);
          const above = level.tile(c, r - 1);
          b.drawImage(above === T_GROUND ? sprites.soil[variant] : sprites.mossTop[variant], sx, sy);
          if (above === T_EMPTY) drawJungleDecoration(c, sx, sy);
        } else if (t === T_GROUND && biome === "desert") {
          const variant = Math.floor(hash(c, r) * 4);
          const above = level.tile(c, r - 1);
          b.drawImage(above === T_GROUND ? sprites.sandstone[variant] : sprites.sandTop[variant], sx, sy);
          if (above === T_EMPTY && !level.isQuick(c)) drawDesertDecoration(c, sx, sy);
        } else if (t === T_GROUND) {
          const variant = Math.floor(hash(c, r) * 4);
          const above = level.tile(c, r - 1);
          if (above === T_GROUND) {
            b.drawImage((snowy ? sprites.snowDirt : sprites.dirt)[variant], sx, sy);
          } else if (snowy) {
            const surface = level.groundTop(c * TILE) === sy; // ledges in the sky are never ice
            b.drawImage(surface && level.isIce(c) ? sprites.ice[variant] : sprites.snowTop[variant], sx, sy);
            if (above === T_EMPTY && !level.isIce(c)) drawSnowDecoration(c, sx, sy);
          } else {
            b.drawImage(sprites.grass[variant], sx, sy);
            if (above === T_EMPTY) drawDecoration(c, sx, sy);
          }
        }
      }
    }
  }

  // Sprouts and little red mushrooms in the jungle
  function drawJungleDecoration(c, sx, sy) {
    const n = hash(c, 99);
    if (n < 0.25) {
      b.fillStyle = "#5fb04f";
      const fx = sx + 2 + Math.floor(hash(c, 5) * 3);
      b.fillRect(fx, sy - 1, 1, 1);
      b.fillRect(fx + 1, sy - 2, 1, 2);
      b.fillRect(fx + 2, sy - 1, 1, 1);
    } else if (n < 0.31) {
      const fx = sx + 2 + Math.floor(hash(c, 3) * 3);
      b.fillStyle = "#e8e0c8";
      b.fillRect(fx + 1, sy - 2, 1, 2);
      b.fillStyle = "#d04a3a";
      b.fillRect(fx, sy - 3, 3, 1);
    }
  }

  // Pebbles and dry grass in the desert
  function drawDesertDecoration(c, sx, sy) {
    const n = hash(c, 99);
    if (n < 0.12) {
      b.fillStyle = "#8a6a3a";
      const fx = sx + Math.floor(hash(c, 5) * 5);
      b.fillRect(fx, sy - 2, 1, 2);
      b.fillRect(fx + 2, sy - 3, 1, 3);
      b.fillRect(fx + 1, sy - 1, 1, 1);
    } else if (n < 0.22) {
      b.fillStyle = "#9c7a5a";
      b.fillRect(sx + Math.floor(hash(c, 3) * 6), sy - 1, 2, 1);
    }
  }

  // Little snow lumps and pebbles in the snow
  function drawSnowDecoration(c, sx, sy) {
    const n = hash(c, 99);
    if (n < 0.2) {
      const fx = sx + Math.floor(hash(c, 5) * 5);
      b.fillStyle = "#ffffff";
      b.fillRect(fx, sy - 1, 3, 1);
      b.fillRect(fx + 1, sy - 2, 1, 1);
    } else if (n < 0.28) {
      b.fillStyle = "#6e5f6b";
      b.fillRect(sx + Math.floor(hash(c, 3) * 6), sy - 1, 2, 1);
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
        const ability = o.kind === "zap" || o.kind === "hand" || o.kind === "wind" || o.kind === "drone";
        b.fillStyle = ability ? "rgba(170, 225, 255, 0.5)" : "rgba(255, 240, 150, 0.5)";
        b.fillRect(sx - 1, o.y + bob + 1, 10, 6);
        b.fillRect(sx + 1, o.y + bob - 1, 6, 10);
      }
      const sprite = { freeze: sprites.freezeOrb, dash: sprites.dashOrb, zap: sprites.zapOrb, hand: sprites.handOrb, wind: sprites.windOrb, drone: sprites.droneOrb }[o.kind] || sprites.orb;
      if (o.kind === "wind") drawOrbWisps(sx, o.y + bob, time + o.x);
      b.drawImage(sprite, sx, o.y + bob);
    }
  }

  // White wind wisps that keep blowing off the back of a wind dash orb
  function drawOrbWisps(sx, y, time) {
    b.fillStyle = "#ffffff";
    for (let k = 0; k < 3; k++) {
      const t = (time * 1.6 + k / 3) % 1;          // each wisp drifts left and fades
      const len = 2 + Math.round(3 * (1 - t));
      b.globalAlpha = 0.85 * (1 - t);
      b.fillRect(Math.round(sx - 1 - t * 9 - len), y + 2 + ((k * 2) % 5), len, 1);
    }
    b.globalAlpha = 1;
  }

  // Charging glow while hanging before a dash, and after-images + speed lines during it
  function drawDashEffects(p, camX, time) {
    const x = Math.round(p.x - camX);
    const y = Math.round(p.y);
    if (p.windTime > 0) {
      // Wind dash: a faint white after-image and quick gusts streaming off behind you
      const d = p.windDir;
      const back = d > 0 ? x - 1 : x + HITBOX_W + 1;   // the side the wind trails from
      const frame = sprites.runners[p.palette.name].jump;
      b.globalAlpha = 0.25;
      if (d > 0) b.drawImage(frame, x - 1 - 6, y - 1);
      else {
        b.save();
        b.translate(x + 7 + 6, y - 1);
        b.scale(-1, 1);
        b.drawImage(frame, 0, 0);
        b.restore();
      }
      b.fillStyle = "#ffffff";
      for (let k = 0; k < 5; k++) {
        const t = hash(k, Math.floor(time * 40));
        const len = 6 + Math.round(t * 10);
        b.globalAlpha = 0.5 + 0.4 * t;
        const ly = y + 1 + ((k * 7 + Math.floor(time * 60)) % 11);
        b.fillRect(d > 0 ? back - len - Math.round(t * 4) : back + Math.round(t * 4), ly, len, 1);
      }
      // little curls at the tips of the gust
      b.globalAlpha = 0.7;
      const cx = d > 0 ? back - 14 : back + 14;
      b.fillRect(cx, y + 3, 2, 1);
      b.fillRect(cx - d, y + 4, 1, 1);
      b.fillRect(cx, y + 5, 2, 1);
      b.globalAlpha = 1;
      return;
    }
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
      b.fillStyle = {
        hand: ["#ffffff", "#c9a3ff", "#9b5de5", "#c9a3ff"],
        wind: ["#ffffff", "#e8f4ff", "#ffffff", "#cfe3f5"],
        drone: ["#ffffff", "#4fc0ff", "#c9d4df", "#4fc0ff"],
        zap: ["#ffffff", "#28aaff", "#5a2bd0", "#28aaff"],
      }[p.power][k];
      b.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
  }

  // ---- Missiles ----

  function drawMissile(m, world, camX) {
    const time = world.time;
    const img = m.striped ? sprites.missileStriped : sprites.missile;
    let x = m.x - camX;
    let y = m.y;
    let angle = m.angle;
    let scale = 1;
    let alpha = 1;

    if (m.state === "approach") {
      // Zooming in from far away: tiny and faded at first, growing as it gets close
      scale = m.scale;
      alpha = 0.35 + 0.65 * ((m.scale - 0.15) / 0.85);
    }
    // Smoke trail from the zoom-in: thin far away, thicker as the missile gets closer
    if (m.smoke && m.smoke.length) {
      const baseX = m.state === "approach" ? m.anchor.x : m.smokeAnchorX;
      for (const puff of m.smoke) {
        const age = time - puff.t;
        const fade = Math.max(0, 1 - age / 1.6);
        if (fade <= 0) continue;
        const px = baseX + puff.rx - Math.cos(m.state === "approach" ? angle : Math.atan2(m.oy - m.sy, m.ox - m.sx)) * 9 * puff.s - camX;
        const py = puff.y - Math.sin(m.state === "approach" ? angle : Math.atan2(m.oy - m.sy, m.ox - m.sx)) * 9 * puff.s;
        const size = Math.max(1, Math.round(1 + puff.s * 2.5 + age * 2)); // grows with the missile, and spreads as it drifts
        b.fillStyle = `rgba(${age < 0.15 ? "255, 244, 214" : "235, 238, 245"}, ${0.75 * fade})`;
        b.fillRect(Math.round(px - size / 2), Math.round(py - size / 2 - age * 3), size, size);
      }
    }

    // A glint where it first appears, like sunlight catching it far away
    if (m.state === "approach" && m.t < 0.45) {
      const k = Math.sin((Math.PI * m.t) / 0.45);
      const gx = Math.round(m.anchor.x + m.sx - camX);
      const gy = Math.round(m.sy);
      const arm = Math.round(2 + 7 * k);
      const diag = Math.round(1 + 3 * k);
      b.fillStyle = `rgba(255, 250, 200, ${0.35 * k})`;
      b.fillRect(gx - 3, gy - 3, 7, 7);
      b.fillStyle = "#ffd23f";
      b.fillRect(gx - arm, gy, arm * 2 + 1, 1);
      b.fillRect(gx, gy - arm, 1, arm * 2 + 1);
      b.fillStyle = "#fff6c8";
      for (let d = 1; d <= diag; d++) {
        b.fillRect(gx + d, gy + d, 1, 1); b.fillRect(gx - d, gy - d, 1, 1);
        b.fillRect(gx + d, gy - d, 1, 1); b.fillRect(gx - d, gy + d, 1, 1);
      }
      b.fillStyle = "#ffffff";
      b.fillRect(gx - 1, gy - 1, 3, 3);
    }

    if (x < -40 || x > VIEW_W + 40) return;

    if (m.state === "boom") return drawExplosion(x, y, m.t);

    // Smoke trail behind it while it flies
    if (m.state === "fly") {
      for (const p of m.trail) {
        const age = time - p.t;
        const fade = Math.max(0, 1 - age * 4);
        if (fade <= 0) continue;
        b.fillStyle = `rgba(150, 150, 160, ${0.6 * fade})`;
        const s = age < 0.08 ? 1 : 2;
        b.fillRect(Math.round(p.x - Math.cos(angle) * 9 - camX), Math.round(p.y - Math.sin(angle) * 9), s, s);
      }
    }

    // Lock-on: a bold flashing red target on the player and a dotted line showing where it'll fly
    if (m.state === "lock" && m.target && m.aim) {
      const on = Math.floor(time * 12) % 2 === 0;
      const tx = Math.round(m.target.x + HITBOX_W / 2 - camX);
      const ty = Math.round(m.target.y + HITBOX_H / 2);
      const red = on ? "#ff2a35" : "#b8131d";
      // aim line: always shown, pulsing
      const ax = m.aim.x - camX;
      const len = Math.hypot(ax - x, m.aim.y - y);
      for (let d = 10; d < len; d += 4) {
        b.fillStyle = (Math.floor(d / 4 + time * 20) % 2) ? red : "#ffffff";
        b.fillRect(Math.round(x + ((ax - x) * d) / len), Math.round(y + ((m.aim.y - y) * d) / len), 2, 2);
      }
      // target: shrinking corner brackets + a rotating ring of dots
      const r = Math.round(12 - 4 * Math.min(1, m.t / MISSILE.lock));
      b.fillStyle = red;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        b.fillRect(tx + sx * r - (sx > 0 ? 2 : 0), ty + sy * r - (sy > 0 ? 0 : 0), 3, 1);
        b.fillRect(tx + sx * r - (sx > 0 ? 0 : 0), ty + sy * r - (sy > 0 ? 2 : 0), 1, 3);
      }
      for (let k = 0; k < 8; k++) {
        const a = time * 4 + (k * Math.PI) / 4;
        b.fillRect(Math.round(tx + Math.cos(a) * (r - 3)), Math.round(ty + Math.sin(a) * (r - 3)), 2, 2);
      }
      b.fillRect(tx, ty, 1, 1);
    }

    b.save();
    b.globalAlpha = alpha;
    b.translate(Math.round(x), Math.round(y));
    b.rotate(angle);
    b.scale(scale, scale);
    b.drawImage(img, -9, -3);
    // flickering flame out the back
    const flick = Math.floor(time * 30) % 2;
    b.fillStyle = flick ? "#ffd23f" : "#f77f00";
    b.fillRect(-12 - flick, -1, 3 + flick, 3);
    b.fillStyle = "#f77f00";
    b.fillRect(-14 - flick * 2, 0, 2, 1);
    b.restore();
  }

  // A small pixel explosion: white flash, fireball, burst with sparks, then smoke
  function drawExplosion(x, y, t) {
    const f = t / MISSILE.blastTime;
    const ring = (r, color) => {
      b.fillStyle = color;
      for (let yy = -r; yy <= r; yy++) {
        const w = Math.round(Math.sqrt(r * r - yy * yy));
        b.fillRect(Math.round(x - w), Math.round(y + yy), w * 2 + 1, 1);
      }
    };
    if (f < 0.15) ring(3, "#ffffff");
    else if (f < 0.35) { ring(7, "#f77f00"); ring(5, "#ffd23f"); ring(2, "#ffffff"); }
    else if (f < 0.55) {
      ring(MISSILE.blast + 1, "#d1361e"); ring(MISSILE.blast - 1, "#f77f00"); ring(4, "#ffd23f");
      b.fillStyle = "#ffd23f";
      for (let k = 0; k < 10; k++) {
        const a = hash(k, Math.round(x)) * Math.PI * 2;
        const r = MISSILE.blast + 2 + hash(k + 5, Math.round(y)) * 3;
        b.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
      }
    } else {
      const fade = 1 - (f - 0.55) / 0.45;
      for (let k = 0; k < 8; k++) {
        const a = hash(k, Math.round(x) + 3) * Math.PI * 2;
        const r = 3 + hash(k + 2, Math.round(y)) * 6 + (f - 0.55) * 8;
        b.fillStyle = k % 3 === 0 && f < 0.75 ? `rgba(209, 54, 30, ${fade})` : `rgba(130, 130, 140, ${fade})`;
        b.fillRect(Math.round(x + Math.cos(a) * r - 2), Math.round(y + Math.sin(a) * r - 2 - (f - 0.55) * 6), 4, 4);
      }
    }
  }

  // ---- Mystic hand ----

  // Draw a sprite rotated around one of its own pixels (the pivot)
  function drawRotated(img, x, y, angle, pivotX, pivotY, alpha = 1) {
    b.save();
    b.globalAlpha = alpha;
    b.translate(Math.round(x), Math.round(y));
    b.rotate(angle);
    b.drawImage(img, -pivotX, -pivotY);
    b.restore();
  }

  // Purple sparkles drifting off the hand
  function handSparkles(x, y, behind, seed, time, count = 6) {
    const tick = Math.floor(time * 18);
    const colors = ["#c9a3ff", "#9b5de5", "#f5e8ff"];
    for (let k = 0; k < count; k++) {
      const sx = x + behind * (6 + hash(seed + k, tick) * 16);
      const sy = y + (hash(seed + k * 3, tick + 1) - 0.5) * 12;
      b.fillStyle = colors[k % 3];
      b.fillRect(Math.round(sx), Math.round(sy), k % 4 === 0 ? 2 : 1, k % 4 === 0 ? 2 : 1);
    }
  }

  function drawHand(h, world, camX, time = world.time) {
    const target = world.players[1 - h.owner];
    const open = sprites.handOpen;
    const back = sprites.handBack;
    const fist = sprites.handFist;
    const seed = h.owner * 97 + Math.round(h.tx || 0);

    if (h.state === "fly") {
      const x = h.x - camX;
      if (x < -20 || x > VIEW_W + 20) return;
      const bob = Math.round(Math.sin(time * 18) * 0.7);
      const img = h.dir > 0 ? open : back;
      b.drawImage(img, Math.round(x - img.width / 2), Math.round(h.y - img.height / 2) + bob);
      handSparkles(x, h.y, -h.dir, seed, time);
      return;
    }

    const cx = target.x + HITBOX_W / 2 - camX;
    const cy = target.y + HITBOX_H / 2;

    if (h.state === "grab") {
      // Fist closes on them, then swings up and back over the top
      drawRotated(fist, cx, cy, h.angle || 0, fist.width / 2, fist.height / 2);
      handSparkles(cx, cy, 1, seed, time, 4);
      // a purple swoosh tracing the arc behind them
      if (h.angle) {
        b.fillStyle = "rgba(201, 163, 255, 0.8)";
        const r = HAND.suplexRadius;
        const ox = h.tx + HITBOX_W / 2 - r - camX;
        const oy = h.ty + HITBOX_H / 2;
        for (let a = 0; a < -h.angle; a += 0.25) b.fillRect(Math.round(ox + (r + 7) * Math.cos(a)), Math.round(oy - (r + 7) * Math.sin(a)), 1, 1);
      }
      return;
    }

    if (h.state === "swat") {
      // Backhand: wind up (fingers swing up), then whip down through them
      const wind = 0.1;
      const t = h.t;
      let angle;
      if (t < wind) angle = (t / wind) * 1.15;
      else angle = 1.15 - ((t - wind) / (HAND.swatTime - wind)) * 1.75;
      const wristX = cx + 14;
      const wristY = cy - 1;
      drawRotated(back, wristX, wristY, angle, back.width - 3, back.height / 2);
      if (t >= wind) { // white and purple swoosh along the swing
        for (let a = -0.6; a < angle + 0.2 && a < 1.2; a += 0.12) {
          const px = wristX - 14 * Math.cos(a);
          const py = wristY - 14 * Math.sin(a);
          b.fillStyle = "#ffffff";
          b.fillRect(Math.round(px - 2), Math.round(py), 1, 1);
          b.fillStyle = "#c9a3ff";
          b.fillRect(Math.round(px - 1), Math.round(py), 1, 1);
        }
      }
      return;
    }

    // fade: the hand dissolves into sparkles
    const alpha = Math.max(0, 1 - h.t / 0.3);
    if (h.swatted) {
      // SMACK burst where the backhand landed
      const sx = h.smackX - camX;
      const sy = h.smackY;
      const r1 = 2 + h.t * 20;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        b.fillStyle = k % 2 ? "#ffd23f" : "#ffffff";
        b.globalAlpha = alpha;
        b.fillRect(Math.round(sx + Math.cos(a) * r1), Math.round(sy + Math.sin(a) * r1), 2, 2);
      }
      b.globalAlpha = 1;
      drawRotated(back, sx + 14, sy - 1, -0.6, back.width - 3, back.height / 2, alpha * 0.7);
    } else if (h.tx !== undefined) {
      drawRotated(fist, h.tx + HITBOX_W / 2 - 2 * HAND.suplexRadius - camX, h.ty + HITBOX_H / 2 - 4, -Math.PI, fist.width / 2, fist.height / 2, alpha);
    } else {
      const img = h.dir > 0 ? open : back;
      b.globalAlpha = alpha;
      b.drawImage(img, Math.round(h.x - camX - img.width / 2), Math.round(h.y - img.height / 2));
      b.globalAlpha = 1;
    }
    handSparkles(h.x - camX, h.y, -h.dir, seed, time, Math.round(6 * alpha));
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

  // ---- Thin ice (snow) ----

  function drawPonds(level, players, camX, time) {
    const px = (c, x, y, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), w, h); };
    for (const pond of level.ponds) {
      const x0 = Math.round(pond.x0 - camX), w = pond.x1 - pond.x0, gy = pond.gy;
      if (x0 > VIEW_W || x0 + w < 0) continue;
      const breaking = pond.state === "water" && time - pond.brokeAt < THIN_ICE.breakTime;
      if (breaking) {
        drawPondBreaking(pond, x0, time - pond.brokeAt, time);
        continue;
      }
      if (pond.state === "ice") {
        // a pale, frosty sheet with the dark water just showing through in blotches
        for (let x = 0; x < w; x++) {
          px(hash(pond.id, x * 3) < 0.15 ? "#ffffff" : "#eef7fc", x0 + x, gy);
          px("#d3e8f4", x0 + x, gy + 1);
          const dark = hash(pond.id + Math.floor(x / 3), 5) < 0.45;
          px(dark ? "#7fa9c8" : "#b7d4e6", x0 + x, gy + 2);
          px(dark ? "#5d88aa" : "#9fc2d9", x0 + x, gy + 3);
          px("#6f6474", x0 + x, gy + 4);
        }
        // Cracks: each one spreads out from where someone stepped, then stays
        for (const c of pond.cracks) drawIceCrack(c, x0 - pond.x0, pond, Math.min(1, (time - c.t) / THIN_ICE.crackGrow));
      } else {
        // broken: open icy water with bits of ice bobbing in it
        for (let x = 0; x < w; x++) {
          const wave = Math.sin(x * 0.6 + time * 5) > 0.6 ? 1 : 0;
          px("#8ccbef", x0 + x, gy + 1 + wave);
          px("#3f7fb2", x0 + x, gy + 2 + wave);
          px("#2b5d8a", x0 + x, gy + 3 + wave, 1, 6 - wave);
        }
        for (let k = 0; k < Math.floor(w / 8); k++) {
          const cx = x0 + 2 + Math.floor((hash(pond.id + k, 2) * w + time * 3) % (w - 5));
          px("#f2fbff", cx, gy + 1, 3, 1);
          px("#b9d6e8", cx, gy + 2, 3, 1);
        }
      }
      px("#ffffff", x0 - 1, gy - 1, 2, 1); // snow on the banks
      px("#ffffff", x0 + w - 1, gy - 1, 2, 1);
    }
  }

  // The ice giving way: first cracks race out across the whole sheet from where it broke,
  // then it snaps into chunks that tip, sink and drift apart while the water splashes up
  function drawPondBreaking(pond, x0, t, time) {
    const px = (c, x, y, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), w, h); };
    const w = pond.x1 - pond.x0, gy = pond.gy, bx = pond.breakX - pond.x0;
    const crackPhase = 0.25; // seconds of cracking before it breaks up
    if (t < crackPhase) {
      // the sheet still holding for a moment, bold cracks racing out from the break
      const f = t / crackPhase;
      for (let x = 0; x < w; x++) {
        px("#eef7fc", x0 + x, gy);
        px("#d3e8f4", x0 + x, gy + 1);
        px(hash(pond.id + Math.floor(x / 3), 5) < 0.45 ? "#7fa9c8" : "#b7d4e6", x0 + x, gy + 2);
        px("#9fc2d9", x0 + x, gy + 3);
        px("#6f6474", x0 + x, gy + 4);
      }
      for (const c of pond.cracks) drawIceCrack(c, x0 - pond.x0, pond, 1);
      for (let k = 0; k < 6; k++) {
        const dir = k % 2 ? 1 : -1, len = Math.round(w * Math.min(1, f * 1.6) * (0.5 + hash(pond.id, k) * 0.7));
        let x = bx, y = k % 3;
        for (let i = 0; i < len; i++) {
          x += dir;
          if (x < 0 || x >= w) break;
          if (hash(pond.id + k, i) < 0.35) y = Math.max(0, Math.min(3, y + (hash(k, i) < 0.5 ? -1 : 1)));
          px("#1f4466", x0 + x, gy + y);
          if (y > 0) px("#ffffff", x0 + x, gy + y - 1);
        }
      }
      px("#1f4466", x0 + bx - 1, gy, 3, 4); // the hole where it gave way
      px("#3f7fb2", x0 + bx, gy + 1, 1, 2);
    } else {
      // the water underneath
      for (let x = 0; x < w; x++) {
        px("#8ccbef", x0 + x, gy + 1);
        px("#3f7fb2", x0 + x, gy + 2);
        px("#2b5d8a", x0 + x, gy + 3, 1, 6);
      }
      // broken up: slabs of ice tipping, sinking and drifting away from the break
      const f = (t - crackPhase) / (THIN_ICE.breakTime - crackPhase);
      let x = 0, k = 0;
      while (x < w) {
        const cw = 4 + Math.floor(hash(pond.id + k, 9) * 4), mid = x + cw / 2;
        const away = Math.sign(mid - bx) || 1, near = 1 - Math.min(1, Math.abs(mid - bx) / w);
        const drift = away * f * 3 * (0.5 + near);
        const sink = f * (1.5 + 4 * near) + (hash(k, pond.id) < 0.3 ? f * 2 : 0);
        const tilt = (hash(pond.id, k * 7) - 0.5) * 4 * Math.min(1, f * 2);
        if (sink < 6) {
          for (let i = 0; i < cw - 1; i++) {
            const cx = x0 + x + i + drift;
            if (cx < x0 || cx >= x0 + w) continue;
            const cy = gy + sink + Math.round(tilt * (i / Math.max(1, cw - 2) - 0.5));
            const edge = i === 0 || i === cw - 2;
            px(edge ? "#2f587c" : "#ffffff", cx, cy);
            px(edge ? "#2f587c" : "#d3e8f4", cx, cy + 1);
            px("#7fa9c8", cx, cy + 2);
          }
        }
        x += cw;
        k++;
      }
      // splash: drops thrown up from the break, falling back
      for (let i = 0; i < 10; i++) {
        const dir = (hash(pond.id, i + 20) - 0.5) * 2, up = 14 + hash(i, pond.id) * 12, ft = f * 1.4;
        const dx = dir * 12 * ft, dy = -up * ft + 24 * ft * ft;
        if (dy > 1) continue;
        px(i % 2 ? "#ffffff" : "#8ccbef", x0 + bx + dx, gy + dy, i % 3 ? 1 : 2, 1);
      }
    }
    px("#ffffff", x0 - 1, gy - 1, 2, 1);
    px("#ffffff", x0 + w - 1, gy - 1, 2, 1);
  }

  // One crack in thin ice: two jagged lines zig-zagging out left and right from the footstep,
  // forking as they go, growing with `grow` (0..1). A bright edge along each makes it read as a crack.
  function drawIceCrack(c, offset, pond, grow) {
    const px = (col, x, y) => {
      if (x < pond.x0 || x >= pond.x1) return;
      b.fillStyle = col;
      b.fillRect(Math.round(x + offset), pond.gy + y, 1, 1);
    };
    // where the foot pressed down: a small dark star
    px("#2f587c", c.x, 1);
    if (grow > 0.15) { px("#2f587c", c.x - 1, 0); px("#2f587c", c.x + 1, 2); }
    // a thin jagged line running out each way, sometimes forking, a bright edge above it
    const reach = 5 + Math.floor(hash(c.seed, 1) * 5);
    for (const dir of [-1, 1]) {
      let x = c.x, y = 1;
      const len = Math.round(reach * grow);
      for (let i = 1; i <= len; i++) {
        x += dir;
        const r = hash(c.seed + dir * 7, i);
        if (r < 0.35 && y > 0) y--;
        else if (r > 0.65 && y < 2) y++;
        px(i > reach - 2 ? "#6f97b8" : "#3d6688", x, y); // fades out toward the tip
        if (y > 0 && i < reach - 1) px("#ffffff", x, y - 1);
        if (i === 3 && hash(c.seed, dir + 5) < 0.6 && grow > 0.6) px("#6f97b8", x + dir, Math.min(3, y + 1)); // a small fork
      }
    }
  }

  // Everyone frozen in the same pond shares one block of ice; cracks show their jumps so far
  function drawIceBlocks(level, camX) {
    const px = (c, x, y, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), w, h); };
    for (const pond of level.ponds) {
      if (!pond.frozen.length) continue;
      const xs = pond.frozen.map((p) => Math.round(p.x - camX));
      const x = Math.min(...xs) - 2, w = Math.max(...xs) - Math.min(...xs) + HITBOX_W + 4;
      const top = pond.gy - 9, h = 13;
      if (x > VIEW_W || x + w < 0) continue;
      b.globalAlpha = 0.35;
      px("#c8ecff", x, top, w, h);
      b.globalAlpha = 1;
      px("#ffffff", x, top, w, 1);
      px("#ffffff", x, top, 1, h);
      px("#ffffff", x + 2, top + 2, 1, 3);
      px("#5fb6e8", x + w - 1, top + 1, 1, h - 1);
      for (const p of pond.frozen) {
        let cx = Math.round(p.x - camX) + 1;
        for (let c = 0; c < p.pondHits; c++, cx += 2) {
          for (let i = 0; i < 5; i++) px("#ffffff", cx + (i % 2 ? 1 : 0), top + 1 + i * 2, 1, 2);
        }
      }
      px("#3f7fb2", x - 1, pond.gy + 1, w + 2, 1); // the water lapping at the block
    }
  }

  // ---- Desert sinkholes ----

  function drawSinkholes(level, camX, time) {
    const px = (c, x, y, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), w, h); };
    for (const s of level.sinkholes) {
      const cx = Math.round(s.x - camX), gy = s.gy;
      if (cx < -60 || cx > VIEW_W + 60) continue;
      if (s.state === "idle") {
        // just a little dip in the sand, barely darker than the sand round it
        const w = SINK.hole[s.size];
        for (let dx = -w; dx <= w; dx++) {
          const k = 1 - (dx / (w + 0.5)) ** 2;
          px("#e3b673", cx + dx, gy, 1, 1);
          if (k > 0.3) px("#d39a5c", cx + dx, gy + 1, 1, 1);
          if (k > 0.75) px("#c98a4b", cx + dx, gy + 2, 1, 1);
        }
        px("#c98a4b", cx - 1, gy, 3, 1);
        continue;
      }
      if (s.size === 2) {
        // caved in: a dark gap, ragged edges, sand still pouring in
        const W = (SINK.gap + 0.5) * TILE;
        for (let dx = -W; dx <= W; dx++) {
          const lip = Math.abs(dx) > W - 3 ? Math.round(hash(s.col + dx, 3) * 3) : 0;
          for (let y = lip; y < VIEW_H - gy; y += 1) {
            px(y < 4 ? "#8a5a2b" : y < 9 ? "#6b4420" : y < 16 ? "#4a2e14" : y < 22 ? "#2e1c0c" : "#170e06", cx + dx, gy + y, 1, 1);
          }
          if (lip) px("#c98a4b", cx + dx, gy, 1, lip);
        }
        const pour = Math.max(0, 1 - (time - s.openedAt) / 3); // pours for a few seconds, then trickles
        for (let i = 0; i < 16; i++) {
          if (i / 16 > pour + 0.2) continue;
          const side = i % 2 ? 1 : -1;
          px(i % 3 ? "#e3b673" : "#f2d091", cx + side * (W - 2 - (i % 4)), gy + 2 + ((time * 45 + i * 7) % 26), 1, 2);
        }
        continue;
      }
      // a small or medium one, opened into a funnel
      const [W, D] = SINK.funnel[s.size];
      const depth = (dx) => Math.round(D * Math.max(0, 1 - Math.abs(dx) / W) ** 0.7);
      const spin = Math.min(1, (time - s.openedAt) / SINK.pull); // it widens as it opens
      for (let dx = -W; dx <= W; dx++) {
        const sd = Math.round(depth(dx) * spin);
        for (let y = 0; y < sd; y++) px(y / D > 0.66 ? "#4a2e14" : y / D > 0.33 ? "#6b4420" : "#8a5a2b", cx + dx, gy + y, 1, 1);
        px("#f2d091", cx + dx, gy + sd, 1, 1);
        px("#d39a5c", cx + dx, gy + sd + 1, 1, 1);
      }
      if (!level.sinkCalm(s)) {
        // loose sand streaming down the slopes to the middle
        for (let i = 0; i < 10; i++) {
          const side = i % 2 ? 1 : -1, f = (time * 1.4 + i / 10) % 1, dx = Math.round(side * (W - 1) * (1 - f));
          px("#fff1cf", cx + dx, gy + Math.round(depth(dx) * spin) - 1, 1, 1);
        }
      } else {
        // the sand stops for a moment: sparkle = jump now!
        for (const side of [-1, 1]) {
          px("#ffffff", cx + side * 5, gy + D - 15);
          px("#ffffff", cx + side * 6, gy + D - 17);
          px("#ffffff", cx + side * 4, gy + D - 18);
        }
      }
    }
  }

  // Sand piled round the legs of someone stuck in a sinkhole
  function drawSinkPile(s, camX) {
    const cx = Math.round(s.x - camX), D = SINK.funnel[s.size][1];
    b.fillStyle = "#e3b673";
    b.fillRect(cx - 4, s.gy + D - 2, 9, 2);
    b.fillStyle = "#f2d091";
    b.fillRect(cx - 3, s.gy + D - 3, 7, 1);
  }

  // ---- Bear traps and bushes ----

  // Little arrows above someone stuck in a trap, flashing left then right: wiggle!
  function drawWiggleHint(p, camX, time) {
    const cx = Math.round(p.x - camX) + HITBOX_W / 2, y = Math.round(p.y) - 6;
    const left = Math.floor(time * 6) % 2 === 0;
    for (const [dir, lit] of [[-1, left], [1, !left]]) {
      b.fillStyle = lit ? "#ffffff" : "#8a8f99";
      const x = cx + dir * 5; // an arrow pointing out: wide base, then narrower, then the tip
      b.fillRect(x, y - 2, 1, 5);
      b.fillRect(x + dir, y - 1, 1, 3);
      b.fillRect(x + 2 * dir, y, 1, 1);
    }
  }

  function drawTraps(level, player, other, camX) {
    for (const t of level.traps) {
      const sx = t.x - camX;
      if (sx < -40 || sx > VIEW_W + 40) continue;
      if (t.bush && !t.bush.torn) continue; // hidden in a bush
      const shut = t.sprung; // once it's snapped on anyone, it stays shut for everyone
      const gy = level.groundTop(t.x);
      if (gy === null) continue;
      const pop = t.poppedAt !== undefined ? level.time - t.poppedAt : 9;
      if (pop < 0.3) {
        // someone just got out: the jaws spring apart (jumping a pixel), with a few sparks
        drawTrap(sx, gy - (pop < 0.1 ? 1 : 0), t.size, "open");
        b.fillStyle = "#ffffff";
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI + 0.3, d = 3 + pop * 30;
          b.fillRect(Math.round(sx + Math.cos(a) * d * (k % 2 ? 1 : -1)), Math.round(gy - 2 - Math.sin(a) * d * 0.6), 1, 1);
        }
      } else drawTrap(sx, gy, t.size, shut ? "shut" : "open");
    }
  }

  // A bear trap, like a real one: two round jaws hinged on posts at each end, a round trigger pan
  // in the middle, a long leaf spring out each side and a chain. Open, it lies flat in the grass
  // (hard to spot); snapped, the jaws stand up in an arch with the teeth meshed and the springs sprung.
  function drawTrap(cx, gy, size, state) {
    const w = TRAP.sizes[size];
    const sp = Math.round(w * 0.9); // how far each spring sticks out
    const px = (c, x, y, ww = 1, hh = 1) => { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), ww, hh); };
    cx = Math.round(cx);
    const steel = "#b4bac3", shade = "#7d838d", dark = "#2b2d33", tooth = "#ffffff";
    const base = gy - 1;
    // chain off the right spring, to a stake
    const links = size === 2 ? 5 : 3, chainX = cx + w + sp + 2;
    for (let k = 0; k < links; k++) px(k % 2 ? steel : shade, chainX + k, base - (k % 2));
    px(dark, chainX + links, base - 3, 1, 4);
    px("#8a5a3c", chainX + links, base - 4);
    // the leaf springs: long thin V's lying sideways, a loop at the far end
    for (const side of [-1, 1]) {
      const x0 = cx + side * (w + 1), x1 = cx + side * (w + sp);
      const spread = state === "shut" ? Math.round(w * 0.6) : 0; // snapped: the spring has sprung open
      for (let i = 0; i <= sp; i++) {
        const f = 1 - i / sp; // 1 at the jaw, 0 at the loop
        px(dark, x0 + side * i, base);
        if (spread) px(shade, x0 + side * i, base - 1 - Math.round(spread * f));
      }
      px(dark, x1 + side, base - (spread ? 2 : 1), 1, spread ? 3 : 2);
      if (spread) px(steel, x1 + side * 2, base - 1);
    }
    if (state === "open") {
      // jaws lying flat: a thin ring, teeth poking up here and there, the pan in the middle
      px(dark, cx - w, base, 2 * w + 1, 1);
      px(shade, cx - w, base - 1, 2 * w + 1, 1);
      for (let dx = -w + 1; dx < w; dx += 2) if (Math.abs(dx) > 1) px(tooth, cx + dx, base - 2);
      px(dark, cx - w - 1, base - 1);
      px(dark, cx + w + 1, base - 1);
      px(size === 2 ? "#d1403a" : "#9a6a44", cx - 1, base - 1, 3, 1); // red pan on the deadly large one
    } else {
      // snapped: both jaws stood up and slammed together into one arch, teeth meshed in a zigzag along the top
      const h = Math.round(w * 1.05);
      for (let dx = -w; dx <= w; dx++) {
        const k = Math.sqrt(Math.max(0, 1 - (dx / (w + 0.4)) ** 2));
        const top = base - Math.round(h * k);
        px(dark, cx + dx, top - 1);
        px(dx < 0 ? steel : shade, cx + dx, top);
        px(shade, cx + dx, top + 1);
        if (Math.abs(dx) >= w - 1) px(dx < 0 ? steel : shade, cx + dx, top, 1, base - top);
        if (k > 0.3) px((dx + 64) % 2 ? tooth : dark, cx + dx, top - 2 + ((dx + 64) % 2));
      }
      px(dark, cx - w - 1, base - 2, 1, 3);
      px(dark, cx + w + 1, base - 2, 1, 3);
      px(dark, cx - w + 1, base, 2 * w - 1, 1);
      px(size === 2 ? "#d1403a" : "#9a6a44", cx - 2, base - 1, 5, 1);
    }
  }

  // Bushes: torn ones (a trap went off inside) are drawn behind the runners, whole ones in front
  function drawBushes(level, camX, torn) {
    for (const bush of level.bushes) {
      if (bush.torn !== torn) continue;
      const sx = Math.round(bush.x0 - camX);
      if (sx > VIEW_W + 20 || sx + bush.w < -20) continue;
      if (!bush.sprite) bush.sprite = makeBushSprites(bush);
      const top = bush.gy - bush.h;
      if (!torn) {
        b.drawImage(bush.sprite.whole, sx, top);
        continue;
      }
      b.drawImage(bush.sprite.stump, sx, top - 2);
      // the top that got knocked off: flies up and tumbles away, fading out
      const t = level.time - (bush.tornAt ?? -9);
      if (t < 0.7) {
        const f = t / 0.7;
        b.globalAlpha = 1 - f * f;
        b.drawImage(bush.sprite.top, Math.round(sx + 14 * f), Math.round(top - 22 * f + 26 * f * f));
        b.globalAlpha = 1;
        b.fillStyle = "#63c74d";
        for (let k = 0; k < 6; k++) {
          const dir = k % 2 ? 1 : -1, sp = 6 + hash(k, bush.seed) * 10;
          b.fillRect(Math.round(sx + bush.w / 2 + dir * sp * f * 1.5), Math.round(top + 2 - 18 * f + (14 + k * 3) * f * f), 1, 1);
        }
      }
    }
  }

  // A whole bush (a rounded, lumpy dome of leaves, lit from the top-left), and once a trap has
  // gone off in it: the top that flies off, and the ruffled stump that's left
  function makeBushSprites(bush) {
    const { w, h, seed } = bush;
    const inside = bushShape(w, h, seed);
    const rnd = (a, k) => { const s = Math.sin(a * 127.1 + k * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
    const leafColor = (x, y) => {
      const nx = (x - w / 2) / (w / 2), ny = 1 - y / h;
      const lx = x % 3, ly = (y + (Math.floor(x / 3) % 2)) % 3;
      const leaf = rnd(Math.floor(x / 3), Math.floor((y + (Math.floor(x / 3) % 2)) / 3));
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1)) return "#1d4a33";           // outline
      if (!inside(x, y - 2) && nx < 0.5) return "#7ad35f";                                          // sunlit rim
      if (ny < 0.22) return lx === 0 && leaf < 0.5 ? "#3e8948" : "#265c42";                         // shade near the ground
      if (lx === 0 && ly === 0 && leaf < 0.45) return nx - ny < -0.2 ? "#7ad35f" : "#63c74d";       // a few leaf highlights
      if (lx === 2 && ly === 2 && leaf > 0.8) return "#265c42";                                     // the odd gap under a leaf
      return nx + (1 - ny) > 1.1 ? "#357a42" : "#3e8948";                                          // darker on the right
    };
    const canvas = (cw, ch) => { const c = document.createElement("canvas"); c.width = cw; c.height = ch; return [c, c.getContext("2d")]; };
    const dot = (g, col, x, y) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    // where the top breaks off: a ragged line a bit below half way
    const cut = (x) => Math.round(h * 0.5 + (rnd(x, 3) - 0.5) * 3 + Math.sin(x * 0.9 + seed) * 1.2);
    const [whole, gw] = canvas(w, h), [top, gt] = canvas(w, h), [stump, gs] = canvas(w, h + 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!inside(x, y)) continue;
        const col = leafColor(x, y);
        dot(gw, col, x, y);
        if (y < cut(x)) dot(gt, col, x, y);
        else dot(gs, y <= cut(x) + 1 ? (rnd(x, y) < 0.5 ? "#265c42" : "#357a42") : col, x, y + 2); // the broken edge is darker inside
      }
    }
    if (bush.berries) {
      for (let k = 0; k < Math.max(2, Math.floor(w / 7)); k++) {
        const bx = 2 + Math.floor(rnd(k, 9) * (w - 4)), by = 3 + Math.floor(rnd(k, 4) * (h - 7));
        if (inside(bx, by) && inside(bx, by - 2) && inside(bx - 1, by) && inside(bx + 1, by)) {
          for (const [g, oy, keep] of [[gw, 0, true], [gt, 0, by < cut(bx)], [gs, 2, by >= cut(bx) + 2]]) {
            if (!keep) continue;
            dot(g, "#e43b44", bx, by + oy);
            dot(g, "#ff9aa0", bx, by + oy - 1);
          }
        }
      }
    }
    // ruffled: leaves sticking up out of the broken top at odd angles, and a few down on the grass
    for (let x = 1; x < w - 1; x++) {
      if (!inside(x, cut(x)) || rnd(x, 11) > 0.45) continue;
      const len = 1 + Math.floor(rnd(x, 12) * 3), lean = rnd(x, 13) < 0.5 ? -1 : 1;
      for (let i = 1; i <= len; i++) dot(gs, i === len ? "#63c74d" : "#3e8948", x + (i === len && rnd(x, 14) < 0.6 ? lean : 0), cut(x) + 2 - i);
    }
    for (let k = 0; k < 5; k++) dot(gs, k % 2 ? "#63c74d" : "#3e8948", Math.floor(rnd(k, 21) * w), h + 1 - (k % 2));
    return { whole, top, stump };
  }

  // ---- Saw blades ----

  function sawOnScreen(s, camX) {
    return Math.max(s.x0, s.x1) + s.r + 4 > camX && Math.min(s.x0, s.x1) - s.r - 4 < camX + VIEW_W;
  }

  // The slots and rails the saws run along (behind the runners)
  function drawSawTracks(level, camX) {
    for (const s of level.saws) {
      if (!sawOnScreen(s, camX)) continue;
      const x0 = Math.round(s.x0 - camX);
      if (s.kind === "slot") {
        drawSawSlot(x0 - s.r + 1, Math.round(s.x1 - camX) + s.r - 1, s.gy);
      } else {
        drawSawRail(x0, Math.round(s.y1) - s.r - 3, s.kind === "pit" ? VIEW_H : s.gy);
        if (s.kind === "rail") drawSawSlot(x0 - s.r + 1, x0 + s.r - 1, s.gy);
      }
    }
  }

  function drawSaws(level, camX, time) {
    for (const s of level.saws) {
      if (!sawOnScreen(s, camX)) continue;
      const c = level.sawPos(s, time);
      const cx = Math.round(c.x - camX);
      const angle = s.spinDir * time * SAW.spin;
      if (s.kind === "pit") {
        drawSawBlade(cx, c.y, s.r, angle);
        continue;
      }
      // Sunk into the ground: only the part above it shows, with sparks where it cuts in
      b.save();
      b.beginPath();
      b.rect(cx - s.r - 2, c.y - s.r - 2, 2 * s.r + 4, Math.max(0, s.gy - (c.y - s.r - 2)));
      b.clip();
      drawSawBlade(cx, c.y, s.r, angle);
      b.restore();
      if (c.y + s.r > s.gy + 2) {
        const half = Math.round(Math.sqrt(Math.max(0, s.r * s.r - (s.gy - c.y) ** 2)));
        const k = Math.floor(time * 30) % 3;
        const side = s.spinDir > 0 ? -1 : 1; // sparks fly off the way the teeth come up out of the ground
        b.fillStyle = "#ffd25a";
        b.fillRect(cx + side * (half + 1 + k), s.gy - 1 - (k % 2), 1, 1);
        b.fillStyle = "#ff8a2a";
        b.fillRect(cx + side * (half + 2 + (k % 2)), s.gy - 2 - k, 1, 1);
      }
    }
  }

  // A steel disc with raked teeth, turned by `angle`
  function drawSawBlade(cx, cy, r, angle) {
    const n = r <= 6 ? 8 : r <= 9 ? 10 : 12;
    const seg = (Math.PI * 2) / n;
    const depth = r <= 6 ? 2.2 : 3; // how deep the teeth are cut
    const shape = (x, y) => {
      const d = Math.hypot(x, y);
      if (d <= r - depth) return 1; // the disc
      let t = (Math.atan2(y, x) - angle) % seg;
      if (t < 0) t += seg;
      return d <= r - depth * (t / seg) + 0.3 ? 2 : 0; // a tooth: rises slowly, drops sharply
    };
    const ox = Math.round(cx);
    const oy = Math.round(cy);
    for (let y = -r - 1; y <= r + 1; y++) {
      for (let x = -r - 1; x <= r + 1; x++) {
        const k = shape(x, y);
        if (!k) continue;
        const edge = !shape(x + 1, y) || !shape(x - 1, y) || !shape(x, y + 1) || !shape(x, y - 1);
        const d = Math.hypot(x, y);
        const lit = x + y < 0;
        if (edge) b.fillStyle = "#2b2d33";
        else if (k === 2) b.fillStyle = lit ? "#ffffff" : "#dfe3e9"; // sharp teeth
        else if (d < Math.max(1.6, r * 0.25)) b.fillStyle = d < 0.8 ? "#cfd4dc" : "#2b2d33"; // bolt in the middle
        else if (Math.abs(d - r * 0.62) < 0.5) b.fillStyle = "#6f7580"; // a groove ring
        else b.fillStyle = lit ? "#b4bac3" : "#8d939d";
        b.fillRect(ox + x, oy + y, 1, 1);
      }
    }
    // three holes that turn with the blade (medium and large), so you can see it spin
    if (r > 6) {
      b.fillStyle = "#3f434b";
      for (let k = 0; k < 3; k++) {
        const a = angle + (k * Math.PI * 2) / 3;
        const size = r > 9 ? 2 : 1;
        b.fillRect(Math.round(cx + Math.cos(a) * r * 0.45), Math.round(cy + Math.sin(a) * r * 0.45), size, size);
      }
    }
  }

  // A groove cut into the ground, with metal caps at each end
  function drawSawSlot(x0, x1, gy) {
    b.fillStyle = "#1c1b22";
    b.fillRect(x0, gy, x1 - x0, 2);
    b.fillStyle = "#8a8f99";
    b.fillRect(x0 - 1, gy - 1, 2, 3);
    b.fillRect(x1 - 1, gy - 1, 2, 3);
    b.fillStyle = "#cfd4dc";
    b.fillRect(x0 - 1, gy - 1, 1, 1);
    b.fillRect(x1 - 1, gy - 1, 1, 1);
  }

  // An upright metal rail from y0 (top) down to y1
  function drawSawRail(x, y0, y1) {
    b.fillStyle = "#3a3d44";
    b.fillRect(x - 1, y0, 3, y1 - y0);
    b.fillStyle = "#8a8f99";
    b.fillRect(x, y0, 1, y1 - y0);
    b.fillStyle = "#5c616b";
    b.fillRect(x - 2, y0 - 1, 5, 2); // bracket at the top
    b.fillStyle = "#cfd4dc";
    b.fillRect(x - 1, y0 - 1, 1, 1);
  }

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
    // Swung by a hand, or tumbling backwards after being thrown
    const spin = p.held ? p.spin : p.stun > 0 && !p.onGround ? -(HAND.stun - p.stun) * 14 : 0;
    if (spin) {
      b.save();
      b.translate(x + 4, y + 6);
      b.rotate(spin);
      if (p.facing < 0) b.scale(-1, 1);
      b.drawImage(frame, -4, -6);
      b.restore();
    } else if (p.facing < 0) {
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
      if (world.wild) text(ctx, "WILD", W - 12, top + 36, "#ff6b3d", 10, "right");
      if (p.power) {
        const key = world.solo ? "S/DOWN" : i === 0 ? "S" : "DOWN";
        const arrow = p.facing > 0 ? ">>" : "<<"; // follows the way you're facing
        const label = { zap: "ZAP", hand: "HAND", wind: "WIND DASH", drone: "DRONE" }[p.power];
        const color = { zap: "#fff27a", hand: "#c9a3ff", wind: "#ffffff", drone: "#4fc0ff" }[p.power];
        text(ctx, `${label} ${arrow} press ${key}`, 12, top + 36, color, 10);
      }
      if (p.flash > 0) {
        ctx.fillStyle = `rgba(220, 245, 255, ${Math.min(1, p.flash) * 0.45})`;
        ctx.fillRect(0, top, W, viewH);
      }

      // Entering a new biome: its name, fading out
      if (p.biomeBanner > 0) {
        ctx.globalAlpha = Math.min(1, p.biomeBanner * 2);
        const name = p.biome.toUpperCase();
        const color = { snow: "#e8f6ff", desert: "#ffcc66", jungle: "#5fe07a" }[p.biome] || "#8be070";
        text(ctx, name, W / 2, top + 64, color, 18, "center");
        ctx.globalAlpha = 1;
      }

      const mid = top + viewH / 2;
      if (p.caught) text(ctx, "CAUGHT!", W / 2, mid, "#ff4d3d", 24, "center");
      else if (p.hitTextTime > 0) text(ctx, p.hitText, W / 2, mid, p.hitColor, 24, "center");
      else if (p.frozen > FREEZE_TIME - 0.8) text(ctx, "FROZEN!", W / 2, mid, "#a6e1ff", 24, "center");
      else if (p.dashHold > 0 || p.dashTime > 0) text(ctx, "DASH!", W / 2, mid, "#ffd23f", 24, "center");
      else if (world.swapFlash > 0) text(ctx, "SWAP!", W / 2, mid, "#ffd23f", 24, "center");
    });

    // The whole canvas: one view in 1-player mode, two views (and the divider) otherwise
    const fullH = (world.players.length === 1 ? VIEW_H : VIEW_H * 2 + DIVIDER) * SCALE;
    if (world.swapFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${world.swapFlash * 0.5})`;
      ctx.fillRect(0, 0, W, fullH);
    }

    const center = fullH / 2;
    if (world.state === "countdown") {
      text(ctx, String(Math.ceil(world.countdown)), W / 2, center, "#ffffff", 40, "center");
    } else if (world.state === "playing" && world.time < 0.6) {
      text(ctx, "GO!", W / 2, center, "#ffffff", 40, "center");
    } else if (world.state === "paused") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, W, fullH);
      text(ctx, "PAUSED", W / 2, center, "#ffffff", 28, "center");
    }
  }

  return { init, render, resetCameras, swapCameras, camera: (i) => cams[i] };
})();
