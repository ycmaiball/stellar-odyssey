/* ===================================================================== */
/*  NX-07 ORBITAL DRYDOCK — 3D ASSEMBLY VIEW                             */
/*  The 2D interface remains authoritative for data; this scene mirrors   */
/*  it in a docked, animated three-dimensional presentation.              */
/* ===================================================================== */

import * as THREE from 'three';
import { createShip } from '../src/ship.js';
import { createWarpCockpit } from '../src/cockpit.js';
import { createSkyTexture } from '../src/textures.js';

(() => {
  'use strict';

  if (window.__SHIPYARD_3D__) return;

  const stage = document.getElementById('ship-stage');
  const canvas = document.getElementById('assembly-canvas');
  if (!stage || !canvas) return;

  const dockOverlay = document.getElementById('dock-overlay');
  const dockFill = document.getElementById('dock-progress-fill');
  const dockCopy = document.getElementById('dock-copy');
  const dockTitle = document.getElementById('dock-title');
  const skipDock = document.getElementById('btn-skip-dock');
  const sceneStatus = document.getElementById('scene-status');
  const decomposeButton = document.getElementById('btn-decompose');
  const decorToggle = document.getElementById('btn-decor-toggle');
  const decorPanel = document.getElementById('decor-panel');

  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tempVec = new THREE.Vector3();
  const tempVecB = new THREE.Vector3();
  const tempVecC = new THREE.Vector3();
  const launchCockpitPosition = new THREE.Vector3();
  const launchNosePoint = new THREE.Vector3();
  let launchOverlayEl = null;
  const launchCockpitQuaternion = new THREE.Quaternion();
  const launchExternalQuaternion = new THREE.Quaternion();

  let bootAttempts = 0;
  let launching = false;
  let launchStarted = 0;
  let launchDurationMs = 3100;
  let launchField = null;
  let launchCockpitRig = null;
  let launchCockpitBlend = 0;
  let launchSky = null;

  /* ------------------------------------------------------------------ */
  /* Materials                                                           */
  /* ------------------------------------------------------------------ */

  const M = {
    ink: new THREE.MeshStandardMaterial({ color: 0x060b0f, metalness: 0.72, roughness: 0.34 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x111a21, metalness: 0.74, roughness: 0.38 }),
    graphite: new THREE.MeshStandardMaterial({ color: 0x26333b, metalness: 0.68, roughness: 0.42 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x68757a, metalness: 0.78, roughness: 0.33 }),
    face: new THREE.MeshStandardMaterial({ color: 0x8b9697, metalness: 0.6, roughness: 0.36 }),
    ivory: new THREE.MeshPhysicalMaterial({
      color: 0xc9c0ae, metalness: 0.18, roughness: 0.5, clearcoat: 0.22, clearcoatRoughness: 0.42,
    }),
    warm: new THREE.MeshStandardMaterial({ color: 0xb8946a, metalness: 0.24, roughness: 0.48 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xc27b4f, metalness: 0.58, roughness: 0.36 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd7ae63, metalness: 0.62, roughness: 0.29 }),
    station: new THREE.MeshStandardMaterial({ color: 0x344852, metalness: 0.76, roughness: 0.34 }),
    stationDark: new THREE.MeshStandardMaterial({ color: 0x14222a, metalness: 0.7, roughness: 0.4 }),
    stationPanel: new THREE.MeshStandardMaterial({ color: 0x1b2c35, metalness: 0.58, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x1a4652, metalness: 0.1, roughness: 0.12, transparent: true, opacity: 0.38,
      transmission: 0.25, clearcoat: 1, clearcoatRoughness: 0.1,
    }),
    cyan: new THREE.MeshBasicMaterial({ color: 0x6ce7ff, toneMapped: false }),
    cyanSoft: new THREE.MeshBasicMaterial({
      color: 0x6ce7ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending,
      toneMapped: false, depthWrite: false,
    }),
    amber: new THREE.MeshBasicMaterial({ color: 0xffb466, toneMapped: false }),
    amberSoft: new THREE.MeshBasicMaterial({
      color: 0xffb466, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending,
      toneMapped: false, depthWrite: false,
    }),
    field: new THREE.MeshBasicMaterial({
      color: 0x67d9ff, transparent: true, opacity: 0.075, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }),
    star: new THREE.PointsMaterial({ color: 0xc9efff, size: 0.8, sizeAttenuation: true, transparent: true, opacity: 0.78 }),
    starDim: new THREE.PointsMaterial({ color: 0x93b7d4, size: 0.45, sizeAttenuation: true, transparent: true, opacity: 0.5 }),
  };

  function accentMaterial(color, opacity = 0.9) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
  }

  const ENGINE_COLORS = {
    'engine-ion': 0x6ce7ff,
    'engine-pulse': 0xffb466,
    'engine-fusion': 0xb7f4ff,
    'engine-singularity': 0xb49cff,
  };
  const WEAPON_COLORS = {
    'weapon-pulse': 0x8fefff,
    'weapon-beam': 0x66c8ff,
    'weapon-rail': 0xffc47b,
    'weapon-torpedo': 0xff9d6d,
  };

  /* ------------------------------------------------------------------ */
  /* Geometry helpers                                                    */
  /* ------------------------------------------------------------------ */

  function addMesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function addBox(parent, width, height, depth, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const mesh = addMesh(parent, new THREE.BoxGeometry(width, height, depth), material, x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
  }

  function addCylinder(parent, radiusTop, radiusBottom, height, material, x = 0, y = 0, z = 0, axis = 'y', segments = 18) {
    const mesh = addMesh(
      parent,
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, false),
      material, x, y, z,
    );
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    return mesh;
  }

  function addTorus(parent, radius, tube, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, radial = 8, tubular = 56) {
    const mesh = addMesh(parent, new THREE.TorusGeometry(radius, tube, radial, tubular), material, x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
  }

  function addSphere(parent, radius, material, x = 0, y = 0, z = 0, segments = 20, scale = null) {
    const mesh = addMesh(parent, new THREE.SphereGeometry(radius, segments, Math.max(8, Math.round(segments * 0.65))), material, x, y, z);
    if (scale) mesh.scale.set(scale.x, scale.y, scale.z);
    return mesh;
  }

  function addPipe(parent, start, end, radius, material, segments = 8) {
    const direction = tempVecC.copy(end).sub(start);
    const length = direction.length();
    if (length < 0.0001) return null;
    const mesh = addMesh(
      parent,
      new THREE.CylinderGeometry(radius, radius, length, segments, 1, false),
      material,
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      (start.z + end.z) / 2,
    );
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  function makeGlowTexture() {
    const size = 128;
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = textureCanvas.height = size;
    const context = textureCanvas.getContext('2d');
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.18, 'rgba(180,242,255,0.9)');
    gradient.addColorStop(0.45, 'rgba(92,212,255,0.3)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const glowTexture = makeGlowTexture();

  function addGlowSprite(parent, color, opacity, scale, x = 0, y = 0, z = 0) {
    const material = new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(scale);
    parent.add(sprite);
    return sprite;
  }

  /* ------------------------------------------------------------------ */
  /* Stars                                                               */
  /* ------------------------------------------------------------------ */

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function createStars() {
    const group = new THREE.Group();
    const random = seededRandom(0x4e583037);

    const nearCount = 1700;
    const nearPositions = new Float32Array(nearCount * 3);
    const nearColors = new Float32Array(nearCount * 3);
    for (let i = 0; i < nearCount; i += 1) {
      const radius = 185 + random() * 420;
      const theta = random() * TAU;
      const y = random() * 2 - 1;
      const horizontal = Math.sqrt(1 - y * y);
      nearPositions[i * 3] = radius * horizontal * Math.cos(theta);
      nearPositions[i * 3 + 1] = radius * y;
      nearPositions[i * 3 + 2] = radius * horizontal * Math.sin(theta);
      const warm = random() > 0.82;
      const color = new THREE.Color(warm ? 0xffd0a1 : 0xa9ddff);
      color.multiplyScalar(0.55 + random() * 0.7);
      nearColors[i * 3] = color.r;
      nearColors[i * 3 + 1] = color.g;
      nearColors[i * 3 + 2] = color.b;
    }
    const nearGeometry = new THREE.BufferGeometry();
    nearGeometry.setAttribute('position', new THREE.BufferAttribute(nearPositions, 3));
    nearGeometry.setAttribute('color', new THREE.BufferAttribute(nearColors, 3));
    const nearMaterial = new THREE.PointsMaterial({
      size: 0.92, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false,
    });
    group.add(new THREE.Points(nearGeometry, nearMaterial));

    const farCount = 1300;
    const farPositions = new Float32Array(farCount * 3);
    for (let i = 0; i < farCount; i += 1) {
      const radius = 560 + random() * 420;
      const theta = random() * TAU;
      const y = random() * 2 - 1;
      const horizontal = Math.sqrt(1 - y * y);
      farPositions[i * 3] = radius * horizontal * Math.cos(theta);
      farPositions[i * 3 + 1] = radius * y;
      farPositions[i * 3 + 2] = radius * horizontal * Math.sin(theta);
    }
    const farGeometry = new THREE.BufferGeometry();
    farGeometry.setAttribute('position', new THREE.BufferAttribute(farPositions, 3));
    group.add(new THREE.Points(farGeometry, M.starDim));

    const nebulaColors = [0x20506d, 0x3e315e, 0x6b4a35, 0x1c5b60];
    const nebulaSpots = [
      [-240, 110, -360, 240, 0.12],
      [310, -90, -280, 280, 0.09],
      [-60, 210, -420, 340, 0.075],
      [160, -210, 170, 220, 0.055],
    ];
    nebulaSpots.forEach((spot, index) => {
      addGlowSprite(group, nebulaColors[index], spot[4], spot[3], spot[0], spot[1], spot[2]);
    });

    return group;
  }

  function createLaunchField() {
    const group = new THREE.Group();
    group.name = 'LIGHT-SPEED-WARP-FIELD';
    const random = seededRandom(0x57415250);
    const count = 240;
    const positions = new Float32Array(count * 6);
    for (let i = 0; i < count; i += 1) {
      const angle = random() * TAU;
      const radius = 5 + Math.pow(random(), 0.58) * 72;
      const z = -28 - random() * 330;
      const length = 7 + random() * 66;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.72;
      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x * 1.015;
      positions[i * 6 + 4] = y * 1.015;
      positions[i * 6 + 5] = z - length;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xc2f5ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    group.add(lines);
    group.visible = false;
    group.userData.material = material;
    return group;
  }

  /* ------------------------------------------------------------------ */
  /* Drydock                                                             */
  /* ------------------------------------------------------------------ */

  function buildDrydock() {
    const group = new THREE.Group();
    group.name = 'ORBITAL-DRYDOCK';
    const arms = [];
    const beaconMaterials = [];

    const ringZ = [-18, 18];
    ringZ.forEach((z, ringIndex) => {
      addTorus(group, 34, 0.42, M.station, 0, 0, z, 0, 0, 0, 8, 160);
      addTorus(group, 34, 0.055, M.cyanSoft, 0, 0, z, 0, 0, 0, 4, 160);

      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * TAU;
        /* Keep the far ring dressed with heavy panels, but leave the near
           ring open. Large near-side slabs used to read as black debris
           across the ship and hid the assembly. */
        if (ringIndex === 0) {
          const panel = addBox(
            group, 5.8, 0.24, 2.2, M.stationPanel,
            Math.cos(angle) * 36, Math.sin(angle) * 36, z,
            0, 0, angle + Math.PI / 2,
          );
          panel.castShadow = false;
        } else {
          const pad = addBox(
            group, 1.5, 0.16, 0.72, i % 4 === 0 ? M.station : M.stationDark,
            Math.cos(angle) * 34, Math.sin(angle) * 34, z - 0.18,
            0, 0, angle + Math.PI / 2,
          );
          pad.castShadow = false;
        }

        const lightStrip = addBox(
          group, ringIndex === 0 ? 3.4 : 1.1, 0.035, 0.055,
          i % 3 === 0 ? M.amberSoft : M.cyanSoft,
          Math.cos(angle) * 36, Math.sin(angle) * 36, z + 1.46,
          0, 0, angle + Math.PI / 2,
        );
        lightStrip.renderOrder = 3;
      }

      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * TAU;
        const light = addSphere(group, 0.12, i % 2 ? M.amber : M.cyan,
          Math.cos(angle) * 35.1, Math.sin(angle) * 35.1, z + 0.45, 10);
        beaconMaterials.push(light);
      }

      const clampRing = addTorus(group, 24.5, 0.09, M.cyanSoft, 0, 0, z, 0, 0, 0, 4, 128);
      clampRing.rotation.z = ringIndex * 0.2;
    });

    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * TAU;
      const x = Math.cos(angle) * 34;
      const y = Math.sin(angle) * 34;
      addPipe(group, new THREE.Vector3(x, y, -18), new THREE.Vector3(x, y, 18), 0.17, M.station, 8);
      const braceAngle = angle + TAU / 16;
      addPipe(
        group,
        new THREE.Vector3(x, y, -18),
        new THREE.Vector3(Math.cos(braceAngle) * 34, Math.sin(braceAngle) * 34, 18),
        0.075,
        M.stationDark,
        6,
      );
    }

    // A high gantry and a lower cradle give the bay a believable scale.
    addBox(group, 72, 0.55, 2.2, M.station, 0, 31, 5);
    addBox(group, 72, 0.08, 0.15, M.cyanSoft, 0, 30.7, 3.86);
    [-31, 31].forEach((x) => {
      addBox(group, 1.3, 12, 1.3, M.stationDark, x, 25, 5);
      addBox(group, 2.2, 1.1, 2.2, M.station, x, 31.1, 5);
      addSphere(group, 0.16, M.amber, x, 27.5, 3.85, 10);
    });
    addBox(group, 5.2, 1.1, 4.2, M.station, 0, 32.2, 5);

    [-1, 1].forEach((side) => {
      addBox(group, 14, 0.7, 2.2, M.station, side * 13, -21.5, -2);
      addBox(group, 14, 0.12, 0.16, M.cyanSoft, side * 13, -21.1, -3.2);
      addBox(group, 1.8, 4.2, 1.8, M.stationDark, side * 23, -18.4, -2);
    });

    // Four sliding magnetic clamps.
    [-1, 1].forEach((side) => {
      [-7, 7].forEach((y) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * 41, y, 8);
        group.add(pivot);

        addBox(pivot, 13, 0.42, 0.52, M.station, -side * 6.5, 0, 0);
        addBox(pivot, 8, 0.12, 0.18, M.stationDark, -side * 6.5, 0.25, 0);
        const clamp = addBox(pivot, 2.1, 1.15, 2.2, M.graphite, -side * 13.8, 0, 0);
        clamp.rotation.y = side * 0.07;
        addBox(pivot, 1.05, 0.12, 2.35, M.cyanSoft, -side * 14.9, 0.25, 0);
        addSphere(pivot, 0.12, M.amber, -side * 14.9, 0.7, 0.7, 9);
        arms.push({ group: pivot, openX: side * 41, closedX: side * 25.5 });
      });
    });

    // Scan gate and navigational arc.
    const scanGate = addTorus(group, 27.5, 0.055, M.cyanSoft, 0, 0, 4.2, 0, 0, 0, 4, 128);
    scanGate.name = 'SCAN-GATE';

    addGlowSprite(group, 0x54c6ef, 0.14, 54, 0, 6, -28);
    addGlowSprite(group, 0xffa960, 0.07, 36, 26, -11, 6);

    const keyLight = new THREE.PointLight(0x78e6ff, 1200, 150, 2);
    keyLight.position.set(-10, 18, 24);
    group.add(keyLight);
    const warmLight = new THREE.PointLight(0xffb173, 850, 130, 2);
    warmLight.position.set(24, -8, 10);
    group.add(warmLight);

    return { group, arms, scanGate, beaconMaterials };
  }

  /* ------------------------------------------------------------------ */
  /* 3D part catalogue models                                            */
  /* ------------------------------------------------------------------ */

  function engineModel(part) {
    const group = new THREE.Group();
    const accent = accentMaterial(ENGINE_COLORS[part.id] || 0x6ce7ff, 0.94);
    const heavy = part.id === 'engine-singularity';
    const fusion = part.id === 'engine-fusion';
    const radius = heavy ? 2.65 : fusion ? 2.18 : 1.52;

    addCylinder(group, radius, radius * 1.08, 2.9, M.graphite, 0, 0, 1.3, 'z', 24);
    addCylinder(group, radius * 1.2, radius * 1.05, 0.34, M.ivory, 0, 0, 0.25, 'z', 24);
    addTorus(group, radius + 0.3, 0.08, M.steel, 0, 0, 0.75, 0, 0, 0, 8, 40);
    addTorus(group, radius + 0.38, 0.11, M.copper, 0, 0, 2.6, 0, 0, 0, 8, 40);
    addTorus(group, radius + 0.2, 0.06, M.cyanSoft, 0, 0, 2.78, 0, 0, 0, 4, 40);

    for (let i = 0; i < 3; i += 1) {
      addTorus(group, radius + 0.16, 0.045, M.stationDark, 0, 0, 0.9 + i * 0.52, 0, 0, 0, 5, 36);
    }

    addCylinder(group, radius * 0.82, radius * 0.5, 2.1, M.dark, 0, 0, 3.65, 'z', 20);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.57, 24), accent);
    inner.position.z = 4.76;
    group.add(inner);
    const orb = addSphere(group, radius * 0.32, accent, 0, 0, 4.78, 16);
    orb.scale.z = 0.5;

    // Exposed plumbing and ceramic runner.
    [-1, 1].forEach((side) => {
      addPipe(
        group,
        new THREE.Vector3(side * radius * 0.72, 0.65, 0.35),
        new THREE.Vector3(side * radius * 0.72, 0.65, 3.4),
        0.055,
        M.copper,
        7,
      );
      addBox(group, 0.22, 1.05, 1.9, M.steel, side * (radius + 0.33), 0.08, 1.5);
    });

    if (fusion) {
      addTorus(group, radius + 0.56, 0.17, M.steel, 0, 0, 1.65, 0, 0, 0, 8, 40);
      addTorus(group, radius + 0.42, 0.08, M.cyanSoft, 0, 0, 1.9, 0, 0, 0, 4, 40);
    }
    if (heavy) {
      addTorus(group, radius + 0.24, 0.16, M.ivory, 0, 0, 1.2, 0, 0, 0, 8, 44);
      addTorus(group, radius + 0.85, 0.09, M.cyanSoft, 0, 0, 2.95, 0, 0, 0, 4, 44);
    }
    if (part.id === 'engine-pulse') {
      [-0.78, 0.78].forEach((x) => {
        addCylinder(group, 0.52, 0.34, 1.8, M.dark, x, 0, 4.3, 'z', 16);
        const glow = new THREE.Mesh(new THREE.CircleGeometry(0.29, 16), accent);
        glow.position.set(x, 0, 5.2);
        group.add(glow);
      });
    }

    addGlowSprite(group, ENGINE_COLORS[part.id] || 0x6ce7ff, 0.72, radius * 2.2, 0, 0, 4.82);
    group.userData.partId = part.id;
    return group;
  }

  function weaponModel(part) {
    const group = new THREE.Group();
    const accent = accentMaterial(WEAPON_COLORS[part.id] || 0x8fefff, 0.9);

    addBox(group, 1.7, 0.65, 2.4, M.graphite, 0, 0.1, 0);
    addBox(group, 1.2, 0.18, 1.9, M.steel, 0, 0.5, 0.1);

    if (part.id === 'weapon-pulse') {
      [-0.42, 0.42].forEach((x) => {
        addCylinder(group, 0.17, 0.17, 3.4, M.steel, x, 0.15, -2.1, 'z', 10);
        addTorus(group, 0.26, 0.045, M.copper, x, 0.15, 0.1, 0, 0, 0, 6, 24);
        const muzzle = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), accent);
        muzzle.position.set(x, 0.15, -3.84);
        group.add(muzzle);
      });
    } else if (part.id === 'weapon-beam') {
      addCylinder(group, 0.21, 0.16, 4.9, M.steel, 0, 0.12, -2.8, 'z', 12);
      addTorus(group, 0.36, 0.06, M.copper, 0, 0.12, -0.8, 0, 0, 0, 6, 30);
      const emitter = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), accent);
      emitter.position.set(0, 0.12, -5.28);
      group.add(emitter);
      addBox(group, 0.18, 0.16, 2.3, M.cyanSoft, 0, 0.48, -2.1);
    } else if (part.id === 'weapon-rail') {
      addBox(group, 0.8, 0.35, 5.2, M.steel, 0, 0.15, -2.8);
      [-0.55, 0.55].forEach((x) => {
        addBox(group, 0.12, 0.12, 4.7, M.copper, x, 0.33, -2.6);
      });
      for (let i = 0; i < 5; i += 1) {
        addTorus(group, 0.43, 0.065, M.copper, 0, 0.1, -0.8 - i * 0.7, 0, 0, 0, 6, 28);
      }
      addBox(group, 0.3, 0.22, 0.8, accent, 0, 0.05, -5.45);
    } else {
      addBox(group, 2.2, 1.25, 3.2, M.dark, 0, 0.12, -0.5);
      [-0.62, 0.62].forEach((x) => {
        [-0.45, 0.45].forEach((y) => {
          addCylinder(group, 0.22, 0.22, 2.6, M.steel, x, y, -2.6, 'z', 10);
          const glow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), accent);
          glow.position.set(x, y, -3.92);
          group.add(glow);
        });
      });
      addBox(group, 1.5, 0.18, 1.1, M.copper, 0, 0.72, -0.9);
    }

    group.userData.partId = part.id;
    return group;
  }

  function shieldModel(part) {
    const group = new THREE.Group();
    const accent = accentMaterial(part.id === 'shield-aegis' ? 0x9df4ff : 0x6ce7ff, 0.75);

    addBox(group, 1.15, 2.25, 2.65, M.graphite, 0, 0, 0);
    addBox(group, 0.38, 1.45, 1.8, M.ivory, 0.32, 0.28, 0);
    addTorus(group, 1.6, 0.075, M.steel, 0, 0, 0, 0, Math.PI / 2, 0, 7, 38);
    addTorus(group, 1.45, 0.035, accent, 0, 0, 0, 0, Math.PI / 2, 0, 4, 38);
    addSphere(group, 0.32, accent, 0, 0, 0, 16);

    const bubble = addSphere(group, 3.4, M.field, 0, 0, 0, 24, { x: 0.48, y: 1, z: 1 });
    bubble.renderOrder = 1;
    addGlowSprite(group, 0x6ce7ff, 0.32, 4.1, 0, 0, 0);

    group.userData.partId = part.id;
    return group;
  }

  function cockpitModel(part) {
    const group = new THREE.Group();
    const command = part.id === 'cockpit-command';
    const neural = part.id === 'cockpit-neural';
    const width = command ? 3.5 : neural ? 2.45 : 2.1;
    const glassColor = neural ? 0x14343d : 0x245763;

    addBox(group, width, 0.38, 4.1, M.graphite, 0, 0.2, 0);
    addBox(group, width * 0.8, 0.2, 3.3, M.ivory, 0, 0.52, -0.1);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshPhysicalMaterial({
      color: glassColor, metalness: 0.2, roughness: 0.08, transparent: true, opacity: 0.44,
      transmission: 0.32, clearcoat: 1, clearcoatRoughness: 0.06,
    }));
    glass.scale.set(command ? 1.8 : 1.25, 0.58, 2.0);
    glass.position.set(0, 0.82, -0.35);
    group.add(glass);

    addBox(group, width * 0.92, 0.09, 0.09, M.cyanSoft, 0, 0.75, -2.05);
    [-1, 1].forEach((side) => {
      addBox(group, 0.12, 0.65, 3.5, M.steel, side * width * 0.46, 0.4, 0);
      addPipe(
        group,
        new THREE.Vector3(side * width * 0.4, 0.05, 1.7),
        new THREE.Vector3(side * width * 0.4, 0.05, 2.7),
        0.045,
        M.copper,
        7,
      );
    });
    if (command) {
      addBox(group, 1.2, 0.3, 1.0, M.amberSoft, 0, 0.43, -2.2);
      addBox(group, 0.18, 1.6, 0.18, M.steel, 0, 1.15, 1.6);
    } else if (neural) {
      addBox(group, 1.5, 0.1, 0.14, M.cyan, 0, 0.72, -2.3);
      addTorus(group, 0.45, 0.035, M.cyanSoft, 0, 0.6, 1.55, Math.PI / 2, 0, 0, 4, 24);
    } else {
      addBox(group, 0.8, 0.12, 0.5, M.amberSoft, 0, 0.54, 1.4);
    }
    group.userData.partId = part.id;
    return group;
  }

  function tailModel(part) {
    const group = new THREE.Group();
    const accent = accentMaterial(part.id === 'tail-curve' ? 0x9df4ff : 0xffb466, 0.8);

    addBox(group, 1.0, 0.6, 2.1, M.graphite, 0, 0, 0);
    if (part.id === 'tail-vector') {
      addBox(group, 0.16, 3.8, 2.9, M.ivory, 0, 2.0, 0.5, -0.16, 0, 0);
      [-1, 1].forEach((side) => {
        addBox(group, 4.0, 0.14, 1.8, M.ivory, side * 2.1, 1.1, 0.1, 0, side * 0.14, side * 0.08);
        addBox(group, 2.1, 0.34, 0.55, M.dark, side * 2.2, 0.72, 0.5);
      });
    } else if (part.id === 'tail-curve') {
      [-1, 1].forEach((side) => {
        addBox(group, 3.5, 0.15, 2.3, M.ivory, side * 1.9, 1.5, 0.2, 0, side * 0.5, side * 0.2);
        addBox(group, 0.1, 0.14, 1.9, accent, side * 2.5, 1.72, 0.02);
      });
      addBox(group, 0.14, 2.5, 2.0, M.steel, 0, 1.3, 0.1);
    } else {
      addBox(group, 0.14, 4.5, 2.0, M.ivory, 0, 2.3, 0.1, -0.22, 0, 0);
      addBox(group, 0.14, 2.9, 1.25, M.steel, 0, 4.1, 0.42, 0.1, 0, 0);
      addTorus(group, 0.55, 0.04, M.cyanSoft, 0, 5.5, 0.2, Math.PI / 2, 0, 0, 4, 24);
      addSphere(group, 0.12, M.cyan, 0, 5.52, 0.2, 10);
    }
    addBox(group, 3.6, 0.08, 0.14, accent, 0, 0.42, -0.8);
    group.userData.partId = part.id;
    return group;
  }

  function hullModel(part) {
    const group = new THREE.Group();
    if (part.id === 'hull-scout') {
      addSphere(group, 0.86, M.graphite, 0, 4.8, 2.2, 20);
      addSphere(group, 0.62, M.cyanSoft, 0, 4.8, 2.2, 20);
      addCylinder(group, 0.04, 0.22, 2.4, M.steel, 0, 5.4, -4.2, 'y', 8);
      addBox(group, 4.6, 0.12, 0.18, M.cyanSoft, 0, 4.28, -1.4);
      [-1, 1].forEach((side) => {
        addBox(group, 0.45, 0.55, 8.3, M.ivory, side * 5.05, 1.35, 1.2, 0, side * 0.03, side * 0.08);
        addBox(group, 0.06, 0.08, 4.4, M.cyanSoft, side * 5.27, 1.52, 0.5);
      });
    } else if (part.id === 'hull-line') {
      [-1, 1].forEach((side) => {
        addBox(group, 1.4, 1.4, 12.8, M.warm, side * 5.2, 1.3, 0.5, 0, side * 0.04, side * 0.05);
        addBox(group, 0.35, 0.3, 10.6, M.graphite, side * 5.85, 1.8, 0.5);
        addBox(group, 0.7, 0.8, 3.4, M.ivory, side * 4.8, 2.5, 7.3, 0, side * 0.08, 0);
      });
      addBox(group, 2.5, 0.64, 6.2, M.graphite, 0, 4.6, 7.6);
      addBox(group, 1.8, 0.12, 3.4, M.cyanSoft, 0, 4.94, 7.6);
    } else {
      [-1, 1].forEach((side) => {
        addBox(group, 2.2, 2.0, 14.7, M.ivory, side * 5.2, 0.9, 0.4, 0, side * 0.07, side * 0.04);
        addBox(group, 1.1, 0.7, 8.6, M.graphite, side * 6.15, 1.4, 1.0);
        addBox(group, 0.44, 0.42, 6.0, M.copper, side * 5.55, 2.2, 0.5);
        addBox(group, 1.4, 0.55, 3.3, M.dark, side * 4.3, -2.2, 3.2);
        addBox(group, 0.08, 0.12, 4.2, M.amberSoft, side * 6.45, 1.18, 0.5);
      });
      addBox(group, 3.2, 1.0, 5.5, M.graphite, 0, 4.1, -9.0);
      addBox(group, 2.3, 0.16, 3.8, M.cyanSoft, 0, 4.65, -9.0);
      addBox(group, 2.4, 0.65, 3.2, M.ivory, 0, -0.8, -21.5);
      [-1, 1].forEach((side) => {
        addBox(group, 1.3, 0.5, 4.2, M.ivory, side * 2.2, 0.4, -21.8, 0.18, side * 0.2, 0);
      });
    }
    group.userData.partId = part.id;
    return group;
  }

  function decorModel(part) {
    const group = new THREE.Group();
    if (part.id === 'decor-plate') {
      addBox(group, 0.95, 0.1, 1.65, M.ivory, 0, 0, 0, 0.08, 0, 0);
      addBox(group, 0.62, 0.03, 1.2, M.warm, 0, 0.07, 0);
    } else if (part.id === 'decor-antenna') {
      addCylinder(group, 0.035, 0.035, 2.7, M.steel, 0, 1.35, 0, 'y', 6);
      addBox(group, 0.75, 0.05, 0.05, M.steel, 0, 1.9, 0);
      addSphere(group, 0.11, M.cyan, 0, 2.72, 0, 9);
    } else if (part.id === 'decor-vent') {
      for (let i = 0; i < 3; i += 1) {
        addBox(group, 0.85, 0.06, 0.72, M.steel, 0, i * 0.22, 0, -0.24, 0, 0);
      }
      addBox(group, 1.0, 0.05, 0.85, M.dark, 0, -0.16, 0);
    } else if (part.id === 'decor-beacon') {
      addSphere(group, 0.16, M.amber, 0, 0.3, 0, 14);
      addTorus(group, 0.4, 0.035, M.copper, 0, 0.3, 0, Math.PI / 2, 0, 0, 5, 20);
      addGlowSprite(group, 0xffb466, 0.55, 1.2, 0, 0.3, 0);
    } else if (part.id === 'decor-drone') {
      addBox(group, 0.62, 0.42, 0.84, M.graphite, 0, 0.28, 0);
      addTorus(group, 0.4, 0.035, M.steel, 0, 0.34, 0, 0, 0, 0, 5, 20);
      addBox(group, 0.28, 0.08, 0.28, M.cyanSoft, 0, 0.55, 0);
    } else if (part.id === 'decor-stripe') {
      addBox(group, 1.7, 0.03, 0.2, M.gold, 0, 0.04, 0);
      addBox(group, 0.55, 0.05, 0.22, M.ivory, -0.72, 0.05, 0);
    } else if (part.id === 'decor-lamp') {
      addSphere(group, 0.12, M.amber, 0, 0.12, 0, 10);
      addGlowSprite(group, 0xffb466, 0.65, 1.0, 0, 0.12, 0);
    } else {
      addCylinder(group, 0.36, 0.16, 0.14, M.steel, 0, 0.08, 0, 'y', 14);
      addCylinder(group, 0.035, 0.035, 1.2, M.steel, 0, 0.6, 0, 'y', 6);
      addSphere(group, 0.08, M.cyan, 0, 1.22, 0, 8);
    }
    group.userData.partId = part.id;
    return group;
  }

  function buildPartModel(part) {
    if (!part) return null;
    let model;
    switch (part.category) {
      case 'engine': model = engineModel(part); break;
      case 'weapon': model = weaponModel(part); break;
      case 'shield': model = shieldModel(part); break;
      case 'cockpit': model = cockpitModel(part); break;
      case 'tail': model = tailModel(part); break;
      case 'hull': model = hullModel(part); break;
      case 'decor': model = decorModel(part); break;
      default: model = new THREE.Group();
    }
    model.name = `PART-${part.id}`;
    return model;
  }

  /* ------------------------------------------------------------------ */
  /* Part thumbnails — one real 3D render per catalogue entry            */
  /* ------------------------------------------------------------------ */

  function renderPartThumbnails(app) {
    if (!app || typeof app.getAllParts !== 'function') return;
    if (window.__PART_THUMBS) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (error) {
      console.warn('part thumbnail renderer unavailable', error);
      return;
    }
    const SIZE = 192;
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    const thumbScene = new THREE.Scene();
    const thumbCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 4000);
    thumbScene.add(new THREE.HemisphereLight(0xd9f4ff, 0x0b1620, 1.55));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
    keyLight.position.set(4, 6, 5);
    thumbScene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x8ef0ff, 2.6);
    rimLight.position.set(-5, 2.4, -4);
    thumbScene.add(rimLight);
    const warmBounce = new THREE.PointLight(0xff6a4a, 110, 140, 2);
    warmBounce.position.set(-3, -3, 4);
    thumbScene.add(warmBounce);

    const map = {};
    const dir = new THREE.Vector3();
    const box = new THREE.Box3();
    const sizeVec = new THREE.Vector3();
    const center = new THREE.Vector3();

    app.getAllParts().forEach((part, index) => {
      const model = buildPartModel(part);
      if (!model) return;
      thumbScene.add(model);
      box.setFromObject(model);
      box.getSize(sizeVec);
      box.getCenter(center);
      const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 0.4);
      const distance = maxDim * 2.15;
      // Same matte-metal oblique family for every card, but each entry gets
      // its own azimuth/elevation step so no two previews read as copies.
      const azimuth = 0.66 + ((index % 5) - 2) * 0.13;
      const elevation = 0.54 + ((index % 3) - 1) * 0.07;
      dir.set(
        Math.cos(azimuth) * Math.cos(elevation),
        Math.sin(elevation),
        Math.sin(azimuth) * Math.cos(elevation),
      ).normalize();
      thumbCamera.position.copy(center).addScaledVector(dir, distance);
      thumbCamera.near = Math.max(0.05, distance * 0.02);
      thumbCamera.far = distance * 8;
      thumbCamera.lookAt(center);
      thumbCamera.updateProjectionMatrix();
      renderer.render(thumbScene, thumbCamera);
      try {
        map[part.id] = renderer.domElement.toDataURL('image/png');
      } catch (error) {
        /* tainted canvas — skip this entry */
      }
      thumbScene.remove(model);
      model.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
      });
    });

    renderer.dispose();
    window.__PART_THUMBS = map;
    window.dispatchEvent(new CustomEvent('shipyard:thumbs-ready', { detail: map }));
  }

  /* ------------------------------------------------------------------ */
  /* Scene boot                                                          */
  /* ------------------------------------------------------------------ */

  function boot() {
    const app = window.ShipyardApp;
    if (!app || typeof app.getSnapshot !== 'function') {
      bootAttempts += 1;
      if (bootAttempts < 160) setTimeout(boot, 50);
      return;
    }
    try {
      initScene(app);
    } catch (error) {
      fallback(error);
    }
  }

  function fallback(error) {
    console.error('NX-07 3D assembly scene failed:', error);
    if (dockOverlay) dockOverlay.style.display = 'none';
    if (canvas) canvas.style.display = 'none';
    document.body.classList.remove('has-3d', 'scene-collapsing', 'scene-docking', 'scene-ready');
    if (stage) stage.classList.add('scene-failed');
  }

  function initScene(app) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
    scene.add(camera);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const ambient = new THREE.AmbientLight(0x6f8d99, 0.38);
    scene.add(ambient);
    const hemisphere = new THREE.HemisphereLight(0x9fd9ee, 0x071018, 0.55);
    scene.add(hemisphere);
    const key = new THREE.DirectionalLight(0xfff4e8, 2.9);
    key.position.set(42, 64, 54);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x64d5ff, 3.2);
    rim.position.set(-54, 22, -42);
    scene.add(rim);
    const under = new THREE.PointLight(0x4e9dbb, 620, 90, 2);
    under.position.set(0, -20, 12);
    scene.add(under);

    const stars = createStars();
    scene.add(stars);

    const dock = buildDrydock();
    scene.add(dock.group);

    const ship = createShip();
    ship.root.name = 'NX-07-HELIOS-DOCKED';
    ship.root.position.set(0, -8, 108);
    ship.root.rotation.set(0, 0, 0.025);
    scene.add(ship.root);

    launchField = createLaunchField();
    camera.add(launchField);

    launchCockpitRig = createWarpCockpit();
    launchCockpitRig.setActive(false);
    camera.add(launchCockpitRig.group);

    /* A camera-bound galactic sky makes the first-person launch feel like
       crossing a real starfield instead of flying through empty black. */
    launchSky = new THREE.Mesh(
      new THREE.SphereGeometry(500, 48, 24),
      new THREE.MeshBasicMaterial({
        map: createSkyTexture(8),
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        color: 0xaebbd4,
      }),
    );
    launchSky.rotation.set(0.08, 1.15, 0.06);
    launchSky.renderOrder = -10;
    launchSky.visible = false;
    camera.add(launchSky);

    /* The drydock is deliberately dark; give the first-person interior its
       own soft practical lights so the dashboard reads during launch. */
    const cockpitFill = new THREE.PointLight(0x9fe7ff, 62, 7.8, 2);
    cockpitFill.position.set(0, 2.0, -2.1);
    launchCockpitRig.group.add(cockpitFill);
    const cockpitWarm = new THREE.PointLight(0xffb46b, 20, 5.8, 2);
    cockpitWarm.position.set(-1.8, -1.3, -3.0);
    launchCockpitRig.group.add(cockpitWarm);
    const cockpitSideFill = new THREE.PointLight(0x8fd7ff, 22, 6.2, 2);
    cockpitSideFill.position.set(2.5, 0.6, -2.4);
    launchCockpitRig.group.add(cockpitSideFill);

    const hullGroup = ship.partsById.get('hull').group;
    const canopyGroup = ship.partsById.get('canopy').group;
    const engineLGroup = ship.partsById.get('engine-left').group;
    const engineRGroup = ship.partsById.get('engine-right').group;

    const mounts = new Map();
    function mount(slotId, parent, x, y, z) {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      parent.add(group);
      const record = { group, slotId };
      mounts.set(slotId, record);
      return record;
    }

    mount('hull', hullGroup, 0, 0, 0);
    mount('cockpit', canopyGroup, 0, 7.2, -7.9);
    mount('engine-0', engineLGroup, 0, 0, 6.6);
    mount('engine-1', engineRGroup, 0, 0, 6.6);
    mount('weapon-0', hullGroup, -10.7, -0.1, -10.4);
    mount('weapon-1', hullGroup, 10.7, -0.1, -10.4);
    mount('shield-0', hullGroup, -11.9, 1.4, 2.0);
    mount('shield-1', hullGroup, 11.9, 1.4, 2.0);
    mount('tail', hullGroup, 0, 1.3, 26.0);

    const decorMounts = [];
    for (let index = 0; index < 54; index += 1) {
      const slotId = `decor-${index}`;
      let x;
      let y;
      let z;
      if (index < 18) {
        x = -5.3;
        y = 2.4 - (index % 4) * 1.05;
        z = -17 + index * 1.85;
      } else if (index < 36) {
        x = 5.3;
        y = 2.4 - ((index - 18) % 4) * 1.05;
        z = -17 + (index - 18) * 1.85;
      } else if (index < 48) {
        x = -5.5 + ((index - 36) % 12) * 1.0;
        y = 5.15;
        z = -15 + Math.floor((index - 36) / 12) * 24;
      } else {
        x = -5.5 + (index - 48) * 2.2;
        y = -3.5;
        z = 4.5;
      }
      const record = mount(slotId, hullGroup, x, y, z);
      record.index = index;
      decorMounts.push(record);
    }

    const coreModels = new Map();
    const decorModels = new Map();
    const tweens = [];
    const bursts = [];
    let currentSnapshot = app.getSnapshot();
    let sceneReady = false;
    let exploded = false;
    let mountedDockProgress = 0;
    let docking = true;
    let dockStart = Infinity;
    let introStarted = false;
    let introTimer = null;
    const introCollapseDelay = reducedMotion ? 140 : 560;
    const dockDuration = reducedMotion ? 900 : 3500;
    let lastInteraction = performance.now();
    let pointerId = null;
    let pointerLastX = 0;
    let pointerLastY = 0;
    let orbiting = false;
    let orbitMoved = false;
    let downX = 0;
    let downY = 0;
    let lastFrame = performance.now();
    const camState = { theta: 2.22, phi: 0.3, distance: 96 };
    const cameraTarget = new THREE.Vector3(0, 2, 2);
    let slotEls = new Map();

    const refitFx = {
      focusSlotId: null,
      focusRing: null,
      focusLight: new THREE.PointLight(0x6ce7ff, 0, 34, 2),
      dragCategory: null,
      hintSprites: [],
      pulses: [],
      sparks: [],
      waves: [],
      simMode: false,
      simRings: null,
      starBoost: 1,
      camTween: null,
    };
    scene.add(refitFx.focusLight);
    const glowTexture = makeGlowTexture();
    const lightBase = { key: 2.9, rim: 3.2, under: 620, ambient: 0.38, hemisphere: 0.55 };

    function slotCategoryOf(slotId) {
      if (slotId === 'hull') return 'hull';
      return String(slotId).replace(/-\d+$/, '');
    }

    function applyLightDim(factor) {
      key.intensity = lightBase.key * factor;
      rim.intensity = lightBase.rim * factor;
      under.intensity = lightBase.under * factor;
      ambient.intensity = lightBase.ambient * Math.max(0.55, factor);
      hemisphere.intensity = lightBase.hemisphere * Math.max(0.6, factor);
    }

    function worldPosOf(record) {
      if (!record) return new THREE.Vector3();
      ship.root.updateMatrixWorld(true);
      return record.group.getWorldPosition(new THREE.Vector3());
    }

    function clearPulseFx() {
      refitFx.pulses.forEach((item) => {
        scene.remove(item.sprite);
        item.sprite.material.dispose();
      });
      refitFx.pulses = [];
    }

    function pulseConduit(slotId) {
      const origin = mounts.get(slotId);
      if (!origin) return;
      clearPulseFx();
      const originPos = worldPosOf(origin);
      const neighbours = [];
      mounts.forEach((record) => {
        if (record === origin || record.slotId.startsWith('decor')) return;
        const distance = worldPosOf(record).distanceTo(originPos);
        neighbours.push({ record, distance });
      });
      neighbours.sort((a, b) => a.distance - b.distance);
      neighbours.slice(0, 3).forEach((entry, index) => {
        const to = worldPosOf(entry.record);
        for (let step = 0; step < 4; step += 1) {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture,
            color: index === 0 ? 0xd9fbff : 0x6ce7ff,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }));
          sprite.scale.setScalar(index === 0 ? 1.9 : 1.4);
          scene.add(sprite);
          refitFx.pulses.push({
            sprite,
            from: originPos.clone(),
            to: to.clone(),
            offset: step / 4,
            age: 0,
            life: 2.4,
            speed: 1.15 + index * 0.18,
          });
        }
      });
    }

    function focusSlot(slotId) {
      const next = slotId && mounts.has(slotId) ? slotId : null;
      refitFx.focusSlotId = next;
      if (refitFx.focusRing) {
        scene.remove(refitFx.focusRing);
        refitFx.focusRing.geometry.dispose();
        refitFx.focusRing.material.dispose();
        refitFx.focusRing = null;
      }
      applyLightDim(next ? 0.42 : (refitFx.simMode ? 0.5 : 1));
      if (!next) {
        refitFx.focusLight.intensity = 0;
        clearPulseFx();
        return;
      }
      const record = mounts.get(next);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.6, 0.055, 6, 56),
        new THREE.MeshBasicMaterial({
          color: 0x6ce7ff,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      scene.add(ring);
      refitFx.focusRing = ring;
      refitFx.focusLight.intensity = 320;
      pulseConduit(next);
      if (record) refitFx.focusLight.position.copy(worldPosOf(record).add(new THREE.Vector3(0, 1.5, 0)));
    }

    function setDragHints(category) {
      refitFx.hintSprites.forEach((sprite) => {
        scene.remove(sprite);
        sprite.material.dispose();
      });
      refitFx.hintSprites = [];
      refitFx.dragCategory = category || null;
      refitFx.starBoost = category ? 2.8 : (refitFx.simMode ? 3.4 : 1);
      if (!category) return;
      let budget = category === 'decor' ? 18 : 99;
      mounts.forEach((record) => {
        if (budget <= 0) return;
        if (slotCategoryOf(record.slotId) !== category) return;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0xffb466,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }));
        sprite.position.copy(worldPosOf(record));
        sprite.userData.baseScale = category === 'decor' ? 4.4 : 7.4;
        sprite.scale.setScalar(sprite.userData.baseScale);
        scene.add(sprite);
        refitFx.hintSprites.push(sprite);
        budget -= 1;
      });
    }

    function getMountScreen(slotId) {
      const record = mounts.get(slotId);
      if (!record || !record.group || !renderer) return null;
      const point = new THREE.Vector3();
      record.group.getWorldPosition(point);
      point.project(camera);
      if (point.z > 1 || !Number.isFinite(point.x)) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: rect.left + (point.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-point.y * 0.5 + 0.5) * rect.height,
      };
    }

    function conflictAt(slotId) {
      const record = mounts.get(slotId) || mounts.get('hull');
      const origin = worldPosOf(record);
      for (let index = 0; index < 16; index += 1) {
        const mesh = new THREE.Mesh(
          new THREE.TetrahedronGeometry(0.18 + Math.random() * 0.12),
          new THREE.MeshBasicMaterial({
            color: index % 3 === 0 ? 0xff9a6a : 0xff5a3c,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        mesh.position.copy(origin);
        scene.add(mesh);
        refitFx.sparks.push({
          mesh,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 26,
            Math.random() * 20 + 2,
            (Math.random() - 0.5) * 26,
          ),
          age: 0,
          life: 0.55 + Math.random() * 0.35,
        });
      }
    }

    function celebrate() {
      const center = new THREE.Vector3(0, 2, 4);
      for (let index = 0; index < 3; index += 1) {
        const mesh = new THREE.Mesh(
          new THREE.TorusGeometry(12, 0.22 - index * 0.04, 6, 96),
          new THREE.MeshBasicMaterial({
            color: index === 1 ? 0xffb466 : 0x9ff6ff,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        mesh.position.copy(center);
        mesh.rotation.set(Math.PI / 2 + index * 0.12, index * 0.06, 0);
        scene.add(mesh);
        refitFx.waves.push({ mesh, age: -index * 0.14, life: 1.5 });
      }
    }

    function setSimMode(active) {
      refitFx.simMode = Boolean(active);
      if (!refitFx.simRings) {
        const group = new THREE.Group();
        const colors = [0x6ce7ff, 0xffb466, 0x9ff6ff];
        for (let index = 0; index < 3; index += 1) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(24 + index * 4, 0.09, 5, 96),
            new THREE.MeshBasicMaterial({
              color: colors[index],
              transparent: true,
              opacity: 0.4 - index * 0.08,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              toneMapped: false,
            }),
          );
          ring.rotation.set(Math.PI / 2 + index * 0.34, index * 0.22, index * 0.18);
          group.add(ring);
        }

        // Data packets ride the outermost flow ring: each dot is a small
        // emissive bead whose orbital phase advances at its own rate, so the
        // stream reads as continuous telemetry rather than a spinning cage.
        const packets = new THREE.Group();
        const packetGeometry = new THREE.SphereGeometry(0.17, 6, 6);
        for (let i = 0; i < 48; i += 1) {
          const radius = 24 + (i % 3) * 4;
          const phase = (i / 48) * TAU * 3;
          const bead = new THREE.Mesh(
            packetGeometry,
            new THREE.MeshBasicMaterial({
              color: i % 7 === 0 ? 0xffb466 : 0x9ff6ff,
              transparent: true,
              opacity: 0.9,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              toneMapped: false,
            }),
          );
          bead.position.set(Math.cos(phase) * radius, Math.sin(phase * 1.7) * 1.5, Math.sin(phase) * radius);
          bead.userData.phase = phase;
          bead.userData.radius = radius;
          packets.add(bead);
        }
        packets.userData.isPackets = true;
        group.add(packets);
        group.position.set(0, 1, 6);
        scene.add(group);
        refitFx.simRings = group;
      }
      refitFx.simRings.visible = refitFx.simMode;
      refitFx.starBoost = refitFx.simMode ? 3.4 : 1;
      applyLightDim(refitFx.simMode ? 0.5 : (refitFx.focusSlotId ? 0.42 : 1));
    }

    function faceSlot(slotId) {
      const record = mounts.get(slotId);
      if (!record) return;
      const position = worldPosOf(record);
      const targetTheta = Math.atan2(position.x - cameraTarget.x, position.z - cameraTarget.z);
      const delta = Math.atan2(Math.sin(targetTheta - camState.theta), Math.cos(targetTheta - camState.theta));
      refitFx.camTween = {
        age: 0,
        duration: 0.85,
        fromTheta: camState.theta,
        toTheta: camState.theta + delta,
        fromPhi: camState.phi,
        toPhi: clamp(0.3 + (position.y - 2) * 0.004, 0.02, 0.7),
        fromDistance: camState.distance,
        toDistance: clamp(camState.distance, 74, 104),
      };
    }

    function pickSlotAt(clientX, clientY) {
      if (!sceneReady || launching) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const pointer = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(ship.root, true);
      for (const hit of hits) {
        let node = hit.object;
        let slotId = null;
        while (node) {
          if (node.userData && node.userData.slotId) {
            slotId = node.userData.slotId;
            break;
          }
          node = node.parent;
        }
        if (slotId) {
          window.dispatchEvent(new CustomEvent('shipyard:pick-slot', { detail: { slotId } }));
          return;
        }
      }
      window.dispatchEvent(new CustomEvent('shipyard:pick-slot', { detail: { slotId: null } }));
    }

    function updateRefitFx(now, dt) {
      const seconds = now * 0.001;
      stars.rotation.y += dt * 0.006 * refitFx.starBoost;
      if (refitFx.camTween) {
        const tween = refitFx.camTween;
        tween.age += dt;
        const k = easeInOutCubic(clamp(tween.age / tween.duration, 0, 1));
        camState.theta = lerp(tween.fromTheta, tween.toTheta, k);
        camState.phi = lerp(tween.fromPhi, tween.toPhi, k);
        camState.distance = lerp(tween.fromDistance, tween.toDistance, k);
        if (tween.age >= tween.duration) refitFx.camTween = null;
      } else if (refitFx.simMode && !docking && !launching) {
        camState.theta += dt * 0.16;
      }
      if (refitFx.focusRing && refitFx.focusSlotId) {
        const record = mounts.get(refitFx.focusSlotId);
        if (record) {
          refitFx.focusRing.position.copy(worldPosOf(record));
          refitFx.focusRing.lookAt(camera.position);
          refitFx.focusRing.rotation.z = seconds * 0.42;
          const pulse = 1 + Math.sin(seconds * 3.1) * 0.06;
          refitFx.focusRing.scale.setScalar(pulse);
          refitFx.focusLight.position.copy(refitFx.focusRing.position).add(new THREE.Vector3(0, 1.4, 0));
          refitFx.focusLight.intensity = 250 + Math.sin(seconds * 2.4) * 70;
        }
      }
      refitFx.pulses.forEach((item) => {
        item.age += dt;
        const progress = (item.age * item.speed + item.offset) % 1;
        item.sprite.position.lerpVectors(item.from, item.to, progress);
        const fade = clamp(1 - item.age / item.life, 0, 1);
        item.sprite.material.opacity = Math.sin(progress * Math.PI) * 0.9 * fade;
      });
      refitFx.pulses = refitFx.pulses.filter((item) => {
        if (item.age < item.life) return true;
        scene.remove(item.sprite);
        item.sprite.material.dispose();
        return false;
      });
      refitFx.hintSprites.forEach((sprite, index) => {
        const wave = 0.5 + Math.sin(seconds * 5.4 + index * 0.5) * 0.5;
        sprite.scale.setScalar((sprite.userData.baseScale || 7.4) * (1 + wave * 0.22));
        sprite.material.opacity = 0.35 + wave * 0.4;
      });
      refitFx.sparks.forEach((item) => {
        item.age += dt;
        item.mesh.position.addScaledVector(item.velocity, dt);
        item.velocity.multiplyScalar(0.94);
        item.mesh.rotation.x += dt * 5;
        item.mesh.rotation.y += dt * 4;
        item.mesh.material.opacity = clamp(1 - item.age / item.life, 0, 1);
      });
      refitFx.sparks = refitFx.sparks.filter((item) => {
        if (item.age < item.life) return true;
        scene.remove(item.mesh);
        item.mesh.geometry.dispose();
        item.mesh.material.dispose();
        return false;
      });
      refitFx.waves.forEach((item) => {
        item.age += dt;
        const progress = clamp(item.age / item.life, 0, 1);
        item.mesh.scale.setScalar(lerp(0.35, 3.4, easeOutCubic(progress)));
        item.mesh.material.opacity = (1 - progress) * 0.8;
      });
      refitFx.waves = refitFx.waves.filter((item) => {
        if (item.age < item.life) return true;
        scene.remove(item.mesh);
        item.mesh.geometry.dispose();
        item.mesh.material.dispose();
        return false;
      });
      if (refitFx.simRings && refitFx.simRings.visible) {
        refitFx.simRings.rotation.y += dt * 0.5;
        refitFx.simRings.children.forEach((ring, index) => {
          if (ring.userData && ring.userData.isPackets) return;
          ring.rotation.z += dt * (0.2 + index * 0.12);
          ring.material.opacity = 0.26 + Math.sin(seconds * 1.8 + index) * 0.12;
        });
        const packets = refitFx.simRings.children.find((child) => child.userData && child.userData.isPackets);
        if (packets) {
          packets.children.forEach((bead) => {
            const phase = bead.userData.phase + seconds * (0.9 + (bead.userData.radius - 24) * 0.22);
            bead.position.set(
              Math.cos(phase) * bead.userData.radius,
              Math.sin(phase * 1.7) * 1.5,
              Math.sin(phase) * bead.userData.radius,
            );
            bead.material.opacity = 0.55 + Math.sin(phase * 3) * 0.35;
          });
        }
      }
    }

    const fullLayout = {
      cockpit: [50, 17],
      'weapon-0': [35, 23],
      'weapon-1': [65, 23],
      'shield-0': [33, 50],
      'shield-1': [67, 50],
      'engine-0': [41, 72],
      'engine-1': [59, 72],
      tail: [50, 79],
    };
    const phoneLayout = {
      cockpit: [50, 8],
      'weapon-0': [22, 24],
      'weapon-1': [78, 24],
      'shield-0': [13, 50],
      'shield-1': [87, 50],
      'engine-0': [31, 76],
      'engine-1': [69, 76],
      tail: [50, 90],
    };

    function refreshSlotEls() {
      slotEls = new Map();
      document.querySelectorAll('.slot[data-slot-id]').forEach((el) => {
        slotEls.set(el.dataset.slotId, el);
      });
    }

    function layoutSlots() {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      const layout = width < 900 ? phoneLayout : fullLayout;
      slotEls.forEach((el, slotId) => {
        const position = layout[slotId];
        if (!position) return;
        el.style.left = `${(position[0] / 100) * width}px`;
        el.style.top = `${(position[1] / 100) * height}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      });
    }

    function disposeModel(model) {
      if (!model) return;
      if (model.parent) model.parent.remove(model);
    }

    function ejectVector(slotId) {
      if (slotId.startsWith('engine')) return new THREE.Vector3(0, 0.1, 1);
      if (slotId === 'cockpit') return new THREE.Vector3(0, 1, 0.1);
      if (slotId === 'tail') return new THREE.Vector3(0, 0.2, 1);
      if (slotId === 'weapon-0' || slotId === 'shield-0') return new THREE.Vector3(-1, 0.1, 0);
      if (slotId === 'weapon-1' || slotId === 'shield-1') return new THREE.Vector3(1, 0.1, 0);
      if (slotId === 'hull') return new THREE.Vector3(0, 1, 0);
      return new THREE.Vector3(0, 0.3, -1);
    }

    function tweenTransform(object, fromPosition, toPosition, fromScale, toScale, delay, duration, onDone) {
      const start = performance.now() + delay;
      object.position.copy(fromPosition);
      object.scale.setScalar(fromScale);
      tweens.push({
        object,
        fromPosition: fromPosition.clone(),
        toPosition: toPosition.clone(),
        fromScale,
        toScale,
        start,
        duration: Math.max(1, duration),
        onDone,
      });
    }

    function spawnInstallBurst(mountRecord, cabling = false) {
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: cabling ? 0xffb466 : 0x6ce7ff,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.045, 5, 36), ringMaterial);
      ring.rotation.x = Math.PI / 2;
      mountRecord.group.add(ring);
      bursts.push({
        object: ring,
        start: performance.now(),
        duration: 460,
        fromScale: 0.8,
        toScale: 3.4,
        material: ringMaterial,
      });
    }

    function createCoreModel(slotId, partId, animate) {
      const record = mounts.get(slotId);
      if (!record) return;
      const previous = coreModels.get(slotId);
      if (previous && previous.id === partId) return;

      if (previous) {
        coreModels.delete(slotId);
        const oldModel = previous.model;
        if (animate && !reducedMotion) {
          const out = ejectVector(slotId).multiplyScalar(8.5);
          tweenTransform(
            oldModel,
            oldModel.position.clone(),
            oldModel.position.clone().add(out),
            1,
            0.04,
            0,
            300,
            () => disposeModel(oldModel),
          );
        } else {
          disposeModel(oldModel);
        }
      }

      if (!partId) return;
      const part = app.getPart(partId);
      if (!part) return;
      const model = buildPartModel(part);
      if (!model) return;
      record.group.add(model);
      model.traverse((node) => { if (node.isMesh) node.userData.slotId = slotId; });
      if (animate && !reducedMotion) {
        const entry = ejectVector(slotId).multiplyScalar(9);
        tweenTransform(model, entry, new THREE.Vector3(0, 0, 0), 0.18, 1, 70, 430);
        spawnInstallBurst(record, slotId === 'engine-0' || slotId === 'engine-1');
      }
      coreModels.set(slotId, { id: partId, model });
    }

    function createDecorModel(slotId, partId, animate) {
      const record = mounts.get(slotId);
      if (!record) return;
      const previous = decorModels.get(slotId);
      if (previous && previous.id === partId) return;
      if (previous) {
        decorModels.delete(slotId);
        const oldModel = previous.model;
        if (animate && !reducedMotion) {
          tweenTransform(
            oldModel,
            oldModel.position.clone(),
            oldModel.position.clone().add(new THREE.Vector3(0, 1.4, 1.2)),
            1,
            0.02,
            0,
            260,
            () => disposeModel(oldModel),
          );
        } else {
          disposeModel(oldModel);
        }
      }
      if (!partId) return;
      const part = app.getPart(partId);
      if (!part) return;
      const model = buildPartModel(part);
      if (!model) return;
      record.group.add(model);
      model.traverse((node) => { if (node.isMesh) node.userData.slotId = slotId; });
      if (animate && !reducedMotion) {
        tweenTransform(model, new THREE.Vector3(0, 1.2, 1.6), new THREE.Vector3(0, 0, 0), 0.12, 1, 50, 340);
        spawnInstallBurst(record);
      }
      decorModels.set(slotId, { id: partId, model });
    }

    function syncFromSnapshot(snapshot, animate = true) {
      if (!snapshot || !snapshot.slots) return;
      currentSnapshot = snapshot;
      const installed = { ...snapshot.slots };
      installed.hull = snapshot.hullId;
      Object.keys(fullLayout).forEach((slotId) => {
        createCoreModel(slotId, installed[slotId] || null, animate);
      });
      // The hull is a core slot but has no DOM card in the 2D shell.
      createCoreModel('hull', snapshot.hullId || null, animate);
      for (let index = 0; index < 54; index += 1) {
        createDecorModel(`decor-${index}`, snapshot.slots[`decor-${index}`] || null, animate);
      }
      refreshSlotEls();
      requestAnimationFrame(layoutSlots);
    }

    function updateTweens(now) {
      for (let index = tweens.length - 1; index >= 0; index -= 1) {
        const item = tweens[index];
        if (now < item.start) continue;
        const raw = clamp((now - item.start) / item.duration, 0, 1);
        const eased = easeOutCubic(raw);
        item.object.position.lerpVectors(item.fromPosition, item.toPosition, eased);
        item.object.scale.setScalar(lerp(item.fromScale, item.toScale, eased));
        if (raw >= 1) {
          if (item.onDone) item.onDone();
          tweens.splice(index, 1);
        }
      }
      for (let index = bursts.length - 1; index >= 0; index -= 1) {
        const item = bursts[index];
        const raw = clamp((now - item.start) / item.duration, 0, 1);
        item.object.scale.setScalar(lerp(item.fromScale, item.toScale, easeOutCubic(raw)));
        item.material.opacity = (1 - raw) * 0.75;
        if (raw >= 1) {
          disposeModel(item.object);
          item.material.dispose();
          bursts.splice(index, 1);
        }
      }
    }

    function setDockState(progress) {
      mountedDockProgress = progress;
      const eased = easeInOutCubic(progress);
      ship.root.position.set(
        0,
        lerp(-8, 0, eased),
        lerp(108, 0, eased),
      );
      ship.root.rotation.z = lerp(0.025, 0, eased);
      dock.arms.forEach((arm) => {
        arm.group.position.x = lerp(arm.openX, arm.closedX, eased);
      });
      dock.scanGate.rotation.z = lerp(0, Math.PI * 0.72, eased);
      if (dockFill) dockFill.style.width = `${(progress * 100).toFixed(2)}%`;
      if (dockCopy) {
        if (progress < 0.25) dockCopy.textContent = '远距引导完成 · 正在捕获进坞航道';
        else if (progress < 0.58) dockCopy.textContent = '磁力锁接合 · 姿态校准中';
        else if (progress < 0.94) dockCopy.textContent = '对接臂闭合 · 硬连接确认';
        else dockCopy.textContent = 'NX-07 已锁定 · 装配台上线';
      }
    }

    function finishDock(skipped = false) {
      if (!docking) return;
      docking = false;
      sceneReady = true;
      setDockState(1);
      ship.root.position.set(0, 0, 0);
      ship.root.rotation.z = 0;
      if (introTimer !== null) {
        window.clearTimeout(introTimer);
        introTimer = null;
      }
      introStarted = false;
      if (dockOverlay) {
        dockOverlay.classList.add('is-done');
        dockOverlay.setAttribute('aria-hidden', 'true');
      }
      document.body.classList.remove('scene-collapsing', 'scene-docking');
      document.body.classList.add('scene-ready');
      if (sceneStatus) sceneStatus.textContent = 'NX-07 // 硬连接';
      lastInteraction = performance.now();
      refreshSlotEls();
      requestAnimationFrame(layoutSlots);
      if (!skipped) {
        window.setTimeout(() => {
          if (app.toast) app.toast('对接完成 · 装配台已就绪，开始改装吧。', 'info');
        }, 520);
      }
    }

    function launchToFlight({ duration = 3100 } = {}) {
      if (docking) finishDock(true);
      if (launching) return true;
      launching = true;
      launchStarted = performance.now();
      launchDurationMs = reducedMotion ? 1000 : clamp(duration, 1200, 5000);
      launchCockpitBlend = 0;
      document.body.classList.remove('launch-cockpit');
      ship.setExploded(false);
      ship.clearDetached();
      ship.root.position.set(0, 0, 0);
      ship.root.rotation.set(0, 0, 0);
      if (ship.visual) ship.visual.visible = true;
      if (launchCockpitRig) {
        launchCockpitRig.setActive(false);
        launchCockpitRig.group.visible = false;
      }
      if (launchSky) launchSky.visible = false;
      if (launchField) {
        launchField.visible = true;
        launchField.userData.material.opacity = 0;
        launchField.rotation.z = 0;
      }
      camera.fov = 40;
      camera.updateProjectionMatrix();
      document.body.classList.add('scene-launching');
      return true;
    }

    function updateLaunch(now, dt) {
      const raw = clamp((now - launchStarted) / launchDurationMs, 0, 1);
      const accelerated = Math.pow(raw, 1.8);
      const warpLevel = clamp(accelerated * 1.2, 0, 1);

      ship.root.position.set(
        Math.sin(raw * Math.PI * 0.9) * 0.7 * (1 - raw * 0.35),
        Math.sin(raw * Math.PI) * 1.25,
        -accelerated * 380,
      );
      ship.root.rotation.set(-0.16 * accelerated, 0, Math.sin(now * 0.009) * 0.014 * raw);
      ship.update({
        dt,
        elapsed: now * 0.001,
        mode: 'flight',
        throttle: 1,
        warp: warpLevel,
        speed: 3200 * accelerated,
        bank: Math.sin(now * 0.0038) * 0.06 * raw,
        pitch: -0.045 * accelerated,
      });
      ship.root.updateMatrixWorld(true);

      /* External establishing shot for the first beat, then a fast
         shoulder-camera move into the physical cockpit. */
      cameraTarget.set(0, 1.4 + ship.root.position.y * 0.6, ship.root.position.z + 2);
      const distance = 104 + 43 * raw;
      const theta = 2.35 + Math.sin(raw * 4.2) * 0.035;
      const phi = 0.34 - 0.055 * raw;
      camera.position.set(
        cameraTarget.x + distance * Math.cos(phi) * Math.sin(theta),
        cameraTarget.y + distance * Math.sin(phi),
        cameraTarget.z + distance * Math.cos(phi) * Math.cos(theta),
      );
      camera.lookAt(cameraTarget);
      launchExternalQuaternion.copy(camera.quaternion);

      /* Hold the establishing shot long enough for the shockwave HUD to
         read, then hand over to the cockpit in one continuous move. */
      const blend = easeInOutCubic(clamp((raw - 0.36) / 0.3, 0, 1));
      launchCockpitBlend = blend;
      document.body.classList.toggle('launch-cockpit', blend > 0.2);
      const fpSpeed = document.getElementById('launch-fp-speed');
      if (fpSpeed) fpSpeed.textContent = (warpLevel * 0.94).toFixed(3);
      if (launchCockpitRig) {
        const cockpitActive = blend > 0.14;
        launchCockpitRig.setActive(cockpitActive);
        if (cockpitActive) {
          launchCockpitRig.update(dt, warpLevel);
        }
      }
      if (launchSky) {
        launchSky.visible = blend > 0.12;
        launchSky.rotation.y = 1.15 + now * 0.000008;
      }
      if (ship.visual) ship.visual.visible = blend < 0.55;

      if (blend > 0) {
        launchCockpitPosition.set(0, 4.9, -7.8);
        ship.root.localToWorld(launchCockpitPosition);
        launchCockpitQuaternion.copy(ship.root.quaternion);

        const shake = raw > 0.46
          ? Math.pow((raw - 0.46) / 0.54, 2) * 0.85
          : 0;
        launchCockpitPosition.x += Math.sin(now * 0.073) * shake;
        launchCockpitPosition.y += Math.cos(now * 0.091) * shake * 0.62;
        camera.position.lerp(launchCockpitPosition, blend);
        camera.quaternion.copy(launchExternalQuaternion).slerp(launchCockpitQuaternion, blend);

        const nextFov = lerp(40, 77, blend);
        if (Math.abs(camera.fov - nextFov) > 0.001) {
          camera.fov = nextFov;
          camera.updateProjectionMatrix();
        }
      }

      /* Shockwave HUD anchors to the real ship nose, then drifts to the
         screen centre as the shoulder camera hands over to the cockpit. */
      if (!launchOverlayEl) launchOverlayEl = document.getElementById('launch-overlay');
      if (launchOverlayEl) {
        launchNosePoint.set(0, 2.4, -25);
        ship.root.localToWorld(launchNosePoint);
        launchNosePoint.project(camera);
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const lock = Math.max(0, 1 - blend * 2.6);
        const anchorX = lerp(viewW / 2, (launchNosePoint.x * 0.5 + 0.5) * viewW, lock);
        const anchorY = lerp(viewH * 0.54, (-launchNosePoint.y * 0.5 + 0.5) * viewH, lock);
        launchOverlayEl.style.setProperty('--ax', `${anchorX.toFixed(1)}px`);
        launchOverlayEl.style.setProperty('--ay', `${anchorY.toFixed(1)}px`);
        launchOverlayEl.style.setProperty('--spd', warpLevel.toFixed(3));
      }

      if (launchField) {
        const strength = clamp((raw - 0.06) / 0.48, 0, 1);
        launchField.userData.material.opacity = strength * 0.52;
        launchField.rotation.z += dt * 0.2;
        launchField.scale.setScalar(0.88 + raw * 0.44);
      }
    }

    function updateDock(now) {
      if (!docking || !introStarted) return;
      if (now < dockStart) {
        setDockState(0);
        return;
      }
      const progress = clamp((now - dockStart) / dockDuration, 0, 1);
      setDockState(progress);
      if (progress >= 1) finishDock(false);
    }

    function updateCamera(dt, now) {
      const eased = easeInOutCubic(mountedDockProgress);
      const targetZ = docking ? lerp(18, 2, eased) : 2;
      cameraTarget.set(0, 2, targetZ);
      const distance = docking ? lerp(142, 96, eased) : camState.distance;
      const theta = docking ? 2.2 : camState.theta;
      const phi = docking ? 0.24 : camState.phi;
      camera.position.set(
        cameraTarget.x + distance * Math.cos(phi) * Math.sin(theta),
        cameraTarget.y + distance * Math.sin(phi),
        cameraTarget.z + distance * Math.cos(phi) * Math.cos(theta),
      );
      camera.lookAt(cameraTarget);
    }

    function setupPointerControls() {
      canvas.addEventListener('pointerdown', (event) => {
        if (!sceneReady || launching || event.button !== 0) return;
        orbiting = true;
        orbitMoved = false;
        downX = event.clientX;
        downY = event.clientY;
        pointerId = event.pointerId;
        pointerLastX = event.clientX;
        pointerLastY = event.clientY;
        lastInteraction = performance.now();
        canvas.setPointerCapture(pointerId);
        canvas.style.cursor = 'grabbing';
      });

      window.addEventListener('pointermove', (event) => {
        if (!orbiting || event.pointerId !== pointerId) return;
        const dx = event.clientX - pointerLastX;
        const dy = event.clientY - pointerLastY;
        pointerLastX = event.clientX;
        pointerLastY = event.clientY;
        if (Math.hypot(event.clientX - downX, event.clientY - downY) > 5) orbitMoved = true;
        camState.theta -= dx * 0.005;
        camState.phi = clamp(camState.phi - dy * 0.0035, -0.05, 1.05);
        lastInteraction = performance.now();
      });

      const stopOrbit = (event) => {
        if (!orbiting || (event && event.pointerId !== pointerId)) return;
        orbiting = false;
        if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
        pointerId = null;
        canvas.style.cursor = 'grab';
        lastInteraction = performance.now();
        if (event && !orbitMoved) pickSlotAt(event.clientX, event.clientY);
      };
      window.addEventListener('pointerup', stopOrbit);
      window.addEventListener('pointercancel', stopOrbit);

      canvas.addEventListener('wheel', (event) => {
        if (!sceneReady || launching) return;
        event.preventDefault();
        camState.distance = clamp(camState.distance + event.deltaY * 0.08, 64, 185);
        lastInteraction = performance.now();
      }, { passive: false });

      canvas.addEventListener('dblclick', () => {
        if (!sceneReady || launching) return;
        camState.theta = 2.35;
        camState.phi = 0.34;
        camState.distance = 104;
        lastInteraction = performance.now();
      });
    }

    function setupUiHooks() {
      if (decomposeButton) {
        decomposeButton.addEventListener('click', () => {
          if (!sceneReady) return;
          exploded = !exploded;
          ship.setExploded(exploded);
          decomposeButton.setAttribute('aria-pressed', String(exploded));
          decomposeButton.textContent = exploded ? '合拢检查' : '分解检查';
        });
      }
      if (decorToggle && decorPanel) {
        decorToggle.addEventListener('click', () => {
          const collapsed = decorPanel.classList.toggle('is-collapsed');
          decorToggle.setAttribute('aria-expanded', String(!collapsed));
          decorToggle.textContent = collapsed ? '装饰' : '收起装饰';
          requestAnimationFrame(layoutSlots);
        });
      }
      if (skipDock) {
        skipDock.addEventListener('click', () => finishDock(true));
      }
      window.addEventListener('shipyard:state', (event) => {
        syncFromSnapshot(event.detail, true);
      });
      window.addEventListener('shipyard:app-ready', (event) => {
        syncFromSnapshot(event.detail, false);
      });
      window.addEventListener('resize', () => requestAnimationFrame(resize));
    }

    function resize() {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      layoutSlots();
    }

    function animate(now) {
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      updateDock(now);
      updateTweens(now);
      updateRefitFx(now, dt);
      if (launching) {
        updateLaunch(now, dt);
      } else {
        updateCamera(dt, now);
        ship.update({
          dt,
          elapsed: now * 0.001,
          mode: 'inspect',
          throttle: 0,
          warp: 0,
          speed: 0,
          bank: 0,
          pitch: 0,
        });
      }
      dock.group.rotation.y = Math.sin(now * 0.00008) * 0.012;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    setDockState(0);
    document.body.classList.add('has-3d');
    // Commit the 3D rail layout first so the following class change is a
    // real transition, not a same-frame jump.
    void document.body.offsetWidth;
    document.body.classList.add('scene-collapsing');
    resize();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(resize);
      observer.observe(stage);
    }
    syncFromSnapshot(currentSnapshot, false);
    setupPointerControls();
    setupUiHooks();

    if (sceneStatus) sceneStatus.textContent = '装配界面收纳中';
    if (dockTitle) dockTitle.textContent = '正在收纳装配界面';
    if (dockCopy) dockCopy.textContent = '配件库与性能面板正在收起 · 准备引导 NX-07 入坞';
    if (dockFill) dockFill.style.width = '0%';

    // Focus-first entry: let both side rails finish retracting before the
    // dock sequence is allowed to move the ship. The delay is deterministic
    // and matches the CSS transition; reduced-motion uses a short beat.
    introTimer = window.setTimeout(() => {
      introTimer = null;
      if (!docking || sceneReady) return;
      introStarted = true;
      document.body.classList.add('scene-docking');
      document.body.classList.remove('scene-collapsing');
      dockStart = performance.now() + (reducedMotion ? 20 : 80);
      if (sceneStatus) sceneStatus.textContent = '进坞引导中';
      if (dockTitle) dockTitle.textContent = '正在引导 NX-07 入坞';
      if (dockCopy) dockCopy.textContent = '远距引导完成 · 正在捕获进坞航道';
    }, introCollapseDelay);

    window.setTimeout(() => renderPartThumbnails(app), 1600);

    requestAnimationFrame((now) => {
      lastFrame = now;
      animate(now);
    });

    window.__SHIPYARD_3D__ = {
      scene,
      camera,
      renderer,
      ship,
      docks: dock.group,
      getState: () => ({
        docking,
        sceneReady,
        exploded,
        launching,
        progress: mountedDockProgress,
        camera: { ...camState },
        slots: currentSnapshot.slots,
      }),
      sync: () => syncFromSnapshot(app.getSnapshot(), false),
      finishDock: () => finishDock(true),
      launchToFlight,
      focusSlot,
      getMountScreen,
      setDragHints,
      conflictAt,
      celebrate,
      setSimMode,
      faceSlot,
      pulseConduit,
    };
  }

  boot();
})();