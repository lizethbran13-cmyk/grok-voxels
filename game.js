/* GROK VOXELS 3.1 — first/third-person voxel shooter, no build step */
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
    regenDelay: 2.5, regenRate: 24, drop: 0.5, hpDrop: 0.3, assist: 0.075, ammoPick: 18, score: 1,
    spd: 1, elite: 0, lead: 0, pack: false, cpHeal: 20, burst: 1, reserve: 24 },
  { name: "NORMAL", desc: "The classic challenge, now with health regen and checkpoints.",
    dmg: 1.0, count: 0.85, spread: [0.10, 0.055], bolt: [8, 10.5], fireCd: [1.7, 1.2], windup: 0.62, see: 16,
    regenDelay: 4, regenRate: 14, drop: 0.32, hpDrop: 0.14, assist: 0.05, ammoPick: 12, score: 1.5,
    spd: 1, elite: 0, lead: 0, pack: false, cpHeal: 20, burst: 1, reserve: 0 },
  // 3.0: HARD is actually hard. Elites, leading shots, packs that alert each other, scarce pickups, no free heals.
  { name: "HARD",   desc: "Elite enemies, leading shots, packs that hunt together, scarce pickups. Actually HARD.",
    dmg: 1.7, count: 1.45, spread: [0.045, 0.018], bolt: [11.5, 14.5], fireCd: [1.05, 0.72], windup: 0.34, see: 24,
    regenDelay: 7, regenRate: 5, drop: 0.13, hpDrop: 0.035, assist: 0.02, ammoPick: 8, score: 2.5,
    spd: 1.25, elite: 0.3, lead: 0.75, pack: true, cpHeal: 0, burst: 2, reserve: -12 },
];
const DMG = { bolt: 20, melee: 24, tank: 16, drone: 10, fall: 25, grey: 18, seeker: 8, turret: 12, brute: 30, swipe: 22, boss: 18, wave: 26, lava: 8 };
const SHELLS_PICK = 8;
const STORE_KEY = "grokvoxels2";
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch (e) { return {}; }
}
function saveStore(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } }
const STORE = loadStore();
if (!STORE.best) STORE.best = {};
if (typeof STORE.diff !== "number") STORE.diff = 0; // first-timers start on Easy
if (typeof STORE.lvl !== "number") STORE.lvl = -1;  // 3.0 level select: -1 = MIX (handcrafted levels rotate with random courses)
if (typeof STORE.rot !== "number") STORE.rot = 0;
if (!STORE.clear) STORE.clear = {};
if (typeof STORE.cam3 !== "boolean") STORE.cam3 = false;   // free 3rd-person camera
if (typeof STORE.assist !== "boolean") STORE.assist = false; // free Assist Mode
if (typeof STORE.skin !== "string") STORE.skin = "classic";
function maxHp() { return STORE.assist ? 150 : MAX_HP; }

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
  // ---- 3.0 themed materials ----
  [0.86,0.90,0.93], // 19 lab tile
  [0.70,0.77,0.82], // 20 lab tile 2
  [1.00,0.80,0.10], // 21 hazard yellow
  [0.30,1.00,0.35], // 22 goo (glow)
  [0.26,0.28,0.33], // 23 dark metal
  [0.56,0.56,0.53], // 24 concrete
  [1.00,0.16,0.12], // 25 red light (glow)
  [1.00,0.22,0.76], // 26 neon pink (glow)
  [0.12,0.95,1.00], // 27 neon cyan (glow)
  [0.20,0.19,0.25], // 28 rooftop tar
  [1.00,0.42,0.06], // 29 lava (glow, hurts)
  [0.19,0.14,0.14], // 30 basalt
  [0.62,0.88,1.00], // 31 ice (slippery)
  [0.94,0.97,1.00], // 32 snow
  [0.42,0.50,0.62], // 33 steel blue
  [0.45,1.00,0.60], // 34 alien glow
  [0.78,0.80,0.87], // 35 silver
  [0.55,0.90,0.96], // 36 glass
  [1.00,0.85,0.45], // 37 window light (glow)
  [0.20,0.13,0.33], // 38 night building
  [0.55,0.17,0.06], // 39 magma rock
  [0.07,0.07,0.09], // 40 black
  [0.30,0.40,0.22], // 41 army green
];
const EMIT = { 9: 0.55, 14: 0.85 };
// glowing voxels: brightened on every face so they read as light sources in dark levels
const GLOW = { 22: 0.85, 25: 0.9, 26: 0.95, 27: 0.95, 29: 1.0, 34: 0.9, 36: 0.25, 37: 0.8, 31: 0.12 };

const SKIES = [
  { sky:[0.38,0.72,0.98], fog:[0.62,0.82,1.00], light:[0.45,0.85,0.35], name:"NOON" },
  { sky:[0.98,0.48,0.32], fog:[1.00,0.62,0.42], light:[0.55,0.55,0.20], name:"BLAZE" },
  { sky:[0.22,0.32,0.62], fog:[0.32,0.38,0.58], light:[0.35,0.55,0.80], name:"DUSK" },
  { sky:[0.42,0.88,0.82], fog:[0.55,0.90,0.82], light:[0.40,0.90,0.55], name:"MINT" },
  { sky:[0.70,0.42,0.92], fog:[0.62,0.48,0.90], light:[0.80,0.45,0.90], name:"NEON" },
];

// =====================================================================
// 3.0 HANDCRAFTED LEVELS. Each one is a fixed layout of rooms with its own palette, props, sky, fog,
// enemy roster and weapon drops. They use the same room/corridor/checkpoint framework as the random
// courses, so co-op, the minimap, checkpoints and saves all work the same way.
// Index 0 is the classic randomized course.
// =====================================================================
const LEVELS = [
  { id: "random", name: "RANDOM COURSE", short: "RANDOM", desc: "A brand-new randomized voxel gauntlet every run." },
  { id: "lab", name: "SECRET LAB", short: "SECRET LAB", desc: "Specimen tanks, glowing goo, mutant brutes and lab drones.",
    sky: { sky: [0.04, 0.10, 0.12], fog: [0.06, 0.17, 0.19], light: [0.35, 0.9, 0.45], name: "SECRET LAB" }, fogN: 13, fogF: 48, tint: [0.96, 1.02, 1.06],
    fy: 1, walls: [19, 27], floor: [19, 20], ceilMat: 20, pillar: 33, stair: 23, under: 23, cover: [23, 33, 19], lamp: 27, light: 14,
    corr: { a: 20, b: 21, wall: 33, ceil: 23, lamp: 27 },
    start: { name: "LAB ENTRY", deco: ["labStart"] },
    rooms: [
      { t: "hall", w: 9, d: 16, dx: -4, name: "CLEAN ROOM", en: [["shoot", 2], ["seeker", 1]], pick: ["freeze"], deco: ["cleanroom"], covers: 0 },
      { t: "arena", w: 16, d: 16, dx: 6, name: "SPECIMEN HALL", en: [["melee", 2], ["seeker", 2], ["shoot", 1]], deco: ["tanks", "goo"], covers: 2 },
      { t: "choke", w: 12, d: 12, dx: -5, name: "SECURITY", en: [["turret", 1], ["shoot", 2]], deco: ["security"], covers: 2 },
      { t: "arena", w: 14, d: 14, dx: 4, name: "SERVER ROOM", en: [["seeker", 2], ["melee", 2]], pick: ["rocket"], deco: ["servers"], covers: 0 },
      { t: "arena", w: 16, d: 16, dx: -3, name: "MUTATION CHAMBER", en: [["brute", 2], ["shoot", 1], ["seeker", 1]], deco: ["chamber", "goo"], covers: 3 },
    ],
    exit: { name: "ELEVATOR" } },
  { id: "a51", name: "AREA 51 HANGAR", short: "AREA 51", desc: "Desert base, alien greys that teleport, turrets and the OVERSEER boss.",
    sky: { sky: [0.05, 0.05, 0.13], fog: [0.11, 0.09, 0.18], light: [0.3, 0.85, 0.5], name: "AREA 51" }, fogN: 16, fogF: 60, tint: [1.0, 0.98, 1.04],
    fy: 1, walls: [33, 25], floor: [24, 23], floorOut: [15, 24], ceilMat: 23, pillar: 33, stair: 23, under: 24, cover: [23, 41, 4], lamp: 25, light: 14,
    corr: { a: 24, b: 23, wall: 33, ceil: 23, lamp: 25 },
    start: { name: "SECURITY GATE", outdoor: true, floor: [15, 2], walls: [24, 21], deco: ["gate"] },
    rooms: [
      { t: "court", w: 16, d: 14, dx: 5, name: "TARMAC", floor: [24, 23], walls: [24, 21], en: [["shoot", 2], ["grey", 1], ["drone", 1]], pick: ["laser"], deco: ["tarmac"], covers: 1 },
      { t: "hall", w: 10, d: 16, dx: -5, name: "HANGAR CORRIDOR", en: [["grey", 2], ["turret", 1]], deco: ["crates"], covers: 0 },
      { t: "arena", w: 18, d: 16, dx: 3, name: "HANGAR 18", ceil: 9, en: [["tank", 1], ["grey", 2], ["seeker", 1]], pick: ["rocket"], deco: ["jet", "crates"], covers: 0 },
      { t: "choke", w: 12, d: 12, dx: -3, name: "CONTAINMENT", walls: [33, 34], en: [["grey", 2], ["turret", 1], ["melee", 1]], deco: ["pods"], covers: 2 },
      { t: "arena", w: 22, d: 22, dx: 0, corr: 8, name: "THE OVERSEER'S HANGAR", ceil: 11, boss: true, en: [["boss", 1]], pick: ["health", "ammo", "rocket"], deco: ["bossHangar"], covers: 0 },
    ],
    exit: { name: "EXFIL" } },
  { id: "neon", name: "NEON CITY ROOFTOPS", short: "NEON CITY", desc: "Night rooftops, sky bridges, neon signs and drone swarms.",
    sky: { sky: [0.09, 0.03, 0.18], fog: [0.22, 0.05, 0.30], light: [0.4, 0.8, 0.6], name: "NEON CITY" }, fogN: 22, fogF: 70, tint: [1.02, 0.98, 1.08],
    fy: 5, outdoor: true, parapet: 2, walls: [38, 26], floor: [28, 23], pillar: 38, stair: 23, under: 38, cover: [35, 23, 38], lamp: 27,
    corr: { a: 36, b: 23, wall: 27, open: true },
    backdrop: "skyline",
    start: { name: "ROOFTOP ACCESS", deco: ["ac"] },
    rooms: [
      { t: "court", w: 14, d: 14, dx: 5, name: "BILLBOARD ROOF", en: [["drone", 2], ["shoot", 1]], pick: ["laser"], deco: ["signs", "ac"], covers: 1 },
      { t: "arena", w: 16, d: 15, dx: -5, name: "HELIPORT", walls: [38, 27], en: [["seeker", 2], ["shoot", 2]], deco: ["ac", "antenna"], covers: 2 },
      { t: "ramp", w: 12, d: 12, dx: 4, rise: 1, name: "SKY GARDEN", en: [["drone", 2], ["melee", 2]], deco: ["watertower"], covers: 0 },
      { t: "choke", w: 14, d: 12, dx: -4, name: "NEON ALLEY", en: [["turret", 1], ["seeker", 1], ["shoot", 2]], pick: ["rocket"], deco: ["signs"], covers: 2 },
      { t: "arena", w: 16, d: 16, dx: 3, name: "ARCADE ROOF", walls: [38, 27], en: [["grey", 2], ["drone", 2], ["shoot", 1]], deco: ["signs", "antenna"], covers: 3 },
    ],
    exit: { name: "HELIPAD" } },
  { id: "forge", name: "VOLCANO FORGE", short: "VOLCANO", desc: "Lava rivers, roaring furnaces, tanks and charging brutes. Don't touch the lava!",
    sky: { sky: [0.22, 0.05, 0.02], fog: [0.40, 0.12, 0.04], light: [0.5, 0.75, 0.3], name: "VOLCANO FORGE" }, fogN: 11, fogF: 46, tint: [1.08, 0.94, 0.86],
    fy: 1, ceil: 7, walls: [30, 39], floor: [30, 11], ceilMat: 30, pillar: 39, stair: 39, under: 30, cover: [39, 23, 30], lamp: 29,
    corr: { a: 30, b: 39, wall: 30, ceil: 30, lamp: 29 },
    start: { name: "FORGE GATE", deco: ["chains"] },
    rooms: [
      { t: "hall", w: 10, d: 16, dx: -4, name: "MAGMA DUCT", en: [["melee", 2], ["shoot", 1]], pick: ["freeze"], deco: ["lavaFalls"], covers: 0 },
      { t: "arena", w: 16, d: 16, dx: 5, name: "LAVA RIVER", en: [["melee", 2], ["shoot", 2], ["turret", 1]], deco: ["lavaRiver"], covers: 3 },
      { t: "choke", w: 12, d: 12, dx: -4, name: "SLAG GATE", en: [["tank", 1], ["melee", 1], ["shoot", 1]], deco: ["chains"], covers: 2 },
      { t: "arena", w: 14, d: 14, dx: 4, name: "BELLOWS", en: [["brute", 1], ["melee", 2]], pick: ["rocket"], deco: ["forge"], covers: 1 },
      { t: "arena", w: 18, d: 18, dx: -2, name: "THE GREAT FORGE", en: [["brute", 2], ["tank", 1], ["turret", 1]], deco: ["forge", "lavaRiver"], covers: 2 },
    ],
    exit: { name: "COOLING VENT" } },
  { id: "frost", name: "FROZEN RESEARCH BASE", short: "FROZEN BASE", desc: "Blizzard courtyards, slippery ice, cryo labs and frozen specimens.",
    sky: { sky: [0.70, 0.82, 0.92], fog: [0.80, 0.88, 0.97], light: [0.45, 0.85, 0.4], name: "FROZEN BASE" }, fogN: 9, fogF: 42, tint: [0.98, 1.0, 1.05],
    fy: 1, walls: [33, 7], floor: [23, 33], floorOut: [32, 32], ceilMat: 23, pillar: 33, stair: 33, under: 32, cover: [31, 33, 32], lamp: 14,
    corr: { a: 23, b: 33, wall: 33, ceil: 23, lamp: 14 },
    start: { name: "AIRLOCK", deco: ["consoles"] },
    rooms: [
      { t: "court", w: 16, d: 14, dx: 5, name: "SNOWFIELD", walls: [32, 31], en: [["shoot", 2], ["drone", 1]], pick: ["laser"], deco: ["snow"], covers: 1 },
      { t: "hall", w: 10, d: 16, dx: -5, name: "MODULE B", en: [["seeker", 2], ["melee", 1]], deco: ["consoles"], covers: 0 },
      { t: "court", w: 16, d: 16, dx: 4, name: "ICE CANYON", walls: [31, 32], en: [["brute", 1], ["shoot", 2], ["drone", 1]], pick: ["rocket"], deco: ["snow", "crystals"], covers: 0 },
      { t: "choke", w: 12, d: 12, dx: -4, name: "CRYO LAB", walls: [19, 27], floor: [19, 31], en: [["grey", 2], ["turret", 1]], deco: ["specimens"], covers: 2 },
      { t: "arena", w: 16, d: 16, dx: 2, name: "SATELLITE ARRAY", outdoor: true, walls: [32, 31], en: [["brute", 1], ["grey", 1], ["seeker", 2], ["shoot", 1]], deco: ["snow", "dish"], covers: 2 },
    ],
    exit: { name: "EVAC" } },
];
const MIX_ORDER = [1, 0, 2, 0, 3, 0, 4, 0, 5, 0];

// ---------- prop helpers (props are placed after the structure, so rockets can blow them apart) ----------
function laneX(r, x) { return x >= r.door - 1 && x < r.door + 4; }
function groundY(x, z, r) {
  for (let y = r.fy + Math.max(0, r.rise || 0) + 1; y >= 0; y--) if (world.get(x, y, z) && !world.get(x, y + 1, z)) return y;
  return r.fy;
}
function propFree(r, x0, z0, w, d, h) {
  for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) {
    if (x < r.x + 1 || x >= r.x + r.w - 1 || z < r.z + 3 || z >= r.z + r.d - 2 || laneX(r, x)) return false;
    const g = groundY(x, z, r);
    for (let y = g + 1; y <= g + (h || 1); y++) if (world.get(x, y, z)) return false;
  }
  return true;
}
function pfill(x0, y0, z0, x1, y1, z1, t) { world.fill(x0, y0, z0, x1, y1, z1, t); }
// stamp a prop at ground level if the footprint is free; fn(x0, gy, z0) does the painting
function stamp(r, x0, z0, w, d, h, fn) {
  if (!propFree(r, x0, z0, w, d, h)) return false;
  fn(x0, groundY(x0, z0, r) + 1, z0);
  return true;
}
function sideSpots(r, w, stepZ, inset) { // spots along both side walls, off the center lane
  const out = [], i = inset || 2;
  for (let z = r.z + 4; z + 1 < r.z + r.d - 3; z += stepZ) { out.push([r.x + i, z]); out.push([r.x + r.w - i - w, z]); }
  return out;
}
function floorPaint(r, x, z, t) { const g = groundY(x, z, r); if (world.get(x, g, z) && world.get(x, g, z) !== 9) world.set(x, g, z, t); }
function blobs(r, rng, n, rad, t, avoidLane) {
  for (let i = 0; i < n; i++) {
    const bx = rng.int(r.x + 2, r.x + r.w - 3), bz = rng.int(r.z + 3, r.z + r.d - 3);
    for (let z = bz - rad; z <= bz + rad; z++) for (let x = bx - rad; x <= bx + rad; x++) {
      if (x <= r.x || x >= r.x + r.w - 1 || z < r.z + 2 || z > r.z + r.d - 2) continue;
      if (avoidLane && laneX(r, x)) continue;
      if ((x - bx) * (x - bx) + (z - bz) * (z - bz) <= rad * rad + rng.f(0, 1.5)) floorPaint(r, x, z, t);
    }
  }
}
function lavaPit(r, x, z) { // sunk 1 block: lava you can step in (it hurts) and jump out of
  const g = groundY(x, z, r);
  world.set(x, g, z, 0); world.set(x, g - 1, z, 29);
}

const DECO = {
  // ---- SECRET LAB ----
  labStart(r) {
    for (let z = r.z + 3; z < r.z + 7; z++) { pfill(r.x + 1, r.fy + 1, z, r.x + 3, r.fy + 2, z + 1, 23); world.set(r.x + 1, r.fy + 2, z, z & 1 ? 27 : 23); }
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) world.set(x, r.fy, r.z + r.d - 2, (x & 1) ? 21 : 40);
  },
  cleanroom(r) {
    for (let z = r.z + 4; z < r.z + r.d - 3; z += 4) for (const x of [r.x + 1, r.x + r.w - 2]) pfill(x, r.fy + 1, z, x + 1, r.fy + 4, z + 2, 36);
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) { world.set(x, r.fy, r.z + 2, (x & 1) ? 21 : 40); world.set(x, r.fy, r.z + r.d - 3, (x & 1) ? 21 : 40); }
  },
  tanks(r) {
    for (const [x, z] of sideSpots(r, 2, 4, 2)) stamp(r, x, z, 2, 2, 5, (x0, y, z0) => {
      pfill(x0, y, z0, x0 + 2, y + 1, z0 + 2, 23); pfill(x0, y + 1, z0, x0 + 2, y + 2, z0 + 2, 36);
      pfill(x0, y + 2, z0, x0 + 2, y + 3, z0 + 2, 22); pfill(x0, y + 3, z0, x0 + 2, y + 4, z0 + 2, 36); pfill(x0, y + 4, z0, x0 + 2, y + 5, z0 + 2, 23);
    });
  },
  goo(r, rng) { blobs(r, rng, 4, 1, 22, true); },
  security(r) {
    const mz = r.z + (r.d >> 1);
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (world.get(x, r.fy + 3, mz)) world.set(x, r.fy + 3, mz, (x & 1) ? 21 : 40);
    for (const x of [r.door - 1, r.door + 3]) if (world.get(x, r.fy + 3, mz)) world.set(x, r.fy + 3, mz, 25);
    stamp(r, r.x + 2, r.z + 4, 3, 1, 2, (x, y, z) => { pfill(x, y, z, x + 3, y + 1, z + 1, 23); world.set(x + 1, y + 1, z, 27); });
  },
  servers(r) {
    for (let z = r.z + 4; z < r.z + r.d - 3; z += 3) {
      for (let x = r.x + 2; x < r.x + r.w - 2; x++) stamp(r, x, z, 1, 1, 3, (x0, y, z0) => {
        pfill(x0, y, z0, x0 + 1, y + 3, z0 + 1, 40);
        world.set(x0, y + 1 + ((x0 + z0) % 2), z0, (x0 + z0) % 3 ? 27 : 22);
      });
    }
  },
  chamber(r) {
    for (const x of [r.x + 2, r.x + r.w - 5]) stamp(r, x, r.z + (r.d >> 1) - 1, 3, 3, 4, (x0, y, z0) => {
      pfill(x0, y, z0, x0 + 3, y + 1, z0 + 3, 23); pfill(x0, y + 1, z0, x0 + 3, y + 3, z0 + 3, 36);
      world.set(x0 + 1, y + 1, z0 + 1, 22); world.set(x0 + 1, y + 2, z0 + 1, 22); pfill(x0, y + 3, z0, x0 + 3, y + 4, z0 + 3, 23);
    });
  },
  // ---- AREA 51 ----
  gate(r) {
    stamp(r, r.x + 1, r.z + 3, 3, 3, 4, (x, y, z) => { pfill(x, y, z, x + 3, y + 3, z + 3, 33); pfill(x, y + 1, z, x + 3, y + 2, z + 3, 36); world.set(x + 1, y + 3, z + 1, 25); });
    for (let x = r.door - 2; x < r.door + 6; x++) if (x > r.x && x < r.x + r.w - 1 && (x < r.door || x >= r.door + 3)) { world.set(x, r.fy + 1, r.z + r.d - 3, 21); world.set(x, r.fy + 2, r.z + r.d - 3, x & 1 ? 16 : 10); }
    stamp(r, r.x + r.w - 3, r.z + 3, 1, 1, 5, (x, y, z) => { pfill(x, y, z, x + 1, y + 4, z + 1, 33); world.set(x, y + 4, z, 14); });
  },
  tarmac(r, rng) {
    for (let z = r.z + 2; z < r.z + r.d - 1; z++) if ((z >> 1) & 1) floorPaint(r, r.door + 1, z, 21);
    stamp(r, r.x + 2, r.z + 4, 2, 4, 2, (x, y, z) => { pfill(x, y, z, x + 2, y + 1, z + 4, 41); pfill(x, y + 1, z + 1, x + 2, y + 2, z + 3, 41); world.set(x, y + 1, z, 36); world.set(x + 1, y + 1, z, 36); });
    for (const [x, z] of [[r.x + r.w - 4, r.z + 4], [r.x + r.w - 3, r.z + 9], [r.x + 3, r.z + 10]]) stamp(r, x, z, 1, 1, 2, (x0, y, z0) => pfill(x0, y, z0, x0 + 1, y + 2, z0 + 1, rng.pick([7, 10, 41])));
    for (const x of [r.x + 1, r.x + r.w - 2]) stamp(r, x, r.z + (r.d >> 1), 1, 1, 6, (x0, y, z0) => { pfill(x0, y, z0, x0 + 1, y + 5, z0 + 1, 33); world.set(x0, y + 5, z0, 14); });
  },
  crates(r, rng) {
    for (const [x, z] of sideSpots(r, 2, 3, 1)) if (rng.chance(0.6)) stamp(r, x, z, 2, 2, 2, (x0, y, z0) => {
      const t = rng.pick([23, 4, 41]); pfill(x0, y, z0, x0 + 2, y + 1, z0 + 2, t);
      if (rng.chance(0.5)) pfill(x0, y + 1, z0, x0 + 1 + rng.int(0, 1), y + 2, z0 + 1, t === 4 ? 18 : 21);
    });
  },
  jet(r) {
    const x = r.x + 2, z = r.z + 4;
    stamp(r, x, z, 3, 9, 3, (x0, y, z0) => {
      pfill(x0, y, z0, x0 + 3, y + 2, z0 + 9, 35); pfill(x0 + 1, y + 2, z0 + 2, x0 + 2, y + 3, z0 + 4, 36);
      pfill(x0 + 1, y + 2, z0 + 7, x0 + 2, y + 4, z0 + 9, 35); world.set(x0 + 1, y, z0 + 8, 29); world.set(x0 + 1, y + 1, z0 - 0, 23);
      for (let wx = x0 + 3; wx < Math.min(r.door - 1, x0 + 7); wx++) pfill(wx, y + 1, z0 + 4, wx + 1, y + 2, z0 + 7, 35);
    });
  },
  pods(r) {
    for (const [x, z] of sideSpots(r, 2, 4, 1)) stamp(r, x, z, 2, 2, 4, (x0, y, z0) => {
      pfill(x0, y, z0, x0 + 2, y + 1, z0 + 2, 23); pfill(x0, y + 1, z0, x0 + 2, y + 3, z0 + 2, 36); world.set(x0, y + 1, z0, 34); world.set(x0 + 1, y + 2, z0 + 1, 34); pfill(x0, y + 3, z0, x0 + 2, y + 4, z0 + 2, 23);
    });
  },
  bossHangar(r) {
    const cx = r.x + r.w / 2, cz = r.z + r.d / 2, uy = r.fy + 8;
    for (let z = r.z + 1; z < r.z + r.d - 1; z++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      if (d < 5.2) world.set(x, uy, z, d > 4.4 ? 34 : 35);
      if (d < 2.6) world.set(x, uy + 1, z, 36);
      if (d < 1.6) world.set(x, uy - 1, z, 34);
      if (Math.abs(d - 6.5) < 0.5) floorPaint(r, x, z, 21);
    }
    for (const [x, z] of [[r.x + 4, r.z + 5], [r.x + r.w - 6, r.z + 5], [r.x + 4, r.z + r.d - 8], [r.x + r.w - 6, r.z + r.d - 8]]) pfill(x, r.fy + 1, z, x + 2, r.fy + 4, z + 2, 33);
    for (let z = r.z + 3; z < r.z + r.d - 3; z += 5) for (const x of [r.x, r.x + r.w - 1]) if (world.get(x, r.fy + 5, z)) world.set(x, r.fy + 5, z, 25);
  },
  // ---- NEON CITY ----
  ac(r, rng) {
    for (let i = 0; i < 4; i++) { const x = rng.int(r.x + 2, r.x + r.w - 4), z = rng.int(r.z + 4, r.z + r.d - 5);
      stamp(r, x, z, 2, 2, 2, (x0, y, z0) => { pfill(x0, y, z0, x0 + 2, y + 1, z0 + 2, 35); world.set(x0, y + 1, z0, 40); world.set(x0 + 1, y + 1, z0 + 1, 33); }); }
  },
  signs(r, rng) {
    for (const [x, z] of sideSpots(r, 1, 5, 1)) stamp(r, x, z, 1, 3, 5, (x0, y, z0) => {
      const c = rng.pick([26, 27, 37]);
      pfill(x0, y, z0 + 1, x0 + 1, y + 2, z0 + 2, 40);
      pfill(x0, y + 2, z0, x0 + 1, y + 5, z0 + 3, 40);
      for (let yy = y + 2; yy < y + 5; yy++) for (let zz = z0; zz < z0 + 3; zz++) if ((yy + zz) % 2 === 0 || yy === y + 3) world.set(x0, yy, zz, c);
    });
  },
  antenna(r, rng) {
    for (let i = 0; i < 2; i++) { const x = rng.int(r.x + 2, r.x + r.w - 3), z = rng.int(r.z + 4, r.z + r.d - 4);
      stamp(r, x, z, 1, 1, 7, (x0, y, z0) => { pfill(x0, y, z0, x0 + 1, y + 6, z0 + 1, 33); world.set(x0, y + 6, z0, 25); }); }
  },
  watertower(r) {
    stamp(r, r.x + 2, r.z + r.d - 7, 3, 3, 6, (x, y, z) => {
      for (const [a, b] of [[0, 0], [2, 0], [0, 2], [2, 2]]) pfill(x + a, y, z + b, x + a + 1, y + 3, z + b + 1, 18);
      pfill(x, y + 3, z, x + 3, y + 5, z + 3, 4); world.set(x + 1, y + 5, z + 1, 18);
    });
  },
  // ---- VOLCANO FORGE ----
  lavaFalls(r) {
    for (let z = r.z + 3; z < r.z + r.d - 3; z++) {
      for (const x of [r.x + 1, r.x + r.w - 2]) if (!laneX(r, x)) lavaPit(r, x, z);
      if (z % 4 === 0) for (const x of [r.x, r.x + r.w - 1]) for (let y = r.fy + 1; y < r.fy + 6; y++) if (world.get(x, y, z)) world.set(x, y, z, 29);
    }
  },
  lavaRiver(r) {
    const z0 = r.z + (r.d >> 1) - 1, bridge2 = r.x + 3;
    for (let z = z0; z < z0 + 2; z++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      if (laneX(r, x) || (x >= bridge2 && x < bridge2 + 2)) { floorPaint(r, x, z, 23); continue; }
      lavaPit(r, x, z);
    }
    for (let y = r.fy + 1; y < r.fy + 6; y++) for (const x of [r.x, r.x + r.w - 1]) for (let z = z0; z < z0 + 2; z++) if (world.get(x, y, z)) world.set(x, y, z, 29);
  },
  chains(r, rng) {
    const top = r.fy + 6;
    for (let i = 0; i < 6; i++) { const x = rng.int(r.x + 2, r.x + r.w - 3), z = rng.int(r.z + 3, r.z + r.d - 3);
      if (laneX(r, x)) continue; const len = rng.int(2, 3); for (let y = top - len; y < top; y++) if (!world.get(x, y, z)) world.set(x, y, z, 40); }
    stamp(r, r.x + 2, r.z + 4, 2, 1, 2, (x, y, z) => { pfill(x, y, z, x + 2, y + 1, z + 1, 40); world.set(x, y + 1, z, 23); world.set(x + 1, y + 1, z, 23); });
  },
  forge(r) {
    for (const x of [r.x + 1, r.x + r.w - 4]) stamp(r, x, r.z + 4, 3, 3, 4, (x0, y, z0) => {
      pfill(x0, y, z0, x0 + 3, y + 3, z0 + 3, 30); world.set(x0 + 1, y, z0 + 1, 29); world.set(x0 + 1, y + 1, z0 + 1, 29);
      const fx = x0 < r.x + r.w / 2 ? x0 + 2 : x0; world.set(fx, y, z0 + 1, 29); world.set(fx, y + 1, z0 + 1, 29);
      pfill(x0 + 1, y + 3, z0 + 1, x0 + 2, r.fy + 7, z0 + 2, 39);
    });
    for (const x of [r.x + 3, r.x + r.w - 5]) stamp(r, x, r.z + r.d - 6, 2, 1, 2, (x0, y, z0) => { pfill(x0, y, z0, x0 + 2, y + 1, z0 + 1, 40); pfill(x0, y + 1, z0, x0 + 2, y + 2, z0 + 1, 23); });
  },
  // ---- FROZEN BASE ----
  snow(r, rng) {
    blobs(r, rng, 3, 2, 31, false);
    for (let i = 0; i < 5; i++) { const x = rng.int(r.x + 2, r.x + r.w - 4), z = rng.int(r.z + 4, r.z + r.d - 4);
      stamp(r, x, z, 2, 2, 1, (x0, y, z0) => { pfill(x0, y, z0, x0 + 2, y + 1, z0 + 2, 32); world.set(x0, y + 1, z0, 32); }); }
  },
  crystals(r, rng) {
    for (let i = 0; i < 6; i++) { const x = rng.int(r.x + 2, r.x + r.w - 3), z = rng.int(r.z + 4, r.z + r.d - 4), h = rng.int(2, 4);
      stamp(r, x, z, 1, 1, h, (x0, y, z0) => { pfill(x0, y, z0, x0 + 1, y + h, z0 + 1, 31); if (!laneX(r, x0 + 1) && x0 + 1 < r.x + r.w - 1) pfill(x0 + 1, y, z0, x0 + 2, y + h - 1, z0 + 1, 31); }); }
  },
  consoles(r) {
    for (let z = r.z + 3; z < r.z + r.d - 3; z += 3) for (const x of [r.x + 1, r.x + r.w - 2]) if (!laneX(r, x)) stamp(r, x, z, 1, 2, 2, (x0, y, z0) => { pfill(x0, y, z0, x0 + 1, y + 1, z0 + 2, 23); world.set(x0, y + 1, z0, 27); world.set(x0, y + 1, z0 + 1, 33); });
  },
  specimens(r) {
    for (const [x, z] of sideSpots(r, 2, 4, 1)) stamp(r, x, z, 2, 2, 3, (x0, y, z0) => { pfill(x0, y, z0, x0 + 2, y + 3, z0 + 2, 31); world.set(x0, y + 1, z0, 22); world.set(x0 + 1, y + 2, z0 + 1, 34); });
  },
  dish(r) {
    stamp(r, r.x + 2, r.z + r.d - 8, 5, 5, 6, (x, y, z) => {
      pfill(x + 2, y, z + 2, x + 3, y + 3, z + 3, 33);
      for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) { const d = Math.hypot(a - 2, b - 2); if (d < 2.6) world.set(x + a, y + 3 + (d > 1.5 ? 1 : 0), z + b, 35); }
      world.set(x + 2, y + 5, z + 2, 25);
    });
  },
};

// Neon City: a lit skyline of towers around the rooftops (only where nothing else was built)
function skylineBackdrop(rng) {
  for (let z = 0; z < D - 4; z += rng.int(3, 5)) {
    for (let side = 0; side < 2; side++) {
      const w = rng.int(3, 6), d = rng.int(3, 5), h = rng.int(6, 15);
      let x0 = side ? rng.int(W - 1 - w - 6, W - 1 - w) : rng.int(0, 6);
      let clear = true;
      for (let zz = z - 1; zz < z + d + 1 && clear; zz++) for (let xx = x0 - 1; xx < x0 + w + 1 && clear; xx++) for (let y = 0; y < H; y++) if (world.get(xx, y, zz) && world.in(xx, y, zz)) { clear = false; break; }
      if (!clear) continue;
      const base = rng.pick([38, 11, 40]), win = rng.pick([37, 26, 27, 37]);
      for (let y = 0; y < h; y++) for (let zz = z; zz < z + d; zz++) for (let xx = x0; xx < x0 + w; xx++) {
        const edge = xx === x0 || xx === x0 + w - 1 || zz === z || zz === z + d - 1;
        world.set(xx, y, zz, edge && y % 2 === 1 && (xx + zz) % 2 === 0 && rng.chance(0.7) ? win : base);
      }
      if (rng.chance(0.4)) world.set(x0 + (w >> 1), h, z + (d >> 1), 25);
    }
  }
}

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

// 3.0: the world mesh is split into z-slabs so a rocket crater only rebuilds the slabs it touched
const CHZ = 12, NCH = Math.ceil(D / CHZ);
const chunks = new Array(NCH).fill(null);
function buildChunk(ci) {
  const arr = [];
  const z0 = ci * CHZ, z1 = Math.min(D, z0 + CHZ);
  for (let z = z0; z < z1; z++)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = world.v[idx(x, y, z)];
        if (!t) continue;
        const col = PAL[t] || [1,1,1];
        const glow = GLOW[t];
        const emitBoost = EMIT[t] ? 1.15 : 1;
        for (let fi = 0; fi < 6; fi++) {
          const d = NDIR[fi];
          if (world.get(x + d[0], y + d[1], z + d[2]) > 0) continue;
          const sh = glow ? 1 + glow * (0.75 + 0.25 * FACE[fi].s) : FACE[fi].s * emitBoost;
          pushFace(arr, x, y, z, fi, col, sh);
        }
      }
  if (chunks[ci]) gl.deleteBuffer(chunks[ci].buf);
  chunks[ci] = arr.length ? makeMesh(arr) : null;
}
function rebuildWorldMesh() { for (let i = 0; i < NCH; i++) buildChunk(i); }
function rebuildRange(z0, z1) {
  const a = clamp(Math.floor((z0 - 1) / CHZ), 0, NCH - 1), b = clamp(Math.floor((z1 + 1) / CHZ), 0, NCH - 1);
  for (let i = a; i <= b; i++) buildChunk(i);
  minimapDirty = true;
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
let rockets = [], beams = [], waves = [];
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

let TH = null;                          // active handcrafted level (null = classic random course)
const hardMask = new Uint8Array(W * H * D); // structural voxels (walls/floors) that explosions can't remove
let craters = [];

function generate(seed, lvl) {
  G.seed = seed >>> 0;
  lvl = clamp(lvl | 0, 0, LEVELS.length - 1);
  G.level = lvl;
  const L = LEVELS[lvl];
  TH = lvl ? L : null;
  const rng = new RNG(G.seed);
  G.sky = TH ? L.sky : SKIES[rng.int(0, SKIES.length - 1)];
  world.clear();
  enemies = [];
  bolts = [];
  pickups = [];
  parts = [];
  rooms = [];
  rockets = []; beams = []; waves = []; craters = [];
  const U = TH ? L.under : 2;

  const wallSets = [[5,3],[6,3],[7,3],[8,3],[4,18],[13,3],[12,17]];
  let cx = 26;
  let cz = 3;
  let fy = TH ? (L.fy || 1) : 1;

  function doorX(room, width) {
    return clamp((room.x + (room.w >> 1)) - (width >> 1), room.x + 1, room.x + room.w - width - 1);
  }

  function addRoom(rw, rd, type) {
    rw |= 0; rd |= 0;
    const x = clamp((cx - (rw >> 1)) | 0, 2, W - rw - 2);
    const z = cz | 0;
    const r = { x, z, w: rw, d: rd, fy, type, walls: rng.pick(wallSets), idx: rooms.length, spec: {} };
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

  const corrs = [];
  if (!TH) {
    addRoom(12, 10, "start");
    const nRooms = rng.int(5, 7);
    const pool = ["arena", "hall", "court", "ramp", "choke", "arena"];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
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
    addRoom(12, 12, "extract");
  } else {
    addRoom(12, 10, "start").spec = L.start || {};
    for (const s of L.rooms) {
      corrs.push(addCorr(s.corr || 7, s.cw || 4, clamp(cx + (s.dx || 0), 12, W - 12)));
      const r = addRoom(s.w, s.d, s.t);
      r.spec = s;
      if (s.t === "ramp") { r.rise = s.rise || 1; fy += r.rise; }
    }
    corrs.push(addCorr(7, 4, clamp(cx, 14, W - 14)));
    addRoom(12, 12, "extract").spec = L.exit || {};
  }

  // ---------- 1) structure: floors, walls, ceilings, doors (these are "hard": rockets can't remove them) ----------
  function paintRoom(r) {
    const S = r.spec;
    const [wall, trim] = TH ? (S.walls || L.walls) : r.walls;
    r.wall = wall; r.trim = trim;
    r.door = doorX(r, 3);
    const outdoor = TH ? (S.outdoor !== undefined ? S.outdoor : (L.outdoor || r.type === "court")) : r.type === "court";
    r.outdoor = outdoor;
    const ceilH = outdoor ? 8 : (S.ceil || (TH && L.ceil) || 6);
    const wallH = outdoor ? (S.wallH || (TH && L.parapet) || 3) : ceilH;
    r.ceilY = r.fy + ceilH;
    let fa, fb;
    if (!TH) {
      const floorT = r.type === "extract" ? 9 : outdoor ? 1 : r.type === "start" ? 15 : rng.chance(0.35) ? 17 : 1;
      fa = floorT; fb = floorT === 1 ? 17 : floorT === 9 ? 7 : 2;
      if (r.type === "extract") fb = 9;
    } else {
      [fa, fb] = S.floor || (outdoor && L.floorOut) || L.floor;
    }
    for (let z = r.z; z < r.z + r.d; z++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        world.set(x, r.fy, z, ((x + z) & 1) ? fa : fb);
        for (let y = 0; y < r.fy; y++) world.set(x, y, z, U);
        if (!outdoor) world.set(x, r.fy + ceilH, z, TH ? (L.ceilMat || trim) : trim);
        else if (!TH && rng.chance(0.04)) world.set(x, r.fy + 1, z, 12);
      }
    }
    for (let z = r.z; z < r.z + r.d; z++) {
      for (let y = r.fy + 1; y <= r.fy + wallH; y++) {
        world.set(r.x, y, z, wall);
        world.set(r.x + r.w - 1, y, z, wall);
        if (y === r.fy + wallH && (!outdoor || TH)) {
          world.set(r.x, y, z, trim);
          world.set(r.x + r.w - 1, y, z, trim);
        }
      }
    }
    for (let x = r.x; x < r.x + r.w; x++) {
      for (let y = r.fy + 1; y <= r.fy + wallH; y++) {
        const t = TH && y === r.fy + wallH ? trim : wall;
        world.set(x, y, r.z, t);
        world.set(x, y, r.z + r.d - 1, t);
      }
    }
    if (TH && !outdoor && L.light) { // ceiling light strips
      for (let z = r.z + 2; z < r.z + r.d - 1; z += 4) for (let x = r.x + 2; x < r.x + r.w - 2; x++) if (x % 3) world.set(x, r.fy + ceilH, z, L.light);
    }
    if (TH && outdoor && L.under === 38) { // Neon City: lit windows on the building below each rooftop
      for (let y = 1; y < r.fy; y++) for (let z = r.z; z < r.z + r.d; z++) for (const x of [r.x, r.x + r.w - 1]) if (y % 2 === 0 && (z % 3) === 1) world.set(x, y, z, rng.chance(0.75) ? 37 : 26);
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
      const stair = TH ? L.stair : 4;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const yy = (r.fy + rise * t + 0.001) | 0;
        const zz = z0 + i;
        for (let x = lane; x < lane + 3; x++) {
          for (let y = 0; y <= yy; y++) world.set(x, y, zz, y === yy ? stair : U);
          for (let y = yy + 1; y < yy + 4; y++) world.set(x, y, zz, 0);
        }
      }
      for (let z = z0 + steps; z < r.z + r.d; z++) {
        for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
          world.set(x, fyOut, z, TH ? (((x + z) & 1) ? fa : fb) : 4);
          for (let y = 0; y < fyOut; y++) world.set(x, y, z, U);
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
      const pil = TH ? L.pillar : 4;
      for (let z = r.z + 3; z < r.z + r.d - 3; z += 3) {
        world.fill(r.x + 2, r.fy + 1, z, r.x + 3, r.fy + 5, z + 1, pil);
        world.fill(r.x + r.w - 3, r.fy + 1, z, r.x + r.w - 2, r.fy + 5, z + 1, pil);
      }
    }

    if (r.type === "extract") {
      const px = r.x + (r.w >> 1) - 2, pz = r.z + r.d - 6;
      world.fill(px, r.fy, pz, px + 4, r.fy + 1, pz + 4, 9);
      const lamp = TH ? L.lamp : 14;
      world.set(px, r.fy + 1, pz, lamp);
      world.set(px + 3, r.fy + 1, pz, lamp);
      world.set(px, r.fy + 1, pz + 3, lamp);
      world.set(px + 3, r.fy + 1, pz + 3, lamp);
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
      const lamp = TH ? L.lamp : 14;
      world.set(r.x + 2, r.fy + 1, r.z + 2, lamp);
      world.set(r.x + r.w - 3, r.fy + 1, r.z + 2, lamp);
    }
  }

  function paintCorr(c) {
    const C = TH ? L.corr : { a: 3, b: 15, wall: 5, ceil: 3 };
    for (let i = 0; i < c.len; i++) {
      const t = (i + 0.5) / c.len;
      const mx = (c.fromX + (c.toX - c.fromX) * t) | 0;
      const z = c.z0 + i;
      const x0 = mx - (c.wid >> 1);
      for (let x = x0; x < x0 + c.wid; x++) {
        world.set(x, c.fy, z, ((x + z) & 1) ? C.a : C.b);
        if (!C.open) for (let y = 0; y < c.fy; y++) world.set(x, y, z, U);
        if (!C.open) world.set(x, c.fy + 4, z, C.ceil);
        for (let y = c.fy + 1; y <= c.fy + 3; y++) world.set(x, y, z, 0);
      }
      for (let y = c.fy + 1; y <= c.fy + (C.open ? 2 : 4); y++) {
        world.set(x0 - 1, y, z, C.wall);
        world.set(x0 + c.wid, y, z, C.wall);
      }
      if (C.open) { world.set(x0 - 1, c.fy, z, 40); world.set(x0 + c.wid, c.fy, z, 40); }
    }
  }

  rooms.forEach(paintRoom);
  corrs.forEach(paintCorr);

  // lamps along corridors
  corrs.forEach((c) => {
    if (TH && L.corr.open) return;
    const mx = (c.fromX + c.toX) >> 1;
    world.set(mx, c.fy + 3, c.z0 + (c.len >> 1), TH ? L.corr.lamp : 14);
  });
  if (TH && L.backdrop === "skyline") skylineBackdrop(rng);

  // everything so far is structural
  for (let i = 0; i < hardMask.length; i++) hardMask[i] = world.v[i] ? 1 : 0;

  // ---------- 2) props & cover (destructible) ----------
  for (const r of rooms) {
    const S = r.spec;
    const [wall] = [r.wall];
    const covers = TH ? (S.covers || 0) : r.type === "arena" ? rng.int(5, 9) : r.type === "court" ? rng.int(3, 6) : rng.int(2, 4);
    if (r.type !== "start" && r.type !== "extract" && r.type !== "ramp") {
      for (let i = 0; i < covers; i++) {
        const cw = rng.int(1, 2), cd = rng.int(1, 2), ch = rng.int(1, 2);
        const cxb = rng.int(r.x + 2, r.x + r.w - 3 - cw);
        const czb = rng.int(r.z + 3, r.z + r.d - 4 - cd);
        if (Math.abs((cxb + cw / 2) - (r.x + r.w / 2)) < 1.2) continue;
        if (TH && !propFree(r, cxb, czb, cw, cd, ch)) continue;
        world.fill(cxb, r.fy + 1, czb, cxb + cw, r.fy + 1 + ch, czb + cd, TH ? rng.pick(L.cover) : rng.pick([wall, 4, 7, 11]));
      }
    }
    if (!TH && r.outdoor) {
      for (let i = 0; i < rng.int(2, 4); i++) {
        const tx = rng.int(r.x + 2, r.x + r.w - 3);
        const tz = rng.int(r.z + 3, r.z + r.d - 4);
        world.fill(tx, r.fy + 1, tz, tx + 1, r.fy + 3, tz + 1, 18);
        world.fill(tx - 1, r.fy + 3, tz - 1, tx + 2, r.fy + 5, tz + 2, 12);
      }
    }
    if (TH && S.deco) for (const name of S.deco) if (DECO[name]) DECO[name](r, rng, L);
  }

  // ---------- 3) enemies, pickups, checkpoints ----------
  const Dd = DIFFS[G.diff];
  for (const r of rooms) {
    if (r.type === "start" || r.type === "extract") continue;
    const S = r.spec;
    // 0 at the first combat room → 1 at the last: early rooms are gentle, the end is a fight.
    const ramp = clamp((r.idx - 1) / Math.max(1, rooms.length - 3), 0, 1);
    const plan = [];
    if (TH) {
      // designed for NORMAL (trimmed a bit so Normal stays fair); EASY fewer, HARD ~2x
      const k = (G.diff === 2 ? 1.7 : Dd.count / DIFFS[1].count * 0.85) * NET.enemyMul;
      for (const [kind, n] of (S.en || [])) {
        const c = kind === "boss" ? 1 : Math.max(1, Math.round(n * k));
        for (let i = 0; i < c; i++) plan.push(kind);
      }
      if (G.diff < 2 && plan.length >= 4) plan.pop(); // keep Easy/Normal fair: big rooms lose one bot
    } else {
      const base = r.type === "arena" ? rng.int(3, 5) : r.type === "hall" ? rng.int(2, 3) : rng.int(1, 3);
      const nEn = Math.max(1, Math.round(base * Dd.count * (0.55 + 0.6 * ramp) * NET.enemyMul)); // co-op: a few more bots per extra player
      let tanks = 0, brutes = 0;
      for (let i = 0; i < nEn; i++) {
        let kind = rng.chance(0.3 + 0.25 * ramp) ? "shoot" : "melee";
        if (ramp > 0.3 && rng.chance(0.2)) kind = "drone";
        // 3.0 newcomers show up in random courses too (gently on Easy)
        if (ramp > 0.2 && rng.chance(G.diff === 0 ? 0.12 : 0.22)) kind = rng.pick(["grey", "seeker", "turret"]);
        if (ramp > 0.5 && brutes < 1 && rng.chance(G.diff === 0 ? 0.05 : 0.12)) { kind = "brute"; brutes++; }
        const tankOk = G.diff === 0 ? r.idx === rooms.length - 2 : ramp > 0.55;
        if (tankOk && tanks < (G.diff === 2 ? 2 : 1) && rng.chance(G.diff === 0 ? 0.5 : 0.25)) { kind = "tank"; tanks++; }
        plan.push(kind);
      }
    }
    const gy = r.fy + (r.rise > 0 ? 0 : 0);
    for (const kind of plan) {
      const st = EN[kind];
      let placed = false;
      for (let guard = 0; guard < 60 && !placed; guard++) {
        let ex = rng.f(r.x + 2, r.x + r.w - 2);
        let ez = rng.f(r.z + 4, r.z + r.d - 3);
        if (kind === "turret") ez = rng.f(r.z + r.d * 0.5, r.z + r.d - 3);
        if (kind === "boss") { ex = r.x + r.w / 2 + rng.f(-1, 1); ez = r.z + r.d * 0.62; }
        const g = groundY(ex | 0, ez | 0, r);
        const ey = g + 1.01;
        if (world.get(ex, g, ez) === 29 || !world.solid(ex, g, ez)) continue;
        if (aabbSolid(ex, ey, ez, st.hw, st.h)) continue;
        if (st.fly && (world.solid(ex, g + 2.4, ez) || world.solid(ex, g + 3.2, ez))) continue;
        const e = makeEnemy(kind, ex, ey, ez, r, rng);
        if (st.fly) e.y = g + (kind === "seeker" ? 2.2 : 2.4);
        placed = true;
        if (kind === "boss") {
          r.boss = true;
          // the OVERSEER's backup: dormant greys it warps in mid-fight (pre-placed so co-op stays in sync)
          const nMin = [3, 5, 7][G.diff] + (NET.n > 1 ? 2 : 0);
          for (let i = 0; i < nMin; i++) {
            const m = makeEnemy("grey", r.x + r.w / 2, ey, r.z + r.d / 2, r, rng);
            m.dormant = true;
          }
        }
      }
    }
    // pickups: generous on Easy, a bit scarcer on Hard
    const spot = () => {
      for (let k = 0; k < 20; k++) {
        const px = rng.f(r.x + 2, r.x + r.w - 2), pz = rng.f(r.z + 2, r.z + r.d - 2);
        const g = groundY(px | 0, pz | 0, r);
        if (!world.solid(px, g + 1.2, pz) && world.get(px, g, pz) !== 29) return { x: px, z: pz, y: g + 1.4 };
      }
      return { x: r.door + 1.5, z: r.z + r.d / 2, y: groundY(r.door + 1, (r.z + r.d / 2) | 0, r) + 1.4 };
    };
    const addPick = kind => { const s = spot(); pickups.push({ x: s.x, y: s.y, z: s.z, kind, alive: true, t: rng.f(0, 5), id: pickups.length }); };
    if (G.diff === 0) { addPick("ammo"); if (rng.chance(0.65)) addPick("health"); if (rng.chance(0.3)) addPick("gem"); }
    else if (rng.chance(G.diff === 1 ? 0.9 : 0.6)) {
      const roll = rng.next();
      addPick(roll < 0.45 ? "ammo" : roll < (G.diff === 1 ? 0.8 : 0.66) ? "health" : "gem");
      if (r.type === "arena" && rng.chance(G.diff === 1 ? 0.5 : 0.3)) addPick(rng.chance(0.5) ? "ammo" : "health");
    }
    if (r.idx === 2) addPick("scatter");                                  // weapons, early on
    if (TH) { for (const k of (S.pick || [])) addPick(k); }
    else {
      if (r.idx === 3) addPick(rng.pick(["laser", "freeze"]));
      if (r.idx === 4 && r.idx < rooms.length - 1) addPick(rng.pick(["rocket", "laser", "freeze"]));
    }
    if (r.idx === Math.floor(rooms.length / 2) && G.diff < 2) addPick("heart"); // extra life halfway
    // checkpoint just inside the entrance door
    const dx = doorX(r, 3);
    r.cp = { x: dx + 1.5, y: r.fy + 1.01, z: r.z + 1.6, yaw: Math.PI, idx: r.idx, active: false };
  }

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
    else if (name === "laser") { blip(1400, 0.12, "sawtooth", 0.05, 300); blip(700, 0.1, "square", 0.03, 1800); }
    else if (name === "rocket") { blip(160, 0.3, "sawtooth", 0.06, 60); blip(900, 0.15, "triangle", 0.03, 300); }
    else if (name === "boom") { blip(110, 0.45, "sawtooth", 0.11, 30); blip(60, 0.5, "square", 0.07, 30); }
    else if (name === "freeze") { blip(1800, 0.2, "triangle", 0.025, 2600); }
    else if (name === "frozen") { blip(2200, 0.15, "square", 0.04, 3200); blip(1600, 0.2, "triangle", 0.04, 900); }
    else if (name === "warp") { blip(300, 0.25, "sine", 0.06, 1500); }
    else if (name === "roar") { blip(90, 0.5, "sawtooth", 0.08, 55); }
    else if (name === "boss") { blip(70, 0.9, "sawtooth", 0.1, 40); blip(140, 0.9, "square", 0.05, 70); }
    else if (name === "slamUp") { blip(80, 0.9, "sine", 0.08, 400); }
    else if (name === "slam") { blip(55, 0.6, "sawtooth", 0.12, 30); }
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
  if (G.shieldT > 0) { ratShieldPing(); return; } // Ratita BUBBLE SHIELD
  const Dd = DIFFS[G.diff];
  const dmg = Math.max(1, Math.round((amount || DMG.bolt) * Dd.dmg * (STORE.assist ? 0.6 : 1)));
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
  bolts = []; waves = [];
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
  G.hp = maxHp();
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
  if (G.level > 0) { const id = LEVELS[G.level].id; const c = STORE.clear[id] || [0, 0, 0]; c[G.diff] = 1; STORE.clear[id] = c; saveStore(STORE); }
  sfx("win");
  G.score += Math.round((250 + G.lives * 100) * DIFFS[G.diff].score);
  document.exitPointerLock && document.exitPointerLock();
  const b = saveBest();
  showOverlay("win");
  document.querySelector("#win-card .result").textContent = G.level > 0 ? LEVELS[G.level].name + " CLEARED!" : "You made it to the pad.";
  document.getElementById("again-btn").textContent = againLabel();
  document.getElementById("win-stats").textContent = runSummary(b) + "  ·  LIVES LEFT " + G.lives;
  updateHUD();
  if (NET.on) netWinCard();
}

// MIX mode alternates handcrafted levels with random courses; otherwise the picked level
function nextLevel() {
  if (STORE.lvl >= 0) return STORE.lvl;
  const l = MIX_ORDER[STORE.rot % MIX_ORDER.length];
  STORE.rot++; saveStore(STORE);
  return l;
}
function againLabel() { return STORE.lvl < 0 ? "NEXT LEVEL" : STORE.lvl === 0 ? "PLAY AGAIN · NEW COURSE" : "PLAY AGAIN"; }
function startRun(diff, seedArg, lvlArg) {
  if (NET.on && !NET.host && !NET.applying) return; // co-op: only the host starts runs
  if (typeof diff === "number") { G.diff = clamp(diff | 0, 0, 2); if (!NET.on || NET.host) { STORE.diff = G.diff; saveStore(STORE); } }
  const seed = typeof seedArg === "number" ? seedArg : (Math.random() * 0xffffffff) ^ (Date.now() * 2654435761);
  const lvl = typeof lvlArg === "number" ? clamp(lvlArg | 0, 0, LEVELS.length - 1) : nextLevel();
  if (NET.on && NET.host && !NET.applying) netAnnounceRun(seed, lvl);
  generate(seed, lvl);
  G.mode = "play";
  G.lives = MAX_LIVES;
  G.hp = maxHp();
  G.regenT = 0;
  G.score = 0;
  G.kills = 0;
  G.dmgTaken = 0;
  G.ammo = MAG;
  G.reserve = RESERVE_START + DIFFS[G.diff].reserve;
  G.shells = 0; G.cells = 0; G.rockets = 0; G.cryo = 0;
  G.got = [true, false, false, false, false, false, false, false];
  ratStartRun();
  G.weapon = 0; G.lavaT = 0;
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
  toast((G.level > 0 ? LEVELS[G.level].name : "RANDOM COURSE") + " · " + DIFFS[G.diff].name, G.level > 0 ? rgbHex(G.sky.fog.map(v => Math.min(1, v * 2 + 0.35))) : "#1ce0ff");
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
  document.getElementById("ammo-label").textContent = WEAP[G.weapon].name;
  if (G.weapon !== 0) {
    const n = wAmmo(G.weapon);
    ammo.textContent = n + " " + WEAP[G.weapon].unit;
    ammo.className = n <= (G.weapon === 4 ? 20 : 2) ? "low" : "";
  } else if (G.reload > 0) {
    ammo.textContent = "RELOAD";
    ammo.className = "reloading";
  } else {
    ammo.textContent = G.ammo + " / " + G.reserve;
    ammo.className = G.ammo <= 3 ? "low" : "";
  }
  let others = 0, sig = G.weapon + ":";
  for (let i = 0; i < WEAP.length; i++) if (wOwned(i)) { sig += i + "=" + wAmmo(i) + ","; if (i !== G.weapon && wAmmo(i) > 0) others++; }
  const swap = document.getElementById("btn-swap");
  if (swap) swap.classList.toggle("hidden", others === 0);
  const bar = document.getElementById("wbar");
  if (bar && bar.dataset.sig !== sig) {
    bar.dataset.sig = sig;
    let h = "";
    for (let i = 0; i < WEAP.length; i++) if (wOwned(i)) {
      const n = i === 0 ? "∞" : wAmmo(i);
      h += "<button type='button' data-w='" + i + "' class='" + (i === G.weapon ? "on" : "") + (i && !wAmmo(i) ? " empty" : "") + "' style='--c:" + rgbHex(WEAP[i].col) + "'><b>" + (i + 1) + "</b>" + WEAP[i].name + "<i>" + n + "</i></button>";
    }
    bar.innerHTML = h;
    bar.classList.toggle("solo", others === 0 && G.weapon === 0);
  }
  document.getElementById("seed-chip").textContent =
    DIFFS[G.diff].name + " · ROOM " + Math.max(0, G.maxRoom) + "/" + Math.max(1, rooms.length - 2) + " · " + (TH ? TH.short : G.sky.name);
}
let hpShown = -1;
function updateHpBar() {
  const v = Math.max(0, Math.round(G.hp));
  if (v === hpShown) return;
  hpShown = v;
  const fill = document.getElementById("hp-fill");
  const pc = v / maxHp() * 100;
  fill.style.width = pc + "%";
  fill.className = pc < 30 ? "crit" : pc < 60 ? "mid" : "";
}

function tryReload() {
  if (G.weapon !== 0) return;
  if (G.reload > 0 || G.ammo >= MAG || G.reserve <= 0) return;
  G.reload = G.diff === 0 ? 1.0 : 1.25;
  sfx("reload");
  updateHUD();
}

// ---------- 3.0 weapons ----------
const WEAP = [
  { name: "BLASTER", full: "BLASTER", unit: "", col: [0.1, 0.9, 1] },
  { name: "SCATTER", full: "SCATTER GUN", key: "shells", unit: "SHELLS", pick: 8, max: 24, col: [1, 0.5, 0.1] },
  { name: "LASER", full: "LASER RIFLE", key: "cells", unit: "CELLS", pick: 18, max: 54, col: [1, 0.25, 0.75] },
  { name: "ROCKETS", full: "ROCKET LAUNCHER", key: "rockets", unit: "ROCKETS", pick: 4, max: 10, col: [0.45, 0.9, 0.3] },
  { name: "FREEZE", full: "FREEZE RAY", key: "cryo", unit: "CRYO", pick: 60, max: 150, col: [0.45, 0.9, 1] },
  // Ratita Industries Item Pack (DLC)
  { name: "CHEESE", full: "CHEESE CANNON", key: "cheese", unit: "WHEELS", pick: 3, max: 16, col: [1, 0.8, 0.2], rat: true },
  { name: "ZAPPER", full: "SQUEAK ZAPPER", key: "zap", unit: "SQUEAKS", pick: 8, max: 40, col: [0.55, 0.78, 1], rat: true },
  { name: "SNOWIE", full: "SNOWIE SPRAYER", key: "snow", unit: "SNOWBALLS", pick: 30, max: 90, col: [0.88, 0.96, 1], rat: true },
];
const WPICK = { scatter: 1, laser: 2, rocket: 3, freeze: 4 };
function rgbHex(c) { return "#" + c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0")).join(""); }
function wAmmo(i) { return i === 0 ? G.ammo + G.reserve : (G[WEAP[i].key] | 0); }
function wOwned(i) { return i === 0 || (i >= 5 && !ratOwned() ? false : !!(G.got && G.got[i])); }
function switchWeapon(to) {
  if (G.mode !== "play") return;
  let next = to;
  if (typeof to !== "number") {
    next = 0;
    for (let k = 1; k <= WEAP.length; k++) { const i = (G.weapon + k) % WEAP.length; if (wOwned(i) && wAmmo(i) > 0) { next = i; break; } }
  } else if (!WEAP[to]) return;
  else if (!wOwned(to)) { toast(WEAP[to].full + " NOT FOUND YET", "#ff9a6b"); return; }
  else if (to !== 0 && wAmmo(to) <= 0) { toast("NO " + WEAP[to].unit, "#ff9a6b"); return; }
  if (next === G.weapon) return;
  G.weapon = next; G.reload = 0; G.shotCd = 0.2;
  sfx("reload");
  updateHUD();
}
function emptyBack() { toast(WEAP[G.weapon].name + " EMPTY · BACK TO BLASTER", "#ff9a6b"); G.weapon = 0; }

// Aim assist: nudge the shot toward a bot that's very close to the crosshair (bigger on phones / Easy).
function assistDir(o, d) {
  let cone = DIFFS[G.diff].assist + (isTouchPlay() ? 0.035 : 0) + (STORE.assist ? 0.12 : 0);
  let best = null, bestA = cone;
  for (const e of enemies) {
    if (e.hp <= 0 || e.dormant) continue;
    const cy = ctrY(e);
    const vx = e.x - o.x, vy = cy - o.y, vz = e.z - o.z, L = Math.hypot(vx, vy, vz);
    if (L > 30 || L < 0.5) continue;
    const a = Math.acos(clamp((vx * d.x + vy * d.y + vz * d.z) / L, -1, 1));
    if (a < bestA && los(o.x, o.y, o.z, e.x, cy, e.z)) { bestA = a; best = { x: vx / L, y: vy / L, z: vz / L }; }
  }
  return best || d;
}

// ---------- enemy roster ----------
// box: [half-width, bottom, top] relative to e.x/e.y/e.z
const EN = {
  shoot:  { hp: 3, hw: 0.32, h: 1.3, box: [0.38, 0, 1.35], score: 100, eye: 0.9, shotY: 0.9, mm: "#b44bff" },
  melee:  { hp: 2, hw: 0.32, h: 1.3, box: [0.38, 0, 1.35], score: 100, eye: 0.9, shotY: 0.9, mm: "#ff3d6e" },
  drone:  { hp: 1, hw: 0.32, h: 0.6, box: [0.38, -0.1, 0.6], score: 120, eye: 0.3, shotY: 0.25, fly: true, mm: "#1ad9bf" },
  tank:   { hp: 7, hw: 0.5, h: 1.7, box: [0.55, 0, 1.7], score: 300, eye: 1.3, shotY: 1.1, mm: "#ff8c1a" },
  grey:   { hp: 3, hw: 0.3, h: 1.5, box: [0.34, 0, 1.55], score: 150, eye: 1.25, shotY: 1.05, mm: "#7dff8a" },
  seeker: { hp: 2, hw: 0.36, h: 0.5, box: [0.44, -0.05, 0.45], score: 140, eye: 0.2, shotY: 0.12, fly: true, mm: "#fff56a" },
  brute:  { hp: 9, hw: 0.55, h: 1.9, box: [0.66, 0, 2.0], score: 260, eye: 1.6, shotY: 1.4, mm: "#6fd13a" },
  turret: { hp: 5, hw: 0.4, h: 1.2, box: [0.45, 0, 1.3], score: 180, eye: 1.0, shotY: 0.95, mm: "#c8d0dc" },
  boss:   { hp: 60, hw: 0.8, h: 3.0, box: [0.95, 0.3, 3.3], score: 2500, eye: 2.4, shotY: 2.0, mm: "#ff5ad9" },
};
const BOLT_COL = [[1, 0.35, 0.15], [0.35, 1, 0.4], [1, 0.12, 0.2], [1, 0.9, 0.2], [0.9, 0.3, 1]];
const BOLT_CI = { grey: 1, turret: 2, seeker: 3, boss: 4 };
function ctrY(e) { const b = EN[e.kind].box; return e.y + (b[1] + b[2]) / 2; }
function makeEnemy(kind, x, y, z, r, rng) {
  const st = EN[kind], Dd = DIFFS[G.diff];
  let hp = st.hp + ((kind === "tank" || kind === "brute") ? NET.tankHp : 0);
  if (kind === "boss") hp = Math.round([45, 65, 120][G.diff] * (1 + 0.55 * Math.max(0, (NET.n || 1) - 1)));
  const elite = G.diff === 2 && kind !== "boss" && rng.chance(Dd.elite);
  if (elite) hp = Math.ceil(hp * 1.6);
  const sp0 = kind === "melee" ? rng.f(2.2, 3.0) : kind === "tank" ? 1.1 : kind === "drone" ? 2.6 : kind === "seeker" ? 3.0
    : kind === "brute" ? 1.7 : kind === "grey" ? 1.9 : kind === "turret" ? 0 : kind === "boss" ? 1.8 : rng.f(1.4, 2.0);
  const e = {
    x, y, z, vx: 0, vy: 0, vz: 0, hp, maxHp: hp, id: enemies.length, kind, fly: !!st.fly, elite,
    cd: rng.f(0.8, 1.8), yaw: rng.f(0, Math.PI * 2), hit: 0, bob: rng.f(0, 10), windup: 0, windMax: 1, alert: false, alertT: 0, see: false, losT: rng.f(0, 0.2),
    strafe: rng.chance(0.5) ? 1 : -1, room: r.idx, speed: sp0 * (kind === "boss" ? 1 : Dd.spd) * (elite ? 1.15 : 1),
    frost: 0, frozenT: 0, tp: rng.f(2, 4), burst: 0, burstT: 0, sumI: 0,
  };
  enemies.push(e);
  return e;
}
function enemyBox(e) {
  const b = EN[e.kind].box;
  return [e.x - b[0], e.y + b[1], e.z - b[0], e.x + b[0], e.y + b[2], e.z + b[0]];
}
function bossAlive() { for (const e of enemies) if (e.kind === "boss" && e.hp > 0) return e; return null; }

function fireRay(o, d, dmg) {
  const maxd = 48;
  const vhit = traceVoxels(o, d, maxd);
  let bestT = vhit ? vhit.t : maxd;
  let bestE = null;
  for (const e of enemies) {
    if (e.hp <= 0 || e.dormant) continue;
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
// LASER RIFLE: pierces through up to 5 enemies in a line
function fireLaser(o, d, dmg) {
  const vhit = traceVoxels(o, d, 60), maxT = vhit ? vhit.t : 60;
  const hits = [];
  for (const e of enemies) {
    if (e.hp <= 0 || e.dormant) continue;
    const b = enemyBox(e);
    const t = rayAABB(o, d, b[0], b[1], b[2], b[3], b[4], b[5], maxT);
    if (t !== null) hits.push([t, e]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  for (const [t, e] of hits.slice(0, 5)) damageEnemy(e, dmg, o.x + d.x * t, o.y + d.y * t, o.z + d.z * t);
  const h = [o.x + d.x * maxT, o.y + d.y * maxT, o.z + d.z * maxT];
  if (vhit) burst(h[0], h[1], h[2], [1, 0.4, 0.85], 5, 3);
  NET.lastHit = h;
  return h;
}
// FREEZE RAY: short-range stream, chills the first enemy it touches; enough chill = frozen solid (and 1.5x damage)
function fireFreeze(o, d) {
  const R = 10, vhit = traceVoxels(o, d, R);
  let bestT = vhit ? vhit.t : R, best = null;
  for (const e of enemies) {
    if (e.hp <= 0 || e.dormant) continue;
    const b = enemyBox(e);
    const t = rayAABB(o, d, b[0] - 0.25, b[1] - 0.2, b[2] - 0.25, b[3] + 0.25, b[4] + 0.2, b[5] + 0.25, bestT);
    if (t !== null && t < bestT) { bestT = t; best = e; }
  }
  const h = [o.x + d.x * bestT, o.y + d.y * bestT, o.z + d.z * bestT];
  if (best) {
    if (NET.on && !NET.host) { netSend({ t: "frz", id: best.id }); best.frost = (best.frost || 0) + 1; }
    else applyFrost(best);
    damageEnemy(best, 0.34, h[0], h[1], h[2], undefined, true);
    if (Math.random() < 0.4) burst(h[0], h[1], h[2], [0.7, 0.95, 1], 3, 2);
  }
  NET.lastHit = h;
  return h;
}
function applyFrost(e) { // host / solo
  if (!e || e.hp <= 0) return;
  e.frost = (e.frost || 0) + 1;
  if (e.kind === "boss") { e.frost = Math.min(e.frost, 4); return; }
  if (e.frozenT > 0) { e.frozenT = Math.min(3.2, e.frozenT + 0.12); e.frost = 0; return; }
  const need = (e.kind === "brute" || e.kind === "tank" ? 9 : 6) * (e.elite ? 1.4 : 1);
  if (e.frost >= need) {
    e.frozenT = G.diff === 2 ? 1.8 : 2.8; e.frost = 0;
    e.windup = 0; e.burst = 0; e.chargeT = 0; e.blink = 0; e.volley = 0;
    sfx("frozen");
  }
}

function damageEnemy(e, dmg, hx, hy, hz, by, quiet) {
  // co-op: "by" is set when the host applies a partner's hit (their own screen already showed it)
  const remote = NET.on && by !== undefined && by !== NET.pid;
  if (NET.on && !NET.host && !remote) { netSend({ t: "dmg", id: e.id, d: dmg, q: quiet ? 1 : 0 }); e.predT = performance.now(); }
  if (e.frozenT > 0 && !quiet && (!NET.on || NET.host)) dmg *= 1.5; // shatter bonus
  if (e.kind === "boss" && (!NET.on || NET.host)) e.awake = true;
  e.hp -= dmg;
  e.hit = quiet ? Math.max(e.hit, 0.04) : 0.15;
  e.alert = true;
  if (!remote && !quiet) {
    G.hitmark = 0.12;
    G.score += Math.round(25 * DIFFS[G.diff].score);
    sfx("hit");
  }
  if (!quiet) burst(hx, hy, hz, [1, 0.3, 0.2], 6, 4);
  if (e.hp <= 0) {
    if (!remote) {
      G.kills++;
      G.score += Math.round(EN[e.kind].score * (e.elite ? 1.5 : 1) * DIFFS[G.diff].score);
      sfx("kill");
    }
    killFx(e);
    if (NET.on && !NET.host) return; // the host rolls drops and confirms the kill
    if (NET.on) netBroadcast({ t: "kill", id: e.id, by: by || NET.pid });
    // drops
    const Dd = DIFFS[G.diff], dropY = (e.fly ? e.y - 1.2 : e.y) + 0.4, big = e.kind === "tank" || e.kind === "brute" || e.kind === "boss";
    if (Math.random() < Dd.drop || big) netDrop({ x: e.x, y: dropY, z: e.z, kind: "ammo", alive: true, t: 0, small: !big });
    if (Math.random() < Dd.hpDrop || (big && G.diff < 2) || e.kind === "boss") netDrop({ x: e.x + 0.4, y: dropY, z: e.z + 0.3, kind: "health", alive: true, t: 1, small: e.kind !== "boss" });
    if (e.kind === "boss") netDrop({ x: e.x - 0.5, y: dropY, z: e.z - 0.4, kind: "gem", alive: true, t: 2 });
  }
}
function killFx(e) {
  if (e.fxDone) return;
  e.fxDone = true;
  const big = e.kind === "tank" || e.kind === "brute" || e.kind === "boss";
  burst(e.x, ctrY(e), e.z, e.kind === "tank" ? [1, 0.6, 0.1] : e.kind === "grey" ? [0.4, 1, 0.5] : e.kind === "brute" ? [0.5, 0.9, 0.2] : e.frozenT > 0 ? [0.7, 0.95, 1] : [1, 0.2, 0.45], big ? 30 : 16, 6);
  if (e.kind === "boss") {
    for (let i = 0; i < 4; i++) burst(e.x + (Math.random() - 0.5) * 2, e.y + 1 + Math.random() * 2, e.z + (Math.random() - 0.5) * 2, [0.9, 0.3, 1], 30, 8);
    G.shake = Math.max(G.shake, 0.6);
    sfx("boom"); sfx("win");
    toast("OVERSEER DEFEATED! · GET TO THE PAD", "#ff5ad9");
    // its backup teleports out with it
    for (const m of enemies) if (m.dormant) m.hp = 0;
  }
}

// gun muzzle in world space (for beams)
function gunTip(o) {
  const f = forward(), rx = Math.cos(P.yaw), rz = Math.sin(P.yaw);
  if (cam3On()) return [P.x + f.x * 1.2 + rx * 0.34, P.y + 1.0 + f.y * 1.2, P.z + f.z * 1.2 + rz * 0.34]; // the avatar's gun
  return [o.x + f.x * 0.45 + rx * 0.22, o.y + f.y * 0.45 - 0.22, o.z + f.z * 0.45 + rz * 0.22];
}
function addBeam(a, h, c, t, w) { beams.push({ o: a, h, c, t, t0: t, w }); }

function shoot() {
  if (G.mode !== "play" || NET.down || NET.menu) return;
  const o = eyePos();
  const d0 = aimFwd(); // forward(), or the 3rd-person crosshair ray
  o.x += d0.x * 0.2; o.y += d0.y * 0.2; o.z += d0.z * 0.2;
  const w = G.weapon;
  if (w !== 0 && wAmmo(w) <= 0) { emptyBack(); updateHUD(); return; }
  if (w === 1) {
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
    if (G.shells <= 0) emptyBack();
    if (NET.on) netShot(o, 1);
    updateHUD();
    return;
  }
  if (w === 2) { // LASER RIFLE
    G.cells--;
    G.muzzle = 0.08; G.recoil = 0.16; G.shotCd = 0.32; G.shake = Math.max(G.shake, 0.1);
    sfx("laser");
    const h = fireLaser(o, assistDir(o, d0), 2);
    addBeam(gunTip(o), h, [1, 0.3, 0.8], 0.14, 0.08);
    if (NET.on) netShot(o, 2);
    if (G.cells <= 0) emptyBack();
    updateHUD();
    return;
  }
  if (w === 3) { // ROCKET LAUNCHER
    G.rockets--;
    G.muzzle = 0.1; G.recoil = 0.42; G.shotCd = 0.95; G.shake = Math.max(G.shake, 0.22);
    sfx("rocket");
    const d = assistDir(o, d0), g = gunTip(o), S = 22;
    rockets.push({ x: g[0], y: g[1], z: g[2], vx: d.x * S, vy: d.y * S, vz: d.z * S, life: 2.5, mine: true });
    if (NET.on) netEvent({ t: "rk", o: g.map(nr2), v: [nr2(d.x * S), nr2(d.y * S), nr2(d.z * S)] });
    if (G.rockets <= 0) emptyBack();
    updateHUD();
    return;
  }
  if (w === 4) { // FREEZE RAY (hold)
    G.cryo--;
    G.shotCd = 0.1; G.recoil = Math.max(G.recoil, 0.05);
    if (!G.frzSnd || G.time - G.frzSnd > 0.22) { sfx("freeze"); G.frzSnd = G.time; }
    const h = fireFreeze(o, assistDir(o, d0));
    addBeam(gunTip(o), h, [0.65, 0.95, 1], 0.12, 0.1);
    if (NET.on && (G.frzNet = (G.frzNet || 0) + 1) % 2 === 0) netShot(o, 4);
    if (G.cryo <= 0) emptyBack();
    updateHUD();
    return;
  }
  if (w >= 5) { ratShoot(w, o, d0); return; } // Ratita Industries weapons
  if (G.reload > 0) return;
  if (G.ammo <= 0) { tryReload(); return; }
  G.ammo--;
  G.muzzle = 0.07;
  G.recoil = 0.12;
  G.shotCd = 0.16;
  G.shake = Math.max(G.shake, 0.08);
  sfx("shoot");
  fireRay(o, assistDir(o, d0), 1);
  if (NET.on) netShot(o, 0);
  if (G.ammo <= 0) tryReload();
  updateHUD();
}

// ---------- rockets / explosions (voxel destruction) ----------
function updateRockets(dt) {
  for (const r of rockets) {
    if (r.dead) continue;
    r.life -= dt;
    for (let i = 0; i < 3 && !r.dead; i++) {
      if (r.cheese) r.vy -= 10 * dt / 3; // cheese wheels arc
      r.x += r.vx * dt / 3; r.y += r.vy * dt / 3; r.z += r.vz * dt / 3;
      if (world.solid(r.x, r.y, r.z) || r.life <= 0) { rocketHit(r); break; }
      if (r.mine) for (const e of enemies) {
        if (e.hp <= 0 || e.dormant) continue;
        const b = enemyBox(e);
        if (r.x > b[0] - 0.15 && r.x < b[3] + 0.15 && r.y > b[1] - 0.15 && r.y < b[4] + 0.15 && r.z > b[2] - 0.15 && r.z < b[5] + 0.15) { r.direct = e; rocketHit(r); break; }
      }
    }
    if (!r.dead && !r.cheese) parts.push({ x: r.x, y: r.y, z: r.z, vx: (Math.random() - 0.5), vy: 1.2, vz: (Math.random() - 0.5), life: 0.35, col: Math.random() < 0.5 ? [1, 0.6, 0.15] : [0.6, 0.6, 0.65], s: 0.12 });
  }
  rockets = rockets.filter(r => !r.dead);
}
function rocketHit(r) {
  r.dead = true;
  if (r.cheese) { ratCheeseHit(r); return; }
  if (!r.mine) return; // a partner's rocket: their "boom" message brings the explosion
  const p = [nr2(r.x - r.vx * 0.012), nr2(r.y - r.vy * 0.012), nr2(r.z - r.vz * 0.012)];
  applyBoom(p[0], p[1], p[2]);
  if (NET.on) netEvent({ t: "boom", p });
  for (const e of enemies) {
    if (e.hp <= 0 || e.dormant) continue;
    const d = Math.hypot(e.x - p[0], ctrY(e) - p[1], e.z - p[2]) - EN[e.kind].box[0] * 0.5;
    if (d > 2.9) continue;
    const dmg = Math.max(1, Math.round(5 * (1 - Math.max(0, d) / 2.9))) + (r.direct === e ? 2 : 0);
    damageEnemy(e, dmg, e.x, ctrY(e), e.z);
  }
}
function applyBoom(x, y, z, silent) {
  const R = 1.75;
  let changed = false;
  for (let zz = Math.floor(z - R); zz <= Math.floor(z + R); zz++)
    for (let yy = Math.floor(y - R); yy <= Math.floor(y + R); yy++)
      for (let xx = Math.floor(x - R); xx <= Math.floor(x + R); xx++) {
        if (!world.in(xx, yy, zz)) continue;
        const i = idx(xx, yy, zz), t = world.v[i];
        if (!t || hardMask[i] || t === 9) continue;
        if (Math.hypot(xx + 0.5 - x, yy + 0.5 - y, zz + 0.5 - z) > R) continue;
        if (!silent) burst(xx + 0.5, yy + 0.5, zz + 0.5, PAL[t] || [1, 1, 1], 3, 5);
        world.v[i] = 0; changed = true;
      }
  if (changed) { rebuildRange(Math.floor(z - R), Math.floor(z + R)); craters.push([x, y, z]); }
  if (silent) return;
  burst(x, y, z, [1, 0.6, 0.15], 26, 7); burst(x, y, z, [1, 0.95, 0.5], 12, 4);
  sfx("boom");
  const dP = Math.hypot(P.x - x, P.y + 1 - y, P.z - z);
  if (dP < 9) G.shake = Math.max(G.shake, 0.4 * (1 - dP / 9));
}

function los(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const L = Math.hypot(dx, dy, dz) || 1;
  const hit = traceVoxels({ x: ax, y: ay, z: az }, { x: dx / L, y: dy / L, z: dz / L }, L - 0.4);
  return !hit;
}

// How far into the run we are (0..1). Difficulty ramps with it.
function runRamp() { return clamp(G.maxRoom / Math.max(1, rooms.length - 2), 0, 1); }

function fireBolt(e, yawOff, dmg, T, spdMul) {
  const Dd = DIFFS[G.diff], t = runRamp();
  const sy = e.y + EN[e.kind].shotY + (e.kind === "boss" ? 0.4 : 0);
  const tg = T || P; // co-op: shoot at the chosen target
  const spd = (Dd.bolt[0] + (Dd.bolt[1] - Dd.bolt[0]) * t) * (e.kind === "drone" || e.kind === "seeker" ? 1.15 : e.kind === "turret" ? 1.25 : e.kind === "boss" ? 0.75 : 1) * (spdMul || 1);
  let tx = tg.x, tz = tg.z;
  if (Dd.lead) { // HARD: bots lead their shots
    const tt = Math.hypot(tg.x - e.x, tg.z - e.z) / spd * Dd.lead;
    tx += (tg.vx || 0) * tt; tz += (tg.vz || 0) * tt;
  }
  const ddx = tx - e.x, ddy = (tg.y + 1.1) - sy, ddz = tz - e.z;
  const L = Math.hypot(ddx, ddy, ddz) || 1;
  // aim error: wide early / on Easy, tighter later
  const spread = Dd.spread[0] + (Dd.spread[1] - Dd.spread[0]) * t;
  const yaw = Math.atan2(ddx, ddz) + (yawOff || 0) + (Math.random() - 0.5) * 2 * spread;
  const pitch = Math.asin(clamp(ddy / L, -1, 1)) + (Math.random() - 0.5) * 1.2 * spread;
  bolts.push({
    x: e.x, y: sy, z: e.z,
    vx: Math.sin(yaw) * Math.cos(pitch) * spd, vy: Math.sin(pitch) * spd, vz: Math.cos(yaw) * Math.cos(pitch) * spd,
    life: 3, friendly: false, dmg: dmg || DMG.bolt, src: e, c: BOLT_CI[e.kind] || 0,
  });
  if (NET.on && NET.host) netBolt(bolts[bolts.length - 1]);
  blip(e.kind === "tank" || e.kind === "boss" ? 90 : e.kind === "grey" ? 420 : 160, 0.07, e.kind === "grey" ? "sine" : "square", 0.04, 70);
}

function hitTarget(TG, dmg, e) { if (TG === P) hurtPlayer(dmg, e); else netHit(TG, dmg, e); }
function announce(text, color) { toast(text, color); if (NET.on && NET.host) netBroadcast({ t: "toast", m: text, c: color }); }

function updateEnemies(dt) {
  if (NET.on && !NET.host) { netPuppetEnemies(dt); return; } // co-op joiner: bots are driven by the host
  const Dd = DIFFS[G.diff], t = runRamp();
  const fireCd = Dd.fireCd[0] + (Dd.fireCd[1] - Dd.fireCd[0]) * t;
  for (const e of enemies) {
    if (e.hp <= 0 || e.dormant) continue;
    const st = EN[e.kind];
    e.bob += dt * 6;
    e.hit = Math.max(0, e.hit - dt);
    e.alertT = Math.max(0, e.alertT - dt);
    e.cd -= dt;
    e.frost = Math.max(0, (e.frost || 0) - dt * 1.5);
    if (e.frozenT > 0) { // frozen solid: no moving, no shooting
      e.frozenT -= dt; e.windup = 0; e.burst = 0; e.chargeT = 0; e.vx = e.vz = 0;
      if (!e.fly && e.kind !== "turret") moveCollide(e, dt, st.hw, st.h, 22);
      continue;
    }
    const TG = NET.on ? netTarget(e) : P; // co-op: nearest player who is still up
    const dx = TG.x - e.x, dz = TG.z - e.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const range = Dd.see * (e.alert ? 1.4 : 1) * (e.kind === "boss" ? 1.6 : 1);
    e.losT -= dt;
    if (e.losT <= 0) {
      e.losT = 0.12 + Math.random() * 0.08;
      e.see = dist < range && los(e.x, e.y + st.eye, e.z, TG.x, TG.y + 1.1, TG.z);
      if (e.see && !e.alert) {
        e.alert = true; e.alertT = 0.8; e.cd = Math.max(e.cd, 0.6); // "!" telegraph before first shot
        if (Dd.pack) for (const o of enemies) if (o !== e && o.room === e.room && !o.alert && !o.dormant && o.hp > 0) { o.alert = true; o.alertT = 0.6; o.cd = Math.max(o.cd, 0.9); }
      }
    }
    const see = e.see;
    const slow = 1 - Math.min(0.6, e.frost * 0.12);
    if (e.kind === "turret") { turretThink(e, dt, TG, dx, dz, dist, see, Dd, fireCd); continue; }
    if (e.kind === "boss") {
      bossThink(e, dt, TG, dx, dz, dist, see, Dd);
    } else {
      if (e.blink > 0) { // grey: shimmering mid-teleport
        e.blink -= dt; e.vx = e.vz = 0;
        if (e.blink <= 0) greyWarp(e, TG);
        continue;
      }
      if (e.stunT > 0) { // brute hit a wall mid-charge: dazed
        e.stunT -= dt; e.vx *= 0.8; e.vz *= 0.8;
        moveCollide(e, dt, st.hw, st.h, 22);
        continue;
      }
      if (e.chargeT > 0) { // brute charge: straight line, big hit, stunned if it slams a wall
        e.chargeT -= dt;
        const cs = (G.diff === 2 ? 10.5 : 9) * slow;
        e.vx = e.cdx * cs; e.vz = e.cdz * cs;
        if (!e.chHit && dist < 1.4 && Math.abs(TG.y - e.y) < 1.8) {
          e.chHit = true; hitTarget(TG, DMG.brute, e);
          if (TG === P) { P.vx += e.cdx * 7; P.vz += e.cdz * 7; P.vy = Math.max(P.vy, 4); }
        }
        const pvx = e.vx, pvz = e.vz;
        moveCollide(e, dt, st.hw, st.h, 22);
        if ((pvx && !e.vx) || (pvz && !e.vz)) {
          e.chargeT = 0; e.stunT = G.diff === 2 ? 1.0 : 1.6;
          burst(e.x, e.y + 1.8, e.z, [1, 0.9, 0.3], 12, 3); blip(90, 0.25, "sawtooth", 0.07, 40);
        }
        if (e.chargeT <= 0) e.cd = G.diff === 2 ? 1.6 : 2.4;
        continue;
      }
      if (see || e.windup > 0) e.yaw = Math.atan2(dx, -dz);
      if (e.burst > 0) { e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = 0.13; fireBolt(e, (Math.random() - 0.5) * 0.08, e.bdmg, TG); } }
      // wind-up in progress: stand still, glow, then strike/fire
      if (e.windup > 0) {
        e.windup -= dt;
        e.vx *= 0.7; e.vz *= 0.7;
        if (e.windup <= 0) {
          if (e.wkind === "melee") {
            if (dist < (e.kind === "brute" ? 2.2 : 1.75) && Math.abs(TG.y - e.y) < 1.6) hitTarget(TG, e.kind === "brute" ? DMG.swipe : DMG.melee, e);
            e.cd = 1.0;
          } else if (e.wkind === "charge") {
            e.chargeT = 1.25; e.cdx = dx / dist; e.cdz = dz / dist; e.chHit = false;
            blip(70, 0.4, "sawtooth", 0.08, 140);
          } else if (e.kind === "tank") {
            for (const off of [-0.2, 0, 0.2]) fireBolt(e, off, DMG.tank, TG);
            if (G.diff === 2) for (const off of [-0.1, 0.1]) fireBolt(e, off, DMG.tank, TG, 0.8);
            e.cd = fireCd * 1.9;
          } else if (e.kind === "seeker") {
            e.burst = G.diff === 2 ? 4 : 3; e.burstT = 0; e.bdmg = DMG.seeker;
            e.cd = fireCd * 1.3;
          } else {
            const dmg = e.kind === "drone" ? DMG.drone : e.kind === "grey" ? DMG.grey : DMG.bolt;
            if (see) {
              fireBolt(e, 0, dmg, TG);
              if (Dd.burst > 1 && e.kind === "shoot") { e.burst = Dd.burst - 1; e.burstT = 0.16; e.bdmg = dmg; }
            }
            e.cd = fireCd * (e.kind === "drone" ? 0.8 : 1) * (0.85 + Math.random() * 0.3);
          }
        }
      } else if (e.kind === "melee" || (e.kind === "tank" && dist < 1.6) || (e.kind === "brute" && dist < 2.4)) {
        if (dist < (e.kind === "brute" ? 2.0 : 1.4) && e.cd <= 0) {
          e.windup = e.windMax = Dd.windup * (e.kind === "brute" ? 1.0 : 0.6) + 0.15; e.wkind = "melee";
          blip(380, 0.05, "square", 0.03, 520);
        } else if (see && dist > 1.0) {
          e.vx = (dx / dist) * e.speed; e.vz = (dz / dist) * e.speed;
        } else if (!see) { e.vx *= 0.85; e.vz *= 0.85; }
        else { e.vx = e.vz = 0; }
      } else if (e.kind === "brute") {
        if (see && dist < 12 && dist > 3 && e.cd <= 0 && e.alertT <= 0) {
          e.windup = e.windMax = Dd.windup * 1.5 + 0.4; e.wkind = "charge";
          sfx("roar");
        } else if (see) { e.vx = (dx / dist) * e.speed; e.vz = (dz / dist) * e.speed; }
        else { e.vx *= 0.85; e.vz *= 0.85; }
      } else { // ranged: shoot / drone / tank / grey / seeker
        if (e.kind === "grey") {
          e.tp -= dt;
          if (see && e.tp <= 0 && e.alertT <= 0) {
            e.blink = 0.45; e.tp = G.diff === 2 ? 2.4 + Math.random() * 2 : 3.8 + Math.random() * 2.5;
            sfx("warp");
            continue;
          }
        }
        const sky = e.kind === "drone" || e.kind === "seeker";
        const far = e.kind === "tank" ? 15 : 14, near = sky ? 3.5 : 4.5;
        if (see && dist < far) {
          if (e.cd <= 0 && e.alertT <= 0) {
            e.windup = e.windMax = Dd.windup * (e.kind === "tank" ? 1.3 : e.kind === "drone" ? 0.8 : e.kind === "seeker" ? 0.75 : 1); e.wkind = "shot";
            blip(e.kind === "tank" ? 120 : 600, 0.06, "triangle", 0.035, e.kind === "tank" ? 200 : 900);
          }
          // strafe sideways (drones circle, seekers dash), close in if too far, back off if too close
          if (e.kind === "seeker") { e.dashT = (e.dashT || 0) - dt; if (e.dashT <= 0) { e.dashT = 0.6 + Math.random() * 0.6; e.strafe = Math.random() < 0.5 ? 1 : -1; } }
          const px = -dz / dist, pz = dx / dist;
          const stf = e.kind === "tank" ? 0 : (e.kind === "seeker" ? 4.2 : e.kind === "drone" ? 1.8 : e.kind === "grey" ? 1.2 : 0.9) * e.strafe;
          const toward = dist > (sky ? 8 : 10) ? e.speed * 0.6 : dist < near ? -e.speed * 0.5 : 0;
          e.vx = px * stf + (dx / dist) * toward; e.vz = pz * stf + (dz / dist) * toward;
          if (e.kind !== "seeker" && Math.random() < dt * 0.4) e.strafe = -e.strafe;
        } else if (see) {
          e.vx = (dx / dist) * e.speed; e.vz = (dz / dist) * e.speed;
        } else {
          e.vx *= 0.85; e.vz *= 0.85;
          if (Math.random() < 0.01) e.yaw += (Math.random() - 0.5);
        }
      }
    }
    e.vx *= slow; e.vz *= slow;
    const pvx = e.vx, pvz = e.vz;
    if (e.fly) moveCollide(e, dt, st.hw, st.h, 0);
    else moveCollide(e, dt, st.hw, st.h, 22);
    if ((pvx && !e.vx) || (pvz && !e.vz)) e.strafe = -e.strafe; // bumped a wall: change direction
    if (e.y < -2) e.hp = 0;
  }
  enemies = enemies.filter(e => e.hp > 0 || e.hit > 0 || e.dormant);
}

function turretThink(e, dt, TG, dx, dz, dist, see, Dd, fireCd) {
  e.vx = e.vz = 0;
  const want = Math.atan2(dx, -dz);
  const turn = (G.diff === 2 ? 3.6 : G.diff === 1 ? 2.2 : 1.6) * dt * (1 - Math.min(0.6, e.frost * 0.12));
  if (see || e.windup > 0 || e.burst > 0) e.yaw += clamp(angWrap(want - e.yaw), -turn, turn);
  else e.yaw += dt * 0.6; // idle sweep
  if (e.burst > 0) {
    e.burstT -= dt;
    if (e.burstT <= 0) { e.burst--; e.burstT = 0.14; if (see) fireBolt(e, -angWrap(e.yaw - want) * 0.5, DMG.turret, TG); }
    return;
  }
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) { e.burst = G.diff === 2 ? 5 : G.diff === 1 ? 3 : 2; e.burstT = 0; }
    return;
  }
  if (see && Math.abs(angWrap(want - e.yaw)) < 0.35 && dist < 18 && e.cd <= 0 && e.alertT <= 0) {
    e.windup = e.windMax = Dd.windup * 1.4 + 0.25; e.wkind = "shot";
    blip(900, 0.1, "sine", 0.03, 1400);
    e.cd = fireCd * 1.7 + e.windMax;
  }
}

function warpSpot(e, TG, dmin, dmax, hw, h) {
  const r = rooms[e.room];
  if (!r) return false;
  for (let k = 0; k < 16; k++) {
    const a = Math.random() * Math.PI * 2, d = dmin + Math.random() * (dmax - dmin);
    const nx = TG.x + Math.cos(a) * d, nz = TG.z + Math.sin(a) * d;
    if (nx < r.x + 1.6 || nx > r.x + r.w - 1.6 || nz < r.z + 1.6 || nz > r.z + r.d - 1.6) continue;
    const g = groundY(nx | 0, nz | 0, r);
    if (world.get(nx, g, nz) === 29 || !world.solid(nx, g, nz)) continue;
    if (aabbSolid(nx, g + 1.01, nz, hw, h)) continue;
    e.x = nx; e.z = nz; e.y = g + 1.01;
    return true;
  }
  return false;
}
function greyWarp(e, TG) {
  burst(e.x, e.y + 0.8, e.z, [0.4, 1, 0.5], 12, 3);
  warpSpot(e, TG, 4, 8, 0.3, 1.5);
  e.cd = Math.max(e.cd, 0.55); e.vx = e.vz = 0;
  burst(e.x, e.y + 0.8, e.z, [0.4, 1, 0.5], 14, 3);
}

// ---------- THE OVERSEER (Area 51 boss) ----------
function bossThink(e, dt, TG, dx, dz, dist, see, Dd) {
  const r = rooms[e.room];
  const inArena = (x, z) => x > r.x && x < r.x + r.w && z > r.z + 1.5 && z < r.z + r.d;
  if (!e.awake) {
    e.vx = e.vz = 0;
    if ((inArena(P.x, P.z) && !NET.down) || (NET.on && netAnyRemote(inArena))) e.awake = true;
    else return;
  }
  if (!e.woke) { e.woke = true; e.alert = true; e.alertT = 1.0; e.cd = 1.6; announce("THE OVERSEER AWAKENS!", "#ff5ad9"); sfx("boss"); }
  const hpf = e.hp / e.maxHp, phase = hpf < 0.5 ? 2 : 1;
  const marks = G.diff === 2 ? [0.85, 0.6, 0.35, 0.15] : G.diff === 1 ? [0.7, 0.4] : [0.55];
  if (e.sumI < marks.length && hpf < marks[e.sumI]) { e.sumI++; bossSummon(e, G.diff === 2 ? 3 : 2, TG); }
  if (phase === 2 && !e.p2) { e.p2 = true; announce("OVERSEER ENRAGED · JUMP THE SHOCKWAVES!", "#ff5ad9"); }
  e.yaw = Math.atan2(dx, -dz);
  if (e.volley > 0) { e.volT -= dt; if (e.volT <= 0) { e.volley--; e.volT = 0.35; bossFan(e, TG, 0.12 * (e.volley % 2 ? 1 : -1)); } }
  if (e.warpT > 0) { e.warpT -= dt; e.vx = e.vz = 0; if (e.warpT <= 0) { burst(e.x, e.y + 1.5, e.z, [0.9, 0.3, 1], 20, 4); warpSpot(e, TG, 7, 11, 0.8, 3.0); burst(e.x, e.y + 1.5, e.z, [0.9, 0.3, 1], 20, 4); sfx("warp"); } return; }
  if (e.windup > 0) {
    e.windup -= dt; e.vx *= 0.6; e.vz *= 0.6;
    if (e.windup <= 0) {
      if (e.wkind === "slam") { spawnWave(e.x, e.y, e.z, true); e.warpT = 0.8; }
      else { bossFan(e, TG, 0); if (phase === 2 && G.diff >= 1) { e.volley = G.diff === 2 ? 2 : 1; e.volT = 0.35; } }
    }
    return;
  }
  if (!see) { e.vx = (dx / dist) * e.speed; e.vz = (dz / dist) * e.speed; return; }
  // drift around the target at mid range
  const px = -dz / dist, pz = dx / dist;
  const toward = dist > 10 ? e.speed : dist < 6 ? -e.speed * 0.7 : 0;
  e.vx = px * e.speed * 0.8 * e.strafe + (dx / dist) * toward; e.vz = pz * e.speed * 0.8 * e.strafe + (dz / dist) * toward;
  if (Math.random() < dt * 0.35) e.strafe = -e.strafe;
  if (e.cd <= 0 && e.alertT <= 0) {
    const hard = G.diff === 2;
    if (phase === 2 && e.last !== "slam" && Math.random() < 0.65) { e.windup = e.windMax = hard ? 0.85 : 1.2; e.wkind = "slam"; e.last = "slam"; sfx("slamUp"); }
    else { e.windup = e.windMax = Dd.windup * 1.4 + 0.35; e.wkind = "shot"; e.last = "shot"; blip(140, 0.3, "sawtooth", 0.05, 400); }
    e.cd = (phase === 2 ? 1.9 : 2.5) * (hard ? 0.75 : G.diff === 0 ? 1.3 : 1) + e.windMax;
  }
}
function bossFan(e, TG, off) {
  const n = [4, 5, 7][G.diff], spread = n === 4 ? 0.75 : 1.0;
  for (let i = 0; i < n; i++) fireBolt(e, off + (i / (n - 1) - 0.5) * spread, DMG.boss, TG);
}
function bossSummon(e, n, TG) {
  let k = 0;
  for (const m of enemies) {
    if (k >= n) break;
    if (!m.dormant || m.room !== e.room || m.hp <= 0) continue;
    m.dormant = false; k++;
    m.x = e.x; m.z = e.z; m.y = e.y;
    if (!warpSpot(m, TG, 4, 9, 0.3, 1.5)) { m.x = e.x + (k % 2 ? 1.6 : -1.6); }
    m.alert = true; m.alertT = 0.7; m.cd = 1.2; m.tp = 3;
    burst(m.x, m.y + 0.8, m.z, [0.4, 1, 0.5], 16, 4);
  }
  if (k) { announce("THE OVERSEER WARPS IN BACKUP!", "#7dff5a"); sfx("warp"); }
}
function spawnWave(x, y, z, fromHost) {
  waves.push({ x, y, z, r: 0.8, hit: false });
  sfx("slam");
  const d = Math.hypot(P.x - x, P.z - z);
  if (d < 14) G.shake = Math.max(G.shake, 0.35);
  if (fromHost && NET.on && NET.host) netBroadcast({ t: "wave", p: [nr2(x), nr2(y), nr2(z)] });
}
function updateWaves(dt) {
  for (const w of waves) {
    w.r += 8.5 * dt;
    if (w.hit || G.mode !== "play" || NET.down) continue;
    const d = Math.hypot(P.x - w.x, P.z - w.z);
    if (Math.abs(d - w.r) < 0.6 && P.y < w.y + 0.45 && P.y > w.y - 1.5) {
      w.hit = true; hurtPlayer(DMG.wave, { x: w.x, z: w.z }); P.vy = Math.max(P.vy, 5);
    }
  }
  waves = waves.filter(w => w.r < 18);
}
function updateBeams(dt) { for (const b of beams) b.t -= dt; beams = beams.filter(b => b.t > 0); }

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
      if (p.kind === "health" && G.hp >= maxHp()) continue; // leave it for later
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
        if (!p.small) for (const [i, k] of [[2, 6], [3, 1], [4, 20], [5, 2], [6, 6], [7, 20]]) if (wOwned(i)) G[WEAP[i].key] = Math.min(WEAP[i].max, (G[WEAP[i].key] | 0) + k);
      } else if (p.kind === "health") {
        const n = p.small ? 25 : 45;
        G.hp = Math.min(maxHp(), G.hp + n); col = [0.3, 1, 0.4]; toast("+" + n + " HEALTH", "#7dff5a");
      } else if (p.kind === "heart") {
        if (G.lives < MAX_LIVES) { G.lives++; toast("+1 LIFE", "#ff3d6e"); } else { G.score += 200; toast("+200 (LIVES FULL)", "#ff3d6e"); }
        G.hp = maxHp(); col = [1, 0.2, 0.4];
      } else if (WPICK[p.kind]) {
        const wi = WPICK[p.kind], WW = WEAP[wi];
        G[WW.key] = Math.min(WW.max, (G[WW.key] | 0) + WW.pick); col = WW.col;
        const first = !wOwned(wi);
        G.got[wi] = true;
        if (first) { G.weapon = wi; G.reload = 0; }
        toast(first ? WW.full + "! · " + (isTouchPlay() ? "SWAP or tap the bar" : "Q or " + (wi + 1) + " to switch") : "+" + WW.pick + " " + WW.unit, rgbHex(WW.col));
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
      G.hp = Math.min(maxHp(), G.hp + DIFFS[G.diff].cpHeal);
      if (G.ammo + G.reserve < MAG * 2) G.reserve += 6;
      ratRefill(0.5);
      sfx("pickup");
      toast("CHECKPOINT · " + (r.spec && r.spec.name ? r.spec.name : "ROOM " + r.idx + "/" + Math.max(1, rooms.length - 2)), "#7dff5a");
      if (r.boss && G.mode === "play") setTimeout(() => { if (G.mode === "play" && bossAlive()) toast("BOSS: THE OVERSEER", "#ff5ad9"); }, 1400);
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
  const under = P.grounded ? world.get(P.x, P.y - 0.08, P.z) : 0;
  const acc = P.grounded ? (under === 31 ? 3.5 : 18) : 6; // ice is slippery
  if (under === 29 && !NET.down) { // lava stings: hop out!
    G.lavaT = (G.lavaT || 0) - dt;
    if (G.lavaT <= 0) { G.lavaT = 0.5; hurtPlayer(DMG.lava, null); if (!G.lavaTip) { G.lavaTip = 1; toast("HOT! JUMP OUT OF THE LAVA", "#ff7a18"); } }
  } else G.lavaT = 0;
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
    if (!STORE.assist) hurtPlayer(DMG.fall / DIFFS[G.diff].dmg); // Assist Mode: no fall damage
    G.invuln = 1.0;
  }
  const pad = extract;
  const onPad = P.x > pad.x && P.x < pad.x + pad.w && P.z > pad.z && P.z < pad.z + pad.d && P.y < pad.y + 2;
  const boss = onPad ? bossAlive() : null;
  if (onPad && boss && (!G.padNag || G.time - G.padNag > 2.5)) { G.padNag = G.time; toast("DEFEAT THE OVERSEER FIRST!", "#ff5ad9"); }
  if (NET.on) NET.onPad = onPad && !boss; // co-op: everyone has to stand on the pad
  else if (onPad && !boss) win();
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

const EBASE = { shoot: [0.55, 0.25, 1.0], tank: [1.0, 0.55, 0.1], drone: [0.1, 0.85, 0.75], melee: [0.95, 0.18, 0.28],
  grey: [0.68, 0.8, 0.7], seeker: [0.92, 0.93, 0.9], brute: [0.4, 0.72, 0.2], turret: [0.5, 0.53, 0.6], boss: [0.36, 0.2, 0.52] };
function drawEnemy(e, vp) {
  if (e.dormant) return;
  const flash = e.hit > 0.05 ? 1 : 0;
  const frozen = e.frozenT > 0;
  if (e.blink > 0 && Math.sin(G.time * 70) > 0) { // teleport shimmer
    drawCube(e.x - 0.2, e.y, e.z - 0.2, 0.4, 1.6, 0.4, [0.4, 1, 0.5], 1, vp);
    return;
  }
  const bob = Math.sin(e.bob) * (e.fly ? 0.15 : 0.05);
  const winding = e.windup > 0 && !frozen;
  const wk = winding ? 1 - e.windup / (e.windMax || 1) : 0;         // 0 → 1 as the attack charges
  const pulse = winding ? 0.5 + 0.5 * Math.sin(G.time * 30) : 0;
  const base = frozen ? [0.62, 0.9, 1] : EBASE[e.kind];
  const body = flash ? [1, 1, 1] : winding ? [base[0] + (1 - base[0]) * pulse * 0.6, base[1] * (1 - pulse * 0.4), base[2] * (1 - pulse * 0.4)] : base;
  const emit = flash ? 1 : frozen ? 0.35 : winding ? 0.25 + 0.5 * wk : 0.08;
  const fx = Math.sin(e.yaw), fz = -Math.cos(e.yaw), rx = -fz, rz = fx;
  const eyeCol = winding ? [1, 0.15, 0.1] : [0.2, 1, 1];
  const k = e.kind;
  let top = e.y + EN[k].box[2];
  if (k === "tank") {
    drawCube(e.x - 0.5, e.y + bob, e.z - 0.5, 1.0, 1.0, 1.0, body, emit, vp);
    drawCube(e.x - 0.36, e.y + 1.0 + bob, e.z - 0.36, 0.72, 0.6, 0.72, [0.15, 0.13, 0.12], 0, vp);
    drawCube(e.x + fx * 0.36 - 0.2, e.y + 1.18 + bob, e.z + fz * 0.36 - 0.2, 0.4, 0.16, 0.4, eyeCol, 1, vp);
    drawCube(e.x - 0.45, e.y - 0.0, e.z - 0.2, 0.25, 0.3, 0.4, [0.1, 0.1, 0.12], 0, vp);
    drawCube(e.x + 0.2, e.y - 0.0, e.z - 0.2, 0.25, 0.3, 0.4, [0.1, 0.1, 0.12], 0, vp);
  } else if (k === "drone") {
    drawCube(e.x - 0.3, e.y + bob, e.z - 0.3, 0.6, 0.4, 0.6, body, emit, vp);
    const spin = G.time * 25;
    for (let i = 0; i < 4; i++) {
      const a = spin + i * Math.PI / 2;
      drawCube(e.x + Math.cos(a) * 0.42 - 0.07, e.y + 0.42 + bob, e.z + Math.sin(a) * 0.42 - 0.07, 0.14, 0.04, 0.14, [0.9, 0.9, 0.95], 0.2, vp);
    }
    drawCube(e.x + fx * 0.3 - 0.08, e.y + 0.14 + bob, e.z + fz * 0.3 - 0.08, 0.16, 0.14, 0.16, eyeCol, 0.9, vp);
  } else if (k === "grey") { // alien grey: spindly body, huge head, big black eyes
    const legC = frozen ? body : [0.45, 0.52, 0.47];
    drawCube(e.x - 0.17, e.y + bob, e.z - 0.06, 0.1, 0.52, 0.12, legC, 0, vp);
    drawCube(e.x + 0.07, e.y + bob, e.z - 0.06, 0.1, 0.52, 0.12, legC, 0, vp);
    drawCube(e.x - 0.18, e.y + 0.5 + bob, e.z - 0.13, 0.36, 0.48, 0.26, body, emit, vp);
    drawCube(e.x + rx * 0.24 - 0.04, e.y + 0.42 + bob, e.z + rz * 0.24 - 0.04, 0.08, 0.52, 0.08, body, emit, vp);
    drawCube(e.x - rx * 0.24 - 0.04, e.y + 0.42 + bob, e.z - rz * 0.24 - 0.04, 0.08, 0.52, 0.08, body, emit, vp);
    drawCube(e.x - 0.3, e.y + 0.96 + bob, e.z - 0.28, 0.6, 0.52, 0.56, body, emit, vp);
    drawCube(e.x - 0.18, e.y + 0.86 + bob, e.z - 0.16, 0.36, 0.12, 0.32, body, emit, vp);
    const ec = winding ? [0.3, 1, 0.35] : [0.03, 0.03, 0.06];
    for (const s of [-1, 1]) drawCube(e.x + fx * 0.25 + rx * s * 0.14 - 0.09, e.y + 1.1 + bob, e.z + fz * 0.25 + rz * s * 0.14 - 0.09, 0.18, 0.15, 0.18, ec, winding ? 1 : 0.15, vp);
  } else if (k === "seeker") { // lab drone: flat saucer, hazard stripe, red eye
    drawCube(e.x - 0.42, e.y + bob, e.z - 0.42, 0.84, 0.2, 0.84, body, emit, vp);
    drawCube(e.x - 0.45, e.y + 0.06 + bob, e.z - 0.12, 0.9, 0.08, 0.24, [1, 0.8, 0.1], 0.4, vp);
    drawCube(e.x - 0.18, e.y + 0.2 + bob, e.z - 0.18, 0.36, 0.14, 0.36, [0.2, 0.22, 0.3], 0, vp);
    drawCube(e.x - 0.12, e.y - 0.06 + bob, e.z - 0.12, 0.24, 0.06, 0.24, [0.2, 1, 1], 1, vp);
    drawCube(e.x + fx * 0.42 - 0.09, e.y + 0.03 + bob, e.z + fz * 0.42 - 0.09, 0.18, 0.13, 0.18, winding ? [1, 0.1, 0.05] : [1, 0.35, 0.2], 0.9, vp);
  } else if (k === "brute") { // mutant brute: hunched, huge shoulders, knuckle-dragging arms
    const dark = frozen ? body : [0.2, 0.42, 0.12];
    drawCube(e.x - 0.42, e.y + bob, e.z - 0.2, 0.34, 0.72, 0.4, dark, 0, vp);
    drawCube(e.x + 0.08, e.y + bob, e.z - 0.2, 0.34, 0.72, 0.4, dark, 0, vp);
    drawCube(e.x - 0.55, e.y + 0.7 + bob, e.z - 0.42, 1.1, 0.85, 0.84, body, emit, vp);
    drawCube(e.x - 0.68, e.y + 1.4 + bob, e.z - 0.38, 1.36, 0.45, 0.76, dark, emit * 0.5, vp);
    drawCube(e.x + fx * 0.46 - 0.21, e.y + 1.28 + bob, e.z + fz * 0.46 - 0.21, 0.42, 0.38, 0.42, body, emit, vp);
    for (const s of [-1, 1]) {
      drawCube(e.x + fx * 0.66 + rx * s * 0.1 - 0.05, e.y + 1.42 + bob, e.z + fz * 0.66 + rz * s * 0.1 - 0.05, 0.1, 0.08, 0.1, winding || e.chargeT > 0 ? [1, 0.15, 0.1] : [1, 0.9, 0.2], 1, vp);
      drawCube(e.x + rx * s * 0.74 - 0.17, e.y + 0.15 + bob, e.z + rz * s * 0.74 - 0.17, 0.34, 1.35, 0.34, body, emit, vp);
    }
    if (e.stunT > 0) for (let i = 0; i < 3; i++) { const a = G.time * 5 + i * 2.1; drawCube(e.x + Math.cos(a) * 0.55 - 0.07, e.y + 2.15, e.z + Math.sin(a) * 0.55 - 0.07, 0.14, 0.14, 0.14, [1, 0.95, 0.3], 1, vp); }
    if (winding && e.wkind === "charge") drawCube(e.x - 0.75, e.y + 0.05, e.z - 0.75, 1.5, 0.06, 1.5, [1, 0.2 + pulse * 0.5, 0.1], 1, vp);
  } else if (k === "turret") {
    drawCube(e.x - 0.42, e.y, e.z - 0.42, 0.84, 0.5, 0.84, [0.22, 0.24, 0.28], 0, vp);
    drawCube(e.x - 0.44, e.y + 0.42, e.z - 0.44, 0.88, 0.08, 0.88, [1, 0.8, 0.1], 0.3, vp);
    drawCube(e.x - 0.12, e.y + 0.5, e.z - 0.12, 0.24, 0.3, 0.24, [0.3, 0.32, 0.36], 0, vp);
    drawCube(e.x - 0.32, e.y + 0.78, e.z - 0.32, 0.64, 0.42, 0.64, body, emit, vp);
    for (let i = 0; i < 3; i++) drawCube(e.x + fx * (0.38 + i * 0.17) - 0.07, e.y + 0.9, e.z + fz * (0.38 + i * 0.17) - 0.07, 0.14, 0.14, 0.14, [0.15, 0.15, 0.18], 0, vp);
    drawCube(e.x + fx * 0.32 - 0.09, e.y + 1.02, e.z + fz * 0.32 - 0.09, 0.18, 0.1, 0.18, winding || e.burst > 0 ? [1, 0.1, 0.1] : [1, 0.4, 0.3], 1, vp);
    if (winding) { // laser sight: shows exactly where the burst will go
      const o = { x: e.x + fx * 0.8, y: e.y + 0.97, z: e.z + fz * 0.8 }, dd = { x: fx, y: 0, z: fz };
      const hit = traceVoxels(o, dd, 16), len = hit ? hit.t : 16;
      for (let s = 0; s < len; s += 0.45) drawCube(o.x + fx * s - 0.03, o.y - 0.03, o.z + fz * s - 0.03, 0.06, 0.06, 0.06, [1, 0.1, 0.1], 1, vp);
    }
  } else if (k === "boss") { // THE OVERSEER: giant grey on a hover-throne
    const hover = 0.35 + Math.sin(e.bob * 0.4) * 0.12 + (winding && e.wkind === "slam" ? wk * 1.4 : 0);
    const y0 = e.y + hover;
    top = y0 + 3.0;
    drawCube(e.x - 1.0, y0, e.z - 1.0, 2.0, 0.3, 2.0, flash ? [1, 1, 1] : [0.75, 0.78, 0.86], 0.1, vp);
    for (let i = 0; i < 6; i++) { const a = G.time * 2 + i * Math.PI / 3; drawCube(e.x + Math.cos(a) * 0.95 - 0.08, y0 + 0.05, e.z + Math.sin(a) * 0.95 - 0.08, 0.16, 0.16, 0.16, [0.45, 1, 0.6], 1, vp); }
    drawCube(e.x - 0.25, y0 - 0.25, e.z - 0.25, 0.5, 0.25, 0.5, [0.45, 1, 0.6], 1, vp);
    drawCube(e.x - 0.5, y0 + 0.3, e.z - 0.4, 1.0, 1.1, 0.8, body, emit, vp);
    drawCube(e.x - 0.78, y0 + 1.2, e.z - 0.36, 1.56, 0.3, 0.72, [0.2, 0.12, 0.3], 0.1, vp);
    const head = flash ? [1, 1, 1] : [0.68, 0.8, 0.7];
    drawCube(e.x - 0.7, y0 + 1.5, e.z - 0.62, 1.4, 1.2, 1.24, head, emit, vp);
    drawCube(e.x - 0.5, y0 + 2.7, e.z - 0.45, 1.0, 0.3, 0.9, [0.95, 0.5, 0.75], 0.35, vp);
    const ec = winding ? [1, 0.15, 0.4] : [0.03, 0.03, 0.06];
    for (const s of [-1, 1]) drawCube(e.x + fx * 0.6 + rx * s * 0.32 - 0.2, y0 + 1.85, e.z + fz * 0.6 + rz * s * 0.32 - 0.2, 0.4, 0.32, 0.4, ec, winding ? 1 : 0.15, vp);
    for (const s of [-1, 0, 1]) drawCube(e.x + rx * s * 0.4 - 0.08, y0 + 3.0 + (s ? 0 : 0.15), e.z + rz * s * 0.4 - 0.08, 0.16, 0.3, 0.16, [1, 0.3, 0.9], 1, vp);
  } else {
    drawCube(e.x - 0.28, e.y + bob, e.z - 0.28, 0.56, 0.72, 0.56, body, emit, vp);
    drawCube(e.x - 0.22, e.y + 0.72 + bob, e.z - 0.22, 0.44, 0.38, 0.44, [0.12, 0.12, 0.18], 0, vp);
    drawCube(e.x + fx * 0.18 - 0.06, e.y + 0.88 + bob, e.z + fz * 0.18 - 0.06, 0.12, 0.12, 0.12, eyeCol, 0.9, vp);
    drawCube(e.x - 0.22, e.y + bob, e.z - 0.08, 0.16, 0.28, 0.16, [0.1, 0.1, 0.14], 0, vp);
    drawCube(e.x + 0.06, e.y + bob, e.z - 0.08, 0.16, 0.28, 0.16, [0.1, 0.1, 0.14], 0, vp);
  }
  if (e.elite) { // HARD elites wear a gold crown
    drawCube(e.x - 0.17, top + 0.04, e.z - 0.17, 0.34, 0.1, 0.34, [1, 0.82, 0.15], 0.9, vp);
    for (const s of [-1, 1]) drawCube(e.x + rx * s * 0.12 - 0.04, top + 0.14, e.z + rz * s * 0.12 - 0.04, 0.08, 0.12, 0.08, [1, 0.82, 0.15], 0.9, vp);
  }
  if (frozen) for (let i = 0; i < 3; i++) { const a = i * 2.1 + e.id; drawCube(e.x + Math.cos(a) * 0.4 - 0.08, e.y + 0.3 + i * 0.4, e.z + Math.sin(a) * 0.4 - 0.08, 0.16, 0.22, 0.16, [0.92, 0.98, 1], 0.6, vp); }
  // telegraph: a charging orb grows where the shot will come from
  if (winding && e.wkind === "shot" && k !== "turret") {
    const big = k === "boss" ? 2 : 1;
    const oy = e.y + EN[k].shotY + (k === "boss" ? 0.4 : 0) + bob, kk = (0.08 + 0.26 * wk) * big;
    const reach = k === "tank" ? 0.7 : k === "boss" ? 1.1 : 0.45;
    const ox = e.x + fx * reach, oz = e.z + fz * reach;
    drawCube(ox - kk / 2, oy - kk / 2, oz - kk / 2, kk, kk, kk, k === "grey" ? [0.3, 1, 0.4] : k === "boss" ? [1, 0.3, 0.95] : [1, 0.35 + 0.4 * pulse, 0.1], 1, vp);
  } else if (winding && e.wkind === "slam") { // boss slam: warning ring on the floor
    const rr = 2 + wk * 3;
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; drawCube(e.x + Math.cos(a) * rr - 0.1, e.y + 0.02, e.z + Math.sin(a) * rr - 0.1, 0.2, 0.06, 0.2, [1, 0.3, 0.9], 1, vp); }
  } else if (winding && e.wkind === "melee") { // melee: claws flare
    const wd = k === "brute" ? 0.8 : 0.4;
    drawCube(e.x + fx * 0.38 - wd / 2, e.y + 0.45, e.z + fz * 0.38 - wd / 2, wd, 0.12, wd, [1, 0.2 + pulse * 0.6, 0.1], 1, vp);
  }
  // "!" when a bot first spots you
  if (e.alertT > 0) {
    const hy = top + 0.1 + 0.1 * Math.sin(G.time * 12);
    drawCube(e.x - 0.06, hy + 0.18, e.z - 0.06, 0.12, 0.32, 0.12, [1, 0.9, 0.2], 1, vp);
    drawCube(e.x - 0.06, hy, e.z - 0.06, 0.12, 0.12, 0.12, [1, 0.9, 0.2], 1, vp);
  }
  // health pips over damaged multi-hit bots
  if (e.maxHp > 2 && e.hp < e.maxHp && k !== "boss") {
    const hy = top - 0.1 + (e.fly ? bob : 0), w = 0.7, f = Math.max(0, e.hp / e.maxHp);
    drawCube(e.x - w / 2, hy + 0.2, e.z - 0.03, w, 0.06, 0.06, [0.15, 0.15, 0.15], 0, vp);
    drawCube(e.x - w / 2, hy + 0.21, e.z - 0.04, w * f, 0.06, 0.08, [1, 0.25, 0.3], 0.8, vp);
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
  } else if (WPICK[p.kind]) { // weapon crate: spinning gun silhouette over a glowing base
    const c = WEAP[WPICK[p.kind]].col, a = p.t * 1.6, cx = Math.cos(a), sz = Math.sin(a);
    drawCube(p.x - 0.4, p.y - 0.45, p.z - 0.4, 0.8, 0.08, 0.8, c, 0.8, vp);
    const L = p.kind === "laser" ? 0.95 : p.kind === "rocket" ? 0.8 : 0.7, T = p.kind === "rocket" ? 0.26 : p.kind === "freeze" ? 0.24 : 0.18;
    for (let i = -2; i <= 2; i++) drawCube(p.x + cx * i * L / 5 - T / 2, y, p.z + sz * i * L / 5 - T / 2, T, T, T, c, 0.6, vp);
    drawCube(p.x - 0.08, y - 0.2, p.z - 0.08, 0.16, 0.22, 0.16, [0.2, 0.2, 0.25], 0, vp);
    if (p.kind === "freeze") drawCube(p.x - cx * 0.2 - 0.14, y + 0.12, p.z - sz * 0.2 - 0.14, 0.28, 0.28, 0.28, [0.85, 0.97, 1], 0.5, vp);
    if (p.kind === "rocket") drawCube(p.x + cx * 0.5 - 0.1, y + 0.03, p.z + sz * 0.5 - 0.1, 0.2, 0.2, 0.2, [1, 0.5, 0.1], 0.8, vp);
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
  gl.uniform3fv(loc.tint, [1, 1, 1]);
  function gbox(x,y,z,sx,sy,sz,c,em) {
    const m = cubeModel(x,y,z,sx,sy,sz);
    const model = m4mul(M, m);
    drawMesh(unitMesh, model, m4mul(vp, m), c, em || 0);
  }
  const w = G.weapon;
  gbox(-0.05, -0.12, 0.02, 0.10, 0.22, 0.14, [0.12,0.12,0.16], 0); // handle
  if (w === 1) { // scatter: chunky double barrel
    gbox(-0.09, 0.02, -0.26, 0.18, 0.14, 0.5, [0.32,0.2,0.12], 0);
    gbox(-0.08, 0.08, -0.62, 0.07, 0.07, 0.4, [0.35,0.38,0.45], 0);
    gbox(0.01, 0.08, -0.62, 0.07, 0.07, 0.4, [0.35,0.38,0.45], 0);
    gbox(-0.06, -0.02, -0.3, 0.12, 0.06, 0.18, [1,0.5,0.12], 0.3);
  } else if (w === 2) { // laser rifle: long slim barrel with glowing coils
    gbox(-0.06, 0.04, -0.3, 0.12, 0.12, 0.56, [0.9,0.9,0.95], 0);
    gbox(-0.03, 0.07, -0.82, 0.06, 0.06, 0.54, [0.25,0.25,0.3], 0);
    for (let i = 0; i < 3; i++) gbox(-0.05, 0.05, -0.36 - i * 0.14, 0.1, 0.1, 0.05, [1,0.25,0.75], 0.9);
    gbox(-0.02, 0.17, -0.2, 0.04, 0.05, 0.14, [1,0.25,0.75], 0.8);
  } else if (w === 3) { // rocket launcher: big tube
    gbox(-0.1, 0.0, -0.7, 0.2, 0.2, 0.95, [0.32,0.55,0.25], 0);
    gbox(-0.11, -0.01, -0.74, 0.22, 0.22, 0.06, [0.15,0.15,0.18], 0);
    if (G.rockets > 0) gbox(-0.06, 0.04, -0.75, 0.12, 0.12, 0.05, [1,0.5,0.1], 0.8);
    gbox(-0.03, 0.2, -0.2, 0.06, 0.06, 0.12, [1,0.9,0.2], 0.6);
  } else if (w === 4) { // freeze ray: tank + nozzle
    gbox(-0.08, 0.02, -0.3, 0.16, 0.14, 0.5, [0.85,0.92,1], 0);
    gbox(-0.07, 0.15, -0.2, 0.14, 0.14, 0.22, [0.45,0.9,1], 0.6);
    gbox(-0.05, 0.05, -0.68, 0.1, 0.1, 0.38, [0.35,0.4,0.5], 0);
    gbox(-0.06, 0.04, -0.72, 0.12, 0.12, 0.05, [0.6,0.95,1], 0.9);
  } else if (w >= 5) { ratGun(w, gbox);
  } else {
    gbox(-0.07, 0.04, -0.22, 0.14, 0.12, 0.46, [0.18,0.2,0.26], 0); // body
    gbox(-0.04, 0.08, -0.52, 0.08, 0.08, 0.32, [0.35,0.38,0.45], 0); // barrel
    gbox(-0.03, 0.16, -0.10, 0.06, 0.06, 0.10, [0.1,0.9,1], 0.6); // sight
    gbox(-0.05, -0.02, -0.08, 0.10, 0.10, 0.16, [1.0,0.5,0.12], 0); // mag
  }
  if (G.muzzle > 0 && w !== 7) gbox(-0.06, 0.06, w === 2 ? -1.0 : w === 3 ? -0.86 : w === 5 ? -1.04 : -0.82, 0.12, 0.12, 0.12, w === 2 ? [1,0.4,0.85] : [1,0.9,0.4], 1);
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
    if (e.hp <= 0 || e.dormant) continue;
    const [qx, qz] = px(e.x, e.z);
    ctx.fillStyle = EN[e.kind].mm;
    const s2 = e.kind === "boss" ? 5 : e.kind === "brute" || e.kind === "tank" ? 3 : 2;
    ctx.fillRect(qx - s2, qz - s2, s2 * 2, s2 * 2);
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

let bossShown = false;
function updateBossBar() {
  const el = document.getElementById("boss-bar");
  if (!el) return;
  const b = G.mode === "play" ? bossAlive() : null;
  const show = !!(b && (b.awake || b.woke || b.hp < b.maxHp || (rooms[b.room] && P.z > rooms[b.room].z - 2)));
  if (show !== bossShown) { bossShown = show; el.classList.toggle("show", show); }
  if (!show) return;
  const f = Math.max(0, b.hp / b.maxHp);
  const fill = el.querySelector("i u");
  const w = Math.round(f * 1000) / 10 + "%";
  if (fill.style.width !== w) fill.style.width = w;
  if (!G.bbT || G.time - G.bbT > 0.5) {
    G.bbT = G.time;
    const hb = document.getElementById("hud-top").getBoundingClientRect();
    if (hb.height > 0) el.style.top = Math.round(hb.bottom + (NET.on ? 44 : 10)) + "px";
  }
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
    if (G.regenT > 0) G.regenT -= dt * (STORE.assist ? 2 : 1);
    else if (G.hp < maxHp() && !NET.down) { G.hp = Math.min(maxHp(), G.hp + DIFFS[G.diff].regenRate * (STORE.assist ? 1.6 : 1) * dt); updateHpBar(); }
    // never soft-lock on ammo: a trickle of emergency rounds when completely dry
    if (G.ammo === 0 && G.reserve === 0 && G.reload <= 0 && G.weapon === 0) {
      G.emergencyT += dt;
      if (G.emergencyT > 2) { G.emergencyT = 0; G.reserve += 6; toast("EMERGENCY AMMO +6", "#ffd23f"); tryReload(); updateHUD(); }
    } else G.emergencyT = 0;
    updateEnemies(dt);
    updateBolts(dt);
    updateRockets(dt);
    updateWaves(dt);
    updatePickups(dt);
    ratUpdate(dt);
    G.shotCd = Math.max(0, G.shotCd - dt);
    if (shooting && G.shotCd <= 0) shoot();
  } else {
    wasShooting = false;
  }
  updateParts(dt);
  updateBeams(dt);
  updateBossBar();

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
    if (cam3On()) { const c3 = cam3View(shx, shy); camX = c3.x; camY = c3.y; camZ = c3.z; view = c3.view; }
    else {
      CAM3 = null;
      camX = P.x + shx; camY = P.y + P.eye + shy; camZ = P.z;
      const f = forward();
      view = lookAt(camX, camY, camZ, camX + f.x, camY + f.y, camZ + f.z, 0, 1, 0);
    }
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
  gl.uniform1f(loc.fogN, TH ? TH.fogN : 18);
  gl.uniform1f(loc.fogF, TH ? TH.fogF : 62);
  gl.uniform1f(loc.time, G.time);

  const wt = TH ? TH.tint : [1, 1, 1];
  for (const c of chunks) if (c) drawMesh(c, IDENT, vp, wt, 0);

  for (const e of enemies) if (e.hp > 0) drawEnemy(e, vp);
  if (NET.on) netDraw(vp);
  ratDraw(vp);
  drawCheckpoints(vp);
  for (const b of bolts) { const big = b.c === 4 ? 0.36 : 0.26; drawCube(b.x - big / 2, b.y - big / 2, b.z - big / 2, big, big, big, BOLT_COL[b.c || 0], 1, vp); }
  for (const r of rockets) {
    if (r.cheese) { ratDrawCheese(r, vp); continue; }
    const L = Math.hypot(r.vx, r.vy, r.vz) || 1;
    drawCube(r.x - 0.11, r.y - 0.11, r.z - 0.11, 0.22, 0.22, 0.22, [0.45, 0.9, 0.3], 0.5, vp);
    drawCube(r.x - r.vx / L * 0.25 - 0.09, r.y - r.vy / L * 0.25 - 0.09, r.z - r.vz / L * 0.25 - 0.09, 0.18, 0.18, 0.18, [1, 0.6, 0.15], 1, vp);
  }
  for (const b of beams) {
    const dx = b.h[0] - b.o[0], dy = b.h[1] - b.o[1], dz = b.h[2] - b.o[2], L = Math.hypot(dx, dy, dz);
    const n = Math.min(60, Math.ceil(L / 0.3)), w = b.w * (0.5 + 0.5 * b.t / b.t0);
    for (let i = 0; i <= n; i++) { const k = i / n; drawCube(b.o[0] + dx * k - w / 2, b.o[1] + dy * k - w / 2, b.o[2] + dz * k - w / 2, w, w, w, b.c, 1, vp); }
  }
  for (const wv of waves) {
    const n = Math.max(16, Math.round(wv.r * 6));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; drawCube(wv.x + Math.cos(a) * wv.r - 0.15, wv.y, wv.z + Math.sin(a) * wv.r - 0.15, 0.3, 0.32, 0.3, [1, 0.3, 0.9], 1, vp); }
  }
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
    if (!NET.down && !cam3On()) drawGun(proj);
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
  for (let i = 0; i < WEAP.length; i++) if (e.code === "Digit" + (i + 1)) switchWeapon(i);
  if (e.code === "Space") e.preventDefault();
  if (e.code === "KeyP" && G.mode === "title") startRun();
});
window.addEventListener("keyup", e => { keys[e.code] = false; keys[e.key] = false; });
window.addEventListener("wheel", e => { if (G.mode === "play" && document.pointerLockElement === canvas) switchWeapon(); }, { passive: true });
(function bindWeaponBar() {
  const bar = document.getElementById("wbar");
  if (!bar) return;
  bar.addEventListener("pointerdown", e => {
    const b = e.target.closest("button[data-w]");
    e.preventDefault(); e.stopPropagation();
    if (b) switchWeapon(+b.dataset.w);
  });
  bar.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); });
})();
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

// =====================================================================
// RATITA INDUSTRIES ITEM PACK (Mini Pack DLC, Suggestion Booth #19) + FREE 3RD-PERSON CAMERA + FREE ASSIST MODE
// Paid part is gated by localStorage 'grokDLC.voxels.ratita_industries_item_pack' (set by the Grok Arcade
// DLC Shop, same origin). It unlocks live (no reload) and in co-op the host's copy is shared with guests.
// Ratita Industries is the company of Luna, Pi-rat (one eye) and Snowie, three very smart rats.
// FREE for everyone: 3rd-person camera (V / CAM button / title) and Assist Mode (title).
// =====================================================================
const RAT_KEY = "grokDLC.voxels.ratita_industries_item_pack";
const ARCADE_URL = "https://lizethbran13-cmyk.github.io/grok-arcade/";
let ratWas = null;
function ratOwnLocal() {
  try {
    if (localStorage.getItem(RAT_KEY)) return true;
    const all = JSON.parse(localStorage.getItem("grokDLC.owned") || "[]");
    return Array.isArray(all) && all.indexOf(RAT_KEY) >= 0;
  } catch (e) { return false; }
}
function ratOwned() { return ratOwnLocal() || (NET.on && !NET.host && !!NET.hostRat); }
// skins: index 0 is free (your co-op colour), the rest come with the pack
const SKINS = [
  { id: "classic", name: "CLASSIC", free: true },
  { id: "luna", name: "LUNA LAB COAT", body: [0.96, 0.96, 1.0], trim: [0.62, 0.36, 1.0], pants: [0.42, 0.24, 0.72], head: [0.66, 0.64, 0.72], visor: [0.75, 0.5, 1.0], ear: [0.66, 0.64, 0.72], tail: true, extra: "goggles" },
  { id: "pirat", name: "PI-RAT CAPTAIN", body: [0.14, 0.13, 0.17], trim: [0.95, 0.15, 0.2], pants: [0.3, 0.2, 0.14], head: [0.55, 0.47, 0.42], visor: [1.0, 0.85, 0.2], ear: [0.55, 0.47, 0.42], tail: true, extra: "pirate" },
  { id: "snowie", name: "SNOWIE FROST SUIT", body: [0.62, 0.88, 1.0], trim: [1.0, 1.0, 1.0], pants: [0.35, 0.6, 0.9], head: [0.98, 0.98, 1.0], visor: [0.4, 0.95, 1.0], ear: [0.98, 0.98, 1.0], tail: true, extra: "scarf" },
  { id: "ceo", name: "RATITA CEO", body: [0.2, 0.18, 0.3], trim: [1.0, 0.82, 0.2], pants: [0.16, 0.15, 0.22], head: [0.72, 0.7, 0.74], visor: [1.0, 0.82, 0.2], ear: [0.72, 0.7, 0.74], tail: true, extra: "tophat" },
  { id: "robo", name: "ROBO-RAT MK1", body: [0.75, 0.78, 0.85], trim: [0.1, 0.95, 1.0], pants: [0.35, 0.38, 0.45], head: [0.82, 0.85, 0.9], visor: [0.1, 0.95, 1.0], ear: [0.6, 0.63, 0.7], tail: true, extra: "antenna", glow: true },
];
const GADGETS = [
  { id: "buddy", name: "ROBO-RAT BUDDY", icon: "🐀", cd: 26, desc: "a tiny Ratita drone that zaps bots for 15 s" },
  { id: "shield", name: "BUBBLE SHIELD", icon: "🫧", cd: 18, desc: "blocks all damage for 5 s" },
  { id: "jet", name: "JET TAIL", icon: "🚀", cd: 5, desc: "rocket hop up and forward" },
];
function ratSkinIdx() { const i = SKINS.findIndex(s => s.id === STORE.skin); return i > 0 && ratOwned() ? i : 0; }
function skinFor(idx, rgb) {
  const S = SKINS[idx | 0];
  if (S && !S.free) return S;
  const c = rgb || [0.1, 0.88, 1.0];
  return { body: c, trim: [1, 1, 1], pants: [c[0] * 0.45, c[1] * 0.45, c[2] * 0.45], head: [0.95, 0.85, 0.75], visor: c, classic: true };
}
function cam3On() { return !!STORE.cam3 && G.mode === "play" && !NET.down; }
let CAM3 = null;
// 3rd person: shots still leave from your eye, aimed at whatever is under the crosshair
function aimFwd() {
  const f = forward();
  if (!cam3On() || !CAM3) return f;
  const o = { x: CAM3.x, y: CAM3.y, z: CAM3.z };
  const vh = traceVoxels(o, f, 70); let T = vh ? vh.t : 70;
  for (const e of enemies) {
    if (e.hp <= 0 || e.dormant) continue;
    const b = enemyBox(e); const t = rayAABB(o, f, b[0], b[1], b[2], b[3], b[4], b[5], T);
    if (t !== null && t < T) T = t;
  }
  const ep = eyePos();
  const tx = o.x + f.x * T - ep.x, ty = o.y + f.y * T - ep.y, tz = o.z + f.z * T - ep.z, L = Math.hypot(tx, ty, tz) || 1;
  if (L < 0.8) return f;
  return { x: tx / L, y: ty / L, z: tz / L };
}
function cam3View(shx, shy) {
  const f = forward(), rx = Math.cos(P.yaw), rz = Math.sin(P.yaw);
  const e = { x: P.x, y: P.y + P.eye + 0.12, z: P.z };
  let dx = -f.x * 3.3 + rx * 0.72, dy = -f.y * 3.3 + 0.55, dz = -f.z * 3.3 + rz * 0.72;
  const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
  const hit = traceVoxels(e, { x: dx, y: dy, z: dz }, L);
  const dist = hit ? Math.max(0.3, hit.t - 0.3) : L;
  const x = e.x + dx * dist + shx, y = e.y + dy * dist + shy, z = e.z + dz * dist;
  CAM3 = { x, y, z, dist };
  return { x, y, z, view: lookAt(x, y, z, x + f.x, y + f.y, z + f.z, 0, 1, 0) };
}
function drawBoxR(ox, oy, oz, yaw, lx, ly, lz, sx, sy, sz, col, emit, vp) {
  const model = m4mul(m4trans(ox, oy, oz), m4mul(m4rotY(-yaw), cubeModel(lx, ly, lz, sx, sy, sz)));
  drawMesh(unitMesh, model, m4mul(vp, model), col, emit || 0);
}
// the player figure (you in 3rd person, partners in co-op). Local axes: +x right, -z forward.
function drawAvatar(x, y, z, yaw, S, walk, vp, gunCol) {
  const b = (lx, ly, lz, sx, sy, sz, c, em) => drawBoxR(x, y, z, yaw, lx, ly, lz, sx, sy, sz, c, em, vp);
  const g = S.glow ? 0.35 : 0;
  b(-0.24, 0, -0.1 + walk, 0.2, 0.7, 0.2, S.pants);
  b(0.04, 0, -0.1 - walk, 0.2, 0.7, 0.2, S.pants);
  b(-0.3, 0.7, -0.2, 0.6, 0.62, 0.4, S.body, S.classic ? 0.18 : g * 0.3);
  b(-0.31, 0.9, -0.21, 0.62, 0.1, 0.42, S.trim, 0.3);
  b(-0.44, 0.78 , -0.12 - walk * 0.6, 0.14, 0.5, 0.22, S.body);
  b(0.3, 0.98, -0.52, 0.14, 0.14, 0.42, S.body);
  b(-0.21, 1.32, -0.21, 0.42, 0.4, 0.42, S.head, 0.05);
  b(-0.19, 1.44, -0.25, 0.38, 0.12, 0.06, S.visor, 0.6);
  b(0.28, 0.94, -1.0, 0.13, 0.13, 0.52, gunCol || [0.22, 0.24, 0.3]);
  if (S.classic) return;
  // rat ears (pink inside) + tail
  for (const sx of [-0.27, 0.11]) { b(sx, 1.64, -0.06, 0.16, 0.16, 0.06, S.ear); b(sx + 0.04, 1.68, -0.075, 0.08, 0.08, 0.02, [1, 0.62, 0.72], 0.2); }
  b(-0.05, 1.4, -0.29, 0.1, 0.08, 0.06, [1, 0.6, 0.7], 0.3); // nose
  if (S.tail) { b(-0.04, 0.72, 0.2, 0.08, 0.08, 0.32, [1, 0.68, 0.74]); b(-0.035, 0.62, 0.5, 0.07, 0.07, 0.26, [1, 0.68, 0.74]); }
  if (S.extra === "pirate") { b(0.0, 1.43, -0.27, 0.18, 0.16, 0.04, [0.04, 0.04, 0.05]); b(-0.23, 1.6, -0.23, 0.46, 0.1, 0.46, [0.85, 0.1, 0.15]); }
  else if (S.extra === "goggles") { b(-0.17, 1.44, -0.28, 0.14, 0.12, 0.04, [0.8, 0.6, 1], 0.7); b(0.03, 1.44, -0.28, 0.14, 0.12, 0.04, [0.8, 0.6, 1], 0.7); }
  else if (S.extra === "scarf") { b(-0.25, 1.24, -0.25, 0.5, 0.12, 0.5, [0.4, 0.85, 1], 0.2); b(0.12, 0.95, -0.27, 0.12, 0.3, 0.06, [0.4, 0.85, 1], 0.2); }
  else if (S.extra === "tophat") { b(-0.24, 1.72, -0.24, 0.48, 0.05, 0.48, [0.08, 0.08, 0.1]); b(-0.16, 1.77, -0.16, 0.32, 0.3, 0.32, [0.08, 0.08, 0.1]); b(-0.165, 1.8, -0.165, 0.33, 0.06, 0.33, S.trim, 0.4); }
  else if (S.extra === "antenna") { b(-0.03, 1.72, -0.03, 0.06, 0.26, 0.06, [0.5, 0.52, 0.6]); b(-0.06, 1.98, -0.06, 0.12, 0.12, 0.12, [0.1, 0.95, 1], 1); }
}
// ---------- weapons (indices 5-7 in WEAP) ----------
function ratGun(w, gbox) {
  if (w === 5) { // CHEESE CANNON: a chunky cheese wedge barrel with holes
    gbox(-0.1, 0.0, -0.62, 0.2, 0.18, 0.7, [1, 0.8, 0.18], 0.15);
    gbox(-0.105, 0.05, -0.5, 0.05, 0.05, 0.05, [0.75, 0.55, 0.08], 0); gbox(0.05, 0.1, -0.75, 0.06, 0.05, 0.06, [0.75, 0.55, 0.08], 0);
    gbox(-0.07, 0.15, -0.35, 0.05, 0.04, 0.05, [0.75, 0.55, 0.08], 0);
    gbox(-0.08, 0.02, -0.98, 0.16, 0.14, 0.06, [0.3, 0.3, 0.36], 0);
    gbox(-0.06, 0.18, -0.2, 0.12, 0.08, 0.16, [0.6, 0.36, 1], 0.4); // Luna purple sight
  } else if (w === 6) { // SQUEAK ZAPPER: coil + little rat-ear antennas
    gbox(-0.07, 0.03, -0.3, 0.14, 0.13, 0.5, [0.25, 0.28, 0.4], 0);
    for (let i = 0; i < 4; i++) gbox(-0.06, 0.04, -0.4 - i * 0.1, 0.12, 0.11, 0.04, [0.55, 0.8, 1], 0.9);
    gbox(-0.03, 0.06, -0.86, 0.06, 0.06, 0.3, [0.6, 0.62, 0.7], 0);
    gbox(-0.08, 0.17, -0.22, 0.05, 0.07, 0.03, [0.55, 0.5, 0.48], 0); gbox(0.03, 0.17, -0.22, 0.05, 0.07, 0.03, [0.55, 0.5, 0.48], 0);
    gbox(-0.02, 0.15, -0.12, 0.04, 0.04, 0.04, [0.95, 0.15, 0.2], 0.8); // Pi-rat's one red eye
  } else { // SNOWIE SPRAYER: snowball hopper + frosty nozzle
    gbox(-0.08, 0.02, -0.3, 0.16, 0.14, 0.5, [0.92, 0.97, 1], 0.1);
    gbox(-0.07, 0.16, -0.32, 0.14, 0.16, 0.18, [0.62, 0.88, 1], 0.5);
    gbox(-0.05, 0.05, -0.7, 0.1, 0.1, 0.4, [0.5, 0.75, 0.95], 0);
    gbox(-0.06, 0.04, -0.74, 0.12, 0.12, 0.05, [1, 1, 1], 0.9);
  }
}
function ratShoot(w, o, d0) {
  if (w === 5) { // CHEESE CANNON: lobbed cheese wheel, gooey splash, no craters
    G.cheese--; G.muzzle = 0.1; G.recoil = 0.36; G.shotCd = 0.8; G.shake = Math.max(G.shake, 0.18);
    blip(180, 0.16, "triangle", 0.08, 60);
    const d = assistDir(o, d0), g = gunTip(o), S = 18;
    rockets.push({ x: g[0], y: g[1], z: g[2], vx: d.x * S, vy: d.y * S + 2.4, vz: d.z * S, life: 2.5, mine: true, cheese: true });
    if (NET.on) netEvent({ t: "rk", o: g.map(nr2), v: [nr2(d.x * S), nr2(d.y * S + 2.4), nr2(d.z * S)], ch: 1 });
    if (G.cheese <= 0) emptyBack();
  } else if (w === 6) { // SQUEAK ZAPPER: chain lightning that hops to 3 more bots
    G.zap--; G.muzzle = 0.06; G.recoil = 0.14; G.shotCd = 0.42; G.shake = Math.max(G.shake, 0.08);
    blip(1800, 0.06, "square", 0.04, 2600); setTimeout(() => blip(2400, 0.05, "square", 0.03, 3200), 50);
    const first = fireRay(o, assistDir(o, d0), 2);
    const pts = [gunTip(o), (NET.lastHit || [o.x, o.y, o.z]).slice()], seen = new Set();
    let cur = first;
    if (cur) seen.add(cur);
    for (let k = 0; k < 3 && cur; k++) {
      let nb = null, nd = 6.5;
      for (const e of enemies) {
        if (e.hp <= 0 || e.dormant || seen.has(e)) continue;
        const dd = Math.hypot(e.x - cur.x, ctrY(e) - ctrY(cur), e.z - cur.z);
        if (dd < nd && los(cur.x, ctrY(cur), cur.z, e.x, ctrY(e), e.z)) { nd = dd; nb = e; }
      }
      if (!nb) break;
      seen.add(nb); pts.push([nb.x, ctrY(nb), nb.z]);
      damageEnemy(nb, 1.5, nb.x, ctrY(nb), nb.z);
      cur = nb;
    }
    for (let i = 0; i + 1 < pts.length; i++) addBeam(pts[i], pts[i + 1], [0.55, 0.8, 1], 0.16, 0.07);
    if (NET.on) netEvent({ t: "s", o: pts[0].map(nr2), h: pts[1].map(nr2), w: 6, c: pts.slice(2).map(p => p.map(nr2)) });
    if (G.zap <= 0) emptyBack();
  } else { // SNOWIE SPRAYER: rapid snowballs that chill and freeze bots
    G.snow--; G.shotCd = 0.11; G.recoil = Math.max(G.recoil, 0.06); G.muzzle = 0.04;
    if (!G.snowSnd || G.time - G.snowSnd > 0.15) { blip(900, 0.05, "triangle", 0.03, 500); G.snowSnd = G.time; }
    const d = assistDir(o, d0), s = 0.025;
    const pd = { x: d.x + (Math.random() - 0.5) * s, y: d.y + (Math.random() - 0.5) * s, z: d.z + (Math.random() - 0.5) * s };
    const L = Math.hypot(pd.x, pd.y, pd.z); pd.x /= L; pd.y /= L; pd.z /= L;
    const hitE = fireRay(o, pd, 0.35);
    if (hitE) { if (NET.on && !NET.host) { netSend({ t: "frz", id: hitE.id }); hitE.frost = (hitE.frost || 0) + 1; } else applyFrost(hitE); }
    ratSnowFx(gunTip(o), pd);
    if (NET.on && (G.snowNet = (G.snowNet || 0) + 1) % 2 === 0) netShot(o, 7);
    if (G.snow <= 0) emptyBack();
  }
  updateHUD();
}
function ratSnowFx(g, d) {
  for (let i = 0; i < 2; i++) parts.push({ x: g[0], y: g[1], z: g[2], vx: d.x * (16 + i * 3), vy: d.y * 16 + 2, vz: d.z * (16 + i * 3), life: 0.45, col: [0.95, 0.98, 1], s: 0.14 });
}
function ratCheeseFx(p) {
  burst(p[0], p[1], p[2], [1, 0.82, 0.2], 18, 5); burst(p[0], p[1], p[2], [1, 0.95, 0.6], 8, 3);
  if (Math.hypot(p[0] - P.x, p[2] - P.z) < 30) blip(120, 0.25, "sine", 0.09, 40);
}
function ratCheeseHit(r) {
  const p = [nr2(r.x - r.vx * 0.012), nr2(r.y - r.vy * 0.012), nr2(r.z - r.vz * 0.012)];
  ratCheeseFx(p);
  if (!r.mine) return;
  if (NET.on) netEvent({ t: "chz", p });
  for (const e of enemies) {
    if (e.hp <= 0 || e.dormant) continue;
    const d = Math.hypot(e.x - p[0], ctrY(e) - p[1], e.z - p[2]) - EN[e.kind].box[0] * 0.5;
    if (d > 2.6) continue;
    damageEnemy(e, Math.max(1, Math.round(4 * (1 - Math.max(0, d) / 2.6))) + (r.direct === e ? 2 : 0), e.x, ctrY(e), e.z);
  }
}
function ratDrawCheese(r, vp) {
  const s = Math.sin(G.time * 14) * 0.03;
  drawCube(r.x - 0.17, r.y - 0.12 + s, r.z - 0.17, 0.34, 0.24, 0.34, [1, 0.8, 0.18], 0.4, vp);
  drawCube(r.x - 0.05, r.y + 0.1 + s, r.z - 0.05, 0.1, 0.04, 0.1, [0.78, 0.55, 0.08], 0, vp);
}
function ratRemoteShot(d, near) {
  if (d.w === 6) {
    const pts = [d.o, d.h].concat(d.c || []);
    for (let i = 0; i + 1 < pts.length; i++) addBeam(pts[i], pts[i + 1], [0.55, 0.8, 1], 0.16, 0.07);
    if (near) blip(1800, 0.05, "square", 0.02, 2600);
  } else if (d.w === 7) {
    const dx = d.h[0] - d.o[0], dy = d.h[1] - d.o[1], dz = d.h[2] - d.o[2], L = Math.hypot(dx, dy, dz) || 1;
    ratSnowFx(d.o, { x: dx / L, y: dy / L, z: dz / L });
  }
}
function ratStartRun() {
  const own = ratOwned();
  for (const i of [5, 6, 7]) G.got[i] = own;
  G.cheese = own ? 8 : 0; G.zap = own ? 24 : 0; G.snow = own ? 60 : 0;
  G.gcd = [0, 0, 0]; G.shieldT = 0; G.buddy = null; if (typeof G.gad !== "number") G.gad = 0;
  if (STORE.assist) G.reserve += 24;
  G.hp = maxHp();
  ratHud(true);
}
function ratRefill(k) { if (!ratOwned()) return; G.cheese = Math.min(WEAP[5].max, (G.cheese | 0) + Math.round(2 * k)); G.zap = Math.min(WEAP[6].max, (G.zap | 0) + Math.round(6 * k)); G.snow = Math.min(WEAP[7].max, (G.snow | 0) + Math.round(20 * k)); }
// ---------- gadgets ----------
function ratGadget() {
  if (G.mode !== "play" || NET.down) return;
  if (!ratOwned()) { toast("🔒 RATITA DLC GADGET", "#ffd23f"); return; }
  const i = G.gad | 0, GD = GADGETS[i];
  if (G.gcd[i] > 0) { toast("RECHARGING " + Math.ceil(G.gcd[i]) + "s", "#9fc3dc"); return; }
  G.gcd[i] = GD.cd;
  const f = forward();
  if (GD.id === "buddy") { G.buddy = { t: 15, x: P.x, y: P.y + 2, z: P.z, cd: 0.5, a: 0 }; toast("🐀 ROBO-RAT BUDDY, GO!", "#9fe8ff"); blip(1200, 0.08, "square", 0.05, 1800); }
  else if (GD.id === "shield") { G.shieldT = 5; toast("🫧 BUBBLE SHIELD UP!", "#7fd8ff"); blip(500, 0.3, "sine", 0.07, 900); }
  else { const fl = Math.hypot(f.x, f.z) || 1; P.vy = 12; P.vx += f.x / fl * 8; P.vz += f.z / fl * 8; P.grounded = false; sfx("jump"); for (let k = 0; k < 14; k++) parts.push({ x: P.x, y: P.y + 0.4, z: P.z, vx: (Math.random() - 0.5) * 3, vy: -4 - Math.random() * 3, vz: (Math.random() - 0.5) * 3, life: 0.5, col: Math.random() < 0.5 ? [1, 0.6, 0.1] : [1, 0.9, 0.3], s: 0.16 }); }
  ratHud(true);
}
function ratCycleGadget() { if (!ratOwned()) { ratGadget(); return; } G.gad = ((G.gad | 0) + 1) % GADGETS.length; toast(GADGETS[G.gad].icon + " " + GADGETS[G.gad].name, "#ffd23f"); ratHud(true); }
function ratShieldPing() { G.hurtFlash = 0; blip(1400, 0.06, "sine", 0.04, 800); burst(P.x, P.y + 1, P.z, [0.5, 0.85, 1], 4, 3); }
function ratUpdate(dt) {
  if (!G.gcd) return;
  for (let i = 0; i < G.gcd.length; i++) G.gcd[i] = Math.max(0, G.gcd[i] - dt);
  if (G.shieldT > 0) G.shieldT = Math.max(0, G.shieldT - dt);
  const bd = G.buddy;
  if (bd) {
    bd.t -= dt; bd.a += dt * 2.4;
    const tx = P.x + Math.cos(bd.a) * 1.2, ty = P.y + 2.1 + Math.sin(G.time * 3) * 0.15, tz = P.z + Math.sin(bd.a) * 1.2;
    const k = Math.min(1, dt * 6); bd.x += (tx - bd.x) * k; bd.y += (ty - bd.y) * k; bd.z += (tz - bd.z) * k;
    bd.cd -= dt;
    if (bd.cd <= 0) {
      bd.cd = 0.55;
      let best = null, bdist = 16;
      for (const e of enemies) {
        if (e.hp <= 0 || e.dormant) continue;
        const dd = Math.hypot(e.x - bd.x, e.z - bd.z);
        if (dd < bdist && los(bd.x, bd.y, bd.z, e.x, ctrY(e), e.z)) { bdist = dd; best = e; }
      }
      if (best) {
        const h = [best.x, ctrY(best), best.z];
        damageEnemy(best, 1, h[0], h[1], h[2]);
        addBeam([bd.x, bd.y, bd.z], h, [0.6, 0.95, 1], 0.12, 0.06);
        blip(2000, 0.04, "square", 0.025, 2600);
        if (NET.on) netEvent({ t: "s", o: [nr2(bd.x), nr2(bd.y), nr2(bd.z)], h: h.map(nr2), w: 6 });
      }
    }
    if (bd.t <= 0) { G.buddy = null; toast("BUDDY WENT HOME 🧀", "#9fc3dc"); }
  }
  document.body.classList.toggle("shield-on", G.shieldT > 0);
  ratHud(false);
}
function ratDraw(vp) {
  if (G.mode !== "play") return;
  if (cam3On() && CAM3 && CAM3.dist > 0.9) {
    const sp = Math.hypot(P.vx, P.vz), walk = P.grounded && sp > 0.5 ? Math.sin(G.time * 12) * 0.12 : 0;
    drawAvatar(P.x, P.y, P.z, P.yaw, skinFor(ratSkinIdx(), NET.on && NET.prm ? hexRgb(NET.prm.color) : null), walk, vp, WEAP[G.weapon].col);
    if (G.muzzle > 0) { const f = forward(), rx = Math.cos(P.yaw), rz = Math.sin(P.yaw); drawCube(P.x + f.x * 1.15 + rx * 0.33 - 0.09, P.y + 1.0, P.z + f.z * 1.15 + rz * 0.33 - 0.09, 0.18, 0.18, 0.18, [1, 0.9, 0.4], 1, vp); }
  }
  if (G.shieldT > 0 && cam3On()) {
    const n = 14;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + G.time * 1.5, yy = P.y + 0.9 + Math.sin(a * 2 + G.time * 3) * 0.6; drawCube(P.x + Math.cos(a) * 0.85 - 0.07, yy, P.z + Math.sin(a) * 0.85 - 0.07, 0.14, 0.14, 0.14, [0.55, 0.88, 1], 1, vp); }
  }
  const bd = G.buddy;
  if (bd) { // little robot rat drone: grey body, pink ears, tail, cyan eye, spinning rotor
    const yaw = bd.a + Math.PI;
    const b = (lx, ly, lz, sx, sy, sz, c, em) => drawBoxR(bd.x, bd.y, bd.z, yaw, lx, ly, lz, sx, sy, sz, c, em, vp);
    b(-0.18, -0.1, -0.26, 0.36, 0.22, 0.5, [0.72, 0.75, 0.82], 0.1);
    b(-0.12, -0.04, -0.36, 0.24, 0.16, 0.12, [0.8, 0.82, 0.88], 0.1);
    b(-0.2, 0.1, -0.2, 0.1, 0.12, 0.04, [1, 0.62, 0.72], 0.3); b(0.1, 0.1, -0.2, 0.1, 0.12, 0.04, [1, 0.62, 0.72], 0.3);
    b(-0.09, 0.0, -0.38, 0.06, 0.05, 0.02, [0.1, 0.95, 1], 1); b(0.03, 0.0, -0.38, 0.06, 0.05, 0.02, [0.1, 0.95, 1], 1);
    b(-0.03, -0.06, 0.24, 0.06, 0.05, 0.36, [1, 0.68, 0.74]);
    const ra = G.time * 30; drawBoxR(bd.x, bd.y + 0.16, bd.z, ra, -0.32, 0, -0.03, 0.64, 0.03, 0.06, [0.3, 0.3, 0.36], 0, vp);
  }
}
// HUD: gadget chip + camera button
let ratHudSig = "";
function ratHud(force) {
  const chip = document.getElementById("gad-chip"), gb = document.getElementById("btn-gadget");
  const own = ratOwned() && G.mode === "play";
  if (chip) chip.classList.toggle("hidden", !own);
  if (gb) gb.classList.toggle("hidden", !own);
  if (!own || !chip || !G.gcd) return;
  const i = G.gad | 0, GD = GADGETS[i], cd = G.gcd[i], sig = i + ":" + Math.ceil(cd) + ":" + (G.shieldT > 0) + ":" + !!G.buddy;
  if (!force && sig === ratHudSig) return;
  ratHudSig = sig;
  chip.innerHTML = "<b>" + GD.icon + "</b><span>" + GD.name + "<i>" + (cd > 0 ? "RECHARGING " + Math.ceil(cd) + "s" : isTouchPlay() ? "READY · tap to switch" : "READY · F use · T switch") + "</i></span><u style='width:" + Math.round((1 - cd / GD.cd) * 100) + "%'></u>";
  chip.classList.toggle("ready", cd <= 0);
  if (gb) { gb.innerHTML = GD.icon + "<br>" + (cd > 0 ? Math.ceil(cd) + "s" : "GADGET"); gb.classList.toggle("cool", cd > 0); }
}
function ratToggleCam() {
  STORE.cam3 = !STORE.cam3; saveStore(STORE);
  if (G.mode === "play") toast(STORE.cam3 ? "🎥 3RD-PERSON CAMERA" : "🎥 1ST-PERSON CAMERA", "#1ce0ff");
  ratTitle();
}
// title-screen options (free) + the pack panel (owned / locked teaser)
function ratTitle() {
  const co = document.getElementById("cam-opt"), ao = document.getElementById("assist-opt");
  if (co) { co.textContent = "🎥 CAMERA: " + (STORE.cam3 ? "3RD PERSON" : "1ST PERSON"); co.classList.toggle("on", !!STORE.cam3); }
  if (ao) { ao.textContent = "🛟 ASSIST MODE: " + (STORE.assist ? "ON" : "OFF"); ao.classList.toggle("on", !!STORE.assist); }
  const cb = document.getElementById("cam-btn"); if (cb) cb.textContent = STORE.cam3 ? "3RD" : "1ST";
  const od = document.getElementById("opt-desc");
  if (od) od.textContent = STORE.assist ? "Assist Mode: 150 health, 40% less damage, faster healing, extra ammo, stronger aim assist and no fall damage." : "Free for everyone. Assist Mode makes it easier: more health, stronger aim assist and more.";
  const el = document.getElementById("rat-panel");
  if (!el) return;
  const own = ratOwned(), viaHost = own && !ratOwnLocal();
  const plaque = "<div class='rat-plaque'><span title='Luna'>🐀<em>LUNA</em></span><span title='Pi-rat'>🐀<em>PI-RAT 👁️</em></span><span title='Snowie'>🐀<em>SNOWIE</em></span></div>";
  const skins = SKINS.map((s, i) => "<button type='button' data-sk='" + s.id + "' class='" + (i === ratSkinIdx() ? "on" : "") + (!s.free && !own ? " locked" : "") + "'>" + (!s.free && !own ? "🔒 " : "") + s.name + "</button>").join("");
  if (own) {
    el.className = "rat-panel owned";
    el.innerHTML = "<div class='rat-head'>🐀 RATITA INDUSTRIES ITEM PACK <b>" + (viaHost ? "SHARED BY HOST" : "OWNED ✓") + "</b></div>" + plaque +
      "<p>3 new weapons: <b>CHEESE CANNON</b> (6), <b>SQUEAK ZAPPER</b> (7), <b>SNOWIE SPRAYER</b> (8). 3 gadgets: <b>ROBO-RAT BUDDY</b>, <b>BUBBLE SHIELD</b>, <b>JET TAIL</b> (" + (isTouchPlay() ? "GADGET button, tap the chip to switch" : "F use, T switch") + ").</p>" +
      "<div class='skin-row'>" + skins + "</div>";
  } else {
    el.className = "rat-panel locked";
    el.innerHTML = "<div class='rat-head'>🔒 RATITA INDUSTRIES ITEM PACK <b>MINI PACK DLC</b></div>" + plaque +
      "<p>High-tech gear from Luna, Pi-rat and Snowie's lab: the <b>Cheese Cannon</b>, the chain-lightning <b>Squeak Zapper</b>, the freezing <b>Snowie Sprayer</b>, gadgets (<b>Robo-Rat Buddy</b> drone, <b>Bubble Shield</b>, <b>Jet Tail</b>) and 5 rat skins you can see in 3rd person.</p>" +
      "<div class='skin-row'>" + skins + "</div>" +
      "<a class='btn rat-buy' href='" + ARCADE_URL + "' target='_top'>UNLOCK IN THE GROK ARCADE DLC SHOP →</a>";
  }
}
function ratRefresh() {
  const own = ratOwned();
  if (ratWas === null) { ratWas = own; return; }
  if (own === ratWas) return;
  ratWas = own;
  if (NET.on && NET.host) netBroadcast({ t: "rat", on: ratOwnLocal() ? 1 : 0 });
  if (own) {
    toast("🐀 RATITA PACK UNLOCKED!", "#ffd23f"); sfx("win");
    if (G.mode === "play") { for (const i of [5, 6, 7]) G.got[i] = true; G.cheese = Math.max(G.cheese | 0, 8); G.zap = Math.max(G.zap | 0, 24); G.snow = Math.max(G.snow | 0, 60); if (!G.gcd) { G.gcd = [0, 0, 0]; G.gad = 0; } }
  } else if (G.weapon >= 5) G.weapon = 0;
  updateHUD(); ratHud(true); ratTitle();
}
(function bindRat() {
  const $ = (id) => document.getElementById(id);
  const tap = (el, fn) => { if (!el) return; el.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); el.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); }); };
  if ($("cam-opt")) $("cam-opt").addEventListener("click", (e) => { e.preventDefault(); ratToggleCam(); });
  if ($("assist-opt")) $("assist-opt").addEventListener("click", (e) => { e.preventDefault(); STORE.assist = !STORE.assist; saveStore(STORE); ratTitle(); });
  if ($("rat-panel")) $("rat-panel").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-sk]"); if (!b) return;
    e.preventDefault();
    const S = SKINS.find(s => s.id === b.dataset.sk);
    if (!S.free && !ratOwned()) { toast("🔒 RATITA DLC SKIN", "#ffd23f"); return; }
    STORE.skin = S.id; saveStore(STORE); ratTitle();
  });
  tap($("cam-btn"), ratToggleCam);
  tap($("btn-gadget"), ratGadget);
  tap($("gad-chip"), ratCycleGadget);
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyV") ratToggleCam();
    if (e.code === "KeyF" && G.mode === "play") ratGadget();
    if (e.code === "KeyT" && G.mode === "play") ratCycleGadget();
  });
  setInterval(ratRefresh, 1000);
  window.addEventListener("storage", (e) => { if (!e.key || e.key === RAT_KEY || e.key === "grokDLC.owned") ratRefresh(); });
  ratRefresh(); ratTitle();
})();

function refreshTitle() {
  document.querySelectorAll("#diff-row button").forEach(b => b.classList.toggle("on", +b.dataset.d === G.diff));
  document.getElementById("diff-desc").textContent = DIFFS[G.diff].desc;
  const lr = document.getElementById("lvl-row");
  if (lr) {
    const opts = [[-1, "MIX ⟳"]].concat(LEVELS.map((L, i) => [i, L.short]));
    lr.innerHTML = opts.map(([v, label]) => {
      const c = v > 0 ? (STORE.clear[LEVELS[v].id] || [0, 0, 0]) : null;
      const stars = c ? "<i>" + c.map((x, d) => "<u class='s" + d + (x ? " got" : "") + "'>★</u>").join("") + "</i>" : "";
      return "<button type='button' data-l='" + v + "' class='" + (v === STORE.lvl ? "on" : "") + (v > 0 ? " lv" + v : "") + "'>" + label + stars + "</button>";
    }).join("");
    const on = lr.querySelector("button.on");
    if (on && on.scrollIntoView && !lr.dataset.scrolled) { lr.dataset.scrolled = 1; try { lr.scrollLeft = Math.max(0, on.offsetLeft - 40); } catch (e) {} }
    const nx = MIX_ORDER[STORE.rot % MIX_ORDER.length];
    document.getElementById("lvl-desc").textContent = STORE.lvl < 0
      ? "Handcrafted levels rotate with random courses. Next up: " + LEVELS[nx].name
      : LEVELS[STORE.lvl].desc;
  }
  const parts = DIFFS.map(d => STORE.best[d.name] ? d.name + " " + STORE.best[d.name] : "").filter(Boolean);
  document.getElementById("title-best").textContent = parts.length ? "BEST · " + parts.join(" · ") : "";
  ratTitle();
}
document.querySelectorAll("#diff-row button").forEach(b => b.addEventListener("click", e => {
  e.preventDefault(); G.diff = +b.dataset.d; STORE.diff = G.diff; saveStore(STORE); refreshTitle();
}));
document.getElementById("lvl-row").addEventListener("click", e => {
  const b = e.target.closest("button[data-l]");
  if (!b) return;
  e.preventDefault(); STORE.lvl = +b.dataset.l; saveStore(STORE); refreshTitle();
});
refreshTitle();
document.getElementById("play-btn").addEventListener("click", () => startRun());
document.getElementById("retry-btn").addEventListener("click", () => startRun(undefined, undefined, G.level));
document.getElementById("again-btn").addEventListener("click", () => startRun());
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
    if (d < bd) { bd = d; best = { x: L.x, y: L.y, z: L.z, pid: R.pid, vx: L.vx || 0, vz: L.vz || 0 }; }
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
function netShot(o, w) {
  const h = NET.lastHit || [o.x, o.y, o.z];
  netEvent({ t: "s", o: [nr2(o.x), nr2(o.y - 0.25), nr2(o.z)], h: [nr2(h[0]), nr2(h[1]), nr2(h[2])], w: w || 0 });
}
function netBolt(b) {
  netBroadcast({ t: "bolt", b: [nr2(b.x), nr2(b.y), nr2(b.z), nr2(b.vx), nr2(b.vy), nr2(b.vz), b.dmg, nr2(b.src ? b.src.x : b.x), nr2(b.src ? b.src.z : b.z), b.c || 0] });
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
    netStandUp(maxHp());
    respawnAtCheckpoint();
    toast("BACK AT THE CHECKPOINT", "#7dff5a");
  }
}
function netStandUp(hp) {
  NET.down = false; G.hp = hp; G.invuln = 1.6; G.regenT = 0; P.eye = 1.55;
  updateHUD(); hpShown = -1; updateHpBar();
}
function netWipe() {
  netStandUp(maxHp());
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
    if (L.sk > 0 && SKINS[L.sk]) { drawAvatar(x, y, z, R.yaw, SKINS[L.sk], walk, vp); continue; } // Ratita skin
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
    hp: Math.round(G.hp / maxHp() * 100), sk: ratSkinIdx(), dn: NET.down ? 1 : 0, pad: NET.onPad ? 1 : 0, sc: G.score, k: G.kills, ds: NET.downs,
    rv: NET.revT > 0 ? NET.revTo : 0, rp: Math.round(NET.revT / REVIVE_TIME * 100) });
}
function netSendWorld() {
  if (!room || G.mode !== "play" || room.count() < 2) return;
  const e = [];
  for (const en of enemies) {
    if (en.hp <= 0 || en.dormant) continue;
    const wk = en.windup > 0 ? ({ melee: 2, charge: 3, slam: 4 }[en.wkind] || 1) : 0;
    const fl = (en.frozenT > 0 ? 1 : 0) | (en.blink > 0 ? 2 : 0) | (en.stunT > 0 ? 4 : 0) | (en.chargeT > 0 ? 8 : 0);
    e.push([en.id, nr2(en.x), nr2(en.y), nr2(en.z), nr2(en.yaw), Math.round(en.hp * 100) / 100, wk, wk ? Math.round(clamp(en.windup / (en.windMax || 1), 0, 1) * 100) : 0, en.alertT > 0 ? 1 : 0, en.hit > 0 ? 1 : 0, fl]);
  }
  room.broadcast({ t: "w", g: NET.gen, e });
}
function netOnWorld(d) {
  const now = performance.now(), seen = new Set();
  for (const s of d.e) {
    const e = NET.enemyMap.get(s[0]);
    if (!e) continue;
    seen.add(e);
    if (e.dormant) { e.dormant = false; e.x = s[1]; e.y = s[2]; e.z = s[3]; burst(e.x, e.y + 0.8, e.z, [0.4, 1, 0.5], 14, 3); }
    const lastS = e.snaps && e.snaps[e.snaps.length - 1];
    if (lastS && (e.kind === "grey" || e.kind === "boss") && Math.hypot(lastS.x - s[1], lastS.z - s[3]) > 3) { burst(lastS.x, lastS.y + 0.8, lastS.z, [0.4, 1, 0.5], 12, 3); burst(s[1], s[2] + 0.8, s[3], [0.4, 1, 0.5], 12, 3); }
    if (e.hp <= 0) { if (now - (e.predT || 0) < 600) continue; e.hp = s[5]; if (enemies.indexOf(e) < 0) enemies.push(e); } // host says it's still alive
    if (!e.snaps) e.snaps = [];
    e.snaps.push({ t: now, x: s[1], y: s[2], z: s[3], yw: s[4] });
    if (e.snaps.length > 20) e.snaps.shift();
    e.hp = now - (e.predT || 0) < 400 ? Math.min(e.hp, s[5]) : s[5];
    e.wkind = [null, "shot", "melee", "charge", "slam"][s[6]] || null;
    const fl = s[10] | 0;
    e.frozenT = fl & 1 ? 0.25 : 0; e.blink = fl & 2 ? 0.25 : 0; e.stunT = fl & 4 ? 0.25 : 0; e.chargeT = fl & 8 ? 0.25 : 0;
    e.windMax = 1; e.windup = s[6] ? Math.max(0.001, s[7] / 100) : 0;
    e.alertT = s[8] ? 0.4 : 0;
    if (s[9]) e.hit = Math.max(e.hit, 0.06);
    e.miss = 0;
  }
  for (const e of enemies) if (e.hp > 0 && !e.dormant && !seen.has(e) && ++e.miss >= 3) e.hp = 0;
}
function netPuppetEnemies(dt) {
  const rt = performance.now() - NET_INTERP;
  for (const e of enemies) {
    e.bob += dt * 6;
    e.hit = Math.max(0, e.hit - dt);
    if (e.hp <= 0 || !e.snaps || e.dormant) continue;
    const s = netSample(e.snaps, rt);
    if (s) { e.x = s.x; e.y = s.y; e.z = s.z; e.yaw = s.yw; }
  }
  enemies = enemies.filter((e) => e.hp > 0 || e.hit > 0 || e.dormant);
}

// ---------- run flow ----------
function netSetCount(n) {
  NET.n = n;
  NET.enemyMul = n >= 3 ? 1.6 : n === 2 ? 1.35 : 1;
  NET.tankHp = n >= 3 ? 3 : n === 2 ? 2 : 0;
}
function netAnnounceRun(seed, lvl) { // host
  NET.gen++;
  netSetCount(room ? room.count() : 1);
  NET.seed = seed >>> 0;
  NET.lv = lvl | 0;
  room.setMeta({ game: "voxels", playing: true, gen: NET.gen, seed: NET.seed, diff: G.diff, n: NET.n, lv: NET.lv });
  netBroadcast({ t: "start", seed: NET.seed, diff: G.diff, n: NET.n, lv: NET.lv });
}
function netStartFromHost(d, gen) { // joiner
  if (gen === NET.gen && G.mode === "play") return;
  NET.gen = gen;
  netSetCount(d.n);
  netHideCard();
  NET.applying = true;
  try { startRun(d.diff, d.seed, d.lv | 0); } finally { NET.applying = false; }
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
  room.sendTo(pid, { t: "sync", g: NET.gen, dead, took, drops, cps, cr: craters.slice(-60) });
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
  $id("again-btn").textContent = againLabel();
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
    if (NET.down) { NET.down = false; G.hp = maxHp(); P.eye = 1.55; }
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
  if (t === "rat") { if (!NET.host) { NET.hostRat = !!d.on; ratRefresh(); } return; } // host shares the Ratita pack
  if (t === "s") {
    if (from !== NET.pid && d.g === NET.gen) {
      const R = netRemote(from), near = Math.hypot(d.o[0] - P.x, d.o[2] - P.z) < 25;
      if (d.w === 2) { addBeam(d.o, d.h, [1, 0.3, 0.8], 0.14, 0.08); if (near) blip(1400, 0.08, "sawtooth", 0.025, 300); }
      else if (d.w === 4) addBeam(d.o, d.h, [0.65, 0.95, 1], 0.22, 0.1);
      else if (d.w >= 5) ratRemoteShot(d, near);
      else { NET.tracers.push({ o: d.o, h: d.h, t: 0.09, c: R.rgb }); if (near) blip(260, 0.05, "square", 0.025, 110); }
    }
    return;
  }
  if (t === "start") { if (!NET.host) netStartFromHost(d, d.g); return; }
  if (t === "lobby") { if (!NET.host) netGoLobby(); return; }
  if (d.g !== NET.gen) return;
  if (NET.host) {
    if (t === "dmg") { const e = NET.enemyMap.get(d.id); if (e && e.hp > 0) damageEnemy(e, d.d, e.x, e.y + 0.6, e.z, from, !!d.q); return; }
    if (t === "frz") { const e = NET.enemyMap.get(d.id); if (e && e.hp > 0) applyFrost(e); return; }
    if (t === "take") { const p = netPickup(d.id); if (p && p.alive) { p.alive = false; netBroadcast({ t: "took", id: p.id, by: from }); } return; }
  }
  switch (t) {
    case "rk": if (from !== NET.pid) rockets.push({ x: d.o[0], y: d.o[1], z: d.o[2], vx: d.v[0], vy: d.v[1], vz: d.v[2], life: 2.5, mine: false, cheese: !!d.ch }); break;
    case "chz": if (from !== NET.pid) ratCheeseFx(d.p); break;
    case "boom": if (from !== NET.pid) applyBoom(d.p[0], d.p[1], d.p[2]); break;
    case "wave": if (!NET.host) spawnWave(d.p[0], d.p[1], d.p[2], false); break;
    case "toast": if (!NET.host) toast(d.m, d.c); break;
    case "rev": if (d.to === NET.pid && NET.down) { netStandUp(50); toast("REVIVED BY " + netName(from).toUpperCase() + "!", "#7dff5a"); sfx("win"); netSendState(); } break;
    case "hit": if (!NET.host && d.to === NET.pid) hurtPlayer(d.d, { x: d.sx, z: d.sz }); break;
    case "w": if (!NET.host) netOnWorld(d); break;
    case "bolt": if (!NET.host) { const b = d.b; bolts.push({ x: b[0], y: b[1], z: b[2], vx: b[3], vy: b[4], vz: b[5], life: 3, friendly: false, dmg: b[6], src: { x: b[7], z: b[8] }, c: b[9] | 0 }); blip(160, 0.05, "square", 0.025, 70); } break;
    case "kill": if (!NET.host) { const e = NET.enemyMap.get(d.id); if (e) { if (e.hp > 0) { e.hp = 0; e.hit = 0.12; } killFx(e); } } break;
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
      for (const c of (d.cr || [])) applyBoom(c[0], c[1], c[2], true);
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
      if (NET.host) netBroadcast({ t: "rat", on: ratOwnLocal() ? 1 : 0 });
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
      if (NET.host) room.sendTo(p.pid, { t: "rat", on: ratOwnLocal() ? 1 : 0 });
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
    mode: G.mode, hp: Math.round(G.hp), maxRoom: G.maxRoom, kills: G.kills, score: G.score, seed: G.seed, level: G.level, enemies: enemies.filter((e) => e.hp > 0 && !e.dormant).length,
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
    if (e.hp <= 0 || e.dormant) continue;
    const d = Math.hypot(e.x - P.x, e.z - P.z);
    if (d < 20 && d < bd && (e.see || (d < 12 && los(P.x, P.y + P.eye, P.z, e.x, ctrY(e), e.z)))) { bd = d; tgt = e; }
  }
  touch.moveX = 0; touch.moveY = 0;
  if (tgt) {
    const ty = ctrY(tgt);
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
  get enemies() { return enemies.filter(e => e.hp > 0 && !e.dormant).map(e => e.kind); }, get best() { return Object.assign({}, STORE.best); },
  get level() { return G.level; }, get levelName() { return LEVELS[G.level].name; }, LEVELS, EN, DIFFS, STORE, get TH() { return TH; }, world, hardMask,
  get boss() { const b = enemies.find(e => e.kind === "boss"); return b ? { hp: b.hp, maxHp: b.maxHp, awake: !!b.awake, phase: b.hp < b.maxHp * 0.5 ? 2 : 1, x: b.x, z: b.z, active: enemies.filter(e => e.room === b.room && e.kind === "grey" && !e.dormant && e.hp > 0).length, dormant: enemies.filter(e => e.dormant).length } : null; },
  give(i, n) { G.got[i] = true; if (i) G[WEAP[i].key] = n || WEAP[i].max; else G.reserve += n || 36; updateHUD(); },
  setWeapon(i) { switchWeapon(i); return G.weapon; }, shoot() { G.shotCd = 0; shoot(); },
  get rocketsInFlight() { return rockets.length; }, get waves() { return waves.length; }, get craters() { return craters.length; },
  startLevel(d, l, seed) { G.bot = !!this._bot; startRun(d, seed, l); buildBotPath(); },
  get dmgTaken() { return G.dmgTaken; }, get weapon() { return G.weapon; }, get ammo() { return [G.ammo, G.reserve, G.shells]; },
  get winding() { return enemies.filter(e => e.hp > 0 && e.windup > 0).length; },
  faceNearest() {
    let t = null, bd = 1e9;
    for (const e of enemies) { if (e.hp <= 0 || e.dormant) continue; const d = Math.hypot(e.x - P.x, e.z - P.z) + (e.windup > 0 ? -100 : 0); if (d < bd) { bd = d; t = e; } }
    if (!t) return false;
    P.yaw = Math.atan2(t.x - P.x, -(t.z - P.z)); P.pitch = -Math.atan2(ctrY(t) - (P.y + P.eye), Math.hypot(t.x - P.x, t.z - P.z)); return true;
  },
  get pickups() { return pickups.filter(p => p.alive).map(p => p.kind); },
  start(d) { G.bot = !!this._bot; startRun(d); buildBotPath(); },
  setBot(on) { this._bot = !!on; G.bot = !!on; if (on) buildBotPath(); else { touch.moveX = touch.moveY = 0; shooting = false; } },
  setGod(on) { G.god = !!on; },
  tp(i) { const r = rooms[i]; if (!r) return false; P.x = r.door + 1.5; P.y = r.fy + 1.01; P.z = r.z + 2; P.vx = P.vy = P.vz = 0; P.yaw = Math.PI; return true; },
  tpXZ(x, z) { const r = rooms.find(q => z >= q.z && z < q.z + q.d) || rooms[0]; P.x = x; P.z = z; P.y = groundY(x | 0, z | 0, r) + 1.01; P.vx = P.vy = P.vz = 0; },
  // co-op test hooks
  net: () => netDebug(), P, G, get enemyList() { return enemies; }, get pickupList() { return pickups; }, get roomList() { return rooms; }, get extractPad() { return extract; },
  rat: { get owned() { return ratOwned(); }, get local() { return ratOwnLocal(); }, get skin() { return ratSkinIdx(); }, get cam3() { return cam3On(); }, get CAM3() { return CAM3; },
    get buddy() { return G.buddy; }, get shieldT() { return G.shieldT; }, get gad() { return G.gad; }, gadget: () => ratGadget(), cycle: () => ratCycleGadget(), toggleCam: () => ratToggleCam(),
    setAssist(on) { STORE.assist = !!on; saveStore(STORE); ratTitle(); }, setSkin(id) { STORE.skin = id; saveStore(STORE); ratTitle(); }, refresh: () => ratRefresh(), maxHp: () => maxHp(), aim: () => aimFwd(), fwd: () => forward() },
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
