/* ===================================================================== */
/*  NX-SHIPYARD — LIGHT-SPEED ASSEMBLY DESK                              */
/*  No frameworks. No build step. Config-first.                          */
/* ===================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 1. CONFIG — replace parts and weights here                           */
  /* ------------------------------------------------------------------ */

  const CONFIG = {
    storagePrefix: 'lightspeed_shipyard:v1:',
    maxBuilds: 20,
    launchDuration: 3600,
    defaultHull: 'hull-scout',
    slots: {
      engine: 2,
      shield: 2,
      weapon: 2,
      cockpit: 1,
      tail: 1,
      decor: 54,
    },
    performance: {
      caps: {
        propulsion: 120,
        defense: 120,
        firepower: 120,
        energy: 100,
      },
      coefficients: {
        thrustScale: 100,
        otherWeight: 0.6,
        hullArmor: 0.4,
        shield: 0.6,
        weapon: 0.8,
        engineFirepower: 0.2,
      },
      weights: {
        propulsion: 0.35,
        defense: 0.3,
        firepower: 0.25,
        energyHeadroom: 0.1,
      },
      ratings: [
        { min: 85, label: 'S' },
        { min: 70, label: 'A' },
        { min: 55, label: 'B' },
        { min: -Infinity, label: 'C' },
      ],
      lightspeedThreshold: 100,
      energyLimit: 100,
    },
  };

  const CATEGORIES = [
    { id: 'hull', label: '船体', en: 'HULL', glyph: 'H', open: true },
    { id: 'engine', label: '引擎', en: 'ENGINE', glyph: 'E', open: true },
    { id: 'shield', label: '护盾', en: 'SHIELD', glyph: 'S', open: true },
    { id: 'weapon', label: '武器', en: 'WEAPON', glyph: 'W', open: true },
    { id: 'cockpit', label: '驾驶舱', en: 'COCKPIT', glyph: 'C', open: false },
    { id: 'tail', label: '尾翼', en: 'TAIL', glyph: 'T', open: false },
    { id: 'decor', label: '装饰', en: 'DECOR', glyph: 'D', open: false },
  ];
  const CATEGORY_BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

  /* ------------------------------------------------------------------ */
  /* 1b. PROGRESSION — credits, unlocks, hull integrity                   */
  /* ------------------------------------------------------------------ */

  const Progression = window.StellarProgression;
  const PRICES = (Progression && Progression.PRICES) || {};

  function currentAccountId() {
    try {
      const raw = window.localStorage.getItem('stellar_odyssey:session:v1');
      if (!raw) return 'guest';
      const session = JSON.parse(raw);
      return (session && session.accountId) || 'guest';
    } catch (error) {
      return 'guest';
    }
  }

  let progression = null;
  function profile() {
    if (!progression && Progression) {
      progression = Progression.createProgression(currentAccountId());
    }
    return progression;
  }

  function isUnlocked(partId) {
    const p = profile();
    return p ? p.isUnlocked(partId) : true;
  }

  function priceOf(partId) {
    const p = profile();
    if (p) return p.price(partId);
    return PRICES[partId];
  }

  function formatCredits(value) {
    return Math.round(Number(value) || 0).toLocaleString('en-US');
  }

  function updateCreditsChip() {
    const p = profile();
    const value = $('#yard-credits-value');
    const hull = $('#yard-hull-value');
    if (!p) return;
    if (value) value.textContent = formatCredits(p.credits);
    if (hull) {
      hull.textContent = `${Math.round(p.hull)}%`;
      hull.classList.toggle('is-critical', p.hull <= 35);
      hull.classList.toggle('is-damaged', p.hull <= 70);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 2. PARTS — the whole parts catalogue lives in this array            */
  /* ------------------------------------------------------------------ */

  const PARTS = [
    /* HULLS */
    {
      id: 'hull-scout', category: 'hull', name: '轻型侦察舰体', en: 'SCOUT FRAME', mk: 'MK I',
      weight: 8, armor: 18, energy: 4, thrust: 0, defense: 18, firepower: 0,
      description: '轻量陶瓷骨架，为速度与远程侦察而生。',
    },
    {
      id: 'hull-line', category: 'hull', name: '标准护卫舰体', en: 'ESCORT FRAME', mk: 'MK II',
      weight: 14, armor: 32, energy: 5, thrust: 0, defense: 32, firepower: 0,
      description: '均衡的军用承力框架，能装下完整的护卫配置。',
    },
    {
      id: 'hull-bastion', category: 'hull', name: '重装堡垒舰体', en: 'BASTION FRAME', mk: 'MK III',
      weight: 24, armor: 52, energy: 8, thrust: 0, defense: 52, firepower: 0,
      description: '厚重的层压装甲与冗余能源母线，慢，但很难被击穿。',
    },

    /* ENGINES */
    {
      id: 'engine-ion', category: 'engine', name: '离子推进器', en: 'ION DRIVE', mk: 'ID-2',
      weight: 8, armor: 0, energy: 5, thrust: 14, defense: 0, firepower: 0,
      description: '低能耗巡航引擎，适合长时间深空航行。',
    },
    {
      id: 'engine-pulse', category: 'engine', name: '脉冲等离子引擎', en: 'PULSE PLASMA', mk: 'PP-4',
      weight: 12, armor: 0, energy: 7, thrust: 20, defense: 0, firepower: 0,
      description: '短促而明亮的等离子尾焰，响应迅速。',
    },
    {
      id: 'engine-fusion', category: 'engine', name: '双环聚变引擎', en: 'FUSION TWIN', mk: 'FT-7',
      weight: 16, armor: 0, energy: 8, thrust: 26, defense: 0, firepower: 0,
      description: '双燃烧室串联，推力与热负荷同样可观。',
    },
    {
      id: 'engine-singularity', category: 'engine', name: '奇点曲率引擎', en: 'SINGULARITY', mk: 'S-9',
      weight: 24, armor: 0, energy: 14, thrust: 38, defense: 0, firepower: 0,
      description: '用微型奇点折叠前方空间，逼近光速的钥匙。',
    },

    /* SHIELDS */
    {
      id: 'shield-deflector', category: 'shield', name: '偏导护盾', en: 'DEFLECTOR', mk: 'DF-1',
      weight: 4, armor: 0, energy: 5, thrust: 0, defense: 18, firepower: 0,
      description: '转移来袭动能，重量极低，适合侦察舰。',
    },
    {
      id: 'shield-phase', category: 'shield', name: '多层相位盾', en: 'PHASE LAYER', mk: 'PL-3',
      weight: 7, armor: 0, energy: 9, thrust: 0, defense: 32, firepower: 0,
      description: '相位错位吸收能量束，护盾发生器的中坚型号。',
    },
    {
      id: 'shield-aegis', category: 'shield', name: '埃癸斯力场', en: 'AEGIS FIELD', mk: 'AG-8',
      weight: 11, armor: 0, energy: 14, thrust: 0, defense: 45, firepower: 0,
      description: '军用级全覆盖力场，代价是惊人的能量消耗。',
    },

    /* WEAPONS */
    {
      id: 'weapon-pulse', category: 'weapon', name: '脉冲炮', en: 'PULSE CANNON', mk: 'PC-2',
      weight: 5, armor: 0, energy: 8, thrust: 0, defense: 0, firepower: 22,
      description: '可靠的短距速射武器，几乎不会过热。',
    },
    {
      id: 'weapon-beam', category: 'weapon', name: '粒子光束', en: 'PARTICLE BEAM', mk: 'PB-5',
      weight: 7, armor: 0, energy: 12, thrust: 0, defense: 0, firepower: 34,
      description: '连续切割装甲的细长粒子流，能耗中等。',
    },
    {
      id: 'weapon-rail', category: 'weapon', name: '轨道磁轨炮', en: 'RAIL LANCE', mk: 'RL-6',
      weight: 12, armor: 0, energy: 18, thrust: 0, defense: 0, firepower: 45,
      description: '一次充能换一次贯穿，舰首的长矛。',
    },
    {
      id: 'weapon-torpedo', category: 'weapon', name: '鱼雷发射舱', en: 'TORPEDO BAY', mk: 'TB-9',
      weight: 15, armor: 0, energy: 24, thrust: 0, defense: 0, firepower: 52,
      description: '高爆战斗部带来毁灭性齐射，也会迅速榨干核心。',
    },

    /* COCKPITS */
    {
      id: 'cockpit-solo', category: 'cockpit', name: '单人战术舱', en: 'SOLO TACTICAL', mk: 'C-1',
      weight: 2, armor: 0, energy: 2, thrust: 0, defense: 0, firepower: 0,
      description: '紧凑、直接、没有多余席位。',
    },
    {
      id: 'cockpit-command', category: 'cockpit', name: '双座指挥舱', en: 'COMMAND DUAL', mk: 'C-3',
      weight: 4, armor: 0, energy: 4, thrust: 0, defense: 0, firepower: 0,
      description: '驾驶员与系统官并排，长航程更从容。',
    },
    {
      id: 'cockpit-neural', category: 'cockpit', name: '神经链接舱', en: 'NEURAL LINK', mk: 'C-7',
      weight: 3, armor: 0, energy: 6, thrust: 0, defense: 0, firepower: 0,
      description: '把反射弧直接交给舰体，快，但有点费神。',
    },

    /* TAILS */
    {
      id: 'tail-vector', category: 'tail', name: '矢量尾翼', en: 'VECTOR TAIL', mk: 'T-2',
      weight: 2, armor: 0, energy: 1, thrust: 0, defense: 0, firepower: 0,
      description: '经典的三轴矢量翼面，稳定而可靠。',
    },
    {
      id: 'tail-curve', category: 'tail', name: '曲率稳定尾翼', en: 'WARP STABILIZER', mk: 'T-5',
      weight: 3, armor: 0, energy: 3, thrust: 0, defense: 0, firepower: 0,
      description: '在光速包络中抑制偏航漂移。',
    },
    {
      id: 'tail-recon', category: 'tail', name: '侦察尾翼', en: 'RECON FIN', mk: 'T-7',
      weight: 2, armor: 0, energy: 1, thrust: 0, defense: 0, firepower: 0,
      description: '更大的翼展，换来更灵敏的滚转响应。',
    },

    /* DECOR */
    {
      id: 'decor-plate', category: 'decor', name: '反应装甲贴片', en: 'REACTIVE PLATE', mk: 'D-1',
      weight: 1, armor: 0, energy: 0, thrust: 0, defense: 0, firepower: 0,
      description: '小面积附加装甲，主要作用是好看且显得很能打。',
    },
    {
      id: 'decor-antenna', category: 'decor', name: '外挂天线', en: 'BLADE ANTENNA', mk: 'D-2',
      weight: 0.5, armor: 0, energy: 1, thrust: 0, defense: 0, firepower: 0,
      description: '拉高通信增益，顺手给舰体增加一点轮廓。',
    },
    {
      id: 'decor-vent', category: 'decor', name: '散热鳍片', en: 'THERMAL VANES', mk: 'D-3',
      weight: 0.4, armor: 0, energy: 1, thrust: 0, defense: 0, firepower: 0,
      description: '把废热甩进真空，顺便闪一闪。',
    },
    {
      id: 'decor-beacon', category: 'decor', name: '相位信标', en: 'PHASE BEACON', mk: 'D-4',
      weight: 0.3, armor: 0, energy: 2, thrust: 0, defense: 0, firepower: 0,
      description: '在深空里留下一个非常昂贵的坐标点。',
    },
    {
      id: 'decor-drone', category: 'decor', name: '维修无人机坞', en: 'DRONE CRADLE', mk: 'D-5',
      weight: 1.6, armor: 0, energy: 2, thrust: 0, defense: 0, firepower: 0,
      description: '装着一台小型维修机，也装着一点安心。',
    },
    {
      id: 'decor-stripe', category: 'decor', name: '金色舷号', en: 'GOLD REGISTRY', mk: 'D-6',
      weight: 0.2, armor: 0, energy: 0, thrust: 0, defense: 0, firepower: 0,
      description: '让所有人知道这艘船有名字。',
    },
    {
      id: 'decor-lamp', category: 'decor', name: '尾迹航行灯', en: 'WAKE LAMP', mk: 'D-7',
      weight: 0.2, armor: 0, energy: 1, thrust: 0, defense: 0, firepower: 0,
      description: '航行灯亮起时，像一条很慢的流星。',
    },
    {
      id: 'decor-nav', category: 'decor', name: '深空导航天线', en: 'DEEP NAV', mk: 'D-8',
      weight: 0.3, armor: 0, energy: 1, thrust: 0, defense: 0, firepower: 0,
      description: '在光速下依然能听见母星的坐标。',
    },
  ];

  const PART_BY_ID = new Map(PARTS.map((part) => [part.id, part]));
  const PARTS_BY_CATEGORY = new Map(CATEGORIES.map((category) => [
    category.id,
    PARTS.filter((part) => part.category === category.id),
  ]));

  /* ------------------------------------------------------------------ */
  /* 3. SLOT LAYOUT — 8 core slots + 54 decor sockets = 62                */
  /* ------------------------------------------------------------------ */

  const CORE_SLOTS = [
    { id: 'cockpit', category: 'cockpit', label: '驾驶舱槽', en: 'COCKPIT', x: 50, y: 7 },
    { id: 'weapon-0', category: 'weapon', label: '左武器槽', en: 'WEAPON L', x: 24, y: 20 },
    { id: 'weapon-1', category: 'weapon', label: '右武器槽', en: 'WEAPON R', x: 76, y: 20 },
    { id: 'shield-0', category: 'shield', label: '左护盾槽', en: 'SHIELD L', x: 8, y: 46 },
    { id: 'shield-1', category: 'shield', label: '右护盾槽', en: 'SHIELD R', x: 92, y: 46 },
    { id: 'engine-0', category: 'engine', label: '左主引擎', en: 'ENGINE L', x: 33, y: 79 },
    { id: 'engine-1', category: 'engine', label: '右主引擎', en: 'ENGINE R', x: 67, y: 79 },
    { id: 'tail', category: 'tail', label: '尾翼槽', en: 'TAIL', x: 50, y: 90 },
  ];
  const DECOR_COUNT = CONFIG.slots.decor;
  const DECOR_SLOTS = Array.from({ length: DECOR_COUNT }, (_, index) => ({
    id: `decor-${index}`,
    category: 'decor',
    label: `装饰槽 ${String(index + 1).padStart(2, '0')}`,
    en: 'DECOR',
    index,
  }));
  const ALL_SLOTS = [...CORE_SLOTS, ...DECOR_SLOTS];
  const SLOT_BY_ID = new Map(ALL_SLOTS.map((slot) => [slot.id, slot]));

  const STORAGE = {
    builds: `${CONFIG.storagePrefix}builds`,
    draft: `${CONFIG.storagePrefix}draft`,
  };

  const INITIAL_NAMES = [
    '星梭·侦察型',
    '壁垒·护航型',
    '雷霆·突击型',
    '无题远征方案',
    '深空拆解实验',
    '猎户座快速反应',
  ];

  /* ------------------------------------------------------------------ */
  /* 4. Small utilities                                                   */
  /* ------------------------------------------------------------------ */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const round1 = (value) => Number(value.toFixed(1));
  const nowISO = () => new Date().toISOString();
  const uuid = () => {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `build-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));

  function seededRandom(seedText) {
    let seed = 2166136261;
    const text = String(seedText || 'shipyard');
    for (let i = 0; i < text.length; i += 1) {
      seed ^= text.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    return () => {
      seed += 0x6d2b79f5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function formatDate(iso) {
    if (!iso) return '未记录';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '未记录';
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(date);
  }

  function formatFileDate() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function safeFileStem(value) {
    return String(value || '未命名方案')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '_')
      .slice(0, 48);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;left:-9999px;opacity:0';
      document.body.appendChild(area);
      area.focus();
      area.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        area.remove();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 5. Storage + state                                                   */
  /* ------------------------------------------------------------------ */

  let storageOK = true;
  try {
    const probe = `${CONFIG.storagePrefix}probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
  } catch (error) {
    storageOK = false;
  }

  function storageGet(key) {
    if (!storageOK) return null;
    try { return localStorage.getItem(key); } catch (error) { return null; }
  }
  function storageSet(key, value) {
    if (!storageOK) return false;
    try { localStorage.setItem(key, value); return true; } catch (error) { return false; }
  }
  function readJSON(key, fallback) {
    const raw = storageGet(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch (error) { return fallback; }
  }
  function writeJSON(key, value) {
    return storageSet(key, JSON.stringify(value));
  }

  function emptySlots() {
    const slots = {};
    CORE_SLOTS.forEach((slot) => { slots[slot.id] = null; });
    DECOR_SLOTS.forEach((slot) => { slots[slot.id] = null; });
    return slots;
  }

  function normalizeSlots(raw) {
    const slots = emptySlots();
    if (!raw || typeof raw !== 'object') return slots;
    ALL_SLOTS.forEach((slot) => {
      const partId = raw[slot.id];
      const part = PART_BY_ID.get(partId);
      if (part && part.category === slot.category) slots[slot.id] = part.id;
    });
    return slots;
  }

  function sanitizeBuild(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const hull = PART_BY_ID.get(raw.hullId);
    const hullId = hull && hull.category === 'hull' ? hull.id : CONFIG.defaultHull;
    const slots = normalizeSlots(raw.slots);
    const name = String(raw.name || '未命名方案').trim().slice(0, 48) || '未命名方案';
    return {
      id: String(raw.id || uuid()),
      name,
      hullId,
      slots,
      savedAt: raw.savedAt || nowISO(),
    };
  }

  function currentSnapshot() {
    return {
      id: currentBuildId || null,
      name: currentName || '未命名方案',
      hullId: state.hullId,
      slots: { ...state.slots },
      savedAt: nowISO(),
    };
  }

  let builds = [];
  let state = {
    hullId: CONFIG.defaultHull,
    slots: emptySlots(),
    name: '未命名方案',
  };
  let currentBuildId = null;
  let currentName = '未命名方案';
  let statsCache = null;
  let previousStats = null;
  let dragPartId = null;
  let pointerDrag = null;
  let dragHoverElement = null;
  let dragTargetHalo = null;
  let lastInstalledSlot = null;
  let flashTimer = 0;
  let refitTimer = 0;
  let toastTimer = 0;
  let activeModal = null;
  let hangarFocus = null;
  let launchTimer = 0;
  let launchWarpTimer = 0;
  let launchActive = false;
  let launchNavigated = false;
  const FLIGHT_URL = '../index.html?from=shipyard&launch=1';

  function makeSampleBuild(name, hullId, assignments, decorIds, daysAgo) {
    const slots = emptySlots();
    Object.entries(assignments).forEach(([slotId, partId]) => {
      const slot = SLOT_BY_ID.get(slotId);
      const part = PART_BY_ID.get(partId);
      if (slot && part && slot.category === part.category) slots[slotId] = partId;
    });
    decorIds.forEach((partId, index) => {
      if (index < DECOR_SLOTS.length && PART_BY_ID.has(partId)) slots[DECOR_SLOTS[index].id] = partId;
    });
    return {
      id: `sample-${hullId}-${name.length}`,
      name,
      hullId,
      slots,
      savedAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    };
  }

  function createSampleBuilds() {
    const sampleDecor = ['decor-plate', 'decor-antenna', 'decor-vent', 'decor-beacon', 'decor-drone', 'decor-stripe', 'decor-lamp', 'decor-nav'];
    return [
      makeSampleBuild('星梭·侦察型', 'hull-scout', {
        'engine-0': 'engine-pulse', 'engine-1': 'engine-ion',
        'shield-0': 'shield-deflector', 'shield-1': 'shield-deflector',
        'weapon-0': 'weapon-pulse', 'weapon-1': 'weapon-beam',
        cockpit: 'cockpit-solo', tail: 'tail-recon',
      }, sampleDecor.slice(0, 8), 1),
      makeSampleBuild('壁垒·护航型', 'hull-line', {
        'engine-0': 'engine-fusion', 'engine-1': 'engine-pulse',
        'shield-0': 'shield-phase', 'shield-1': 'shield-aegis',
        'weapon-0': 'weapon-rail', 'weapon-1': 'weapon-pulse',
        cockpit: 'cockpit-command', tail: 'tail-curve',
      }, sampleDecor.slice(0, 14), 2),
      makeSampleBuild('雷霆·突击型', 'hull-bastion', {
        'engine-0': 'engine-singularity', 'engine-1': 'engine-fusion',
        'shield-0': 'shield-aegis', 'shield-1': 'shield-phase',
        'weapon-0': 'weapon-rail', 'weapon-1': 'weapon-torpedo',
        cockpit: 'cockpit-command', tail: 'tail-vector',
      }, sampleDecor.slice(0, 1), 3),
    ];
  }

  function loadBuildsFromStorage() {
    const stored = readJSON(STORAGE.builds, null);
    if (stored === null) {
      writeJSON(STORAGE.builds, []);
      return [];
    }
    if (!Array.isArray(stored)) return [];
    return stored
      .map(sanitizeBuild)
      .filter(Boolean)
      .slice(0, CONFIG.maxBuilds);
  }

  function loadDraft() {
    const draft = readJSON(STORAGE.draft, null);
    if (!draft || typeof draft !== 'object') return null;
    return sanitizeBuild(draft);
  }

  function adoptBuild(build, keepIdentity = false) {
    state = {
      hullId: build.hullId || CONFIG.defaultHull,
      slots: normalizeSlots(build.slots),
      name: build.name || '未命名方案',
    };
    currentName = state.name;
    currentBuildId = keepIdentity ? build.id : null;
  }

  function saveDraft() {
    writeJSON(STORAGE.draft, {
      id: currentBuildId,
      name: currentName,
      hullId: state.hullId,
      slots: state.slots,
      savedAt: nowISO(),
    });
  }

  function persistBuilds() {
    const result = writeJSON(STORAGE.builds, builds.slice(0, CONFIG.maxBuilds));
    if (!result && storageOK) showToast('保存失败：浏览器存储不可用。', 'warning');
    updateHangarCount();
    return result;
  }

  /* ------------------------------------------------------------------ */
  /* 6. Formula engine                                                    */
  /* ------------------------------------------------------------------ */

  function partInSlot(build, slotId) {
    const slot = SLOT_BY_ID.get(slotId);
    if (!slot) return null;
    const partId = build.slots && build.slots[slotId];
    const part = PART_BY_ID.get(partId);
    return part && part.category === slot.category ? part : null;
  }

  function equippedCoreParts(build) {
    return CORE_SLOTS.map((slot) => ({ slot, part: partInSlot(build, slot.id) }));
  }

  function hullForBuild(build) {
    const hull = PART_BY_ID.get(build.hullId);
    return hull && hull.category === 'hull' ? hull : PART_BY_ID.get(CONFIG.defaultHull);
  }

  function computeStats(build) {
    const formula = CONFIG.performance.coefficients;
    const caps = CONFIG.performance.caps;
    const hull = hullForBuild(build);
    const core = equippedCoreParts(build);
    const engines = core.filter((entry) => entry.slot.category === 'engine' && entry.part).map((entry) => entry.part);
    const shields = core.filter((entry) => entry.slot.category === 'shield' && entry.part).map((entry) => entry.part);
    const weapons = core.filter((entry) => entry.slot.category === 'weapon' && entry.part).map((entry) => entry.part);
    const nonHull = core.filter((entry) => entry.part).map((entry) => entry.part);
    DECOR_SLOTS.forEach((slot) => {
      const part = partInSlot(build, slot.id);
      if (part) nonHull.push(part);
    });

    const engineThrust = engines.reduce((sum, part) => sum + part.thrust, 0);
    const hullWeight = hull.weight;
    const otherWeight = nonHull.reduce((sum, part) => sum + part.weight, 0);
    const denominator = hullWeight + otherWeight * formula.otherWeight;
    const propulsionRaw = denominator > 0 ? (engineThrust * formula.thrustScale) / denominator : 0;
    const propulsion = clamp(propulsionRaw, 0, caps.propulsion);
    const defense = hull.armor * formula.hullArmor
      + shields.reduce((sum, part) => sum + part.defense, 0) * formula.shield;
    const energy = [hull, ...nonHull].reduce((sum, part) => sum + part.energy, 0);
    const firepower = weapons.reduce((sum, part) => sum + part.firepower, 0) * formula.weapon
      + engineThrust * formula.engineFirepower;
    const weights = CONFIG.performance.weights;
    const score = propulsion * weights.propulsion
      + defense * weights.defense
      + firepower * weights.firepower
      + (CONFIG.performance.energyLimit - energy) * weights.energyHeadroom;
    const emptyCore = CORE_SLOTS.filter((slot) => !partInSlot(build, slot.id)).length;
    const emptyDecor = DECOR_SLOTS.filter((slot) => !partInSlot(build, slot.id)).length;
    const rating = CONFIG.performance.ratings.find((entry) => score >= entry.min) || CONFIG.performance.ratings.at(-1);
    return {
      hull,
      propulsion: round1(propulsion),
      defense: round1(defense),
      energy: round1(energy),
      firepower: round1(firepower),
      score: round1(score),
      rating: rating.label,
      emptyCore,
      emptyDecor,
      engineThrust: round1(engineThrust),
      counts: {
        engines: engines.length,
        shields: shields.length,
        weapons: weapons.length,
        decor: DECOR_COUNT - emptyDecor,
      },
      overload: energy > CONFIG.performance.energyLimit,
      lightspeed: propulsion >= CONFIG.performance.lightspeedThreshold,
    };
  }

  function commentaryFor(stats) {
    if (stats.overload) return '能量超载：火力与风险一起拉满，先减一件武器。';
    if (stats.emptyCore > 2) return '试验型空壳：先把关键槽位装满，再谈光速。';
    if (stats.propulsion >= 100 && stats.defense < 45) return '高速侦察型：跑得快，扛不住。';
    if (stats.defense >= 70) return '重装护航型：很难被打穿，也很难追上别人。';
    if (stats.firepower >= 70) return '重火力突击型：一轮齐射，决定胜负。';
    if (stats.propulsion >= 100) return '光速突击型：推进效率已越过阈值，火力和速度都在线。';
    if (stats.emptyCore === 0 && stats.score >= 85) return '旗舰级配置：没有短板，只有预算问题。';
    if (stats.emptyCore === 0) return '均衡巡航型：每个槽位都在工作，稳定就是答案。';
    return '开放式方案：还有空槽，装上能更强。';
  }

  const REFIT_LABELS = {
    propulsion: '推进',
    defense: '防御',
    firepower: '火力',
    energy: '能耗',
  };

  function refitVerdict(previous, next) {
    const speed = next.propulsion - previous.propulsion;
    const armor = next.defense - previous.defense;
    const guns = next.firepower - previous.firepower;
    const draw = next.energy - previous.energy;
    if (draw > 4) return '能量负担上升，续航会变紧。';
    if (speed > 3 && armor < -2) return '更快，但更考验走位。';
    if (armor > 3 && speed < -2) return '更稳，但速度让位。';
    if (guns > 3) return '火力上去了，注意武器温度。';
    if (armor > 3) return '防线更扎实，适合硬闯。';
    if (speed > 3) return '机动性提升，适合快速接敌。';
    return '配置已更新，平衡维持。';
  }

  function showRefitDelta(previous, next) {
    const panel = $('#refit-delta');
    const values = $('.refit-delta__values');
    const verdict = $('.refit-delta__verdict');
    if (!panel || !values || !verdict) return;

    const changes = ['propulsion', 'defense', 'firepower', 'energy']
      .map((key) => ({ key, delta: next[key] - previous[key] }))
      .filter((entry) => Math.abs(entry.delta) >= 0.05)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 2);

    if (!changes.length) return;
    values.replaceChildren();
    changes.forEach(({ key, delta }) => {
      const item = document.createElement('span');
      const good = key === 'energy' ? delta < 0 : delta > 0;
      item.className = good ? 'is-up' : 'is-down';
      item.textContent = `${REFIT_LABELS[key]} ${delta > 0 ? '+' : ''}${round1(delta)}`;
      values.append(item);
    });
    verdict.textContent = refitVerdict(previous, next);
    panel.classList.add('is-visible');
    window.clearTimeout(refitTimer);
    refitTimer = window.setTimeout(() => panel.classList.remove('is-visible'), 3600);
  }

  function updateRefitAdvice(stats) {
    const advice = $('#refit-advice');
    if (!advice) return;
    if (stats.overload) {
      advice.textContent = '建议 · 先卸下高能耗武器，解除能量超载。';
      return;
    }
    if (stats.emptyCore > 0) {
      advice.textContent = `建议 · 补齐 ${stats.emptyCore} 个核心槽位，别让空槽拖低总评。`;
      return;
    }
    const weakest = [
      { label: '推进', value: stats.propulsion / 120 },
      { label: '防御', value: stats.defense / 120 },
      { label: '火力', value: stats.firepower / 120 },
      { label: '能量余量', value: (100 - stats.energy) / 100 },
    ].sort((a, b) => a.value - b.value)[0];
    advice.textContent = `建议 · 当前最短板是${weakest.label}，下一次改装优先补它。`;
  }

  function updateStatsUI(flash = false) {
    const previous = previousStats;
    statsCache = computeStats(state);
    const stats = statsCache;
    const perf = CONFIG.performance;
    const statIDs = ['propulsion', 'defense', 'energy', 'firepower'];
    const maxValues = {
      propulsion: perf.caps.propulsion,
      defense: perf.caps.defense,
      energy: perf.energyLimit,
      firepower: perf.caps.firepower,
    };
    statIDs.forEach((key) => {
      const value = stats[key];
      const valueNode = $(`#stat-${key}`);
      const barNode = $(`#bar-${key}`);
      if (valueNode) valueNode.textContent = value.toFixed(key === 'propulsion' || key === 'defense' || key === 'firepower' ? 0 : 0);
      if (barNode) {
        const width = clamp((value / maxValues[key]) * 100, 0, 100);
        barNode.style.width = `${width}%`;
      }
    });

    const energyItem = $('.stat-item[data-stat="energy"]');
    const energyWarning = $('#energy-warning');
    if (energyItem) energyItem.classList.toggle('is-overload', stats.overload);
    if (energyWarning) {
      energyWarning.hidden = !stats.overload;
      energyWarning.textContent = '能量超载，建议减少武器';
    }
    const energyHint = $('#hint-energy');
    if (energyHint) {
      energyHint.textContent = stats.overload
        ? `已超出 ${round1(stats.energy - perf.energyLimit)} · 能量上限 ${perf.energyLimit}`
        : `余量 ${round1(perf.energyLimit - stats.energy)} / ${perf.energyLimit}`;
    }

    const scoreNode = $('#score-value');
    if (scoreNode) scoreNode.textContent = stats.score.toFixed(1);
    const ratingNode = $('#rating-letter');
    if (ratingNode) {
      ratingNode.textContent = stats.rating;
      ratingNode.className = `rating-letter grade-${stats.rating}`;
    }
    const archetypeNode = $('#archetype');
    if (archetypeNode) archetypeNode.textContent = commentaryFor(stats);

    const speedChip = $('#speed-chip');
    if (speedChip) {
      speedChip.classList.toggle('is-ready', stats.lightspeed);
      speedChip.textContent = stats.lightspeed ? '可进入光速状态' : stats.propulsion >= 80 ? '接近光速阈值' : '常规巡航状态';
    }

    const hintPropulsion = $('#hint-propulsion');
    if (hintPropulsion) {
      hintPropulsion.textContent = stats.lightspeed
        ? `光速包络稳定 · ${stats.propulsion.toFixed(0)} / ${perf.caps.propulsion}`
        : `距离 100 还有 ${round1(Math.max(0, 100 - stats.propulsion))} · 上限 120`;
    }

    const emptyWarning = $('#empty-warning');
    if (emptyWarning) {
      if (stats.emptyCore > 0) {
        emptyWarning.textContent = `还有 ${stats.emptyCore} 个关键槽位空着，装上能更强。`;
        emptyWarning.classList.remove('is-good');
      } else if (stats.emptyDecor > 0) {
        emptyWarning.textContent = `关键槽位已满 · 装饰矩阵还有 ${stats.emptyDecor} 个空位。`;
        emptyWarning.classList.add('is-good');
      } else {
        emptyWarning.textContent = '62 个槽位全部装满 · 舰体进入战备状态。';
        emptyWarning.classList.add('is-good');
      }
    }

    const launchMeta = $('#launch-button-meta');
    if (launchMeta) launchMeta.textContent = `推进效率 ${stats.propulsion.toFixed(0)} / 100 · 综合 ${stats.rating}`;
    const launchButton = $('#btn-launch');
    if (launchButton) launchButton.classList.toggle('is-ready', stats.lightspeed);

    const coreFilled = CORE_SLOTS.filter((slot) => partInSlot(state, slot.id)).length;
    const coreCount = $('#core-filled');
    if (coreCount) coreCount.textContent = String(coreFilled);
    const decorCount = $('#decor-filled');
    if (decorCount) decorCount.textContent = String(DECOR_COUNT - stats.emptyDecor);
    if (hangarCount()) hangarCount().textContent = String(builds.length);

    if (flash) {
      const telemetry = $('#telemetry');
      if (telemetry) {
        telemetry.classList.remove('is-flashing');
        void telemetry.offsetWidth;
        telemetry.classList.add('is-flashing');
        window.clearTimeout(flashTimer);
        flashTimer = window.setTimeout(() => telemetry.classList.remove('is-flashing'), 380);
      }
    }
    markHullCard();
    updateRefitAdvice(stats);
    if (flash && previous) showRefitDelta(previous, stats);
    previousStats = stats;
  }

  /* ------------------------------------------------------------------ */
  /* 7. Rendering: parts library, slots, decor                           */
  /* ------------------------------------------------------------------ */

  function hangarCount() { return $('#hangar-count'); }

  const SVG_CYAN = '#6ce7ff';
  const SVG_AMBER = '#ffb466';
  const SVG_STEEL = '#b8c8cf';
  const SVG_DARK = '#0a141d';
  const SVG_PANEL = '#273a46';

  function partSvg(part) {
    const variant = Math.abs(hashText(part.id)) % 5;
    let art = '';
    if (part.category === 'hull') {
      art = `
        <path d="M60 9 86 39 80 61 60 69 40 61 34 39Z" fill="#304451" stroke="${SVG_STEEL}" stroke-opacity=".45"/>
        <path d="M60 13 78 40 73 57 60 63 47 57 42 40Z" fill="${SVG_DARK}" stroke="${SVG_CYAN}" stroke-opacity=".36"/>
        <path d="M42 43 18 55 29 61 50 53M78 43 102 55 91 61 70 53" fill="${SVG_PANEL}" stroke="${SVG_CYAN}" stroke-opacity=".25"/>
        <path d="M60 18v38" stroke="${SVG_STEEL}" stroke-opacity=".38"/>
        <path d="M49 38h22" stroke="${SVG_AMBER}" stroke-opacity=".6"/>
        <circle cx="60" cy="34" r="4" fill="#06121a" stroke="${SVG_CYAN}" stroke-opacity=".7"/>
      `;
    } else if (part.category === 'engine') {
      art = `
        <rect x="35" y="17" width="${18 + variant * 3}" height="39" rx="8" fill="${SVG_PANEL}" stroke="${SVG_STEEL}" stroke-opacity=".45"/>
        <rect x="67" y="17" width="${18 + variant * 3}" height="39" rx="8" fill="${SVG_PANEL}" stroke="${SVG_STEEL}" stroke-opacity=".45"/>
        <rect x="39" y="22" width="${10 + variant * 3}" height="12" rx="3" fill="#0b1820" stroke="${SVG_CYAN}" stroke-opacity=".28"/>
        <rect x="71" y="22" width="${10 + variant * 3}" height="12" rx="3" fill="#0b1820" stroke="${SVG_CYAN}" stroke-opacity=".28"/>
        <circle cx="44" cy="52" r="${7 + variant}" fill="${SVG_AMBER}" fill-opacity=".18" stroke="${SVG_AMBER}" stroke-opacity=".7"/>
        <circle cx="76" cy="52" r="${7 + variant}" fill="${SVG_AMBER}" fill-opacity=".18" stroke="${SVG_AMBER}" stroke-opacity=".7"/>
        <path d="M39 58h10M71 58h10" stroke="${SVG_AMBER}" stroke-width="2" stroke-opacity=".6"/>
      `;
    } else if (part.category === 'shield') {
      art = `
        <path d="M60 12 90 25v22c0 9-12 15-30 17-18-2-30-8-30-17V25Z" fill="none" stroke="${SVG_CYAN}" stroke-opacity=".55"/>
        <path d="M60 20 82 29v16c0 6-8 10-22 13-14-3-22-7-22-13V29Z" fill="${SVG_CYAN}" fill-opacity=".045" stroke="${SVG_CYAN}" stroke-opacity=".25"/>
        <path d="M46 34 54 42 76 26" fill="none" stroke="${SVG_AMBER}" stroke-opacity=".55"/>
        <circle cx="60" cy="46" r="2" fill="${SVG_CYAN}"/>
      `;
    } else if (part.category === 'weapon') {
      art = `
        <path d="M18 20h40l${10 + variant * 3} 16-${10 + variant * 3} 16H18Z" fill="${SVG_PANEL}" stroke="${SVG_STEEL}" stroke-opacity=".45"/>
        <rect x="54" y="32" width="${34 + variant * 4}" height="8" rx="3" fill="#0b1820" stroke="${SVG_CYAN}" stroke-opacity=".38"/>
        <path d="M39 28h16M39 44h16M25 28v16" stroke="${SVG_AMBER}" stroke-opacity=".6"/>
        <path d="M84 36h8" stroke="${SVG_AMBER}" stroke-opacity=".85"/>
        <circle cx="34" cy="36" r="4" fill="#06121a" stroke="${SVG_CYAN}" stroke-opacity=".4"/>
      `;
    } else if (part.category === 'cockpit') {
      art = `
        <path d="M24 54 31 29c5-15 15-23 29-23s24 8 29 23l7 25Z" fill="${SVG_PANEL}" stroke="${SVG_STEEL}" stroke-opacity=".45"/>
        <path d="M38 52 42 33c4-9 10-14 18-14s14 5 18 14l4 19Z" fill="#07151e" stroke="${SVG_CYAN}" stroke-opacity=".45"/>
        <path d="M47 37h26M60 19v31" stroke="${SVG_CYAN}" stroke-opacity=".25"/>
        <path d="M45 52h30" stroke="${SVG_AMBER}" stroke-opacity=".55"/>
      `;
    } else if (part.category === 'tail') {
      art = `
        <path d="M60 12 80 54 60 65 40 54Z" fill="${SVG_PANEL}" stroke="${SVG_STEEL}" stroke-opacity=".45"/>
        <path d="M60 20 70 49 60 56 50 49Z" fill="${SVG_DARK}" stroke="${SVG_CYAN}" stroke-opacity=".35"/>
        <path d="M33 56 45 46M87 56 75 46" stroke="${SVG_AMBER}" stroke-opacity=".65"/>
        <path d="M54 63h12" stroke="${SVG_CYAN}" stroke-opacity=".55"/>
      `;
    } else {
      const icons = [
        `<path d="M60 14 64 34 84 38 67 46 60 66 53 46 36 38 56 34Z" fill="none" stroke="${SVG_CYAN}" stroke-opacity=".55"/><circle cx="60" cy="39" r="4" fill="${SVG_AMBER}" fill-opacity=".7"/>`,
        `<path d="M38 55 60 18 82 55M60 18v33" fill="none" stroke="${SVG_CYAN}" stroke-opacity=".45"/><circle cx="60" cy="18" r="3" fill="${SVG_AMBER}"/>`,
        `<rect x="39" y="23" width="42" height="28" rx="4" fill="${SVG_PANEL}" stroke="${SVG_CYAN}" stroke-opacity=".3"/><path d="M46 30h28M46 37h20M46 44h24" stroke="${SVG_AMBER}" stroke-opacity=".5"/>`,
        `<path d="M44 20 60 33 76 20M60 33v24M42 57h36" fill="none" stroke="${SVG_CYAN}" stroke-opacity=".5"/><circle cx="60" cy="33" r="3" fill="${SVG_AMBER}"/>`,
        `<circle cx="60" cy="37" r="19" fill="none" stroke="${SVG_CYAN}" stroke-opacity=".3"/><circle cx="60" cy="37" r="10" fill="none" stroke="${SVG_STEEL}" stroke-opacity=".35"/><path d="M60 18v38M41 37h38" stroke="${SVG_AMBER}" stroke-opacity=".45"/>`,
      ];
      art = icons[variant % icons.length];
    }

    return `<svg viewBox="0 0 120 72" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect width="120" height="72" fill="#061018"/>
      <path d="M0 18h120M0 36h120M0 54h120M24 0v72M48 0v72M72 0v72M96 0v72" stroke="${SVG_CYAN}" stroke-opacity=".045"/>
      ${art}
      <text x="8" y="66" fill="${SVG_CYAN}" fill-opacity=".38" font-size="4" font-family="monospace" letter-spacing="1">${part.mk || 'NX'}</text>
    </svg>`;
  }

  function hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash) + text.charCodeAt(i);
    return hash;
  }

  function partCardMarkup(part) {
    const isHull = part.category === 'hull';
    const unlocked = isUnlocked(part.id);
    const price = priceOf(part.id) || 0;
    const priceLabel = unlocked ? '已解锁' : `锁定 · ${formatCredits(price)} CR`;
    return `<div class="part-card${unlocked ? '' : ' is-locked'}" role="button" tabindex="0" draggable="false" data-part-id="${part.id}" data-category="${part.category}" data-locked="${unlocked ? '0' : '1'}" aria-label="${unlocked ? '装配' : '解锁'} ${escapeHTML(part.name)}">
      <div class="part-thumb">${partSvg(part)}</div>
      <div class="part-info">
        <div class="part-title-row"><span class="part-title">${escapeHTML(part.name)}</span><span class="part-mk">${escapeHTML(part.mk || '')}</span></div>
        <div class="part-sub">${escapeHTML(part.en)} · WT ${part.weight.toFixed(1)}</div>
        <div class="part-stats">
          <span><i>推</i><b>${part.thrust}</b></span>
          <span><i>防</i><b>${part.defense}</b></span>
          <span><i>耗</i><b>${part.energy}</b></span>
        </div>
      </div>
      <span class="part-price${unlocked ? ' is-owned' : ''}">${priceLabel}</span>
      ${isHull && state.hullId === part.id ? '<span class="part-current">CURRENT</span>' : ''}
    </div>`;
  }

  function renderLibrary() {
    const list = $('#library-list');
    if (!list) return;
    list.innerHTML = CATEGORIES.map((category) => {
      const parts = PARTS_BY_CATEGORY.get(category.id) || [];
      return `<details class="part-group" data-group="${category.id}" ${category.open ? 'open' : ''}>
        <summary>
          <span class="category-glyph">${category.glyph}</span>
          <span class="category-label">${category.label}</span>
          <span class="category-count">${parts.filter((item) => isUnlocked(item.id)).length} / ${parts.length}</span>
        </summary>
        <div class="part-grid">${parts.map(partCardMarkup).join('')}</div>
      </details>`;
    }).join('');
    const partCount = $('#part-count');
    if (partCount) partCount.textContent = `${PARTS.length} PARTS`;
    const libraryFoot = $('.library-foot');
    if (libraryFoot) libraryFoot.firstElementChild.textContent = `已解锁 ${PARTS.filter((item) => isUnlocked(item.id)).length} / ${PARTS.length} 个零件`;
    updateCreditsChip();
  }

  function slotMarkup(slot, index) {
    const part = partInSlot(state, slot.id);
    const category = CATEGORY_BY_ID.get(slot.category);
    const filled = Boolean(part);
    const style = `left:${slot.x}%;top:${slot.y}%`;
    if (filled) {
      return `<button type="button" class="slot is-filled" data-slot-id="${slot.id}" data-category="${slot.category}" style="${style}" aria-label="${escapeHTML(slot.label)} 已装 ${escapeHTML(part.name)}，点击更换">
        <span class="slot-top"><span class="slot-no">${String(index + 1).padStart(2, '0')}</span><span class="slot-cat">${category.en}</span></span>
        <span class="slot-main">
          <span class="slot-icon">${partSvg(part)}</span>
          <span class="slot-copy"><span class="slot-name">${escapeHTML(part.name)}</span><span class="slot-stats">推${part.thrust} · 防${part.defense} · 耗${part.energy}</span></span>
        </span>
      </button>`;
    }
    return `<button type="button" class="slot" data-slot-id="${slot.id}" data-category="${slot.category}" style="${style}" aria-label="${escapeHTML(slot.label)} 空槽，点击选择零件">
      <span class="slot-top"><span class="slot-no">${String(index + 1).padStart(2, '0')}</span><span class="slot-cat">${category.en}</span></span>
      <span class="slot-empty-copy"><b>${escapeHTML(slot.label)}</b>拖拽或点击安装</span>
    </button>`;
  }

  function renderSlots(changedSlot = null) {
    const container = $('#functional-slots');
    if (!container) return;
    container.innerHTML = CORE_SLOTS.map((slot, index) => slotMarkup(slot, index)).join('');
    if (changedSlot) {
      const el = container.querySelector(`[data-slot-id="${changedSlot}"]`);
      if (el) el.classList.add('just-installed');
    }
  }

  function renderDecor(changedSlot = null) {
    const grid = $('#decor-grid');
    if (!grid) return;
    grid.innerHTML = DECOR_SLOTS.map((slot) => {
      const part = partInSlot(state, slot.id);
      if (!part) {
        return `<button type="button" class="decor-cell" data-slot-id="${slot.id}" data-category="decor" title="${escapeHTML(slot.label)} · 空" aria-label="${escapeHTML(slot.label)} 空槽"><span class="decor-plus">+</span></button>`;
      }
      return `<button type="button" class="decor-cell is-filled" data-slot-id="${slot.id}" data-category="decor" title="${escapeHTML(part.name)} · ${escapeHTML(slot.label)}" aria-label="${escapeHTML(slot.label)} 已装 ${escapeHTML(part.name)}">${partSvg(part)}</button>`;
    }).join('');
    if (changedSlot) {
      const el = grid.querySelector(`[data-slot-id="${changedSlot}"]`);
      if (el) el.classList.add('just-installed');
    }
    const count = $('#decor-filled');
    if (count) count.textContent = String(DECOR_COUNT - computeStats(state).emptyDecor);
  }

  function markHullCard() {
    $$('.part-card[data-category="hull"]').forEach((card) => {
      const current = card.dataset.partId === state.hullId;
      card.classList.toggle('is-equipped', current);
      let badge = card.querySelector('.part-current');
      if (current && !badge) {
        badge = document.createElement('span');
        badge.className = 'part-current';
        badge.textContent = 'CURRENT';
        card.appendChild(badge);
      } else if (!current && badge) {
        badge.remove();
      }
    });
  }

  function updateHullDisplay() {
    const hull = hullForBuild(state);
    const name = $('#hull-name');
    const spec = $('#hull-spec');
    if (name) name.textContent = hull.name;
    if (spec) spec.textContent = `WT ${hull.weight.toFixed(1)} / ARMOR ${hull.armor} / ENERGY ${hull.energy}`;
  }

  function renderAll(flash = false, changedSlot = null) {
    renderSlots(changedSlot && changedSlot.startsWith('decor') ? null : changedSlot);
    renderDecor(changedSlot && changedSlot.startsWith('decor') ? changedSlot : null);
    updateHullDisplay();
    updateStatsUI(flash);
    saveDraft();
    try {
      window.dispatchEvent(new CustomEvent('shipyard:state', {
        detail: JSON.parse(JSON.stringify(currentSnapshot())),
      }));
    } catch (error) {
      /* The 2D interface must keep working even if a scene listener throws. */
    }
  }

  /* ------------------------------------------------------------------ */
  /* 8. Feedback, modal and drawer helpers                               */
  /* ------------------------------------------------------------------ */

  function showToast(message, tone = 'info') {
    const stack = $('#toast-stack');
    if (!stack) return;
    const toast = document.createElement('div');
    toast.className = `toast${tone === 'warning' ? ' is-warning' : ''}`;
    const mark = document.createElement('span');
    mark.className = 'toast-mark';
    mark.textContent = tone === 'warning' ? '!' : '//';
    const copy = document.createElement('span');
    copy.textContent = message;
    toast.append(mark, copy);
    stack.appendChild(toast);
    while (stack.children.length > 4) stack.firstElementChild.remove();
    window.setTimeout(() => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 260);
    }, tone === 'warning' ? 3900 : 2600);
  }

  function syncBodyLock() {
    const locked = Boolean(
      document.querySelector('.screen-overlay.is-open')
      || document.querySelector('.modal-layer.is-open')
      || document.querySelector('.launch-overlay.is-active')
      || document.querySelector('.library.is-open'),
    );
    document.body.classList.toggle('has-overlay', locked);
  }

  function showModal(html, options = {}) {
    const layer = $('#modal-layer');
    if (!layer) return () => {};
    if (activeModal) activeModal.close(null);
    layer.innerHTML = html;
    layer.classList.add('is-open');
    layer.setAttribute('aria-hidden', 'false');
    syncBodyLock();

    let closed = false;
    const close = (value) => {
      if (closed) return;
      closed = true;
      activeModal = null;
      layer.classList.remove('is-open');
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = '';
      syncBodyLock();
      if (typeof options.onClose === 'function') options.onClose(value);
    };
    activeModal = { close };
    layer.onclick = (event) => {
      if (event.target === layer) close(null);
    };
    $$('[data-modal-close]', layer).forEach((button) => {
      button.addEventListener('click', () => close(null));
    });
    window.requestAnimationFrame(() => {
      const focusTarget = layer.querySelector('input, button, [href], select, textarea');
      if (focusTarget) focusTarget.focus();
    });
    return close;
  }

  function askName(options = {}) {
    const {
      title = '保存方案',
      label = '方案名称',
      value = '',
      confirmLabel = '保存',
      hint = '最多 48 个字符。保存后写入当前浏览器。',
    } = options;
    return new Promise((resolve) => {
      let settled = false;
      let close = null;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (close) close(result);
        resolve(result);
      };
      close = showModal(`<div class="modal-card">
        <div class="modal-head">
          <div><span class="kicker">SAVE LOADOUT / LOCAL</span><h2>${escapeHTML(title)}</h2></div>
          <button type="button" class="icon-btn" data-modal-close aria-label="关闭">×</button>
        </div>
        <div class="modal-body">
          <label class="field-label" for="modal-name">${escapeHTML(label)}</label>
          <input id="modal-name" class="text-input" type="text" maxlength="48" autocomplete="off" value="${escapeHTML(value)}" placeholder="例如：远望号">
          <p class="modal-copy" style="margin-top:10px;margin-bottom:0">${escapeHTML(hint)}</p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-modal-close>取消</button>
          <button id="modal-ok" type="button" class="btn btn-primary">${escapeHTML(confirmLabel)}</button>
        </div>
      </div>`, {
        onClose: () => {
          if (!settled) {
            settled = true;
            resolve(null);
          }
        },
      });

      const input = $('#modal-name');
      const ok = $('#modal-ok');
      const submit = () => {
        if (settled) return;
        const name = input ? input.value.trim().replace(/\s+/g, ' ') : '';
        if (!name) {
          if (input) input.focus();
          showToast('给飞船起一个名字。', 'warning');
          return;
        }
        finish(name.slice(0, 48));
      };
      if (input) {
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
        });
      }
      if (ok) ok.addEventListener('click', submit);
    });
  }

  function showConfirm(options = {}) {
    const {
      title = '确认操作',
      message = '',
      confirmLabel = '确认',
      cancelLabel = '取消',
      danger = false,
    } = options;
    return new Promise((resolve) => {
      let settled = false;
      let close = null;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (close) close(result);
        resolve(result);
      };
      close = showModal(`<div class="modal-card">
        <div class="modal-head">
          <div><span class="kicker">CONFIRM / LOCAL ACTION</span><h2>${escapeHTML(title)}</h2></div>
          <button type="button" class="icon-btn" data-modal-close aria-label="关闭">×</button>
        </div>
        <div class="modal-body"><p class="modal-copy" style="margin:0">${escapeHTML(message)}</p></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-modal-close>${escapeHTML(cancelLabel)}</button>
          <button id="confirm-ok" type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${escapeHTML(confirmLabel)}</button>
        </div>
      </div>`, {
        onClose: () => {
          if (!settled) {
            settled = true;
            resolve(false);
          }
        },
      });
      const ok = $('#confirm-ok');
      if (ok) ok.addEventListener('click', () => finish(true));
    });
  }

  function closeActiveModal() {
    if (activeModal) activeModal.close(null);
  }

  function isMobile() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function openDrawer() {
    const library = $('#library');
    const backdrop = $('#drawer-backdrop');
    if (!library) return;
    library.classList.add('is-open');
    if (backdrop) backdrop.classList.add('is-visible');
    syncBodyLock();
  }

  function closeDrawer() {
    const library = $('#library');
    const backdrop = $('#drawer-backdrop');
    if (!library) return;
    library.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-visible');
    syncBodyLock();
  }

  /* ------------------------------------------------------------------ */
  /* 9. Assembly interactions                                            */
  /* ------------------------------------------------------------------ */

  function canDrop(partId, category) {
    const part = PART_BY_ID.get(partId);
    return Boolean(part && part.category === category);
  }

  function markModified() {
    if (currentBuildId) currentBuildId = null;
  }

  function findFirstEmpty(category) {
    const target = CORE_SLOTS.find((slot) => slot.category === category && !partInSlot(state, slot.id));
    return target || null;
  }

  function findFirstEmptyDecor() {
    return DECOR_SLOTS.find((slot) => !partInSlot(state, slot.id)) || null;
  }

  function installPart(partId) {
    const part = PART_BY_ID.get(partId);
    if (!part) return;
    if (!isUnlocked(part.id)) { openUnlock(part.id); return; }
    if (part.category === 'hull') {
      if (state.hullId === part.id) {
        showToast('这已经是当前船体。', 'warning');
        return;
      }
      state.hullId = part.id;
      markModified();
      renderAll(true);
      showToast(`船体更换为 ${part.name}。`);
      if (isMobile()) closeDrawer();
      return;
    }

    let slot = null;
    if (part.category === 'decor') {
      slot = findFirstEmptyDecor();
      if (!slot) {
        showToast('装饰矩阵已满，右键一个装饰格空出位置。', 'warning');
        return;
      }
    } else {
      slot = findFirstEmpty(part.category);
      if (!slot) {
        const label = CATEGORY_BY_ID.get(part.category)?.label || '该类别';
        showToast(`${label}槽位已满，点击槽位可替换。`, 'warning');
        return;
      }
    }
    installIntoSlot(slot.id, part.id);
  }

  function installIntoSlot(slotId, partId) {
    const slot = SLOT_BY_ID.get(slotId);
    const part = PART_BY_ID.get(partId);
    if (!slot || !part || slot.category !== part.category) {
      showToast('这个零件不能装进该槽位。', 'warning');
      return;
    }
    if (!isUnlocked(part.id)) { openUnlock(part.id); return; }
    if (partInSlot(state, slotId)?.id === part.id) {
      showToast('这个零件已经在该槽位。', 'warning');
      return;
    }
    state.slots[slotId] = part.id;
    markModified();
    renderAll(true, slotId);
    showToast(`${part.name} 已安装。`);
    if (isMobile()) closeDrawer();
  }

  function removeSlot(slotId) {
    const slot = SLOT_BY_ID.get(slotId);
    if (!slot) return;
    const part = partInSlot(state, slotId);
    if (!part) return;
    state.slots[slotId] = null;
    markModified();
    renderAll(true, slotId);
    showToast(`已移除 ${part.name}。`);
  }

  function openSlotPicker(slotId) {
    const slot = SLOT_BY_ID.get(slotId);
    if (!slot) return;
    const current = partInSlot(state, slotId);
    const parts = PARTS_BY_CATEGORY.get(slot.category) || [];
    const category = CATEGORY_BY_ID.get(slot.category);
    let close = null;
    close = showModal(`<div class="modal-card modal-card--wide">
      <div class="modal-head">
        <div><span class="kicker">SLOT CONFIG / ${escapeHTML(category.en)}</span><h2>${escapeHTML(slot.label)}</h2></div>
        <button type="button" class="icon-btn" data-modal-close aria-label="关闭">×</button>
      </div>
      <div class="modal-body">
        <p class="modal-copy">${current ? `当前：${escapeHTML(current.name)}。选择一个零件替换，或移除当前零件。` : '选择一个兼容零件装入该槽位。'}</p>
        <div class="picker-grid">
          ${parts.map((part) => {
            const unlocked = isUnlocked(part.id);
            const price = priceOf(part.id) || 0;
            return `<button type="button" class="picker-part${current && current.id === part.id ? ' is-current' : ''}${unlocked ? '' : ' is-locked'}" data-pick-id="${part.id}" data-locked="${unlocked ? '0' : '1'}">
            <span class="picker-thumb">${partSvg(part)}</span>
            <span class="picker-copy"><span class="picker-name">${escapeHTML(part.name)}</span><span class="picker-stats">推 ${part.thrust} · 防 ${part.defense} · 耗 ${part.energy} · WT ${part.weight.toFixed(1)}</span></span>
            <span class="picker-price">${unlocked ? '已解锁' : `${formatCredits(price)} CR`}</span>
          </button>`;
          }).join('') || '<div class="picker-empty">这个槽位暂无可用零件。</div>'}
        </div>
      </div>
      <div class="modal-foot">
        ${current ? '<button id="picker-remove" type="button" class="btn btn-danger">移除零件</button>' : ''}
        <button type="button" class="btn btn-ghost" data-modal-close>关闭</button>
      </div>
    </div>`);

    const layer = $('#modal-layer');
    if (!layer) return;
    $$('[data-pick-id]', layer).forEach((button) => {
      button.addEventListener('click', () => {
        const partId = button.dataset.pickId;
        close(null);
        if (!isUnlocked(partId)) { openUnlock(partId); return; }
        installIntoSlot(slotId, partId);
      });
    });
    const remove = $('#picker-remove', layer);
    if (remove) {
      remove.addEventListener('click', () => {
        close(null);
        removeSlot(slotId);
      });
    }
  }

  function handleSlotClick(event) {
    const slot = event.target.closest('.slot');
    if (!slot || !event.currentTarget.contains(slot)) return;
    event.preventDefault();
    event.stopPropagation();
    openSlotPicker(slot.dataset.slotId);
  }

  function handleSlotContextMenu(event) {
    const slot = event.target.closest('.slot');
    if (!slot) return;
    event.preventDefault();
    event.stopPropagation();
    if (partInSlot(state, slot.dataset.slotId)) {
      removeSlot(slot.dataset.slotId);
    }
  }

  function handleDecorClick(event) {
    const cell = event.target.closest('.decor-cell');
    if (!cell) return;
    event.preventDefault();
    const current = partInSlot(state, cell.dataset.slotId);
    if (current) {
      removeSlot(cell.dataset.slotId);
      return;
    }
    openSlotPicker(cell.dataset.slotId);
  }

  function handleDecorContextMenu(event) {
    const cell = event.target.closest('.decor-cell');
    if (!cell) return;
    event.preventDefault();
    if (partInSlot(state, cell.dataset.slotId)) removeSlot(cell.dataset.slotId);
  }

  function clearDropHints() {
    $$('.is-dragover').forEach((element) => element.classList.remove('is-dragover'));
    const stage = $('#ship-drop');
    if (stage) stage.classList.remove('is-hull-over');
    if (dragTargetHalo) dragTargetHalo.classList.remove('is-visible');
    dragHoverElement = null;
  }

  function showDragTargetHalo(element) {
    if (!dragTargetHalo || !dragTargetHalo.isConnected) {
      dragTargetHalo = document.createElement('div');
      dragTargetHalo.className = 'drag-target-halo';
      dragTargetHalo.setAttribute('aria-hidden', 'true');
      document.body.appendChild(dragTargetHalo);
    }
    const rect = element.getBoundingClientRect();
    const pad = element.id === 'ship-drop' ? 2 : 3;
    dragTargetHalo.style.left = `${rect.left - pad}px`;
    dragTargetHalo.style.top = `${rect.top - pad}px`;
    dragTargetHalo.style.width = `${rect.width + pad * 2}px`;
    dragTargetHalo.style.height = `${rect.height + pad * 2}px`;
    dragTargetHalo.classList.toggle('is-wide', element.id === 'ship-drop');
    dragTargetHalo.classList.add('is-visible');
  }

  /* Pointer-based part drag. Native HTML5 drag has no hover ghost on all
     platforms and cannot animate a return, so cards use a real follow
     ghost while slot clicks stay available for keyboard and touch. */

  function dragCategoryLabel(categoryId) {
    return CATEGORY_BY_ID.get(categoryId)?.label || '该类别';
  }

  function makePartDragGhost(card) {
    const ghost = card.cloneNode(true);
    ghost.classList.remove('is-equipped', 'is-dragging', 'is-drag-source');
    ghost.classList.add('part-drag-ghost');
    ghost.removeAttribute('draggable');
    ghost.removeAttribute('tabindex');
    ghost.removeAttribute('role');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.pointerEvents = 'none';
    const rect = card.getBoundingClientRect();
    ghost.style.width = `${Math.min(248, Math.max(190, rect.width))}px`;
    document.body.appendChild(ghost);
    return ghost;
  }

  function movePartDragGhost(ghost, x, y) {
    if (!ghost) return;
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
  }

  function findDropTargetAt(x, y, part) {
    const raw = document.elementFromPoint(x, y);
    if (!(raw instanceof Element)) return { kind: 'outside', valid: false };
    const slot = raw.closest('.slot');
    if (slot) {
      const category = slot.dataset.category;
      return { kind: 'slot', element: slot, category, valid: part.category === category };
    }
    const decor = raw.closest('.decor-cell');
    if (decor) {
      return { kind: 'decor', element: decor, category: 'decor', valid: part.category === 'decor' };
    }
    const stage = raw.closest('#ship-drop');
    if (stage) {
      return { kind: 'stage', element: stage, category: 'hull', valid: part.category === 'hull' };
    }
    return { kind: 'outside', valid: false };
  }

  function highlightDropTarget(target) {
    const next = target && target.valid ? target.element : null;
    if (next === dragHoverElement) return;
    clearDropHints();
    if (!next) return;
    dragHoverElement = next;
    if (target.kind === 'stage') next.classList.add('is-hull-over');
    else next.classList.add('is-dragover');
    showDragTargetHalo(next);
  }

  function returnPartDragGhost(ghost, card) {
    if (!ghost) return;
    const rect = card.getBoundingClientRect();
    ghost.classList.add('is-returning');
    ghost.style.left = `${rect.left + rect.width / 2}px`;
    ghost.style.top = `${rect.top + rect.height / 2}px`;
    ghost.style.transform = 'translate(-50%, -50%) scale(.82)';
    ghost.style.opacity = '0';
    window.setTimeout(() => ghost.remove(), 240);
  }

  function snapPartDragGhost(ghost, target) {
    if (!ghost) return;
    const rect = target.getBoundingClientRect();
    ghost.classList.add('is-snapping');
    ghost.style.left = `${rect.left + rect.width / 2}px`;
    ghost.style.top = `${rect.top + rect.height / 2}px`;
    ghost.style.transform = 'translate(-50%, -50%) scale(.52)';
    ghost.style.opacity = '0';
    window.setTimeout(() => ghost.remove(), 220);
  }

  function clearPointerDragVisuals(card) {
    if (card) card.classList.remove('is-drag-source');
    document.body.classList.remove('is-part-dragging');
    clearDropHints();
  }

  function finishPointerDrag(event, cancelled = false) {
    const drag = pointerDrag;
    if (!drag) return;
    pointerDrag = null;
    if (!drag.moved) return;
    if (event && typeof event.preventDefault === 'function') event.preventDefault();

    const library = $('#library-list');
    if (library) library.dataset.ignoreClickUntil = String(performance.now() + 500);
    clearPointerDragVisuals(drag.card);

    if (cancelled) {
      returnPartDragGhost(drag.ghost, drag.card);
      return;
    }

    const target = drag.target || { kind: 'outside', valid: false };
    if (target.valid) {
      snapPartDragGhost(drag.ghost, target.element);
      const partId = drag.part.id;
      const slotId = target.kind === 'stage' ? null : target.element.dataset.slotId;
      window.setTimeout(() => {
        if (target.kind === 'stage') installPart(partId);
        else if (slotId) installIntoSlot(slotId, partId);
      }, 140);
      return;
    }

    returnPartDragGhost(drag.ghost, drag.card);
    if (target.kind === 'slot' || target.kind === 'decor') {
      showToast(`该槽位只能装${dragCategoryLabel(target.category)}`, 'warning');
    } else if (target.kind === 'stage') {
      showToast('装配画布只接收船体', 'warning');
    } else {
      showToast('把零件拖到高亮的槽位里', 'warning');
    }
  }

  function beginPointerDrag(event) {
    const drag = pointerDrag;
    if (!drag) return;
    drag.moved = true;
    drag.ghost = makePartDragGhost(drag.card);
    drag.card.classList.add('is-drag-source');
    document.body.classList.add('is-part-dragging');
    movePartDragGhost(drag.ghost, event.clientX, event.clientY);
  }

  function handleLibraryPointerDown(event) {
    if (event.button !== 0 || event.pointerType === 'touch') return;
    if (pointerDrag || activeModal || launchActive) return;
    const card = event.target.closest('.part-card');
    if (!card) return;
    const part = PART_BY_ID.get(card.dataset.partId);
    if (!part) return;
    pointerDrag = {
      card,
      part,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      ghost: null,
      target: null,
    };
  }

  function handlePointerMove(event) {
    const drag = pointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
      beginPointerDrag(event);
    }
    if (!drag.moved) return;
    event.preventDefault();
    movePartDragGhost(drag.ghost, event.clientX, event.clientY);
    drag.target = findDropTargetAt(event.clientX, event.clientY, drag.part);
    highlightDropTarget(drag.target);
  }

  function handlePointerUp(event) {
    const drag = pointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      pointerDrag = null;
      return;
    }
    finishPointerDrag(event, false);
  }

  function handlePointerCancel(event) {
    const drag = pointerDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      pointerDrag = null;
      return;
    }
    finishPointerDrag(event, true);
  }

  function cancelPointerDragOnBlur() {
    const drag = pointerDrag;
    if (!drag) return;
    if (!drag.moved) {
      pointerDrag = null;
      return;
    }
    finishPointerDrag(null, true);
  }

  function hasContent() {
    return CORE_SLOTS.some((slot) => Boolean(partInSlot(state, slot.id)))
      || DECOR_SLOTS.some((slot) => Boolean(partInSlot(state, slot.id)));
  }

  const STARTER_KIT = {
    'engine-0': 'engine-ion', 'engine-1': 'engine-ion',
    'shield-0': 'shield-deflector', 'shield-1': 'shield-deflector',
    'weapon-0': 'weapon-pulse', 'weapon-1': 'weapon-pulse',
    cockpit: 'cockpit-solo', tail: 'tail-vector',
  };

  function applyStarterKit() {
    state.hullId = CONFIG.defaultHull;
    state.slots = emptySlots();
    Object.entries(STARTER_KIT).forEach(([slotId, partId]) => {
      if (SLOT_BY_ID.has(slotId)) state.slots[slotId] = partId;
    });
  }

  function stripLockedParts() {
    let changed = false;
    CORE_SLOTS.concat(DECOR_SLOTS).forEach((slot) => {
      const partId = state.slots[slot.id];
      if (partId && !isUnlocked(partId)) {
        state.slots[slot.id] = null;
        changed = true;
      }
    });
    if (!isUnlocked(state.hullId)) {
      state.hullId = CONFIG.defaultHull;
      changed = true;
    }
    return changed;
  }

  function openUnlock(partId) {
    const part = PART_BY_ID.get(partId);
    const p = profile();
    if (!part || !p) return;
    const price = priceOf(partId) || 0;
    const affordable = p.credits >= price;
    let close = null;
    close = showModal(`<div class="modal-card unlock-card">
      <div class="modal-head">
        <div><span class="kicker">RESEARCH UNLOCK / ${escapeHTML(part.en)}</span><h2>解锁 ${escapeHTML(part.name)}</h2></div>
        <button type="button" class="icon-btn" data-modal-close aria-label="关闭">×</button>
      </div>
      <div class="modal-body">
        <p class="modal-copy">${escapeHTML(part.description || '')}</p>
        <div class="unlock-rows">
          <div><span>解锁价格</span><b>${formatCredits(price)} CR</b></div>
          <div><span>当前积分</span><b>${formatCredits(p.credits)} CR</b></div>
          <div><span>解锁后余额</span><b>${formatCredits(Math.max(0, p.credits - price))} CR</b></div>
        </div>
        <p class="modal-copy modal-copy--hint">解锁后永久有效，可在任意装配方案中使用。积分来自巡航：击毁敌机、勘测星球与合约结算。</p>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-modal-close>再想想</button>
        <button id="unlock-ok" type="button" class="btn btn-primary" ${affordable ? '' : 'disabled'}>${affordable ? `解锁 · ${formatCredits(price)} CR` : '积分不足'}</button>
      </div>
    </div>`);
    const ok = $('#unlock-ok');
    if (ok && !ok.disabled) {
      ok.addEventListener('click', () => {
        const result = p.unlock(partId);
        if (!result.ok) {
          showToast(result.reason === 'INSUFFICIENT_CREDITS' ? '积分不足，先去完成一次巡航。' : '解锁失败，请重试。', 'warning');
          return;
        }
        close(null);
        updateCreditsChip();
        renderLibrary();
        renderAll(true);
        showToast(`${part.name} 已解锁，可直接装配。`);
      });
    }
  }

  function maybeOpenRepair() {
    const overlay = $('#repair-overlay');
    if (!overlay) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('return') !== '1') return;
    const p = profile();
    if (!p) return;
    const copy = $('#repair-copy');
    const hullValue = $('#repair-hull');
    const creditsValue = $('#repair-credits');
    const costValue = $('#repair-cost');
    const meter = $('#repair-meter-fill');
    const full = $('#btn-repair-full');
    const partial = $('#btn-repair-partial');
    const skip = $('#btn-repair-skip');
    const refresh = () => {
      const cost = p.repairCost();
      if (copy) copy.textContent = p.hull >= 100 ? '舰体完整，船坞已完成例行检查。' : '巡航结束，舰体存在结构损伤。维修需要消耗积分，也可以选择带伤出航。';
      if (hullValue) hullValue.textContent = `${Math.round(p.hull)}%`;
      if (creditsValue) creditsValue.textContent = `${formatCredits(p.credits)} CR`;
      if (costValue) costValue.textContent = `${formatCredits(cost)} CR`;
      if (meter) meter.style.width = `${Math.max(0, Math.min(100, p.hull))}%`;
      if (full) { full.disabled = p.credits < cost || p.hull >= 100; full.textContent = p.hull >= 100 ? '无需修复' : `全额修复 · ${formatCredits(cost)} CR`; }
      if (partial) { partial.disabled = p.hull >= 100; partial.textContent = `部分修复 · ${formatCredits(Math.max(40, Math.round(cost * 0.55)))} CR`; }
      if (skip) skip.disabled = p.hull >= 100;
    };
    const close = (silent) => {
      overlay.classList.add('is-hidden');
      window.history.replaceState({}, '', window.location.pathname);
      if (!silent) updateCreditsChip();
    };
    refresh();
    overlay.classList.remove('is-hidden');
    if (full) full.onclick = () => {
      const result = p.repair('full');
      if (!result.ok) { showToast('积分不足，可选择部分修复或带伤出航。', 'warning'); return; }
      showToast(result.cost ? `修复完成，扣除 ${formatCredits(result.cost)} CR。` : '舰体无需修复。');
      refresh();
      updateCreditsChip();
      if (p.hull >= 100) setTimeout(() => close(false), 420);
    };
    if (partial) partial.onclick = () => {
      const result = p.repair('partial');
      if (!result.ok) { showToast('积分不足。', 'warning'); return; }
      showToast(`部分修复完成，扣除 ${formatCredits(result.cost)} CR，舰体 ${Math.round(result.hull)}%。`);
      refresh();
      updateCreditsChip();
    };
    if (skip) skip.onclick = () => {
      p.repair('skip');
      showToast('已记录带伤出航，下一次巡航将继承当前舰体完整度。');
      close(false);
    };
  }

  function setStateBlank() {
    state = {
      hullId: CONFIG.defaultHull,
      slots: emptySlots(),
      name: '未命名方案',
    };
    currentBuildId = null;
    currentName = '未命名方案';
  }

  async function startNewBuild(skipConfirm = false) {
    if (!skipConfirm && hasContent()) {
      const confirmed = await showConfirm({
        title: '开始新的装配？',
        message: '当前方案会自动保存为草稿。开始新方案会清空现有槽位，但不会删除“我的飞船”里已保存的版本。',
        confirmLabel: '开始装配',
      });
      if (!confirmed) return;
    }
    setStateBlank();
    applyStarterKit();
    state.name = '新装配方案';
    currentName = state.name;
    renderAll();
    closeDrawer();
    showToast('新装配台已就绪，已装载首发基础套件。');
  }

  function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function randomShipName() {
    const prefixes = ['深空', '远望', '苍蓝', '孤星', '白昼', '弦月', '天穹', '无声'];
    const nouns = ['信使', '游隼', '长矛', '折光', '回声', '先驱', '蒲公英', '幽灵'];
    return `${pickRandom(prefixes)}${pickRandom(nouns)}`;
  }

  function randomizeBuild() {
    const hulls = (PARTS_BY_CATEGORY.get('hull') || []).filter((part) => isUnlocked(part.id));
    const slots = emptySlots();
    const hull = pickRandom(hulls) || PART_BY_ID.get(CONFIG.defaultHull);
    CORE_SLOTS.forEach((slot) => {
      const options = (PARTS_BY_CATEGORY.get(slot.category) || []).filter((part) => isUnlocked(part.id));
      if (options.length) slots[slot.id] = pickRandom(options).id;
    });
    const decor = (PARTS_BY_CATEGORY.get('decor') || []).filter((part) => isUnlocked(part.id));
    const decorCount = decor.length ? 3 + Math.floor(Math.random() * Math.min(15, DECOR_SLOTS.length - 2)) : 0;
    DECOR_SLOTS.slice(0, decorCount).forEach((slot) => {
      if (decor.length) slots[slot.id] = pickRandom(decor).id;
    });
    state = {
      hullId: hull.id,
      slots,
      name: randomShipName(),
    };
    currentBuildId = null;
    currentName = state.name;
    renderAll(true);
    closeDrawer();
    showToast(`随机方案「${state.name}」已生成。`);
  }

  async function clearCurrentShip() {
    if (!hasContent()) {
      showToast('当前装配台已经是空的。', 'warning');
      return;
    }
    const confirmed = await showConfirm({
      title: '清空装配槽？',
      message: '会移除所有已安装零件，保留当前船体。已保存的版本不会受影响。',
      confirmLabel: '清空',
      danger: true,
    });
    if (!confirmed) return;
    state.slots = emptySlots();
    markModified();
    renderAll(true);
    showToast('装配槽已清空，船体保留。');
  }

  /* ------------------------------------------------------------------ */
  /* 10. Save / hangar / export                                          */
  /* ------------------------------------------------------------------ */

  async function saveCurrentBuild() {
    const suggested = currentName && currentName !== '未命名方案' ? currentName : '';
    const name = await askName({
      title: '保存方案',
      value: suggested,
      confirmLabel: '保存',
      hint: '保存为当前浏览器中的一艘飞船。最多保留 20 艘，超过时可先删除旧方案。',
    });
    if (!name) return;
    const savedBuild = {
      id: currentBuildId || uuid(),
      name,
      hullId: state.hullId,
      slots: { ...state.slots },
      savedAt: nowISO(),
    };
    const existingIndex = builds.findIndex((build) => build.id === savedBuild.id);
    if (existingIndex >= 0) {
      builds[existingIndex] = savedBuild;
    } else {
      if (builds.length >= CONFIG.maxBuilds) {
        showToast('最多保存 20 艘飞船，请先在“我的飞船”中删除一艘。', 'warning');
        window.setTimeout(openHangar, 150);
        return;
      }
      builds.unshift(savedBuild);
    }
    currentBuildId = savedBuild.id;
    currentName = savedBuild.name;
    state.name = savedBuild.name;
    const persisted = persistBuilds();
    saveDraft();
    renderAll(false);
    updateHangarCount();
    showToast(persisted ? `已保存「${savedBuild.name}」。` : '已加入本次会话，但浏览器存储不可用。', persisted ? 'info' : 'warning');
  }

  function updateHangarCount() {
    const count = $('#hangar-count');
    if (count) count.textContent = String(builds.length);
    const summary = $('#hangar-summary');
    if (summary) summary.textContent = `${builds.length} / ${CONFIG.maxBuilds}`;
  }

  function renderHangar() {
    const grid = $('#hangar-grid');
    if (!grid) return;
    const summary = $('#hangar-summary');
    if (summary) summary.textContent = `${builds.length} / ${CONFIG.maxBuilds}`;
    if (!builds.length) {
      grid.innerHTML = '<div class="hangar-empty"><strong>还没有保存的飞船</strong><span>在装配台完成一艘，然后保存它。</span></div>';
      return;
    }
    grid.innerHTML = builds.map((build, index) => {
      const stats = computeStats(build);
      return `<article class="hangar-card" data-build-id="${escapeHTML(build.id)}" data-build-index="${index}">
        <div class="hangar-thumb">
          <canvas data-thumb-index="${index}" width="800" height="430" aria-label="${escapeHTML(build.name)} 预览"></canvas>
          <span class="hangar-grade grade-${stats.rating}">${stats.rating}</span>
        </div>
        <div class="hangar-body">
          <div class="hangar-title-row"><span class="hangar-title">${escapeHTML(build.name)}</span><span class="hangar-date">${escapeHTML(formatDate(build.savedAt))}</span></div>
          <div class="hangar-stats">
            <span>推 <b>${stats.propulsion.toFixed(0)}</b></span>
            <span>防 <b>${stats.defense.toFixed(0)}</b></span>
            <span>火 <b>${stats.firepower.toFixed(0)}</b></span>
            <span>综合 <b>${stats.score.toFixed(1)}</b></span>
          </div>
          <div class="hangar-actions">
            <button type="button" class="mini-btn" data-action="load">载入</button>
            <button type="button" class="mini-btn" data-action="rename">改名</button>
            <button type="button" class="mini-btn" data-action="export">PNG</button>
            <button type="button" class="mini-btn" data-action="share">复制文案</button>
            <button type="button" class="mini-btn" data-action="delete">删除</button>
          </div>
        </div>
      </article>`;
    }).join('');
    $$('[data-thumb-index]', grid).forEach((canvas) => {
      const index = Number(canvas.dataset.thumbIndex);
      const build = builds[index];
      if (build) drawHangarThumb(canvas, build);
    });
  }

  function openHangar() {
    const overlay = $('#hangar-overlay');
    if (!overlay || overlay.classList.contains('is-open')) return;
    closeDrawer();
    hangarFocus = document.activeElement;
    renderHangar();
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    syncBodyLock();
    const closeButton = $('#btn-hangar-close');
    if (closeButton) closeButton.focus();
  }

  function closeHangar() {
    const overlay = $('#hangar-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    syncBodyLock();
    if (hangarFocus && typeof hangarFocus.focus === 'function') hangarFocus.focus();
  }

  function getBuildById(id) {
    return builds.find((build) => build.id === id) || null;
  }

  function saveBuildFromCurrent(name) {
    return {
      id: currentBuildId || uuid(),
      name,
      hullId: state.hullId,
      slots: { ...state.slots },
      savedAt: nowISO(),
    };
  }

  function loadBuild(build) {
    if (!build) return;
    adoptBuild(build, true);
    renderAll(false);
    closeHangar();
    closeDrawer();
    showToast(`已载入「${build.name}」。`);
  }

  async function renameBuild(build) {
    if (!build) return;
    const name = await askName({
      title: '重命名飞船',
      label: '新名称',
      value: build.name,
      confirmLabel: '确认改名',
      hint: '只会修改“我的飞船”中的名称。',
    });
    if (!name) return;
    build.name = name;
    if (currentBuildId === build.id) {
      currentName = name;
      state.name = name;
    }
    persistBuilds();
    renderHangar();
    saveDraft();
    showToast(`已改名为「${name}」。`);
  }

  async function deleteBuild(build) {
    if (!build) return;
    const confirmed = await showConfirm({
      title: '删除这艘飞船？',
      message: `「${build.name}」会从当前浏览器的机库中永久移除。此操作不可撤销。`,
      confirmLabel: '删除',
      danger: true,
    });
    if (!confirmed) return;
    builds = builds.filter((item) => item.id !== build.id);
    if (currentBuildId === build.id) currentBuildId = null;
    persistBuilds();
    renderHangar();
    saveDraft();
    updateHangarCount();
    showToast(`已删除「${build.name}」。`);
  }

  function exportCurrentBuild() {
    const build = {
      ...saveBuildFromCurrent(currentName || '未命名方案'),
      id: currentBuildId || 'draft',
    };
    exportBuild(build);
  }

  function exportBuild(build) {
    if (!build) return;
    const safeBuild = sanitizeBuild(build);
    const stats = computeStats(safeBuild);
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1000;
    drawPoster(canvas, safeBuild, stats);
    downloadCanvas(canvas, `光速飞船_${safeFileStem(safeBuild.name)}_${formatFileDate()}.png`);
    showToast('正在导出装配海报。');
  }

  function shareBuild(build) {
    if (!build) return;
    const stats = computeStats(build);
    const text = [
      `【${build.name}】${stats.rating} 级 · 综合 ${stats.score.toFixed(1)}`,
      `推进 ${stats.propulsion.toFixed(0)} / 防御 ${stats.defense.toFixed(0)} / 火力 ${stats.firepower.toFixed(0)} / 能耗 ${stats.energy.toFixed(0)}`,
      commentaryFor(stats),
      '— NX-SHIPYARD 光速飞船装配台',
    ].join('\n');
    copyText(text)
      .then(() => showToast('分享文案已复制到剪贴板。'))
      .catch(() => showToast('复制失败，请手动选择文本。', 'warning'));
  }

  function shareCaption(build, stats) {
    const rawName = String(build.name || '未命名方案').replace(/\s+/g, ' ').trim() || '未命名方案';
    const fullName = Array.from(rawName);
    const shortName = fullName.length > 18
      ? `${fullName.slice(0, 18).join('')}…`
      : rawName;
    const fixed = `「${shortName}」综合 ${stats.rating} 级 · `;
    const comment = Array.from(commentaryFor(stats).replace(/\s+/g, ' ').trim());
    const remaining = 60 - Array.from(fixed).length;
    if (remaining <= 0) return Array.from(fixed).slice(0, 60).join('');
    if (comment.length > remaining) {
      return `${fixed}${comment.slice(0, remaining - 1).join('')}…`;
    }
    return `${fixed}${comment.join('')}`;
  }

  function openShareModal(caption) {
    const count = Array.from(caption).length;
    showModal(`<div class="modal-card share-modal">
      <div class="modal-head">
        <div><span class="kicker">SHARE / LOCAL EXPORT</span><h2>分享这艘飞船</h2></div>
        <button type="button" class="icon-btn" data-modal-close aria-label="关闭">×</button>
      </div>
      <div class="modal-body">
        <p class="modal-copy">装配海报已开始下载。下面这段文案不超过 60 字，可直接复制分享。</p>
        <div class="share-preview">
          <div class="share-preview__meta"><span>SHARE TEXT</span><span>${count} / 60 字</span></div>
          <p class="share-preview__text" id="share-copy-text">${escapeHTML(caption)}</p>
        </div>
        <p class="modal-copy share-local-note">仅导出 PNG 与本地文案，不会连接任何社交平台。</p>
        <p class="share-copy-status" id="share-copy-status" role="status"></p>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-modal-close>关闭</button>
        <button id="btn-copy-share" type="button" class="btn btn-primary">复制文案</button>
      </div>
    </div>`);

    const copyButton = $('#btn-copy-share');
    const status = $('#share-copy-status');
    if (!copyButton) return;
    copyButton.addEventListener('click', () => {
      copyText(caption)
        .then(() => {
          copyButton.textContent = '已复制';
          copyButton.classList.add('is-copied');
          if (status) status.textContent = '文案已复制，可直接粘贴。';
          showToast('分享文案已复制。');
        })
        .catch(() => {
          if (status) status.textContent = '复制失败，请手动选择上方文案。';
          showToast('复制失败，请手动选择文案。', 'warning');
        });
    });
  }

  function shareCurrentBuild() {
    const build = sanitizeBuild({
      ...saveBuildFromCurrent(currentName || '未命名方案'),
      id: currentBuildId || 'draft',
    });
    if (!build) return;
    const stats = computeStats(build);
    exportBuild(build);
    openShareModal(shareCaption(build, stats));
  }

  function downloadCanvas(canvas, filename) {
    canvas.toBlob((blob) => {
      if (!blob) {
        showToast('图片导出失败。', 'warning');
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  }

  /* ------------------------------------------------------------------ */
  /* 11. Canvas poster + thumbnails                                      */
  /* ------------------------------------------------------------------ */

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawStars(ctx, width, height, seed, count) {
    const random = seededRandom(seed);
    for (let i = 0; i < count; i += 1) {
      const x = random() * width;
      const y = random() * height;
      const size = 0.5 + random() * 1.8;
      ctx.globalAlpha = 0.16 + random() * 0.62;
      ctx.fillStyle = random() > 0.82 ? '#ffcf9a' : '#bfe8ef';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawShipVector(ctx, cx, cy, scale = 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-330, -200);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const wingGradient = ctx.createLinearGradient(70, 100, 590, 360);
    wingGradient.addColorStop(0, 'rgba(86, 111, 124, 0.94)');
    wingGradient.addColorStop(0.5, 'rgba(33, 53, 65, 0.96)');
    wingGradient.addColorStop(1, 'rgba(8, 17, 25, 0.98)');
    const hullGradient = ctx.createLinearGradient(300, 30, 360, 360);
    hullGradient.addColorStop(0, 'rgba(220, 230, 229, 0.98)');
    hullGradient.addColorStop(0.42, 'rgba(111, 133, 141, 0.98)');
    hullGradient.addColorStop(1, 'rgba(22, 38, 49, 0.99)');
    const panelGradient = ctx.createLinearGradient(300, 100, 340, 300);
    panelGradient.addColorStop(0, 'rgba(171, 190, 193, 0.64)');
    panelGradient.addColorStop(1, 'rgba(27, 48, 60, 0.44)');

    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 14;

    ctx.fillStyle = wingGradient;
    ctx.strokeStyle = 'rgba(122, 232, 255, .32)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(310, 122); ctx.lineTo(168, 216); ctx.lineTo(82, 314);
    ctx.lineTo(137, 337); ctx.lineTo(286, 284); ctx.lineTo(310, 334); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(350, 122); ctx.lineTo(492, 216); ctx.lineTo(578, 314);
    ctx.lineTo(523, 337); ctx.lineTo(374, 284); ctx.lineTo(350, 334); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(200, 216, 219, .18)';
    ctx.beginPath();
    ctx.moveTo(310, 122); ctx.lineTo(168, 216); ctx.lineTo(206, 254); ctx.lineTo(301, 216); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(350, 122); ctx.lineTo(492, 216); ctx.lineTo(454, 254); ctx.lineTo(359, 216); ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(8, 18, 26, .92)';
    ctx.strokeStyle = 'rgba(122, 232, 255, .18)';
    ctx.beginPath();
    ctx.moveTo(310, 150); ctx.lineTo(160, 234); ctx.lineTo(213, 267); ctx.lineTo(307, 231); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(350, 150); ctx.lineTo(500, 234); ctx.lineTo(447, 267); ctx.lineTo(353, 231); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = hullGradient;
    ctx.strokeStyle = 'rgba(201, 224, 228, .5)';
    ctx.beginPath();
    ctx.moveTo(330, 34); ctx.lineTo(366, 155); ctx.lineTo(354, 300); ctx.lineTo(330, 376);
    ctx.lineTo(306, 300); ctx.lineTo(294, 155); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = 'rgba(7, 18, 27, .96)';
    ctx.strokeStyle = 'rgba(122, 232, 255, .25)';
    ctx.beginPath();
    ctx.moveTo(330, 54); ctx.lineTo(350, 160); ctx.lineTo(343, 278); ctx.lineTo(330, 338);
    ctx.lineTo(317, 278); ctx.lineTo(310, 160); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = panelGradient;
    ctx.beginPath();
    ctx.moveTo(330, 72); ctx.lineTo(339, 155); ctx.lineTo(333, 246); ctx.lineTo(330, 289);
    ctx.lineTo(327, 246); ctx.lineTo(321, 155); ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(8, 17, 25, .92)';
    ctx.strokeStyle = 'rgba(122, 232, 255, .24)';
    ctx.beginPath();
    ctx.moveTo(306, 266); ctx.lineTo(270, 300); ctx.lineTo(286, 321); ctx.lineTo(318, 300); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(354, 266); ctx.lineTo(390, 300); ctx.lineTo(374, 321); ctx.lineTo(342, 300); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = 'rgba(4, 15, 23, .98)';
    ctx.strokeStyle = 'rgba(174, 247, 255, .65)';
    ctx.beginPath(); ctx.ellipse(330, 146, 18, 29, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(122, 232, 255, .38)';
    ctx.beginPath(); ctx.moveTo(318, 128); ctx.quadraticCurveTo(330, 119, 342, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(318, 146); ctx.lineTo(342, 146); ctx.stroke();

    ctx.strokeStyle = 'rgba(210, 230, 232, .3)';
    ctx.beginPath(); ctx.moveTo(284, 245); ctx.lineTo(258, 260); ctx.moveTo(376, 245); ctx.lineTo(402, 260); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 180, 102, .55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(195, 235); ctx.lineTo(230, 253); ctx.moveTo(465, 235); ctx.lineTo(430, 253); ctx.stroke();
    ctx.lineWidth = 1;

    for (const [ex, ey] of [[298, 326], [362, 326]]) {
      const glow = ctx.createRadialGradient(ex, ey, 2, ex, ey, 56);
      glow.addColorStop(0, 'rgba(255, 238, 200, .94)');
      glow.addColorStop(0.25, 'rgba(255, 180, 102, .52)');
      glow.addColorStop(1, 'rgba(255, 180, 102, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(ex, ey, 56, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(4, 15, 23, .98)';
      ctx.strokeStyle = 'rgba(158, 176, 182, .55)';
      ctx.beginPath(); ctx.arc(ex, ey, 25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd6a3';
      ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = 'rgba(189, 223, 228, .9)';
    ctx.font = '9px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NX-07', 330, 211);
    ctx.fillStyle = 'rgba(122, 232, 255, .55)';
    ctx.font = '5px "Courier New", monospace';
    ctx.fillText('HELIOS', 330, 222);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
    const chars = Array.from(String(text || ''));
    const lines = [];
    let line = '';
    for (const char of chars) {
      const test = line + char;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = char;
        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    lines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
  }

  function drawPoster(canvas, build, stats) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const accent = '#ffb466';
    const primary = '#6ce7ff';
    const ink = '#e6f0f1';
    const muted = '#8499a1';
    const random = seededRandom(`${build.id}-${build.name}`);
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#07121b');
    bg.addColorStop(0.56, '#030a11');
    bg.addColorStop(1, '#071219');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(470, 470, 20, 470, 470, 620);
    glow.addColorStop(0, 'rgba(23, 71, 91, .22)');
    glow.addColorStop(0.62, 'rgba(9, 29, 41, .08)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    drawStars(ctx, W, H, `${build.id}-${build.name}-stars`, 170);

    ctx.strokeStyle = 'rgba(108, 231, 255, .07)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = primary;
    ctx.font = '600 14px "Courier New", monospace';
    ctx.fillText('NX-SHIPYARD', 72, 64);
    ctx.fillStyle = muted;
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('LIGHT-SPEED ASSEMBLY DESK / OFFICIAL BUILD CARD', 72, 84);
    ctx.fillStyle = accent;
    ctx.fillText(`RATING ${stats.rating}  /  SCORE ${stats.score.toFixed(1)}`, 72, 104);
    const dateText = formatDate(build.savedAt || nowISO());
    ctx.fillStyle = muted;
    ctx.textAlign = 'right';
    ctx.fillText(dateText, W - 72, 74);
    ctx.fillText('NX-07 / HELIOS PROGRAM', W - 72, 94);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(108, 231, 255, .28)';
    ctx.beginPath(); ctx.moveTo(72, 124); ctx.lineTo(W - 72, 124); ctx.stroke();

    ctx.fillStyle = ink;
    ctx.font = '500 52px "Microsoft YaHei", "PingFang SC", sans-serif';
    const nameBottom = drawWrappedText(ctx, build.name, 72, 168, 830, 58, 2);
    ctx.fillStyle = accent;
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText(`${stats.rating} CLASS LOADOUT  /  ${stats.counts.decor} DECOR FITTINGS`, 72, nameBottom + 10);

    drawShipVector(ctx, 440, 490, 1.08);

    ctx.strokeStyle = 'rgba(108, 231, 255, .18)';
    ctx.beginPath();
    ctx.moveTo(1000, 128);
    ctx.lineTo(1000, 892);
    ctx.stroke();

    ctx.fillStyle = primary;
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('PERFORMANCE MANIFEST / 04', 1040, 154);
    ctx.fillStyle = ink;
    ctx.font = '500 24px "Microsoft YaHei", sans-serif';
    ctx.fillText('舰体性能', 1040, 190);

    const ratingX = 1466;
    const ratingY = 260;
    ctx.strokeStyle = 'rgba(255, 180, 102, .58)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = ratingX + Math.cos(angle) * 54;
      const y = ratingY + Math.sin(angle) * 54;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.font = '500 68px "Microsoft YaHei", "Courier New", monospace';
    ctx.fillText(stats.rating, ratingX, ratingY + 18);
    ctx.fillStyle = muted;
    ctx.font = '9px "Courier New", monospace';
    ctx.fillText('OVERALL RATING', ratingX, ratingY + 46);
    ctx.fillStyle = ink;
    ctx.font = '34px "Courier New", monospace';
    ctx.fillText(stats.score.toFixed(1), ratingX, ratingY + 94);
    ctx.fillStyle = muted;
    ctx.font = '9px "Courier New", monospace';
    ctx.fillText('/ 100', ratingX + 4, ratingY + 112);
    ctx.textAlign = 'left';

    const barX = 1040;
    const barW = 390;
    const metrics = [
      ['推进效率', 'PROPULSION', stats.propulsion, 120, accent],
      ['防御', 'DEFENSE', stats.defense, 120, primary],
      ['火力', 'FIREPOWER', stats.firepower, 120, accent],
      ['能耗', 'ENERGY', stats.energy, 100, stats.overload ? accent : primary],
    ];
    metrics.forEach(([label, en, value, max, color], index) => {
      const y = 402 + index * 84;
      ctx.fillStyle = ink;
      ctx.font = '500 16px "Microsoft YaHei", sans-serif';
      ctx.fillText(label, barX, y);
      ctx.fillStyle = muted;
      ctx.font = '10px "Courier New", monospace';
      ctx.fillText(en, barX, y + 17);
      ctx.fillStyle = color;
      ctx.font = '22px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(0), barX + barW, y + 8);
      ctx.textAlign = 'left';
      roundedRect(ctx, barX, y + 32, barW, 7, 4);
      ctx.fillStyle = 'rgba(120, 154, 166, .16)';
      ctx.fill();
      const ratio = Math.min(1, Math.max(0, value / max));
      if (ratio > 0) {
        roundedRect(ctx, barX, y + 32, barW * ratio, 7, 4);
        ctx.fillStyle = color;
        ctx.fill();
      }
      if (index === 0) {
        ctx.strokeStyle = 'rgba(255, 180, 102, .75)';
        ctx.beginPath();
        ctx.moveTo(barX + barW * (100 / 120), y + 27);
        ctx.lineTo(barX + barW * (100 / 120), y + 44);
        ctx.stroke();
      }
    });

    const commentary = commentaryFor(stats);
    ctx.fillStyle = accent;
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('ARCHETYPE / 舰型判读', 1040, 742);
    ctx.fillStyle = ink;
    ctx.font = '500 17px "Microsoft YaHei", sans-serif';
    drawWrappedText(ctx, commentary, 1040, 775, 470, 28, 3);

    ctx.fillStyle = stats.lightspeed ? accent : muted;
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(stats.lightspeed ? '▲ LIGHT-SPEED ENVELOPE: READY' : '△ LIGHT-SPEED ENVELOPE: NOT READY', 1040, 860);
    ctx.fillStyle = muted;
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText(`THRUST ${stats.engineThrust.toFixed(0)}  /  EMPTY CORE ${stats.emptyCore}  /  EMPTY DECOR ${stats.emptyDecor}`, 1040, 882);

    ctx.fillStyle = primary;
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText('LOADOUT MANIFEST', 72, 790);
    const coreParts = equippedCoreParts(build);
    const columns = [0, 1];
    columns.forEach((column) => {
      const x = 72 + column * 420;
      coreParts.slice(column * 4, column * 4 + 4).forEach((entry, row) => {
        const y = 818 + row * 24;
        ctx.fillStyle = muted;
        ctx.font = '9px "Courier New", monospace';
        ctx.fillText(entry.slot.en, x, y);
        ctx.fillStyle = entry.part ? ink : 'rgba(120, 154, 166, .4)';
        ctx.font = '12px "Microsoft YaHei", sans-serif';
        ctx.fillText(entry.part ? entry.part.name : '— 未安装', x + 78, y);
      });
    });

    ctx.strokeStyle = 'rgba(108, 231, 255, .22)';
    ctx.beginPath(); ctx.moveTo(72, 936); ctx.lineTo(W - 72, 936); ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText('NX-SHIPYARD / 62 SLOTS / LOCAL BUILD SYSTEM', 72, 960);
    ctx.textAlign = 'right';
    ctx.fillText('光速飞船装配台 · 装配方案卡', W - 72, 960);
    ctx.textAlign = 'left';
  }

  function drawHangarThumb(canvas, build) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const stats = computeStats(build);
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#07141d');
    bg.addColorStop(1, '#03090f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(240, 250, 20, 240, 250, 350);
    glow.addColorStop(0, 'rgba(27, 73, 91, .3)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    drawStars(ctx, W, H, `${build.id}-thumb`, 44);
    ctx.strokeStyle = 'rgba(108, 231, 255, .08)';
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    drawShipVector(ctx, 250, 260, 0.65);

    ctx.fillStyle = '#ffb466';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText('NX-SHIPYARD / BUILD CARD', 24, 34);
    ctx.fillStyle = '#e6f0f1';
    ctx.font = '500 23px "Microsoft YaHei", sans-serif';
    const title = build.name.length > 13 ? `${build.name.slice(0, 13)}…` : build.name;
    ctx.fillText(title, 24, 65);
    ctx.fillStyle = '#8499a1';
    ctx.font = '9px "Courier New", monospace';
    ctx.fillText(`${stats.rating} CLASS  /  ${stats.score.toFixed(1)} SCORE`, 24, 83);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffb466';
    ctx.font = '500 54px "Microsoft YaHei", "Courier New", monospace';
    ctx.fillText(stats.rating, W - 28, 76);
    ctx.textAlign = 'left';

    const barX = 532;
    const barW = 236;
    const metrics = [
      ['推进', stats.propulsion, 120],
      ['防御', stats.defense, 120],
      ['火力', stats.firepower, 120],
      ['能耗', stats.energy, 100],
    ];
    metrics.forEach(([label, value, max], index) => {
      const y = 160 + index * 46;
      ctx.fillStyle = '#8499a1';
      ctx.font = '10px "Microsoft YaHei", sans-serif';
      ctx.fillText(label, barX, y);
      ctx.fillStyle = '#ffb466';
      ctx.font = '14px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(0), barX + barW, y);
      ctx.textAlign = 'left';
      roundedRect(ctx, barX, y + 12, barW, 4, 2);
      ctx.fillStyle = 'rgba(120, 154, 166, .16)';
      ctx.fill();
      const ratio = Math.min(1, Math.max(0, value / max));
      if (ratio > 0) {
        roundedRect(ctx, barX, y + 12, barW * ratio, 4, 2);
        ctx.fillStyle = index === 3 && stats.overload ? '#ffb466' : '#6ce7ff';
        ctx.fill();
      }
    });

    ctx.fillStyle = '#6ce7ff';
    ctx.font = '9px "Courier New", monospace';
    ctx.fillText('LOCAL BUILD / JSON SAVED', 24, H - 28);
    ctx.textAlign = 'right';
    ctx.fillStyle = stats.lightspeed ? '#ffb466' : '#8499a1';
    ctx.fillText(stats.lightspeed ? 'LIGHT-SPEED READY' : 'SUB-LIGHT', W - 24, H - 28);
    ctx.textAlign = 'left';
  }

  /* ------------------------------------------------------------------ */
  /* 12. Launch sequence                                                 */
  /* ------------------------------------------------------------------ */

  function buildLaunchStreaks() {
    const container = $('#launch-streaks');
    if (!container || container.children.length) return;
    const random = seededRandom('launch-streaks');
    for (let i = 0; i < 54; i += 1) {
      const streak = document.createElement('span');
      streak.className = 'streak';
      streak.style.setProperty('--y', `${4 + random() * 92}%`);
      streak.style.setProperty('--len', `${80 + random() * 280}px`);
      streak.style.setProperty('--h', `${0.5 + random() * 1.7}px`);
      streak.style.setProperty('--dur', `${0.6 + random() * 1.1}s`);
      streak.style.setProperty('--delay', `${random() * 0.8}s`);
      streak.style.setProperty('--op', `${0.35 + random() * 0.55}`);
      container.appendChild(streak);
    }
  }

  function navigateToFlight() {
    if (launchNavigated) return;
    launchNavigated = true;
    /* One-shot pass proving the sortie was launched from the bay. */
    try {
      window.sessionStorage.setItem('stellar_odyssey:arrival-ok', '1');
    } catch (error) {
      /* private mode: the flight page will simply show its start screen */
    }
    const overlay = $('#launch-overlay');
    overlay?.classList.add('is-launching-out');
    document.body.classList.add('is-launching');
    window.setTimeout(() => {
      window.location.href = FLIGHT_URL;
    }, 240);
  }

  function startLaunch() {
    if (launchActive) return;
    const readiness = computeStats(state);
    if (readiness.emptyCore > 0) {
      showToast(`还有 ${readiness.emptyCore} 个核心槽位为空，装满 8 个核心槽才能起飞。`, 'warning');
      return;
    }
    statsCache = computeStats(state);
    const stats = statsCache;
    const overlay = $('#launch-overlay');
    if (!overlay) return;
    const status = $('#launch-status');
    if (status) {
      status.textContent = stats.lightspeed
        ? '曲率包络锁定 · 航道已开放'
        : `推进效率 ${stats.propulsion.toFixed(0)} / 100 · 亚光速航道`;
    }
    const launchPropulsion = $('#launch-stat-propulsion');
    const launchScore = $('#launch-stat-score');
    const launchRating = $('#launch-stat-rating');
    if (launchPropulsion) launchPropulsion.textContent = stats.propulsion.toFixed(0);
    if (launchScore) launchScore.textContent = stats.score.toFixed(1);
    if (launchRating) launchRating.textContent = stats.rating;

    launchNavigated = false;
    launchActive = true;
    document.body.classList.add('is-launching');
    overlay.classList.remove('is-warping', 'is-launching-out');
    overlay.classList.add('is-active', 'is-cinematic');
    overlay.classList.toggle('is-warning', !stats.lightspeed);
    overlay.setAttribute('aria-hidden', 'false');
    buildLaunchStreaks();
    syncBodyLock();

    /* Let the live three-dimensional dock perform the undock and warp
       burn while the overlay supplies the HUD and CSS star streaks. */
    const scene = window.__SHIPYARD_3D__;
    if (scene && typeof scene.finishDock === 'function') scene.finishDock();
    if (scene && typeof scene.launchToFlight === 'function') {
      scene.launchToFlight({ duration: 3100 });
    }

    window.clearTimeout(launchWarpTimer);
    window.clearTimeout(launchTimer);
    launchWarpTimer = window.setTimeout(() => {
      overlay.classList.add('is-warping');
    }, 1000);
    launchTimer = window.setTimeout(() => endLaunch(false), CONFIG.launchDuration);
  }

  function endLaunch(skipped = false) {
    if (!launchActive) return;
    launchActive = false;
    window.clearTimeout(launchTimer);
    window.clearTimeout(launchWarpTimer);
    const overlay = $('#launch-overlay');
    if (skipped && overlay) overlay.classList.add('is-warping');
    navigateToFlight();
  }

  /* ------------------------------------------------------------------ */
  /* 13. Event wiring                                                    */
  /* ------------------------------------------------------------------ */

  function setupLibraryEvents() {
    const library = $('#library-list');
    if (!library) return;
    library.addEventListener('pointerdown', handleLibraryPointerDown);
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('blur', cancelPointerDragOnBlur);
    library.addEventListener('click', (event) => {
      const card = event.target.closest('.part-card');
      if (!card) return;
      if (performance.now() < (library.dataset.ignoreClickUntil || 0)) return;
      installPart(card.dataset.partId);
    });
    library.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('.part-card');
      if (!card) return;
      event.preventDefault();
      installPart(card.dataset.partId);
    });
    library.addEventListener('dragstart', (event) => {
      /* Pointer drag owns the interaction. Block the browser's native
         image/SVG drag when a drag starts inside a part card. */
      if (event.target.closest('.part-card')) event.preventDefault();
    });
  }

  function setupSlotEvents() {
    const slots = $('#functional-slots');
    if (!slots) return;
    slots.addEventListener('click', handleSlotClick);
    slots.addEventListener('contextmenu', handleSlotContextMenu);
    slots.addEventListener('dragover', (event) => {
      const slot = event.target.closest('.slot');
      if (!slot || !canDrop(dragPartId, slot.dataset.category)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      clearDropHints();
      slot.classList.add('is-dragover');
    });
    slots.addEventListener('dragleave', (event) => {
      const slot = event.target.closest('.slot');
      if (!slot || slot.contains(event.relatedTarget)) return;
      slot.classList.remove('is-dragover');
    });
    slots.addEventListener('drop', (event) => {
      const slot = event.target.closest('.slot');
      if (!slot) return;
      event.preventDefault();
      event.stopPropagation();
      const partId = dragPartId || (event.dataTransfer ? event.dataTransfer.getData('text/plain') : '');
      if (canDrop(partId, slot.dataset.category)) installIntoSlot(slot.dataset.slotId, partId);
      clearDropHints();
      dragPartId = null;
    });

    const decor = $('#decor-grid');
    if (!decor) return;
    decor.addEventListener('click', handleDecorClick);
    decor.addEventListener('contextmenu', handleDecorContextMenu);
    decor.addEventListener('dragover', (event) => {
      const cell = event.target.closest('.decor-cell');
      if (!cell || !canDrop(dragPartId, 'decor')) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      clearDropHints();
      cell.classList.add('is-dragover');
    });
    decor.addEventListener('dragleave', (event) => {
      const cell = event.target.closest('.decor-cell');
      if (!cell || cell.contains(event.relatedTarget)) return;
      cell.classList.remove('is-dragover');
    });
    decor.addEventListener('drop', (event) => {
      const cell = event.target.closest('.decor-cell');
      if (!cell) return;
      event.preventDefault();
      const partId = dragPartId || (event.dataTransfer ? event.dataTransfer.getData('text/plain') : '');
      if (canDrop(partId, 'decor')) installIntoSlot(cell.dataset.slotId, partId);
      clearDropHints();
      dragPartId = null;
    });

    const stage = $('#ship-drop');
    if (!stage) return;
    stage.addEventListener('dragover', (event) => {
      if (!canDrop(dragPartId, 'hull')) return;
      if (event.target.closest('.slot') || event.target.closest('.decor-cell')) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      stage.classList.add('is-hull-over');
    });
    stage.addEventListener('dragleave', (event) => {
      if (!stage.contains(event.relatedTarget)) stage.classList.remove('is-hull-over');
    });
    stage.addEventListener('drop', (event) => {
      if (!canDrop(dragPartId, 'hull')) return;
      if (event.target.closest('.slot') || event.target.closest('.decor-cell')) return;
      event.preventDefault();
      installPart(dragPartId);
      dragPartId = null;
      clearDropHints();
    });
  }

  function setupHangarEvents() {
    const grid = $('#hangar-grid');
    if (!grid) return;
    grid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const card = button.closest('[data-build-id]');
      if (!card) return;
      const build = getBuildById(card.dataset.buildId);
      if (!build) return;
      switch (button.dataset.action) {
        case 'load': loadBuild(build); break;
        case 'rename': renameBuild(build); break;
        case 'export': exportBuild(build); break;
        case 'share': shareBuild(build); break;
        case 'delete': deleteBuild(build); break;
        default: break;
      }
    });
  }

  function setupEvents() {
    const on = (selector, eventName, listener) => {
      const node = $(selector);
      if (node) node.addEventListener(eventName, listener);
    };
    on('#btn-new', 'click', () => startNewBuild());
    on('#btn-hangar', 'click', openHangar);
    on('#btn-random', 'click', randomizeBuild);
    on('#btn-clear-ship', 'click', clearCurrentShip);
    on('#btn-save', 'click', saveCurrentBuild);
    on('#btn-export', 'click', exportCurrentBuild);
    on('#btn-share', 'click', shareCurrentBuild);
    on('#btn-launch', 'click', startLaunch);
    on('#btn-skip-launch', 'click', () => endLaunch(true));
    on('#btn-hangar-close', 'click', closeHangar);
    on('#btn-hangar-new', 'click', () => {
      closeHangar();
      startNewBuild();
    });
    on('#btn-drawer', 'click', openDrawer);
    on('#btn-drawer-close', 'click', closeDrawer);
    on('#drawer-backdrop', 'click', closeDrawer);
    const hangarOverlay = $('#hangar-overlay');
    if (hangarOverlay) {
      hangarOverlay.addEventListener('click', (event) => {
        if (event.target === hangarOverlay) closeHangar();
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (launchActive) {
          endLaunch(true);
          return;
        }
        if (activeModal) {
          closeActiveModal();
          return;
        }
        if ($('#hangar-overlay')?.classList.contains('is-open')) {
          closeHangar();
          return;
        }
        if ($('#library')?.classList.contains('is-open')) closeDrawer();
      }
    });

    window.addEventListener('resize', () => {
      if (!isMobile()) closeDrawer();
    });
    window.addEventListener('beforeunload', saveDraft);
    setupLibraryEvents();
    setupSlotEvents();
    setupHangarEvents();
  }

  /* ------------------------------------------------------------------ */
  /* 14. Boot                                                            */
  /* ------------------------------------------------------------------ */

  function setLibraryRail(collapsed) {
    const library = $('#library');
    if (!library) return;
    const isRail = Boolean(collapsed);
    library.classList.toggle('is-rail', isRail);
    $('#btn-library-expand')?.setAttribute('aria-expanded', isRail ? 'false' : 'true');
    $('#btn-library-collapse')?.setAttribute('aria-expanded', isRail ? 'false' : 'true');
  }

  function setupLibraryRail() {
    const library = $('#library');
    if (!library) return;
    setLibraryRail(window.matchMedia('(min-width: 901px)').matches);
    $('#btn-library-expand')?.addEventListener('click', () => setLibraryRail(false));
    $('#btn-library-collapse')?.addEventListener('click', () => setLibraryRail(true));
    window.addEventListener('resize', () => {
      if (window.innerWidth < 901 && library.classList.contains('is-rail')) {
        setLibraryRail(false);
      }
    });
  }

  function createStarfield() {
    const field = $('#starfield');
    if (!field) return;
    field.innerHTML = '';
    const random = seededRandom('shipyard-stars');
    for (let i = 0; i < 90; i += 1) {
      const star = document.createElement('span');
      const x = random() * 100;
      const y = random() * 100;
      const size = 0.6 + random() * 1.7;
      const alpha = 0.1 + random() * 0.55;
      star.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:${size}px;height:${size}px;border-radius:50%;background:${random() > 0.82 ? '#ffcf9a' : '#d8f6fa'};opacity:${alpha};`;
      field.appendChild(star);
    }
  }

  function exposeSceneApi() {
    window.ShipyardApp = {
      getSnapshot: () => JSON.parse(JSON.stringify(currentSnapshot())),
      getPart: (id) => PART_BY_ID.get(id) || null,
      getStats: () => JSON.parse(JSON.stringify(computeStats(state))),
      toast: (message, tone = 'info') => showToast(message, tone),
    };
  }

  function init() {
    builds = loadBuildsFromStorage();
    const draft = loadDraft();
    if (draft) {
      const draftIsSaved = builds.some((build) => build.id === draft.id);
      adoptBuild(draft, draftIsSaved);
      if (stripLockedParts()) {
        showToast('部分零件的解锁状态已变更，已从当前方案中卸下。', 'warning');
      }
    } else {
      setStateBlank();
      applyStarterKit();
      state.name = '首发装配';
      currentName = state.name;
      saveDraft();
    }
    renderLibrary();
    renderAll(false);
    setupEvents();
    setupLibraryRail();
    createStarfield();
    updateHangarCount();
    updateCreditsChip();
    syncBodyLock();
    maybeOpenRepair();
    if (!storageOK) {
      showToast('当前浏览器无法写入 localStorage，方案只会在本次会话中保留。', 'warning');
    }
    exposeSceneApi();
    try {
      window.dispatchEvent(new CustomEvent('shipyard:app-ready', {
        detail: JSON.parse(JSON.stringify(currentSnapshot())),
      }));
    } catch (error) {
      /* no-op */
    }
  }

  init();
})();