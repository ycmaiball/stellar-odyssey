import { formatNumber, clamp } from './utils.js';

const $ = (id) => document.getElementById(id);

function setText(element, value) {
  if (element && element.textContent !== value) element.textContent = value;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/**
 * All DOM, HUD and overlay choreography lives here. main.js owns the world;
 * the UI owns the glass, type and pixels around it.
 */
export class GameUI {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.ready = false;
    this.started = false;
    this.mode = 'boot';
    this.targetKey = null;
    this.discovered = new Set();
    this.planets = [];
    this.parts = [];
    this.currentPartId = null;
    this.exploded = false;
    this.planetMarkers = new Map();
    this.partMarkers = new Map();
    this.discoveredChips = new Map();
    this.partItems = new Map();
    this.toasts = [];
    this.alertTimer = 0;
    this.chapterTimer = 0;
    this.startTransitionTimer = 0;
    this.touchEnabled = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 820;
    this.radarCtx = null;
    this.lastRadarDraw = 0;
    this.combatActive = false;
    this.enemyMarkerNodes = new Map();
    this.warpCockpitActive = false;

    this.cache = {
      speedC: '',
      speedKm: '',
      throttle: -1,
      warp: -1,
      warpClass: '',
      temp: '',
      nearest: '',
      heading: '',
      mode: '',
      clock: '',
      targetDistance: '',
      targetBearing: '',
    };

    this.el = {
      app: $('app'),
      boot: $('boot-screen'),
      bootFill: $('boot-bar-fill'),
      bootStatus: $('boot-status'),
      bootPercent: $('boot-percent'),
      start: $('start-screen'),
      startButton: $('btn-start'),
      startNote: $('start-ready-note'),
      hud: $('hud'),
      touch: $('touch-controls'),
      inspect: $('inspect-screen'),
      targetCn: $('target-cn'),
      targetEn: $('target-en'),
      targetIndex: $('target-index'),
      targetDistance: $('target-distance'),
      targetBearing: $('target-bearing'),
      targetBlurb: $('target-blurb'),
      autopilotButton: $('btn-autopilot'),
      autopilotLabel: $('autopilot-label'),
      discoverCount: $('discover-count'),
      discoverFill: $('discover-fill'),
      discoveredList: $('discovered-list'),
      speedC: $('hud-speed-c'),
      speed: $('hud-speed'),
      throttleValue: $('throttle-value'),
      throttleFill: $('throttle-fill'),
      warpValue: $('warp-value'),
      warpFill: $('warp-fill'),
      warpMeter: document.querySelector('.meter--warp'),
      reactorTemp: $('reactor-temp'),
      nearest: $('hud-nearest'),
      heading: $('hud-heading'),
      mode: $('hud-mode'),
      clock: $('hud-clock'),
      alert: $('hud-alert'),
      reticleLabel: $('reticle-label'),
      radar: $('radar-canvas'),
      sound: $('btn-sound'),
      soundGlyph: $('sound-glyph'),
      partList: $('part-list'),
      partMarkers: $('part-marker-layer'),
      planetMarkers: $('planet-marker-layer'),
      partIndex: $('part-index'),
      partCn: $('part-name-cn'),
      partEn: $('part-name-en'),
      partCode: $('part-code'),
      partSubsystem: $('part-subsystem'),
      partDesc: $('part-desc'),
      partSpecs: $('part-specs'),
      detachButton: $('btn-detach'),
      explodeButton: $('btn-explode'),
      explodeLabel: $('explode-label'),
      resetButton: $('btn-reset'),
      inspectExit: $('btn-inspect-exit'),
      toastStack: $('toast-stack'),
      chapter: $('chapter-card'),
      chapterKicker: $('chapter-kicker'),
      chapterTitle: $('chapter-title'),
      chapterSub: $('chapter-sub'),
      complete: $('complete-screen'),
      completePlanets: $('complete-planets'),
      completeTime: $('complete-time'),
      completeDistance: $('complete-distance'),
      error: $('webgl-error'),
      errorMessage: $('webgl-error-message'),
      warpFlash: $('warp-flash'),
      warpCockpit: $('warp-cockpit'),
      warpCockpitSpeed: $('warp-cockpit-speed'),
      enemyMarkers: $('enemy-marker-layer'),
      damageFlash: $('damage-flash'),
      combatPanel: $('combat-panel'),
      combatWave: $('combat-wave'),
      combatKills: $('combat-kills'),
      combatShieldFill: $('combat-shield-fill'),
      combatShieldValue: $('combat-shield-value'),
      combatHullFill: $('combat-hull-fill'),
      combatHullValue: $('combat-hull-value'),
      combatHeatFill: $('combat-heat-fill'),
      combatWeaponState: $('combat-weapon-state'),
      combatTarget: $('combat-target'),
      combatTargetDistance: $('combat-target-distance'),
      combatEnemyCount: $('combat-enemy-count'),
      combatShieldBar: document.querySelector('.combat-bar--shield'),
      combatHullBar: document.querySelector('.combat-bar--hull'),
      defeat: $('defeat-screen'),
      defeatKills: $('defeat-kills'),
      defeatWave: $('defeat-wave'),
      defeatTime: $('defeat-time'),
      missionStrip: document.querySelector('.mission-strip'),
      missionTarget: $('mission-target'),
      missionDistance: $('mission-distance'),
      missionBearing: $('mission-bearing'),
      missionObjective: $('mission-objective'),
      missionProgress: $('mission-progress'),
      tacticalBanner: $('tactical-banner'),
      contractChip: $('contract-chip'),
      contractKicker: $('contract-kicker'),
      contractTitle: $('contract-title'),
      contractProgress: $('contract-progress'),
      contractReward: $('contract-reward'),
      contractCredits: $('contract-credits'),
      contractRank: $('contract-rank'),
      contractDesc: $('contract-desc'),
      hitMarker: $('hit-marker'),
      killConfirm: $('kill-confirm'),
      killConfirmName: $('kill-confirm-name'),
      coreStatus: document.querySelector('.core-status'),
      coreMode: $('core-mode'),
      coreShieldFill: $('core-shield-fill'),
      coreShieldValue: $('core-shield-value'),
      coreHullFill: $('core-hull-fill'),
      coreHullValue: $('core-hull-value'),
      coreHeatFill: $('core-heat-fill'),
      coreWeaponState: $('core-weapon-state'),
      coreSpeed: $('core-speed'),
      coreWarp: $('core-warp'),
      coreKills: $('core-kills'),
      coreShieldBar: document.querySelector('.core-bar--shield'),
      coreHullBar: document.querySelector('.core-bar--hull'),
      coreHeatBar: document.querySelector('.core-bar--heat'),
      flightHints: $('flight-hints'),
      hudCredits: $('hud-credits-value'),
      creditFloaters: $('hud-credit-floaters'),
      abortButton: $('btn-abort'),
      abortScreen: $('abort-screen'),
      abortKills: $('abort-kills'),
      abortTime: $('abort-time'),
      abortHull: $('abort-hull'),
      abortCredits: $('abort-credits'),
      missilePips: $('missile-pips'),
      missileState: $('missile-state'),
    };

    this.hitTimer = 0;
    this.killTimer = 0;
    this.damageTimer = 0;
    this.tacticalActive = false;

    this.bindEvents();
    this.radarCtx = this.el.radar ? this.el.radar.getContext('2d') : null;
    window.addEventListener('resize', () => {
      this.touchEnabled =
        window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 820;
      this.syncTouchVisibility();
    });
  }

  on(name, fn) {
    this.callbacks[name] = fn;
  }

  bindEvents() {
    const click = (id, handler) => {
      const element = $(id);
      if (!element) return;
      element.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (element.disabled) return;
        handler(event);
      });
    };

    click('btn-start', () => {
      if (!this.ready || this.started) return;
      this.started = true;
      this.callbacks.onStart?.();
    });
    click('btn-inspect', () => this.callbacks.onInspect?.());
    click('btn-inspect-exit', () => this.callbacks.onExitInspect?.());
    click('btn-target-prev', () => this.callbacks.onTargetStep?.(-1));
    click('btn-target-next', () => this.callbacks.onTargetStep?.(1));
    click('btn-autopilot', () => this.callbacks.onAutopilot?.());
    click('btn-sound', () => this.callbacks.onToggleSound?.());
    click('btn-detach', () => this.callbacks.onDetach?.());
    click('btn-explode', () => this.callbacks.onExplode?.());
    click('btn-reset', () => this.callbacks.onReset?.());
    click('btn-continue', () => this.callbacks.onContinue?.());
    click('btn-respawn', () => this.callbacks.onRespawn?.());
    click('btn-abort', () => this.callbacks.onAbort?.());
    click('btn-abort-cancel', () => this.hideAbortConfirm());
    click('btn-abort-confirm', () => this.callbacks.onAbortConfirm?.());
    click('btn-touch-missile', () => this.callbacks.onMissile?.());
    click('btn-touch-inspect', () => this.callbacks.onInspect?.());
    click('btn-touch-target', () => this.callbacks.onTargetStep?.(1));
    click('btn-touch-auto', () => this.callbacks.onAutopilot?.());

    const holdButton = (id, startEvent, endEvent) => {
      const element = $(id);
      if (!element) return;
      const start = (event) => {
        event.preventDefault();
        event.stopPropagation();
        element.classList.add('is-pressed');
        startEvent();
      };
      const end = (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        element.classList.remove('is-pressed');
        endEvent();
      };
      element.addEventListener('pointerdown', start);
      element.addEventListener('pointerup', end);
      element.addEventListener('pointercancel', end);
      element.addEventListener('pointerleave', end);
      element.addEventListener('contextmenu', (event) => event.preventDefault());
    };

    holdButton(
      'btn-touch-thrust',
      () => this.callbacks.onThrustHold?.(true),
      () => this.callbacks.onThrustHold?.(false),
    );
    holdButton(
      'btn-touch-warp',
      () => this.callbacks.onWarpHold?.(true),
      () => this.callbacks.onWarpHold?.(false),
    );
    holdButton(
      'btn-touch-fire',
      () => this.callbacks.onFireHold?.(true),
      () => this.callbacks.onFireHold?.(false),
    );

    window.addEventListener('pointerup', () => {
      this.el.touch
        ?.querySelectorAll('.is-pressed')
        .forEach((element) => element.classList.remove('is-pressed'));
    });
  }

  /* ── boot / start ──────────────────────────────────────── */

  setBootProgress(percent, status) {
    const value = clamp(percent, 0, 100);
    if (this.el.bootFill) this.el.bootFill.style.width = `${value.toFixed(1)}%`;
    setText(this.el.bootPercent, `${String(Math.round(value)).padStart(2, '0')}%`);
    if (status) setText(this.el.bootStatus, status);
  }

  setBootStatus(status) {
    setText(this.el.bootStatus, status);
  }

  finishBoot({ failed = false } = {}) {
    this.setBootProgress(100, failed ? '部分链路离线 · 使用本地星图' : '深空链路稳定');
    this.ready = true;
    window.setTimeout(() => {
      if (this.started) return;
      this.el.boot?.classList.add('is-finished');
      this.el.start?.classList.remove('is-hidden');
      this.setMode('start');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.el.start?.classList.add('is-ready'));
      });
      if (this.el.startButton) this.el.startButton.disabled = false;
      if (this.el.startNote) {
        this.el.startNote.classList.add('is-ready');
        const label = this.el.startNote.querySelector('span:last-child');
        setText(label, '轨道数据已同步 · 8 / 8 行星');
      }
      window.setTimeout(() => {
        if (this.el.boot) this.el.boot.style.display = 'none';
      }, 1100);
    }, failed ? 500 : 850);
  }

  enterFlight() {
    if (!this.started) this.started = true;
    this.el.start?.classList.add('is-leaving');
    this.setMode('flight');
    this.el.hud?.classList.remove('is-hidden');
    window.setTimeout(() => {
      this.el.hud?.classList.add('is-live');
      this.el.start?.classList.add('is-hidden');
    }, 30);
    this.syncTouchVisibility();
    window.clearTimeout(this.startTransitionTimer);
    this.startTransitionTimer = window.setTimeout(() => {
      this.el.start?.classList.add('is-hidden');
    }, 1100);
  }

  setTouchMode(enabled) {
    this.touchEnabled = Boolean(enabled);
    this.syncTouchVisibility();
  }

  syncTouchVisibility() {
    if (!this.el.touch) return;
    const visible = this.mode === 'flight' && this.touchEnabled;
    this.el.touch.classList.toggle('is-hidden', !visible);
  }

  /* ── modes ─────────────────────────────────────────────── */

  setMode(mode) {
    this.mode = mode;
    document.body.dataset.mode = mode;
    this.el.app?.classList.remove(
      'mode-boot',
      'mode-start',
      'mode-flight',
      'mode-inspect',
      'mode-complete',
      'mode-defeat',
    );
    this.el.app?.classList.add(`mode-${mode}`);
    if (mode !== 'flight') {
      this.setTacticalScan(false);
      this.el.hitMarker?.classList.remove('is-hit', 'is-kill');
      this.el.killConfirm?.classList.remove('is-visible');
    }
    this.syncTouchVisibility();
  }

  openInspect() {
    this.setMode('inspect');
    this.el.inspect?.classList.remove('is-hidden');
    this.el.inspect?.classList.add('is-open');
    this.el.hud?.classList.add('is-hidden');
    this.el.touch?.classList.add('is-hidden');
  }

  closeInspect() {
    if (this.mode !== 'inspect') return;
    this.el.inspect?.classList.remove('is-open');
    this.el.inspect?.classList.add('is-hidden');
    this.el.hud?.classList.remove('is-hidden');
    this.setMode('flight');
    this.el.hud?.classList.add('is-live');
  }

  /* ── planet navigation UI ──────────────────────────────── */

  buildPlanets(planets) {
    this.planets = planets;
    if (!this.el.planetMarkers) return;

    this.el.planetMarkers.replaceChildren();
    this.planetMarkers.clear();

    planets.forEach((planet) => {
      const marker = makeElement('button', 'planet-marker');
      marker.type = 'button';
      marker.dataset.key = planet.key;
      marker.setAttribute('aria-label', `导航至${planet.cn}`);

      const dot = makeElement('span', 'planet-marker__dot');
      const body = makeElement('span', 'planet-marker__body');
      const name = makeElement('span', 'planet-marker__name', planet.cn);
      const meta = makeElement('span', 'planet-marker__meta');
      const en = makeElement('span', '', planet.en);
      const distance = makeElement('span', 'planet-marker__distance', '—');
      meta.append(en, distance);
      body.append(name, meta);
      marker.append(dot, body);
      marker.addEventListener('click', (event) => {
        event.stopPropagation();
        this.callbacks.onSelectPlanet?.(planet.key);
      });
      this.el.planetMarkers.append(marker);
      this.planetMarkers.set(planet.key, { root: marker, distance, en });
    });
  }

  buildDiscoveredList(planets) {
    if (!this.el.discoveredList) return;
    this.el.discoveredList.replaceChildren();
    this.discoveredChips.clear();
    planets.forEach((planet) => {
      const chip = makeElement('button', 'discovered-chip', planet.cn);
      chip.type = 'button';
      chip.dataset.key = planet.key;
      chip.title = planet.en;
      chip.addEventListener('click', (event) => {
        event.stopPropagation();
        this.callbacks.onSelectPlanet?.(planet.key);
      });
      this.el.discoveredList.append(chip);
      this.discoveredChips.set(planet.key, chip);
    });
  }

  setTarget(planet, index = 0, total = 8) {
    if (!planet) return;
    this.targetKey = planet.key;
    setText(this.el.targetCn, planet.cn);
    setText(this.el.targetEn, planet.en);
    setText(this.el.targetBlurb, planet.blurb);
    setText(
      this.el.targetIndex,
      `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
    );
    this.planetMarkers.forEach((marker, key) => {
      marker.root.classList.toggle('is-selected', key === planet.key);
    });
  }

  updateTargetTelemetry(distanceText, bearingText) {
    if (distanceText !== undefined) {
      setText(this.el.targetDistance, distanceText);
      this.cache.targetDistance = distanceText;
    }
    if (bearingText !== undefined) {
      const value = `方位 ${String(Math.round(bearingText)).padStart(3, '0')}°`;
      if (value !== this.cache.targetBearing) {
        setText(this.el.targetBearing, value);
        this.cache.targetBearing = value;
      }
    }
  }

  setDiscovered(keys) {
    this.discovered = new Set(keys);
    this.discoveredChips.forEach((chip, key) => {
      const found = this.discovered.has(key);
      chip.classList.toggle('is-discovered', found);
      chip.setAttribute('aria-pressed', found ? 'true' : 'false');
    });
    this.planetMarkers.forEach((marker, key) => {
      marker.root.classList.toggle('is-discovered', this.discovered.has(key));
    });
    const count = this.discovered.size;
    const total = this.planets.length || 8;
    setText(this.el.discoverCount, `${count} / ${total}`);
    if (this.el.discoverFill) {
      this.el.discoverFill.style.width = `${(count / total) * 100}%`;
    }
  }

  setPlanetMarkers(items) {
    items.forEach((item) => {
      const marker = this.planetMarkers.get(item.key);
      if (!marker) return;
      if (!item.visible) {
        marker.root.classList.remove('is-visible');
        marker.root.style.pointerEvents = 'none';
        return;
      }
      marker.root.classList.add('is-visible');
      marker.root.style.pointerEvents = 'auto';
      marker.root.style.left = `${item.x.toFixed(1)}px`;
      marker.root.style.top = `${item.y.toFixed(1)}px`;
      if (item.distance !== undefined) {
        setText(marker.distance, item.distance);
      }
      const edge = item.edge === 'left' || item.edge === 'right';
      marker.root.classList.toggle('is-edge', edge);
    });
  }

  /* ── flight telemetry ──────────────────────────────────── */

  updateFlight(data) {
    if (data.speedC !== undefined) {
      const value = `${data.speedC.toFixed(3)}c`;
      if (value !== this.cache.speedC) {
        setText(this.el.speedC, value);
        this.cache.speedC = value;
      }
    }
    if (data.speedC !== undefined) {
      this.updateWarpCockpit(data);
    }
    if (data.speedKmS !== undefined) {
      const value = `${formatNumber(Math.round(data.speedKmS))} km/s`;
      if (value !== this.cache.speedKm) {
        setText(this.el.speed, value);
        this.cache.speedKm = value;
      }
    }
    if (data.throttle !== undefined) {
      const percentage = clamp(Math.round(data.throttle * 100), 0, 100);
      if (percentage !== this.cache.throttle) {
        this.el.throttleFill.style.width = `${percentage}%`;
        setText(this.el.throttleValue, `${percentage}%`);
        this.cache.throttle = percentage;
      }
    }
    if (data.warpCharge !== undefined) {
      const percentage = clamp(Math.round(data.warpCharge * 100), 0, 100);
      if (percentage !== this.cache.warp) {
        this.el.warpFill.style.width = `${percentage}%`;
        setText(this.el.warpValue, `${percentage}%`);
        this.cache.warp = percentage;
      }
    }
    if (data.warpState !== undefined) {
      const classes = ['is-draining', 'is-exhausted'].filter((name) =>
        data.warpState === name.replace('is-', ''),
      );
      if (classes.join(' ') !== this.cache.warpClass) {
        this.el.warpMeter?.classList.remove('is-draining', 'is-exhausted');
        classes.forEach((name) => this.el.warpMeter?.classList.add(name));
        this.cache.warpClass = classes.join(' ');
      }
    }
    if (data.reactorTemp !== undefined) {
      const value = `${formatNumber(Math.round(data.reactorTemp))} K`;
      if (value !== this.cache.temp) {
        setText(this.el.reactorTemp, value);
        this.cache.temp = value;
      }
    }
    if (data.nearest !== undefined) {
      const value = `最近天体 · ${data.nearest}`;
      if (value !== this.cache.nearest) {
        setText(this.el.nearest, value);
        this.cache.nearest = value;
      }
    }
    if (data.heading !== undefined) {
      const value = String(Math.round(data.heading) % 360).padStart(3, '0');
      if (value !== this.cache.heading) {
        setText(this.el.heading, value);
        this.cache.heading = value;
      }
    }
    if (data.modeLabel !== undefined && data.modeLabel !== this.cache.mode) {
      setText(this.el.mode, data.modeLabel);
      this.cache.mode = data.modeLabel;
    }
    if (data.clock !== undefined) {
      const value = `T+ ${data.clock}`;
      if (value !== this.cache.clock) {
        setText(this.el.clock, value);
        this.cache.clock = value;
      }
    }
    if (data.reticleLabel !== undefined) {
      setText(this.el.reticleLabel, data.reticleLabel);
    }
    if (data.speedC !== undefined) {
      setText(this.el.coreSpeed, `${data.speedC.toFixed(3)} c`);
    }
    if (data.warpCharge !== undefined) {
      setText(this.el.coreWarp, `${Math.round(data.warpCharge * 100)}%`);
    }
    if (data.modeLabel !== undefined) {
      setText(this.el.coreMode, data.modeLabel);
    }
  }

  updateMission(data) {
    if (!data) return;
    setText(this.el.missionTarget, data.target || '—');
    setText(this.el.missionDistance, data.distance || '—');
    setText(this.el.missionBearing, data.bearing || '—');
    setText(this.el.missionObjective, data.objective || '');
    setText(this.el.missionProgress, data.progress || '');
  }

  setTacticalScan(active) {
    const next = Boolean(active);
    if (this.tacticalActive === next) return;
    this.tacticalActive = next;
    this.el.hud?.classList.toggle('is-tactical', next);
  }

  muteHints() {
    this.el.flightHints?.classList.add('is-muted');
  }

  hitMarker(killed = false) {
    const marker = this.el.hitMarker;
    if (!marker) return;
    marker.classList.remove('is-hit', 'is-kill');
    void marker.offsetWidth;
    marker.classList.add('is-hit');
    if (killed) marker.classList.add('is-kill');
    window.clearTimeout(this.hitTimer);
    this.hitTimer = window.setTimeout(() => {
      marker.classList.remove('is-hit', 'is-kill');
    }, 220);
  }

  showKillConfirm(name = '敌对目标') {
    if (!this.el.killConfirm) return;
    setText(this.el.killConfirmName, name);
    this.el.killConfirm.classList.add('is-visible');
    window.clearTimeout(this.killTimer);
    this.killTimer = window.setTimeout(() => {
      this.el.killConfirm.classList.remove('is-visible');
    }, 1500);
  }

  setCombatActive(active) {
    this.combatActive = Boolean(active);
    this.el.combatPanel?.classList.toggle('is-hidden', !this.combatActive);
    if (!this.combatActive) this.updateEnemyMarkers([]);
  }

  updateCombat(data) {
    if (!data) return;
    if (data.active && !this.combatActive) this.setCombatActive(true);

    const shieldPct = clamp((data.shield / data.shieldMax) * 100, 0, 100);
    const hullPct = clamp((data.hull / data.hullMax) * 100, 0, 100);
    const heatPct = clamp(data.heat, 0, 100);

    setText(this.el.combatWave, `WAVE ${String(data.wave).padStart(2, '0')}`);
    setText(this.el.combatKills, `击毁 ${String(data.kills).padStart(2, '0')}`);
    setText(this.el.combatEnemyCount, `${data.enemyCount} 个敌对信号`);

    if (this.el.combatShieldFill) {
      this.el.combatShieldFill.style.width = `${shieldPct.toFixed(1)}%`;
    }
    if (this.el.combatHullFill) {
      this.el.combatHullFill.style.width = `${hullPct.toFixed(1)}%`;
    }
    if (this.el.combatHeatFill) {
      this.el.combatHeatFill.style.width = `${heatPct.toFixed(1)}%`;
    }
    setText(this.el.combatShieldValue, String(Math.round(data.shield)).padStart(3, '0'));
    setText(this.el.combatHullValue, String(Math.round(data.hull)).padStart(3, '0'));
    setText(
      this.el.combatWeaponState,
      data.overheated ? '过热' : data.heat > 72 ? '高温' : data.firing ? '射击' : '就绪',
    );
    this.el.combatShieldBar?.classList.toggle('is-critical', shieldPct <= 28);
    this.el.combatHullBar?.classList.toggle('is-critical', hullPct <= 34);
    this.el.combatPanel?.classList.toggle('is-overheated', data.overheated);
    this.updateMissiles(data);

    if (data.targetName) {
      setText(this.el.combatTarget, `${data.targetName} · LOCKED`);
      setText(
        this.el.combatTargetDistance,
        data.targetDistance == null ? '' : `${formatNumber(Math.round(data.targetDistance))} m`,
      );
    } else {
      setText(this.el.combatTarget, '扫描敌方信号...');
      setText(
        this.el.combatTargetDistance,
        data.nextWaveIn != null && data.nextWaveIn > 0
          ? `下一波 ${Math.ceil(data.nextWaveIn)}s`
          : '',
      );
    }

    /* The compact core panel is the permanent combat readout. */
    if (this.el.coreShieldFill) this.el.coreShieldFill.style.width = `${shieldPct.toFixed(1)}%`;
    if (this.el.coreHullFill) this.el.coreHullFill.style.width = `${hullPct.toFixed(1)}%`;
    if (this.el.coreHeatFill) this.el.coreHeatFill.style.width = `${heatPct.toFixed(1)}%`;
    setText(this.el.coreShieldValue, String(Math.round(data.shield)).padStart(3, '0'));
    setText(this.el.coreHullValue, String(Math.round(data.hull)).padStart(3, '0'));
    setText(
      this.el.coreWeaponState,
      data.overheated ? '过热' : data.heat > 72 ? '高温' : data.firing ? '射击' : '就绪',
    );
    setText(this.el.coreKills, String(data.kills || 0).padStart(2, '0'));
    this.el.coreStatus?.classList.toggle('is-critical', shieldPct <= 28 || hullPct <= 34);
    this.el.coreShieldBar?.classList.toggle('is-critical', shieldPct <= 28);
    this.el.coreHullBar?.classList.toggle('is-critical', hullPct <= 34);
    this.el.coreHeatBar?.classList.toggle('is-hot', data.heat > 72 && !data.overheated);
    this.el.coreHeatBar?.classList.toggle('is-overheated', Boolean(data.overheated));
  }

  updateCredits(value, delta = null) {
    setText(this.el.hudCredits, Math.round(Number(value) || 0).toLocaleString('en-US'));
    if (Number.isFinite(delta) && delta !== 0) this.floatCredits(delta);
  }

  floatCredits(amount) {
    const layer = this.el.creditFloaters;
    if (!layer) return;
    const floater = document.createElement('span');
    floater.className = `credit-floater${amount >= 0 ? ' is-gain' : ' is-loss'}`;
    floater.textContent = `${amount >= 0 ? '+' : '−'}${Math.abs(Math.round(amount))} CR`;
    layer.append(floater);
    window.setTimeout(() => floater.remove(), 1600);
  }

  updateMissiles(data) {
    if (!this.el.missilePips) return;
    const max = data.missileMax || 4;
    const left = data.missiles == null ? max : data.missiles;
    const pips = this.el.missilePips.children;
    for (let i = 0; i < pips.length; i += 1) {
      pips[i].classList.toggle('is-empty', i >= left);
    }
    const cooling = (data.missileTimer || 0) > 0;
    if (this.el.missileState) {
      this.el.missileState.innerHTML = cooling
        ? `装填 ${(data.missileTimer || 0).toFixed(1)}s`
        : left > 0
          ? '<kbd>R</kbd> 发射'
          : '弹药耗尽';
    }
  }

  showAbortConfirm(data = {}) {
    const screen = this.el.abortScreen;
    if (!screen) return;
    setText(this.el.abortKills, String(data.kills || 0).padStart(2, '0'));
    setText(this.el.abortTime, data.time || '00:00');
    setText(this.el.abortHull, `${Math.round(data.hull || 0)}%`);
    setText(this.el.abortCredits, `${Math.round(data.credits || 0).toLocaleString('en-US')} CR`);
    screen.classList.remove('is-hidden');
    screen.classList.add('is-visible');
    document.body.classList.add('is-abort-open');
  }

  hideAbortConfirm() {
    const screen = this.el.abortScreen;
    if (!screen) return;
    screen.classList.add('is-hidden');
    screen.classList.remove('is-visible');
    document.body.classList.remove('is-abort-open');
  }

  setAbortEnabled(enabled) {
    if (this.el.abortButton) this.el.abortButton.classList.toggle('is-hidden', !enabled);
    if (!enabled) this.hideAbortConfirm();
  }

  updateContract(data) {
    const chip = this.el.contractChip;
    if (!chip) return;
    const visible = Boolean(data && data.visible);
    chip.classList.toggle('is-hidden', !visible);
    if (!visible) return;
    setText(this.el.contractKicker, data.kicker || 'CONTRACT / 合约');
    setText(this.el.contractTitle, data.title || '—');
    setText(this.el.contractProgress, data.progressText || `${data.progress || 0} / ${data.need || 0}`);
    setText(this.el.contractReward, `+${data.reward || 0} CR`);
    setText(this.el.contractCredits, `CR ${data.credits || 0}`);
    setText(this.el.contractRank, data.rankCn || '见习舰长');
    setText(this.el.contractDesc, data.desc || '');
    chip.classList.toggle('is-complete', Boolean(data.pending));
  }

  updateEnemyMarkers(items = []) {
    const layer = this.el.enemyMarkers;
    if (!layer) return;
    const visibleIds = new Set();

    items.forEach((item) => {
      if (item.visible === false) return;
      visibleIds.add(item.id);
      let marker = this.enemyMarkerNodes.get(item.id);
      if (!marker) {
        const root = makeElement('div', 'enemy-marker');
        const diamond = makeElement('span', 'enemy-marker__diamond');
        const name = makeElement('div', 'enemy-marker__name');
        const nameText = makeElement('span', '', item.name);
        const hostile = makeElement('span', '', 'HOSTILE');
        name.append(nameText, hostile);
        const bars = makeElement('div', 'enemy-marker__bars');
        const shieldBar = makeElement('div', 'enemy-marker__bar enemy-marker__bar--shield');
        const shieldFill = document.createElement('i');
        shieldBar.append(shieldFill);
        const hullBar = makeElement('div', 'enemy-marker__bar enemy-marker__bar--hull');
        const hullFill = document.createElement('i');
        hullBar.append(hullFill);
        bars.append(shieldBar, hullBar);
        const distance = makeElement('div', 'enemy-marker__distance');
        root.append(diamond, name, bars, distance);
        layer.append(root);
        marker = {
          root,
          shieldFill,
          hullFill,
          distance,
        };
        this.enemyMarkerNodes.set(item.id, marker);
      }

      marker.root.style.left = `${item.x}px`;
      marker.root.style.top = `${item.y}px`;
      marker.root.classList.toggle('is-locked', Boolean(item.locked));
      marker.root.classList.toggle('is-compact', Boolean(item.compact));
      marker.root.classList.toggle('is-offscreen', !item.visible);
      marker.shieldFill.style.width = `${clamp(
        (item.shield / item.shieldMax) * 100,
        0,
        100,
      )}%`;
      marker.hullFill.style.width = `${clamp(
        (item.hull / item.hullMax) * 100,
        0,
        100,
      )}%`;
      setText(
        marker.distance,
        `${formatNumber(Math.round(item.distance))} m`,
      );
    });

    for (const [id, marker] of this.enemyMarkerNodes) {
      if (!visibleIds.has(id)) {
        marker.root.remove();
        this.enemyMarkerNodes.delete(id);
      }
    }
  }

  flashDamage(strength = 1, side = null) {
    const element = this.el.damageFlash;
    if (!element) return;
    element.style.setProperty(
      '--damage-alpha',
      String(clamp(0.45 + strength * 0.32, 0.45, 0.95)),
    );
    element.classList.remove(
      'is-active',
      'from-front',
      'from-back',
      'from-left',
      'from-right',
    );
    if (side && ['front', 'back', 'left', 'right'].includes(side)) {
      element.classList.add(`from-${side}`);
    }
    void element.offsetWidth;
    element.classList.add('is-active');
    window.clearTimeout(this.damageTimer);
    this.damageTimer = window.setTimeout(() => {
      element.classList.remove('is-active');
    }, 420);
  }

  showDefeat({ kills = 0, wave = 1, time = 0 } = {}) {
    setText(this.el.defeatKills, String(kills).padStart(2, '0'));
    setText(this.el.defeatWave, `WAVE ${String(wave).padStart(2, '0')}`);
    setText(this.el.defeatTime, this.formatClock(time));
    this.setCombatActive(false);
    this.el.defeat?.classList.remove('is-hidden');
    requestAnimationFrame(() => this.el.defeat?.classList.add('is-visible'));
    this.el.hud?.classList.add('is-hidden');
    this.el.touch?.classList.add('is-hidden');
    this.setMode('defeat');
  }

  hideDefeat() {
    this.el.defeat?.classList.remove('is-visible');
    window.setTimeout(() => this.el.defeat?.classList.add('is-hidden'), 550);
    this.el.hud?.classList.remove('is-hidden');
    this.setMode('flight');
    this.el.hud?.classList.add('is-live');
    this.syncTouchVisibility();
  }

  formatClock(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0',
    )}:${String(secs).padStart(2, '0')}`;
  }

  setAutopilot(active) {
    this.el.autopilotButton?.classList.toggle('is-active', active);
    setText(this.el.autopilotLabel, active ? '自动导航中' : '自动导航');
    if (this.el.autopilotButton) {
      this.el.autopilotButton.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  setMuted(muted) {
    this.el.sound?.classList.toggle('is-muted', muted);
    if (this.el.soundGlyph) this.el.soundGlyph.textContent = muted ? '◗' : '◖';
    this.el.sound?.setAttribute('aria-label', muted ? '取消静音' : '静音');
  }

  flashWarp() {
    if (!this.el.warpFlash) return;
    this.el.warpFlash.classList.add('is-active');
    window.setTimeout(() => this.el.warpFlash.classList.remove('is-active'), 280);
  }

  setWarpCockpit(active) {
    const next = Boolean(active);
    if (this.warpCockpitActive === next) return;
    this.warpCockpitActive = next;
    this.el.warpCockpit?.classList.toggle('is-active', next);
    this.el.warpCockpit?.setAttribute('aria-hidden', next ? 'false' : 'true');
    this.el.hud?.classList.toggle('is-warp-cockpit', next);
    document.body.classList.toggle('is-warp-fp', next);
  }

  updateWarpCockpit(data) {
    if (!data) return;
    if (data.speedC !== undefined) {
      setText(this.el.warpCockpitSpeed, `${data.speedC.toFixed(3)} c`);
    }
  }

  showAlert(message, duration = 2600) {
    if (!this.el.alert) return;
    setText(this.el.alert, message);
    this.el.alert.classList.add('is-visible');
    window.clearTimeout(this.alertTimer);
    this.alertTimer = window.setTimeout(() => {
      this.el.alert.classList.remove('is-visible');
    }, duration);
  }

  drawRadar(data) {
    const context = this.radarCtx;
    if (!context) return;
    const size = 220;
    const center = size / 2;
    const radius = 96;
    context.clearRect(0, 0, size, size);
    context.save();
    context.translate(center, center);

    context.strokeStyle = 'rgba(139, 233, 255, 0.1)';
    context.lineWidth = 1;
    [0.33, 0.66, 1].forEach((fraction) => {
      context.beginPath();
      context.arc(0, 0, radius * fraction, 0, Math.PI * 2);
      context.stroke();
    });
    context.strokeStyle = 'rgba(139, 233, 255, 0.07)';
    context.beginPath();
    context.moveTo(-radius, 0);
    context.lineTo(radius, 0);
    context.moveTo(0, -radius);
    context.lineTo(0, radius);
    context.stroke();

    if (!data) {
      context.restore();
      return;
    }

    const yaw = data.yaw || 0;
    const range = 27000;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const toScreen = (worldX, worldZ) => {
      const dx = worldX - data.player.x;
      const dz = worldZ - data.player.z;
      const rotatedX = dx * cos - dz * sin;
      const rotatedY = dx * sin + dz * cos;
      return [rotatedX, rotatedY];
    };

    const drawBody = (x, z, color, selected, discovered) => {
      const [rawX, rawY] = toScreen(x, z);
      const distance = Math.hypot(rawX, rawY);
      const clamped = Math.min(distance, radius - 4) / Math.max(distance, 0.001);
      const px = rawX * clamped;
      const py = rawY * clamped;
      const isClipped = distance > radius - 4;
      context.globalAlpha = isClipped ? 0.35 : 1;
      if (selected) {
        context.strokeStyle = 'rgba(139, 233, 255, 0.72)';
        context.lineWidth = 1;
        context.beginPath();
        context.arc(px, py, 6.5, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = 'rgba(139, 233, 255, 0.24)';
        context.beginPath();
        context.arc(px, py, 11, 0, Math.PI * 2);
        context.stroke();
      }
      context.fillStyle = color;
      context.globalAlpha *= discovered ? 0.95 : 0.48;
      context.beginPath();
      context.arc(px, py, selected ? 3 : 2.1, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    };

    if (data.sun) {
      const [x, y] = toScreen(data.sun.x, data.sun.z);
      const distance = Math.hypot(x, y);
      const clamped = Math.min(distance, radius - 2) / Math.max(distance, 0.001);
      context.fillStyle = 'rgba(255, 190, 120, 0.75)';
      context.globalAlpha = 0.8;
      context.beginPath();
      context.arc(x * clamped, y * clamped, 2.6, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }

    data.planets.forEach((planet) => {
      const selected = planet.key === data.targetKey;
      drawBody(planet.x, planet.z, planet.color || '#8be9ff', selected, planet.discovered);
    });

    if (Array.isArray(data.enemies)) {
      /* Contacts use a local combat scale, not the 27,000-unit planet
         scale, so a raider at 300 m is actually visible on the dial. */
      const combatRange = 1200;
      const localScale = radius / combatRange;
      data.enemies.forEach((enemy) => {
        const [rawX, rawY] = toScreen(enemy.x, enemy.z);
        let px = rawX * localScale;
        let py = rawY * localScale;
        const offScale = Math.hypot(px, py) > radius - 4;
        if (offScale) {
          const factor = (radius - 4) / Math.max(Math.hypot(px, py), 0.001);
          px *= factor;
          py *= factor;
        }
        context.fillStyle = '#ff705b';
        context.globalAlpha = offScale ? 0.42 : 0.95;
        context.beginPath();
        context.arc(px, py, 2.6, 0, Math.PI * 2);
        context.fill();
        if (enemy.locked) {
          context.strokeStyle = 'rgba(255, 190, 120, 0.85)';
          context.lineWidth = 1;
          context.beginPath();
          context.arc(px, py, 6.4, 0, Math.PI * 2);
          context.stroke();
        }
        context.globalAlpha = 1;
      });
    }

    context.restore();
  }

  /* ── ship inspection ───────────────────────────────────── */

  buildShipParts(parts) {
    this.parts = parts;
    if (!this.el.partList) return;
    this.el.partList.replaceChildren();
    if (this.el.partMarkers) this.el.partMarkers.replaceChildren();
    this.partItems.clear();
    this.partMarkers.clear();

    parts.forEach((part) => {
      const item = makeElement('button', 'part-item');
      item.type = 'button';
      item.dataset.id = part.id;
      item.setAttribute('role', 'listitem');
      item.style.setProperty('--part-accent', part.accent || '#8be9ff');

      const index = makeElement('span', 'part-item__index', part.index);
      const names = makeElement('span', 'part-item__names');
      const cn = makeElement('span', 'part-item__cn', part.cn);
      const en = makeElement('span', 'part-item__en', part.en);
      const state = makeElement('span', 'part-item__state', '已分离');
      names.append(cn, en);
      item.append(index, names, state);
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.callbacks.onSelectPart?.(part.id);
      });
      this.el.partList.append(item);
      this.partItems.set(part.id, item);

      if (!this.el.partMarkers) return;
      const marker = makeElement('button', 'part-marker');
      marker.type = 'button';
      marker.dataset.id = part.id;
      const line = makeElement('span', 'part-marker__line');
      const markerIndex = makeElement('span', 'part-marker__index', part.index);
      const text = makeElement('span', 'part-marker__text');
      const markerCn = makeElement('span', 'part-marker__cn', part.cn);
      const markerEn = makeElement('span', 'part-marker__en', part.en);
      text.append(markerCn, markerEn);
      marker.append(line, markerIndex, text);
      marker.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.callbacks.onSelectPart?.(part.id);
      });
      this.el.partMarkers.append(marker);
      this.partMarkers.set(part.id, marker);
    });

    if (parts.length) this.selectPart(parts[0]);
  }

  selectPart(part) {
    if (!part) return;
    this.currentPartId = part.id;
    setText(this.el.partIndex, part.index);
    setText(this.el.partCn, part.cn);
    setText(this.el.partEn, part.en);
    setText(this.el.partCode, `NX / ${part.id.toUpperCase()}`);
    setText(this.el.partSubsystem, part.subsystem.toUpperCase());
    setText(this.el.partDesc, part.description);
    if (this.el.partSpecs) {
      this.el.partSpecs.replaceChildren();
      part.specs.forEach(([label, value]) => {
        const spec = makeElement('div', 'part-spec');
        spec.append(
          makeElement('span', 'part-spec__label', label),
          makeElement('span', 'part-spec__value', value),
        );
        this.el.partSpecs.append(spec);
      });
    }

    this.partItems.forEach((item, id) => {
      item.classList.toggle('is-active', id === part.id);
      item.setAttribute('aria-current', id === part.id ? 'true' : 'false');
    });
    this.partMarkers.forEach((marker, id) => {
      marker.classList.toggle('is-selected', id === part.id);
    });

    if (this.el.detachButton) {
      this.el.detachButton.disabled = !part.canDetach;
      this.el.detachButton.classList.toggle('is-disabled', !part.canDetach);
      const label = this.el.detachButton.querySelector('span:first-child');
      const en = this.el.detachButton.querySelector('.panel-button__en');
      setText(label, part.canDetach ? '分离模块' : '核心模块锁定');
      setText(en, part.canDetach ? 'DETACH' : 'LOCKED');
    }
    this.setDetachedState(part.id, Boolean(part.detached));
  }

  setDetachedState(id, detached) {
    this.partItems.get(id)?.classList.toggle('is-detached', detached);
    this.partMarkers.get(id)?.classList.toggle('is-detached', detached);
    if (id !== this.currentPartId) return;
    const part = this.parts.find((entry) => entry.id === id);
    if (this.el.detachButton && part) {
      this.el.detachButton.classList.toggle('is-detached', detached);
      const label = this.el.detachButton.querySelector('span:first-child');
      const en = this.el.detachButton.querySelector('.panel-button__en');
      setText(label, part.canDetach ? (detached ? '接回模块' : '分离模块') : '核心模块锁定');
      setText(en, part.canDetach ? (detached ? 'RECONNECT' : 'DETACH') : 'LOCKED');
    }
  }

  setExploded(exploded) {
    this.exploded = Boolean(exploded);
    this.el.explodeButton?.classList.toggle('is-active', this.exploded);
    setText(this.el.explodeLabel, this.exploded ? '收拢结构' : '全舰分解');
  }

  setPartMarkersData(items) {
    items.forEach((item) => {
      const marker = this.partMarkers.get(item.id);
      if (!marker) return;
      if (!item.visible) {
        marker.classList.remove('is-visible');
        marker.style.pointerEvents = 'none';
        return;
      }
      marker.classList.add('is-visible');
      marker.style.pointerEvents = 'auto';
      marker.style.left = `${item.x.toFixed(1)}px`;
      marker.style.top = `${item.y.toFixed(1)}px`;
      marker.classList.toggle('is-flipped', Boolean(item.flipped));
    });
  }

  updatePartList(parts) {
    parts.forEach((part) => {
      const item = this.partItems.get(part.id);
      if (item) item.classList.toggle('is-detached', Boolean(part.detached));
      const marker = this.partMarkers.get(part.id);
      if (marker) marker.classList.toggle('is-detached', Boolean(part.detached));
    });
  }

  /* ── toasts / chapters / complete ─────────────────────── */

  showToast({ kicker = 'SYSTEM', title = '', text = '', tone = 'discovery', duration = 4400 }) {
    if (!this.el.toastStack) return;
    const toast = makeElement('div', `toast toast--${tone}`);
    const mark = makeElement('span', 'toast__mark');
    const body = makeElement('span', 'toast__body');
    const kick = makeElement('span', 'toast__kicker', kicker);
    const heading = makeElement('span', 'toast__title', title);
    body.append(kick, heading);
    if (text) body.append(makeElement('span', 'toast__text', text));
    toast.append(mark, body);
    this.el.toastStack.append(toast);
    this.toasts.push(toast);
    if (this.toasts.length > 3) {
      const oldest = this.toasts.shift();
      oldest?.remove();
    }
    const remove = () => {
      if (!toast.isConnected) return;
      toast.classList.add('is-leaving');
      window.setTimeout(() => {
        toast.remove();
        this.toasts = this.toasts.filter((entry) => entry !== toast);
      }, 460);
    };
    window.setTimeout(remove, duration);
  }

  showChapter(kicker, title, sub) {
    if (!this.el.chapter) return;
    setText(this.el.chapterKicker, kicker);
    setText(this.el.chapterTitle, title);
    setText(this.el.chapterSub, sub);
    this.el.chapter.classList.remove('is-visible');
    void this.el.chapter.offsetWidth;
    this.el.chapter.classList.add('is-visible');
    window.clearTimeout(this.chapterTimer);
    this.chapterTimer = window.setTimeout(() => {
      this.el.chapter?.classList.remove('is-visible');
    }, 4900);
  }

  showComplete({ planets = '8 / 8', time = '00:00', distance = '0 km' } = {}) {
    setText(this.el.completePlanets, planets);
    setText(this.el.completeTime, time);
    setText(this.el.completeDistance, distance);
    this.el.complete?.classList.remove('is-hidden');
    requestAnimationFrame(() => this.el.complete?.classList.add('is-visible'));
    this.setMode('complete');
    this.el.hud?.classList.add('is-hidden');
    this.syncTouchVisibility();
  }

  hideComplete() {
    this.el.complete?.classList.remove('is-visible');
    window.setTimeout(() => this.el.complete?.classList.add('is-hidden'), 550);
    this.el.hud?.classList.remove('is-hidden');
    this.setMode('flight');
    this.el.hud?.classList.add('is-live');
  }

  showError(message) {
    if (message) setText(this.el.errorMessage, message);
    this.el.boot?.classList.add('is-hidden');
    this.el.start?.classList.add('is-hidden');
    this.el.hud?.classList.add('is-hidden');
    this.el.inspect?.classList.add('is-hidden');
    this.el.error?.classList.remove('is-hidden');
  }
}

export function createUI(callbacks) {
  return new GameUI(callbacks);
}