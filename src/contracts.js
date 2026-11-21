import * as THREE from 'three';
import { clamp, mulberry32 } from './utils.js';
import { createGlowTexture } from './textures.js';

/**
 * 合约与打捞系统
 * ---------------------------------------------------------------
 * 三班倒的合约链：勘测 → 清剿 → 打捞 → 勘测……
 * 每完成一份合约结算 CR 与舰队资历，并按舰长账号持久化。
 * 敌机被击毁时会掉落可打捞的残骸核心，靠近即可回收。
 */

const STORAGE_PREFIX = 'stellar_odyssey:contracts:v1:';
const SALVAGE_TTL = 92;
const PICKUP_RADIUS = 58;
const NEXT_DELAY = 6.5;
const DROP_CHANCE = 0.62;

const RANKS = [
  { at: 0, cn: '见习舰长', en: 'ENSIGN' },
  { at: 120, cn: '上尉', en: 'LIEUTENANT' },
  { at: 320, cn: '少校', en: 'COMMANDER' },
  { at: 640, cn: '星区指挥官', en: 'SECTOR COMMANDER' },
];

const CONTRACT_DEFS = {
  survey: {
    need: () => 1,
    reward: 180,
    xp: 60,
    kicker: 'SURVEY / 勘测合约',
    title: (target) => `勘测 ${target}`,
    desc: (target) => `抵达 ${target} 轨道并完成地形扫描。`,
  },
  sweep: {
    need: () => 4,
    reward: 220,
    xp: 80,
    kicker: 'INTERCEPT / 清剿合约',
    title: () => '清剿空域',
    desc: () => '击毁 4 艘敌对拦截机，恢复航道控制权。',
  },
  salvage: {
    need: () => 3,
    reward: 260,
    xp: 90,
    kicker: 'SALVAGE / 打捞合约',
    title: () => '回收残骸',
    desc: () => '击毁敌机后回收 3 个残骸核心（飞近自动打捞）。',
  },
};

const ORDER = ['survey', 'sweep', 'salvage'];

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export class ContractSystem {
  constructor({ scene, ship, audio, callbacks = {}, getWallet = null } = {}) {
    this.getWallet = getWallet;
    this.scene = scene;
    this.ship = ship;
    this.audio = audio;
    this.callbacks = callbacks;

    this.accountId = 'guest';
    this.storageKey = `${STORAGE_PREFIX}guest`;
    this.state = {
      credits: 0,
      xp: 0,
      completed: 0,
      issued: 0,
      active: null,
      pendingAt: 0,
    };
    this.wrecks = [];
    this.time = 0;
    this.random = mulberry32(0x51a7);
    this.glowTexture = createGlowTexture('rgba(255, 214, 160, 1)');
    this.materials = {
      core: new THREE.MeshStandardMaterial({
        color: 0xffcf90,
        emissive: 0xff9d43,
        emissiveIntensity: 1.9,
        metalness: 0.55,
        roughness: 0.3,
      }),
      ring: new THREE.MeshStandardMaterial({
        color: 0x8be9ff,
        emissive: 0x3fb9d8,
        emissiveIntensity: 1.3,
        metalness: 0.3,
        roughness: 0.35,
      }),
    };
    this.geo = {
      core: new THREE.OctahedronGeometry(1.55, 0),
      ring: new THREE.TorusGeometry(3.15, 0.14, 5, 22),
    };
  }

  /* ── lifecycle ─────────────────────────────────────────── */

  start({ accountId, discoveredKeys = [] } = {}) {
    this.accountId = accountId || 'guest';
    this.storageKey = `${STORAGE_PREFIX}${this.accountId}`;
    const saved = readJson(this.storageKey);
    if (saved && typeof saved === 'object') {
      this.state = {
        credits: Number(saved.credits) || 0,
        xp: Number(saved.xp) || 0,
        completed: Number(saved.completed) || 0,
        issued: Number(saved.issued) || 0,
        active: saved.active && saved.active.type ? saved.active : null,
        pendingAt: 0,
      };
    } else {
      this.state = { credits: 0, xp: 0, completed: 0, issued: 0, active: null, pendingAt: 0 };
    }
    this.discoveredKeys = new Set(discoveredKeys);
    this.clearWrecks();
    this.time = 0;
    if (!this.state.active) this.issueNextContract();
    return this.state.active;
  }

  stop() {
    this.clearWrecks();
  }

  setAccount(accountId, discoveredKeys = []) {
    if ((accountId || 'guest') === this.accountId) return;
    this.start({ accountId, discoveredKeys });
  }

  save() {
    writeJson(this.storageKey, {
      credits: this.state.credits,
      xp: this.state.xp,
      completed: this.state.completed,
      issued: this.state.issued,
      active: this.state.active,
    });
  }

  /* ── contract generation ───────────────────────────────── */

  rank() {
    let entry = RANKS[0];
    for (const rank of RANKS) if (this.state.xp >= rank.at) entry = rank;
    return entry;
  }

  issueNextContract() {
    const def = CONTRACT_DEFS;
    const type = ORDER[this.state.issued % ORDER.length];
    this.state.issued += 1;

    if (type === 'survey') {
      const pool = (this.callbacks.undiscoveredPlanets?.() || []).filter(
        (planet) => !this.discoveredKeys.has(planet.key),
      );
      if (pool.length === 0) {
        /* 全部行星都勘测过了，改派一份清剿合约。 */
        const need = def.sweep.need();
        this.state.active = {
          id: uid(),
          type: 'sweep',
          title: def.sweep.title(),
          desc: def.sweep.desc(),
          kicker: def.sweep.kicker,
          need,
          got: 0,
          reward: def.sweep.reward,
          xp: def.sweep.xp,
        };
      } else {
        const planet = pool[Math.floor(this.random() * pool.length)];
        this.state.active = {
          id: uid(),
          type: 'survey',
          target: planet.key,
          title: def.survey.title(planet.cn),
          desc: def.survey.desc(planet.cn),
          kicker: def.survey.kicker,
          need: def.survey.need(),
          got: 0,
          reward: def.survey.reward,
          xp: def.survey.xp,
        };
      }
    } else {
      const entry = def[type];
      this.state.active = {
        id: uid(),
        type,
        title: entry.title(),
        desc: entry.desc(),
        kicker: entry.kicker,
        need: entry.need(),
        got: 0,
        reward: entry.reward,
        xp: entry.xp,
      };
    }
    this.state.pendingAt = 0;
    this.save();
    this.callbacks.onIssued?.(this.getHudData());
    return this.state.active;
  }

  completeActive(silent = false) {
    const active = this.state.active;
    if (!active) return null;
    const wallet = this.getWallet ? this.getWallet() : null;
    if (wallet) {
      wallet.addCredits(active.reward);
      wallet.addXp(active.xp);
      this.state.credits = wallet.credits;
      this.state.xp = wallet.xp;
    } else {
      this.state.credits += active.reward;
      this.state.xp += active.xp;
    }
    this.state.completed += 1;
    this.state.active = null;
    this.state.pendingAt = this.time + NEXT_DELAY;
    this.save();
    if (!silent) {
      this.callbacks.onComplete?.({
        title: active.title,
        reward: active.reward,
        xp: active.xp,
        credits: this.state.credits,
        rank: this.rank(),
        completed: this.state.completed,
        nextIn: NEXT_DELAY,
      });
    }
    return active;
  }

  /* ── progress hooks ────────────────────────────────────── */

  notifyPlanet(key) {
    if (!this.discoveredKeys) this.discoveredKeys = new Set();
    this.discoveredKeys.add(key);
    const active = this.state.active;
    if (!active || active.type !== 'survey' || active.target !== key) return;
    active.got = Math.min(active.need, active.got + 1);
    this.completeActive();
  }

  notifyKill(position) {
    const active = this.state.active;
    if (active && active.type === 'sweep') {
      active.got = Math.min(active.need, active.got + 1);
      if (active.got >= active.need) this.completeActive();
      else this.save();
    }
    if (position && this.random() < DROP_CHANCE) this.spawnWreck(position);
  }

  notifySalvage(count = 1) {
    const active = this.state.active;
    if (!active || active.type !== 'salvage') return;
    active.got = clamp(active.got + count, 0, active.need);
    if (active.got >= active.need) this.completeActive();
    else this.save();
  }

  /* ── salvage wrecks ────────────────────────────────────── */

  spawnWreck(position) {
    const group = new THREE.Group();
    const coreMaterial = this.materials.core.clone();
    const core = new THREE.Mesh(this.geo.core, coreMaterial);
    core.castShadow = false;
    group.add(core);
    const ring = new THREE.Mesh(this.geo.ring, this.materials.ring);
    ring.rotation.x = Math.PI * 0.42;
    ring.rotation.y = 0.5;
    group.add(ring);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xffb066,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.scale.setScalar(11);
    group.add(glow);

    group.position.copy(position);
    group.position.x += (this.random() - 0.5) * 7;
    group.position.y += (this.random() - 0.5) * 5;
    group.position.z += (this.random() - 0.5) * 7;
    this.scene.add(group);

    this.wrecks.push({
      group,
      core,
      coreMaterial,
      ring,
      glow,
      age: 0,
      phase: this.random() * Math.PI * 2,
      spin: 0.6 + this.random() * 0.7,
      drift: new THREE.Vector3(
        (this.random() - 0.5) * 3.4,
        (this.random() - 0.5) * 2.2,
        (this.random() - 0.5) * 3.4,
      ),
      collected: false,
    });
    this.callbacks.onWreck?.({ total: this.wrecks.length });
  }

  clearWrecks() {
    for (const wreck of this.wrecks) {
      this.scene.remove(wreck.group);
      wreck.group.traverse((child) => {
        if (child.isSprite) child.material?.dispose?.();
      });
      wreck.coreMaterial?.dispose?.();
    }
    this.wrecks = [];
  }

  /* ── per-frame ─────────────────────────────────────────── */

  update(dt, playerPosition) {
    this.time += dt;
    if (!this.state.active && this.state.pendingAt && this.time >= this.state.pendingAt) {
      this.issueNextContract();
    }

    const wx = playerPosition?.x ?? 0;
    const wy = playerPosition?.y ?? 0;
    const wz = playerPosition?.z ?? 0;

    for (let i = this.wrecks.length - 1; i >= 0; i -= 1) {
      const wreck = this.wrecks[i];
      wreck.age += dt;
      wreck.group.position.addScaledVector(wreck.drift, dt);
      wreck.core.rotation.y += dt * wreck.spin;
      wreck.core.rotation.x += dt * wreck.spin * 0.6;
      wreck.ring.rotation.z += dt * 0.9;
      wreck.group.position.y += Math.sin(this.time * 1.4 + wreck.phase) * dt * 1.6;

      const fadeStart = SALVAGE_TTL - 12;
      const alpha = wreck.age > fadeStart
        ? clamp(1 - (wreck.age - fadeStart) / 12, 0, 1) * (0.55 + 0.45 * Math.sin(wreck.age * 9))
        : 1;
      wreck.glow.material.opacity = 0.85 * clamp(alpha, 0, 1);
      wreck.coreMaterial.emissiveIntensity = 1.9 * (0.7 + 0.3 * Math.sin(wreck.age * 5 + wreck.phase));

      const dx = wreck.group.position.x - wx;
      const dy = wreck.group.position.y - wy;
      const dz = wreck.group.position.z - wz;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < PICKUP_RADIUS) {
        this.scene.remove(wreck.group);
        wreck.group.traverse((child) => {
          if (child.isSprite) child.material?.dispose?.();
        });
        this.wrecks.splice(i, 1);
        this.notifySalvage(1);
        this.callbacks.onSalvage?.({
          collected: 1,
          remaining: this.wrecks.length,
          credits: this.state.credits,
        });
        continue;
      }

      if (wreck.age > SALVAGE_TTL) {
        this.scene.remove(wreck.group);
        wreck.group.traverse((child) => {
          if (child.isSprite) child.material?.dispose?.();
        });
        this.wrecks.splice(i, 1);
      }
    }
  }

  /* ── readouts ──────────────────────────────────────────── */

  getHudData() {
    const active = this.state.active;
    const rank = this.rank();
    const pending = !active && this.state.pendingAt > 0;
    const remain = pending ? Math.max(0, Math.ceil(this.state.pendingAt - this.time)) : 0;
    return {
      visible: Boolean(active || pending),
      kicker: active ? active.kicker : 'CONTRACT / 待命',
      title: active ? active.title : '接收下一份合约',
      desc: active ? active.desc : '上一份合约已结算，任务链路正在分配新的航段。',
      progress: active?.got ?? 0,
      need: active?.need ?? 0,
      progressText: active ? `${active.got} / ${active.need}` : `${remain} s`,
      reward: active?.reward ?? 0,
      credits: this.state.credits,
      completed: this.state.completed,
      rankCn: rank.cn,
      rankEn: rank.en,
      wrecks: this.wrecks.length,
      nextIn: remain,
      pending,
    };
  }

}

export function createContractSystem(options) {
  return new ContractSystem(options);
}

export const CONTRACT_STORAGE_PREFIX = STORAGE_PREFIX;