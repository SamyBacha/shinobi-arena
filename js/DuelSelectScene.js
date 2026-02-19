// ============================================================
// Duel Select Scene
// ============================================================
// Tous les stages sont des GIFs chargés depuis img/world/scenes/
// GIF_SCENES est défini dans js/scenes-manifest.js
// stageIndex 1, 2, 3... correspondent à GIF_SCENES[0], [1], [2]...

class DuelSelectScene extends Phaser.Scene {
  constructor() { super('DuelSelectScene'); }

  init(data) {
    this._initData = data || {};
  }

  preload() {
    [...Object.values(CHARACTERS), ...Object.values(GHOST_CHARACTERS), ...Object.values(HIDDEN_CHARACTERS)].forEach(char => {
      const key = 'select_' + char.folder + '_idle';
      if (!this.textures.exists(key)) {
        const base = char.imgBase || IMG_BASE;
        const fs = char.frameSize || FRAME_SIZE;
        this.load.spritesheet(key, base + char.folder + '/Idle.png', {
          frameWidth: fs, frameHeight: fs
        });
      }
    });
    if (!this.cache.audio.exists('duel_select_bgm')) {
      this.load.audio('duel_select_bgm', 'music/liecio-loop-menu-preview-109594.mp3');
    }
    if (!this.cache.audio.exists('duel_announce')) {
      this.load.audio('duel_announce', 'music/25249708_announcer-let-the-battles-begin_by_applehillstudios_preview.mp3');
    }
    if (!this.cache.audio.exists('menu_click')) {
      this.load.audio('menu_click', 'music/freesound_community-menu-click-89198.mp3');
    }
    if (!this.cache.audio.exists('menu_nav')) {
      this.load.audio('menu_nav', 'music/freesound_community-menu-button-88360.mp3');
    }
    // Stage thumbnails — GIF scenes (première frame chargée par Phaser)
    GIF_SCENES.forEach((filename, idx) => {
      const key = 'stage_thumb_' + idx;
      if (!this.textures.exists(key)) {
        this.load.image(key, 'img/world/scenes/' + filename);
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

    this.phase = 'mode'; // 'mode' | 'p1' | 'p2' | 'stage'
    this.vsAI   = false;
    this.arcade = false;
    this.p1Char = null;
    this.p2Char = null;
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

    this.modeOptions = ['AVENTURE', 'JOUEUR vs IA', 'JOUEUR vs JOUEUR'];
    this.modeTexts = [];
    this.modeOptions.forEach((label, i) => {
      const txt = this.add.text(w / 2, h * 0.45 + i * 70, label, {
        fontSize: '28px', fontFamily: 'monospace', color: '#888888',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
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
    ];

    const cy = h * 0.50;
    const cx = w / 2;
    this._carouselCY = cy;
    this._carouselCX = cx;
    this.charPreviews = [];

    this._carouselChars.forEach((char) => {
      const animKey = 'select_anim_' + char.folder;
      if (!this.anims.exists(animKey)) {
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers('select_' + char.folder + '_idle', {
            start: 0, end: char.sheets.idle.frames - 1,
          }),
          frameRate: 8, repeat: -1,
        });
      }
      const baseScale = (FRAME_SIZE / (char.frameSize || FRAME_SIZE)) * (char.duelScale || 1);
      const sprite = this.add.sprite(cx, cy, 'select_' + char.folder + '_idle', 0);
      sprite.setOrigin(0.5, 0.75);
      sprite.play(animKey);
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

    const hint = this.add.text(w / 2, h * 0.88, '←→ : Naviguer  |  ESPACE : Détails  |  ENTER : Valider  |  ESC : Retour', {
      fontSize: '13px', fontFamily: 'monospace', color: '#555577',
    }).setOrigin(0.5);
    this.dynamicObjects.push(hint);

    this._layoutCarousel();
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
      const charColor = Phaser.Display.Color.HexStringToColor(char.color).color;
      this._carouselFrame.clear();
      this._carouselFrame.fillStyle(0x000000, 0.25);
      this._carouselFrame.fillRoundedRect(cx - fw / 2, cy - fh / 2, fw, fh, 10);
      this._carouselFrame.lineStyle(3, charColor, 0.9);
      this._carouselFrame.strokeRoundedRect(cx - fw / 2, cy - fh / 2, fw, fh, 10);
    }
    if (this._carouselName)  this._carouselName.setText(char.name.toUpperCase()).setColor(char.color);
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
    this._stageList = GIF_SCENES.map((filename, idx) => ({
      thumbKey: 'stage_thumb_' + idx,
      name: filename.replace(/\.gif$/i, ''),
      isGif: true,
    }));

    // Carrousel horizontal : 5 slots visibles, centre = sélection
    const THUMB_W = 260, THUMB_H = 146;
    const slotX    = [w/2 - 520, w/2 - 280, w/2, w/2 + 280, w/2 + 520];
    const slotScale = [0.6, 0.8, 1.0, 0.8, 0.6];
    const slotAlpha = [0.3, 0.6, 1.0, 0.6, 0.3];
    const slotDepth = [1,   2,   4,   2,   1  ];
    const cy = h * 0.50;

    this.stagePreviews = this._stageList.map((s, i) => {
      const thumb = this.add.image(w / 2, cy, s.thumbKey)
        .setDisplaySize(THUMB_W, THUMB_H).setScale(1).setAlpha(0).setDepth(1);
      const name = this.add.text(w / 2, cy + THUMB_H / 2 + 10, s.name, {
        fontSize: '12px', fontFamily: 'monospace',
        color: s.isGif ? '#ff88ff' : '#cccccc',
        stroke: '#000000', strokeThickness: 2,
        wordWrap: { width: THUMB_W }, align: 'center',
      }).setOrigin(0.5, 0).setAlpha(0).setDepth(1);
      const hl = this.add.graphics().setDepth(5);
      this.dynamicObjects.push(thumb, name, hl);
      return { thumb, name, hl, isGif: s.isGif };
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

    const hint = this.add.text(w / 2, h * 0.92, '← → : Naviguer  |  ENTER : Valider  |  ESC : Retour', {
      fontSize: '13px', fontFamily: 'monospace', color: '#555577',
    }).setOrigin(0.5);
    this.dynamicObjects.push(hint);

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
    this._stageNameText.setText(s.name).setColor('#ffcc00');
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
      if (this.phase === 'p2') { this.showCharSelect('p1'); return; }
      if (this.phase === 'stage') { this.showCharSelect('p2'); return; }
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
            this.arcadeOpponents = arcadeOpponents;
            this.launchDuel();
          } else {
            // JOUEUR vs IA ou PvP : J1 a choisi, on passe à P2
            this.showCharSelect('p2');
          }
        } else {
          // P2 choisi (par J1 en vsAI ou par J2 en PvP)
          this.p2Char = chosen;
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

  launchDuel() {
    this.confirmed = true;
    this.stopSelectMusic();
    this.sound.play('duel_announce', { volume: AUDIO_SETTINGS.sfxVolume });
    this.cameras.main.flash(300, 255, 255, 255);
    this.time.delayedCall(400, () => {
      const data = {
        p1: this.p1Char,
        p2: this.p2Char,
        vsAI: this.vsAI,
        stageIndex: this.selectedStage || null
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
