// ============================================================
// Constants
// ============================================================
const TILE_SIZE = 16;
const TILE_SCALE = 3;             // tiles rendered at 48px (16×3)
const TILE_DRAW = TILE_SIZE * TILE_SCALE; // 48
const GRAVITY = 1800;
const PLAYER_SCALE = 1.0;         // 128px sprite → ~2.7 tiles tall
const GHOST_ENEMY_SCALE = 1.0;
const WORLD_ENEMY_SCALE = 2.0;    // 48×2 = 96px
const GEM_SCALE = TILE_SCALE;     // 16×3 = 48px
const TRAP_SCALE = 2.0;           // 48×2 = 96px
const BOX_SCALE = TILE_SCALE;     // 32×3 = 96px
const PLAYER_SPEED = 320;
const RUN_SPEED = 520;
const JUMP_VELOCITY = -720;
const FRAME_SIZE = 128;
const COMBO_WINDOW = 500;
const DOUBLE_TAP_TIME = 250;

// World generation
const CHUNK_WIDTH_TILES = 30;
const CHUNK_WIDTH_PX = CHUNK_WIDTH_TILES * TILE_DRAW;
const GROUND_LEVEL = 11;          // row index (0-based) out of 15
const WORLD_HEIGHT_TILES = 15;
const WORLD_HEIGHT_PX = WORLD_HEIGHT_TILES * TILE_DRAW; // 720
const GENERATE_AHEAD = 2;
const DESPAWN_BEHIND = 2;

// Combat constants
const PLAYER_MAX_HP = 100;
const ENEMY_MAX_HP = 40;
const PLAYER_ATTACK_RANGE = 130;
const ATTACK_DAMAGE = [15, 20, 35];
const ENEMY_AGGRO_RANGE = 320;
const ENEMY_DISENGAGE_RANGE = 520;
const ENEMY_ATTACK_RANGE = 90;
const ENEMY_ATTACK_DAMAGE = 12;
const PLAYER_IFRAMES_MS = 600;
const ENEMY_IFRAMES_MS = 300;
const ENEMY_ATTACK_COOLDOWN = 1800;
const ENEMY_SPEED = 100;
const ENEMY_RUN_SPEED = 200;

// Arcade mode – fixed opponent order (player's own character is removed at runtime)
const ARCADE_ORDER = [
  'Fighter', 'Kunoichi', 'Ninja_Peasant', 'Gotoku',
  'Shinobi', 'Yurei', 'Onre', 'Wanderer_Magician', 'Yokai',
];

// Duel constants
const DUEL_MAX_LIVES = 3;
const DUEL_ACTIONS = { RECHARGER: 0, PROTEGER: 1, FRAPPER: 2, FRAPPER2: 3, FRAPPER3: 4, FRAPPER4: 5, PROJECTILE: 6, PROJECTILE2: 7 };
const DUEL_ACTION_LABELS = ['Recharger', 'Protéger', 'Frapper', 'Frapper x2', 'Frapper x3', 'Frapper x4', 'Projectile', 'Projectile x2'];
const DUEL_PLAYER_SCALE = 2.5;
const DUEL_HEART_SIZE = 28;
const DUEL_RESOLVE_DELAY = 600;
const DUEL_NEXT_TURN_DELAY = 1800;

// Audio settings (shared across scenes)
const AUDIO_SETTINGS = { musicVolume: 0.5, sfxVolume: 1.0 };

// Display settings
const DISPLAY_SETTINGS = { showHints: true };

// Graphics settings
const GRAPHICS_SETTINGS = {
  smoothing:   false,  // true = LINEAR (antialiased), false = NEAREST (pixel art)
  vignette:    0.4,    // 0 = off, 1 = max
  saturation:  0.0,    // -1 = greyscale, 0 = normal, 1 = very saturated
  scanlines:   false,  // CRT scanlines overlay
};

// Cheat code settings
const CHEAT_SETTINGS = { ghostsUnlocked: false, magikUnlocked: false, villageUnlocked: false, yokaiUnlocked: false, finalFight: false };

// Trait descriptions for UI – short name + detailed explanation
const TRAIT_LABELS = {
  extra_life: {
    short: 'Endurance',
    desc: 'Commence avec 4 vies au lieu de 3.',
  },
  attack_x4: {
    short: 'Lame Aiguisée',
    desc: 'Chaque frappe inflige +1 dégât bonus : x1 mana = 2 dégâts, x2 = 3 (KO), x3 = 4 dégâts.',
  },
  counter: {
    short: 'Riposte',
    desc: 'Lors d\'un duel frappe vs frappe, réduit de 1 les dégâts reçus.',
  },
  jump_dodge: {
    short: 'Esquive',
    desc: 'Si attaqué pendant une recharge, esquive et réduit les dégâts de 1 (mais ne recharge pas).',
  },
  flight: {
    short: 'Contre-attaque',
    desc: 'Si protège une attaque et possède ≥1 mana, consomme 1 mana et inflige 1 dégât.',
  },
  double_charge: {
    short: 'Double Recharge',
    desc: 'Chaque recharge donne 2 mana au lieu de 1.',
  },
  mimicry: {
    short: 'Mimétisme',
    desc: 'Si Kunoichi fait la même action que l\'adversaire (recharge, garde ou attaque), elle gagne +1 mana bonus. Limité à Frapper x2.',
  },
  disguise: {
    short: 'Déguisement',
    desc: 'Garde vs Garde = +1 vie (max 3). Garde vs Recharge adverse = attaque surprise (-1 vie, coûte 1 mana). Limité à Frapper x2.',
  },
  magic_shield: {
    short: 'Garde Arcanique',
    desc: 'Protéger si attaqué : +1 mana + contre-attaque magique (-1 vie attaquant, coûte 1 mana). Projectile via touche 4/R (J1) ou 0 (J2). Max Frapper x2.',
  },
  life_restore: {
    short: 'Âme Vengeresse',
    desc: 'Commence avec 1 mana. Recharger 4 fois de suite (dépense 4 mana) restaure 1 vie. Kitsune : capacité inactive.',
  },
};

// Persist settings to localStorage
function saveSettings() {
  try {
    localStorage.setItem('shinobi_settings', JSON.stringify({
      musicVolume:  AUDIO_SETTINGS.musicVolume,
      sfxVolume:    AUDIO_SETTINGS.sfxVolume,
      showHints:    DISPLAY_SETTINGS.showHints,
      smoothing:    GRAPHICS_SETTINGS.smoothing,
      vignette:     GRAPHICS_SETTINGS.vignette,
      saturation:   GRAPHICS_SETTINGS.saturation,
      scanlines:    GRAPHICS_SETTINGS.scanlines,
    }));
  } catch (e) {}
}
function loadSettings() {
  try {
    const raw = localStorage.getItem('shinobi_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.musicVolume  !== undefined) AUDIO_SETTINGS.musicVolume      = s.musicVolume;
      if (s.sfxVolume    !== undefined) AUDIO_SETTINGS.sfxVolume        = s.sfxVolume;
      if (s.showHints    !== undefined) DISPLAY_SETTINGS.showHints      = s.showHints;
      if (s.smoothing    !== undefined) GRAPHICS_SETTINGS.smoothing     = s.smoothing;
      if (s.vignette     !== undefined) GRAPHICS_SETTINGS.vignette      = s.vignette;
      if (s.saturation   !== undefined) GRAPHICS_SETTINGS.saturation    = s.saturation;
      if (s.scanlines    !== undefined) GRAPHICS_SETTINGS.scanlines     = s.scanlines;
    }
  } catch (e) {}
}

// Apply graphics settings to a scene's camera
function applyGraphicsSettings(scene) {
  const cam = scene.cameras.main;

  // Remove any previous postFX to avoid stacking on re-entry
  if (cam.postFX) cam.postFX.clear();
  cam.resetPostPipeline();

  // Texture smoothing (LINEAR vs NEAREST) on all loaded textures
  const filterMode = GRAPHICS_SETTINGS.smoothing
    ? Phaser.Textures.FilterMode.LINEAR
    : Phaser.Textures.FilterMode.NEAREST;
  scene.textures.list && Object.values(scene.textures.list).forEach(tex => {
    if (tex && tex.setFilter) tex.setFilter(filterMode);
  });

  // Vignette
  if (GRAPHICS_SETTINGS.vignette > 0) {
    cam.postFX.addVignette(0.5, 0.5, 0.8, GRAPHICS_SETTINGS.vignette);
  }

  // Saturation via ColorMatrix
  if (GRAPHICS_SETTINGS.saturation !== 0) {
    const cm = cam.postFX.addColorMatrix();
    // saturate(0) = normal, positive = boost, negative = desaturate
    // Phaser's saturate() takes a multiplier offset from 0: 0=normal
    cm.saturate(GRAPHICS_SETTINGS.saturation, false);
  }

  // Scanlines overlay — lightweight custom graphics on top
  if (GRAPHICS_SETTINGS.scanlines) {
    const w = scene.cameras.main.width;
    const h = scene.cameras.main.height;
    if (!scene._scanlinesGfx) {
      scene._scanlinesGfx = scene.add.graphics().setDepth(9999).setScrollFactor(0);
    }
    const g = scene._scanlinesGfx;
    g.clear();
    g.lineStyle(1, 0x000000, 0.18);
    for (let y = 0; y < h; y += 4) {
      g.lineBetween(0, y, w, y);
    }
  } else if (scene._scanlinesGfx) {
    scene._scanlinesGfx.clear();
  }
}

// Asset paths
const IMG_BASE = 'img/craftpix-net-453698-free-shinobi-sprites-pixel-art/';
const NINJA_IMG_BASE = 'img/free-ninja-sprite-sheets-pixel-art/';
const WIZARD_IMG_BASE = 'img/wizard-sprite-sheets-pixel-art/';
const ENEMY_IMG_BASE = 'img/craftpix-net-872297-free-ghost-pixel-art-sprite-sheets/';
const WORLD_BASE = 'img/world/craftpix-net-396765-free-simple-platformer-game-kit-pixel-art/';
const TILE_BASE = WORLD_BASE + '2 Locations/Tiles/';
const BG_BASE = WORLD_BASE + '2 Locations/Backgrounds/';
const GEM_BASE = WORLD_BASE + '3 Objects/Gems/';
const BOX_BASE = WORLD_BASE + '3 Objects/Boxes/';
const TRAP_BASE = WORLD_BASE + '6 Traps/';
const WENEMY_BASE = WORLD_BASE + '4 Enemies/';

// Tiles to load (subset of useful ones)
const TILES_TO_LOAD = [
  'Tile_01', 'Tile_02', 'Tile_03', 'Tile_04', 'Tile_05',
  'Tile_06', 'Tile_07', 'Tile_08', 'Tile_09', 'Tile_10',
  'Tile_11', 'Tile_12', 'Tile_13', 'Tile_14', 'Tile_15',
  'Tile_16', 'Tile_17', 'Tile_18', 'Tile_19', 'Tile_20',
  'Tile_21', 'Tile_22', 'Tile_23', 'Tile_24', 'Tile_25',
];

// World enemy definitions (48x48 frames)
const WORLD_ENEMIES = {
  Enemy1: {
    folder: '1', frameW: 48, frameH: 48,
    sheets: {
      idle: { file: 'Idle.png', frames: 11 },   // 528/48
      run:  { file: 'Run.png',  frames: 12 },    // 576/48
      hit:  { file: 'Hit.png',  frames: 5 },     // 240/48
    }
  },
  Enemy2: {
    folder: '2', frameW: 48, frameH: 48,
    sheets: {
      idle: { file: 'Idle.png', frames: 11 },
      run:  { file: 'Run.png',  frames: 12 },
      hit:  { file: 'Hit.png',  frames: 5 },
    }
  },
  Enemy3: {
    folder: '3', frameW: 48, frameH: 48,
    sheets: {
      idle:  { file: 'Idle.png',  frames: 11 },
      walk:  { file: 'Walk.png',  frames: 12 },
      hit:   { file: 'Hit.png',   frames: 5 },
    }
  },
  Enemy4: {
    folder: '4', frameW: 48, frameH: 48,
    sheets: {
      idle:   { file: 'Idle.png',   frames: 11 },
      walk:   { file: 'Walk.png',   frames: 12 },
      hit:    { file: 'Hit.png',    frames: 5 },
      attack: { file: 'Attack.png', frames: 7 },
    }
  },
  Enemy5: {
    folder: '5', frameW: 48, frameH: 48,
    sheets: {
      idle:   { file: 'Idle.png',   frames: 6 },  // 288/48
      fly:    { file: 'Fly.png',    frames: 6 },
      hit:    { file: 'Hit.png',    frames: 5 },
      attack: { file: 'Attack.png', frames: 8 },   // 384/48
    }
  },
};


// Character definitions — instances des classes définies dans CharacterDef.js
const CHARACTERS = {
  Fighter:  new FighterCharacter(),
  Samurai:  new SamuraiCharacter(),
  Shinobi:  new ShinobiCharacter(),
};

// Hidden characters – unlocked via cheat codes
const HIDDEN_CHARACTERS = {
  Kunoichi:          new KunoichiCharacter(),
  Ninja_Peasant:     new NinjaPeasantCharacter(),
  Wanderer_Magician: new WandererMagicianCharacter(),
  Yokai:             new YokaiCharacter(),
};

// Ghost characters (duel-compatible, AI opponents only)
const GHOST_CHARACTERS = {
  Gotoku: new GotokuCharacter(),
  Onre:   new OnreCharacter(),
  Yurei:  new YureiCharacter(),
};
