import * as THREE from 'three';

function mkCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function toTex(canvas, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 1;
  return t;
}

function blit(ctx, rows, pal, ox, oy, s) {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const P = {
  pink:   '#FFC0CB',
  pinkL:  '#FFE3EC',
  pinkD:  '#F09CBB',
  pinkDD: '#D9739A',
  white:  '#FFFFFF',
  cream:  '#FFF7FA',
  ink:    '#5A3448',
  inkD:   '#2E1B26',
  rose:   '#F06A9B',
  blood:  '#8B0000',
  blood2: '#C40000',
};

const HEART = [
  '01100110',
  '11111111',
  '11111111',
  '11111111',
  '01111110',
  '00111100',
  '00011000',
];
const BOW = [
  '.XX....XX.',
  'XXXX..XXXX',
  'XXXXXXXXXX',
  'XXXX..XXXX',
  '.XX....XX.',
];
const CATFACE = [
  '.XX..XX.',
  'XWWXXWWX',
  'XWKXXKWX',
  'XWWWWWWX',
  'XWXPPXWX',
  '.XWWWWX.',
  '..XXXX..',
];
const STAR = [
  '..X..',
  '..X..',
  'XXXXX',
  '..X..',
  '..X..',
];
const HEART_PAL  = { '1': P.white, '0': P.rose };
const BOW_PAL    = { 'X': P.rose };
const CAT_PAL    = { 'X': P.ink, 'W': P.white, 'K': P.inkD, 'P': P.rose };
const STAR_PAL   = { 'X': P.white };

const CACHE = new Map();
function cached(key, factory) {
  if (!CACHE.has(key)) CACHE.set(key, factory());
  return CACHE.get(key);
}

function drawLace(ctx, size, y, color) {
  ctx.fillStyle = color;
  for (let x = 0; x < size; x += 6) {
    ctx.fillRect(x, y, 3, 2);
    ctx.fillRect(x + 3, y + 2, 3, 2);
  }
}

function wallHearts() {
  const { c, ctx } = mkCanvas(64);
  ctx.fillStyle = P.pink;  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = P.pinkL;
  for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 8, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  for (let y = 0; y < 64; y += 32)
    for (let x = 0; x < 64; x += 32) ctx.fillRect(x, y, 16, 16);
  for (const [hx, hy] of [[5, 5], [37, 9], [11, 37], [41, 41]])
    blit(ctx, HEART, HEART_PAL, hx, hy, 2);
  drawLace(ctx, 64, 0, P.white);
  drawLace(ctx, 64, 60, P.white);
  return c;
}

function wallBows() {
  const { c, ctx } = mkCanvas(64);
  ctx.fillStyle = P.pinkL; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = P.pink;
  for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let y = 0; y < 64; y += 8) ctx.fillRect(0, y, 64, 2);
  for (const [bx, by] of [[3, 8], [35, 24], [3, 40], [35, 52]])
    blit(ctx, BOW, BOW_PAL, bx, by, 2);
  drawLace(ctx, 64, 0, P.white);
  drawLace(ctx, 64, 60, P.white);
  return c;
}

function wallCats() {
  const { c, ctx } = mkCanvas(64);
  ctx.fillStyle = P.pink; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = P.pinkD;
  for (let x = 0; x < 64; x += 32)
    for (let y = 0; y < 64; y += 32) ctx.fillRect(x, y, 16, 16);
  for (const [fx, fy] of [[6, 6], [36, 6], [6, 36], [36, 36]])
    blit(ctx, CATFACE, CAT_PAL, fx, fy, 2);
  drawLace(ctx, 64, 0, P.white);
  drawLace(ctx, 64, 60, P.white);
  return c;
}

function wallLocked() {
  const { c, ctx } = mkCanvas(64);
  ctx.fillStyle = P.pink;  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = P.pinkD;
  for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let y = 0; y < 64; y += 8) ctx.fillRect(0, y, 64, 1);

  // shackle
  ctx.strokeStyle = P.rose;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(32, 28, 10, Math.PI, 0);
  ctx.stroke();

  // body
  ctx.fillStyle = P.rose;
  ctx.fillRect(18, 30, 28, 24);
  ctx.fillStyle = P.pinkDD;
  ctx.fillRect(18, 30, 28, 3);
  ctx.fillRect(18, 51, 28, 3);

  // keyhole
  ctx.fillStyle = P.ink;
  ctx.fillRect(29, 38, 6, 6);
  ctx.fillRect(30, 43, 4, 8);

  drawLace(ctx, 64, 0, P.white);
  drawLace(ctx, 64, 60, P.white);
  return c;
}

export function wallTexture(variant) {
  return cached('wall' + variant, () => {
    const canv = [wallHearts, wallBows, wallCats, wallLocked][variant % 4]();
    return toTex(canv);
  });
}

export function floorTexture() {
  return cached('floor', () => {
    const { c, ctx } = mkCanvas(64);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 ? P.white : '#FFD9E6';
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }
    ctx.globalAlpha = 0.9;
    for (const [sx, sy] of [[8, 8], [40, 24], [24, 48], [52, 56]])
      blit(ctx, STAR, STAR_PAL, sx, sy, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(240,156,187,0.55)';
    for (let i = 0; i < 64; i += 8) {
      ctx.fillRect(i, 0, 1, 64);
      ctx.fillRect(0, i, 64, 1);
    }
    return toTex(c);
  });
}

export function ceilingTexture() {
  return cached('ceil', () => {
    const { c, ctx } = mkCanvas(64);
    ctx.fillStyle = '#FFE7F0'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#FFD2E2';
    for (let y = 0; y < 64; y += 8)
      for (let x = 0; x < 64; x += 8)
        if ((x + y) % 16 === 0) ctx.fillRect(x + 3, y + 3, 2, 2);
    return toTex(c);
  });
}

export function exitTexture() {
  return cached('exitFloor', () => {
    const { c, ctx } = mkCanvas(64);
    ctx.fillStyle = '#FFD9EA'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#FF9EC2';
    for (let i = 0; i < 64; i += 16) ctx.fillRect(i, 0, 8, 64);
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 64; i += 16) ctx.fillRect(i + 8, 0, 8, 64);
    return toTex(c);
  });
}

const SPR_SIZE = 48;
const SPR_SCALE = 3;

function pixelPen(ctx) {
  return (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x * SPR_SCALE, y * SPR_SCALE, w * SPR_SCALE, h * SPR_SCALE);
  };
}

function drawCatMascot(ctx, mode, frame) {
  const R = pixelPen(ctx);
  const BODY  = '#3B2B41', BODY2 = '#241628', FACE = '#FFF2F7';
  const PINK  = '#FF8FBB', EYE = '#FF2E55', DARK = '#140B18', GORE = '#8B0000';

  if (mode === 'dead') {
    R(2, 12, 12, 3, BODY); R(1, 13, 14, 2, BODY2);
    R(4, 10, 3, 3, FACE);  R(9, 10, 3, 3, FACE);
    R(3, 14, 4, 1, GORE);  R(9, 14, 4, 1, GORE);
    R(7, 11, 2, 2, GORE);
    return;
  }
  const bob = (mode === 'walk' && frame === 1) ? 1 : 0;
  const y = bob;
  R(4, 14 - y, 3, 2, BODY2);
  R(9, 14 - y, 3, 2, BODY2);
  R(4, 9 - y, 8, 5, BODY);
  R(5, 10 - y, 6, 3, BODY2);
  R(3, 3 - y, 10, 7, BODY);
  R(2, 1 - y, 3, 3, BODY);
  R(11, 1 - y, 3, 3, BODY);
  R(3, 2 - y, 1, 1, PINK);
  R(12, 2 - y, 1, 1, PINK);
  R(4, 4 - y, 8, 5, FACE);
  if (mode === 'attack') {
    R(5, 5 - y, 2, 2, EYE); R(9, 5 - y, 2, 2, EYE);
    R(5, 7 - y, 2, 1, DARK); R(9, 7 - y, 2, 1, DARK);
  } else if (mode === 'hurt') {
    R(5, 5 - y, 2, 2, GORE); R(9, 5 - y, 2, 2, GORE);
  } else {
    R(5, 5 - y, 2, 2, DARK); R(9, 5 - y, 2, 2, DARK);
    R(5, 5 - y, 1, 1, '#FFFFFF'); R(9, 5 - y, 1, 1, '#FFFFFF');
  }
  R(7, 7 - y, 2, 1, PINK);
  R(12, 2 - y, 3, 2, PINK);
  R(11, 1 - y, 2, 1, '#FFFFFF');
}

function drawBunnyMascot(ctx, mode, frame) {
  const R = pixelPen(ctx);
  const BODY  = '#FFF0F6', BODY2 = '#FFD3E3', EAR = '#FFB3D0';
  const PINK  = '#FF7FAE', DARK = '#2E1B26', EYE = '#B00000', GORE = '#8B0000';

  if (mode === 'dead') {
    R(2, 12, 12, 3, BODY2); R(1, 13, 14, 2, BODY);
    R(4, 11, 3, 2, EAR);    R(9, 11, 3, 2, EAR);
    R(3, 14, 5, 1, GORE);   R(8, 14, 5, 1, GORE);
    return;
  }
  const bob = (mode === 'walk' && frame === 1) ? 1 : 0;
  const y = bob;
  R(4, 0 - y, 3, 6, BODY);  R(5, 1 - y, 1, 4, EAR);
  R(9, 0 - y, 3, 6, BODY);  R(10, 1 - y, 1, 4, EAR);
  R(3, 5 - y, 10, 7, BODY);
  R(3, 8 - y, 2, 2, BODY2);
  R(11, 8 - y, 2, 2, BODY2);
  R(4, 11 - y, 8, 4, BODY2);
  R(4, 11 - y, 8, 1, BODY);
  if (mode === 'attack') {
    R(5, 7 - y, 2, 2, EYE); R(9, 7 - y, 2, 2, EYE);
  } else if (mode === 'hurt') {
    R(5, 7 - y, 2, 2, GORE); R(9, 7 - y, 2, 2, GORE);
  } else {
    R(5, 7 - y, 2, 2, DARK); R(9, 7 - y, 2, 2, DARK);
    R(5, 7 - y, 1, 1, '#FFFFFF'); R(9, 7 - y, 1, 1, '#FFFFFF');
  }
  R(7, 9 - y, 2, 1, PINK);
  const hc = mode === 'attack' ? GORE : PINK;
  R(11, 10 - y, 4, 3, hc); R(12, 9 - y, 2, 1, hc);
  R(11, 13 - y, 2, 1, hc); R(13, 13 - y, 2, 1, hc);
}

function drawCupcake(ctx) {
  const R = pixelPen(ctx);
  const CUP = '#FFB3D0', CUP2 = '#E88AB0', FROST = '#FFFFFF', FROST2 = '#FFE3EC';
  const CHERRY = '#C40000', STEM = '#5A3448';
  R(3, 9, 10, 6, CUP);  R(4, 10, 8, 4, CUP2);
  R(5, 11, 2, 1, '#FFFFFF');
  R(4, 5, 8, 5, FROST); R(3, 6, 10, 3, FROST);
  R(5, 4, 6, 2, FROST2);
  R(7, 2, 2, 2, CHERRY); R(7, 1, 1, 1, STEM);
  R(5, 7, 1, 1, FROST2); R(10, 7, 1, 1, FROST2);
}

function drawGrenadePickup(ctx) {
  const R = pixelPen(ctx);
  const WHITE = '#FFF6FA', PINK = '#FF9EC2', DARK = '#2E1B26';
  R(3, 3, 10, 9, WHITE);
  R(2, 1, 3, 3, WHITE); R(11, 1, 3, 3, WHITE);
  R(3, 2, 1, 1, PINK);  R(12, 2, 1, 1, PINK);
  R(5, 6, 2, 2, DARK);  R(9, 6, 2, 2, DARK);
  R(7, 9, 2, 1, PINK);
  R(12, 3, 3, 2, PINK);
}

function drawSecret(ctx, kind) {
  const R = pixelPen(ctx);
  if (kind === 0) {
    const WHITE = '#FFFFFF', DARK = '#2E1B26', PINK = '#FF9EC2';
    R(3, 4, 10, 9, WHITE); R(2, 2, 3, 3, WHITE); R(11, 2, 3, 3, WHITE);
    R(4, 3, 1, 1, PINK);   R(11, 3, 1, 1, PINK);
    R(5, 6, 2, 3, DARK);   R(9, 6, 2, 3, DARK);
    R(7, 10, 2, 2, DARK);  R(6, 12, 4, 1, DARK);
  } else if (kind === 1) {
    const WHITE = '#FFFFFF', DARK = '#2E1B26', PINK = '#FF9EC2';
    R(1, 2, 14, 9, WHITE); R(3, 11, 3, 3, WHITE);
    R(3, 4, 2, 1, DARK); R(5, 4, 2, 1, DARK);
    R(3, 7, 4, 1, DARK); R(8, 4, 5, 1, DARK);
    R(8, 7, 5, 1, DARK); R(12, 5, 1, 2, DARK);
    R(4, 8, 8, 1, PINK);
  } else if (kind === 2) {
    const WHITE = '#FFFFFF', DARK = '#2E1B26', PINK = '#FF9EC2';
    R(1, 1, 14, 14, WHITE);
    R(3, 6, 3, 2, DARK); R(10, 6, 3, 2, DARK);
    R(3, 7, 1, 1, DARK); R(12, 7, 1, 1, DARK);
    R(5, 10, 6, 1, PINK);
    R(5, 11, 2, 1, PINK); R(9, 11, 2, 1, PINK);
  } else {
    R(1, 1, 14, 14, '#FFF0F6');
    blit(ctx, HEART, HEART_PAL, 4, 4, 1.2);
  }
}

function drawViewmodel(kind) {
  const W = 96, H = 72;
  const { c, ctx } = mkCanvas(W, H);
  const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };

  if (kind === 'rifle') {
    R(30, 34, 52, 16, '#4A3548');
    R(30, 34, 52, 4, '#6B4E66');
    R(30, 46, 52, 4, '#2E1B26');
    R(74, 36, 18, 8, '#FF9EC2');
    R(88, 38, 8, 4, '#FFE3EC');
    R(38, 24, 16, 12, '#FFD3E3');
    R(40, 26, 4, 6, '#C40000');
    R(20, 40, 14, 22, '#FF9EC2');
    R(22, 42, 10, 4, '#FFFFFF');
    R(46, 50, 22, 18, '#FFB3D0');
    R(52, 52, 4, 4, '#FFFFFF');
    R(56, 52, 4, 4, '#FFFFFF');
    R(54, 56, 8, 4, '#FFFFFF');
    R(56, 60, 4, 4, '#FFFFFF');
  } else {
    R(28, 30, 56, 18, '#4A3548');
    R(28, 30, 56, 4, '#6B4E66');
    R(28, 44, 56, 4, '#2E1B26');
    R(74, 32, 20, 14, '#FFF6FA');
    R(76, 26, 6, 6, '#FFF6FA');
    R(86, 26, 6, 6, '#FFF6FA');
    R(77, 27, 2, 2, '#FF9EC2');
    R(87, 27, 2, 2, '#FF9EC2');
    R(80, 36, 4, 4, '#2E1B26');
    R(86, 36, 4, 4, '#2E1B26');
    R(18, 38, 14, 24, '#FF9EC2');
    R(20, 40, 10, 4, '#FFFFFF');
  }
  return c;
}

function drawMuzzleFlash() {
  const { c, ctx } = mkCanvas(32);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? 15 : 6;
    const x = 16 + Math.cos(a) * r;
    const y = 16 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFD3E3';
  ctx.beginPath(); ctx.arc(16, 16, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FF9EC2';
  ctx.beginPath(); ctx.arc(16, 16, 3, 0, Math.PI * 2); ctx.fill();
  return c;
}

function drawHeartOrb() {
  const { c, ctx } = mkCanvas(32);
  ctx.clearRect(0, 0, 32, 32);
  const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,60,60,0.95)');
  g.addColorStop(0.5, 'rgba(139,0,0,0.75)');
  g.addColorStop(1, 'rgba(139,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  blit(ctx, HEART, { '1': '#FF3355', '0': '#8B0000' }, 8, 9, 2);
  return c;
}

function drawPortal() {
  const { c, ctx } = mkCanvas(64);
  ctx.clearRect(0, 0, 64, 64);
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,158,194,0.95)');
  g.addColorStop(0.7, 'rgba(240,106,155,0.55)');
  g.addColorStop(1, 'rgba(240,106,155,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = 32 + Math.cos(a) * 22;
    const y = 32 + Math.sin(a) * 22;
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  return c;
}

function drawBloodSplat(seed) {
  const { c, ctx } = mkCanvas(32);
  ctx.clearRect(0, 0, 32, 32);
  const rnd = mulberry32(seed);
  for (let i = 0; i < 26; i++) {
    const x = 16 + (rnd() - 0.5) * 26;
    const y = 16 + (rnd() - 0.5) * 26;
    const s = 1 + Math.floor(rnd() * 3);
    const shade = ['#8B0000', '#A00000', '#C40000', '#5A0000'][Math.floor(rnd() * 4)];
    ctx.fillStyle = shade;
    ctx.fillRect(Math.floor(x), Math.floor(y), s, s);
  }
  return c;
}

export function enemyTexture(type, mode, frame) {
  const key = `enemy_${type}_${mode}_${frame}`;
  return cached(key, () => {
    const { c, ctx } = mkCanvas(SPR_SIZE);
    ctx.clearRect(0, 0, SPR_SIZE, SPR_SIZE);
    if (type === 'melee') drawCatMascot(ctx, mode, frame);
    else drawBunnyMascot(ctx, mode, frame);
    return toTex(c);
  });
}

export function pickupTexture(kind) {
  return cached('pickup_' + kind, () => {
    const { c, ctx } = mkCanvas(SPR_SIZE);
    ctx.clearRect(0, 0, SPR_SIZE, SPR_SIZE);
    if (kind === 'health') drawCupcake(ctx);
    else drawGrenadePickup(ctx);
    return toTex(c);
  });
}

export function secretTexture(kind) {
  return cached('secret_' + kind, () => {
    const { c, ctx } = mkCanvas(SPR_SIZE);
    ctx.clearRect(0, 0, SPR_SIZE, SPR_SIZE);
    drawSecret(ctx, kind);
    return toTex(c);
  });
}

export function viewmodelTexture(kind) {
  return cached('vm_' + kind, () => {
    const c = drawViewmodel(kind);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function muzzleTexture() {
  return cached('muzzle', () => {
    const c = drawMuzzleFlash();
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function orbTexture() {
  return cached('orb', () => {
    const c = drawHeartOrb();
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function portalTexture() {
  return cached('portal', () => {
    const c = drawPortal();
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function bloodTexture(seed) {
  return cached('blood_' + (seed % 6), () => {
    const c = drawBloodSplat(seed);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function makeGrenadeModel() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xFFF6FA });
  const pink  = new THREE.MeshLambertMaterial({ color: 0xFF9EC2 });
  const dark  = new THREE.MeshLambertMaterial({ color: 0x2E1B26 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), white);
  head.scale.set(1.05, 0.92, 1);
  g.add(head);

  const earGeo = new THREE.ConeGeometry(0.09, 0.18, 6);
  const eL = new THREE.Mesh(earGeo, white);
  eL.position.set(-0.13, 0.24, 0);
  eL.rotation.z = 0.28;
  const eR = new THREE.Mesh(earGeo, white);
  eR.position.set(0.13, 0.24, 0);
  eR.rotation.z = -0.28;
  g.add(eL, eR);

  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.03, 4, 8), pink);
  bow.position.set(0.15, 0.15, 0.02);
  bow.rotation.y = Math.PI / 2;
  g.add(bow);

  const eyeGeo = new THREE.SphereGeometry(0.028, 6, 5);
  const eyeL = new THREE.Mesh(eyeGeo, dark);
  eyeL.position.set(-0.075, 0.03, 0.195);
  const eyeR = new THREE.Mesh(eyeGeo, dark);
  eyeR.position.set(0.075, 0.03, 0.195);
  g.add(eyeL, eyeR);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), pink);
  nose.position.set(0, -0.03, 0.21);
  nose.scale.set(1.4, 1, 0.7);
  g.add(nose);

  return g;
}

export function makeMenuHeart() {
  const shape = new THREE.Shape();
  const x = 0, y = 0;
  shape.moveTo(x + 0.5, y + 0.5);
  shape.bezierCurveTo(x + 0.5, y + 0.5, x + 0.4, y, x, y);
  shape.bezierCurveTo(x - 0.6, y, x - 0.6, y + 0.7, x - 0.6, y + 0.7);
  shape.bezierCurveTo(x - 0.6, y + 1.1, x - 0.3, y + 1.54, x + 0.5, y + 1.9);
  shape.bezierCurveTo(x + 1.2, y + 1.54, x + 1.6, y + 1.1, x + 1.6, y + 0.7);
  shape.bezierCurveTo(x + 1.6, y + 0.7, x + 1.6, y, x + 1.0, y);
  shape.bezierCurveTo(x + 0.7, y, x + 0.5, y + 0.5, x + 0.5, y + 0.5);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.5, bevelEnabled: true, bevelThickness: 0.12,
    bevelSize: 0.12, bevelSegments: 2, steps: 1, curveSegments: 6,
  });
  geo.center();

  const mat = new THREE.MeshLambertMaterial({ color: 0xFF9EC2, emissive: 0x551133 });
  const heart = new THREE.Mesh(geo, mat);
  heart.scale.setScalar(1.35);

  const group = new THREE.Group();
  group.add(heart);
  const goreMat = new THREE.MeshBasicMaterial({ color: 0x8B0000 });
  for (let i = 0; i < 7; i++) {
    const blob = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), goreMat);
    const a = Math.random() * Math.PI * 2;
    const r = 0.6 + Math.random() * 0.55;
    blob.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.85, 0.35);
    group.add(blob);
  }
  return group;
}