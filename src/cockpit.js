import * as THREE from 'three';

/* ─────────────────────────────────────────────────────────────
   NX-07 · Quantum cruise cockpit
   A compact, camera-local hard-surface interior.  Everything is
   procedural so the cockpit can be lit and animated by the same
   renderer as the exterior ship.
   ───────────────────────────────────────────────────────────── */

const STRUCTURE = 0x0b1218;
const PANEL = 0x18252d;
const TRIM = 0x51636c;
const CYAN = 0x8be9ff;
const AMBER = 0xffb46b;

function makeScreenTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 512, 256);
  bg.addColorStop(0, '#041019');
  bg.addColorStop(0.58, '#061822');
  bg.addColorStop(1, '#071014');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = 'rgba(108, 216, 240, 0.11)';
  ctx.lineWidth = 1;
  for (let x = 16; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 16; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(139, 233, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 492, 236);

  ctx.fillStyle = 'rgba(139, 233, 255, 0.72)';
  ctx.font = '700 11px Consolas, monospace';
  ctx.letterSpacing = '2px';

  if (kind === 'nav') {
    ctx.fillText('NAV / HELIOCENTRIC', 28, 34);
    ctx.fillStyle = 'rgba(139, 233, 255, 0.38)';
    ctx.fillText('SOL SYSTEM · CRUISE VECTOR', 28, 51);

    const cx = 274;
    const cy = 144;
    ctx.strokeStyle = 'rgba(139, 233, 255, 0.42)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 30 + i * 33, 13 + i * 18, -0.34, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 70, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(139, 233, 255, 0.2)';
    ctx.stroke();

    const stars = [
      [180, 103, 1.7], [234, 190, 1.1], [330, 96, 1.3], [370, 165, 1.9],
      [205, 148, 1], [300, 206, 1.2], [414, 117, 1], [252, 132, 0.8],
      [352, 220, 0.9], [160, 178, 0.8],
    ];
    for (const [x, y, r] of stars) {
      ctx.fillStyle = 'rgba(202, 247, 255, 0.82)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ffe0b0';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(139, 233, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(cx + 54, cy - 42, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 190, 120, 0.82)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 54, cy - 42);
    ctx.stroke();

    ctx.fillStyle = 'rgba(192, 241, 250, 0.8)';
    ctx.font = '700 10px Consolas, monospace';
    ctx.fillText('TGT  EARTH / 03', 28, 190);
    ctx.fillText('RANGE  0.21 AU', 28, 208);
    ctx.fillText('VEL    0.940 C', 28, 226);
    ctx.fillStyle = 'rgba(139, 233, 255, 0.38)';
    ctx.font = '8px Consolas, monospace';
    ctx.fillText('AUTOPILOT  RELEASED', 28, 243);
  } else {
    ctx.fillText('SYSTEMS / NX-07', 28, 34);
    ctx.fillStyle = 'rgba(139, 233, 255, 0.38)';
    ctx.fillText('QUANTUM CRUISE · LIVE', 28, 51);

    const rows = [
      ['DEFLECTOR', 0.94, '#83e6ff'],
      ['HULL INTEGRITY', 0.98, '#83e6ff'],
      ['WARP CORE', 0.86, '#ffd091'],
      ['FIELD STABILITY', 0.91, '#83e6ff'],
      ['THERMAL LOAD', 0.34, '#ffb46b'],
    ];
    rows.forEach(([label, value, color], index) => {
      const y = 86 + index * 31;
      ctx.fillStyle = 'rgba(170, 220, 231, 0.62)';
      ctx.font = '9px Consolas, monospace';
      ctx.fillText(label, 28, y);
      ctx.fillStyle = 'rgba(139, 233, 255, 0.11)';
      ctx.fillRect(152, y - 7, 310, 5);
      ctx.fillStyle = color;
      ctx.fillRect(152, y - 7, 310 * value, 5);
      for (let i = 0; i < 15; i += 1) {
        ctx.fillStyle = 'rgba(2, 10, 14, 0.8)';
        ctx.fillRect(152 + i * 21.3, y - 7, 3, 5);
      }
      ctx.fillStyle = 'rgba(210, 246, 252, 0.58)';
      ctx.font = '8px Consolas, monospace';
      ctx.fillText(`${Math.round(value * 100)}%`, 470, y);
    });

    ctx.fillStyle = 'rgba(139, 233, 255, 0.5)';
    ctx.font = '8px Consolas, monospace';
    ctx.fillText('NX-07 / HELIOS  ·  DEEP SPACE PROGRAM', 28, 240);
  }

  // Fine scan lines.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let y = 0; y < 256; y += 3) ctx.fillRect(10, y, 492, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeHoloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  const glow = ctx.createRadialGradient(128, 128, 4, 128, 128, 120);
  glow.addColorStop(0, 'rgba(130, 235, 255, 0.22)');
  glow.addColorStop(0.45, 'rgba(85, 194, 255, 0.08)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(139, 233, 255, 0.58)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.ellipse(128, 128, 25 + i * 21, 11 + i * 14, -0.25, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(128, 128, 34, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(139, 233, 255, 0.28)';
  ctx.stroke();

  ctx.fillStyle = 'rgba(183, 244, 255, 0.78)';
  for (let i = 0; i < 18; i += 1) {
    const angle = i * 1.91;
    const radius = 15 + ((i * 31) % 100);
    ctx.fillRect(128 + Math.cos(angle) * radius, 128 + Math.sin(angle) * radius, 1.5, 1.5);
  }
  ctx.fillStyle = '#ffdfaa';
  ctx.beginPath();
  ctx.arc(128, 128, 3, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addBox(parent, material, width, height, depth, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

function addTube(parent, material, points, radius, tubularSegments = 24) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, radius, 8, false),
    material,
  );
  parent.add(mesh);
  return mesh;
}

function addButtonRows(parent, material, x, y, z, facing = 1) {
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const button = addBox(
        parent,
        material,
        0.1,
        0.035,
        0.035,
        x + (column - 1) * 0.14,
        y - row * 0.11,
        z,
        0,
        0,
        0,
      );
      button.material = material;
    }
  }
}

export function createWarpCockpit() {
  const group = new THREE.Group();
  group.name = 'NX-07-QUANTUM-COCKPIT';
  group.visible = false;

  const structure = new THREE.MeshStandardMaterial({
    color: STRUCTURE,
    metalness: 0.86,
    roughness: 0.34,
    emissive: 0x02070a,
    emissiveIntensity: 0.8,
  });
  const panel = new THREE.MeshStandardMaterial({
    color: PANEL,
    metalness: 0.62,
    roughness: 0.48,
    emissive: 0x06151c,
    emissiveIntensity: 0.32,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: TRIM,
    metalness: 0.92,
    roughness: 0.26,
    emissive: 0x061016,
    emissiveIntensity: 0.34,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x03070a,
    metalness: 0.5,
    roughness: 0.72,
  });
  const cyan = new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false });
  const amber = new THREE.MeshBasicMaterial({ color: AMBER, toneMapped: false });
  const cyanDim = new THREE.MeshBasicMaterial({
    color: 0x1d6b7d,
    transparent: true,
    opacity: 0.82,
    toneMapped: false,
  });

  // Main instrument shelf and the dark cowl beneath the canopy glass.
  addBox(group, structure, 8.6, 0.32, 1.9, 0, -2.02, -4.12, -0.06);
  addBox(group, panel, 7.8, 0.1, 1.15, 0, -1.67, -3.55, -0.22);
  addBox(group, dark, 8.1, 0.08, 0.22, 0, -1.79, -3.02, -0.12);
  addBox(group, trim, 7.75, 0.045, 0.075, 0, -1.52, -3.12);
  addBox(group, cyanDim, 7.35, 0.018, 0.025, 0, -1.55, -3.08);

  // Side consoles, angled inward toward the pilot.
  for (const side of [-1, 1]) {
    addBox(group, panel, 1.24, 0.72, 2.05, side * 3.45, -1.45, -3.55, -0.12, side * -0.2);
    addBox(group, structure, 0.22, 0.78, 2.2, side * 4.08, -1.22, -3.5, 0, side * -0.2);
    addBox(group, trim, 0.08, 0.06, 1.5, side * 4.0, -0.95, -3.46);
    addBox(group, cyanDim, 0.05, 0.025, 1.3, side * 3.94, -0.9, -3.46);
    addButtonRows(group, side < 0 ? cyan : amber, side * 3.1, -1.1, -3.6, side);
    addButtonRows(group, trim, side * 2.9, -1.66, -3.9, side);
  }

  // Instrument displays, recessed into the top of the shelf.
  const navScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.05),
    new THREE.MeshBasicMaterial({ map: makeScreenTexture('nav'), toneMapped: false }),
  );
  navScreen.position.set(-2.33, -1.17, -4.14);
  navScreen.rotation.x = -0.18;
  group.add(navScreen);

  const systemsScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.05),
    new THREE.MeshBasicMaterial({ map: makeScreenTexture('systems'), toneMapped: false }),
  );
  systemsScreen.position.set(2.33, -1.17, -4.14);
  systemsScreen.rotation.x = -0.18;
  group.add(systemsScreen);

  for (const x of [-2.33, 2.33]) {
    addBox(group, dark, 2.86, 1.3, 0.16, x, -1.19, -4.22, -0.18);
    addBox(group, trim, 2.92, 0.035, 0.09, x, -0.54, -4.2, -0.18);
    addBox(group, trim, 2.92, 0.035, 0.09, x, -1.85, -4.25, -0.18);
  }

  // Holographic navigation volume in the center of the shelf.
  const holoGroup = new THREE.Group();
  holoGroup.position.set(0, -0.72, -4.02);
  group.add(holoGroup);

  const holoPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({
      map: makeHoloTexture(),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  holoPlane.position.z = -0.18;
  holoGroup.add(holoPlane);

  const holoRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.008, 6, 52),
    new THREE.MeshBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.66,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  holoRing.rotation.x = 0.32;
  holoGroup.add(holoRing);

  const holoRingB = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.006, 6, 44),
    new THREE.MeshBasicMaterial({
      color: AMBER,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  holoRingB.rotation.set(0.9, 0.4, 0.2);
  holoGroup.add(holoRingB);

  const holoCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.17, 1),
    new THREE.MeshBasicMaterial({
      color: 0xaef5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  holoGroup.add(holoCore);

  // A thin, elevated instrument rail above the centre screen.
  addBox(group, structure, 4.35, 0.1, 0.12, 0, -0.32, -4.36);
  for (let i = 0; i < 7; i += 1) {
    addBox(group, i % 3 === 0 ? amber : cyan, 0.07, 0.07, 0.035, -1.5 + i * 0.5, -0.3, -4.28);
  }

  // Cockpit pillars / canopy sill.  These frame the view without closing it.
  for (const side of [-1, 1]) {
    addTube(group, structure, [
      new THREE.Vector3(side * 4.12, -2.0, -4.0),
      new THREE.Vector3(side * 3.9, -0.4, -3.72),
      new THREE.Vector3(side * 3.32, 1.72, -3.36),
    ], 0.105);

    addTube(group, trim, [
      new THREE.Vector3(side * 4.15, -1.95, -3.94),
      new THREE.Vector3(side * 3.93, -0.42, -3.68),
      new THREE.Vector3(side * 3.34, 1.67, -3.34),
    ], 0.023);

    addTube(group, cyan, [
      new THREE.Vector3(side * 4.12, -0.35, -3.92),
      new THREE.Vector3(side * 3.92, 0.48, -3.75),
    ], 0.012, 8);

    addBox(group, structure, 0.16, 2.65, 1.7, side * 4.38, -0.55, -3.15, 0, side * -0.2);
    addBox(group, trim, 0.04, 1.55, 0.05, side * 4.28, -0.5, -3.86);
  }

  addTube(group, structure, [
    new THREE.Vector3(-3.34, 1.71, -3.36),
    new THREE.Vector3(0, 1.94, -3.17),
    new THREE.Vector3(3.34, 1.71, -3.36),
  ], 0.11);
  addTube(group, trim, [
    new THREE.Vector3(-3.3, 1.66, -3.31),
    new THREE.Vector3(0, 1.88, -3.12),
    new THREE.Vector3(3.3, 1.66, -3.31),
  ], 0.022);

  // Overhead switchgear and small running lights.
  addBox(group, panel, 3.9, 0.16, 0.72, 0, 1.67, -3.55, 0.16);
  addBox(group, trim, 3.3, 0.025, 0.04, 0, 1.57, -3.23);
  for (let i = 0; i < 5; i += 1) {
    addBox(group, i === 2 ? amber : cyan, 0.065, 0.06, 0.045, -1.2 + i * 0.6, 1.58, -3.22);
  }

  // Lower deck lip and the centre control column.
  addBox(group, structure, 5.8, 0.36, 2.2, 0, -2.72, -3.55);
  addBox(group, panel, 2.9, 0.18, 0.8, 0, -2.48, -3.28, -0.08);
  addBox(group, trim, 0.52, 0.06, 0.34, 0, -2.33, -3.2);

  const yokeBase = addBox(group, dark, 0.32, 0.78, 0.35, 0, -2.1, -3.24, -0.18);
  yokeBase.material = dark;
  for (const side of [-1, 1]) {
    addBox(group, trim, 0.52, 0.11, 0.12, side * 0.46, -1.73, -3.23, 0, 0, side * 0.12);
    addBox(group, panel, 0.46, 0.13, 0.18, side * 0.67, -1.64, -3.2, 0, 0, side * 0.12);
    addBox(group, side < 0 ? cyan : amber, 0.19, 0.035, 0.05, side * 0.67, -1.55, -3.12);
  }

  // A few deliberate fasteners and service lights for scale.
  for (let i = 0; i < 9; i += 1) {
    addBox(group, trim, 0.035, 0.035, 0.025, -3.8 + i * 0.95, -2.19, -3.03);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      addBox(group, cyanDim, 0.05, 0.02, 0.02, side * 3.74, -1.83 + i * 0.31, -2.45);
    }
  }

  const keyLight = new THREE.PointLight(0x7bdfff, 18, 6.5, 2);
  keyLight.position.set(-0.8, 0.8, -2.4);
  group.add(keyLight);

  const warmLight = new THREE.PointLight(0xffb36b, 7, 4.6, 2);
  warmLight.position.set(2.2, -0.5, -3.1);
  group.add(warmLight);

  const pulseLights = [];
  group.traverse((mesh) => {
    if (mesh.isMesh && mesh.material && mesh.material.color) {
      const hex = mesh.material.color.getHex();
      if (hex === AMBER || hex === CYAN) pulseLights.push(mesh);
    }
  });

  let active = false;
  let elapsed = 0;

  return {
    group,
    setActive(next) {
      active = Boolean(next);
      group.visible = active;
    },
    get active() {
      return active;
    },
    update(dt, warp = 0) {
      if (!active) return;
      elapsed += dt;
      const pulse = 0.72 + Math.sin(elapsed * 2.7) * 0.16;
      holoPlane.material.opacity = (0.7 + Math.sin(elapsed * 1.9) * 0.1) * Math.min(1, 0.45 + warp);
      holoPlane.material.opacity = Math.max(0.12, holoPlane.material.opacity);
      holoRing.rotation.z += dt * 0.55;
      holoRing.rotation.y += dt * 0.22;
      holoRingB.rotation.z -= dt * 0.8;
      holoRingB.rotation.x += dt * 0.3;
      holoCore.rotation.y += dt * 0.85;
      holoCore.rotation.x += dt * 0.32;
      keyLight.intensity = 16 + Math.sin(elapsed * 1.7) * 2.2;
      for (let i = 0; i < pulseLights.length; i += 1) {
        const light = pulseLights[i];
        if (light.material.transparent) {
          light.material.opacity = clamp01(pulse + Math.sin(elapsed * 3.1 + i) * 0.16);
        }
      }
    },
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}