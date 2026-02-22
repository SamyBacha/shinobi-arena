// ============================================================
// Duel Select Scene
// ============================================================
// Les stages sont déclarés dans js/duel/Stage.js (approche DDD)
// stageIndex 1, 2, 3... correspondent à STAGES[0], [1], [2]...

class DuelSelectScene extends Phaser.Scene {
  constructor() { super('DuelSelectScene'); }

  init(data) {
    this._initData = data || {};
  }

  preload() {
    const allChars = [...Object.values(CHARACTERS), ...Object.values(GHOST_CHARACTERS), ...Object.values(HIDDEN_CHARACTERS)];
    allChars.forEach(char => {
      const base = char.assetFolder;
      const fs   = char.frameSize;
      const load = (key, file, fw, fh) => {
        if (!this.textures.exists(key)) this.load.spritesheet(key, file, { frameWidth: fw, frameHeight: fh });
      };
      load('select_' + char.folder + '_idle',    base + char.sheets.idle.file,    fs, fs);
      load('select_' + char.folder + '_attack1', base + char.sheets.attack1.file, fs, fs);
      if (char.sheets.attack2) load('select_' + char.folder + '_attack2', base + char.sheets.attack2.file, fs, fs);
      if (char.sheets.attack3) load('select_' + char.folder + '_attack3', base + char.sheets.attack3.file, fs, fs);
      if (char.projectile) {
        const pfs = char.projectile.frameSize || fs;
        load('select_' + char.folder + '_proj', base + char.sheets[char.projectile.sheet].file, pfs, pfs);
      }
      // Preload outfit sprites for characters with alternate outfits
      if (char._outfits) {
        char._outfits.filter(o => o.enabled !== false).forEach(outfit => {
          if (!outfit.folder) return;
          const folderKey = outfit.folder.replace(/[^a-zA-Z0-9_]/g, '_');
          const oSheets = outfit.sheets || {};
          const oBase   = outfit.folder;
          const idleFile = oSheets.idle    ? oBase + oSheets.idle.file    : base + char.sheets.idle.file;
          const atk1File = oSheets.attack1 ? oBase + oSheets.attack1.file : base + char.sheets.attack1.file;
          load('select_outfit_' + folderKey + '_idle',    idleFile, fs, fs);
          load('select_outfit_' + folderKey + '_attack1', atk1File, fs, fs);
          if (oSheets.attack2 || char.sheets.attack2) {
            const atk2File = oSheets.attack2 ? oBase + oSheets.attack2.file : base + char.sheets.attack2.file;
            load('select_outfit_' + folderKey + '_attack2', atk2File, fs, fs);
          }
          if (oSheets.attack3 || char.sheets.attack3) {
            const atk3File = oSheets.attack3 ? oBase + oSheets.attack3.file : base + char.sheets.attack3.file;
            load('select_outfit_' + folderKey + '_attack3', atk3File, fs, fs);
          }
          // Outfit projectile (ex: Kitsune fire1)
          if (outfit.projectile1) {
            const pSheet = oSheets[outfit.projectile1.sheet];
            if (pSheet) {
              const pfs2 = outfit.projectile1.frameSize || fs;
              load('select_outfit_' + folderKey + '_proj', oBase + pSheet.file, pfs2, pfs2);
            }
          }
        });
      }
    });
    if (!this.cache.audio.exists('duel_select_bgm')) {
      this.load.audio('duel_select_bgm', 'music/bgm_duel_select.mp3');
    }
    if (!this.cache.audio.exists('duel_announce')) {
      this.load.audio('duel_announce', 'music/sfx_announcer.mp3');
    }
    if (!this.cache.audio.exists('menu_click')) {
      this.load.audio('menu_click', 'music/sfx_menu_click.mp3');
    }
    if (!this.cache.audio.exists('menu_nav')) {
      this.load.audio('menu_nav', 'music/sfx_menu_nav.mp3');
    }
    // Stage thumbnails — chargées depuis le dossier de chaque stage
    STAGES.forEach(stage => {
      if (!this.textures.exists(stage.thumbKey)) {
        this.load.image(stage.thumbKey, stage.bgPath);
      }
    });
  }

  create() {
    applyGraphicsSettings(this);
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    this.cameras.main.setBackgroundColor('#0e0e1a');

    // Music
    this.selectBgm = this.sound.add('duel_select_bgm', { loop: true, volume: AUDIO_SETTINGS.musicVolume });
    this.selectBgm.play();

    this.phase = 'mode'; // 'mode' | 'p1' | 'p1outfit' | 'p2' | 'p2outfit' | 'stage'
    this.vsAI   = false;
    this.arcade = false;
    this.p1Char = null;
    this.p2Char = null;
    this.p1Outfit = null;
    this.p2Outfit = null;
    this.selectedIndex = 0;
    this.selectedStage = null;
    this.confirmed = false;

    // Container for dynamic content
    this.dynamicObjects = [];

    this.keyUp    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyLeft  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keyEsc   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.detailVisible = false;
    this.detailObjects = [];

    // Check init data then clear it to avoid stale state on scene restart
    const initData = this._initData || {};
    this._initData = {};
    if (initData.skipToCharSelect) {
      this.vsAI   = initData.vsAI   || false;
      this.arcade = initData.arcade || false;
      this.showCharSelect('p1');
    } else {
      this.showModeSelect();
    }
  }

  clearDynamic() {
    this.hideDetail();
    this.dynamicObjects.forEach(o => { if (o && o.destroy) o.destroy(); });
    this.dynamicObjects = [];
  }

  showModeSelect() {
    this.clearDynamic();
    this.phase = 'mode';
    this.selectedIndex = 0;
    this.confirmed = false;
    this._phaseChanged = true;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const title = this.add.text(w / 2, h * 0.15, 'MODE DUEL', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.dynamicObjects.push(title);

    this.modeOptions = ['AVENTURE', 'JOUEUR vs IA', 'JOUEUR vs JOUEUR', 'TUTORIEL'];
    this.modeTexts = [];
    this.modeOptions.forEach((label, i) => {
      const txt = this.add.text(w / 2, h * 0.45 + i * 70, label, {
        fontSize: '28px', fontFamily: 'monospace', color: '#888888',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      txt.on('pointerover', () => {
        if (this.confirmed) return;
        this.selectedIndex = i; this.updateModeHighlight();
      });
      txt.on('pointerdown', () => {
        if (this.confirmed) return;
        this.selectedIndex = i; this.updateModeHighlight();
        this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
        if (i === 3) {
          this.stopSelectMusic();
          this.cameras.main.flash(200, 255, 255, 255);
          this.time.delayedCall(250, () => { this.scene.start('TutorialScene'); });
          return;
        }
        this.arcade = i === 0; this.vsAI = i <= 1;
        this.showCharSelect('p1');
      });
      this.modeTexts.push(txt);
      this.dynamicObjects.push(txt);
    });

    this.modeArrow = this.add.text(0, 0, '▶', {
      fontSize: '24px', fontFamily: 'monospace', color: '#ff4444',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.dynamicObjects.push(this.modeArrow);

    const hint = this.add.text(w / 2, h * 0.82, '↑↓ : Naviguer  |  ENTER : Valider  |  ESC : Retour', {
      fontSize: '14px', fontFamily: 'monospace', color: '#555577',
    }).setOrigin(0.5);
    this.dynamicObjects.push(hint);

    this.updateModeHighlight();
  }

  updateModeHighlight() {
    this.modeTexts.forEach((txt, i) => {
      if (i === this.selectedIndex) {
        txt.setColor('#ffffff'); txt.setScale(1.1);
        this.modeArrow.setPosition(txt.x - txt.width * 0.55 - 20, txt.y);
      } else {
        txt.setColor('#888888'); txt.setScale(1);
      }
    });
  }

  showCharSelect(player) {
    this.clearDynamic();
    this.phase = player;
    this.selectedIndex = 0;
    this.confirmed = false;
    this._phaseChanged = true;

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const playerColor = player === 'p1' ? '#44bbff' : (this.vsAI && !this.arcade ? '#ff8844' : '#ff4466');
    let label;
    if (player === 'p1') {
      label = 'JOUEUR 1 — CHOISISSEZ';
    } else if (this.vsAI && !this.arcade) {
      label = 'CHOISISSEZ L\'ADVERSAIRE (IA)';
    } else {
      label = 'JOUEUR 2 — CHOISISSEZ';
    }
    const title = this.add.text(w / 2, h * 0.10, label, {
      fontSize: '30px', fontFamily: 'monospace', color: playerColor,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.dynamicObjects.push(title);

    this._carouselChars = [
      ...Object.values(CHARACTERS),
      ...(CHEAT_SETTINGS.ghostsUnlocked ? Object.values(GHOST_CHARACTERS) : []),
      ...(CHEAT_SETTINGS.villageUnlocked ? [HIDDEN_CHARACTERS.Kunoichi, HIDDEN_CHARACTERS.Ninja_Peasant] : []),
      ...(CHEAT_SETTINGS.magikUnlocked ? [HIDDEN_CHARACTERS.Wanderer_Magician] : []),
      ...(CHEAT_SETTINGS.yokaiUnlocked ? [HIDDEN_CHARACTERS.Yokai] : []),
    ];

    const cy = h * 0.50;
    const cx = w / 2;
    this._carouselCY = cy;
    this._carouselCX = cx;
    this.charPreviews = [];

    this._carouselChars.forEach((char) => {
      const tag = char.folder;
      const makeAnim = (name, texKey, frames, rate, rep) => {
        const k = 'select_anim_' + tag + '_' + name;
        if (!this.anims.exists(k) && this.textures.exists(texKey)) {
          this.anims.create({ key: k, frames: this.anims.generateFrameNumbers(texKey, { start: 0, end: frames - 1 }), frameRate: rate, repeat: rep });
        }
        return k;
      };
      makeAnim('idle',    'select_' + tag + '_idle',    char.sheets.idle.frames,    8,  -1);
      makeAnim('attack1', 'select_' + tag + '_attack1', char.sheets.attack1.frames, 12, 0);
      if (char.sheets.attack2) makeAnim('attack2', 'select_' + tag + '_attack2', char.sheets.attack2.frames, 10, 0);
      if (char.sheets.attack3) makeAnim('attack3', 'select_' + tag + '_attack3', char.sheets.attack3.frames, 10, 0);
      if (char.projectile && this.textures.exists('select_' + tag + '_proj')) {
        makeAnim('proj', 'select_' + tag + '_proj', char.projectile.frames, 12, 0);
      }

      const baseScale = (FRAME_SIZE / char.frameSize) * char.duelScale;
      const sprite = this.add.sprite(cx, cy, 'select_' + tag + '_idle', 0);
      sprite.setOrigin(0.5, 0.75);
      sprite.play('select_anim_' + tag + '_idle');
      this.dynamicObjects.push(sprite);
      this.charPreviews.push({ sprite, char, baseScale });
    });

    // Shadow
    this._carouselShadow = this.add.graphics();
    this.dynamicObjects.push(this._carouselShadow);

    // Cadre autour du perso central
    const frameW = 180;
    const frameH = 240;
    this._carouselFrame = this.add.graphics();
    this._carouselFrame.setDepth(5);
    this.dynamicObjects.push(this._carouselFrame);

    // Label joueur dans le cadre (en haut)
    this._carouselPlayerLabel = this.add.text(cx, cy - frameH / 2 - 2, player === 'p1' ? 'JOUEUR 1' : 'JOUEUR 2', {
      fontSize: '14px', fontFamily: 'monospace', color: playerColor,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(6);
    this.dynamicObjects.push(this._carouselPlayerLabel);
    this._carouselPlayerColor = playerColor;
    this._carouselFrameW = frameW;
    this._carouselFrameH = frameH;

    // Name
    this._carouselName = this.add.text(cx, h * 0.70, '', {
      fontSize: '26px', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);
    this.dynamicObjects.push(this._carouselName);

    // Trait
    this._carouselTrait = this.add.text(cx, h * 0.77, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#aaddaa',
      stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: 500 }, align: 'center',
    }).setOrigin(0.5).setDepth(10);
    this.dynamicObjects.push(this._carouselTrait);

    // Arrows
    const arrowL = this.add.text(w * 0.12, cy - 20, '◀', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    arrowL.on('pointerdown', () => this._carouselNav(-1));
    this.dynamicObjects.push(arrowL);

    const arrowR = this.add.text(w * 0.88, cy - 20, '▶', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    arrowR.on('pointerdown', () => this._carouselNav(1));
    this.dynamicObjects.push(arrowR);

    const hint = this.add.text(w / 2, h * 0.88, '←→ : Naviguer  |  ESPACE : Détails  |  ENTER / Clic : Valider  |  ESC : Retour', {
      fontSize: '13px', fontFamily: 'monospace', color: '#555577',
    }).setOrigin(0.5);
    this.dynamicObjects.push(hint);

    // Click on center carousel zone to confirm selection
    const confirmZone = this.add.zone(cx, cy, 200, 280)
      .setInteractive({ useHandCursor: true }).setDepth(10);
    confirmZone.on('pointerdown', () => {
      if (this.confirmed) return;
      this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
      const chosen = this._carouselChars[this.selectedIndex];
      if (this.phase === 'p1') {
        this.p1Char = chosen; this.p1Outfit = null;
        if (this.arcade) {
          const allChars = { ...CHARACTERS, ...GHOST_CHARACTERS, ...HIDDEN_CHARACTERS };
          const chosenKey = Object.keys(allChars).find(k => allChars[k] === chosen);
          let arcadeOpponents;
          if (CHEAT_SETTINGS.finalFight) {
            arcadeOpponents = [HIDDEN_CHARACTERS.Wanderer_Magician];
          } else {
            arcadeOpponents = ARCADE_ORDER.filter(k => k !== chosenKey).map(k => allChars[k]);
          }
          this.p2Char = arcadeOpponents[0]; this.p2Outfit = null;
          this.arcadeOpponents = arcadeOpponents;
          this.launchDuel();
        } else {
          if (chosen.outfits.length > 1) { this.showOutfitSelect('p1'); }
          else { this.showCharSelect('p2'); }
        }
      } else {
        this.p2Char = chosen; this.p2Outfit = null;
        if (chosen.outfits.length > 1) { this.showOutfitSelect('p2'); }
        else { this.showStageSelect(); }
      }
    });
    this.dynamicObjects.push(confirmZone);

    this._layoutCarousel();
  }

  showOutfitSelect(player) {
    this.clearDynamic();
    this.phase = player + 'outfit'; // 'p1outfit' or 'p2outfit'
    this.selectedIndex = 0;
    this.confirmed = false;
    this._phaseChanged = true;

    const charDef = player === 'p1' ? this.p1Char : this.p2Char;
    this._outfitPlayer = player;
    this._outfitChars = charDef.outfits; // [{ name, folder? }, ...]

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const playerColor = player === 'p1' ? '#44bbff' : (this.vsAI && !this.arcade ? '#ff8844' : '#ff4466');
    const label = player === 'p1' ? 'JOUEUR 1 — CHOISISSEZ UN OUTFIT' : 'JOUEUR 2 — CHOISISSEZ UN OUTFIT';

    const title = this.add.text(w / 2, h * 0.10, label, {
      fontSize: '28px', fontFamily: 'monospace', color: playerColor,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.dynamicObjects.push(title);

    const cy = h * 0.50;
    const cx = w / 2;
    this._outfitCY = cy;
    this._outfitCX = cx;
    this.outfitPreviews = [];

    this._outfitChars.forEach((outfit, idx) => {
      // Texture key for this outfit's idle sprite
      let texKey;
      if (outfit.folder) {
        const folderKey = outfit.folder.replace(/[^a-zA-Z0-9_]/g, '_');
        texKey = 'select_outfit_' + folderKey + '_idle';
        // Fallback to default if not loaded (shouldn't happen since preloaded above)
        if (!this.textures.exists(texKey)) texKey = 'select_' + charDef.folder + '_idle';
      } else {
        texKey = 'select_' + charDef.folder + '_idle';
      }

      const animKey = 'outfit_anim_' + idx + '_' + charDef.folder;
      const idleFrames = (outfit.sheets && outfit.sheets.idle)
        ? outfit.sheets.idle.frames
        : charDef.sheets.idle.frames;
      if (!this.anims.exists(animKey)) {
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(texKey, {
            start: 0, end: idleFrames - 1,
          }),
          frameRate: 8, repeat: -1,
        });
      }

      const baseScale = (FRAME_SIZE / charDef.frameSize) * charDef.duelScale;
      const sprite = this.add.sprite(cx, cy, texKey, 0);
      sprite.setOrigin(0.5, 0.75);
      sprite.play(animKey);
      this.dynamicObjects.push(sprite);
      this.outfitPreviews.push({ sprite, outfit, baseScale });
    });

    // Frame
    const frameW = 180, frameH = 240;
    this._outfitFrame = this.add.graphics().setDepth(5);
    this.dynamicObjects.push(this._outfitFrame);
    this._outfitFrameW = frameW;
    this._outfitFrameH = frameH;

    // Outfit name
    this._outfitName = this.add.text(cx, h * 0.70, '', {
      fontSize: '26px', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);
    this.dynamicObjects.push(this._outfitName);

    // Arrows
    const arrowL = this.add.text(w * 0.12, cy - 20, '◀', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    arrowL.on('pointerdown', () => this._outfitNav(-1));
    this.dynamicObjects.push(arrowL);

    const arrowR = this.add.text(w * 0.88, cy - 20, '▶', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    arrowR.on('pointerdown', () => this._outfitNav(1));
    this.dynamicObjects.push(arrowR);

    const hint = this.add.text(w / 2, h * 0.88, '←→ : Naviguer  |  ENTER / Clic : Valider  |  ESC : Retour', {
      fontSize: '13px', fontFamily: 'monospace', color: '#555577',
    }).setOrigin(0.5);
    this.dynamicObjects.push(hint);

    // Click center to confirm outfit
    const confirmZone = this.add.zone(cx, cy, 200, 280)
      .setInteractive({ useHandCursor: true }).setDepth(10);
    confirmZone.on('pointerdown', () => {
      if (this.confirmed) return;
      this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
      const chosen = this._outfitChars[this.selectedIndex];
      if (this.phase === 'p1outfit') {
        this.p1Outfit = chosen.folder ? chosen : null;
        this.showCharSelect('p2');
      } else {
        this.p2Outfit = chosen.folder ? chosen : null;
        this.showStageSelect();
      }
    });
    this.dynamicObjects.push(confirmZone);

    this._layoutOutfitCarousel();
  }

  _outfitNav(dir) {
    if (this.confirmed) return;
    const n = this._outfitChars.length;
    this.selectedIndex = (this.selectedIndex + dir + n) % n;
    this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume });
    this._layoutOutfitCarousel();
  }

  _layoutOutfitCarousel() {
    const n  = this._outfitChars.length;
    const cx = this._outfitCX;
    const cy = this._outfitCY;

    const slots    = [-1, 0, 1];
    const slotX    = [cx - 220, cx, cx + 220];
    const slotScale= [1.1, 2.2, 1.1];
    const slotAlpha= [0.5, 1.0, 0.5];
    const slotDepth= [2,   4,   2  ];

    this.outfitPreviews.forEach((p, i) => {
      let dist = i - this.selectedIndex;
      if (dist >  n / 2) dist -= n;
      if (dist < -n / 2) dist += n;

      const slotIdx = slots.indexOf(dist);
      if (slotIdx === -1) { p.sprite.setVisible(false); return; }

      p.sprite.setVisible(true);
      const targetScale = slotScale[slotIdx] * p.baseScale;
      this.tweens.add({
        targets: p.sprite,
        x: slotX[slotIdx], scaleX: targetScale, scaleY: targetScale, alpha: slotAlpha[slotIdx],
        duration: 180, ease: 'Power2',
      });
      p.sprite.setDepth(slotDepth[slotIdx]);

      if (dist === 0) {
        this._startSelectPreviewCycle(p);
      }
    });

    // Frame around center outfit
    const outfit = this._outfitChars[this.selectedIndex];
    const charDef = this._outfitPlayer === 'p1' ? this.p1Char : this.p2Char;
    // Mirror si P2 choisit même perso ET même outfit que P1
    const isMirrorOutfit = this._outfitPlayer === 'p2' && this.p1Char === charDef && outfit === this.p1Outfit;
    const outfitDisplayColor = isMirrorOutfit ? this._mirrorColorFor(charDef) : charDef.color;
    if (this._outfitFrame && this._outfitFrameW) {
      const fw = this._outfitFrameW;
      const fh = this._outfitFrameH;
      const charColor = Phaser.Display.Color.HexStringToColor(outfitDisplayColor).color;
      this._outfitFrame.clear();
      this._outfitFrame.fillStyle(0x000000, 0.25);
      this._outfitFrame.fillRoundedRect(cx - fw / 2, cy - fh / 2, fw, fh, 10);
      this._outfitFrame.lineStyle(3, charColor, 0.9);
      this._outfitFrame.strokeRoundedRect(cx - fw / 2, cy - fh / 2, fw, fh, 10);
    }
    if (this._outfitName) {
      this._outfitName.setText(outfit.name.toUpperCase()).setColor(outfitDisplayColor);
    }
  }

  _startSelectPreviewCycle(p) {
    // Annuler le cycle précédent
    if (this._previewTimer) { this._previewTimer.remove(false); this._previewTimer = null; }
    this._previewCycleActive = false;
    // Retirer tout listener animationcomplete du sprite précédent
    if (this._previewSprite && this._previewNextAttackFn) {
      this._previewSprite.off('animationcomplete', this._previewNextAttackFn);
      this._previewNextAttackFn = null;
    }
    this._previewCycleActive = true;
    this._previewSprite = p.sprite;

    const sprite  = p.sprite;
    // Détermine le tag de texture selon que c'est un outfit ou un perso de base
    const charDef = p.char || (this._outfitPlayer === 'p1' ? this.p1Char : this.p2Char);
    const outfit  = p.outfit || null;
    let texTag, animTag;
    if (outfit && outfit.folder) {
      const folderKey = outfit.folder.replace(/[^a-zA-Z0-9_]/g, '_');
      texTag  = 'select_outfit_' + folderKey;
      animTag = 'select_outfit_anim_' + folderKey;
    } else {
      texTag  = 'select_' + charDef.folder;
      animTag = 'select_anim_' + charDef.folder;
    }
    const sheets = (outfit && outfit.sheets) || charDef.sheets;

    // Créer les anims à la volée si pas encore faites (cas outfit)
    const ensureAnim = (name, frames, rate, rep) => {
      const k   = animTag + '_' + name;
      const tex = texTag  + '_' + name;
      if (!this.anims.exists(k) && this.textures.exists(tex)) {
        this.anims.create({ key: k, frames: this.anims.generateFrameNumbers(tex, { start: 0, end: frames - 1 }), frameRate: rate, repeat: rep });
      }
      return this.anims.exists(k) ? k : null;
    };

    const idleFrames = sheets.idle ? sheets.idle.frames : charDef.sheets.idle.frames;
    const idleKey = ensureAnim('idle', idleFrames, 8, -1)
                 || 'select_anim_' + charDef.folder + '_idle';

    // Séquence d'attaques
    const attacks = [];
    const tryAtk = (name, defSheets) => {
      const fr = (sheets[name] || defSheets[name]);
      if (!fr) return;
      const k = ensureAnim(name, fr.frames, name === 'attack1' ? 12 : 10, 0);
      if (k) attacks.push(k);
    };
    tryAtk('attack1', charDef.sheets);
    tryAtk('attack2', charDef.sheets);
    tryAtk('attack3', charDef.sheets);
    // Projectile outfit (Kitsune fire1) ou charDef.projectile
    if (outfit && outfit.projectile1) {
      const k = ensureAnim('proj', outfit.projectile1.frames, 12, 0);
      if (k) attacks.push(k);
    } else if (charDef.projectile) {
      const k = 'select_anim_' + charDef.folder + '_proj';
      if (this.anims.exists(k)) attacks.push(k);
    }

    const runCycle = () => {
      if (!this._previewCycleActive) return;
      sprite.play(idleKey);
      this._previewTimer = this.time.delayedCall(2000, () => {
        if (!this._previewCycleActive) return;
        let idx = 0;
        const nextAttack = () => {
          this._previewNextAttackFn = null;
          if (!this._previewCycleActive) return;
          if (!sprite || !sprite.active) return;
          if (idx >= attacks.length) { runCycle(); return; }
          const animKey = attacks[idx++];
          if (!this.anims.exists(animKey)) { nextAttack(); return; }
          sprite.play(animKey);
          this._previewNextAttackFn = nextAttack;
          sprite.once('animationcomplete', nextAttack);
        };
        nextAttack();
      });
    };

    runCycle();
  }

  _carouselNav(dir) {
    if (this.confirmed) return;
    const n = this._carouselChars.length;
    this.selectedIndex = (this.selectedIndex + dir + n) % n;
    this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume });
    this._layoutCarousel();
    this.updateDetail();
  }

  _layoutCarousel() {
    const n  = this._carouselChars.length;
    const cx = this._carouselCX;
    const cy = this._carouselCY;

    const slots    = [-2, -1, 0, 1, 2];
    const slotX    = [cx - 340, cx - 190, cx, cx + 190, cx + 340];
    const slotScale= [0.7, 1.1, 2.2, 1.1, 0.7];
    const slotAlpha= [0.3, 0.6, 1.0, 0.6, 0.3];
    const slotDepth= [1,   2,   4,   2,   1  ];

    this.charPreviews.forEach((p, i) => {
      let dist = i - this.selectedIndex;
      if (dist >  n / 2) dist -= n;
      if (dist < -n / 2) dist += n;

      const slotIdx = slots.indexOf(dist);
      if (slotIdx === -1) { p.sprite.setVisible(false); return; }

      p.sprite.setVisible(true);
      const targetScale = slotScale[slotIdx] * p.baseScale;
      this.tweens.add({
        targets: p.sprite,
        x: slotX[slotIdx], scaleX: targetScale, scaleY: targetScale, alpha: slotAlpha[slotIdx],
        duration: 180, ease: 'Power2',
      });
      p.sprite.setDepth(slotDepth[slotIdx]);

      if (dist === 0) {
        this._startSelectPreviewCycle(p);
      } else {
        // Hors centre : revenir à idle simple
        p.sprite.play('select_anim_' + p.char.folder + '_idle');
      }
    });

    // Shadow
    if (this._carouselShadow) {
      this._carouselShadow.clear();
      this._carouselShadow.fillStyle(0x000000, 0.35);
      this._carouselShadow.fillEllipse(cx, cy + 58, 180, 26);
      this._carouselShadow.setDepth(3);
    }

    // Cadre
    const char = this._carouselChars[this.selectedIndex];
    if (this._carouselFrame && this._carouselFrameW) {
      const fw = this._carouselFrameW;
      const fh = this._carouselFrameH;
      // Mirror match: use alternate color for P2 when hovering the same char as P1
      const isMirrorHover = (this.phase === 'p2' || this.phase === 'p2outfit') && this.p1Char === char;
      const displayColor = isMirrorHover ? this._mirrorColorFor(char) : char.color;
      const charColor = Phaser.Display.Color.HexStringToColor(displayColor).color;
      this._carouselFrame.clear();
      this._carouselFrame.fillStyle(0x000000, 0.25);
      this._carouselFrame.fillRoundedRect(cx - fw / 2, cy - fh / 2, fw, fh, 10);
      this._carouselFrame.lineStyle(3, charColor, 0.9);
      this._carouselFrame.strokeRoundedRect(cx - fw / 2, cy - fh / 2, fw, fh, 10);
    }
    if (this._carouselName) {
      const isMirrorHover2 = (this.phase === 'p2' || this.phase === 'p2outfit') && this.p1Char === char;
      const displayColor2 = isMirrorHover2 ? this._mirrorColorFor(char) : char.color;
      this._carouselName.setText(char.name.toUpperCase()).setColor(displayColor2);
    }
    const traitObj = char.trait ? TRAIT_LABELS[char.trait] : null;
    if (this._carouselTrait) this._carouselTrait.setText(traitObj ? traitObj.short : '');
  }

  highlightChar(index) {
    // Délégué au carrousel
    this.selectedIndex = index;
    this._layoutCarousel();
  }

  showStageSelect() {
    this.clearDynamic();
    this.phase = 'stage';
    this.selectedIndex = 0;
    this._phaseChanged = true;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const title = this.add.text(w / 2, h * 0.08, 'CHOISISSEZ L\'ARÈNE', {
      fontSize: '30px', fontFamily: 'monospace', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.dynamicObjects.push(title);

    // Tous les stages sont des GIFs
    this._stageList = STAGES;

    // Carrousel horizontal : 5 slots visibles, centre = sélection
    const THUMB_W = 260, THUMB_H = 146;
    const slotX    = [w/2 - 520, w/2 - 280, w/2, w/2 + 280, w/2 + 520];
    const slotScale = [0.6, 0.8, 1.0, 0.8, 0.6];
    const slotAlpha = [0.3, 0.6, 1.0, 0.6, 0.3];
    const slotDepth = [1,   2,   4,   2,   1  ];
    const cy = h * 0.50;

    this.stagePreviews = this._stageList.map((stage, i) => {
      const thumb = this.add.image(w / 2, cy, stage.thumbKey)
        .setDisplaySize(THUMB_W, THUMB_H).setScale(1).setAlpha(0).setDepth(1);
      const name = this.add.text(w / 2, cy + THUMB_H / 2 + 10, stage.displayName, {
        fontSize: '12px', fontFamily: 'monospace',
        color: '#ff88ff',
        stroke: '#000000', strokeThickness: 2,
        wordWrap: { width: THUMB_W }, align: 'center',
      }).setOrigin(0.5, 0).setAlpha(0).setDepth(1);
      const hl = this.add.graphics().setDepth(5);
      this.dynamicObjects.push(thumb, name, hl);
      return { thumb, name, hl };
    });

    // Nom du stage sélectionné (grand, centré en bas)
    this._stageNameText = this.add.text(w / 2, h * 0.76, '', {
      fontSize: '22px', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);
    this.dynamicObjects.push(this._stageNameText);

    // Flèches
    this._stageArrowL = this.add.text(w * 0.08, cy, '◀', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    this._stageArrowR = this.add.text(w * 0.92, cy, '▶', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    this._stageArrowL.on('pointerdown', () => this._stageNav(-1));
    this._stageArrowR.on('pointerdown', () => this._stageNav(1));
    this.dynamicObjects.push(this._stageArrowL, this._stageArrowR);

    // Compteur x/total
    this._stageCounter = this.add.text(w / 2, h * 0.83, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#777799',
    }).setOrigin(0.5).setDepth(10);
    this.dynamicObjects.push(this._stageCounter);

    const hint = this.add.text(w / 2, h * 0.92, '← → : Naviguer  |  ENTER / Clic : Valider  |  ESC : Retour', {
      fontSize: '13px', fontFamily: 'monospace', color: '#555577',
    }).setOrigin(0.5);
    this.dynamicObjects.push(hint);

    // Click center thumbnail to confirm
    const stageConfirmZone = this.add.zone(w / 2, cy, 280, 170)
      .setInteractive({ useHandCursor: true }).setDepth(10);
    stageConfirmZone.on('pointerdown', () => {
      if (this.confirmed) return;
      this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
      this.selectedStage = this.selectedIndex + 1;
      this.launchDuel();
    });
    this.dynamicObjects.push(stageConfirmZone);

    this._layoutStageCarousel();
  }

  _stageNav(dir) {
    const total = this._stageList.length;
    this.selectedIndex = (this.selectedIndex + dir + total) % total;
    this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume });
    this._layoutStageCarousel();
  }

  _layoutStageCarousel() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const n = this._stageList.length;
    const sel = this.selectedIndex;
    // Dimensions fixes par slot — toutes les miniatures ont la même taille affichée
    const BASE_W = 260, BASE_H = 146;
    const cy = h * 0.50;
    const slotX    = [w/2 - 520, w/2 - 280, w/2, w/2 + 280, w/2 + 520];
    const slotW    = [156, 208, BASE_W, 208, 156]; // largeurs absolues par slot
    const slotH    = [88,  117, BASE_H, 117, 88 ]; // hauteurs absolues par slot
    const slotAlpha = [0.3, 0.6, 1.0, 0.6, 0.3];
    const slotDepth = [1,   2,   4,   2,   1  ];
    const slots = [-2, -1, 0, 1, 2];

    this.stagePreviews.forEach((p, i) => {
      let dist = i - sel;
      if (dist >  n / 2) dist -= n;
      if (dist < -n / 2) dist += n;
      const slotIdx = slots.indexOf(dist);
      if (slotIdx === -1) {
        p.thumb.setAlpha(0); p.name.setAlpha(0); p.hl.clear(); return;
      }
      const tx = slotX[slotIdx];
      const tw = slotW[slotIdx];
      const th = slotH[slotIdx];
      const al = slotAlpha[slotIdx];
      const dp = slotDepth[slotIdx];
      // Tweener x et alpha ; setDisplaySize appliqué immédiatement pour taille fixe
      p.thumb.setDisplaySize(tw, th);
      this.tweens.add({ targets: p.thumb, x: tx, alpha: al, duration: 180, ease: 'Power2' });
      p.thumb.setDepth(dp);
      p.name.setDepth(dp);
      p.hl.clear();
      if (dist === 0) {
        p.hl.lineStyle(3, 0xffcc00, 0.9);
        p.hl.strokeRoundedRect(tx - BASE_W / 2, cy - BASE_H / 2, BASE_W, BASE_H, 8);
      }
    });

    // Mise à jour du nom et compteur
    const s = this._stageList[sel];
    this._stageNameText.setText(s.displayName).setColor('#ffcc00');
    this._stageCounter.setText((sel + 1) + ' / ' + n);
  }

  highlightStage(index) {
    // Délégué à _layoutStageCarousel dans le nouveau système
    this.selectedIndex = index;
    this._layoutStageCarousel();
  }

  showDetail() {
    if (this.detailVisible) return;
    this.detailVisible = true;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const panW = w * 0.52;
    const panH = 130;
    const panX = w / 2 - panW / 2;
    const panY = h * 0.76;

    this._detailBg = this.add.graphics().setDepth(50);
    this._detailTitle = this.add.text(w / 2, panY + 18, '', {
      fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(51);
    this._detailTraitName = this.add.text(w / 2, panY + 44, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffdd88',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(51);
    this._detailTraitDesc = this.add.text(w / 2, panY + 64, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#bbccbb',
      stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: panW - 24 }, align: 'center',
    }).setOrigin(0.5, 0).setDepth(51);
    this._detailHint = this.add.text(w / 2, panY + panH - 16, 'ESPACE / ÉCHAP : fermer', {
      fontSize: '11px', fontFamily: 'monospace', color: '#445544',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(51);

    this.detailObjects = [this._detailBg, this._detailTitle, this._detailTraitName, this._detailTraitDesc, this._detailHint];
    this._detailPanX = panX; this._detailPanY = panY; this._detailPanW = panW; this._detailPanH = panH;
    this.updateDetail();
  }

  updateDetail() {
    if (!this.detailVisible) return;
    const char = this._carouselChars[this.selectedIndex];
    const traitObj = char.trait ? TRAIT_LABELS[char.trait] : null;
    const charColor = Phaser.Display.Color.HexStringToColor(char.color).color;

    this._detailBg.clear();
    this._detailBg.fillStyle(0x060810, 0.92);
    this._detailBg.fillRoundedRect(this._detailPanX, this._detailPanY, this._detailPanW, this._detailPanH, 10);
    this._detailBg.lineStyle(2, charColor, 0.9);
    this._detailBg.strokeRoundedRect(this._detailPanX, this._detailPanY, this._detailPanW, this._detailPanH, 10);

    this._detailTitle.setText(char.name.toUpperCase()).setColor(char.color);
    this._detailTraitName.setText(traitObj ? '— ' + traitObj.short + ' —' : '');
    this._detailTraitDesc.setText(traitObj ? traitObj.desc : '(aucune capacité spéciale)');
  }

  hideDetail() {
    if (!this.detailVisible) return;
    this.detailVisible = false;
    this.detailObjects.forEach(o => o.destroy());
    this.detailObjects = [];
  }

  update() {
    if (this.confirmed) return;

    // Skip one frame after phase transition to avoid ENTER carrying over
    if (this._phaseChanged) { this._phaseChanged = false; return; }

    // ESPACE : toggle detail (seulement en phase perso)
    if ((this.phase === 'p1' || this.phase === 'p2') && Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.detailVisible ? this.hideDetail() : this.showDetail();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      if (this.detailVisible) { this.hideDetail(); return; }
      if (this.phase === 'mode') { this.stopSelectMusic(); this.scene.start('MenuScene'); return; }
      if (this.phase === 'p1') { this.showModeSelect(); return; }
      if (this.phase === 'p1outfit') { this.showCharSelect('p1'); return; }
      if (this.phase === 'p2') {
        if (this.p1Char && this.p1Char.outfits.length > 1) { this.showOutfitSelect('p1'); return; }
        this.showCharSelect('p1'); return;
      }
      if (this.phase === 'p2outfit') { this.showCharSelect('p2'); return; }
      if (this.phase === 'stage') {
        // Go back to p2 outfit if p2 has outfits, else go back to p2 char select
        if (this.p2Char && this.p2Char.outfits.length > 1) { this.showOutfitSelect('p2'); return; }
        this.showCharSelect('p2'); return;
      }
    }

    if (this.phase === 'mode') {
      let changed = false;
      if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
        this.selectedIndex = (this.selectedIndex + 1) % this.modeOptions.length; changed = true;
      }
      if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
        this.selectedIndex = (this.selectedIndex - 1 + this.modeOptions.length) % this.modeOptions.length; changed = true;
      }
      if (changed) { this.updateModeHighlight(); this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume }); }

      if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
        this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
        if (this.selectedIndex === 3) {
          // TUTORIEL
          this.stopSelectMusic();
          this.cameras.main.flash(200, 255, 255, 255);
          this.time.delayedCall(250, () => { this.scene.start('TutorialScene'); });
          return;
        }
        // 0 = AVENTURE (arcade), 1 = JOUEUR vs IA (J1 choisit les deux persos), 2 = PvP
        this.arcade  = this.selectedIndex === 0;
        this.vsAI    = this.selectedIndex <= 1;
        this.showCharSelect('p1');
      }
    } else if (this.phase === 'p1' || this.phase === 'p2') {
      if (Phaser.Input.Keyboard.JustDown(this.keyRight)) this._carouselNav(1);
      if (Phaser.Input.Keyboard.JustDown(this.keyLeft))  this._carouselNav(-1);

      if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
        this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
        const chosen = this._carouselChars[this.selectedIndex];
        if (this.phase === 'p1') {
          this.p1Char = chosen;
          this.p1Outfit = null;
          if (this.arcade) {
            // AVENTURE : ordre arcade fixe, l'IA gère les adversaires
            const allChars = { ...CHARACTERS, ...GHOST_CHARACTERS, ...HIDDEN_CHARACTERS };
            const chosenKey = Object.keys(allChars).find(k => allChars[k] === chosen);
            let arcadeOpponents;
            if (CHEAT_SETTINGS.finalFight) {
              // Cheat "final fight" : directement contre le boss final
              arcadeOpponents = [HIDDEN_CHARACTERS.Wanderer_Magician];
            } else {
              arcadeOpponents = ARCADE_ORDER
                .filter(k => k !== chosenKey)
                .map(k => allChars[k]);
            }
            this.p2Char = arcadeOpponents[0];
            this.p2Outfit = null;
            this.arcadeOpponents = arcadeOpponents;
            this.launchDuel();
          } else {
            // Si le perso a plus d'un outfit, proposer le choix
            if (chosen.outfits.length > 1) {
              this.showOutfitSelect('p1');
            } else {
              this.showCharSelect('p2');
            }
          }
        } else {
          // P2 choisi (par J1 en vsAI ou par J2 en PvP)
          this.p2Char = chosen;
          this.p2Outfit = null;
          if (chosen.outfits.length > 1) {
            this.showOutfitSelect('p2');
          } else {
            this.showStageSelect();
          }
        }
      }
    } else if (this.phase === 'p1outfit' || this.phase === 'p2outfit') {
      if (Phaser.Input.Keyboard.JustDown(this.keyRight)) this._outfitNav(1);
      if (Phaser.Input.Keyboard.JustDown(this.keyLeft))  this._outfitNav(-1);

      if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
        this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
        const chosen = this._outfitChars[this.selectedIndex];
        if (this.phase === 'p1outfit') {
          this.p1Outfit = chosen.folder ? chosen : null; // null = default
          this.showCharSelect('p2');
        } else {
          this.p2Outfit = chosen.folder ? chosen : null;
          this.showStageSelect();
        }
      }
    } else if (this.phase === 'stage') {
      if (Phaser.Input.Keyboard.JustDown(this.keyRight)) this._stageNav(1);
      if (Phaser.Input.Keyboard.JustDown(this.keyLeft))  this._stageNav(-1);

      if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
        this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
        this.selectedStage = this.selectedIndex + 1;
        this.launchDuel();
      }
    }
  }

  stopSelectMusic() {
    if (this.selectBgm && this.selectBgm.isPlaying) this.selectBgm.stop();
  }

  // Returns an alternate color for P2 when it's a mirror match (same character as P1)
  _mirrorColorFor(charDef) {
    // Shift hue by rotating RGB components to produce a visually distinct but thematic tint
    const hex = charDef.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Mix with a fixed amber shift: blend toward #ffaa22
    const mr = Math.min(255, Math.round(r * 0.4 + 0xdd * 0.6));
    const mg = Math.min(255, Math.round(g * 0.4 + 0x88 * 0.6));
    const mb = Math.min(255, Math.round(b * 0.4 + 0x22 * 0.6));
    return '#' + mr.toString(16).padStart(2, '0') + mg.toString(16).padStart(2, '0') + mb.toString(16).padStart(2, '0');
  }

  launchDuel() {
    this.confirmed = true;
    this._previewCycleActive = false;
    if (this._previewTimer) { this._previewTimer.remove(false); this._previewTimer = null; }
    this.stopSelectMusic();
    this.sound.play('duel_announce', { volume: AUDIO_SETTINGS.sfxVolume });
    this.cameras.main.flash(300, 255, 255, 255);
    this.time.delayedCall(400, () => {
      // Mirror match: même perso ET même outfit (ou les deux sans outfit)
      const sameChar = this.p1Char === this.p2Char;
      const sameOutfit = (this.p1Outfit || null) === (this.p2Outfit || null);
      const isMirror = sameChar && sameOutfit;
      const data = {
        p1: this.p1Char,
        p2: this.p2Char,
        p1Outfit: this.p1Outfit || null,
        p2Outfit: this.p2Outfit || null,
        vsAI: this.vsAI,
        stageIndex: this.selectedStage || null,
        p2Color: isMirror ? this._mirrorColorFor(this.p2Char) : null,
      };
      if (this.arcade && this.arcadeOpponents) {
        data.arcade = true;
        data.arcadeOpponents = this.arcadeOpponents;
        data.arcadeIndex = 0;
      }
      this.scene.start('DuelScene', data);
    });
  }
}
