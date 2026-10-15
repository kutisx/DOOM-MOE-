import * as THREE from 'three';
import {
  floorTexture, ceilingTexture, exitTexture, wallTexture, makeMenuHeart,
} from './assets.js';
import { TILE, WALL_H, T } from './level.js';

export class Particles {
  constructor(scene, max = 1400) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial();
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    const c = new THREE.Color(0x8B0000);
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, m);
      this.mesh.setColorAt(i, c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
  }

  spawn(x, y, z, vx, vy, vz, opts = {}) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;

    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;

    const life = opts.life !== undefined ? opts.life : 0.6 + Math.random() * 0.5;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = opts.size !== undefined ? opts.size : 0.10 + Math.random() * 0.12;
    this.grav[i] = opts.gravity !== undefined ? opts.gravity : 22;
    this.drag[i] = opts.drag !== undefined ? opts.drag : 1.2;

    this.mesh.setColorAt(i, this._c.setHex(opts.color !== undefined ? opts.color : 0x8B0000));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  burst(x, y, z, count, opts = {}) {
    const speed = opts.speed !== undefined ? opts.speed : 6;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.35 + Math.random() * 0.9);
      this.spawn(
        x + (Math.random() - 0.5) * 0.3,
        y + (Math.random() - 0.5) * 0.3,
        z + (Math.random() - 0.5) * 0.3,
        Math.cos(a) * Math.cos(p) * s,
        Math.sin(p) * s + (opts.up || 0),
        Math.sin(a) * Math.cos(p) * s,
        opts
      );
    }
  }

  update(dt) {
    let anyDirty = false;
    const m = this._m, v = this._v, s = this._s, q = this._q;

    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      anyDirty = true;

      this.life[i] -= dt;
      const i3 = i * 3;

      if (this.life[i] <= 0) {
        m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, m);
        continue;
      }

      const drag = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= drag;
      this.vel[i3 + 1] = this.vel[i3 + 1] * drag - this.grav[i] * dt;
      this.vel[i3 + 2] *= drag;

      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;

      if (this.pos[i3 + 1] < 0.05) {
        this.pos[i3 + 1] = 0.05;
        this.vel[i3 + 1] *= -0.28;
        this.vel[i3] *= 0.6;
        this.vel[i3 + 2] *= 0.6;
      }

      const fade = Math.min(1, this.life[i] / (this.maxLife[i] * 0.4));
      const sc = this.size[i] * fade;

      v.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]);
      s.set(sc, sc, sc);
      m.compose(v, q, s);
      this.mesh.setMatrixAt(i, m);
    }

    if (anyDirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xFFB8D4);
    this.scene.fog = new THREE.Fog(0xFFB8D4, 16, 52);

    this.camera = new THREE.PerspectiveCamera(78, 1, 0.05, 300);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.scene.add(new THREE.AmbientLight(0xFFFFFF, 1.0));
    this.scene.add(new THREE.HemisphereLight(0xFFE3F0, 0xFF9EC2, 0.75));
    const dir = new THREE.DirectionalLight(0xFFFFFF, 0.55);
    dir.position.set(0.8, 2, 0.5);
    this.scene.add(dir);

    this.menuScene = new THREE.Scene();
    this.menuScene.background = null;
    this.menuCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    this.menuCamera.position.set(0, 0.15, 4.4);
    this.menuCamera.lookAt(0, 0, 0);
    this.menuScene.add(new THREE.AmbientLight(0xFFFFFF, 1.1));
    const md = new THREE.DirectionalLight(0xFFFFFF, 0.8);
    md.position.set(1, 2, 3);
    this.menuScene.add(md);
    this.menuHeart = null;

    this.levelGroup = null;

    this.glitch = 0;
    this.crtEnabled = 1;

    this.rt = new THREE.WebGLRenderTarget(320, 240, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.postMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse:   { value: this.rt.texture },
        uTime:      { value: 0 },
        uGlitch:    { value: 0 },
        uCRT:       { value: 1 },
        uBufferRes: { value: new THREE.Vector2(320, 240) },
        uScreenRes: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uGlitch;
        uniform float uCRT;
        uniform vec2  uBufferRes;
        uniform vec2  uScreenRes;
        varying vec2 vUv;

        float hash(vec2 p){
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main(){
          vec2 uv = vUv;

          if (uGlitch > 0.001){
            float band = floor(uv.y * 36.0);
            float n = hash(vec2(band, floor(uTime * 26.0)));
            if (n > 0.80){
              uv.x += (n - 0.9) * uGlitch * 0.32;
            }
          }

          vec2 dir = uv - 0.5;
          float ca = 0.0018 + uGlitch * 0.012;
          float r = texture2D(tDiffuse, uv - dir * ca).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, uv + dir * ca).b;
          vec3 col = vec3(r, g, b);

          float levels = 24.0;
          col = floor(col * levels + 0.5) / levels;

          float sl = sin(uv.y * uBufferRes.y * 6.2831853) * 0.5 + 0.5;
          col *= mix(1.0, 0.86 + 0.14 * sl, uCRT);

          float vig = smoothstep(1.08, 0.30, length(dir) * 1.5);
          col *= mix(1.0, vig, uCRT);

          col = mix(col, vec3(0.52, 0.0, 0.0), uGlitch * 0.55);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    quad.frustumCulled = false;
    this.postScene.add(quad);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.menuCamera.aspect = w / h;
    this.menuCamera.updateProjectionMatrix();

    const scale = 3;
    const rw = Math.max(200, Math.floor(w / scale));
    const rh = Math.max(150, Math.floor(h / scale));
    this.rt.setSize(rw, rh);

    this.postMaterial.uniforms.uBufferRes.value.set(rw, rh);
    this.postMaterial.uniforms.uScreenRes.value.set(w, h);
  }

  setGlitch(v) { this.glitch = Math.max(this.glitch, v); }

  setCRT(on) {
    this.crtEnabled = on ? 1 : 0;
    this.postMaterial.uniforms.uCRT.value = this.crtEnabled;
  }

  buildLevel(level) {
    if (this.levelGroup) {
      this.scene.remove(this.levelGroup);
      disposeTree(this.levelGroup);
      this.levelGroup = null;
    }

    const size = level.size;
    const group = new THREE.Group();

    const floors = [];
    const exits = [];
    const walls = [];
    const wallVariant = [];

    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const t = level.grid[z * size + x];

        if (t === T.FLOOR || t === T.DOOR) floors.push([x, z]);
        else if (t === T.EXIT) exits.push([x, z]);

        if (t === T.SOLID || t === T.SECRET || t === T.LOCKED) {
          let near = false;
          for (let dz = -1; dz <= 1 && !near; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dz) continue;
              const nx = x + dx, nz = z + dz;
              if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
              const nt = level.grid[nz * size + nx];
              if (nt === T.FLOOR || nt === T.DOOR || nt === T.EXIT) { near = true; break; }
            }
          }
          if (near) {
            walls.push([x, z]);
            let v;
            if (t === T.SECRET) v = 2;
            else if (t === T.LOCKED) v = 3;
            else v = (x * 7 + z * 13) % 3;
            wallVariant.push(v);
          }
        }
      }
    }

    const floorGeo = new THREE.PlaneGeometry(TILE, TILE);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshLambertMaterial({ map: floorTexture() });
    const floorMesh = new THREE.InstancedMesh(floorGeo, floorMat, floors.length);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    floors.forEach(([x, z], i) => {
      m.makeTranslation(x * TILE + TILE / 2, 0, z * TILE + TILE / 2);
      floorMesh.setMatrixAt(i, m);
      const v = 0.94 + ((x * 31 + z * 17) % 7) * 0.012;
      floorMesh.setColorAt(i, col.setRGB(v, v, v));
    });
    floorMesh.instanceMatrix.needsUpdate = true;
    if (floorMesh.instanceColor) floorMesh.instanceColor.needsUpdate = true;
    group.add(floorMesh);

    const ceilGeo = new THREE.PlaneGeometry(TILE, TILE);
    ceilGeo.rotateX(Math.PI / 2);
    const ceilMat = new THREE.MeshLambertMaterial({ map: ceilingTexture() });
    const ceilMesh = new THREE.InstancedMesh(ceilGeo, ceilMat, floors.length + exits.length);
    let ci = 0;
    const addCeil = (x, z) => {
      m.makeTranslation(x * TILE + TILE / 2, WALL_H, z * TILE + TILE / 2);
      ceilMesh.setMatrixAt(ci, m);
      ceilMesh.setColorAt(ci, col.setRGB(1, 1, 1));
      ci++;
    };
    floors.forEach(([x, z]) => addCeil(x, z));
    exits.forEach(([x, z]) => addCeil(x, z));
    ceilMesh.count = ci;
    ceilMesh.instanceMatrix.needsUpdate = true;
    if (ceilMesh.instanceColor) ceilMesh.instanceColor.needsUpdate = true;
    group.add(ceilMesh);

    if (exits.length) {
      const exitMat = new THREE.MeshLambertMaterial({ map: exitTexture() });
      const exitMesh = new THREE.InstancedMesh(floorGeo, exitMat, exits.length);
      exits.forEach(([x, z], i) => {
        m.makeTranslation(x * TILE + TILE / 2, 0.01, z * TILE + TILE / 2);
        exitMesh.setMatrixAt(i, m);
        exitMesh.setColorAt(i, col.setRGB(1, 1, 1));
      });
      exitMesh.instanceMatrix.needsUpdate = true;
      if (exitMesh.instanceColor) exitMesh.instanceColor.needsUpdate = true;
      group.add(exitMesh);
    }

    const wallGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE);
    for (let v = 0; v < 4; v++) {
      const indices = [];
      for (let i = 0; i < walls.length; i++) if (wallVariant[i] === v) indices.push(i);
      if (!indices.length) continue;

      const mat = new THREE.MeshLambertMaterial({ map: wallTexture(v) });
      const mesh = new THREE.InstancedMesh(wallGeo, mat, indices.length);
      indices.forEach((wi, i) => {
        const [x, z] = walls[wi];
        m.makeTranslation(x * TILE + TILE / 2, WALL_H / 2, z * TILE + TILE / 2);
        mesh.setMatrixAt(i, m);
        const t = 0.92 + ((x * 13 + z * 29) % 9) * 0.012;
        mesh.setColorAt(i, col.setRGB(t, t, t));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
    }

    this.levelGroup = group;
    this.scene.add(group);
  }

  initMenu() {
    if (!this.menuHeart) {
      this.menuHeart = makeMenuHeart();
      this.menuScene.add(this.menuHeart);
    }
  }

  renderMenu(dt) {
    if (this.menuHeart) {
      this.menuHeart.rotation.y += dt * 0.55;
      this.menuHeart.rotation.x = Math.sin(performance.now() * 0.0004) * 0.18;
    }
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.menuScene, this.menuCamera);
    this.renderer.setRenderTarget(null);
    this.postMaterial.uniforms.uTime.value += dt;
    this.postMaterial.uniforms.uGlitch.value = 0;
    this.renderer.render(this.postScene, this.postCamera);
  }

  render(dt) {
    this.glitch = Math.max(0, this.glitch - dt * 2.2);
    this.postMaterial.uniforms.uTime.value += dt;
    this.postMaterial.uniforms.uGlitch.value = this.glitch;

    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}

function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(mm => mm.dispose());
    }
  });
}