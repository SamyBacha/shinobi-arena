// ============================================================
// Duel Scene
// ============================================================
class DuelScene extends Phaser.Scene {
  constructor() { super('DuelScene'); }

  // Returns the asset folder to use for a character, considering outfit override
  _charAssetFolder(charDef, outfit) {
    if (outfit && outfit.folder) return outfit.folder;
    return charDef.assetFolder;
  }

  // Returns a load key suffix that's unique to the outfit (to avoid texture cache collision)
  _charLoadTag(charDef, outfit) {
    if (outfit && outfit.folder) {
      return charDef.folder + '_outfit_' + outfit.folder.replace(/[^a-zA-Z0-9]/g, '_');
    }
    return charDef.folder;
  }

  // Returns the attack sfx key to use, considering outfit sounds override
  _charAttackSfxKey(charDef, outfit) {
    const s = outfit && outfit.sounds;
    if (s && s.attackSfx) return 'outfit_atk_sfx_' + outfit.folder.replace(/[^a-zA-Z0-9]/g, '_');
    if (s && s.sfxStyle)  return s.sfxStyle === 'punch' ? 'duel_punch' : 'duel_sword';
    return charDef.attackSfxKey;
  }

  // Returns { cachePrefix, folder, voiceKey } for voice loading/playing, considering outfit override
  // sounds.voices = dossier, sounds.voiceKey = nom de base des fichiers (ex: 'Yokai')
  _charVoiceInfo(charDef, outfit) {
    const s = outfit && outfit.sounds;
    if (s && s.voices) {
      const vk = s.voiceKey || charDef.voiceKey;
      return { cachePrefix: 'outfit_voice_' + outfit.folder.replace(/[^a-zA-Z0-9]/g, '_'), folder: s.voices, voiceKey: vk };
    }
    return { cachePrefix: 'voice', folder: charDef.voicesFolder, voiceKey: charDef.voiceKey };
  }

  // Returns true if the character (with given outfit) has a projectile ability
  _charHasProjectile(charDef, outfit) {
    if (charDef.projectile) return true;
    if (outfit && (outfit.projectile1 || outfit.projectile2 || outfit.projectile3)) return true;
    return false;
  }

  init(data) {
    this.p1Def = data.p1;
    this.p2Def = data.p2;
    this.p1Outfit = data.p1Outfit || null;
    this.p2Outfit = data.p2Outfit || null;
    // Mirror match: use alternate color for P2 so they're visually distinct from P1
    this.p2Color = (data.p2Color) || this.p2Def.color;
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

    this.tutorialMode   = data.tutorialMode || false;
    this.tutorialScript = data.tutorialScript || [];
    this.tutorialTurnIdx = 0;

    this.isMobile      = (navigator.maxTouchPoints > 0) || /Mobi|Android/i.test(navigator.userAgent);
    this.showTouchBtns = this.isMobile || DISPLAY_SETTINGS.touchButtons;
  }

  // Sheets present in outfit folders (standard animations only)
  static get OUTFIT_SHEETS() {
    return ['idle', 'idle2', 'walk', 'run', 'jump', 'attack1', 'attack2', 'attack3', 'dead', 'hurt', 'shield', 'magic_sphere', 'charge1', 'fire1', 'fire2'];
  }

  preload() {
    [[this.p1Def, this.p1Outfit], [this.p2Def, this.p2Outfit]].forEach(([charDef, outfit]) => {
      const defaultBase   = charDef.assetFolder;
      const outfitBase    = this._charAssetFolder(charDef, outfit);
      const tag           = this._charLoadTag(charDef, outfit);
      const sheets        = charDef.sheets;
      const fs            = charDef.frameSize;
      const outfitSheets  = DuelScene.OUTFIT_SHEETS;
      const outfitSheetOverrides = (outfit && outfit.sheets) || {};
      // Keys to load: charDef sheets + outfit-only sheets (ex: fire1, fire2)
      const allKeys = new Set([...Object.keys(sheets), ...Object.keys(outfitSheetOverrides)]);
      allKeys.forEach(key => {
        const loadKey = 'duel_' + tag + '_' + key;
        if (!this.textures.exists(loadKey)) {
          const override  = outfitSheetOverrides[key];
          // Use outfit folder only when the outfit explicitly overrides this sheet.
          // If the outfit has a folder but no override for this key, fall back to
          // the base character assets (avoids 404s for partial outfits like Magician).
          const useOutfit = outfit && outfit.folder && outfitSheets.includes(key) && !!override;
          const base      = useOutfit ? outfitBase : defaultBase;
          const sheetDef  = override || sheets[key];
          if (!sheetDef) return; // outfit-only sheet without base fallback — skip if no outfit
          // frameSize: outfit override > projectile override > charDef default
          let fw = fs, fh = fs;
          if (override && override.frameSize) {
            fw = override.frameSize;
            fh = override.frameSize; // projectile frames are square
          } else if (charDef.projectile && key === charDef.projectile.sheet) {
            fw = charDef.projectile.frameSize;
            fh = charDef.projectile.frameSize; // square
          }
          this.load.spritesheet(loadKey, base + sheetDef.file, {
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
    if (!this.textures.exists('peasant_dart')) {
      this.load.image('peasant_dart', peasant.assetFolder + 'Dart.png');
    }
    if (!this.cache.audio.exists('magic_spell')) {
      this.load.audio('magic_spell', 'music/sfx_elemental-magic-spell-impact-outgoing.mp3');
    }

    // Character voices — fichiers optionnels dans {voicesFolder}/{voiceKey}_{event}.mp3
    [[this.p1Def, this.p1Outfit], [this.p2Def, this.p2Outfit]].forEach(([charDef, outfit]) => {
      // Base character voices
      ['intro', 'win', 'lose'].forEach(ev => {
        const key = 'voice_' + charDef.voiceKey + '_' + ev;
        if (!this.cache.audio.exists(key)) {
          this.load.audio(key, charDef.voicesFolder + charDef.voiceKey + '_' + ev + '.mp3');
        }
      });
      // Outfit sound overrides
      const s = outfit && outfit.sounds;
      if (s) {
        // Custom attack sfx
        if (s.attackSfx) {
          const key = 'outfit_atk_sfx_' + outfit.folder.replace(/[^a-zA-Z0-9]/g, '_');
          if (!this.cache.audio.exists(key)) this.load.audio(key, s.attackSfx);
        }
        // Custom voices (sounds.voices = dossier, sounds.voiceKey = nom de base optionnel)
        if (s.voices) {
          const info = this._charVoiceInfo(charDef, outfit);
          ['intro', 'win', 'lose'].forEach(ev => {
            const key = info.cachePrefix + '_' + info.voiceKey + '_' + ev;
            if (!this.cache.audio.exists(key)) {
              this.load.audio(key, info.folder + info.voiceKey + '_' + ev + '.mp3');
            }
          });
        }
      }
    });

    // Stage background chargé comme <img> DOM dans create() via stage.bgPath

    // Mobile button icons
    if (!this.textures.exists('fx_mana'))       this.load.image('fx_mana',       'img/fx/mana.png');
    if (!this.textures.exists('fx_shield'))     this.load.image('fx_shield',     'img/fx/shield.png');
    if (!this.textures.exists('fx_sword'))      this.load.image('fx_sword',      'img/fx/swoard.png');
    if (!this.textures.exists('fx_projection')) this.load.image('fx_projection', 'img/fx/projection.png');
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
    this.createDuelAnims('p1', this.p1Def, this.p1Outfit);
    this.createDuelAnims('p2', this.p2Def, this.p2Outfit);
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
    // life_restore trait: start with 1 charge
    const p1StartCharge = this.p1Def.trait === 'life_restore' ? 1 : 0;
    const p2StartCharge = this.p2Def.trait === 'life_restore' ? 1 : 0;
    this.p1 = { lives: this.p1MaxLives, charges: p1StartCharge, choice: -1, ready: false, def: this.p1Def };
    this.p2 = { lives: this.p2MaxLives, charges: p2StartCharge, choice: -1, ready: false, def: this.p2Def };

    // Sprites — use outfit load tag for texture key
    const p1Tag = this._charLoadTag(this.p1Def, this.p1Outfit);
    const p2Tag = this._charLoadTag(this.p2Def, this.p2Outfit);
    this.p1Sprite = this.add.sprite(-200, 570, 'duel_' + p1Tag + '_idle', 0);
    this.p1Sprite.setScale(this.p1Def.effectiveDuelScale);
    this.p1Sprite.setOrigin(0.5, 0.75);
    this.p1Sprite.setDepth(310);

    this.p2Sprite = this.add.sprite(1480, 570, 'duel_' + p2Tag + '_idle', 0);
    this.p2Sprite.setScale(this.p2Def.effectiveDuelScale);
    this.p2Sprite.setOrigin(0.5, 0.75);
    this.p2Sprite.setFlipX(true);
    this.p2Sprite.setDepth(310);
    // Mirror match: tint P2 sprite avec la couleur alternative
    if (this.p2Color !== this.p2Def.color) {
      const tintColor = Phaser.Display.Color.HexStringToColor(this.p2Color).color;
      this.p2Sprite.setTint(tintColor);
    }

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
      fontSize: '22px', fontFamily: 'monospace', color: this.p2Color,
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

    // HUD backgrounds
    const hudBg = this.add.graphics().setDepth(399);
    hudBg.fillStyle(0x000000, 0.45);
    hudBg.fillRoundedRect(8, 12, 340, 120, 8);
    hudBg.fillRoundedRect(w - 348, 12, 340, 120, 8);

    // Hearts graphics
    this.p1HeartsGfx = this.add.graphics();
    this.p2HeartsGfx = this.add.graphics();
    this.p1HeartsGfx.setDepth(400);
    this.p2HeartsGfx.setDepth(400);
    this.drawHearts();

    // Mana text
    this.p1ChargesText = this.add.text(30, 90, 'Mana: 0', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffcc00',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(400);
    this.p2ChargesText = this.add.text(w - 30, 90, 'Mana: 0', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffcc00',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(400);

    // "Projectile prêt !" / "Contre prêt !" indicators for magic_shield
    this.p1SpecialText = this.add.text(30, 110, '⚡ Projectile prêt !', {
      fontSize: '13px', fontFamily: 'monospace', color: '#55bbff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setDepth(400).setAlpha(0);
    this.p2SpecialText = this.add.text(w - 30, 110, '⚡ Projectile prêt !', {
      fontSize: '13px', fontFamily: 'monospace', color: '#55bbff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(400).setAlpha(0);
    this.p1ShieldText = this.add.text(30, 127, '🛡 Contre prêt !', {
      fontSize: '12px', fontFamily: 'monospace', color: '#aaddff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setDepth(400).setAlpha(0);
    this.p2ShieldText = this.add.text(w - 30, 127, '🛡 Contre prêt !', {
      fontSize: '12px', fontFamily: 'monospace', color: '#aaddff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(400).setAlpha(0);

    // life_restore trait: charge streak indicator
    this.p1StreakText = this.add.text(30, 144, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ff88cc',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setDepth(400).setAlpha(0);
    this.p2StreakText = this.add.text(w - 30, 144, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ff88cc',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(400).setAlpha(0);

    // Turn counter
    this.turnNumber = 1;
    this.turnText = this.add.text(w / 2, 600, 'TOUR 1 — CHOISISSEZ !', {
      fontSize: '24px', fontFamily: 'monospace', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(400);
    if (this.tutorialMode) this.turnText.setAlpha(0);

    // Result text (center, hidden at first)
    this.resultText = this.add.text(w / 2, 360, '', {
      fontSize: '28px', fontFamily: 'monospace', color: '#ffcc00',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(400);

    // Control labels
    if (DISPLAY_SETTINGS.showHints) {
      const p1HasProj = this._charHasProjectile(this.p1Def, this.p1Outfit);
      const p2HasProj = this._charHasProjectile(this.p2Def, this.p2Outfit);
      const p1Hint = '1:Recharger  2:Protéger  3:Frapper(x1/x2/x3)' + (p1HasProj ? '  4/R:Projectile' : '');
      this.add.text(160, 690, p1Hint, {
        fontSize: '11px', fontFamily: 'monospace', color: '#777799',
      }).setOrigin(0.5).setDepth(400);

      if (!this.vsAI) {
        const p2Hint = '7:Recharger  8:Protéger  9:Frapper(x1/x2/x3)' + (p2HasProj ? '  0:Projectile' : '');
        this.add.text(w - 160, 690, p2Hint, {
          fontSize: '11px', fontFamily: 'monospace', color: '#777799',
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
    this.keyFour = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    // Keys for P2
    this.keySeven = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SEVEN);
    this.keyEight = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.EIGHT);
    this.keyNine = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NINE);
    this.keyZero = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO);

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

    if (this.showTouchBtns) this._createMobileButtons();
    if (this.tutorialMode) this._createTutorialOverlay();
  }

  showRules() {
    if (this.tutorialMode) { this.startTurn(); return; }
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
    addTxt(w / 2, 148, 'RECHARGER — Gagne 1 mana', '14px', '#44dd44');
    addTxt(w / 2, 168, 'PROTÉGER  — Bloque une attaque', '14px', '#4488ff');
    addTxt(w / 2, 188, 'FRAPPER   — Utilise 1 mana, retire 1 vie', '14px', '#ff4444');

    const p1HasProj = this._charHasProjectile(this.p1Def, this.p1Outfit);
    const p2HasProj = this._charHasProjectile(this.p2Def, this.p2Outfit);
    if (p1HasProj || p2HasProj) {
      addTxt(w / 2, 208, 'PROJECTILE — 4 mana, perce la garde (1 vie), sinon 2 vies', '13px', '#cc88ff');
    }

    // Super attack
    const superY = (p1HasProj || p2HasProj) ? 232 : 220;
    addTxt(w / 2, superY, '── SUPER ATTAQUE ──', '18px', '#ff00ff');
    addTxt(w / 2, superY + 23, 'Appuyez plusieurs fois sur Frapper pour charger !', '14px', '#ddaaff');
    addTxt(w / 2, superY + 43, 'x2 = 2 mana, retire 2 vies', '13px', '#ff8844');
    addTxt(w / 2, superY + 63, 'x3 = 3 mana, retire 3 vies (KO direct !)', '13px', '#ff00ff');

    // Key rule
    addTxt(w / 2, superY + 92, 'Frapper nécessite au moins 1 mana !', '14px', '#ff6666');

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
    addTxt(w / 2 + 180, 370, this.p2Def.name.toUpperCase(), '14px', this.p2Color);
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
    if (this._charHasProjectile(this.p1Def, this.p1Outfit)) {
      addTxt(w / 2 - 180, 559, '4 ou R : Projectile', '13px', '#cc88ff');
    }

    if (!this.vsAI) {
      addTxt(w / 2 + 180, 477, 'JOUEUR 2', '16px', this.p2Color);
      addTxt(w / 2 + 180, 499, '7 : Recharger', '13px', '#aaaacc');
      addTxt(w / 2 + 180, 519, '8 : Protéger', '13px', '#aaaacc');
      addTxt(w / 2 + 180, 539, '9 : Frapper (x1/x2/x3)', '13px', '#aaaacc');
      if (this._charHasProjectile(this.p2Def, this.p2Outfit)) {
        addTxt(w / 2 + 180, 559, '0 : Projectile', '13px', '#cc88ff');
      }
    } else {
      addTxt(w / 2 + 180, 477, 'IA', '16px', this.p2Color);
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

  createDuelAnims(prefix, charDef, outfit) {
    const s = charDef.sheets;
    const loadTag = this._charLoadTag(charDef, outfit);
    const tag = 'duel_' + prefix;
    // Sheet overrides from outfit (ex: different frame counts for magic_sphere, charge1)
    const ov = (outfit && outfit.sheets) || {};
    const frames = key => (ov[key] ? ov[key].frames : s[key].frames);
    const fps    = (key, defaultRate) => (ov[key] && ov[key].frameRate) ? ov[key].frameRate : defaultRate;

    const makeAnim = (name, sheetKey, fr, rate, rep) => {
      const animKey = tag + '_' + name;
      if (this.anims.exists(animKey)) this.anims.remove(animKey);
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers('duel_' + loadTag + '_' + sheetKey, {
          start: 0, end: fr - 1
        }),
        frameRate: rate, repeat: rep
      });
    };

    makeAnim('idle',  'idle',  frames('idle'),  8, -1);
    // idle2 : uniquement pour les Yokai — supprimer toujours l'ancienne anim pour éviter les résidus de session précédente
    if (s.idle2 || ov.idle2) {
      makeAnim('idle2', 'idle2', frames('idle2'), 8, 0);
    } else {
      const idle2Key = tag + '_idle2';
      if (this.anims.exists(idle2Key)) this.anims.remove(idle2Key);
    }
    if (s.walk) makeAnim('walk', 'walk', frames('walk'), 10, -1);
    if (s.run)  makeAnim('run',  'run',  frames('run'),  10, -1);
    makeAnim('attack1', 'attack1', frames('attack1'), fps('attack1', 12), 0);
    makeAnim('attack2', 'attack2', frames('attack2'), fps('attack2', 10), 0);
    makeAnim('attack3', 'attack3', frames('attack3'), fps('attack3', 10), 0);
    if (s.shield || ov.shield) makeAnim('shield', 'shield', frames('shield'), 8, -1);
    if (s.flight) makeAnim('flight', 'flight', frames('flight'), 10, -1);
    if (s.jump)   makeAnim('jump',   'jump',   frames('jump'),   10, 0);
    makeAnim('hurt', 'hurt', frames('hurt'), 6, 0);
    makeAnim('dead', 'dead', frames('dead'), 4, 0);
    if (s.magic_sphere) makeAnim('magic_sphere', 'magic_sphere', frames('magic_sphere'), 14, 0);
    if (charDef.projectile) {
      const projFrames = ov[charDef.projectile.sheet] ? ov[charDef.projectile.sheet].frames : charDef.projectile.frames;
      makeAnim('projectile', charDef.projectile.sheet, projFrames, 12, -1);
    }
    // Outfit-specific projectiles (Kitsune fire1/fire2)
    const p1def  = outfit && outfit.projectile1;
    const p2def  = outfit && outfit.projectile2;
    if (p1def && (ov[p1def.sheet] || s[p1def.sheet])) {
      const fr = ov[p1def.sheet] ? ov[p1def.sheet].frames : p1def.frames;
      makeAnim('projectile1', p1def.sheet, fr, 12, -1);
    }
    if (p2def && (ov[p2def.sheet] || s[p2def.sheet])) {
      const fr = ov[p2def.sheet] ? ov[p2def.sheet].frames : p2def.frames;
      makeAnim('projectile2', p2def.sheet, fr, 12, -1);
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

  // ---- Idle cycle (Yokai: idle×2 → pause 1s → idle2 → repeat) ----
  // Démarre le cycle d'animation idle pour un joueur.
  // Pour les persos sans idle2, équivalent à sprite.play('duel_pX_idle').
  _startIdleCycle(playerNum) {
    const prefix  = 'duel_p' + playerNum;
    const sprite  = playerNum === 1 ? this.p1Sprite : this.p2Sprite;
    const charDef = playerNum === 1 ? this.p1Def    : this.p2Def;
    const outfit  = playerNum === 1 ? this.p1Outfit : this.p2Outfit;
    const timerKey = '_p' + playerNum + 'IdleTimer';

    // Annuler tout cycle précédent
    if (this[timerKey]) { this[timerKey].remove(false); this[timerKey] = null; }

    const hasIdle2 = this.anims.exists(prefix + '_idle2');
    // Yokai : idle2 existe mais on ne l'enchaîne pas (vibrage lié aux assets)
    const isYokai = charDef.folder === 'Yokai';

    if (!hasIdle2 || isYokai) {
      sprite.play(prefix + '_idle');
      return;
    }

    // Cycle : joue idle en boucle (-1) deux fois la durée d'un cycle,
    // puis s'arrête, attend 1s, joue idle2 une fois, puis reprend idle.
    let loopCount = 0;
    const idleFrames = charDef.sheets.idle2 ? charDef.sheets.idle2 : // shouldn't be needed
      ((outfit && outfit.sheets && outfit.sheets.idle) ? outfit.sheets.idle : charDef.sheets.idle);
    // Durée d'un cycle idle complet (frames × 1000ms / frameRate)
    const idleAnim   = this.anims.get(prefix + '_idle');
    const idle2Anim  = this.anims.get(prefix + '_idle2');
    const idleDur    = idleAnim  ? (idleAnim.frames.length  / (idleAnim.frameRate  || 8)) * 1000 : 800;
    const idle2Dur   = idle2Anim ? (idle2Anim.frames.length / (idle2Anim.frameRate || 8)) * 1000 : 600;

    const startCycle = () => {
      // S'assurer que le sprite est toujours en vie et en idle
      if (this.gameOver) return;
      const pData = playerNum === 1 ? this.p1 : this.p2;
      if (pData.lives <= 0) return;

      loopCount = 0;
      sprite.play(prefix + '_idle');

      // Après 2 cycles d'idle : stopper l'anim, attendre 1s, jouer idle2
      const twoCycles = idleDur * 2;
      this[timerKey] = this.time.delayedCall(twoCycles, () => {
        this[timerKey] = null;
        if (this.gameOver) return;
        const pData2 = playerNum === 1 ? this.p1 : this.p2;
        if (pData2.lives <= 0) return;
        // Vérifier que le sprite joue encore l'idle (pas une autre anim lancée entre-temps)
        const currentAnim = sprite.anims && sprite.anims.currentAnim;
        if (!currentAnim || currentAnim.key !== prefix + '_idle') return;

        sprite.stop(); // pause visuelle (reste sur la dernière frame)

        this[timerKey] = this.time.delayedCall(1000, () => {
          this[timerKey] = null;
          if (this.gameOver) return;
          const pData3 = playerNum === 1 ? this.p1 : this.p2;
          if (pData3.lives <= 0) return;
          const currentAnim2 = sprite.anims && sprite.anims.currentAnim;
          // Si une autre anim s'est lancée pendant la pause, ne pas reprendre
          if (currentAnim2 && currentAnim2.key !== prefix + '_idle') return;

          sprite.play(prefix + '_idle2');
          sprite.once('animationcomplete', () => {
            // Recommencer le cycle depuis le début
            startCycle();
          });
        });
      });
    };

    startCycle();
  }

  // Joue l'idle d'un joueur (démarre le cycle si idle2 existe, sinon idle normal)
  _playIdle(playerNum) {
    const prefix = 'duel_p' + playerNum;
    const sprite = playerNum === 1 ? this.p1Sprite : this.p2Sprite;
    // Annuler tout cycle en cours
    const timerKey = '_p' + playerNum + 'IdleTimer';
    if (this[timerKey]) { this[timerKey].remove(false); this[timerKey] = null; }

    if (this.anims.exists(prefix + '_idle2')) {
      this._startIdleCycle(playerNum);
    } else {
      sprite.play(prefix + '_idle');
    }
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
    gfx.fillStyle(0x000000, 1);
    gfx.fillCircle(x - r, y - r * 0.5, r + b);
    gfx.fillCircle(x + r, y - r * 0.5, r + b);
    gfx.fillTriangle(
      x - size * 0.5 - b, y + b,
      x + size * 0.5 + b, y + b,
      x, y + size * 0.5 + b * 1.5
    );
    gfx.fillRect(x - r - b, y - r * 0.5, r * 2 + b * 2, r + b);
    // Cœur vide (contour coloré)
    gfx.lineStyle(2, color, 0.9);
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
    const colorP2 = Phaser.Display.Color.HexStringToColor(this.p2Color).color;

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
    this.p1ChargesText.setText('Mana: ' + this.p1.charges);
    this.p2ChargesText.setText('Mana: ' + this.p2.charges);

    // magic_shield: persistent flame aura + "Projectile prêt !" when ≥4 mana, "Contre prêt !" when ≥1
    const p1KitsuneDisp = !!(this.p1Outfit && this.p1Outfit.projectile1);
    const p2KitsuneDisp = !!(this.p2Outfit && this.p2Outfit.projectile1);

    const p1Ready  = this.p1Def.trait === 'magic_shield' && this.p1.charges >= 4;
    const p2Ready  = this.p2Def.trait === 'magic_shield' && this.p2.charges >= 4;
    const p1Shield = this.p1Def.trait === 'magic_shield' && this.p1.charges >= 1 && !p1Ready;
    const p2Shield = this.p2Def.trait === 'magic_shield' && this.p2.charges >= 1 && !p2Ready;

    // Kitsune: show projectile readiness based on mana threshold
    const p1KitsuneReady2 = p1KitsuneDisp && this.p1.charges >= 4;
    const p1KitsuneReady1 = p1KitsuneDisp && this.p1.charges >= 3 && !p1KitsuneReady2;
    const p2KitsuneReady2 = p2KitsuneDisp && this.p2.charges >= 4;
    const p2KitsuneReady1 = p2KitsuneDisp && this.p2.charges >= 3 && !p2KitsuneReady2;

    if (p1KitsuneReady2) {
      this.p1SpecialText.setText('⚡ Projectile x2 prêt !').setAlpha(1);
    } else if (p1KitsuneReady1) {
      this.p1SpecialText.setText('⚡ Projectile x1 prêt !').setAlpha(1);
    } else if (p1Ready) {
      this.p1SpecialText.setText('⚡ Projectile prêt !').setAlpha(1);
    } else {
      this.p1SpecialText.setAlpha(0);
    }

    if (p2KitsuneReady2) {
      this.p2SpecialText.setText('⚡ Projectile x2 prêt !').setAlpha(1);
    } else if (p2KitsuneReady1) {
      this.p2SpecialText.setText('⚡ Projectile x1 prêt !').setAlpha(1);
    } else if (p2Ready) {
      this.p2SpecialText.setText('⚡ Projectile prêt !').setAlpha(1);
    } else {
      this.p2SpecialText.setAlpha(0);
    }

    this.p1ShieldText.setAlpha(p1Shield ? 1 : 0);
    this.p2ShieldText.setAlpha(p2Shield ? 1 : 0);

    // life_restore trait: indicateur soin disponible (mana >= 4)
    if (this.p1Def.trait === 'life_restore' && !p1KitsuneDisp) {
      if (this.p1.charges >= 4 && this.p1.lives < this.p1MaxLives) {
        this.p1StreakText.setText('❤ Soin prêt !');
        this.p1StreakText.setAlpha(1);
      } else if (this.p1.lives < this.p1MaxLives) {
        this.p1StreakText.setText('Mana ' + this.p1.charges + '/4 → +1 vie');
        this.p1StreakText.setAlpha(1);
      } else {
        this.p1StreakText.setAlpha(0);
      }
    } else {
      this.p1StreakText.setAlpha(0);
    }
    if (this.p2Def.trait === 'life_restore' && !p2KitsuneDisp) {
      if (this.p2.charges >= 4 && this.p2.lives < this.p2MaxLives) {
        this.p2StreakText.setText('❤ Soin prêt !');
        this.p2StreakText.setAlpha(1);
      } else if (this.p2.lives < this.p2MaxLives) {
        this.p2StreakText.setText('Mana ' + this.p2.charges + '/4 → +1 vie');
        this.p2StreakText.setAlpha(1);
      } else {
        this.p2StreakText.setAlpha(0);
      }
    } else {
      this.p2StreakText.setAlpha(0);
    }

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

    if (this.showTouchBtns) this._refreshMobileBtnStates();
  }

  _doCharacterEntrance() {
    this.turnPhase = 'entrance';
    this._p1IntroPlayed = false;
    this._p2IntroPlayed = false;

    const pickAnim = (prefix, charDef) => {
      const s = charDef.sheets;
      const hasRun  = !!s.run;
      const hasWalk = !!s.walk;
      const hasJump = !!s.jump;
      // Build pool of available entrance animations
      const pool = [];
      if (hasRun)  pool.push({ anim: 'duel_' + prefix + '_run',  duration: 900  });
      if (hasWalk) pool.push({ anim: 'duel_' + prefix + '_walk', duration: 1300 });
      if (hasJump) pool.push({ anim: 'duel_' + prefix + '_jump', duration: 1100 });
      if (pool.length === 0) return { anim: 'duel_' + prefix + '_idle', duration: 1100 };
      return pool[Math.floor(Math.random() * pool.length)];
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
        this._playIdle(1);
        this.p1ChoiceText.setText('?');

        // P2 entre ensuite
        this.p2Sprite.play(e2.anim);

        this.tweens.add({
          targets: this.p2Sprite,
          x: 960,
          duration: e2.duration,
          ease: 'Linear',
          onComplete: () => {
            this._playIdle(2);
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

  _playVoice(charDef, event, delay, outfit) {
    const info = this._charVoiceInfo(charDef, outfit);
    const key  = info.cachePrefix + '_' + info.voiceKey + '_' + event;
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
    this.updateChargesDisplay();

    // Reset sprites to idle and original positions
    this.p1Sprite.setAlpha(1);
    this.p2Sprite.setAlpha(1);
    this.p1Sprite.x = 320;
    this.p2Sprite.x = 960;
    if (this.p1.lives > 0) this._playIdle(1);
    if (this.p2.lives > 0) this._playIdle(2);

    if (this.tutorialMode) this._updateTutorialOverlay();
    if (this.showTouchBtns) this._updateMobileBtns();
  }

  setPlayerChoice(player, action) {
    if (this.turnPhase !== 'input') return;
    const pData = player === 1 ? this.p1 : this.p2;
    if (pData.ready) return;
    const choiceText = player === 1 ? this.p1ChoiceText : this.p2ChoiceText;

    const isFrapper = action === DUEL_ACTIONS.FRAPPER || action === DUEL_ACTIONS.FRAPPER2 || action === DUEL_ACTIONS.FRAPPER3 || action === DUEL_ACTIONS.FRAPPER4;
    const isProjectile = action === DUEL_ACTIONS.PROJECTILE || action === DUEL_ACTIONS.PROJECTILE2;

    // Projectile action
    if (isProjectile) {
      const playerDef = player === 1 ? this.p1Def : this.p2Def;
      const playerOutfit = player === 1 ? this.p1Outfit : this.p2Outfit;
      if (!this._charHasProjectile(playerDef, playerOutfit)) return; // not available
      // Kitsune: projectile x1 at 3 charges, x2 at 4 charges
      const isKitsune = !!(playerOutfit && (playerOutfit.projectile1 || playerOutfit.projectile2));
      const projCost = isKitsune ? 3 : 4;
      if (pData.charges < projCost) {
        this.flashNoCharge(player === 1 ? 320 : 960);
        return;
      }
      // Kitsune can do x2 at 4 charges; everyone else does x1 only
      if (isKitsune && pData.charges >= 4) {
        pData.choice = DUEL_ACTIONS.PROJECTILE2;
      } else {
        pData.choice = DUEL_ACTIONS.PROJECTILE;
      }
      pData.ready = true;
      choiceText.setText('...').setColor('#cc88ff');
      if (this.showTouchBtns) this._updateMobileBtns();
      if (this.p1.ready && this.p2.ready) this.lockChoices();
      return;
    }

    if (isFrapper) {
      // First press — need at least 1 charge
      if (pData.attackLevel === 0 && pData.charges <= 0) {
        this.flashNoCharge(player === 1 ? 320 : 960);
        return;
      }
      // mimicry, disguise & magic_shield: max x2 / others (including life_restore): max x3
      // Kitsune (outfit with projectile1): max x1 for Frapper
      const playerDef = player === 1 ? this.p1Def : this.p2Def;
      const playerOutfit = player === 1 ? this.p1Outfit : this.p2Outfit;
      const isKitsuneOutfit = !!(playerOutfit && playerOutfit.projectile1);
      const limitX2 = playerDef.trait === 'mimicry' || playerDef.trait === 'disguise' || playerDef.trait === 'magic_shield';
      const maxAttackLevel = isKitsuneOutfit ? 1 : (limitX2 ? 2 : 3);
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
    if (player === 1) this._updateMobileBtns();

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
    if (player === 1) this._updateMobileBtns();

    if (this.p1.ready && this.p2.ready) {
      this.lockChoices();
    }
  }

  flashNoCharge(x) {
    this.noChargeText.setPosition(x, 500);
    this.noChargeText.setText('PAS DE MANA !');
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

  getProjectileLevel(action) {
    if (action === DUEL_ACTIONS.PROJECTILE) return 1;
    if (action === DUEL_ACTIONS.PROJECTILE2) return 2;
    return 0;
  }

  isProjectileAction(action) {
    return this.getProjectileLevel(action) > 0;
  }

  resolveTurn() {
    const a1 = this.p1.choice;
    const a2 = this.p2.choice;
    let msg = '';

    const R = DUEL_ACTIONS.RECHARGER;
    const P = DUEL_ACTIONS.PROTEGER;
    const f1 = this.isAttackAction(a1);
    const f2 = this.isAttackAction(a2);
    const proj1 = this.isProjectileAction(a1);
    const proj2 = this.isProjectileAction(a2);
    const projLvl1 = this.getProjectileLevel(a1);
    const projLvl2 = this.getProjectileLevel(a2);
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
    this._p1ShieldCounter = false;
    this._p2ShieldCounter = false;
    this._p1LifeRestore = false;
    this._p2LifeRestore = false;
    this._p1ProjectileFired = false;
    this._p2ProjectileFired = false;
    this._p1ProjectileLevel = 0;
    this._p2ProjectileLevel = 0;
    this._projCancel = false;

    const p1MagicShield = this.p1Def.trait === 'magic_shield';
    const p2MagicShield = this.p2Def.trait === 'magic_shield';

    // Kunoichi mimicry trait flags
    const p1Mimicry = this.p1Def.trait === 'mimicry';
    const p2Mimicry = this.p2Def.trait === 'mimicry';

    // Resolution matrix
    if (a1 === R && a2 === R) {
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
      if (p1Mimicry) { this.p1.charges += 1; msg = (msg ? msg + ' ' : '') + 'Kunoichi imite et gagne +1 mana !'; }
      if (p2Mimicry) { this.p2.charges += 1; msg = (msg ? msg + ' ' : '') + 'Kunoichi imite et gagne +1 mana !'; }
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
      // magic_shield: bouclier électrique — contre-attaque si ≥1 charge (en sus du +1 charge passif)
      if (p1MagicShield && this.p1.charges >= 1) {
        this.p1.charges -= 1;
        this.p2.lives -= 1;
        this._p1ShieldCounter = true;
        msg = 'J1 pare et contre-attaque magique ! J2 -1 vie !';
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
      // magic_shield: bouclier électrique — contre-attaque si ≥1 charge
      if (p2MagicShield && this.p2.charges >= 1) {
        this.p2.charges -= 1;
        this.p1.lives -= 1;
        this._p2ShieldCounter = true;
        msg = 'J2 pare et contre-attaque magique ! J1 -1 vie !';
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
      if (p1Mimicry || p2Mimicry) msg += ' Kunoichi imite et gagne +1 mana !';
    }

    // magic_shield: Protéger gives +1 mana only if attacked (melee or projectile)
    if (p1MagicShield && a1 === P && (f2 || proj2)) this.p1.charges += 1;
    if (p2MagicShield && a2 === P && (f1 || proj1)) this.p2.charges += 1;

    // Projectile action resolution (separate from melee attack matrix)
    // Kitsune: cost 3 (x1) or 4 (x2); Standard: cost 4 (x1 only)
    // vs Protect: 1 damage; vs anything else: projLvl damages
    // Both fire projectiles simultaneously → annulation : perte de mana seulement, aucun dégât
    if (proj1 && proj2) {
      const isKitsuneP1b = !!(this.p1Outfit && this.p1Outfit.projectile1);
      const isKitsuneP2b = !!(this.p2Outfit && this.p2Outfit.projectile1);
      const cost1b = isKitsuneP1b ? (projLvl1 >= 2 ? 4 : 3) : 4;
      const cost2b = isKitsuneP2b ? (projLvl2 >= 2 ? 4 : 3) : 4;
      this.p1.charges -= cost1b;
      this.p2.charges -= cost2b;
      this._p1ProjectileFired = true; this._p1ProjectileLevel = projLvl1;
      this._p2ProjectileFired = true; this._p2ProjectileLevel = projLvl2;
      const diff = projLvl1 - projLvl2;
      if (diff === 0) {
        // Equal — full cancel, no damage
        this._projCancel = true;
        msg = 'Les deux tirent ! Les projectiles s\'annulent au milieu !';
      } else if (diff > 0) {
        // P1 fired more — P2 takes the difference
        this._projCancel = false;
        this.p2.lives -= diff;
        msg = 'J1 tire ' + projLvl1 + ' projectile(s), J2 tire ' + projLvl2 + ' ! J2 -' + diff + ' vie' + (diff > 1 ? 's' : '') + ' !';
      } else {
        // P2 fired more — P1 takes the difference
        this._projCancel = false;
        this.p1.lives -= (-diff);
        msg = 'J2 tire ' + projLvl2 + ' projectile(s), J1 tire ' + projLvl1 + ' ! J1 -' + (-diff) + ' vie' + ((-diff) > 1 ? 's' : '') + ' !';
      }
    } else if (proj1) {
      const isKitsuneP1 = !!(this.p1Outfit && this.p1Outfit.projectile1);
      const cost1 = isKitsuneP1 ? (projLvl1 >= 2 ? 4 : 3) : 4;
      this.p1.charges -= cost1;
      this._p1ProjectileFired = true;
      this._p1ProjectileLevel = projLvl1;
      if (a2 === P) {
        this.p2.lives -= 1;
        msg = (msg ? msg + ' ' : '') + 'J1 tire un projectile ! Garde réduit les dégâts — J2 -1 vie !';
      } else if (a2 === R) {
        this.p2.charges += p2ChargeGain;
        this.p2.lives -= projLvl1;
        msg = (msg ? msg + ' ' : '') + 'J1 tire un projectile ! J2 recharge mais prend ' + projLvl1 + ' vie' + (projLvl1 > 1 ? 's' : '') + ' !';
      } else if (f2) {
        // Both act simultaneously: P2 melee hits P1, P1 projectile hits P2
        this.p2.lives -= projLvl1;
        this.p1.lives -= hit2; this.p2.charges -= lvl2;
        msg = (msg ? msg + ' ' : '') + 'J1 tire un projectile et J2 frappe ! Les deux se touchent !';
      } else {
        this.p2.lives -= projLvl1;
        msg = (msg ? msg + ' ' : '') + 'J1 tire un projectile ! J2 -' + projLvl1 + ' vie' + (projLvl1 > 1 ? 's' : '') + ' !';
      }
    }
    if (proj2 && !proj1) {
      const isKitsuneP2 = !!(this.p2Outfit && this.p2Outfit.projectile1);
      const cost2 = isKitsuneP2 ? (projLvl2 >= 2 ? 4 : 3) : 4;
      this.p2.charges -= cost2;
      this._p2ProjectileFired = true;
      this._p2ProjectileLevel = projLvl2;
      if (a1 === P) {
        this.p1.lives -= 1;
        msg = (msg ? msg + ' ' : '') + 'J2 tire un projectile ! Garde réduit les dégâts — J1 -1 vie !';
      } else if (a1 === R) {
        this.p1.charges += p1ChargeGain;
        this.p1.lives -= projLvl2;
        msg = (msg ? msg + ' ' : '') + 'J2 tire un projectile ! J1 recharge mais prend ' + projLvl2 + ' vie' + (projLvl2 > 1 ? 's' : '') + ' !';
      } else if (f1) {
        this.p1.lives -= projLvl2;
        this.p2.lives -= hit1; this.p1.charges -= lvl1;
        msg = (msg ? msg + ' ' : '') + 'J2 tire un projectile et J1 frappe ! Les deux se touchent !';
      } else {
        this.p1.lives -= projLvl2;
        msg = (msg ? msg + ' ' : '') + 'J2 tire un projectile ! J1 -' + projLvl2 + ' vie' + (projLvl2 > 1 ? 's' : '') + ' !';
      }
    }

    // life_restore: si mana >= 4 → consomme 4 mana et restaure 1 vie (Kitsune : désactivé)
    const p1IsKitsune = !!(this.p1Outfit && this.p1Outfit.projectile1);
    const p2IsKitsune = !!(this.p2Outfit && this.p2Outfit.projectile1);
    if (this.p1Def.trait === 'life_restore' && !p1IsKitsune && this.p1.charges >= 4 && this.p1.lives < this.p1MaxLives) {
      this.p1.charges -= 4;
      this.p1.lives = Math.min(this.p1.lives + 1, this.p1MaxLives);
      this._p1LifeRestore = true;
      msg = (msg ? msg + ' ' : '') + 'J1 récupère 1 vie !';
    }
    if (this.p2Def.trait === 'life_restore' && !p2IsKitsune && this.p2.charges >= 4 && this.p2.lives < this.p2MaxLives) {
      this.p2.charges -= 4;
      this.p2.lives = Math.min(this.p2.lives + 1, this.p2MaxLives);
      this._p2LifeRestore = true;
      msg = (msg ? msg + ' ' : '') + 'J2 récupère 1 vie !';
    }

    // Clamp lives and charges to 0
    this.p1.lives = Math.max(0, this.p1.lives);
    this.p2.lives = Math.max(0, this.p2.lives);
    this.p1.charges = Math.max(0, this.p1.charges);
    this.p2.charges = Math.max(0, this.p2.charges);

    this.resultText.setText(msg);
    this.drawHearts();
    this.updateChargesDisplay();

    // Cri du perdant au moment où son dernier coeur disparaît
    if (this.p1.lives <= 0) this._playVoice(this.p1Def, 'lose', 0, this.p1Outfit);
    if (this.p2.lives <= 0) this._playVoice(this.p2Def, 'lose', 0, this.p2Outfit);

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

    const isBlue  = color === 'blue';
    const isGreen = color === 'green';
    const tint1 = isBlue ? 0x0088ff : (isGreen ? 0x00cc44 : 0xff2200);
    const tint2 = isBlue ? 0x00ccff : (isGreen ? 0x44ff88 : 0xff8800);
    const tint3 = isBlue ? 0xaaeeff : (isGreen ? 0xaaffcc : 0xffcc00);

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
    const proj1 = this.isProjectileAction(a1);
    const proj2 = this.isProjectileAction(a2);
    const projLvl1 = this._p1ProjectileLevel || 0;
    const projLvl2 = this._p2ProjectileLevel || 0;
    const lvl1 = this.getAttackLevel(a1);
    const lvl2 = this.getAttackLevel(a2);
    const maxLvl = Math.max(lvl1, lvl2, 1);

    // Kitsune melee is corps à corps (rush + attack1) — no ranged visual for melee
    const p1Ranged = false;
    const p2Ranged = false;

    // Rush movement constants
    const rushDuration = 300;
    const returnDuration = 300;
    const hasRush = (f1 && !p1Ranged) || (f2 && !p2Ranged);
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
      if (p1Ranged) {
        // Ranged: attack in place, no rush
        this.playAttackChain(this.p1Sprite, 'duel_p1', lvl1, null, this.p1Def);
      } else if (p1HasRun) {
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
      if (!this._p1IntroPlayed) { this._p1IntroPlayed = true; this._playVoice(this.p1Def, 'intro', 0, this.p1Outfit); }
      // Attack sound — shifted by rush
      const p1Sfx = this._charAttackSfxKey(this.p1Def, this.p1Outfit);
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
      } else if (this.anims.exists('duel_p1_shield')) {
        this.p1Sprite.play('duel_p1_shield');
      }
      if (this.p1Def.trait === 'magic_shield') {
        this.sound.play('boss_useless', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 2) });
      }
    }

    // --- Rush movement + attack for P2 ---
    if (f2) {
      if (p2Ranged) {
        // Ranged: attack in place, no rush
        this.playAttackChain(this.p2Sprite, 'duel_p2', lvl2, null, this.p2Def);
      } else if (p2HasRun) {
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
      if (!this._p2IntroPlayed) { this._p2IntroPlayed = true; this._playVoice(this.p2Def, 'intro', 0, this.p2Outfit); }
      const p2Sfx = this._charAttackSfxKey(this.p2Def, this.p2Outfit);
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
      } else if (this.anims.exists('duel_p2_shield')) {
        this.p2Sprite.play('duel_p2_shield');
      }
      if (this.p2Def.trait === 'magic_shield') {
        this.sound.play('boss_useless', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 2) });
      }
    }


    // PROJECTILE action (key 4/R or 0) — fires the character's projectile at full range
    // Kitsune x1: cast attack3 + fire1 projectile
    // Kitsune x2: cast attack3 + fire1, then attack2 + fire2
    // Magician: cast magic_sphere + charDef projectile
    const projDelay = 200;
    const _spawnProj = (pNum, projLvl, outfit, charDef, startX, targetX, flipX) => {
      const tag = this._charLoadTag(charDef, outfit);
      const isKitsuneProj = !!(outfit && outfit.projectile1);
      const prefix = 'duel_p' + pNum;

      // Cast animation
      this.time.delayedCall(projDelay, () => {
        if (this.anims.exists(prefix + '_magic_sphere')) {
          // Magician cast
          const sp = pNum === 1 ? this.p1Sprite : this.p2Sprite;
          sp.play(prefix + '_magic_sphere');
        } else if (isKitsuneProj) {
          // Kitsune: always play attack3 first
          const sp = pNum === 1 ? this.p1Sprite : this.p2Sprite;
          sp.play(prefix + '_attack3');
        } else {
          const sp = pNum === 1 ? this.p1Sprite : this.p2Sprite;
          sp.play(prefix + '_attack1');
        }
      });

      // First projectile (fire1 for Kitsune, or charDef projectile)
      this.time.delayedCall(projDelay + 400, () => {
        this.sound.play('magic_spell', { volume: AUDIO_SETTINGS.sfxVolume });
        let projKey = null, animKey = null;
        if (outfit && outfit.projectile1) {
          const pdef = outfit.projectile1;
          projKey = 'duel_' + tag + '_' + pdef.sheet;
          animKey = prefix + '_projectile1';
        } else if (charDef.projectile) {
          projKey = 'duel_' + tag + '_' + charDef.projectile.sheet;
          animKey = prefix + '_projectile';
        }
        if (projKey) {
          const sp = pNum === 1 ? this.p1Sprite : this.p2Sprite;
          const proj = this.add.sprite(startX + (flipX ? -80 : 80), sp.y - 40, projKey, 0);
          proj.setScale(DUEL_PLAYER_SCALE);
          if (flipX) proj.setFlipX(true);
          proj.setDepth(320);
          if (animKey && this.anims.exists(animKey)) proj.play(animKey);
          this.tweens.add({
            targets: proj, x: targetX, duration: 400, ease: 'Power2',
            onComplete: () => { proj.destroy(); }
          });
        }
      });

      // Second projectile (fire2 for Kitsune x2 only)
      if (projLvl >= 2 && outfit && outfit.projectile2) {
        this.time.delayedCall(projDelay + 200, () => {
          // Second cast anim: attack2
          const sp = pNum === 1 ? this.p1Sprite : this.p2Sprite;
          sp.play(prefix + '_attack2');
        });
        this.time.delayedCall(projDelay + 600, () => {
          this.sound.play('magic_spell', { volume: AUDIO_SETTINGS.sfxVolume });
          const pdef2 = outfit.projectile2;
          const projKey2 = 'duel_' + tag + '_' + pdef2.sheet;
          const animKey2 = prefix + '_projectile2';
          const sp = pNum === 1 ? this.p1Sprite : this.p2Sprite;
          const proj2 = this.add.sprite(startX + (flipX ? -80 : 80), sp.y - 60, projKey2, 0);
          proj2.setScale(DUEL_PLAYER_SCALE);
          if (flipX) proj2.setFlipX(true);
          proj2.setDepth(321);
          if (this.anims.exists(animKey2)) proj2.play(animKey2);
          this.tweens.add({
            targets: proj2, x: targetX, duration: 400, ease: 'Power2',
            onComplete: () => { proj2.destroy(); }
          });
        });
      }

      // Impact / hurt
      if (!this._projCancel) {
        const impactDelay = projLvl >= 2 ? projDelay + 1100 : projDelay + 900;
        this.time.delayedCall(impactDelay, () => {
          this.sound.play('duel_sword', { volume: AUDIO_SETTINGS.sfxVolume });
          const targetNum = pNum === 1 ? 2 : 1;
          const targetData = targetNum === 1 ? this.p1 : this.p2;
          const targetSprite = targetNum === 1 ? this.p1Sprite : this.p2Sprite;
          if (targetData.lives > 0) targetSprite.play('duel_p' + targetNum + '_hurt');
          else targetSprite.play('duel_p' + targetNum + '_dead');
          this.time.delayedCall(600, () => { if (targetData.lives > 0) this._playIdle(targetNum); });
        });
      }
    };

    if (this._p1ProjectileFired) {
      const targetX1 = this._projCancel ? (p1StartX + p2StartX) / 2 : p2StartX;
      _spawnProj(1, projLvl1, this.p1Outfit, this.p1Def, p1StartX, targetX1, false);
    }
    if (this._p2ProjectileFired) {
      const targetX2 = this._projCancel ? (p1StartX + p2StartX) / 2 : p1StartX;
      _spawnProj(2, projLvl2, this.p2Outfit, this.p2Def, p2StartX, targetX2, true);
    }

    // Recharge FX (particle flames)
    const rechargeFxDuration = 1200;
    if (a1 === DUEL_ACTIONS.RECHARGER) {
      this.spawnFlameEffect(this.p1Sprite, 'red', rechargeFxDuration);
    }
    if (a2 === DUEL_ACTIONS.RECHARGER) {
      this.spawnFlameEffect(this.p2Sprite, 'red', rechargeFxDuration);
    }
    // Projectile action FX — purple/blue cast glow
    if (this._p1ProjectileFired) this.spawnFlameEffect(this.p1Sprite, 'blue', 800);
    if (this._p2ProjectileFired) this.spawnFlameEffect(this.p2Sprite, 'blue', 800);
    // magic_shield: Protéger recharges only when attacked — show flame FX
    if (this.p1Def.trait === 'magic_shield' && a1 === P && (f2 || proj2)) {
      this.spawnFlameEffect(this.p1Sprite, 'red', rechargeFxDuration);
    }
    if (this.p2Def.trait === 'magic_shield' && a2 === P && (f1 || proj1)) {
      this.spawnFlameEffect(this.p2Sprite, 'red', rechargeFxDuration);
    }

    // Disguise surprise attack animations
    const disguiseDelay = 600;
    const _spawnDart = (fromX, toX, spriteY) => {
      if (!this.textures.exists('peasant_dart')) return;
      const dartY = spriteY - 40;
      const dart = this.add.image(fromX + (fromX < toX ? 60 : -60), dartY, 'peasant_dart');
      dart.setScale(8);
      dart.setDepth(320);
      if (fromX > toX) dart.setFlipX(true);
      this.tweens.add({
        targets: dart, x: toX + (fromX < toX ? -60 : 60), duration: 300, ease: 'Power2',
        onComplete: () => { dart.destroy(); }
      });
    };
    if (this._p1DisguiseAttack) {
      this.sound.play('peasant_special', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 2) });
      this.time.delayedCall(disguiseDelay, () => {
        this.p1Sprite.play('duel_p1_attack1');
        this.sound.play('duel_sword', { volume: AUDIO_SETTINGS.sfxVolume });
        _spawnDart(p1StartX, p2StartX, this.p1Sprite.y);
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
        _spawnDart(p2StartX, p1StartX, this.p2Sprite.y);
      });
      this.playCharFx(this.p1Def, 'attack1', p1StartX, p1y, 0.45, false, 200, disguiseDelay + 300);
      this.time.delayedCall(disguiseDelay + 300, () => {
        if (this.p1.lives > 0) this.p1Sprite.play('duel_p1_hurt');
        else this.p1Sprite.play('duel_p1_dead');
      });
    }

    // Projectile collision — fumée au milieu dans tous les cas si les deux tirent
    if (this._p1ProjectileFired && this._p2ProjectileFired) {
      const midX = (p1StartX + p2StartX) / 2;
      this.time.delayedCall(projDelay + 600, () => {
        this.playFx('fx_anim_smoke2', midX, this.p1Sprite.y - 40, 0.5, false, 325, 0);
        this.playFx('fx_anim_smoke2', midX, this.p1Sprite.y - 60, 0.4, false, 326, 0);
        this.sound.play('duel_punch', { volume: AUDIO_SETTINGS.sfxVolume });
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
            onComplete: () => { this._playIdle(1); }
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
            onComplete: () => { this._playIdle(2); }
          });
        }
      });
    }

    // life_restore: restauration de vie — flamme verte + son
    const restoreDelay = 400;
    if (this._p1LifeRestore) {
      this.time.delayedCall(restoreDelay, () => {
        this.spawnFlameEffect(this.p1Sprite, 'green', 1000);
        if (this.cache.audio.exists('peasant_special')) {
          this.sound.play('peasant_special', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 1.5) });
        }
      });
    }
    if (this._p2LifeRestore) {
      this.time.delayedCall(restoreDelay, () => {
        this.spawnFlameEffect(this.p2Sprite, 'green', 1000);
        if (this.cache.audio.exists('peasant_special')) {
          this.sound.play('peasant_special', { volume: Math.min(1, AUDIO_SETTINGS.sfxVolume * 1.5) });
        }
      });
    }

    // magic_shield: contre-attaque bouclier — reste en place, joue attack1 + FX + hurt adverse
    const shieldCounterDelay = hurtDelay + 300;
    if (this._p1ShieldCounter) {
      this.time.delayedCall(shieldCounterDelay, () => {
        this.p1Sprite.play('duel_p1_attack1');
        this.sound.play('magic_spell', { volume: AUDIO_SETTINGS.sfxVolume });
      });
      this.playCharFx(this.p1Def, 'attack1', p2StartX, p2y, 0.45, true, 200, shieldCounterDelay + 200);
      this.time.delayedCall(shieldCounterDelay + 200, () => {
        if (this.p2.lives > 0) this.p2Sprite.play('duel_p2_hurt');
        else this.p2Sprite.play('duel_p2_dead');
      });
      this.time.delayedCall(shieldCounterDelay + 600, () => {
        if (this.p1.lives > 0) this._playIdle(1);
      });
    }
    if (this._p2ShieldCounter) {
      this.time.delayedCall(shieldCounterDelay, () => {
        this.p2Sprite.play('duel_p2_attack1');
        this.sound.play('magic_spell', { volume: AUDIO_SETTINGS.sfxVolume });
      });
      this.playCharFx(this.p2Def, 'attack1', p1StartX, p1y, 0.45, false, 200, shieldCounterDelay + 200);
      this.time.delayedCall(shieldCounterDelay + 200, () => {
        if (this.p1.lives > 0) this.p1Sprite.play('duel_p1_hurt');
        else this.p1Sprite.play('duel_p1_dead');
      });
      this.time.delayedCall(shieldCounterDelay + 600, () => {
        if (this.p2.lives > 0) this._playIdle(2);
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
        if (f1 && !p1Ranged && p1HasRun && this.p1.lives > 0) {
          this.p1Sprite.play('duel_p1_run');
          this.tweens.add({
            targets: this.p1Sprite, x: p1StartX,
            duration: returnDuration, ease: 'Power2',
            onComplete: () => { this._playIdle(1); }
          });
        }
        if (f2 && !p2Ranged && p2HasRun && this.p2.lives > 0) {
          this.p2Sprite.play('duel_p2_run');
          this.tweens.add({
            targets: this.p2Sprite, x: p2StartX,
            duration: returnDuration, ease: 'Power2',
            onComplete: () => { this._playIdle(2); }
          });
        }
      });
    }

    // Wait longer for higher level attacks + rush before next turn
    const resolveWait = DUEL_NEXT_TURN_DELAY + rush + returnDuration + (maxLvl - 1) * 400;
    this.time.delayedCall(resolveWait, () => {
      if (this.p1.lives <= 0 || this.p2.lives <= 0) {
        this.showGameOver();
      } else {
        if (this.tutorialMode) this.tutorialTurnIdx++;
        this.turnNumber++;
        this.startTurn();
      }
    });
  }

  showGameOver() {
    if (this.tutorialMode) { this._showTutorialComplete(); return; }
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
      this._playVoice(this.p1Def, 'win', 800, this.p1Outfit);
    } else if (this.p1.lives <= 0) {
      this._playVoice(this.p2Def, 'win', 800, this.p2Outfit);
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
            p1Outfit: this.p1Outfit,
            p2Outfit: null,
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
    const _p2ColorOverride = this.p2Def.color !== this.p2Color ? this.p2Color : null;
    if (choice === 'RECOMMENCER') {
      if (this._defeatArcade) {
        this.scene.start('DuelScene', {
          p1: this.p1Def,
          p2: this.p2Def,
          p1Outfit: this.p1Outfit,
          p2Outfit: this.p2Outfit,
          vsAI: true,
          arcade: true,
          arcadeOpponents: this.arcadeOpponents,
          arcadeIndex: this.arcadeIndex,
          stageIndex: this.stageIndex,
          p2Color: _p2ColorOverride,
        });
      } else {
        this.scene.restart({ p1: this.p1Def, p2: this.p2Def, p1Outfit: this.p1Outfit, p2Outfit: this.p2Outfit, vsAI: true, stageIndex: this.stageIndex, p2Color: _p2ColorOverride });
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
    addHelpTxt(w / 2, top + 77, 'RECHARGER — Gagne 1 mana', '11px', '#44dd44');
    addHelpTxt(w / 2, top + 93, 'PROTÉGER  — Bloque une attaque', '11px', '#4488ff');
    addHelpTxt(w / 2, top + 109, 'FRAPPER   — Utilise 1 mana, retire 1 vie', '11px', '#ff4444');

    const helpHasProj = this._charHasProjectile(this.p1Def, this.p1Outfit) || this._charHasProjectile(this.p2Def, this.p2Outfit);
    if (helpHasProj) {
      addHelpTxt(w / 2, top + 123, 'PROJECTILE — 4 mana, perce garde (1v) sinon 2v', '10px', '#cc88ff');
    }

    const superHelpY = helpHasProj ? top + 141 : top + 135;
    addHelpTxt(w / 2, superHelpY, '── SUPER ATTAQUE ──', '14px', '#ff00ff');
    addHelpTxt(w / 2, superHelpY + 19, 'Appuyez plusieurs fois sur Frapper !', '11px', '#ddaaff');
    addHelpTxt(w / 2, superHelpY + 35, 'x2 = 2 mana  |  x3 = 3 mana (KO !)', '10px', '#ff8844');

    addHelpTxt(w / 2, superHelpY + 61, '── TOUCHES ──', '14px', '#ffcc00');
    addHelpTxt(w / 2 - 120, superHelpY + 83, 'JOUEUR 1', '12px', this.p1Def.color);
    addHelpTxt(w / 2 - 120, superHelpY + 99, '1/A: Recharger', '10px', '#aaaacc');
    addHelpTxt(w / 2 - 120, superHelpY + 113, '2/Z: Protéger', '10px', '#aaaacc');
    addHelpTxt(w / 2 - 120, superHelpY + 127, '3/E: Frapper (x1/x2/x3)', '10px', '#aaaacc');
    if (this._charHasProjectile(this.p1Def, this.p1Outfit)) {
      addHelpTxt(w / 2 - 120, superHelpY + 141, '4/R: Projectile', '10px', '#cc88ff');
    }

    if (!this.vsAI) {
      addHelpTxt(w / 2 + 120, superHelpY + 83, 'JOUEUR 2', '12px', this.p2Color);
      addHelpTxt(w / 2 + 120, superHelpY + 99, '7: Recharger', '10px', '#aaaacc');
      addHelpTxt(w / 2 + 120, superHelpY + 113, '8: Protéger', '10px', '#aaaacc');
      addHelpTxt(w / 2 + 120, superHelpY + 127, '9: Frapper (x1/x2/x3)', '10px', '#aaaacc');
      if (this._charHasProjectile(this.p2Def, this.p2Outfit)) {
        addHelpTxt(w / 2 + 120, superHelpY + 141, '0: Projectile', '10px', '#cc88ff');
      }
    } else {
      addHelpTxt(w / 2 + 120, superHelpY + 83, 'IA', '12px', this.p2Color);
      addHelpTxt(w / 2 + 120, superHelpY + 103, 'Joue automatiquement', '10px', '#aaaacc');
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

    const allChars = [
      ...Object.values(CHARACTERS),
      ...Object.values(GHOST_CHARACTERS),
      ...(CHEAT_SETTINGS.magikUnlocked ? [HIDDEN_CHARACTERS.Wanderer_Magician] : []),
      ...(CHEAT_SETTINGS.villageUnlocked ? [HIDDEN_CHARACTERS.Kunoichi, HIDDEN_CHARACTERS.Ninja_Peasant] : []),
      ...(CHEAT_SETTINGS.yokaiUnlocked ? [HIDDEN_CHARACTERS.Yokai] : []),
    ];
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
      p1Outfit: this.p1Outfit,
      p2Outfit: this.p2Outfit,
      vsAI: this.vsAI,
      stageIndex: this.stageIndex,
      p2Color: this.p2Def.color !== this.p2Color ? this.p2Color : null,
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
    // For PROJECTILE: validate cost and resolve x1 vs x2 like setPlayerChoice does
    if (action === DUEL_ACTIONS.PROJECTILE) {
      const isKitsuneOutfit = !!(this.p2Outfit && this.p2Outfit.projectile1);
      const projCost = isKitsuneOutfit ? 3 : 4;
      if (this.p2.charges < projCost) {
        action = DUEL_ACTIONS.RECHARGER; // fallback
      } else if (isKitsuneOutfit && this.p2.charges >= 4) {
        action = DUEL_ACTIONS.PROJECTILE2;
      }
    }
    this.p2.choice = action;
    this.p2.ready = true;
    this.p2ChoiceText.setText('...').setColor('#ffcc00');
    if (this.p1.ready && this.p2.ready) {
      this.lockChoices();
    }
  }

  computeAIChoice() {
    if (this.tutorialMode) return this._tutorialScriptedAction();
    const roll = Math.random();
    const myCharges = this.p2.charges;
    const enemyCharges = this.p1.charges;
    const enemyLives = this.p1.lives;

    const hasBonusDmg = this.p2Def.trait === 'attack_x4';
    const hasMimicry = this.p2Def.trait === 'mimicry';
    const hasDisguise = this.p2Def.trait === 'disguise';
    const hasMagicShield  = this.p2Def.trait === 'magic_shield';
    const hasLifeRestore  = this.p2Def.trait === 'life_restore';
    const hasProjectile = this._charHasProjectile(this.p2Def, this.p2Outfit);
    const isKitsuneOutfit = !!(this.p2Outfit && this.p2Outfit.projectile1);
    const projCost = isKitsuneOutfit ? 3 : 4;
    const limitX2 = hasMimicry || hasDisguise || hasMagicShield || isKitsuneOutfit;
    const maxCharges = limitX2 ? 2 : 3;
    // Samurai deals charges+1 damage, others deal charges damage
    const dmgAt = (charges) => charges + (hasBonusDmg ? 1 : 0);

    // Can finish with projectile?
    if (hasProjectile && myCharges >= projCost && projCost <= enemyLives && roll < 0.75) {
      return DUEL_ACTIONS.PROJECTILE;
    }
    // Kitsune x2 finisher
    if (isKitsuneOutfit && myCharges >= 4 && 2 <= enemyLives && roll < 0.70) {
      return DUEL_ACTIONS.PROJECTILE; // resolves as x2
    }

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
    //   Cap 1 — Protéger si attaqué → +1 mana passif + contre-attaque magique (-1 vie, coûte 1 mana)
    //   Cap 2 — Projectile via touche dédiée (≥4 mana)
    //   Imprévisible : les probabilités varient selon le contexte mais gardent une variance
    if (hasMagicShield) {
      const enemyThreat = enemyCharges >= 1; // l'ennemi peut frapper → Protéger offensif
      if (myCharges >= 4) {
        // Projectile disponible — priorité haute
        const roll2 = Math.random();
        if (roll2 < 0.75) return DUEL_ACTIONS.PROJECTILE;      // tir magique
        if (enemyThreat && roll2 < 0.90) return DUEL_ACTIONS.PROTEGER; // contre + recharge
        return DUEL_ACTIONS.FRAPPER2;                           // feinte agressive rare
      } else if (myCharges >= 2) {
        if (enemyThreat) {
          // Protéger = contre-attaque + recharge +1 = très rentable
          if (roll < 0.60) return DUEL_ACTIONS.PROTEGER;
          if (roll < 0.90) return DUEL_ACTIONS.RECHARGER;
          return DUEL_ACTIONS.FRAPPER2;                         // feinte
        } else {
          // Pas de menace → recharger ou feinte
          if (roll < 0.80) return DUEL_ACTIONS.RECHARGER;
          return DUEL_ACTIONS.FRAPPER2;
        }
      } else if (myCharges === 1) {
        if (enemyThreat) {
          // Protéger = contre-attaque (net 0 mana consommée) — très agressif
          if (roll < 0.65) return DUEL_ACTIONS.PROTEGER;
          if (roll < 0.90) return DUEL_ACTIONS.RECHARGER;
          return DUEL_ACTIONS.FRAPPER;                          // feinte imprévisible
        } else {
          // Pas de menace → recharger
          if (roll < 0.85) return DUEL_ACTIONS.RECHARGER;
          return DUEL_ACTIONS.PROTEGER;
        }
      } else {
        // 0 mana — doit recharger, mais Protéger donne +1 si attaqué
        if (enemyThreat) {
          if (roll < 0.55) return DUEL_ACTIONS.PROTEGER;        // +1 gratuit dès le départ
          return DUEL_ACTIONS.RECHARGER;
        } else {
          return DUEL_ACTIONS.RECHARGER;
        }
      }
    }

    // life_restore AI: accumuler 4 mana → soin automatique (désactivé pour Kitsune)
    if (hasLifeRestore && !isKitsuneOutfit) {
      const hasLostLife = this.p2.lives < this.p2MaxLives;
      const canHeal = myCharges >= 4 && hasLostLife; // soin se déclenche automatiquement ce tour
      const wantsHeal = hasLostLife && myCharges < 4 && enemyCharges < this.p2.lives;

      // Le soin va se déclencher ce tour (mana >= 4) — jouer librement
      if (canHeal) {
        // Après soin on aura myCharges-4 mana, jouer normalement
        const afterCharges = myCharges - 4;
        if (afterCharges >= enemyLives && roll < 0.65) {
          if (afterCharges >= 3) return DUEL_ACTIONS.FRAPPER3;
          if (afterCharges >= 2) return DUEL_ACTIONS.FRAPPER2;
          return DUEL_ACTIONS.FRAPPER;
        }
        if (roll < 0.55) return DUEL_ACTIONS.RECHARGER;
        if (roll < 0.75) return DUEL_ACTIONS.PROTEGER;
        return DUEL_ACTIONS.FRAPPER;
      }

      // Accumuler du mana pour se soigner si on a perdu des vies
      if (wantsHeal) {
        const inDanger = enemyCharges >= this.p2.lives;
        if (inDanger) {
          // Danger : frapper ou protéger
          if (myCharges >= this.p2.lives && roll < 0.65) {
            if (myCharges >= 3) return DUEL_ACTIONS.FRAPPER3;
            if (myCharges >= 2) return DUEL_ACTIONS.FRAPPER2;
            return DUEL_ACTIONS.FRAPPER;
          }
          return roll < 0.55 ? DUEL_ACTIONS.PROTEGER : DUEL_ACTIONS.RECHARGER;
        }
        // Pas de danger → recharger vers 4 mana
        const healUrgency = (this.p2MaxLives - this.p2.lives) / this.p2MaxLives;
        if (roll < 0.55 + healUrgency * 0.30) return DUEL_ACTIONS.RECHARGER;
      }

      // Comportement normal
      if (myCharges <= 0) return roll < 0.75 ? DUEL_ACTIONS.RECHARGER : DUEL_ACTIONS.PROTEGER;
      if (myCharges >= 3 && roll < 0.35) return DUEL_ACTIONS.FRAPPER3;
      if (myCharges >= 2 && roll < 0.25) return DUEL_ACTIONS.FRAPPER2;
      if (roll < 0.50) return DUEL_ACTIONS.RECHARGER;
      if (roll < 0.70) return DUEL_ACTIONS.PROTEGER;
      return DUEL_ACTIONS.FRAPPER;
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
      if (hasProjectile && myCharges >= projCost && roll < 0.60) return DUEL_ACTIONS.PROJECTILE;
      if (!limitX2 && myCharges >= 3 && roll < 0.25) return DUEL_ACTIONS.FRAPPER3;
      if (!limitX2 && myCharges >= 2 && roll < 0.40) return DUEL_ACTIONS.FRAPPER2;
      if (limitX2 && !isKitsuneOutfit && myCharges >= 2 && roll < 0.40) return DUEL_ACTIONS.FRAPPER2;
      if (isKitsuneOutfit && myCharges >= 4 && roll < 0.65) return DUEL_ACTIONS.PROJECTILE;
      if (isKitsuneOutfit && myCharges >= 3 && roll < 0.55) return DUEL_ACTIONS.PROJECTILE;
      if (isKitsuneOutfit && myCharges >= 1 && roll < 0.35) return DUEL_ACTIONS.FRAPPER;
      // Mimicry: enemy has no charges, likely to recharge — mirror them
      if (hasMimicry) return roll < 0.60 ? DUEL_ACTIONS.RECHARGER : DUEL_ACTIONS.FRAPPER;
      // Disguise: protect to surprise attack recharging enemy
      if (hasDisguise) return roll < 0.40 ? DUEL_ACTIONS.PROTEGER : (roll < 0.70 ? DUEL_ACTIONS.FRAPPER : DUEL_ACTIONS.RECHARGER);
      return roll < 0.55 ? DUEL_ACTIONS.RECHARGER : DUEL_ACTIONS.FRAPPER;
    } else {
      // Both have charges
      if (hasProjectile && myCharges >= projCost && roll < 0.50) return DUEL_ACTIONS.PROJECTILE;
      if (!limitX2 && myCharges >= 3 && roll < 0.15) return DUEL_ACTIONS.FRAPPER3;
      if (!limitX2 && myCharges >= 2 && roll < 0.20) return DUEL_ACTIONS.FRAPPER2;
      if (limitX2 && !isKitsuneOutfit && myCharges >= 2 && roll < 0.25) return DUEL_ACTIONS.FRAPPER2;
      if (isKitsuneOutfit && myCharges >= 4 && roll < 0.60) return DUEL_ACTIONS.PROJECTILE;
      if (isKitsuneOutfit && myCharges >= 3 && roll < 0.50) return DUEL_ACTIONS.PROJECTILE;
      if (isKitsuneOutfit && myCharges >= 1 && roll < 0.25) return DUEL_ACTIONS.FRAPPER;
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

    // P1 input: 1/A = Recharger, 2/Z = Protéger, 3/E = Frapper, 4/R = Projectile
    if (Phaser.Input.Keyboard.JustDown(this.keyOne) || Phaser.Input.Keyboard.JustDown(this.keyA)) {
      this.setPlayerChoice(1, DUEL_ACTIONS.RECHARGER);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyTwo) || Phaser.Input.Keyboard.JustDown(this.keyZ)) {
      this.setPlayerChoice(1, DUEL_ACTIONS.PROTEGER);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyThree) || Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.setPlayerChoice(1, DUEL_ACTIONS.FRAPPER);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyFour) || Phaser.Input.Keyboard.JustDown(this.keyR)) {
      this.setPlayerChoice(1, DUEL_ACTIONS.PROJECTILE);
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
      if (Phaser.Input.Keyboard.JustDown(this.keyZero)) {
        this.setPlayerChoice(2, DUEL_ACTIONS.PROJECTILE);
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

  _createTutorialOverlay() {
    const w = this.cameras.main.width;
    this._tutPanel = this.add.graphics();
    this._tutPanel.fillStyle(0x000000, 0.75);
    this._tutPanel.fillRoundedRect(w / 2 - 310, 8, 620, 70, 10);
    this._tutPanel.setDepth(450);
    this._tutHintText = this.add.text(w / 2, 43, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffff88',
      stroke: '#000000', strokeThickness: 3,
      wordWrap: { width: 580 }, align: 'center',
    }).setOrigin(0.5).setDepth(451);
  }

  _updateTutorialOverlay() {
    const hints = [
      'Tour 1 — Rechargez pour gagner du mana (touche 1)',
      'Tour 2 — Rechargez encore pour avoir 2 mana',
      'Tour 3 — L\'IA va frapper ! Protégez-vous (touche 2)',
      'Tour 4 — L\'IA se protège. Frappez (touche 3) !',
      'Tour 5 — Rechargez pour préparer une super attaque',
      'Tour 6 — L\'IA se protège. Frappez x2 (double-tap 3) !',
      'Tour 7 — Rechargez encore une fois',
      'Tour 8 — L\'IA se protège. Frappez x3 pour le KO !',
    ];
    const idx = this.tutorialTurnIdx;
    if (this._tutHintText) {
      this._tutHintText.setText(idx < hints.length ? hints[idx] : '');
    }
  }

  _tutorialScriptedAction() {
    const actions = [
      DUEL_ACTIONS.RECHARGER,  // Tour 1
      DUEL_ACTIONS.RECHARGER,  // Tour 2
      DUEL_ACTIONS.FRAPPER,    // Tour 3 — frappe le joueur
      DUEL_ACTIONS.PROTEGER,   // Tour 4 — protège contre l'attaque du joueur
      DUEL_ACTIONS.RECHARGER,  // Tour 5
      DUEL_ACTIONS.PROTEGER,   // Tour 6 — protège x2
      DUEL_ACTIONS.RECHARGER,  // Tour 7
      DUEL_ACTIONS.PROTEGER,   // Tour 8 — protège x3 → KO
    ];
    return this.tutorialTurnIdx < actions.length
      ? actions[this.tutorialTurnIdx]
      : DUEL_ACTIONS.RECHARGER;
  }

  _showTutorialComplete() {
    this.gameOver = true;
    this.turnPhase = 'gameover';
    this.stopDuelMusic();
    const w = this.cameras.main.width;
    const p1Won = this.p2.lives <= 0 && this.p1.lives > 0;
    const msg = p1Won ? 'TUTORIEL TERMINÉ !\nBravo, vous maîtrisez les bases !' : 'Essayez encore !';
    const color = p1Won ? '#44ff44' : '#ff4444';
    this.add.text(w / 2, 320, msg, {
      fontSize: '36px', fontFamily: 'monospace', color,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
      align: 'center',
    }).setOrigin(0.5).setDepth(600);
    this.time.delayedCall(3500, () => {
      this.scene.start('DuelSelectScene');
    });
  }

  // ---- Mobile touch buttons ----

  _makeMobileBtn(x, y, texKey, label, action, player) {
    const RADIUS   = 44;
    const IMG_SIZE = 64;

    // Background circle (redrawn on hover/press)
    const gfx = this.add.graphics().setDepth(410).setScrollFactor(0);
    this._drawMobileBtnGfx(gfx, x, y, RADIUS, false, false);

    // Compute the scale needed to display the texture at IMG_SIZE px,
    // regardless of the source image's actual pixel dimensions.
    const tex    = this.textures.get(texKey);
    const frame  = tex.getSourceImage();
    const srcW   = frame.width  || IMG_SIZE;
    const srcH   = frame.height || IMG_SIZE;
    const base   = IMG_SIZE / Math.max(srcW, srcH);  // uniform scale, keeps aspect

    const img = this.add.image(x, y, texKey)
      .setScale(base)
      .setAlpha(0.92)
      .setDepth(411)
      .setScrollFactor(0);

    const txt = this.add.text(x, y + RADIUS - 2, label, {
      fontSize: '10px', fontFamily: 'monospace', color: '#ccddff',
    }).setOrigin(0.5).setDepth(412).setScrollFactor(0);

    const zone = this.add.zone(x, y, RADIUS * 2, RADIUS * 2)
      .setInteractive({ useHandCursor: true })
      .setDepth(413)
      .setScrollFactor(0);

    const resetScale = () => { this.tweens.killTweensOf(img); img.setScale(base); };

    // Hover in — bright border
    zone.on('pointerover', () => {
      this._drawMobileBtnGfx(gfx, x, y, RADIUS, true, false);
      img.setAlpha(1);
      txt.setColor('#ffffff');
    });

    // Hover out — back to normal
    zone.on('pointerout', () => {
      this._drawMobileBtnGfx(gfx, x, y, RADIUS, false, false);
      resetScale();
      img.setAlpha(0.92);
      txt.setColor('#ccddff');
    });

    // Press down — shrink to 82% of base scale
    zone.on('pointerdown', () => {
      this._drawMobileBtnGfx(gfx, x, y, RADIUS, true, true);
      this.tweens.killTweensOf(img);
      this.tweens.add({ targets: img, scaleX: base * 0.82, scaleY: base * 0.82, duration: 60, ease: 'Power2' });
      if (player === 1) this.setPlayerChoice(1, action);
      else              this.setPlayerChoice(2, action);
    });

    // Release — animate back to base scale
    zone.on('pointerup', () => {
      this._drawMobileBtnGfx(gfx, x, y, RADIUS, false, false);
      this.tweens.killTweensOf(img);
      this.tweens.add({ targets: img, scaleX: base, scaleY: base, duration: 120, ease: 'Back.easeOut' });
      img.setAlpha(0.92);
      txt.setColor('#ccddff');
    });

    // Store base scale on the image for _updateMobileBtns to restore
    img._baseScale = base;

    return { gfx, img, txt, zone };
  }

  // Apply or remove the greyed-out (disabled) look on a button
  _applyMobileBtnDim(btn, disabled) {
    if (disabled) {
      btn.img.setAlpha(0.25);
      btn.img.setTint(0x888888);
      btn.txt.setColor('#555566');
      btn.zone.disableInteractive();
    } else {
      btn.img.setAlpha(0.92);
      btn.img.clearTint();
      btn.txt.setColor('#ccddff');
      btn.zone.setInteractive({ useHandCursor: true });
    }
  }

  // Refresh disabled state of attack/projectile buttons based on current charges
  _refreshMobileBtnStates() {
    if (!this.showTouchBtns || !this._mobileBtns) return;
    if (this.turnPhase !== 'input') return;

    const refresh = (btns, swordBtn, projBtn, pData, charDef, outfit) => {
      if (!btns || !btns.length) return;
      // Frapper: needs at least 1 charge
      if (swordBtn) this._applyMobileBtnDim(swordBtn, pData.charges <= 0);
      // Projectile: cost depends on character
      if (projBtn) {
        const isKitsune = !!(outfit && (outfit.projectile1 || outfit.projectile2));
        const projCost  = isKitsune ? 3 : 4;
        this._applyMobileBtnDim(projBtn, pData.charges < projCost);
      }
    };

    // P1 — sword = index 1, proj = index 2 (or _mobileProjBtn)
    refresh(this._mobileBtns, this._mobileBtns[1], this._mobileProjBtn,
            this.p1, this.p1Def, this.p1Outfit);

    // P2
    if (!this.vsAI && this._mobileP2Btns && this._mobileP2Btns.length) {
      refresh(this._mobileP2Btns, this._mobileP2Btns[1], this._mobileP2ProjBtn,
              this.p2, this.p2Def, this.p2Outfit);
    }
  }

  _drawMobileBtnGfx(gfx, x, y, r, hover, pressed) {
    gfx.clear();
    if (pressed) {
      gfx.fillStyle(0x223344, 0.75);
      gfx.fillCircle(x, y, r);
      gfx.lineStyle(2, 0x88ccff, 1);
      gfx.strokeCircle(x, y, r);
      // inner highlight ring
      gfx.lineStyle(1, 0xffffff, 0.3);
      gfx.strokeCircle(x, y, r - 6);
    } else if (hover) {
      gfx.fillStyle(0x112233, 0.5);
      gfx.fillCircle(x, y, r);
      gfx.lineStyle(2, 0x66aadd, 1);
      gfx.strokeCircle(x, y, r);
    } else {
      gfx.fillStyle(0x000000, 0.35);
      gfx.fillCircle(x, y, r);
      gfx.lineStyle(2, 0x446688, 0.8);
      gfx.strokeCircle(x, y, r);
    }
  }

  _createMobileButtons() {
    const w = this.cameras.main.width; // 1280

    this._mobileBtns   = [];
    this._mobileP2Btns = [];

    // P1 — bottom-left
    const p1Mana   = this._makeMobileBtn(68,  560, 'fx_mana',       'Recharger',  DUEL_ACTIONS.RECHARGER,  1);
    const p1Sword  = this._makeMobileBtn(172, 560, 'fx_sword',      'Frapper',    DUEL_ACTIONS.FRAPPER,    1);
    const p1Proj   = this._makeMobileBtn(276, 560, 'fx_projection', 'Projectile', DUEL_ACTIONS.PROJECTILE, 1);
    const p1Shield = this._makeMobileBtn(120, 628, 'fx_shield',     'Protéger',   DUEL_ACTIONS.PROTEGER,   1);

    this._mobileBtns.push(p1Mana, p1Sword, p1Proj, p1Shield);
    this._mobileProjBtn = p1Proj;

    // P2 — bottom-right (mirrored), only if not vsAI
    if (!this.vsAI) {
      const p2Mana   = this._makeMobileBtn(w - 68,  560, 'fx_mana',       'Recharger',  DUEL_ACTIONS.RECHARGER,  2);
      const p2Sword  = this._makeMobileBtn(w - 172, 560, 'fx_sword',      'Frapper',    DUEL_ACTIONS.FRAPPER,    2);
      const p2Proj   = this._makeMobileBtn(w - 276, 560, 'fx_projection', 'Projectile', DUEL_ACTIONS.PROJECTILE, 2);
      const p2Shield = this._makeMobileBtn(w - 120, 628, 'fx_shield',     'Protéger',   DUEL_ACTIONS.PROTEGER,   2);

      this._mobileP2Btns.push(p2Mana, p2Sword, p2Proj, p2Shield);
      this._mobileP2ProjBtn = p2Proj;
    }

    // Start hidden
    [...this._mobileBtns, ...this._mobileP2Btns].forEach(b => {
      b.gfx.setVisible(false);
      b.img.setVisible(false);
      b.txt.setVisible(false);
      b.zone.setVisible(false);
    });
  }

  _updateMobileBtns() {
    if (!this.showTouchBtns || !this._mobileBtns) return;

    // P1 buttons
    const p1Visible = (this.turnPhase === 'input') && !this.p1.ready;
    this._mobileBtns.forEach(b => {
      if (p1Visible) { this.tweens.killTweensOf(b.img); b.img.setScale(b.img._baseScale); }
      b.gfx.setVisible(p1Visible);
      b.img.setVisible(p1Visible);
      b.txt.setVisible(p1Visible);
      b.zone.setVisible(p1Visible);
    });
    if (this._mobileProjBtn) {
      const hasProj = this._charHasProjectile(this.p1Def, this.p1Outfit);
      const v = p1Visible && hasProj;
      this._mobileProjBtn.gfx.setVisible(v);
      this._mobileProjBtn.img.setVisible(v);
      this._mobileProjBtn.txt.setVisible(v);
      this._mobileProjBtn.zone.setVisible(v);
    }

    // P2 buttons (only in 2-player mode)
    if (!this.vsAI && this._mobileP2Btns && this._mobileP2Btns.length) {
      const p2Visible = (this.turnPhase === 'input') && !this.p2.ready;
      this._mobileP2Btns.forEach(b => {
        if (p2Visible) { this.tweens.killTweensOf(b.img); b.img.setScale(b.img._baseScale); }
        b.gfx.setVisible(p2Visible);
        b.img.setVisible(p2Visible);
        b.txt.setVisible(p2Visible);
        b.zone.setVisible(p2Visible);
      });
      if (this._mobileP2ProjBtn) {
        const hasProj2 = this._charHasProjectile(this.p2Def, this.p2Outfit);
        const v2 = p2Visible && hasProj2;
        this._mobileP2ProjBtn.gfx.setVisible(v2);
        this._mobileP2ProjBtn.img.setVisible(v2);
        this._mobileP2ProjBtn.txt.setVisible(v2);
        this._mobileP2ProjBtn.zone.setVisible(v2);
      }
    }

    this._refreshMobileBtnStates();
  }
}
