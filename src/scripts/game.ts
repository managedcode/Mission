import { miniGame } from '../data/site';

/* =================================================================
   MAINTAINER DAY — a savagely on-the-nose platformer about being an open-source
   maintainer. You ship for $0 while the expense monsters keep coming:
   RENT · TAX · ELECTRIC · WATER · MOBILE · SUBS · GAS · LOAN · FEES.
   Bump ? blocks for GitHub ★ (worth $0), grab the COFFEE, and find the secret
   NEW PROJECT IDEA — the backlog grows, so the maintainer grows with it.

   Reach the finale and you win, obviously: the lights warm up and fireworks go up
   because ManagedCode is glad to have you here, funding the maintenance work
   you've done for free — but first you JUMP the fire-spitting LAYOFF dragon
   (the meme boss) like Bowser. COFFEE = temporary invincibility; the secret block
   drops a NEW PROJECT IDEA (another one you'll start instead of finishing this one).

   Plays with keyboard (← → + space) or on-screen touch buttons on phones.
   Launched by clicking the corner mascot. Lazy + self-contained: the
   DOM/canvas is built only on first launch(), never on load, so it can't
   surface in screenshots/tests.
   ================================================================= */

type Game = { launch: () => void };
type MissionSoundBridge = { play?: (name: string) => void };

export function createMascotGame(): Game {
  const TILE = 16;
  const VIEW_W = 320;
  const VIEW_H = 176;
  const GROUND_ROW = 9;
  const GROUND_TOP = GROUND_ROW * TILE; // 144
  const LEVEL_W = 104;
  const WORLD_W = LEVEL_W * TILE;

  // ---- Level geometry ----
  const GROUND_SPANS: Array<[number, number]> = [
    [0, 68],
    [71, 77],
    [80, 103], // long opening run, two late pits, then a roomier layoff arena
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
    [32, 5, 'coin'],
    [40, 3, 'power'],
    [53, 5, 'coin'],
    [57, 3, 'hidden'],
    [80, 4, 'coin'],
  ];
  // enemies: [type, tileX, label?, tone?] — every monster is a cost line item.
  // They are not framework jokes; they are the boring expenses that keep charging
  // while the maintainer ships for $0.
  const ENEMIES_DEF: Array<[string, number, string?, BillTone?]> = [
    ['goomba', 11, 'TAX', 'tax'],
    ['bill', 18, 'RENT', 'rent'],
    ['fly', 14, 'ELECTRIC', 'electric'],
    ['bill', 29, 'WATER', 'water'],
    ['turtle', 34, 'LOAN', 'loan'],
    ['bill', 40, 'MOBILE', 'mobile'],
    ['bill', 47, 'SUBS', 'subs'],
    ['bill', 53, 'GAS', 'gas'],
    ['goomba', 58, 'FEES', 'fees'],
    ['fly', 67, 'TAX', 'tax'],
    ['bill', 72, 'RENT', 'rent'],
    ['turtle', 76, 'LOAN', 'loan'],
    ['bill', 82, 'WATER', 'water'],
  ];
  // background signposts = the open-source career arc, dead obvious: you ship OSS,
  // you're still paid $0, you're drowning (SOS) — then the LAYOFF dragon, then funding.
  const SIGNS: Array<[number, string]> = [
    [9 * TILE, 'OSS'],
    [38 * TILE, 'STILL $0'],
    [85 * TILE, 'SOS'],
  ];
  // recurring household bills that erupt from each expense pipe (by pipe order)
  const PIPE_TAGS: Array<[string, BillTone]> = [
    ['MOBILE', 'mobile'],
    ['SUBS', 'subs'],
    ['FEES', 'fees'],
  ];
  const START = { x: 2 * TILE, y: 6 * TILE };
  const CASTLE_X = 98 * TILE;
  const CASTLE_W = 5 * TILE;
  const PLAYER_SMALL = { w: 11, h: 14, scale: 1 };
  const PLAYER_BIG = { w: PLAYER_SMALL.w * 2, h: PLAYER_SMALL.h * 2, scale: 2 };
  const VOID_GROUND = VIEW_H - 28;
  const VOID_DRAGON_START_GAP = 152;
  const VOID_DRAGON_HIT_GAP = 26;
  const VOID_DRAGON_RAMP_FRAMES = 42 * 60;
  const VOID_PLAYER_BACK_MAX = -1.05;
  const VOID_PLAYER_FORWARD_MAX = 2.62;
  const VOID_TEST_ADVANCE_FRAMES = 120 * 60;
  const TRANSITION_SHORT = 32;
  const TRANSITION_LONG = 56;
  const PIPE_DESCENT_FRAMES = 62;
  const PIPE_SCENE_TRANSITION_FRAMES = PIPE_DESCENT_FRAMES * 2;

  const sound = (name: string) => {
    (window as Window & { __missionSound?: MissionSoundBridge }).__missionSound?.play?.(name);
  };

  // ---- Solid tiles + ? lookup ----
  const solidSet = new Set<string>();
  const kk = (tx: number, ty: number) => tx + ':' + ty;
  for (const [a, b] of GROUND_SPANS)
    for (let tx = a; tx <= b; tx++) {
      solidSet.add(kk(tx, 9));
      solidSet.add(kk(tx, 10));
    }
  for (const [px, py, w] of PLATFORMS) for (let i = 0; i < w; i++) solidSet.add(kk(px + i, py));
  const isPipeTile = (tx: number, ty: number) =>
    PIPES.some(([px, ph]) => (tx === px || tx === px + 1) && ty >= GROUND_ROW - ph && ty <= 8);
  for (const [px, ph] of PIPES)
    for (let r = GROUND_ROW - ph; r <= 8; r++) {
      solidSet.add(kk(px, r));
      solidSet.add(kk(px + 1, r));
    }
  for (const [tx, ty, kind] of QDEF) if (kind !== 'hidden') solidSet.add(kk(tx, ty));
  const solidAt = (tx: number, ty: number) => {
    const q = qmap.get(kk(tx, ty));
    if (q) return q.kind !== 'hidden' || q.used;
    if (brokenBricks.has(kk(tx, ty))) return false;
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
    tax: '#c24a7a',
    subs: '#8a6cff',
    fees: '#df5f27',
    // the bills that keep charging while you maintain for free
    electric: '#f2c200',
    water: '#27a3e0',
    gas: '#e0662b',
    gym: '#9b59b6',
    metime: '#16c79a',
    // the real-life cost monsters
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
    | 'tax'
    | 'subs'
    | 'fees'
    | 'electric'
    | 'water'
    | 'gas'
    | 'gym'
    | 'metime';
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
  let downHeld = false;
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
  function setDown(on: boolean) {
    downHeld = on;
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
    projectScale: PLAYER_SMALL.scale,
  };
  let camX = 0;
  let stars = 0;
  let lives = 3;
  type GameState = 'play' | 'pipe' | 'void' | 'ending' | 'win' | 'dying' | 'over';
  let state: GameState = 'play';
  let tick = 0;
  type DeathScene = 'main' | 'void';
  let deathScene: DeathScene = 'main';
  type Transition = {
    kind: 'launch' | 'restart' | 'pipe' | 'void' | 'win' | 'death';
    t: number;
    duration: number;
    label: string;
  };
  let transition: Transition | null = null;

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
    pipeX?: number;
  };
  let enemies: Enemy[] = [];
  type Particle = { x: number; y: number; vy: number; life: number; text: string; color: string };
  let particles: Particle[] = [];
  let blockPunchlineIndex = 0;
  const brickBumps = new Map<string, number>();
  const brokenBricks = new Set<string>();
  type BrickBit = { x: number; y: number; vx: number; vy: number; life: number; color: string };
  let brickBits: BrickBit[] = [];
  type BlockStar = { x: number; y: number; vx: number; vy: number; life: number };
  let blockStars: BlockStar[] = [];
  type Pickup = { x: number; y: number; vx: number; vy: number; got: boolean };
  let oneups: Pickup[] = []; // "NEW PROJECT IDEA" 1-ups dropped by secret blocks
  let enterT = 0; // castle-entry timer for the ending scene
  let overT = 0; // delayed game-over timer, so the loss has a readable beat
  let pipeT = 0;
  type ActivePipe = { px: number; ph: number; pipeX: number; top: number };
  let activePipe: ActivePipe | null = null;
  let voidT = 0;
  let voidDragon = { x: 0, y: 0, t: 0, mouth: 0 };
  const voidGap = () => player.x - voidDragon.x;
  const voidSeconds = () => Math.max(0, Math.floor(voidT / 60));
  const pipeBillMouthLeft = (e: Enemy) => e.pipeX ?? e.x + e.w / 2 - TILE;
  const pipeBillBlockedByPlayer = (e: Enemy) => {
    const pipeLeft = pipeBillMouthLeft(e);
    const pipeRight = pipeLeft + TILE * 2;
    const playerCenter = player.x + player.w / 2;
    const playerFeet = player.y + player.h;
    const standingOnMouth =
      playerCenter >= pipeLeft - 2 &&
      playerCenter <= pipeRight + 2 &&
      Math.abs(playerFeet - e.baseY) <= 3;
    const enteringSamePipe =
      state === 'pipe' && activePipe ? Math.abs(activePipe.pipeX - pipeLeft) <= 1 : false;
    return standingOnMouth || enteringSamePipe;
  };
  const pipeBillEmergence = (e: Enemy) => {
    if (e.type !== 'piranha') return 1;
    return Math.max(0, Math.min(1, (e.baseY + 8 - e.y) / 22));
  };
  const pipeBillVisible = (e: Enemy) =>
    e.type !== 'piranha' || (!pipeBillBlockedByPlayer(e) && pipeBillEmergence(e) > 0.25);
  const pipeBillHittable = (e: Enemy) => e.type !== 'piranha' || pipeBillVisible(e);
  const pipeBillDangerous = (e: Enemy) =>
    e.type !== 'piranha' || (!pipeBillBlockedByPlayer(e) && pipeBillEmergence(e) > 0.55);
  let lastGameOverFinaleIndex = -1;
  let forcedGameOverFinaleIndex: number | null = null;
  const normalizeGameOverFinaleIndex = (index: number) => {
    const count: number = miniGame.gameOverFinales.length;
    if (count === 0) return -1;
    return ((Math.trunc(index) % count) + count) % count;
  };
  const pickGameOverFinaleIndex = () => {
    const count: number = miniGame.gameOverFinales.length;
    if (count === 0) return -1;
    if (forcedGameOverFinaleIndex !== null) {
      lastGameOverFinaleIndex = normalizeGameOverFinaleIndex(forcedGameOverFinaleIndex);
      return lastGameOverFinaleIndex;
    }
    let next = Math.floor(Math.random() * count);
    if (count > 1 && next === lastGameOverFinaleIndex) next = (next + 1) % count;
    lastGameOverFinaleIndex = next;
    return next;
  };
  const pickGameOverFinale = () => {
    const index = pickGameOverFinaleIndex();
    return { index, finale: index >= 0 ? miniGame.gameOverFinales[index] : null };
  };
  const formatVoidGameOver = () => {
    const seconds = Math.max(1, voidSeconds());
    const label = seconds === 1 ? miniGame.voidSecondLabel : miniGame.voidSecondsLabel;
    const { finale } = pickGameOverFinale();
    if (!finale)
      return `${miniGame.voidGameOverTitle}\n${miniGame.voidGameOverPrefix} ${seconds} ${label}.`;
    return `${finale.title}\n${miniGame.voidGameOverPrefix} ${seconds} ${label}.\n${finale.void}\n${finale.detail}`;
  };
  const formatMainGameOver = () => {
    const { finale } = pickGameOverFinale();
    if (!finale) return `${miniGame.voidGameOverTitle}   ★ ${stars}\nyou ran out of lives.`;
    return `${finale.title}   ★ ${stars}\n${finale.main}\n${finale.detail}`;
  };
  type PlayerPose = 'none' | 'hit' | 'shrink' | 'grow' | 'stomp';
  let playerPose: PlayerPose = 'none';
  let poseT = 0;
  const WIN_DOOR_FADE_FRAMES = 72;
  const WIN_CARD_DELAY_FRAMES = 148;
  const GAME_OVER_SQUASH_FRAMES = 12;
  const GAME_OVER_POP_FRAMES = 28;
  const GAME_OVER_FALL_FRAMES = 82;
  const GAME_OVER_CARD_DELAY_FRAMES = 136;
  // --- the LAYOFF dragon: the termination boss guarding the gate. Spits
  // fire; you jump it like Bowser to reach the job. (COFFEE lets you blow through.)
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
  const BOSS_X = 89 * TILE; // paces in front of the castle gate (castle @98)
  // --- victory celebration: a raised flag + fireworks over the ManagedCode HQ ---
  type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };
  type Rocket = { x: number; y: number; vy: number; color: string };
  let sparks: Spark[] = [];
  let rockets: Rocket[] = [];
  let celebrate = false; // spawning fireworks (true from castle-entry through the win)
  let fwTick = 0;
  const FW_COLORS = [C.starHi, C.star, C.bodyHi, C.grassHi, C.mobile, C.rent, C.electric, C.cream];

  function clearInput() {
    leftHeld = false;
    rightHeld = false;
    downHeld = false;
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
  function setPlayerPose(pose: PlayerPose, frames: number) {
    playerPose = pose;
    poseT = frames;
  }
  function startTransition(kind: Transition['kind'], label: string, duration = TRANSITION_SHORT) {
    transition = { kind, label, duration, t: duration };
  }
  function updateTransition() {
    if (!transition) return;
    transition.t--;
    if (transition.t <= 0) transition = null;
  }
  function activePlayerPose(): PlayerPose | 'death-squash' | 'death' {
    if (state === 'dying') return overT <= GAME_OVER_SQUASH_FRAMES ? 'death-squash' : 'death';
    return poseT > 0 ? playerPose : 'none';
  }
  function playerOverlapsSolid() {
    const left = Math.floor(player.x / TILE);
    const right = Math.floor((player.x + player.w - 1) / TILE);
    const top = Math.floor(player.y / TILE);
    const bottom = Math.floor((player.y + player.h - 1) / TILE);
    for (let ty = top; ty <= bottom; ty++)
      for (let tx = left; tx <= right; tx++) if (solidAt(tx, ty)) return true;
    return false;
  }
  function resizePlayer(scale: number) {
    const next = scale === PLAYER_BIG.scale ? PLAYER_BIG : PLAYER_SMALL;
    if (player.projectScale === next.scale) return;
    const center = player.x + player.w / 2;
    const feet = player.y + player.h;
    player.projectScale = next.scale;
    player.w = next.w;
    player.h = next.h;
    player.x = Math.max(0, Math.min(WORLD_W - player.w, center - player.w / 2));
    player.y = feet - player.h;

    // If the pickup happens under a block, nudge down to the nearest free row.
    for (let i = 0; i < player.h && playerOverlapsSolid(); i++) player.y += 1;
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
      const h = type === 'turtle' ? 14 : type === 'bill' ? (tone === 'mobile' ? 16 : 14) : 12;
      if (type === 'fly')
        enemies.push({
          type: 'fly',
          x: tx * TILE,
          y: GROUND_TOP - 34,
          w: 12,
          h: 10,
          vx: tx <= 20 ? -0.25 : 0.7,
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
          y: GROUND_TOP - h,
          w: 12,
          h,
          vx: tx <= 20 ? -0.25 : 0.5,
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
      const h = tone === 'mobile' ? 16 : 14;
      const w = 12;
      enemies.push({
        type: 'piranha',
        x: px * TILE + TILE - w / 2,
        y: top + 10,
        w,
        h,
        vx: 0,
        baseY: top,
        dead: 0,
        t: (px * 11) % 120,
        label,
        tone,
        pipeX: px * TILE,
      });
    }
  }
  function reset() {
    player.w = PLAYER_SMALL.w;
    player.h = PLAYER_SMALL.h;
    player.projectScale = PLAYER_SMALL.scale;
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
    deathScene = 'main';
    transition = null;
    clearInput();
    qblocks = QDEF.map(([tx, ty, kind]) => ({ tx, ty, kind, used: false, bump: 0 }));
    qmap.clear();
    for (const q of qblocks) qmap.set(kk(q.tx, q.ty), q);
    flowers = [];
    spawnEnemies();
    particles = [];
    blockPunchlineIndex = 0;
    brickBumps.clear();
    brokenBricks.clear();
    brickBits = [];
    blockStars = [];
    oneups = [];
    enterT = 0;
    overT = 0;
    pipeT = 0;
    activePipe = null;
    voidT = 0;
    voidDragon = { x: START.x - 92, y: VOID_GROUND - 34, t: 0, mouth: 0 };
    setPlayerPose('none', 0);
    sparks = [];
    rockets = [];
    celebrate = false;
    fwTick = 0;
    boss = { x: BOSS_X, y: GROUND_TOP - 24, w: 36, h: 24, t: 0, dir: -1, mouth: 0, dead: 0 };
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
    const n = 28;
    sound('firework');
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = 0.9 + Math.random() * 1.35;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.4,
        life: 34 + Math.floor(Math.random() * 18),
        color,
      });
    }
    addParticle(x - 2, y - 7, '+', C.starHi);
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
  function popBlockPunchline(tx: number, ty: number) {
    const punchlines: readonly string[] = miniGame.blockPunchlines;
    const label = punchlines[blockPunchlineIndex % punchlines.length];
    blockPunchlineIndex++;
    const w = label.length * 4 - 1;
    const x = Math.max(camX + 6, Math.min(tx * TILE + 8 - w / 2, camX + VIEW_W - w - 6));
    addParticle(x, ty * TILE - 13, label, C.starHi);
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
    // NOT a 1-UP / life-up — it's a NEW PROJECT idea. The shiny new repo you'll
    // start instead of finishing this one. Bigger backlog, bigger sprite.
    oneups.push({ x: tx * TILE + 1, y: ty * TILE - 14, vx: 0.8, vy: -2.4, got: false });
    addParticle(tx * TILE - 20, ty * TILE - 4, 'NEW PROJECT IDEA', C.life);
  }
  function isBreakableBrick(tx: number, ty: number) {
    const key = kk(tx, ty);
    return ty < GROUND_ROW && !qmap.has(key) && !isPipeTile(tx, ty) && solidSet.has(key);
  }
  function burstBrick(tx: number, ty: number) {
    const x = tx * TILE;
    const y = ty * TILE;
    brickBits.push(
      { x: x + 2, y: y + 2, vx: -1.4, vy: -3.8, life: 36, color: C.brickHi },
      { x: x + 9, y: y + 2, vx: 1.3, vy: -3.5, life: 34, color: C.brick },
      { x: x + 1, y: y + 9, vx: -1.0, vy: -2.4, life: 32, color: C.brick },
      { x: x + 10, y: y + 9, vx: 1.1, vy: -2.2, life: 32, color: C.dirt }
    );
  }
  function bumpBrick(tx: number, ty: number) {
    const key = kk(tx, ty);
    if (!isBreakableBrick(tx, ty) || brokenBricks.has(key)) return;
    brokenBricks.add(key);
    brickBumps.delete(key);
    burstBrick(tx, ty);
    sound('brick');
    addParticle(tx * TILE + 1, ty * TILE - 5, 'CRACK', C.starHi);
  }
  function bumpBlock(q: Q) {
    q.used = true;
    q.bump = 8;
    sound('block');
    if (q.kind === 'coin') {
      stars += 3;
      popGithubStars(q.tx, q.ty);
      popBlockPunchline(q.tx, q.ty);
      sound('star');
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
    sound('hurt');
    clearInput();
    player.w = PLAYER_SMALL.w;
    player.h = PLAYER_SMALL.h;
    player.projectScale = PLAYER_SMALL.scale;
    player.x = START.x;
    player.y = START.y;
    player.vx = 0;
    player.vy = 0;
    player.invuln = 100;
    player.power = 0;
    setPlayerPose('hit', 44);
    addParticle(player.x - 8, player.y - 8, '-1 LIFE', C.rent);
  }
  function hurt() {
    if (player.invuln > 0 || player.power > 0) return;
    if (player.projectScale > PLAYER_SMALL.scale) {
      resizePlayer(PLAYER_SMALL.scale);
      player.invuln = 100;
      player.vy = -3;
      setPlayerPose('shrink', 38);
      sound('shrink');
      addParticle(player.x - 10, player.y - 8, 'TOO MUCH', C.rent);
      return;
    }
    lives -= 1;
    updateHud();
    if (lives <= 0) return gameOver();
    sound('hurt');
    player.invuln = 100;
    player.vy = -4;
    player.vx = -player.face * 3;
    setPlayerPose('hit', 34);
    addParticle(player.x - 8, player.y - 8, 'OUCH', C.rent);
  }
  function updateEnding() {
    // Mario-style castle entry: the maintainer walks into the (now warmly lit) gate
    // and fades in, then the scene gets one real fanfare beat before the card.
    const doorX = CASTLE_X + CASTLE_W / 2 - player.w / 2;
    if (player.x < doorX - 1) {
      player.x += 1.4;
      player.face = 1;
      player.step += 0.2;
    } else {
      player.x = doorX;
      player.vx = 0;
      enterT++;
      if (enterT % 24 === 0 && enterT < WIN_CARD_DELAY_FRAMES - 12) spawnRocket();
    }
    player.vy += GRAV;
    if (player.vy > MAXFALL) player.vy = MAXFALL;
    player.onGround = false;
    player.y += player.vy;
    collide('y');
    settleGround();
    camX = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x + player.w / 2 - VIEW_W / 2));
    if (enterT >= WIN_CARD_DELAY_FRAMES) showWin();
  }
  function startEnding() {
    state = 'ending';
    enterT = 0;
    overT = 0;
    celebrate = true;
    deathScene = 'main';
    startTransition('win', 'FUNDED', TRANSITION_LONG);
    sound('win');
    if (boss) boss.dead = 1; // the layoff monster loses; you got the job
    fireballs = [];
    clearInput();
    setPlaying(false);
    hideMsg();
  }
  function parkPlayerAtCastleDoor() {
    player.x = CASTLE_X + CASTLE_W / 2 - player.w / 2;
    player.y = GROUND_TOP - player.h;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    camX = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x + player.w / 2 - VIEW_W / 2));
  }
  function showWin() {
    state = 'win';
    setPlaying(false);
    // celebrate stays true → the fireworks keep bursting behind the win card.
    const finale = miniGame.winFinale;
    showMsg(
      [`${finale.title}   [star] ${stars}`, finale.lead, finale.detail, finale.stars]
        .filter(Boolean)
        .join('\n'),
      true
    );
  }
  function gameOver() {
    clearInput();
    deathScene = state === 'void' || deathScene === 'void' ? 'void' : 'main';
    state = 'dying';
    setPlaying(false);
    celebrate = false;
    fireballs = []; // don't leave hazards frozen behind the translucent lose card
    overT = 0;
    player.power = 0;
    player.invuln = 0;
    player.vx = -player.face * 0.45;
    player.vy = 0;
    player.onGround = false;
    if (player.y > VIEW_H) player.y = (deathScene === 'void' ? VOID_GROUND : GROUND_TOP) - player.h;
    setPlayerPose('none', 0);
    transition = null;
    sound('death');
    addParticle(player.x - 4, player.y - 10, 'OOF', C.rent);
    hideMsg();
  }
  function updateGameOver() {
    overT++;
    if (overT <= GAME_OVER_SQUASH_FRAMES) {
      player.step += 0.1;
    } else if (overT <= GAME_OVER_FALL_FRAMES) {
      if (overT === GAME_OVER_SQUASH_FRAMES + 1) player.vy = -7.4;
      player.vy += overT < GAME_OVER_POP_FRAMES ? 0.18 : 0.38;
      if (player.vy > MAXFALL) player.vy = MAXFALL;
      player.x += player.vx;
      player.y += player.vy;
      player.step += 0.18;
    }
    if (overT >= GAME_OVER_CARD_DELAY_FRAMES) showGameOver();
  }
  function standingPipe(): ActivePipe | null {
    const center = player.x + player.w / 2;
    const feet = player.y + player.h;
    for (const [px, ph] of PIPES) {
      const pipeX = px * TILE;
      const top = (GROUND_ROW - ph) * TILE;
      if (center >= pipeX - 2 && center <= pipeX + TILE * 2 + 2 && Math.abs(feet - top) <= 2) {
        return { px, ph, pipeX, top };
      }
    }
    return null;
  }
  function startPipeDescent() {
    const pipe = standingPipe();
    if (!pipe) return;
    state = 'pipe';
    pipeT = 0;
    activePipe = pipe;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.face = 1;
    player.x = pipe.pipeX + TILE - player.w / 2;
    player.y = pipe.top - player.h;
    clearInput();
    setPlaying(false);
    startTransition('pipe', 'DOWN PIPE', PIPE_SCENE_TRANSITION_FRAMES);
    sound('pipe');
  }
  function updatePipeDescent() {
    pipeT++;
    player.vx = 0;
    player.vy = 0;
    player.y += pipeT < 34 ? 1.45 : 0.65;
    player.step += 0.08;
    if (pipeT >= PIPE_DESCENT_FRAMES) startVoidChase();
  }
  function startVoidChase() {
    state = 'void';
    deathScene = 'void';
    voidT = 0;
    activePipe = null;
    player.w = PLAYER_SMALL.w;
    player.h = PLAYER_SMALL.h;
    player.projectScale = PLAYER_SMALL.scale;
    player.x = 44;
    player.y = VOID_GROUND - player.h;
    player.vx = 0.48;
    player.vy = 0;
    player.onGround = true;
    player.face = 1;
    player.power = 0;
    player.invuln = 0;
    camX = 0;
    voidDragon = { x: player.x - VOID_DRAGON_START_GAP, y: VOID_GROUND - 38, t: 0, mouth: 0 };
    fireballs = [];
    particles = [];
    clearInput();
    setPlaying(true);
    if (transition?.kind !== 'pipe') transition = null;
    sound('void');
  }
  function updateVoidChase() {
    voidT++;
    voidDragon.t++;
    if (voidDragon.mouth > 0) voidDragon.mouth--;
    const dir = moveDir();
    const idleDrift = dir === 0 ? 0.018 : 0;
    player.vx += dir * 0.13 + idleDrift;
    player.vx *= dir === 0 ? 0.965 : 0.982;
    player.vx = Math.max(VOID_PLAYER_BACK_MAX, Math.min(VOID_PLAYER_FORWARD_MAX, player.vx));
    if (Math.abs(player.vx) < 0.015) player.vx = 0;
    player.face = dir < 0 ? -1 : 1;
    player.step += 0.12 + Math.abs(player.vx) * 0.08;
    if (jumpBuf > 0 && player.onGround) {
      player.vy = JUMP * 0.94;
      jumpBuf = 0;
      player.onGround = false;
      sound('jump');
    }
    if (jumpBuf > 0) jumpBuf--;
    let g = GRAV;
    if (player.vy < 0 && jumpHeld) g = ASCEND_G;
    player.vy += g;
    if (player.vy > MAXFALL) player.vy = MAXFALL;
    if (!jumpHeld && player.vy < CUT) player.vy = CUT;
    player.x += player.vx;
    if (player.x < 28) {
      player.x = 28;
      player.vx = Math.max(0, player.vx);
    }
    player.y += player.vy;
    if (player.y + player.h >= VOID_GROUND) {
      player.y = VOID_GROUND - player.h;
      player.vy = 0;
      player.onGround = true;
    }
    camX = Math.max(0, player.x - (VIEW_W - 34));
    const ramp = Math.min(1, voidT / VOID_DRAGON_RAMP_FRAMES);
    const gap = voidGap();
    const lunge = gap > 170 ? Math.min(2.2, (gap - 170) * 0.015) : gap < 56 ? -0.08 : 0;
    const dragonSpeed = Math.max(0.78, 0.84 + ramp * 2.62 + lunge);
    voidDragon.x += dragonSpeed;
    voidDragon.y = VOID_GROUND - 38 + Math.sin(voidDragon.t * 0.12) * 2;
    if (voidT % 105 === 0) {
      voidDragon.mouth = 30;
      sound('fire');
      addParticle(player.x + 42, VOID_GROUND - 74, 'FEATURE?', C.subs);
    }
    if (voidGap() <= VOID_DRAGON_HIT_GAP) {
      gameOver();
    }
  }
  function showGameOver() {
    state = 'over';
    showMsg(deathScene === 'void' ? formatVoidGameOver() : formatMainGameOver(), false);
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
            else bumpBrick(tx, ty);
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
        // Pipe bills should read as recurring charges coming from the pipe, not
        // as a shy plant that disappears when the player walks up. They only
        // stay down while the maintainer is literally on/inside that pipe.
        const blocked = pipeBillBlockedByPlayer(e);
        const wave = (Math.sin(e.t * 0.045) + 1) / 2;
        const tgt = blocked ? e.baseY + 10 : e.baseY + 8 - wave * 24;
        e.y += (tgt - e.y) * 0.14;
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
        setPlayerPose('stomp', 14);
        sound('stomp');
        addParticle(e.x - 2, e.y - 10, 'BONK', C.starHi);
      } // stomp a moving shell → stop it
      else hurt();
      return;
    }
    if (e.type === 'piranha') {
      if (stomp && pipeBillVisible(e)) {
        e.dead = 1;
        stars++;
        player.vy = JUMP * 0.55;
        setPlayerPose('stomp', 14);
        sound('stomp');
        addParticle(e.x - 2, e.y - 10, 'BONK', C.starHi);
        updateHud();
      } else if (player.power > 0) {
        e.dead = 1;
        stars++;
        updateHud();
      } else if (pipeBillDangerous(e)) hurt();
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
      setPlayerPose('stomp', 14);
      sound('stomp');
      addParticle(e.x - 2, e.y - 10, 'BONK', C.starHi);
      updateHud();
    } else if (player.power > 0) {
      e.dead = 1;
      stars++;
      updateHud();
    } else hurt();
  }

  function update() {
    tick++;
    updateTransition();
    if (poseT > 0) poseT--;
    else playerPose = 'none';
    updateFireworks();
    for (const q of qblocks) if (q.bump > 0) q.bump--;
    for (const [key, bump] of brickBumps) {
      if (bump <= 1) brickBumps.delete(key);
      else brickBumps.set(key, bump - 1);
    }
    for (const s of blockStars) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.16;
      s.life--;
    }
    blockStars = blockStars.filter((s) => s.life > 0);
    for (const b of brickBits) {
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.26;
      b.life--;
    }
    brickBits = brickBits.filter((b) => b.life > 0);
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
    if (state === 'pipe') {
      updatePipeDescent();
      return;
    }
    if (state === 'void') {
      updateVoidChase();
      return;
    }
    if (state === 'ending') {
      updateEnding();
      return;
    }
    if (state === 'dying') {
      updateGameOver();
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
      sound('jump');
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
    if (downHeld && standingPipe()) {
      startPipeDescent();
      return;
    }

    for (const f of flowers)
      if (!f.got && ov(player.x, player.y, player.w, player.h, f.x, f.y, 10, 12)) {
        f.got = true;
        player.power = 420;
        setPlayerPose('grow', 24);
        sound('power');
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
        resizePlayer(PLAYER_BIG.scale);
        setPlayerPose('grow', 42);
        sound('power');
        addParticle(u.x - 20, u.y - 4, 'NEW PROJECT IDEA', C.life);
      }
    }

    updateEnemies();
    for (const e of enemies)
      if (
        !e.dead &&
        pipeBillHittable(e) &&
        ov(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)
      )
        hitEnemy(e);

    updateBoss();

    if (player.x + player.w >= CASTLE_X + 18) {
      startEnding();
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
    // a slow menace pacing in a roomy arena in front of the gate
    boss.x += boss.dir * 0.35;
    if (boss.x < BOSS_X - 28) boss.dir = 1;
    else if (boss.x > BOSS_X + 20) boss.dir = -1;
    if (boss.mouth > 0) boss.mouth--;
    // only breathe fire once the player is in range, so the approach is fair
    const near = player.x > boss.x - 150;
    if (near && boss.t % 95 === 0) {
      boss.mouth = 26;
      fireballs.push({ x: boss.x - 4, y: boss.y + 13, vx: -2.1, vy: -1.4, life: 170 });
      sound('fire');
    }
    // contact: COFFEE blows straight through (and topples the layoff); else you're hit
    if (ov(player.x, player.y, player.w, player.h, boss.x, boss.y, boss.w, boss.h)) {
      if (player.power > 0) {
        boss.dead = 1;
        stars += 5;
        addParticle(boss.x, boss.y - 6, 'FUNDED', C.starHi);
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
    // a white octocat-ish "new project" pickup
    block(x + 2, y + 1, 10, 9, C.cream);
    block(x + 1, y + 3, 12, 5, C.cream); // head
    block(x + 2, y, 2, 2, C.cream);
    block(x + 10, y, 2, 2, C.cream); // ears
    block(x + 4, y + 4, 2, 2, C.ink);
    block(x + 8, y + 4, 2, 2, C.ink); // eyes
    block(x + 4, y + 10, 6, 3, C.cream);
    block(x + 6, y + 12, 2, 2, C.cream); // body + tail
    block(x + 3, y + 13, 8, 1, C.bodyHi); // green "new project" base
    drawTag(x + 7, y - 12, 'NEW PROJECT IDEA', 'subs');
  }
  function drawBrickTile(x: number, y: number, used = false) {
    const base = used ? C.used : C.brick;
    const hi = used ? '#6b5a2c' : C.brickHi;
    const shade = used ? '#2f2714' : '#7a5a16';
    block(x, y, TILE, TILE, base);
    block(x + 1, y + 1, 4, 2, hi);
    block(x + 9, y + 1, 5, 2, hi);
    block(x + 2, y + 6, 3, 2, shade);
    block(x + 8, y + 7, 6, 2, shade);
    block(x + 1, y + 12, 5, 2, shade);
    block(x + 11, y + 12, 3, 2, hi);
  }
  function drawGroundTile(x: number, y: number, isTop: boolean) {
    block(x, y, TILE, TILE, C.dirt);
    if (!isTop) return;
    block(x, y, TILE, 4, C.grass);
    const alt = Math.abs(Math.floor(x / TILE)) % 2;
    block(x + 1 + alt, y, 5, 1, C.grassHi);
    block(x + 9 - alt, y + 1, 4, 1, C.grassHi);
    block(x + 3, y + 4, 3, 2, C.dirt);
    block(x + 10, y + 5, 4, 2, '#3d341a');
  }
  function drawQBlock(q: Q) {
    const x = q.tx * TILE;
    const y = q.ty * TILE - (q.bump > 0 ? 4 : 0);
    if (q.kind === 'hidden' && !q.used) return;
    if (q.used) {
      drawBrickTile(x, y, true);
      return;
    }
    drawBrickTile(x, y);
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
  function drawBillMonster(e: Enemy, wob: number) {
    const x = e.x;
    const y = e.y;
    const tone = e.tone || 'rent';
    const t = billTone(tone);
    if (tone === 'rent') {
      // Angry house: rent is the monster with a roof over its head.
      block(x + 1, y + 4, 10, 8, C.paper);
      block(x + 2, y + 2, 8, 2, t);
      block(x + 3, y, 6, 2, t);
      block(x + 3, y + 6, 2, 2, C.ink);
      block(x + 8, y + 6, 2, 2, C.ink);
      block(x + 5, y + 9, 3, 3, t);
      block(x + (wob ? 0 : 1), y + 12, 3, 2, C.ink);
      block(x + (wob ? 9 : 8), y + 12, 3, 2, C.ink);
    } else if (tone === 'water') {
      // Droplet with a bill face.
      block(x + 5, y, 2, 2, C.starHi);
      block(x + 3, y + 2, 6, 3, t);
      block(x + 1, y + 5, 10, 5, t);
      block(x + 2, y + 10, 8, 2, '#145f86');
      block(x + 3, y + 6, 2, 2, C.cream);
      block(x + 8, y + 6, 2, 2, C.cream);
      block(x + 4, y + 7, 1, 1, C.ink);
      block(x + 9, y + 7, 1, 1, C.ink);
      block(x + (wob ? 1 : 2), y + 12, 3, 2, '#145f86');
      block(x + (wob ? 8 : 7), y + 12, 3, 2, '#145f86');
    } else if (tone === 'mobile') {
      // Phone bill: antenna + screen-face.
      block(x + 3, y, 6, 2, t);
      block(x + 4, y - 2, 1, 2, t);
      block(x + 2, y + 2, 9, 12, '#0b2630');
      block(x + 3, y + 3, 7, 8, t);
      block(x + 4, y + 6, 1, 2, C.ink);
      block(x + 8, y + 6, 1, 2, C.ink);
      block(x + 5, y + 10, 3, 1, C.starHi);
      block(x + (wob ? 1 : 2), y + 14, 3, 2, C.ink);
      block(x + (wob ? 8 : 7), y + 14, 3, 2, C.ink);
    } else if (tone === 'subs') {
      // Subscription ghost: recurring charge that follows you around.
      block(x + 2, y + 2, 8, 2, t);
      block(x + 1, y + 4, 10, 7, t);
      block(x + 1, y + 11, 2, 2, t);
      block(x + 5, y + 11, 2, 2, t);
      block(x + 9, y + 11, 2, 2, t);
      block(x + 3, y + 6, 2, 2, C.cream);
      block(x + 7, y + 6, 2, 2, C.cream);
      block(x + 4, y + 7, 1, 1, C.ink);
      block(x + 8, y + 7, 1, 1, C.ink);
      block(x + 5, y + 9, 3, 1, C.ink);
      block(x + (wob ? 0 : 1), y + 13, 3, 2, '#392b7a');
      block(x + (wob ? 9 : 8), y + 13, 3, 2, '#392b7a');
    } else if (tone === 'gas') {
      // Flame bill: heat and fuel spikes.
      block(x + 5, y, 2, 2, C.starHi);
      block(x + 3, y + 2, 6, 4, C.starHi);
      block(x + 1, y + 5, 10, 6, t);
      block(x + 3, y + 6, 2, 2, C.ink);
      block(x + 8, y + 6, 2, 2, C.ink);
      block(x + 4, y + 10, 5, 2, '#7a2c13');
      block(x + (wob ? 1 : 2), y + 12, 3, 2, '#7a2c13');
      block(x + (wob ? 8 : 7), y + 12, 3, 2, '#7a2c13');
    } else {
      block(x, y, 12, 10, C.paper);
      block(x, y, 12, 3, t);
      block(x + 2, y + 5, 2, 2, C.ink);
      block(x + 8, y + 5, 2, 2, C.ink);
      block(x + 3, y + 8, 6, 1, t);
      block(x + (wob ? 0 : 2), y + 10, 3, 2, C.ink);
      block(x + (wob ? 9 : 7), y + 10, 3, 2, C.ink);
    }
  }
  function drawEnemy(e: Enemy) {
    const x = e.x;
    const y = e.y;
    const wob = Math.floor(tick / 8) % 2;
    if (e.type === 'bill') {
      drawBillMonster(e, wob);
    } else if (e.type === 'goomba') {
      const t = billTone(e.tone || 'tax');
      block(x + 1, y, 10, 7, t);
      block(x, y + 3, 12, 4, t);
      block(x + 3, y + 1, 6, 2, C.sign); // official-looking bill stamp
      block(x + 3, y + 3, 2, 2, C.cream);
      block(x + 7, y + 3, 2, 2, C.cream);
      block(x + 3, y + 4, 1, 1, C.ink);
      block(x + 8, y + 4, 1, 1, C.ink);
      block(x + (wob ? 0 : 2), y + 9, 4, 3, C.goombaD);
      block(x + (wob ? 8 : 6), y + 9, 4, 3, C.goombaD);
    } else if (e.type === 'turtle') {
      const t = billTone(e.tone || 'loan');
      block(x + (e.vx < 0 ? 8 : 1), y + 2, 3, 4, C.skin); // head
      block(x + 1, y + 5, 10, 7, t);
      block(x, y + 7, 12, 4, t);
      block(x + 3, y + 6, 6, 3, C.shellD);
      block(x + 5, y + 5, 2, 1, C.starHi); // coin glint: debt keeps compounding
      block(x + (wob ? 1 : 2), y + 12, 3, 2, C.shellD);
      block(x + (wob ? 8 : 7), y + 12, 3, 2, C.shellD);
    } else if (e.type === 'shell') {
      block(x + 1, y, 10, 8, C.shell);
      block(x, y + 2, 12, 5, C.shell);
      block(x + 3, y + 1, 6, 4, C.shellD);
      block(x + 4, y + 2, 4, 2, C.shell);
    } else if (e.type === 'fly') {
      const flap = Math.floor(tick / 5) % 2;
      const t = billTone(e.tone || 'electric');
      block(x + (flap ? -2 : 0), y + 1, 3, 4, C.wing);
      block(x + 11 - (flap ? 1 : 3), y + 1, 3, 4, C.wing); // wings
      block(x + 2, y + 2, 8, 7, t);
      block(x + 5, y - 1, 2, 3, C.starHi);
      block(x + 4, y + 1, 4, 1, C.starHi); // electric crown/bolt
      block(x + 3, y + 4, 2, 2, C.cream);
      block(x + 7, y + 4, 2, 2, C.cream);
      block(x + 3, y + 5, 1, 1, C.ink);
      block(x + 8, y + 5, 1, 1, C.ink);
    } else if (e.type === 'piranha') {
      if (!pipeBillVisible(e)) return;
      const t = billTone(e.tone || 'mobile');
      const stemTop = Math.min(e.baseY + 10, y + e.h - 4);
      block(x + 5, stemTop, 2, Math.max(2, e.baseY + 12 - stemTop), t);
      drawBillMonster(e, wob);
    }
  }
  function drawCastle() {
    const bx = CASTLE_X;
    const top = GROUND_TOP - 64;
    const stoneD = '#4b515a';
    const stoneM = '#747982';
    const stoneL = '#a8afb6';
    const roof = '#8f3921';
    const roofHi = '#df6a35';
    const mortar = '#bec6ca';
    const lit = celebrate ? C.starHi : C.cream;

    // classic platformer silhouette: red caps, squat towers, simple readable blocks.
    block(bx + 4, top + 30, 72, 34, stoneD);
    block(bx + 7, top + 27, 66, 37, stoneM);
    block(bx + 7, top + 27, 66, 3, stoneL);

    for (const x of [bx + 7, bx + 25, bx + 47, bx + 65]) {
      block(x, top + 18, 8, 10, stoneM);
      block(x, top + 18, 8, 2, stoneL);
    }
    block(bx + 7, top + 26, 66, 2, mortar);
    block(bx + 7, top + 30, 66, 2, stoneD);

    // side towers with little red roofs.
    for (const tx of [bx - 2, bx + 62]) {
      block(tx, top + 23, 20, 41, stoneD);
      block(tx + 2, top + 20, 16, 44, stoneM);
      block(tx + 2, top + 20, 16, 3, stoneL);
      block(tx, top + 16, 20, 5, roof);
      block(tx + 3, top + 11, 14, 5, roof);
      block(tx + 6, top + 7, 8, 4, roofHi);
      block(tx + 5, top + 36, 8, 4, stoneL);
      block(tx + 6, top + 50, 7, 3, stoneD);
    }

    // taller middle keep.
    block(bx + 25, top + 13, 30, 51, stoneD);
    block(bx + 28, top + 10, 24, 54, stoneM);
    block(bx + 28, top + 10, 24, 3, stoneL);
    block(bx + 24, top + 6, 32, 6, roof);
    block(bx + 29, top + 1, 22, 5, roof);
    block(bx + 34, top - 3, 12, 4, roofHi);
    block(bx + 29, top + 24, 22, 3, mortar);
    block(bx + 34, top + 30, 12, 9, C.doorDark);
    block(bx + 36, top + 32, 8, 3, lit);

    // masonry that reads as stone instead of a flat rectangle.
    for (let r = 0; r < 4; r++) {
      const y = top + 36 + r * 7;
      const offset = r % 2 ? 9 : 0;
      for (let x = bx + 10 + offset; x < bx + 70; x += 18) {
        block(x, y, 9, 2, r % 2 ? stoneD : stoneL);
      }
    }
    block(bx + 16, top + 42, 6, 10, C.doorDark);
    block(bx + 58, top + 42, 6, 10, C.doorDark);
    block(bx + 17, top + 43, 4, 2, lit);
    block(bx + 59, top + 43, 4, 2, lit);

    // arched, warm doorway: the castle is the place that finally pays the maintainer.
    const doorX = bx + CASTLE_W / 2 - 12;
    const doorY = GROUND_TOP - 31;
    block(doorX - 2, doorY + 8, 28, 23, C.doorDark);
    block(doorX + 2, doorY + 3, 20, 7, C.doorDark);
    block(doorX + 1, doorY + 9, 22, 22, roof);
    block(doorX + 4, doorY + 5, 16, 5, roof);
    block(doorX + 5, doorY + 12, 14, 19, lit);
    block(doorX + 7, doorY + 15, 10, 16, celebrate ? C.starHi : '#160f06');
    block(doorX + 2, doorY + 10, 3, 21, roofHi);
    block(doorX + 20, doorY + 10, 3, 21, roofHi);
    // the doorway warms up as you're hired (no flag — fireworks carry the win)
    if (celebrate) {
      block(doorX + 7, doorY + 15, 10, 16, C.starHi);
      block(doorX + 10, doorY + 19, 4, 12, C.cream);
      block(bx + 37, top + 16, 6, 3, C.starHi);
    }
  }

  // The LAYOFF dragon — longer and easier to read, with room to jump it cleanly.
  function drawBoss() {
    if (!boss || boss.dead) return;
    const x = boss.x;
    const y = boss.y;
    // back spikes
    block(x + 14, y + 2, 3, 5, C.pir);
    block(x + 20, y, 3, 7, C.pir);
    block(x + 26, y + 3, 3, 5, C.pir);
    // body + tail
    block(x + 9, y + 7, 21, 13, C.shellD);
    block(x + 10, y + 7, 19, 3, C.shell);
    block(x + 29, y + 12, 7, 5, C.shellD);
    block(x + 34, y + 13, 4, 3, C.shell);
    // head (faces left, toward the player)
    block(x, y + 8, 12, 11, C.shell);
    block(x + 1, y + 6, 9, 3, C.shellD); // brow
    block(x + 5, y + 1, 3, 6, C.cream); // horn
    block(x + 2, y + 10, 3, 3, C.starHi); // eye white
    block(x + 2, y + 10, 1, 3, C.pir); // angry red pupil
    // mouth: open + glowing when charging fire, a hard line otherwise
    if (boss.mouth > 0) {
      block(x - 4, y + 13, 7, 5, C.pir);
      block(x - 4, y + 14, 4, 2, C.starHi);
    } else {
      block(x, y + 15, 7, 1, C.ink);
    }
    // legs
    const step = Math.floor(boss.t / 10) % 2;
    block(x + 12, y + 20, 4, 4, C.shellD);
    block(x + 24 + (step ? 1 : 0), y + 20, 4, 4, C.shellD);
    // stylized banner so there is zero doubt what this is
    const flick = Math.floor(boss.t / 8) % 2 === 0;
    drawBossLabel(x + boss.w / 2, y - 17, 'LAYOFF', flick);
  }
  function drawBossLabel(cx: number, topY: number, label: string, flick: boolean, s = 2) {
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

  function drawVoidDragon() {
    const x = voidDragon.x;
    const y = voidDragon.y;
    const step = Math.floor(voidDragon.t / 8) % 2;
    block(x - 10, y + 20, 14, 5, C.pirD); // tail
    block(x + 2, y + 10, 28, 18, C.shellD);
    block(x + 4, y + 10, 24, 4, C.shell);
    block(x + 12, y + 4, 4, 8, C.pir);
    block(x + 20, y + 2, 4, 10, C.pir);
    block(x + 29, y + 12, 18, 14, C.shell);
    block(x + 34, y + 7, 7, 6, C.cream);
    block(x + 34, y + 13, 3, 3, C.starHi);
    block(x + 34, y + 13, 1, 3, C.pir);
    if (voidDragon.mouth > 0) {
      block(x + 45, y + 18, 12, 6, C.pir);
      block(x + 52, y + 19, 6, 3, C.starHi);
    } else {
      block(x + 43, y + 21, 6, 1, C.ink);
    }
    block(x + 8, y + 28, 5, 7, C.shellD);
    block(x + 24 + step, y + 28, 5, 7, C.shellD);
    const label = miniGame.voidTitle;
    const labelScale = 1;
    const labelW = label.length * 4 * labelScale - labelScale;
    const labelLeft = Math.round(x + 23 - labelW / 2) - 3;
    const labelRight = labelLeft + labelW + 6;
    if (labelLeft >= camX + 4 && labelRight <= camX + VIEW_W - 4) {
      drawBossLabel(x + 23, y - 18, label, Math.floor(voidDragon.t / 9) % 2 === 0, labelScale);
    }
  }

  function drawVoidWorld() {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#050606');
    grad.addColorStop(0.62, '#0a0b12');
    grad.addColorStop(1, '#12070a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.globalAlpha = 0.28;
    ctx.fillStyle = C.grassHi;
    for (let i = 0; i < 18; i++) {
      const x = (((i * 97 - camX * 0.36) % 1200) + 1200) % 1200;
      ctx.fillRect(Math.round(x), 14 + ((i * 19) % 84), 1, 1);
      ctx.fillRect(Math.round(x) + 24, 28 + ((i * 31) % 74), 2, 1);
    }
    ctx.globalAlpha = 1;

    for (let i = -1; i < 24; i++) {
      const x = Math.floor(camX / TILE) * TILE + i * TILE;
      block(x, VOID_GROUND, TILE, 3, C.pirD);
      block(x, VOID_GROUND + 3, TILE, 2, C.sign);
    }

    miniGame.voidSignLines.forEach((line, i) => {
      const wx = 120 + i * 220;
      const y = 58 + (i % 2) * 20;
      const w = textW(line, 1) + 8;
      block(wx - 4, y - 4, w, 13, C.sign);
      block(wx - 4, y - 4, w, 1, i === 0 ? C.subs : i === 1 ? C.mobile : C.rent);
      text(line, wx, y - 2, 1, C.starHi);
    });

    text(miniGame.voidTitle, camX + 12, 14, 2, C.rent);
    text(miniGame.voidWarning.toUpperCase(), camX + 12, 36, 1, C.starHi);
    const seconds = voidSeconds();
    const gap = Math.max(0, Math.min(1, (voidGap() - VOID_DRAGON_HIT_GAP) / 180));
    const danger = gap < 0.18;
    text(String(seconds).padStart(2, '0'), camX + VIEW_W - 38, 14, 2, danger ? C.rent : C.starHi);
    text(miniGame.voidSecondsShortLabel, camX + VIEW_W - 34, 35, 1, danger ? C.rent : C.starHi);
    block(camX + VIEW_W - 98, 52, 76, 5, C.sign);
    block(camX + VIEW_W - 96, 54, Math.max(2, Math.round(72 * gap)), 1, danger ? C.rent : C.life);

    drawVoidDragon();
    drawPlayer();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
      text(p.text, p.x, p.y, 1, p.color);
      ctx.globalAlpha = 1;
    }
    drawGameOverCurtain();
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

    if (state === 'pipe') drawPlayer();

    const t0 = Math.floor(camX / TILE) - 1;
    const t1 = Math.floor((camX + VIEW_W) / TILE) + 1;
    for (let ty = 0; ty < 11; ty++) {
      for (let tx = t0; tx <= t1; tx++) {
        if (!solidAt(tx, ty) || qmap.has(kk(tx, ty))) continue;
        // pipe tiles are drawn separately
        if (isPipeTile(tx, ty)) continue;
        const x = tx * TILE;
        const key = kk(tx, ty);
        const y = ty * TILE - (brickBumps.get(key) ? 3 : 0);
        if (ty >= GROUND_ROW) {
          drawGroundTile(x, y, ty === GROUND_ROW);
        } else {
          drawBrickTile(x, y);
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
    for (const b of brickBits) {
      ctx.globalAlpha = Math.max(0, Math.min(1, b.life / 14));
      block(b.x, b.y, 5, 5, b.color);
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
      if (e.type === 'piranha' && !pipeBillVisible(e)) continue;
      const lw = textW(e.label, 1);
      const l = Math.round(e.x + e.w / 2 - lw / 2) - 6;
      const r = l + lw + 12;
      let lvl = 0;
      while (placedTags.some((p) => p.lvl === lvl && l < p.r && r > p.l)) lvl++;
      placedTags.push({ l, r, lvl });
      drawTag(e.x + e.w / 2, e.y - 10 - lvl * 9, e.label, e.tone || 'rent');
    }

    // the boss + its banner sit above the regular nameplates (it dominates), under
    // the player (you leap over it)
    drawBoss();
    drawFireballs();

    if (state !== 'pipe') drawPlayer();

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
      text(p.text, p.x, p.y, 1, p.color);
      ctx.globalAlpha = 1;
    }
    drawFireworks();
    drawGameOverCurtain();
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
  function drawGameOverCurtain() {
    if (state !== 'dying') return;
    const start = GAME_OVER_POP_FRAMES + 18;
    const range = GAME_OVER_CARD_DELAY_FRAMES - start;
    const alpha = Math.max(0, Math.min(0.68, ((overT - start) / range) * 0.68));
    if (alpha <= 0) return;
    ctx.fillStyle = `rgba(6, 18, 10, ${alpha.toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  function drawTransition() {
    if (!transition) return;
    const p = 1 - transition.t / transition.duration;
    const pulse = Math.sin(p * Math.PI);
    const alpha = Math.max(0, Math.min(0.72, pulse * 0.72));
    ctx.fillStyle = `rgba(6, 18, 10, ${alpha.toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const labelColor =
      transition.kind === 'death'
        ? C.rent
        : transition.kind === 'pipe' || transition.kind === 'void'
          ? C.subs
          : C.starHi;
    ctx.globalAlpha = Math.max(0, Math.min(1, pulse));
    const s = transition.label.length > 9 ? 1 : 2;
    const w = textW(transition.label, s);
    text(transition.label, camX + VIEW_W / 2 - w / 2, VIEW_H / 2 - 8, s, labelColor);
    ctx.globalAlpha = 1;
  }

  // The maintainer: a dev in a hoodie (hood up → hides hair, so anyone can read
  // themselves into it), a neutral skin tone, two friendly eyes. Walks with a
  // little body-bob + alternating legs.
  function drawSquashedPlayer(x: number, y: number, s: number, hood: string) {
    const pblock = (dx: number, dy: number, w: number, h: number, color: string) =>
      block(x + dx * s, y + dy * s, w * s, h * s, color);
    pblock(1, 4, 9, 2, hood);
    pblock(2, 5, 7, 3, hood);
    pblock(3, 6, 5, 2, C.face);
    pblock(4, 6, 1, 1, C.ink);
    pblock(6, 6, 1, 1, C.ink);
    pblock(1, 8, 9, 3, hood);
    pblock(1, 8, 9, 1, C.bodyHi);
    pblock(2, 11, 7, 2, C.ink);
  }
  function drawPlayer() {
    const pose = activePlayerPose();
    if (
      state !== 'dying' &&
      pose === 'none' &&
      player.invuln > 0 &&
      Math.floor(player.invuln / 4) % 2 === 0
    ) {
      return;
    }
    if (state === 'ending' && enterT > 0) {
      ctx.globalAlpha = Math.max(0, 1 - enterT / WIN_DOOR_FADE_FRAMES);
    }
    const panic = pose === 'death';
    const squash =
      pose === 'death-squash' ||
      (pose === 'hit' && poseT > 22) ||
      (pose === 'shrink' && poseT > 20);
    const flash =
      pose === 'grow' || pose === 'shrink' || pose === 'stomp' || pose === 'death-squash';
    const wobble = pose === 'hit' || pose === 'shrink' ? (Math.floor(poseT / 3) % 2 ? 1 : -1) : 0;
    const x = player.x + wobble;
    const s = player.projectScale;
    const walking = player.onGround && Math.abs(player.vx) > 0.25;
    const frame = Math.floor(player.step) % 2;
    const boost = pose === 'grow' || pose === 'stomp' ? s : 0;
    const y = player.y - (walking && frame === 0 ? s : 0) - boost; // body lifts mid-stride
    const hood =
      flash && Math.floor(tick / 4) % 2
        ? C.starHi
        : player.power > 0
          ? Math.floor(tick / 4) % 2
            ? C.star
            : C.bodyHi
          : C.body;
    if (squash) {
      drawSquashedPlayer(x, player.y + s, s, hood);
      ctx.globalAlpha = 1;
      return;
    }
    const pblock = (dx: number, dy: number, w: number, h: number, color: string) =>
      block(x + dx * s, y + dy * s, w * s, h * s, color);
    // hood (covers the hair)
    pblock(2, 0, 7, 2, hood);
    pblock(1, 1, 9, 3, hood);
    if (panic) {
      pblock(0, 5, 2, 2, hood);
      pblock(9, 5, 2, 2, hood);
    } else {
      pblock(1, 4, 2, 3, hood);
      pblock(8, 4, 2, 3, hood);
    }
    // face (neutral tone) in the hood opening + two eyes
    pblock(3, 3, 5, 4, C.face);
    if (panic) {
      pblock(4, 4, 1, 1, C.ink);
      pblock(5, 5, 1, 1, C.ink);
      pblock(6, 4, 1, 1, C.ink);
      pblock(4, 5, 1, 1, C.ink);
      pblock(6, 5, 1, 1, C.ink);
    } else {
      pblock(4, 4, 1, 2, C.ink);
      pblock(6, 4, 1, 2, C.ink);
    }
    // hoodie body
    pblock(1, 7, 9, 4, hood);
    pblock(1, 7, 9, 1, C.bodyHi);
    pblock(4, 8, 3, 2, C.bodyHi);
    // legs (true ground y; alternate while walking, tuck in the air)
    const ly = player.y + 11 * s;
    const lblock = (dx: number, w: number) => block(x + dx * s, ly, w * s, 3 * s, C.ink);
    if (panic) {
      lblock(1, 2);
      lblock(8, 2);
    } else if (!player.onGround) {
      lblock(2, 3);
      lblock(6, 3);
    } else if (walking && frame === 0) {
      lblock(1, 3);
      lblock(6, 3);
    } else if (walking) {
      lblock(2, 3);
      lblock(7, 3);
    } else {
      lblock(2, 3);
      lblock(6, 3);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    if (state === 'void' || (deathScene === 'void' && (state === 'dying' || state === 'over'))) {
      drawVoidWorld();
    } else {
      drawWorld();
    }
    drawTransition();
  }

  function updateHud() {
    if (starsEl) starsEl.textContent = String(stars);
    if (livesEl) {
      livesEl.replaceChildren();
      if (lives > 0) {
        for (let i = 0; i < lives; i++) livesEl.appendChild(makeHeartIcon('life'));
      } else {
        livesEl.textContent = '—';
      }
    }
  }
  function makeStarIcon(label: string) {
    const star = document.createElement('span');
    star.className = 'mgame__star';
    star.setAttribute('role', 'img');
    star.setAttribute('aria-label', label);
    return star;
  }
  function makeHeartIcon(label: string) {
    const heart = document.createElement('span');
    heart.className = 'mgame__heart';
    heart.setAttribute('role', 'img');
    heart.setAttribute('aria-label', label);
    return heart;
  }
  function makeCheckIcon(label: string) {
    const check = document.createElement('span');
    check.className = 'mgame__check';
    check.setAttribute('role', 'img');
    check.setAttribute('aria-label', label);
    return check;
  }
  function showMsg(t: string, won: boolean) {
    if (!msgEl || !msgTextEl) return;
    msgTextEl.replaceChildren();
    const lines = t.split('\n');
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      if (lineIndex > 0) msgTextEl.appendChild(document.createElement('br'));
      const parts = lines[lineIndex].split(/(\[star\]|\[check\]|★)/);
      for (const part of parts) {
        if (!part) continue;
        if (part === '[star]' || part === '★') msgTextEl.appendChild(makeStarIcon('GitHub star'));
        else if (part === '[check]') msgTextEl.appendChild(makeCheckIcon('funded'));
        else msgTextEl.appendChild(document.createTextNode(part));
      }
    }
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
  const isDownKey = (k: string) => k === 'ArrowDown' || k === 's' || k === 'S';
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
      if (state === 'play' || state === 'void') setLeft(true);
      e.preventDefault();
    } else if (isRightKey(k)) {
      if (state === 'play' || state === 'void') setRight(true);
      e.preventDefault();
    } else if (isDownKey(k)) {
      if (state === 'play') setDown(true);
      e.preventDefault();
    } else if (isJumpKey(k)) {
      if (state === 'play' || state === 'void') jumpDown(jumpKeyId(k), !e.repeat);
      else if ((state === 'win' || state === 'over') && !e.repeat) restart();
      e.preventDefault();
    } else if (k === 'Escape') {
      close();
    } else if (k === 'Enter' && (state === 'win' || state === 'over') && !e.repeat) {
      restart();
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    const k = e.key;
    if (isLeftKey(k)) setLeft(false);
    else if (isRightKey(k)) setRight(false);
    else if (isDownKey(k)) setDown(false);
    else if (isJumpKey(k)) jumpUp(jumpKeyId(k));
  }

  function build() {
    const titleHtml = miniGame.title
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll(' ', '&nbsp;');
    root = document.createElement('div');
    root.className = 'mgame';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', miniGame.ariaLabel);
    root.innerHTML = `
      <div class="mgame__cab">
        <div class="mgame__bar">
          <span class="mgame__title font-pixel">${titleHtml}</span>
          <span class="mgame__hud font-pixel"><span class="mgame__star" role="img" aria-label="GitHub stars"></span><span data-mgame-stars>0</span><span class="mgame__sep">·</span><span data-mgame-lives>♥♥♥</span></span>
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
        <p class="mgame__hint font-mono">${miniGame.controlsHintHtml}</p>
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
        if (state === 'play' || state === 'void') jumpDown('touch', true);
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
      vx: Number(player.vx.toFixed(2)),
      stars,
      lives,
      state,
      deathScene,
      power: player.power,
      onGround: player.onGround,
      jumpHeld,
      downHeld,
      blockStars: blockStars.length,
      oneups: oneups.filter((u) => !u.got).length,
      projectScale: player.projectScale,
      w: player.w,
      h: player.h,
      pose: activePlayerPose(),
      poseT,
      endingT: enterT,
      overT,
      pipeT,
      activePipe: activePipe ? { px: activePipe.px, ph: activePipe.ph } : null,
      pipeX: activePipe?.pipeX ?? null,
      pipeTop: activePipe?.top ?? null,
      pipeOccluded: Boolean(activePipe && state === 'pipe' && player.y + player.h > activePipe.top),
      camX: Math.round(camX),
      voidT,
      voidSeconds: voidSeconds(),
      voidDragonX: Math.round(voidDragon.x),
      voidGap: Math.round(voidGap()),
      finaleIndex: lastGameOverFinaleIndex,
      finaleCount: miniGame.gameOverFinales.length,
      messageText: msgTextEl?.innerText ?? '',
      transition: transition ? transition.kind : 'none',
      transitionLabel: transition?.label ?? null,
      transitionT: transition?.t ?? 0,
      transitionDuration: transition?.duration ?? 0,
      messageVisible: Boolean(msgEl && !msgEl.hidden),
      dir: moveDir(),
      celebrate,
      fireworks: rockets.length + sparks.length,
      bossDead: boss ? boss.dead : 1,
      blocks: qblocks.map((q) => ({ tx: q.tx, ty: q.ty, kind: q.kind, used: q.used })),
      brickBumps: Array.from(brickBumps.keys()),
      brokenBricks: Array.from(brokenBricks.keys()),
      usedBlocks: qblocks.filter((q) => q.used).map((q) => ({ tx: q.tx, ty: q.ty, kind: q.kind })),
      particles: particles.map((p) => ({
        text: p.text,
        x: Math.round(p.x),
        y: Math.round(p.y),
      })),
      enemies: enemies
        .filter((e) => !e.dead)
        .map((e) => ({
          t: e.type,
          x: Math.round(e.x),
          y: Math.round(e.y),
          label: e.label,
          tone: e.tone,
        })),
      pipeBills: enemies
        .filter((e) => !e.dead && e.type === 'piranha')
        .map((e) => ({
          x: Math.round(e.x),
          y: Math.round(e.y),
          pipeX: Math.round(pipeBillMouthLeft(e)),
          label: e.label,
          tone: e.tone,
          emerged: Number(pipeBillEmergence(e).toFixed(2)),
          visible: pipeBillVisible(e),
          dangerous: pipeBillDangerous(e),
          blocked: pipeBillBlockedByPlayer(e),
        })),
    });
    if (import.meta.env.DEV || navigator.webdriver) {
      type DebugWindow = Window & {
        __mgameDropNewProject?: () => void;
        __mgameSpawnExpense?: () => void;
        __mgameBumpBlock?: (tx?: number, ty?: number) => void;
        __mgameWarpBoss?: () => void;
        __mgameBumpBrick?: (tx?: number, ty?: number) => void;
        __mgameEnterPipe?: () => void;
        __mgameAdvancePipe?: (frames?: number) => void;
        __mgameWarpNearPipeBill?: () => void;
        __mgameStompPipeBill?: () => void;
        __mgameAdvancePlay?: (frames?: number) => void;
        __mgameHoldVoidDirection?: (dir?: -1 | 0 | 1) => void;
        __mgameAdvanceVoid?: (frames?: number) => void;
        __mgameTriggerWin?: () => void;
        __mgameAdvanceEnding?: (frames?: number) => void;
        __mgameTriggerGameOver?: () => void;
        __mgameForceFinale?: (index?: number | null) => void;
        __mgameAdvanceGameOver?: (frames?: number) => void;
      };
      const debugWindow = window as DebugWindow;
      const freezeDebugLoop = () => {
        stopLoop();
        acc = 0;
        last = performance.now();
      };
      debugWindow.__mgameDropNewProject = () => {
        oneups.push({ x: player.x, y: player.y, vx: 0, vy: 0, got: false });
      };
      debugWindow.__mgameSpawnExpense = () => {
        hurt();
      };
      debugWindow.__mgameBumpBlock = (tx = 32, ty = 5) => {
        const q = qmap.get(kk(tx, ty));
        if (q && !q.used) bumpBlock(q);
        render();
      };
      debugWindow.__mgameWarpBoss = () => {
        player.x = BOSS_X - 72;
        player.y = GROUND_TOP - player.h;
        player.vx = 0;
        player.vy = 0;
        player.onGround = true;
        fireballs = [];
        if (boss) {
          boss.x = BOSS_X;
          boss.y = GROUND_TOP - 24;
          boss.dir = -1;
          boss.mouth = 0;
          boss.dead = 0;
        }
        camX = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x + player.w / 2 - VIEW_W / 2));
      };
      debugWindow.__mgameBumpBrick = (tx = 13, ty = 5) => {
        bumpBrick(tx, ty);
      };
      debugWindow.__mgameEnterPipe = () => {
        freezeDebugLoop();
        const [px, ph] = PIPES[0];
        const pipeX = px * TILE;
        const top = (GROUND_ROW - ph) * TILE;
        player.x = pipeX + TILE - player.w / 2;
        player.y = top - player.h;
        player.vx = 0;
        player.vy = 0;
        player.onGround = true;
        camX = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x + player.w / 2 - VIEW_W / 2));
        startPipeDescent();
      };
      debugWindow.__mgameAdvancePipe = (frames = 64) => {
        freezeDebugLoop();
        if (state !== 'pipe') debugWindow.__mgameEnterPipe?.();
        for (let i = 0; i < frames && state === 'pipe'; i++) update();
        render();
      };
      debugWindow.__mgameWarpNearPipeBill = () => {
        freezeDebugLoop();
        const [px, ph] = PIPES[0];
        const pipeX = px * TILE;
        player.x = pipeX - player.w + 2;
        player.y = GROUND_TOP - player.h;
        player.vx = 0;
        player.vy = 0;
        player.onGround = true;
        player.face = 1;
        const top = (GROUND_ROW - ph) * TILE;
        const bill = enemies.find((e) => e.type === 'piranha' && e.pipeX === pipeX);
        if (bill) {
          bill.t = 20;
          bill.y = top - 14;
        }
        camX = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x + player.w / 2 - VIEW_W / 2));
        render();
      };
      debugWindow.__mgameStompPipeBill = () => {
        freezeDebugLoop();
        const bill = enemies.find((e) => e.type === 'piranha' && !e.dead);
        if (!bill) return;
        state = 'play';
        bill.t = 20;
        bill.y = bill.baseY - Math.min(14, bill.h);
        player.x = bill.x + bill.w / 2 - player.w / 2;
        player.y = bill.y - player.h + 2;
        player.vx = 0;
        player.vy = 2;
        player.onGround = false;
        player.invuln = 0;
        player.power = 0;
        camX = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x + player.w / 2 - VIEW_W / 2));
        update();
        render();
      };
      debugWindow.__mgameAdvancePlay = (frames = 1) => {
        freezeDebugLoop();
        for (let i = 0; i < frames && state === 'play'; i++) update();
        render();
      };
      debugWindow.__mgameHoldVoidDirection = (dir = 0) => {
        setLeft(dir < 0);
        setRight(dir > 0);
      };
      debugWindow.__mgameAdvanceVoid = (frames = VOID_TEST_ADVANCE_FRAMES) => {
        freezeDebugLoop();
        if (state !== 'void') startVoidChase();
        for (let i = 0; i < frames && state === 'void'; i++) update();
        render();
      };
      debugWindow.__mgameTriggerWin = () => {
        freezeDebugLoop();
        startEnding();
        parkPlayerAtCastleDoor();
      };
      debugWindow.__mgameAdvanceEnding = (frames = WIN_CARD_DELAY_FRAMES) => {
        freezeDebugLoop();
        if (state !== 'ending') {
          startEnding();
          parkPlayerAtCastleDoor();
        }
        for (let i = 0; i < frames && state === 'ending'; i++) updateEnding();
        render();
      };
      debugWindow.__mgameTriggerGameOver = () => {
        freezeDebugLoop();
        lives = 0;
        updateHud();
        gameOver();
      };
      debugWindow.__mgameForceFinale = (index = null) => {
        forcedGameOverFinaleIndex =
          typeof index === 'number' && Number.isFinite(index)
            ? normalizeGameOverFinaleIndex(index)
            : null;
      };
      debugWindow.__mgameAdvanceGameOver = (frames = GAME_OVER_CARD_DELAY_FRAMES) => {
        freezeDebugLoop();
        for (let i = 0; i < frames && state === 'dying'; i++) updateGameOver();
        render();
      };
    }
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
    sound('restart');
    reset();
    startTransition('restart', 'READY', TRANSITION_SHORT);
    startLoop();
  }
  function launch() {
    try {
      if (!root) build();
      if (!root) return;
      root.dataset.open = 'true';
      document.documentElement.classList.add('mgame-open');
      reset();
      startTransition('launch', 'READY', TRANSITION_SHORT);
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
