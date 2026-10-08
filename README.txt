GROK VOXELS 3.0
Open this folder with a local static server, then load index.html.

  python3 -m http.server 8080

Visit http://localhost:8080/

PLAY starts the selected level (MIX rotates handcrafted levels with random courses). Three lives. Extract on the gold pad.

Desktop: WASD move, mouse look, left click shoot, Space jump, Shift sprint, R reload,
1-5 / Q / mouse wheel switch weapons.
Phone: left joystick to move, swipe the right side to look, FIRE / JUMP / RELOAD buttons, tap the weapon bar (or SWAP) to switch guns.
Pointer lock is desktop-only; tap PLAY on a phone to start immediately.

A single-file copy also lives at /workspace/GrokVoxels.html (save that one file to play offline).

What's new in 3.0
  * Five handcrafted levels with their own look, props, lighting and fog:
    SECRET LAB, AREA 51 HANGAR (boss: THE OVERSEER), NEON CITY ROOFTOPS,
    VOLCANO FORGE (lava hurts!) and FROZEN RESEARCH BASE (slippery ice).
    Level select on the title screen; MIX rotates them with random courses.
    Stars show which difficulties you've cleared per level.
  * New weapons: LASER RIFLE (pierces a line of enemies), ROCKET LAUNCHER
    (splash damage, blasts craters in props) and FREEZE RAY (hold to freeze
    enemies solid; frozen enemies take 1.5x damage). Weapon bar + keys 1-5.
  * New enemies: alien GREYS (teleport), SEEKER drones (fast, burst fire),
    mutant BRUTES (telegraphed charge), wall TURRETS (laser sight, bursts),
    and the Area 51 boss THE OVERSEER (fan shots, backup greys, phase 2 slam
    shockwave you have to jump).
  * HARD is actually hard now: ~2x enemies incl. gold-crowned elites, faster
    bots that lead their shots and hunt in packs, more damage, slower regen,
    scarce pickups, no checkpoint healing. EASY and NORMAL stay fair.
  * Online co-op works on every level (host-authoritative, boss scales with
    players).

What's new in 2.0
  * Difficulty select: EASY (default for new players) / NORMAL / HARD.
  * Health bar + regeneration: getting hit costs health, not a whole heart. Lose
    all health and you lose a heart and respawn at the last CHECKPOINT (green
    pillars just inside each combat room).
  * The course ramps up: early rooms have fewer, slower, less accurate bots;
    later rooms bring more bots, drones and armoured tanks.
  * Telegraphs: bots show "!" when they spot you, and glow + grow a charging orb
    before every shot (melee bots flare their claws) — move to dodge.
  * Pickups: health (green cross), ammo (gold), extra life (red heart), gems,
    and the new SCATTER gun (orange, 8 shells; Q / SWAP to switch). Bots drop
    ammo/health. Emergency ammo trickles in if you're completely dry.
  * Aim assist (stronger on phones and EASY). High scores saved per difficulty.
