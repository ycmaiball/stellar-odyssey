import * as THREE from 'three';
import {
  TAU,
  clamp,
  createTextTexture,
  makeCanvas,
  get2DContext,
  mulberry32,
  randRange,
  smoothstep,
} from './utils.js';
import {
  createGlowTexture,
  createSkyTexture,
  createStarSprite,
  createFlareTexture,
} from './textures.js';

export const ASSETS = {
  earthDay: './assets/textures/earth_day_sss.jpg',
  earthNight: './assets/textures/earth_night_sss.jpg',
  earthClouds: './assets/textures/earth_clouds_alpha.png',
  earthNormal: './assets/textures/earth_normal.jpg',
  mercury: './assets/textures/mercury_sss.jpg',
  venus: './assets/textures/venus_sss.jpg',
  mars: './assets/textures/mars_sss.jpg',
  jupiter: './assets/textures/jupiter_sss.jpg',
  saturn: './assets/textures/saturn_sss.jpg',
  saturnRing: './assets/textures/saturn_ring_sss.png',
  uranus: './assets/textures/uranus_sss.jpg',
  neptune: './assets/textures/neptune_sss.jpg',
  moon: './assets/textures/moon_sss.jpg',
  sun: './assets/textures/sun_sss.jpg',
};

export const PLANET_DEFS = [
  {
    key: 'mercury',
    cn: '水星',
    en: 'MERCURY',
    label: '铁质世界',
    radius: 76,
    position: [-7700, 1500, -9100],
    color: '#c8b9ad',
    halo: '#d6c2ad',
    atmosphere: '#c7b7aa',
    atmosphereStrength: 0.25,
    roughness: 0.96,
    tilt: 0.001,
    spin: 0.018,
    visitDistance: 1050,
    blurb: '距恒星最近的岩石行星。昼侧表面温度足以熔化铅，阴影中却接近绝对零度。',
  },
  {
    key: 'venus',
    cn: '金星',
    en: 'VENUS',
    label: '硫酸云层',
    radius: 148,
    position: [-5300, -1050, -7100],
    color: '#e8c58f',
    halo: '#f0c27f',
    atmosphere: '#ffcf91',
    atmosphereStrength: 0.9,
    roughness: 0.88,
    tilt: 0.05,
    spin: -0.006,
    visitDistance: 1200,
    blurb: '被高压硫酸云包裹的温室行星。云顶反射率极高，是夜空中最明亮的行星。',
  },
  {
    key: 'earth',
    cn: '地球',
    en: 'EARTH',
    label: '起源行星',
    radius: 530,
    position: [820, -420, -3080],
    color: '#73d7ff',
    halo: '#71c8ff',
    atmosphere: '#6ed9ff',
    atmosphereStrength: 1.15,
    roughness: 0.82,
    tilt: -0.36,
    spin: 0.011,
    visitDistance: 1700,
    blurb: '人类文明的母星。液态水海洋、氮氧大气与一层薄薄的磁层，让这里成为已知唯一的生命摇篮。',
  },
  {
    key: 'mars',
    cn: '火星',
    en: 'MARS',
    label: '赤色荒原',
    radius: 252,
    position: [3300, 760, -5600],
    color: '#ff9b6c',
    halo: '#ff8f63',
    atmosphere: '#ff9c70',
    atmosphereStrength: 0.48,
    roughness: 0.94,
    tilt: -0.12,
    spin: 0.013,
    visitDistance: 1400,
    blurb: '铁氧化物将整颗行星染成锈红色。极冠的干冰随季节生长，古老河床仍在等待下一次融水。',
  },
  {
    key: 'jupiter',
    cn: '木星',
    en: 'JUPITER',
    label: '气态巨行星',
    radius: 920,
    position: [7700, 2900, -11000],
    color: '#e8bf90',
    halo: '#dfb17e',
    atmosphere: '#e8c79c',
    atmosphereStrength: 0.65,
    roughness: 0.92,
    tilt: 0.08,
    spin: 0.024,
    visitDistance: 2900,
    blurb: '太阳系的引力巨人。大红斑是一场比地球还宽的古老风暴，已持续至少数百年。',
  },
  {
    key: 'saturn',
    cn: '土星',
    en: 'SATURN',
    label: '环系女王',
    radius: 720,
    position: [-5200, -2450, -13900],
    color: '#e7d8a6',
    halo: '#d8c58a',
    atmosphere: '#e9d8a9',
    atmosphereStrength: 0.6,
    roughness: 0.93,
    tilt: -0.32,
    spin: 0.02,
    ring: true,
    visitDistance: 2600,
    blurb: '由数万亿冰粒组成的环系统横跨二十七万公里，厚度却往往不足一公里。',
  },
  {
    key: 'uranus',
    cn: '天王星',
    en: 'URANUS',
    label: '侧转冰巨星',
    radius: 382,
    position: [9500, 1580, -17600],
    color: '#a5e8e4',
    halo: '#8be0df',
    atmosphere: '#b2f3ef',
    atmosphereStrength: 0.55,
    roughness: 0.86,
    tilt: 1.26,
    spin: -0.015,
    faintRing: true,
    visitDistance: 1800,
    blurb: '自转轴几乎躺倒在轨道平面上，像一颗被漫长撞击推倒的冰巨星。',
  },
  {
    key: 'neptune',
    cn: '海王星',
    en: 'NEPTUNE',
    label: '深空哨站',
    radius: 408,
    position: [-1450, -4450, -19800],
    color: '#7ea9ff',
    halo: '#648dff',
    atmosphere: '#8fb5ff',
    atmosphereStrength: 0.65,
    roughness: 0.88,
    tilt: 0.16,
    spin: 0.017,
    visitDistance: 1900,
    blurb: '太阳系最遥远的行星，风速可超过两千公里每小时。蓝色甲烷云层下方仍是未解之谜。',
  },
];

const SUN_POSITION = new THREE.Vector3(-6900, 3350, -20000);
const SUN_RADIUS = 960;
const STAR_SHELL_RADIUS = 42000;

function makeTextureLoader(manager, renderer) {
  const loader = new THREE.TextureLoader(manager);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return {
    load(path, colorSpace = 'srgb') {
      const texture = loader.load(path);
      texture.colorSpace =
        colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.anisotropy = maxAniso;
      return texture;
    },
  };
}

function createAtmosphereMaterial({
  color,
  strength = 0.8,
  power = 3.1,
  sunDirection,
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength },
      uPower: { value: power },
      uSunDirection: { value: sunDirection.clone().normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      uniform float uPower;
      uniform vec3 uSunDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float rim = pow(1.0 - abs(dot(normal, viewDirection)), uPower);
        float sun = smoothstep(-0.35, 0.6, dot(normal, normalize(uSunDirection)));
        float alpha = rim * (0.16 + sun * 0.84) * uStrength;
        vec3 color = uColor * (0.7 + sun * 1.45);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

function createCityLightsMaterial(nightTexture, sunDirection) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: nightTexture },
      uSunDirection: { value: sunDirection.clone().normalize() },
      uIntensity: { value: 1.65 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uSunDirection;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vec3 normal = normalize(vWorldNormal);
        float night = smoothstep(0.2, -0.22, dot(normal, normalize(uSunDirection)));
        vec3 lights = texture2D(uMap, vUv).rgb;
        lights = pow(lights, vec3(1.35)) * uIntensity;
        gl_FragColor = vec4(lights * night, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function createHalo(color, opacity, size) {
  const material = new THREE.SpriteMaterial({
    map: createGlowTexture(),
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(size);
  return sprite;
}

function createPlanetSphere(radius, segments = 96) {
  return new THREE.SphereGeometry(radius, segments, Math.max(32, segments / 2));
}

function createPlanet(def, textures, glowTexture, starSprite, sunDirection) {
  const group = new THREE.Group();
  group.name = `planet-${def.key}`;
  group.position.fromArray(def.position);

  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = def.tilt;
  group.add(tiltGroup);

  const texture = textures[def.key];
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: def.roughness ?? 0.94,
    metalness: 0.02,
    envMapIntensity: 0.22,
  });

  const segments = def.radius > 500 ? 96 : 72;
  const sphere = new THREE.Mesh(createPlanetSphere(def.radius, segments), material);
  sphere.rotation.y = (def.key.length * 1.713) % TAU;
  tiltGroup.add(sphere);

  const atmosphere = new THREE.Mesh(
    createPlanetSphere(def.radius * 1.035, Math.max(48, segments / 2)),
    createAtmosphereMaterial({
      color: def.atmosphere || def.color,
      strength: def.atmosphereStrength ?? 0.5,
      power: def.key === 'earth' ? 3.4 : 2.6,
      sunDirection,
    }),
  );
  group.add(atmosphere);

  const halo = createHalo(def.halo || def.color, 0.12, def.radius * 4.4);
  group.add(halo);

  const planet = {
    ...def,
    group,
    tiltGroup,
    sphere,
    atmosphere,
    halo,
    rotationSpeed: def.spin,
    currentSpin: sphere.rotation.y,
  };

  if (def.key === 'earth') {
    const clouds = new THREE.Mesh(
      createPlanetSphere(def.radius * 1.006, segments),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        alphaMap: textures.earthClouds,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.1,
      }),
    );
    clouds.rotation.y = sphere.rotation.y + 0.5;
    tiltGroup.add(clouds);

    const cityLights = new THREE.Mesh(
      createPlanetSphere(def.radius * 1.001, segments),
      createCityLightsMaterial(textures.earthNight, sunDirection),
    );
    tiltGroup.add(cityLights);

    const moonPivot = new THREE.Group();
    moonPivot.rotation.z = 0.16;
    const moonMaterial = new THREE.MeshStandardMaterial({
      map: textures.moon,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.25,
    });
    const moon = new THREE.Mesh(createPlanetSphere(118, 48), moonMaterial);
    moon.position.set(1080, 275, -310);
    moon.rotation.y = 1.1;
    moonPivot.add(moon);
    group.add(moonPivot);

    planet.clouds = clouds;
    planet.cityLights = cityLights;
    planet.moonPivot = moonPivot;
    planet.moon = moon;
  }

  if (def.ring) {
    const inner = def.radius * 1.38;
    const outer = def.radius * 2.38;
    const ringGeometry = new THREE.RingGeometry(inner, outer, 256, 1);
    const ringMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: textures.saturnRing },
        uInner: { value: inner },
        uOuter: { value: outer },
        uOpacity: { value: 0.88 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vLocal;
        varying vec2 vUv;
        void main() {
          vLocal = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uInner;
        uniform float uOuter;
        uniform float uOpacity;
        varying vec3 vLocal;
        void main() {
          float radius = length(vLocal.xy);
          float t = clamp((radius - uInner) / (uOuter - uInner), 0.0, 1.0);
          vec4 source = texture2D(uMap, vec2(t, 0.5));
          float fineBands = 0.72 + 0.2 * sin(t * 230.0) + 0.08 * sin(t * 89.0 + 1.2);
          float edge = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.92, 1.0, t));
          gl_FragColor = vec4(source.rgb * 1.08, source.a * fineBands * edge * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.rotation.x = -Math.PI / 2;
    const ringPivot = new THREE.Group();
    ringPivot.rotation.x = 0.36;
    ringPivot.rotation.z = -0.18;
    ringPivot.add(ringMesh);
    group.add(ringPivot);
    planet.ringPivot = ringPivot;
    planet.ring = ringMesh;
  }

  if (def.faintRing) {
    const ringGeometry = new THREE.RingGeometry(
      def.radius * 1.55,
      def.radius * 1.86,
      128,
      1,
    );
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x92d7de),
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.rotation.x = -Math.PI / 2;
    const ringPivot = new THREE.Group();
    ringPivot.rotation.x = 1.22;
    ringPivot.rotation.z = 0.22;
    ringPivot.add(ringMesh);
    group.add(ringPivot);
    planet.ringPivot = ringPivot;
  }

  return planet;
}

function createSun(sunDirection) {
  const group = new THREE.Group();
  group.position.copy(SUN_POSITION);

  const sunTexture = new THREE.TextureLoader().load(ASSETS.sun);
  sunTexture.colorSpace = THREE.SRGBColorSpace;
  const sunMaterial = new THREE.MeshBasicMaterial({
    map: sunTexture,
    color: new THREE.Color(3.2, 2.35, 1.45),
    toneMapped: false,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 64, 32), sunMaterial);
  sphere.rotation.y = -1.2;
  group.add(sphere);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture(),
      color: new THREE.Color(1.0, 0.62, 0.28),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  glow.scale.setScalar(SUN_RADIUS * 7.2);
  group.add(glow);

  const outerGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture(),
      color: new THREE.Color(0.32, 0.5, 0.95),
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  outerGlow.scale.setScalar(SUN_RADIUS * 16);
  group.add(outerGlow);

  const flare = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createFlareTexture(),
      color: new THREE.Color(0.8, 0.9, 1.0),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  flare.scale.set(SUN_RADIUS * 8.5, SUN_RADIUS * 0.9, 1);
  group.add(flare);

  return { group, sphere, glow, outerGlow, flare, sunDirection };
}

function createStarfield() {
  const group = new THREE.Group();
  const starTexture = createStarSprite();
  const random = mulberry32(6113);
  const palettes = [
    new THREE.Color('#e9f6ff'),
    new THREE.Color('#c7dcff'),
    new THREE.Color('#94b8ff'),
    new THREE.Color('#ffe8c7'),
    new THREE.Color('#ffd2a2'),
    new THREE.Color('#d7f4ff'),
  ];

  const createLayer = (count, minRadius, maxRadius, size) => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const r = randRange(random, minRadius, maxRadius);
      const theta = random() * TAU;
      const z = random() * 2 - 1;
      const planar = Math.sqrt(1 - z * z);
      positions[i * 3] = Math.cos(theta) * planar * r;
      positions[i * 3 + 1] = z * r * 0.68;
      positions[i * 3 + 2] = Math.sin(theta) * planar * r;
      const color = palettes[Math.floor(random() * palettes.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      map: starTexture,
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      alphaTest: 0.01,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    group.add(points);
    return points;
  };

  createLayer(2600, 9000, 31000, 70);
  createLayer(360, 12000, 26000, 130);
  return group;
}

function createAsteroidBelt() {
  const random = mulberry32(28841);
  const count = 620;
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0x776b61,
    roughness: 0.96,
    metalness: 0.06,
    envMapIntensity: 0.18,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < count; i += 1) {
    const angle = random() * TAU;
    const radius = randRange(random, 4200, 8600);
    const x = Math.cos(angle) * radius;
    const z = -4300 - Math.sin(angle * 0.7) * 3200 + randRange(random, -1300, 1300);
    const y = randRange(random, -900, 2300);
    const scale = Math.pow(random, 2.4) * 38 + 3;
    dummy.position.set(x, y, z);
    dummy.rotation.set(random() * TAU, random() * TAU, random() * TAU);
    dummy.scale.set(scale, scale * randRange(random, 0.55, 1.1), scale * randRange(random, 0.7, 1.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

function createWarpField() {
  const count = 520;
  const random = mulberry32(4917);
  const positions = new Float32Array(count * 6);
  const colors = new Float32Array(count * 6);
  const data = [];
  const palette = [new THREE.Color('#dff9ff'), new THREE.Color('#89ccff'), new THREE.Color('#b8b3ff')];

  for (let i = 0; i < count; i += 1) {
    const angle = random() * TAU;
    const radius = randRange(random, 7, 98);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.7;
    const z = randRange(random, -620, 20);
    data.push({ x, y, z });
    const color = palette[Math.floor(random() * palette.length)];
    colors[i * 6] = color.r;
    colors[i * 6 + 1] = color.g;
    colors[i * 6 + 2] = color.b;
    colors[i * 6 + 3] = color.r;
    colors[i * 6 + 4] = color.g;
    colors[i * 6 + 5] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.visible = false;

  const update = (camera, speed, warp, dt) => {
    const intensity = smoothstep(650, 2600, speed) * (0.35 + warp * 0.65);
    lines.visible = intensity > 0.012;
    material.opacity = intensity * 0.7;
    if (!lines.visible) return;
    lines.position.copy(camera.position);
    lines.quaternion.copy(camera.quaternion);

    const advance = Math.max(14, speed * 0.17) * dt;
    const length = 3 + speed * 0.0135;
    for (let i = 0; i < count; i += 1) {
      const item = data[i];
      item.z += advance;
      if (item.z > 20) item.z -= 640;
      const base = i * 6;
      positions[base] = item.x;
      positions[base + 1] = item.y;
      positions[base + 2] = item.z;
      positions[base + 3] = item.x;
      positions[base + 4] = item.y;
      positions[base + 5] = item.z - length;
    }
    geometry.attributes.position.needsUpdate = true;
  };

  return { lines, update };
}

function createMinimapDecorations(scene) {
  // Faint orbital guides make the solar system legible without becoming an orrery.
  const group = new THREE.Group();
  const sunPosition = SUN_POSITION;
  const material = new THREE.LineBasicMaterial({
    color: 0x4a83a3,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  PLANET_DEFS.forEach((def) => {
    const delta = new THREE.Vector3().fromArray(def.position).sub(sunPosition);
    const horizontalRadius = Math.sqrt(delta.x * delta.x + delta.z * delta.z);
    const points = [];
    for (let i = 0; i <= 180; i += 1) {
      const angle = (i / 180) * TAU;
      points.push(
        new THREE.Vector3(
          sunPosition.x + Math.cos(angle) * horizontalRadius,
          sunPosition.y + delta.y * 0.15,
          sunPosition.z + Math.sin(angle) * horizontalRadius,
        ),
      );
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    group.add(line);
  });

  scene.add(group);
  return group;
}

export function createUniverse(scene, renderer, manager) {
  const sunDirection = SUN_POSITION.clone().normalize();
  const textures = {};
  const textureLoader = makeTextureLoader(manager, renderer);

  textures.earthDay = textureLoader.load(ASSETS.earthDay);
  textures.earthNight = textureLoader.load(ASSETS.earthNight);
  textures.earthClouds = textureLoader.load(ASSETS.earthClouds, 'linear');
  textures.earthNormal = textureLoader.load(ASSETS.earthNormal, 'linear');
  textures.earth = textures.earthDay;
  textures.mercury = textureLoader.load(ASSETS.mercury);
  textures.venus = textureLoader.load(ASSETS.venus);
  textures.mars = textureLoader.load(ASSETS.mars);
  textures.jupiter = textureLoader.load(ASSETS.jupiter);
  textures.saturn = textureLoader.load(ASSETS.saturn);
  textures.saturnRing = textureLoader.load(ASSETS.saturnRing);
  textures.uranus = textureLoader.load(ASSETS.uranus);
  textures.neptune = textureLoader.load(ASSETS.neptune);
  textures.moon = textureLoader.load(ASSETS.moon);
  textures.sun = textureLoader.load(ASSETS.sun);

  const starSprite = createStarSprite();
  const glowTexture = createGlowTexture();
  const skyTexture = createSkyTexture(renderer.capabilities.getMaxAnisotropy());

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // The sky is a distant shell centred on the active camera every frame.
  const skyGroup = new THREE.Group();
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(STAR_SHELL_RADIUS, 64, 32),
    skyMaterial,
  );
  skyDome.rotation.y = 1.35;
  skyDome.rotation.z = 0.12;
  skyGroup.add(skyDome);
  worldGroup.add(skyGroup);

  const starfield = createStarfield();
  skyGroup.add(starfield);

  const sun = createSun(sunDirection);
  worldGroup.add(sun.group);

  const planets = PLANET_DEFS.map((def) =>
    createPlanet(def, textures, glowTexture, starSprite, sunDirection),
  );
  planets.forEach((planet) => worldGroup.add(planet.group));

  // Earth-specific material upgrades that need the shared assets.
  const earth = planets.find((planet) => planet.key === 'earth');
  if (earth) {
    earth.sphere.material.normalMap = textures.earthNormal;
    earth.sphere.material.normalScale = new THREE.Vector2(0.62, 0.62);
    earth.sphere.material.needsUpdate = true;
  }

  const belt = createAsteroidBelt();
  worldGroup.add(belt);
  createMinimapDecorations(worldGroup);
  const warpField = createWarpField();
  worldGroup.add(warpField.lines);

  const sunLight = new THREE.DirectionalLight(0xfff2df, 2.2);
  sunLight.position.copy(SUN_POSITION).normalize().multiplyScalar(1000);
  sunLight.target.position.set(0, 0, 0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  const rimLight = new THREE.DirectionalLight(0x5b87ff, 1.2);
  rimLight.position.set(1400, 700, 2200);
  rimLight.target.position.set(0, 0, 0);
  scene.add(rimLight);
  scene.add(rimLight.target);

  const fillLight = new THREE.DirectionalLight(0xffb778, 0.45);
  fillLight.position.set(-2000, -900, 1400);
  scene.add(fillLight);

  const ambient = new THREE.AmbientLight(0x1a2c47, 1.4);
  scene.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0x8abfff, 0x05070c, 0.48);
  scene.add(hemisphere);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const environment = pmrem.fromEquirectangular(skyTexture);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.56;
  pmrem.dispose();

  const getPlanet = (key) => planets.find((planet) => planet.key === key);

  const update = ({ dt, elapsed, camera, speed, warp, mode }) => {
    skyGroup.position.copy(camera.position);
    sun.sphere.rotation.y += dt * 0.006;
    sun.glow.material.opacity = 0.5 + Math.sin(elapsed * 0.9) * 0.035;
    sun.outerGlow.material.opacity = 0.12 + Math.sin(elapsed * 0.55 + 1) * 0.02;

    planets.forEach((planet) => {
      planet.sphere.rotation.y += dt * planet.rotationSpeed;
      if (planet.clouds) planet.clouds.rotation.y += dt * (planet.rotationSpeed + 0.006);
      if (planet.moonPivot) planet.moonPivot.rotation.y += dt * 0.018;
      if (planet.ringPivot) planet.ringPivot.rotation.z += dt * 0.002;
      planet.halo.material.opacity =
        0.1 + Math.sin(elapsed * 0.28 + planet.radius * 0.011) * 0.018;
    });

    belt.rotation.y += dt * 0.0012;

    if (mode === 'flight' || mode === 'launch') {
      warpField.update(camera, speed, warp, dt);
    } else {
      warpField.lines.visible = false;
    }

    // Keep the environmental light attached to the ship in spirit: the sun
    // is infinitely far away, so only the direction matters.
    sunLight.position.copy(sunDirection).multiplyScalar(3000);
  };

  return {
    group: worldGroup,
    skyGroup,
    skyMaterial,
    planets,
    sun,
    sunLight,
    rimLight,
    ambient,
    belt,
    warpField,
    getPlanet,
    update,
    sunDirection,
    textures,
  };
}