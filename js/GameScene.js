// ============================================================
// Game Scene — 2D Platformer
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.charKey = data.character || 'Shinobi';
    this.charDef = CHARACTERS[this.charKey] || HIDDEN_CHARACTERS[this.charKey];
  }

  preload() {
    // Player sheets
    const base = IMG_BASE + this.charDef.folder + '/';
    const sheets = this.charDef.sheets;
    Object.keys(sheets).forEach(key => {
      this.load.spritesheet(key, base + sheets[key].file, {
        frameWidth: FRAME_SIZE,
        frameHeight: FRAME_SIZE
      });
    });

    // Ghost enemy sheets
    Object.values(ENEMIES).forEach(enemy => {
      const eBase = ENEMY_IMG_BASE + enemy.folder + '/';
      Object.keys(enemy.sheets).forEach(key => {
        const sheetKey = 'enemy_' + enemy.folder + '_' + key;
        this.load.spritesheet(sheetKey, eBase + enemy.sheets[key].file, {
          frameWidth: FRAME_SIZE,
          frameHeight: FRAME_SIZE
        });
      });
    });

    // World tiles (individual 16x16 images)
    TILES_TO_LOAD.forEach(t => {
      this.load.image(t, TILE_BASE + t + '.png');
    });

    // Backgrounds (64x64 tiling)
    for (let i = 1; i <= 6; i++) {
      this.load.image('bg_' + i, BG_BASE + i + '.png');
    }

    // Gems (spritesheets: 112x16 = 7 frames of 16x16)
    for (let i = 1; i <= 6; i++) {
      this.load.spritesheet('gem_' + i, GEM_BASE + i + '.png', {
        frameWidth: 16, frameHeight: 16
      });
    }

    // Boxes (32x32)
    for (let i = 1; i <= 3; i++) {
      this.load.image('box_' + i, BOX_BASE + i + '_Idle.png');
      this.load.spritesheet('box_' + i + '_hit', BOX_BASE + i + '_Hit.png', {
        frameWidth: 32, frameHeight: 32
      });
      this.load.image('box_' + i + '_break', BOX_BASE + i + '_Break.png');
    }

    // Traps (spritesheets: 336x48 = 7 frames of 48x48)
    for (let i = 1; i <= 6; i++) {
      this.load.spritesheet('trap_' + i, TRAP_BASE + i + '.png', {
        frameWidth: 48, frameHeight: 48
      });
    }

    // World enemies
    Object.entries(WORLD_ENEMIES).forEach(([key, def]) => {
      const eBase = WENEMY_BASE + def.folder + '/';
      Object.entries(def.sheets).forEach(([anim, info]) => {
        this.load.spritesheet('wenemy_' + key + '_' + anim, eBase + info.file, {
          frameWidth: def.frameW, frameHeight: def.frameH
        });
      });
    });
  }

  create() {
    applyGraphicsSettings(this);
    // Physics groups
    this.platformGroup = this.physics.add.staticGroup();
    this.gemGroup = this.physics.add.staticGroup();
    this.trapGroup = this.physics.add.staticGroup();
    // boxes are individual physics sprites, no group needed

    // Parallax background
    this.bgSprite = this.add.tileSprite(0, 0, 1280, 720, 'bg_4');
    this.bgSprite.setOrigin(0, 0);
    this.bgSprite.setScrollFactor(0);
    this.bgSprite.setDepth(-10);
    this.bgSprite.setTileScale(TILE_SCALE, TILE_SCALE);

    // Animations
    this.createAnimations();
    this.createEnemyAnimations();
    this.createWorldEnemyAnimations();
    this.createGemAnimations();
    this.createTrapAnimations();
    this.createBoxAnimations();

    // Player
    this.createPlayer();

    // Camera
    this.setupCamera();

    // Keys
    this.setupKeys();

    // State
    this.facingRight = true;
    this.isMoving = false;

    // Attack combo state
    this.isAttacking = false;
    this.comboStep = -1;
    this.comboQueued = false;
    this.attackHitEnemies = new Set();

    // Run (double-tap)
    this.isRunning = false;
    this.lastTapDir = null;
    this.lastTapTime = 0;

    // Shield state
    this.isShielding = false;

    // Player combat state
    this.playerHP = PLAYER_MAX_HP;
    this.playerDead = false;
    this.playerLastHitTime = 0;
    this.isHurt = false;

    // Score / distance
    this.score = 0;
    this.maxDistance = 0;

    // Enemies
    this.activeEnemies = [];

    // Destructible boxes
    this.activeBoxes = [];

    // Chunks
    this.chunks = new Map();
    this.lastChunkIndex = -1;

    // Generate initial chunks
    this.generateChunk(0);
    this.generateChunk(1);
    this.generateChunk(2);

    // Colliders
    this.physics.add.collider(this.player, this.platformGroup);
    this.physics.add.overlap(this.player, this.gemGroup, this.collectGem, null, this);
    this.physics.add.overlap(this.player, this.trapGroup, this.hitTrap, null, this);

    // Trap cooldown tracking
    this.lastTrapHitTime = 0;

    // HUD
    this.createHUD();
  }

  // ============================================================
  // Animations
  // ============================================================
  createAnimations() {
    const s = this.charDef.sheets;

    this.anims.create({
      key: 'anim_idle',
      frames: this.anims.generateFrameNumbers('idle', { start: 0, end: s.idle.frames - 1 }),
      frameRate: 8, repeat: -1
    });
    this.anims.create({
      key: 'anim_walk',
      frames: this.anims.generateFrameNumbers('walk', { start: 0, end: s.walk.frames - 1 }),
      frameRate: 10, repeat: -1
    });
    this.anims.create({
      key: 'anim_run',
      frames: this.anims.generateFrameNumbers('run', { start: 0, end: s.run.frames - 1 }),
      frameRate: 12, repeat: -1
    });
    this.anims.create({
      key: 'anim_jump',
      frames: this.anims.generateFrameNumbers('jump', { start: 0, end: s.jump.frames - 1 }),
      frameRate: 18, repeat: 0
    });
    this.anims.create({
      key: 'anim_attack1',
      frames: this.anims.generateFrameNumbers('attack1', { start: 0, end: s.attack1.frames - 1 }),
      frameRate: 12, repeat: 0
    });
    this.anims.create({
      key: 'anim_attack2',
      frames: this.anims.generateFrameNumbers('attack2', { start: 0, end: s.attack2.frames - 1 }),
      frameRate: 10, repeat: 0
    });
    this.anims.create({
      key: 'anim_attack3',
      frames: this.anims.generateFrameNumbers('attack3', { start: 0, end: s.attack3.frames - 1 }),
      frameRate: 10, repeat: 0
    });
    this.anims.create({
      key: 'anim_dead',
      frames: this.anims.generateFrameNumbers('dead', { start: 0, end: s.dead.frames - 1 }),
      frameRate: 6, repeat: 0
    });
    this.anims.create({
      key: 'anim_hurt',
      frames: this.anims.generateFrameNumbers('hurt', { start: 0, end: s.hurt.frames - 1 }),
      frameRate: 6, repeat: 0
    });
    this.anims.create({
      key: 'anim_shield',
      frames: this.anims.generateFrameNumbers('shield', { start: 0, end: s.shield.frames - 1 }),
      frameRate: 8, repeat: -1
    });
  }

  createEnemyAnimations() {
    Object.values(ENEMIES).forEach(enemy => {
      const prefix = 'enemy_' + enemy.folder;
      const s = enemy.sheets;

      this.anims.create({
        key: prefix + '_idle',
        frames: this.anims.generateFrameNumbers(prefix + '_idle', { start: 0, end: s.idle.frames - 1 }),
        frameRate: 6, repeat: -1
      });
      this.anims.create({
        key: prefix + '_walk',
        frames: this.anims.generateFrameNumbers(prefix + '_walk', { start: 0, end: s.walk.frames - 1 }),
        frameRate: 8, repeat: -1
      });
      this.anims.create({
        key: prefix + '_run',
        frames: this.anims.generateFrameNumbers(prefix + '_run', { start: 0, end: s.run.frames - 1 }),
        frameRate: 10, repeat: -1
      });
      this.anims.create({
        key: prefix + '_scream',
        frames: this.anims.generateFrameNumbers(prefix + '_scream', { start: 0, end: s.scream.frames - 1 }),
        frameRate: 6, repeat: 0
      });
      this.anims.create({
        key: prefix + '_attack',
        frames: this.anims.generateFrameNumbers(prefix + '_attack1', { start: 0, end: s.attack1.frames - 1 }),
        frameRate: 8, repeat: 0
      });
      this.anims.create({
        key: prefix + '_hurt',
        frames: this.anims.generateFrameNumbers(prefix + '_hurt', { start: 0, end: s.hurt.frames - 1 }),
        frameRate: 6, repeat: 0
      });
      this.anims.create({
        key: prefix + '_dead',
        frames: this.anims.generateFrameNumbers(prefix + '_dead', { start: 0, end: s.dead.frames - 1 }),
        frameRate: 6, repeat: 0
      });
    });
  }

  createWorldEnemyAnimations() {
    Object.entries(WORLD_ENEMIES).forEach(([key, def]) => {
      Object.entries(def.sheets).forEach(([anim, info]) => {
        const animKey = 'wenemy_' + key + '_' + anim;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(animKey, { start: 0, end: info.frames - 1 }),
            frameRate: 8, repeat: -1
          });
        }
      });
    });
  }

  createGemAnimations() {
    for (let i = 1; i <= 6; i++) {
      const key = 'gem_anim_' + i;
      if (!this.anims.exists(key)) {
        this.anims.create({
          key: key,
          frames: this.anims.generateFrameNumbers('gem_' + i, { start: 0, end: 6 }),
          frameRate: 8, repeat: -1
        });
      }
    }
  }

  createTrapAnimations() {
    for (let i = 1; i <= 6; i++) {
      const key = 'trap_anim_' + i;
      if (!this.anims.exists(key)) {
        this.anims.create({
          key: key,
          frames: this.anims.generateFrameNumbers('trap_' + i, { start: 0, end: 6 }),
          frameRate: 8, repeat: -1
        });
      }
    }
  }

  createBoxAnimations() {
    for (let i = 1; i <= 3; i++) {
      const hitKey = 'box_hit_anim_' + i;
      if (!this.anims.exists(hitKey)) {
        this.anims.create({
          key: hitKey,
          frames: this.anims.generateFrameNumbers('box_' + i + '_hit', { start: 0, end: 2 }),
          frameRate: 10, repeat: 0
        });
      }
    }
  }

  // ============================================================
  // Player
  // ============================================================
  createPlayer() {
    const startX = 200;
    const startY = GROUND_LEVEL * TILE_DRAW - 80;

    this.player = this.physics.add.sprite(startX, startY, 'idle', 0);
    this.player.setScale(PLAYER_SCALE);
    this.player.setOrigin(0.5, 0.75);
    this.player.setDepth(10);
    this.player.play('anim_idle');

    // Body size adjusted for scale 1.0 (128px sprite)
    this.player.body.setSize(50, 90);
    this.player.body.setOffset(39, 38);
    this.player.setCollideWorldBounds(false);

    this.player.on('animationcomplete', (anim) => {
      if (anim.key === 'anim_attack1' || anim.key === 'anim_attack2' || anim.key === 'anim_attack3') {
        this.onAttackComplete();
      }
    });
  }

  // ============================================================
  // Camera
  // ============================================================
  setupCamera() {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1a1a2e');
    cam.startFollow(this.player, false, 0.1, 0.1);
    cam.setFollowOffset(-130, 80);
    cam.setBounds(0, 0, Number.MAX_SAFE_INTEGER, WORLD_HEIGHT_PX);
  }

  // ============================================================
  // Keys
  // ============================================================
  setupKeys() {
    this.keys = {
      left: [
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT)
      ],
      right: [
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT)
      ]
    };
    this.jumpKeys = [
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    ];
    this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.shieldKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ALT);
  }

  isDown(keyArray) { return keyArray.some(key => key.isDown); }
  justDown(keyArray) { return keyArray.some(key => Phaser.Input.Keyboard.JustDown(key)); }

  checkDoubleTap(dir, time) {
    if (this.lastTapDir === dir && (time - this.lastTapTime) < DOUBLE_TAP_TIME) {
      this.isRunning = true;
    }
    this.lastTapDir = dir;
    this.lastTapTime = time;
  }

  // ============================================================
  // Attack / Combo
  // ============================================================
  startAttack(step) {
    this.isAttacking = true;
    this.comboStep = step;
    this.comboQueued = false;
    this.isMoving = false;
    this.attackHitEnemies.clear();
    this.player.play('anim_attack' + (step + 1));
    // Stop horizontal movement during attack
    this.player.setVelocityX(0);
  }

  onAttackComplete() {
    if (this.comboQueued && this.comboStep < 2) {
      this.startAttack(this.comboStep + 1);
    } else {
      this.comboWindowTimer = this.time.delayedCall(COMBO_WINDOW, () => {
        if (!this.comboQueued) {
          this.endCombo();
        }
      });
    }
  }

  endCombo() {
    this.isAttacking = false;
    this.comboStep = -1;
    this.comboQueued = false;
    this.attackHitEnemies.clear();
    if (!this.playerDead) this.player.play('anim_idle');
  }

  // ============================================================
  // Chunk Generation
  // ============================================================
  generateChunk(chunkIndex) {
    if (this.chunks.has(chunkIndex)) return;

    const chunkData = {
      index: chunkIndex,
      sprites: [],
      enemies: [],
    };

    const startX = chunkIndex * CHUNK_WIDTH_PX;

    if (chunkIndex === 0) {
      // Chunk 0: flat safe ground
      this.buildFlatGround(startX, 0, CHUNK_WIDTH_TILES, chunkData);
    } else {
      // Procedural chunk
      this.buildProceduralChunk(startX, chunkIndex, chunkData);
    }

    // Populate enemies (skip chunk 0 first few tiles)
    if (chunkIndex > 0) {
      this.populateChunkEnemies(startX, chunkIndex, chunkData);
    }

    this.chunks.set(chunkIndex, chunkData);
  }

  buildFlatGround(startX, startCol, widthTiles, chunkData) {
    for (let col = 0; col < widthTiles; col++) {
      const x = startX + col * TILE_DRAW + TILE_DRAW / 2;
      // Grass top
      this.placeTile(x, GROUND_LEVEL * TILE_DRAW + TILE_DRAW / 2, 'Tile_02', chunkData);
      // Dirt fill below
      for (let row = GROUND_LEVEL + 1; row < WORLD_HEIGHT_TILES; row++) {
        this.placeTile(x, row * TILE_DRAW + TILE_DRAW / 2, 'Tile_05', chunkData);
      }
    }
  }

  buildProceduralChunk(startX, chunkIndex, chunkData) {
    // Use seeded random based on chunk index for consistency
    const rand = this.seededRandom(chunkIndex * 7919);

    let col = 0;
    while (col < CHUNK_WIDTH_TILES) {
      const roll = rand();
      const remaining = CHUNK_WIDTH_TILES - col;

      if (remaining < 3) {
        // Just fill remaining with ground
        this.buildSegmentGround(startX, col, remaining, GROUND_LEVEL, chunkData, rand);
        col += remaining;
      } else if (roll < 0.15) {
        // Gap (15%)
        const gapWidth = Math.min(Phaser.Math.Between(2, 4), remaining);
        // Leave gap (no tiles)
        col += gapWidth;
      } else if (roll < 0.35) {
        // Elevated platform + ground below (20%)
        const segWidth = Math.min(Phaser.Math.Between(4, 8), remaining);
        const elevLevel = GROUND_LEVEL - Phaser.Math.Between(2, 4);
        // Ground below
        this.buildSegmentGround(startX, col, segWidth, GROUND_LEVEL, chunkData, rand);
        // Elevated platform
        for (let c = 0; c < segWidth; c++) {
          const x = startX + (col + c) * TILE_DRAW + TILE_DRAW / 2;
          const tileKey = (c === 0) ? 'Tile_01' : (c === segWidth - 1) ? 'Tile_03' : 'Tile_02';
          this.placeTile(x, elevLevel * TILE_DRAW + TILE_DRAW / 2, tileKey, chunkData);
        }
        // Place gems above elevated platform
        if (rand() < 0.6) {
          this.placeGemCluster(startX + (col + Math.floor(segWidth / 2)) * TILE_DRAW, (elevLevel - 2) * TILE_DRAW, chunkData, rand);
        }
        col += segWidth;
      } else {
        // Normal ground (65%)
        const segWidth = Math.min(Phaser.Math.Between(5, 12), remaining);
        this.buildSegmentGround(startX, col, segWidth, GROUND_LEVEL, chunkData, rand);

        // Maybe place collectibles
        if (rand() < 0.4) {
          const gemX = startX + (col + Math.floor(segWidth / 2)) * TILE_DRAW;
          this.placeGemCluster(gemX, (GROUND_LEVEL - 2) * TILE_DRAW, chunkData, rand);
        }

        // Maybe place trap (30%)
        if (rand() < 0.3 && segWidth > 3) {
          const trapCol = col + Phaser.Math.Between(1, segWidth - 2);
          const trapX = startX + trapCol * TILE_DRAW + TILE_DRAW / 2;
          const trapY = GROUND_LEVEL * TILE_DRAW - TILE_DRAW; // on top of ground
          this.placeTrap(trapX, trapY, chunkData, rand);
        }

        // Maybe place box (40%)
        if (rand() < 0.4 && segWidth > 2) {
          const boxCol = col + Phaser.Math.Between(1, segWidth - 2);
          const boxX = startX + boxCol * TILE_DRAW + TILE_DRAW / 2;
          const boxY = GROUND_LEVEL * TILE_DRAW - TILE_DRAW / 2;
          this.placeBox(boxX, boxY, chunkData);
        }

        col += segWidth;
      }
    }
  }

  buildSegmentGround(startX, colStart, width, groundRow, chunkData, rand) {
    for (let c = 0; c < width; c++) {
      const x = startX + (colStart + c) * TILE_DRAW + TILE_DRAW / 2;
      // Left edge, right edge, or middle
      let tileKey = 'Tile_02'; // grass top
      if (c === 0 && rand() < 0.3) tileKey = 'Tile_01'; // left edge variant
      if (c === width - 1 && rand() < 0.3) tileKey = 'Tile_03'; // right edge variant

      this.placeTile(x, groundRow * TILE_DRAW + TILE_DRAW / 2, tileKey, chunkData);

      // Fill below with dirt
      for (let row = groundRow + 1; row < WORLD_HEIGHT_TILES; row++) {
        this.placeTile(x, row * TILE_DRAW + TILE_DRAW / 2, 'Tile_05', chunkData);
      }
    }
  }

  placeTile(x, y, tileKey, chunkData) {
    const tile = this.platformGroup.create(x, y, tileKey);
    tile.setOrigin(0.5, 0.5);
    tile.setScale(TILE_SCALE);
    tile.refreshBody();
    chunkData.sprites.push(tile);
  }

  placeGemCluster(centerX, y, chunkData, rand) {
    const gemType = Phaser.Math.Between(1, 6);
    const count = Phaser.Math.Between(3, 5);
    for (let i = 0; i < count; i++) {
      const gx = centerX + (i - Math.floor(count / 2)) * 40;
      const gem = this.gemGroup.create(gx, y, 'gem_' + gemType, 0);
      gem.setOrigin(0.5, 0.5);
      gem.setScale(GEM_SCALE);
      gem.refreshBody();
      gem.play('gem_anim_' + gemType);
      gem.setDepth(5);
      chunkData.sprites.push(gem);
    }
  }

  placeTrap(x, y, chunkData, rand) {
    const trapType = Phaser.Math.Between(1, 6);
    const trap = this.trapGroup.create(x, y, 'trap_' + trapType, 0);
    trap.setOrigin(0.5, 0.5);
    trap.setScale(TRAP_SCALE);
    trap.body.setSize(32, 32);
    trap.body.setOffset(8, 8);
    trap.refreshBody();
    trap.play('trap_anim_' + trapType);
    trap.setDepth(5);
    chunkData.sprites.push(trap);
  }

  placeBox(x, y, chunkData) {
    const boxType = Phaser.Math.Between(1, 3);
    const sprite = this.physics.add.sprite(x, y, 'box_' + boxType);
    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(BOX_SCALE);
    sprite.body.allowGravity = false;
    sprite.body.setImmovable(true);
    sprite.setDepth(5);

    const boxData = {
      sprite,
      boxType,
      hp: 2,          // 2 hits to break
      dead: false,
      lastHitTime: 0,
    };

    this.physics.add.collider(this.player, sprite);
    this.activeBoxes.push(boxData);
    chunkData.sprites.push(sprite);
    chunkData.boxes = chunkData.boxes || [];
    chunkData.boxes.push(boxData);
  }

  populateChunkEnemies(startX, chunkIndex, chunkData) {
    const enemyCount = Phaser.Math.Between(1, 3);
    const ghostTypes = Object.values(ENEMIES);
    const worldEnemyKeys = Object.keys(WORLD_ENEMIES);

    for (let i = 0; i < enemyCount; i++) {
      const ex = startX + Phaser.Math.Between(80, CHUNK_WIDTH_PX - 80);
      const isGhost = Math.random() < 0.3;

      if (isGhost) {
        this.spawnGhostEnemy(ex, chunkData, ghostTypes);
      } else {
        this.spawnWorldEnemy(ex, chunkData, worldEnemyKeys);
      }
    }
  }

  spawnGhostEnemy(x, chunkData, ghostTypes) {
    const type = ghostTypes[Phaser.Math.Between(0, ghostTypes.length - 1)];
    const prefix = 'enemy_' + type.folder;
    const y = GROUND_LEVEL * TILE_DRAW - 100;

    const sprite = this.physics.add.sprite(x, y, prefix + '_idle', 0);
    sprite.setScale(GHOST_ENEMY_SCALE);
    sprite.setOrigin(0.5, 0.75);
    sprite.setDepth(8);
    sprite.play(prefix + '_idle');
    sprite.body.allowGravity = false;
    sprite.body.setSize(60, 80);
    sprite.body.setOffset(34, 28);

    const enemy = {
      sprite,
      type,
      prefix,
      isGhost: true,
      // Patrol
      patrolMinX: x - 150,
      patrolMaxX: x + 150,
      patrolDir: 1,
      // AI state
      state: 'idle',
      stateTimer: 0,
      stateDuration: Phaser.Math.Between(1500, 4000),
      facingRight: true,
      // Combat state
      hp: ENEMY_MAX_HP,
      dead: false,
      lastHitTime: 0,
      lastAttackTime: 0,
      hpBarBg: null,
      hpBar: null,
    };

    this.createEnemyHealthBar(enemy);
    this.activeEnemies.push(enemy);
    chunkData.enemies.push(enemy);

    // Collider with player
    this.physics.add.collider(sprite, this.platformGroup);
  }

  spawnWorldEnemy(x, chunkData, worldEnemyKeys) {
    const key = worldEnemyKeys[Phaser.Math.Between(0, worldEnemyKeys.length - 1)];
    const def = WORLD_ENEMIES[key];
    const prefix = 'wenemy_' + key;
    const y = GROUND_LEVEL * TILE_DRAW - 60;

    const idleAnim = prefix + '_idle';
    const sprite = this.physics.add.sprite(x, y, 'wenemy_' + key + '_idle', 0);
    sprite.setOrigin(0.5, 0.75);
    sprite.setScale(WORLD_ENEMY_SCALE);
    sprite.setDepth(8);
    sprite.play(idleAnim);
    sprite.body.setSize(36, 36);
    sprite.body.setOffset(6, 6);

    const enemy = {
      sprite,
      typeKey: key,
      def,
      prefix,
      isGhost: false,
      // Patrol
      patrolMinX: x - 120,
      patrolMaxX: x + 120,
      patrolDir: 1,
      // AI state
      state: 'patrol',
      stateTimer: 0,
      facingRight: true,
      // Combat
      hp: ENEMY_MAX_HP,
      dead: false,
      lastHitTime: 0,
      lastAttackTime: 0,
      hpBarBg: null,
      hpBar: null,
    };

    this.createEnemyHealthBar(enemy);
    this.activeEnemies.push(enemy);
    chunkData.enemies.push(enemy);

    this.physics.add.collider(sprite, this.platformGroup);
  }

  seededRandom(seed) {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // ============================================================
  // Chunk management
  // ============================================================
  manageChunks() {
    const playerChunk = Math.floor(this.player.x / CHUNK_WIDTH_PX);

    // Generate chunks ahead
    for (let i = 0; i <= GENERATE_AHEAD; i++) {
      this.generateChunk(playerChunk + i);
    }

    // Destroy chunks far behind
    for (const [idx, chunk] of this.chunks) {
      if (idx < playerChunk - DESPAWN_BEHIND) {
        this.destroyChunk(idx);
      }
    }
  }

  destroyChunk(chunkIndex) {
    const chunk = this.chunks.get(chunkIndex);
    if (!chunk) return;

    // Destroy all sprites
    chunk.sprites.forEach(s => {
      if (s && s.active) s.destroy();
    });

    // Destroy enemies
    chunk.enemies.forEach(e => {
      if (e.sprite && e.sprite.active) e.sprite.destroy();
      if (e.hpBarBg) e.hpBarBg.destroy();
      if (e.hpBar) e.hpBar.destroy();
      const idx = this.activeEnemies.indexOf(e);
      if (idx !== -1) this.activeEnemies.splice(idx, 1);
    });

    // Destroy boxes
    if (chunk.boxes) {
      chunk.boxes.forEach(b => {
        const idx = this.activeBoxes.indexOf(b);
        if (idx !== -1) this.activeBoxes.splice(idx, 1);
      });
    }

    this.chunks.delete(chunkIndex);
  }

  // ============================================================
  // Collectibles & Traps
  // ============================================================
  collectGem(player, gem) {
    gem.destroy();
    this.score += 10;
    this.updateScoreText();
  }

  hitTrap(player, trap) {
    const time = this.time.now;
    if (time - this.lastTrapHitTime < 1000) return; // 1s cooldown per trap hit
    this.lastTrapHitTime = time;
    this.applyDamageToPlayer(15, time);
  }

  // ============================================================
  // HUD
  // ============================================================
  createHUD() {
    // Character name
    this.add.text(12, 8, this.charDef.name.toUpperCase(), {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: this.charDef.color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(0).setDepth(100);

    // Health bar background
    this.hpBarBg = this.add.graphics();
    this.hpBarBg.setScrollFactor(0).setDepth(100);
    this.hpBarBg.fillStyle(0x333333, 0.8);
    this.hpBarBg.fillRoundedRect(12, 32, 204, 16, 4);
    this.hpBarBg.lineStyle(2, 0x555555, 1);
    this.hpBarBg.strokeRoundedRect(12, 32, 204, 16, 4);

    // Health bar fill
    this.hpBar = this.add.graphics();
    this.hpBar.setScrollFactor(0).setDepth(101);
    this.updateHealthBar();

    // Score text
    this.scoreText = this.add.text(1280 - 12, 8, 'SCORE: 0', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // Distance text
    this.distText = this.add.text(1280 - 12, 30, 'DIST: 0m', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#88ccff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
  }

  updateHealthBar() {
    this.hpBar.clear();
    const pct = Math.max(0, this.playerHP / PLAYER_MAX_HP);
    const w = 200 * pct;
    let color;
    if (pct > 0.5) color = Phaser.Display.Color.GetColor(
      Math.round((1 - pct) * 2 * 255), 255, 50);
    else color = Phaser.Display.Color.GetColor(
      255, Math.round(pct * 2 * 255), 50);
    this.hpBar.fillStyle(color, 1);
    if (w > 0) this.hpBar.fillRoundedRect(14, 34, w, 12, 3);
  }

  updateScoreText() {
    if (this.scoreText) this.scoreText.setText('SCORE: ' + this.score);
  }

  updateDistText() {
    const dist = Math.floor(this.player.x / TILE_DRAW);
    if (dist > this.maxDistance) this.maxDistance = dist;
    if (this.distText) this.distText.setText('DIST: ' + this.maxDistance + 'm');
  }

  // ============================================================
  // Combat
  // ============================================================
  handlePlayerCombat(time) {
    if (!this.isAttacking || this.comboStep < 0) return;

    const damage = ATTACK_DAMAGE[this.comboStep];
    const px = this.player.x;
    const py = this.player.y;

    this.activeEnemies.forEach(e => {
      if (e.dead || this.attackHitEnemies.has(e)) return;
      if (!e.sprite || !e.sprite.active) return;

      const ex = e.sprite.x;
      const ey = e.sprite.y;
      const dx = ex - px;
      const dy = Math.abs(ey - py);

      // Check if in range and in facing direction
      const inDir = this.facingRight ? dx > 0 : dx < 0;
      if (Math.abs(dx) < PLAYER_ATTACK_RANGE && dy < 100 && inDir) {
        this.attackHitEnemies.add(e);
        this.applyDamageToEnemy(e, damage, time);
      }
    });

    // Hit boxes
    this.activeBoxes.forEach(b => {
      if (b.dead || !b.sprite || !b.sprite.active) return;
      if (this.attackHitEnemies.has(b)) return; // reuse set for boxes too

      const bx = b.sprite.x;
      const by = b.sprite.y;
      const dx = bx - px;
      const dy = Math.abs(by - py);

      const inDir = this.facingRight ? dx > 0 : dx < 0;
      if (Math.abs(dx) < PLAYER_ATTACK_RANGE && dy < 100 && inDir) {
        this.attackHitEnemies.add(b);
        this.hitBox(b, time);
      }
    });
  }

  hitBox(b, time) {
    if (b.dead) return;
    if (b.lastHitTime && (time - b.lastHitTime) < 300) return;
    b.lastHitTime = time;
    b.hp--;

    if (b.hp <= 0) {
      // Break the box
      b.dead = true;
      b.sprite.setTexture('box_' + b.boxType + '_break');
      b.sprite.setScale(BOX_SCALE);
      this.score += 5;
      this.updateScoreText();

      // Fade out and destroy
      this.tweens.add({
        targets: b.sprite,
        alpha: 0,
        duration: 400,
        onComplete: () => {
          if (b.sprite && b.sprite.active) b.sprite.destroy();
        }
      });
    } else {
      // Play hit animation
      const hitAnim = 'box_hit_anim_' + b.boxType;
      b.sprite.play(hitAnim);
      b.sprite.once('animationcomplete', () => {
        if (!b.dead && b.sprite && b.sprite.active) {
          b.sprite.setTexture('box_' + b.boxType);
          b.sprite.setScale(BOX_SCALE);
        }
      });
    }
  }

  applyDamageToEnemy(e, damage, time) {
    if (e.lastHitTime && (time - e.lastHitTime) < ENEMY_IFRAMES_MS) return;
    e.lastHitTime = time;

    e.hp -= damage;

    // Flash red
    e.sprite.setTint(0xff0000);
    this.time.delayedCall(100, () => {
      if (e.sprite && e.sprite.active && !e.dead) e.sprite.clearTint();
    });

    if (e.hp <= 0) {
      e.hp = 0;
      e.dead = true;
      e.state = 'dead';
      this.score += 25;
      this.updateScoreText();

      if (e.isGhost) {
        e.sprite.play(e.prefix + '_dead');
        if (e.hpBarBg) e.hpBarBg.setVisible(false);
        if (e.hpBar) e.hpBar.setVisible(false);
        e.sprite.once('animationcomplete', () => {
          e.sprite.setAlpha(0.4);
        });
      } else {
        // World enemy hit animation then fade
        const hitAnim = e.prefix + '_hit';
        if (this.anims.exists(hitAnim)) {
          e.sprite.play(hitAnim);
        }
        if (e.hpBarBg) e.hpBarBg.setVisible(false);
        if (e.hpBar) e.hpBar.setVisible(false);
        e.sprite.once('animationcomplete', () => {
          e.sprite.setAlpha(0.4);
        });
      }
    } else {
      // Hurt animation
      if (e.isGhost) {
        const prevState = e.state;
        e.state = 'hurt';
        e.sprite.play(e.prefix + '_hurt');
        e.sprite.once('animationcomplete', () => {
          if (!e.dead) {
            e.state = prevState === 'hurt' ? 'idle' : prevState;
            if (e.isGhost) {
              if (e.state === 'idle') e.sprite.play(e.prefix + '_idle');
              else if (e.state === 'chase') e.sprite.play(e.prefix + '_run');
              else e.sprite.play(e.prefix + '_idle');
            }
          }
        });
      } else {
        const hitAnim = e.prefix + '_hit';
        if (this.anims.exists(hitAnim)) {
          const prevState = e.state;
          e.state = 'hurt';
          e.sprite.play(hitAnim);
          e.sprite.once('animationcomplete', () => {
            if (!e.dead) {
              e.state = 'patrol';
              const idleAnim = e.prefix + '_idle';
              if (this.anims.exists(idleAnim)) e.sprite.play(idleAnim);
            }
          });
        }
      }
      this.updateEnemyHealthBar(e);
    }
  }

  applyDamageToPlayer(damage, time) {
    if (this.isShielding) return;
    if ((time - this.playerLastHitTime) < PLAYER_IFRAMES_MS) return;
    if (this.playerDead) return;

    this.playerLastHitTime = time;
    this.playerHP -= damage;
    this.updateHealthBar();

    // Flash
    this.player.setTint(0xff0000);
    this.time.delayedCall(100, () => {
      if (!this.playerDead) this.player.clearTint();
    });

    // Blink during iframes
    let blinkCount = 0;
    this.time.addEvent({
      delay: 80,
      repeat: Math.floor(PLAYER_IFRAMES_MS / 80) - 1,
      callback: () => {
        blinkCount++;
        this.player.setAlpha(blinkCount % 2 === 0 ? 1 : 0.3);
      }
    });
    this.time.delayedCall(PLAYER_IFRAMES_MS, () => {
      this.player.setAlpha(1);
    });

    if (this.playerHP <= 0) {
      this.playerHP = 0;
      this.playerDeath();
    } else if (!this.isAttacking) {
      this.isHurt = true;
      this.player.play('anim_hurt');
      this.player.once('animationcomplete', () => {
        this.isHurt = false;
        if (!this.playerDead && !this.isAttacking) {
          this.player.play('anim_idle');
        }
      });
    }
  }

  playerDeath() {
    this.playerDead = true;
    this.isAttacking = false;
    this.isMoving = false;
    this.isShielding = false;
    this.player.clearTint();
    this.player.setAlpha(1);
    this.player.setVelocity(0, 0);
    this.player.body.allowGravity = false;
    this.player.play('anim_dead');

    const cam = this.cameras.main;
    const goText = this.add.text(cam.width / 2, cam.height / 2 - 50, 'GAME OVER', {
      fontSize: '64px',
      fontFamily: 'monospace',
      color: '#ff2222',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.add.text(cam.width / 2, cam.height / 2 + 20, 'Score: ' + this.score + '  |  Dist: ' + this.maxDistance + 'm', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#cccccc',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.add.text(cam.width / 2, cam.height / 2 + 55, 'Returning to select...', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#888888',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.time.delayedCall(3000, () => {
      this.scene.start('MenuScene');
    });
  }

  // ============================================================
  // Enemy health bars
  // ============================================================
  createEnemyHealthBar(e) {
    e.hpBarBg = this.add.graphics();
    e.hpBar = this.add.graphics();
    e.hpBarBg.setVisible(false);
    e.hpBar.setVisible(false);
  }

  updateEnemyHealthBar(e) {
    if (!e.hpBarBg || !e.sprite || !e.sprite.active) return;
    const pct = Math.max(0, e.hp / ENEMY_MAX_HP);

    const show = pct < 1 && !e.dead;
    e.hpBarBg.setVisible(show);
    e.hpBar.setVisible(show);

    if (!show) return;

    const barX = e.sprite.x - 30;
    const barY = e.sprite.y - (e.isGhost ? 80 : 60);

    e.hpBarBg.clear();
    e.hpBarBg.fillStyle(0x333333, 0.8);
    e.hpBarBg.fillRect(barX, barY, 60, 8);
    e.hpBarBg.setDepth(50);

    e.hpBar.clear();
    let color;
    if (pct > 0.5) color = Phaser.Display.Color.GetColor(
      Math.round((1 - pct) * 2 * 255), 255, 50);
    else color = Phaser.Display.Color.GetColor(
      255, Math.round(pct * 2 * 255), 50);
    e.hpBar.fillStyle(color, 1);
    e.hpBar.fillRect(barX + 1, barY + 1, 58 * pct, 6);
    e.hpBar.setDepth(51);
  }

  // ============================================================
  // Enemy AI
  // ============================================================
  updateEnemies(time, delta) {
    const px = this.player.x;
    const py = this.player.y;

    this.activeEnemies.forEach(e => {
      if (!e.sprite || !e.sprite.active) return;
      if (e.dead) return;
      if (e.state === 'hurt') return;

      const ex = e.sprite.x;
      const ey = e.sprite.y;
      const dx = px - ex;
      const dy = py - ey;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (e.isGhost) {
        this.updateGhostEnemy(e, time, delta, dx, dy, dist);
      } else {
        this.updateWorldEnemy(e, time, delta, dx, dy, dist);
      }

      // Update health bar position
      this.updateEnemyHealthBar(e);
    });
  }

  updateGhostEnemy(e, time, delta, dxPlayer, dyPlayer, distToPlayer) {
    // Ghost: no gravity, patrol + chase
    if (!this.playerDead && distToPlayer < ENEMY_AGGRO_RANGE && e.state !== 'chase' && e.state !== 'attack') {
      e.state = 'chase';
      e.stateTimer = 0;
      e.sprite.play(e.prefix + '_run');
    }

    if (e.state === 'chase') {
      if (this.playerDead || distToPlayer > ENEMY_DISENGAGE_RANGE) {
        e.state = 'idle';
        e.stateTimer = 0;
        e.stateDuration = Phaser.Math.Between(1500, 4000);
        e.sprite.play(e.prefix + '_idle');
        e.sprite.setVelocity(0, 0);
      } else if (distToPlayer < ENEMY_ATTACK_RANGE) {
        if (!e.lastAttackTime || (time - e.lastAttackTime) > ENEMY_ATTACK_COOLDOWN) {
          e.state = 'attack';
          e.sprite.play(e.prefix + '_attack');
          e.lastAttackTime = time;
          e.sprite.setVelocity(0, 0);

          this.time.delayedCall(200, () => {
            if (!e.dead && e.state === 'attack') {
              const cdx = this.player.x - e.sprite.x;
              const cdy = this.player.y - e.sprite.y;
              const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
              if (cdist < ENEMY_ATTACK_RANGE * 1.5) {
                this.applyDamageToPlayer(ENEMY_ATTACK_DAMAGE, time);
              }
            }
          });

          e.sprite.once('animationcomplete', () => {
            if (!e.dead) {
              e.state = 'chase';
              e.sprite.play(e.prefix + '_run');
            }
          });
        }
      } else {
        // Move towards player (floating)
        const len = distToPlayer || 1;
        const speed = ENEMY_RUN_SPEED;
        e.sprite.setVelocity(
          (dxPlayer / len) * speed,
          (dyPlayer / len) * speed * 0.5
        );
        e.facingRight = dxPlayer > 0;
        e.sprite.setFlipX(!e.facingRight);
      }
    } else if (e.state === 'attack') {
      // wait for anim
    } else {
      // Idle / patrol
      e.stateTimer += delta;
      if (e.stateTimer >= e.stateDuration) {
        e.stateTimer = 0;
        if (e.state === 'idle') {
          e.state = 'walk';
          e.stateDuration = Phaser.Math.Between(2000, 4000);
          e.patrolDir = Math.random() > 0.5 ? 1 : -1;
          e.facingRight = e.patrolDir > 0;
          e.sprite.setFlipX(!e.facingRight);
          e.sprite.play(e.prefix + '_walk');
        } else {
          e.state = 'idle';
          e.stateDuration = Phaser.Math.Between(1500, 3000);
          e.sprite.setVelocity(0, 0);
          e.sprite.play(e.prefix + '_idle');
        }
      }

      if (e.state === 'walk') {
        e.sprite.setVelocityX(e.patrolDir * ENEMY_SPEED);
        // Drift vertically towards a baseline
        const baseY = GROUND_LEVEL * TILE_DRAW - 100;
        e.sprite.setVelocityY((baseY - e.sprite.y) * 0.5);

        // Bounce at patrol bounds
        if (e.sprite.x < e.patrolMinX) { e.patrolDir = 1; e.facingRight = true; e.sprite.setFlipX(false); }
        if (e.sprite.x > e.patrolMaxX) { e.patrolDir = -1; e.facingRight = false; e.sprite.setFlipX(true); }
      }
    }
  }

  updateWorldEnemy(e, time, delta, dxPlayer, dyPlayer, distToPlayer) {
    // World enemy: has gravity, patrols on ground, turns at edges
    if (!this.playerDead && distToPlayer < ENEMY_AGGRO_RANGE && e.state !== 'chase' && e.state !== 'attack') {
      e.state = 'chase';
      const runAnim = e.prefix + '_run';
      const walkAnim = e.prefix + '_walk';
      if (this.anims.exists(runAnim)) e.sprite.play(runAnim);
      else if (this.anims.exists(walkAnim)) e.sprite.play(walkAnim);
    }

    if (e.state === 'chase') {
      if (this.playerDead || distToPlayer > ENEMY_DISENGAGE_RANGE) {
        e.state = 'patrol';
        const idleAnim = e.prefix + '_idle';
        if (this.anims.exists(idleAnim)) e.sprite.play(idleAnim);
        e.sprite.setVelocityX(0);
      } else if (distToPlayer < ENEMY_ATTACK_RANGE) {
        if (!e.lastAttackTime || (time - e.lastAttackTime) > ENEMY_ATTACK_COOLDOWN) {
          e.state = 'attack';
          e.lastAttackTime = time;
          e.sprite.setVelocityX(0);

          const attackAnim = e.prefix + '_attack';
          if (this.anims.exists(attackAnim)) {
            e.sprite.play(attackAnim);
          }

          this.time.delayedCall(200, () => {
            if (!e.dead && e.state === 'attack') {
              const cdx = this.player.x - e.sprite.x;
              const cdy = this.player.y - e.sprite.y;
              const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
              if (cdist < ENEMY_ATTACK_RANGE * 1.5) {
                this.applyDamageToPlayer(ENEMY_ATTACK_DAMAGE, time);
              }
            }
          });

          e.sprite.once('animationcomplete', () => {
            if (!e.dead) {
              e.state = 'chase';
              const runAnim = e.prefix + '_run';
              const walkAnim = e.prefix + '_walk';
              if (this.anims.exists(runAnim)) e.sprite.play(runAnim);
              else if (this.anims.exists(walkAnim)) e.sprite.play(walkAnim);
            }
          });
        }
      } else {
        // Chase: move towards player horizontally
        const dir = dxPlayer > 0 ? 1 : -1;
        e.sprite.setVelocityX(dir * ENEMY_RUN_SPEED);
        e.facingRight = dir > 0;
        e.sprite.setFlipX(!e.facingRight);
      }
    } else if (e.state === 'attack') {
      // wait for anim
    } else {
      // Patrol
      e.stateTimer += delta;

      const speed = ENEMY_SPEED * 0.7;
      e.sprite.setVelocityX(e.patrolDir * speed);
      e.facingRight = e.patrolDir > 0;
      e.sprite.setFlipX(!e.facingRight);

      // Detect edge: if no ground ahead, turn around
      if (e.sprite.body.onFloor()) {
        const aheadX = e.sprite.x + e.patrolDir * 20;
        const groundY = GROUND_LEVEL * TILE_DRAW + TILE_DRAW / 2;
        // Simple bounds check
        if (e.sprite.x < e.patrolMinX || e.sprite.x > e.patrolMaxX) {
          e.patrolDir *= -1;
        }
      }

      // Play walk/idle animation
      const runAnim = e.prefix + '_run';
      const walkAnim = e.prefix + '_walk';
      const idleAnim = e.prefix + '_idle';
      const currentAnim = e.sprite.anims.currentAnim ? e.sprite.anims.currentAnim.key : '';
      if (currentAnim !== runAnim && currentAnim !== walkAnim && currentAnim !== idleAnim) {
        if (this.anims.exists(runAnim)) e.sprite.play(runAnim);
        else if (this.anims.exists(walkAnim)) e.sprite.play(walkAnim);
        else if (this.anims.exists(idleAnim)) e.sprite.play(idleAnim);
      }
    }
  }

  // ============================================================
  // Main update loop
  // ============================================================
  update(time, delta) {
    // Parallax background
    this.bgSprite.tilePositionX = this.cameras.main.scrollX * 0.3;

    // Check fall death
    if (!this.playerDead && this.player.y > WORLD_HEIGHT_PX + 100) {
      this.playerHP = 0;
      this.updateHealthBar();
      this.playerDeath();
      return;
    }

    // Dead: stop
    if (this.playerDead) {
      this.updateEnemies(time, delta);
      return;
    }

    // Hurt: wait
    if (this.isHurt) {
      this.player.setVelocityX(0);
      this.updateEnemies(time, delta);
      this.manageChunks();
      this.updateDistText();
      return;
    }

    // Shield
    if (this.shieldKey.isDown && !this.isAttacking && this.player.body.onFloor()) {
      if (!this.isShielding) {
        this.isShielding = true;
        this.isMoving = false;
        this.isRunning = false;
        this.player.setVelocityX(0);
        this.player.play('anim_shield');
      }
    } else if (this.isShielding) {
      this.isShielding = false;
      this.player.play('anim_idle');
    }

    if (this.isShielding) {
      this.player.setVelocityX(0);
      this.handlePlayerCombat(time);
      this.updateEnemies(time, delta);
      this.manageChunks();
      this.updateDistText();
      return;
    }

    // Attack input
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      if (!this.isAttacking) {
        this.startAttack(0);
      } else if (this.isAttacking && this.comboStep < 2) {
        this.comboQueued = true;
        if (this.comboWindowTimer && this.comboWindowTimer.getProgress() < 1) {
          this.comboWindowTimer.remove();
          this.startAttack(this.comboStep + 1);
        }
      }
    }

    // Jump
    if (this.justDown(this.jumpKeys) && this.player.body.onFloor() && !this.isAttacking) {
      this.player.setVelocityY(JUMP_VELOCITY);
      this.player.play('anim_jump');
    }

    // Double-tap detection
    if (this.justDown(this.keys.left)) this.checkDoubleTap('left', time);
    if (this.justDown(this.keys.right)) this.checkDoubleTap('right', time);

    // Movement (blocked during attack)
    let dx = 0;
    if (!this.isAttacking) {
      if (this.isDown(this.keys.left)) dx = -1;
      if (this.isDown(this.keys.right)) dx = 1;
    }

    const moving = dx !== 0;

    if (dx > 0) this.facingRight = true;
    if (dx < 0) this.facingRight = false;
    this.player.setFlipX(!this.facingRight);

    if (!moving) this.isRunning = false;

    if (moving) {
      const speed = this.isRunning ? RUN_SPEED : PLAYER_SPEED;
      this.player.setVelocityX(dx * speed);

      if (this.player.body.onFloor() && !this.isAttacking) {
        const wantedAnim = this.isRunning ? 'anim_run' : 'anim_walk';
        const currentAnim = this.player.anims.currentAnim ? this.player.anims.currentAnim.key : '';
        if (!this.isMoving || currentAnim !== wantedAnim) {
          this.player.play(wantedAnim);
        }
        this.isMoving = true;
      }
    } else {
      if (!this.isAttacking) {
        this.player.setVelocityX(0);
      }
      if (this.isMoving && this.player.body.onFloor() && !this.isAttacking) {
        this.isMoving = false;
        this.player.play('anim_idle');
      }
    }

    // Air animation
    if (!this.player.body.onFloor() && !this.isAttacking) {
      const currentAnim = this.player.anims.currentAnim ? this.player.anims.currentAnim.key : '';
      if (currentAnim !== 'anim_jump') {
        this.player.play('anim_jump');
      }
    }

    // Landing detection
    if (this.player.body.onFloor() && !this.isAttacking && !moving) {
      const currentAnim = this.player.anims.currentAnim ? this.player.anims.currentAnim.key : '';
      if (currentAnim === 'anim_jump') {
        this.player.play('anim_idle');
        this.isMoving = false;
      }
    }

    // Combat
    this.handlePlayerCombat(time);

    // Enemies
    this.updateEnemies(time, delta);

    // Chunk management
    this.manageChunks();

    // Distance
    this.updateDistText();
  }
}
