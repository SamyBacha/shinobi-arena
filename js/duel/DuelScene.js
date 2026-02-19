// ============================================================
// Duel Scene
// ============================================================
class DuelScene extends Phaser.Scene {
  constructor() { super('DuelScene'); }

  init(data) {
    this.p1Def = data.p1;
    this.p2Def = data.p2;
    this.vsAI = data.vsAI || false;

    // Arcade mode state
    this.arcade = data.arcade || false;
    this.arcadeOpponents = data.arcadeOpponents || [];
    this.arcadeIndex = data.arcadeIndex || 0;

    // Force le stage boss si combat contre le Magician en vsAI
    const isBossCandidate = data.p2 && data.p2.trait === 'magic_shield' && (data.vsAI || false);
    const bossStageIdx = STAGES.findIndex(s => s.id === BOSS_GIF);

    if (isBossCandidate) {
      this.stageIndex = bossStageIdx !== -1 ? bossStageIdx + 1 : 1;
    } else if (data.stageIndex) {
      this.stageIndex = data.stageIndex;
    } else {
      this.stageIndex = Phaser.Math.Between(1, Math.max(1, STAGES.length));
    }
  }

  preload() {
    [this.p1Def, this.p2Def].forEach(charDef => {
      const base = charDef.assetFolder;
      const sheets = charDef.sheets;
      const fs = charDef.frameSize;
      Object.keys(sheets).forEach(key => {
        const loadKey = 'duel_' + charDef.folder + '_' + key;
        if (!this.textures.exists(loadKey)) {
          // Projectile sheet uses its own frame size
          let fw = fs, fh = fs;
          if (charDef.projectile && key === charDef.projectile.sheet) {
            fw = charDef.projectile.frameSize;
            fh = fs; // height stays 128
          }
          this.load.spritesheet(loadKey, base + sheets[key].file, {
            frameWidth: fw, frameHeight: fh
          });
        }
      });
    });

    // Preload idle spritesheets for ALL characters (miniatures in pause/rules)
    const allChars = [...Object.values(CHARACTERS), ...Object.values(GHOST_CHARACTERS), ...Object.values(HIDDEN_CHARACTERS)];
    allChars.forEach(charDef => {
      const loadKey = 'duel_' + charDef.folder + '_idle';
      if (!this.textures.exists(loadKey)) {
        this.load.spritesheet(loadKey, charDef.assetFolder + charDef.sheets.idle.file, {
          frameWidth: charDef.frameSize, frameHeight: charDef.frameSize
        });
      }
    });

    // FX partagés (smoke, green_slash — indépendants du personnage)
    const sharedFx = {
      'fx_smoke':      { base: 'img/fx/smoke/',       count: 10 },
      'fx_smoke2':     { base: 'img/fx/smoke2/',      count: 10 },
      'fx_green_slash':{ base: 'img/fx/green_slash/', count: 10 },
    };
    Object.entries(sharedFx).forEach(([key, info]) => {
      for (let i = 1; i <= info.count; i++) {
        const imgKey = key + '_' + i;
        if (!this.textures.exists(imgKey)) {
          this.load.image(imgKey, info.base + i + '.png');
        }
      }
    });

    // FX propres à chaque personnage — déclarés dans charDef.fx
    [this.p1Def, this.p2Def].forEach(charDef => {
      Object.entries(charDef.fx).forEach(([fxName, info]) => {
        const key = 'fx_' + charDef.voiceKey + '_' + fxName;
        for (let i = 1; i <= info.count; i++) {
          const imgKey = key + '_' + i;
          if (!this.textures.exists(imgKey)) {
            this.load.image(imgKey, charDef.fxFolder + info.folder + i + '.png');
          }
        }
      });
    });

    if (!this.cache.audio.exists('duel_bgm')) {
      this.load.audio('duel_bgm', 'music/bgm_duel.mp3');
    }
    if (!this.cache.audio.exists('duel_boss_bgm')) {
      this.load.audio('duel_boss_bgm', 'music/bgm_duel_boss.mp3');
    }
    // BGM propre au stage (s'il en a un)
    const currentStagePreload = STAGES[this.stageIndex - 1];
    if (currentStagePreload && currentStagePreload.bgmPath) {
      const key = currentStagePreload.musicKey;
      if (!this.cache.audio.exists(key)) {
        this.load.audio(key, currentStagePreload.bgmPath);
      }
    }
    if (!this.cache.audio.exists('duel_gameover')) {
      this.load.audio('duel_gameover', 'music/sfx_gameover.mp3');
    }
    if (!this.cache.audio.exists('duel_samurai')) {
      this.load.audio('duel_samurai', 'music/sfx_duel_end.mp3');
    }
    if (!this.cache.audio.exists('duel_sword')) {
      this.load.audio('duel_sword', 'music/sfx_sword.mp3');
    }
    if (!this.cache.audio.exists('duel_punch')) {
      this.load.audio('duel_punch', 'music/sfx_punch.mp3');
    }
    // Special voices — chargées depuis le dossier du personnage concerné
    const magician = HIDDEN_CHARACTERS.Wanderer_Magician;
    if (!this.cache.audio.exists('boss_useless')) {
      this.load.audio('boss_useless', magician.voicesFolder + 'boss_useless.mp3');
    }
    const onre = GHOST_CHARACTERS.Onre;
    if (!this.cache.audio.exists('onre_counter')) {
      this.load.audio('onre_counter', onre.voicesFolder + 'Onre_counter.mp3');
    }
    const peasant = HIDDEN_CHARACTERS.Ninja_Peasant;
    if (!this.cache.audio.exists('peasant_special')) {
      this.load.audio('peasant_special', peasant.voicesFolder + 'Peasant_special_ability.mp3');
    }
    if (!this.cache.audio.exists('magic_spell')) {
      this.load.audio('magic_spell', 'music/sfx_elemental-magic-spell-impact-outgoing.mp3');
    }

    // Character voices — fichiers optionnels dans {voicesFolder}/{folder}_{event}.mp3
    [this.p1Def, this.p2Def].forEach(charDef => {
      ['intro', 'win', 'lose'].forEach(ev => {
        const key = 'voice_' + charDef.voiceKey + '_' + ev;
        if (!this.cache.audio.exists(key)) {
          this.load.audio(key, charDef.voicesFolder + charDef.voiceKey + '_' + ev + '.mp3');
        }
      });
    });

    // Stage background chargé comme <img> DOM dans create() via stage.bgPath
  }

  create() {
    applyGraphicsSettings(this);
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    // Détection boss final : Magician (trait magic_shield) en vsAI OU stage boss sélectionné
    const currentStage = STAGES[this.stageIndex - 1];
    this.isBossFight = (this.p2Def.trait === 'magic_shield' && this.vsAI) ||
      (currentStage && currentStage.isBossStage);

    // Fond transparent — le background DOM est visible derrière le canvas
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    // Music — clé depuis le Stage (propre ou fallback global)
    const bgmKey = currentStage ? currentStage.musicKey : 'duel_bgm';
    this.duelBgm = this.sound.add(bgmKey, { loop: true, volume: AUDIO_SETTINGS.musicVolume });
    this.duelBgm.play();
    this.sound.play('duel_samurai', { volume: AUDIO_SETTINGS.sfxVolume * 0.7 });

    // Create animations for both players + FX
    this.createDuelAnims('p1', this.p1Def);
    this.createDuelAnims('p2', this.p2Def);
    this.createFxAnims();

    // Stage background — <img> DOM derrière le canvas Phaser
    {
      const stage = currentStage || STAGES[0];
      const gameCanvas = this.sys.game.canvas;
      const rect = gameCanvas.getBoundingClientRect();

      this._gifImg = document.createElement('img');
      this._gifImg.src = stage.bgPath;
      this._gifImg.style.cssText = [
        'position:fixed',
        'pointer-events:none',
        'left:'   + rect.left   + 'px',
        'top:'    + rect.top    + 'px',
        'width:'  + rect.width  + 'px',
        'height:' + rect.height + 'px',
        'object-fit:cover',
        'z-index:0',
      ].join(';');
      // Insérer avant le canvas Phaser pour être naturellement derrière
      gameCanvas.parentNode.insertBefore(this._gifImg, gameCanvas);

      // Canvas Phaser transparent (transparent:true dans config app.js)
      // La caméra est déjà à rgba(0,0,0,0) — le GIF DOM est visible derrière
      gameCanvas.style.position = 'relative';
      gameCanvas.style.zIndex = '2';

      // Nettoyage quand la scène se termine
      this.events.once('shutdown', () => {
        if (this._gifImg) { this._gifImg.remove(); this._gifImg = null; }
        gameCanvas.style.zIndex = '';
      });
    }

    // Player state — Fighter trait: +1 max life
    this.p1MaxLives = DUEL_MAX_LIVES + this.p1Def.maxLifeBonus;
    this.p2MaxLives = DUEL_MAX_LIVES + this.p2Def.maxLifeBonus;
    this.p1 = { lives: this.p1MaxLives, charges: 0, choice: -1, ready: false, def: this.p1Def };
    this.p2 = { lives: this.p2MaxLives, charges: 0, choice: -1, ready: false, def: this.p2Def };

    // Sprites
    this.p1Sprite = this.add.sprite(-200, 570, 'duel_' + this.p1Def.folder + '_idle', 0);
    this.p1Sprite.setScale(this.p1Def.effectiveDuelScale);
    this.p1Sprite.setOrigin(0.5, 0.75);
    this.p1Sprite.setDepth(310);

    this.p2Sprite = this.add.sprite(1480, 570, 'duel_' + this.p2Def.folder + '_idle', 0);
    this.p2Sprite.setScale(this.p2Def.effectiveDuelScale);
    this.p2Sprite.setOrigin(0.5, 0.75);
    this.p2Sprite.setFlipX(true);
    this.p2Sprite.setDepth(310);

    // Entrée des personnages en marchant/courant
    this._doCharacterEntrance();

    // "?" indicators above sprites
    this.p1ChoiceText = this.add.text(320, 390, '', {
      fontSize: '48px', fontFamily: 'monospace', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(400);

    this.p2ChoiceText = this.add.text(960, 390, '', {
      fontSize: '48px', fontFamily: 'monospace', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(400);

    // HUD - Names
    this.add.text(30, 20, this.p1Def.name.toUpperCase(), {
      fontSize: '22px', fontFamily: 'monospace', color: this.p1Def.color,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setDepth(400);

    const p2Label = this.vsAI ? 'IA — ' + this.p2Def.name.toUpperCase() : this.p2Def.name.toUpperCase();
    this.add.text(w - 30, 20, p2Label, {
      fontSize: '22px', fontFamily: 'monospace', color: this.p2Def.color,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(400);

    // Arcade combat indicator + boss label
    if (this.isBossFight) {
      // Label boss spécial (arcade ou vsAI direct)
      this.add.text(w / 2, 14, '⚡ BOSS FINAL ⚡', {
        fontSize: '22px', fontFamily: 'monospace', color: '#ff44ff',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5, 0).setDepth(400);
      if (this.arcade) {
        const total = this.arcadeOpponents.length;
        const current = this.arcadeIndex + 1;
        this.add.text(w / 2, 40, 'Combat ' + current + ' / ' + total, {
          fontSize: '14px', fontFamily: 'monospace', color: '#cc88ff',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(400);
      }
      // Éclairs périodiques
      this._bossLightningGfx = this.add.graphics().setDepth(500);
      this._spawnBossLightning();
    } else if (this.arcade) {
      const total = this.arcadeOpponents.length;
      const current = this.arcadeIndex + 1;
      this.add.text(w / 2, 18, 'Combat ' + current + ' / ' + total, {
        fontSize: '20px', fontFamily: 'monospace', color: '#ffcc00',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5, 0).setDepth(400);
    }

    // Hearts graphics
    this.p1HeartsGfx = this.add.graphics();
    this.p2HeartsGfx = this.add.graphics();
    this.p1HeartsGfx.setDepth(400);
    this.p2HeartsGfx.setDepth(400);
    this.drawHearts();

    // Charges text
    this.p1ChargesText = this.add.text(30, 90, 'Charges: 0', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffcc00',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(400);
    this.p2ChargesText = this.add.text(w - 30, 90, 'Charges: 0', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffcc00',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(400);

    // "Spéciale prête !" indicators for magic_shield
    this.p1SpecialText = this.add.text(30, 110, '⚡ Spéciale prête !', {
      fontSize: '13px', fontFamily: 'monospace', color: '#55bbff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setDepth(400).setAlpha(0);
    this.p2SpecialText = this.add.text(w - 30, 110, '⚡ Spéciale prête !', {
      fontSize: '13px', fontFamily: 'monospace', color: '#55bbff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(400).setAlpha(0);

    // Turn counter
    this.turnNumber = 1;
    this.turnText = this.add.text(w / 2, 600, 'TOUR 1 — CHOISISSEZ !', {
      fontSize: '24px', fontFamily: 'monospace', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(400);

    // Result text (center, hidden at first)
    this.resultText = this.add.text(w / 2, 360, '', {
      fontSize: '28px', fontFamily: 'monospace', color: '#ffcc00',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(400);

    // Control labels
    if (DISPLAY_SETTINGS.showHints) {
      this.add.text(160, 690, '1:Recharger  2:Protéger  3:Frapper(x1/x2/x3)', {
        fontSize: '12px', fontFamily: 'monospace', color: '#777799',
      }).setOrigin(0.5).setDepth(400);

      if (!this.vsAI) {
        this.add.text(w - 160, 690, '7:Recharger  8:Protéger  9:Frapper(x1/x2/x3)', {
          fontSize: '12px', fontFamily: 'monospace', color: '#777799',
        }).setOrigin(0.5).setDepth(400);
      } else {
        this.add.text(w - 140, 690, 'IA joue automatiquement', {
          fontSize: '13px', fontFamily: 'monospace', color: '#777799',
        }).setOrigin(0.5).setDepth(400);
      }
    }

    // "No charge" flash text
    this.noChargeText = this.add.text(w / 2, 500, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ff4444',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0).setDepth(400);

    // Keys for P1
    this.keyOne = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.keyTwo = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.keyThree = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Keys for P2
    this.keySeven = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SEVEN);
    this.keyEight = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.EIGHT);
    this.keyNine = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NINE);

    // Pause
    this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyUp = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyLeft = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.paused = false;
    this.pauseObjects = [];
    this.pauseIndex = 0;

    this.turnPhase = 'none';
    this.gameOver = false;
  }

  showRules() {
    this.turnPhase = 'rules';
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Overlay background
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRoundedRect(w / 2 - 400, 15, 800, 690, 16);
    overlay.lineStyle(2, 0x444488, 0.8);
    overlay.strokeRoundedRect(w / 2 - 400, 15, 800, 690, 16);
    overlay.setDepth(500);

    this.rulesObjects = [overlay];

    const addTxt = (x, y, text, size, color, align) => {
      const t = this.add.text(x, y, text, {
        fontSize: size, fontFamily: 'monospace', color: color,
        stroke: '#000000', strokeThickness: 3,
        wordWrap: { width: 720 }, align: align || 'center',
      }).setOrigin(0.5).setDepth(501);
      this.rulesObjects.push(t);
      return t;
    };

    // Title
    addTxt(w / 2, 50, 'RÈGLES DU DUEL', '32px', '#ff4444');

    // Principle
    addTxt(w / 2, 90, 'Chaque joueur a 3 vies. Dernier debout gagne !', '16px', '#cccccc');

    // Actions
    addTxt(w / 2, 125, '── ACTIONS ──', '18px', '#ffcc00');
    addTxt(w / 2, 148, 'RECHARGER — Gagne 1 charge', '14px', '#44dd44');
    addTxt(w / 2, 168, 'PROTÉGER  — Bloque une attaque', '14px', '#4488ff');
    addTxt(w / 2, 188, 'FRAPPER   — Utilise 1 charge, retire 1 vie', '14px', '#ff4444');

    // Super attack
    addTxt(w / 2, 220, '── SUPER ATTAQUE ──', '18px', '#ff00ff');
    addTxt(w / 2, 243, 'Appuyez plusieurs fois sur Frapper pour charger !', '14px', '#ddaaff');
    addTxt(w / 2, 263, 'x2 = 2 charges, retire 2 vies', '13px', '#ff8844');
    addTxt(w / 2, 283, 'x3 = 3 charges, retire 3 vies (KO direct !)', '13px', '#ff00ff');

    // Key rule
    addTxt(w / 2, 312, 'Frapper nécessite au moins 1 charge !', '14px', '#ff6666');

    // Traits section (P1/P2 only)
    addTxt(w / 2, 345, '── CAPACITÉS SPÉCIALES ──', '18px', '#ffcc00');

    const p1TraitObj = this.p1Def.trait ? TRAIT_LABELS[this.p1Def.trait] : null;
    const p2TraitObj = this.p2Def.trait ? TRAIT_LABELS[this.p2Def.trait] : null;
    const p1Short = p1TraitObj ? p1TraitObj.short : 'Aucune';
    const p2Short = p2TraitObj ? p2TraitObj.short : 'Aucune';
    const p1Desc = p1TraitObj ? p1TraitObj.desc : '';
    const p2Desc = p2TraitObj ? p2TraitObj.desc : '';
    addTxt(w / 2 - 180, 370, this.p1Def.name.toUpperCase(), '14px', this.p1Def.color);
    addTxt(w / 2 - 180, 387, p1Short, '12px', '#ffcc00');
    const p1DescTxt = this.add.text(w / 2 - 180, 403, p1Desc, {
      fontSize: '10px', fontFamily: 'monospace', color: '#aaddaa',
      stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: 300 }, align: 'center',
    }).setOrigin(0.5, 0).setDepth(501);
    this.rulesObjects.push(p1DescTxt);
    addTxt(w / 2 + 180, 370, this.p2Def.name.toUpperCase(), '14px', this.p2Def.color);
    addTxt(w / 2 + 180, 387, p2Short, '12px', '#ffcc00');
    const p2DescTxt = this.add.text(w / 2 + 180, 403, p2Desc, {
      fontSize: '10px', fontFamily: 'monospace', color: '#aaddaa',
      stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: 300 }, align: 'center',
    }).setOrigin(0.5, 0).setDepth(501);
    this.rulesObjects.push(p2DescTxt);

    // Controls
    addTxt(w / 2, 450, '── TOUCHES ──', '18px', '#ffcc00');

    addTxt(w / 2 - 180, 477, 'JOUEUR 1', '16px', this.p1Def.color);
    addTxt(w / 2 - 180, 499, '1 ou A : Recharger', '13px', '#aaaacc');
    addTxt(w / 2 - 180, 519, '2 ou Z : Protéger', '13px', '#aaaacc');
    addTxt(w / 2 - 180, 539, '3 ou E : Frapper (x1/x2/x3)', '13px', '#aaaacc');

    if (!this.vsAI) {
      addTxt(w / 2 + 180, 477, 'JOUEUR 2', '16px', this.p2Def.color);
      addTxt(w / 2 + 180, 499, '7 : Recharger', '13px', '#aaaacc');
      addTxt(w / 2 + 180, 519, '8 : Protéger', '13px', '#aaaacc');
      addTxt(w / 2 + 180, 539, '9 : Frapper (x1/x2/x3)', '13px', '#aaaacc');
    } else {
      addTxt(w / 2 + 180, 477, 'IA', '16px', this.p2Def.color);
      addTxt(w / 2 + 180, 505, 'Joue automatiquement', '13px', '#aaaacc');
    }

    // Continue prompt
    const prompt = addTxt(w / 2, 670, 'Appuyez sur ENTER pour commencer', '16px', '#ffffff');
    this.tweens.add({
      targets: prompt, alpha: 0.3, duration: 600, yoyo: true, repeat: -1,
    });

    this.rulesKeyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  dismissRules() {
    this.rulesObjects.forEach(o => { if (o && o.destroy) o.destroy(); });
    this.rulesObjects = [];
    this.startTurn();
  }

  createDuelAnims(prefix, charDef) {
    const s = charDef.sheets;
    const folder = charDef.folder;
    const tag = 'duel_' + prefix;

    const makeAnim = (name, sheetKey, frames, rate, rep) => {
      const animKey = tag + '_' + name;
      if (this.anims.exists(animKey)) this.anims.remove(animKey);
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers('duel_' + folder + '_' + sheetKey, {
          start: 0, end: frames - 1
        }),
        frameRate: rate, repeat: rep
      });
    };

    makeAnim('idle', 'idle', s.idle.frames, 8, -1);
    if (s.walk) makeAnim('walk', 'walk', s.walk.frames, 10, -1);
    if (s.run) makeAnim('run', 'run', s.run.frames, 10, -1);
    makeAnim('attack1', 'attack1', s.attack1.frames, 12, 0);
    makeAnim('attack2', 'attack2', s.attack2.frames, 10, 0);
    makeAnim('attack3', 'attack3', s.attack3.frames, 10, 0);
    makeAnim('shield', 'shield', s.shield.frames, 8, -1);
    if (s.flight) makeAnim('flight', 'flight', s.flight.frames, 10, -1);
    if (s.jump) makeAnim('jump', 'jump', s.jump.frames, 10, 0);
    makeAnim('hurt', 'hurt', s.hurt.frames, 6, 0);
    makeAnim('dead', 'dead', s.dead.frames, 4, 0);
    if (s.magic_sphere) makeAnim('magic_sphere', 'magic_sphere', s.magic_sphere.frames, 14, 0);
    if (charDef.projectile) {
      makeAnim('projectile', charDef.projectile.sheet, charDef.projectile.frames, 12, -1);
    }
  }

  createFxAnims() {
    const makeFxAnim = (key, prefix, count, rate) => {
      if (this.anims.exists(key)) return;
      const frames = [];
      for (let i = 1; i <= count; i++) frames.push({ key: prefix + '_' + i });
      this.anims.create({ key, frames, frameRate: rate, repeat: 0 });
    };

    // FX partagés
    makeFxAnim('fx_anim_green_slash', 'fx_green_slash', 10, 16);
    makeFxAnim('fx_anim_smoke',       'fx_smoke',       10, 14);
    makeFxAnim('fx_anim_smoke2',      'fx_smoke2',      10, 14);

    // FX propres à chaque personnage
    const fxRates = { attack1: 18, attack2: 18, attack3: 18, special: 16, flames: 14 };
    [this.p1Def, this.p2Def].forEach(charDef => {
      Object.entries(charDef.fx).forEach(([fxName, info]) => {
        const prefix = 'fx_' + charDef.voiceKey + '_' + fxName;
        const animKey = 'fx_anim_' + charDef.voiceKey + '_' + fxName;
        makeFxAnim(animKey, prefix, info.count, fxRates[fxName] || 16);
      });
    });
  }

  // Helper : joue un FX propre à un personnage par nom (ex: 'attack1', 'flames')
  // Fallback silencieux si le personnage n'a pas ce FX déclaré
  playCharFx(charDef, fxName, x, y, scale, flipX, depth, delay) {
    if (!charDef.fx[fxName]) return;
    this.playFx('fx_anim_' + charDef.voiceKey + '_' + fxName, x, y, scale, flipX, depth, delay);
  }

  // Play a one-shot FX sprite at a position then destroy
  playFx(animKey, x, y, scale, flipX, depth, delay) {
    const d = delay || 0;
    // Texture key for frame 1: fx_anim_slash -> fx_slash_1
    const texKey = animKey.replace('fx_anim_', 'fx_') + '_1';
    const doPlay = () => {
      const sprite = this.add.sprite(x, y, texKey);
      sprite.setScale(scale || 0.4);
      sprite.setOrigin(0.5, 0.5);
      sprite.setDepth((depth || 200) + 220);
      if (flipX) sprite.setFlipX(true);
      sprite.setBlendMode(Phaser.BlendModes.ADD);
      sprite.play(animKey);
      sprite.once('animationcomplete', () => sprite.destroy());
    };
    if (d > 0) this.time.delayedCall(d, doPlay);
    else doPlay();
  }

  // ---- Hearts pixel-art ----
  drawFilledHeart(gfx, x, y, size, color) {
    const r = size * 0.25;
    const b = 2; // épaisseur bordure
    // Bordure noire
    gfx.fillStyle(0x000000, 1);
    gfx.fillCircle(x - r, y - r * 0.5, r + b);
    gfx.fillCircle(x + r, y - r * 0.5, r + b);
    gfx.fillTriangle(
      x - size * 0.5 - b, y + b,
      x + size * 0.5 + b, y + b,
      x, y + size * 0.5 + b * 1.5
    );
    gfx.fillRect(x - r - b, y - r * 0.5, r * 2 + b * 2, r + b);
    // Cœur coloré
    gfx.fillStyle(color, 1);
    gfx.fillCircle(x - r, y - r * 0.5, r);
    gfx.fillCircle(x + r, y - r * 0.5, r);
    gfx.fillTriangle(
      x - size * 0.5, y,
      x + size * 0.5, y,
      x, y + size * 0.5
    );
    gfx.fillRect(x - r, y - r * 0.5, r * 2, r);
  }

  drawEmptyHeart(gfx, x, y, size, color) {
    const r = size * 0.25;
    const b = 2;
    // Bordure noire (remplie)
    gfx.fillStyle(0x000000, 0.6);
    gfx.fillCircle(x - r, y - r * 0.5, r + b);
    gfx.fillCircle(x + r, y - r * 0.5, r + b);
    gfx.fillTriangle(
      x - size * 0.5 - b, y + b,
      x + size * 0.5 + b, y + b,
      x, y + size * 0.5 + b * 1.5
    );
    gfx.fillRect(x - r - b, y - r * 0.5, r * 2 + b * 2, r + b);
    // Cœur vide (contour coloré)
    gfx.lineStyle(2, color, 0.5);
    gfx.strokeCircle(x - r, y - r * 0.5, r);
    gfx.strokeCircle(x + r, y - r * 0.5, r);
    gfx.beginPath();
    gfx.moveTo(x - size * 0.5, y);
    gfx.lineTo(x, y + size * 0.5);
    gfx.lineTo(x + size * 0.5, y);
    gfx.closePath();
    gfx.strokePath();
  }

  drawHearts() {
    const colorP1 = Phaser.Display.Color.HexStringToColor(this.p1Def.color).color;
    const colorP2 = Phaser.Display.Color.HexStringToColor(this.p2Def.color).color;

    this.p1HeartsGfx.clear();
    for (let i = 0; i < this.p1MaxLives; i++) {
      const hx = 35 + i * (DUEL_HEART_SIZE + 6);
      if (i < this.p1.lives) this.drawFilledHeart(this.p1HeartsGfx, hx, 60, DUEL_HEART_SIZE, colorP1);
      else this.drawEmptyHeart(this.p1HeartsGfx, hx, 60, DUEL_HEART_SIZE, colorP1);
    }

    this.p2HeartsGfx.clear();
    const w = this.cameras.main.width;
    for (let i = 0; i < this.p2MaxLives; i++) {
      const hx = w - 35 - (this.p2MaxLives - 1 - i) * (DUEL_HEART_SIZE + 6);
      if (i < this.p2.lives) this.drawFilledHeart(this.p2HeartsGfx, hx, 60, DUEL_HEART_SIZE, colorP2);
      else this.drawEmptyHeart(this.p2HeartsGfx, hx, 60, DUEL_HEART_SIZE, colorP2);
    }
  }

  updateChargesDisplay() {
    this.p1ChargesText.setText('Charges: ' + this.p1.charges);
    this.p2ChargesText.setText('Charges: ' + this.p2.charges);

    // magic_shield: persistent flame aura + "Spéciale prête !" when ≥3 charges
    const p1Ready = this.p1Def.trait === 'magic_shield' && this.p1.charges >= 3;
    const p2Ready = this.p2Def.trait === 'magic_shield' && this.p2.charges >= 3;

    this.p1SpecialText.setAlpha(p1Ready ? 1 : 0);
    this.p2SpecialText.setAlpha(p2Ready ? 1 : 0);

    if (p1Ready && !this._p1MagicAura) {
      this._p1MagicAura = this.spawnFlameEffect(this.p1Sprite, 'blue', 999999);
    } else if (!p1Ready && this._p1MagicAura) {
      const aura = this._p1MagicAura;
      this._p1MagicAura = null;
      aura.stop();
      this.time.delayedCall(700, () => { aura.destroy(); });
    }

    if (p2Ready && !this._p2MagicAura) {
      this._p2MagicAura = this.spawnFlameEffect(this.p2Sprite, 'blue', 999999);
    } else if (!p2Ready && this._p2MagicAura) {
      const aura = this._p2MagicAura;
      this._p2MagicAura = null;
      aura.stop();
      this.time.delayedCall(700, () => { aura.destroy(); });
    }
  }

  _doCharacterEntrance() {
    this.turnPhase = 'entrance';
    this._p1IntroPlayed = false;
    this._p2IntroPlayed = false;

    const pickAnim = (prefix, charDef) => {
      const s = charDef.sheets;
      const hasRun  = !!s.run;
      const hasWalk = !!s.walk;
      const useRun  = hasRun && (!hasWalk || Math.random() < 0.5);
      if (useRun)  return { anim: 'duel_' + prefix + '_run',  duration: 900 };
      if (hasWalk) return { anim: 'duel_' + prefix + '_walk', duration: 1300 };
      return { anim: 'duel_' + prefix + '_idle', duration: 1100 };
    };

    const e1 = pickAnim('p1', this.p1Def);
    const e2 = pickAnim('p2', this.p2Def);

    // P1 entre en premier
    this.p1Sprite.play(e1.anim);

    this.tweens.add({
      targets: this.p1Sprite,
      x: 320,
      duration: e1.duration,
      ease: 'Linear',
      onComplete: () => {
        this.p1Sprite.play('duel_p1_idle');
        this.p1ChoiceText.setText('?');

        // P2 entre ensuite
        this.p2Sprite.play(e2.anim);

        this.tweens.add({
          targets: this.p2Sprite,
          x: 960,
          duration: e2.duration,
          ease: 'Linear',
          onComplete: () => {
            this.p2Sprite.play('duel_p2_idle');
            this.p2ChoiceText.setText('?');
            if (DISPLAY_SETTINGS.showHints) {
              this.showRules();
            } else {
              this.startTurn();
            }
          },
        });
      },
    });
  }

  _playVoice(charDef, event, delay) {
    const key = 'voice_' + charDef.voiceKey + '_' + event;
    if (!this.cache.audio.exists(key)) return;
    const fn = () => {
      if (this.sound && !this.sound.locked) {
        this.sound.play(key, { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 2) });
      }
    };
    if (delay) { this.time.delayedCall(delay, fn); } else { fn(); }
  }

  // ---- Turn machine ----
  startTurn() {
    this.turnPhase = 'input';
    this.p1.choice = -1;
    this.p2.choice = -1;
    this.p1.ready = false;
    this.p2.ready = false;
    this.p1.attackLevel = 0;
    this.p2.attackLevel = 0;
    if (this.p1.attackTimer) { this.p1.attackTimer.remove(); this.p1.attackTimer = null; }
    if (this.p2.attackTimer) { this.p2.attackTimer.remove(); this.p2.attackTimer = null; }
    this.resultText.setText('');
    this.p1ChoiceText.setText('?').setColor('#ffffff');
    this.p2ChoiceText.setText('?').setColor('#ffffff');
    this.turnText.setText('TOUR ' + this.turnNumber + ' — CHOISISSEZ !');

    // Reset sprites to idle and original positions
    this.p1Sprite.setAlpha(1);
    this.p2Sprite.setAlpha(1);
    this.p1Sprite.x = 320;
    this.p2Sprite.x = 960;
    if (this.p1.lives > 0) this.p1Sprite.play('duel_p1_idle');
    if (this.p2.lives > 0) this.p2Sprite.play('duel_p2_idle');
  }

  setPlayerChoice(player, action) {
    if (this.turnPhase !== 'input') return;
    const pData = player === 1 ? this.p1 : this.p2;
    if (pData.ready) return;
    const choiceText = player === 1 ? this.p1ChoiceText : this.p2ChoiceText;

    const isFrapper = action === DUEL_ACTIONS.FRAPPER || action === DUEL_ACTIONS.FRAPPER2 || action === DUEL_ACTIONS.FRAPPER3 || action === DUEL_ACTIONS.FRAPPER4;

    if (isFrapper) {
      // First press — need at least 1 charge
      if (pData.attackLevel === 0 && pData.charges <= 0) {
        this.flashNoCharge(player === 1 ? 320 : 960);
        return;
      }
      // Samurai: max x3 charges (deals +1 bonus dmg) / mimicry, disguise & magic_shield: max x2
      const playerDef = player === 1 ? this.p1Def : this.p2Def;
      const limitX2 = playerDef.trait === 'mimicry' || playerDef.trait === 'disguise' || playerDef.trait === 'magic_shield';
      const maxAttackLevel = limitX2 ? 2 : 3;
      // Trying to upgrade — need enough charges
      const nextLevel = pData.attackLevel + 1;
      if (nextLevel > maxAttackLevel || nextLevel > pData.charges) {
        // Can't go higher — confirm current level now
        this.confirmAttack(player);
        return;
      }

      pData.attackLevel = nextLevel;

      // Don't reveal the level — just show charging
      choiceText.setText('...').setColor('#ffcc00');

      // Cancel previous timer
      if (pData.attackTimer) { pData.attackTimer.remove(); pData.attackTimer = null; }

      if (nextLevel >= maxAttackLevel || nextLevel >= pData.charges) {
        // Max level or max charges — auto-confirm
        this.confirmAttack(player);
      } else {
        // Wait 800ms for another press, then auto-confirm
        pData.attackTimer = this.time.delayedCall(800, () => {
          if (!pData.ready && pData.attackLevel > 0) {
            this.confirmAttack(player);
          }
        });
      }
      return;
    }

    // Non-frapper action: if player was charging an attack, cancel it
    if (pData.attackLevel > 0) {
      pData.attackLevel = 0;
      if (pData.attackTimer) { pData.attackTimer.remove(); pData.attackTimer = null; }
    }

    pData.choice = action;
    pData.ready = true;
    choiceText.setText('...').setColor('#ffcc00');

    // Check if both ready
    if (this.p1.ready && this.p2.ready) {
      this.lockChoices();
    }
  }

  confirmAttack(player) {
    const pData = player === 1 ? this.p1 : this.p2;
    const choiceText = player === 1 ? this.p1ChoiceText : this.p2ChoiceText;
    if (pData.ready) return;
    if (pData.attackTimer) { pData.attackTimer.remove(); pData.attackTimer = null; }

    const level = pData.attackLevel;
    if (level === 1) pData.choice = DUEL_ACTIONS.FRAPPER;
    else if (level === 2) pData.choice = DUEL_ACTIONS.FRAPPER2;
    else if (level === 3) pData.choice = DUEL_ACTIONS.FRAPPER3;
    else pData.choice = DUEL_ACTIONS.FRAPPER4;

    pData.ready = true;
    choiceText.setText('...').setColor('#ffcc00');

    if (this.p1.ready && this.p2.ready) {
      this.lockChoices();
    }
  }

  flashNoCharge(x) {
    this.noChargeText.setPosition(x, 500);
    this.noChargeText.setText('PAS DE CHARGE !');
    this.noChargeText.setAlpha(1);
    this.tweens.add({
      targets: this.noChargeText,
      alpha: 0,
      duration: 800,
      ease: 'Power2'
    });
  }

  lockChoices() {
    this.turnPhase = 'locked';
    this.p1ChoiceText.setText(DUEL_ACTION_LABELS[this.p1.choice]).setColor('#ffcc00');
    this.p2ChoiceText.setText(DUEL_ACTION_LABELS[this.p2.choice]).setColor('#ffcc00');
    this.turnText.setText('Résolution...');

    this.time.delayedCall(DUEL_RESOLVE_DELAY, () => {
      this.resolveTurn();
    });
  }

  getAttackLevel(action) {
    if (action === DUEL_ACTIONS.FRAPPER) return 1;
    if (action === DUEL_ACTIONS.FRAPPER2) return 2;
    if (action === DUEL_ACTIONS.FRAPPER3) return 3;
    if (action === DUEL_ACTIONS.FRAPPER4) return 4;
    return 0;
  }

  isAttackAction(action) {
    return this.getAttackLevel(action) > 0;
  }

  resolveTurn() {
    const a1 = this.p1.choice;
    const a2 = this.p2.choice;
    let msg = '';

    const R = DUEL_ACTIONS.RECHARGER;
    const P = DUEL_ACTIONS.PROTEGER;
    const f1 = this.isAttackAction(a1);
    const f2 = this.isAttackAction(a2);
    const lvl1 = this.getAttackLevel(a1);
    const lvl2 = this.getAttackLevel(a2);
    // Samurai attack_x4 trait: each hit deals +1 bonus damage
    const dmgBonus1 = this.p1Def.trait === 'attack_x4' && lvl1 > 0 ? 1 : 0;
    const dmgBonus2 = this.p2Def.trait === 'attack_x4' && lvl2 > 0 ? 1 : 0;
    const hit1 = lvl1 + dmgBonus1; // actual damage dealt by P1
    const hit2 = lvl2 + dmgBonus2; // actual damage dealt by P2
    const lbl1 = lvl1 > 1 ? 'super x' + lvl1 : 'frappe';
    const lbl2 = lvl2 > 1 ? 'super x' + lvl2 : 'frappe';

    // Charge gain per recharge (Yurei double_charge trait: 2 instead of 1)
    const p1ChargeGain = this.p1Def.trait === 'double_charge' ? 2 : 1;
    const p2ChargeGain = this.p2Def.trait === 'double_charge' ? 2 : 1;

    // Reset trait flags
    this._p1JumpDodge = false;
    this._p2JumpDodge = false;
    this._p1DisguiseAttack = false;
    this._p2DisguiseAttack = false;
    this._p1MagicAttack = false;
    this._p2MagicAttack = false;

    // magic_shield: Recharger with ≥3 charges = special magic attack
    const p1MagicShield = this.p1Def.trait === 'magic_shield';
    const p2MagicShield = this.p2Def.trait === 'magic_shield';
    const p1MagicAttack = p1MagicShield && a1 === R && this.p1.charges >= 3;
    const p2MagicAttack = p2MagicShield && a2 === R && this.p2.charges >= 3;

    // Kunoichi mimicry trait flags
    const p1Mimicry = this.p1Def.trait === 'mimicry';
    const p2Mimicry = this.p2Def.trait === 'mimicry';

    // --- Magic attack resolution (intercepts before normal matrix) ---
    if (p1MagicAttack || p2MagicAttack) {
      // Apply each magic attack: -3 charges, opponent -1 life, mage +1 life (pierces guard)
      if (p1MagicAttack) {
        this._p1MagicAttack = true;
        this.p1.charges -= 3;
        this.p2.lives -= 1;
        this.p1.lives = Math.min(this.p1.lives + 1, this.p1MaxLives);
      }
      if (p2MagicAttack) {
        this._p2MagicAttack = true;
        this.p2.charges -= 3;
        this.p1.lives -= 1;
        this.p2.lives = Math.min(this.p2.lives + 1, this.p2MaxLives);
      }
      // Handle the other player's action normally alongside the magic attack
      if (p1MagicAttack && p2MagicAttack) {
        msg = 'Double attaque magique ! Les deux perdent 1 vie et se soignent !';
      } else if (p1MagicAttack) {
        if (a2 === R) {
          this.p2.charges += p2ChargeGain;
          msg = 'J1 lance une attaque magique ! J2 -1 vie ! J2 recharge.';
        } else if (a2 === P) {
          msg = 'J1 lance une attaque magique ! Transperce la garde ! J2 -1 vie !';
        } else if (f2) {
          // Opponent attacks normally, magic attack also hits
          this.p1.lives -= hit2; this.p2.charges -= lvl2;
          msg = 'J1 lance une attaque magique ! J2 ' + lbl2 + ' ! Les deux se touchent !';
        }
      } else { // p2MagicAttack
        if (a1 === R) {
          this.p1.charges += p1ChargeGain;
          msg = 'J2 lance une attaque magique ! J1 -1 vie ! J1 recharge.';
        } else if (a1 === P) {
          msg = 'J2 lance une attaque magique ! Transperce la garde ! J1 -1 vie !';
        } else if (f1) {
          // Opponent attacks normally, magic attack also hits
          this.p2.lives -= hit1; this.p1.charges -= lvl1;
          msg = 'J2 lance une attaque magique ! J1 ' + lbl1 + ' ! Les deux se touchent !';
        }
      }
    }
    // Resolution matrix (normal, when no magic attack)
    else if (a1 === R && a2 === R) {
      // Mimicry: same action as opponent → +1 bonus charge
      const p1Bonus = p1Mimicry ? 1 : 0;
      const p2Bonus = p2Mimicry ? 1 : 0;
      this.p1.charges += p1ChargeGain + p1Bonus;
      this.p2.charges += p2ChargeGain + p2Bonus;
      if (p1Bonus || p2Bonus) {
        msg = 'Les deux rechargent ! Kunoichi imite et gagne +1 bonus !';
      } else {
        msg = 'Les deux rechargent !';
      }
    } else if (a1 === R && a2 === P) {
      if (this.p2Def.trait === 'disguise' && this.p2.charges >= 1) {
        // Disguise vs recharge: surprise attack (costs 1 charge)
        this.p2.charges -= 1;
        this.p1.lives -= 1;
        this._p2DisguiseAttack = true;
        msg = 'J2 se déguise et attaque ! J1 -1 vie !';
      } else {
        this.p1.charges += p1ChargeGain;
        this._p2DisguiseAttack = false;
        msg = 'J1 recharge, J2 protège.';
      }
    } else if (a1 === R && f2) {
      // Gotoku jump_dodge: reduce damage by 1 but recharge fails
      let dmg = hit2;
      if (this.p1Def.trait === 'jump_dodge') { dmg = Math.max(0, dmg - 1); this._p1JumpDodge = true; }
      else { this.p1.charges += p1ChargeGain; }
      this.p1.lives -= dmg; this.p2.charges -= lvl2;
      if (dmg === 0) msg = 'J1 esquive ! J2 ' + lbl2 + ' raté !';
      else msg = 'J1 perd ' + dmg + ' vie' + (dmg > 1 ? 's' : '') + ' ! J2 ' + lbl2 + ' !';
    } else if (a1 === P && a2 === R) {
      if (this.p1Def.trait === 'disguise' && this.p1.charges >= 1) {
        // Disguise vs recharge: surprise attack (costs 1 charge)
        this.p1.charges -= 1;
        this.p2.lives -= 1;
        this._p1DisguiseAttack = true;
        msg = 'J1 se déguise et attaque ! J2 -1 vie !';
      } else {
        this.p2.charges += p2ChargeGain;
        this._p1DisguiseAttack = false;
        msg = 'J1 protège, J2 recharge.';
      }
    } else if (a1 === P && a2 === P) {
      const p1Disguise = this.p1Def.trait === 'disguise';
      const p2Disguise = this.p2Def.trait === 'disguise';
      if (p1Disguise && this.p1.lives < DUEL_MAX_LIVES) {
        this.p1.lives += 1;
        this.sound.play('peasant_special', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 2) });
        msg = p2Disguise ? 'Les deux se soignent ! +1 vie chacun !' : 'J1 se soigne ! +1 vie !';
      }
      if (p2Disguise && this.p2.lives < DUEL_MAX_LIVES) {
        this.p2.lives += 1;
        if (!p1Disguise) {
          this.sound.play('peasant_special', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 2) });
          msg = 'J2 se soigne ! +1 vie !';
        }
      }
      // Mimicry: both protect → +1 bonus charge
      if (p1Mimicry) { this.p1.charges += 1; msg = (msg ? msg + ' ' : '') + 'Kunoichi imite et gagne +1 charge !'; }
      if (p2Mimicry) { this.p2.charges += 1; msg = (msg ? msg + ' ' : '') + 'Kunoichi imite et gagne +1 charge !'; }
      if (!msg) msg = 'Les deux protègent. Rien ne se passe.';
    } else if (a1 === P && f2) {
      this.p2.charges -= lvl2;
      if (this.p1Def.trait === 'flight' && this.p1.charges >= 1) {
        this.p1.charges -= 1;
        this.p2.lives -= 1;
        this._p1FlightTriggered = true;
        msg = 'J1 s\'envole et contre-attaque ! J2 -1 vie !';
      } else {
        this._p1FlightTriggered = false;
        msg = 'J1 bloque l\'attaque de J2 !';
      }
    } else if (f1 && a2 === R) {
      // Gotoku jump_dodge: reduce damage by 1 but recharge fails
      let dmg = hit1;
      if (this.p2Def.trait === 'jump_dodge') { dmg = Math.max(0, dmg - 1); this._p2JumpDodge = true; }
      else { this.p2.charges += p2ChargeGain; }
      this.p2.lives -= dmg; this.p1.charges -= lvl1;
      if (dmg === 0) msg = 'J2 esquive ! J1 ' + lbl1 + ' raté !';
      else msg = 'J2 perd ' + dmg + ' vie' + (dmg > 1 ? 's' : '') + ' ! J1 ' + lbl1 + ' !';
    } else if (f1 && a2 === P) {
      this.p1.charges -= lvl1;
      if (this.p2Def.trait === 'flight' && this.p2.charges >= 1) {
        this.p2.charges -= 1;
        this.p1.lives -= 1;
        this._p2FlightTriggered = true;
        msg = 'J2 s\'envole et contre-attaque ! J1 -1 vie !';
      } else {
        this._p2FlightTriggered = false;
        msg = 'J2 bloque l\'attaque de J1 !';
      }
    } else if (f1 && f2) {
      // Shinobi counter trait: lose 1 less life than what the opponent deals
      let dmg1 = hit2;  // damage received by P1
      let dmg2 = hit1;  // damage received by P2
      if (this.p1Def.trait === 'counter') dmg1 = Math.max(0, dmg1 - 1);
      if (this.p2Def.trait === 'counter') dmg2 = Math.max(0, dmg2 - 1);
      this.p1.lives -= dmg1; this.p2.lives -= dmg2;
      this.p1.charges -= lvl1; this.p2.charges -= lvl2;
      // Mimicry: both attack → +1 bonus charge
      if (p1Mimicry) this.p1.charges += 1;
      if (p2Mimicry) this.p2.charges += 1;
      msg = 'Les deux frappent ! J1 -' + dmg1 + ' vie' + (dmg1 > 1 ? 's' : '') + ', J2 -' + dmg2 + ' vie' + (dmg2 > 1 ? 's' : '') + ' !';
      if (p1Mimicry || p2Mimicry) msg += ' Kunoichi imite et gagne +1 charge !';
    }

    // magic_shield: Protéger gives +1 charge only if attacked
    if (p1MagicShield && a1 === P && (f2 || p2MagicAttack)) this.p1.charges += 1;
    if (p2MagicShield && a2 === P && (f1 || p1MagicAttack)) this.p2.charges += 1;

    // Clamp lives and charges to 0
    this.p1.lives = Math.max(0, this.p1.lives);
    this.p2.lives = Math.max(0, this.p2.lives);
    this.p1.charges = Math.max(0, this.p1.charges);
    this.p2.charges = Math.max(0, this.p2.charges);

    this.resultText.setText(msg);
    this.drawHearts();
    this.updateChargesDisplay();

    // Cri du perdant au moment où son dernier coeur disparaît
    if (this.p1.lives <= 0) this._playVoice(this.p1Def, 'lose', 0);
    if (this.p2.lives <= 0) this._playVoice(this.p2Def, 'lose', 0);

    this.playResolveAnimations(a1, a2);
  }

  createFlameTexture() {
    if (this.textures.exists('flame_particle')) return;
    const gfx = this.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(8, 8, 8);
    gfx.generateTexture('flame_particle', 16, 16);
    gfx.destroy();
  }

  spawnFlameEffect(sprite, color, duration) {
    this.createFlameTexture();

    const isBlue = color === 'blue';
    const tint1 = isBlue ? 0x0088ff : 0xff2200;
    const tint2 = isBlue ? 0x00ccff : 0xff8800;
    const tint3 = isBlue ? 0xaaeeff : 0xffcc00;

    const emitter = this.add.particles(sprite.x, sprite.y, 'flame_particle', {
      speed: { min: 40, max: 120 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: { min: 300, max: 600 },
      tint: [tint1, tint2, tint3],
      frequency: 20,
      quantity: 3,
      blendMode: 'ADD',
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-40, -80, 80, 100) },
    });
    emitter.setDepth(320);

    // Follow the sprite
    const followUpdate = this.time.addEvent({
      delay: 16, loop: true,
      callback: () => { emitter.setPosition(sprite.x, sprite.y); }
    });

    // Stop after duration
    this.time.delayedCall(duration, () => {
      emitter.stop();
      followUpdate.remove();
      this.time.delayedCall(700, () => { emitter.destroy(); });
    });

    return emitter;
  }

  playAttackChain(sprite, prefix, level, onDone, charDef) {
    const defaultAnims = ['attack1', 'attack2', 'attack3', 'attack1'];
    const chain = charDef && charDef.attackChain ? charDef.attackChain : defaultAnims;
    const count = charDef && charDef.attackChain ? level + 1 : level;
    let step = 0;
    const playNext = () => {
      if (step >= count || step >= chain.length) { if (onDone) onDone(); return; }
      const animKey = prefix + '_' + chain[step];
      sprite.play(animKey);
      step++;
      if (step < count && step < chain.length) {
        sprite.once('animationcomplete', playNext);
      }
    };
    playNext();
  }

  playResolveAnimations(a1, a2) {
    this.turnPhase = 'animate';

    const P = DUEL_ACTIONS.PROTEGER;
    const f1 = this.isAttackAction(a1);
    const f2 = this.isAttackAction(a2);
    const lvl1 = this.getAttackLevel(a1);
    const lvl2 = this.getAttackLevel(a2);
    const maxLvl = Math.max(lvl1, lvl2, 1);

    // Rush movement constants
    const rushDuration = 300;
    const returnDuration = 300;
    const hasRush = f1 || f2;
    const rush = hasRush ? rushDuration : 0;

    const flameDuration = DUEL_NEXT_TURN_DELAY + rush + returnDuration + (maxLvl - 1) * 400 - 200;

    const p1StartX = this.p1Sprite.x;
    const p2StartX = this.p2Sprite.x;
    const p1y = this.p1Sprite.y - 40;
    const p2y = this.p2Sprite.y - 40;

    // Target positions when rushing
    // Both attack → meet in the middle; only one attacks → rush close to opponent
    const midX = (p1StartX + p2StartX) / 2;
    const bothAttack = f1 && f2;
    const p1TargetX = bothAttack ? midX - 60 : p2StartX - 200;
    const p2TargetX = bothAttack ? midX + 60 : p1StartX + 200;

    // Compute delay before hurt based on attack level (shifted by rush)
    const hurtDelay = rush + 200 + (maxLvl - 1) * 300;

    // Check if run anims exist
    const p1HasRun = this.anims.exists('duel_p1_run');
    const p2HasRun = this.anims.exists('duel_p2_run');

    // --- Rush movement + attack for P1 ---
    if (f1) {
      if (p1HasRun) {
        this.p1Sprite.play('duel_p1_run');
        this.tweens.add({
          targets: this.p1Sprite, x: p1TargetX,
          duration: rushDuration, ease: 'Power2',
          onComplete: () => {
            this.playAttackChain(this.p1Sprite, 'duel_p1', lvl1, null, this.p1Def);
          }
        });
      } else {
        // Fallback: attack in place immediately
        this.playAttackChain(this.p1Sprite, 'duel_p1', lvl1, null, this.p1Def);
      }
      // Voix intro à la première attaque
      if (!this._p1IntroPlayed) { this._p1IntroPlayed = true; this._playVoice(this.p1Def, 'intro', 0); }
      // Attack sound — shifted by rush
      const p1Sfx = this.p1Def.attackSfxKey;
      for (let i = 0; i < lvl1; i++) {
        this.time.delayedCall(hurtDelay + i * 250, () => { this.sound.play(p1Sfx, { volume: AUDIO_SETTINGS.sfxVolume }); });
      }
      // Smoke behind attacker — shifted by rush
      this.playFx('fx_anim_smoke', p1StartX - 60, p1y + 30, 0.35, false, 99, rush);
      if (lvl1 >= 2) {
        this.spawnFlameEffect(this.p1Sprite, 'blue', flameDuration);
        this.playCharFx(this.p1Def, 'attack2', p1StartX, p1y, 0.5, false, 150, rush + 100);
      }
    } else if (a1 === P) {
      // Flight trait: use flight anim instead of shield
      if (this.p1Def.trait === 'flight' && this.anims.exists('duel_p1_flight')) {
        this.p1Sprite.play('duel_p1_flight');
      } else {
        this.p1Sprite.play('duel_p1_shield');
      }
      if (this.p1Def.trait === 'magic_shield') {
        this.sound.play('boss_useless', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 2) });
      }
    }

    // --- Rush movement + attack for P2 ---
    if (f2) {
      if (p2HasRun) {
        this.p2Sprite.play('duel_p2_run');
        this.tweens.add({
          targets: this.p2Sprite, x: p2TargetX,
          duration: rushDuration, ease: 'Power2',
          onComplete: () => {
            this.playAttackChain(this.p2Sprite, 'duel_p2', lvl2, null, this.p2Def);
          }
        });
      } else {
        this.playAttackChain(this.p2Sprite, 'duel_p2', lvl2, null, this.p2Def);
      }
      // Voix intro à la première attaque
      if (!this._p2IntroPlayed) { this._p2IntroPlayed = true; this._playVoice(this.p2Def, 'intro', 0); }
      const p2Sfx = this.p2Def.attackSfxKey;
      for (let i = 0; i < lvl2; i++) {
        this.time.delayedCall(hurtDelay + i * 250, () => { this.sound.play(p2Sfx, { volume: AUDIO_SETTINGS.sfxVolume }); });
      }
      this.playFx('fx_anim_smoke', p2StartX + 60, p2y + 30, 0.35, true, 99, rush);
      if (lvl2 >= 2) {
        this.spawnFlameEffect(this.p2Sprite, 'blue', flameDuration);
        this.playCharFx(this.p2Def, 'attack2', p2StartX, p2y, 0.5, true, 150, rush + 100);
      }
    } else if (a2 === P) {
      // Flight trait: use flight anim instead of shield
      if (this.p2Def.trait === 'flight' && this.anims.exists('duel_p2_flight')) {
        this.p2Sprite.play('duel_p2_flight');
      } else {
        this.p2Sprite.play('duel_p2_shield');
      }
      if (this.p2Def.trait === 'magic_shield') {
        this.sound.play('boss_useless', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 2) });
      }
    }

    // Recharge FX (particle flames only — skip if magic attack)
    const rechargeFxDuration = 1200;
    if (a1 === DUEL_ACTIONS.RECHARGER && !this._p1MagicAttack) {
      this.spawnFlameEffect(this.p1Sprite, 'red', rechargeFxDuration);
    }
    if (a2 === DUEL_ACTIONS.RECHARGER && !this._p2MagicAttack) {
      this.spawnFlameEffect(this.p2Sprite, 'red', rechargeFxDuration);
    }
    // magic_shield: Protéger recharges only when attacked — show flame FX
    if (this.p1Def.trait === 'magic_shield' && a1 === P && (f2 || this._p2MagicAttack)) {
      this.spawnFlameEffect(this.p1Sprite, 'red', rechargeFxDuration);
    }
    if (this.p2Def.trait === 'magic_shield' && a2 === P && (f1 || this._p1MagicAttack)) {
      this.spawnFlameEffect(this.p2Sprite, 'red', rechargeFxDuration);
    }

    // Disguise surprise attack animations
    const disguiseDelay = 600;
    if (this._p1DisguiseAttack) {
      this.sound.play('peasant_special', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 2) });
      this.time.delayedCall(disguiseDelay, () => {
        this.p1Sprite.play('duel_p1_attack1');
        this.sound.play('duel_sword', { volume: AUDIO_SETTINGS.sfxVolume });
      });
      this.playCharFx(this.p2Def, 'attack1', p2StartX, p2y, 0.45, true, 200, disguiseDelay + 300);
      this.time.delayedCall(disguiseDelay + 300, () => {
        if (this.p2.lives > 0) this.p2Sprite.play('duel_p2_hurt');
        else this.p2Sprite.play('duel_p2_dead');
      });
    }
    if (this._p2DisguiseAttack) {
      this.sound.play('peasant_special', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 2) });
      this.time.delayedCall(disguiseDelay, () => {
        this.p2Sprite.play('duel_p2_attack1');
        this.sound.play('duel_sword', { volume: AUDIO_SETTINGS.sfxVolume });
      });
      this.playCharFx(this.p1Def, 'attack1', p1StartX, p1y, 0.45, false, 200, disguiseDelay + 300);
      this.time.delayedCall(disguiseDelay + 300, () => {
        if (this.p1.lives > 0) this.p1Sprite.play('duel_p1_hurt');
        else this.p1Sprite.play('duel_p1_dead');
      });
    }

    // Magic attack animations (magic_shield trait)
    const magicCastDelay = 200;
    const magicProjectileDelay = magicCastDelay + 400;
    const magicTweenDuration = 500;
    const magicImpactDelay = magicProjectileDelay + magicTweenDuration;
    if (this._p1MagicAttack) {
      // Mage plays magic_sphere anim
      this.time.delayedCall(magicCastDelay, () => {
        if (this.anims.exists('duel_p1_magic_sphere')) {
          this.p1Sprite.play('duel_p1_magic_sphere');
        }
      });
      // Spawn projectile and tween toward opponent
      this.time.delayedCall(magicProjectileDelay, () => {
        this.sound.play('magic_spell', { volume: AUDIO_SETTINGS.sfxVolume });
        const projKey = 'duel_' + this.p1Def.folder + '_' + this.p1Def.projectile.sheet;
        const proj = this.add.sprite(p1StartX + 80, this.p1Sprite.y - 40, projKey, 0);
        proj.setScale(DUEL_PLAYER_SCALE);
        proj.setDepth(320);
        if (this.anims.exists('duel_p1_projectile')) proj.play('duel_p1_projectile');
        this.tweens.add({
          targets: proj, x: p2StartX, duration: magicTweenDuration, ease: 'Power2',
          onComplete: () => { proj.destroy(); }
        });
      });
      // Impact: hurt on opponent (no slash FX — projectile IS the visual)
      this.time.delayedCall(magicImpactDelay, () => {
        this.sound.play('duel_sword', { volume: AUDIO_SETTINGS.sfxVolume });
        if (this.p2.lives > 0) this.p2Sprite.play('duel_p2_hurt');
        else this.p2Sprite.play('duel_p2_dead');
      });
    }
    if (this._p2MagicAttack) {
      this.time.delayedCall(magicCastDelay, () => {
        if (this.anims.exists('duel_p2_magic_sphere')) {
          this.p2Sprite.play('duel_p2_magic_sphere');
        }
      });
      this.time.delayedCall(magicProjectileDelay, () => {
        this.sound.play('magic_spell', { volume: AUDIO_SETTINGS.sfxVolume });
        const projKey = 'duel_' + this.p2Def.folder + '_' + this.p2Def.projectile.sheet;
        const proj = this.add.sprite(p2StartX - 80, this.p2Sprite.y - 40, projKey, 0);
        proj.setScale(DUEL_PLAYER_SCALE);
        proj.setFlipX(true);
        proj.setDepth(320);
        if (this.anims.exists('duel_p2_projectile')) proj.play('duel_p2_projectile');
        this.tweens.add({
          targets: proj, x: p1StartX, duration: magicTweenDuration, ease: 'Power2',
          onComplete: () => { proj.destroy(); }
        });
      });
      this.time.delayedCall(magicImpactDelay, () => {
        this.sound.play('duel_sword', { volume: AUDIO_SETTINGS.sfxVolume });
        if (this.p1.lives > 0) this.p1Sprite.play('duel_p1_hurt');
        else this.p1Sprite.play('duel_p1_dead');
      });
    }

    // Who gets hit?
    const p1Hit = f2 && a1 !== P;
    const p2Hit = f1 && a2 !== P;
    const p1Blocked = f2 && a1 === P;
    const p2Blocked = f1 && a2 === P;
    // Flight counter-attack: only if trait triggered (had charges)
    const p1FlightCounter = p1Blocked && !!this._p1FlightTriggered;
    const p2FlightCounter = p2Blocked && !!this._p2FlightTriggered;

    // FX on defenders — slash/impact effects (shifted by rush)
    if (p2Hit) {
      if (lvl1 === 1) {
        this.playCharFx(this.p1Def, 'attack1', p2StartX, p2y, 0.45, true, 200, hurtDelay);
      } else if (lvl1 === 2) {
        this.playCharFx(this.p1Def, 'attack2', p2StartX, p2y, 0.5, true, 200, hurtDelay);
        this.playCharFx(this.p1Def, 'flames',  p2StartX, p2y + 20, 0.4, false, 199, hurtDelay + 100);
      } else if (lvl1 >= 3) {
        this.playCharFx(this.p1Def, 'attack2',  p2StartX - 20, p2y - 20, 0.45, true, 200, hurtDelay);
        this.playCharFx(this.p1Def, 'attack3',  p2StartX + 20, p2y, 0.5, true, 201, hurtDelay + 80);
        this.playCharFx(this.p1Def, 'special',  p2StartX, p2y, 0.55, true, 202, hurtDelay + 150);
        this.playCharFx(this.p1Def, 'flames',   p2StartX, p2y + 20, 0.5, false, 199, hurtDelay + 50);
        if (lvl1 >= 4) {
          this.playCharFx(this.p1Def, 'special', p2StartX - 20, p2y - 10, 0.6, true, 203, hurtDelay + 250);
          this.playCharFx(this.p1Def, 'flames',  p2StartX + 10, p2y, 0.55, false, 204, hurtDelay + 300);
        }
      }
    }
    if (p1Hit) {
      if (lvl2 === 1) {
        this.playCharFx(this.p2Def, 'attack1', p1StartX, p1y, 0.45, false, 200, hurtDelay);
      } else if (lvl2 === 2) {
        this.playCharFx(this.p2Def, 'attack2', p1StartX, p1y, 0.5, false, 200, hurtDelay);
        this.playCharFx(this.p2Def, 'flames',  p1StartX, p1y + 20, 0.4, false, 199, hurtDelay + 100);
      } else if (lvl2 >= 3) {
        this.playCharFx(this.p2Def, 'attack2',  p1StartX + 20, p1y - 20, 0.45, false, 200, hurtDelay);
        this.playCharFx(this.p2Def, 'attack3',  p1StartX - 20, p1y, 0.5, false, 201, hurtDelay + 80);
        this.playCharFx(this.p2Def, 'special',  p1StartX, p1y, 0.55, false, 202, hurtDelay + 150);
        this.playCharFx(this.p2Def, 'flames',   p1StartX, p1y + 20, 0.5, false, 199, hurtDelay + 50);
        if (lvl2 >= 4) {
          this.playCharFx(this.p2Def, 'special', p1StartX + 20, p1y - 10, 0.6, false, 203, hurtDelay + 250);
          this.playCharFx(this.p2Def, 'flames',  p1StartX - 10, p1y, 0.55, false, 204, hurtDelay + 300);
        }
      }
    }

    // Block FX — green slash spark (shifted by rush)
    if (p1Blocked) {
      this.playFx('fx_anim_green_slash', p1StartX + 40, p1y, 0.4, false, 200, hurtDelay);
      this.playFx('fx_anim_smoke2', p1StartX, p1y + 20, 0.3, false, 198, hurtDelay);
    }
    if (p2Blocked) {
      this.playFx('fx_anim_green_slash', p2StartX - 40, p2y, 0.4, true, 200, hurtDelay);
      this.playFx('fx_anim_smoke2', p2StartX, p2y + 20, 0.3, true, 198, hurtDelay);
    }

    // Flight counter-attack: blocker walks toward attacker, then plays attack1
    const counterDelay = hurtDelay + 500;
    const walkDuration = 400;
    if (p1FlightCounter) {
      // P1 (flight) walks toward P2 then counter-attacks
      const p1WalkTarget = p2StartX - 200;
      if (this.p1Def.trait === 'flight') this.sound.play('onre_counter', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 2) });
      this.time.delayedCall(counterDelay, () => {
        const walkAnim = this.anims.exists('duel_p1_walk') ? 'duel_p1_walk' : 'duel_p1_run';
        this.p1Sprite.play(walkAnim);
        this.tweens.add({
          targets: this.p1Sprite, x: p1WalkTarget,
          duration: walkDuration, ease: 'Power2',
          onComplete: () => {
            this.p1Sprite.play('duel_p1_attack1');
            this.sound.play('duel_sword', { volume: AUDIO_SETTINGS.sfxVolume });
          }
        });
      });
      this.playCharFx(this.p1Def, 'attack1', p2StartX, p2y, 0.45, true, 200, counterDelay + walkDuration + 200);
      this.time.delayedCall(counterDelay + walkDuration + 200, () => {
        if (this.p2.lives > 0) this.p2Sprite.play('duel_p2_hurt');
        else this.p2Sprite.play('duel_p2_dead');
      });
      // Walk back after counter-attack
      this.time.delayedCall(counterDelay + walkDuration + 600, () => {
        if (this.p1.lives > 0) {
          const walkAnim = this.anims.exists('duel_p1_walk') ? 'duel_p1_walk' : 'duel_p1_run';
          this.p1Sprite.play(walkAnim);
          this.tweens.add({
            targets: this.p1Sprite, x: p1StartX,
            duration: walkDuration, ease: 'Power2',
            onComplete: () => { this.p1Sprite.play('duel_p1_idle'); }
          });
        }
      });
    }
    if (p2FlightCounter) {
      // P2 (flight) walks toward P1 then counter-attacks
      const p2WalkTarget = p1StartX + 200;
      if (this.p2Def.trait === 'flight') this.sound.play('onre_counter', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 2) });
      this.time.delayedCall(counterDelay, () => {
        const walkAnim = this.anims.exists('duel_p2_walk') ? 'duel_p2_walk' : 'duel_p2_run';
        this.p2Sprite.play(walkAnim);
        this.tweens.add({
          targets: this.p2Sprite, x: p2WalkTarget,
          duration: walkDuration, ease: 'Power2',
          onComplete: () => {
            this.p2Sprite.play('duel_p2_attack1');
            this.sound.play('duel_sword', { volume: AUDIO_SETTINGS.sfxVolume });
          }
        });
      });
      this.playCharFx(this.p2Def, 'attack1', p1StartX, p1y, 0.45, false, 200, counterDelay + walkDuration + 200);
      this.time.delayedCall(counterDelay + walkDuration + 200, () => {
        if (this.p1.lives > 0) this.p1Sprite.play('duel_p1_hurt');
        else this.p1Sprite.play('duel_p1_dead');
      });
      // Walk back after counter-attack
      this.time.delayedCall(counterDelay + walkDuration + 600, () => {
        if (this.p2.lives > 0) {
          const walkAnim = this.anims.exists('duel_p2_walk') ? 'duel_p2_walk' : 'duel_p2_run';
          this.p2Sprite.play(walkAnim);
          this.tweens.add({
            targets: this.p2Sprite, x: p2StartX,
            duration: walkDuration, ease: 'Power2',
            onComplete: () => { this.p2Sprite.play('duel_p2_idle'); }
          });
        }
      });
    }

    // Hurt/dead animations on defenders (shifted by rush)
    // Jump dodge: play jump anim instead of hurt when trait triggers
    if (p1Hit || p2Hit) {
      this.time.delayedCall(hurtDelay, () => {
        if (p1Hit) {
          if (this._p1JumpDodge && this.anims.exists('duel_p1_jump')) {
            this.p1Sprite.play('duel_p1_jump');
            const p1BaseY = this.p1Sprite.y;
            this.tweens.add({
              targets: this.p1Sprite, y: p1BaseY - 150,
              duration: 350, ease: 'Sine.easeOut',
              yoyo: true,
            });
          } else if (this.p1.lives > 0) {
            this.p1Sprite.play('duel_p1_hurt');
          } else {
            this.p1Sprite.play('duel_p1_dead');
          }
        }
        if (p2Hit) {
          if (this._p2JumpDodge && this.anims.exists('duel_p2_jump')) {
            this.p2Sprite.play('duel_p2_jump');
            const p2BaseY = this.p2Sprite.y;
            this.tweens.add({
              targets: this.p2Sprite, y: p2BaseY - 150,
              duration: 350, ease: 'Sine.easeOut',
              yoyo: true,
            });
          } else if (this.p2.lives > 0) {
            this.p2Sprite.play('duel_p2_hurt');
          } else {
            this.p2Sprite.play('duel_p2_dead');
          }
        }
      });
    }

    // Return movement after resolution (skip dead players — let them stay where they fell)
    if (hasRush) {
      this.time.delayedCall(hurtDelay + 400, () => {
        if (f1 && p1HasRun && this.p1.lives > 0) {
          this.p1Sprite.play('duel_p1_run');
          this.tweens.add({
            targets: this.p1Sprite, x: p1StartX,
            duration: returnDuration, ease: 'Power2',
            onComplete: () => { this.p1Sprite.play('duel_p1_idle'); }
          });
        }
        if (f2 && p2HasRun && this.p2.lives > 0) {
          this.p2Sprite.play('duel_p2_run');
          this.tweens.add({
            targets: this.p2Sprite, x: p2StartX,
            duration: returnDuration, ease: 'Power2',
            onComplete: () => { this.p2Sprite.play('duel_p2_idle'); }
          });
        }
      });
    }

    // Wait longer for higher level attacks + rush + magic attack before next turn
    const magicExtra = (this._p1MagicAttack || this._p2MagicAttack) ? magicImpactDelay + 400 : 0;
    const resolveWait = Math.max(DUEL_NEXT_TURN_DELAY + rush + returnDuration + (maxLvl - 1) * 400, magicExtra + DUEL_NEXT_TURN_DELAY);
    this.time.delayedCall(resolveWait, () => {
      if (this.p1.lives <= 0 || this.p2.lives <= 0) {
        this.showGameOver();
      } else {
        this.turnNumber++;
        this.startTurn();
      }
    });
  }

  showGameOver() {
    this.gameOver = true;
    this.turnPhase = 'gameover';

    this.stopDuelMusic();

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.turnText.setText('');
    this.resultText.setText('');
    this.p1ChoiceText.setText('');
    this.p2ChoiceText.setText('');

    const p1Won = this.p2.lives <= 0 && this.p1.lives > 0;

    // Cri du vainqueur — le perdant a déjà crié au moment de la perte du dernier coeur
    if (p1Won) {
      this._playVoice(this.p1Def, 'win', 800);
    } else if (this.p1.lives <= 0) {
      this._playVoice(this.p2Def, 'win', 800);
    }

    // Arcade mode logic
    if (this.arcade) {
      const isLastOpponent = this.arcadeIndex >= this.arcadeOpponents.length - 1;

      if (p1Won && !isLastOpponent) {
        // Won, more opponents remain → next fight
        this.add.text(w / 2, h / 2 - 40, 'VICTOIRE !', {
          fontSize: '52px', fontFamily: 'monospace', color: '#44ff44',
          fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(400);

        this.add.text(w / 2, h / 2 + 30, 'Adversaire suivant...', {
          fontSize: '20px', fontFamily: 'monospace', color: '#cccccc',
        }).setOrigin(0.5).setDepth(400);

        this.time.delayedCall(2500, () => {
          const nextIndex = this.arcadeIndex + 1;
          this.scene.start('DuelScene', {
            p1: this.p1Def,
            p2: this.arcadeOpponents[nextIndex],
            vsAI: true,
            arcade: true,
            arcadeOpponents: this.arcadeOpponents,
            arcadeIndex: nextIndex,
          });
        });
        return;

      } else if (p1Won && isLastOpponent) {
        // Beat the final boss!
        this.add.text(w / 2, h / 2 - 50, 'ARCADE TERMINE !', {
          fontSize: '48px', fontFamily: 'monospace', color: '#ffcc00',
          fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(400);

        this.add.text(w / 2, h / 2 + 20, 'Tous les adversaires vaincus !', {
          fontSize: '22px', fontFamily: 'monospace', color: '#44ff44',
          fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(400);

        this.add.text(w / 2, h / 2 + 60, 'Retour au menu...', {
          fontSize: '16px', fontFamily: 'monospace', color: '#888888',
        }).setOrigin(0.5).setDepth(400);

        this.time.delayedCall(4000, () => {
          this.scene.start('MenuScene');
        });
        return;

      } else {
        // Défaite en arcade → menu recommencer / quitter
        const victories = this.arcadeIndex;
        this.add.text(w / 2, h / 2 - 80, 'DEFAITE', {
          fontSize: '52px', fontFamily: 'monospace', color: '#ff4444',
          fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(400);

        this.add.text(w / 2, h / 2 - 30, 'Victoires : ' + victories + ' / ' + this.arcadeOpponents.length, {
          fontSize: '20px', fontFamily: 'monospace', color: '#cccccc',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(400);

        this._showDefeatMenu(true);
        return;
      }
    }

    // Non-arcade
    let msg;
    if (this.p1.lives <= 0 && this.p2.lives <= 0) {
      msg = 'EGALITE !';
    } else if (p1Won) {
      msg = 'VICTOIRE !';
    } else {
      msg = this.vsAI ? 'IA GAGNE !' : 'JOUEUR 2 GAGNE !';
    }

    this.add.text(w / 2, h / 2 - 80, msg, {
      fontSize: '52px', fontFamily: 'monospace', color: p1Won ? '#44ff88' : '#ff4444',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(400);

    // PvP → retour à la sélection des personnages
    if (!this.vsAI) {
      this.add.text(w / 2, h / 2 + 30, 'Retour à la sélection...', {
        fontSize: '18px', fontFamily: 'monospace', color: '#888888',
      }).setOrigin(0.5).setDepth(400);
      this.time.delayedCall(3000, () => { this.scene.start('DuelSelectScene', { skipToCharSelect: true, vsAI: false }); });
      return;
    }

    // vsAI victoire → retour à la sélection des personnages
    if (p1Won) {
      this.add.text(w / 2, h / 2 + 30, 'Retour à la sélection...', {
        fontSize: '18px', fontFamily: 'monospace', color: '#888888',
      }).setOrigin(0.5).setDepth(400);
      this.time.delayedCall(3000, () => {
        this.scene.start('DuelSelectScene', { skipToCharSelect: true, vsAI: true });
      });
      return;
    }

    // vsAI défaite → menu avec option sélection
    this._showDefeatMenu(false);
  }

  _showDefeatMenu(isArcade) {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Options
    this._defeatOptions = ['RECOMMENCER', 'SÉLECTION', 'QUITTER'];
    this._defeatIndex   = 0;
    this._defeatArcade  = isArcade;
    this._defeatObjects = [];

    const panW = 320, panH = 190;
    const panX = w / 2 - panW / 2;
    const panY = h / 2 + 10;

    const bg = this.add.graphics().setDepth(401);
    bg.fillStyle(0x080810, 0.92);
    bg.fillRoundedRect(panX, panY, panW, panH, 12);
    bg.lineStyle(2, 0x444488, 0.8);
    bg.strokeRoundedRect(panX, panY, panW, panH, 12);
    this._defeatObjects.push(bg);

    this._defeatTexts = this._defeatOptions.map((label, i) => {
      const txt = this.add.text(w / 2, panY + 35 + i * 52, label, {
        fontSize: '26px', fontFamily: 'monospace', color: '#888888',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(402);
      this._defeatObjects.push(txt);
      return txt;
    });

    this._defeatArrow = this.add.text(0, 0, '▶', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ff4444',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(402);
    this._defeatObjects.push(this._defeatArrow);

    const hint = this.add.text(w / 2, panY + panH - 12, '↑↓ Naviguer  |  ENTER Valider', {
      fontSize: '11px', fontFamily: 'monospace', color: '#445544',
    }).setOrigin(0.5, 1).setDepth(402);
    this._defeatObjects.push(hint);

    this._updateDefeatMenu();
    this._defeatMenuActive = true;
  }

  _updateDefeatMenu() {
    this._defeatTexts.forEach((txt, i) => {
      if (i === this._defeatIndex) {
        txt.setColor('#ffffff').setScale(1.1);
        this._defeatArrow.setPosition(txt.x - txt.width * 0.55 - 16, txt.y);
      } else {
        txt.setColor('#666688').setScale(1);
      }
    });
  }

  _confirmDefeatMenu() {
    const choice = this._defeatOptions[this._defeatIndex];
    this._defeatObjects.forEach(o => o.destroy());
    this._defeatMenuActive = false;
    this.stopDuelMusic();
    if (choice === 'RECOMMENCER') {
      if (this._defeatArcade) {
        this.scene.start('DuelScene', {
          p1: this.p1Def,
          p2: this.p2Def,
          vsAI: true,
          arcade: true,
          arcadeOpponents: this.arcadeOpponents,
          arcadeIndex: this.arcadeIndex,
          stageIndex: this.stageIndex,
        });
      } else {
        this.scene.restart({ p1: this.p1Def, p2: this.p2Def, vsAI: true, stageIndex: this.stageIndex });
      }
    } else if (choice === 'SÉLECTION') {
      this.scene.start('DuelSelectScene', { skipToCharSelect: true, vsAI: true });
    } else {
      // QUITTER
      this.sound.play('duel_gameover', { volume: AUDIO_SETTINGS.sfxVolume });
      this.time.delayedCall(1500, () => { this.scene.start('MenuScene'); });
    }
  }

  // ---- Pause menu ----
  showPauseMenu() {
    this.paused = true;
    this.pauseIndex = 0;
    this.pausePhase = 'main'; // 'main' | 'volume' | 'help' | 'chars'
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.88);
    overlay.fillRoundedRect(w / 2 - 280, h / 2 - 310, 560, 620, 14);
    overlay.lineStyle(2, 0x444488, 0.8);
    overlay.strokeRoundedRect(w / 2 - 280, h / 2 - 310, 560, 620, 14);
    overlay.setDepth(600);
    this.pauseObjects.push(overlay);

    const addTxt = (x, y, text, size, color) => {
      const t = this.add.text(x, y, text, {
        fontSize: size, fontFamily: 'monospace', color: color,
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(601);
      this.pauseObjects.push(t);
      return t;
    };

    addTxt(w / 2, h / 2 - 185, 'PAUSE', '32px', '#ff4444');

    // Menu options (hide RECOMMENCER in vs AI)
    this.pauseOptions = ['REPRENDRE', 'VOLUME', 'AIDE', 'PERSONNAGES'];
    if (!this.vsAI) this.pauseOptions.push('RECOMMENCER');
    this.pauseOptions.push('CHANGER PERSOS', 'MENU PRINCIPAL');
    this.pauseTexts = [];
    const count = this.pauseOptions.length;
    const startY = h / 2 - (count - 1) * 24;
    this.pauseOptions.forEach((label, i) => {
      const txt = addTxt(w / 2, startY + i * 48, label, '22px', '#888888');
      this.pauseTexts.push(txt);
    });

    this.pauseArrow = addTxt(0, 0, '▶', '20px', '#ff4444');

    // Volume bars (hidden by default, shown when 'volume' sub-phase)
    addTxt(w / 2 - 140, h / 2 - 80, 'Musique', '16px', '#ffffff').setVisible(false);
    this.pauseMusicLabel = this.pauseObjects[this.pauseObjects.length - 1];
    this.pauseMusicBarBg = this.add.graphics().setDepth(601).setVisible(false);
    this.pauseMusicBarFill = this.add.graphics().setDepth(602).setVisible(false);
    this.pauseMusicValText = addTxt(w / 2 + 170, h / 2 - 80, '', '14px', '#ffcc00');
    this.pauseMusicValText.setVisible(false);
    this.pauseObjects.push(this.pauseMusicBarBg, this.pauseMusicBarFill);

    addTxt(w / 2 - 140, h / 2 - 20, 'Sound Effets', '16px', '#ffffff').setVisible(false);
    this.pauseSfxLabel = this.pauseObjects[this.pauseObjects.length - 1];
    this.pauseSfxBarBg = this.add.graphics().setDepth(601).setVisible(false);
    this.pauseSfxBarFill = this.add.graphics().setDepth(602).setVisible(false);
    this.pauseSfxValText = addTxt(w / 2 + 170, h / 2 - 20, '', '14px', '#ffcc00');
    this.pauseSfxValText.setVisible(false);
    this.pauseObjects.push(this.pauseSfxBarBg, this.pauseSfxBarFill);

    this.pauseVolArrow = addTxt(0, 0, '▶', '16px', '#ff4444');
    this.pauseVolArrow.setVisible(false);

    this.pauseVolHint = addTxt(w / 2, h / 2 + 40, '←→ : Régler  |  ESC : Retour', '12px', '#777799');
    this.pauseVolHint.setVisible(false);

    // Main hint
    this.pauseMainHint = addTxt(w / 2, h / 2 + 280, '↑↓ : Naviguer  |  ENTER : Valider  |  ESC : Reprendre', '12px', '#555577');

    this.updatePauseHighlight();
  }

  updatePauseHighlight() {
    this.pauseTexts.forEach((txt, i) => {
      if (i === this.pauseIndex) {
        txt.setColor('#ffffff'); txt.setScale(1.1);
        this.pauseArrow.setPosition(txt.x - txt.width * 0.55 - 20, txt.y);
      } else {
        txt.setColor('#888888'); txt.setScale(1);
      }
    });
  }

  showPauseVolume() {
    this.pausePhase = 'volume';
    this.pauseVolIndex = 0;
    // Hide main menu items
    this.pauseTexts.forEach(t => t.setVisible(false));
    this.pauseArrow.setVisible(false);
    this.pauseMainHint.setVisible(false);
    // Show volume controls
    this.pauseMusicLabel.setVisible(true);
    this.pauseMusicBarBg.setVisible(true);
    this.pauseMusicBarFill.setVisible(true);
    this.pauseMusicValText.setVisible(true);
    this.pauseSfxLabel.setVisible(true);
    this.pauseSfxBarBg.setVisible(true);
    this.pauseSfxBarFill.setVisible(true);
    this.pauseSfxValText.setVisible(true);
    this.pauseVolArrow.setVisible(true);
    this.pauseVolHint.setVisible(true);
    this.drawPauseBars();
    this.updatePauseVolArrow();
  }

  hidePauseVolume() {
    this.pausePhase = 'main';
    // Show main menu items
    this.pauseTexts.forEach(t => t.setVisible(true));
    this.pauseArrow.setVisible(true);
    this.pauseMainHint.setVisible(true);
    // Hide volume controls
    this.pauseMusicLabel.setVisible(false);
    this.pauseMusicBarBg.setVisible(false);
    this.pauseMusicBarFill.setVisible(false);
    this.pauseMusicValText.setVisible(false);
    this.pauseSfxLabel.setVisible(false);
    this.pauseSfxBarBg.setVisible(false);
    this.pauseSfxBarFill.setVisible(false);
    this.pauseSfxValText.setVisible(false);
    this.pauseVolArrow.setVisible(false);
    this.pauseVolHint.setVisible(false);
    this.updatePauseHighlight();
  }

  showPauseHelp() {
    this.pausePhase = 'help';
    // Hide main menu items
    this.pauseTexts.forEach(t => t.setVisible(false));
    this.pauseArrow.setVisible(false);
    this.pauseMainHint.setVisible(false);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    this.pauseHelpObjects = [];

    const addHelpTxt = (x, y, text, size, color) => {
      const t = this.add.text(x, y, text, {
        fontSize: size, fontFamily: 'monospace', color: color,
        stroke: '#000000', strokeThickness: 3,
        wordWrap: { width: 500 }, align: 'center',
      }).setOrigin(0.5).setDepth(610);
      this.pauseObjects.push(t);
      this.pauseHelpObjects.push(t);
      return t;
    };

    const top = h / 2 - 200;
    addHelpTxt(w / 2, top, 'RÈGLES DU DUEL', '24px', '#ff4444');
    addHelpTxt(w / 2, top + 30, 'Chaque joueur a 3 vies. Dernier debout gagne !', '12px', '#cccccc');

    addHelpTxt(w / 2, top + 58, '── ACTIONS ──', '14px', '#ffcc00');
    addHelpTxt(w / 2, top + 77, 'RECHARGER — Gagne 1 charge', '11px', '#44dd44');
    addHelpTxt(w / 2, top + 93, 'PROTÉGER  — Bloque une attaque', '11px', '#4488ff');
    addHelpTxt(w / 2, top + 109, 'FRAPPER   — Utilise 1 charge, retire 1 vie', '11px', '#ff4444');

    addHelpTxt(w / 2, top + 135, '── SUPER ATTAQUE ──', '14px', '#ff00ff');
    addHelpTxt(w / 2, top + 154, 'Appuyez plusieurs fois sur Frapper !', '11px', '#ddaaff');
    addHelpTxt(w / 2, top + 170, 'x2 = 2 charges  |  x3 = 3 charges (KO !)', '10px', '#ff8844');

    addHelpTxt(w / 2, top + 200, '── TOUCHES ──', '14px', '#ffcc00');
    addHelpTxt(w / 2 - 120, top + 222, 'JOUEUR 1', '12px', this.p1Def.color);
    addHelpTxt(w / 2 - 120, top + 238, '1/A: Recharger', '10px', '#aaaacc');
    addHelpTxt(w / 2 - 120, top + 252, '2/Z: Protéger', '10px', '#aaaacc');
    addHelpTxt(w / 2 - 120, top + 266, '3/E: Frapper (x1/x2/x3)', '10px', '#aaaacc');

    if (!this.vsAI) {
      addHelpTxt(w / 2 + 120, top + 222, 'JOUEUR 2', '12px', this.p2Def.color);
      addHelpTxt(w / 2 + 120, top + 238, '7: Recharger', '10px', '#aaaacc');
      addHelpTxt(w / 2 + 120, top + 252, '8: Protéger', '10px', '#aaaacc');
      addHelpTxt(w / 2 + 120, top + 266, '9: Frapper (x1/x2/x3)', '10px', '#aaaacc');
    } else {
      addHelpTxt(w / 2 + 120, top + 222, 'IA', '12px', this.p2Def.color);
      addHelpTxt(w / 2 + 120, top + 242, 'Joue automatiquement', '10px', '#aaaacc');
    }

    const hint = addHelpTxt(w / 2, top + 310, 'ESC ou ENTER : Retour', '12px', '#555577');
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
  }

  hidePauseHelp() {
    this.pausePhase = 'main';
    // Destroy help texts
    if (this.pauseHelpObjects) {
      this.pauseHelpObjects.forEach(o => { if (o && o.destroy) o.destroy(); });
      this.pauseHelpObjects = [];
    }
    // Show main menu items
    this.pauseTexts.forEach(t => t.setVisible(true));
    this.pauseArrow.setVisible(true);
    this.pauseMainHint.setVisible(true);
    this.updatePauseHighlight();
  }

  showPauseChars() {
    this.pausePhase = 'chars';
    // Hide main menu items
    this.pauseTexts.forEach(t => t.setVisible(false));
    this.pauseArrow.setVisible(false);
    this.pauseMainHint.setVisible(false);

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    this.pauseCharsObjects = [];

    const addCharTxt = (x, y, text, size, color, originX) => {
      const t = this.add.text(x, y, text, {
        fontSize: size, fontFamily: 'monospace', color: color,
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(originX !== undefined ? originX : 0.5, 0.5).setDepth(610);
      this.pauseObjects.push(t);
      this.pauseCharsObjects.push(t);
      return t;
    };

    addCharTxt(w / 2, h / 2 - 280, '── PERSONNAGES ──', '22px', '#ffcc00');

    const allChars = [...Object.values(CHARACTERS), ...Object.values(GHOST_CHARACTERS), ...(CHEAT_SETTINGS.magikUnlocked ? Object.values(HIDDEN_CHARACTERS) : [])];
    const listX = w / 2 - 220;
    let listY = h / 2 - 238;
    const listRowH = 60;

    allChars.forEach(charDef => {
      const spriteKey = 'duel_' + charDef.folder + '_idle';
      if (this.textures.exists(spriteKey)) {
        const spr = this.add.sprite(listX, listY + 8, spriteKey, 0);
        spr.setScale(0.3 * (FRAME_SIZE / charDef.frameSize));
        spr.setDepth(611);
        this.pauseObjects.push(spr);
        this.pauseCharsObjects.push(spr);
      }
      const traitObj = charDef.trait ? TRAIT_LABELS[charDef.trait] : null;
      const shortName = traitObj ? traitObj.short : 'Aucune';
      const descText = traitObj ? traitObj.desc : '';
      addCharTxt(listX + 30, listY - 5, charDef.name.toUpperCase() + '  —  ' + shortName, '12px', charDef.color, 0);
      const desc = this.add.text(listX + 30, listY + 12, descText, {
        fontSize: '10px', fontFamily: 'monospace', color: '#aaddaa',
        stroke: '#000000', strokeThickness: 2,
        wordWrap: { width: 400 },
      }).setOrigin(0, 0).setDepth(610);
      this.pauseObjects.push(desc);
      this.pauseCharsObjects.push(desc);
      listY += listRowH;
    });

    const hint = addCharTxt(w / 2, h / 2 + 280, 'ESC ou ENTER : Retour', '12px', '#555577');
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
  }

  hidePauseChars() {
    this.pausePhase = 'main';
    if (this.pauseCharsObjects) {
      this.pauseCharsObjects.forEach(o => { if (o && o.destroy) o.destroy(); });
      this.pauseCharsObjects = [];
    }
    this.pauseTexts.forEach(t => t.setVisible(true));
    this.pauseArrow.setVisible(true);
    this.pauseMainHint.setVisible(true);
    this.updatePauseHighlight();
  }

  drawPauseBars() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const barX = w / 2 - 50;
    const barW = 180;
    const barH = 14;

    this.pauseMusicBarBg.clear();
    this.pauseMusicBarBg.fillStyle(0x333333, 0.9);
    this.pauseMusicBarBg.fillRoundedRect(barX, h / 2 - 87, barW, barH, 4);
    this.pauseMusicBarFill.clear();
    this.pauseMusicBarFill.fillStyle(0x4488ff, 1);
    const mw = Math.round(barW * AUDIO_SETTINGS.musicVolume);
    if (mw > 0) this.pauseMusicBarFill.fillRoundedRect(barX, h / 2 - 87, mw, barH, 4);
    this.pauseMusicValText.setText(Math.round(AUDIO_SETTINGS.musicVolume * 100) + '%');

    this.pauseSfxBarBg.clear();
    this.pauseSfxBarBg.fillStyle(0x333333, 0.9);
    this.pauseSfxBarBg.fillRoundedRect(barX, h / 2 - 27, barW, barH, 4);
    this.pauseSfxBarFill.clear();
    this.pauseSfxBarFill.fillStyle(0x44dd44, 1);
    const sw = Math.round(barW * AUDIO_SETTINGS.sfxVolume);
    if (sw > 0) this.pauseSfxBarFill.fillRoundedRect(barX, h / 2 - 27, sw, barH, 4);
    this.pauseSfxValText.setText(Math.round(AUDIO_SETTINGS.sfxVolume * 100) + '%');
  }

  updatePauseVolArrow() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const yPositions = [h / 2 - 80, h / 2 - 20];
    this.pauseVolArrow.setPosition(w / 2 - 200, yPositions[this.pauseVolIndex]);
  }

  closePauseMenu() {
    this.paused = false;
    this.pauseObjects.forEach(o => { if (o && o.destroy) o.destroy(); });
    this.pauseObjects = [];
    if (this.duelBgm) this.duelBgm.setVolume(AUDIO_SETTINGS.musicVolume);
  }

  restartMatch() {
    this.closePauseMenu();
    this.stopDuelMusic();
    this.scene.restart({
      p1: this.p1Def,
      p2: this.p2Def,
      vsAI: this.vsAI,
      stageIndex: this.stageIndex
    });
  }

  goToCharSelect() {
    this.closePauseMenu();
    this.stopDuelMusic();
    this.scene.start('DuelSelectScene', { skipToCharSelect: true, vsAI: this.vsAI });
  }

  goToMenu() {
    this.closePauseMenu();
    this.stopDuelMusic();
    this.scene.start('MenuScene');
  }

  stopDuelMusic() {
    if (this.duelBgm && this.duelBgm.isPlaying) this.duelBgm.stop();
  }

  // ---- AI logic ----
  setAIChoice(action) {
    if (this.turnPhase !== 'input' || this.p2.ready) return;
    this.p2.choice = action;
    this.p2.ready = true;
    this.p2ChoiceText.setText('...').setColor('#ffcc00');
    if (this.p1.ready && this.p2.ready) {
      this.lockChoices();
    }
  }

  computeAIChoice() {
    const roll = Math.random();
    const myCharges = this.p2.charges;
    const enemyCharges = this.p1.charges;
    const enemyLives = this.p1.lives;

    const hasBonusDmg = this.p2Def.trait === 'attack_x4';
    const hasMimicry = this.p2Def.trait === 'mimicry';
    const hasDisguise = this.p2Def.trait === 'disguise';
    const hasMagicShield = this.p2Def.trait === 'magic_shield';
    const limitX2 = hasMimicry || hasDisguise || hasMagicShield;
    const maxCharges = limitX2 ? 2 : 3;
    // Samurai deals charges+1 damage, others deal charges damage
    const dmgAt = (charges) => charges + (hasBonusDmg ? 1 : 0);

    // Can finish with super attack?
    if (dmgAt(myCharges) >= enemyLives && myCharges >= 1) {
      if (roll < 0.70) {
        // Find minimum charges needed to kill
        for (let c = 1; c <= Math.min(myCharges, maxCharges); c++) {
          if (dmgAt(c) >= enemyLives) {
            if (c === 1) return DUEL_ACTIONS.FRAPPER;
            if (c === 2) return DUEL_ACTIONS.FRAPPER2;
            if (c === 3) return DUEL_ACTIONS.FRAPPER3;
          }
        }
        return DUEL_ACTIONS.FRAPPER;
      }
    }

    const hasFlight = this.p2Def.trait === 'flight';
    const hasJumpDodge = this.p2Def.trait === 'jump_dodge';

    // magic_shield AI :
    //   Cap 1 — Protéger si ennemi a des charges → +1 charge bonus passif
    //   Cap 2 — Recharger avec ≥3 charges → attaque magique perce-garde + soin
    //   Imprévisible : les probabilités varient selon le contexte mais gardent une variance
    if (hasMagicShield) {
      const enemyThreat = enemyCharges >= 1; // l'ennemi peut frapper → Protéger utile
      if (myCharges >= 3) {
        // Spéciale disponible — priorité haute
        const roll2 = Math.random();
        if (roll2 < 0.75) return DUEL_ACTIONS.RECHARGER;       // attaque magique
        if (enemyThreat && roll2 < 0.90) return DUEL_ACTIONS.PROTEGER; // feinte défensive
        return DUEL_ACTIONS.FRAPPER2;                           // feinte agressive rare
      } else if (myCharges === 2) {
        if (enemyThreat) {
          if (roll < 0.50) return DUEL_ACTIONS.PROTEGER;        // +1 gratuit via cap 1
          if (roll < 0.85) return DUEL_ACTIONS.RECHARGER;
          return DUEL_ACTIONS.FRAPPER2;                         // feinte
        } else {
          // Pas de menace → Protéger inutile, recharger ou feinte
          if (roll < 0.80) return DUEL_ACTIONS.RECHARGER;
          return DUEL_ACTIONS.FRAPPER2;
        }
      } else if (myCharges === 1) {
        if (enemyThreat) {
          if (roll < 0.55) return DUEL_ACTIONS.PROTEGER;        // +1 gratuit via cap 1
          if (roll < 0.88) return DUEL_ACTIONS.RECHARGER;
          return DUEL_ACTIONS.FRAPPER;                          // feinte imprévisible
        } else {
          // Pas de menace → toujours recharger
          return DUEL_ACTIONS.RECHARGER;
        }
      } else {
        // 0 charge
        if (enemyThreat) {
          if (roll < 0.55) return DUEL_ACTIONS.PROTEGER;        // +1 gratuit dès le départ
          return DUEL_ACTIONS.RECHARGER;
        } else {
          // Pas de menace → toujours recharger
          return DUEL_ACTIONS.RECHARGER;
        }
      }
    }

    if (myCharges <= 0 && enemyCharges <= 0) {
      // Flight trait: protect more often to bait counter-attacks
      if (hasFlight && roll < 0.30) return DUEL_ACTIONS.PROTEGER;
      // Disguise: no charges = can't surprise attack, still heal on P vs P
      if (hasDisguise) return roll < 0.35 ? DUEL_ACTIONS.PROTEGER : DUEL_ACTIONS.RECHARGER;
      return DUEL_ACTIONS.RECHARGER;
    } else if (myCharges <= 0) {
      if (hasFlight) return roll < 0.45 ? DUEL_ACTIONS.RECHARGER : DUEL_ACTIONS.PROTEGER;
      // Jump dodge: recharge more boldly since damage is reduced
      if (hasJumpDodge) return roll < 0.75 ? DUEL_ACTIONS.RECHARGER : DUEL_ACTIONS.PROTEGER;
      // Mimicry: mirror enemy — if enemy has no charges they likely recharge too
      if (hasMimicry) return roll < 0.75 ? DUEL_ACTIONS.RECHARGER : DUEL_ACTIONS.PROTEGER;
      // Disguise: no charges = can't surprise attack, recharge first
      if (hasDisguise) return roll < 0.30 ? DUEL_ACTIONS.PROTEGER : DUEL_ACTIONS.RECHARGER;
      return roll < 0.65 ? DUEL_ACTIONS.RECHARGER : DUEL_ACTIONS.PROTEGER;
    } else if (enemyCharges <= 0) {
      // Try super attacks if enough charges
      if (!limitX2 && myCharges >= 3 && roll < 0.25) return DUEL_ACTIONS.FRAPPER3;
      if (!limitX2 && myCharges >= 2 && roll < 0.40) return DUEL_ACTIONS.FRAPPER2;
      if (limitX2 && myCharges >= 2 && roll < 0.40) return DUEL_ACTIONS.FRAPPER2;
      // Mimicry: enemy has no charges, likely to recharge — mirror them
      if (hasMimicry) return roll < 0.60 ? DUEL_ACTIONS.RECHARGER : DUEL_ACTIONS.FRAPPER;
      // Disguise: protect to surprise attack recharging enemy
      if (hasDisguise) return roll < 0.40 ? DUEL_ACTIONS.PROTEGER : (roll < 0.70 ? DUEL_ACTIONS.FRAPPER : DUEL_ACTIONS.RECHARGER);
      return roll < 0.55 ? DUEL_ACTIONS.RECHARGER : DUEL_ACTIONS.FRAPPER;
    } else {
      // Both have charges
      if (!limitX2 && myCharges >= 3 && roll < 0.15) return DUEL_ACTIONS.FRAPPER3;
      if (!limitX2 && myCharges >= 2 && roll < 0.20) return DUEL_ACTIONS.FRAPPER2;
      if (limitX2 && myCharges >= 2 && roll < 0.25) return DUEL_ACTIONS.FRAPPER2;
      if (hasDisguise) {
        if (roll < 0.35) return DUEL_ACTIONS.PROTEGER;
        if (roll < 0.55) return DUEL_ACTIONS.RECHARGER;
        return DUEL_ACTIONS.FRAPPER;
      }
      if (roll < 0.40) return DUEL_ACTIONS.RECHARGER;
      if (roll < 0.60) return DUEL_ACTIONS.PROTEGER;
      return DUEL_ACTIONS.FRAPPER;
    }
  }

  _drawLightningBolt(gfx, x1, y1, x2, y2, color, alpha, segments) {
    gfx.lineStyle(2, color, alpha);
    gfx.beginPath();
    gfx.moveTo(x1, y1);
    const dx = (x2 - x1) / segments;
    const dy = (y2 - y1) / segments;
    for (let i = 1; i < segments; i++) {
      const px = x1 + dx * i + (Math.random() - 0.5) * 60;
      const py = y1 + dy * i + (Math.random() - 0.5) * 30;
      gfx.lineTo(px, py);
    }
    gfx.lineTo(x2, y2);
    gfx.strokePath();
  }

  _spawnBossLightning() {
    if (this.gameOver || !this._bossLightningGfx) return;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const gfx = this._bossLightningGfx;

    // Flash violet via rectangle Graphics (compatible canvas transparent)
    const flashGfx = this.add.graphics().setDepth(499);
    flashGfx.fillStyle(0x6600aa, 0.25);
    flashGfx.fillRect(0, 0, w, h);
    this.time.delayedCall(80, () => { if (flashGfx) flashGfx.destroy(); });

    // Dessiner 2-4 éclairs depuis le haut vers le sol
    gfx.clear();
    const count = Phaser.Math.Between(2, 4);
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(w * 0.1, w * 0.9);
      // Éclair principal (blanc)
      this._drawLightningBolt(gfx, x, 0, x + Phaser.Math.Between(-80, 80), h * 0.75, 0xffffff, 0.9, 12);
      // Halo violet
      this._drawLightningBolt(gfx, x, 0, x + Phaser.Math.Between(-80, 80), h * 0.75, 0xcc44ff, 0.5, 10);
    }

    // Effacer après 120ms
    this.time.delayedCall(120, () => {
      if (gfx) gfx.clear();
    });

    // Prochain éclair dans 1.5–3.5s
    const delay = Phaser.Math.Between(1500, 3500);
    this.time.delayedCall(delay, () => this._spawnBossLightning());
  }

  update() {
    // Menu défaite actif (vsAI / arcade)
    if (this._defeatMenuActive) {
      if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
        this._defeatIndex = (this._defeatIndex + 1) % this._defeatOptions.length;
        this._updateDefeatMenu();
        this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume });
      }
      if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
        this._defeatIndex = (this._defeatIndex - 1 + this._defeatOptions.length) % this._defeatOptions.length;
        this._updateDefeatMenu();
        this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume });
      }
      if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
        this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
        this._confirmDefeatMenu();
      }
      return;
    }

    if (this.gameOver) return;

    // Pause menu handling
    if (this.paused) {
      if (this.pausePhase === 'volume') {
        if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
          this.hidePauseVolume(); return;
        }
        let navChanged = false;
        if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
          this.pauseVolIndex = (this.pauseVolIndex + 1) % 2; navChanged = true;
        }
        if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
          this.pauseVolIndex = (this.pauseVolIndex + 1) % 2; navChanged = true;
        }
        if (navChanged) {
          this.updatePauseVolArrow();
          this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume });
        }
        const step = 0.05;
        if (Phaser.Input.Keyboard.JustDown(this.keyRight)) {
          if (this.pauseVolIndex === 0) AUDIO_SETTINGS.musicVolume = Math.min(1, AUDIO_SETTINGS.musicVolume + step);
          else AUDIO_SETTINGS.sfxVolume = Math.min(1, AUDIO_SETTINGS.sfxVolume + step);
          this.drawPauseBars(); saveSettings();
          if (this.duelBgm) this.duelBgm.setVolume(AUDIO_SETTINGS.musicVolume);
        }
        if (Phaser.Input.Keyboard.JustDown(this.keyLeft)) {
          if (this.pauseVolIndex === 0) AUDIO_SETTINGS.musicVolume = Math.max(0, AUDIO_SETTINGS.musicVolume - step);
          else AUDIO_SETTINGS.sfxVolume = Math.max(0, AUDIO_SETTINGS.sfxVolume - step);
          this.drawPauseBars(); saveSettings();
          if (this.duelBgm) this.duelBgm.setVolume(AUDIO_SETTINGS.musicVolume);
        }
      } else if (this.pausePhase === 'help') {
        if (Phaser.Input.Keyboard.JustDown(this.keyEsc) || Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
          this.hidePauseHelp(); return;
        }
      } else if (this.pausePhase === 'chars') {
        if (Phaser.Input.Keyboard.JustDown(this.keyEsc) || Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
          this.hidePauseChars(); return;
        }
      } else {
        if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
          this.closePauseMenu(); return;
        }
        let changed = false;
        if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
          this.pauseIndex = (this.pauseIndex + 1) % this.pauseOptions.length; changed = true;
        }
        if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
          this.pauseIndex = (this.pauseIndex - 1 + this.pauseOptions.length) % this.pauseOptions.length; changed = true;
        }
        if (changed) {
          this.updatePauseHighlight();
          this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume });
        }
        if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
          this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
          const action = this.pauseOptions[this.pauseIndex];
          if (action === 'REPRENDRE') { this.closePauseMenu(); }
          else if (action === 'VOLUME') { this.showPauseVolume(); }
          else if (action === 'AIDE') { this.showPauseHelp(); }
          else if (action === 'PERSONNAGES') { this.showPauseChars(); }
          else if (action === 'RECOMMENCER') { this.restartMatch(); }
          else if (action === 'CHANGER PERSOS') { this.goToCharSelect(); }
          else if (action === 'MENU PRINCIPAL') { this.goToMenu(); }
        }
      }
      return;
    }

    // ESC to open pause (during input or rules)
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.showPauseMenu(); return;
    }

    // Rules overlay: dismiss on ENTER
    if (this.turnPhase === 'rules') {
      if (Phaser.Input.Keyboard.JustDown(this.rulesKeyEnter)) {
        this.dismissRules();
      }
      return;
    }

    if (this.turnPhase !== 'input') return;

    // P1 input: 1/A = Recharger, 2/Z = Protéger, 3/E = Frapper
    if (Phaser.Input.Keyboard.JustDown(this.keyOne) || Phaser.Input.Keyboard.JustDown(this.keyA)) {
      this.setPlayerChoice(1, DUEL_ACTIONS.RECHARGER);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyTwo) || Phaser.Input.Keyboard.JustDown(this.keyZ)) {
      this.setPlayerChoice(1, DUEL_ACTIONS.PROTEGER);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyThree) || Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.setPlayerChoice(1, DUEL_ACTIONS.FRAPPER);
    }

    // P2 input (PvP) or AI
    if (!this.vsAI) {
      if (Phaser.Input.Keyboard.JustDown(this.keySeven)) {
        this.setPlayerChoice(2, DUEL_ACTIONS.RECHARGER);
      }
      if (Phaser.Input.Keyboard.JustDown(this.keyEight)) {
        this.setPlayerChoice(2, DUEL_ACTIONS.PROTEGER);
      }
      if (Phaser.Input.Keyboard.JustDown(this.keyNine)) {
        this.setPlayerChoice(2, DUEL_ACTIONS.FRAPPER);
      }
    } else {
      // AI plays after P1 chooses
      if (this.p1.ready && !this.p2.ready) {
        this.time.delayedCall(300, () => {
          if (this.turnPhase === 'input' && !this.p2.ready) {
            const aiChoice = this.computeAIChoice();
            this.setAIChoice(aiChoice);
          }
        });
      }
    }
  }
}
