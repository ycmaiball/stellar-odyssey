import * as THREE from 'three';

export const TAU = Math.PI * 2;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const lerp = (a, b, t) => a + (b - a) * t;

export const damp = (current, target, lambda, dt) =>
  THREE.MathUtils.damp(current, target, lambda, dt);

export function dampAngle(current, target, lambda, dt) {
  let delta = ((target - current + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const smoothstep = (min, max, value) => {
  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
};

export function mulberry32(seed = 1) {
  let a = seed >>> 0;
  return function random() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

export function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDistance(units) {
  // The HUD treats one scene unit as roughly 1.6 km for a readable scale.
  const km = units * 1.6;
  if (km >= 1000000) return `${(km / 1000000).toFixed(2)}M km`;
  if (km >= 1000) return `${formatNumber(km, 0)} km`;
  return `${formatNumber(km, 0)} km`;
}

export function canvasTexture(canvas, { colorSpace = 'srgb', anisotropy = 8 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace =
    colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function get2DContext(canvas, options = {}) {
  const ctx = canvas.getContext('2d', options);
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');
  return ctx;
}

export function createTextTexture({
  width = 512,
  height = 192,
  lines = [],
  align = 'left',
} = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const x = align === 'center' ? width / 2 : 24;

  lines.forEach((line) => {
    ctx.save();
    ctx.globalAlpha = line.opacity ?? 1;
    ctx.fillStyle = line.color ?? '#dff8ff';
    ctx.font = line.font ?? '600 48px "Bahnschrift", "Segoe UI", sans-serif';
    if (line.letterSpacing) {
      // Canvas does not consistently support letterSpacing, so draw manually.
      let cursor = x;
      for (const character of line.text) {
        ctx.fillText(character, cursor, line.y);
        cursor += ctx.measureText(character).width + line.letterSpacing;
      }
    } else {
      ctx.fillText(line.text, x, line.y);
    }
    ctx.restore();
  });

  return canvasTexture(canvas);
}

export function createGridTexture({
  width = 512,
  height = 512,
  background = 'rgba(0,0,0,0)',
  line = 'rgba(120,220,255,0.24)',
  cell = 64,
} = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }
  return canvasTexture(canvas, { colorSpace: 'srgb' });
}

export function randRange(random, min, max) {
  return min + (max - min) * random();
}

export function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value && value.isTexture) value.dispose();
        });
        material.dispose();
      });
    }
  });
}