import * as THREE from 'three';
import { enemyTexture, orbTexture, makeGrenadeModel } from './assets.js';
import {
  TILE, T, tileAt, isBlockedWorld, hasLOS,
} from './level.js';

export const ENEMY_TYPES = {
  melee: {
    hp: 95, speed: 1.85, score: 100, damage: 13,
    attackRange: 2.0, attackCooldown: 1.05,
    hitRadius: 0.62, centerY: 0.85,
    spriteW: 1.7, spriteH: 1.7, sightRange: 26,
  },
  ranged: {
    hp: 58, speed: 2.75, score: 150, damage: 9,
    attackRange: 15, attackCooldown: 1.9,
    hitRadius: 0.55, centerY: 0.85,
    spriteW: 1.5, spriteH: 1.7, sightRange: 30,
  },
};

export class Enemy {
  constructor(game, type, x, z) {
    this.game = game;
    this.type = type;
    this.def = ENEMY_TYPES[type];

    this.pos = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3();
    this.hp = this.def.hp;
    this.alive = true;

    this.state = 'idle';
    this.stateTimer = 0;
    this.attackTimer = 0;
    this.hurtTimer = 0;
    this.frame = 0;
    this.frameTimer = 0;
    this.deathTimer = 0;

    this.hitRadius = this.def.hitRadius;
    this.centerY = this.def.centerY;

    this.material = new THREE.SpriteMaterial({
      map: enemyTexture(type, 'walk', 0),
      transparent: false,
      alphaTest: 0.5,
      depthWrite: true,
    });

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(this.def.spriteW, this.def.spriteH, 1);
    this.sprite.position.set(x, this.def.spriteH / 2, z);
    game.engine.scene.add(this.sprite);

    this.setFrame('walk', 0);
  }

  setFrame(mode, frame) {
    this.material.map = enemyTexture(this.type, mode, frame);
    this.material.needsUpdate = true;
    this.currentMode = mode;
  }

  damage(amount, dir) {
    if (!this.alive || this.state === 'dead') return;
    this.hp -= amount;
    this.game.audio.enemyHurt();

    if (dir) {
      this.vel.x += dir.x * 2.4;
      this.vel.z += dir.z * 2.4;
    }

    this.game.particles.burst(
      this.pos.x, this.centerY, this.pos.z, 14,
      { color: 0x8B0000, speed: 6, life: 0.5, size: 0.10, gravity: 26 }
    );
    this.game.particles.burst(
      this.pos.x, this.centerY, this.pos.z, 6,
      { color: 0xC40000, speed: 9, life: 0.32, size: 0.08, gravity: 22 }
    );

    if (this.hp <= 0) {
      this.die();
    } else {
      this.state = 'hurt';
      this.hurtTimer = 0.2;
      this.setFrame('hurt', 0);
    }
  }

  die() {
    this.alive = false;
    this.state = 'dead';
    this.deathTimer = 0.22;
    this.setFrame('dead', 0);
    this.game.audio.enemyDeath();

    for (let i = 0; i < 4; i++) {
      this.game.particles.burst(
        this.pos.x + (Math.random() - 0.5) * 0.5,
        this.centerY * (0.4 + Math.random() * 0.8),
        this.pos.z + (Math.random() - 0.5) * 0.5,
        22,
        {
          color: [0x8B0000, 0xA00000, 0xC40000, 0x5A0000][i % 4],
          speed: 7 + i * 1.8,
          life: 0.7 + Math.random() * 0.5,
          size: 0.11 + Math.random() * 0.08,
          gravity: 28,
        }
      );
    }

    this.game.spawnCorpse(this.pos.x, this.pos.z);
    this.game.onEnemyKilled(this);
  }

  update(dt) {
    if (this.state === 'dead') {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.remove();
      return;
    }

    const g = this.game;
    const player = g.player;
    const level = g.level;

    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    if (this.state === 'hurt') {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0) this.state = 'chase';
      this.applyMotion(dt, 0, 0);
      this.syncSprite();
      return;
    }

    if (this.state === 'idle') {
      const sees = dist < this.def.sightRange &&
        hasLOS(level, this.pos.x, this.pos.z, player.pos.x, player.pos.z);
      if (sees || dist < 5) {
        this.state = 'chase';
        this.setFrame('walk', 0);
      }
      this.syncSprite();
      return;
    }

    if (this.state === 'chase') {
      const speed = this.def.speed;
      const dir = this.steerDirection();
      const los = hasLOS(level, this.pos.x, this.pos.z, player.pos.x, player.pos.z);

      if (this.type === 'melee') {
        if (dist < this.def.attackRange && los) {
          this.state = 'attack';
          this.attackTimer = 0;
        }
      } else {
        if (dist < this.def.attackRange && los && this.attackTimer <= 0) {
          this.state = 'attack';
          this.attackTimer = 0;
        }
      }

      this.frameTimer += dt;
      if (this.frameTimer > 0.22) {
        this.frameTimer = 0;
        this.frame = 1 - this.frame;
        this.setFrame('walk', this.frame);
      }

      this.applyMotion(dt, dir.x * speed, dir.z * speed);
      this.syncSprite();
      return;
    }

    if (this.state === 'attack') {
      this.attackTimer += dt;

      if (this.attackTimer < 0.25) {
        this.setFrame('attack', 0);
      }

      if (this.type === 'melee') {
        if (this.attackTimer > 0.35 && !this._didHit) {
          this._didHit = true;
          if (dist < this.def.attackRange + 0.5) {
            g.player.takeDamage(this.def.damage);
          }
        }
        if (this.attackTimer > 0.75) {
          this._didHit = false;
          this.state = 'chase';
        }
      } else {
        if (this.attackTimer > 0.35 && !this._didHit) {
          this._didHit = true;
          this.fireProjectile();
        }
        if (this.attackTimer > 0.75) {
          this._didHit = false;
          this.attackTimer = 0;
          this.state = 'chase';
          this.setFrame('walk', 0);
        }
      }

      this.syncSprite();
      return;
    }
  }

  steerDirection() {
    const g = this.game;
    const player = g.player;
    const level = g.level;

    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.001 && hasLOS(level, this.pos.x, this.pos.z, player.pos.x, player.pos.z)) {
      return { x: dx / dist, z: dz / dist };
    }

    const flow = g.flow;
    if (!flow) {
      return dist > 0.001 ? { x: dx / dist, z: dz / dist } : { x: 0, z: 0 };
    }

    const size = level.size;
    const tx = Math.floor(this.pos.x / TILE);
    const tz = Math.floor(this.pos.z / TILE);
    if (tx < 0 || tz < 0 || tx >= size || tz >= size) return { x: 0, z: 0 };

    const here = flow[tz * size + tx];
    if (here < 0) {
      return dist > 0.001 ? { x: dx / dist, z: dz / dist } : { x: 0, z: 0 };
    }

    let bestD = here;
    let bx = tx, bz = tz;

    for (let k = 0; k < 8; k++) {
      const ox = [1, -1, 0, 0, 1, 1, -1, -1][k];
      const oz = [0, 0, 1, -1, 1, -1, 1, -1][k];
      const nx = tx + ox, nz = tz + oz;
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const d = flow[nz * size + nx];
      if (d < 0) continue;
      const cost = d + (ox !== 0 && oz !== 0 ? 0.4 : 0);
      if (cost < bestD) { bestD = cost; bx = nx; bz = nz; }
    }

    if (bx === tx && bz === tz) {
      return dist > 0.001 ? { x: dx / dist, z: dz / dist } : { x: 0, z: 0 };
    }

    const tx2 = (bx + 0.5) * TILE;
    const tz2 = (bz + 0.5) * TILE;
    const mx = tx2 - this.pos.x;
    const mz = tz2 - this.pos.z;
    const m = Math.hypot(mx, mz);
    if (m < 0.001) return { x: 0, z: 0 };
    return { x: mx / m, z: mz / m };
  }

  applyMotion(dt, vx, vz) {
    const g = this.game;
    const level = g.level;

    this.vel.x += (vx - this.vel.x) * Math.min(1, dt * 9);
    this.vel.z += (vz - this.vel.z) * Math.min(1, dt * 9);

    const r = 0.55;
    const blocked = (x, z) =>
      isBlockedWorld(level, x - r, z - r) ||
      isBlockedWorld(level, x + r, z - r) ||
      isBlockedWorld(level, x - r, z + r) ||
      isBlockedWorld(level, x + r, z + r);

    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;

    if (!blocked(nx, this.pos.z)) this.pos.x = nx; else this.vel.x = 0;
    if (!blocked(this.pos.x, nz)) this.pos.z = nz; else this.vel.z = 0;

    if (Math.hypot(this.vel.x, this.vel.z) < 0.05 && (vx || vz)) {
      this.stuckTimer = (this.stuckTimer || 0) + dt;
      if (this.stuckTimer > 0.5) {
        this.stuckTimer = 0;
        this.pos.x += (Math.random() - 0.5) * 0.6;
        this.pos.z += (Math.random() - 0.5) * 0.6;
        if (blocked(this.pos.x, this.pos.z)) {
          this.pos.x -= (Math.random() - 0.5) * 0.6;
          this.pos.z -= (Math.random() - 0.5) * 0.6;
        }
      }
    } else {
      this.stuckTimer = 0;
    }

    const tx = Math.floor(this.pos.x / TILE);
    const tz = Math.floor(this.pos.z / TILE);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        if (tileAt(level, tx + dx, tz + dz) === T.DOOR)
          g.openDoor(tx + dx, tz + dz);
  }

  fireProjectile() {
    const g = this.game;
    const p = g.player;
    g.audio.enemyShoot();

    const ox = this.pos.x;
    const oy = this.centerY;
    const oz = this.pos.z;

    let dx = p.pos.x - ox;
    let dy = (p.pos.y + 1.4) - oy;
    let dz = p.pos.z - oz;
    const m = Math.hypot(dx, dy, dz) || 1;
    dx /= m; dy /= m; dz /= m;

    dx += (Math.random() - 0.5) * 0.06;
    dy += (Math.random() - 0.5) * 0.06;
    dz += (Math.random() - 0.5) * 0.06;

    const speed = 11;
    g.projectiles.push(new EnemyProjectile(
      g, ox, oy, oz, dx * speed, dy * speed, dz * speed
    ));
  }

  syncSprite() {
    this.sprite.position.set(this.pos.x, this.def.spriteH / 2, this.pos.z);
  }

  remove() {
    if (this.sprite.parent) this.sprite.parent.remove(this.sprite);
    this.material.dispose();
  }
}

/* ===================== EnemyProjectile ===================== */

export class EnemyProjectile {
  constructor(game, x, y, z, vx, vy, vz) {
    this.game = game;
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3(vx, vy, vz);
    this.life = 4.0;
    this.dead = false;

    this.material = new THREE.SpriteMaterial({
      map: orbTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(0.65, 0.65, 1);
    this.sprite.position.copy(this.pos);
    game.engine.scene.add(this.sprite);
  }

  update(dt) {
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0) { this.destroy(); return; }

    const p = this.game.player;
    const toX = p.pos.x - this.pos.x;
    const toY = (p.pos.y + 1.3) - this.pos.y;
    const toZ = p.pos.z - this.pos.z;
    const m = Math.hypot(toX, toY, toZ) || 1;
    const homing = 1.6;
    this.vel.x += (toX / m) * homing * dt;
    this.vel.y += (toY / m) * homing * dt;
    this.vel.z += (toZ / m) * homing * dt;

    this.pos.addScaledVector(this.vel, dt);
    this.sprite.position.copy(this.pos);

    if (Math.random() < 0.7) {
      this.game.particles.spawn(
        this.pos.x, this.pos.y, this.pos.z,
        (Math.random() - 0.5) * 1.4,
        (Math.random() - 0.5) * 1.4,
        (Math.random() - 0.5) * 1.4,
        { color: 0x8B0000, life: 0.35, size: 0.08, gravity: 0 }
      );
    }

    if (isBlockedWorld(this.game.level, this.pos.x, this.pos.z)) {
      this.game.particles.burst(this.pos.x, this.pos.y, this.pos.z, 10, {
        color: 0x8B0000, speed: 5, life: 0.35, size: 0.09, gravity: 14,
      });
      this.destroy();
      return;
    }

    const d = Math.hypot(
      this.pos.x - p.pos.x,
      this.pos.y - (p.pos.y + 1.2),
      this.pos.z - p.pos.z
    );
    if (d < 0.75) {
      p.takeDamage(ENEMY_TYPES.ranged.damage);
      this.game.particles.burst(this.pos.x, this.pos.y, this.pos.z, 14, {
        color: 0xC40000, speed: 6, life: 0.4, size: 0.1, gravity: 18,
      });
      this.destroy();
    }
  }

  destroy() {
    this.dead = true;
    if (this.sprite.parent) this.sprite.parent.remove(this.sprite);
    this.material.dispose();
  }
}

/* ===================== Grenade ===================== */

export class Grenade {
  constructor(game, x, y, z, vx, vy, vz) {
    this.game = game;
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3(vx, vy, vz);
    this.fuse = 1.55;
    this.dead = false;
    this.spin = 0;

    this.model = makeGrenadeModel();
    this.model.position.copy(this.pos);
    game.engine.scene.add(this.model);
  }

  update(dt) {
    if (this.dead) return;

    this.fuse -= dt;

    this.vel.y -= 24 * dt;
    this.pos.addScaledVector(this.vel, dt);

    if (this.pos.y < 0.22) {
      this.pos.y = 0.22;
      this.vel.y = Math.abs(this.vel.y) * 0.42;
      this.vel.x *= 0.72;
      this.vel.z *= 0.72;
    }

    const level = this.game.level;
    if (isBlockedWorld(level, this.pos.x + Math.sign(this.vel.x) * 0.24, this.pos.z)) {
      this.vel.x *= -0.5;
    }
    if (isBlockedWorld(level, this.pos.x, this.pos.z + Math.sign(this.vel.z) * 0.24)) {
      this.vel.z *= -0.5;
    }

    this.spin += dt * 9;
    this.model.position.copy(this.pos);
    this.model.rotation.x = this.spin;
    this.model.rotation.z = this.spin * 0.7;

    for (const e of this.game.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(this.pos.x - e.pos.x, this.pos.z - e.pos.z);
      if (d < 1.0 && Math.abs(this.pos.y - e.centerY) < 1.3) {
        this.explode();
        return;
      }
    }

    if (this.fuse <= 0) this.explode();
  }

  explode() {
    if (this.dead) return;
    this.dead = true;

    const g = this.game;
    g.audio.explosion();
    g.shake = Math.max(g.shake, 0.9);
    g.engine.setGlitch(0.35);

    for (let i = 0; i < 5; i++) {
      g.particles.burst(
        this.pos.x, this.pos.y + 0.2, this.pos.z,
        26,
        {
          color: [0x8B0000, 0xA80000, 0xC40000, 0x5A0000, 0xFF0000][i],
          speed: 9 + i * 2.4,
          life: 0.6 + Math.random() * 0.6,
          size: 0.12 + Math.random() * 0.1,
          gravity: 26,
        }
      );
    }
    g.particles.burst(this.pos.x, this.pos.y + 0.3, this.pos.z, 14, {
      color: 0xFFD3E3, speed: 12, life: 0.35, size: 0.08, gravity: 20,
    });

    const RADIUS = 5.2;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
      if (d < RADIUS) {
        const falloff = 1 - d / RADIUS;
        e.damage(Math.round(130 * falloff * falloff) + 20, null);
      }
    }

    const pd = Math.hypot(g.player.pos.x - this.pos.x, g.player.pos.z - this.pos.z);
    if (pd < RADIUS) {
      const falloff = 1 - pd / RADIUS;
      g.player.takeDamage(Math.round(45 * falloff * falloff));
    }

    if (this.model.parent) this.model.parent.remove(this.model);
  }
}