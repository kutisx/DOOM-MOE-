import * as THREE from 'three';
import { Engine, Particles } from './engine.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Input, Player } from './player.js';
import { Enemy, Grenade } from './enemy.js';
import {
  generateLevel, computeFlow, TILE, tileAt, T,
} from './level.js';
import {
  pickupTexture, secretTexture, portalTexture, bloodTexture,
} from './assets.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game');

    this.engine = new Engine(this.canvas);
    this.audio = new AudioEngine();
    this.input = new Input(this.canvas);
    this.ui = new UI(this);
    this.particles = new Particles(this.engine.scene, 1400);

    this.state = 'menu';
    this.level = null;
    this.player = new Player(this);
    this.enemies = [];
    this.projectiles = [];
    this.grenades = [];
    this.pickupSprites = [];
    this.corpses = [];
    this.portal = null;
    this.portalLight = null;
    this.secretSprites = [];

    this.flow = null;
    this.flowTimer = 0;
    this.shake = 0;
    this.elapsed = 0;
    this.score = 0;
    this.stats = { kills: 0, shotsFired: 0, shotsHit: 0, secrets: 0 };

    this.clock = new THREE.Clock();
    this.engine.initMenu();
    this.ui.show('menu');
    this.ui.showHUD(false);

    this.bindGlobalEvents();
    this.loop();
  }

  bindGlobalEvents() {
    this.canvas.addEventListener('click', () => {
      if (this.state === 'playing' && !this.input.isTouch) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      this.ui.showLockHint(this.state === 'playing' && !locked && !this.input.isTouch);
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });

    /* первый user-gesture инициализирует аудио и запускает музыку в меню */
    const startAudio = () => {
      this.audio.init();
      this.audio.resume();
      if (this.state === 'menu') this.audio.startMusic();
      if (this.audio.ctx) {
        document.removeEventListener('pointerdown', startAudio);
        document.removeEventListener('keydown', startAudio);
      }
    };
    document.addEventListener('pointerdown', startAudio);
    document.addEventListener('keydown', startAudio);
  }

  handleAction(action) {
    switch (action) {
      case 'start':
      case 'restart':
        this.startGame();
        break;
      case 'settings':
        this.ui.show('settings');
        break;
      case 'credits':
        this.ui.show('credits');
        break;
      case 'back':
        if (this.state === 'paused') {
          this.ui.show('pause');
          this.ui.showPauseStats(this);
        } else {
          this.ui.show('menu');
        }
        break;
      case 'resume':
        this.resume();
        break;
      case 'menu':
        this.toMenu();
        break;
    }
  }

  startGame() {
    this.audio.init();
    this.audio.resume();

    this.clearWorld();

    this.level = generateLevel(50);
    this.engine.buildLevel(this.level);

    this.player.spawn(this.level);
    this.player.updateCamera(0);

    this.enemies = this.level.enemies.map(e => new Enemy(this, e.type, e.x, e.z));
    this.buildPickups();
    this.buildPortal();
    this.buildSecrets();

    this.flow = computeFlow(this.level, this.level.exit.tx, this.level.exit.tz);
    this.flowTimer = 0;

    this.score = 0;
    this.elapsed = 0;
    this.stats = { kills: 0, shotsFired: 0, shotsHit: 0, secrets: 0 };
    this.shake = 0;

    this.ui.show(null);
    this.ui.showHUD(true);
    this.ui.setScore(0);
    this.ui.setHealth(100);
    this.ui.setKeys(0);
    this.ui.setRemaining(this.enemies.length);
    this.ui.setTime(0);
    this.ui.setWeapon('rifle', Infinity);

    this.state = 'playing';
    this.audio.startMusic();

    if (!this.input.isTouch) {
      this.canvas.requestPointerLock();
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.exitPointerLock();
    this.audio.stopMusic();
    this.ui.showPauseStats(this);
    this.ui.show('pause');
    this.ui.showHUD(false);
    this.ui.showLockHint(false);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.show(null);
    this.ui.showHUD(true);
    this.audio.startMusic();
    if (!this.input.isTouch) this.canvas.requestPointerLock();
  }

  toMenu() {
    this.state = 'menu';
    document.exitPointerLock();
    this.clearWorld();
    this.ui.showHUD(false);
    this.ui.show('menu');
    this.ui.showLockHint(false);
    this.engine.initMenu();
    this.audio.startMusic();
  }

  clearWorld() {
    for (const e of this.enemies) e.remove();
    this.enemies = [];

    for (const p of this.projectiles) p.destroy();
    this.projectiles = [];

    for (const g of this.grenades) {
      if (g.model.parent) g.model.parent.remove(g.model);
    }
    this.grenades = [];

    for (const s of this.pickupSprites) {
      if (s.parent) s.parent.remove(s);
      if (s.material) s.material.dispose();
    }
    this.pickupSprites = [];

    for (const c of this.corpses) {
      if (c.parent) c.parent.remove(c);
      if (c.material) c.material.dispose();
    }
    this.corpses = [];

    for (const s of this.secretSprites) {
      if (s.parent) s.parent.remove(s);
    }
    this.secretSprites = [];

    if (this.portal) {
      if (this.portal.parent) this.portal.parent.remove(this.portal);
      this.portal = null;
    }
    if (this.portalLight) {
      if (this.portalLight.parent) this.portalLight.parent.remove(this.portalLight);
      this.portalLight = null;
    }
  }

  buildPickups() {
    for (const p of this.level.pickups) {
      const mat = new THREE.SpriteMaterial({
        map: pickupTexture(p.type),
        transparent: false,
        alphaTest: 0.5,
      });
      const spr = new THREE.Sprite(mat);
      spr.scale.set(1.1, 1.1, 1);
      spr.position.set(p.x, 0.75, p.z);
      spr.userData = { kind: p.type, baseY: 0.75, phase: Math.random() * 6.28 };
      this.engine.scene.add(spr);
      this.pickupSprites.push(spr);
    }
  }

  buildPortal() {
    const mat = new THREE.SpriteMaterial({
      map: portalTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(3.2, 3.6, 1);
    spr.position.set(this.level.exit.x, 1.8, this.level.exit.z);
    this.engine.scene.add(spr);
    this.portal = spr;

    const light = new THREE.PointLight(0xFF9EC2, 2.2, 14);
    light.position.set(this.level.exit.x, 2.0, this.level.exit.z);
    this.engine.scene.add(light);
    this.portalLight = light;
  }

  buildSecrets() {
    for (const s of this.level.secrets) {
      if (!s.found) continue;
      this.spawnSecretSprite(s);
    }
  }

  spawnSecretSprite(s) {
    const mat = new THREE.SpriteMaterial({
      map: secretTexture(s.kind),
      transparent: false,
      alphaTest: 0.5,
    });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(1.2, 1.2, 1);
    spr.position.set((s.x + 0.5) * TILE, 0.8, (s.z + 0.5) * TILE);
    spr.userData = { kind: 'secret', secret: s };
    this.engine.scene.add(spr);
    this.secretSprites.push(spr);
  }

  spawnCorpse(x, z) {
    const mat = new THREE.MeshBasicMaterial({
      map: bloodTexture(Math.floor(Math.random() * 1000)),
      transparent: true,
      depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(2.2, 2.2);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.02, z);
    mesh.rotation.z = Math.random() * Math.PI * 2;
    this.engine.scene.add(mesh);
    this.corpses.push(mesh);

    while (this.corpses.length > 45) {
      const old = this.corpses.shift();
      if (old.parent) old.parent.remove(old);
      old.geometry.dispose();
      old.material.dispose();
    }
  }

  spawnGrenade(x, y, z, vx, vy, vz) {
    this.grenades.push(new Grenade(this, x, y, z, vx, vy, vz));
  }

  openDoor(tx, tz) {
    const level = this.level;
    if (tileAt(level, tx, tz) !== T.DOOR) return;
    level.grid[tz * level.size + tx] = T.FLOOR;
    this.audio.door();
    this.engine.buildLevel(level);
    this.flow = computeFlow(level, level.exit.tx, level.exit.tz);
  }

  unlockDoor(tx, tz) {
    const level = this.level;
    if (tileAt(level, tx, tz) !== T.LOCKED) return;
    level.grid[tz * level.size + tx] = T.FLOOR;
    this.audio.door();
    this.engine.buildLevel(level);
    this.flow = computeFlow(level, level.exit.tx, level.exit.tz);
  }

  revealSecret(s) {
    if (s.found) return;
    s.found = true;
    this.stats.secrets++;
    this.score += 250;

    const level = this.level;
    level.grid[s.wz * level.size + s.wx] = T.FLOOR;
    this.engine.buildLevel(level);
    this.spawnSecretSprite(s);

    this.audio.secret();
    this.ui.setScore(this.score);
    this.ui.toast('SECRET FOUND! press E \u2661');
  }

  onEnemyKilled(enemy) {
    this.stats.kills++;
    this.score += enemy.def.score;
    this.ui.setScore(this.score);

    const remaining = this.enemies.filter(e => e.alive).length;
    this.ui.setRemaining(remaining);

    if (this.player.noDamageStreak > 0 && this.player.noDamageStreak % 5 === 0) {
      this.score += 50;
      this.ui.setScore(this.score);
    }
    this.player.noDamageStreak++;

    if (remaining === 0) this.ui.toast('ALL DEMONS PURGED!');
  }

  onPlayerHurt(amount) {
    this.engine.setGlitch(Math.min(0.85, 0.28 + amount * 0.022));
    this.shake = Math.max(this.shake, 0.42);
    this.audio.playerHurt();
  }

  onPlayerDeath() {
    this.audio.lose();
    this.audio.stopMusic();
    document.exitPointerLock();
    this.state = 'dead';
    this.ui.showDeathStats(this);
    this.ui.show('dead');
    this.ui.showHUD(false);
    this.ui.showLockHint(false);
  }

  onVictory() {
    this.audio.win();
    this.audio.stopMusic();
    document.exitPointerLock();
    this.state = 'victory';
    this.ui.showVictoryStats(this);
    this.ui.show('victory');
    this.ui.showHUD(false);
    this.ui.showLockHint(false);
  }

  loop() {
    requestAnimationFrame(() => this.loop());

    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.05);

    if (this.state === 'menu') {
      this.engine.renderMenu(dt);
      return;
    }

    if (this.state === 'paused' || this.state === 'dead' || this.state === 'victory') {
      this.engine.render(0);
      return;
    }

    this.elapsed += dt;
    this.ui.setTime(this.elapsed);

    this.player.update(dt);

    this.flowTimer -= dt;
    if (this.flowTimer <= 0) {
      this.flowTimer = 0.35;
      const tx = Math.floor(this.player.pos.x / TILE);
      const tz = Math.floor(this.player.pos.z / TILE);
      this.flow = computeFlow(this.level, tx, tz);
    }

    for (const e of this.enemies) e.update(dt);

    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter(p => !p.dead);

    for (const g of this.grenades) g.update(dt);
    this.grenades = this.grenades.filter(g => !g.dead);

    this.updatePickups(dt);

    if (this.portal) {
      const t = performance.now() * 0.001;
      this.portal.scale.set(
        3.2 + Math.sin(t * 2.2) * 0.22,
        3.6 + Math.sin(t * 2.2 + 1) * 0.26,
        1
      );
      this.portal.material.rotation = t * 0.35;
      if (this.portalLight) {
        this.portalLight.intensity = 2.0 + Math.sin(t * 4.0) * 0.6;
      }
    }

    this.particles.update(dt);
    this.shake = Math.max(0, this.shake - dt * 2.2);

    this.checkVictory();

    this.engine.render(dt);
  }

  updatePickups(dt) {
    const p = this.player;
    const t = performance.now() * 0.001;

    for (let i = this.pickupSprites.length - 1; i >= 0; i--) {
      const spr = this.pickupSprites[i];
      const ud = spr.userData;
      spr.position.y = ud.baseY + Math.sin(t * 2.4 + ud.phase) * 0.12;
      spr.material.rotation = Math.sin(t * 1.2 + ud.phase) * 0.12;

      const d = Math.hypot(spr.position.x - p.pos.x, spr.position.z - p.pos.z);
      if (d < 1.0) {
        if (ud.kind === 'health') {
          if (p.health >= p.maxHealth) {
            this.ui.toastCooldown('HP FULL \u2661', 1000, 'hp-full');
            continue;
          }
          p.heal(28);
          this.ui.toast('+28 HP');
        } else {
          if (p.grenades >= p.maxGrenades) {
            this.ui.toastCooldown('MAX GRENADES \u2661', 1000, 'gren-full');
            continue;
          }
          p.grenades = Math.min(p.maxGrenades, p.grenades + 2);
          this.ui.toast('+2 GRENADES');
          if (p.weapon === 'grenade') this.ui.setWeapon('grenade', p.grenades);
        }
        this.audio.pickup();
        this.engine.scene.remove(spr);
        spr.material.dispose();
        this.pickupSprites.splice(i, 1);
      }
    }
  }

  checkVictory() {
    if (!this.level || this.state !== 'playing') return;

    const total = this.level.enemies.length;
    const required = Math.ceil(total * 0.8);
    const killed = this.stats.kills;

    const dx = this.player.pos.x - this.level.exit.x;
    const dz = this.player.pos.z - this.level.exit.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 2.0) {
      if (killed >= required) {
        this.onVictory();
      } else {
        if (!this._warnedExit || this.elapsed - this._warnedExit > 3) {
          this._warnedExit = this.elapsed;
          this.ui.toast(`NEED ${required - killed} MORE KILLS`);
        }
      }
    }
  }
}

window.addEventListener('load', () => {
  new Game();
});