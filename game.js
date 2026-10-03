/* GROK VOXELS 2.0 — first-person voxel shooter, no build step */
(() => {
"use strict";

const W = 52, H = 16, D = 180;
const MAG = 12, RESERVE_START = 36;
const MAX_LIVES = 3;
const MAX_HP = 100;
// Difficulty tuning. [early, late] pairs ramp over the course as you push deeper.
const DIFFS = [
  { name: "EASY",   desc: "Fewer, slower-shooting bots. Big health regen. Aim assist.",
    dmg: 0.5, count: 0.6, spread: [0.16, 0.09], bolt: [6.5, 8.5], fireCd: [2.2, 1.6], windup: 0.9, see: 13,
    regenDelay: 2.5, regenRate: 24, drop: 0.5, hpDrop: 0.3, assist: 0.075, ammoPick: 18, score: 1 },
  { name: "NORMAL", desc: "The classic challenge, now with health regen and checkpoints.",
    dmg: 1.0, count: 0.85, spread: [0.10, 0.055], bolt: [8, 10.5], fireCd: [1.7, 1.2], windup: 0.62, see: 16,
    regenDelay: 4, regenRate: 14, drop: 0.32, hpDrop: 0.14, assist: 0.05, ammoPick: 12, score: 1.5 },
  { name: "HARD",   desc: "Sharp-shooting swarms. Slow regen. For veterans.",
    dmg: 1.45, count: 1.15, spread: [0.055, 0.025], bolt: [10, 12.5], fireCd: [1.25, 0.9], windup: 0.42, see: 20,
    regenDelay: 6, regenRate: 8, drop: 0.2, hpDrop: 0.06, assist: 0.03, ammoPick: 12, score: 2 },
];
const DMG = { bolt: 20, melee: 24, tank: 16, drone: 10, fall: 25 };
const SHELLS_PICK = 8;
const STORE_KEY = "grokvoxels2";
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch (e) { return {}; }
}
function saveStore(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } }
const STORE = loadStore();
if (!STORE.best) STORE.best = {};
if (typeof STORE.diff !== "number") STORE.diff = 0; // first-timers start on Easy

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
  diff: STORE.diff, hp: MAX_HP, regenT: 0, kills: 0, dmgTaken: 0, shells: 0, weapon: 0, emergencyT: 0,
  maxRoom: 0, cp: null, runStart: 0, dmgDir: 0, dmgDirT: 0, god: false, bot: false,
};
const P = {
  x: 26, y: 3, z: 6, vx: 0, vy: 0, vz: 0,
  yaw: 0, pitch: 0, grounded: false, eye: 1.55,
};
// Online co-op state (see the ONLINE CO-OP section near the end). Inert in single-player.
const NET = { on: false, host: true, down: false, menu: false, applying: false, enemyMul: 1, tankHp: 0, remotes: new Map(), gen: 0, onPad: false };
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
    const r = { x, z, w: rw, d: rd, fy, type, walls: rng.pick(wallSets), idx: rooms.length };
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
    r.door = doorX(r, 3);
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
      const Dd = DIFFS[G.diff];
      // 0 at the first combat room → 1 at the last: early rooms are gentle, the end is a fight.
      const ramp = clamp((r.idx - 1) / Math.max(1, rooms.length - 3), 0, 1);
      const base = r.type === "arena" ? rng.int(3, 5) : r.type === "hall" ? rng.int(2, 3) : rng.int(1, 3);
      const nEn = Math.max(1, Math.round(base * Dd.count * (0.55 + 0.6 * ramp) * NET.enemyMul)); // co-op: a few more bots per extra player
      let placed = 0, guard = 0, tanks = 0;
      while (placed < nEn && guard++ < 60) {
        const ex = rng.f(r.x + 2, r.x + r.w - 2);
        const ez = rng.f(r.z + 4, r.z + r.d - 3);
        const ey = r.fy + 1.01;
        if (world.solid(ex, ey, ez) || world.solid(ex, ey + 1, ez)) continue;
        let kind = rng.chance(0.3 + 0.25 * ramp) ? "shoot" : "melee";
        if (ramp > 0.3 && rng.chance(0.2)) kind = "drone";
        const tankOk = G.diff === 0 ? r.idx === rooms.length - 2 : ramp > 0.55;
        if (tankOk && tanks < (G.diff === 2 ? 2 : 1) && rng.chance(G.diff === 0 ? 0.5 : 0.25)) { kind = "tank"; tanks++; }
        const fly = kind === "drone";
        if (fly && (world.solid(ex, r.fy + 2.4, ez) || world.solid(ex, r.fy + 3.2, ez))) continue;
        enemies.push({
          x: ex, y: fly ? r.fy + 2.4 : ey, z: ez, vx: 0, vy: 0, vz: 0,
          hp: { shoot: 3, melee: 2, drone: 1, tank: 7 + NET.tankHp }[kind], maxHp: { shoot: 3, melee: 2, drone: 1, tank: 7 + NET.tankHp }[kind], id: enemies.length,
          kind, fly, cd: rng.f(0.8, 1.8), yaw: rng.f(0, Math.PI * 2),
          hit: 0, bob: rng.f(0, 10), windup: 0, windMax: 1, alert: false, alertT: 0, see: false, losT: rng.f(0, 0.2),
          strafe: rng.chance(0.5) ? 1 : -1, room: r.idx,
          speed: kind === "melee" ? rng.f(2.2, 3.0) : kind === "tank" ? 1.1 : kind === "drone" ? 2.6 : rng.f(1.4, 2.0),
        });
        placed++;
      }
      // pickups: generous on Easy, a bit scarcer on Hard
      const spot = () => {
        for (let k = 0; k < 20; k++) {
          const px = rng.f(r.x + 2, r.x + r.w - 2), pz = rng.f(r.z + 2, r.z + r.d - 2);
          if (!world.solid(px, r.fy + 1.2, pz)) return { x: px, z: pz };
        }
        return { x: r.x + r.w / 2, z: r.z + r.d / 2 };
      };
      const addPick = kind => { const s = spot(); pickups.push({ x: s.x, y: r.fy + 1.4, z: s.z, kind, alive: true, t: rng.f(0, 5), id: pickups.length }); };
      if (G.diff === 0) { addPick("ammo"); if (rng.chance(0.65)) addPick("health"); if (rng.chance(0.3)) addPick("gem"); }
      else if (rng.chance(G.diff === 1 ? 0.9 : 0.75)) {
        const roll = rng.next();
        addPick(roll < 0.45 ? "ammo" : roll < (G.diff === 1 ? 0.8 : 0.72) ? "health" : "gem");
        if (r.type === "arena" && rng.chance(0.5)) addPick(rng.chance(0.5) ? "ammo" : "health");
      }
      if (r.idx === 2) addPick("scatter");                                  // new weapon, early on
      if (r.idx === Math.floor(rooms.length / 2) && G.diff < 2) addPick("heart"); // extra life halfway
      // checkpoint just inside the entrance door
      const dx = doorX(r, 3);
      r.cp = { x: dx + 1.5, y: r.fy + 1.01, z: r.z + 1.6, yaw: Math.PI, idx: r.idx, active: false };
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

function toast(text, color) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = text;
  el.style.color = color || "#fff56a";
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
}

function hurtPlayer(amount, src) {
  if (G.mode !== "play" || G.invuln > 0 || G.god || NET.down) return;
  const Dd = DIFFS[G.diff];
  const dmg = Math.max(1, Math.round((amount || DMG.bolt) * Dd.dmg));
  G.hp -= dmg;
  G.regenT = Dd.regenDelay;
  G.invuln = 0.3;                 // brief i-frames so a burst can't delete you
  G.hurtFlash = 0.25 + Math.min(0.3, dmg / 80);
  G.shake = Math.max(G.shake, 0.22);
  G.dmgTaken += dmg;
  if (src) { // damage direction indicator
    G.dmgDir = Math.atan2(src.x - P.x, -(src.z - P.z)); G.dmgDirT = 0.9; // world angle
  }
  sfx("hurt");
  if (G.hp <= 0) { if (NET.on) netDown(); else loseLife(); } // co-op: go down and wait for a revive
  updateHUD();
}

function respawnAtCheckpoint() {
  const c = G.cp || spawn;
  P.x = c.x; P.y = c.y; P.z = c.z;
  P.vx = P.vy = P.vz = 0;
  P.yaw = c.yaw; P.pitch = 0; P.grounded = false;
  bolts = [];
  if (NET.on) netSpread();
  // give the player breathing room: nearby bots lose track and back off a little
  for (const e of enemies) {
    e.windup = 0; e.cd = Math.max(e.cd, 1.5); e.alert = false; e.see = false;
    if (Math.hypot(e.x - P.x, e.z - P.z) < 6) { e.vx = e.vz = 0; }
  }
}

function loseLife() {
  G.lives--;
  if (G.lives <= 0) { G.hp = 0; updateHUD(); die(); return; }
  G.hp = MAX_HP;
  G.invuln = 2.2;
  G.regenT = 0;
  if (G.ammo + G.reserve < MAG) G.reserve = MAG - G.ammo; // never respawn empty
  respawnAtCheckpoint();
  toast(G.cp && G.cp !== spawn ? "LIFE LOST · BACK TO CHECKPOINT" : "LIFE LOST · BACK TO START", "#ff6b8a");
}

function saveBest() {
  const k = DIFFS[G.diff].name;
  const prev = STORE.best[k] || 0;
  const isBest = G.score > prev;
  if (isBest) { STORE.best[k] = G.score; saveStore(STORE); }
  return { isBest, best: Math.max(prev, G.score) };
}
function runSummary(b) {
  const secs = Math.round(G.time - G.runStart);
  return "SCORE " + G.score + (b.isBest ? "  ★ NEW BEST" : "  ·  BEST " + b.best) +
    "\nKILLS " + G.kills + "  ·  ROOMS " + Math.max(0, G.maxRoom) + "/" + Math.max(1, rooms.length - 2) +
    "  ·  " + Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0") + "  ·  " + DIFFS[G.diff].name;
}

function die() {
  G.mode = "dead";
  sfx("die");
  document.exitPointerLock && document.exitPointerLock();
  const b = saveBest();
  showOverlay("dead");
  document.getElementById("dead-msg").textContent = G.diff > 0 && G.maxRoom <= 2
    ? "The bots got you. Try EASY to learn the ropes!" : "The bots got you. Your checkpoints reset each run.";
  document.getElementById("dead-stats").textContent = runSummary(b);
}

function win() {
  if (G.mode !== "play") return;
  G.mode = "win";
  sfx("win");
  G.score += Math.round((250 + G.lives * 100) * DIFFS[G.diff].score);
  document.exitPointerLock && document.exitPointerLock();
  const b = saveBest();
  showOverlay("win");
  document.getElementById("win-stats").textContent = runSummary(b) + "  ·  LIVES LEFT " + G.lives;
  updateHUD();
  if (NET.on) netWinCard();
}

function startRun(diff, seedArg) {
  if (NET.on && !NET.host && !NET.applying) return; // co-op: only the host starts runs
  if (typeof diff === "number") { G.diff = clamp(diff | 0, 0, 2); if (!NET.on || NET.host) { STORE.diff = G.diff; saveStore(STORE); } }
  const seed = typeof seedArg === "number" ? seedArg : (Math.random() * 0xffffffff) ^ (Date.now() * 2654435761);
  if (NET.on && NET.host && !NET.applying) netAnnounceRun(seed);
  generate(seed);
  G.mode = "play";
  G.lives = MAX_LIVES;
  G.hp = MAX_HP;
  G.regenT = 0;
  G.score = 0;
  G.kills = 0;
  G.dmgTaken = 0;
  G.ammo = MAG;
  G.reserve = RESERVE_START + (G.diff === 0 ? 24 : 0);
  G.shells = 0;
  G.weapon = 0;
  G.reload = 0;
  G.invuln = 1.0;
  G.emergencyT = 0;
  G.muzzle = G.recoil = G.hurtFlash = G.hitmark = G.shake = 0;
  G.shotCd = 0;
  G.dmgDirT = 0;
  G.maxRoom = 0;
  G.cp = spawn;
  G.runStart = G.time;
  resetPlayer();
  hideOverlay();
  updateHUD();
  try { audio(); } catch (e) {}
  if (!isTouchPlay() && !G.bot && !NET.applying) {
    try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (err) {}
  }
  toast(DIFFS[G.diff].name + " · REACH THE GOLD PAD", "#1ce0ff");
  if (NET.on) { netSpread(); netRunStarted(); }
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
  let html = "";
  if (NET.on) html = "<b class='mp-you'>" + (NET.down ? "DOWN" : "CO-OP") + "</b>";
  else for (let i = 0; i < MAX_LIVES; i++) html += i < G.lives ? "<span>♥</span>" : "<span class='gone'>♥</span>";
  document.getElementById("hearts").innerHTML = html;
  updateHpBar();
  document.getElementById("score").textContent = G.score;
  const ammo = document.getElementById("ammo");
  document.getElementById("ammo-label").textContent = G.weapon === 1 ? "SCATTER" : "BLASTER";
  if (G.weapon === 1) {
    ammo.textContent = G.shells + " SHELLS";
    ammo.className = G.shells <= 2 ? "low" : "";
  } else if (G.reload > 0) {
    ammo.textContent = "RELOAD";
    ammo.className = "reloading";
  } else {
    ammo.textContent = G.ammo + " / " + G.reserve;
    ammo.className = G.ammo <= 3 ? "low" : "";
  }
  const swap = document.getElementById("btn-swap");
  if (swap) swap.classList.toggle("hidden", G.shells <= 0);
  document.getElementById("seed-chip").textContent =
    DIFFS[G.diff].name + " · ROOM " + Math.max(0, G.maxRoom) + "/" + Math.max(1, rooms.length - 2) + " · " + G.sky.name;
}
let hpShown = -1;
function updateHpBar() {
  const v = Math.max(0, Math.round(G.hp));
  if (v === hpShown) return;
  hpShown = v;
  const fill = document.getElementById("hp-fill");
  fill.style.width = v + "%";
  fill.className = v < 30 ? "crit" : v < 60 ? "mid" : "";
}

function tryReload() {
  if (G.weapon === 1) return;
  if (G.reload > 0 || G.ammo >= MAG || G.reserve <= 0) return;
  G.reload = G.diff === 0 ? 1.0 : 1.25;
  sfx("reload");
  updateHUD();
}

function switchWeapon(to) {
  if (G.mode !== "play") return;
  const next = typeof to === "number" ? to : 1 - G.weapon;
  if (next === 1 && G.shells <= 0) { toast("NO SCATTER SHELLS", "#ff9a6b"); return; }
  if (next === G.weapon) return;
  G.weapon = next; G.reload = 0; G.shotCd = 0.2;
  sfx("reload");
  updateHUD();
}

// Aim assist: nudge the shot toward a bot that's very close to the crosshair (bigger on phones / Easy).
function assistDir(o, d) {
  let cone = DIFFS[G.diff].assist + (isTouchPlay() ? 0.035 : 0);
  let best = null, bestA = cone;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const cy = e.y + (e.kind === "tank" ? 0.8 : 0.6);
    const vx = e.x - o.x, vy = cy - o.y, vz = e.z - o.z, L = Math.hypot(vx, vy, vz);
    if (L > 30 || L < 0.5) continue;
    const a = Math.acos(clamp((vx * d.x + vy * d.y + vz * d.z) / L, -1, 1));
    if (a < bestA && los(o.x, o.y, o.z, e.x, cy, e.z)) { bestA = a; best = { x: vx / L, y: vy / L, z: vz / L }; }
  }
  return best || d;
}

function enemyBox(e) {
  if (e.kind === "tank") return [e.x - 0.55, e.y, e.z - 0.55, e.x + 0.55, e.y + 1.7, e.z + 0.55];
  if (e.kind === "drone") return [e.x - 0.38, e.y - 0.1, e.z - 0.38, e.x + 0.38, e.y + 0.6, e.z + 0.38];
  return [e.x - 0.38, e.y, e.z - 0.38, e.x + 0.38, e.y + 1.35, e.z + 0.38];
}

function fireRay(o, d, dmg) {
  const maxd = 48;
  const vhit = traceVoxels(o, d, maxd);
  let bestT = vhit ? vhit.t : maxd;
  let bestE = null;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const b = enemyBox(e);
    const t = rayAABB(o, d, b[0], b[1], b[2], b[3], b[4], b[5], bestT);
    if (t !== null && t < bestT) { bestT = t; bestE = e; }
  }
  const hx = o.x + d.x * bestT, hy = o.y + d.y * bestT, hz = o.z + d.z * bestT;
  NET.lastHit = [hx, hy, hz];
  if (bestE) {
    damageEnemy(bestE, dmg, hx, hy, hz);
  } else if (vhit) {
    burst(hx, hy, hz, [1, 0.85, 0.4], 4, 3);
  }
  return bestE;
}

function damageEnemy(e, dmg, hx, hy, hz, by) {
  // co-op: "by" is set when the host applies a partner's hit (their own screen already showed it)
  const remote = NET.on && by !== undefined && by !== NET.pid;
  if (NET.on && !NET.host && !remote) { netSend({ t: "dmg", id: e.id, d: dmg }); e.predT = performance.now(); }
  e.hp -= dmg;
  e.hit = 0.15;
  e.alert = true;
  if (!remote) {
    G.hitmark = 0.12;
    G.score += Math.round(25 * DIFFS[G.diff].score);
    sfx("hit");
  }
  burst(hx, hy, hz, [1, 0.3, 0.2], 6, 4);
  if (e.hp <= 0) {
    if (!remote) {
      G.kills++;
      const val = e.kind === "tank" ? 300 : e.kind === "drone" ? 120 : 100;
      G.score += Math.round(val * DIFFS[G.diff].score);
      sfx("kill");
    }
    burst(e.x, e.y + 0.6, e.z, e.kind === "tank" ? [1, 0.6, 0.1] : [1, 0.2, 0.45], e.kind === "tank" ? 30 : 16, 6);
    if (NET.on && !NET.host) return; // the host rolls drops and confirms the kill
    if (NET.on) netBroadcast({ t: "kill", id: e.id, by: by || NET.pid });
    // drops
    const Dd = DIFFS[G.diff], dropY = (e.fly ? e.y - 1.2 : e.y) + 0.4;
    if (Math.random() < Dd.drop || e.kind === "tank") netDrop({ x: e.x, y: dropY, z: e.z, kind: "ammo", alive: true, t: 0, small: e.kind !== "tank" });
    if (Math.random() < Dd.hpDrop || (e.kind === "tank" && G.diff < 2)) netDrop({ x: e.x + 0.4, y: dropY, z: e.z + 0.3, kind: "health", alive: true, t: 1, small: true });
  }
}

function shoot() {
  if (G.mode !== "play" || NET.down || NET.menu) return;
  const o = eyePos();
  const d0 = forward();
  o.x += d0.x * 0.2; o.y += d0.y * 0.2; o.z += d0.z * 0.2;
  if (G.weapon === 1) {
    if (G.shells <= 0) { switchWeapon(0); return; }
    G.shells--;
    G.muzzle = 0.1; G.recoil = 0.28; G.shake = Math.max(G.shake, 0.18);
    G.shotCd = 0.62;
    sfx("shoot"); blip(70, 0.18, "sawtooth", 0.07, 35);
    const d = assistDir(o, d0);
    // 7 pellets in a cone; up close this deletes anything
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2, r = (i === 0 ? 0 : 0.035 + Math.random() * 0.05);
      const ux = -d.z, uz = d.x; // horizontal perpendicular
      const pd = { x: d.x + ux * Math.cos(a) * r, y: d.y + Math.sin(a) * r, z: d.z + uz * Math.cos(a) * r };
      const L = Math.hypot(pd.x, pd.y, pd.z);
      fireRay(o, { x: pd.x / L, y: pd.y / L, z: pd.z / L }, 1);
    }
    if (G.shells <= 0) { toast("SCATTER EMPTY · BACK TO BLASTER", "#ff9a6b"); G.weapon = 0; }
    if (NET.on) netShot(o);
    updateHUD();
    return;
  }
  if (G.reload > 0) return;
  if (G.ammo <= 0) { tryReload(); return; }
  G.ammo--;
  G.muzzle = 0.07;
  G.recoil = 0.12;
  G.shotCd = 0.16;
  G.shake = Math.max(G.shake, 0.08);
  sfx("shoot");
  fireRay(o, assistDir(o, d0), 1);
  if (NET.on) netShot(o);
  if (G.ammo <= 0) tryReload();
  updateHUD();
}

function los(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const L = Math.hypot(dx, dy, dz) || 1;
  const hit = traceVoxels({ x: ax, y: ay, z: az }, { x: dx / L, y: dy / L, z: dz / L }, L - 0.4);
  return !hit;
}

// How far into the run we are (0..1). Difficulty ramps with it.
function runRamp() { return clamp(G.maxRoom / Math.max(1, rooms.length - 2), 0, 1); }

function fireBolt(e, yawOff, dmg, T) {
  const Dd = DIFFS[G.diff], t = runRamp();
  const sy = e.y + (e.kind === "tank" ? 1.1 : e.fly ? 0.25 : 0.9);
  const tg = T || P; // co-op: shoot at the chosen target
  const ddx = tg.x - e.x, ddy = (tg.y + 1.1) - sy, ddz = tg.z - e.z;
  const L = Math.hypot(ddx, ddy, ddz) || 1;
  // aim error: wide early / on Easy, tighter later
  const spread = Dd.spread[0] + (Dd.spread[1] - Dd.spread[0]) * t;
  const yaw = Math.atan2(ddx, ddz) + (yawOff || 0) + (Math.random() - 0.5) * 2 * spread;
  const pitch = Math.asin(clamp(ddy / L, -1, 1)) + (Math.random() - 0.5) * 1.2 * spread;
  const spd = (Dd.bolt[0] + (Dd.bolt[1] - Dd.bolt[0]) * t) * (e.kind === "drone" ? 1.15 : 1);
  bolts.push({
    x: e.x, y: sy, z: e.z,
    vx: Math.sin(yaw) * Math.cos(pitch) * spd, vy: Math.sin(pitch) * spd, vz: Math.cos(yaw) * Math.cos(pitch) * spd,
    life: 3, friendly: false, dmg: dmg || DMG.bolt, src: e,
  });
  if (NET.on && NET.host) netBolt(bolts[bolts.length - 1]);
  blip(e.kind === "tank" ? 90 : 160, 0.07, "square", 0.04, 70);
}

function updateEnemies(dt) {
  if (NET.on && !NET.host) { netPuppetEnemies(dt); return; } // co-op joiner: bots are driven by the host
  const Dd = DIFFS[G.diff], t = runRamp();
  const fireCd = Dd.fireCd[0] + (Dd.fireCd[1] - Dd.fireCd[0]) * t;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    e.bob += dt * 6;
    e.hit = Math.max(0, e.hit - dt);
    e.alertT = Math.max(0, e.alertT - dt);
    e.cd -= dt;
    const TG = NET.on ? netTarget(e) : P; // co-op: nearest player who is still up
    const dx = TG.x - e.x, dz = TG.z - e.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const range = Dd.see * (e.alert ? 1.4 : 1);
    e.losT -= dt;
    if (e.losT <= 0) {
      e.losT = 0.12 + Math.random() * 0.08;
      const eyeY = e.y + (e.kind === "tank" ? 1.3 : e.fly ? 0.3 : 0.9);
      e.see = dist < range && los(e.x, eyeY, e.z, TG.x, TG.y + 1.1, TG.z);
      if (e.see && !e.alert) { e.alert = true; e.alertT = 0.8; e.cd = Math.max(e.cd, 0.6); } // "!" telegraph before first shot
    }
    const see = e.see;
    if (see || e.windup > 0) e.yaw = Math.atan2(dx, -dz);

    // wind-up in progress: stand still, glow, then strike/fire
    if (e.windup > 0) {
      e.windup -= dt;
      e.vx *= 0.7; e.vz *= 0.7;
      if (e.windup <= 0) {
        if (e.wkind === "melee") {
          if (dist < 1.75 && Math.abs((TG.y) - e.y) < 1.6) { if (TG === P) hurtPlayer(DMG.melee, e); else netHit(TG, DMG.melee, e); }
          e.cd = 1.0;
        } else if (e.kind === "tank") {
          for (const off of [-0.2, 0, 0.2]) fireBolt(e, off, DMG.tank, TG);
          e.cd = fireCd * 1.9;
        } else {
          if (see) fireBolt(e, 0, e.kind === "drone" ? DMG.drone : DMG.bolt, TG);
          e.cd = fireCd * (e.kind === "drone" ? 0.8 : 1) * (0.85 + Math.random() * 0.3);
        }
      }
    } else if (e.kind === "melee" || (e.kind === "tank" && dist < 1.6)) {
      if (dist < 1.4 && e.cd <= 0) {
        e.windup = e.windMax = Dd.windup * 0.6 + 0.15; e.wkind = "melee";
        blip(380, 0.05, "square", 0.03, 520);
      } else if (see && dist > 1.0) {
        e.vx = (dx / dist) * e.speed; e.vz = (dz / dist) * e.speed;
      } else if (!see) { e.vx *= 0.85; e.vz *= 0.85; }
      else { e.vx = e.vz = 0; }
    } else { // ranged: shoot / drone / tank
      const far = e.kind === "tank" ? 15 : 14, near = e.kind === "drone" ? 3.5 : 4.5;
      if (see && dist < far) {
        if (e.cd <= 0 && e.alertT <= 0) {
          e.windup = e.windMax = Dd.windup * (e.kind === "tank" ? 1.3 : e.kind === "drone" ? 0.8 : 1); e.wkind = "shot";
          blip(e.kind === "tank" ? 120 : 600, 0.06, "triangle", 0.035, e.kind === "tank" ? 200 : 900);
        }
        // strafe sideways (drones circle), close in if too far, back off if too close
        const px = -dz / dist, pz = dx / dist;
        const st = e.kind === "tank" ? 0 : (e.kind === "drone" ? 1.8 : 0.9) * e.strafe;
        const toward = dist > (e.kind === "drone" ? 8 : 10) ? e.speed * 0.6 : dist < near ? -e.speed * 0.5 : 0;
        e.vx = px * st + (dx / dist) * toward; e.vz = pz * st + (dz / dist) * toward;
        if (Math.random() < dt * 0.4) e.strafe = -e.strafe;
      } else if (see) {
        e.vx = (dx / dist) * e.speed; e.vz = (dz / dist) * e.speed;
      } else {
        e.vx *= 0.85; e.vz *= 0.85;
        if (Math.random() < 0.01) e.yaw += (Math.random() - 0.5);
      }
    }
    const pvx = e.vx, pvz = e.vz;
    if (e.fly) moveCollide(e, dt, 0.32, 0.6, 0);
    else moveCollide(e, dt, e.kind === "tank" ? 0.5 : 0.32, e.kind === "tank" ? 1.7 : 1.3, 22);
    if ((pvx && !e.vx) || (pvz && !e.vz)) e.strafe = -e.strafe; // bumped a wall: change direction
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
        hurtPlayer(b.dmg || DMG.bolt, b.src || b);
        burst(b.x, b.y, b.z, [1,0.2,0.2], 8, 3);
      }
    }
  }
  bolts = bolts.filter(b => b.life > 0);
}

function updatePickups(dt) {
  const Dd = DIFFS[G.diff];
  for (const p of pickups) {
    if (!p.alive) continue;
    p.t += dt;
    if (Math.hypot(p.x - P.x, p.z - P.z) < 1.25 && Math.abs(p.y - (P.y + 0.8)) < 1.3) {
      if (p.kind === "health" && G.hp >= MAX_HP) continue; // leave it for later
      if (NET.on && !netClaimPickup(p)) continue; // co-op: the host hands out each pickup once
      applyPickup(p);
    }
  }
}
function applyPickup(p) {
  const Dd = DIFFS[G.diff];
  {
    {
      p.alive = false;
      sfx("pickup");
      let col = [1, 0.85, 0.2];
      if (p.kind === "ammo") {
        const n = p.small ? Math.ceil(Dd.ammoPick / 2) : Dd.ammoPick;
        G.reserve += n; G.score += 25; toast("+" + n + " AMMO", "#ffd23f");
      } else if (p.kind === "health") {
        const n = p.small ? 25 : 45;
        G.hp = Math.min(MAX_HP, G.hp + n); col = [0.3, 1, 0.4]; toast("+" + n + " HEALTH", "#7dff5a");
      } else if (p.kind === "heart") {
        if (G.lives < MAX_LIVES) { G.lives++; toast("+1 LIFE", "#ff3d6e"); } else { G.score += 200; toast("+200 (LIVES FULL)", "#ff3d6e"); }
        G.hp = MAX_HP; col = [1, 0.2, 0.4];
      } else if (p.kind === "scatter") {
        G.shells += SHELLS_PICK; col = [1, 0.5, 0.1];
        const first = G.weapon !== 1;
        G.weapon = 1; G.reload = 0;
        toast(first ? "SCATTER GUN! · " + (isTouchPlay() ? "SWAP" : "Q") + " to switch" : "+" + SHELLS_PICK + " SHELLS", "#ff9a3b");
      } else {
        G.score += 75; col = [0.9, 0.2, 0.9]; toast("+75 GEM", "#f07bff");
      }
      burst(p.x, p.y, p.z, col, 10, 3);
      updateHUD();
    }
  }
}

// Checkpoints: walking into a new combat room saves your respawn point there.
function updateCheckpoints() {
  if (NET.on && !NET.host) return; // co-op: the host tracks room progress for the team
  for (const r of rooms) {
    if (!r.cp || r.cp.active) continue;
    const inside = (x, z) => x > r.x && x < r.x + r.w && z > r.z + 0.8 && z < r.z + r.d;
    if ((inside(P.x, P.z) && !NET.down) || (NET.on && netAnyRemote(inside))) {
      if (NET.on) netBroadcast({ t: "cp", i: rooms.indexOf(r) });
      activateCp(r);
    }
  }
}
function activateCp(r) {
  {
    {
      r.cp.active = true;
      G.cp = r.cp;
      G.maxRoom = Math.max(G.maxRoom, r.idx);
      // a small top-up for reaching new ground
      G.hp = Math.min(MAX_HP, G.hp + 20);
      if (G.ammo + G.reserve < MAG * 2) G.reserve += 6;
      sfx("pickup");
      toast("CHECKPOINT · ROOM " + r.idx + "/" + Math.max(1, rooms.length - 2), "#7dff5a");
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
    if (!(NET.on && netRespawnNearPartner())) respawnAtCheckpoint();
    G.invuln = 0;
    hurtPlayer(DMG.fall / DIFFS[G.diff].dmg);
    G.invuln = 1.0;
  }
  const pad = extract;
  const onPad = P.x > pad.x && P.x < pad.x + pad.w && P.z > pad.z && P.z < pad.z + pad.d && P.y < pad.y + 2;
  if (NET.on) NET.onPad = onPad; // co-op: everyone has to stand on the pad
  else if (onPad) win();
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
  const bob = Math.sin(e.bob) * (e.fly ? 0.15 : 0.05);
  const winding = e.windup > 0;
  const wk = winding ? 1 - e.windup / (e.windMax || 1) : 0;         // 0 → 1 as the attack charges
  const pulse = winding ? 0.5 + 0.5 * Math.sin(G.time * 30) : 0;
  const base = e.kind === "shoot" ? [0.55, 0.25, 1.0] : e.kind === "tank" ? [1.0, 0.55, 0.1] : e.kind === "drone" ? [0.1, 0.85, 0.75] : [0.95, 0.18, 0.28];
  const body = flash ? [1, 1, 1] : winding ? [base[0] + (1 - base[0]) * pulse * 0.6, base[1] * (1 - pulse * 0.4), base[2] * (1 - pulse * 0.4)] : base;
  const emit = flash ? 1 : winding ? 0.25 + 0.5 * wk : 0.08;
  const fx = Math.sin(e.yaw), fz = -Math.cos(e.yaw);
  const eyeCol = winding ? [1, 0.15, 0.1] : [0.2, 1, 1];
  if (e.kind === "tank") {
    drawCube(e.x - 0.5, e.y + bob, e.z - 0.5, 1.0, 1.0, 1.0, body, emit, vp);
    drawCube(e.x - 0.36, e.y + 1.0 + bob, e.z - 0.36, 0.72, 0.6, 0.72, [0.15, 0.13, 0.12], 0, vp);
    drawCube(e.x + fx * 0.36 - 0.2, e.y + 1.18 + bob, e.z + fz * 0.36 - 0.2, 0.4, 0.16, 0.4, eyeCol, 1, vp);
    drawCube(e.x - 0.45, e.y - 0.0, e.z - 0.2, 0.25, 0.3, 0.4, [0.1, 0.1, 0.12], 0, vp);
    drawCube(e.x + 0.2, e.y - 0.0, e.z - 0.2, 0.25, 0.3, 0.4, [0.1, 0.1, 0.12], 0, vp);
  } else if (e.kind === "drone") {
    drawCube(e.x - 0.3, e.y + bob, e.z - 0.3, 0.6, 0.4, 0.6, body, emit, vp);
    const spin = G.time * 25;
    for (let i = 0; i < 4; i++) {
      const a = spin + i * Math.PI / 2;
      drawCube(e.x + Math.cos(a) * 0.42 - 0.07, e.y + 0.42 + bob, e.z + Math.sin(a) * 0.42 - 0.07, 0.14, 0.04, 0.14, [0.9, 0.9, 0.95], 0.2, vp);
    }
    drawCube(e.x + fx * 0.3 - 0.08, e.y + 0.14 + bob, e.z + fz * 0.3 - 0.08, 0.16, 0.14, 0.16, eyeCol, 0.9, vp);
  } else {
    drawCube(e.x - 0.28, e.y + bob, e.z - 0.28, 0.56, 0.72, 0.56, body, emit, vp);
    drawCube(e.x - 0.22, e.y + 0.72 + bob, e.z - 0.22, 0.44, 0.38, 0.44, [0.12, 0.12, 0.18], 0, vp);
    drawCube(e.x + fx * 0.18 - 0.06, e.y + 0.88 + bob, e.z + fz * 0.18 - 0.06, 0.12, 0.12, 0.12, eyeCol, 0.9, vp);
    drawCube(e.x - 0.22, e.y + bob, e.z - 0.08, 0.16, 0.28, 0.16, [0.1, 0.1, 0.14], 0, vp);
    drawCube(e.x + 0.06, e.y + bob, e.z - 0.08, 0.16, 0.28, 0.16, [0.1, 0.1, 0.14], 0, vp);
  }
  // telegraph: a charging orb grows where the shot will come from
  if (winding && e.wkind === "shot") {
    const oy = e.y + (e.kind === "tank" ? 1.1 : e.fly ? 0.2 : 0.55) + bob, k = 0.08 + 0.26 * wk;
    const ox = e.x + fx * (e.kind === "tank" ? 0.7 : 0.45), oz = e.z + fz * (e.kind === "tank" ? 0.7 : 0.45);
    drawCube(ox - k / 2, oy - k / 2, oz - k / 2, k, k, k, [1, 0.35 + 0.4 * pulse, 0.1], 1, vp);
  } else if (winding) { // melee: claws flare
    drawCube(e.x + fx * 0.38 - 0.2, e.y + 0.45, e.z + fz * 0.38 - 0.2, 0.4, 0.12, 0.4, [1, 0.2 + pulse * 0.6, 0.1], 1, vp);
  }
  // "!" when a bot first spots you
  if (e.alertT > 0) {
    const hy = e.y + (e.kind === "tank" ? 2.0 : e.fly ? 0.9 : 1.45) + 0.1 * Math.sin(G.time * 12);
    drawCube(e.x - 0.06, hy + 0.18, e.z - 0.06, 0.12, 0.32, 0.12, [1, 0.9, 0.2], 1, vp);
    drawCube(e.x - 0.06, hy, e.z - 0.06, 0.12, 0.12, 0.12, [1, 0.9, 0.2], 1, vp);
  }
  // health pips over damaged multi-hit bots
  if (e.maxHp > 2 && e.hp < e.maxHp) {
    const hy = e.y + (e.kind === "tank" ? 1.85 : 1.25) + bob, w = 0.7, f = e.hp / e.maxHp;
    drawCube(e.x - w / 2, hy, e.z - 0.03, w, 0.06, 0.06, [0.15, 0.15, 0.15], 0, vp);
    drawCube(e.x - w / 2, hy + 0.01, e.z - 0.04, w * f, 0.06, 0.08, [1, 0.25, 0.3], 0.8, vp);
  }
}

function drawPickup(p, vp) {
  const y = p.y + Math.sin(p.t * 3) * 0.12, s = p.small ? 0.28 : 0.36, h = s / 2;
  if (p.kind === "health") {
    drawCube(p.x - h, y, p.z - h, s, s, s, [0.95, 0.98, 0.95], 0.4, vp);
    drawCube(p.x - h * 0.3, y - 0.02, p.z - h - 0.02, s * 0.3, s + 0.04, s + 0.04, [0.2, 1, 0.3], 0.8, vp);
    drawCube(p.x - h - 0.02, y + h * 0.7, p.z - h - 0.02, s + 0.04, s * 0.3, s + 0.04, [0.2, 1, 0.3], 0.8, vp);
  } else if (p.kind === "heart") {
    const k = 0.4 + 0.06 * Math.sin(p.t * 6);
    drawCube(p.x - k / 2, y, p.z - k / 2, k, k, k, [1, 0.15, 0.35], 0.9, vp);
  } else if (p.kind === "scatter") {
    drawCube(p.x - 0.35, y, p.z - 0.1, 0.7, 0.18, 0.2, [1, 0.5, 0.1], 0.6, vp);
    drawCube(p.x - 0.35, y - 0.18, p.z - 0.08, 0.16, 0.2, 0.16, [0.2, 0.2, 0.25], 0, vp);
  } else {
    const col = p.kind === "ammo" ? [1, 0.82, 0.2] : [0.95, 0.25, 0.9];
    drawCube(p.x - h, y, p.z - h, s, s, s, col, 0.45, vp);
  }
}

function drawCheckpoints(vp) {
  for (const r of rooms) {
    if (!r.cp) continue;
    const c = r.cp, on = c.active, glow = on ? 0.8 : 0.15 + 0.1 * Math.sin(G.time * 3);
    const col = on ? [0.3, 1, 0.4] : [0.5, 0.6, 0.7];
    for (const sx of [-2.2, 1.9]) {
      drawCube(c.x + sx, c.y, c.z - 0.15, 0.3, 1.8, 0.3, [0.25, 0.27, 0.32], 0, vp);
      drawCube(c.x + sx - 0.05, c.y + 1.8, c.z - 0.2, 0.4, 0.4, 0.4, col, glow, vp);
    }
  }
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
  if (NET.on) netMinimap(ctx, px);
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
  G.dmgDirT = Math.max(0, G.dmgDirT - dt);
  const dd = document.getElementById("dmg-dir");
  if (G.dmgDirT > 0 && G.mode === "play") {
    dd.style.opacity = Math.min(1, G.dmgDirT * 1.6).toFixed(2);
    dd.style.transform = "rotate(" + (G.dmgDir - P.yaw).toFixed(3) + "rad)";
  } else if (dd.style.opacity !== "0") dd.style.opacity = "0";

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
    if (G.bot) botThink(dt);
    if (NET.down) netDownTick(dt); else updatePlayer(dt);
    updateCheckpoints();
    // health regen after a short break from taking damage
    if (G.regenT > 0) G.regenT -= dt;
    else if (G.hp < MAX_HP && !NET.down) { G.hp = Math.min(MAX_HP, G.hp + DIFFS[G.diff].regenRate * dt); updateHpBar(); }
    // never soft-lock on ammo: a trickle of emergency rounds when completely dry
    if (G.ammo === 0 && G.reserve === 0 && G.reload <= 0 && G.weapon === 0) {
      G.emergencyT += dt;
      if (G.emergencyT > 2) { G.emergencyT = 0; G.reserve += 6; toast("EMERGENCY AMMO +6", "#ffd23f"); tryReload(); updateHUD(); }
    } else G.emergencyT = 0;
    updateEnemies(dt);
    updateBolts(dt);
    updatePickups(dt);
    G.shotCd = Math.max(0, G.shotCd - dt);
    if (shooting && G.shotCd <= 0) shoot();
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
  if (NET.on) netDraw(vp);
  drawCheckpoints(vp);
  for (const b of bolts) drawCube(b.x - 0.13, b.y - 0.13, b.z - 0.13, 0.26, 0.26, 0.26, [1,0.35,0.15], 1, vp);
  for (const p of pickups) if (p.alive && !(p.pending && performance.now() - p.pending < 1500)) drawPickup(p, vp);
  for (const p of parts) {
    const k = Math.max(0.04, p.s * (p.life * 2));
    drawCube(p.x, p.y, p.z, k, k, k, p.col, 0.4, vp);
  }

  // extract beacon
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 3);
  drawCube(extract.x + 1.5, extract.y + 0.4 + pulse, extract.z + 1.5, 0.9, 0.9, 0.9, [1, 0.9, 0.2], 0.8, vp);

  if (G.mode === "play") {
    gl.clear(gl.DEPTH_BUFFER_BIT);
    if (!NET.down) drawGun(proj);
    drawMinimap();
  }
  if (NET.on) netFrame(dt, vp);
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", e => {
  keys[e.code] = true;
  keys[e.key] = true;
  if (e.code === "KeyR") tryReload();
  if (e.code === "KeyQ") switchWeapon();
  if (e.code === "Digit1") switchWeapon(0);
  if (e.code === "Digit2") switchWeapon(1);
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
    if (G.shotCd <= 0) shoot();
  }, () => { shooting = false; });
  holdBtn(btnJump, () => { touch.jump = true; touch.jumpQueued = true; }, () => { touch.jump = false; });
  holdBtn(btnReload, () => { if (G.mode === "play") tryReload(); }, null);
  const btnSwap = document.getElementById("btn-swap");
  if (btnSwap) holdBtn(btnSwap, () => switchWeapon(), null);

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

function refreshTitle() {
  document.querySelectorAll("#diff-row button").forEach(b => b.classList.toggle("on", +b.dataset.d === G.diff));
  document.getElementById("diff-desc").textContent = DIFFS[G.diff].desc;
  const parts = DIFFS.map(d => STORE.best[d.name] ? d.name + " " + STORE.best[d.name] : "").filter(Boolean);
  document.getElementById("title-best").textContent = parts.length ? "BEST · " + parts.join(" · ") : "";
}
document.querySelectorAll("#diff-row button").forEach(b => b.addEventListener("click", e => {
  e.preventDefault(); G.diff = +b.dataset.d; STORE.diff = G.diff; saveStore(STORE); refreshTitle();
}));
refreshTitle();
document.getElementById("play-btn").addEventListener("click", startRun);
document.getElementById("retry-btn").addEventListener("click", startRun);
document.getElementById("again-btn").addEventListener("click", startRun);
document.getElementById("dead-menu-btn").addEventListener("click", () => { G.mode = "title"; showOverlay("title"); refreshTitle(); });
document.getElementById("win-menu-btn").addEventListener("click", () => { if (NET.on) { netLobby(); return; } G.mode = "title"; showOverlay("title"); refreshTitle(); });


// =====================================================================
// ONLINE CO-OP (2 players, up to 3). Only active with ?mp=host|join&code=... from the Grok Arcade
// lobby. Everyone runs the same seeded course. Each player moves, aims and shoots locally and streams
// that ~20x a second; the host runs the bots, damage, pickups and room progress. At 0 HP you go DOWN
// and a partner holds REVIVE next to you for 2 s. If the whole team is down, everyone restarts at the
// last checkpoint. No game over in co-op. Without mp params nothing here runs.
// =====================================================================
const NET_SEND = 1 / 20, NET_WORLD = 1 / 15, NET_INTERP = 110, REVIVE_TIME = 2, REVIVE_RANGE = 2.3, DOWN_AUTO = 30;
let room = null, netBadge = null;
const $id = (id) => document.getElementById(id);
function nr2(v) { return Math.round(v * 100) / 100; }
function netEsc(s) { return window.GrokNet ? window.GrokNet.esc(s) : String(s); }
function hexRgb(c) { const n = parseInt(String(c || "#3ff0ff").slice(1), 16) || 0x3ff0ff; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
function netSend(d) { if (!room || NET.host) return; d.g = NET.gen; room.send(d); }
function netBroadcast(d) { if (!room || !NET.host) return; d.g = NET.gen; room.broadcast(d); }
function netEvent(d) { if (!room) return; d.g = NET.gen; room.broadcast(d); }
function netInfo(pid) { const l = room ? room.players() : []; for (const p of l) if (p.pid === pid) return p; return { pid, name: "Partner", color: "#3ff0ff" }; }
function netName(pid) { return pid === NET.pid ? "YOU" : netInfo(pid).name; }
function netHostName() { const l = room ? room.players() : []; for (const p of l) if (p.host) return p.name; return "the host"; }
let noticeT = null;
function netNotice(html, secs) {
  const el = $id("mp-notice");
  el.innerHTML = html; el.classList.add("show");
  clearTimeout(noticeT);
  noticeT = setTimeout(() => el.classList.remove("show"), (secs || 4) * 1000);
}

// ---------- partners ----------
function netRemote(pid) {
  let R = NET.remotes.get(pid);
  if (R) return R;
  const info = netInfo(pid);
  R = { pid, name: info.name, color: info.color, rgb: hexRgb(info.color), snaps: [], last: null, x: 0, y: -99, z: 0, yaw: 0, tr: 0 };
  R.tag = document.createElement("div"); R.tag.className = "mp-tag hidden";
  R.tag.innerHTML = "<b></b><i><u></u></i><em></em>";
  R.tag.style.setProperty("--c", R.color);
  R.tag.firstChild.textContent = R.name;
  $id("mp-tags").appendChild(R.tag);
  R.row = document.createElement("div"); R.row.className = "mp-row";
  R.row.style.setProperty("--c", R.color);
  R.row.innerHTML = "<b></b><i><u></u></i><em>DOWN</em>";
  R.row.firstChild.textContent = R.name;
  $id("mp-party").appendChild(R.row);
  NET.remotes.set(pid, R);
  return R;
}
function netDropRemote(pid) {
  const R = NET.remotes.get(pid);
  if (!R) return;
  R.tag.remove(); R.row.remove();
  NET.remotes.delete(pid);
}
function netLive(R) { return !!R.last && R.last.g === NET.gen && G.mode !== "title"; }
function netOnPlayer(d, from) {
  if (from === NET.pid) return;
  const R = netRemote(from);
  if (!R.last || R.last.g !== d.g) R.snaps.length = 0;
  R.last = d;
  R.snaps.push({ t: performance.now(), x: d.x, y: d.y, z: d.z, yw: d.yw });
  if (R.snaps.length > 30) R.snaps.shift();
}
function netSample(snaps, t) {
  const n = snaps.length;
  if (!n) return null;
  if (t >= snaps[n - 1].t) return snaps[n - 1];
  let i = n - 1;
  while (i > 0 && snaps[i - 1].t > t) i--;
  if (i === 0) return snaps[0];
  const a = snaps[i - 1], b = snaps[i], k = clamp((t - a.t) / Math.max(1, b.t - a.t), 0, 1);
  if (Math.abs(a.x - b.x) + Math.abs(a.z - b.z) > 5) return k < 0.5 ? a : b;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yw: a.yw + angWrap(b.yw - a.yw) * k };
}
// host: which player should this bot go after? (nearest one who is still up)
function netTarget(e) {
  let best = null, bd = Infinity;
  if (!NET.down) { best = P; bd = Math.hypot(P.x - e.x, P.z - e.z); }
  for (const R of NET.remotes.values()) {
    const L = R.last;
    if (!netLive(R) || L.dn) continue;
    const d = Math.hypot(L.x - e.x, L.z - e.z);
    if (d < bd) { bd = d; best = { x: L.x, y: L.y, z: L.z, pid: R.pid }; }
  }
  return best || { x: e.x + 999, y: e.y, z: e.z + 999, pid: null };
}
function netHit(T, dmg, e) { if (T.pid) netBroadcast({ t: "hit", to: T.pid, d: dmg, sx: nr2(e.x), sz: nr2(e.z) }); }
function netAnyRemote(fn) {
  for (const R of NET.remotes.values()) if (netLive(R) && !R.last.dn && fn(R.last.x, R.last.z)) return true;
  return false;
}
function netRespawnNearPartner() {
  for (const R of NET.remotes.values()) {
    const L = R.last;
    if (!netLive(R) || L.dn || L.y < 0) continue;
    for (const o of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8], [0, 0]]) {
      if (!aabbSolid(L.x + o[0], L.y + 0.05, L.z + o[1], 0.32, 1.7)) {
        P.x = L.x + o[0]; P.y = L.y + 0.05; P.z = L.z + o[1]; P.vx = P.vy = P.vz = 0; bolts = [];
        return true;
      }
    }
  }
  return false;
}

// ---------- shooting / bolts / drops ----------
function netShot(o) {
  const h = NET.lastHit || [o.x, o.y, o.z];
  netEvent({ t: "s", o: [nr2(o.x), nr2(o.y - 0.25), nr2(o.z)], h: [nr2(h[0]), nr2(h[1]), nr2(h[2])] });
}
function netBolt(b) {
  netBroadcast({ t: "bolt", b: [nr2(b.x), nr2(b.y), nr2(b.z), nr2(b.vx), nr2(b.vy), nr2(b.vz), b.dmg, nr2(b.src ? b.src.x : b.x), nr2(b.src ? b.src.z : b.z)] });
}
function netDrop(p) { // host: a bot dropped something
  p.id = NET.pickSeq++;
  pickups.push(p);
  if (NET.on) netBroadcast({ t: "drop", p: { id: p.id, x: nr2(p.x), y: nr2(p.y), z: nr2(p.z), kind: p.kind, small: !!p.small } });
}
function netClaimPickup(p) {
  if (NET.host) { netBroadcast({ t: "took", id: p.id, by: NET.pid }); return true; }
  if (p.pending && performance.now() - p.pending < 1500) return false;
  p.pending = performance.now();
  netSend({ t: "take", id: p.id });
  return false;
}
function netPickup(id) { for (const p of pickups) if (p.id === id) return p; return null; }

// ---------- downed / revive ----------
function netDown() {
  if (NET.down) return;
  NET.down = true; NET.downT = 0; NET.downs++;
  G.hp = 0; shooting = false; G.reload = 0; G.regenT = 0;
  P.eye = 0.55;
  toast("YOU'RE DOWN! A PARTNER CAN REVIVE YOU", "#ff3d6e");
  sfx("die");
  updateHUD();
  netSendState();
}
function netSpread() { // co-op: don't stack everyone on the exact same spawn voxel
  const raw = room && room.isHost ? 0 : room && room.slot != null ? room.slot : NET.prm && NET.prm.slot;
  const slot = Math.max(0, Math.min(2, parseInt(raw, 10) || 0));
  const o = [[-0.9, 0], [0.9, 0], [0, 1.1]][slot];
  const c = Math.cos(P.yaw), sn = Math.sin(P.yaw);
  const nx = P.x + o[0] * c - o[1] * sn, nz = P.z + o[0] * sn + o[1] * c;
  if (!aabbSolid(nx, P.y + 0.05, nz, 0.32, 1.7)) { P.x = nx; P.z = nz; }
}
function netDownTick(dt) {
  P.vx = 0; P.vz = 0;
  moveCollide(P, dt, 0.32, 1.7, 24);
  if (P.y < -4) respawnAtCheckpoint();
  NET.downT += NET.rdt || dt; // real seconds, even if the frame rate dips
  if (NET.downT > DOWN_AUTO) { // nobody came: back to the checkpoint on your own
    netStandUp(MAX_HP);
    respawnAtCheckpoint();
    toast("BACK AT THE CHECKPOINT", "#7dff5a");
  }
}
function netStandUp(hp) {
  NET.down = false; G.hp = hp; G.invuln = 1.6; G.regenT = 0; P.eye = 1.55;
  updateHUD(); hpShown = -1; updateHpBar();
}
function netWipe() {
  netStandUp(MAX_HP);
  G.invuln = 2.2;
  if (G.ammo + G.reserve < MAG) G.reserve = MAG - G.ammo;
  respawnAtCheckpoint();
  toast("TEAM WIPED · BACK TO CHECKPOINT", "#ff6b8a");
}
function netCheckWipe() { // host
  if (G.mode !== "play" || !NET.down) return;
  for (const R of NET.remotes.values()) if (netLive(R) && !R.last.dn) return;
  netBroadcast({ t: "wipe" });
  netWipe();
}
function netCheckWin() { // host
  if (G.mode !== "play" || !NET.onPad || NET.down) return;
  for (const R of NET.remotes.values()) if (netLive(R) && (!R.last.pad || R.last.dn)) return;
  const stats = {};
  stats[NET.pid] = [NET.prm.name, NET.prm.color, G.score, G.kills, NET.downs];
  for (const R of NET.remotes.values()) if (netLive(R)) stats[R.pid] = [R.name, R.color, R.last.sc | 0, R.last.k | 0, R.last.ds | 0];
  netBroadcast({ t: "win", stats });
  NET.winStats = stats;
  win();
}

// ---------- per-frame ----------
function netFrame(dt, vp) {
  const now = performance.now();
  const rdt = Math.min(0.25, (now - (NET.lastNow || now)) / 1000); NET.lastNow = now; NET.rdt = rdt; // revive timing uses real time
  const playing = G.mode === "play";
  // partners: interpolate, tags, party panel
  for (const R of NET.remotes.values()) {
    const L = R.last, live = netLive(R) && playing;
    if (live) {
      const s = netSample(R.snaps, now - NET_INTERP);
      if (s) { R.x = s.x; R.y = s.y; R.z = s.z; R.yaw = s.yw; }
    }
    netTag(R, live, vp);
    R.row.classList.toggle("down", !!(live && L.dn));
    R.row.classList.toggle("off", !live);
    const hp = live ? Math.max(0, L.hp) : 0;
    R.row.children[1].firstChild.style.width = hp + "%";
    R.row.children[1].firstChild.className = hp < 30 ? "crit" : hp < 60 ? "mid" : "";
  }
  if (!NET.sideT || now - NET.sideT > 500) { // keep the party panel just under the HUD (it wraps to 2 rows in portrait)
    NET.sideT = now;
    const hb = $id("hud-top").getBoundingClientRect();
    if (hb.height > 0) $id("mp-side").style.top = Math.round(hb.bottom + 10) + "px";
  }
  for (let i = NET.tracers.length - 1; i >= 0; i--) { NET.tracers[i].t -= dt; if (NET.tracers[i].t <= 0) NET.tracers.splice(i, 1); }
  // revive: am I next to a downed partner?
  let near = null, nd = REVIVE_RANGE;
  if (playing && !NET.down && !NET.menu) {
    for (const R of NET.remotes.values()) {
      if (!netLive(R) || !R.last.dn) continue;
      const d = Math.hypot(R.last.x - P.x, R.last.z - P.z);
      if (d < nd && Math.abs(R.last.y - P.y) < 2) { nd = d; near = R; }
    }
  }
  const held = !!(keys["KeyE"] || NET.reviveHeld);
  if (near && held) {
    if (NET.revTo !== near.pid) { NET.revTo = near.pid; NET.revT = 0; }
    NET.revT += rdt;
    if (NET.revT >= REVIVE_TIME) {
      netEvent({ t: "rev", to: near.pid });
      toast("REVIVED " + near.name.toUpperCase() + "!", "#7dff5a");
      sfx("win");
      NET.revT = 0; NET.revTo = null;
      near.last.dn = 0; // optimistic until their next update
    }
  } else { NET.revT = Math.max(0, NET.revT - rdt * 3); if (NET.revT === 0) NET.revTo = null; }
  $id("btn-revive").classList.toggle("hidden", !near);
  // status line (revive prompt, being revived, waiting at the pad)
  let msg = "", pct = -1;
  if (playing && NET.down) {
    let by = null;
    for (const R of NET.remotes.values()) if (netLive(R) && R.last.rv === NET.pid && R.last.rp > 0) by = R;
    if (by) { msg = by.name.toUpperCase() + " IS REVIVING YOU"; pct = by.last.rp; }
    else msg = (NET.remotes.size && Array.from(NET.remotes.values()).some((R) => netLive(R) && !R.last.dn)
      ? "DOWN! WAIT FOR A PARTNER TO REVIVE YOU" : "DOWN!") + " · AUTO-RESPAWN " + Math.max(0, Math.ceil(DOWN_AUTO - NET.downT)) + "s";
  } else if (near) {
    msg = (touch.on ? "HOLD REVIVE" : "HOLD E") + " TO REVIVE " + near.name.toUpperCase();
    if (NET.revT > 0) pct = Math.round(NET.revT / REVIVE_TIME * 100);
  } else if (playing && NET.onPad && room && room.count() > 1) {
    const wait = Array.from(NET.remotes.values()).filter((R) => netLive(R) && (!R.last.pad || R.last.dn)).map((R) => R.name.toUpperCase());
    if (wait.length) msg = "ON THE PAD · WAITING FOR " + wait.join(" & ");
  }
  const st = $id("mp-status");
  if (st.dataset.m !== msg) { st.dataset.m = msg; st.firstChild.textContent = msg; }
  st.classList.toggle("show", !!msg);
  st.lastChild.style.display = pct >= 0 ? "" : "none";
  if (pct >= 0) st.lastChild.firstChild.style.width = Math.min(100, pct) + "%";
  // host referee checks
  if (NET.host && playing) { netCheckWipe(); netCheckWin(); }
  // network sends
  NET.sendT += dt; NET.worldT += dt;
  if (NET.sendT >= NET_SEND) { NET.sendT = Math.min(NET.sendT - NET_SEND, NET_SEND); netSendState(); }
  if (NET.host && NET.worldT >= NET_WORLD) { NET.worldT = Math.min(NET.worldT - NET_WORLD, NET_WORLD); netSendWorld(); }
}
function netProject(vp, x, y, z) {
  const m = vp;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 0.05) return null;
  return [(cx / cw * 0.5 + 0.5) * innerWidth, (0.5 - cy / cw * 0.5) * innerHeight];
}
function netTag(R, live, vp) {
  const el = R.tag;
  if (!live || !vp) { el.classList.add("hidden"); return; }
  const L = R.last, dist = Math.hypot(R.x - P.x, R.z - P.z);
  const sp = netProject(vp, R.x, R.y + (L.dn ? 1.1 : 2.1), R.z);
  if (!sp || dist > 45 || sp[0] < -60 || sp[0] > innerWidth + 60 || sp[1] < -40 || sp[1] > innerHeight + 40) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  el.style.transform = "translate(" + Math.round(sp[0]) + "px," + Math.round(sp[1]) + "px)";
  el.classList.toggle("down", !!L.dn);
  el.children[1].firstChild.style.width = Math.max(0, L.hp) + "%";
  const sub = L.dn ? (dist < REVIVE_RANGE ? "HOLD REVIVE!" : "DOWN · GO REVIVE") : "";
  if (el.lastChild.textContent !== sub) el.lastChild.textContent = sub;
}
function netDraw(vp) {
  for (const R of NET.remotes.values()) {
    if (!netLive(R) || G.mode !== "play") continue;
    const L = R.last, c = R.rgb, x = R.x, y = R.y, z = R.z;
    const fx = Math.sin(R.yaw), fz = -Math.cos(R.yaw);
    const dark = [c[0] * 0.45, c[1] * 0.45, c[2] * 0.45];
    if (L.dn) { // lying on the floor with a pulsing beacon so you can find them
      drawCube(x - 0.45, y, z - 0.45, 0.9, 0.32, 0.9, c, 0.25, vp);
      drawCube(x - 0.2, y + 0.32, z - 0.2, 0.4, 0.28, 0.4, [0.95, 0.85, 0.75], 0.1, vp);
      const k = 0.5 + 0.5 * Math.sin(G.time * 6);
      drawCube(x - 0.06, y + 1.3 + k * 0.2, z - 0.22, 0.12, 0.44, 0.12, [1, 0.25, 0.3], 1, vp);
      drawCube(x - 0.22, y + 1.46 + k * 0.2, z - 0.06, 0.44, 0.12, 0.12, [1, 0.25, 0.3], 1, vp);
      continue;
    }
    const walk = Math.hypot(L.vx || 0, L.vz || 0) > 0.5 ? Math.sin(G.time * 12) * 0.12 : 0;
    drawCube(x - 0.24, y, z - 0.1 + walk, 0.2, 0.7, 0.2, dark, 0, vp);
    drawCube(x + 0.04, y, z - 0.1 - walk, 0.2, 0.7, 0.2, dark, 0, vp);
    drawCube(x - 0.3, y + 0.7, z - 0.2, 0.6, 0.62, 0.4, c, 0.18, vp);
    drawCube(x - 0.21, y + 1.32, z - 0.21, 0.42, 0.4, 0.42, [0.95, 0.85, 0.75], 0.05, vp);
    drawCube(x + fx * 0.2 - 0.17, y + 1.44, z + fz * 0.2 - 0.17, 0.34, 0.12, 0.34, c, 0.6, vp); // visor
    drawCube(x + fx * 0.42 - 0.07, y + 1.0, z + fz * 0.42 - 0.07, 0.14, 0.14, 0.14, [0.2, 0.22, 0.28], 0, vp); // gun
    drawCube(x + fx * 0.62 - 0.05, y + 1.02, z + fz * 0.62 - 0.05, 0.1, 0.1, 0.1, [0.25, 0.27, 0.33], 0, vp);
  }
  for (const t of NET.tracers) {
    const n = 7;
    for (let i = 1; i <= n; i++) {
      const k = i / (n + 1);
      drawCube(t.o[0] + (t.h[0] - t.o[0]) * k - 0.04, t.o[1] + (t.h[1] - t.o[1]) * k - 0.04, t.o[2] + (t.h[2] - t.o[2]) * k - 0.04, 0.08, 0.08, 0.08, t.c, 1, vp);
    }
  }
}
function netMinimap(ctx, px) {
  for (const R of NET.remotes.values()) {
    if (!netLive(R)) continue;
    const q = px(R.x, R.z);
    ctx.fillStyle = R.color;
    ctx.fillRect(q[0] - 3, q[1] - 3, 6, 6);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(q[0] - 3.5, q[1] - 3.5, 7, 7);
  }
}
function netSendState() {
  if (!room || G.mode === "title") return;
  room.broadcast({ t: "p", g: NET.gen, x: nr2(P.x), y: nr2(P.y), z: nr2(P.z), yw: nr2(P.yaw), vx: nr2(P.vx), vz: nr2(P.vz),
    hp: Math.round(G.hp), dn: NET.down ? 1 : 0, pad: NET.onPad ? 1 : 0, sc: G.score, k: G.kills, ds: NET.downs,
    rv: NET.revT > 0 ? NET.revTo : 0, rp: Math.round(NET.revT / REVIVE_TIME * 100) });
}
function netSendWorld() {
  if (!room || G.mode !== "play" || room.count() < 2) return;
  const e = [];
  for (const en of enemies) {
    if (en.hp <= 0) continue;
    const wk = en.windup > 0 ? (en.wkind === "melee" ? 2 : 1) : 0;
    e.push([en.id, nr2(en.x), nr2(en.y), nr2(en.z), nr2(en.yaw), en.hp, wk, wk ? Math.round(clamp(en.windup / (en.windMax || 1), 0, 1) * 100) : 0, en.alertT > 0 ? 1 : 0, en.hit > 0 ? 1 : 0]);
  }
  room.broadcast({ t: "w", g: NET.gen, e });
}
function netOnWorld(d) {
  const now = performance.now(), seen = new Set();
  for (const s of d.e) {
    const e = NET.enemyMap.get(s[0]);
    if (!e) continue;
    seen.add(e);
    if (e.hp <= 0) { if (now - (e.predT || 0) < 600) continue; e.hp = s[5]; if (enemies.indexOf(e) < 0) enemies.push(e); } // host says it's still alive
    if (!e.snaps) e.snaps = [];
    e.snaps.push({ t: now, x: s[1], y: s[2], z: s[3], yw: s[4] });
    if (e.snaps.length > 20) e.snaps.shift();
    e.hp = now - (e.predT || 0) < 400 ? Math.min(e.hp, s[5]) : s[5];
    e.wkind = s[6] === 2 ? "melee" : s[6] === 1 ? "shot" : null;
    e.windMax = 1; e.windup = s[6] ? Math.max(0.001, s[7] / 100) : 0;
    e.alertT = s[8] ? 0.4 : 0;
    if (s[9]) e.hit = Math.max(e.hit, 0.06);
    e.miss = 0;
  }
  for (const e of enemies) if (e.hp > 0 && !seen.has(e) && ++e.miss >= 3) e.hp = 0;
}
function netPuppetEnemies(dt) {
  const rt = performance.now() - NET_INTERP;
  for (const e of enemies) {
    e.bob += dt * 6;
    e.hit = Math.max(0, e.hit - dt);
    if (e.hp <= 0 || !e.snaps) continue;
    const s = netSample(e.snaps, rt);
    if (s) { e.x = s.x; e.y = s.y; e.z = s.z; e.yaw = s.yw; }
  }
  enemies = enemies.filter((e) => e.hp > 0 || e.hit > 0);
}

// ---------- run flow ----------
function netSetCount(n) {
  NET.n = n;
  NET.enemyMul = n >= 3 ? 1.6 : n === 2 ? 1.35 : 1;
  NET.tankHp = n >= 3 ? 3 : n === 2 ? 2 : 0;
}
function netAnnounceRun(seed) { // host
  NET.gen++;
  netSetCount(room ? room.count() : 1);
  NET.seed = seed >>> 0;
  room.setMeta({ game: "voxels", playing: true, gen: NET.gen, seed: NET.seed, diff: G.diff, n: NET.n });
  netBroadcast({ t: "start", seed: NET.seed, diff: G.diff, n: NET.n });
}
function netStartFromHost(d, gen) { // joiner
  if (gen === NET.gen && G.mode === "play") return;
  NET.gen = gen;
  netSetCount(d.n);
  netHideCard();
  NET.applying = true;
  try { startRun(d.diff, d.seed); } finally { NET.applying = false; }
}
function netRunStarted() {
  NET.down = false; NET.downs = 0; NET.downT = 0; NET.revT = 0; NET.revTo = null; NET.onPad = false; NET.winStats = null;
  NET.pickSeq = 10000; NET.tracers = [];
  P.eye = 1.55;
  G.lives = MAX_LIVES;
  NET.enemyMap = new Map(); for (const e of enemies) NET.enemyMap.set(e.id, e);
  for (const R of NET.remotes.values()) { R.snaps.length = 0; R.last = null; }
  netHideCard();
  updateHUD();
  document.body.classList.add("mp-run");
  if (NET.n > 1) setTimeout(() => { if (G.mode === "play") toast("CO-OP · MORE BOTS · REVIVE EACH OTHER", "#1ce0ff"); }, 2100);
}
function netSyncFor(pid) { // host -> late joiner
  const dead = [], took = [], drops = [];
  NET.enemyMap.forEach((e, id) => { if (e.hp <= 0) dead.push(id); });
  for (const p of pickups) { if (!p.alive && p.id < 10000) took.push(p.id); if (p.alive && p.id >= 10000) drops.push({ id: p.id, x: nr2(p.x), y: nr2(p.y), z: nr2(p.z), kind: p.kind, small: !!p.small }); }
  const cps = rooms.filter((r) => r.cp && r.cp.active).map((r) => rooms.indexOf(r));
  room.sendTo(pid, { t: "sync", g: NET.gen, dead, took, drops, cps });
}
function netWinCard() {
  const st = NET.winStats;
  if (st) {
    const lines = [];
    for (const pid in st) { const s = st[pid]; lines.push(s[0].toUpperCase() + (pid === NET.pid ? " (YOU)" : "") + " · SCORE " + s[2] + " · KILLS " + s[3] + " · DOWNS " + s[4]); }
    const secs = Math.round(G.time - G.runStart);
    $id("win-stats").textContent = lines.join("\n") + "\nROOMS " + Math.max(0, G.maxRoom) + "/" + Math.max(1, rooms.length - 2) + "  ·  " + Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0") + "  ·  " + DIFFS[G.diff].name;
  }
  document.querySelector("#win-card .result").textContent = "The whole team made it to the pad!";
  $id("again-btn").classList.toggle("hidden", !NET.host);
  $id("again-btn").textContent = "PLAY AGAIN · NEW COURSE";
  $id("win-menu-btn").textContent = NET.host ? "BACK TO LOBBY" : "LEAVE GAME";
  let note = $id("mp-win-note");
  if (!note) { note = document.createElement("p"); note.id = "mp-win-note"; note.className = "mp-note"; $id("win-stats").after(note); }
  note.classList.toggle("hidden", NET.host);
  note.innerHTML = "Waiting for <b>" + netEsc(netHostName()) + "</b> to start the next run&hellip;";
}
function netShowCard(title, msg, buttons) {
  $id("overlay").classList.add("show");
  for (const id of ["title-card", "dead-card", "win-card"]) $id(id).classList.add("hidden");
  $id("mp-card").classList.remove("hidden");
  $id("mp-kicker").textContent = "CO-OP · ROOM " + NET.code;
  $id("mp-title").textContent = title;
  $id("mp-msg").innerHTML = msg;
  netRoster();
  const bw = $id("mp-btns"); bw.innerHTML = "";
  buttons.forEach((b, i) => {
    const el = document.createElement("button");
    el.className = "btn " + (i ? "ghost" : "primary"); el.textContent = b[0]; el.type = "button";
    el.addEventListener("click", (e) => { e.preventDefault(); b[1](); });
    bw.appendChild(el);
  });
}
function netHideCard() {
  $id("mp-card").classList.add("hidden");
  if (NET.menu) { NET.menu = false; }
  if (G.mode === "play") $id("overlay").classList.remove("show");
}
function netRoster() {
  const el = $id("mp-roster");
  if (!room) return;
  el.innerHTML = room.players().map((p) => "<span class='mp-pl' style='--c:" + netEsc(p.color) + "'>" + netEsc(p.name) + (p.pid === NET.pid ? " <small>YOU</small>" : "") + (p.host ? " <small>HOST</small>" : "") + "</span>").join("");
}
function netWaitCard() {
  G.mode = "title";
  showOverlay("title");
  $id("title-card").classList.add("hidden");
  document.body.classList.remove("mp-run");
  netShowCard("HOST IS PICKING", "Waiting for <b>" + netEsc(netHostName()) + "</b> to choose the difficulty and press START&hellip;", [["LEAVE GAME", netLeave]]);
}
function netOpenMenu() {
  if (G.mode !== "play") return;
  NET.menu = true; shooting = false;
  try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { /* ignore */ }
  const btns = [["RESUME", netHideCard]];
  if (NET.host) btns.push(["BACK TO LOBBY", netLobby]); else btns.push(["LEAVE GAME", netLeave]);
  netShowCard("CO-OP MENU", "The run keeps going while this menu is open.", btns);
}
function netGoLobby() {
  const GN = window.GrokNet, me = room.me() || {};
  room.markNavigating();
  location.href = GN.buildUrl(GN.hubUrl(), { mode: room.isHost ? "host" : "join", code: room.code, name: NET.prm.name, color: NET.prm.color, pid: room.pid, slot: me.slot });
}
function netLobby() {
  if (!NET.host) { netLeave(); return; }
  room.broadcast({ t: "lobby" });
  setTimeout(netGoLobby, 250);
}
function netLeave() {
  try { if (room) room.leave(); } catch (e) { /* ignore */ }
  location.href = window.GrokNet.hubUrl();
}
function netGoSolo() { // host left: keep going alone with normal single-player rules
  NET.on = false; NET.menu = false;
  for (const pid of Array.from(NET.remotes.keys())) netDropRemote(pid);
  if (netBadge) { netBadge.remove(); netBadge = null; }
  document.body.classList.remove("mp", "mp-run");
  $id("btn-revive").classList.add("hidden"); $id("mp-status").classList.remove("show");
  if (window.GrokNet) window.GrokNet.ui.hide();
  $id("mp-card").classList.add("hidden");
  for (const p of pickups) p.pending = 0;
  if (G.mode === "play") {
    G.lives = MAX_LIVES;
    if (NET.down) { NET.down = false; G.hp = MAX_HP; P.eye = 1.55; }
    NET.down = false;
    $id("overlay").classList.remove("show");
    updateHUD();
    toast("SOLO NOW · 3 LIVES", "#1ce0ff");
  } else { G.mode = "title"; showOverlay("title"); refreshTitle(); }
}

// ---------- messages ----------
function netMsg(d, from) {
  if (!d || typeof d !== "object" || !NET.on) return;
  const t = d.t;
  if (t === "p") { netOnPlayer(d, from); return; }
  if (t === "s") { if (from !== NET.pid && d.g === NET.gen) { const R = netRemote(from); NET.tracers.push({ o: d.o, h: d.h, t: 0.09, c: R.rgb }); if (Math.hypot(d.o[0] - P.x, d.o[2] - P.z) < 25) blip(260, 0.05, "square", 0.025, 110); } return; }
  if (t === "start") { if (!NET.host) netStartFromHost(d, d.g); return; }
  if (t === "lobby") { if (!NET.host) netGoLobby(); return; }
  if (d.g !== NET.gen) return;
  if (NET.host) {
    if (t === "dmg") { const e = NET.enemyMap.get(d.id); if (e && e.hp > 0) damageEnemy(e, d.d, e.x, e.y + 0.6, e.z, from); return; }
    if (t === "take") { const p = netPickup(d.id); if (p && p.alive) { p.alive = false; netBroadcast({ t: "took", id: p.id, by: from }); } return; }
  }
  switch (t) {
    case "rev": if (d.to === NET.pid && NET.down) { netStandUp(50); toast("REVIVED BY " + netName(from).toUpperCase() + "!", "#7dff5a"); sfx("win"); netSendState(); } break;
    case "hit": if (!NET.host && d.to === NET.pid) hurtPlayer(d.d, { x: d.sx, z: d.sz }); break;
    case "w": if (!NET.host) netOnWorld(d); break;
    case "bolt": if (!NET.host) { const b = d.b; bolts.push({ x: b[0], y: b[1], z: b[2], vx: b[3], vy: b[4], vz: b[5], life: 3, friendly: false, dmg: b[6], src: { x: b[7], z: b[8] } }); blip(160, 0.05, "square", 0.025, 70); } break;
    case "kill": if (!NET.host) { const e = NET.enemyMap.get(d.id); if (e && e.hp > 0) { e.hp = 0; e.hit = 0.12; burst(e.x, e.y + 0.6, e.z, e.kind === "tank" ? [1, 0.6, 0.1] : [1, 0.2, 0.45], e.kind === "tank" ? 30 : 16, 6); } } break;
    case "drop": if (!NET.host && !netPickup(d.p.id)) pickups.push({ id: d.p.id, x: d.p.x, y: d.p.y, z: d.p.z, kind: d.p.kind, small: d.p.small, alive: true, t: 0 }); break;
    case "took": if (!NET.host) { const p = netPickup(d.id); if (p && p.alive) { if (d.by === NET.pid) applyPickup(p); else p.alive = false; } } break;
    case "cp": if (!NET.host) { const r = rooms[d.i]; if (r && r.cp && !r.cp.active) activateCp(r); } break;
    case "wipe": if (!NET.host) netWipe(); break;
    case "win": if (!NET.host) { NET.winStats = d.stats; win(); } break;
    case "sync": if (!NET.host) {
      for (const id of d.dead) { const e = NET.enemyMap.get(id); if (e) e.hp = 0; }
      enemies = enemies.filter((e) => e.hp > 0);
      for (const id of d.took) { const p = netPickup(id); if (p) p.alive = false; }
      for (const p of d.drops) if (!netPickup(p.id)) pickups.push(Object.assign({ alive: true, t: 0 }, p));
      for (const i of d.cps) { const r = rooms[i]; if (r && r.cp && !r.cp.active) { r.cp.active = true; G.cp = r.cp; G.maxRoom = Math.max(G.maxRoom, r.idx); } }
      updateHUD();
    } break;
  }
}

// ---------- boot ----------
function netBoot() {
  const GN = window.GrokNet;
  if (!GN) return;
  const prm = GN.params();
  if (!prm) return;
  NET.on = true; NET.host = prm.mode === "host"; NET.prm = prm; NET.pid = prm.pid; NET.code = prm.code;
  NET.sendT = 0; NET.worldT = 0; NET.tracers = []; NET.enemyMap = new Map(); NET.downs = 0; NET.revT = 0; NET.pickSeq = 10000;
  document.body.classList.add("mp");
  $id("play-btn").textContent = "START CO-OP";
  const info = document.createElement("div"); info.id = "mp-title-info";
  info.innerHTML = "<b>CO-OP ROOM " + netEsc(prm.code) + "</b> · you pick the difficulty for the team<div id='mp-title-roster'></div>";
  $id("diff-row").before(info);
  // touch REVIVE button
  const rb = $id("btn-revive");
  const down = (e) => { e.preventDefault(); e.stopPropagation(); NET.reviveHeld = true; try { rb.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } };
  const up = (e) => { e.preventDefault(); NET.reviveHeld = false; };
  rb.addEventListener("pointerdown", down); rb.addEventListener("pointerup", up); rb.addEventListener("pointercancel", up); rb.addEventListener("lostpointercapture", up);
  rb.addEventListener("contextmenu", (e) => e.preventDefault());
  $id("mp-menu-btn").addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); netOpenMenu(); });
  $id("mp-menu-btn").addEventListener("pointerdown", (e) => e.stopPropagation());
  window.addEventListener("keydown", (e) => { if ((e.code === "Escape" || e.code === "KeyM") && G.mode === "play" && NET.on && !NET.menu && !document.pointerLockElement) netOpenMenu(); });
  GN.ui.status(NET.host ? "Opening co-op room…" : "Joining co-op room…", "Room code " + prm.code);
  const go = () => {
    room = GN.joinFromParams(prm, { max: 3 });
    room.on("open", () => {
      GN.ui.hide();
      if (!netBadge) netBadge = GN.ui.badge(room, { pos: "bc", label: room.code });
      if (NET.host) {
        if (G.mode !== "play") { room.setMeta({ game: "voxels", playing: false, gen: NET.gen }); showOverlay("title"); refreshTitle(); }
      } else {
        const m = room._meta || {};
        if (m.playing && m.gen) netStartFromHost(m, m.gen); else netWaitCard();
      }
    });
    room.on("meta", (m) => { if (!NET.host && m && m.playing && m.gen && m.gen !== NET.gen) netStartFromHost(m, m.gen); });
    room.on("message", netMsg);
    room.on("players", (list) => {
      for (const pid of Array.from(NET.remotes.keys())) if (!list.some((p) => p.pid === pid)) netDropRemote(pid);
      for (const p of list) { const R = NET.remotes.get(p.pid); if (R && R.name !== p.name) { R.name = p.name; R.tag.firstChild.textContent = p.name; R.row.firstChild.textContent = p.name; } if (R && R.color !== p.color) { R.color = p.color; R.rgb = hexRgb(p.color); R.tag.style.setProperty("--c", p.color); R.row.style.setProperty("--c", p.color); } }
      const tr = $id("mp-title-roster");
      if (tr) tr.innerHTML = list.map((p) => "<span class='mp-pl' style='--c:" + netEsc(p.color) + "'>" + netEsc(p.name) + "</span>").join("") + (list.length < 2 ? " <small>waiting for a partner…</small>" : "");
      if (!$id("mp-card").classList.contains("hidden")) netRoster();
    });
    room.on("join", (p) => {
      if (p.pid === NET.pid) return;
      netNotice("<b>" + netEsc(p.name) + "</b> joined the game!", 3.5);
      if (NET.host && G.mode !== "title") {
        room.sendTo(p.pid, { t: "start", seed: NET.seed, diff: G.diff, n: NET.n, g: NET.gen });
        netSyncFor(p.pid);
      }
    });
    room.on("leave", (p) => {
      if (p.pid === NET.pid) return;
      netDropRemote(p.pid);
      if (p.host) return;
      netNotice("<b>" + netEsc(p.name) + "</b> left the game." + (room.count() < 2 ? " You're on your own now." : ""), 6);
    });
    room.on("reconnecting", () => netNotice("Connection to the host dropped — reconnecting…", 13));
    room.on("reconnected", () => netNotice("Reconnected!", 2.5));
    room.on("error", (err) => {
      if (err.code === "hostleft" && G.mode === "play") {
        GN.ui.dialog({ title: "Host left", message: netHostName() + " left, so the co-op run ended. You can keep going solo with 3 lives.", error: true, buttons: [
          { label: "KEEP PLAYING SOLO", id: "mp-solo-btn", action: netGoSolo },
          { label: "BACK TO ARCADE", href: GN.hubUrl() }] });
      } else GN.ui.error(err);
      shooting = false;
      try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { /* ignore */ }
    });
    room.start();
  };
  if (window.Peer) go();
  else {
    const s = document.createElement("script");
    s.src = "peerjs.min.js"; s.onload = go; s.onerror = () => GN.ui.error("nopeer");
    document.head.appendChild(s);
  }
}
function netDebug() {
  return { on: NET.on, host: NET.host, gen: NET.gen, n: NET.n, down: NET.down, onPad: NET.onPad, revT: NET.revT, count: room ? room.count() : 0,
    mode: G.mode, hp: Math.round(G.hp), maxRoom: G.maxRoom, kills: G.kills, score: G.score, seed: G.seed, enemies: enemies.filter((e) => e.hp > 0).length,
    remotes: Array.from(NET.remotes.values()).map((R) => ({ pid: R.pid, name: R.name, x: R.x, y: R.y, z: R.z, live: netLive(R), dn: R.last ? R.last.dn : null, hp: R.last ? R.last.hp : null, tag: !R.tag.classList.contains("hidden") })) };
}

// ---------- autopilot bot (used by automated smoke tests) ----------
let botWps = [], botWi = 0, botStuck = 0, botStrafeT = 0, botStrafe = 1;
function buildBotPath() {
  botWps = []; botWi = 0;
  for (const r of rooms) {
    const cx = (r.door !== undefined ? r.door : r.x + (r.w >> 1) - 1) + 1.5;
    if (r.type === "start") { botWps.push({ x: cx, z: r.z + r.d - 1.2 }); continue; }
    if (r.type === "extract") { botWps.push({ x: cx, z: r.z + 1.5 }); botWps.push({ x: extract.x + 2, z: extract.z + 2 }); continue; }
    botWps.push({ x: cx, z: r.z + 1.5 });
    botWps.push({ x: cx, z: r.z + r.d - 1.2 });
  }
}
function angWrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function botThink(dt) {
  if (!botWps.length) buildBotPath();
  let tgt = null, bd = 1e9;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - P.x, e.z - P.z);
    if (d < 20 && d < bd && (e.see || (d < 12 && los(P.x, P.y + P.eye, P.z, e.x, e.y + 0.6, e.z)))) { bd = d; tgt = e; }
  }
  touch.moveX = 0; touch.moveY = 0;
  if (tgt) {
    const ty = tgt.y + (tgt.kind === "tank" ? 0.8 : tgt.fly ? 0.2 : 0.6);
    const dx = tgt.x - P.x, dz = tgt.z - P.z, hd = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(dx, -dz), wantPitch = -Math.atan2(ty - (P.y + P.eye), hd);
    const dy = angWrap(wantYaw - P.yaw), dp = wantPitch - P.pitch;
    const rate = 5 * dt;
    P.yaw += clamp(dy, -rate, rate); P.pitch += clamp(dp, -rate, rate);
    shooting = Math.abs(dy) < 0.09 && Math.abs(dp) < 0.12;
    if (G.weapon === 0 && G.shells > 0 && hd < 5) switchWeapon(1);
    botStrafeT -= dt; if (botStrafeT <= 0) { botStrafeT = 0.8 + Math.random(); botStrafe = -botStrafe; }
    touch.moveX = botStrafe * 0.6;
    if (hd < 3) touch.moveY = 0.6; // back off a little from melee bots
    return;
  }
  shooting = false;
  if (G.ammo < MAG && G.reserve > 0 && G.reload <= 0) tryReload();
  const wp = botWps[Math.min(botWi, botWps.length - 1)];
  const dx = wp.x - P.x, dz = wp.z - P.z, d = Math.hypot(dx, dz);
  if (d < 1.1 && botWi < botWps.length - 1) botWi++;
  const wantYaw = Math.atan2(dx, -dz), dy = angWrap(wantYaw - P.yaw);
  P.yaw += clamp(dy, -6 * dt, 6 * dt);
  P.pitch += clamp(-P.pitch, -3 * dt, 3 * dt);
  if (Math.abs(dy) < 0.6) touch.moveY = -1;
  const sp = Math.hypot(P.vx, P.vz);
  botStuck = touch.moveY && sp < 0.6 ? botStuck + dt : 0;
  if (botStuck > 0.5) { touch.jumpQueued = true; touch.moveX = Math.random() < 0.5 ? -1 : 1; botStuck = 0; }
}

window.__vox = {
  get mode() { return G.mode; }, get lives() { return G.lives; }, get hp() { return Math.round(G.hp); }, get score() { return G.score; },
  get kills() { return G.kills; }, get maxRoom() { return G.maxRoom; }, get rooms() { return rooms.length; }, get diff() { return DIFFS[G.diff].name; },
  get enemies() { return enemies.filter(e => e.hp > 0).map(e => e.kind); }, get best() { return Object.assign({}, STORE.best); },
  get dmgTaken() { return G.dmgTaken; }, get weapon() { return G.weapon; }, get ammo() { return [G.ammo, G.reserve, G.shells]; },
  get winding() { return enemies.filter(e => e.hp > 0 && e.windup > 0).length; },
  faceNearest() {
    let t = null, bd = 1e9;
    for (const e of enemies) { if (e.hp <= 0) continue; const d = Math.hypot(e.x - P.x, e.z - P.z) + (e.windup > 0 ? -100 : 0); if (d < bd) { bd = d; t = e; } }
    if (!t) return false;
    P.yaw = Math.atan2(t.x - P.x, -(t.z - P.z)); P.pitch = -Math.atan2(t.y + 0.6 - (P.y + P.eye), Math.hypot(t.x - P.x, t.z - P.z)); return true;
  },
  get pickups() { return pickups.filter(p => p.alive).map(p => p.kind); },
  start(d) { G.bot = !!this._bot; startRun(d); buildBotPath(); },
  setBot(on) { this._bot = !!on; G.bot = !!on; if (on) buildBotPath(); else { touch.moveX = touch.moveY = 0; shooting = false; } },
  setGod(on) { G.god = !!on; },
  tp(i) { const r = rooms[i]; if (!r) return false; P.x = r.door + 1.5; P.y = r.fy + 1.01; P.z = r.z + 2; P.vx = P.vy = P.vz = 0; P.yaw = Math.PI; return true; },
  // co-op test hooks
  net: () => netDebug(), P, G, get enemyList() { return enemies; }, get pickupList() { return pickups; }, get roomList() { return rooms; }, get extractPad() { return extract; },
  hurt(n) { const g = G.invuln; G.invuln = 0; hurtPlayer(n / DIFFS[G.diff].dmg); G.invuln = g; },
};

if (prefersTouch()) enableTouchUI();
generate((Date.now() ^ 0x9e3779b9) >>> 0);
document.body.classList.add("menu");
resize();
updateHUD();
netBoot();
requestAnimationFrame(frame);
})();
