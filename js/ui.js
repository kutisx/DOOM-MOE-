/* ================================================================
 * ui.js — HUD, меню, настройки, touch, оверлеи, фон меню.
 * ================================================================ */

const SECRET_MESSAGES = [
  'you found a secret. it was waiting for you. \u2661',
  "shhh. don't tell the others.",
  'behind the wallpaper, something smiled back.',
  "a gift, just for you. it's still warm.",
  '\u2727 the walls have secrets. now they have you. \u2727',
  'you hear purring. nothing is here. everything is here.',
  "kawaii... isn't it? the pink is not paint.",
  'it remembers you. from the other side.',
  'found it! (it found you first.)',
  'the cupcakes are watching. always watching.',
  '+250 points. you earned them. we earned you.',
  'somebody left this here for you. somebody still is.',
  'the ribbon was tied by fingers you cannot see.',
  'do not turn around. the secret is behind you. it always was.',
  'soft. warm. wet. a secret should feel like this.',
  'you are the fourth to find this. the other three are still here.',
  'it giggles when you blink.',
  'the little key hums a lullaby. take it. take it.',
  'press E, it whispered. press E, and i am yours.',
  'a gift. a key. a very small debt.',
];

const MENU_BG_IMAGES = [
  'img/menu-bg-1.png',
  'img/menu-bg-2.png',
  'img/menu-bg-3.png',
];
const MENU_BG_INTERVAL = 10000;

/* Пиксельная пастельно-голубая иконка ключа.
   Сетка 14 x 8, символы: E = обводка, B = тело, H = блик, . = пусто. */
const KEY_PX = [
  '..EEEE........',
  '.EBBBBE.......',
  'EBBEEBBE......',
  'EBE..EBEEEEEEE',
  'EBE..EBBBBBBBE',
  'EBBEEBBE.E.E.E',
  '.EBBBBE..E.E.E',
  '..EEEE...EEEEE',
];
const KEY_COLORS = {
  E: '#5FA5CC', // обводка, пастельно-голубая
  B: '#B8E0F5', // тело
  H: '#E0F3FF', // блик
};
const KEY_SCALE = 4; // 14 * 4 = 56, 8 * 4 = 32

export class UI {
  constructor(game) {
    this.game = game;

    this.screens = {
      menu:     document.getElementById('screen-menu'),
      settings: document.getElementById('screen-settings'),
      credits:  document.getElementById('screen-credits'),
      pause:    document.getElementById('screen-pause'),
      dead:     document.getElementById('screen-dead'),
      victory:  document.getElementById('screen-victory'),
    };

    this.hud        = document.getElementById('hud');
    this.scoreEl    = document.getElementById('hud-score');
    this.remainEl   = document.getElementById('hud-remaining');
    this.timeEl     = document.getElementById('hud-time');
    this.healthEl   = document.getElementById('health-num');
    this.keysEl     = document.getElementById('keys-num');
    this.keysIconCv = document.getElementById('keys-icon');
    this.ammoEl     = document.getElementById('ammo');
    this.weaponEl   = document.getElementById('weapon-name');
    this.toastEl    = document.getElementById('toast');
    this.hitmarkEl  = document.getElementById('hitmark');
    this.healthCv   = document.getElementById('health-icon');
    this.lockHint   = document.getElementById('lock-hint');
    this.secretMsgEl = document.getElementById('secret-msg');
    this.interactHintEl = document.getElementById('interact-hint');

    this._toastTimer = null;
    this._hitTimer = null;
    this._toastCooldowns = {};

    this.settings = this.loadSettings();
    this.bindButtons();
    this.bindSettings();
    this.applySettings();

    this.drawHealthIcon(100);
    this.drawKeyIcon();
    this.initMenuBackground();
  }

  /* ---------------- menu background ---------------- */

  initMenuBackground() {
    this.menuScreen = document.getElementById('screen-menu');
    this.menuLayers = [
      document.getElementById('menu-bg-a'),
      document.getElementById('menu-bg-b'),
    ].filter(Boolean);
    this.menuImages = [];
    this.menuIndex = 0;
    this.menuLayerIndex = 0;
    this.menuBGTimer = null;

    if (!this.menuScreen || this.menuLayers.length === 0) return;

    let pending = MENU_BG_IMAGES.length;
    const onAllDone = () => {
      if (--pending > 0) return;
      if (this.menuImages.length === 0) return;
      this.showMenuBg(0, true);
      this.scheduleMenuBg();
    };

    MENU_BG_IMAGES.forEach(src => {
      const img = new Image();
      img.onload = () => { this.menuImages.push(src); onAllDone(); };
      img.onerror = () => { onAllDone(); };
      img.src = src;
    });

    this.menuScreen.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (e.target.closest('input')) return;
      if (e.target.closest('select')) return;
      if (this.menuImages.length === 0) return;
      this.showMenuBg(this.menuIndex + 1);
      this.scheduleMenuBg();
    });
  }

  showMenuBg(index, instant = false) {
    if (this.menuImages.length === 0) return;
    const n = this.menuImages.length;
    this.menuIndex = ((index % n) + n) % n;
    const src = this.menuImages[this.menuIndex];

    const next = (this.menuLayerIndex + 1) % this.menuLayers.length;
    const layer = this.menuLayers[next];
    const prev = this.menuLayers[this.menuLayerIndex];

    layer.style.backgroundImage = `url("${src}")`;

    if (instant) {
      layer.style.transition = 'none';
      layer.classList.add('active');
      if (prev) prev.classList.remove('active');
      void layer.offsetWidth;
      layer.style.transition = '';
    } else {
      layer.classList.add('active');
      if (prev) prev.classList.remove('active');
    }
    this.menuLayerIndex = next;
  }

  scheduleMenuBg() {
    clearTimeout(this.menuBGTimer);
    if (this.menuImages.length < 2) return;
    this.menuBGTimer = setTimeout(() => {
      this.showMenuBg(this.menuIndex + 1);
      this.scheduleMenuBg();
    }, MENU_BG_INTERVAL);
  }

  /* ---------------- settings ---------------- */

  loadSettings() {
    const defaults = {
      sens: 2.4, master: 0.7, music: 0.35, sfx: 0.8, crt: true,
      track: 'shuffle',
    };
    try {
      const raw = localStorage.getItem('doommoe.settings');
      if (raw) return Object.assign(defaults, JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return defaults;
  }

  saveSettings() {
    try {
      localStorage.setItem('doommoe.settings', JSON.stringify(this.settings));
    } catch (e) { /* ignore */ }
  }

  bindSettings() {
    const sens = document.getElementById('set-sens');
    const master = document.getElementById('set-master');
    const music = document.getElementById('set-music');
    const sfx = document.getElementById('set-sfx');
    const crt = document.getElementById('set-crt');
    const track = document.getElementById('set-track');

    sens.value = this.settings.sens;
    master.value = this.settings.master;
    music.value = this.settings.music;
    sfx.value = this.settings.sfx;
    crt.checked = this.settings.crt;
    if (track) track.value = this.settings.track || 'shuffle';

    const onChange = () => {
      this.settings.sens = parseFloat(sens.value);
      this.settings.master = parseFloat(master.value);
      this.settings.music = parseFloat(music.value);
      this.settings.sfx = parseFloat(sfx.value);
      this.settings.crt = crt.checked;
      if (track) this.settings.track = track.value;
      this.applySettings();
      this.saveSettings();
    };

    [sens, master, music, sfx, crt, track].forEach(el => {
      if (!el) return;
      el.addEventListener('input', onChange);
      el.addEventListener('change', onChange);
    });
  }

  applySettings() {
    const g = this.game;
    if (g.input) g.input.sensitivity = this.settings.sens;
    g.audio.setMaster(this.settings.master);
    g.audio.setMusic(this.settings.music);
    g.audio.setSfx(this.settings.sfx);
    g.audio.setTrack(this.settings.track || 'shuffle');
    g.engine.setCRT(this.settings.crt);
  }

  /* ---------------- buttons ---------------- */

  bindButtons() {
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.game.audio.init();
        this.game.audio.resume();
        this.game.handleAction(action);
      });
    });
  }

  /* ---------------- screens ---------------- */

  hideAll() {
    Object.values(this.screens).forEach(s => s.classList.add('hidden'));
  }

  show(name) {
    this.hideAll();
    if (name && this.screens[name]) this.screens[name].classList.remove('hidden');
  }

  showHUD(on) {
    this.hud.classList.toggle('hidden', !on);
    if (!on) this.showInteractHint(false);
  }

  /* ---------------- HUD ---------------- */

  setScore(v) { this.scoreEl.textContent = v; }
  setRemaining(v) { this.remainEl.textContent = v; }

  setTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    this.timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }

  setHealth(hp) {
    const v = Math.max(0, Math.round(hp));
    this.healthEl.textContent = v;
    this.healthEl.classList.toggle('low', v <= 30);
    this.drawHealthIcon(v);
  }

  setKeys(n) {
    if (this.keysEl) this.keysEl.textContent = String(n);
  }

  setWeapon(name, ammo) {
    this.weaponEl.textContent = name === 'rifle' ? 'RIFFLE' : 'GRENADE';
    this.ammoEl.innerHTML = ammo === Infinity ? '&#8734;' : String(ammo);
  }

  toast(msg, ms = 1600) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, ms);
  }

  toastCooldown(msg, ms = 1200, key = msg, cdMs = 2200) {
    const now = performance.now();
    const last = this._toastCooldowns[key] || 0;
    if (now - last < cdMs) return;
    this._toastCooldowns[key] = now;
    this.toast(msg, ms);
  }

  hitmark() {
    this.hitmarkEl.classList.add('show');
    clearTimeout(this._hitTimer);
    this._hitTimer = setTimeout(() => {
      this.hitmarkEl.classList.remove('show');
    }, 90);
  }

  showLockHint(on) {
    this.lockHint.classList.toggle('hidden', !on);
  }

  showInteractHint(on) {
    if (!this.interactHintEl) return;
    this.interactHintEl.classList.toggle('hidden', !on);
  }

  showSecretMessage(text) {
    const el = this.secretMsgEl;
    const msg = text || SECRET_MESSAGES[Math.floor(Math.random() * SECRET_MESSAGES.length)];
    el.textContent = msg;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  randomSecretMessage() {
    return SECRET_MESSAGES[Math.floor(Math.random() * SECRET_MESSAGES.length)];
  }

  /* ---------------- icons ---------------- */

  drawHealthIcon(hp) {
    const c = this.healthCv;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);

    const ratio = Math.max(0, Math.min(1, hp / 100));
    const rows = [
      '01100110',
      '11111111',
      '11111111',
      '11111111',
      '01111110',
      '00111100',
      '00011000',
    ];
    const s = 8;
    const ox = (c.width - 8 * s) / 2;
    const oy = (c.height - 7 * s) / 2;

    const bright = ratio > 0.6 ? '#FFFFFF' : ratio > 0.3 ? '#FFD6D6' : '#B00000';
    const shade  = ratio > 0.6 ? '#F06A9B' : ratio > 0.3 ? '#C24C77' : '#5A0000';

    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < 8; x++) {
        if (rows[y][x] !== '1') continue;
        const edge = y === 0 || y === rows.length - 1 || x === 0 || x === 7;
        ctx.fillStyle = edge ? shade : bright;
        ctx.fillRect(ox + x * s, oy + y * s, s, s);
      }
    }

    if (ratio < 0.8) {
      ctx.fillStyle = '#3A0010';
      const cracks = Math.floor((1 - ratio) * 9);
      for (let i = 0; i < cracks; i++) {
        const cx = ox + 8 + ((i * 17) % (5 * s));
        const cy = oy + 8 + ((i * 11) % (4 * s));
        ctx.fillRect(cx, cy, s * 0.7, s * 0.7);
        ctx.fillRect(cx + s * 0.7, cy + s * 0.7, s * 0.6, s * 0.6);
      }
    }
  }

  drawKeyIcon() {
    const c = this.keysIconCv;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;

    const s = KEY_SCALE;
    for (let y = 0; y < KEY_PX.length; y++) {
      const row = KEY_PX[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        const col = KEY_COLORS[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
  }

  /* ---------------- stats blocks ---------------- */

  formatStats(g, title) {
    const acc = g.stats.shotsFired > 0
      ? Math.round((g.stats.shotsHit / g.stats.shotsFired) * 100)
      : 0;
    const total = g.level ? g.level.enemies.length : 0;
    const mins = Math.floor(g.elapsed / 60);
    const secs = Math.floor(g.elapsed % 60);

    return `
      ${title ? `<b>${title}</b><br>` : ''}
      SCORE &nbsp;<b>${g.score}</b><br>
      DEMONS KILLED &nbsp;<b>${g.stats.kills}</b> / ${total}<br>
      SECRETS FOUND &nbsp;<b>${g.stats.secrets}</b><br>
      ACCURACY &nbsp;<b>${acc}%</b><br>
      TIME &nbsp;<b>${mins}:${secs.toString().padStart(2, '0')}</b>
    `;
  }

  showPauseStats(g) {
    document.getElementById('pause-stats').innerHTML = this.formatStats(g, '');
  }

  showDeathStats(g) {
    document.getElementById('dead-stats').innerHTML = this.formatStats(g, 'FINAL TALLY');
  }

  showVictoryStats(g) {
    document.getElementById('win-stats').innerHTML = this.formatStats(g, 'FINAL TALLY');
  }
}

export { SECRET_MESSAGES };