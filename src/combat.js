import * as THREE from 'three';
import { clamp, randRange } from './utils.js';
import { createGlowTexture } from './textures.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

const PLAYER_MAX_SHIELD = 100;
const PLAYER_MAX_HULL = 100;
const MISSILE_MAX = 4;
const MISSILE_COOLDOWN = 3.2;
const MISSILE_SPEED = 1250;
const MISSILE_MAX_SPEED = 2100;
const MISSILE_TURN = 3.4;
const MISSILE_LIFE = 6.5;
const MISSILE_DAMAGE = 38;

const PLAYER_FIRE_INTERVAL = 0.18;
const PLAYER_HEAT_PER_SHOT = 5.2;
const PLAYER_COOL_RATE = 17;
const PLAYER_SHIELD_REGEN = 7.5;
const PLAYER_SHIELD_DELAY = 4.6;
const PLAYER_LOCK_RANGE = 780;
const PLAYER_LOCK_COS = Math.cos(THREE.MathUtils.degToRad(17));
const ENEMY_MAX_SHIELD = 42;
const ENEMY_MAX_HULL = 58;
const ENEMY_BOLT_SPEED = 640;
const ENEMY_BOLT_LIFE = 3.4;

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();

function dampValue(current, target, lambda, dt) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function glowSprite(map, color, size, opacity = 0.75) {
  const material = new THREE.SpriteMaterial({
    map,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  return sprite;
}

function makeWingGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0.7, -1.6);
  shape.lineTo(6.4, 1.1);
  shape.lineTo(5.5, 2.6);
  shape.lineTo(0.5, 2.2);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.06,
    bevelSegments: 1,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0.06, 0);
  return geometry;
}

export class CombatSystem {
  constructor({ scene, ship, audio, callbacks = {} }) {
    this.scene = scene;
    this.ship = ship;
    this.audio = audio;
    this.callbacks = callbacks;
    this.active = false;
    this.defeated = false;
    this.time = 0;
    this.spawnAt = 2.8;
    this.wave = 1;
    this.kills = 0;
    this.enemies = [];
    this.projectiles = [];
    this.missiles = [];
    this.effects = [];
    this.nextEnemyId = 1;
    this.firing = false;
    this.target = null;
    this.weaponPods = null;
    this.shieldBubble = null;
    this.shieldFlash = 0;
    this.waveNoticeShown = false;

    this.player = {
      shield: PLAYER_MAX_SHIELD,
      shieldMax: PLAYER_MAX_SHIELD,
      hull: PLAYER_MAX_HULL,
      hullMax: PLAYER_MAX_HULL,
      heat: 0,
      overheated: false,
      fireTimer: 0,
      lastHitAt: -100,
      kills: 0,
      missiles: MISSILE_MAX,
      missileMax: MISSILE_MAX,
      missileTimer: 0,
    };

    this.glowTexture = createGlowTexture('rgba(255,255,255,1)');
    this.geometries = {
      body: new THREE.CylinderGeometry(0.72, 1.08, 5.8, 6, 1),
      nose: new THREE.ConeGeometry(0.92, 3.6, 5),
      wing: makeWingGeometry(),
      fin: new THREE.BoxGeometry(0.22, 2.8, 2.2),
      engine: new THREE.CylinderGeometry(0.38, 0.52, 2.5, 6),
      engineGlow: new THREE.CylinderGeometry(0.28, 0.28, 0.16, 8),
      cockpit: new THREE.SphereGeometry(0.58, 8, 6),
      bolt: new THREE.SphereGeometry(0.48, 8, 6),
      beam: new THREE.CylinderGeometry(0.13, 0.13, 1, 6, 1, true),
      shield: new THREE.SphereGeometry(28, 24, 12),
    };
    this.geometries.body.rotateX(Math.PI / 2);
    this.geometries.nose.rotateX(-Math.PI / 2);

    this.materials = {
      body: new THREE.MeshStandardMaterial({
        color: 0x2a151b,
        metalness: 0.72,
        roughness: 0.42,
        emissive: 0x200408,
        emissiveIntensity: 0.5,
      }),
      armor: new THREE.MeshStandardMaterial({
        color: 0x11161a,
        metalness: 0.85,
        roughness: 0.34,
        emissive: 0x090a0c,
        emissiveIntensity: 0.25,
      }),
      accent: new THREE.MeshBasicMaterial({
        color: 0xff6048,
        toneMapped: false,
      }),
      cockpit: new THREE.MeshStandardMaterial({
        color: 0x401016,
        metalness: 0.25,
        roughness: 0.18,
        transparent: true,
        opacity: 0.82,
        emissive: 0x77161c,
        emissiveIntensity: 0.8,
      }),
      bolt: new THREE.MeshBasicMaterial({
        color: 0xff5b42,
        toneMapped: false,
      }),
      shield: new THREE.MeshBasicMaterial({
        color: 0x8be9ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    };

    this._buildPlayerEquipment();
  }

  _buildPlayerEquipment() {
    this.weaponPods = new THREE.Group();
    this.weaponPods.name = 'NX-07 / COMBAT PACKAGE';
    const podMaterial = new THREE.MeshStandardMaterial({
      color: 0x252f34,
      metalness: 0.75,
      roughness: 0.35,
      emissive: 0x061014,
      emissiveIntensity: 0.4,
    });
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x8be9ff,
      toneMapped: false,
    });

    for (const side of [-1, 1]) {
      const pod = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.62, 3.8, 8),
        podMaterial,
      );
      body.rotation.x = Math.PI / 2;
      body.position.y = 0.34;
      pod.add(body);

      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.48, 0.11, 6, 10),
        podMaterial,
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, 0.34, -1.6);
      pod.add(collar);

      const muzzle = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.07, 6, 10),
        ringMaterial,
      );
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(0, 0.34, -2.12);
      pod.add(muzzle);

      const glow = glowSprite(this.glowTexture, 0x6de6ff, 2.2, 0.35);
      glow.position.set(0, 0.34, -2.12);
      pod.add(glow);

      pod.position.set(side * 9.8, 0.2, -5.6);
      this.weaponPods.add(pod);
    }
    this.ship.root.add(this.weaponPods);

    this.shieldBubble = new THREE.Mesh(
      this.geometries.shield,
      this.materials.shield,
    );
    this.shieldBubble.position.set(0, 2, 1);
    this.shieldBubble.scale.set(1, 0.86, 1.15);
    this.shieldBubble.renderOrder = 3;
    this.ship.root.add(this.shieldBubble);
  }

  _createEnemyGlow(color, size, opacity = 0.85) {
    return glowSprite(this.glowTexture, color, size, opacity);
  }

  _makeEnemy(id) {
    const group = new THREE.Group();
    group.name = `RAIDER-${String(id).padStart(2, '0')}`;

    const body = new THREE.Mesh(this.geometries.body, this.materials.body);
    group.add(body);

    const nose = new THREE.Mesh(this.geometries.nose, this.materials.armor);
    nose.position.z = -3.35;
    group.add(nose);

    const wingL = new THREE.Mesh(this.geometries.wing, this.materials.armor);
    wingL.scale.x = -1;
    group.add(wingL);
    const wingR = new THREE.Mesh(this.geometries.wing, this.materials.armor);
    group.add(wingR);

    const wingTipMaterial = this.materials.accent;
    for (const side of [-1, 1]) {
      const tip = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.08, 1.45),
        wingTipMaterial,
      );
      tip.position.set(side * 5.9, 0.14, 1.85);
      group.add(tip);
    }

    const fin = new THREE.Mesh(this.geometries.fin, this.materials.body);
    fin.position.set(0, 1.32, 2.2);
    fin.rotation.x = -0.18;
    group.add(fin);

    for (const side of [-1, 1]) {
      const engine = new THREE.Mesh(
        this.geometries.engine,
        this.materials.armor,
      );
      engine.rotation.x = Math.PI / 2;
      engine.position.set(side * 1.25, 0, 3.3);
      group.add(engine);

      const exhaust = new THREE.Mesh(
        this.geometries.engineGlow,
        this.materials.accent,
      );
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(side * 1.25, 0, 4.58);
      group.add(exhaust);

      const engineGlow = this._createEnemyGlow(0xff4f35, 3.4, 0.75);
      engineGlow.position.set(side * 1.25, 0, 4.8);
      group.add(engineGlow);
    }

    const cockpit = new THREE.Mesh(
      this.geometries.cockpit,
      this.materials.cockpit,
    );
    cockpit.scale.set(0.82, 0.72, 1.45);
    cockpit.position.set(0, 0.48, -1.25);
    group.add(cockpit);

    const belly = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.18, 2.4),
      this.materials.accent,
    );
    belly.position.set(0, -0.58, 0.8);
    group.add(belly);

    const contactGlow = this._createEnemyGlow(0xff4a36, 7.0, 0.24);
    contactGlow.position.set(0, 0, 2.2);
    group.add(contactGlow);

    group.scale.setScalar(randRange(Math.random, 1.9, 2.3));
    group.userData.enemyId = id;
    return group;
  }

  start() {
    this.active = true;
    this.defeated = false;
    this.time = 0;
    this.wave = 1;
    this.kills = 0;
    this.spawnAt = 2.7;
    this.player.shield = PLAYER_MAX_SHIELD;
    this.player.hull = PLAYER_MAX_HULL;
    this.player.heat = 0;
    this.player.overheated = false;
    this.player.fireTimer = 0;
    this.player.lastHitAt = -100;
    this.player.kills = 0;
    this.firing = false;
    this.target = null;
    this.waveNoticeShown = false;
    this._clearEnemies();
    this._clearProjectiles();
    this._clearEffects();
    this.weaponPods.visible = true;
    this.shieldBubble.material.opacity = 0;
  }

  setActive(active) {
    this.active = Boolean(active);
    for (const missile of this.missiles) missile.group.visible = this.active;
    if (!this.active) {
      this.firing = false;
      this.target = null;
    }
    /* Inspection and other overlays pause the encounter; keep its actors
       in memory but out of the clean ship-view. */
    for (const enemy of this.enemies) enemy.group.visible = this.active;
    for (const projectile of this.projectiles) projectile.mesh.visible = this.active;
  }

  setFiring(firing) {
    this.firing = Boolean(firing) && this.active && !this.defeated;
  }

  respawn() {
    this.start();
    this.spawnAt = 2.1;
  }

  stop() {
    this.active = false;
    this.defeated = false;
    this.firing = false;
    this.target = null;
    this._clearEnemies();
    this._clearProjectiles();
    this._clearEffects();
    this.materials.shield.opacity = 0;
  }

  _clearEnemies() {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.group);
    }
    this.enemies.length = 0;
  }

  _clearProjectiles() {
    for (const projectile of this.projectiles) {
      this.scene.remove(projectile.mesh);
    }
    this.projectiles.length = 0;
  }

  _clearEffects() {
    for (const effect of this.effects) {
      this.scene.remove(effect.object);
      effect.material?.dispose?.();
      effect.spriteMaterial?.dispose?.();
    }
    this.effects.length = 0;
  }

  _spawnWave() {
    if (!this.active || this.defeated) return;
    const count = Math.min(3 + this.wave, 7);
    const playerPos = this.ship.root.position;
    const forward = _v1.set(0, 0, -1).applyQuaternion(this.ship.root.quaternion);
    const right = _v2.set(1, 0, 0).applyQuaternion(this.ship.root.quaternion);
    const up = _v3.set(0, 1, 0).applyQuaternion(this.ship.root.quaternion);

    for (let i = 0; i < count; i += 1) {
      const enemy = {
        id: this.nextEnemyId++,
        name: `RAIDER ${String(i + 1).padStart(2, '0')}`,
        group: this._makeEnemy(this.nextEnemyId - 1),
        shield: ENEMY_MAX_SHIELD,
        shieldMax: ENEMY_MAX_SHIELD,
        hull: ENEMY_MAX_HULL,
        hullMax: ENEMY_MAX_HULL,
        phase: Math.random() * Math.PI * 2,
        angularSpeed: randRange(Math.random, 0.12, 0.24) * (Math.random() < 0.5 ? -1 : 1),
        radius: randRange(Math.random, 210, 330),
        height: randRange(Math.random, -8, 52),
        fireTimer: randRange(Math.random, 1.1, 3.4),
        velocity: new THREE.Vector3(),
      };

      const spread = (i - (count - 1) / 2) * 0.24;
      const distance = 300 + i * 24 + Math.random() * 42;
      enemy.group.position
        .copy(playerPos)
        .addScaledVector(forward, Math.cos(spread) * distance)
        .addScaledVector(right, Math.sin(spread) * distance)
        .addScaledVector(up, Math.random() * 44 - 24);
      enemy.group.quaternion.copy(this.ship.root.quaternion);
      this.scene.add(enemy.group);
      this.enemies.push(enemy);
    }

    this.spawnAt = Infinity;
    this.waveNoticeShown = true;
    this.callbacks.onWave?.({
      wave: this.wave,
      count: this.enemies.length,
    });
    this._playTone(180, 360, 0.42, 0.04, 'sawtooth');
    this._playTone(360, 720, 0.26, 0.025, 'triangle', 0.14);
  }

  _playTone(frequency, endFrequency, duration, volume, type = 'sine', delay = 0) {
    try {
      this.audio?.tone?.({ frequency, endFrequency, duration, volume, type, delay });
    } catch {
      /* Audio is optional. */
    }
  }

  _noise(duration, volume, frequency) {
    try {
      this.audio?.noiseBurst?.({ duration, volume, frequency });
    } catch {
      /* Audio is optional. */
    }
  }

  _acquireTarget(forward, playerPos) {
    let best = null;
    let bestScore = -Infinity;
    for (const enemy of this.enemies) {
      _v1.copy(enemy.group.position).sub(playerPos);
      const distance = _v1.length();
      if (distance > PLAYER_LOCK_RANGE || distance < 1) continue;
      const dot = forward.dot(_v1.normalize());
      if (dot < PLAYER_LOCK_COS) continue;
      const score = dot * 1.3 - distance / (PLAYER_LOCK_RANGE * 2.2);
      if (score > bestScore) {
        bestScore = score;
        best = enemy;
      }
    }
    this.target = best;
    return best;
  }

  _fire() {
    if (this.player.overheated || this.defeated) return;
    const playerPos = this.ship.root.position;
    const forward = _v1.set(0, 0, -1).applyQuaternion(this.ship.root.quaternion);
    const target = this._acquireTarget(forward, playerPos);

    this.player.fireTimer = PLAYER_FIRE_INTERVAL;
    this.player.heat = Math.min(100, this.player.heat + PLAYER_HEAT_PER_SHOT);
    if (this.player.heat >= 100) {
      this.player.overheated = true;
      this.callbacks.onWeaponOverheat?.();
    }

    const localMuzzles = [
      [-9.8, 0.5, -7.5],
      [9.8, 0.5, -7.5],
    ];
    this.ship.root.updateMatrixWorld();
    for (const local of localMuzzles) {
      const origin = this.ship.root.localToWorld(
        new THREE.Vector3(local[0], local[1], local[2]),
      );
      let endpoint;
      if (target) {
        endpoint = _v2.copy(target.group.position);
        const distance = origin.distanceTo(endpoint);
        endpoint.addScaledVector(target.velocity, distance / 1800);
        endpoint.x += randRange(Math.random, -0.7, 0.7);
        endpoint.y += randRange(Math.random, -0.5, 0.5);
        endpoint.z += randRange(Math.random, -0.7, 0.7);
      } else {
        endpoint = _v2.copy(origin).addScaledVector(forward, 520);
      }
      this._spawnBeam(origin, endpoint, 0x7defff, 0.12);
      this._spawnMuzzle(origin, 0x8be9ff);
    }

    if (target) {
      this._damageEnemy(target, 12.5, target.group.position);
    }
    this._playTone(980, 310, 0.09, 0.022, 'square');
    this.callbacks.onPlayerFire?.(target);
  }

  fireMissile() {
    if (!this.active || this.defeated) return false;
    if (this.player.missiles <= 0) {
      this.callbacks.onMissileEmpty?.();
      return false;
    }
    if (this.player.missileTimer > 0) return false;
    this.player.missiles -= 1;
    this.player.missileTimer = MISSILE_COOLDOWN;

    const playerPos = this.ship.root.position;
    const forward = _v1.set(0, 0, -1).applyQuaternion(this.ship.root.quaternion);
    const target = this._acquireTarget(forward, playerPos);
    const side = this.player.missiles % 2 === 0 ? -1 : 1;
    const origin = new THREE.Vector3(9.8 * side, 0.1, -4.6).applyMatrix4(
      this.ship.root.matrixWorld,
    );

    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.34, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: 0xdfe8ea, metalness: 0.7, roughness: 0.34 }),
    );
    body.rotation.x = Math.PI / 2;
    const glow = glowSprite(this.glowTexture, 0x8be9ff, 1.4, 0.85);
    glow.position.z = 1.35;
    const plume = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 1.3, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x9ff4ff,
        transparent: true,
        opacity: 0.7,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    plume.rotation.x = -Math.PI / 2;
    plume.position.z = 1.9;
    group.add(body, glow, plume);
    group.position.copy(origin);
    const direction = target
      ? _v2.copy(target.group.position).sub(origin).normalize()
      : forward.clone();
    group.quaternion.setFromUnitVectors(FORWARD, direction);
    this.scene.add(group);

    this.missiles.push({
      group,
      velocity: direction.clone().multiplyScalar(MISSILE_SPEED),
      target,
      life: MISSILE_LIFE,
      trailTimer: 0,
      plume,
    });

    this._playTone(180, 620, 0.32, 0.028, 'sawtooth');
    this.callbacks.onMissile?.({ target, remaining: this.player.missiles });
    return true;
  }

  _updateMissiles(dt) {
    for (let i = this.missiles.length - 1; i >= 0; i -= 1) {
      const missile = this.missiles[i];
      if (!missile) {
        this.missiles.splice(i, 1);
        continue;
      }
      missile.life -= dt;
      missile.trailTimer -= dt;

      const target = missile.target;
      if (target && !target.dead) {
        const desired = _v1.copy(target.group.position).sub(missile.group.position);
        const distance = desired.length();
        if (distance > 0.01) {
          desired.normalize();
          const speed = missile.velocity.length();
          const current = _v2.copy(missile.velocity).normalize();
          current.lerp(desired, Math.min(1, MISSILE_TURN * dt)).normalize();
          missile.velocity.copy(current).multiplyScalar(
            Math.min(MISSILE_MAX_SPEED, speed + 520 * dt),
          );
          missile.group.quaternion.setFromUnitVectors(FORWARD, current);
        }
        if (distance < 26) {
          this._spawnHit(missile.group.position, 0xffbe78, 2.2);
          this._damageEnemy(target, MISSILE_DAMAGE, target.group.position);
          this._spawnBurst(missile.group.position, 0xffbe78, 14);
          this._playTone(140, 40, 0.28, 0.04, 'square');
          this.scene.remove(missile.group);
          this.missiles.splice(i, 1);
          continue;
        }
      }

      missile.group.position.addScaledVector(missile.velocity, dt);
      missile.plume.material.opacity = 0.55 + Math.sin(this.time * 24 + i) * 0.2;
      if (missile.trailTimer <= 0) {
        missile.trailTimer = 0.035;
        this._spawnMuzzle(missile.group.position, 0x6fd8ff);
      }

      if (missile.life <= 0) {
        this._spawnBurst(missile.group.position, 0xffbe78, 10);
        this.scene.remove(missile.group);
        this.missiles.splice(i, 1);
      }
    }
  }

  setHull(value) {
    this.player.hull = Math.max(0, Math.min(this.player.hullMax, Number(value) || 0));
    return this.player.hull;
  }

  _spawnBeam(from, to, color, width) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.geometries.beam, material);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    _v1.copy(to).sub(from);
    const length = _v1.length();
    mesh.quaternion.setFromUnitVectors(Y_AXIS, _v1.normalize());
    mesh.scale.set(width / 0.13, length, width / 0.13);
    this.scene.add(mesh);
    this.effects.push({
      kind: 'beam',
      object: mesh,
      material,
      life: 0.075,
      maxLife: 0.075,
    });
  }

  _spawnMuzzle(position, color) {
    const sprite = glowSprite(this.glowTexture, color, 2.2, 0.9);
    sprite.position.copy(position);
    this.scene.add(sprite);
    this.effects.push({
      kind: 'flash',
      object: sprite,
      spriteMaterial: sprite.material,
      life: 0.18,
      maxLife: 0.18,
      startSize: 1.5,
      endSize: 4.8,
    });
  }

  _damageEnemy(enemy, damage, hitPos) {
    if (!enemy || enemy.dead) return;
    let remaining = damage;
    if (enemy.shield > 0) {
      const absorbed = Math.min(enemy.shield, remaining);
      enemy.shield -= absorbed;
      remaining -= absorbed;
      this._spawnHit(hitPos, 0x8be9ff, 1.1);
    }
    if (remaining > 0) {
      enemy.hull = Math.max(0, enemy.hull - remaining);
      this._spawnHit(hitPos, 0xff6b50, 1.35);
    }

    this.callbacks.onEnemyHit?.({
      enemy,
      name: enemy.name,
      killed: enemy.hull <= 0,
      shield: enemy.shield,
      hull: enemy.hull,
    });

    if (enemy.hull <= 0) {
      this._destroyEnemy(enemy);
    } else {
      this._playTone(520, 220, 0.07, 0.012, 'triangle');
    }
  }

  _destroyEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    const deathPosition = enemy.group.position.clone();
    this._spawnBurst(enemy.group.position, 0xff5b3d, 34);
    this.scene.remove(enemy.group);
    const index = this.enemies.indexOf(enemy);
    if (index >= 0) this.enemies.splice(index, 1);
    if (this.target === enemy) this.target = null;
    this.kills += 1;
    this.player.kills = this.kills;
    this._noise(0.55, 0.07, 420);
    this._playTone(160, 48, 0.55, 0.04, 'sawtooth');
    this.callbacks.onEnemyKilled?.({
      kills: this.kills,
      wave: this.wave,
      remaining: this.enemies.length,
      position: deathPosition,
    });

    if (this.enemies.length === 0) {
      this.wave += 1;
      this.spawnAt = this.time + 4.2;
      this.callbacks.onWaveCleared?.({
        wave: this.wave - 1,
        nextWave: this.wave,
        kills: this.kills,
      });
    }
  }

  _spawnHit(position, color, size) {
    const sprite = glowSprite(this.glowTexture, color, 4.2 * size, 0.9);
    sprite.position.copy(position);
    this.scene.add(sprite);
    this.effects.push({
      kind: 'flash',
      object: sprite,
      spriteMaterial: sprite.material,
      life: 0.28,
      maxLife: 0.28,
      startSize: 2.2,
      endSize: 7.2,
    });
  }

  _spawnBurst(position, color, size = 30) {
    const flash = glowSprite(this.glowTexture, color, size, 0.9);
    flash.position.copy(position);
    this.scene.add(flash);
    this.effects.push({
      kind: 'flash',
      object: flash,
      spriteMaterial: flash.material,
      life: 0.6,
      maxLife: 0.6,
      startSize: size * 0.5,
      endSize: size * 2.4,
    });

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const group = new THREE.Group();
    group.position.copy(position);
    for (let i = 0; i < 9; i += 1) {
      const shard = new THREE.Mesh(
        new THREE.TetrahedronGeometry(size * 0.035, 0),
        material,
      );
      shard.position.set(
        randRange(Math.random, -2, 2),
        randRange(Math.random, -2, 2),
        randRange(Math.random, -2, 2),
      );
      shard.userData.velocity = new THREE.Vector3(
        randRange(Math.random, -36, 36),
        randRange(Math.random, -30, 32),
        randRange(Math.random, -36, 36),
      );
      group.add(shard);
    }
    this.scene.add(group);
    this.effects.push({
      kind: 'debris',
      object: group,
      material,
      life: 0.9,
      maxLife: 0.9,
    });
  }

  _spawnEnemyBolt(enemy, playerPos) {
    if (!enemy || enemy.dead) return;
    const origin = _v1.set(0, 0, -4.8).applyMatrix4(enemy.group.matrixWorld);
    const target = _v2.copy(playerPos);
    target.x += randRange(Math.random, -5, 5);
    target.y += randRange(Math.random, -4, 4);
    target.z += randRange(Math.random, -5, 5);
    const direction = _v3.copy(target).sub(origin).normalize();
    const mesh = new THREE.Mesh(this.geometries.bolt, this.materials.bolt);
    mesh.scale.set(0.8, 0.8, 1.8);
    mesh.position.copy(origin);
    mesh.quaternion.setFromUnitVectors(FORWARD, direction);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      velocity: direction.clone().multiplyScalar(ENEMY_BOLT_SPEED),
      life: ENEMY_BOLT_LIFE,
      source: enemy.group.position.clone(),
    });
    this._playTone(280, 110, 0.13, 0.018, 'sawtooth');
  }

  _damagePlayer(amount, source = null) {
    if (this.defeated) return;
    this.player.lastHitAt = this.time;
    let remaining = amount;
    const previousShield = this.player.shield;
    if (this.player.shield > 0) {
      const absorbed = Math.min(this.player.shield, remaining);
      this.player.shield -= absorbed;
      remaining -= absorbed;
      this.shieldFlash = 1;
      this.materials.shield.opacity = 0.12;
    }
    if (remaining > 0) {
      this.player.hull = Math.max(0, this.player.hull - remaining);
      this.shieldFlash = 1.5;
      this.callbacks.onPlayerHullHit?.({
        hull: this.player.hull,
        amount: remaining,
      });
    }

    this.callbacks.onPlayerHit?.({
      shield: this.player.shield,
      shieldMax: this.player.shieldMax,
      hull: this.player.hull,
      hullMax: this.player.hullMax,
      amount,
      shieldBroken:
        previousShield > 0 && this.player.shield <= 0,
      source: source ? source.clone() : null,
    });
    this._playTone(90, 48, 0.22, 0.035, 'sawtooth');

    if (this.player.hull <= 0) {
      this.defeated = true;
      this.firing = false;
      this._clearProjectiles();
      this._spawnBurst(this.ship.root.position, 0xffba78, 32);
      this._noise(0.9, 0.09, 280);
      this.callbacks.onPlayerDeath?.({
        kills: this.kills,
        wave: this.wave,
        time: this.time,
      });
    }
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;

    if (this.shieldBubble) {
      this.shieldFlash = Math.max(0, this.shieldFlash - dt * 2.5);
      this.materials.shield.opacity = this.defeated
        ? 0
        : Math.max(0, this.materials.shield.opacity - dt * 3.2);
      this.shieldBubble.visible = !this.defeated && this.player.shield > 0;
      if (this.player.shield <= 0) this.shieldBubble.visible = false;
    }

    if (this.defeated) {
      this._updateEffects(dt);
      return;
    }

    const playerPos = this.ship.root.position;
    const forward = _v1.set(0, 0, -1).applyQuaternion(this.ship.root.quaternion);

    if (this.time - this.player.lastHitAt > PLAYER_SHIELD_DELAY) {
      this.player.shield = Math.min(
        this.player.shieldMax,
        this.player.shield + PLAYER_SHIELD_REGEN * dt,
      );
    }

    if (this.player.overheated) {
      this.player.heat = Math.max(0, this.player.heat - 18 * dt);
      if (this.player.heat <= 0) {
        this.player.overheated = false;
        this.callbacks.onWeaponReady?.();
      }
    } else {
      const cooling = this.firing ? 5.2 : PLAYER_COOL_RATE;
      this.player.heat = Math.max(0, this.player.heat - cooling * dt);
    }

    this.player.missileTimer = Math.max(0, this.player.missileTimer - dt);
    this.player.fireTimer -= dt;
    if (this.firing && this.player.fireTimer <= 0) {
      this._fire();
    }

    if (
      this.spawnAt !== Infinity &&
      this.time >= this.spawnAt &&
      this.enemies.length === 0
    ) {
      this._spawnWave();
    }

    this._updateEnemies(dt, playerPos, forward);
    this._updateProjectiles(dt, playerPos);
    this._updateMissiles(dt);
    this._updateEffects(dt);
    this._acquireTarget(forward, playerPos);
  }

  _updateEnemies(dt, playerPos, playerForward) {
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.phase += enemy.angularSpeed * dt;
      const center = _v4
        .copy(playerPos)
        .addScaledVector(playerForward, 72);
      const desired = _v5.set(
        center.x + Math.cos(enemy.phase) * enemy.radius,
        center.y + enemy.height + Math.sin(enemy.phase * 0.7) * 18,
        center.z + Math.sin(enemy.phase) * enemy.radius,
      );
      const toDesired = _v2.copy(desired).sub(enemy.group.position);
      const distanceToDesired = toDesired.length();
      const playerDistance = enemy.group.position.distanceTo(playerPos);

      if (playerDistance > 1600) {
        enemy.group.position
          .copy(playerPos)
          .addScaledVector(playerForward, -300)
          .add(
            _v3.set(
              randRange(Math.random, -450, 450),
              randRange(Math.random, -60, 80),
              randRange(Math.random, -300, 300),
            ),
          );
      }

      const speed = playerDistance > 700 ? 380 : 150;
      if (distanceToDesired > 0.01) {
        enemy.group.position.addScaledVector(
          toDesired.normalize(),
          Math.min(speed * dt, distanceToDesired),
        );
      }
      enemy.velocity
        .copy(toDesired)
        .normalize()
        .multiplyScalar(Math.min(speed, distanceToDesired / Math.max(dt, 0.001)));

      const toPlayer = _v3.copy(playerPos).sub(enemy.group.position);
      const distanceToPlayer = toPlayer.length();
      if (distanceToPlayer > 0.01) {
        _q1.setFromUnitVectors(FORWARD, toPlayer.normalize());
        enemy.group.quaternion.slerp(_q1, 1 - Math.exp(-2.8 * dt));
      }

      enemy.fireTimer -= dt;
      if (
        distanceToPlayer < 690 &&
        enemy.fireTimer <= 0 &&
        enemy.group.position.distanceTo(playerPos) > 55
      ) {
        const forwardDot = _v4
          .set(0, 0, -1)
          .applyQuaternion(enemy.group.quaternion)
          .dot(toPlayer.normalize());
        if (forwardDot > 0.55) {
          enemy.fireTimer = randRange(Math.random, 2.2, 3.5);
          this._spawnEnemyBolt(enemy, playerPos);
        }
      }
    }
  }

  _updateProjectiles(dt, playerPos) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      if (!projectile) {
        this.projectiles.splice(i, 1);
        continue;
      }
      projectile.life -= dt;
      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      const hit = projectile.mesh.position.distanceTo(playerPos) < 27;
      if (hit) {
        this._spawnHit(projectile.mesh.position, 0xff7d68, 0.8);
        this._damagePlayer(randRange(Math.random, 7, 10), projectile.source || null);
      }
      if (hit || projectile.life <= 0) {
        this.scene.remove(projectile.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  _updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i];
      if (!effect) {
        this.effects.splice(i, 1);
        continue;
      }
      effect.life -= dt;
      const progress = 1 - Math.max(0, effect.life) / effect.maxLife;

      if (effect.kind === 'flash') {
        const size =
          effect.startSize + (effect.endSize - effect.startSize) * progress;
        effect.object.scale.set(size, size, 1);
        if (effect.spriteMaterial) {
          effect.spriteMaterial.opacity = Math.max(0, 0.9 * (1 - progress));
        }
      } else if (effect.kind === 'beam') {
        effect.material.opacity = Math.max(0, 0.9 * (1 - progress));
      } else if (effect.kind === 'debris') {
        effect.material.opacity = Math.max(0, 0.9 * (1 - progress));
        for (const shard of effect.object.children) {
          shard.position.addScaledVector(shard.userData.velocity, dt);
          shard.rotation.x += dt * 4.2;
          shard.rotation.y += dt * 3.7;
        }
      }

      if (effect.life <= 0) {
        this.scene.remove(effect.object);
        effect.material?.dispose?.();
        effect.spriteMaterial?.dispose?.();
        this.effects.splice(i, 1);
      }
    }
  }

  getHudData() {
    const target = this.target;
    return {
      active: this.active,
      defeated: this.defeated,
      shield: this.player.shield,
      shieldMax: this.player.shieldMax,
      hull: this.player.hull,
      hullMax: this.player.hullMax,
      heat: this.player.heat,
      overheated: this.player.overheated,
      firing: this.firing,
      kills: this.kills,
      wave: this.wave,
      enemyCount: this.enemies.length,
      targetName: target?.name || '',
      targetDistance: target
        ? target.group.position.distanceTo(this.ship.root.position)
        : null,
      nextWaveIn:
        this.spawnAt === Infinity ? null : Math.max(0, this.spawnAt - this.time),
      missiles: this.player.missiles,
      missileMax: this.player.missileMax,
      missileTimer: this.player.missileTimer,
    };
  }

  getEnemyMarkers() {
    return this.enemies.map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      group: enemy.group,
      shield: enemy.shield,
      shieldMax: enemy.shieldMax,
      hull: enemy.hull,
      hullMax: enemy.hullMax,
      distance: enemy.group.position.distanceTo(this.ship.root.position),
      locked: this.target === enemy,
    }));
  }

  getRadarContacts() {
    return this.enemies.map((enemy) => ({
      id: enemy.id,
      x: enemy.group.position.x,
      z: enemy.group.position.z,
      locked: this.target === enemy,
    }));
  }
}

export function createCombatSystem(options) {
  return new CombatSystem(options);
}