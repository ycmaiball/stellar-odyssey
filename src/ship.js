import * as THREE from 'three';
import {
  TAU,
  clamp,
  damp,
  makeCanvas,
  canvasTexture,
  randRange,
  mulberry32,
  createGridTexture,
} from './utils.js';
import {
  createGlowTexture,
  createHullStencilTexture,
  createShipDecalTexture,
  createWarningStripeTexture,
  createWingDecalTexture,
} from './textures.js';

export const SHIP_META = {
  name: 'HELIOS',
  registry: 'NX-07',
  className: 'QUANTUM-CLASS LONGSHIP',
  chineseClass: '量子级远程星舰',
  length: '51.4 m',
  wingspan: '42.8 m',
  crew: '04',
  cruise: '0.42 c',
  maxSpeed: '0.94 c',
  warp: '9.4',
  commissioning: '2187',
};

const PART_DATA = [
  {
    id: 'hull',
    index: '01',
    cn: '主舰体',
    en: 'CORE HULL',
    subsystem: '结构与动力核心',
    accent: '#8deaff',
    description:
      '量子级钛陶复合装甲构成的主承力框架。内部集成反物质约束舱、导航陀螺阵列与全舰能源总线，是整个 NX-07 的结构心脏。',
    specs: [
      ['全长', '51.4 m'],
      ['干重', '2,840 t'],
      ['装甲', 'Ti-C 复合层'],
      ['能源', '反物质约束'],
    ],
    canDetach: false,
  },
  {
    id: 'canopy',
    index: '02',
    cn: '驾驶舱',
    en: 'OBSERVATION CANOPY',
    subsystem: '飞行控制',
    accent: '#ffc37d',
    description:
      '全向透明座舱罩采用五层铝硅酸盐复合材料，可承受微陨石撞击与跃迁时的辐射脉冲。内部保留两组人工驾驶席，以应对量子导航失效。',
    specs: [
      ['乘员', '4 人'],
      ['视野', '270°'],
      ['罩体', '5 层复合'],
      ['应急', '全手动'],
    ],
    canDetach: true,
  },
  {
    id: 'wing-left',
    index: '03',
    cn: '左舷矢量翼',
    en: 'PORT VECTOR WING',
    subsystem: '姿态控制',
    accent: '#ff8790',
    description:
      '带后掠翼梢小翼的变几何翼面，内嵌 24 组微推力矢量喷口。左舷翼尖的红色航行灯在编队飞行中用于识别舰体姿态。',
    specs: [
      ['翼展', '21.4 m'],
      ['控制面', '6 组'],
      ['RCS', '24 组'],
      ['识别灯', 'PORT / 红'],
    ],
    canDetach: true,
    side: -1,
  },
  {
    id: 'wing-right',
    index: '04',
    cn: '右舷矢量翼',
    en: 'STARBOARD VECTOR WING',
    subsystem: '姿态控制',
    accent: '#8dffd0',
    description:
      '与左舷对称的变几何翼面。翼面蒙皮集成柔性光伏与热辐射涂层，可在恒星附近展开散热，以维持舰体内部温差。',
    specs: [
      ['翼展', '21.4 m'],
      ['控制面', '6 组'],
      ['RCS', '24 组'],
      ['识别灯', 'STBD / 绿'],
    ],
    canDetach: true,
    side: 1,
  },
  {
    id: 'engine-left',
    index: '05',
    cn: '左舷聚变引擎',
    en: 'PORT FUSION DRIVE',
    subsystem: '推进系统',
    accent: '#7fdcff',
    description:
      '氘氦-3 聚变脉冲引擎，喷口磁场可约束等离子体至 1.2 亿摄氏度。短时过载推重比可达 14.6，是光速巡航的主要动力来源。',
    specs: [
      ['推力', '4.8 MN'],
      ['比冲', '18,400 s'],
      ['工质', 'D-He3'],
      ['喷口', '磁约束'],
    ],
    canDetach: true,
    side: -1,
  },
  {
    id: 'engine-right',
    index: '06',
    cn: '右舷聚变引擎',
    en: 'STARBOARD FUSION DRIVE',
    subsystem: '推进系统',
    accent: '#7fdcff',
    description:
      '与左舷同步的聚变引擎。双引擎可独立矢量偏转，也能在损伤时互相备份；单向推进时仍保留 62% 的巡航推力。',
    specs: [
      ['推力', '4.8 MN'],
      ['比冲', '18,400 s'],
      ['工质', 'D-He3'],
      ['喷口', '磁约束'],
    ],
    canDetach: true,
    side: 1,
  },
  {
    id: 'warp',
    index: '07',
    cn: '曲率驱动环',
    en: 'WARP COIL',
    subsystem: '超光速推进',
    accent: '#a89bff',
    description:
      '舰体外置的曲率场发生器。十二组超导线圈在舰体前后压缩时空，使 NX-07 在局部参考系中保持静止，同时让宇宙在周围流动。',
    specs: [
      ['曲率级', '9.4'],
      ['线圈', '12 组'],
      ['效应', '时空压缩'],
      ['冷却', '液氦循环'],
    ],
    canDetach: true,
  },
  {
    id: 'sensor',
    index: '08',
    cn: '传感阵列',
    en: 'SENSOR ARRAY',
    subsystem: '探测与导航',
    accent: '#9af0b8',
    description:
      '远程引力波与光学复合传感器。背鳍顶端的主阵列可在 12 AU 外分辨一颗小行星的热特征，并为曲率跳跃提供星图校准。',
    specs: [
      ['探测', '12 AU'],
      ['频段', '光学 / 引力波'],
      ['天线', '6 组'],
      ['校准', '量子星图'],
    ],
    canDetach: true,
  },
];

const STATIONS = [
  { z: -27.0, w: 0.05, h: 0.05, cy: -0.1 },
  { z: -23.0, w: 2.1, h: 1.05, cy: -0.05 },
  { z: -16.0, w: 4.5, h: 2.0, cy: 0.0 },
  { z: -6.0, w: 6.9, h: 2.8, cy: 0.1 },
  { z: 4.0, w: 8.2, h: 3.3, cy: 0.15 },
  { z: 13.0, w: 8.7, h: 3.6, cy: 0.18 },
  { z: 20.0, w: 6.1, h: 2.9, cy: 0.12 },
  { z: 24.0, w: 2.1, h: 1.05, cy: 0.02 },
];

const ENGINE_HOME_X = 8.2;
const ENGINE_HOME_Z = 17.6;

function makeMaterial(name, options) {
  const material = new THREE.MeshPhysicalMaterial({
    metalness: 0.7,
    roughness: 0.4,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
    envMapIntensity: 1.35,
    ...options,
  });
  material.name = name;
  return material;
}

function makeBasicMaterial(color, options = {}) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    toneMapped: false,
    ...options,
  });
}

/**
 * Grayscale service-panel data map. Reused as bump + roughness: the dark
 * seams sit in the surface while the lighter plates catch long, broken
 * highlights. This gives the very large low-poly hull readable scale at
 * gameplay distance without adding thousands of draw calls.
 */
function createHullPanelTexture() {
  const size = 1024;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const random = mulberry32(7717);

  ctx.fillStyle = '#777873';
  ctx.fillRect(0, 0, size, size);

  let y = 0;
  while (y < size) {
    const rowHeight = Math.round(randRange(random, 72, 168));
    let x = -Math.round(randRange(random, 0, 80));
    while (x < size) {
      const width = Math.round(randRange(random, 104, 286));
      const shade = Math.round(randRange(random, 94, 172));
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x + 2, y + 2, width - 4, rowHeight - 4);
      ctx.strokeStyle = 'rgba(24,26,28,0.92)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, width - 2, rowHeight - 2);

      // Recessed sub-panel or inspection hatch.
      if (random() > 0.53) {
        const inset = Math.round(randRange(random, 10, 25));
        ctx.strokeStyle = 'rgba(35,37,39,0.75)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          x + inset,
          y + inset,
          width - inset * 2,
          rowHeight - inset * 2,
        );
        if (random() > 0.55) {
          ctx.fillStyle = 'rgba(45,46,44,0.55)';
          ctx.fillRect(
            x + inset + 5,
            y + inset + 5,
            Math.max(8, width - inset * 2 - 10),
            4,
          );
        }
      }

      // A handful of precision fasteners along the panel edge.
      if (random() > 0.42) {
        const boltCount = 2 + Math.floor(random() * 4);
        for (let i = 0; i < boltCount; i += 1) {
          const bx = x + 12 + (i / Math.max(1, boltCount - 1)) * (width - 24);
          const by = y + 9;
          ctx.fillStyle = 'rgba(32,34,35,0.9)';
          ctx.beginPath();
          ctx.arc(bx, by, 2.1, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(200,200,188,0.25)';
          ctx.beginPath();
          ctx.arc(bx - 0.7, by - 0.7, 0.8, 0, TAU);
          ctx.fill();
        }
      }
      x += width;
    }
    y += rowHeight;
  }

  // Long service trenches break up the panel grid.
  [0.27, 0.67].forEach((fraction, index) => {
    const ty = Math.round(size * fraction);
    ctx.fillStyle = 'rgba(42,44,44,0.7)';
    ctx.fillRect(0, ty, size, 18 + index * 5);
    ctx.strokeStyle = 'rgba(17,19,21,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, ty);
    ctx.lineTo(size, ty);
    ctx.stroke();
    for (let x = 18; x < size; x += 46) {
      ctx.fillStyle = 'rgba(153,153,142,0.35)';
      ctx.fillRect(x, ty + 7, 18, 3);
    }
  });

  // Vent blocks and heat-staining streaks.
  for (let i = 0; i < 6; i += 1) {
    const vx = Math.round(randRange(random, 30, size - 150));
    const vy = Math.round(randRange(random, 40, size - 80));
    const vw = Math.round(randRange(random, 72, 130));
    const vh = 30;
    ctx.fillStyle = 'rgba(26,28,30,0.85)';
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeStyle = 'rgba(150,150,140,0.3)';
    ctx.strokeRect(vx + 3, vy + 3, vw - 6, vh - 6);
    for (let s = 0; s < 6; s += 1) {
      ctx.fillStyle = 'rgba(8,10,12,0.9)';
      ctx.fillRect(vx + 7, vy + 6 + s * 4, vw - 14, 2);
    }
  }

  // Very fine scratches, mostly along the ship's longitudinal axis.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 190; i += 1) {
    const sx = randRange(random, 0, size);
    const sy = randRange(random, 0, size);
    const length = randRange(random, 5, 70);
    ctx.strokeStyle = `rgba(226,223,206,${randRange(random, 0.025, 0.11)})`;
    ctx.lineWidth = randRange(random, 0.5, 1.5);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + randRange(random, -4, 4), sy + length);
    ctx.stroke();
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.1, 4.4);
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createArmorAlbedoTexture(base, seam, plateShift, wear) {
  const size = 1024;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const random = mulberry32(wear);
  const baseColor = new THREE.Color(base);
  const seamColor = new THREE.Color(seam);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Irregular plate grid: every seam has a dark gasket and a thin lit lip.
  let y = -40;
  while (y < size) {
    const rowHeight = Math.round(randRange(random, 72, 156));
    let x = -Math.round(randRange(random, 40, 140));
    while (x < size) {
      const width = Math.round(randRange(random, 96, 260));
      const shift = randRange(random, -plateShift, plateShift);
      const plateColor = baseColor.clone().offsetHSL(
        randRange(random, -0.012, 0.012),
        randRange(random, -0.03, 0.03),
        shift / 255,
      );
      ctx.fillStyle = `#${plateColor.getHexString()}`;
      ctx.fillRect(x + 3, y + 3, width - 6, rowHeight - 6);
      ctx.strokeStyle = `#${seamColor.getHexString()}`;
      ctx.lineWidth = 6;
      ctx.strokeRect(x + 2, y + 2, width - 4, rowHeight - 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 7, y + 7, width - 14, rowHeight - 14);

      if (random() > 0.64) {
        const inset = Math.round(randRange(random, 12, 28));
        ctx.strokeStyle = 'rgba(20,22,22,0.68)';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          x + inset,
          y + inset,
          width - inset * 2,
          rowHeight - inset * 2,
        );
      }
      if (random() > 0.72) {
        const ventW = Math.round(randRange(random, 18, 34));
        const ventH = Math.round(randRange(random, 4, 8));
        ctx.fillStyle = 'rgba(8,10,11,0.76)';
        for (let v = 0; v < 4; v += 1) {
          ctx.fillRect(
            x + width - ventW - 18,
            y + 18 + v * (ventH + 4),
            ventW,
            ventH,
          );
        }
      }
      if (random() > 0.68) {
        const boltR = randRange(random, 1.2, 2.4);
        ctx.fillStyle = 'rgba(32,34,33,0.82)';
        [
          [x + 12, y + 12],
          [x + width - 12, y + 12],
          [x + 12, y + rowHeight - 12],
          [x + width - 12, y + rowHeight - 12],
        ].forEach(([bx, by]) => {
          ctx.beginPath();
          ctx.arc(bx, by, boltR, 0, TAU);
          ctx.fill();
        });
      }
      x += width;
    }
    y += rowHeight;
  }

  // Long service staining and small paint chips break the machine-perfect grid.
  for (let i = 0; i < 85; i += 1) {
    const x = random() * size;
    const y0 = random() * size;
    const length = randRange(random, 12, 140);
    ctx.strokeStyle = `rgba(18,19,18,${randRange(random, 0.025, 0.11)})`;
    ctx.lineWidth = randRange(random, 0.6, 2.4);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + randRange(random, -5, 5), y0 + length);
    ctx.stroke();
  }
  const texture = canvasTexture(canvas, { colorSpace: 'srgb', anisotropy: 8 });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.7, 3.8);
  return texture;
}

/**
 * Warm ceramic plate albedo. The dark gasket grid remains legible even when
 * the ship is only a few hundred pixels long, while the large plates keep the
 * silhouette quiet enough for the HUD.
 */
function createCeramicAlbedoTexture() {
  return createArmorAlbedoTexture('#b4ab97', '#2b2923', 15, 8171);
}

/** Graphite structural albedo for the wing box and exposed machinery. */
function createGraphiteAlbedoTexture() {
  return createArmorAlbedoTexture('#2d3437', '#070a0b', 9, 3929);
}

function createWarningMaterial(map) {
  return new THREE.MeshBasicMaterial({
    map,
    toneMapped: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
}

function addRCSCluster(group, materials, position, side) {
  const cluster = new THREE.Group();
  cluster.name = 'rcs-quad';
  cluster.position.copy(position);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.34, 0.78),
    materials.hullDark,
  );
  cluster.add(body);

  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.2, 0.46),
    materials.armorMid,
  );
  cap.position.set(side * 0.1, 0.2, 0);
  cluster.add(cap);

  const nozzleMaterial = materials.rib;
  const outward = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.3, 6),
    nozzleMaterial,
  );
  outward.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  outward.position.x = side * 0.37;
  cluster.add(outward);

  [-1, 1].forEach((direction) => {
    const nozzle = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.22, 6),
      nozzleMaterial,
    );
    nozzle.rotation.x = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    nozzle.position.z = direction * 0.48;
    cluster.add(nozzle);
  });

  const bleed = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.023, 0.12),
    materials.trimAmber,
  );
  bleed.position.set(side * 0.27, 0.16, -0.19);
  markNoOutline(bleed);
  cluster.add(bleed);

  group.add(cluster);
  return cluster;
}

function addVentBlock(group, materials, width, height, depth, position, rotationY = 0, slats = 5) {
  const block = new THREE.Group();
  block.position.copy(position);
  block.rotation.y = rotationY;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    materials.rib,
  );
  block.add(frame);

  for (let i = 0; i < slats; i += 1) {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.82, height * 0.08, depth * 0.86),
      materials.hullDark,
    );
    slat.position.y = -height * 0.34 + (i / Math.max(1, slats - 1)) * height * 0.68;
    block.add(slat);
  }

  const warning = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.86, height * 0.28),
    materials.warningMaterial,
  );
  warning.rotation.y = Math.PI / 2;
  warning.position.set(width * 0.505, 0, 0);
  block.add(warning);

  group.add(block);
  return block;
}

function addBoltRow(group, material, start, end, count, radius = 0.045) {
  const direction = end.clone().sub(start);
  for (let i = 0; i < count; i += 1) {
    const bolt = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 6, 4),
      material,
    );
    bolt.position.copy(start).addScaledVector(direction, count === 1 ? 0 : i / (count - 1));
    group.add(bolt);
  }
}

function createplatePoints(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  return shape;
}

function createPlateGeometry(points, thickness = 0.5, bevel = 0.06) {
  const shape = createplatePoints(points);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -thickness / 2, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function createVerticalPlateGeometry(points, thickness = 0.4, bevel = 0.04) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], index) => {
    if (index === 0) shape.moveTo(z, y);
    else shape.lineTo(z, y);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 1,
  });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(thickness / 2, 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function createLoftGeometry(
  stations,
  segments = 28,
  thetaStart = 0,
  thetaLength = TAU,
) {
  const closed = Math.abs(thetaLength - TAU) < 0.0001;
  const columns = closed ? segments : segments + 1;
  const positions = [];
  const uvs = [];
  for (let i = 0; i < stations.length; i += 1) {
    const station = stations[i];
    const v = i / Math.max(1, stations.length - 1);
    for (let j = 0; j < columns; j += 1) {
      const angle = thetaStart + (j / segments) * thetaLength;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const exponent = 0.78;
      const x = Math.sign(c) * Math.pow(Math.abs(c), exponent) * station.w;
      const y =
        (station.cy || 0) +
        Math.sign(s) * Math.pow(Math.abs(s), exponent) * station.h;
      positions.push(x, y, station.z);
      uvs.push(closed ? j / segments : j / Math.max(1, columns - 1), v);
    }
  }

  const indices = [];
  for (let i = 0; i < stations.length - 1; i += 1) {
    for (let j = 0; j < (closed ? segments : columns - 1); j += 1) {
      const next = closed ? (j + 1) % segments : j + 1;
      const a = i * columns + j;
      const b = i * columns + next;
      const c = (i + 1) * columns + next;
      const d = (i + 1) * columns + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  if (closed) {
    const first = stations[0];
    const last = stations[stations.length - 1];
    const firstCenter = positions.length / 3;
    positions.push(0, first.cy || 0, first.z);
    uvs.push(0.5, 0);
    const lastCenter = positions.length / 3;
    positions.push(0, last.cy || 0, last.z);
    uvs.push(0.5, 1);
    const lastRow = (stations.length - 1) * columns;
    for (let j = 0; j < segments; j += 1) {
      const next = (j + 1) % segments;
      indices.push(firstCenter, next, j);
      indices.push(lastCenter, lastRow + j, lastRow + next);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function stationAt(z) {
  if (z <= STATIONS[0].z) return STATIONS[0];
  if (z >= STATIONS[STATIONS.length - 1].z) return STATIONS[STATIONS.length - 1];
  for (let i = 0; i < STATIONS.length - 1; i += 1) {
    const a = STATIONS[i];
    const b = STATIONS[i + 1];
    if (z >= a.z && z <= b.z) {
      const t = (z - a.z) / (b.z - a.z);
      return {
        z,
        w: THREE.MathUtils.lerp(a.w, b.w, t),
        h: THREE.MathUtils.lerp(a.h, b.h, t),
        cy: THREE.MathUtils.lerp(a.cy || 0, b.cy || 0, t),
      };
    }
  }
  return STATIONS[0];
}

function createTubeBetween(group, start, end, radius, material, radialSegments = 6) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    length,
    radialSegments,
    1,
    false,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  group.add(mesh);
  return mesh;
}

function createSprite(texture, color, opacity, scale) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(scale);
  return sprite;
}

function createExhaustMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float fade = pow(1.0 - vUv.y, 1.7);
        float pulse = 0.78 + 0.22 * sin(vUv.x * 37.0 + vUv.y * 24.0);
        float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
        gl_FragColor = vec4(uColor * (1.0 + fade * 2.1), fade * edge * uOpacity * pulse);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

function createShipDecalMaterial(map, opacity = 0.85) {
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

function addPartRoot(parts, visual, data, group, homePosition, homeRotation = [0, 0, 0]) {
  group.position.copy(homePosition);
  group.rotation.set(homeRotation[0], homeRotation[1], homeRotation[2]);
  group.userData.partId = data.id;
  group.name = `module-${data.id}`;
  visual.add(group);

  const anchor = new THREE.Object3D();
  anchor.name = `anchor-${data.id}`;
  anchor.position.fromArray(data.anchor || [0, 0, 0]);
  group.add(anchor);

  const outlineMeshes = [];
  const pickables = [];
  group.traverse((child) => {
    if (child.isMesh) {
      child.userData.partId = data.id;
      if (!child.userData.noOutline) outlineMeshes.push(child);
      if (!child.userData.noPick) pickables.push(child);
    }
  });

  const part = {
    ...data,
    group,
    anchor,
    outlineMeshes,
    pickables,
    homePosition: group.position.clone(),
    homeQuaternion: group.quaternion.clone(),
    explodeOffset: new THREE.Vector3(...(data.explodeOffset || [0, 0, 0])),
    explodeRotation: new THREE.Euler(...(data.explodeRotation || [0, 0, 0])),
    detachTarget: 0,
    separation: 0,
    detached: false,
    fx: data.fx || null,
  };
  parts.push(part);
  return part;
}

function markNoOutline(object) {
  object.traverse((child) => {
    if (child.isMesh) child.userData.noOutline = true;
  });
  return object;
}

function buildCore(materials, textures, glowTexture, shipState) {
  const group = new THREE.Group();
  group.name = 'core-hull-geometry';

  const hull = new THREE.Mesh(
    createLoftGeometry(STATIONS, 32),
    materials.hull,
  );
  hull.name = 'hull-shell';
  group.add(hull);

  // The dorsal shell is intentionally broken into five overlapping plates.
  // One continuous cap reads as a flat white shield from above; the gaps and
  // staggered edge angles expose the dark structural hull underneath.
  const topArmorSegments = [
    { z0: -26.6, z1: -16.5, start: 0.2, length: 0.58, material: materials.armorMid },
    { z0: -15.7, z1: -6.2, start: 0.17, length: 0.64, material: materials.armorLight },
    { z0: -5.4, z1: 4.4, start: 0.15, length: 0.68, material: materials.armorLight },
    { z0: 5.2, z1: 13.4, start: 0.18, length: 0.63, material: materials.armorWarm },
    { z0: 14.2, z1: 23.2, start: 0.22, length: 0.54, material: materials.armorMid },
  ];
  topArmorSegments.forEach((segment, segmentIndex) => {
    const stations = [];
    const stepCount = 4;
    for (let i = 0; i <= stepCount; i += 1) {
      const z = THREE.MathUtils.lerp(segment.z0, segment.z1, i / stepCount);
      const station = stationAt(z);
      stations.push({
        ...station,
        w: station.w * (1.028 + segmentIndex * 0.0015),
        h: station.h * (1.028 + segmentIndex * 0.0015),
      });
    }
    const plate = new THREE.Mesh(
      createLoftGeometry(
        stations,
        18,
        Math.PI * segment.start,
        Math.PI * segment.length,
      ),
      segment.material,
    );
    plate.name = `dorsal-armor-${segmentIndex + 1}`;
    group.add(plate);
  });

  const bellyArmor = new THREE.Mesh(
    createLoftGeometry(
      STATIONS.map((s) => ({ ...s, w: s.w * 1.01, h: s.h * 1.012 })),
      18,
      Math.PI * 1.16,
      Math.PI * 0.68,
    ),
    materials.hullDark,
  );
  group.add(bellyArmor);

  const spineArmor = new THREE.Mesh(
    createLoftGeometry(
      STATIONS.map((s) => ({ ...s, w: s.w * 1.022, h: s.h * 1.022 })),
      12,
      Math.PI * 0.37,
      Math.PI * 0.26,
    ),
    materials.armorLight,
  );
  group.add(spineArmor);

  // Port and starboard shoulder plating. These are deliberately separate
  // shells with visible gaps so close inspection reveals layered armour
  // rather than one continuous painted surface.
  const shoulderShells = [
    { start: Math.PI * 0.82, length: Math.PI * 0.3, material: materials.hullMid },
    { start: -Math.PI * 0.12, length: Math.PI * 0.3, material: materials.armorMid },
  ];
  shoulderShells.forEach((shell) => {
    const shoulder = new THREE.Mesh(
      createLoftGeometry(
        STATIONS.map((s) => ({ ...s, w: s.w * 1.032, h: s.h * 1.026 })),
        12,
        shell.start,
        shell.length,
      ),
      shell.material,
    );
    shoulder.name = 'shoulder-armor';
    group.add(shoulder);

    // A narrow ceramic rail rides the upper shoulder, leaving a broad dark
    // structural band underneath for contrast and scale.
    const ceramicRail = new THREE.Mesh(
      createLoftGeometry(
        STATIONS.map((s) => ({ ...s, w: s.w * 1.047, h: s.h * 1.039 })),
        10,
        shell.start + shell.length * 0.43,
        shell.length * 0.28,
      ),
      materials.armorLight,
    );
    ceramicRail.name = 'shoulder-ceramic-rail';
    group.add(ceramicRail);

    // A dark trim rail follows the exposed edge of each shell.
    const edgePoints = [];
    for (let i = 0; i < 8; i += 1) {
      const z = -18 + (i / 7) * 34;
      const station = stationAt(z);
      const angle = shell.start + shell.length;
      edgePoints.push(
        new THREE.Vector3(
          Math.cos(angle) * station.w * 1.042,
          (station.cy || 0) + Math.sin(angle) * station.h * 1.036,
          z,
        ),
      );
    }
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(edgePoints),
        42,
        0.038,
        5,
        false,
      ),
      materials.rib,
    );
    group.add(rail);
  });

  const ribMaterial = materials.rib;
  [-19, -12, -4.5, 3, 10, 18, 22].forEach((z) => {
    const station = stationAt(z);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.032, 4, 36),
      ribMaterial,
    );
    ring.scale.set(station.w * 1.018, station.h * 1.018, 1);
    ring.position.set(0, station.cy || 0, z);
    group.add(ring);
  });

  // Thin longitudinal panel seams following the crown of the hull.
  const seamA = [];
  const seamB = [];
  for (let i = 0; i < 15; i += 1) {
    const z = -22 + (i / 14) * 39;
    const station = stationAt(z);
    const top = (station.cy || 0) + station.h * 1.025;
    seamA.push(new THREE.Vector3(-station.w * 0.3, top, z));
    seamB.push(new THREE.Vector3(station.w * 0.3, top, z));
  }
  const seamMaterial = materials.panelLine;
  [seamA, seamB].forEach((points) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const seam = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 48, 0.025, 4, false),
      seamMaterial,
    );
    group.add(seam);
  });

  // Raised dorsal deck and its large hull identity decal.
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 0.28, 8.8),
    materials.armorLight,
  );
  deck.position.set(0, 3.45, 5.2);
  group.add(deck);

  const deckInset = new THREE.Mesh(
    new THREE.BoxGeometry(6.6, 0.18, 7.7),
    materials.hullMid,
  );
  deckInset.position.set(0, 3.63, 5.2);
  group.add(deckInset);

  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(4.75, 2.25),
    createShipDecalMaterial(textures.shipDecal, 0.82),
  );
  decal.rotation.x = -Math.PI / 2;
  decal.position.set(0, 3.735, 1.55);
  decal.renderOrder = 3;
  decal.userData.noOutline = true;
  group.add(decal);

  // A raised engineering spine breaks the dorsal silhouette and gives the
// mid-body a clear hierarchy: dark structural trench, ceramic armor caps,
// copper service runs, and a forest of small heat exchangers.
  const spine = new THREE.Group();
  spine.name = 'dorsal-engineering-spine';
  const spineBase = new THREE.Mesh(
    new THREE.BoxGeometry(3.15, 0.62, 12.6),
    materials.hullDark,
  );
  spineBase.position.set(0, 3.92, 9.3);
  spine.add(spineBase);
  [5.0, 8.3, 11.6, 14.3].forEach((z, index) => {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.26, 2.75),
      index % 2 === 0 ? materials.armorLight : materials.armorWarm,
    );
    cap.position.set(0, 4.3, z);
    cap.rotation.y = index % 2 === 0 ? 0.02 : -0.025;
    spine.add(cap);
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.08, 0.12),
      materials.panelLine,
    );
    seam.position.set(0, 4.45, z + 1.36);
    spine.add(seam);
  });
  [-1.72, 1.72].forEach((x) => {
    createTubeBetween(
      spine,
      new THREE.Vector3(x, 4.15, 3.4),
      new THREE.Vector3(x, 4.15, 15.2),
      0.075,
      x < 0 ? materials.copper : materials.frame,
      5,
    );
    for (let i = 0; i < 5; i += 1) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.55, 0.1),
        materials.trimDim,
      );
      fin.position.set(x, 4.38, 4.8 + i * 2.4);
      spine.add(fin);
    }
  });
  // Exposed heat-exchanger stacks on both flanks of the spine.
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i += 1) {
      const stack = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.52, 1.55),
        i === 1 ? materials.armorMid : materials.hullMid,
      );
      stack.position.set(side * 1.98, 4.0, 6.4 + i * 2.8);
      spine.add(stack);
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.09, 1.05),
        materials.trimAmber,
      );
      glow.position.set(side * 2.21, 4.0, 6.4 + i * 2.8);
      glow.userData.noOutline = true;
      spine.add(glow);
    }
  }
  const mast = new THREE.Group();
  mast.position.set(0, 4.4, 11.4);
  const mastBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.48, 0.4, 8),
    materials.hullDark,
  );
  mast.add(mastBase);
  const mastRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.095, 2.9, 6),
    materials.frame,
  );
  mastRod.position.y = 1.55;
  mast.add(mastRod);
  const mastTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    makeBasicMaterial('#ffbc72'),
  );
  mastTip.position.y = 3.02;
  mastTip.userData.noOutline = true;
  mast.add(mastTip);
  shipState.beacons.push(mastTip);
  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.075, 0.075),
    materials.frame,
  );
  crossbar.position.y = 2.1;
  mast.add(crossbar);
  [-0.9, 0.9].forEach((x) => {
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.38, 5),
      materials.armorLight,
    );
    tip.rotation.z = Math.PI / 2;
    tip.position.set(x, 2.1, 0);
    mast.add(tip);
  });
  spine.add(mast);
  group.add(spine);

  // Long ceramic-and-copper chine rails catch the light along the full body.
  for (let side = -1; side <= 1; side += 2) {
    const upper = [];
    const lower = [];
    for (let i = 0; i < 15; i += 1) {
      const z = -19.4 + (i / 14) * 33.4;
      const station = stationAt(z);
      upper.push(
        new THREE.Vector3(
          side * (station.w * 1.005 + 0.08),
          (station.cy || 0) + 0.78,
          z,
        ),
      );
      lower.push(
        new THREE.Vector3(
          side * (station.w * 0.992 + 0.12),
          (station.cy || 0) - 0.86,
          z,
        ),
      );
    }
    [upper, lower].forEach((points, index) => {
      const rail = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points),
          44,
          index === 0 ? 0.075 : 0.055,
          5,
          false,
        ),
        index === 0 ? materials.armorLight : materials.copper,
      );
      group.add(rail);
    });
  }

  // Dorsal docking collar with six mechanical clamps. It reads as a
  // functional hatch at close range and as a bright ceramic disc from afar.
  const collar = new THREE.Group();
  collar.name = 'dorsal-docking-collar';
  collar.position.set(0, 4.55, 8.2);
  const collarRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.105, 6, 28),
    materials.frame,
  );
  collarRing.rotation.x = Math.PI / 2;
  collar.add(collarRing);
  const collarWell = new THREE.Mesh(
    new THREE.CylinderGeometry(1.08, 1.08, 0.08, 28),
    materials.hullDark,
  );
  collar.add(collarWell);
  const collarCore = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 24),
    materials.hullMid,
  );
  collarCore.rotation.x = -Math.PI / 2;
  collarCore.position.y = 0.06;
  collar.add(collarCore);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * TAU;
    const clamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.18, 0.46),
      materials.armorWarm,
    );
    clamp.position.set(Math.cos(angle) * 1.22, 0.08, Math.sin(angle) * 1.22);
    clamp.rotation.y = -angle;
    collar.add(clamp);
  }
  const collarLamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.025, 0.075),
    materials.trimAmber,
  );
  collarLamp.position.set(0, 0.11, -1.33);
  markNoOutline(collarLamp);
  collar.add(collarLamp);
  group.add(collar);

  addBoltRow(
    group,
    materials.frame,
    new THREE.Vector3(-3.4, 3.75, 0.95),
    new THREE.Vector3(-3.4, 3.75, 9.4),
    11,
    0.037,
  );
  addBoltRow(
    group,
    materials.frame,
    new THREE.Vector3(3.4, 3.75, 0.95),
    new THREE.Vector3(3.4, 3.75, 9.4),
    11,
    0.037,
  );

  // Port/starboard registry stencils are set into the shoulder line.
  const stencilMaterial = createShipDecalMaterial(textures.stencil, 0.68);
  for (let side = -1; side <= 1; side += 2) {
    const stencil = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 2.62),
      stencilMaterial,
    );
    stencil.rotation.y = side * Math.PI * 0.5;
    stencil.position.set(
      side * (stationAt(2).w * 1.032 + 0.06),
      0.46,
      2.0,
    );
    stencil.renderOrder = 4;
    stencil.userData.noOutline = true;
    group.add(stencil);
  }

  // Service trenches and plumbing follow the hull taper rather than
  // floating at one fixed width.
  for (let side = -1; side <= 1; side += 2) {
    const pipeSpecs = [
      { y: -0.36, radius: 0.075, material: materials.copper, offset: 0.32 },
      { y: -0.7, radius: 0.055, material: materials.frame, offset: 0.42 },
      { y: -1.02, radius: 0.045, material: materials.trimDim, offset: 0.5 },
    ];
    pipeSpecs.forEach((spec) => {
      const points = [];
      for (let z = -1; z <= 16.5; z += 3.5) {
        const station = stationAt(z);
        points.push(
          new THREE.Vector3(
            side * (station.w + spec.offset),
            (station.cy || 0) + spec.y,
            z,
          ),
        );
      }
      const pipe = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points),
          44,
          spec.radius,
          5,
          false,
        ),
        spec.material,
      );
      pipe.name = 'external-service-pipe';
      group.add(pipe);
    });

    const conduit = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.34, 11.4),
      materials.panelLine,
    );
    conduit.position.set(side * (stationAt(7).w * 0.995), -1.15, 7.2);
    group.add(conduit);

    addRCSCluster(
      group,
      materials,
      new THREE.Vector3(
        side * stationAt(-13).w * 0.94,
        0.1,
        -13,
      ),
      side,
    );
    addRCSCluster(
      group,
      materials,
      new THREE.Vector3(
        side * stationAt(15.5).w * 0.94,
        0.25,
        15.5,
      ),
      side,
    );
  }

  addVentBlock(
    group,
    materials,
    2.7,
    0.34,
    1.8,
    new THREE.Vector3(3.15, 2.78, 14.8),
    -Math.PI * 0.46,
    6,
  );
  addVentBlock(
    group,
    materials,
    2.7,
    0.34,
    1.8,
    new THREE.Vector3(-3.15, 2.78, 14.8),
    Math.PI * 0.46,
    6,
  );

  // Forward sensor prow under the nose. Small cyan slits give the ship a
  // coherent service-light language without relying on noisy emitters.
  const prow = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.34, 2.8),
    materials.armorWarm,
  );
  prow.position.set(0, -1.55, -18.3);
  prow.rotation.x = -0.2;
  group.add(prow);
  for (let i = -1; i <= 1; i += 1) {
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.04, 0.12),
      materials.trimCyan,
    );
    slit.position.set(i * 0.75, -1.38, -19.48);
    slit.rotation.x = -0.2;
    markNoOutline(slit);
    group.add(slit);
  }

  // Hazard tape around the aft service hatch.
  const hazard = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.42),
    materials.warningMaterial,
  );
  hazard.rotation.x = -Math.PI / 2;
  hazard.position.set(0, 2.45, 18.9);
  markNoOutline(hazard);
  group.add(hazard);

  // Rear dorsal greeble field.
  const random = mulberry32(7107);
  for (let i = 0; i < 22; i += 1) {
    const width = randRange(random, 0.35, 1.25);
    const height = randRange(random, 0.12, 0.5);
    const depth = randRange(random, 0.5, 2.1);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      i % 4 === 0 ? materials.armorMid : materials.hullDark,
    );
    box.position.set(
      randRange(random, -3.1, 3.1),
      3.78 + height * 0.5,
      randRange(random, 10.4, 18.6),
    );
    box.rotation.y = randRange(random, -0.1, 0.1);
    group.add(box);
  }

  // Side windows make the scale legible.
  const windowMaterial = makeBasicMaterial('#ffcf96', {
    transparent: true,
    opacity: 0.78,
  });
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 7; i += 1) {
      const z = -1 + i * 2.25;
      const station = stationAt(z);
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.13, 0.72),
        windowMaterial,
      );
      window.position.set(
        side * (station.w * 1.004 + 0.01),
        0.35,
        z,
      );
      group.add(window);
    }
  }

  // Forward canards.
  const canardPoints = [
    [4.6, -17.4],
    [9.2, -15.6],
    [11.4, -11.6],
    [7.6, -12.3],
    [4.8, -14.6],
  ];
  const canardGeometry = createPlateGeometry(canardPoints, 0.28, 0.05);
  const canardRight = new THREE.Mesh(canardGeometry, materials.armorMid);
  canardRight.position.set(0, -0.34, 0);
  group.add(canardRight);
  const canardLeft = canardRight.clone();
  canardLeft.scale.x = -1;
  canardLeft.material = materials.armorMid;
  group.add(canardLeft);

  const canardTip = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.05, 0.08),
    materials.trimCyan,
  );
  canardTip.position.set(8.5, -0.18, -14.1);
  canardTip.rotation.y = -0.45;
  group.add(canardTip);
  const canardTipLeft = canardTip.clone();
  canardTipLeft.position.x *= -1;
  canardTipLeft.rotation.y *= -1;
  group.add(canardTipLeft);

  // Ventral keel fin.
  const keel = new THREE.Mesh(
    createVerticalPlateGeometry(
      [
        [-6, -2.2],
        [11, -2.35],
        [20.5, -5.4],
        [9.2, -4.25],
        [0.8, -3.3],
      ],
      0.32,
      0.04,
    ),
    materials.hullDark,
  );
  group.add(keel);
  const keelAccent = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.07, 15),
    materials.trimAmber,
  );
  keelAccent.position.set(0, -4.18, 7.5);
  keelAccent.rotation.x = -0.16;
  group.add(keelAccent);

  // -------------------------------------------------------------------------
  // Command architecture / massing
  // -------------------------------------------------------------------------
  // The original hull was a clean missile. A raised citadel immediately behind
  // the canopy, armoured canopy buttresses and deep side sponsons give it the
  // stepped, top-heavy command silhouette of a long-range exploration craft.
  const citadelProfile = [
    [-1.3, 2.9],
    [-1.3, 4.3],
    [-0.1, 5.15],
    [2.4, 5.3],
    [4.9, 4.7],
    [6.0, 3.55],
    [4.5, 3.0],
    [1.0, 2.85],
  ];
  const citadel = new THREE.Mesh(
    createVerticalPlateGeometry(citadelProfile, 6.25, 0.08),
    materials.hullDark,
  );
  citadel.name = 'command-citadel';
  group.add(citadel);

  const citadelCapProfile = [
    [-0.3, 4.35],
    [0.45, 5.1],
    [2.4, 5.24],
    [4.65, 4.65],
    [5.5, 3.75],
    [4.35, 3.52],
    [-0.55, 4.18],
  ];
  const citadelCap = new THREE.Mesh(
    createVerticalPlateGeometry(citadelCapProfile, 5.05, 0.07),
    materials.armorLight,
  );
  citadelCap.name = 'citadel-ceramic-cap';
  group.add(citadelCap);

  // Forward-facing bridge slit and secondary command windows. These are
  // intentionally small enough not to compete with the canopy, but bright
  // enough to provide scale when the ship is seen from the side.
  const bridgeVisor = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.34, 0.16),
    materials.hullDark,
  );
  bridgeVisor.position.set(0, 4.43, -1.27);
  group.add(bridgeVisor);
  [-1.75, -0.95, -0.15, 0.65, 1.45].forEach((x) => {
    const pane = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.035),
      materials.trimAmber,
    );
    pane.position.set(x, 4.44, -1.36);
    markNoOutline(pane);
    group.add(pane);
  });

  // A blade-like command fin gives the ship a memorable top silhouette.
  const commandFin = new THREE.Mesh(
    createVerticalPlateGeometry(
      [
        [2.15, 5.2],
        [3.05, 7.1],
        [4.25, 7.0],
        [5.2, 5.2],
      ],
      0.3,
      0.03,
    ),
    materials.wingPanel,
  );
  group.add(commandFin);
  const commandFinEdge = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.05, 1.45),
    materials.trimCyan,
  );
  commandFinEdge.position.set(0, 7.1, 3.15);
  markNoOutline(commandFinEdge);
  group.add(commandFinEdge);
  const commandFinBase = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.4, 2.6),
    materials.hullMid,
  );
  commandFinBase.position.set(0, 5.22, 3.55);
  group.add(commandFinBase);

  // Dark separation line and mechanical hinges under the ceramic cap.
  const citadelSeam = new THREE.Mesh(
    new THREE.BoxGeometry(6.32, 0.16, 0.3),
    materials.panelLine,
  );
  citadelSeam.position.set(0, 4.0, -1.15);
  citadelSeam.rotation.x = 0.16;
  group.add(citadelSeam);
  [-2.2, -0.8, 0.6, 2.0].forEach((z, index) => {
    const hinge = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.15, 0.42),
      index % 2 === 0 ? materials.frame : materials.copper,
    );
    hinge.position.set(0, 4.72 - index * 0.025, z);
    group.add(hinge);
    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.08, 8),
      materials.rib,
    );
    bolt.position.set(0.36, 4.8, z);
    group.add(bolt);
  });
  [-3.1, 3.1].forEach((x) => {
    for (let i = 0; i < 5; i += 1) {
      const louver = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.08, 0.84),
        materials.trimDim,
      );
      louver.position.set(x, 3.95 + i * 0.2, 2.2);
      louver.rotation.z = Math.PI * 0.04;
      markNoOutline(louver);
      group.add(louver);
    }
    addRCSCluster(
      group,
      materials,
      new THREE.Vector3(x * 1.04, 4.3, 4.55),
      x < 0 ? -1 : 1,
    );
  });

  // Heavy buttresses frame the glasshouse without hiding it. They are part of
  // the hull, so detaching the canopy reveals a complete structural aperture.
  const buttressProfile = [
    [-12.1, 2.46],
    [-12.1, 3.08],
    [-8.4, 3.68],
    [-2.3, 3.42],
    [-2.3, 2.68],
    [-7.3, 2.36],
  ];
  for (let side = -1; side <= 1; side += 2) {
    const buttress = new THREE.Mesh(
      createVerticalPlateGeometry(buttressProfile, 1.55, 0.06),
      materials.hullMid,
    );
    buttress.position.x = side * 5.05;
    buttress.name = 'canopy-buttress';
    group.add(buttress);

    const buttressRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.18, 8.1),
      materials.armorLight,
    );
    buttressRail.position.set(side * 5.78, 3.18, -7.0);
    buttressRail.rotation.x = -0.065;
    group.add(buttressRail);

    const buttressPipes = [
      { y: 2.72, radius: 0.065, material: materials.copper },
      { y: 2.9, radius: 0.045, material: materials.frame },
    ];
    buttressPipes.forEach((pipe, index) => {
      createTubeBetween(
        group,
        new THREE.Vector3(side * 5.73, pipe.y, -11.4 + index * 0.22),
        new THREE.Vector3(side * 5.73, pipe.y + 0.3, -2.8),
        pipe.radius,
        pipe.material,
        5,
      );
    });
  }

  // Deep side sponsons give the profile a broad, purposeful centre of mass.
  // They also carry the RCS quads and service lighting that would normally
  // clutter the clean outer armour.
  const sponsonProfile = [
    [0.1, -1.02],
    [1.1, -1.36],
    [5.8, -1.32],
    [9.5, -0.74],
    [10.6, 0.03],
    [8.7, 0.9],
    [3.0, 1.08],
    [0.8, 0.52],
  ];
  const sponsonCapProfile = [
    [1.3, 0.28],
    [3.15, 0.94],
    [8.6, 0.78],
    [9.55, 0.2],
    [8.5, -0.2],
    [3.15, -0.05],
  ];
  for (let side = -1; side <= 1; side += 2) {
    const sponson = new THREE.Mesh(
      createVerticalPlateGeometry(sponsonProfile, 2.35, 0.07),
      materials.hullDark,
    );
    sponson.position.x = side * 9.0;
    sponson.name = 'side-sponson';
    group.add(sponson);

    const cap = new THREE.Mesh(
      createVerticalPlateGeometry(sponsonCapProfile, 2.05, 0.05),
      materials.armorMid,
    );
    cap.position.set(side * 9.0, 0.18, 0);
    group.add(cap);

    const capRail = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.14, 7.4),
      materials.armorLight,
    );
    capRail.position.set(side * 9.05, 1.18, 5.1);
    capRail.rotation.z = side * 0.04;
    group.add(capRail);

    for (let i = 0; i < 4; i += 1) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(2.72, 0.12, 0.35),
        materials.rib,
      );
      rib.position.set(side * 9.0, -0.1, 1.25 + i * 2.45);
      group.add(rib);
    }

    const outerAmber = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.055, 5.9),
      materials.trimAmber,
    );
    outerAmber.position.set(side * 10.21, 0.04, 4.5);
    markNoOutline(outerAmber);
    group.add(outerAmber);

    addRCSCluster(
      group,
      materials,
      new THREE.Vector3(side * 9.85, 0.4, 0.55),
      side,
    );
    addRCSCluster(
      group,
      materials,
      new THREE.Vector3(side * 9.85, 0.4, 9.25),
      side,
    );
    addVentBlock(
      group,
      materials,
      2.16,
      0.22,
      1.2,
      new THREE.Vector3(side * 10.24, 0.36, 5.6),
      side < 0 ? -Math.PI / 2 : Math.PI / 2,
      4,
    );

    // Two solid mounting arms stop the wide sponson reading as a floating box.
    [2.1, 7.6].forEach((z) => {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 0.42, 1.15),
        materials.hullMid,
      );
      arm.position.set(side * 8.12, 0.16, z);
      arm.rotation.z = side * 0.08;
      group.add(arm);
      const armBolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.18, 8),
        materials.frame,
      );
      armBolt.rotation.z = Math.PI / 2;
      armBolt.position.set(side * 8.95, 0.16, z);
      group.add(armBolt);
    });

    // Aft radiator blade, edged with a warm service strip.
    const radiatorProfile = [
      [7.7, 0.3],
      [7.7, 1.0],
      [11.6, 2.6],
      [12.7, 2.45],
      [12.7, 1.08],
      [9.6, 0.18],
    ];
    const radiator = new THREE.Mesh(
      createVerticalPlateGeometry(radiatorProfile, 0.24, 0.03),
      materials.wingPanel,
    );
    radiator.position.x = side * 9.6;
    group.add(radiator);
    const radiatorEdge = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.06, 4.65),
      materials.trimAmber,
    );
    radiatorEdge.position.set(side * 9.6, 2.47, 10.05);
    radiatorEdge.rotation.x = 0.39;
    markNoOutline(radiatorEdge);
    group.add(radiatorEdge);

    // Bow mandible: an angular, forward-swept blade that splits the nose.
    const mandibleProfile = [
      [-13.7, 0.18],
      [-16.8, -0.34],
      [-22.3, 0.06],
      [-23.05, 0.58],
      [-18.2, 0.86],
      [-14.4, 0.62],
    ];
    const mandible = new THREE.Mesh(
      createVerticalPlateGeometry(mandibleProfile, 0.55, 0.04),
      materials.hullMid,
    );
    mandible.position.x = side * 3.15;
    group.add(mandible);
    const mandibleEdge = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.09, 3.4),
      materials.armorWarm,
    );
    mandibleEdge.position.set(side * 3.15, 0.63, -19.25);
    mandibleEdge.rotation.x = 0.1;
    group.add(mandibleEdge);
    const mandibleLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      materials.trimCyan,
    );
    mandibleLight.position.set(side * 3.15, 0.5, -22.95);
    markNoOutline(mandibleLight);
    group.add(mandibleLight);
  }

  // Ventral mission pod, partially protecting the keel root and adding a
  // second, lower horizontal line to the side profile.
  const missionPod = new THREE.Mesh(
    new THREE.BoxGeometry(3.7, 0.78, 8.8),
    materials.hullDark,
  );
  missionPod.position.set(0, -2.18, 3.2);
  missionPod.rotation.x = -0.035;
  group.add(missionPod);
  const missionPodCap = new THREE.Mesh(
    new THREE.BoxGeometry(3.15, 0.24, 7.65),
    materials.armorMid,
  );
  missionPodCap.position.set(0, -1.83, 3.2);
  missionPodCap.rotation.x = -0.035;
  group.add(missionPodCap);
  for (let i = 0; i < 5; i += 1) {
    const podRib = new THREE.Mesh(
      new THREE.BoxGeometry(3.86, 0.08, 0.18),
      materials.panelLine,
    );
    podRib.position.set(0, -2.16, 0.6 + i * 1.62);
    group.add(podRib);
  }
  const targetingGimbal = new THREE.Group();
  targetingGimbal.position.set(0, -2.0, -13.8);
  const gimbalBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.34, 0.42, 12),
    materials.hullMid,
  );
  gimbalBody.rotation.x = Math.PI / 2;
  targetingGimbal.add(gimbalBody);
  const gimbalLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8),
    materials.trimCyan,
  );
  gimbalLens.position.z = -0.34;
  markNoOutline(gimbalLens);
  targetingGimbal.add(gimbalLens);
  group.add(targetingGimbal);

  // Heavy circumferential service belts segment the long hull and provide
  // instant scale cues. They are real raised shell strips, not surface paint.
  [-12.4, -3.6, 5.2, 16.1].forEach((z, index) => {
    const before = stationAt(z - 0.28);
    const after = stationAt(z + 0.28);
    const band = new THREE.Mesh(
      createLoftGeometry(
        [
          { ...before, z: z - 0.28, w: before.w * 1.018, h: before.h * 1.02 },
          { ...after, z: z + 0.28, w: after.w * 1.022, h: after.h * 1.024 },
        ],
        32,
        0,
        TAU,
      ),
      index % 2 === 0 ? materials.hullDark : materials.rib,
    );
    band.name = 'structural-service-belt';
    group.add(band);

    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.045, 4, 42),
      index === 2 ? materials.trimAmber : materials.trimDim,
    );
    edge.scale.set(after.w * 1.026, after.h * 1.028, 1);
    edge.position.set(0, after.cy || 0, z + 0.3);
    markNoOutline(edge);
    group.add(edge);
  });

  // Big dark access modules sit under the side stencils, giving the white
  // armour a strong graphic break and a place for exposed maintenance gear.
  for (let side = -1; side <= 1; side += 2) {
    const accessWidth = stationAt(2).w;
    const access = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 3.05, 8.7),
      materials.hullDark,
    );
    access.position.set(side * accessWidth * 1.018, 0.5, 1.7);
    group.add(access);

    [-1.32, 1.32].forEach((y) => {
      const frameRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.11, 8.9),
        y > 0 ? materials.armorWarm : materials.frame,
      );
      frameRail.position.set(side * accessWidth * 1.03, 0.5 + y, 1.7);
      group.add(frameRail);
    });
    [-5.05, 5.05].forEach((z) => {
      const hinge = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.2, 0.42),
        materials.copper,
      );
      hinge.position.set(side * accessWidth * 1.035, 1.5, 1.7 + z);
      group.add(hinge);
    });

    // Exposed service panel: dark glass with a warm instrument strip.
    const servicePanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.58, 2.25),
      materials.hullMid,
    );
    servicePanel.position.set(side * accessWidth * 1.041, -0.54, -4.55);
    group.add(servicePanel);
    const serviceGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.08, 1.45),
      materials.trimAmber,
    );
    serviceGlow.position.set(side * accessWidth * 1.052, -0.42, -4.55);
    markNoOutline(serviceGlow);
    group.add(serviceGlow);

    // Broad ceramic side strake with black gaps, running from bow to waist.
    const strake = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.46, 8.5),
      materials.armorLight,
    );
    strake.position.set(side * accessWidth * 1.014, -1.68, 2.1);
    strake.rotation.x = -0.015;
    group.add(strake);
    const strakeGap = new THREE.Mesh(
      new THREE.BoxGeometry(0.245, 0.12, 8.55),
      materials.panelLine,
    );
    strakeGap.position.set(side * accessWidth * 1.018, -1.88, 2.1);
    group.add(strakeGap);
  }

  // A dense little navigation / sensor stack on the forward crown. It breaks
  // the nose silhouette at close range and gives the eye a sense of scale.
  const crownStack = new THREE.Group();
  crownStack.position.set(0, 1.82, -17.2);
  const crownBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.34, 3.2),
    materials.hullDark,
  );
  crownStack.add(crownBase);
  [-0.42, 0.42].forEach((x, index) => {
    const sensorBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.5, 1.25),
      index === 0 ? materials.armorMid : materials.copper,
    );
    sensorBlock.position.set(x, 0.35, 0.3);
    crownStack.add(sensorBlock);
  });
  const crownLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 0.26, 10),
    materials.trimCyan,
  );
  crownLens.rotation.x = Math.PI / 2;
  crownLens.position.set(0, 0.39, -1.35);
  markNoOutline(crownLens);
  crownStack.add(crownLens);
  group.add(crownStack);

  // Dark intake recesses with slats.
  const intakeMaterial = new THREE.MeshStandardMaterial({
    color: 0x020408,
    metalness: 0.5,
    roughness: 0.62,
  });
  for (let side = -1; side <= 1; side += 2) {
    const intake = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.2, 4.2),
      intakeMaterial,
    );
    intake.position.set(side * 6.0, -0.72, -3.4);
    intake.rotation.y = side * 0.08;
    group.add(intake);
    for (let i = 0; i < 5; i += 1) {
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.045, 0.065),
        materials.armorLight,
      );
      slat.position.set(side * 5.62, -0.72, -5.1 + i * 0.78);
      group.add(slat);
    }
  }

  // A warm central tail light and the aft engineering ring.
  const tailRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.16, 6, 24),
    materials.hullMid,
  );
  tailRing.position.set(0, 0.1, 23.8);
  group.add(tailRing);
  const tailGlow = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 24),
    materials.trimAmber,
  );
  tailGlow.position.set(0, 0.1, 23.95);
  markNoOutline(tailGlow);
  group.add(tailGlow);

  // Running lights / dorsal beacon.
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    makeBasicMaterial('#ffc07a'),
  );
  beacon.position.set(0.9, 4.02, 11.5);
  markNoOutline(beacon);
  group.add(beacon);
  shipState.beacons.push(beacon);

  const hullLight = new THREE.PointLight(0x7ad9ff, 540, 150, 2);
  hullLight.position.set(-24, 22, -8);
  group.add(hullLight);
  const warmBounce = new THREE.PointLight(0xffb478, 280, 120, 2);
  warmBounce.position.set(18, 4, 26);
  group.add(warmBounce);

  return group;
}

function buildCanopy(materials, glowTexture) {
  const group = new THREE.Group();
  group.name = 'canopy-geometry';

  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.55, 12.4),
    materials.hullMid,
  );
  sill.position.set(0, 2.85, -9.2);
  group.add(sill);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 20, 0, TAU, 0, Math.PI / 2),
    materials.glass,
  );
  dome.scale.set(3.2, 2.8, 7.0);
  dome.position.set(0, 3.08, -8.8);
  group.add(dome);

  const innerShell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 30, 14, 0, TAU, 0, Math.PI / 2),
    materials.glassInner,
  );
  innerShell.scale.set(2.85, 2.45, 6.55);
  innerShell.position.set(0, 3.11, -8.8);
  innerShell.userData.noPick = true;
  group.add(innerShell);

  const frameMaterial = materials.frame;
  const hoopGeometry = new THREE.TorusGeometry(1, 0.055, 5, 34, Math.PI);
  const canopyCenterZ = -8.8;
  const canopyHalfLength = 7.0;
  [
    { z: -13.6, sx: 2.34, sy: 2.05 },
    { z: -9.2, sx: 3.17, sy: 2.77 },
    { z: -4.1, sx: 2.4, sy: 2.1 },
  ].forEach(({ z, sx, sy }) => {
    const hoop = new THREE.Mesh(hoopGeometry, frameMaterial);
    const normalized = (z - canopyCenterZ) / canopyHalfLength;
    const taper = Math.sqrt(Math.max(0.08, 1 - normalized * normalized));
    hoop.scale.set(sx * taper + 0.03, sy * taper + 0.02, 1);
    hoop.position.set(0, 3.08, z);
    group.add(hoop);
  });

  const topRailPoints = [];
  for (let i = 0; i < 8; i += 1) {
    const z = -14.7 + (i / 7) * 11.9;
    const t = (z + 14.7) / 11.9;
    const curve = Math.sin(t * Math.PI);
    topRailPoints.push(new THREE.Vector3(0, 3.08 + 2.78 * curve + 0.06, z));
  }
  const topRailCurve = new THREE.CatmullRomCurve3(topRailPoints);
  const topRail = new THREE.Mesh(
    new THREE.TubeGeometry(topRailCurve, 32, 0.06, 5, false),
    frameMaterial,
  );
  group.add(topRail);

  // Interior silhouettes and instrument glow.
  const seatMaterial = new THREE.MeshStandardMaterial({
    color: 0x13171c,
    metalness: 0.4,
    roughness: 0.7,
  });
  [-9.6, -7.8].forEach((z) => {
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.5, 0.65),
      seatMaterial,
    );
    seat.position.set(-0.8, 3.1, z);
    seat.rotation.x = -0.12;
    group.add(seat);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      seatMaterial,
    );
    head.position.set(-0.8, 3.92, z - 0.06);
    group.add(head);
  });

  const consoleMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.07, 1.05),
    makeBasicMaterial('#67e5ff', { transparent: true, opacity: 0.5 }),
  );
  consoleMesh.position.set(0.25, 3.18, -10.75);
  consoleMesh.rotation.x = -0.38;
  group.add(consoleMesh);

  const glow = createSprite(glowTexture, '#81e9ff', 0.16, 8.5);
  glow.position.set(0, 3.8, -8.8);
  glow.userData.noOutline = true;
  group.add(glow);

  return group;
}

function createWingGeometryParts() {
  const outer = [
    [2.2, -8.0],
    [17.4, 0.8],
    [21.0, 4.5],
    [16.0, 9.8],
    [8.0, 14.2],
    [3.3, 10.1],
    [4.7, 2.0],
  ];
  const inner = [
    [4.2, -4.7],
    [15.4, 1.6],
    [18.2, 4.6],
    [14.4, 8.2],
    [8.3, 11.3],
    [5.3, 8.4],
    [6.2, 2.2],
  ];
  return {
    outer: createPlateGeometry(outer, 0.7, 0.09),
    inner: createPlateGeometry(inner, 0.22, 0.04),
    outerPoints: outer,
  };
}

function buildWing(side, materials, textures, glowTexture, sharedWingGeometry, shipState) {
  const group = new THREE.Group();
  group.name = side < 0 ? 'port-wing-geometry' : 'starboard-wing-geometry';
  if (side < 0) group.scale.x = -1;

  const wingBase = new THREE.Mesh(sharedWingGeometry.outer, materials.wing);
  wingBase.position.set(0, -2.15, 0);
  group.add(wingBase);

  const wingPanel = new THREE.Mesh(
    sharedWingGeometry.inner,
    materials.wingPanel,
  );
  wingPanel.position.set(0, -1.73, 0);
  group.add(wingPanel);

  // Interlocking ceramic armor tiles float over a dark structural wing box.
  // The tile gaps expose graphite frame and read as true layered plating.
  const wingTiles = [
    { x: 7.7, z: 0.9, w: 4.8, d: 3.0, r: -0.34 },
    { x: 11.4, z: 4.7, w: 4.4, d: 2.9, r: -0.38 },
    { x: 14.2, z: 8.0, w: 3.4, d: 2.5, r: -0.44 },
    { x: 7.1, z: 5.8, w: 3.1, d: 2.3, r: -0.2 },
  ];
  const wingTileMaterials = [
    materials.wingCeramic,
    materials.armorMid,
    materials.wingPanel,
    materials.armorWarm,
  ];
  wingTiles.forEach((tile, index) => {
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(tile.w + 0.26, 0.18, tile.d + 0.24),
      materials.rib,
    );
    backing.position.set(tile.x, -1.62, tile.z);
    backing.rotation.y = tile.r;
    group.add(backing);
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(tile.w, 0.12, tile.d),
      wingTileMaterials[index],
    );
    plate.position.set(tile.x, -1.49, tile.z);
    plate.rotation.y = tile.r;
    group.add(plate);
    [-0.34, 0.34].forEach((offset) => {
      const bolt = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 6, 5),
        materials.frame,
      );
      bolt.position.set(
        tile.x + Math.cos(tile.r) * offset * tile.w,
        -1.41,
        tile.z - Math.sin(tile.r) * offset * tile.w,
      );
      group.add(bolt);
    });
  });

  // Exposed chordwise ribs sit above the ceramic tiles. They break the broad
  // lifting surface into distinct structural bays and catch the rim light.
  const wingRibs = [
    { x: 7.7, z0: -3.9, z1: 11.3 },
    { x: 11.4, z0: -1.55, z1: 9.9 },
    { x: 14.2, z0: 0.25, z1: 8.7 },
  ];
  wingRibs.forEach((rib, index) => {
    const spar = createTubeBetween(
      group,
      new THREE.Vector3(rib.x, -1.37, rib.z0),
      new THREE.Vector3(rib.x, -1.37, rib.z1),
      0.055,
      index === 1 ? materials.copper : materials.frame,
      5,
    );
    spar.userData.noOutline = false;
    const rootCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.9),
      materials.hullDark,
    );
    rootCap.position.set(rib.x, -1.33, rib.z0 + 0.25);
    group.add(rootCap);
  });

  // A thick ceramic leading edge and exposed stainless wing spar.
  const leadArmor = createTubeBetween(
    group,
    new THREE.Vector3(2.9, -1.62, -7.55),
    new THREE.Vector3(19.6, -1.62, 3.95),
    0.19,
    materials.wingCeramic,
    6,
  );
  leadArmor.userData.noOutline = false;
  createTubeBetween(
    group,
    new THREE.Vector3(3.9, -1.55, 1.25),
    new THREE.Vector3(18.9, -1.55, 8.3),
    0.075,
    materials.frame,
    5,
  );
  const actuator = createTubeBetween(
    group,
    new THREE.Vector3(3.0, -1.35, -1.15),
    new THREE.Vector3(9.0, -1.42, 4.8),
    0.115,
    materials.copper,
    7,
  );
  actuator.userData.noOutline = false;
  for (let i = 0; i < 3; i += 1) {
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.5, 8),
      materials.hullDark,
    );
    sleeve.rotation.z = Math.PI / 2;
    sleeve.position.set(4.6 + i * 1.5, -1.38, -0.15 + i * 1.7);
    group.add(sleeve);
  }

  // Three articulated trailing-edge surfaces with cyan hinge lines.
  const flapSpecs = [
    { x: 7.0, z: 12.0, w: 3.8, r: -0.38 },
    { x: 11.4, z: 9.9, w: 3.2, r: -0.42 },
    { x: 15.1, z: 7.5, w: 2.5, r: -0.46 },
  ];
  flapSpecs.forEach((flap) => {
    const control = new THREE.Mesh(
      new THREE.BoxGeometry(flap.w, 0.16, 1.35),
      materials.wingPanel,
    );
    control.position.set(flap.x, -1.84, flap.z);
    control.rotation.y = flap.r;
    group.add(control);
    const hinge = new THREE.Mesh(
      new THREE.BoxGeometry(flap.w * 0.82, 0.055, 0.065),
      materials.trimDim,
    );
    hinge.position.set(flap.x, -1.74, flap.z - 0.7);
    hinge.rotation.y = flap.r;
    group.add(hinge);
  });

  // Outboard sensor / RCS pod.
  const tipPod = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.74, 3.2),
    materials.hullDark,
  );
  tipPod.position.set(18.9, -1.55, 6.7);
  tipPod.rotation.y = -0.18;
  group.add(tipPod);
  const podArmor = new THREE.Mesh(
    new THREE.BoxGeometry(2.25, 0.16, 2.5),
    materials.armorMid,
  );
  podArmor.position.set(18.9, -1.12, 6.7);
  podArmor.rotation.y = -0.18;
  group.add(podArmor);
  [-1, 1].forEach((direction) => {
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 0.6, 8),
      materials.copper,
    );
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(18.9, -1.7, 6.7 + direction * 1.8);
    group.add(nozzle);
  });

  const leadingEdge = createTubeBetween(
    group,
    new THREE.Vector3(2.4, -1.82, -7.85),
    new THREE.Vector3(20.7, -1.82, 4.5),
    0.055,
    materials.trimCyan,
    5,
  );
  leadingEdge.userData.noOutline = true;

  const trailingEdge = createTubeBetween(
    group,
    new THREE.Vector3(16.0, -1.84, 9.6),
    new THREE.Vector3(4.2, -1.84, 13.9),
    0.035,
    materials.trimDim,
    5,
  );

  // Wingtip winglet and navigation beacon.
  const winglet = new THREE.Mesh(
    createVerticalPlateGeometry(
      [
        [1.7, 1.8],
        [7.4, 1.8],
        [10.4, 5.2],
        [4.2, 4.5],
      ],
      0.22,
      0.04,
    ),
    materials.wingPanel,
  );
  winglet.position.set(19.1, 0, 0);
  group.add(winglet);

  const navColor = side < 0 ? '#ff5c6d' : '#63ffc0';
  const navMaterial = makeBasicMaterial(navColor, {
    transparent: true,
    opacity: 0.95,
  });
  const navMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    navMaterial,
  );
  navMesh.position.set(21.1, -1.62, 4.65);
  navMesh.userData.noOutline = true;
  group.add(navMesh);
  const navGlow = createSprite(glowTexture, navColor, 0.6, 5.2);
  navGlow.position.copy(navMesh.position);
  navGlow.userData.noOutline = true;
  group.add(navGlow);
  shipState.navLights.push({
    mesh: navMesh,
    sprite: navGlow,
    phase: side < 0 ? 0 : 1.7,
  });

  // A small formation light on the upper surface.
  const upperLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.035, 0.11),
    materials.trimDim,
  );
  upperLight.position.set(11.8, -1.68, 4.9);
  upperLight.rotation.y = -0.43;
  group.add(upperLight);

  if (side > 0) {
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(4.1, 4.1),
      createShipDecalMaterial(textures.wingDecal, 0.76),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = -0.35;
    decal.position.set(13.4, -1.54, 4.25);
    decal.renderOrder = 3;
    decal.userData.noOutline = true;
    group.add(decal);
  }

  // Two small heat exchanger panels under the wing.
  const exchanger = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.16, 1.3),
    materials.rib,
  );
  exchanger.position.set(10.3, -2.58, 8.8);
  exchanger.rotation.y = -0.38;
  group.add(exchanger);

  return group;
}

function buildEngine(side, materials, glowTexture, exhaustTexture, shipState) {
  const group = new THREE.Group();
  group.name = side < 0 ? 'port-engine-geometry' : 'starboard-engine-geometry';

  const nacelle = new THREE.Mesh(
    new THREE.CylinderGeometry(2.35, 2.78, 12.6, 12, 1, true),
    materials.hull,
  );
  nacelle.rotation.x = Math.PI / 2;
  group.add(nacelle);

  const innerLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(2.17, 2.52, 12.4, 12, 1, true),
    materials.engineLiner,
  );
  innerLiner.rotation.x = Math.PI / 2;
  innerLiner.scale.set(0.98, 1, 0.98);
  group.add(innerLiner);

  const frontCowl = new THREE.Mesh(
    new THREE.CylinderGeometry(2.95, 2.2, 2.15, 12, 1, true),
    materials.armorMid,
  );
  frontCowl.rotation.x = Math.PI / 2;
  frontCowl.position.z = -7.15;
  group.add(frontCowl);

  // Heavy segmented collar rings give the drive a machined, modular mass.
  // The broad gaps expose the graphite liner and the copper service run.
  [-6.55, -3.25, 0.1, 3.45, 6.75].forEach((z, index) => {
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(index === 4 ? 3.02 : 2.94, 0.24, 8, 40),
      index % 2 === 0 ? materials.armorMid : materials.hullMid,
    );
    collar.position.z = z;
    group.add(collar);
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(index === 4 ? 3.22 : 3.11, 0.045, 5, 48),
      index === 2 ? materials.trimCyan : materials.trimDim,
    );
    trim.position.z = z + 0.04;
    group.add(trim);
  });

  // Three longitudinal armor runners ride over the coil collars. They give
  // the engine a strong top / outboard silhouette instead of a plain tube.
  const runnerAngles = [Math.PI * 0.5, side > 0 ? 0.12 : Math.PI - 0.12, -0.18];
  runnerAngles.forEach((angle, runnerIndex) => {
    const runner = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.32, 9.7),
      runnerIndex === 0 ? materials.armorLight : materials.armorMid,
    );
    const radius = 2.7;
    runner.position.set(
      Math.sin(angle) * radius,
      Math.cos(angle) * radius,
      0.25,
    );
    runner.rotation.z = -angle;
    group.add(runner);
    const inlay = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.045, 7.1),
      runnerIndex === 1 ? materials.warningMaterial : materials.hullDark,
    );
    inlay.position.set(
      Math.sin(angle) * (radius + 0.18),
      Math.cos(angle) * (radius + 0.18),
      0.3,
    );
    inlay.rotation.z = -angle;
    if (inlay.material === materials.warningMaterial) {
      inlay.userData.noOutline = true;
    }
    group.add(inlay);
  });

  // Dorsal service pipes and their clamps.
  [-0.9, 0.9].forEach((x) => {
    const start = new THREE.Vector3(x, 2.5, -6.2);
    const end = new THREE.Vector3(x, 2.8, 6.6);
    createTubeBetween(
      group,
      start,
      end,
      0.085,
      x < 0 ? materials.copper : materials.frame,
      6,
    );
    for (let c = 0; c < 4; c += 1) {
      const clamp = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.045, 4, 10),
        materials.hullDark,
      );
      clamp.position.set(x, 2.5 + (c / 3) * 0.3, -5.5 + c * 3.4);
      clamp.rotation.x = Math.PI / 2;
      group.add(clamp);
    }
  });

  // Outboard radiator fin with exposed actuator.
  const radiator = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 2.35, 6.4),
    materials.armorMid,
  );
  radiator.position.set(side * 2.92, 0.45, 0.9);
  radiator.rotation.z = side * -0.12;
  group.add(radiator);
  const radiatorInset = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.32, 4.3),
    materials.trimAmber,
  );
  radiatorInset.position.set(side * 3.04, 0.85, 1.1);
  radiatorInset.rotation.z = side * -0.12;
  radiatorInset.userData.noOutline = true;
  group.add(radiatorInset);
  for (let i = 0; i < 4; i += 1) {
    const brace = new THREE.Mesh(
      new THREE.BoxGeometry(0.64, 0.14, 0.18),
      materials.frame,
    );
    brace.position.set(side * 2.78, -0.5 + i * 0.62, -1.8 + i * 1.65);
    group.add(brace);
  }

  // A dense service manifold on the inboard flank, half-hidden by the hull.
  const manifold = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.5, 3.5),
    materials.hullDark,
  );
  manifold.position.set(-side * 2.55, -0.8, -0.4);
  group.add(manifold);
  for (let i = 0; i < 3; i += 1) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 2.7, 6),
      i === 1 ? materials.copper : materials.frame,
    );
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(-side * 2.55, -1.2 + i * 0.42, 0.3);
    group.add(pipe);
  }

  const intakeRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.23, 0.15, 6, 28),
    materials.trimCyan,
  );
  intakeRing.position.z = -8.18;
  markNoOutline(intakeRing);
  group.add(intakeRing);

  const intakeDark = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 24),
    new THREE.MeshBasicMaterial({
      color: 0x010306,
      side: THREE.DoubleSide,
    }),
  );
  intakeDark.position.z = -8.19;
  group.add(intakeDark);

  // Armor bands and dorsal stabilizer.
  [-3.9, -0.1, 3.9].forEach((z) => {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(2.54, 0.115, 5, 26),
      materials.armorMid,
    );
    band.position.z = z;
    group.add(band);
  });

  const stabilizer = new THREE.Mesh(
    createVerticalPlateGeometry(
      [
        [-5.4, 2.3],
        [4.2, 2.3],
        [6.2, 4.65],
        [2.5, 4.2],
      ],
      0.28,
      0.04,
    ),
    materials.wingPanel,
  );
  stabilizer.position.set(0, 0.4, 0);
  group.add(stabilizer);

  const spineLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.04, 6.8),
    materials.trimCyan,
  );
  spineLight.position.set(0, 4.77, -0.5);
  group.add(spineLight);

  // Small maintenance greebles on the outboard flank.
  const random = mulberry32(3209 + (side > 0 ? 71 : 0));
  for (let i = 0; i < 7; i += 1) {
    const greeble = new THREE.Mesh(
      new THREE.BoxGeometry(randRange(random, 0.2, 0.65), 0.18, randRange(random, 0.5, 1.7)),
      i % 2 === 0 ? materials.armorMid : materials.rib,
    );
    greeble.position.set(
      side * randRange(random, 2.0, 2.42),
      randRange(random, -1.9, 1.8),
      randRange(random, -5.0, 4.0),
    );
    group.add(greeble);
  }

  // Pylon toward the hull.
  const pylon = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.55, 4.5),
    materials.wingPanel,
  );
  pylon.position.set(-side * 3.0, 1.55, -2.8);
  pylon.rotation.z = side * 0.06;
  group.add(pylon);

  // Exhaust bell.
  const bell = new THREE.Mesh(
    new THREE.CylinderGeometry(3.12, 2.32, 2.3, 14, 1, true),
    materials.armorMid,
  );
  bell.rotation.x = Math.PI / 2;
  bell.position.z = 7.25;
  group.add(bell);

  // Twelve overlapping nozzle petals make the exhaust read as a machine
  // assembly rather than a glowing hole.
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * TAU;
    const petal = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 2.05),
      i % 3 === 0 ? materials.armorLight : materials.hullMid,
    );
    petal.position.set(
      Math.cos(angle) * 2.9,
      Math.sin(angle) * 2.9,
      8.25,
    );
    petal.rotation.z = angle;
    group.add(petal);
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.16, 1.6),
      materials.copper,
    );
    rib.position.set(
      Math.cos(angle + 0.15) * 3.01,
      Math.sin(angle + 0.15) * 3.01,
      8.42,
    );
    rib.rotation.z = angle;
    group.add(rib);
  }

  const exhaustRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.02, 0.2, 7, 42),
    materials.frame,
  );
  exhaustRing.position.z = 8.45;
  group.add(exhaustRing);
  const exhaustInner = new THREE.Mesh(
    new THREE.TorusGeometry(2.48, 0.09, 5, 42),
    materials.trimCyan,
  );
  exhaustInner.position.z = 8.5;
  markNoOutline(exhaustInner);
  group.add(exhaustInner);

  const plasmaDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.35, 28),
    makeBasicMaterial('#b8f4ff', {
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  plasmaDisc.position.z = 8.2;
  plasmaDisc.userData.noOutline = true;
  group.add(plasmaDisc);

  const innerFlameGeometry = new THREE.ConeGeometry(1.55, 7.0, 20, 1, true);
  innerFlameGeometry.rotateX(Math.PI / 2);
  innerFlameGeometry.translate(0, 0, 3.5);
  const innerFlame = new THREE.Mesh(
    innerFlameGeometry,
    createExhaustMaterial('#eafdff', 0.55),
  );
  innerFlame.position.z = 8.2;
  innerFlame.userData.noOutline = true;
  innerFlame.userData.noPick = true;
  group.add(innerFlame);

  const outerFlameGeometry = new THREE.ConeGeometry(2.55, 13.5, 24, 1, true);
  outerFlameGeometry.rotateX(Math.PI / 2);
  outerFlameGeometry.translate(0, 0, 6.75);
  const outerFlame = new THREE.Mesh(
    outerFlameGeometry,
    createExhaustMaterial('#6adfff', 0.24),
  );
  outerFlame.position.z = 8.1;
  outerFlame.userData.noOutline = true;
  outerFlame.userData.noPick = true;
  group.add(outerFlame);

  const glow = createSprite(glowTexture, '#8eeeff', 0.65, 8.0);
  glow.position.z = 8.6;
  glow.userData.noOutline = true;
  group.add(glow);

  const intakeGlow = createSprite(glowTexture, '#77d8ff', 0.28, 4.0);
  intakeGlow.position.z = -8.35;
  intakeGlow.userData.noOutline = true;
  group.add(intakeGlow);

  const engineLight = new THREE.PointLight(0x7be6ff, 180, 42, 2);
  engineLight.position.set(0, 0, 11);
  group.add(engineLight);

  shipState.engineFx.push({
    side,
    innerFlame,
    outerFlame,
    plasmaDisc,
    glow,
    intakeGlow,
    engineLight,
    phase: side < 0 ? 0.6 : 2.1,
  });

  return group;
}

function buildWarpRing(materials, glowTexture, shipState) {
  const group = new THREE.Group();
  group.name = 'warp-ring-geometry';

  const ringBody = new THREE.Mesh(
    new THREE.TorusGeometry(15.2, 0.88, 12, 160),
    materials.warpRing,
  );
  ringBody.position.set(0, 2.5, 14.6);
  group.add(ringBody);

  // A dark structural spine sits under the ceramic coil cowlings. The
  // stepped radii keep the ring reading as an assembly, not a painted hoop.
  const ringSpine = new THREE.Mesh(
    new THREE.TorusGeometry(15.2, 1.12, 10, 160),
    materials.hullDark,
  );
  ringSpine.position.set(0, 2.5, 14.6);
  ringSpine.scale.z = 0.72;
  group.add(ringSpine);

  const ringInner = new THREE.Mesh(
    new THREE.TorusGeometry(14.66, 0.1, 4, 120),
    materials.trimCyan,
  );
  ringInner.position.set(0, 2.5, 14.6);
  group.add(ringInner);

  const ringOuterRail = new THREE.Mesh(
    new THREE.TorusGeometry(16.2, 0.14, 6, 160),
    materials.frame,
  );
  ringOuterRail.position.set(0, 2.5, 14.6);
  group.add(ringOuterRail);

  const ringOuter = new THREE.Mesh(
    new THREE.TorusGeometry(16.48, 0.055, 4, 120),
    materials.trimDim,
  );
  ringOuter.position.set(0, 2.5, 14.6);
  group.add(ringOuter);

  // Eight heavy coil cowlings break the halo into monumental segments.
  const coilGlowMaterial = makeBasicMaterial('#b9f7ff', {
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * TAU;
    const cowl = new THREE.Group();
    cowl.position.set(
      Math.cos(angle) * 15.2,
      2.5 + Math.sin(angle) * 15.2,
      14.6,
    );
    cowl.rotation.z = angle;

    const underBlock = new THREE.Mesh(
      new THREE.BoxGeometry(4.35, 1.45, 2.5),
      materials.hullDark,
    );
    underBlock.position.z = -0.16;
    cowl.add(underBlock);

    const ceramicBlock = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.48, 2.1),
      i % 2 === 0 ? materials.armorLight : materials.armorWarm,
    );
    ceramicBlock.position.set(0, 0.77, 0.08);
    cowl.add(ceramicBlock);

    const darkBand = new THREE.Mesh(
      new THREE.BoxGeometry(3.72, 0.16, 2.22),
      materials.rib,
    );
    darkBand.position.set(0, 0.47, 0.08);
    cowl.add(darkBand);

    const glowSlot = new THREE.Mesh(
      new THREE.BoxGeometry(2.96, 0.075, 0.075),
      coilGlowMaterial,
    );
    glowSlot.position.set(0, 0.98, 1.12);
    markNoOutline(glowSlot);
    cowl.add(glowSlot);

    // Vent louvres on the front face, and a hazard plate on each face.
    for (let l = 0; l < 4; l += 1) {
      const louvre = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.32, 0.08),
        materials.frame,
      );
      louvre.position.set(-1.28 + l * 0.84, -0.2, 1.29);
      cowl.add(louvre);
    }
    const hazardPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.28),
      materials.warningMaterial,
    );
    hazardPlate.position.set(1.5, -0.32, 1.3);
    hazardPlate.userData.noOutline = true;
    cowl.add(hazardPlate);

    // Exposed bolt heads around every cowling.
    for (let b = 0; b < 4; b += 1) {
      const bolt = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 6, 5),
        materials.frame,
      );
      bolt.position.set(
        b < 2 ? -1.48 : 1.48,
        b % 2 === 0 ? 0.62 : -0.52,
        1.28,
      );
      cowl.add(bolt);
    }
    group.add(cowl);
  }

  // The outer rim gets alternating dark clamp shoes and hot service strips.
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * TAU;
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(1.24, 0.32, 1.9),
      i % 2 === 0 ? materials.hullMid : materials.armorMid,
    );
    shoe.position.set(
      Math.cos(angle) * 16.38,
      2.5 + Math.sin(angle) * 16.38,
      14.6,
    );
    shoe.rotation.z = angle;
    group.add(shoe);
    const bolt = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 6, 5),
      materials.frame,
    );
    bolt.position.set(
      Math.cos(angle + 0.08) * 16.71,
      2.5 + Math.sin(angle + 0.08) * 16.71,
      14.6,
    );
    group.add(bolt);
  }

  const energyGroup = new THREE.Group();
  energyGroup.position.set(0, 2.5, 14.72);
  const arcMaterials = [];
  for (let i = 0; i < 8; i += 1) {
    const arcMaterial = makeBasicMaterial(i % 2 === 0 ? '#b7f4ff' : '#8f8bff', {
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(14.95, 0.11, 5, 34, Math.PI * 0.15),
      arcMaterial,
    );
    arc.rotation.z = (i / 8) * TAU + 0.32;
    energyGroup.add(arc);
    arcMaterials.push(arcMaterial);
  }
  group.add(energyGroup);

  // Twelve smaller tuning nodes sit between the cowlings.
  const nodeMaterial = materials.frame;
  const nodeGlowMaterial = makeBasicMaterial('#bff6ff', {
    transparent: true,
    opacity: 0.85,
  });
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * TAU;
    const x = Math.cos(angle) * 15.2;
    const y = 2.5 + Math.sin(angle) * 15.2;
    const node = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.78, 1.55),
      nodeMaterial,
    );
    node.position.set(x, y, 14.6);
    node.rotation.z = angle;
    group.add(node);
    const nodeGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.16, 8),
      nodeGlowMaterial,
    );
    nodeGlow.rotation.x = Math.PI / 2;
    nodeGlow.position.set(
      x + Math.cos(angle) * 0.24,
      y + Math.sin(angle) * 0.24,
      15.44,
    );
    markNoOutline(nodeGlow);
    group.add(nodeGlow);
  }

  // Six braced struts tie the halo back into the hull. Each pair carries a
// dark fairing, a polished hydraulic ram, and a mechanical clamp at the root.
  [-0.42, 0.38, Math.PI * 0.5, Math.PI, 2.68, 3.5].forEach((angle, index) => {
    const outer = new THREE.Vector3(
      Math.cos(angle) * 15.2,
      2.5 + Math.sin(angle) * 15.2,
      14.6,
    );
    const inner = new THREE.Vector3(
      Math.cos(angle) * 5.1,
      2.5 + Math.sin(angle) * 5.1,
      14.6,
    );
    createTubeBetween(group, inner, outer, 0.24, materials.hullDark, 6);
    createTubeBetween(
      group,
      inner.clone().add(new THREE.Vector3(0, 0, 0.28)),
      outer.clone().add(new THREE.Vector3(0, 0, 0.28)),
      0.075,
      index % 2 === 0 ? materials.copper : materials.trimDim,
      5,
    );
    const mid = inner.clone().lerp(outer, 0.56);
    const fairing = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.65, 0.9),
      index % 2 === 0 ? materials.armorMid : materials.armorWarm,
    );
    fairing.position.copy(mid);
    fairing.rotation.z = angle;
    group.add(fairing);
    const clampRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.14, 6, 16),
      materials.frame,
    );
    clampRing.position.copy(inner);
    group.add(clampRing);
    const clampCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.22, 12),
      materials.armorLight,
    );
    clampCap.position.copy(inner).add(new THREE.Vector3(0, 0, 0.28));
    clampCap.rotation.x = Math.PI / 2;
    group.add(clampCap);
  });

  const glow = createSprite(glowTexture, '#8d9dff', 0.06, 38);
  glow.position.set(0, 2.5, 14.6);
  glow.userData.noOutline = true;
  group.add(glow);

  if (shipState) {
    shipState.warpEnergy = energyGroup;
    shipState.warpArcMaterials = arcMaterials;
    shipState.warpGlow = glow;
  }

  return group;
}

function buildSensorArray(materials, textures, glowTexture, shipState) {
  const group = new THREE.Group();
  group.name = 'sensor-array-geometry';

  const fin = new THREE.Mesh(
    createVerticalPlateGeometry(
      [
        [-19.2, 2.8],
        [-14.7, 3.0],
        [-8.8, 6.1],
        [-4.5, 8.9],
        [-2.2, 8.8],
        [-3.8, 5.0],
        [-10.2, 3.05],
      ],
      0.48,
      0.05,
    ),
    materials.wingPanel,
  );
  group.add(fin);

  const finInset = new THREE.Mesh(
    createVerticalPlateGeometry(
      [
        [-16.5, 3.35],
        [-12.4, 3.5],
        [-7.3, 6.3],
        [-4.8, 7.9],
        [-4.3, 7.2],
        [-8.3, 4.6],
      ],
      0.18,
      0.03,
    ),
    materials.armorLight,
  );
  finInset.position.x = 0;
  group.add(finInset);

  const edgeLight = createTubeBetween(
    group,
    new THREE.Vector3(0, 8.86, -2.5),
    new THREE.Vector3(0, 2.86, -19.0),
    0.035,
    materials.trimCyan,
    4,
  );
  edgeLight.userData.noOutline = true;

  const mastMaterial = materials.frame;
  const tipMaterial = makeBasicMaterial('#84f6d2');
  [
    [-3.4, 9.0, -0.12, 9.2],
    [-5.2, 8.8, -0.55, 8.1],
    [-1.0, 8.9, 0.4, 7.6],
  ].forEach(([z, y, lean, height], index) => {
    const start = new THREE.Vector3(0, y - 0.3, z);
    const end = new THREE.Vector3(
      lean * (index + 1) * 0.8,
      y + height * 0.55,
      z - height * 0.28,
    );
    createTubeBetween(group, start, end, 0.045, mastMaterial, 4);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 6),
      tipMaterial,
    );
    tip.position.copy(end);
    markNoOutline(tip);
    group.add(tip);
  });

  const antennaBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 4.2),
    materials.hullDark,
  );
  antennaBar.position.set(0, 8.22, -6.5);
  group.add(antennaBar);

  const gridPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 2.6),
    new THREE.MeshBasicMaterial({
      map: createGridTexture({ width: 256, height: 256, cell: 32 }),
      color: new THREE.Color('#79ffe0'),
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  gridPanel.position.set(0.3, 6.9, -5.1);
  gridPanel.rotation.set(-0.34, -0.48, 0.22);
  markNoOutline(gridPanel);
  group.add(gridPanel);

  const glow = createSprite(glowTexture, '#83ffdc', 0.2, 11);
  glow.position.set(0, 8.6, -5.2);
  glow.userData.noOutline = true;
  group.add(glow);

  if (shipState) {
    shipState.sensorGlow = glow;
    shipState.sensorTipMaterial = tipMaterial;
  }

  return group;
}

export function createShip() {
  const root = new THREE.Group();
  root.name = 'NX-07-HELIOS';
  const visual = new THREE.Group();
  visual.name = 'ship-visual';
  root.add(visual);

  const glowTexture = createGlowTexture();
  const hullPanel = createHullPanelTexture();
  const ceramicAlbedo = createCeramicAlbedoTexture();
  const graphiteAlbedo = createGraphiteAlbedoTexture();
  const stencilTexture = createHullStencilTexture();
  const warningTexture = createWarningStripeTexture();

  const materials = {
    hull: makeMaterial('hull-graphite', {
      color: 0x4b555b,
      map: graphiteAlbedo,
      metalness: 0.5,
      roughness: 0.68,
      envMapIntensity: 0.5,
      clearcoat: 0.1,
      bumpMap: hullPanel,
      bumpScale: 0.09,
      roughnessMap: hullPanel,
    }),
    hullDark: makeMaterial('hull-deep', {
      color: 0x10171c,
      map: graphiteAlbedo,
      metalness: 0.45,
      roughness: 0.7,
      envMapIntensity: 0.4,
    }),
    hullMid: makeMaterial('hull-mid', {
      color: 0x7b8588,
      map: graphiteAlbedo,
      metalness: 0.4,
      roughness: 0.62,
      envMapIntensity: 0.5,
      bumpMap: hullPanel,
      bumpScale: 0.07,
      roughnessMap: hullPanel,
    }),
    armorMid: makeMaterial('armor-mid', {
      color: 0x8e8371,
      map: ceramicAlbedo,
      metalness: 0.2,
      roughness: 0.6,
      envMapIntensity: 0.5,
      clearcoat: 0.26,
      bumpMap: hullPanel,
      bumpScale: 0.075,
      roughnessMap: hullPanel,
    }),
    armorLight: makeMaterial('armor-light', {
      color: 0xd4cab6,
      map: ceramicAlbedo,
      metalness: 0.18,
      roughness: 0.55,
      envMapIntensity: 0.55,
      clearcoat: 0.12,
      bumpMap: hullPanel,
      bumpScale: 0.07,
      roughnessMap: hullPanel,
    }),
    armorWarm: makeMaterial('armor-warm', {
      color: 0xb8946a,
      map: ceramicAlbedo,
      metalness: 0.22,
      roughness: 0.52,
      envMapIntensity: 0.5,
      clearcoat: 0.22,
      bumpMap: hullPanel,
      bumpScale: 0.06,
      roughnessMap: hullPanel,
    }),
    copper: makeMaterial('copper-service', {
      color: 0xb57249,
      metalness: 0.86,
      roughness: 0.34,
      clearcoat: 0.18,
    }),
    wing: makeMaterial('wing-carbon', {
      color: 0x3d4a51,
      map: graphiteAlbedo,
      metalness: 0.42,
      roughness: 0.64,
      envMapIntensity: 0.45,
      side: THREE.DoubleSide,
      bumpMap: hullPanel,
      bumpScale: 0.06,
      roughnessMap: hullPanel,
    }),
    wingPanel: makeMaterial('wing-panel', {
      color: 0x7f8988,
      map: graphiteAlbedo,
      metalness: 0.3,
      roughness: 0.6,
      envMapIntensity: 0.45,
      clearcoat: 0.3,
      side: THREE.DoubleSide,
      bumpMap: hullPanel,
      bumpScale: 0.065,
      roughnessMap: hullPanel,
    }),
    wingCeramic: makeMaterial('wing-ceramic', {
      color: 0xcfc3aa,
      map: ceramicAlbedo,
      metalness: 0.16,
      roughness: 0.56,
      envMapIntensity: 0.55,
      clearcoat: 0.32,
      side: THREE.DoubleSide,
      bumpMap: hullPanel,
      bumpScale: 0.06,
      roughnessMap: hullPanel,
    }),
    rib: makeMaterial('rib-metal', {
      color: 0x101216,
      metalness: 0.9,
      roughness: 0.32,
    }),
    frame: makeMaterial('frame-steel', {
      color: 0x6f7778,
      metalness: 0.7,
      roughness: 0.4,
      envMapIntensity: 0.45,
    }),
    engineLiner: makeMaterial('engine-liner', {
      color: 0x0c141c,
      metalness: 0.9,
      roughness: 0.22,
      side: THREE.DoubleSide,
    }),
    warpRing: makeMaterial('warp-ring', {
      color: 0x11181e,
      metalness: 0.55,
      roughness: 0.55,
      envMapIntensity: 0.4,
      clearcoat: 0.2,
      bumpMap: hullPanel,
      bumpScale: 0.05,
      roughnessMap: hullPanel,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x0a1820,
      metalness: 0.35,
      roughness: 0.06,
      transparent: true,
      opacity: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 2.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    glassInner: new THREE.MeshPhysicalMaterial({
      color: 0x08121b,
      metalness: 0.25,
      roughness: 0.2,
      transparent: true,
      opacity: 0.28,
      envMapIntensity: 1.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    trimCyan: makeBasicMaterial('#92efff'),
    trimAmber: makeBasicMaterial('#ffbe7a'),
    trimDim: makeBasicMaterial('#56889b', { transparent: true, opacity: 0.6 }),
    panelLine: new THREE.MeshStandardMaterial({
      color: 0x020306,
      metalness: 0.9,
      roughness: 0.22,
    }),
    warningMaterial: createWarningMaterial(warningTexture),
  };

  const textures = {
    shipDecal: createShipDecalTexture(),
    wingDecal: createWingDecalTexture(),
    stencil: stencilTexture,
    warning: warningTexture,
  };

  const shipState = {
    engineFx: [],
    navLights: [],
    beacons: [],
    warpEnergy: null,
    warpArcMaterials: [],
    warpGlow: null,
    sensorGlow: null,
  };

  const parts = [];
  const wingGeometry = createWingGeometryParts();

  const coreGroup = buildCore(materials, textures, glowTexture, shipState);
  addPartRoot(
    parts,
    visual,
    {
      ...PART_DATA.find((part) => part.id === 'hull'),
      anchor: [0, 4.2, 10],
      explodeOffset: [0, 0, 0],
    },
    coreGroup,
    new THREE.Vector3(0, 0, 0),
  );

  const canopyGroup = buildCanopy(materials, glowTexture);
  addPartRoot(
    parts,
    visual,
    {
      ...PART_DATA.find((part) => part.id === 'canopy'),
      anchor: [0, 7.25, -9],
      explodeOffset: [0, 14, -13],
      explodeRotation: [0.02, 0, -0.12],
    },
    canopyGroup,
    new THREE.Vector3(0, 0, 0),
  );

  [-1, 1].forEach((side) => {
    const id = side < 0 ? 'wing-left' : 'wing-right';
    const data = PART_DATA.find((part) => part.id === id);
    const wingGroup = buildWing(
      side,
      materials,
      textures,
      glowTexture,
      wingGeometry,
      shipState,
    );
    addPartRoot(
      parts,
      visual,
      {
        ...data,
        anchor: [17.2, 0.5, 5.5],
        explodeOffset: [side * 25, -8, 3],
        explodeRotation: [0.06, side * 0.05, side * 0.18],
      },
      wingGroup,
      new THREE.Vector3(0, 0, 0),
    );
  });

  [-1, 1].forEach((side) => {
    const id = side < 0 ? 'engine-left' : 'engine-right';
    const data = PART_DATA.find((part) => part.id === id);
    const engineGroup = buildEngine(
      side,
      materials,
      glowTexture,
      null,
      shipState,
    );
    addPartRoot(
      parts,
      visual,
      {
        ...data,
        anchor: [0, 6.0, 1.5],
        explodeOffset: [side * 9, 7, 13],
        explodeRotation: [0.14, side * 0.08, side * 0.14],
      },
      engineGroup,
      new THREE.Vector3(side * ENGINE_HOME_X, -0.1, ENGINE_HOME_Z),
    );
  });

  const warpGroup = buildWarpRing(materials, glowTexture, shipState);
  addPartRoot(
    parts,
    visual,
    {
      ...PART_DATA.find((part) => part.id === 'warp'),
      anchor: [0, 18.6, 14.6],
      explodeOffset: [0, 21, 9],
      explodeRotation: [0.2, 0, 0],
    },
    warpGroup,
    new THREE.Vector3(0, 0, 0),
  );

  const sensorGroup = buildSensorArray(
    materials,
    textures,
    glowTexture,
    shipState,
  );
  addPartRoot(
    parts,
    visual,
    {
      ...PART_DATA.find((part) => part.id === 'sensor'),
      anchor: [0, 11.6, -8],
      explodeOffset: [0, 17, -9],
      explodeRotation: [0.08, 0, -0.1],
    },
    sensorGroup,
    new THREE.Vector3(0, 0, 0),
  );

  const partsById = new Map(parts.map((part) => [part.id, part]));
  const allPickables = parts.flatMap((part) => part.pickables);
  const outlineMeshes = parts.flatMap((part) => part.outlineMeshes);

  // A compact presentation rig travels with the ship. It gives the ceramic
  // plating a readable key / cyan rim / warm belly separation in every game
  // mode without having to relight the entire solar system.
  const presentationLighting = new THREE.Group();
  presentationLighting.name = 'presentation-lighting';
  const keyLight = new THREE.DirectionalLight(0xffddb8, 1.8);
  keyLight.position.set(34, 30, 44);
  keyLight.target.position.set(0, 2, 2);
  presentationLighting.add(keyLight, keyLight.target);
  const rimLight = new THREE.DirectionalLight(0x7edcff, 2.0);
  rimLight.position.set(-46, 17, -38);
  rimLight.target.position.set(0, 1.5, 6);
  presentationLighting.add(rimLight, rimLight.target);
  const bellyFill = new THREE.PointLight(0xffa46a, 400, 120, 2);
  bellyFill.position.set(-8, -15, 19);
  presentationLighting.add(bellyFill);
  const crownFill = new THREE.PointLight(0x87d9ff, 280, 130, 2);
  crownFill.position.set(12, 18, 5);
  presentationLighting.add(crownFill);
  root.add(presentationLighting);

  const state = {
    explodeTarget: 0,
    explode: 0,
    mode: 'menu',
    selected: null,
  };

  const tmpEuler = new THREE.Euler();
  const tmpQuat = new THREE.Quaternion();
  const tmpVec = new THREE.Vector3();

  function setExploded(value) {
    state.explodeTarget = value ? 1 : 0;
  }

  function setDetached(id, value) {
    const part = partsById.get(id);
    if (!part || !part.canDetach) return false;
    part.detached = Boolean(value);
    part.detachTarget = value ? 1 : 0;
    return true;
  }

  function clearDetached() {
    parts.forEach((part) => {
      part.detached = false;
      part.detachTarget = 0;
    });
  }

  function select(id) {
    state.selected = id && partsById.has(id) ? id : null;
    return state.selected;
  }

  function getPartAtObject(object) {
    let current = object;
    while (current) {
      if (current.userData && current.userData.partId) {
        return partsById.get(current.userData.partId) || null;
      }
      current = current.parent;
    }
    return null;
  }

  function getPart(id) {
    return partsById.get(id) || null;
  }

  function update({
    dt = 1 / 60,
    elapsed = 0,
    mode = 'menu',
    throttle = 0,
    warp = 0,
    speed = 0,
    bank = 0,
    pitch = 0,
  } = {}) {
    state.mode = mode;
    state.explode = damp(
      state.explode,
      state.explodeTarget,
      mode === 'inspect' ? 3.4 : 4.2,
      dt,
    );

    parts.forEach((part) => {
      const target = Math.max(state.explode, part.detached ? 1 : 0);
      part.separation = damp(part.separation, target, 4.3, dt);
      const amount = part.separation;
      part.group.position
        .copy(part.homePosition)
        .addScaledVector(part.explodeOffset, amount);
      tmpEuler.set(
        part.explodeRotation.x * amount,
        part.explodeRotation.y * amount,
        part.explodeRotation.z * amount,
      );
      tmpQuat.setFromEuler(tmpEuler);
      part.group.quaternion.copy(part.homeQuaternion).multiply(tmpQuat);
    });

    if (mode === 'menu') {
      visual.position.y = Math.sin(elapsed * 0.65) * 0.28;
      visual.rotation.z = damp(
        visual.rotation.z,
        Math.sin(elapsed * 0.37) * 0.012,
        3,
        dt,
      );
      visual.rotation.x = damp(
        visual.rotation.x,
        Math.sin(elapsed * 0.27 + 1.1) * 0.008,
        3,
        dt,
      );
    } else if (mode === 'inspect') {
      visual.position.y = Math.sin(elapsed * 0.45) * 0.14;
      visual.rotation.z = damp(visual.rotation.z, 0, 4, dt);
      visual.rotation.x = damp(visual.rotation.x, 0, 4, dt);
    } else {
      visual.position.y = damp(
        visual.position.y,
        Math.sin(elapsed * 2.1) * 0.06 * Math.min(1, speed / 300),
        5,
        dt,
      );
      visual.rotation.z = damp(visual.rotation.z, -bank * 0.38, 5.2, dt);
      visual.rotation.x = damp(visual.rotation.x, pitch * 0.2, 5.2, dt);
    }

    const throttleClamped = clamp(throttle, 0, 1.4);
    const warpClamped = clamp(warp, 0, 1);
    const thrustIdle =
      mode === 'inspect' ? 0.035 : mode === 'menu' ? 0.1 : 0.11;
    const thrust =
      thrustIdle +
      throttleClamped * 0.74 +
      warpClamped * 0.35 +
      clamp(speed / 5200, 0, 0.15);
    const engineEnergy = clamp(thrust, 0, 1.55);

    shipState.engineFx.forEach((fx) => {
      const flicker =
        0.9 +
        Math.sin(elapsed * 31.7 + fx.phase) * 0.06 +
        Math.sin(elapsed * 47.3 + fx.phase * 1.7) * 0.035;
      const length = 0.45 + engineEnergy * 1.2 + warpClamped * 0.5;
      fx.innerFlame.scale.z = 0.45 + engineEnergy * 0.92;
      fx.outerFlame.scale.z = length;
      fx.innerFlame.material.uniforms.uOpacity.value =
        (0.15 + engineEnergy * 0.4) * flicker;
      fx.outerFlame.material.uniforms.uOpacity.value =
        (0.06 + engineEnergy * 0.2) * flicker;
      fx.innerFlame.material.uniforms.uColor.value.set(
        warpClamped > 0.35 ? '#d9f1ff' : '#fff1d0',
      );
      fx.glow.material.opacity = (0.07 + engineEnergy * 0.1) * flicker;
      fx.glow.scale.setScalar(2.6 + engineEnergy * 1.5);
      fx.intakeGlow.material.opacity =
        0.1 + engineEnergy * 0.24 + Math.sin(elapsed * 2.4 + fx.phase) * 0.03;
      fx.plasmaDisc.material.opacity = 0.12 + engineEnergy * 0.18;
      fx.engineLight.intensity = 80 + engineEnergy * 260;
    });

    if (shipState.warpEnergy) {
      const warpEnergy =
        0.25 +
        warpClamped * 0.75 +
        Math.sin(elapsed * 1.8) * 0.06 * (0.3 + warpClamped);
      shipState.warpEnergy.rotation.z +=
        dt * (0.06 + warpClamped * 2.4 + throttleClamped * 0.12);
      shipState.warpArcMaterials.forEach((material, index) => {
        material.opacity =
          (0.08 + warpClamped * 0.58 + throttleClamped * 0.08) *
          (index % 3 === 0 ? 1.2 : 0.8);
      });
      if (shipState.warpGlow) {
        shipState.warpGlow.material.opacity =
          0.024 + warpClamped * 0.13 + Math.sin(elapsed * 2.2) * 0.012;
        shipState.warpGlow.scale.setScalar(34 + warpClamped * 10);
      }
      if (shipState.sensorGlow) {
        shipState.sensorGlow.material.opacity =
          0.13 + Math.sin(elapsed * 1.4 + 0.4) * 0.04;
      }
    }

    shipState.navLights.forEach((light) => {
      const pulse = Math.sin(elapsed * 2.7 + light.phase);
      const visible = pulse > 0.35;
      light.sprite.material.opacity = visible ? 0.55 : 0.03;
      light.mesh.scale.setScalar(visible ? 1.15 : 0.72);
    });

    shipState.beacons.forEach((beacon, index) => {
      const blink = Math.sin(elapsed * 1.6 + index * 1.7) > 0.2 ? 1 : 0.15;
      beacon.scale.setScalar(blink);
    });

    return state;
  }

  function reset() {
    state.explodeTarget = 0;
    state.explode = 0;
    state.selected = null;
    clearDetached();
    parts.forEach((part) => {
      part.separation = 0;
      part.group.position.copy(part.homePosition);
      part.group.quaternion.copy(part.homeQuaternion);
    });
  }

  return {
    root,
    visual,
    parts,
    partsById,
    allPickables,
    outlineMeshes,
    meta: SHIP_META,
    state,
    update,
    reset,
    select,
    setExploded,
    setDetached,
    clearDetached,
    getPart,
    getPartAtObject,
    setThrottleGlow(value) {
      state.externalThrust = value;
    },
  };
}