/* =================================================================
   RENT RUN — a savagely on-the-nose platformer about being an open-source
   maintainer. You ship for $0 while two armies come for you: the BILLS that
   keep charging anyway (RENT · POWER · WATER · GAS · NET · GYM · ME TIME) and
   the ENTITLED ISSUES / dead PRs / "URGENT!!" DMs / dependency 0-DAYs ("ETA?",
   "+1", "UNPAID", "WONTFIX", "REVIEW?", "CVE"). Bump ? blocks for GitHub ★
   (worth $0), grab the COFFEE (caffeine = invincibility), and find the secret
   NEW PROJECT IDEA — another life = another project you'll start, never finishing this.

   Reach the castle and you win, obviously: its doors warm up and fireworks go up
   — because the castle is ManagedCode, the one place that pays you to maintain the
   stuff you've done for free — but first you JUMP the fire-spitting LAYOFF dragon
   (the meme boss) like Bowser. COFFEE = temporary invincibility; the secret block
   drops a NEW PROJECT IDEA (another one you'll start instead of finishing this one).

   Plays with keyboard (← → + space) or on-screen touch buttons on phones.
   Launched by clicking the corner mascot. Lazy + self-contained: the
   DOM/canvas is built only on first launch(), never on load, so it can't
   surface in screenshots/tests.
   ================================================================= */

type Game = { launch: () => void };

export function createMascotGame(): Game {
  const TILE = 16;
  const VIEW_W = 320;
  const VIEW_H = 176;
  const GROUND_ROW = 9;
  const GROUND_TOP = GROUND_ROW * TILE; // 144
  const LEVEL_W = 92;
  const WORLD_W = LEVEL_W * TILE;

  // ---- Level geometry ----
  const GROUND_SPANS: Array<[number, number]> = [
    [0, 68],
    [71, 77],
    [80, 91], // long opening run, then two late 1-1-style pits
  ];
  const PLATFORMS: Array<[number, number, number]> = [
    [9, 5, 1],
    [11, 5, 1],
    [13, 5, 1],
    [18, 3, 2],
    [31, 5, 3],
    [39, 3, 3],
    [48, 5, 2],
    [52, 5, 1],
    [54, 5, 2],
    [56, 3, 3],
    [63, 8, 1],
    [64, 7, 1],
    [65, 6, 1],
    [66, 5, 1],
    [74, 8, 1],
    [75, 7, 1],
    [76, 6, 1],
  ];
  const PIPES: Array<[number, number]> = [
    [24, 2],
    [44, 3],
    [60, 2],
  ]; // [tileX, heightTiles] (2 wide)
  const QDEF: Array<[number, number, 'coin' | 'power' | 'hidden']> = [
    [8, 5, 'coin'],
    [10, 5, 'coin'],
    [12, 5, 'coin'],
    [16, 5, 'hidden'],
    [32, 4, 'coin'],
    [40, 3, 'power'],
    [53, 5, 'coin'],
    [57, 3, 'hidden'],
    [80, 4, 'coin'],
  ];
  // enemies: [type, tileX, label?, tone?] — EVERYTHING wears a label so a dev reads
  // it at a glance. Two armies maul an open-source maintainer:
  //  · the BILLS (paper, ground walkers) — the real life that keeps charging while
  //    you ship for $0: RENT · POWER · WATER · GAS · NET · GYM · ME TIME.
  //  · the ENTITLED ISSUES (goombas), DEAD PRs (turtles → kickable shells), an
  //    URGENT!! DM (fly) and 0-DAYs erupting from your dependency pipes (piranhas):
  //    "ETA?", "+1", "UNPAID", "WONTFIX", "REVIEW?", "CVE". All free, all yours.
  const ENEMIES_DEF: Array<[string, number, string?, BillTone?]> = [
    ['goomba', 12, 'ETA?', 'issue'],
    ['bill', 18, 'RENT', 'rent'],
    ['goomba', 22, '+1', 'issue'],
    ['turtle', 29, 'BAD PR', 'pr'],
    ['bill', 34, 'POWER', 'power'],
    ['goomba', 40, 'UNPAID', 'donate'],
    ['bill', 47, 'WATER', 'water'],
    ['turtle', 50, 'REVIEW?', 'pr'],
    ['fly', 53, 'URGENT', 'urgent'],
    ['bill', 56, 'GAS', 'gas'],
    ['bill', 67, 'NET', 'net'],
    ['goomba', 72, 'WONTFIX', 'issue'],
    ['bill', 76, 'GYM', 'gym'],
    ['bill', 82, 'ME TIME', 'metime'],
  ];
  // background signposts = the open-source career arc, dead obvious: you ship OSS,
  // you're still paid $0, you're drowning (SOS) — then the LAYOFF dragon, then the
  // one castle that actually pays.
  const SIGNS: Array<[number, string]> = [
    [9 * TILE, 'OSS'],
    [38 * TILE, 'STILL $0'],
    [81 * TILE, 'SOS'],
  ];
  // the 0-day/CVE/deps panic that erupts from each dependency pipe (by pipe order)
  const PIPE_TAGS: Array<[string, BillTone]> = [
    ['CVE', 'cve'],
    ['0-DAY', 'cve'],
    ['DEPS', 'cve'],
  ];
  const START = { x: 2 * TILE, y: 6 * TILE };
  const CASTLE_X = 87 * TILE;
  const CASTLE_W = 5 * TILE;

  // ---- Solid tiles + ? lookup ----
  const solidSet = new Set<string>();
  const kk = (tx: number, ty: number) => tx + ':' + ty;
  for (const [a, b] of GROUND_SPANS)
    for (let tx = a; tx <= b; tx++) {
      solidSet.add(kk(tx, 9));
      solidSet.add(kk(tx, 10));
    }
  for (const [px, py, w] of PLATFORMS) for (let i = 0; i < w; i++) solidSet.add(kk(px + i, py));
  for (const [px, ph] of PIPES)
    for (let r = GROUND_ROW - ph; r <= 8; r++) {
      solidSet.add(kk(px, r));
      solidSet.add(kk(px + 1, r));
    }
  for (const [tx, ty, kind] of QDEF) if (kind !== 'hidden') solidSet.add(kk(tx, ty));
  const solidAt = (tx: number, ty: number) => {
    const q = qmap.get(kk(tx, ty));
    if (q) return q.kind !== 'hidden' || q.used;
    return solidSet.has(kk(tx, ty));
  };

  // ---- Palette ----
  const C = {
    skyTop: '#0a1410',
    skyBot: '#0f221a',
    hill: '#0f7138',
    grass: '#1a9b4b',
    grassHi: '#3de07a',
    dirt: '#5b4a22',
    brick: '#b08628',
    brickHi: '#e8b94a',
    used: '#4a3c1c',
    star: '#e8b94a',
    starHi: '#fff3cf',
    skin: '#e8b94a',
    face: '#cf9b76',
    cream: '#f1ece0',
    body: '#1a9b4b',
    bodyHi: '#3de07a',
    ink: '#0c0b06',
    paper: '#efe9da',
    doorDark: '#2a1d0e',
    stone: '#6b6f78',
    stoneHi: '#9aa0a8',
    cloud: '#dfe7df',
    sign: '#13241a',
    life: '#3de07a',
    rent: '#df5f27',
    util: '#2b50e0',
    loan: '#b08628',
    mobile: '#22b8cf',
    net: '#6e87ff',
    claude: '#d97757',
    gpt: '#10a37f',
    work: '#8a6cff',
    family: '#e85d9b',
    // the bills that keep charging while you maintain for free
    power: '#f2c200',
    water: '#27a3e0',
    gas: '#e0662b',
    gym: '#9b59b6',
    metime: '#16c79a',
    // the open-source torments (entitled issues, dead PRs, security panics)
    issue: '#7c8896',
    pr: '#a06cff',
    urgent: '#e0473a',
    donate: '#2ea043',
    cve: '#d7263d',
    goomba: '#9c5a24',
    goombaD: '#5a3414',
    shell: '#2fbf5a',
    shellD: '#15783a',
    pipe: '#1aa64e',
    pipeHi: '#3de07a',
    pipeD: '#0d5e2c',
    pir: '#e0473a',
    pirD: '#8a241a',
    wing: '#eef3ee',
  };
  type BillTone =
    | 'rent'
    | 'util'
    | 'loan'
    | 'mobile'
    | 'net'
    | 'claude'
    | 'gpt'
    | 'work'
    | 'family'
    | 'power'
    | 'water'
    | 'gas'
    | 'gym'
    | 'metime'
    | 'issue'
    | 'pr'
    | 'urgent'
    | 'donate'
    | 'cve';
  const billTone = (key: BillTone) => C[key];

  // ---- 3×5 pixel font ----
  const FONT: Record<string, string[]> = {
    A: ['111', '101', '111', '101', '101'],
    C: ['111', '100', '100', '100', '111'],
    E: ['111', '100', '110', '100', '111'],
    G: ['111', '100', '101', '101', '111'],
    L: ['100', '100', '100', '100', '111'],
    N: ['101', '111', '101', '101', '101'],
    O: ['111', '101', '101', '101', '111'],
    P: ['110', '101', '110', '100', '100'],
    R: ['110', '101', '110', '101', '101'],
    S: ['111', '100', '111', '001', '111'],
    T: ['111', '010', '010', '010', '010'],
    U: ['101', '101', '101', '101', '111'],
    W: ['101', '101', '111', '111', '101'],
    M: ['101', '111', '111', '101', '101'],
    I: ['111', '010', '010', '010', '111'],
    D: ['110', '101', '101', '101', '110'],
    F: ['111', '100', '110', '100', '100'],
    K: ['101', '110', '100', '110', '101'],
    Y: ['101', '101', '010', '010', '010'],
    B: ['110', '101', '110', '101', '110'],
    H: ['101', '101', '111', '101', '101'],
    J: ['111', '001', '001', '101', '010'],
    Q: ['111', '101', '101', '111', '001'],
    V: ['101', '101', '101', '101', '010'],
    X: ['101', '101', '010', '101', '101'],
    Z: ['111', '001', '010', '100', '111'],
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    '#': ['101', '111', '101', '111', '101'],
    '.': ['000', '000', '000', '000', '010'],
    '+': ['000', '010', '111', '010', '000'],
    '-': ['000', '000', '111', '000', '000'],
    '?': ['111', '001', '011', '000', '010'],
    '!': ['010', '010', '010', '000', '010'],
    '/': ['001', '001', '010', '100', '100'],
    ':': ['000', '010', '000', '010', '000'],
    $: ['010', '111', '110', '011', '111'],
  };

  // ---- State ----
  let root: HTMLElement | null = null;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let starsEl: HTMLElement | null = null;
  let livesEl: HTMLElement | null = null;
  let msgEl: HTMLElement | null = null;
  let msgTextEl: HTMLElement | null = null;
  let raf = 0;
  let running = false;
  let last = 0;
  let acc = 0;
  const STEP = 1000 / 60;

  // --- input layer: keyboard and on-screen touch buttons share one path ---
  // Horizontal uses last-pressed-wins, so holding both directions never cancels
  // out to a dead stop — exactly how a normal platformer feels.
  let leftHeld = false;
  let rightHeld = false;
  let dirLast = 0; // -1 | 0 | 1 — which side was pressed most recently
  let jumpHeld = false;
  let jumpBuf = 0;
  let coyote = 0;
  const JUMP_BUF = 8;
  // jumpHeld is true while ANY jump source is held; jumpSrc counts them so two
  // jump keys (or a key + the touch button) don't cut each other's leap short.
  const jumpSrc = new Set<string>();
  // each touch button registers a reset() that drops its held pointers + highlight.
  const touchResets: Array<() => void> = [];
  function setLeft(on: boolean) {
    if (on === leftHeld) return;
    leftHeld = on;
    if (on) dirLast = -1;
  }
  function setRight(on: boolean) {
    if (on === rightHeld) return;
    rightHeld = on;
    if (on) dirLast = 1;
  }
  function moveDir(): number {
    if (leftHeld && rightHeld) return dirLast;
    return leftHeld ? -1 : rightHeld ? 1 : 0;
  }
  // Buffer a jump only on the rising edge from no source held. Auto-repeat
  // keydowns (allowBuffer=false) for unknown sources are ignored; repeats for an
  // already-held source only keep that source held. That lets a held jump extend
  // one leap without letting repeat events latch input or bunny-hop on landing.
  function jumpDown(src: string, allowBuffer: boolean) {
    const alreadyHeld = jumpSrc.has(src);
    if (!allowBuffer && !alreadyHeld) return;
    const wasEmpty = jumpSrc.size === 0;
    jumpSrc.add(src);
    jumpHeld = true;
    if (wasEmpty && allowBuffer) jumpBuf = JUMP_BUF;
  }
  function jumpUp(src: string) {
    if (!jumpSrc.delete(src)) return;
    if (jumpSrc.size === 0) jumpHeld = false;
  }
  function syncTouchButtons() {
    for (const r of touchResets) r();
  }
  const player = {
    x: START.x,
    y: START.y,
    w: 11,
    h: 14,
    vx: 0,
    vy: 0,
    onGround: false,
    face: 1,
    step: 0,
    invuln: 0,
    power: 0,
  };
  let camX = 0;
  let stars = 0;
  let lives = 3;
  let state: 'play' | 'win' | 'over' | 'ending' = 'play';
  let tick = 0;

  type Q = {
    tx: number;
    ty: number;
    kind: 'coin' | 'power' | 'hidden';
    used: boolean;
    bump: number;
  };
  let qblocks: Q[] = [];
  const qmap = new Map<string, Q>();
  type Flower = { x: number; y: number; got: boolean; emerge: number };
  let flowers: Flower[] = [];
  type EType = 'bill' | 'goomba' | 'turtle' | 'shell' | 'fly' | 'piranha';
  type Enemy = {
    type: EType;
    x: number;
    y: number;
    w: number;
    h: number;
    vx: number;
    baseY: number;
    dead: number;
    t: number;
    label?: string;
    tone?: BillTone;
  };
  let enemies: Enemy[] = [];
  type Particle = { x: number; y: number; vy: number; life: number; text: string; color: string };
  let particles: Particle[] = [];
  type BlockStar = { x: number; y: number; vx: number; vy: number; life: number };
  let blockStars: BlockStar[] = [];
  type Pickup = { x: number; y: number; vx: number; vy: number; got: boolean };
  let oneups: Pickup[] = []; // "NEW PROJECT IDEA" 1-ups dropped by secret blocks
  let enterT = 0; // castle-entry timer for the ending scene
  // --- the LAYOFF dragon: the meme mini-boss guarding the gate. Spits fire; you
  // jump it like Bowser to reach the job. (COFFEE lets you blow straight through.)
  type Boss = {
    x: number;
    y: number;
    w: number;
    h: number;
    t: number;
    dir: number;
    mouth: number;
    dead: number;
  };
  let boss: Boss | null = null;
  type Fireball = { x: number; y: number; vx: number; vy: number; life: number };
  let fireballs: Fireball[] = [];
  const BOSS_X = 84 * TILE; // paces in front of the castle gate (castle @87)
  // --- victory celebration: a raised flag + fireworks over the ManagedCode HQ ---
  type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };
  type Rocket = { x: number; y: number; vy: number; color: string };
  let sparks: Spark[] = [];
  let rockets: Rocket[] = [];
  let celebrate = false; // spawning fireworks (true from castle-entry through the win)
  let fwTick = 0;
  const FW_COLORS = [C.starHi, C.star, C.bodyHi, C.grassHi, C.mobile, C.rent, C.family, C.cream];

  function clearInput() {
    leftHeld = false;
    rightHeld = false;
    dirLast = 0;
    jumpHeld = false;
    jumpBuf = 0;
    coyote = 0;
    jumpSrc.clear();
    syncTouchButtons();
  }
  function setPlaying(on: boolean) {
    if (root) root.dataset.playing = String(on);
  }

  // ---- Physics ----
  const GRAV = 0.5;
  const ASCEND_G = 0.36;
  const RUN = 1.9;
  const ACCEL = 0.7; // ramp toward run speed (smooth, not an instant on/off)
  const FRICTION = 0.7; // glide to a stop quickly enough to keep edge control
  const JUMP = -7.2;
  const CUT = -3.0;
  const MAXFALL = 9;

  function spawnEnemies() {
    enemies = [];
    for (const [type, tx, label, tone] of ENEMIES_DEF) {
      if (type === 'fly')
        enemies.push({
          type: 'fly',
          x: tx * TILE,
          y: GROUND_TOP - 34,
          w: 12,
          h: 10,
          vx: 0.7,
          baseY: GROUND_TOP - 34,
          dead: 0,
          t: (tx * 7) % 60,
          label,
          tone,
        });
      else
        enemies.push({
          type: type as EType,
          x: tx * TILE,
          y: GROUND_TOP - (type === 'turtle' ? 14 : 12),
          w: 12,
          h: type === 'turtle' ? 14 : 12,
          vx: 0.5,
          baseY: 0,
          dead: 0,
          t: 0,
          label,
          tone,
        });
    }
    for (let i = 0; i < PIPES.length; i++) {
      const [px, ph] = PIPES[i];
      const top = (GROUND_ROW - ph) * TILE;
      const [label, tone] = PIPE_TAGS[i % PIPE_TAGS.length];
      enemies.push({
        type: 'piranha',
        x: px * TILE + 4,
        y: top + 4,
        w: 10,
        h: 12,
        vx: 0,
        baseY: top,
        dead: 0,
        t: (px * 11) % 120,
        label,
        tone,
      });
    }
  }
  function reset() {
    player.x = START.x;
    player.y = START.y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.face = 1;
    player.step = 0;
    player.invuln = 0;
    player.power = 0;
    camX = 0;
    stars = 0;
    lives = 3;
    state = 'play';
    clearInput();
    qblocks = QDEF.map(([tx, ty, kind]) => ({ tx, ty, kind, used: false, bump: 0 }));
    qmap.clear();
    for (const q of qblocks) qmap.set(kk(q.tx, q.ty), q);
    flowers = [];
    spawnEnemies();
    particles = [];
    blockStars = [];
    oneups = [];
    enterT = 0;
    sparks = [];
    rockets = [];
    celebrate = false;
    fwTick = 0;
    boss = { x: BOSS_X, y: GROUND_TOP - 18, w: 22, h: 18, t: 0, dir: -1, mouth: 0, dead: 0 };
    fireballs = [];
    setPlaying(true);
    updateHud();
    hideMsg();
  }
  // ---- Fireworks ----
  function spawnRocket() {
    const x = camX + 32 + Math.random() * (VIEW_W - 64);
    rockets.push({
      x,
      y: VIEW_H - 8,
      vy: -(3.1 + Math.random() * 0.8), // arcs up into the open sky over the keep
      color: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)],
    });
  }
  function explodeRocket(x: number, y: number, color: string) {
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = 0.9 + Math.random() * 1.0;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.4,
        life: 34 + Math.floor(Math.random() * 18),
        color,
      });
    }
  }
  function updateFireworks() {
    for (const r of rockets) {
      r.y += r.vy;
      r.vy += 0.05;
    }
    const burst = rockets.filter((r) => r.vy >= -0.4 || r.y < 16);
    for (const r of burst) explodeRocket(r.x, r.y, r.color);
    if (burst.length) rockets = rockets.filter((r) => !(r.vy >= -0.4 || r.y < 16));
    for (const s of sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.05;
      s.vx *= 0.99;
      s.life--;
    }
    sparks = sparks.filter((s) => s.life > 0);
    if (celebrate && fwTick++ % 20 === 0 && rockets.length < 5) spawnRocket();
  }
  function addParticle(x: number, y: number, text: string, color: string) {
    particles.push({ x, y, vy: -0.55, life: 52, text, color });
  }
  function popGithubStars(tx: number, ty: number) {
    const x = tx * TILE + 3;
    const y = ty * TILE - 8;
    blockStars.push(
      { x: x - 5, y: y + 3, vx: -0.45, vy: -3.0, life: 58 },
      { x, y, vx: 0, vy: -3.7, life: 66 },
      { x: x + 5, y: y + 3, vx: 0.45, vy: -3.0, life: 58 }
    );
  }
  function popPowerFlower(tx: number, ty: number) {
    // the power-up is COFFEE — the maintainer's only fuel (temporary invincibility)
    flowers.push({ x: tx * TILE + 3, y: ty * TILE - 4, got: false, emerge: 16 });
    addParticle(tx * TILE - 10, ty * TILE - 4, 'COFFEE', C.starHi);
  }
  function popNewProject(tx: number, ty: number) {
    // NOT a 1-UP / level-up / life-up — it's a NEW PROJECT idea. The shiny new repo
    // you'll start instead of finishing this one. The maintainer's true weakness.
    oneups.push({ x: tx * TILE + 1, y: ty * TILE - 14, vx: 0.8, vy: -2.4, got: false });
    addParticle(tx * TILE - 20, ty * TILE - 4, 'NEW PROJECT IDEA', C.life);
  }
  function bumpBlock(q: Q) {
    q.used = true;
    q.bump = 8;
    if (q.kind === 'coin') {
      stars += 3;
      popGithubStars(q.tx, q.ty);
    } else if (q.kind === 'power') {
      popPowerFlower(q.tx, q.ty);
    } else {
      popNewProject(q.tx, q.ty);
    }
    updateHud();
  }
  function loseLifeFromStart() {
    lives -= 1;
    updateHud();
    if (lives <= 0) return gameOver();
    clearInput();
    player.x = START.x;
    player.y = START.y;
    player.vx = 0;
    player.vy = 0;
    player.invuln = 100;
    player.power = 0;
  }
  function hurt() {
    if (player.invuln > 0 || player.power > 0) return;
    lives -= 1;
    updateHud();
    if (lives <= 0) return gameOver();
    player.invuln = 100;
    player.vy = -4;
    player.vx = -player.face * 3;
  }
  function updateEnding() {
    // Mario-style castle entry: the maintainer walks into the (now warmly lit) gate
    // and fades in, while fireworks go up over the ManagedCode HQ.
    const doorX = CASTLE_X + CASTLE_W / 2 - player.w / 2;
    if (player.x < doorX - 1) {
      player.x += 1.4;
      player.face = 1;
      player.step += 0.2;
    } else enterT++;
    player.vy += GRAV;
    if (player.vy > MAXFALL) player.vy = MAXFALL;
    player.onGround = false;
    player.y += player.vy;
    collide('y');
    settleGround();
    camX = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x + player.w / 2 - VIEW_W / 2));
    if (enterT > 36) showWin();
  }
  function showWin() {
    state = 'win';
    setPlaying(false);
    // celebrate stays true → the fireworks keep bursting behind the win card.
    showMsg(
      `YOU'RE FUNDED ✓   ★ ${stars}\nthe castle is ManagedCode — they pay you to\nmaintain the stuff you shipped free for years.\nyour ★ GitHub stars are still worth $0 →`,
      true
    );
  }
  function gameOver() {
    clearInput();
    state = 'over';
    setPlaying(false);
    celebrate = false;
    fireballs = []; // don't leave hazards frozen behind the translucent lose card
    showMsg(
      `BURNED OUT   ★ ${stars}\nyou archived the repo. somewhere a Fortune 500\nstill ships it in prod — for free.`,
      false
    );
  }

  function collide(axis: 'x' | 'y') {
    const left = Math.floor(player.x / TILE);
    const right = Math.floor((player.x + player.w - 1) / TILE);
    const top = Math.floor(player.y / TILE);
    const bottom = Math.floor((player.y + player.h - 1) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        const q = qmap.get(kk(tx, ty));
        const hiddenBump = axis === 'y' && player.vy < 0 && q?.kind === 'hidden' && !q.used;
        if (!solidAt(tx, ty) && !hiddenBump) continue;
        if (axis === 'x') {
          if (player.vx > 0) player.x = tx * TILE - player.w;
          else if (player.vx < 0) player.x = (tx + 1) * TILE;
          player.vx = 0;
          return;
        } else {
          if (player.vy > 0) {
            player.y = ty * TILE - player.h;
            player.onGround = true;
          } else if (player.vy < 0) {
            player.y = (ty + 1) * TILE;
            if (q && !q.used) bumpBlock(q);
          }
          player.vy = 0;
          return;
        }
      }
    }
  }
  const ov = (
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number
  ) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  // Settle flush on the ground. The AABB collide uses `y+h-1` for the foot row,
  // so a player resting exactly on a tile boundary isn't re-grounded and gravity
  // sinks it ~1px before the next collide snaps it back → a constant 1px jitter.
  // Probing the tile right at the feet and clamping kills that vibration.
  function settleGround() {
    if (player.vy < 0) return;
    const fy = Math.floor((player.y + player.h) / TILE);
    const lx = Math.floor((player.x + 1) / TILE);
    const rxw = Math.floor((player.x + player.w - 2) / TILE);
    if (solidAt(lx, fy) || solidAt(rxw, fy)) {
      player.y = fy * TILE - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }

  function updateEnemies() {
    for (const e of enemies) {
      if (e.dead) continue;
      e.t++;
      if (e.type === 'piranha') {
        const near = Math.abs(player.x + player.w / 2 - (e.x + e.w / 2)) < 22;
        const up = !near && Math.sin(e.t * 0.045) > 0;
        const tgt = up ? e.baseY - 12 : e.baseY + 10;
        e.y += (tgt - e.y) * 0.16;
        continue;
      }
      if (e.type === 'fly') {
        e.x += e.vx;
        if (e.x <= 0 || e.x >= WORLD_W - e.w) e.vx *= -1;
        e.y = e.baseY + Math.sin(e.t * 0.08) * 11;
        continue;
      }
      // ground walkers + sliding shells
      if (e.vx !== 0) {
        e.x += e.vx;
        const aheadTx = Math.floor((e.x + (e.vx > 0 ? e.w : 0)) / TILE);
        if (
          e.x <= 0 ||
          e.x >= WORLD_W - e.w ||
          !solidAt(aheadTx, GROUND_ROW) ||
          solidAt(aheadTx, GROUND_ROW - 1)
        )
          e.vx *= -1;
      }
      if (e.type === 'shell' && e.vx !== 0) {
        for (const o of enemies) {
          if (o === e || o.dead || o.type === 'shell') continue;
          if (ov(e.x, e.y, e.w, e.h, o.x, o.y, o.w, o.h)) {
            o.dead = 1;
            stars++;
            addParticle(o.x, o.y - 4, '+1', C.star);
            updateHud();
          }
        }
      }
    }
  }

  function hitEnemy(e: Enemy) {
    const stomp = player.vy > 0 && player.y + player.h - e.y < 12;
    if (e.type === 'shell') {
      if (e.vx === 0) {
        e.vx = player.x + player.w / 2 < e.x + e.w / 2 ? 3.2 : -3.2;
      } // kick idle shell
      else if (stomp) {
        e.vx = 0;
        player.vy = JUMP * 0.5;
      } // stomp a moving shell → stop it
      else hurt();
      return;
    }
    if (e.type === 'piranha') {
      if (player.power > 0) {
        e.dead = 1;
        stars++;
        updateHud();
      } else hurt();
      return;
    }
    if (stomp) {
      if (e.type === 'turtle') {
        e.type = 'shell';
        e.vx = 0;
        e.h = 10;
        e.y = GROUND_TOP - 10;
      } else e.dead = 1;
      stars++;
      player.vy = JUMP * 0.55;
      updateHud();
    } else if (player.power > 0) {
      e.dead = 1;
      stars++;
      updateHud();
    } else hurt();
  }

  function update() {
    tick++;
    updateFireworks();
    for (const q of qblocks) if (q.bump > 0) q.bump--;
    for (const s of blockStars) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.16;
      s.life--;
    }
    blockStars = blockStars.filter((s) => s.life > 0);
    for (const p of particles) {
      p.y += p.vy;
      p.life--;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const f of flowers) {
      if (!f.got && f.emerge > 0) {
        f.y -= 0.65;
        f.emerge--;
      }
    }
    if (state === 'ending') {
      updateEnding();
      return;
    }
    if (state !== 'play') return;
    if (player.invuln > 0) player.invuln--;
    if (player.power > 0) player.power--;

    if (player.onGround) coyote = 8;
    else if (coyote > 0) coyote--;
    if (jumpBuf > 0) jumpBuf--;

    const dir = moveDir();
    if (dir !== 0) {
      player.vx += dir * ACCEL;
      if (player.vx > RUN) player.vx = RUN;
      if (player.vx < -RUN) player.vx = -RUN;
      player.face = dir > 0 ? 1 : -1;
    } else {
      player.vx *= FRICTION;
      if (Math.abs(player.vx) < 0.08) player.vx = 0;
    }
    if (Math.abs(player.vx) > 0.12) player.step += 0.2;
    player.x += player.vx;
    if (player.x < 0) player.x = 0;
    if (player.x > WORLD_W - player.w) player.x = WORLD_W - player.w;
    collide('x');

    if (jumpBuf > 0 && coyote > 0) {
      player.vy = JUMP;
      coyote = 0;
      jumpBuf = 0;
    }
    let g = GRAV;
    if (player.vy < 0 && jumpHeld) g = ASCEND_G;
    player.vy += g;
    if (player.vy > MAXFALL) player.vy = MAXFALL;
    if (!jumpHeld && player.vy < CUT) player.vy = CUT;
    player.onGround = false;
    player.y += player.vy;
    collide('y');
    settleGround();

    if (player.y > VIEW_H + 48) return loseLifeFromStart();

    for (const f of flowers)
      if (!f.got && ov(player.x, player.y, player.w, player.h, f.x, f.y, 10, 12)) {
        f.got = true;
        player.power = 420;
        addParticle(f.x - 8, f.y - 4, 'CAFFEINE', C.starHi);
      }

    for (const u of oneups) {
      if (u.got) continue;
      u.vy += GRAV * 0.6;
      if (u.vy > 6) u.vy = 6;
      u.x += u.vx;
      u.y += u.vy;
      const footTy = Math.floor((u.y + 14) / TILE);
      if (solidAt(Math.floor((u.x + 7) / TILE), footTy)) {
        u.y = footTy * TILE - 14;
        u.vy = 0;
      }
      const aheadTx = Math.floor((u.x + (u.vx > 0 ? 14 : 0)) / TILE);
      if (u.x <= 0 || u.x >= WORLD_W - 14 || solidAt(aheadTx, Math.floor((u.y + 7) / TILE)))
        u.vx *= -1;
      if (u.y > VIEW_H + 40) {
        u.got = true;
        continue;
      }
      if (ov(player.x, player.y, player.w, player.h, u.x, u.y, 14, 14)) {
        u.got = true;
        lives += 1;
        addParticle(u.x - 20, u.y - 4, 'NEW PROJECT IDEA', C.life);
        updateHud();
      }
    }

    updateEnemies();
    for (const e of enemies)
      if (!e.dead && ov(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)) hitEnemy(e);

    updateBoss();

    if (player.x + player.w >= CASTLE_X + 18) {
      state = 'ending';
      enterT = 0;
      celebrate = true;
      if (boss) boss.dead = 1; // the layoff loses; you got the job
      fireballs = [];
      clearInput();
      setPlaying(false);
    }
    camX = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x + player.w / 2 - VIEW_W / 2));
  }

  function updateBoss() {
    // (only runs in 'play'; the win + game-over paths clear fireballs so none freeze)
    for (const f of fireballs) {
      f.x += f.vx;
      f.y += f.vy;
      f.vy += 0.06;
      if (f.y > GROUND_TOP - 5) {
        f.y = GROUND_TOP - 5;
        f.vy = -2.4; // bounce like a Bowser fireball
      }
      f.life--;
    }
    fireballs = fireballs.filter((f) => f.life > 0 && f.x > camX - 24);
    if (!boss || boss.dead || state !== 'play') return;
    boss.t++;
    // a slow menace pacing a couple tiles in front of the gate
    boss.x += boss.dir * 0.35;
    if (boss.x < BOSS_X - 18) boss.dir = 1;
    else if (boss.x > BOSS_X + 10) boss.dir = -1;
    if (boss.mouth > 0) boss.mouth--;
    // only breathe fire once the player is in range, so the approach is fair
    const near = player.x > boss.x - 150;
    if (near && boss.t % 95 === 0) {
      boss.mouth = 26;
      fireballs.push({ x: boss.x - 2, y: boss.y + 5, vx: -2.1, vy: -1.4, life: 170 });
    }
    // contact: COFFEE blows straight through (and topples the layoff); else you're hit
    if (ov(player.x, player.y, player.w, player.h, boss.x, boss.y, boss.w, boss.h)) {
      if (player.power > 0) {
        boss.dead = 1;
        stars += 5;
        addParticle(boss.x, boss.y - 6, 'LAID OFF', C.starHi);
        updateHud();
      } else hurt();
    }
    for (const f of fireballs)
      if (ov(player.x, player.y, player.w, player.h, f.x, f.y, 5, 5)) hurt();
  }

  // ---- Render ----
  const rx = (x: number) => Math.round(x - camX);
  function block(x: number, y: number, w: number, h: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(rx(x), Math.round(y), w, h);
  }
  function text(str: string, wx: number, wy: number, s: number, color: string) {
    ctx.fillStyle = color;
    let cx = wx;
    for (const ch of str) {
      const g = FONT[ch.toUpperCase()];
      if (g)
        for (let r = 0; r < 5; r++)
          for (let c = 0; c < 3; c++)
            if (g[r][c] === '1') ctx.fillRect(rx(cx + c * s), Math.round(wy + r * s), s, s);
      cx += 4 * s;
    }
  }
  const textW = (str: string, s: number) => str.length * 4 * s - s;
  function drawPixelMask(x: number, y: number, rows: string[], color: string) {
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < rows[r].length; c++)
        if (rows[r][c] === '1') block(x + c, y + r, 1, 1, color);
  }
  function drawStar(x: number, y: number) {
    const githubStar = [
      '00000100000',
      '00001110000',
      '00001110000',
      '11011111011',
      '01111111110',
      '00111111100',
      '00011111000',
      '00111011100',
      '01100001110',
      '11000000011',
    ];
    drawPixelMask(x + 1, y + 1, githubStar, '#7a5a16');
    drawPixelMask(x, y, githubStar, C.starHi);
  }
  function drawQuestionMark(x: number, y: number) {
    const question = [
      '01110',
      '10001',
      '00001',
      '00010',
      '00100',
      '00100',
      '00000',
      '00100',
      '00100',
    ];
    drawPixelMask(x + 1, y + 1, question, '#7a5a16');
    drawPixelMask(x, y, question, C.starHi);
  }
  // the power-up is a COFFEE mug (caffeine = the maintainer's invincibility)
  function drawFlower(x: number, y: number) {
    const steam = Math.floor(tick / 10) % 2;
    block(x + 2 + steam, y - 4, 1, 2, C.cloud); // steam wisps
    block(x + 6 - steam, y - 5, 1, 2, C.cloud);
    block(x + 1, y, 8, 9, C.cream); // mug body
    block(x + 1, y, 8, 2, '#6b4a2c'); // coffee rim
    block(x + 2, y + 1, 6, 2, '#3a2412'); // coffee dark
    block(x + 1, y + 8, 8, 1, '#cdbfa8'); // base shade
    block(x + 9, y + 2, 2, 4, C.cream); // handle
    block(x + 10, y + 3, 1, 2, '#cdbfa8');
    drawTag(x + 5, y - 16, 'COFFEE', 'metime');
  }
  function drawGithub(x: number, y: number) {
    // a white octocat-ish "new project" 1-up
    block(x + 2, y + 1, 10, 9, C.cream);
    block(x + 1, y + 3, 12, 5, C.cream); // head
    block(x + 2, y, 2, 2, C.cream);
    block(x + 10, y, 2, 2, C.cream); // ears
    block(x + 4, y + 4, 2, 2, C.ink);
    block(x + 8, y + 4, 2, 2, C.ink); // eyes
    block(x + 4, y + 10, 6, 3, C.cream);
    block(x + 6, y + 12, 2, 2, C.cream); // body + tail
    block(x + 3, y + 13, 8, 1, C.bodyHi); // green "new project" base
    drawTag(x + 7, y - 12, 'NEW PROJECT IDEA', 'donate');
  }
  function drawQBlock(q: Q) {
    const x = q.tx * TILE;
    const y = q.ty * TILE - (q.bump > 0 ? 4 : 0);
    if (q.kind === 'hidden' && !q.used) return;
    if (q.used) {
      block(x, y, TILE, TILE, C.used);
      block(x, y, TILE, 2, '#6b5a2c');
      return;
    }
    block(x, y, TILE, TILE, C.brick);
    block(x, y, TILE, 2, C.brickHi);
    block(x, y, 2, TILE, C.brickHi);
    drawQuestionMark(x + 6, y + 3);
  }
  function drawPipe(px: number, ph: number) {
    const x = px * TILE;
    const top = (GROUND_ROW - ph) * TILE;
    block(x, top + 6, 2 * TILE, GROUND_TOP - top - 6, C.pipeD);
    block(x, top + 6, 3, GROUND_TOP - top - 6, C.pipe);
    block(x + 5, top + 6, 2 * TILE - 10, 4, '#07371c');
    block(x - 2, top, 2 * TILE + 4, 6, C.pipe);
    block(x - 2, top, 2 * TILE + 4, 2, C.pipeHi);
    block(x + 3, top + 3, 2 * TILE - 6, 2, C.pipeD);
  }
  // a little nameplate above any enemy — this is what makes each one legible
  function drawTag(cx: number, topY: number, label: string, tone: BillTone) {
    const t = billTone(tone);
    const lw = textW(label, 1);
    const tx = Math.round(cx - lw / 2);
    block(tx - 2, topY, lw + 4, 8, C.sign);
    block(tx - 2, topY, lw + 4, 1, t);
    text(label, tx, topY + 1, 1, C.starHi);
  }
  function drawEnemy(e: Enemy) {
    const x = e.x;
    const y = e.y;
    const wob = Math.floor(tick / 8) % 2;
    if (e.type === 'bill') {
      const t = billTone(e.tone || 'rent');
      block(x, y, 12, 10, C.paper);
      block(x, y, 12, 3, t);
      block(x + 2, y + 5, 2, 2, C.ink);
      block(x + 8, y + 5, 2, 2, C.ink);
      block(x + 3, y + 8, 6, 1, t);
      block(x + (wob ? 0 : 2), y + 10, 3, 2, C.ink);
      block(x + (wob ? 9 : 7), y + 10, 3, 2, C.ink);
    } else if (e.type === 'goomba') {
      block(x + 1, y, 10, 7, C.goomba);
      block(x, y + 3, 12, 4, C.goomba);
      block(x + 3, y + 3, 2, 2, C.cream);
      block(x + 7, y + 3, 2, 2, C.cream);
      block(x + 3, y + 4, 1, 1, C.ink);
      block(x + 8, y + 4, 1, 1, C.ink);
      block(x + (wob ? 0 : 2), y + 9, 4, 3, C.goombaD);
      block(x + (wob ? 8 : 6), y + 9, 4, 3, C.goombaD);
    } else if (e.type === 'turtle') {
      block(x + (e.vx < 0 ? 8 : 1), y + 2, 3, 4, C.skin); // head
      block(x + 1, y + 5, 10, 7, C.shell);
      block(x, y + 7, 12, 4, C.shell);
      block(x + 3, y + 6, 6, 3, C.shellD);
      block(x + (wob ? 1 : 2), y + 12, 3, 2, C.shellD);
      block(x + (wob ? 8 : 7), y + 12, 3, 2, C.shellD);
    } else if (e.type === 'shell') {
      block(x + 1, y, 10, 8, C.shell);
      block(x, y + 2, 12, 5, C.shell);
      block(x + 3, y + 1, 6, 4, C.shellD);
      block(x + 4, y + 2, 4, 2, C.shell);
    } else if (e.type === 'fly') {
      const flap = Math.floor(tick / 5) % 2;
      block(x + (flap ? -2 : 0), y + 1, 3, 4, C.wing);
      block(x + 11 - (flap ? 1 : 3), y + 1, 3, 4, C.wing); // wings
      block(x + 2, y + 2, 8, 7, C.util);
      block(x + 3, y + 4, 2, 2, C.cream);
      block(x + 7, y + 4, 2, 2, C.cream);
      block(x + 3, y + 5, 1, 1, C.ink);
      block(x + 8, y + 5, 1, 1, C.ink);
    } else if (e.type === 'piranha') {
      block(x + 2, y + 4, 6, 9, C.body); // stem
      block(x, y, 10, 6, C.pir);
      block(x + 1, y + 5, 8, 3, C.pirD);
      block(x + 2, y + 2, 2, 1, C.cream);
      block(x + 6, y + 2, 2, 1, C.cream); // teeth
    }
  }
  function drawCastle() {
    const bx = CASTLE_X;
    const top = GROUND_TOP - 58;
    block(bx, top, CASTLE_W, 58, C.stone);
    block(bx, top, CASTLE_W, 3, C.stoneHi);
    for (let i = 0; i < 5; i++) block(bx + i * 16, top - 8, 10, 8, C.stone);
    block(bx + 10, top + 16, 6, 9, C.doorDark);
    block(bx + CASTLE_W - 16, top + 16, 6, 9, C.doorDark);
    block(bx + CASTLE_W / 2 - 10, GROUND_TOP - 28, 20, 28, C.doorDark);
    block(bx + CASTLE_W / 2 - 7, GROUND_TOP - 24, 14, 24, '#160f06');
    // the doorway warms up as you're hired (no flag — fireworks carry the win)
    if (celebrate) {
      block(bx + CASTLE_W / 2 - 6, GROUND_TOP - 23, 12, 22, C.rent);
      block(bx + CASTLE_W / 2 - 4, GROUND_TOP - 20, 8, 18, C.starHi);
    }
  }

  // The LAYOFF dragon — a squat, scaly, left-facing meme boss with a big red banner.
  function drawBoss() {
    if (!boss || boss.dead) return;
    const x = boss.x;
    const y = boss.y;
    // back spikes
    block(x + 11, y + 1, 2, 3, C.pir);
    block(x + 15, y, 2, 4, C.pir);
    block(x + 18, y + 2, 2, 3, C.pir);
    // body + tail
    block(x + 7, y + 4, 13, 11, C.shellD);
    block(x + 8, y + 4, 11, 2, C.shell);
    block(x + 19, y + 9, 3, 4, C.shellD); // tail stub
    // head (faces left, toward the player)
    block(x, y + 5, 9, 9, C.shell);
    block(x, y + 4, 7, 2, C.shellD); // brow
    block(x + 4, y + 1, 2, 4, C.cream); // horn
    block(x + 1, y + 7, 2, 2, C.starHi); // eye white
    block(x + 1, y + 7, 1, 2, C.pir); // angry red pupil
    // mouth: open + glowing when charging fire, a hard line otherwise
    if (boss.mouth > 0) {
      block(x - 3, y + 9, 5, 4, C.pir);
      block(x - 3, y + 10, 3, 2, C.starHi);
    } else {
      block(x, y + 11, 5, 1, C.ink);
    }
    // legs
    const step = Math.floor(boss.t / 10) % 2;
    block(x + 9, y + 15, 3, 3, C.shellD);
    block(x + 14 + (step ? 1 : 0), y + 15, 3, 3, C.shellD);
    // stylized banner so there is zero doubt what this is
    const flick = Math.floor(boss.t / 8) % 2 === 0;
    drawBossLabel(x + boss.w / 2, y - 17, 'LAYOFF', flick);
  }
  function drawBossLabel(cx: number, topY: number, label: string, flick: boolean) {
    const s = 2;
    const lw = label.length * 4 * s - s;
    const tx = Math.round(cx - lw / 2);
    block(tx - 3, topY - 2, lw + 6, 5 * s + 4, C.sign);
    block(tx - 3, topY - 2, lw + 6, 2, C.pir);
    block(tx - 3, topY + 5 * s + 1, lw + 6, 1, C.pirD);
    text(label, tx, topY, s, flick ? C.starHi : C.pir);
  }
  function drawFireballs() {
    for (const f of fireballs) {
      const fl = Math.floor(f.life / 3) % 2;
      block(f.x, f.y, 5, 5, C.pirD);
      block(f.x, f.y + (fl ? 0 : 1), 5, 4, C.pir);
      block(f.x + 1, f.y + 1, 3, 2, fl ? C.starHi : '#ffb24a');
    }
  }

  function drawWorld() {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, C.skyTop);
    grad.addColorStop(1, C.skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.fillStyle = C.cloud;
    for (let i = 0; i < 8; i++) {
      const cx = (((i * 210 - camX * 0.4) % 1500) + 1500) % 1500;
      const cy = 16 + ((i * 41) % 40);
      ctx.globalAlpha = 0.15;
      ctx.fillRect(Math.round(cx), cy, 18, 5);
      ctx.fillRect(Math.round(cx) + 5, cy - 4, 10, 5);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = C.hill;
    for (let i = 0; i < 13; i++) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(i * 150 - camX * 0.6, GROUND_TOP + 6, 46, Math.PI, 0);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const [wx, label] of SIGNS) {
      const w = textW(label, 1) + 4;
      block(wx + w / 2 - 1, GROUND_TOP - 14, 2, 14, C.dirt);
      block(wx - 2, GROUND_TOP - 28, w, 12, C.sign);
      block(wx - 2, GROUND_TOP - 28, w, 1, C.grassHi);
      text(label, wx, GROUND_TOP - 26, 1, C.grassHi);
    }

    drawCastle();

    const t0 = Math.floor(camX / TILE) - 1;
    const t1 = Math.floor((camX + VIEW_W) / TILE) + 1;
    for (let ty = 0; ty < 11; ty++) {
      for (let tx = t0; tx <= t1; tx++) {
        if (!solidAt(tx, ty) || qmap.has(kk(tx, ty))) continue;
        // pipe tiles are drawn separately
        let isPipe = false;
        for (const [px, ph] of PIPES)
          if ((tx === px || tx === px + 1) && ty >= GROUND_ROW - ph && ty <= 8) {
            isPipe = true;
            break;
          }
        if (isPipe) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        if (ty >= GROUND_ROW) {
          block(x, y, TILE, TILE, C.dirt);
          if (ty === GROUND_ROW) {
            block(x, y, TILE, 4, C.grass);
            block(x, y, TILE, 1, C.grassHi);
          }
        } else {
          block(x, y, TILE, TILE, C.brick);
          block(x, y, TILE, 2, C.brickHi);
          block(x, y, 1, TILE, C.brickHi);
        }
      }
    }
    for (const e of enemies) if (!e.dead && e.type === 'piranha') drawEnemy(e);
    for (const [px, ph] of PIPES) drawPipe(px, ph);
    for (const q of qblocks) drawQBlock(q);
    for (const b of blockStars) {
      ctx.globalAlpha = Math.max(0, Math.min(1, b.life / 18));
      drawStar(b.x, b.y);
      ctx.globalAlpha = 1;
    }
    for (const f of flowers) if (!f.got) drawFlower(f.x, f.y);
    for (const u of oneups) if (!u.got) drawGithub(u.x, u.y);
    for (const e of enemies) if (!e.dead && e.type !== 'piranha') drawEnemy(e);
    // nameplates last (over pipes & sprites), stacked upward so two tags can never
    // overlap when walkers cross in a corridor — every foe stays readable at a glance
    const placedTags: Array<{ l: number; r: number; lvl: number }> = [];
    for (const e of [...enemies].sort((a, b) => a.x - b.x)) {
      if (e.dead || !e.label) continue;
      const lw = textW(e.label, 1);
      const l = Math.round(e.x + e.w / 2 - lw / 2) - 2;
      const r = l + lw + 4;
      let lvl = 0;
      while (placedTags.some((p) => p.lvl === lvl && l < p.r && r > p.l)) lvl++;
      placedTags.push({ l, r, lvl });
      drawTag(e.x + e.w / 2, e.y - 10 - lvl * 9, e.label, e.tone || 'rent');
    }

    // the boss + its banner sit above the regular nameplates (it dominates), under
    // the player (you leap over it)
    drawBoss();
    drawFireballs();

    drawPlayer();

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
      text(p.text, p.x, p.y, 1, p.color);
      ctx.globalAlpha = 1;
    }
    drawFireworks();
  }

  function drawFireworks() {
    for (const r of rockets) {
      block(r.x, r.y + 2, 1, 3, C.cream); // spark trail
      block(r.x, r.y, 2, 2, r.color);
    }
    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life / 20));
      block(s.x, s.y, 2, 2, s.color);
      ctx.globalAlpha = 1;
    }
  }

  // The maintainer: a dev in a hoodie (hood up → hides hair, so anyone can read
  // themselves into it), a neutral skin tone, two friendly eyes. Walks with a
  // little body-bob + alternating legs.
  function drawPlayer() {
    if (player.invuln > 0 && Math.floor(player.invuln / 4) % 2 === 0) return;
    if (state === 'ending' && enterT > 0) ctx.globalAlpha = Math.max(0, 1 - enterT / 36); // fade into the castle
    const x = player.x;
    const walking = player.onGround && Math.abs(player.vx) > 0.25;
    const frame = Math.floor(player.step) % 2;
    const y = player.y - (walking && frame === 0 ? 1 : 0); // body lifts mid-stride
    const hood = player.power > 0 ? (Math.floor(tick / 4) % 2 ? C.star : C.bodyHi) : C.body;
    // hood (covers the hair)
    block(x + 2, y, 7, 2, hood);
    block(x + 1, y + 1, 9, 3, hood);
    block(x + 1, y + 4, 2, 3, hood);
    block(x + 8, y + 4, 2, 3, hood);
    // face (neutral tone) in the hood opening + two eyes
    block(x + 3, y + 3, 5, 4, C.face);
    block(x + 4, y + 4, 1, 2, C.ink);
    block(x + 6, y + 4, 1, 2, C.ink);
    // hoodie body
    block(x + 1, y + 7, 9, 4, hood);
    block(x + 1, y + 7, 9, 1, C.bodyHi);
    block(x + 4, y + 8, 3, 2, C.bodyHi);
    // legs (true ground y; alternate while walking, tuck in the air)
    const ly = player.y + 11;
    if (!player.onGround) {
      block(x + 2, ly, 3, 3, C.ink);
      block(x + 6, ly, 3, 3, C.ink);
    } else if (walking && frame === 0) {
      block(x + 1, ly, 3, 3, C.ink);
      block(x + 6, ly, 3, 3, C.ink);
    } else if (walking) {
      block(x + 2, ly, 3, 3, C.ink);
      block(x + 7, ly, 3, 3, C.ink);
    } else {
      block(x + 2, ly, 3, 3, C.ink);
      block(x + 6, ly, 3, 3, C.ink);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    drawWorld();
  }

  function updateHud() {
    if (starsEl) starsEl.textContent = String(stars);
    if (livesEl) livesEl.textContent = lives > 0 ? '♥'.repeat(lives) : '—';
  }
  function showMsg(t: string, won: boolean) {
    if (!msgEl || !msgTextEl) return;
    msgTextEl.textContent = t;
    msgEl.dataset.win = String(won);
    msgEl.hidden = false;
  }
  function hideMsg() {
    if (msgEl) msgEl.hidden = true;
  }

  function loop(now: number) {
    if (!running) return;
    let dt = now - last;
    last = now;
    if (dt > 60) dt = 60;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 5) {
      update();
      acc -= STEP;
    }
    render();
    raf = requestAnimationFrame(loop);
  }

  const isLeftKey = (k: string) => k === 'ArrowLeft' || k === 'a' || k === 'A';
  const isRightKey = (k: string) => k === 'ArrowRight' || k === 'd' || k === 'D';
  const isJumpKey = (k: string) =>
    k === ' ' || k === 'Spacebar' || k === 'ArrowUp' || k === 'w' || k === 'W';
  // collapse the synonyms so a single physical jump key is one source, but Space,
  // ArrowUp and W remain distinct sources (each refcounts independently).
  const jumpKeyId = (k: string) =>
    k === ' ' || k === 'Spacebar' ? 'k:space' : k === 'ArrowUp' ? 'k:up' : 'k:w';
  function onKeyDown(e: KeyboardEvent) {
    if (!running) return;
    const k = e.key;
    if (isLeftKey(k)) {
      if (state === 'play') setLeft(true);
      e.preventDefault();
    } else if (isRightKey(k)) {
      if (state === 'play') setRight(true);
      e.preventDefault();
    } else if (isJumpKey(k)) {
      if (state === 'play') jumpDown(jumpKeyId(k), !e.repeat);
      else if (!e.repeat) restart();
      e.preventDefault();
    } else if (k === 'Escape') {
      close();
    } else if (k === 'Enter' && state !== 'play' && !e.repeat) {
      restart();
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    const k = e.key;
    if (isLeftKey(k)) setLeft(false);
    else if (isRightKey(k)) setRight(false);
    else if (isJumpKey(k)) jumpUp(jumpKeyId(k));
  }

  function build() {
    root = document.createElement('div');
    root.className = 'mgame';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Rent Run — a mini game');
    root.innerHTML = `
      <div class="mgame__cab">
        <div class="mgame__bar">
          <span class="mgame__title font-pixel">RENT&nbsp;RUN</span>
          <span class="mgame__hud font-pixel">★&nbsp;<span data-mgame-stars>0</span><span class="mgame__sep">·</span><span data-mgame-lives>♥♥♥</span></span>
          <button class="mgame__close" type="button" data-mgame-close aria-label="Close game">×</button>
        </div>
        <div class="mgame__screen">
          <canvas class="mgame__canvas" width="${VIEW_W}" height="${VIEW_H}" tabindex="0" data-mgame-canvas></canvas>
          <div class="mgame__touch" data-mgame-touch>
            <div class="mgame__pad">
              <button class="mgame__tbtn" type="button" data-mgame-left aria-label="Move left">◀</button>
              <button class="mgame__tbtn" type="button" data-mgame-right aria-label="Move right">▶</button>
            </div>
            <button class="mgame__tbtn mgame__tbtn--jump font-pixel" type="button" data-mgame-jump aria-label="Jump">JUMP</button>
          </div>
          <div class="mgame__msg" data-mgame-msg hidden>
            <p class="mgame__msg-text font-pixel" data-mgame-msgtext></p>
            <div class="mgame__msg-actions">
              <button class="btn btn--ghost mgame__again" type="button" data-mgame-again>Play again</button>
              <a class="btn btn--accent mgame__patron" data-mgame-patron href="#apply">Become a patron →</a>
            </div>
          </div>
        </div>
        <p class="mgame__hint font-mono">← → move&nbsp;·&nbsp;space / JUMP to leap&nbsp;·&nbsp;jump the bills, stomp the entitled issues, dodge the CVEs&nbsp;·&nbsp;grab COFFEE to go invincible&nbsp;·&nbsp;the secret ? = a NEW PROJECT IDEA (you'll never finish it)&nbsp;·&nbsp;then jump the LAYOFF dragon to reach ManagedCode, where maintaining OSS finally pays&nbsp;·&nbsp;esc quits</p>
      </div>`;
    document.body.appendChild(root);

    canvas = root.querySelector('[data-mgame-canvas]') as HTMLCanvasElement;
    const c = canvas.getContext('2d');
    if (!c) {
      root.remove();
      root = null;
      throw new Error('no 2d context');
    }
    ctx = c;
    starsEl = root.querySelector('[data-mgame-stars]');
    livesEl = root.querySelector('[data-mgame-lives]');
    msgEl = root.querySelector('[data-mgame-msg]');
    msgTextEl = root.querySelector('[data-mgame-msgtext]');

    root.querySelector('[data-mgame-close]')?.addEventListener('click', close);
    root.querySelector('[data-mgame-again]')?.addEventListener('click', restart);
    root.querySelector('[data-mgame-patron]')?.addEventListener('click', (e) => {
      e.preventDefault();
      close();
      document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' });
    });
    root.addEventListener('click', (e) => {
      if (e.target === root) close();
    });

    // --- on-screen touch controls (phones/tablets) ---
    // Only surfaced on a coarse pointer. Pointer capture + pointercancel means a
    // finger that slides off the button still releases cleanly — no stuck keys.
    root.dataset.touch = String(
      typeof window.matchMedia === 'function' &&
        window.matchMedia('(hover: none) and (pointer: coarse)').matches
    );
    // Each button refcounts its own active pointers, so a second finger landing on
    // it (or one finger lifting while another still holds) can't desync the input
    // or the highlight. Touch pointers get implicit capture, so a finger that
    // slides off still delivers its pointerup/cancel back here and releases clean.
    const bindHold = (sel: string, press: () => void, release: () => void) => {
      const el = root?.querySelector<HTMLElement>(sel);
      if (!el) return;
      const active = new Set<number>();
      const reset = () => {
        active.clear();
        el.dataset.on = 'false';
      };
      touchResets.push(reset);
      const down = (e: PointerEvent) => {
        e.preventDefault();
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* explicit capture is belt-and-suspenders; touch capture is implicit */
        }
        const wasEmpty = active.size === 0;
        active.add(e.pointerId);
        if (wasEmpty) {
          press();
          el.dataset.on = 'true';
        }
      };
      const up = (e: PointerEvent) => {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* no-op */
        }
        if (!active.delete(e.pointerId)) return;
        if (active.size === 0) {
          release();
          el.dataset.on = 'false';
        }
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    bindHold(
      '[data-mgame-left]',
      () => setLeft(true),
      () => setLeft(false)
    );
    bindHold(
      '[data-mgame-right]',
      () => setRight(true),
      () => setRight(false)
    );
    bindHold(
      '[data-mgame-jump]',
      () => {
        if (state === 'play') jumpDown('touch', true);
      },
      () => jumpUp('touch')
    );

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    // Losing focus/leaving the tab drops any held key/button so nothing sticks on.
    window.addEventListener('blur', clearInput);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearInput();
        stopLoop();
      } else if (root && root.dataset.open === 'true') startLoop();
    });

    (window as Window & { __mgame?: () => unknown }).__mgame = () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      stars,
      lives,
      state,
      power: player.power,
      onGround: player.onGround,
      jumpHeld,
      blockStars: blockStars.length,
      oneups: oneups.filter((u) => !u.got).length,
      dir: moveDir(),
      celebrate,
      fireworks: rockets.length + sparks.length,
      bossDead: boss ? boss.dead : 1,
      usedBlocks: qblocks.filter((q) => q.used).map((q) => ({ tx: q.tx, ty: q.ty, kind: q.kind })),
      enemies: enemies.filter((e) => !e.dead).map((e) => ({ t: e.type, x: Math.round(e.x) })),
    });
  }

  function startLoop() {
    if (running) return;
    running = true;
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(loop);
  }
  function stopLoop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  function restart() {
    reset();
    startLoop();
  }
  function launch() {
    try {
      if (!root) build();
      if (!root) return;
      root.dataset.open = 'true';
      document.documentElement.classList.add('mgame-open');
      reset();
      startLoop();
      canvas.focus();
    } catch {
      /* the mascot still works without the game */
    }
  }
  function close() {
    stopLoop();
    clearInput();
    setPlaying(false);
    celebrate = false;
    if (root) root.dataset.open = 'false';
    document.documentElement.classList.remove('mgame-open');
  }

  return { launch };
}
