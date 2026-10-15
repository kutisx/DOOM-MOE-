import * as THREE from 'three';
import { viewmodelTexture, muzzleTexture } from './assets.js';
import {
  TILE, T, tileAt, isBlockedWorld, raycastGrid,
} from './level.js';

const PLAYER_RADIUS = 0.42;
const EYE_HEIGHT = 1.55;
const MAX_SPEED = 7.4;
const ACCEL = 68;
const AIR_ACCEL = 14;
const FRICTION = 11;
const GRAVITY = 22;
const JUMP_VEL = 7.6;

const INTERACT_DIST = 2.0;
const DOOR_INTERACT_DIST = TILE * 1.15;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.firing = false;
    this.jumpQueued = false;
    this.swapQueued = false;
    this.interactQueued = false;
    this.sensitivity = 2.4;

    this.touchMove = { x: 0, y: 0 };
    this.touchLook = { x: 0, y: 0 };
    this.touchFire = false;
    this.isTouch = false;

    this._bindKeyboard();
    this._bindMouse();
    this._bindTouch();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', e => {
      this.keys.add(e.code);
      if (e.code === 'Space') { this.jumpQueued = true; e.preventDefault(); }
      if (e.code === 'KeyQ') this.swapQueued = true;
      if (e.code === 'Digit1') this.swapQueued = true;
      if (e.code === 'KeyE') this.interactQueued = true;
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _bindMouse() {
    this.canvas.addEventListener('mousedown', e => {
      if (e.button === 0) this.firing = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.firing = false;
    });
    window.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.mouseDX -= e.movementX * 0.0022 * this.sensitivity;
      this.mouseDY -= e.movementY * 0.0022 * this.sensitivity;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.firing = false;
    });
  }

  _bindTouch() {
    const hasTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!hasTouch) return;
    this.isTouch = true;
    document.body.classList.add('touch');

    const base = document.getElementById('stick-base');
    const knob = document.getElementById('stick-knob');
    let stickId = null, cx = 0, cy = 0, R = 48;

    const stickMove = (e) => {
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touchMove.x = dx / R;
      this.touchMove.y = dy / R;
    };

    base.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      stickId = e.pointerId;
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      R = r.width / 2 - 14;
      base.setPointerCapture(e.pointerId);
      stickMove(e);
    });
    base.addEventListener('pointermove', e => {
      if (e.pointerId !== stickId) return;
      e.preventDefault();
      stickMove(e);
    });
    const stickEnd = e => {
      if (e.pointerId !== stickId) return;
      stickId = null;
      knob.style.transform = 'translate(0px, 0px)';
      this.touchMove.x = 0;
      this.touchMove.y = 0;
    };
    base.addEventListener('pointerup', stickEnd);
    base.addEventListener('pointercancel', stickEnd);

    let lookId = null, lastX = 0, lastY = 0;
    this.canvas.addEventListener('pointerdown', e => {
      if (lookId !== null) return;
      lookId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('pointermove', e => {
      if (e.pointerId !== lookId) return;
      this.touchLook.x -= (e.clientX - lastX) * 0.0042 * this.sensitivity;
      this.touchLook.y -= (e.clientY - lastY) * 0.0042 * this.sensitivity;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    const lookEnd = e => {
      if (e.pointerId === lookId) lookId = null;
    };
    window.addEventListener('pointerup', lookEnd);
    window.addEventListener('pointercancel', lookEnd);

    const fire = document.getElementById('btn-fire');
    fire.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      this.touchFire = true;
    });
    const fireEnd = e => { e.preventDefault(); this.touchFire = false; };
    fire.addEventListener('pointerup', fireEnd);
    fire.addEventListener('pointercancel', fireEnd);

    const jump = document.getElementById('btn-jump');
    jump.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      this.jumpQueued = true;
    });

    const swap = document.getElementById('btn-swap');
    swap.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      this.swapQueued = true;
    });

    const use = document.getElementById('btn-use');
    if (use) use.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      this.interactQueued = true;
    });
  }

  consumeLook() {
    const dx = this.mouseDX + this.touchLook.x;
    const dy = this.mouseDY + this.touchLook.y;
    this.mouseDX = 0; this.mouseDY = 0;
    this.touchLook.x = 0; this.touchLook.y = 0;
    return { dx, dy };
  }
}

export class Player {
  constructor(game) {
    this.game = game;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.onGround = true;
    this.health = 100;
    this.maxHealth = 100;
    this.grenades = 3;
    this.maxGrenades = 5;
    this.keys = 0;
    this.weapon = 'rifle';

    this.fireCooldown = 0;
    this.grenadeCooldown = 0;
    this.muzzleTimer = 0;
    this.kick = 0;

    this.bobPhase = 0;
    this.bobY = 0;
    this.bobRoll = 0;

    this.dead = false;
    this.noDamageStreak = 0;

    const cam = game.engine.camera;

    this.vmRifle = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 0.79),
      new THREE.MeshBasicMaterial({
        map: viewmodelTexture('rifle'), transparent: true,
        depthTest: false, depthWrite: false,
      })
    );
    this.vmRifle.position.set(0.42, -0.40, -0.95);
    this.vmRifle.renderOrder = 20;
    cam.add(this.vmRifle);

    this.vmGrenade = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 0.79),
      new THREE.MeshBasicMaterial({
        map: viewmodelTexture('grenade'), transparent: true,
        depthTest: false, depthWrite: false,
      })
    );
    this.vmGrenade.position.set(0.42, -0.40, -0.95);
    this.vmGrenade.renderOrder = 20;
    this.vmGrenade.visible = false;
    cam.add(this.vmGrenade);

    this.muzzle = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.55),
      new THREE.MeshBasicMaterial({
        map: muzzleTexture(), transparent: true,
        depthTest: false, depthWrite: false,
      })
    );
    this.muzzle.position.set(0.42, -0.22, -1.0);
    this.muzzle.renderOrder = 21;
    this.muzzle.visible = false;
    cam.add(this.muzzle);

    this.muzzleLight = new THREE.PointLight(0xFFD3E3, 0, 9);
    cam.add(this.muzzleLight);

    this.switchWeapon(this.weapon);
  }

  spawn(level) {
    this.pos.set(level.start.x, 0, level.start.z);
    this.vel.set(0, 0, 0);
    this.health = this.maxHealth;
    this.grenades = 3;
    this.keys = 0;
    this.dead = false;
    this.yaw = 0;
    this.pitch = 0;
    this.weapon = 'rifle';
    this.switchWeapon('rifle');
    this.game.ui.setKeys(0);
  }

  switchWeapon(w) {
    this.weapon = w;
    this.vmRifle.visible = w === 'rifle';
    this.vmGrenade.visible = w === 'grenade';
    this.game.ui.setWeapon(w, w === 'rifle' ? Infinity : this.grenades);
  }

  toggleWeapon() {
    if (this.weapon === 'rifle' && this.grenades > 0) this.switchWeapon('grenade');
    else this.switchWeapon('rifle');
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.health -= amount;
    this.game.onPlayerHurt(amount);
    this.game.ui.setHealth(this.health);
    this.noDamageStreak = 0;

    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.game.onPlayerDeath();
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.game.ui.setHealth(this.health);
  }

  update(dt) {
    const input = this.game.input;
    const level = this.game.level;

    if (this.dead) {
      this.updateCamera(dt);
      return;
    }

    const look = input.consumeLook();
    this.yaw += look.dx;
    this.pitch += look.dy;
    const maxPitch = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    let fwd = 0, strafe = 0;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) fwd += 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) fwd -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) strafe += 1;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) strafe -= 1;

    fwd -= input.touchMove.y;
    strafe += input.touchMove.x;

    const mag = Math.hypot(fwd, strafe);
    if (mag > 1) { fwd /= mag; strafe /= mag; }

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wishX = (-sin * fwd + cos * strafe);
    const wishZ = (-cos * fwd - sin * strafe);

    const accel = this.onGround ? ACCEL : AIR_ACCEL;
    this.vel.x += wishX * accel * dt;
    this.vel.z += wishZ * accel * dt;

    if (this.onGround) {
      const speed = Math.hypot(this.vel.x, this.vel.z);
      if (speed > 0.0001) {
        const drop = speed * FRICTION * dt;
        const nf = Math.max(0, speed - drop) / speed;
        this.vel.x *= nf;
        this.vel.z *= nf;
      }
    }

    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (hSpeed > MAX_SPEED) {
      const k = MAX_SPEED / hSpeed;
      this.vel.x *= k;
      this.vel.z *= k;
    }

    if (input.jumpQueued) {
      input.jumpQueued = false;
      if (this.onGround) {
        this.vel.y = JUMP_VEL;
        this.onGround = false;
      }
    }

    this.vel.y -= GRAVITY * dt;

    this.moveWithCollision(dt);

    const spd = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && spd > 0.6) {
      this.bobPhase += dt * (7 + spd * 1.1);
      this.bobY = Math.sin(this.bobPhase * 2) * 0.035 * Math.min(1, spd / MAX_SPEED);
      this.bobRoll = Math.sin(this.bobPhase) * 0.012 * Math.min(1, spd / MAX_SPEED);
    } else {
      this.bobY *= Math.max(0, 1 - dt * 8);
      this.bobRoll *= Math.max(0, 1 - dt * 8);
    }

    this.fireCooldown -= dt;
    this.grenadeCooldown -= dt;
    this.muzzleTimer -= dt;
    this.kick *= Math.max(0, 1 - dt * 12);

    if (input.swapQueued) {
      input.swapQueued = false;
      this.toggleWeapon();
    }

    if (input.interactQueued) {
      input.interactQueued = false;
      this.tryInteract();
    }

    const wantFire = input.firing || input.touchFire;
    if (wantFire) {
      if (this.weapon === 'rifle' && this.fireCooldown <= 0) {
        this.fireRifle();
      } else if (this.weapon === 'grenade' && this.grenadeCooldown <= 0 && this.grenades > 0) {
        this.throwGrenade();
      }
    }

    this.muzzle.visible = this.muzzleTimer > 0;
    this.muzzleLight.intensity = this.muzzleTimer > 0 ? 2.6 : 0;

    const swayX = Math.sin(this.bobPhase) * 0.02 * Math.min(1, spd / MAX_SPEED);
    const swayY = Math.abs(Math.cos(this.bobPhase)) * 0.016 * Math.min(1, spd / MAX_SPEED);
    for (const vm of [this.vmRifle, this.vmGrenade]) {
      vm.position.x = 0.42 + swayX;
      vm.position.y = -0.40 - swayY - this.kick * 0.06;
    }
    this.muzzle.position.y = -0.22 - swayY - this.kick * 0.06;

    this.checkSecrets();
    this.updateInteractHint();
    this.updateCamera(dt);
  }

  moveWithCollision(dt) {
    const level = this.game.level;
    const r = PLAYER_RADIUS;

    const blocked = (x, z) => {
      return isBlockedWorld(level, x - r, z - r) ||
             isBlockedWorld(level, x + r, z - r) ||
             isBlockedWorld(level, x - r, z + r) ||
             isBlockedWorld(level, x + r, z + r);
    };

    const dx = this.vel.x * dt;
    const dz = this.vel.z * dt;

    if (!blocked(this.pos.x + dx, this.pos.z)) this.pos.x += dx;
    else { this.vel.x = 0; this.tryOpenNearbyDoor(); }

    if (!blocked(this.pos.x, this.pos.z + dz)) this.pos.z += dz;
    else { this.vel.z = 0; this.tryOpenNearbyDoor(); }

    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  tryOpenNearbyDoor() {
    const level = this.game.level;
    const tx = Math.floor(this.pos.x / TILE);
    const tz = Math.floor(this.pos.z / TILE);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (tileAt(level, tx + dx, tz + dz) === T.DOOR) {
          this.game.openDoor(tx + dx, tz + dz);
          return;
        }
      }
    }
  }

  checkSecrets() {
    const level = this.game.level;
    for (const s of level.secrets) {
      if (s.found) continue;
      const d = Math.hypot(this.pos.x - (s.x + 0.5) * TILE,
                           this.pos.z - (s.z + 0.5) * TILE);
      if (d < 2.6) this.game.revealSecret(s);
    }
  }

  findNearSecret() {
    const g = this.game;
    for (const spr of g.secretSprites) {
      const s = spr.userData && spr.userData.secret;
      if (!s) continue;
      const d = Math.hypot(spr.position.x - this.pos.x, spr.position.z - this.pos.z);
      if (d < INTERACT_DIST) return { spr, s };
    }
    return null;
  }

  findNearLockedDoor() {
    const level = this.game.level;
    const tx = Math.floor(this.pos.x / TILE);
    const tz = Math.floor(this.pos.z / TILE);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx, nz = tz + dz;
        if (tileAt(level, nx, nz) !== T.LOCKED) continue;
        const wx = (nx + 0.5) * TILE;
        const wz = (nz + 0.5) * TILE;
        const d = Math.hypot(wx - this.pos.x, wz - this.pos.z);
        if (d < DOOR_INTERACT_DIST) return { tx: nx, tz: nz };
      }
    }
    return null;
  }

  tryInteract() {
    const g = this.game;

    const nearSecret = this.findNearSecret();
    if (nearSecret) {
      const { s } = nearSecret;
      if (!s.keyTaken) {
        s.keyTaken = true;
        this.keys++;
        g.ui.setKeys(this.keys);
        g.ui.toast('+1 KEY \u2661');
        g.audio.pickup();
      }
      g.ui.showSecretMessage(g.ui.randomSecretMessage());
      return;
    }

    const nearDoor = this.findNearLockedDoor();
    if (nearDoor) {
      if (this.keys > 0) {
        this.keys--;
        g.ui.setKeys(this.keys);
        g.unlockDoor(nearDoor.tx, nearDoor.tz);
        g.ui.toast('DOOR UNLOCKED \u2661');
      } else {
        g.ui.toastCooldown('NEED A KEY \u2661', 1300, 'need-key');
      }
      return;
    }
  }

  updateInteractHint() {
    const show = !!(this.findNearSecret() || this.findNearLockedDoor());
    this.game.ui.showInteractHint(show);
  }

  updateCamera(dt) {
    const cam = this.game.engine.camera;
    const g = this.game;

    let shakeX = 0, shakeY = 0;
    if (g.shake > 0.001) {
      shakeX = (Math.random() - 0.5) * g.shake * 0.22;
      shakeY = (Math.random() - 0.5) * g.shake * 0.22;
    }

    cam.position.set(
      this.pos.x + shakeX,
      this.pos.y + EYE_HEIGHT + this.bobY + shakeY,
      this.pos.z
    );
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch + this.kick * 0.05;
    cam.rotation.z = this.bobRoll + shakeX * 0.4;
  }

  fireRifle() {
    const g = this.game;
    this.fireCooldown = 0.085;
    this.muzzleTimer = 0.055;
    this.kick = 1;

    g.audio.shoot();
    g.stats.shotsFired++;

    const cam = g.engine.camera;
    const origin = new THREE.Vector3();
    cam.getWorldPosition(origin);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();

    const wallHit = raycastGrid(g.level, origin.x, origin.z, dir.x, dir.z, 70);
    let bestDist = wallHit.dist;
    let bestEnemy = null;

    for (const e of g.enemies) {
      if (!e.alive) continue;
      const t = raySphere(
        origin.x, origin.y, origin.z,
        dir.x, dir.y, dir.z,
        e.pos.x, e.pos.y + e.centerY, e.pos.z,
        e.hitRadius
      );
      if (t !== null && t > 0.1 && t < bestDist) {
        bestDist = t;
        bestEnemy = e;
      }
    }

    const ix = origin.x + dir.x * bestDist;
    const iy = origin.y + dir.y * bestDist;
    const iz = origin.z + dir.z * bestDist;

    if (bestEnemy) {
      g.stats.shotsHit++;
      bestEnemy.damage(34, dir);
      g.particles.burst(ix, iy, iz, 12, {
        color: 0x8B0000, speed: 5, life: 0.45, size: 0.09, gravity: 24,
      });
      g.particles.burst(ix, iy, iz, 6, {
        color: 0xC40000, speed: 8, life: 0.3, size: 0.07, gravity: 20,
      });
      g.ui.hitmark();
    } else {
      g.particles.burst(ix, iy, iz, 6, {
        color: 0xFFFFFF, speed: 4, life: 0.25, size: 0.07, gravity: 18,
      });
      g.particles.burst(ix, iy, iz, 4, {
        color: 0xFF9EC2, speed: 6, life: 0.3, size: 0.06, gravity: 18,
      });
    }
  }

  throwGrenade() {
    const g = this.game;
    if (this.grenades <= 0) return;

    this.grenades--;
    this.grenadeCooldown = 0.65;
    this.kick = 0.7;
    g.audio.throwGrenade();
    g.ui.setWeapon('grenade', this.grenades);

    const cam = g.engine.camera;
    const origin = new THREE.Vector3();
    cam.getWorldPosition(origin);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();

    g.spawnGrenade(
      origin.x + dir.x * 0.7,
      origin.y + dir.y * 0.7 - 0.15,
      origin.z + dir.z * 0.7,
      dir.x * 17 + this.vel.x,
      dir.y * 17 + 3.5,
      dir.z * 17 + this.vel.z
    );

    if (this.grenades <= 0) this.switchWeapon('rifle');
    else g.ui.setWeapon('grenade', this.grenades);
  }
}

export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const mx = ox - cx, my = oy - cy, mz = oz - cz;
  const b = mx * dx + my * dy + mz * dz;
  const c = mx * mx + my * my + mz * mz - r * r;
  if (c > 0 && b > 0) return null;
  const disc = b * b - c;
  if (disc < 0) return null;
  let t = -b - Math.sqrt(disc);
  if (t < 0) t = 0;
  return t;
}