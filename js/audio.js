/* ================================================================
 * audio.js — все звуки синтезируются через Web Audio API.
 * Треки: classic / apocalypse / lullaby / rave / off + SHUFFLE.
 * По умолчанию — SHUFFLE (треки играют по очереди, случайно).
 * ================================================================ */

const SHUFFLE_MIN_MS = 60000;
const SHUFFLE_MAX_MS = 90000;

const MUSIC_TRACKS = {
  /* -------------------- KAWAII APOCALYPSE (CLASSIC) --------------------
     Точная копия старой композиции из первой версии игры. */
  classic: {
    name: 'KAWAII APOCALYPSE (CLASSIC)',
    intervalMs: 155,
    play(engine, t, step) {
      const s = step;
      const roots = [0, 0, 5, 7];
      const bar = Math.floor(s / 8) % 4;
      const root = 261.63 * Math.pow(2, roots[bar] / 12);

      if (s % 2 === 0)
        engine._blip(root / 2, 0.17, 'triangle', 0.16, t, engine.musicGain);

      const mel = [0, 4, 7, 12, 7, 4, 0, 7];
      const n = mel[s % 8];
      engine._blip(root * Math.pow(2, n / 12), 0.12, 'square', 0.055, t, engine.musicGain);

      if (Math.random() < 0.045) {
        const bad = root * Math.pow(2, (Math.random() < 0.5 ? 1 : 6) / 12);
        engine._blip(bad, 0.26, 'sawtooth', 0.06, t, engine.musicGain);
        engine._noiseBurst(t, 0.09, 0.05, 3000, 400, engine.musicGain);
      }
    },
  },

  /* -------------------- KAWAII APOCALYPSE (NEON) -------------------- */
  apocalypse: {
    name: 'KAWAII APOCALYPSE (NEON)',
    intervalMs: 155,
    play(engine, t, step) {
      const s = step;
      const roots = [0, 0, 5, 7];
      const bar = Math.floor(s / 8) % 4;
      const root = 261.63 * Math.pow(2, roots[bar] / 12);

      if (s % 2 === 0)
        engine._blip(root / 2, 0.17, 'triangle', 0.16, t, engine.musicGain);

      const mel = [0, 4, 7, 12, 7, 4, 0, 7];
      const n = mel[s % 8];
      engine._blip(root * Math.pow(2, n / 12), 0.12, 'square', 0.055, t, engine.musicGain);

      if (s % 4 === 2)
        engine._noiseBurst(t, 0.05, 0.05, 8000, 5000, engine.musicGain);

      if (Math.random() < 0.045) {
        const bad = root * Math.pow(2, (Math.random() < 0.5 ? 1 : 6) / 12);
        engine._blip(bad, 0.26, 'sawtooth', 0.06, t, engine.musicGain);
        engine._noiseBurst(t, 0.09, 0.05, 3000, 400, engine.musicGain);
      }
    },
  },

  /* -------------------- CORRUPTED LULLABY -------------------- */
  lullaby: {
    name: 'CORRUPTED LULLABY',
    intervalMs: 210,
    play(engine, t, step) {
      const s = step;
      const chord = [220.00, 261.63, 329.63, 440.00];
      const bassRoots = [110.00, 130.81, 98.00, 87.31];
      const bar = Math.floor(s / 8) % 4;

      if (s % 8 === 0)
        engine._blip(bassRoots[bar], 1.6, 'triangle', 0.14, t, engine.musicGain);

      const arp = [0, 1, 2, 3, 2, 1];
      if (s % 2 === 0) {
        const tone = chord[arp[(s >> 1) % 6]];
        engine._blip(tone, 0.5, 'sine', 0.085, t, engine.musicGain);
        engine._blip(tone * 2, 0.35, 'sine', 0.03, t, engine.musicGain);
      }

      if (s % 8 === 4) {
        const pad = bassRoots[bar] * 2;
        engine._blip(pad, 1.2, 'triangle', 0.05, t, engine.musicGain);
      }

      if (s % 16 === 12) {
        const high = chord[Math.floor(Math.random() * chord.length)] * 2;
        engine._blip(high, 1.1, 'sine', 0.045, t, engine.musicGain);
      }

      if (Math.random() < 0.02) {
        engine._blip(233.08 * 0.97, 1.5, 'triangle', 0.05, t, engine.musicGain);
      }
    },
  },

  /* -------------------- BLOOD RAVE -------------------- */
  rave: {
    name: 'BLOOD RAVE',
    intervalMs: 108,
    play(engine, t, step) {
      const s = step;
      const roots = [0, 0, 3, 5, 0, 7, 5, 3];
      const bar = Math.floor(s / 4) % 8;
      const root = 130.81 * Math.pow(2, roots[bar] / 12);

      if (s % 2 === 0) {
        engine._blip(root / 2, 0.10, 'sine', 0.30, t, engine.musicGain, root / 3);
      }
      if (s % 4 === 1) {
        engine._blip(root, 0.09, 'square', 0.10, t, engine.musicGain, root / 1.5);
      }

      if (s % 4 === 2) {
        engine._noiseBurst(t, 0.06, 0.17, 6000, 1800, engine.musicGain);
      }
      if (s % 4 === 1 || s % 4 === 3) {
        engine._noiseBurst(t, 0.035, 0.09, 9000, 6000, engine.musicGain);
      }

      if (s % 8 === 0 || s % 8 === 3 || s % 8 === 6) {
        const lick = [0, 12, 15, 19][Math.floor(s / 8) % 4];
        engine._blip(
          root * 2 * Math.pow(2, lick / 12),
          0.13, 'square', 0.10, t, engine.musicGain
        );
      }

      if (Math.random() < 0.055) {
        engine._blip(
          root * 4 * (0.5 + Math.random()),
          0.14, 'sawtooth', 0.06, t, engine.musicGain
        );
        engine._noiseBurst(t, 0.05, 0.05, 5000, 800, engine.musicGain);
      }
    },
  },

  /* -------------------- OFF -------------------- */
  off: {
    name: 'OFF',
    intervalMs: 155,
    play() { /* silence */ },
  },
};

const SHUFFLE_POOL = ['classic', 'apocalypse', 'lullaby', 'rave'];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.shuffleTimer = null;
    this.step = 0;
    this.noise = null;
    this.masterVol = 0.7;
    this.musicVol = 0.35;
    this.sfxVol = 0.8;
    this.currentTrack = 'shuffle';
    this.activeTrack = 'classic';
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.masterVol;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVol;
    this.musicGain.connect(this.master);

    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMaster(v) { this.masterVol = v; if (this.master) this.master.gain.value = v; }
  setMusic(v)  { this.musicVol = v;  if (this.musicGain) this.musicGain.gain.value = v; }
  setSfx(v)    { this.sfxVol = v;    if (this.sfxGain) this.sfxGain.gain.value = v; }

  _blip(freq, dur, type, peak, t, dest, slideTo) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  _noiseBurst(t, dur, peak, filterFrom, filterTo, dest) {
    if (!this.ctx || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(filterFrom, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest || this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  shoot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._blip(920, 0.09, 'square', 0.20, t, this.sfxGain, 190);
    this._noiseBurst(t, 0.06, 0.12, 4000, 900, this.sfxGain);
  }

  throwGrenade() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._blip(260, 0.16, 'sine', 0.22, t, this.sfxGain, 760);
    this._blip(520, 0.10, 'triangle', 0.10, t + 0.05, this.sfxGain, 980);
  }

  explosion() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(t, 0.65, 0.85, 1800, 110, this.sfxGain);
    this._blip(120, 0.5, 'sawtooth', 0.45, t, this.sfxGain, 34);
    this._blip(70, 0.65, 'square', 0.30, t + 0.02, this.sfxGain, 25);
  }

  enemyShoot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._blip(420, 0.22, 'triangle', 0.16, t, this.sfxGain, 180);
    this._blip(660, 0.12, 'sine', 0.09, t + 0.03, this.sfxGain, 240);
  }

  enemyHurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(t, 0.08, 0.20, 2400, 500, this.sfxGain);
    this._blip(300, 0.09, 'square', 0.10, t, this.sfxGain, 160);
  }

  enemyDeath() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(t, 0.22, 0.35, 1400, 180, this.sfxGain);
    this._blip(560, 0.09, 'triangle', 0.18, t + 0.06, this.sfxGain, 780);
    this._blip(760, 0.09, 'triangle', 0.16, t + 0.15, this.sfxGain, 700);
    this._blip(700, 0.05, 'triangle', 0.10, t + 0.24, this.sfxGain, 300);
  }

  playerHurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._blip(180, 0.26, 'sawtooth', 0.28, t, this.sfxGain, 70);
    this._noiseBurst(t, 0.16, 0.18, 900, 200, this.sfxGain);
  }

  door() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._blip(880, 0.20, 'sine', 0.16, t, this.sfxGain);
    this._blip(1320, 0.28, 'sine', 0.12, t + 0.06, this.sfxGain);
    this._blip(1760, 0.35, 'sine', 0.08, t + 0.12, this.sfxGain);
  }

  secret() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [392, 370, 349, 311, 294, 262, 247, 220];
    notes.forEach((f, i) => {
      this._blip(f, 0.35, 'triangle', 0.12, t + i * 0.09, this.sfxGain);
    });
    this._blip(82.4, 1.4, 'sawtooth', 0.10, t + 0.2, this.sfxGain);
    this._noiseBurst(t, 0.7, 0.06, 2000, 400, this.sfxGain);
  }

  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._blip(700, 0.09, 'square', 0.14, t, this.sfxGain, 1050);
    this._blip(1050, 0.12, 'square', 0.12, t + 0.07, this.sfxGain, 1400);
  }

  win() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((f, i) => this._blip(f, 0.22, 'square', 0.16, t + i * 0.13, this.sfxGain));
  }

  lose() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [440, 415, 392, 370, 349, 330, 262];
    notes.forEach((f, i) => this._blip(f, 0.30, 'sawtooth', 0.16, t + i * 0.16, this.sfxGain));
    this._noiseBurst(t + 0.5, 0.8, 0.15, 600, 80, this.sfxGain);
  }

  /* ---------- music ---------- */

  setTrack(name) {
    if (name !== 'shuffle' && !MUSIC_TRACKS[name]) return;
    const wasPlaying = !!this.musicTimer || !!this.shuffleTimer;
    this.stopMusic();
    this.currentTrack = name;
    if (wasPlaying) this.startMusic();
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    if (this.currentTrack === 'off') return;

    let trackName = this.currentTrack;
    if (trackName === 'shuffle') trackName = this._pickShuffleTrack();

    const track = MUSIC_TRACKS[trackName];
    if (!track || trackName === 'off') return;

    this.activeTrack = trackName;
    this.step = 0;
    this.musicTimer = setInterval(() => this._tick(), track.intervalMs);

    if (this.currentTrack === 'shuffle') {
      const delay = SHUFFLE_MIN_MS + Math.random() * (SHUFFLE_MAX_MS - SHUFFLE_MIN_MS);
      this.shuffleTimer = setTimeout(() => {
        this.shuffleTimer = null;
        const wasPlaying = !!this.musicTimer;
        this.stopMusic();
        if (wasPlaying) this.startMusic();
      }, delay);
    }
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.shuffleTimer) {
      clearTimeout(this.shuffleTimer);
      this.shuffleTimer = null;
    }
  }

  _pickShuffleTrack() {
    const pool = SHUFFLE_POOL.filter(n => n !== this.activeTrack);
    const list = pool.length ? pool : SHUFFLE_POOL;
    return list[Math.floor(Math.random() * list.length)];
  }

  _tick() {
    if (!this.ctx) return;
    const track = MUSIC_TRACKS[this.activeTrack];
    if (!track) return;
    const t = this.ctx.currentTime;
    track.play(this, t, this.step++);
  }
}

export { MUSIC_TRACKS };