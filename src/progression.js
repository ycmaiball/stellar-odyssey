/* ===================================================================== */
/*  STELLAR ODYSSEY — PROGRESSION / CREDIT ECONOMY                        */
/*                                                                       */
/*  Classic script (no modules) so the shipyard's app.js can use it and  */
/*  the flight ESM bundle can read the same global. One profile per      */
/*  captain account, one storage key per account.                        */
/* ===================================================================== */

(() => {
  'use strict';

  const STORAGE_PREFIX = 'stellar_odyssey:profile:v1:';
  const DEMO_ADMIN_ID = 'acct-demo-admin';
  const CONTRACTS_PREFIX = 'stellar_odyssey:contracts:v1:';

  /* Every part id in the shipyard catalogue, with its credit price.
     Parts at 0 are part of the starter kit. Prices are the single source
     of truth for the unlock economy — edit here, nowhere else. */
  const PRICES = {
    'hull-scout': 0,
    'hull-line': 600,
    'hull-bastion': 2400,

    'engine-ion': 0,
    'engine-pulse': 600,
    'engine-fusion': 1200,
    'engine-singularity': 2400,

    'shield-deflector': 0,
    'shield-phase': 600,
    'shield-aegis': 1200,

    'weapon-pulse': 0,
    'weapon-beam': 600,
    'weapon-rail': 1200,
    'weapon-torpedo': 2400,

    'cockpit-solo': 0,
    'cockpit-command': 1200,
    'cockpit-neural': 2400,

    'tail-vector': 0,
    'tail-curve': 500,
    'tail-recon': 900,

    'decor-plate': 180,
    'decor-antenna': 200,
    'decor-vent': 220,
    'decor-stripe': 240,
    'decor-beacon': 260,
    'decor-lamp': 280,
    'decor-drone': 320,
    'decor-nav': 420,
  };

  const STARTER_PARTS = Object.keys(PRICES).filter((id) => PRICES[id] === 0);

  const START_CREDITS = 300;
  const RANKS = [
    { min: 0, label: '见习舰长' },
    { min: 120, label: '上尉' },
    { min: 320, label: '少校' },
    { min: 640, label: '星区指挥官' },
  ];

  const REPAIR_BASE = 40;
  const REPAIR_FULL_RATE = 240;
  const REPAIR_PARTIAL_RATE = 0.55;

  const KILL_CREDITS = 45;
  const KILL_XP = 8;
  const SURVEY_CREDITS = 120;
  const SURVEY_XP = 20;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function storageKey(accountId) {
    return `${STORAGE_PREFIX}${accountId || 'guest'}`;
  }

  function defaultProfile() {
    return {
      version: 1,
      credits: START_CREDITS,
      xp: 0,
      unlocked: STARTER_PARTS.slice(),
      hull: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: { sorties: 0, kills: 0, surveys: 0, contracts: 0, earned: 0, repairs: 0 },
    };
  }

  /* Migrate the credits/rank a captain already earned through contracts
     before the profile existed, so nobody loses progress. */
  function migrateFromContracts(accountId) {
    const legacy = readJSON(`${CONTRACTS_PREFIX}${accountId || 'guest'}`, null);
    if (!legacy || typeof legacy !== 'object') return null;
    const credits = Number(legacy.credits) || 0;
    const xp = Number(legacy.xp) || 0;
    if (credits <= 0 && xp <= 0) return null;
    return { credits, xp };
  }

  function loadProfile(accountId) {
    const key = storageKey(accountId);
    const stored = readJSON(key, null);
    if (stored && typeof stored === 'object') {
      const profile = defaultProfile();
      profile.credits = Number.isFinite(stored.credits) ? Math.max(0, Math.round(stored.credits)) : START_CREDITS;
      profile.xp = Number.isFinite(stored.xp) ? Math.max(0, Math.round(stored.xp)) : 0;
      profile.hull = Number.isFinite(stored.hull) ? clamp(stored.hull, 0, 100) : 100;
      profile.unlocked = Array.isArray(stored.unlocked)
        ? Array.from(new Set(STARTER_PARTS.concat(stored.unlocked.filter((id) => PRICES[id] !== undefined))))
        : STARTER_PARTS.slice();
      profile.createdAt = stored.createdAt || profile.createdAt;
      profile.updatedAt = stored.updatedAt || profile.updatedAt;
      profile.stats = Object.assign(profile.stats, stored.stats || {});
      return profile;
    }

    const profile = defaultProfile();
    const migrated = migrateFromContracts(accountId);
    if (migrated) {
      profile.credits = migrated.credits;
      profile.xp = migrated.xp;
    }
    writeJSON(key, profile);
    return profile;
  }

  function rankFor(xp) {
    let label = RANKS[0].label;
    RANKS.forEach((rank) => {
      if (xp >= rank.min) label = rank.label;
    });
    return label;
  }

  function createProgression(accountId, options = {}) {
    const id = accountId || 'guest';
    const key = storageKey(id);
    const profile = loadProfile(id);
    const unlimited = Boolean(options && options.admin) || id === DEMO_ADMIN_ID;

    function save() {
      profile.updatedAt = new Date().toISOString();
      writeJSON(key, profile);
      return profile;
    }

    function earn(amount, reason) {
      const value = Math.max(0, Math.round(Number(amount) || 0));
      if (!value) return profile.credits;
      profile.credits += value;
      profile.stats.earned = (profile.stats.earned || 0) + value;
      if (reason) profile.stats[reason] = (profile.stats[reason] || 0) + 1;
      save();
      return profile.credits;
    }

    return {
      accountId: id,
      storageKey: key,
      prices: PRICES,
      starterParts: STARTER_PARTS.slice(),
      get credits() { return unlimited ? Infinity : profile.credits; },
      get isUnlimited() { return unlimited; },
      get xp() { return profile.xp; },
      get hull() { return profile.hull; },
      get stats() { return profile.stats; },
      rank() { return rankFor(profile.xp); },
      isUnlocked(partId) {
        if (unlimited) return PRICES[partId] !== undefined;
        if (PRICES[partId] === 0) return true;
        return profile.unlocked.includes(partId);
      },
      price(partId) {
        return PRICES[partId] === undefined ? null : PRICES[partId];
      },
      unlockedParts() {
        return profile.unlocked.slice();
      },
      canAfford(partId) {
        if (unlimited) return PRICES[partId] !== undefined;
        const price = PRICES[partId];
        return price !== undefined && profile.credits >= price;
      },
      unlock(partId) {
        const price = PRICES[partId];
        if (price === undefined) return { ok: false, reason: 'UNKNOWN_PART' };
        if (price === 0 || profile.unlocked.includes(partId)) return { ok: true, already: true };
        if (unlimited) {
          profile.unlocked.push(partId);
          save();
          return { ok: true, spent: 0, credits: Infinity, admin: true };
        }
        if (profile.credits < price) return { ok: false, reason: 'INSUFFICIENT_CREDITS', missing: price - profile.credits };
        profile.credits -= price;
        profile.unlocked.push(partId);
        save();
        return { ok: true, spent: price, credits: profile.credits };
      },
      addCredits(amount) { return unlimited ? Infinity : earn(amount); },
      addXp(amount) {
        profile.xp = Math.max(0, Math.round(profile.xp + (Number(amount) || 0)));
        save();
        return profile.xp;
      },
      recordKill() {
        profile.stats.kills = (profile.stats.kills || 0) + 1;
        profile.xp += KILL_XP;
        if (!unlimited) {
          profile.credits += KILL_CREDITS;
          profile.stats.earned = (profile.stats.earned || 0) + KILL_CREDITS;
        }
        save();
        return { credits: KILL_CREDITS, xp: KILL_XP };
      },
      recordSurvey() {
        profile.stats.surveys = (profile.stats.surveys || 0) + 1;
        profile.xp += SURVEY_XP;
        if (!unlimited) {
          profile.credits += SURVEY_CREDITS;
          profile.stats.earned = (profile.stats.earned || 0) + SURVEY_CREDITS;
        }
        save();
        return { credits: SURVEY_CREDITS, xp: SURVEY_XP };
      },
      recordSortie() {
        profile.stats.sorties = (profile.stats.sorties || 0) + 1;
        save();
      },
      setHull(value) {
        profile.hull = clamp(Number(value) || 0, 0, 100);
        save();
        return profile.hull;
      },
      damageHull(amount) {
        profile.hull = clamp(profile.hull - Math.max(0, Number(amount) || 0), 0, 100);
        save();
        return profile.hull;
      },
      repairCost(hullOverride) {
        if (unlimited) return 0;
        const hull = hullOverride === undefined ? profile.hull : clamp(hullOverride, 0, 100);
        if (hull >= 100) return 0;
        return Math.ceil(((100 - hull) / 100) * REPAIR_FULL_RATE) + REPAIR_BASE;
      },
      repair(mode = 'full') {
        const current = profile.hull;
        const fullCost = this.repairCost(current);
        if (current >= 100) return { ok: true, free: true, cost: 0, hull: current };
        if (mode === 'skip') return { ok: true, skipped: true, cost: 0, hull: current };
        if (unlimited) {
          profile.hull = mode === 'partial' ? clamp(current + 50, 0, 100) : 100;
          profile.stats.repairs = (profile.stats.repairs || 0) + 1;
          save();
          return { ok: true, cost: 0, hull: profile.hull, admin: true };
        }
        if (mode === 'partial') {
          const cost = Math.max(REPAIR_BASE, Math.round(fullCost * REPAIR_PARTIAL_RATE));
          if (profile.credits < cost) return { ok: false, reason: 'INSUFFICIENT_CREDITS', cost };
          profile.credits -= cost;
          profile.hull = clamp(current + 50, 0, 100);
          profile.stats.repairs = (profile.stats.repairs || 0) + 1;
          save();
          return { ok: true, cost, hull: profile.hull };
        }
        if (profile.credits < fullCost) return { ok: false, reason: 'INSUFFICIENT_CREDITS', cost: fullCost };
        profile.credits -= fullCost;
        profile.hull = 100;
        profile.stats.repairs = (profile.stats.repairs || 0) + 1;
        save();
        return { ok: true, cost: fullCost, hull: profile.hull };
      },
      reset() {
        const fresh = defaultProfile();
        Object.assign(profile, fresh);
        profile.unlocked = unlimited ? Object.keys(PRICES) : STARTER_PARTS.slice();
        save();
        return profile;
      },
      snapshot() {
        const snap = JSON.parse(JSON.stringify(profile));
        if (unlimited) {
          snap.credits = 999999999;
          snap.unlimited = true;
        }
        return snap;
      },
      save,
    };
  }

  window.StellarProgression = {
    createProgression,
    PRICES,
    STARTER_PARTS,
    RANKS,
    START_CREDITS,
    KILL_CREDITS,
    KILL_XP,
    SURVEY_CREDITS,
    SURVEY_XP,
    REPAIR_BASE,
    REPAIR_FULL_RATE,
    rankFor,
    storageKey,
  };
})();