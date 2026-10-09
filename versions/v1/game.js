/* GROK VOXELS — first-person voxel shooter, no build step */
(() => {
"use strict";

const W = 52, H = 16, D = 180;
const MAG = 12, RESERVE_START = 36;
const MAX_LIVES = 3;

const PAL = [
  [0,0,0],
  [0.30,0.80,0.34], // 1 grass
  [0.70,0.44,0.22], // 2 dirt
  [0.58,0.60,0.66], // 3 stone
  [0.68,0.42,0.22], // 4 wood
  [0.10,0.84,0.94], // 5 cyan
  [0.92,0.22,0.78], // 6 magenta
  [1.00,0.50,0.14], // 7 orange
  [0.55,0.34,0.98], // 8 purple
  [1.00,0.84,0.16], // 9 gold
  [0.92,0.16,0.24], // 10 red
  [0.16,0.18,0.26], // 11 dark
  [0.48,0.96,0.30], // 12 lime
  [0.18,0.48,0.90], // 13 blue
  [1.00,0.96,0.55], // 14 lamp
  [0.90,0.78,0.42], // 15 sand
  [0.96,0.96,1.00], // 16 white
  [0.22,0.55,0.28], // 17 dark grass
  [0.40,0.28,0.22], // 18 dark wood
];
const EMIT = { 9: 0.55, 14: 0.85 };

const SKIES = [
  { sky:[0.38,0.72,0.98], fog:[0.62,0.82,1.00], light:[0.45,0.85,0.35], name:"NOON" },
  { sky:[0.98,0.48,0.32], fog:[1.00,0.62,0.42], light:[0.55,0.55,0.20], name:"BLAZE" },
  { sky:[0.22,0.32,0.62], fog:[0.32,0.38,0.58], light:[0.35,0.55,0.80], name:"DUSK" },
  { sky:[0.42,0.88,0.82], fog:[0.55,0.90,0.82], light:[0.40,0.90,0.55], name:"MINT" },
  { sky:[0.70,0.42,0.92], fog:[0.62,0.48,0.90], light:[0.80,0.45,0.90], name:"NEON" },
];

function RNG(seed) {
  this.s = seed >>> 0;
}
RNG.prototype.next = function () {
  this.s += 0x6D2B79F5;
  let t = this.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
RNG.prototype.int = function (a, b) { return a + (this.next() * (b - a + 1) | 0); };
RNG.prototype.pick = function (a) { return a[this.int(0, a.length - 1)]; };
RNG.prototype.chance = function (p) { return this.next() < p; };
RNG.prototype.f = function (a, b) { return a + this.next() * (b - a); };

function idx(x, y, z) { return x + W * (y + H * z); }

const world = {
  v: new Uint8Array(W * H * D),
  clear() { this.v.fill(0); },
  in(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D; },
  get(x, y, z) {
    x = x | 0; y = y | 0; z = z | 0;
    if (y < 0) return 3;
    if (y >= H) return 0;
    if (x < 0 || z < 0 || x >= W || z >= D) return 3;
    return this.v[idx(x, y, z)];
  },
  set(x, y, z, t) {
    x = x | 0; y = y | 0; z = z | 0;
    if (!this.in(x, y, z)) return;
    this.v[idx(x, y, z)] = t;
  },
  solid(x, y, z) { return this.get(x, y, z) > 0; },
  fill(x0, y0, z0, x1, y1, z1, t) {
    for (let z = z0; z < z1; z++)
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) this.set(x, y, z, t);
  },
};

function m4ident() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
function m4mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    const b0 = b[c*4], b1 = b[c*4+1], b2 = b[c*4+2], b3 = b[c*4+3];
    o[c*4]   = a[0]*b0 + a[4]*b1 + a[8]*b2  + a[12]*b3;
    o[c*4+1] = a[1]*b0 + a[5]*b1 + a[9]*b2  + a[13]*b3;
    o[c*4+2] = a[2]*b0 + a[6]*b1 + a[10]*b2 + a[14]*b3;
    o[c*4+3] = a[3]*b0 + a[7]*b1 + a[11]*b2 + a[15]*b3;
  }
  return o;
}
function m4persp(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1;
  m[14] = 2 * far * near * nf;
  return m;
}
function m4trans(x, y, z) {
  const m = m4ident(); m[12] = x; m[13] = y; m[14] = z; return m;
}
function m4scale(x, y, z) {
  const m = m4ident(); m[0] = x; m[5] = y; m[10] = z; return m;
}
function m4rotX(a) {
  const c = Math.cos(a), s = Math.sin(a), m = m4ident();
  m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m;
}
function m4rotY(a) {
  const c = Math.cos(a), s = Math.sin(a), m = m4ident();
  m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m;
}
function m4rotZ(a) {
  const c = Math.cos(a), s = Math.sin(a), m = m4ident();
  m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m;
}
function lookAt(ex, ey, ez, tx, ty, tz, ux, uy, uz) {
  let zx = ex - tx, zy = ey - ty, zz = ez - tz;
  let zl = Math.hypot(zx, zy, zz) || 1;
  zx /= zl; zy /= zl; zz /= zl;
  let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
  let xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const m = new Float32Array(16);
  m[0] = xx; m[1] = yx; m[2] = zx; m[3] = 0;
  m[4] = xy; m[5] = yy; m[6] = zy; m[7] = 0;
  m[8] = xz; m[9] = yz; m[10] = zz; m[11] = 0;
  m[12] = -(xx * ex + xy * ey + xz * ez);
  m[13] = -(yx * ex + yy * ey + yz * ez);
  m[14] = -(zx * ex + zy * ey + zz * ez);
  m[15] = 1;
  return m;
}

const VS = `
attribute vec3 a_pos;
attribute vec3 a_nrm;
attribute vec3 a_col;
attribute vec2 a_uv;
uniform mat4 u_mvp;
uniform mat4 u_model;
varying vec3 v_col, v_nrm, v_wpos;
varying vec2 v_uv;
void main() {
  vec4 w = u_model * vec4(a_pos, 1.0);
  v_wpos = w.xyz;
  v_nrm = mat3(u_model) * a_nrm;
  v_col = a_col;
  v_uv = a_uv;
  gl_Position = u_mvp * vec4(a_pos, 1.0);
}`;

const FS = `
precision mediump float;
varying vec3 v_col, v_nrm, v_wpos;
varying vec2 v_uv;
uniform vec3 u_light, u_cam, u_fog, u_tint;
uniform float u_fogN, u_fogF, u_emit, u_time;
void main() {
  vec3 n = normalize(v_nrm);
  float ndl = max(dot(n, normalize(u_light)), 0.0);
  float wrap = ndl * 0.58 + 0.42;
  float fx = min(v_uv.x, 1.0 - v_uv.x);
  float fy = min(v_uv.y, 1.0 - v_uv.y);
  float edge = smoothstep(0.0, 0.07, min(fx, fy));
  vec3 col = v_col * u_tint * mix(0.52, 1.0, edge) * wrap;
  col += v_col * u_emit;
  float pulse = 0.65 + 0.35 * sin(u_time * 4.0 + v_wpos.x * 0.4);
  col += v_col * u_emit * pulse * 0.35;
  float dist = length(v_wpos - u_cam);
  float fog = clamp((dist - u_fogN) / (u_fogF - u_fogN), 0.0, 1.0);
  gl_FragColor = vec4(mix(col, u_fog, fog), 1.0);
}`;

const canvas = document.getElementById("c");
const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
if (!gl) { document.body.textContent = "WebGL required"; return; }

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
  }
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);

const loc = {
  pos: gl.getAttribLocation(prog, "a_pos"),
  nrm: gl.getAttribLocation(prog, "a_nrm"),
  col: gl.getAttribLocation(prog, "a_col"),
  uv: gl.getAttribLocation(prog, "a_uv"),
  mvp: gl.getUniformLocation(prog, "u_mvp"),
  model: gl.getUniformLocation(prog, "u_model"),
  light: gl.getUniformLocation(prog, "u_light"),
  cam: gl.getUniformLocation(prog, "u_cam"),
  fog: gl.getUniformLocation(prog, "u_fog"),
  tint: gl.getUniformLocation(prog, "u_tint"),
  fogN: gl.getUniformLocation(prog, "u_fogN"),
  fogF: gl.getUniformLocation(prog, "u_fogF"),
  emit: gl.getUniformLocation(prog, "u_emit"),
  time: gl.getUniformLocation(prog, "u_time"),
};

const FACE = [
  { n:[0,1,0], v:[[0,1,0],[0,1,1],[1,1,1],[1,1,0]], s:1.00 },
  { n:[0,-1,0], v:[[0,0,1],[0,0,0],[1,0,0],[1,0,1]], s:0.42 },
  { n:[0,0,1], v:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]], s:0.82 },
  { n:[0,0,-1], v:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]], s:0.70 },
  { n:[1,0,0], v:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]], s:0.90 },
  { n:[-1,0,0], v:[[0,0,1],[0,0,0],[0,1,0],[0,1,1]], s:0.62 },
];
const NDIR = [[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,0,0],[-1,0,0]];

function pushFace(arr, x, y, z, fi, col, shade) {
  const f = FACE[fi];
  const uv = [[0,0],[1,0],[1,1],[0,1]];
  const tri = [0,1,2, 0,2,3];
  for (let i = 0; i < 6; i++) {
    const vi = tri[i];
    const p = f.v[vi];
    arr.push(
      x + p[0], y + p[1], z + p[2],
      f.n[0], f.n[1], f.n[2],
      col[0] * shade, col[1] * shade, col[2] * shade,
      uv[vi][0], uv[vi][1]
    );
  }
}

function makeMesh(data) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  const stride = 11 * 4;
  return { buf, count: data.length / 11, stride };
}

function bindMesh(mesh) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
  const s = mesh.stride;
  gl.enableVertexAttribArray(loc.pos);
  gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, s, 0);
  gl.enableVertexAttribArray(loc.nrm);
  gl.vertexAttribPointer(loc.nrm, 3, gl.FLOAT, false, s, 12);
  gl.enableVertexAttribArray(loc.col);
  gl.vertexAttribPointer(loc.col, 3, gl.FLOAT, false, s, 24);
  gl.enableVertexAttribArray(loc.uv);
  gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, s, 36);
}

const unitData = [];
for (let fi = 0; fi < 6; fi++) pushFace(unitData, 0, 0, 0, fi, [1,1,1], FACE[fi].s);
const unitMesh = makeMesh(unitData);

let worldMesh = makeMesh([0,0,0, 0,1,0, 1,1,1, 0,0]);

function rebuildWorldMesh() {
  const arr = [];
  for (let z = 0; z < D; z++)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = world.v[idx(x, y, z)];
        if (!t) continue;
        const col = PAL[t] || [1,1,1];
        const emitBoost = EMIT[t] ? 1.15 : 1;
        for (let fi = 0; fi < 6; fi++) {
          const d = NDIR[fi];
          if (world.get(x + d[0], y + d[1], z + d[2]) > 0) continue;
          const sh = FACE[fi].s * emitBoost;
          pushFace(arr, x, y, z, fi, col, sh);
        }
      }
  worldMesh = makeMesh(arr);
}

const G = {
  mode: "title",
  seed: 1,
  sky: SKIES[0],
  lives: MAX_LIVES,
  score: 0,
  ammo: MAG,
  reserve: RESERVE_START,
  reload: 0,
  invuln: 0,
  time: 0,
  muzzle: 0,
  recoil: 0,
  hurtFlash: 0,
  hitmark: 0,
  shake: 0,
  locked: false,
  shotCd: 0,
};
const P = {
  x: 26, y: 3, z: 6, vx: 0, vy: 0, vz: 0,
  yaw: 0, pitch: 0, grounded: false, eye: 1.55,
};
let enemies = [];
let bolts = [];
let pickups = [];
let parts = [];
let extract = { x: 26, y: 2, z: 80, w: 4, d: 4 };
let spawn = { x: 26, y: 3, z: 6, yaw: 0 };
let rooms = [];
let keys = Object.create(null);
let shooting = false, wasShooting = false;
let lastT = 0;
let minimapDirty = true;

const touch = {
  on: false,
  moveX: 0,
  moveY: 0,
  jump: false,
  jumpQueued: false,
  joyPtr: null,
  lookPtr: null,
  lookLX: 0,
  lookLY: 0,
  joyOX: 0,
  joyOY: 0,
};
const JOY_R = 52;

function prefersTouch() {
  try {
    if (window.matchMedia("(pointer: coarse)").matches) return true;
    if (window.matchMedia("(hover: none)").matches) return true;
  } catch (err) {}
  return false;
}
function enableTouchUI() {
  if (touch.on) return;
  touch.on = true;
  document.body.classList.add("touch");
  const hint = document.getElementById("hint");
  if (hint) hint.textContent = "JOYSTICK MOVE  ·  SWIPE LOOK  ·  FIRE  ·  JUMP  ·  RELOAD";
}
function resetTouch() {
  touch.moveX = 0;
  touch.moveY = 0;
  touch.jump = false;
  touch.jumpQueued = false;
  touch.joyPtr = null;
  touch.lookPtr = null;
  const stick = document.getElementById("joy-stick");
  const base = document.getElementById("joy-base");
  if (stick) stick.style.transform = "";
  if (base) {
    base.classList.remove("active");
    base.style.left = "";
    base.style.top = "";
  }
}
function isTouchPlay() {
  return touch.on;
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function generate(seed) {
  G.seed = seed >>> 0;
  const rng = new RNG(G.seed);
  G.sky = SKIES[rng.int(0, SKIES.length - 1)];
  world.clear();
  enemies = [];
  bolts = [];
  pickups = [];
  parts = [];
  rooms = [];

  const wallSets = [[5,3],[6,3],[7,3],[8,3],[4,18],[13,3],[12,17]];
  let cx = 26;
  let cz = 3;
  let fy = 1;

  function doorX(room, width) {
    return clamp((room.x + (room.w >> 1)) - (width >> 1), room.x + 1, room.x + room.w - width - 1);
  }

  function addRoom(rw, rd, type) {
    rw |= 0; rd |= 0;
    const x = clamp((cx - (rw >> 1)) | 0, 2, W - rw - 2);
    const z = cz | 0;
    const r = { x, z, w: rw, d: rd, fy, type, walls: rng.pick(wallSets) };
    rooms.push(r);
    cz = z + rd;
    cx = x + (rw >> 1);
    return r;
  }

  function addCorr(len, wid, toX) {
    len |= 0; wid |= 0;
    const z0 = cz | 0;
    const fromX = cx;
    cz = z0 + len;
    cx = toX;
    return { z0, len, wid, fromX, toX, fy };
  }

  const start = addRoom(12, 10, "start");
  const nRooms = rng.int(5, 7);
  const pool = ["arena", "hall", "court", "ramp", "choke", "arena"];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  const corrs = [];
  for (let i = 0; i < nRooms; i++) {
    if (cz > D - 36) break;
    const len = rng.int(5, 9);
    const wid = rng.int(3, 4);
    const toX = clamp(cx + rng.int(-8, 8), 12, W - 12);
    corrs.push(addCorr(len, wid, toX));
    const t = i === nRooms - 1 ? "arena" : pool[i % pool.length];
    const rw = t === "hall" ? rng.int(7, 9) : t === "choke" ? rng.int(8, 11) : rng.int(11, 16);
    const rd = t === "hall" ? rng.int(14, 18) : rng.int(10, 15);
    const r = addRoom(rw, rd, t);
    if (t === "ramp") {
      let rise = rng.chance(0.7) ? 1 : -1;
      if (fy + rise > 5) rise = -1;
      if (fy + rise < 1) rise = 1;
      r.rise = rise;
      fy = fy + rise;
    }
  }
  corrs.push(addCorr(rng.int(6, 8), 4, clamp(cx + rng.int(-3, 3), 14, W - 14)));
  const end = addRoom(12, 12, "extract");

  function paintRoom(r) {
    const [wall, trim] = r.walls;
    const outdoor = r.type === "court";
    const ceilH = outdoor ? 8 : 6;
    const wallH = outdoor ? 3 : 6;
    const floorT = r.type === "extract" ? 9 : outdoor ? 1 : r.type === "start" ? 15 : rng.chance(0.35) ? 17 : 1;
    for (let z = r.z; z < r.z + r.d; z++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const check = ((x + z) & 1) ? floorT : (floorT === 1 ? 17 : floorT === 9 ? 7 : 2);
        world.set(x, r.fy, z, r.type === "extract" ? 9 : check);
        for (let y = 0; y < r.fy; y++) world.set(x, y, z, 2);
        if (!outdoor) world.set(x, r.fy + ceilH, z, trim);
        else if (rng.chance(0.04)) world.set(x, r.fy + 1, z, 12);
      }
    }
    for (let z = r.z; z < r.z + r.d; z++) {
      for (let y = r.fy + 1; y <= r.fy + wallH; y++) {
        world.set(r.x, y, z, wall);
        world.set(r.x + r.w - 1, y, z, wall);
        if (y === r.fy + wallH && !outdoor) {
          world.set(r.x, y, z, trim);
          world.set(r.x + r.w - 1, y, z, trim);
        }
      }
    }
    for (let x = r.x; x < r.x + r.w; x++) {
      for (let y = r.fy + 1; y <= r.fy + wallH; y++) {
        world.set(x, y, r.z, wall);
        world.set(x, y, r.z + r.d - 1, wall);
      }
    }
    const dw = 3, dh = 3;
    const punch = (zedge, inward) => {
      const dx = doorX(r, dw);
      for (let x = dx; x < dx + dw; x++)
        for (let y = r.fy + 1; y <= r.fy + dh; y++) {
          world.set(x, y, zedge, 0);
          if (inward) world.set(x, y, zedge + inward, 0);
        }
    };
    if (r.type !== "start") punch(r.z, 1);
    if (r.type !== "extract") punch(r.z + r.d - 1, -1);
    else punch(r.z, 1);

    if (r.type === "ramp" && r.rise) {
      const lane = doorX(r, 3);
      const rise = r.rise;
      const steps = Math.max(3, Math.abs(rise) + 3);
      const z0 = r.z + 2;
      const fyOut = r.fy + rise;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const yy = (r.fy + rise * t + 0.001) | 0;
        const zz = z0 + i;
        for (let x = lane; x < lane + 3; x++) {
          for (let y = 0; y <= yy; y++) world.set(x, y, zz, y === yy ? 4 : 2);
          for (let y = yy + 1; y < yy + 4; y++) world.set(x, y, zz, 0);
        }
      }
      for (let z = z0 + steps; z < r.z + r.d; z++) {
        for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
          world.set(x, fyOut, z, 4);
          for (let y = 0; y < fyOut; y++) world.set(x, y, z, 2);
          for (let y = fyOut + 1; y < fyOut + 4; y++) world.set(x, y, z, 0);
        }
      }
      const dw = 3, dx = doorX(r, dw);
      for (let x = dx; x < dx + dw; x++) {
        for (let y = fyOut + 1; y <= fyOut + 3; y++) {
          world.set(x, y, r.z + r.d - 1, 0);
          world.set(x, y, r.z + r.d - 2, 0);
        }
      }
    }

    if (r.type === "choke") {
      const midz = r.z + (r.d >> 1);
      for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
        if (Math.abs(x - (r.x + r.w / 2)) < 1.6) continue;
        world.fill(x, r.fy + 1, midz, x + 1, r.fy + 4, midz + 1, wall);
      }
    }

    if (r.type === "hall") {
      for (let z = r.z + 3; z < r.z + r.d - 3; z += 3) {
        world.fill(r.x + 2, r.fy + 1, z, r.x + 3, r.fy + 5, z + 1, 4);
        world.fill(r.x + r.w - 3, r.fy + 1, z, r.x + r.w - 2, r.fy + 5, z + 1, 4);
      }
    }

    const covers = r.type === "arena" ? rng.int(5, 9) : r.type === "court" ? rng.int(3, 6) : rng.int(2, 4);
    if (r.type !== "start" && r.type !== "extract" && r.type !== "ramp") {
      for (let i = 0; i < covers; i++) {
        const cw = rng.int(1, 2), cd = rng.int(1, 2), ch = rng.int(1, 2);
        const cxb = rng.int(r.x + 2, r.x + r.w - 3 - cw);
        const czb = rng.int(r.z + 3, r.z + r.d - 4 - cd);
        if (Math.abs((cxb + cw / 2) - (r.x + r.w / 2)) < 1.2) continue;
        world.fill(cxb, r.fy + 1, czb, cxb + cw, r.fy + 1 + ch, czb + cd, rng.pick([wall, 4, 7, 11]));
      }
    }

    if (outdoor) {
      for (let i = 0; i < rng.int(2, 4); i++) {
        const tx = rng.int(r.x + 2, r.x + r.w - 3);
        const tz = rng.int(r.z + 3, r.z + r.d - 4);
        world.fill(tx, r.fy + 1, tz, tx + 1, r.fy + 3, tz + 1, 18);
        world.fill(tx - 1, r.fy + 3, tz - 1, tx + 2, r.fy + 5, tz + 2, 12);
      }
    }

    if (r.type === "extract") {
      const px = r.x + (r.w >> 1) - 2, pz = r.z + r.d - 6;
      world.fill(px, r.fy, pz, px + 4, r.fy + 1, pz + 4, 9);
      world.set(px, r.fy + 1, pz, 14);
      world.set(px + 3, r.fy + 1, pz, 14);
      world.set(px, r.fy + 1, pz + 3, 14);
      world.set(px + 3, r.fy + 1, pz + 3, 14);
      extract = { x: px, y: r.fy + 1, z: pz, w: 4, d: 4 };
      for (let y = r.fy + 1; y <= r.fy + 5; y++) {
        world.set(r.x + 1, y, r.z + 1, 9);
        world.set(r.x + r.w - 2, y, r.z + 1, 9);
      }
    }

    if (r.type === "start") {
      spawn.x = r.x + r.w / 2;
      spawn.y = r.fy + 1.01;
      spawn.z = r.z + 3;
      spawn.yaw = Math.PI;
      world.set(r.x + 2, r.fy + 1, r.z + 2, 14);
      world.set(r.x + r.w - 3, r.fy + 1, r.z + 2, 14);
    }

    if (r.type !== "start" && r.type !== "extract") {
      const nEn = r.type === "arena" ? rng.int(3, 5) : r.type === "hall" ? rng.int(2, 3) : rng.int(1, 3);
      let placed = 0, guard = 0;
      while (placed < nEn && guard++ < 40) {
        const ex = rng.f(r.x + 2, r.x + r.w - 2);
        const ez = rng.f(r.z + 3, r.z + r.d - 3);
        const ey = r.fy + 1.01;
        if (world.solid(ex, ey, ez) || world.solid(ex, ey + 1, ez)) continue;
        const kind = rng.chance(0.45) ? "shoot" : "melee";
        enemies.push({
          x: ex, y: ey, z: ez, vx: 0, vy: 0, vz: 0,
          hp: kind === "shoot" ? 3 : 2,
          kind, cd: rng.f(0.4, 1.2),
          yaw: rng.f(0, Math.PI * 2),
          hit: 0, bob: rng.f(0, 10),
          speed: kind === "melee" ? rng.f(2.4, 3.2) : rng.f(1.4, 2.0),
        });
        placed++;
      }
      if (rng.chance(0.8)) {
        pickups.push({
          x: rng.f(r.x + 2, r.x + r.w - 2),
          y: r.fy + 1.4,
          z: rng.f(r.z + 2, r.z + r.d - 2),
          kind: rng.chance(0.55) ? "ammo" : "gem",
          alive: true, t: rng.f(0, 5),
        });
      }
    }
  }

  function paintCorr(c) {
    for (let i = 0; i < c.len; i++) {
      const t = (i + 0.5) / c.len;
      const mx = (c.fromX + (c.toX - c.fromX) * t) | 0;
      const z = c.z0 + i;
      const x0 = mx - (c.wid >> 1);
      for (let x = x0; x < x0 + c.wid; x++) {
        world.set(x, c.fy, z, ((x + z) & 1) ? 3 : 15);
        for (let y = 0; y < c.fy; y++) world.set(x, y, z, 2);
        world.set(x, c.fy + 4, z, 3);
        for (let y = c.fy + 1; y <= c.fy + 3; y++) world.set(x, y, z, 0);
      }
      for (let y = c.fy + 1; y <= c.fy + 4; y++) {
        world.set(x0 - 1, y, z, 5);
        world.set(x0 + c.wid, y, z, 5);
      }
    }
  }

  rooms.forEach(paintRoom);
  corrs.forEach(paintCorr);

  // lamps along corridors
  corrs.forEach((c, i) => {
    if (i % 1 === 0) {
      const mx = (c.fromX + c.toX) >> 1;
      world.set(mx, c.fy + 3, c.z0 + (c.len >> 1), 14);
    }
  });

  rebuildWorldMesh();
  minimapDirty = true;
}


function resetPlayer() {
  P.x = spawn.x; P.y = spawn.y; P.z = spawn.z;
  P.vx = P.vy = P.vz = 0;
  P.yaw = spawn.yaw; P.pitch = 0;
  P.grounded = false;
}

function aabbSolid(px, py, pz, hw, h) {
  const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw - 1e-4);
  const y0 = Math.floor(py), y1 = Math.floor(py + h - 1e-4);
  const z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw - 1e-4);
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++)
        if (world.solid(x, y, z)) return true;
  return false;
}

function moveCollide(e, dt, hw, h, grav) {
  e.vy -= grav * dt;
  e.x += e.vx * dt;
  if (aabbSolid(e.x, e.y, e.z, hw, h)) {
    e.x -= e.vx * dt;
    e.vx = 0;
  }
  e.z += e.vz * dt;
  if (aabbSolid(e.x, e.y, e.z, hw, h)) {
    e.z -= e.vz * dt;
    e.vz = 0;
  }
  e.y += e.vy * dt;
  e.grounded = false;
  if (aabbSolid(e.x, e.y, e.z, hw, h)) {
    e.y -= e.vy * dt;
    if (e.vy < 0) e.grounded = true;
    e.vy = 0;
  }
}

function forward() {
  const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
  return {
    x: Math.sin(P.yaw) * cp,
    y: -sp,
    z: -Math.cos(P.yaw) * cp,
  };
}
function eyePos() {
  return { x: P.x, y: P.y + P.eye, z: P.z };
}

function rayAABB(o, d, minx, miny, minz, maxx, maxy, maxz, tmax) {
  let t0 = 0, t1 = tmax;
  const ox = [o.x, o.y, o.z], dx = [d.x, d.y, d.z];
  const mn = [minx, miny, minz], mx = [maxx, maxy, maxz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dx[i]) < 1e-8) {
      if (ox[i] < mn[i] || ox[i] > mx[i]) return null;
      continue;
    }
    const inv = 1 / dx[i];
    let n = (mn[i] - ox[i]) * inv, f = (mx[i] - ox[i]) * inv;
    if (n > f) { const t = n; n = f; f = t; }
    t0 = Math.max(t0, n);
    t1 = Math.min(t1, f);
    if (t0 > t1) return null;
  }
  return t0;
}

function traceVoxels(o, d, maxd) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = d.x >= 0 ? 1 : -1, sy = d.y >= 0 ? 1 : -1, sz = d.z >= 0 ? 1 : -1;
  const idxX = 1 / (Math.abs(d.x) || 1e-8);
  const idy = 1 / (Math.abs(d.y) || 1e-8);
  const idz = 1 / (Math.abs(d.z) || 1e-8);
  let tmaxX = ((sx > 0 ? x + 1 - o.x : o.x - x) * idxX);
  let tmaxY = ((sy > 0 ? y + 1 - o.y : o.y - y) * idy);
  let tmaxZ = ((sz > 0 ? z + 1 - o.z : o.z - z) * idz);
  let t = 0;
  for (let i = 0; i < 180 && t <= maxd; i++) {
    if (world.solid(x, y, z) && t > 0.02) return { t, x, y, z };
    if (tmaxX < tmaxY && tmaxX < tmaxZ) {
      t = tmaxX; tmaxX += idxX; x += sx;
    } else if (tmaxY < tmaxZ) {
      t = tmaxY; tmaxY += idy; y += sy;
    } else {
      t = tmaxZ; tmaxZ += idz; z += sz;
    }
  }
  return null;
}

let actx = null;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume();
  return actx;
}
function blip(freq, dur, type, vol, slide) {
  const a = audio();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type || "square";
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), a.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.08, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination);
  o.start(); o.stop(a.currentTime + dur + 0.02);
}
function sfx(name) {
  try {
    if (name === "shoot") { blip(220, 0.08, "square", 0.07, 80); blip(90, 0.07, "sawtooth", 0.04, 40); }
    else if (name === "hit") { blip(520, 0.07, "square", 0.07, 180); }
    else if (name === "kill") { blip(180, 0.18, "sawtooth", 0.08, 60); blip(420, 0.12, "square", 0.05, 900); }
    else if (name === "hurt") { blip(140, 0.22, "sawtooth", 0.1, 50); }
    else if (name === "pickup") { blip(660, 0.1, "square", 0.07, 990); }
    else if (name === "reload") { blip(180, 0.08, "triangle", 0.05); setTimeout(() => blip(240, 0.08, "triangle", 0.05), 120); }
    else if (name === "win") { blip(330, 0.15, "square", 0.08, 440); setTimeout(() => blip(440, 0.2, "square", 0.08, 660), 140); }
    else if (name === "die") { blip(200, 0.4, "sawtooth", 0.1, 40); }
    else if (name === "jump") { blip(300, 0.08, "triangle", 0.04, 180); }
  } catch (err) { /* audio optional */ }
}

function burst(x, y, z, col, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const b = Math.random() * Math.PI;
    parts.push({
      x, y, z,
      vx: Math.cos(a) * Math.sin(b) * spd,
      vy: Math.cos(b) * spd + 1.5,
      vz: Math.sin(a) * Math.sin(b) * spd,
      life: 0.35 + Math.random() * 0.35,
      col, s: 0.08 + Math.random() * 0.1,
    });
  }
}

function hurtPlayer() {
  if (G.mode !== "play" || G.invuln > 0) return;
  G.lives--;
  G.invuln = 1.15;
  G.hurtFlash = 0.45;
  G.shake = 0.35;
  sfx("hurt");
  updateHUD();
  if (G.lives <= 0) die();
}

function die() {
  G.mode = "dead";
  sfx("die");
  document.exitPointerLock && document.exitPointerLock();
  showOverlay("dead");
  document.getElementById("dead-stats").textContent =
    "SCORE " + G.score + "   ·   COURSE #" + (G.seed >>> 0).toString(16).toUpperCase();
}

function win() {
  if (G.mode !== "play") return;
  G.mode = "win";
  sfx("win");
  G.score += 250 + G.lives * 100;
  document.exitPointerLock && document.exitPointerLock();
  showOverlay("win");
  document.getElementById("win-stats").textContent =
    "SCORE " + G.score + "   ·   LIVES LEFT " + G.lives + "   ·   #" + (G.seed >>> 0).toString(16).toUpperCase();
  updateHUD();
}

function startRun() {
  const seed = (Math.random() * 0xffffffff) ^ (Date.now() * 2654435761);
  generate(seed);
  G.mode = "play";
  G.lives = MAX_LIVES;
  G.score = 0;
  G.ammo = MAG;
  G.reserve = RESERVE_START;
  G.reload = 0;
  G.invuln = 1.0;
  G.muzzle = G.recoil = G.hurtFlash = G.hitmark = G.shake = 0;
  G.shotCd = 0;
  resetPlayer();
  hideOverlay();
  updateHUD();
  try { audio(); } catch (e) {}
  if (!isTouchPlay()) {
    try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (err) {}
  }
}

function showOverlay(which) {
  resetTouch();
  shooting = false;
  document.getElementById("overlay").classList.add("show");
  document.body.classList.add("menu");
  document.getElementById("title-card").classList.toggle("hidden", which !== "title");
  document.getElementById("dead-card").classList.toggle("hidden", which !== "dead");
  document.getElementById("win-card").classList.toggle("hidden", which !== "win");
  document.getElementById("hud").classList.remove("show");
  document.getElementById("minimap").classList.remove("show");
  document.getElementById("crosshair").classList.remove("show");
}
function hideOverlay() {
  document.getElementById("overlay").classList.remove("show");
  document.body.classList.remove("menu");
  document.getElementById("hud").classList.add("show");
  document.getElementById("minimap").classList.add("show");
  document.getElementById("crosshair").classList.add("show");
}

function updateHUD() {
  const el = document.getElementById("lives");
  let html = "";
  for (let i = 0; i < MAX_LIVES; i++) html += i < G.lives ? "<span>♥</span>" : "<span class='gone'>♥</span>";
  el.innerHTML = html;
  document.getElementById("score").textContent = G.score;
  const ammo = document.getElementById("ammo");
  if (G.reload > 0) {
    ammo.textContent = "RELOAD";
    ammo.className = "reloading";
  } else {
    ammo.textContent = G.ammo + " / " + G.reserve;
    ammo.className = G.ammo <= 3 ? "low" : "";
  }
  document.getElementById("seed-chip").textContent =
    "COURSE #" + (G.seed >>> 0).toString(16).toUpperCase() + "  " + G.sky.name;
}

function tryReload() {
  if (G.reload > 0 || G.ammo >= MAG || G.reserve <= 0) return;
  G.reload = 1.25;
  sfx("reload");
  updateHUD();
}

function shoot() {
  if (G.mode !== "play" || G.reload > 0) return;
  if (G.ammo <= 0) { tryReload(); return; }
  G.ammo--;
  G.muzzle = 0.07;
  G.recoil = 0.12;
  G.shake = Math.max(G.shake, 0.08);
  sfx("shoot");
  const o = eyePos();
  const d = forward();
  o.x += d.x * 0.2; o.y += d.y * 0.2; o.z += d.z * 0.2;
  const maxd = 48;
  const vhit = traceVoxels(o, d, maxd);
  let bestT = vhit ? vhit.t : maxd;
  let bestE = null;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const t = rayAABB(o, d, e.x - 0.38, e.y, e.z - 0.38, e.x + 0.38, e.y + 1.35, e.z + 0.38, bestT);
    if (t !== null && t < bestT) { bestT = t; bestE = e; }
  }
  const hx = o.x + d.x * bestT, hy = o.y + d.y * bestT, hz = o.z + d.z * bestT;
  if (bestE) {
    bestE.hp--;
    bestE.hit = 0.15;
    G.hitmark = 0.12;
    G.score += 25;
    burst(hx, hy, hz, [1, 0.3, 0.2], 8, 4);
    sfx("hit");
    if (bestE.hp <= 0) {
      G.score += 100;
      burst(bestE.x, bestE.y + 0.6, bestE.z, [1, 0.2, 0.45], 16, 6);
      sfx("kill");
    }
  } else if (vhit) {
    burst(hx, hy, hz, [1, 0.85, 0.4], 6, 3);
  }
  if (G.ammo <= 0) tryReload();
  updateHUD();
}

function los(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const L = Math.hypot(dx, dy, dz) || 1;
  const hit = traceVoxels({ x: ax, y: ay, z: az }, { x: dx / L, y: dy / L, z: dz / L }, L - 0.4);
  return !hit;
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    e.bob += dt * 6;
    e.hit = Math.max(0, e.hit - dt);
    e.cd -= dt;
    const dx = P.x - e.x, dz = P.z - e.z;
    const dist = Math.hypot(dx, dz);
    const see = dist < 18 && los(e.x, e.y + 0.9, e.z, P.x, P.y + 1.1, P.z);
    if (dist < 1.15) {
      e.vx = e.vz = 0;
      if (e.cd <= 0) { e.cd = 0.7; hurtPlayer(); }
    } else if (see) {
      e.yaw = Math.atan2(dx, -dz);
      if (e.kind === "shoot" && dist < 14 && dist > 4.5) {
        e.vx *= 0.4; e.vz *= 0.4;
        if (e.cd <= 0) {
          e.cd = 1.15;
          const ddx = P.x - e.x, ddy = (P.y + 1.1) - (e.y + 0.9), ddz = P.z - e.z;
          const L = Math.hypot(ddx, ddy, ddz) || 1;
          bolts.push({
            x: e.x, y: e.y + 0.9, z: e.z,
            vx: ddx / L * 10, vy: ddy / L * 10, vz: ddz / L * 10,
            life: 2.2, friendly: false,
          });
          blip(140, 0.06, "square", 0.04, 70);
        }
      } else {
        const sp = e.speed;
        e.vx = (dx / dist) * sp;
        e.vz = (dz / dist) * sp;
      }
    } else {
      e.vx *= 0.85; e.vz *= 0.85;
      if (Math.random() < 0.01) e.yaw += (Math.random() - 0.5);
    }
    moveCollide(e, dt, 0.32, 1.3, 22);
    if (e.y < -2) e.hp = 0;
  }
  enemies = enemies.filter(e => e.hp > 0 || e.hit > 0);
}

function updateBolts(dt) {
  for (const b of bolts) {
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (world.solid(b.x, b.y, b.z)) { b.life = 0; burst(b.x, b.y, b.z, [1,0.4,0.2], 5, 2); continue; }
    if (!b.friendly) {
      if (Math.abs(b.x - P.x) < 0.4 && b.y > P.y && b.y < P.y + 1.7 && Math.abs(b.z - P.z) < 0.4) {
        b.life = 0;
        hurtPlayer();
        burst(b.x, b.y, b.z, [1,0.2,0.2], 8, 3);
      }
    }
  }
  bolts = bolts.filter(b => b.life > 0);
}

function updatePickups(dt) {
  for (const p of pickups) {
    if (!p.alive) continue;
    p.t += dt;
    if (Math.hypot(p.x - P.x, p.z - P.z) < 1.1 && Math.abs(p.y - (P.y + 0.8)) < 1.2) {
      p.alive = false;
      sfx("pickup");
      if (p.kind === "ammo") {
        G.reserve += 12;
        G.score += 25;
      } else {
        G.score += 75;
      }
      burst(p.x, p.y, p.z, p.kind === "ammo" ? [1,0.85,0.2] : [0.9,0.2,0.9], 10, 3);
      updateHUD();
    }
  }
}

function updatePlayer(dt) {
  const sprint = keys["ShiftLeft"] || keys["ShiftRight"] || keys["Shift"];
  const speed = sprint ? 7.2 : 4.6;
  const fx = Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  const rx = Math.cos(P.yaw), rz = Math.sin(P.yaw);
  let wishx = 0, wishz = 0;
  if (keys["KeyW"] || keys["ArrowUp"]) { wishx += fx; wishz += fz; }
  if (keys["KeyS"] || keys["ArrowDown"]) { wishx -= fx; wishz -= fz; }
  if (keys["KeyA"] || keys["ArrowLeft"]) { wishx -= rx; wishz -= rz; }
  if (keys["KeyD"] || keys["ArrowRight"]) { wishx += rx; wishz += rz; }
  if (touch.moveX || touch.moveY) {
    wishx += -touch.moveY * fx + touch.moveX * rx;
    wishz += -touch.moveY * fz + touch.moveX * rz;
  }
  const wl = Math.hypot(wishx, wishz);
  if (wl > 0) { wishx = wishx / wl * speed; wishz = wishz / wl * speed; }
  const acc = P.grounded ? 18 : 6;
  P.vx += (wishx - P.vx) * Math.min(1, acc * dt);
  P.vz += (wishz - P.vz) * Math.min(1, acc * dt);
  if ((keys["Space"] || keys[" "] || touch.jump || touch.jumpQueued) && P.grounded) {
    P.vy = 8.2;
    P.grounded = false;
    touch.jumpQueued = false;
    sfx("jump");
  } else if (!touch.jump) {
    touch.jumpQueued = false;
  }
  moveCollide(P, dt, 0.32, 1.7, 24);
  if (P.y < -4) {
    P.x = spawn.x; P.y = spawn.y; P.z = spawn.z; P.vx = P.vy = P.vz = 0;
    hurtPlayer();
  }
  const pad = extract;
  if (P.x > pad.x && P.x < pad.x + pad.w && P.z > pad.z && P.z < pad.z + pad.d && P.y < pad.y + 2) {
    win();
  }
}

function updateParts(dt) {
  for (const p of parts) {
    p.life -= dt;
    p.vy -= 14 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  parts = parts.filter(p => p.life > 0);
}

const IDENT = m4ident();
function drawMesh(mesh, model, mvp, tint, emit) {
  bindMesh(mesh);
  gl.uniformMatrix4fv(loc.model, false, model);
  gl.uniformMatrix4fv(loc.mvp, false, mvp);
  gl.uniform3fv(loc.tint, tint);
  gl.uniform1f(loc.emit, emit);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
}

function cubeModel(x, y, z, sx, sy, sz) {
  return m4mul(m4trans(x, y, z), m4scale(sx, sy, sz));
}

function drawCube(x, y, z, sx, sy, sz, rgb, emit, viewproj) {
  const model = cubeModel(x, y, z, sx, sy, sz);
  const mvp = m4mul(viewproj, model);
  drawMesh(unitMesh, model, mvp, rgb, emit || 0);
}

function drawEnemy(e, vp) {
  const flash = e.hit > 0 ? 1 : 0;
  const bob = Math.sin(e.bob) * 0.05;
  const col = e.kind === "shoot" ? [0.55, 0.25, 1.0] : [0.95, 0.18, 0.28];
  const body = flash ? [1,1,1] : col;
  drawCube(e.x - 0.28, e.y + bob, e.z - 0.28, 0.56, 0.72, 0.56, body, flash, vp);
  drawCube(e.x - 0.22, e.y + 0.72 + bob, e.z - 0.22, 0.44, 0.38, 0.44, [0.12,0.12,0.18], 0, vp);
  const ex = Math.sin(e.yaw) * 0.18, ez = -Math.cos(e.yaw) * 0.18;
  drawCube(e.x + ex - 0.06, e.y + 0.88 + bob, e.z + ez - 0.06, 0.12, 0.12, 0.12, [0.2,1,1], 0.9, vp);
  drawCube(e.x - 0.22, e.y + bob, e.z - 0.08, 0.16, 0.28, 0.16, [0.1,0.1,0.14], 0, vp);
  drawCube(e.x + 0.06, e.y + bob, e.z - 0.08, 0.16, 0.28, 0.16, [0.1,0.1,0.14], 0, vp);
}

function drawGun(proj) {
  const kick = G.recoil * 0.18;
  const bobx = Math.sin(G.time * (P.grounded && (Math.hypot(P.vx,P.vz)>0.4) ? 10 : 2)) * 0.012;
  const boby = Math.abs(Math.cos(G.time * 10)) * (Math.hypot(P.vx,P.vz)>0.4 ? 0.018 : 0.006);
  let M = m4trans(0.28 + bobx, -0.32 - kick - boby, -0.55 - kick);
  M = m4mul(M, m4rotY(0.18));
  M = m4mul(M, m4rotX(0.12 + G.recoil * 0.4));
  const vp = m4mul(proj, M);
  gl.uniform3fv(loc.cam, [0, 0, 0]);
  gl.uniform1f(loc.fogN, 80);
  gl.uniform1f(loc.fogF, 120);
  function gbox(x,y,z,sx,sy,sz,c,em) {
    const m = cubeModel(x,y,z,sx,sy,sz);
    const model = m4mul(M, m);
    drawMesh(unitMesh, model, m4mul(vp, m), c, em || 0);
  }
  gbox(-0.05, -0.12, 0.02, 0.10, 0.22, 0.14, [0.12,0.12,0.16], 0); // handle
  gbox(-0.07, 0.04, -0.22, 0.14, 0.12, 0.46, [0.18,0.2,0.26], 0); // body
  gbox(-0.04, 0.08, -0.52, 0.08, 0.08, 0.32, [0.35,0.38,0.45], 0); // barrel
  gbox(-0.03, 0.16, -0.10, 0.06, 0.06, 0.10, [0.1,0.9,1], 0.6); // sight
  gbox(-0.05, -0.02, -0.08, 0.10, 0.10, 0.16, [1.0,0.5,0.12], 0); // mag
  if (G.muzzle > 0) gbox(-0.06, 0.06, -0.82, 0.12, 0.12, 0.12, [1,0.9,0.4], 1);
}

function drawMinimap() {
  const mm = document.getElementById("minimap");
  const ctx = mm.getContext("2d");
  const s = 168;
  ctx.fillStyle = "#081018";
  ctx.fillRect(0, 0, s, s);
  // world fit
  let minx = W, minz = D, maxx = 0, maxz = 0;
  for (const r of rooms) {
    minx = Math.min(minx, r.x); maxx = Math.max(maxx, r.x + r.w);
    minz = Math.min(minz, r.z); maxz = Math.max(maxz, r.z + r.d);
  }
  minx = Math.max(0, minx - 2); minz = Math.max(0, minz - 2);
  maxx = Math.min(W, maxx + 2); maxz = Math.min(D, maxz + 2);
  const bw = maxx - minx, bd = maxz - minz;
  const sc = Math.min(s / bw, s / bd);
  const ox = (s - bw * sc) / 2, oz = (s - bd * sc) / 2;
  function px(x, z) { return [ox + (x - minx) * sc, oz + (z - minz) * sc]; }
  if (minimapDirty) {
    G._mm = { minx, minz, sc, ox, oz };
    const img = ctx.createImageData(s, s);
    for (let z = minz; z < maxz; z++) {
      for (let x = minx; x < maxx; x++) {
        let t = 0;
        for (let y = H - 1; y >= 0; y--) { if (world.get(x, y, z)) { t = world.get(x, y, z); break; } }
        if (!t) continue;
        const c = PAL[t] || [1,1,1];
        const [px1, pz1] = px(x, z);
        const x0 = px1 | 0, y0 = pz1 | 0, x1 = (px1 + sc) | 0, y1 = (pz1 + sc) | 0;
        for (let yy = y0; yy <= y1 && yy < s; yy++)
          for (let xx = x0; xx <= x1 && xx < s; xx++) {
            if (xx < 0 || yy < 0) continue;
            const i = (yy * s + xx) * 4;
            img.data[i] = c[0] * 255; img.data[i+1] = c[1] * 255; img.data[i+2] = c[2] * 255; img.data[i+3] = 255;
          }
      }
    }
    G._mmImg = img;
    minimapDirty = false;
  }
  if (G._mmImg) ctx.putImageData(G._mmImg, 0, 0);
  const [ex, ez] = px(extract.x + extract.w / 2, extract.z + extract.d / 2);
  ctx.fillStyle = "#ffe14a";
  ctx.fillRect(ex - 4, ez - 4, 8, 8);
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const [qx, qz] = px(e.x, e.z);
    ctx.fillStyle = e.kind === "shoot" ? "#b44bff" : "#ff3d6e";
    ctx.fillRect(qx - 2, qz - 2, 4, 4);
  }
  const [plx, plz] = px(P.x, P.z);
  ctx.save();
  ctx.translate(plx, plz);
  ctx.rotate(P.yaw);
  ctx.fillStyle = "#1ce0ff";
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(0, 3); ctx.lineTo(-4, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - lastT) / 1000 || 0.016);
  lastT = now;
  G.time += dt;
  G.muzzle = Math.max(0, G.muzzle - dt);
  G.recoil = Math.max(0, G.recoil - dt * 1.6);
  G.hurtFlash = Math.max(0, G.hurtFlash - dt);
  G.hitmark = Math.max(0, G.hitmark - dt);
  G.shake = Math.max(0, G.shake - dt * 1.8);
  G.invuln = Math.max(0, G.invuln - dt);
  document.getElementById("muzzle").classList.toggle("flash", G.muzzle > 0);
  document.getElementById("hurt").classList.toggle("show", G.hurtFlash > 0);
  document.getElementById("crosshair").classList.toggle("hit", G.hitmark > 0);

  if (G.mode === "play") {
    if (G.reload > 0) {
      G.reload -= dt;
      if (G.reload <= 0) {
        const need = MAG - G.ammo;
        const take = Math.min(need, G.reserve);
        G.ammo += take; G.reserve -= take;
        updateHUD();
      }
    }
    updatePlayer(dt);
    updateEnemies(dt);
    updateBolts(dt);
    updatePickups(dt);
    G.shotCd = Math.max(0, G.shotCd - dt);
    if (shooting && G.shotCd <= 0) { shoot(); G.shotCd = 0.16; }
  } else {
    wasShooting = false;
  }
  updateParts(dt);

  if (canvas.width !== canvas.clientWidth * Math.min(devicePixelRatio||1,2) ||
      canvas.height !== canvas.clientHeight * Math.min(devicePixelRatio||1,2)) resize();

  const sky = G.sky;
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(sky.sky[0], sky.sky[1], sky.sky[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = canvas.width / Math.max(1, canvas.height);
  const proj = m4persp(70 * Math.PI / 180, aspect, 0.08, 90);
  let camX, camY, camZ, view;
  if (G.mode === "play") {
    const shx = (Math.random() - 0.5) * G.shake * 0.12;
    const shy = (Math.random() - 0.5) * G.shake * 0.12;
    camX = P.x + shx; camY = P.y + P.eye + shy; camZ = P.z;
    const f = forward();
    view = lookAt(camX, camY, camZ, camX + f.x, camY + f.y, camZ + f.z, 0, 1, 0);
  } else {
    const t = G.time * 0.22;
    camX = 26 + Math.sin(t) * 16;
    camY = 11;
    camZ = 18 + (G.time * 3) % 50;
    view = lookAt(camX, camY, camZ, 26, 4, camZ + 10, 0, 1, 0);
  }
  const vp = m4mul(proj, view);
  gl.uniform3fv(loc.light, sky.light);
  gl.uniform3fv(loc.cam, [camX, camY, camZ]);
  gl.uniform3fv(loc.fog, sky.fog);
  gl.uniform1f(loc.fogN, 18);
  gl.uniform1f(loc.fogF, 62);
  gl.uniform1f(loc.time, G.time);

  drawMesh(worldMesh, IDENT, vp, [1,1,1], 0);

  for (const e of enemies) if (e.hp > 0) drawEnemy(e, vp);
  for (const b of bolts) drawCube(b.x - 0.08, b.y - 0.08, b.z - 0.08, 0.16, 0.16, 0.16, [1,0.35,0.15], 1, vp);
  for (const p of pickups) {
    if (!p.alive) continue;
    const y = p.y + Math.sin(p.t * 3) * 0.12;
    const col = p.kind === "ammo" ? [1, 0.82, 0.2] : [0.95, 0.25, 0.9];
    drawCube(p.x - 0.18, y, p.z - 0.18, 0.36, 0.36, 0.36, col, 0.45, vp);
  }
  for (const p of parts) {
    const k = Math.max(0.04, p.s * (p.life * 2));
    drawCube(p.x, p.y, p.z, k, k, k, p.col, 0.4, vp);
  }

  // extract beacon
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 3);
  drawCube(extract.x + 1.5, extract.y + 0.4 + pulse, extract.z + 1.5, 0.9, 0.9, 0.9, [1, 0.9, 0.2], 0.8, vp);

  if (G.mode === "play") {
    gl.clear(gl.DEPTH_BUFFER_BIT);
    drawGun(proj);
    drawMinimap();
  }
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", e => {
  keys[e.code] = true;
  keys[e.key] = true;
  if (e.code === "KeyR") tryReload();
  if (e.code === "Space") e.preventDefault();
  if (e.code === "KeyP" && G.mode === "title") startRun();
});
window.addEventListener("keyup", e => { keys[e.code] = false; keys[e.key] = false; });
window.addEventListener("blur", () => { keys = Object.create(null); shooting = false; resetTouch(); });

canvas.addEventListener("mousedown", e => {
  if (isTouchPlay()) return;
  if (e.button === 0) {
    shooting = true;
    if (G.mode === "play" && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  }
});
window.addEventListener("mouseup", e => { if (e.button === 0 && !isTouchPlay()) shooting = false; });
document.addEventListener("mousemove", e => {
  if (document.pointerLockElement !== canvas || G.mode !== "play") return;
  P.yaw += e.movementX * 0.0022;
  P.pitch += e.movementY * 0.0022;
  P.pitch = clamp(P.pitch, -1.35, 1.35);
});
document.addEventListener("pointerlockchange", () => {
  G.locked = document.pointerLockElement === canvas;
  if (isTouchPlay()) return;
  document.getElementById("hint").textContent = G.locked
    ? "WASD MOVE  ·  LMB SHOOT  ·  SPACE JUMP  ·  SHIFT SPRINT  ·  R RELOAD"
    : "CLICK TO LOCK MOUSE  ·  WASD MOVE  ·  LMB SHOOT";
});

(function bindTouchControls() {
  const joyZone = document.getElementById("joy-zone");
  const lookZone = document.getElementById("look-zone");
  const joyBase = document.getElementById("joy-base");
  const joyStick = document.getElementById("joy-stick");
  const btnFire = document.getElementById("btn-fire");
  const btnJump = document.getElementById("btn-jump");
  const btnReload = document.getElementById("btn-reload");

  function setJoyVisual(dx, dy) {
    joyStick.style.transform = "translate(" + dx + "px," + dy + "px)";
  }
  function applyJoy(clientX, clientY) {
    let dx = clientX - touch.joyOX;
    let dy = clientY - touch.joyOY;
    const len = Math.hypot(dx, dy);
    if (len > JOY_R) {
      dx = dx / len * JOY_R;
      dy = dy / len * JOY_R;
    }
    const nx = dx / JOY_R;
    const ny = dy / JOY_R;
    const dead = 0.18;
    touch.moveX = Math.abs(nx) < dead ? 0 : nx;
    touch.moveY = Math.abs(ny) < dead ? 0 : ny;
    setJoyVisual(dx, dy);
  }
  function endJoy() {
    touch.joyPtr = null;
    touch.moveX = 0;
    touch.moveY = 0;
    setJoyVisual(0, 0);
    joyBase.classList.remove("active");
    joyBase.style.left = "";
    joyBase.style.top = "";
  }

  joyZone.addEventListener("pointerdown", e => {
    if (G.mode !== "play") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (touch.joyPtr != null) return;
    e.preventDefault();
    enableTouchUI();
    touch.joyPtr = e.pointerId;
    const zone = joyZone.getBoundingClientRect();
    const r = 56;
    touch.joyOX = clamp(e.clientX, zone.left + r, zone.right - r);
    touch.joyOY = clamp(e.clientY, zone.top + r, zone.bottom - r);
    joyBase.classList.add("active");
    joyBase.style.left = (touch.joyOX - zone.left) + "px";
    joyBase.style.top = (touch.joyOY - zone.top) + "px";
    try { joyZone.setPointerCapture(e.pointerId); } catch (err) {}
    applyJoy(e.clientX, e.clientY);
  });
  joyZone.addEventListener("pointermove", e => {
    if (e.pointerId !== touch.joyPtr) return;
    e.preventDefault();
    applyJoy(e.clientX, e.clientY);
  });
  function joyUp(e) {
    if (e.pointerId !== touch.joyPtr) return;
    endJoy();
  }
  joyZone.addEventListener("pointerup", joyUp);
  joyZone.addEventListener("pointercancel", joyUp);
  joyZone.addEventListener("lostpointercapture", e => {
    if (e.pointerId === touch.joyPtr) endJoy();
  });

  lookZone.addEventListener("pointerdown", e => {
    if (G.mode !== "play") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (touch.lookPtr != null) return;
    e.preventDefault();
    enableTouchUI();
    touch.lookPtr = e.pointerId;
    touch.lookLX = e.clientX;
    touch.lookLY = e.clientY;
    try { lookZone.setPointerCapture(e.pointerId); } catch (err) {}
  });
  lookZone.addEventListener("pointermove", e => {
    if (e.pointerId !== touch.lookPtr) return;
    e.preventDefault();
    const dx = e.clientX - touch.lookLX;
    const dy = e.clientY - touch.lookLY;
    touch.lookLX = e.clientX;
    touch.lookLY = e.clientY;
    if (G.mode !== "play") return;
    P.yaw += dx * 0.0034;
    P.pitch += dy * 0.0034;
    P.pitch = clamp(P.pitch, -1.35, 1.35);
  });
  function lookUp(e) {
    if (e.pointerId !== touch.lookPtr) return;
    touch.lookPtr = null;
  }
  lookZone.addEventListener("pointerup", lookUp);
  lookZone.addEventListener("pointercancel", lookUp);
  lookZone.addEventListener("lostpointercapture", e => {
    if (e.pointerId === touch.lookPtr) touch.lookPtr = null;
  });

  function holdBtn(el, down, up) {
    const onDown = e => {
      e.preventDefault();
      e.stopPropagation();
      enableTouchUI();
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      down(e);
    };
    const onUp = e => {
      e.preventDefault();
      up && up(e);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); });
    el.addEventListener("contextmenu", e => e.preventDefault());
  }
  holdBtn(btnFire, () => {
    if (G.mode !== "play") return;
    shooting = true;
    if (G.shotCd <= 0) { shoot(); G.shotCd = 0.16; }
  }, () => { shooting = false; });
  holdBtn(btnJump, () => { touch.jump = true; touch.jumpQueued = true; }, () => { touch.jump = false; });
  holdBtn(btnReload, () => { if (G.mode === "play") tryReload(); }, null);

  window.addEventListener("pointerdown", e => {
    if (e.pointerType === "touch" || e.pointerType === "pen") enableTouchUI();
  }, true);

  document.addEventListener("touchmove", e => {
    if (G.mode === "play") e.preventDefault();
  }, { passive: false });
  document.addEventListener("gesturestart", e => e.preventDefault());
  document.addEventListener("contextmenu", e => {
    if (G.mode === "play") e.preventDefault();
  });
})();

document.getElementById("play-btn").addEventListener("click", startRun);
document.getElementById("retry-btn").addEventListener("click", startRun);
document.getElementById("again-btn").addEventListener("click", startRun);
document.getElementById("dead-menu-btn").addEventListener("click", () => { G.mode = "title"; showOverlay("title"); });
document.getElementById("win-menu-btn").addEventListener("click", () => { G.mode = "title"; showOverlay("title"); });

if (prefersTouch()) enableTouchUI();
generate((Date.now() ^ 0x9e3779b9) >>> 0);
document.body.classList.add("menu");
resize();
updateHUD();
requestAnimationFrame(frame);
})();
