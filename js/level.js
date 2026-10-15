export const TILE = 3;
export const WALL_H = 3.6;

export const T = {
  SOLID: 0,
  FLOOR: 1,
  DOOR: 2,
  SECRET: 3,
  EXIT: 4,
  LOCKED: 5,
};

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function reachable(grid, size, sx, sz, ex, ez) {
  const seen = new Uint8Array(size * size);
  const q = new Int32Array(size * size);
  let head = 0, tail = 0;
  const si = sz * size + sx;
  const t0 = grid[si];
  if (t0 !== T.FLOOR && t0 !== T.EXIT && t0 !== T.DOOR) return false;
  seen[si] = 1;
  q[tail++] = si;
  while (head < tail) {
    const cur = q[head++];
    const cx = cur % size;
    const cz = (cur / size) | 0;
    if (cx === ex && cz === ez) return true;
    for (let k = 0; k < 4; k++) {
      const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const nz = cz + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const ni = nz * size + nx;
      if (seen[ni]) continue;
      const t = grid[ni];
      if (t === T.FLOOR || t === T.EXIT || t === T.DOOR) {
        seen[ni] = 1;
        q[tail++] = ni;
      }
    }
  }
  return false;
}

export function generateLevel(size = 50) {
  const grid = new Uint8Array(size * size);
  const rooms = [];

  const get = (x, z) =>
    (x >= 0 && z >= 0 && x < size && z < size) ? grid[z * size + x] : T.SOLID;
  const put = (x, z, t) => {
    if (x >= 0 && z >= 0 && x < size && z < size) grid[z * size + x] = t;
  };

  for (let attempt = 0; attempt < 500 && rooms.length < 15; attempt++) {
    const w = 4 + Math.floor(Math.random() * 8);
    const h = 4 + Math.floor(Math.random() * 8);
    const x = 2 + Math.floor(Math.random() * (size - w - 4));
    const z = 2 + Math.floor(Math.random() * (size - h - 4));
    const r = { x, z, w, h, cx: (x + (w >> 1)) | 0, cz: (z + (h >> 1)) | 0 };

    let ok = true;
    for (const o of rooms) {
      if (r.x - 2 < o.x + o.w && o.x - 2 < r.x + r.w &&
          r.z - 2 < o.z + o.h && o.z - 2 < r.z + r.h) { ok = false; break; }
    }
    if (!ok) continue;

    rooms.push(r);
    for (let zz = r.z; zz < r.z + r.h; zz++)
      for (let xx = r.x; xx < r.x + r.w; xx++) put(xx, zz, T.FLOOR);
  }

  if (rooms.length < 2) return generateLevel(size);

  const inTree = new Set([0]);
  const edges = [];
  while (inTree.size < rooms.length) {
    let best = null, bestD = Infinity;
    for (const i of inTree) {
      for (let j = 0; j < rooms.length; j++) {
        if (inTree.has(j)) continue;
        const d = Math.abs(rooms[i].cx - rooms[j].cx) +
                  Math.abs(rooms[i].cz - rooms[j].cz);
        if (d < bestD) { bestD = d; best = [i, j]; }
      }
    }
    if (!best) break;
    inTree.add(best[1]);
    edges.push(best);
  }

  const extra = Math.max(2, Math.floor(rooms.length * 0.28));
  for (let k = 0; k < extra; k++) {
    const a = Math.floor(Math.random() * rooms.length);
    const b = Math.floor(Math.random() * rooms.length);
    if (a !== b) edges.push([a, b]);
  }

  for (const [a, b] of edges) {
    const A = rooms[a], B = rooms[b];
    let x = A.cx, z = A.cz;
    const horizFirst = Math.random() < 0.5;
    const stepX = () => { while (x !== B.cx) { put(x, z, T.FLOOR); x += Math.sign(B.cx - x); } };
    const stepZ = () => { while (z !== B.cz) { put(x, z, T.FLOOR); z += Math.sign(B.cz - z); } };
    if (horizFirst) { stepX(); stepZ(); } else { stepZ(); stepX(); }
    put(B.cx, B.cz, T.FLOOR);
  }

  const inRoom = (x, z) =>
    rooms.some(r => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.h);

  const corridorTiles = [];
  for (let z = 1; z < size - 1; z++) {
    for (let x = 1; x < size - 1; x++) {
      if (get(x, z) !== T.FLOOR || inRoom(x, z)) continue;
      const n = get(x, z - 1) === T.FLOOR;
      const s = get(x, z + 1) === T.FLOOR;
      const e = get(x + 1, z) === T.FLOOR;
      const w = get(x - 1, z) === T.FLOOR;
      if ((n && s && !e && !w) || (e && w && !n && !s)) corridorTiles.push([x, z]);
    }
  }
  shuffle(corridorTiles);
  const doors = [];
  for (const [x, z] of corridorTiles) {
    if (doors.length >= 9) break;
    if (doors.some(d => Math.abs(d[0] - x) + Math.abs(d[1] - z) < 8)) continue;
    put(x, z, T.DOOR);
    doors.push([x, z]);
  }

  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const candidates = [];
  for (let z = 2; z < size - 2; z++) {
    for (let x = 2; x < size - 2; x++) {
      if (get(x, z) !== T.SOLID) continue;
      for (const [dx, dz] of dirs) {
        if (get(x + dx, z + dz) !== T.FLOOR) continue;
        if (get(x + dx * 2, z + dz * 2) !== T.SOLID) continue;
        let clean = true;
        for (const [ex, ez] of dirs) {
          const nx = x + dx * 2 + ex, nz = z + dz * 2 + ez;
          if (nx === x + dx && nz === z + dz) continue;
          if (get(nx, nz) !== T.SOLID) { clean = false; break; }
        }
        if (!clean) continue;
        candidates.push([x, z, dx, dz]);
      }
    }
  }
  shuffle(candidates);
  const secrets = [];
  for (const [x, z, dx, dz] of candidates) {
    if (secrets.length >= 4) break;
    if (secrets.some(s => Math.abs(s.wx - x) + Math.abs(s.wz - z) < 14)) continue;
    put(x, z, T.SECRET);
    put(x + dx * 2, z + dz * 2, T.FLOOR);
    secrets.push({
      wx: x, wz: z,
      x: x + dx * 2, z: z + dz * 2,
      found: false,
      keyTaken: false,
      kind: secrets.length % 4,
    });
  }

  const startRoom = rooms[0];
  let exitRoom = rooms[0], bestD = -1;
  for (const r of rooms) {
    const d = Math.hypot(r.cx - startRoom.cx, r.cz - startRoom.cz);
    if (d > bestD) { bestD = d; exitRoom = r; }
  }
  const exit = { x: exitRoom.cx, z: exitRoom.cz };
  put(exit.x, exit.z, T.EXIT);

  /* ---- locked doors ---- */
  const lockCandidates = shuffle(doors.slice());
  const lockedDoors = [];
  for (const [x, z] of lockCandidates) {
    if (lockedDoors.length >= 3) break;
    if (grid[z * size + x] !== T.DOOR) continue;
    grid[z * size + x] = T.LOCKED;
    if (!reachable(grid, size, startRoom.cx, startRoom.cz, exit.x, exit.z)) {
      grid[z * size + x] = T.DOOR;
      continue;
    }
    lockedDoors.push([x, z]);
  }

  const startWorld = {
    x: (startRoom.cx + 0.5) * TILE,
    z: (startRoom.cz + 0.5) * TILE,
  };

  const openTiles = [];
  for (let z = 1; z < size - 1; z++) {
    for (let x = 1; x < size - 1; x++) {
      if (get(x, z) !== T.FLOOR) continue;
      if (x === exit.x && z === exit.z) continue;
      const d = Math.hypot((x + 0.5) * TILE - startWorld.x,
                           (z + 0.5) * TILE - startWorld.z);
      if (d < 14) continue;
      openTiles.push([x, z]);
    }
  }
  shuffle(openTiles);

  const enemyCount = Math.min(26, Math.max(9, Math.floor(rooms.length * 1.7)));
  const enemies = [];
  for (let i = 0; i < enemyCount && openTiles.length; i++) {
    const [x, z] = openTiles.pop();
    enemies.push({
      x: (x + 0.5) * TILE,
      z: (z + 0.5) * TILE,
      type: Math.random() < 0.62 ? 'melee' : 'ranged',
    });
  }

  const pickups = [];
  for (let i = 0; i < 12 && openTiles.length; i++) {
    const [x, z] = openTiles.pop();
    pickups.push({
      x: (x + 0.5) * TILE,
      z: (z + 0.5) * TILE,
      type: Math.random() < 0.62 ? 'health' : 'grenade',
    });
  }

  return {
    size, grid, rooms, doors, secrets, lockedDoors,
    start: startWorld,
    exit: { x: (exit.x + 0.5) * TILE, z: (exit.z + 0.5) * TILE, tx: exit.x, tz: exit.z },
    enemies, pickups,
  };
}

export function tileAt(level, tx, tz) {
  if (tx < 0 || tz < 0 || tx >= level.size || tz >= level.size) return T.SOLID;
  return level.grid[tz * level.size + tx];
}

export function isBlockedTile(t) {
  return t === T.SOLID || t === T.SECRET || t === T.DOOR || t === T.LOCKED;
}

export function isBlockedWorld(level, wx, wz) {
  return isBlockedTile(tileAt(level, Math.floor(wx / TILE), Math.floor(wz / TILE)));
}

export function tileToWorld(tx, tz) {
  return { x: (tx + 0.5) * TILE, z: (tz + 0.5) * TILE };
}

export function computeFlow(level, tx, tz) {
  const size = level.size;
  const total = size * size;
  const dist = new Int16Array(total).fill(-1);
  if (tx < 0 || tz < 0 || tx >= size || tz >= size) return dist;

  const q = new Int32Array(total);
  let head = 0, tail = 0;
  const start = tz * size + tx;
  dist[start] = 0;
  q[tail++] = start;

  const walkable = t => t === T.FLOOR || t === T.EXIT || t === T.DOOR;

  while (head < tail) {
    const cur = q[head++];
    const cx = cur % size;
    const cz = (cur / size) | 0;
    const d = dist[cur];

    for (let k = 0; k < 4; k++) {
      const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const nz = cz + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const ni = nz * size + nx;
      if (dist[ni] !== -1) continue;
      if (!walkable(level.grid[ni])) continue;
      dist[ni] = d + 1;
      q[tail++] = ni;
    }
  }
  return dist;
}

export function hasLOS(level, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return true;
  const steps = Math.ceil(len / 0.45);
  const sx = dx / steps, sz = dz / steps;
  let x = x1, z = z1;
  for (let i = 0; i < steps; i++) {
    x += sx; z += sz;
    if (isBlockedWorld(level, x, z)) return false;
  }
  return true;
}

export function raycastGrid(level, ox, oz, dx, dz, maxDist) {
  let t = 0;
  const step = 0.18;
  while (t < maxDist) {
    t += step;
    const x = ox + dx * t;
    const z = oz + dz * t;
    if (isBlockedWorld(level, x, z)) return { dist: t, x, z };
  }
  return { dist: maxDist, x: ox + dx * maxDist, z: oz + dz * maxDist, hit: false };
}