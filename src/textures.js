import {
  TAU,
  canvasTexture,
  get2DContext,
  gaussian,
  makeCanvas,
  mulberry32,
  randRange,
  createTextTexture,
} from './utils.js';

function drawWrapped(ctx, width, x, draw) {
  draw(x);
  if (x < 220) draw(x + width);
  if (x > width - 220) draw(x - width);
}

function drawBlob(ctx, x, y, rx, ry, rotation, stops) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(Math.max(1, rx), Math.max(1, ry));
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx, x, y, size, color, alpha, glow = 0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (glow > 0) {
    const halo = ctx.createRadialGradient(x, y, 0, x, y, glow);
    halo.addColorStop(0, color);
    halo.addColorStop(0.25, color);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, glow, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function createSkyTexture(anisotropy = 8) {
  const width = 2048;
  const height = 1024;
  const canvas = makeCanvas(width, height);
  const ctx = get2DContext(canvas);
  const random = mulberry32(90471);

  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, '#010207');
  base.addColorStop(0.34, '#030611');
  base.addColorStop(0.54, '#050813');
  base.addColorStop(0.78, '#02040c');
  base.addColorStop(1, '#010208');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const bandY = (x) =>
    height * 0.46 +
    Math.sin((x / width) * TAU + 0.9) * height * 0.085 +
    Math.sin((x / width) * TAU * 3 + 2.1) * height * 0.022;

  ctx.globalCompositeOperation = 'lighter';

  // Broad cool glow around the galactic band.
  for (let i = 0; i < 160; i += 1) {
    const x = random() * width;
    const y = bandY(x) + gaussian(random) * 150;
    const rx = randRange(random, 180, 480);
    const ry = randRange(random, 50, 180);
    drawBlob(ctx, x, y, rx, ry, -0.13 + gaussian(random) * 0.08, [
      [0, 'rgba(38,67,122,0.026)'],
      [0.42, 'rgba(55,74,142,0.018)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
  }

  // Structured nebula filaments: violet, glacial blue and a breath of ember.
  const nebulaColors = [
    ['rgba(135,82,200,0.15)', 'rgba(58,46,143,0.08)'],
    ['rgba(38,139,179,0.13)', 'rgba(24,83,128,0.06)'],
    ['rgba(203,96,115,0.09)', 'rgba(108,55,95,0.045)'],
    ['rgba(84,175,198,0.10)', 'rgba(31,91,132,0.05)'],
  ];

  for (let i = 0; i < 720; i += 1) {
    const x = random() * width;
    const y = bandY(x) + gaussian(random) * randRange(random, 28, 190);
    const rx = randRange(random, 35, 240);
    const ry = randRange(random, 10, 90);
    const palette = nebulaColors[Math.floor(random() * nebulaColors.length)];
    const alphaScale = randRange(random, 0.35, 1);
    const rotation = -0.14 + gaussian(random) * 0.18;
    const draw = (dx) => {
      ctx.save();
      ctx.globalAlpha = alphaScale;
      drawBlob(ctx, dx, y, rx, ry, rotation, [
        [0, palette[0]],
        [0.36, palette[1]],
        [0.72, palette[1].replace(/[\d.]+\)$/, '0.012)')],
        [1, 'rgba(0,0,0,0)'],
      ]);
      ctx.restore();
    };
    drawWrapped(ctx, width, x, draw);
  }

  // A dusty, denser core around the center of the band.
  const coreX = width * 0.61;
  drawBlob(ctx, coreX, bandY(coreX), 580, 190, -0.08, [
    [0, 'rgba(239,184,133,0.10)'],
    [0.28, 'rgba(146,116,134,0.06)'],
    [0.64, 'rgba(63,72,126,0.025)'],
    [1, 'rgba(0,0,0,0)'],
  ]);

  // Distant blue nebula clouds off the band.
  for (let i = 0; i < 80; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const rx = randRange(random, 90, 360);
    const ry = randRange(random, 50, 220);
    drawBlob(ctx, x, y, rx, ry, gaussian(random) * 0.2, [
      [0, 'rgba(22,79,126,0.025)'],
      [0.5, 'rgba(16,43,89,0.014)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
  }

  // Dark dust lanes, layered over the bright core.
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 110; i += 1) {
    const x = random() * width;
    const y = bandY(x) + gaussian(random) * 115;
    const rx = randRange(random, 60, 330);
    const ry = randRange(random, 12, 60);
    drawBlob(ctx, x, y, rx, ry, -0.12 + gaussian(random) * 0.1, [
      [0, 'rgba(1,3,8,0.28)'],
      [0.47, 'rgba(2,5,11,0.16)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
  }

  // Fine star field.
  ctx.globalCompositeOperation = 'lighter';
  const starColors = [
    '#e7f5ff',
    '#c7ddff',
    '#a9c8ff',
    '#fff1db',
    '#ffe4b4',
    '#d7e9ff',
  ];

  for (let i = 0; i < 4300; i += 1) {
    const inBand = random() < 0.43;
    const x = random() * width;
    const y = inBand
      ? bandY(x) + gaussian(random) * randRange(random, 20, 180)
      : random() * height;
    const size = randRange(random, 0.3, 1.55) * (inBand ? 0.82 : 1);
    const alpha = randRange(random, 0.16, 0.9);
    const color = starColors[Math.floor(random() * starColors.length)];
    drawWrapped(ctx, width, x, (dx) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(dx, y, size, 0, TAU);
      ctx.fill();
    });
  }

  // A small number of bright beacons with soft halos and diffraction spikes.
  for (let i = 0; i < 64; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const color = starColors[Math.floor(random() * starColors.length)];
    const glow = randRange(random, 2.5, 9);
    drawWrapped(ctx, width, x, (dx) => {
      drawStar(ctx, dx, y, randRange(random, 0.8, 1.8), color, 0.85, glow);
      ctx.save();
      ctx.globalAlpha = randRange(random, 0.1, 0.32);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      const spike = randRange(random, 4, 17);
      ctx.beginPath();
      ctx.moveTo(dx - spike, y);
      ctx.lineTo(dx + spike, y);
      ctx.moveTo(dx, y - spike);
      ctx.lineTo(dx, y + spike);
      ctx.stroke();
      ctx.restore();
    });
  }

  ctx.globalCompositeOperation = 'source-over';
  // Slightly dim the poles so the sky sphere has depth.
  const poleFade = ctx.createLinearGradient(0, 0, 0, height);
  poleFade.addColorStop(0, 'rgba(1,2,7,0.72)');
  poleFade.addColorStop(0.2, 'rgba(1,2,7,0)');
  poleFade.addColorStop(0.8, 'rgba(1,2,7,0)');
  poleFade.addColorStop(1, 'rgba(1,2,7,0.76)');
  ctx.fillStyle = poleFade;
  ctx.fillRect(0, 0, width, height);

  return canvasTexture(canvas, { colorSpace: 'srgb', anisotropy });
}

export function createStarSprite() {
  const size = 96;
  const canvas = makeCanvas(size, size);
  const ctx = get2DContext(canvas);
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.12, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.32, 'rgba(191,226,255,0.32)');
  gradient.addColorStop(0.68, 'rgba(80,142,255,0.07)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvasTexture(canvas, { colorSpace: 'srgb' });
}

export function createGlowTexture(inner = 'rgba(255,255,255,1)') {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = get2DContext(canvas);
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.12, inner);
  gradient.addColorStop(0.3, 'rgba(190,235,255,0.36)');
  gradient.addColorStop(0.58, 'rgba(88,170,255,0.09)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvasTexture(canvas, { colorSpace: 'srgb' });
}

export function createFlareTexture() {
  const width = 512;
  const height = 128;
  const canvas = makeCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.globalCompositeOperation = 'lighter';

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(1, 0.13);
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, width / 2);
  halo.addColorStop(0, 'rgba(255,255,255,0.98)');
  halo.addColorStop(0.08, 'rgba(220,250,255,0.78)');
  halo.addColorStop(0.28, 'rgba(96,204,255,0.24)');
  halo.addColorStop(0.68, 'rgba(47,139,255,0.05)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, width / 2, 0, TAU);
  ctx.fill();
  ctx.restore();

  const core = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    20,
  );
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.4, 'rgba(200,245,255,0.85)');
  core.addColorStop(1, 'rgba(160,235,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, width, height);

  return canvasTexture(canvas, { colorSpace: 'srgb' });
}

export function createShipDecalTexture() {
  const canvas = makeCanvas(1024, 512);
  const ctx = get2DContext(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(208,245,255,0.92)';
  ctx.font = '700 174px "Bahnschrift", "Agency FB", "Segoe UI", sans-serif';
  ctx.fillText('NX–07', 44, 218);

  ctx.fillStyle = 'rgba(181,224,238,0.68)';
  ctx.font = '500 34px "Bahnschrift", "Segoe UI", sans-serif';
  ctx.fillText('HELIOS  /  DEEP SPACE PROGRAM', 52, 342);

  ctx.strokeStyle = 'rgba(123,224,255,0.55)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(52, 382);
  ctx.lineTo(746, 382);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,182,100,0.9)';
  ctx.fillRect(764, 358, 52, 48);
  ctx.fillStyle = 'rgba(140,241,255,0.86)';
  ctx.fillRect(832, 358, 100, 48);

  ctx.fillStyle = 'rgba(175,220,235,0.6)';
  ctx.font = '500 24px "Bahnschrift", "Segoe UI", sans-serif';
  ctx.fillText('STARSHIP // QUANTUM CLASS', 52, 444);

  return canvasTexture(canvas, { colorSpace: 'srgb' });
}

export function createWingDecalTexture() {
  const canvas = makeCanvas(512, 512);
  const ctx = get2DContext(canvas);
  ctx.clearRect(0, 0, 512, 512);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(220,250,255,0.72)';
  ctx.font = '700 220px "Bahnschrift", "Agency FB", "Segoe UI", sans-serif';
  ctx.fillText('07', 256, 228);
  ctx.strokeStyle = 'rgba(122,231,255,0.48)';
  ctx.lineWidth = 6;
  ctx.strokeRect(62, 64, 388, 358);
  ctx.fillStyle = 'rgba(188,228,240,0.62)';
  ctx.font = '500 28px "Bahnschrift", "Segoe UI", sans-serif';
  ctx.fillText('VECTOR WING', 256, 368);
  return canvasTexture(canvas, { colorSpace: 'srgb' });
}

export function createLabelLineTexture() {
  return createTextTexture({
    width: 512,
    height: 64,
    lines: [
      {
        text: '◆ VECTOR ENGINE / 07',
        y: 32,
        font: '500 22px "Bahnschrift", "Segoe UI", sans-serif',
        color: 'rgba(170,240,255,0.85)',
      },
    ],
  });
}

/**
 * Transparent service-marking sheet used on the hull and nacelles.
 * The texture is intentionally asymmetric: one side reads as a dock-side
 * maintenance board, the other as a compact registry stencil.
 */
export function createHullStencilTexture() {
  const width = 1024;
  const height = 320;
  const canvas = makeCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.clearRect(0, 0, width, height);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(222,219,205,0.9)';
  ctx.font = '700 154px "Bahnschrift", "Agency FB", "Segoe UI", sans-serif';
  ctx.fillText('NX-07', 28, 112);

  ctx.fillStyle = 'rgba(219,217,205,0.66)';
  ctx.font = '500 30px "Bahnschrift", "Segoe UI", sans-serif';
  ctx.fillText('HELIOS  /  QUANTUM-CLASS LONGSHIP', 34, 214);

  ctx.strokeStyle = 'rgba(202,198,184,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(34, 246);
  ctx.lineTo(640, 246);
  ctx.stroke();

  ctx.fillStyle = 'rgba(231,145,82,0.95)';
  ctx.fillRect(34, 270, 72, 18);
  ctx.fillStyle = 'rgba(150,232,244,0.78)';
  ctx.fillRect(118, 270, 36, 18);
  ctx.fillStyle = 'rgba(210,205,190,0.55)';
  ctx.font = '500 21px "Bahnschrift", "Segoe UI", sans-serif';
  ctx.fillText('DEEP SPACE PROGRAM  //  FRAME 07-A', 174, 280);

  ctx.fillStyle = 'rgba(221,218,204,0.78)';
  ctx.font = '600 24px "Bahnschrift", "Segoe UI", sans-serif';
  ctx.fillText('NO STEP', 798, 78);
  ctx.fillText('SERVICE BAY 03', 798, 112);
  ctx.fillStyle = 'rgba(230,148,84,0.9)';
  ctx.fillRect(798, 138, 164, 9);

  // Small maintenance runes at the far right keep decals from looking
  // like a single isolated logo.
  ctx.strokeStyle = 'rgba(196,222,228,0.45)';
  ctx.lineWidth = 2;
  [0, 1, 2].forEach((i) => {
    ctx.strokeRect(798, 176 + i * 34, 18 + i * 12, 18);
  });

  return canvasTexture(canvas, { colorSpace: 'srgb' });
}

/** Diagonal hazard tape for docking collars, pylons and service panels. */
export function createWarningStripeTexture() {
  const canvas = makeCanvas(256, 64);
  const ctx = get2DContext(canvas);
  ctx.fillStyle = '#111318';
  ctx.fillRect(0, 0, 256, 64);
  ctx.save();
  ctx.translate(16, 0);
  ctx.rotate(-0.5);
  for (let x = -60; x < 340; x += 42) {
    ctx.fillStyle = 'rgba(224,135,68,0.92)';
    ctx.fillRect(x, -20, 21, 110);
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(246,214,175,0.35)';
  ctx.fillRect(0, 2, 256, 2);
  ctx.fillRect(0, 60, 256, 2);
  return canvasTexture(canvas, { colorSpace: 'srgb' });
}