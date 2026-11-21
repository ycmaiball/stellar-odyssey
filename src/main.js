import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createUniverse } from './world.js';
import { createShip } from './ship.js';
import { createAudioEngine } from './audio.js';
import { createUI } from './ui.js';
import { createCombatSystem } from './combat.js';
import { createContractSystem } from './contracts.js';
import { createWarpCockpit } from './cockpit.js';
import { createAuthSystem } from './auth.js';
import { clamp, damp, formatNumber } from './utils.js';

/* ─────────────────────────────────────────────────────────────
   Stellar Odyssey — flight director
   The world below is compressed for play. The idea above it is not.
   ───────────────────────────────────────────────────────────── */


const sceneRoot = document.getElementById('scene-root');
const app = document.getElementById('app');

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const DEG = THREE.MathUtils.RAD2DEG;
const RAD = THREE.MathUtils.DEG2RAD;

const NAV_KM_PER_UNIT = 50000;
const AU_KM = 149597870.7;

const ENTRY_PARAMS = new URLSearchParams(window.location.search);
const ARRIVAL_FROM_SHIPYARD =
  ENTRY_PARAMS.get('from') === 'shipyard' && ENTRY_PARAMS.get('launch') === '1';

const game = {
  mode: 'boot',
  booted: false,
  started: false,
  completed: false,
  startedAt: 0,
  elapsed: 0,
  distanceTraveled: 0,

  targetIndex: 2,
  discovered: new Set(),
  completePending: false,
  completeAt: 0,
  combatDefeated: false,
  keyFiring: false,
  touchFire: false,
  combatWave: 1,
  combatKills: 0,
  tacticalScan: false,
  cameraShake: 0,

  throttle: 0.36,
  speed: 0,
  warpHeld: false,
  warp: 0,
  warpCharge: 1,
  warpExhausted: false,
  warpWarningShown: false,
  warpFlashArmed: true,
  warpCockpit: 0,
  cockpitShipHidden: false,
  cockpitRigVisible: false,
  autopilot: false,
  touchThrust: false,
  touchWarp: false,
  keys: new Set(),

  cameraMode: 'menu',
  menuTheta: 2.0,
  completeTheta: 0,
  cameraLook: new THREE.Vector3(),
  fov: 44,
  bank: 0,
  steer: new THREE.Vector2(),
  steerTarget: new THREE.Vector2(),

  pointer: {
    id: null,
    down: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    moved: 0,
  },

  inspect: {
    theta: 2.0,
    phi: 0.3,
    zoom: 84,
    targetZoom: 84,
    dragging: false,
    lastInput: -100,
    hintShown: false,
  },

  selectedPartId: 'hull',
  exploded: false,
  muted: false,
  lastCollisionAt: -100,
  lastWarpAlertAt: -100,
  isTouch: false,
  frames: 0,
  clock: 0,
};

let renderer = null;
let scene = null;
let camera = null;
let composer = null;
let outlinePass = null;
let bloomPass = null;
let gradePass = null;
let raycaster = null;
let universe = null;
let ship = null;
let warpCockpitRig = null;
let auth = null;
let combat = null;
let contracts = null;

let bootStartedAt = performance.now();
let lastFrame = 0;
let bootUiAccum = 0;
let hudAccum = 0;
let markerAccum = 0;
let radarAccum = 0;
let audioAccum = 0;
let lastBootPercent = -1;
let lastBootStatus = '';
let assetsLoaded = false;
let assetsFailed = 0;
let assetLoadedCount = 0;
let assetTotal = 0;
let assetsDoneAt = 0;
let pointerNdc = new THREE.Vector2();
const projected = new THREE.Vector3();
const worldPoint = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const tempVecA = new THREE.Vector3();
const tempVecB = new THREE.Vector3();
const tempVecC = new THREE.Vector3();
const tempVecD = new THREE.Vector3();
const tempQuatA = new THREE.Quaternion();
const tempQuatB = new THREE.Quaternion();
const tempQy = new THREE.Quaternion();
const tempQp = new THREE.Quaternion();
const tempQr = new THREE.Quaternion();

const chaseForward = new THREE.Vector3();
const chaseShipUp = new THREE.Vector3();
const chaseStableUp = new THREE.Vector3();
const chaseRight = new THREE.Vector3();
const chaseDesired = new THREE.Vector3();
const chaseLook = new THREE.Vector3();
const chaseLookOffset = new THREE.Vector3();
const chaseOffset = new THREE.Vector3();
const cockpitPosition = new THREE.Vector3();
const autopilotAvoidance = new THREE.Vector3();
const autopilotOffset = new THREE.Vector3();
let chaseOffsetReady = false;
let cameraFill = null;
let cameraFillSecondary = null;
let cameraKey = null;
let cameraKeyTarget = null;

const markerHiddenItems = [];
const emptyMarkerItems = [];

const ui = createUI({
  onStart: startMission,
  onInspect: enterInspection,
  onExitInspect: exitInspection,
  onTargetStep: stepTarget,
  onAutopilot: toggleAutopilot,
  onToggleSound: toggleSound,
  onDetach: toggleDetach,
  onExplode: toggleExplosion,
  onReset: resetInspection,
  onContinue: continueMission,
  onSelectPlanet: selectPlanetByKey,
  onSelectPart: selectPart,
  onThrustHold: (held) => {
    game.touchThrust = Boolean(held);
    if (held && game.autopilot) manualTakeover();
  },
  onWarpHold: (held) => {
    game.touchWarp = Boolean(held);
    if (held && game.autopilot) manualTakeover();
  },
  onFireHold: (held) => {
    game.touchFire = Boolean(held);
    syncCombatFiring();
  },
  onRespawn: respawnMission,
});


const audio = createAudioEngine();

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.42 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      vec3 color = texture2D(tDiffuse, vUv).rgb;

      // A whisper of lateral separation, only at the far edges.
      float edge = smoothstep(0.28, 0.78, length(centered));
      float split = 0.00055 * edge;
      color.r = texture2D(tDiffuse, vUv + vec2(split, 0.0)).r;
      color.b = texture2D(tDiffuse, vUv - vec2(split, 0.0)).b;

      float vignette = 1.0 - smoothstep(0.32, 0.86, length(centered)) * uVignette;
      color *= vignette;
      color = pow(max(color, vec3(0.0)), vec3(0.985));

      float grain = (hash(vUv * 917.7 + uTime * 0.021) - 0.5) * 0.0075;
      color += grain;
      color += vec3(0.0015, 0.0032, 0.0060);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

init();

/* ── crew registry ─────────────────────────────────────────── */

function applyPilot(session) {
  const chip = document.getElementById('start-pilot');
  const name = document.getElementById('start-pilot-name');
  if (!chip || !name) return;
  const bar = chip.closest('.start-topbar__right');
  if (!session) {
    chip.classList.add('is-hidden');
    bar?.classList.remove('has-pilot');
    name.textContent = '—';
    return;
  }
  bar?.classList.add('has-pilot');
  name.textContent = session.nickname || session.callsign;
  name.title = `${session.nickname || session.callsign} · ${session.callsign}`;
  chip.classList.remove('is-hidden');
}

function setupAuth() {
  auth = createAuthSystem({
    onAuthed: (session) => applyPilot(session),
    onSignedOut: () => applyPilot(null),
  });

  document.getElementById('btn-signout')?.addEventListener('click', () => {
    if (!auth) return;
    ui.showToast({
      kicker: 'CREW / LINK',
      title: '已退出舰长档案',
      text: '会话已清除，账号记录仍保留在本机。',
      tone: 'system',
      duration: 3200,
    });
    auth.signOut();
  });

  const session = auth.getSession();
  if (session) applyPilot(session);
}

function init() {
  bootStartedAt = performance.now();
  ui.setMode('boot');
  ui.setBootProgress(2, '正在建立深空链路');

  try {
    setupRenderer();
    setupScene();
    setupUniverse();
    setupShip();
    setupWarpCockpit();
    setupPostprocessing();
    setupInterface();
    setupAuth();
    setupContracts();
    setupCombat();
    bindInput();
    onResize();

    game.isTouch =
      window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 820;
    ui.setTouchMode(game.isTouch);
    ui.setMuted(false);

    lastFrame = performance.now();
    window.__STELLAR_ODYSSEY__ = {
      game,
      ui,
      audio,
      get universe() {
        return universe;
      },
      get ship() {
        return ship;
      },
      get combat() {
        return combat;
      },
      get contracts() {
        return contracts;
      },
      get warpCockpitRig() {
        return warpCockpitRig;
      },
      get auth() {
        return auth;
      },
      get camera() {
        return camera;
      },
      get renderer() {
        return renderer;
      },
      get composer() {
        return composer;
      },
      get bloomPass() {
        return bloomPass;
      },
    };

    requestAnimationFrame(animate);
  } catch (error) {
    fatal(error);
  }
}

/* ── scene assembly ──────────────────────────────────────── */

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.setClearColor(0x010309, 1);

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.6 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.domElement.id = 'stellar-canvas';
  renderer.domElement.setAttribute(
    'aria-label',
    '可交互的 NX-07 HELIOS 深空星舰与太阳系三维场景',
  );
  renderer.domElement.tabIndex = 0;
  sceneRoot.appendChild(renderer.domElement);

  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    fatal(new Error('WebGL 渲染上下文已丢失。请重新加载任务。'));
  });

  raycaster = new THREE.Raycaster();
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01030a);

  camera = new THREE.PerspectiveCamera(
    44,
    window.innerWidth / Math.max(1, window.innerHeight),
    0.5,
    140000,
  );
  camera.position.set(
    Math.sin(game.menuTheta) * 88,
    35,
    Math.cos(game.menuTheta) * 88,
  );
  camera.up.set(0, 1, 0);
  game.cameraLook.set(0, 2.5, 0);
  camera.lookAt(game.cameraLook);

  // A soft camera-side fill keeps the dark hull readable without flattening
  // the cinematic rim light from the distant sun.
  cameraFill = new THREE.PointLight(0xbfe9ff, 0, 520, 2);
  cameraFill.position.copy(camera.position);
  scene.add(cameraFill);

  cameraFillSecondary = new THREE.PointLight(0xffd7b0, 0, 520, 2);
  cameraFillSecondary.position.copy(camera.position);
  scene.add(cameraFillSecondary);

  cameraKey = new THREE.DirectionalLight(0xffe2c2, 0);
  cameraKey.position.copy(camera.position);
  scene.add(cameraKey);
  cameraKeyTarget = new THREE.Object3D();
  scene.add(cameraKeyTarget);
  cameraKey.target = cameraKeyTarget;
}

function setupUniverse() {
  const manager = new THREE.LoadingManager();

  manager.onStart = () => {
    ui.setBootStatus('同步太阳系行星影像');
  };
  manager.onProgress = (_url, loaded, total) => {
    assetLoadedCount = loaded;
    assetTotal = total;
  };
  manager.onLoad = () => {
    assetsLoaded = true;
    assetsDoneAt = performance.now();
    ui.setBootStatus('星图与舰体纹理已就位');
  };
  manager.onError = (url) => {
    assetsFailed += 1;
    console.warn('[stellar] asset link degraded:', url);
  };

  universe = createUniverse(scene, renderer, manager);

  const earthIndex = universe.planets.findIndex((planet) => planet.key === 'earth');
  game.targetIndex = earthIndex >= 0 ? earthIndex : 2;
}

function setupShip() {
  ship = createShip();
  ship.root.position.set(0, 0, 0);
  ship.root.quaternion.setFromEuler(new THREE.Euler(0.012, -0.205, 0, 'YXZ'));
  scene.add(ship.root);
  ship.select('hull');
  game.selectedPartId = 'hull';
}

function setupWarpCockpit() {
  warpCockpitRig = createWarpCockpit();
  camera.add(warpCockpitRig.group);
  scene.add(camera);
  warpCockpitRig.setActive(false);
}

function setupPostprocessing() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = renderer.getPixelRatio();

  composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  outlinePass = new OutlinePass(new THREE.Vector2(width, height), scene, camera);
  outlinePass.enabled = false;
  outlinePass.edgeStrength = 2.2;
  outlinePass.edgeGlow = 0.12;
  outlinePass.edgeThickness = 0.8;
  outlinePass.pulsePeriod = 0;
  outlinePass.visibleEdgeColor.set('#8be9ff');
  outlinePass.hiddenEdgeColor.set('#173845');
  composer.addPass(outlinePass);

  bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.30, 0.40, 1.55);
  composer.addPass(bloomPass);

  composer.addPass(new OutputPass());

  gradePass = new ShaderPass(GradeShader);
  gradePass.renderToScreen = true;
  composer.addPass(gradePass);
}

function setupInterface() {
  ui.buildPlanets(universe.planets);
  ui.buildDiscoveredList(universe.planets);
  ui.buildShipParts(ship.parts);
  ui.setDiscovered([]);
  ui.setExploded(false);
  ui.setAutopilot(false);
  ui.setTouchMode(game.isTouch);
  ui.selectPart(ship.getPart(game.selectedPartId) || ship.parts[0]);

  setTargetIndex(game.targetIndex, false);
  hidePlanetMarkers();
  hidePartMarkers();
  updateOutlineSelection();
}

function setupCombat() {
  combat = createCombatSystem({
    scene,
    ship,
    audio,
    callbacks: {
      onWave: ({ wave, count }) => {
        game.combatWave = wave;
        ui.showToast({
          kicker: `IFF / HOSTILE WAVE ${String(wave).padStart(2, '0')}`,
          title: `敌方编队进入射程 · ${count} 个目标`,
          text: 'SPACE 开火 · 自动锁定最近敌机 · 护盾与装甲已接入战斗链路',
          tone: 'warning',
          duration: 4600,
        });
        audio.hullAlert();
      },
      onWaveCleared: ({ nextWave, kills }) => {
        game.combatKills = kills;
        ui.showToast({
          kicker: 'IFF / SECTOR CLEAR',
          title: `第 ${game.combatWave} 波敌机已清空`,
          text: `等待下一批敌对信号 · 击毁 ${kills} · 下一波 ${nextWave}`,
          tone: 'discovery',
          duration: 4000,
        });
        ui.showAlert('空域暂时净空 · 武器系统散热中', 2600);
        audio.confirm();
      },
      onEnemyKilled: ({ kills, remaining, position }) => {
        game.combatKills = kills;
        contracts?.notifyKill(position);
        if (remaining === 0) ui.showAlert('敌方信号消失 · 重新扫描空域', 1800);
      },
      onEnemyHit: ({ name, killed }) => {
        ui.hitMarker(Boolean(killed));
        if (killed) ui.showKillConfirm(name || '敌对目标');
      },
      onPlayerHit: ({ amount, shieldBroken, source }) => {
        const side = damageDirectionFromSource(source);
        ui.flashDamage(clamp(amount / 9, 0.4, 1.4), side);
        game.cameraShake = Math.max(game.cameraShake, clamp(amount * 0.55, 2.2, 8));
        if (shieldBroken) {
          ui.showAlert('护盾崩溃 · 装甲暴露', 2400);
          audio.hullAlert();
        }
      },
      onPlayerHullHit: ({ amount }) => {
        game.cameraShake = Math.max(
          game.cameraShake,
          clamp(4 + amount * 0.8, 5, 11),
        );
      },
      onPlayerDeath: (payload) => {
        handlePlayerDefeat(payload);
      },
      onWeaponOverheat: () => {
        ui.showAlert('武器过热 · 停止射击等待散热', 1800);
      },
      onWeaponReady: () => {
        ui.showAlert('武器散热完成 · 射击链路恢复', 1300);
      },
    },
  });

  ui.setCombatActive(false);
  ui.updateCombat(combat.getHudData());
}

/* ── contracts / salvage ────────────────────────────────── */

function setupContracts() {
  contracts = createContractSystem({
    scene,
    ship,
    audio,
    callbacks: {
      undiscoveredPlanets: () =>
        universe ? universe.planets.filter((planet) => !game.discovered.has(planet.key)) : [],
      onIssued: (data) => {
        if (game.mode !== 'flight') return;
        ui.updateContract(data);
        ui.showToast({
          kicker: data.kicker || 'CONTRACT / 合约',
          title: `新合约 · ${data.title}`,
          text: `${data.desc} 报酬 ${data.reward} CR`,
          tone: 'system',
          duration: 5000,
        });
      },
      onComplete: ({ title, reward, credits, rank, completed }) => {
        ui.updateContract(contracts.getHudData());
        ui.showToast({
          kicker: 'CONTRACT / SETTLED',
          title: `合约完成 · ${title}`,
          text: `+${reward} CR · 累计 ${credits} CR · 第 ${completed} 份 · ${rank.cn}`,
          tone: 'discovery',
          duration: 5200,
        });
        ui.showAlert(`报酬入账 +${reward} CR`, 2400);
        audio.confirm();
      },
      onSalvage: ({ remaining }) => {
        ui.updateContract(contracts.getHudData());
        ui.showAlert(remaining > 0 ? '残骸核心已回收 · 附近仍有信号' : '残骸核心已回收', 2000);
        audio.click();
      },
      onWreck: () => {},
    },
  });
  ui.updateContract(contracts.getHudData());
}

function syncCombatFiring() {
  if (!combat) return;
  combat.setFiring(
    game.mode === 'flight' &&
      !game.combatDefeated &&
      (game.keyFiring || game.touchFire),
  );
}

function damageDirectionFromSource(source) {
  if (!source || !ship) return 'front';
  const local = new THREE.Vector3()
    .copy(source)
    .sub(ship.root.position)
    .applyQuaternion(ship.root.quaternion.clone().invert());
  const angle = Math.atan2(local.x, -local.z) * DEG;
  if (angle >= -45 && angle < 45) return 'front';
  if (angle >= 45 && angle < 135) return 'right';
  if (angle >= -135 && angle < -45) return 'left';
  return 'back';
}

function handlePlayerDefeat({ kills, wave, time }) {
  if (game.combatDefeated) return;
  resetWarpCockpit();
  game.tacticalScan = false;
  ui.setTacticalScan(false);
  game.combatDefeated = true;
  game.combatWave = wave || game.combatWave;
  game.combatKills = kills || game.combatKills;
  game.keyFiring = false;
  game.touchFire = false;
  game.throttle = 0;
  game.speed = 0;
  game.warp = 0;
  game.warpHeld = false;
  game.touchWarp = false;
  game.touchThrust = false;
  game.autopilot = false;
  game.keys.clear();
  game.steer.set(0, 0);
  game.steerTarget.set(0, 0);
  combat?.setFiring(false);
  ui.setAutopilot(false);
  ui.setCombatActive(false);
  ui.flashDamage(1.8);
  ui.showDefeat({
    kills: game.combatKills,
    wave: game.combatWave,
    time: time || game.elapsed,
  });
  audio.hullAlert();
}

function respawnMission() {
  if (!game.combatDefeated || !combat) return;
  resetWarpCockpit();
  game.combatDefeated = false;
  game.mode = 'flight';
  game.cameraMode = 'chase';
  game.throttle = 0.24;
  game.speed = 0;
  game.warp = 0;
  game.warpCharge = 1;
  game.warpExhausted = false;
  game.warpWarningShown = false;
  game.keyFiring = false;
  game.touchFire = false;
  game.keys.clear();
  game.steer.set(0, 0);
  game.steerTarget.set(0, 0);

  combat.respawn();
  ui.hideDefeat();
  ui.setAutopilot(false);
  ui.setCombatActive(true);
  ui.updateCombat(combat.getHudData());
  primeChaseCamera();
  audio.confirm();
  ui.showAlert('应急跃迁完成 · 护盾与装甲已重组', 3000);
}

/* ── boot / mission flow ─────────────────────────────────── */

function updateBoot(now) {
  if (game.booted) return;

  const elapsed = (now - bootStartedAt) / 1000;
  bootUiAccum += 1 / 60;

  if (assetsLoaded && !assetsDoneAt) assetsDoneAt = now;
  if (bootUiAccum < 0.08) return;
  bootUiAccum = 0;

  const assetFraction = assetTotal > 0 ? assetLoadedCount / assetTotal : 0;
  const timedProgress = clamp(elapsed / 2.45, 0, 1);
  let percent = 4 + timedProgress * 48 + assetFraction * 44;
  if (assetsLoaded) percent = Math.max(percent, 94);
  if (elapsed > 12) percent = Math.max(percent, 97);

  const status =
    percent < 18
      ? '建立深空链路'
      : percent < 36
        ? '同步太阳系行星影像'
        : percent < 58
          ? '编译曲率场解析器'
          : percent < 78
            ? '校准导航星图'
            : percent < 95
              ? '舰体系统自检'
              : '任务文件校验完成';

  if (Math.abs(percent - lastBootPercent) > 0.4) {
    ui.setBootProgress(percent, status);
    lastBootPercent = percent;
    lastBootStatus = status;
  } else if (status !== lastBootStatus) {
    ui.setBootStatus(status);
    lastBootStatus = status;
  }

  const readyToStart =
    (assetsLoaded && elapsed > 2.45 && now - assetsDoneAt > 240) ||
    elapsed > 22;
  if (readyToStart) {
    /* A slow CDN is not a broken link: only real load errors may mark the
       boot as degraded, otherwise the start screen claims assets are offline
       when everything is still streaming in. */
    if (!assetsLoaded && assetsFailed === 0) {
      console.info('[stellar] boot continued while assets were still streaming');
    }
    finalizeBoot(assetsFailed > 0);
  }
}

function finalizeBoot(failed) {
  if (game.booted) return;
  game.booted = true;
  game.mode = 'start';
  game.cameraMode = 'menu';
  app.classList.remove('is-booting');
  if (ARRIVAL_FROM_SHIPYARD) {
    document.body.classList.add('is-launch-arrival');
  }
  ui.finishBoot({ failed });
  if (failed) {
    console.warn('[stellar] boot completed with degraded assets:', assetsFailed);
  }
  /* The crew registry stands between the boot screen and the mission: no
     session means the start button stays behind the auth layer. */
  const proceed = () => {
    const active = auth?.getSession() || null;
    applyPilot(active);
    if (!ARRIVAL_FROM_SHIPYARD) return;
    /* The shipyard has already played the launch. Skip the second
       start-screen confirmation and slide straight into the cockpit. */
    window.setTimeout(() => {
      if (!game.started) startMission();
      const cleanUrl = `${window.location.pathname}${window.location.hash}`;
      window.history.replaceState({}, document.title, cleanUrl);
      window.setTimeout(() => {
        document.body.classList.remove('is-launch-arrival');
      }, 1100);
    }, 1000);
  };

  if (auth?.getSession()) {
    window.setTimeout(proceed, 0);
  } else if (auth) {
    /* let the boot bar finish its own fade before the registry takes over */
    window.setTimeout(() => auth.open(proceed), 900);
  }
}

function startMission() {
  if (!game.booted || game.started) return;
  game.started = true;
  game.mode = 'flight';
  game.cameraMode = 'chase';
  resetWarpCockpit();
  game.startedAt = game.clock;
  game.elapsed = 0;
  game.distanceTraveled = 0;
  game.completed = false;
  game.completePending = false;
  game.combatDefeated = false;
  game.combatWave = 1;
  game.combatKills = 0;
  game.keyFiring = false;
  game.touchFire = false;
  game.tacticalScan = false;
  game.cameraShake = 0;
  game.throttle = 0.34;
  game.speed = 0;
  game.warp = 0;
  game.warpCharge = 1;
  game.warpExhausted = false;
  game.warpWarningShown = false;
  game.autopilot = false;
  game.bank = 0;
  game.steer.set(0, 0);
  game.steerTarget.set(0, 0);
  game.inspect.theta = 2.18;
  game.inspect.phi = 0.16;
  game.inspect.zoom = 196;
  game.inspect.targetZoom = 196;

  ship.root.quaternion.setFromEuler(new THREE.Euler(0.012, -0.205, 0, 'YXZ'));
  primeChaseCamera();
  ship.setExploded(false);
  ship.clearDetached();
  ship.select(game.selectedPartId || 'hull');

  ui.enterFlight();
  ui.setAutopilot(false);
  ui.setExploded(false);
  ui.setMuted(game.muted);
  ui.setTacticalScan(false);
  ui.updatePartList(ship.parts);
  ui.setDiscovered([...game.discovered]);
  ui.hideDefeat();

  if (combat) {
    combat.start();
    ui.setCombatActive(true);
    ui.updateCombat(combat.getHudData());
  }

  if (contracts) {
    contracts.start({
      accountId: auth?.getSession()?.accountId || 'guest',
      discoveredKeys: [...game.discovered],
    });
    ui.updateContract(contracts.getHudData());
  }

  audio.setMuted(game.muted);
  audio.start().catch(() => {});
  audio.confirm();

  window.setTimeout(() => {
    if (!game.started) return;
    ui.showChapter('MISSION 07 / 黎明航线', '向光而行', 'SOL SYSTEM · 2149');
  }, 1150);

  window.setTimeout(() => {
    if (!game.started) return;
    ui.showToast({
      kicker: 'NAV / LINK',
      title: '深空链路已接通',
      text: '拖拽转向 · W/S 调节推力 · SHIFT 曲率航行 · SPACE 开火',
      tone: 'system',
      duration: 6200,
    });
  }, 3300);

  window.setTimeout(() => {
    if (game.started && game.mode === 'flight') ui.flashWarp();
  }, 680);

  window.setTimeout(() => {
    if (game.started && game.mode === 'flight') ui.muteHints();
  }, 11000);
}

function enterInspection() {
  if (game.mode !== 'flight' || !ship || game.combatDefeated) return;
  resetWarpCockpit();
  game.tacticalScan = false;
  ui.setTacticalScan(false);
  game.mode = 'inspect';
  game.cameraMode = 'inspect';
  game.autopilot = false;
  game.warpHeld = false;
  game.touchWarp = false;
  game.touchThrust = false;
  game.warp = 0;
  game.speed = 0;
  game.keys.clear();
  game.keyFiring = false;
  game.touchFire = false;
  if (combat) {
    combat.setFiring(false);
    combat.setActive(false);
    combat.weaponPods.visible = false;
    combat.shieldBubble.visible = false;
  }

  if (game.selectedPartId) {
    const selected = ship.getPart(game.selectedPartId);
    if (selected) ship.select(selected.id);
  }

  const offset = tempVecA.copy(camera.position).sub(ship.root.position);
  const radius = Math.max(36, offset.length());
  game.inspect.theta = 2.0;
  game.inspect.phi = 0.3;
  game.inspect.zoom = clamp(radius, 80, 94);
  game.inspect.targetZoom = 84;
  game.inspect.lastInput = game.clock;

  game.exploded = false;
  ship.setExploded(false);
  ui.setExploded(false);

  ui.openInspect();
  ui.setAutopilot(false);
  ui.selectPart(
    ship.getPart(game.selectedPartId) || ship.getPart('hull') || ship.parts[0],
  );
  updateOutlineSelection(true);
  hidePlanetMarkers();
  hidePartMarkers();
  audio.confirm();

  if (!game.inspect.hintShown) {
    game.inspect.hintShown = true;
    ui.showAlert('结构扫描完成 · 点击模块查看规格 / 拖拽环绕 / 滚轮缩放', 4200);
  }
}

function exitInspection() {
  if (game.mode !== 'inspect') return;

  const hadDetached = ship.parts.some((part) => part.detached);
  game.mode = 'flight';
  game.cameraMode = 'chase';
  game.exploded = false;
  game.speed = 0;
  game.warp = 0;
  game.autopilot = false;
  game.warpHeld = false;
  game.touchWarp = false;
  game.touchThrust = false;
  game.throttle = Math.min(Math.max(game.throttle, 0.24), 0.42);

  ship.setExploded(false);
  ship.clearDetached();
  ui.setExploded(false);
  ui.setAutopilot(false);
  ui.updatePartList(ship.parts);
  for (const part of ship.parts) ui.setDetachedState(part.id, false);
  ui.closeInspect();
  primeChaseCamera();

  if (combat) {
    combat.setActive(true);
    combat.weaponPods.visible = true;
    syncCombatFiring();
  }

  outlinePass.enabled = false;
  outlinePass.selectedObjects.length = 0;
  hidePartMarkers();
  audio.back();

  if (hadDetached) {
    ui.showAlert('所有模块已接回 · 航行控制恢复', 2200);
  }
}

function continueMission() {
  if (game.mode !== 'complete') return;
  resetWarpCockpit();
  game.mode = 'flight';
  game.cameraMode = 'chase';
  game.autopilot = false;
  game.throttle = 0.3;
  game.speed = 0;
  game.combatDefeated = false;
  game.keyFiring = false;
  game.touchFire = false;
  ui.hideComplete();
  ui.setAutopilot(false);
  primeChaseCamera();
  if (combat) {
    combat.start();
    ui.setCombatActive(true);
    ui.updateCombat(combat.getHudData());
  }
  audio.confirm();
  ui.showAlert('自由航行模式 · 太阳系勘测已完成', 2600);
}

function completeMission() {
  if (game.mode === 'complete' || !game.completed) return;
  resetWarpCockpit();
  game.mode = 'complete';
  game.cameraMode = 'complete';
  game.autopilot = false;
  game.warpHeld = false;
  game.touchWarp = false;
  game.warp = 0;
  game.speed = 0;
  game.completeTheta = Math.atan2(
    camera.position.x - ship.root.position.x,
    camera.position.z - ship.root.position.z,
  );
  ui.setAutopilot(false);
  game.keyFiring = false;
  game.touchFire = false;
  if (combat) {
    combat.setFiring(false);
    combat.stop();
  }
  ui.setCombatActive(false);
  hidePlanetMarkers();
  audio.complete();
  ui.showComplete({
    planets: `${game.discovered.size} / ${universe.planets.length}`,
    time: formatClock(game.elapsed),
    distance: formatNavDistance(game.distanceTraveled),
  });
}

/* ── flight simulation ───────────────────────────────────── */

function updateSimulation(dt) {
  if (!ship || !universe) return;

  if (game.mode === 'flight') {
    updateFlight(dt);
    combat?.update(dt);
    contracts?.update(dt, ship.root.position);
    checkDiscovery();
    if (
      game.completePending &&
      !game.completed &&
      game.clock >= game.completeAt
    ) {
      game.completed = true;
      game.completePending = false;
      completeMission();
    }
  }

  updateShipVisual(dt);

  if (game.mode === 'flight') {
    game.elapsed += dt;
    game.distanceTraveled += game.speed * dt;
  }

  universe.update({
    dt,
    elapsed: game.clock,
    camera,
    speed: game.speed,
    warp: game.mode === 'flight' ? game.warp : 0,
    mode: game.mode === 'flight' ? 'flight' : 'menu',
  });
}

function updateFlight(dt) {
  if (!ship || game.mode !== 'flight') return;

  if (game.combatDefeated) {
    game.speed = damp(game.speed, 0, 5.5, dt);
    game.warp = damp(game.warp, 0, 6, dt);
    return;
  }

  const keys = game.keys;
  const turnZ = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
  const manualTurn =
    keys.has('KeyA') ||
    keys.has('KeyD') ||
    keys.has('ArrowUp') ||
    keys.has('ArrowDown') ||
    keys.has('ArrowLeft') ||
    keys.has('ArrowRight') ||
    Math.abs(game.steerTarget.x) > 0.01 ||
    Math.abs(game.steerTarget.y) > 0.01;

  if (game.autopilot && manualTurn && game.pointer.down) {
    manualTakeover();
  }

  game.steer.x = damp(game.steer.x, game.pointer.down ? game.steerTarget.x : 0, 20, dt);
  game.steer.y = damp(game.steer.y, game.pointer.down ? game.steerTarget.y : 0, 20, dt);

  if (game.autopilot) {
    updateAutopilot(dt);
    game.bank = damp(game.bank, 0, 4, dt);
  } else {
    const yawInput = clamp(
      (keys.has('KeyA') ? 1 : 0) -
        (keys.has('KeyD') ? 1 : 0) -
        game.steer.x,
      -1.35,
      1.35,
    );
    const pitchInput = clamp(
      (keys.has('ArrowUp') ? 1 : 0) -
        (keys.has('ArrowDown') ? 1 : 0) -
        game.steer.y,
      -1.35,
      1.35,
    );
    const warpControlScale = 1 - game.warp * 0.28;

    if (yawInput !== 0 || pitchInput !== 0 || turnZ !== 0) {
      tempQy.setFromAxisAngle(Y_AXIS, yawInput * 1.28 * dt * warpControlScale);
      tempQp.setFromAxisAngle(
        X_AXIS,
        pitchInput * 1.02 * dt * warpControlScale,
      );
      tempQr.setFromAxisAngle(Z_AXIS, turnZ * 1.75 * dt * warpControlScale);
      ship.root.quaternion
        .multiply(tempQy)
        .multiply(tempQp)
        .multiply(tempQr)
        .normalize();
    }

    const throttleInput =
      (keys.has('KeyW') ? 1 : 0) -
      (keys.has('KeyS') ? 1 : 0) +
      (game.touchThrust ? 1 : 0);
    if (throttleInput !== 0) {
      game.throttle = clamp(game.throttle + throttleInput * 0.46 * dt, 0, 1);
    }

    const warpRequested = (keys.has('ShiftLeft') || keys.has('ShiftRight') || game.touchWarp);
    game.warpHeld = Boolean(warpRequested);

    if (warpRequested && game.throttle < 0.16) {
      game.throttle = 0.18;
    }

    const canWarp =
      warpRequested &&
      !game.warpExhausted &&
      game.warpCharge > 0.001 &&
      game.mode === 'flight';

    game.warp = damp(game.warp, canWarp ? 1 : 0, canWarp ? 2.5 : 4.2, dt);

    if (canWarp) {
      game.warpCharge = Math.max(
        0,
        game.warpCharge - dt * 0.045 * (0.55 + game.warp * 0.45),
      );
    } else {
      game.warpCharge = Math.min(1, game.warpCharge + dt * 0.026);
    }

    if (game.warp > 0.45 && game.warpFlashArmed) {
      ui.flashWarp();
      game.warpFlashArmed = false;
    } else if (game.warp < 0.1) {
      game.warpFlashArmed = true;
    }

    if (game.warpCharge <= 0.0005 && canWarp) {
      game.warpCharge = 0;
      game.warpExhausted = true;
      game.warpHeld = false;
      game.warp = 0;
      ui.showAlert('曲率蓄能耗尽 · 切换常规推进', 3200);
      audio.hullAlert();
    }
    if (game.warpExhausted && game.warpCharge > 0.18) {
      game.warpExhausted = false;
      game.warpWarningShown = false;
    }

    const baseSpeed = game.throttle * 520;
    const warpSpeed = 2800 + game.throttle * 500;
    const targetSpeed = baseSpeed + (warpSpeed - baseSpeed) * game.warp;
    game.speed = damp(game.speed, targetSpeed, game.warp > 0.2 ? 1.65 : 1.45, dt);
    game.bank = damp(game.bank, clamp(yawInput * 0.72, -1, 1), 4.2, dt);
  }

  const forward = tempVecA.set(0, 0, -1).applyQuaternion(ship.root.quaternion);
  ship.root.position.addScaledVector(forward, game.speed * dt);

  resolveCollisions();
  updateWarpState();

  const cockpitThreshold = game.warpCockpit > 0.5 ? 0.2 : 0.45;
  const cockpitTarget = game.warp > cockpitThreshold ? 1 : 0;
  game.warpCockpit = damp(
    game.warpCockpit,
    cockpitTarget,
    cockpitTarget > game.warpCockpit ? 2.4 : 4.2,
    dt,
  );

  const hideShip = game.warpCockpit > 0.58;
  if (hideShip !== game.cockpitShipHidden) {
    game.cockpitShipHidden = hideShip;
    if (ship.visual) ship.visual.visible = !hideShip;
    if (combat?.weaponPods) combat.weaponPods.visible = !hideShip;
  }

  if (warpCockpitRig) {
    const rigVisible = game.warpCockpit > (game.cockpitRigVisible ? 0.42 : 0.55);
    if (rigVisible !== game.cockpitRigVisible) {
      game.cockpitRigVisible = rigVisible;
      warpCockpitRig.setActive(rigVisible);
    }
    warpCockpitRig.update(dt, game.warp, game.warpCockpit);
  }
  syncWarpCockpitUi();
}

function updateAutopilot(dt) {
  const target = universe.planets[game.targetIndex];
  if (!target) {
    toggleAutopilot(false, { silent: true });
    return;
  }

  const targetPos = tempVecB.copy(target.group.position);
  const toTarget = tempVecC.copy(targetPos).sub(ship.root.position);
  const centerDistance = toTarget.length();
  const stopDistance = Math.max(target.visitDistance * 0.55, target.radius * 1.45 + 100);
  const distanceToStop = centerDistance - stopDistance;

  if (distanceToStop < 70) {
    game.speed = 0;
    game.throttle = 0;
    toggleAutopilot(false, { silent: true });
    ui.showAlert(`抵达勘测轨道 · ${target.cn}`, 2600);
    audio.dock();
    return;
  }

  const forward = tempVecA.set(0, 0, -1).applyQuaternion(ship.root.quaternion);
  const desiredDirection = toTarget.normalize();

  // Skim around planetary gravity wells instead of pinning the ship against
  // a planet when the target happens to sit behind it.
  autopilotAvoidance.set(0, 0, 0);
  for (const planet of universe.planets) {
    const distance = autopilotOffset
      .copy(ship.root.position)
      .sub(planet.group.position)
      .length();
    const safeRadius = planet.radius * 1.6 + 100;
    if (distance < safeRadius) {
      autopilotOffset.normalize();
      autopilotAvoidance.addScaledVector(
        autopilotOffset,
        (1 - distance / safeRadius) * 2.8,
      );
    }
  }
  desiredDirection.add(autopilotAvoidance).normalize();

  tempQuatA.setFromUnitVectors(forward, desiredDirection);
  tempQuatB.copy(ship.root.quaternion).premultiply(tempQuatA);
  ship.root.quaternion.slerp(tempQuatB, 1 - Math.exp(-2.05 * dt)).normalize();

  const desiredSpeed = clamp(
    Math.sqrt(Math.max(0, distanceToStop) * 1450) + 50,
    80,
    760,
  );
  game.throttle = clamp(desiredSpeed / 520, 0.12, 1);
  game.speed = damp(game.speed, desiredSpeed, 1.7, dt);
  game.warp = damp(game.warp, 0, 4.5, dt);
}

function updateWarpState() {
  const steppingOut = game.warp < 0.16;
  if (steppingOut && game.warpCharge < 0.04 && !game.warpExhausted) {
    game.warpExhausted = true;
  }
}

function updateShipVisual(dt) {
  if (!ship) return;
  if (game.mode === 'flight') {
    ship.update({
      dt,
      elapsed: game.clock,
      mode: 'flight',
      throttle: game.autopilot ? 0.8 : game.throttle,
      warp: game.warp,
      speed: game.speed,
      bank: game.bank,
      pitch: 0,
    });
  } else if (game.mode === 'inspect') {
    ship.update({
      dt,
      elapsed: game.clock,
      mode: 'inspect',
      throttle: 0,
      warp: 0,
      speed: 0,
      bank: 0,
      pitch: 0,
    });
  } else {
    ship.update({
      dt,
      elapsed: game.clock,
      mode: 'menu',
      throttle: 0,
      warp: 0,
      speed: 0,
      bank: 0,
      pitch: 0,
    });
  }
}

function resolveCollisions() {
  if (!universe) return;
  for (const planet of universe.planets) {
    const minDistance = planet.radius * 1.09 + 36;
    const delta = tempVecA.copy(ship.root.position).sub(planet.group.position);
    const distance = delta.length();
    if (distance >= minDistance) continue;
    delta.normalize();
    ship.root.position.copy(planet.group.position).addScaledVector(delta, minDistance);
    game.speed *= 0.2;
    game.warp = 0;
    if (game.clock - game.lastCollisionAt > 3.8) {
      game.lastCollisionAt = game.clock;
      ui.showAlert(`引力井警告 · ${planet.cn}大气层修正`, 2800);
      audio.hullAlert();
    }
  }

  if (universe.sun?.group) {
    const minDistance = 1120;
    const delta = tempVecA.copy(ship.root.position).sub(universe.sun.group.position);
    const distance = delta.length();
    if (distance < minDistance) {
      delta.normalize();
      ship.root.position.copy(universe.sun.group.position).addScaledVector(delta, minDistance);
      game.speed *= 0.15;
      game.warp = 0;
      if (game.clock - game.lastCollisionAt > 3.8) {
        game.lastCollisionAt = game.clock;
        ui.showAlert('恒星热辐射临界 · 自动航向修正', 3000);
        audio.hullAlert();
      }
    }
  }
}

function checkDiscovery() {
  if (!universe) return;
  for (const planet of universe.planets) {
    if (game.discovered.has(planet.key)) continue;
    const distance = ship.root.position.distanceTo(planet.group.position);
    if (distance > planet.visitDistance) continue;

    game.discovered.add(planet.key);
    contracts?.notifyPlanet(planet.key);
    ui.setDiscovered([...game.discovered]);
    audio.discovery();

    const count = game.discovered.size;
    ui.showToast({
      kicker: `PLANETARY SURVEY / ${String(count).padStart(2, '0')}`,
      title: `${planet.cn} · 勘测完成`,
      text: planet.blurb,
      tone: 'discovery',
      duration: 5400,
    });

    if (count === universe.planets.length && !game.completed) {
      game.completePending = true;
      game.completeAt = game.clock + 4.3;
      ui.showAlert('太阳系全图勘测完成 · 正在汇总任务记录', 3800);
    }
  }
}

function manualTakeover() {
  if (!game.autopilot) return;
  game.autopilot = false;
  ui.setAutopilot(false);
  ui.showAlert('手动接管 · 航向控制已解锁', 1800);
  audio.back();
}

/* ── camera direction ────────────────────────────────────── */

function updateCamera(dt) {
  if (!camera || !ship) return;

  if (game.cameraMode === 'inspect') {
    updateInspectCamera(dt);
  } else if (game.cameraMode === 'complete') {
    updateCompleteCamera(dt);
  } else if (game.cameraMode === 'chase' && game.mode === 'flight') {
    updateChaseCamera(dt);
  } else {
    updateMenuCamera(dt);
  }

  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  camera.getWorldDirection(cameraForward);
  cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  updateCameraFill(dt);
}

function updateCameraFill(dt) {
  if (!cameraFill) return;
  const target =
    game.mode === 'inspect'
      ? 2400
      : game.mode === 'complete'
        ? 1900
        : game.mode === 'flight'
          ? 600
          : 2200;
  const secondaryTarget =
    game.mode === 'inspect'
      ? 700
      : game.mode === 'complete'
        ? 500
        : game.mode === 'menu'
          ? 350
          : 0;
  cameraFill.intensity = damp(cameraFill.intensity, target, 4.2, dt);
  cameraFill.position
    .copy(camera.position)
    .addScaledVector(cameraForward, 16)
    .addScaledVector(cameraRight, 55);
  cameraFill.position.y += 34;

  if (cameraKey) {
    const keyTarget =
      game.mode === 'inspect'
        ? 0.95
        : game.mode === 'complete'
          ? 0.75
          : game.mode === 'flight'
            ? 0.1
            : 0.9;
    cameraKey.intensity = damp(cameraKey.intensity, keyTarget, 4.2, dt);
    cameraKey.position
      .copy(camera.position)
      .addScaledVector(cameraForward, 12)
      .addScaledVector(cameraRight, 24);
    cameraKey.position.y += 15;
    cameraKeyTarget.position.copy(ship.root.position);
    cameraKeyTarget.updateMatrixWorld();
  }

  if (cameraFillSecondary) {
    cameraFillSecondary.intensity = damp(
      cameraFillSecondary.intensity,
      secondaryTarget,
      4.2,
      dt,
    );
    cameraFillSecondary.position
      .copy(camera.position)
      .addScaledVector(cameraForward, 10)
      .addScaledVector(cameraRight, -62);
    cameraFillSecondary.position.y += 8;
  }
}

function primeChaseCamera() {
  if (!ship || !camera) return;
  chaseOffset.copy(camera.position).sub(ship.root.position);
  chaseOffsetReady = true;
}

function resetWarpCockpit() {
  game.warpCockpit = 0;
  game.cockpitShipHidden = false;
  game.cockpitRigVisible = false;
  if (ship?.visual) ship.visual.visible = true;
  if (combat?.weaponPods) combat.weaponPods.visible = true;
  warpCockpitRig?.setActive(false);
  ui?.setWarpCockpit(false);
}

function syncWarpCockpitUi() {
  if (!ui) return;
  ui.setWarpCockpit(game.warpCockpit > 0.06);
}

function updateMenuCamera(dt) {
  game.menuTheta += dt * 0.024;
  const radius = 88;
  const desired = tempVecA.set(
    Math.sin(game.menuTheta) * radius,
    35 + Math.sin(game.clock * 0.22) * 2.2,
    Math.cos(game.menuTheta) * radius,
  );
  const follow = 1 - Math.exp(-1.8 * dt);
  camera.position.lerp(desired, follow);

  const look = tempVecB.set(0, 2.4, 0);
  const toLook = tempVecC.copy(look).sub(camera.position).normalize();
  const screenRight = tempVecD.crossVectors(toLook, Y_AXIS).normalize();
  look.addScaledVector(screenRight, -12);
  game.cameraLook.lerp(look, 1 - Math.exp(-2.2 * dt));
  camera.up.set(0, 1, 0);
  camera.lookAt(game.cameraLook);
  setFov(42, dt);
}

function updateChaseCamera(dt) {
  /* Center-locked chase rig:
     the eye sits strictly on the hull's aft axis (no lateral offset, no
     look-ahead), so the nose always points into the vanishing point and the
     ship's centre is exactly the screen centre. Reactivity comes from the
     ship's own rotation, not from a lagging camera, which keeps the
     orientation stable while turning. */
  const forward = chaseForward
    .set(0, 0, -1)
    .applyQuaternion(ship.root.quaternion);
  const shipUp = chaseShipUp
    .set(0, 1, 0)
    .applyQuaternion(ship.root.quaternion);

  /* horizon stays level: only a touch of the ship's roll bleeds into the
     camera, so banking reads without rolling the world */
  const stableUp = chaseStableUp
    .copy(Y_AXIS)
    .multiplyScalar(0.9)
    .addScaledVector(shipUp, 0.1)
    .normalize();

  const speedNorm = clamp(game.speed / 3200, 0, 1);
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const portraitBoost = aspect < 1.15 ? clamp(1.26 / aspect, 1, 1.6) : 1;
  const back = (100 + speedNorm * 10) * portraitBoost;
  const height = 60 * (1 + (portraitBoost - 1) * 0.3);

  const desiredOffset = chaseDesired
    .set(0, 0, 0)
    .addScaledVector(forward, -back)
    .addScaledVector(stableUp, height);

  /* hard lock (no positional lag) — the rig is bolted to the hull */
  chaseOffset.copy(desiredOffset);
  chaseOffsetReady = true;
  camera.position.copy(ship.root.position).add(chaseOffset);
  camera.up.copy(stableUp);

  /* Aim at the visual centre of the whole vessel (hull + warp ring), not at
     the hull origin: the ring sits 7.3 m aft and 1.3 m up, so a hull-origin
     aim leaves the ship reading ~25 px low. The offset is rigid in ship
     space, so the framing never drifts as the ship turns. */
  const lookTarget = chaseLook
    .copy(ship.root.position)
    .add(chaseLookOffset.set(0, 1.3, 7.3).applyQuaternion(ship.root.quaternion));
  game.cameraLook.copy(lookTarget);
  camera.lookAt(lookTarget);

  const blend = game.warpCockpit * game.warpCockpit * (3 - 2 * game.warpCockpit);
  const baseFov = 57 + game.warp * 8;
  if (blend > 0.001) {
    cockpitPosition
      .copy(ship.root.position)
      .add(tempVecD.set(0, 4.9, -7.8).applyQuaternion(ship.root.quaternion));
    cockpitPosition.x += Math.sin(game.clock * 47.3) * game.warp * 0.035 * blend;
    cockpitPosition.y += Math.cos(game.clock * 39.1) * game.warp * 0.026 * blend;
    camera.position.lerp(cockpitPosition, blend);
    camera.quaternion.slerp(ship.root.quaternion, blend);
    camera.up.lerp(shipUp, blend);
    setFov(baseFov + (77 - baseFov) * blend, dt);
  } else {
    setFov(baseFov, dt);
  }

  if (game.cameraShake > 0.01) {
    const amount = game.cameraShake;
    camera.position.x += (Math.random() - 0.5) * amount * 0.055;
    camera.position.y += (Math.random() - 0.5) * amount * 0.045;
    camera.position.z += (Math.random() - 0.5) * amount * 0.035;
    camera.rotateZ((Math.random() - 0.5) * amount * 0.0011);
    game.cameraShake = damp(game.cameraShake, 0, 8.5, dt);
    if (game.cameraShake < 0.02) game.cameraShake = 0;
  }
}

function updateInspectCamera(dt) {
  if (!game.inspect.dragging && game.clock - game.inspect.lastInput > 4.5) {
    game.inspect.theta += dt * 0.038;
  }
  game.inspect.zoom = damp(game.inspect.zoom, game.inspect.targetZoom, 3.1, dt);

  const focusHeight = game.exploded ? 6.1 : 2.8;
  const focus = tempVecA
    .copy(ship.root.position)
    .add(tempVecB.set(0, focusHeight, 0));
  const portraitZoom =
    window.innerWidth < window.innerHeight ? 1.22 : 1;
  const radius = game.inspect.zoom * portraitZoom;
  const cosPhi = Math.cos(game.inspect.phi);
  const desired = tempVecC.set(
    focus.x + Math.sin(game.inspect.theta) * cosPhi * radius,
    focus.y + Math.sin(game.inspect.phi) * radius,
    focus.z + Math.cos(game.inspect.theta) * cosPhi * radius,
  );

  camera.position.lerp(desired, 1 - Math.exp(-3.4 * dt));
  camera.up.set(0, 1, 0);
  game.cameraLook.lerp(focus, 1 - Math.exp(-4.1 * dt));
  camera.lookAt(game.cameraLook);
  setFov(41, dt);
}

function updateCompleteCamera(dt) {
  game.completeTheta += dt * 0.036;
  const radius = 112;
  const focus = tempVecA.copy(ship.root.position).add(tempVecB.set(0, 5.2, 0));
  const desired = tempVecC.set(
    focus.x + Math.sin(game.completeTheta) * radius,
    focus.y + 17,
    focus.z + Math.cos(game.completeTheta) * radius,
  );
  camera.position.lerp(desired, 1 - Math.exp(-1.7 * dt));
  camera.up.set(0, 1, 0);
  game.cameraLook.lerp(focus, 1 - Math.exp(-2.2 * dt));
  camera.lookAt(game.cameraLook);
  setFov(43, dt);
}

function setFov(target, dt) {
  game.fov = damp(game.fov, target, 3.2, dt);
  if (Math.abs(camera.fov - game.fov) > 0.01) {
    camera.fov = game.fov;
    camera.updateProjectionMatrix();
  }
}

/* ── HUD + world-space labels ────────────────────────────── */

function updateInterface(dt) {
  if (!universe || !ship) return;

  hudAccum += dt;
  markerAccum += dt;
  radarAccum += dt;
  audioAccum += dt;

  if (hudAccum >= 0.09) {
    hudAccum = 0;
    updateHud();
    updateCombatHud();
    if (contracts) ui.updateContract(contracts.getHudData());
  }

  if (markerAccum >= 0.07) {
    markerAccum = 0;
    updatePlanetMarkers();
    updatePartMarkers();
    updateEnemyMarkers();
  }

  if (radarAccum >= 0.2) {
    radarAccum = 0;
    if (game.mode === 'flight') updateRadar();
  }

  if (audioAccum >= 0.09) {
    audioAccum = 0;
    const flying = game.mode === 'flight';
    audio.setFlight({
      throttle: flying ? (game.autopilot ? 0.8 : game.throttle) : 0,
      warp: flying ? game.warp : 0,
      speed: flying ? game.speed : 0,
    });
  }
}

function updateHud() {
  if (game.mode !== 'flight') return;
  const target = universe.planets[game.targetIndex];
  if (!target) return;

  const targetDir = tempVecA.copy(target.group.position).sub(ship.root.position);
  const targetDistance = targetDir.length();
  const forward = tempVecB.set(0, 0, -1).applyQuaternion(ship.root.quaternion);
  const right = tempVecC.set(1, 0, 0).applyQuaternion(ship.root.quaternion);
  targetDir.normalize();

  const forwardDot = clamp(forward.dot(targetDir), -1, 1);
  const targetAngle = Math.acos(forwardDot) * DEG;
  const bearing = (Math.atan2(targetDir.dot(right), forwardDot) * DEG + 360) % 360;
  const speedC = clamp(game.speed / 3200, 0, 1) * 0.94;
  const speedKmS = speedC * 299792.458;

  let nearest = '—';
  let nearestDistance = Infinity;
  for (const planet of universe.planets) {
    const distance = ship.root.position.distanceTo(planet.group.position);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = `${planet.cn} / ${formatNavDistance(Math.max(0, distance - planet.radius))}`;
    }
  }
  if (universe.sun?.group) {
    const sunDistance = ship.root.position.distanceTo(universe.sun.group.position);
    if (sunDistance < nearestDistance) {
      nearest = `太阳 / ${formatNavDistance(Math.max(0, sunDistance - 960))}`;
    }
  }

  const heading =
    (Math.atan2(forward.x, -forward.z) * DEG + 360) % 360;
  const warpState =
    game.warpExhausted || game.warpCharge < 0.04
      ? 'exhausted'
      : game.warp > 0.08
        ? 'draining'
        : null;

  const combatHud = combat && !game.combatDefeated ? combat.getHudData() : null;
  const planetReticle =
    targetAngle < 12
      ? '航向锁定'
      : targetAngle > 150
        ? '目标在后方'
        : `目标偏差 ${Math.round(targetAngle)}°`;
  const reticleLabel = combatHud?.targetName
    ? `武器锁定 · ${combatHud.targetName}`
    : planetReticle;

  ui.updateFlight({
    speedC,
    speedKmS,
    throttle: game.autopilot
      ? clamp(game.speed / 760, 0, 1)
      : game.throttle,
    warpCharge: game.warpCharge,
    warpState,
    reactorTemp:
      6900 +
      game.throttle * 2100 +
      game.warp * 2700 +
      Math.sin(game.clock * 1.7) * 36,
    nearest,
    heading,
    modeLabel: game.autopilot
      ? 'AUTO'
      : game.warp > 0.22
        ? 'WARP'
        : game.speed > 80
          ? 'CRUISE'
          : 'HOLD',
    clock: formatClock(game.elapsed),
    reticleLabel,
  });

  ui.updateTargetTelemetry(
    formatNavDistance(targetDistance),
    bearing,
  );

  ui.updateMission({
    target: `${target.cn} / ${String(target.en).toUpperCase()}`,
    distance: formatNavDistance(targetDistance),
    bearing: `${String(Math.round(bearing)).padStart(3, '0')}°`,
    objective: `行星勘测 · ${target.cn}`,
    progress: `勘测 ${String(game.discovered.size).padStart(2, '0')} / ${String(
      universe.planets.length,
    ).padStart(2, '0')}`,
  });
}

function updateCombatHud() {
  if (!combat) return;
  const data = combat.getHudData();
  if (game.mode !== 'flight' || game.combatDefeated) {
    if (game.mode !== 'flight') combat.setFiring(false);
    ui.setCombatActive(false);
    return;
  }
  ui.updateCombat(data);
}

function updateEnemyMarkers() {
  if (!combat || game.mode !== 'flight' || game.combatDefeated) {
    ui.updateEnemyMarkers([]);
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const items = [];

  for (const enemy of combat.getEnemyMarkers()) {
    enemy.group.getWorldPosition(worldPoint);
    const direction = tempVecA.copy(worldPoint).sub(camera.position);
    const inFront = direction.dot(cameraForward) > 0;
    projected.copy(worldPoint).project(camera);
    const visible =
      inFront &&
      projected.z > -1 &&
      projected.z < 1.02 &&
      Math.abs(projected.x) < 1.15 &&
      Math.abs(projected.y) < 1.15;

    if (!visible) {
      items.push({ ...enemy, visible: false });
      continue;
    }

    items.push({
      ...enemy,
      visible: true,
      x: clamp((projected.x * 0.5 + 0.5) * width, 68, width - 68),
      y: clamp((-projected.y * 0.5 + 0.5) * height, 92, height - 100),
    });
  }

  /* Declutter: the locked target plus one nearest hostile carry a full
     readout; the rest collapse to a diamond and a range, nudged apart
     so stacked contacts stay legible. */
  const ranked = items
    .filter((item) => item.visible)
    .sort(
      (a, b) =>
        Number(Boolean(b.locked)) - Number(Boolean(a.locked)) ||
        a.distance - b.distance,
    );
  const placed = [];
  let detailed = 0;

  for (const item of ranked) {
    let x = item.x;
    let y = item.y;
    let compact = !item.locked && detailed >= 2;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const crowded = placed.some(
        (other) => Math.abs(other.x - x) < 58 && Math.abs(other.y - y) < 44,
      );
      if (!crowded) break;
      compact = true;
      y += 44;
      if (y > height - 108) y = item.y - 44 * (attempt + 1);
    }

    placed.push({ x, y });
    if (!compact) detailed += 1;
    item.x = x;
    item.y = y;
    item.compact = compact;
  }

  ui.updateEnemyMarkers(items);
}

function updatePlanetMarkers() {
  if (game.mode !== 'flight') {
    if (game.planetMarkersShown) {
      game.planetMarkersShown = false;
      hidePlanetMarkers();
    }
    return;
  }
  game.planetMarkersShown = true;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const items = [];
  const targetKey = universe.planets[game.targetIndex]?.key;
  let nearestKey = null;
  let nearestDistance = Infinity;
  for (const planet of universe.planets) {
    const distance = ship.root.position.distanceTo(planet.group.position);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestKey = planet.key;
    }
  }
  const combatActive =
    combat &&
    combat.active &&
    !game.combatDefeated &&
    combat.getHudData().enemyCount > 0;
  const targetOnly = combatActive || game.warp > 0.16;
  const allowed =
    game.tacticalScan && !game.warp
      ? new Set(universe.planets.map((planet) => planet.key))
      : new Set([targetKey]);
  if (!targetOnly && !game.tacticalScan && nearestKey) allowed.add(nearestKey);

  for (const planet of universe.planets) {
    if (!allowed.has(planet.key)) {
      items.push({ key: planet.key, visible: false });
      continue;
    }
    worldPoint.copy(planet.group.position);
    const direction = tempVecA.copy(worldPoint).sub(camera.position);
    const inFront = direction.dot(cameraForward) > 0;
    projected.copy(worldPoint).project(camera);

    let visible = inFront && projected.z < 1.02 && projected.z > -1;
    let edge = null;
    let x = (projected.x * 0.5 + 0.5) * width;
    let y = (-projected.y * 0.5 + 0.5) * height;

    if (!visible) {
      items.push({ key: planet.key, visible: false });
      continue;
    }

    if (x < 36 || x > width - 36 || y < 82 || y > height - 118) {
      if (planet.key !== targetKey) {
        visible = false;
      } else {
        edge = x < width * 0.5 ? 'left' : 'right';
        x = clamp(x, 72, width - 72);
        y = clamp(y, 104, height - 154);
      }
    }

    if (!visible) {
      items.push({ key: planet.key, visible: false });
      continue;
    }

    items.push({
      key: planet.key,
      visible: true,
      x,
      y,
      edge,
      distance: formatNavDistance(
        ship.root.position.distanceTo(planet.group.position),
      ),
    });
  }

  ui.setPlanetMarkers(items);
}

function updatePartMarkers() {
  if (game.mode !== 'inspect') {
    if (game.partMarkersShown) {
      game.partMarkersShown = false;
      hidePartMarkers();
    }
    return;
  }
  game.partMarkersShown = true;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const items = [];

  for (const part of ship.parts) {
    if (!game.exploded && part.id !== game.selectedPartId) {
      items.push({ id: part.id, visible: false });
      continue;
    }
    part.anchor.getWorldPosition(worldPoint);
    const direction = tempVecA.copy(worldPoint).sub(camera.position);
    const inFront = direction.dot(cameraForward) > 0;
    projected.copy(worldPoint).project(camera);
    const visible =
      inFront &&
      projected.z > -1 &&
      projected.z < 1.02 &&
      Math.abs(projected.x) < 1.06 &&
      Math.abs(projected.y) < 1.06;
    if (!visible) {
      items.push({ id: part.id, visible: false });
      continue;
    }
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    items.push({
      id: part.id,
      visible: true,
      x: clamp(x, 42, width - 42),
      y: clamp(y, 92, height - 90),
      flipped: x > width * 0.58,
    });
  }

  ui.setPartMarkersData(items);
}

function updateRadar() {
  const target = universe.planets[game.targetIndex];
  const forward = tempVecA.set(0, 0, -1).applyQuaternion(ship.root.quaternion);
  const heading = Math.atan2(forward.x, -forward.z);
  ui.drawRadar({
    player: { x: ship.root.position.x, z: ship.root.position.z },
    yaw: -heading,
    targetKey: target?.key,
    sun: {
      x: universe.sun.group.position.x,
      z: universe.sun.group.position.z,
    },
    planets: universe.planets.map((planet) => ({
      x: planet.group.position.x,
      z: planet.group.position.z,
      key: planet.key,
      color: planet.color || '#8be9ff',
      discovered: game.discovered.has(planet.key),
    })),
    enemies: game.combatDefeated ? [] : combat?.getRadarContacts() || [],
  });
}

function hidePlanetMarkers() {
  for (const planet of universe?.planets || []) {
    markerHiddenItems.push({ key: planet.key, visible: false });
  }
  if (markerHiddenItems.length) ui.setPlanetMarkers(markerHiddenItems);
  markerHiddenItems.length = 0;
}

function hidePartMarkers() {
  if (!ship) return;
  for (const part of ship.parts) {
    emptyMarkerItems.push({ id: part.id, visible: false });
  }
  if (emptyMarkerItems.length) ui.setPartMarkersData(emptyMarkerItems);
  emptyMarkerItems.length = 0;
}

/* ── interaction: targets, inspection, sound ─────────────── */

function setTargetIndex(index, announce = true) {
  if (!universe?.planets?.length) return;
  const total = universe.planets.length;
  game.targetIndex = ((index % total) + total) % total;
  const planet = universe.planets[game.targetIndex];
  ui.setTarget(planet, game.targetIndex, total);

  const distance = ship
    ? ship.root.position.distanceTo(planet.group.position)
    : 0;
  ui.updateTargetTelemetry(formatNavDistance(distance), 0);

  if (announce) {
    audio.click();
    ui.showAlert(`导航目标 · ${planet.cn} / ${planet.en}`, 1900);
  }
}

function stepTarget(delta) {
  if (game.mode !== 'flight') return;
  setTargetIndex(game.targetIndex + delta, true);
}

function selectPlanetByKey(key) {
  if (game.mode !== 'flight' || !universe) return;
  const index = universe.planets.findIndex((planet) => planet.key === key);
  if (index < 0) return;
  setTargetIndex(index, true);
}

function toggleAutopilot(force, options = {}) {
  if (game.mode !== 'flight') return;
  const next = typeof force === 'boolean' ? force : !game.autopilot;
  if (next === game.autopilot) return;
  game.autopilot = next;
  ui.setAutopilot(next);

  if (next) {
    const target = universe.planets[game.targetIndex];
    audio.autopilot();
    ui.showAlert(`自动导航接入 · ${target?.cn || '未知天体'}`, 2400);
  } else if (!options.silent) {
    audio.back();
    ui.showAlert('自动导航解除 · 手动控制', 1800);
  }
}

function toggleSound() {
  game.muted = !game.muted;
  audio.setMuted(game.muted);
  ui.setMuted(game.muted);
  if (!game.muted && game.started) audio.start().catch(() => {});
}

function selectPart(id) {
  if (!ship) return;
  const part = ship.getPart(id);
  if (!part) return;
  game.selectedPartId = id;
  ship.select(id);
  ui.selectPart(part);
  updateOutlineSelection(game.mode === 'inspect');
  if (game.mode === 'inspect') audio.click();
}

function updateOutlineSelection(enabled = false) {
  if (!outlinePass || !ship) return;
  const part = ship.getPart(game.selectedPartId);
  if (!enabled && game.mode !== 'inspect') {
    outlinePass.enabled = false;
    outlinePass.selectedObjects.length = 0;
    return;
  }
  if (game.mode !== 'inspect') {
    outlinePass.enabled = false;
    return;
  }
  outlinePass.enabled = true;
  outlinePass.selectedObjects.length = 0;
  if (part) {
    outlinePass.selectedObjects.push(...part.outlineMeshes);
    outlinePass.visibleEdgeColor.set(part.accent || '#8be9ff');
  }
}

function toggleDetach() {
  if (game.mode !== 'inspect') return;
  const part = ship.getPart(game.selectedPartId);
  if (!part || !part.canDetach) {
    ui.showAlert('核心模块锁定 · 不可分离', 1800);
    audio.back();
    return;
  }
  const next = !part.detached;
  ship.setDetached(part.id, next);
  ui.setDetachedState(part.id, next);
  ui.updatePartList(ship.parts);
  if (next) {
    audio.detach();
    ui.showAlert(`模块分离 · ${part.cn} / ${part.en}`, 2200);
  } else {
    audio.dock();
    ui.showAlert(`模块接回 · ${part.cn} / ${part.en}`, 2000);
  }
}

function toggleExplosion() {
  if (game.mode !== 'inspect') return;
  game.exploded = !game.exploded;
  ship.setExploded(game.exploded);
  ui.setExploded(game.exploded);
  game.inspect.targetZoom = game.exploded ? 196 : 84;
  audio.confirm();
}

function resetInspection() {
  if (game.mode !== 'inspect') return;
  ship.reset();
  ship.clearDetached();
  ship.setExploded(false);
  game.exploded = false;
  ui.setExploded(false);
  ui.updatePartList(ship.parts);
  for (const part of ship.parts) ui.setDetachedState(part.id, false);

  const hull = ship.getPart('hull') || ship.parts[0];
  selectPart(hull.id);
  game.inspect.targetZoom = 84;
  audio.dock();
  ui.showAlert('舰体结构已恢复 · 全模块锁定', 2200);
}

function pickPart(clientX, clientY) {
  if (game.mode !== 'inspect' || !ship || !raycaster) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  scene.updateMatrixWorld(true);
  const hits = raycaster.intersectObjects(ship.allPickables, false);
  if (!hits.length) return;
  const part = ship.getPartAtObject(hits[0].object);
  if (part) selectPart(part.id);
}

/* ── input ───────────────────────────────────────────────── */

function bindInput() {
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', resetInputState);
  window.addEventListener('resize', onResize);
  window.addEventListener('visibilitychange', () => {
    if (document.hidden) resetInputState();
    else lastFrame = performance.now();
  });

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && event.buttons === 0) return;
  });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

function onKeyDown(event) {
  const code = event.code;

  if (
    (game.mode === 'flight' &&
      ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) ||
    (game.mode === 'complete' && ['Space', 'Enter'].includes(code)) ||
    (game.combatDefeated && ['Space', 'Enter', 'Escape'].includes(code))
  ) {
    event.preventDefault();
  }

  if (event.repeat) return;

  if (code === 'KeyM') {
    toggleSound();
    return;
  }

  if (game.combatDefeated) {
    if (code === 'Enter' || code === 'Space' || code === 'Escape') {
      respawnMission();
    }
    return;
  }

  if (game.mode === 'complete') {
    if (code === 'Escape' || code === 'Enter' || code === 'Space') continueMission();
    return;
  }

  if (game.mode === 'inspect') {
    if (code === 'Escape' || code === 'KeyX') exitInspection();
    return;
  }

  if (game.mode !== 'flight') return;

  if (code === 'Space') {
    game.keyFiring = true;
    syncCombatFiring();
    return;
  }

  if (code === 'KeyX') {
    enterInspection();
    return;
  }
  if (code === 'KeyF') {
    toggleAutopilot();
    return;
  }
  if (code === 'Tab') {
    game.tacticalScan = true;
    ui.setTacticalScan(true);
    return;
  }
  if (code === 'KeyT') {
    stepTarget(1);
    return;
  }
  if (code === 'Escape') {
    game.keys.clear();
    return;
  }

  const manualCodes = [
    'KeyW',
    'KeyS',
    'KeyA',
    'KeyD',
    'KeyQ',
    'KeyE',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ShiftLeft',
    'ShiftRight',
  ];

  if (manualCodes.includes(code)) {
    if (game.autopilot) manualTakeover();
    if (!event.repeat) game.keys.add(code);
  }
}

function onKeyUp(event) {
  game.keys.delete(event.code);
  if (event.code === 'Space') {
    game.keyFiring = false;
    syncCombatFiring();
  }
  if (event.code === 'Tab') {
    game.tacticalScan = false;
    ui.setTacticalScan(false);
  }
}

function resetInputState() {
  game.keys.clear();
  game.warpHeld = false;
  game.touchThrust = false;
  game.touchWarp = false;
  game.keyFiring = false;
  game.touchFire = false;
  game.tacticalScan = false;
  ui?.setTacticalScan(false);
  combat?.setFiring(false);
  game.steerTarget.set(0, 0);
  game.pointer.down = false;
  game.pointer.id = null;
  game.inspect.dragging = false;
  if (ui?.el?.touch) {
    ui.el.touch.querySelectorAll('.is-pressed').forEach((el) => el.classList.remove('is-pressed'));
  }
}

function onPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  if (game.mode === 'flight') {
    if (game.autopilot) manualTakeover();
    game.pointer.down = true;
    game.pointer.id = event.pointerId;
    game.pointer.startX = event.clientX;
    game.pointer.startY = event.clientY;
    game.pointer.lastX = event.clientX;
    game.pointer.lastY = event.clientY;
    game.pointer.moved = 0;
    game.steerTarget.set(0, 0);
    try {
      renderer.domElement.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture is a convenience, not a requirement */
    }
    event.preventDefault();
  } else if (game.mode === 'inspect') {
    game.pointer.down = true;
    game.pointer.id = event.pointerId;
    game.pointer.startX = event.clientX;
    game.pointer.startY = event.clientY;
    game.pointer.lastX = event.clientX;
    game.pointer.lastY = event.clientY;
    game.pointer.moved = 0;
    game.inspect.dragging = true;
    game.inspect.lastInput = game.clock;
    try {
      renderer.domElement.setPointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
    event.preventDefault();
  }
}

function onPointerMove(event) {
  if (!game.pointer.down || event.pointerId !== game.pointer.id) return;

  const dx = event.clientX - game.pointer.startX;
  const dy = event.clientY - game.pointer.startY;
  game.pointer.lastX = event.clientX;
  game.pointer.lastY = event.clientY;
  game.pointer.moved = Math.max(game.pointer.moved, Math.hypot(dx, dy));

  if (game.mode === 'flight') {
    game.steerTarget.set(
      clamp(dx / (window.innerWidth * 0.17), -1, 1),
      clamp(dy / (window.innerHeight * 0.17), -1, 1),
    );
  } else if (game.mode === 'inspect') {
    game.inspect.theta -= dx * 0.0052;
    game.inspect.phi = clamp(game.inspect.phi - dy * 0.004, -0.45, 1.32);
    game.inspect.lastInput = game.clock;
  }
}

function onPointerUp(event) {
  if (!game.pointer.down) return;
  if (event.pointerId !== game.pointer.id) return;

  const wasInspect = game.mode === 'inspect';
  const wasFlight = game.mode === 'flight';
  const moved = game.pointer.moved;
  const pointerX = event.clientX;
  const pointerY = event.clientY;

  game.pointer.down = false;
  game.pointer.id = null;
  game.inspect.dragging = false;
  game.inspect.lastInput = game.clock;
  game.steerTarget.set(0, 0);

  try {
    if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
  } catch {
    /* noop */
  }

  if (wasInspect && moved < 7) {
    pickPart(pointerX, pointerY);
  }

  if (wasFlight) {
    // A click without a drag is a harmless nudge, not a course change.
    game.steer.set(0, 0);
  }
}

function onWheel(event) {
  if (game.mode !== 'inspect') return;
  event.preventDefault();
  game.inspect.targetZoom = clamp(
    game.inspect.targetZoom * (1 + event.deltaY * 0.00075),
    88,
    280,
  );
  game.inspect.lastInput = game.clock;
}

function onResize() {
  if (!renderer || !camera) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.6 : 2);

  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();

  if (composer) {
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
  }
}

/* ── frame loop ──────────────────────────────────────────── */

function animate(now) {
  requestAnimationFrame(animate);
  const rawDt = (now - lastFrame) / 1000;
  lastFrame = now;
  const dt = clamp(rawDt || 0.016, 0.001, 0.05);

  game.clock += dt;
  game.frames += 1;

  updateBoot(now);

  if (game.booted) {
    updateSimulation(dt);
    updateCamera(dt);
    updateInterface(dt);
  }

  if (gradePass) gradePass.uniforms.uTime.value = game.clock;
  if (composer) composer.render();
}

/* ── helpers ─────────────────────────────────────────────── */

function formatNavDistance(units) {
  const safeUnits = Math.max(0, Number.isFinite(units) ? units : 0);
  const km = safeUnits * NAV_KM_PER_UNIT;
  const au = km / AU_KM;
  if (au >= 0.1) {
    return `${au.toFixed(au >= 10 ? 1 : 2)} AU`;
  }
  if (km >= 1000000) {
    return `${(km / 1000000).toFixed(2)}M km`;
  }
  return `${formatNumber(Math.round(km))} km`;
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

function fatal(error) {
  console.error('[stellar] fatal:', error);
  const message =
    error?.message?.includes('WebGL')
      ? '此设备未能建立 WebGL 渲染上下文。请启用硬件加速后重试。'
      : '任务初始化中断。请刷新页面，或检查本地服务器是否已启动。';
  try {
    ui.showError(message);
  } catch {
    if (app) app.innerHTML = `<div class="webgl-error">${message}</div>`;
  }
}
