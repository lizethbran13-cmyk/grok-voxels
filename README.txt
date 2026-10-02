GROK VOXELS 2.0
Open this folder with a local static server, then load index.html.

  python3 -m http.server 8080

Visit http://localhost:8080/

PLAY starts a new random course. Three lives. Extract on the gold pad.

Desktop: WASD move, mouse look, left click shoot, Space jump, Shift sprint, R reload.
Phone: left joystick to move, swipe the right side to look, FIRE / JUMP / RELOAD buttons.
Pointer lock is desktop-only; tap PLAY on a phone to start immediately.

A single-file copy also lives at /workspace/GrokVoxels.html (save that one file to play offline).

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
