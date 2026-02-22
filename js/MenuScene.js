// ============================================================
// Menu Scene
// ============================================================
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  preload() {
    if (!this.cache.audio.exists('menu_bgm')) {
      this.load.audio('menu_bgm', 'music/bgm_menu.mp3');
    }
    if (!this.cache.audio.exists('menu_nav')) {
      this.load.audio('menu_nav', 'music/sfx_menu_nav.mp3');
    }
    if (!this.cache.audio.exists('menu_click')) {
      this.load.audio('menu_click', 'music/sfx_menu_click.mp3');
    }

    // Preload idle spritesheets for all characters (miniatures in Options)
    const allChars = [...Object.values(CHARACTERS), ...Object.values(GHOST_CHARACTERS), ...Object.values(HIDDEN_CHARACTERS)];
    allChars.forEach(charDef => {
      const loadKey = 'menu_' + charDef.folder + '_idle';
      if (!this.textures.exists(loadKey)) {
        this.load.spritesheet(loadKey, charDef.assetFolder + charDef.sheets.idle.file, {
          frameWidth: charDef.frameSize, frameHeight: charDef.frameSize
        });
      }
    });
  }

  create() {
    applyGraphicsSettings(this);
    smokeShader.start();
    this.events.once('shutdown', () => {
      smokeShader.stop();
      if (this.cheatKeyHandler) {
        window.removeEventListener('keydown', this.cheatKeyHandler, true);
        this.cheatKeyHandler = null;
      }
      if (this._deactivateTimer) { this._deactivateTimer.remove(false); this._deactivateTimer = null; }
    });

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    this.cameras.main.setBackgroundColor('#0e0e1a');

    // Menu music
    this.menuBgm = this.sound.add('menu_bgm', { loop: true, volume: AUDIO_SETTINGS.musicVolume });
    this.menuBgm.play();

    // Title
    this.add.text(w / 2, h * 0.18, 'SHINOBI ARENA', {
      fontSize: '56px', fontFamily: 'monospace', color: '#ff4444',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(w / 2, h * 0.28, '忍者アリーナ', {
      fontSize: '22px', fontFamily: 'monospace', color: '#aa3333',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Menu options
    this.options = ['AVENTURE', 'DUEL', 'PERSONNAGES', 'OPTIONS'];
    this.selectedIndex = 0;
    this.optionTexts = [];

    this.options.forEach((label, i) => {
      const txt = this.add.text(w / 2, h * 0.44 + i * 60, label, {
        fontSize: '32px', fontFamily: 'monospace', color: '#888888',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5);
      this.optionTexts.push(txt);
    });

    // Arrow indicator
    this.arrow = this.add.text(0, 0, '▶', {
      fontSize: '28px', fontFamily: 'monospace', color: '#ff4444',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    this.updateMenuHighlight();

    // Controls hint
    this.add.text(w / 2, h * 0.85, '↑↓ : Naviguer  |  ENTER : Valider', {
      fontSize: '14px', fontFamily: 'monospace', color: '#555577',
    }).setOrigin(0.5);

    // Keys
    this.keyUp = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyLeft = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.confirmed = false;
    this.showingOptions = false;
    this.showingPersonnages = false;
    this.optionsObjects = [];
    this.personnagesObjects = [];
    this.persoListItems = [];
    this.persoChars = [];
    this.persoSelectedIndex = 0;
    this.persoAnimTimer = null;
    this.optionsIndex = 0;

    // Cheat code visible input
    this.cheatActive = false;
    this.cheatBuffer = '';
    this.cheatUnlockText = null;

    // Cheat input bar (hidden by default, shown on focus)
    this.cheatLabel = this.add.text(w / 2, h * 0.93, '> Code secret...', {
      fontSize: '13px', fontFamily: 'monospace', color: '#444466',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    this.cheatLabel.on('pointerdown', () => { this.activateCheatInput(); });

    // Input box elements (created but hidden)
    this.cheatBoxGfx = this.add.graphics().setDepth(10);
    this.cheatInputText = this.add.text(w / 2, h * 0.93, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#00ff88',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(11).setVisible(false);
    this.cheatCursor = this.add.text(0, h * 0.93, '_', {
      fontSize: '16px', fontFamily: 'monospace', color: '#00ff88',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(11).setVisible(false);

    this.drawCheatBox(false);

    this.createMenuParticles();
  }

  drawCheatBox(active) {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const boxW = 240;
    const boxH = 28;
    const bx = w / 2 - boxW / 2;
    const by = h * 0.93 - boxH / 2;

    this.cheatBoxGfx.clear();
    if (active) {
      this.cheatBoxGfx.fillStyle(0x111122, 0.9);
      this.cheatBoxGfx.fillRoundedRect(bx, by, boxW, boxH, 6);
      this.cheatBoxGfx.lineStyle(1, 0x00ff88, 0.6);
      this.cheatBoxGfx.strokeRoundedRect(bx, by, boxW, boxH, 6);
    }
  }

  activateCheatInput() {
    if (this.cheatActive) return;
    this.cheatActive = true;
    this.cheatBuffer = '';
    this.cheatLabel.setVisible(false);
    this.cheatInputText.setVisible(true).setText('');
    this.cheatCursor.setVisible(true);
    this.drawCheatBox(true);
    this.updateCheatDisplay();

    // Blinking cursor
    this.cheatCursorTween = this.tweens.add({
      targets: this.cheatCursor, alpha: 0, duration: 400, yoyo: true, repeat: -1,
    });

    // Keyboard listener for typing — use native DOM event to intercept before Phaser
    this.cheatKeyHandler = (event) => {
      if (!this.cheatActive) return;
      // Stop the event from reaching Phaser's keyboard manager
      event.stopPropagation();
      event.preventDefault();
      const k = event.key;
      if (k === 'Escape') { this.deactivateCheatInput(); return; }
      if (k === 'Enter') { this.submitCheatCode(); return; }
      if (k === 'Backspace') {
        this.cheatBuffer = this.cheatBuffer.slice(0, -1);
      } else if (k.length === 1 && this.cheatBuffer.length < 16) {
        this.cheatBuffer += k.toLowerCase();
      }
      this.updateCheatDisplay();
    };
    window.addEventListener('keydown', this.cheatKeyHandler, true);

    // Click outside the box closes the input
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const boxW = 240;
    const boxH = 28;
    const bx = w / 2 - boxW / 2;
    const by = h * 0.93 - boxH / 2;
    this.cheatClickOutsideHandler = (ptr) => {
      if (ptr.x < bx || ptr.x > bx + boxW || ptr.y < by || ptr.y > by + boxH) {
        this.deactivateCheatInput();
      }
    };
    this.input.on('pointerdown', this.cheatClickOutsideHandler);
  }

  deactivateCheatInput() {
    // Annuler tout delayedCall de désactivation encore en attente
    if (this._deactivateTimer) { this._deactivateTimer.remove(false); this._deactivateTimer = null; }

    this.cheatActive = false;
    this.cheatBuffer = '';
    this.cheatLabel.setVisible(true);
    this.cheatInputText.setVisible(false);
    this.cheatCursor.setVisible(false);
    this.drawCheatBox(false);
    if (this.cheatCursorTween) { this.cheatCursorTween.stop(); this.cheatCursorTween = null; }
    if (this.cheatKeyHandler) {
      window.removeEventListener('keydown', this.cheatKeyHandler, true);
      this.cheatKeyHandler = null;
    }
    if (this.cheatClickOutsideHandler) {
      this.input.off('pointerdown', this.cheatClickOutsideHandler);
      this.cheatClickOutsideHandler = null;
    }
  }

  updateCheatDisplay() {
    const w = this.cameras.main.width;
    this.cheatInputText.setText(this.cheatBuffer);
    // Position cursor after text
    const textRight = w / 2 + this.cheatInputText.width / 2 + 2;
    this.cheatCursor.setX(textRight);
  }

  submitCheatCode() {
    if (this.cheatBuffer === 'badaboom') {
      CHEAT_SETTINGS.ghostsUnlocked  = true;
      CHEAT_SETTINGS.magikUnlocked   = true;
      CHEAT_SETTINGS.villageUnlocked = true;
      CHEAT_SETTINGS.yokaiUnlocked   = true;
      this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
      this.showCheatUnlock('TOUT DÉBLOQUÉ !', 'TOUT DÉBLOQUÉ');
      this.deactivateCheatInput();
    } else if (this.cheatBuffer === 'finalfight') {
      CHEAT_SETTINGS.finalFight = !CHEAT_SETTINGS.finalFight;
      CHEAT_SETTINGS.magikUnlocked = true; // le Magician doit être disponible
      this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
      const msg = CHEAT_SETTINGS.finalFight ? 'FINAL FIGHT ACTIVÉ !' : 'FINAL FIGHT DÉSACTIVÉ !';
      this.showCheatUnlock(msg, 'FINAL FIGHT');
      this.deactivateCheatInput();
    } else if (this.cheatBuffer === 'ghost' && !CHEAT_SETTINGS.ghostsUnlocked) {
      CHEAT_SETTINGS.ghostsUnlocked = true;
      this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
      this.showCheatUnlock('GHOSTS DÉBLOQUÉS !', 'GHOSTS DÉBLOQUÉS');
      this.deactivateCheatInput();
    } else if (this.cheatBuffer === 'magik' && !CHEAT_SETTINGS.magikUnlocked) {
      CHEAT_SETTINGS.magikUnlocked = true;
      this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
      this.showCheatUnlock('MAGICIAN DÉBLOQUÉ !', 'MAGICIAN DÉBLOQUÉ');
      this.deactivateCheatInput();
    } else if (this.cheatBuffer === 'village' && !CHEAT_SETTINGS.villageUnlocked) {
      CHEAT_SETTINGS.villageUnlocked = true;
      this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
      this.showCheatUnlock('VILLAGE DÉBLOQUÉ !', 'VILLAGE DÉBLOQUÉ');
      this.deactivateCheatInput();
    } else if (this.cheatBuffer === 'yokai' && !CHEAT_SETTINGS.yokaiUnlocked) {
      CHEAT_SETTINGS.yokaiUnlocked = true;
      this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
      this.showCheatUnlock('YOKAI DÉBLOQUÉ !', 'YOKAI DÉBLOQUÉ');
      this.deactivateCheatInput();
    } else if (this.cheatBuffer) {
      // Wrong code — flash red then close after delay
      this.cheatInputText.setColor('#ff4444');
      this._deactivateTimer = this.time.delayedCall(600, () => {
        this._deactivateTimer = null;
        this.cheatInputText.setColor('#00ff88');
        this.deactivateCheatInput();
      });
    } else {
      this.deactivateCheatInput();
    }
  }

  showCheatUnlock(msg, label) {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    // Message flash temporaire (disparaît après 4.5s)
    if (this.cheatUnlockText) this.cheatUnlockText.destroy();
    this.cheatUnlockText = this.add.text(w / 2, h * 0.70, msg, {
      fontSize: '24px', fontFamily: 'monospace', color: '#00ff88',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100);
    this.tweens.add({
      targets: this.cheatUnlockText,
      alpha: 0, y: h * 0.65,
      delay: 3000,
      duration: 1500, ease: 'Power2',
      onComplete: () => { if (this.cheatUnlockText) this.cheatUnlockText.destroy(); }
    });
    // Le cheatLabel reprend son texte par défaut après le flash
    this.cheatLabel.setText('> Code secret...').setColor('#444466').setAlpha(1);
    this.cameras.main.flash(300, 0, 255, 100);
  }

  createMenuParticles() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // --- Leaf texture (small diamond ~8x6) ---
    const leafGfx = this.make.graphics({ x: 0, y: 0, add: false });
    leafGfx.fillStyle(0xffffff, 1);
    leafGfx.fillTriangle(4, 0, 8, 3, 4, 6);
    leafGfx.fillTriangle(4, 0, 0, 3, 4, 6);
    leafGfx.generateTexture('leaf_particle', 8, 6);
    leafGfx.destroy();

    // --- Leaf emitter ---
    this.add.particles(0, 0, 'leaf_particle', {
      x: { min: 0, max: w },
      y: -10,
      lifespan: 8000,
      speedY: { min: 30, max: 60 },
      speedX: { min: -20, max: 20 },
      rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.5 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xff4444, 0xff8844, 0x44aa44, 0xffcc00],
      frequency: 300,
      quantity: 1,
    }).setDepth(-1);

  }

  updateMenuHighlight() {
    this.optionTexts.forEach((txt, i) => {
      if (i === this.selectedIndex) {
        txt.setColor('#ffffff');
        txt.setScale(1.15);
        this.arrow.setPosition(txt.x - txt.width * 0.6 - 20, txt.y);
      } else {
        txt.setColor('#888888');
        txt.setScale(1);
      }
    });
  }

  // ---- Options overlay ----
  showOptionsMenu() {
    this.showingOptions = true;
    this.optionsIndex = 0;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // 8 rows: musique, effets, aide, boutons tactiles, --- séparateur, lissage, vignette, saturation, scanlines
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.88);
    overlay.fillRoundedRect(w / 2 - 270, h / 2 - 300, 540, 658, 14);
    overlay.lineStyle(2, 0x444488, 0.8);
    overlay.strokeRoundedRect(w / 2 - 270, h / 2 - 300, 540, 658, 14);
    overlay.setDepth(500);
    this.optionsObjects.push(overlay);

    const addTxt = (x, y, text, size, color) => {
      const t = this.add.text(x, y, text, {
        fontSize: size, fontFamily: 'monospace', color: color,
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(501);
      this.optionsObjects.push(t);
      return t;
    };

    addTxt(w / 2, h / 2 - 268, 'OPTIONS', '26px', '#ff4444');

    // ── Audio ──
    addTxt(w / 2, h / 2 - 228, '─── AUDIO ───', '13px', '#555577');

    addTxt(w / 2 - 160, h / 2 - 198, 'Musique', '18px', '#ffffff');
    this.musicBarBg = this.add.graphics().setDepth(501);
    this.musicBarFill = this.add.graphics().setDepth(502);
    this.musicValText = addTxt(w / 2 + 170, h / 2 - 198, '', '16px', '#ffcc00');
    this.optionsObjects.push(this.musicBarBg, this.musicBarFill);

    addTxt(w / 2 - 160, h / 2 - 140, 'Effets', '18px', '#ffffff');
    this.sfxBarBg = this.add.graphics().setDepth(501);
    this.sfxBarFill = this.add.graphics().setDepth(502);
    this.sfxValText = addTxt(w / 2 + 170, h / 2 - 140, '', '16px', '#ffcc00');
    this.optionsObjects.push(this.sfxBarBg, this.sfxBarFill);

    // ── Affichage ──
    addTxt(w / 2, h / 2 - 92, '─── AFFICHAGE ───', '13px', '#555577');

    addTxt(w / 2 - 160, h / 2 - 62, 'Aide', '18px', '#ffffff');
    this.hintCheckGfx = this.add.graphics().setDepth(502);
    this.optionsObjects.push(this.hintCheckGfx);
    this.hintValText = addTxt(w / 2 + 170, h / 2 - 62, '', '16px', '#ffcc00');

    addTxt(w / 2 - 160, h / 2 - 4, 'Boutons tactiles', '18px', '#ffffff');
    this.touchBtnsCheckGfx = this.add.graphics().setDepth(502);
    this.optionsObjects.push(this.touchBtnsCheckGfx);
    this.touchBtnsValText = addTxt(w / 2 + 170, h / 2 - 4, '', '16px', '#ffcc00');

    // ── Graphismes ──
    addTxt(w / 2, h / 2 + 58, '─── GRAPHISMES ───', '13px', '#555577');

    addTxt(w / 2 - 160, h / 2 + 90, 'Lissage', '18px', '#ffffff');
    this.smoothCheckGfx = this.add.graphics().setDepth(502);
    this.optionsObjects.push(this.smoothCheckGfx);
    this.smoothValText = addTxt(w / 2 + 170, h / 2 + 90, '', '16px', '#ffcc00');

    addTxt(w / 2 - 160, h / 2 + 148, 'Vignette', '18px', '#ffffff');
    this.vignetteBarBg = this.add.graphics().setDepth(501);
    this.vignetteBarFill = this.add.graphics().setDepth(502);
    this.vignetteValText = addTxt(w / 2 + 170, h / 2 + 148, '', '16px', '#ffcc00');
    this.optionsObjects.push(this.vignetteBarBg, this.vignetteBarFill);

    addTxt(w / 2 - 160, h / 2 + 206, 'Saturation', '18px', '#ffffff');
    this.satBarBg = this.add.graphics().setDepth(501);
    this.satBarFill = this.add.graphics().setDepth(502);
    this.satValText = addTxt(w / 2 + 170, h / 2 + 206, '', '16px', '#ffcc00');
    this.optionsObjects.push(this.satBarBg, this.satBarFill);

    addTxt(w / 2 - 160, h / 2 + 264, 'Scanlines', '18px', '#ffffff');
    this.scanCheckGfx = this.add.graphics().setDepth(502);
    this.optionsObjects.push(this.scanCheckGfx);
    this.scanValText = addTxt(w / 2 + 170, h / 2 + 264, '', '16px', '#ffcc00');

    // Option arrow
    this.optArrow = addTxt(0, 0, '▶', '18px', '#ff4444');

    // Hint
    addTxt(w / 2, h / 2 + 326, '↑↓ : Sélection  |  ←→ : Régler  |  ENTER : Cocher', '12px', '#777799');
    addTxt(w / 2, h / 2 + 342, 'ESC : Retour', '12px', '#777799');

    this.drawOptionsBars();
    this.drawHintCheckbox();
    this.drawTouchBtnsCheckbox();
    this.drawGraphicsControls();
    this.updateOptionsArrow();
  }

  // ---- Personnages overlay ----
  showPersonnagesMenu() {
    this.showingPersonnages = true;
    this.persoSelectedIndex = 0;
    this.persoAnimQueue = [];
    this.persoAnimTimer = null;

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Panel dimensions
    const panelW = 880;
    const panelH = 640;
    const panelX = w / 2 - panelW / 2;
    const panelY = h / 2 - panelH / 2;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.92);
    overlay.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    overlay.lineStyle(2, 0x444488, 0.8);
    overlay.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);
    overlay.setDepth(500);
    this.personnagesObjects.push(overlay);

    // Vertical divider
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x333366, 0.8);
    divider.lineBetween(panelX + 220, panelY + 50, panelX + 220, panelY + panelH - 40);
    divider.setDepth(501);
    this.personnagesObjects.push(divider);

    // Title
    const titleTxt = this.add.text(w / 2, panelY + 22, 'PERSONNAGES', {
      fontSize: '24px', fontFamily: 'monospace', color: '#ff4444',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(502);
    this.personnagesObjects.push(titleTxt);

    this.persoChars = [
      ...Object.values(CHARACTERS),
      ...(CHEAT_SETTINGS.ghostsUnlocked ? Object.values(GHOST_CHARACTERS) : []),
      ...(CHEAT_SETTINGS.villageUnlocked ? [HIDDEN_CHARACTERS.Kunoichi, HIDDEN_CHARACTERS.Ninja_Peasant] : []),
      ...(CHEAT_SETTINGS.magikUnlocked ? [HIDDEN_CHARACTERS.Wanderer_Magician] : []),
      ...(CHEAT_SETTINGS.yokaiUnlocked ? [HIDDEN_CHARACTERS.Yokai] : []),
    ];

    // ── LEFT: character list ──
    const listX = panelX + 14;
    const listItemH = 48;
    const listStartY = panelY + 54;

    this.persoListItems = [];
    this.persoChars.forEach((charDef, i) => {
      const iy = listStartY + i * listItemH;

      const bg = this.add.graphics().setDepth(501);
      this.personnagesObjects.push(bg);

      const spriteKey = 'menu_' + charDef.folder + '_idle';
      let miniSpr = null;
      if (this.textures.exists(spriteKey)) {
        miniSpr = this.add.sprite(listX + 22, iy + listItemH / 2, spriteKey, 0)
          .setScale(0.28 * (FRAME_SIZE / charDef.frameSize)).setDepth(503);
        this.personnagesObjects.push(miniSpr);
      }

      const nameTxt = this.add.text(listX + 46, iy + listItemH / 2, charDef.name.toUpperCase(), {
        fontSize: '13px', fontFamily: 'monospace', color: charDef.color,
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0, 0.5).setDepth(503);
      this.personnagesObjects.push(nameTxt);

      // Click zone
      const zone = this.add.zone(listX, iy, 206, listItemH).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(504);
      zone.on('pointerdown', () => { this.selectPersoIndex(i); });
      zone.on('pointerover', () => { if (this.persoSelectedIndex !== i) bg.setAlpha(0.5); });
      zone.on('pointerout',  () => { bg.setAlpha(1); });
      this.personnagesObjects.push(zone);

      this.persoListItems.push({ bg, nameTxt, miniSpr, charDef });
    });

    // ── RIGHT: detail panel ──
    const detailX = panelX + 230;
    const detailY = panelY + 54;
    const detailW = panelW - 240;

    // Big sprite placeholder
    this.persoDetailSprite = this.add.sprite(detailX + 68, detailY + 100, 'menu_' + this.persoChars[0].folder + '_idle', 0)
      .setScale(1.8).setDepth(503);
    this.personnagesObjects.push(this.persoDetailSprite);

    // Anim label (e.g. "IDLE", "ATTAQUE 1"…)
    this.persoAnimLabel = this.add.text(detailX + 68, detailY + 198, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#888899',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(503);
    this.personnagesObjects.push(this.persoAnimLabel);

    // Name
    this.persoDetailName = this.add.text(detailX + 140, detailY + 10, '', {
      fontSize: '22px', fontFamily: 'monospace', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(503);
    this.personnagesObjects.push(this.persoDetailName);

    // Trait badge
    this.persoDetailTrait = this.add.text(detailX + 140, detailY + 36, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffcc00',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(503);
    this.personnagesObjects.push(this.persoDetailTrait);

    // Actions block
    const actionsData = [
      { icon: '⚡', label: 'Recharger',  desc: 'Gagne 1 charge (utilisée pour attaquer).' },
      { icon: '🛡', label: 'Protéger',   desc: 'Bloque les attaques entrantes.' },
      { icon: '⚔', label: 'Frapper',    desc: 'Attaque de base (coûte 1 charge).' },
      { icon: '⚔', label: 'Frapper x2', desc: 'Attaque puissante (coûte 2 charges).' },
      { icon: '⚔', label: 'Frapper x3', desc: 'Attaque lourde (coûte 3 charges, non dispo tous).' },
    ];

    const actY0 = detailY + 220;
    const actRowH = 46;
    actionsData.forEach((a, i) => {
      const ay = actY0 + i * actRowH;
      const aCard = this.add.graphics().setDepth(501);
      aCard.fillStyle(0x111133, 0.6);
      aCard.fillRoundedRect(detailX + 130, ay, detailW - 136, actRowH - 6, 6);
      aCard.lineStyle(1, 0x333366, 0.7);
      aCard.strokeRoundedRect(detailX + 130, ay, detailW - 136, actRowH - 6, 6);
      this.personnagesObjects.push(aCard);

      const labelColor = i === 0 ? '#44bbff' : i === 1 ? '#44dd88' : '#ff8844';
      const lTxt = this.add.text(detailX + 142, ay + 10, a.label, {
        fontSize: '13px', fontFamily: 'monospace', color: labelColor,
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0, 0).setDepth(503);
      this.personnagesObjects.push(lTxt);

      const dTxt = this.add.text(detailX + 142, ay + 27, a.desc, {
        fontSize: '10px', fontFamily: 'monospace', color: '#aaaacc',
        stroke: '#000000', strokeThickness: 2,
        wordWrap: { width: detailW - 150 },
      }).setOrigin(0, 0).setDepth(503);
      this.personnagesObjects.push(dTxt);
    });

    // Trait desc box (below actions)
    const traitBoxY = actY0 + actionsData.length * actRowH + 4;
    const traitBoxH = 68;
    this.persoTraitBox = this.add.graphics().setDepth(501);
    this.personnagesObjects.push(this.persoTraitBox);

    const traitBadgeLabel = this.add.text(detailX + 142, traitBoxY + 8, 'CAPACITÉ SPÉCIALE', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ff4444',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0).setDepth(503);
    this.personnagesObjects.push(traitBadgeLabel);

    this.persoTraitDesc = this.add.text(detailX + 142, traitBoxY + 24, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaddaa',
      stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: detailW - 150 },
    }).setOrigin(0, 0).setDepth(503);
    this.personnagesObjects.push(this.persoTraitDesc);

    this._persoTraitBoxX = detailX + 130;
    this._persoTraitBoxY = traitBoxY;
    this._persoTraitBoxW = detailW - 136;
    this._persoTraitBoxH = traitBoxH;

    // Hint
    const hintTxt = this.add.text(w / 2, panelY + panelH - 16, '↑↓ : Naviguer  |  ESC : Retour', {
      fontSize: '12px', fontFamily: 'monospace', color: '#555577',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(502);
    this.personnagesObjects.push(hintTxt);

    // Init first selection
    this.selectPersoIndex(0);
  }

  selectPersoIndex(index) {
    const chars = this.persoChars;
    if (!chars || index < 0 || index >= chars.length) return;
    this.persoSelectedIndex = index;
    const charDef = chars[index];

    // Highlight list items
    const panelX = this.cameras.main.width / 2 - 440;
    const panelY = this.cameras.main.height / 2 - 320;
    const listX = panelX + 14;
    const listStartY = panelY + 54;
    const listItemH = 48;

    this.persoListItems.forEach((item, i) => {
      item.bg.clear();
      const iy = listStartY + i * listItemH;
      if (i === index) {
        const color = Phaser.Display.Color.HexStringToColor(item.charDef.color).color;
        item.bg.fillStyle(color, 0.2);
        item.bg.fillRoundedRect(listX, iy, 206, listItemH - 2, 6);
        item.bg.lineStyle(1, color, 0.5);
        item.bg.strokeRoundedRect(listX, iy, 206, listItemH - 2, 6);
        item.nameTxt.setColor('#ffffff');
      } else {
        item.nameTxt.setColor(item.charDef.color);
      }
    });

    // Update detail name & trait
    this.persoDetailName.setText(charDef.name.toUpperCase()).setColor(charDef.color);
    const traitObj = charDef.trait ? TRAIT_LABELS[charDef.trait] : null;
    this.persoDetailTrait.setText(traitObj ? '✦ ' + traitObj.short : '');
    this.persoTraitDesc.setText(traitObj ? traitObj.desc : '—');

    // Trait box border color
    this.persoTraitBox.clear();
    const traitColor = Phaser.Display.Color.HexStringToColor(charDef.color).color;
    this.persoTraitBox.fillStyle(0x111133, 0.7);
    this.persoTraitBox.fillRoundedRect(this._persoTraitBoxX, this._persoTraitBoxY, this._persoTraitBoxW, this._persoTraitBoxH, 6);
    this.persoTraitBox.lineStyle(1, traitColor, 0.6);
    this.persoTraitBox.strokeRoundedRect(this._persoTraitBoxX, this._persoTraitBoxY, this._persoTraitBoxW, this._persoTraitBoxH, 6);

    // Start animation sequence
    this._startPersoAnimSequence(charDef);
  }

  _startPersoAnimSequence(charDef) {
    // Clear any running timer
    if (this.persoAnimTimer) { this.persoAnimTimer.remove(); this.persoAnimTimer = null; }

    // Build queue of available anims with labels
    const animDefs = [
      { key: 'idle',         label: 'REPOS',       duration: 2000 },
      { key: 'walk',         label: 'MARCHE',      duration: 1800 },
      { key: 'run',          label: 'COURSE',      duration: 1600 },
      { key: 'jump',         label: 'SAUT',        duration: 1600 },
      { key: 'attack1',      label: 'ATTAQUE 1',   duration: 1400 },
      { key: 'attack2',      label: 'ATTAQUE 2',   duration: 1400 },
      { key: 'attack3',      label: 'ATTAQUE 3',   duration: 1400 },
      { key: 'shield',       label: 'GARDE',       duration: 1600 },
      { key: 'magic_sphere', label: 'MAGIE',       duration: 1800 },
      { key: 'charge1',      label: 'CHARGEMENT',  duration: 1800 },
      { key: 'hurt',         label: 'TOUCHÉ',      duration: 1000 },
    ];

    // Keep only anims the character actually has
    const queue = animDefs.filter(a => charDef.sheets[a.key]);
    if (!queue.length) return;

    const spriteKey = 'menu_' + charDef.folder + '_idle';
    const scale = 1.8 * (FRAME_SIZE / charDef.frameSize);

    let queueIndex = 0;

    const playNext = () => {
      // Guard: menu may have closed
      if (!this.showingPersonnages) return;
      // Guard: char may have changed
      if (this.persoChars[this.persoSelectedIndex] !== charDef) return;

      const entry = queue[queueIndex % queue.length];
      queueIndex++;

      const sheetKey = 'menu_' + charDef.folder + '_' + entry.key;

      // Lazy-load the sheet if not already loaded
      if (!this.textures.exists(sheetKey)) {
        const sheet = charDef.sheets[entry.key];
        this.load.spritesheet(sheetKey, charDef.assetFolder + sheet.file, { frameWidth: charDef.frameSize, frameHeight: charDef.frameSize });
        this.load.once('complete', () => {
          if (!this.showingPersonnages) return;
          if (this.persoChars[this.persoSelectedIndex] !== charDef) return;
          this._playPersoAnim(sheetKey, charDef, entry, scale, playNext);
        });
        this.load.start();
        return;
      }

      this._playPersoAnim(sheetKey, charDef, entry, scale, playNext);
    };

    playNext();
  }

  _playPersoAnim(sheetKey, charDef, entry, scale, onComplete) {
    const sheet = charDef.sheets[entry.key];
    const animKey = 'perso_detail_' + charDef.folder + '_' + entry.key;

    if (!this.anims.exists(animKey)) {
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(sheetKey, { start: 0, end: sheet.frames - 1 }),
        frameRate: 10,
        repeat: -1,
      });
    }

    this.persoDetailSprite.setTexture(sheetKey, 0).setScale(scale).play(animKey);
    this.persoAnimLabel.setText(entry.label);

    this.persoAnimTimer = this.time.delayedCall(entry.duration, onComplete);
  }

  drawOptionsBars() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const barX = w / 2 - 70;
    const barW = 200;
    const barH = 16;

    // Music bar
    this.musicBarBg.clear();
    this.musicBarBg.fillStyle(0x333333, 0.9);
    this.musicBarBg.fillRoundedRect(barX, h / 2 - 206, barW, barH, 4);
    this.musicBarFill.clear();
    this.musicBarFill.fillStyle(0x4488ff, 1);
    const mw = Math.round(barW * AUDIO_SETTINGS.musicVolume);
    if (mw > 0) this.musicBarFill.fillRoundedRect(barX, h / 2 - 206, mw, barH, 4);
    this.musicValText.setText(Math.round(AUDIO_SETTINGS.musicVolume * 100) + '%');

    // SFX bar
    this.sfxBarBg.clear();
    this.sfxBarBg.fillStyle(0x333333, 0.9);
    this.sfxBarBg.fillRoundedRect(barX, h / 2 - 148, barW, barH, 4);
    this.sfxBarFill.clear();
    this.sfxBarFill.fillStyle(0x44dd44, 1);
    const sw = Math.round(barW * AUDIO_SETTINGS.sfxVolume);
    if (sw > 0) this.sfxBarFill.fillRoundedRect(barX, h / 2 - 148, sw, barH, 4);
    this.sfxValText.setText(Math.round(AUDIO_SETTINGS.sfxVolume * 100) + '%');
  }

  drawHintCheckbox() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = w / 2 - 70;
    const cy = h / 2 - 71;
    const size = 18;

    this.hintCheckGfx.clear();
    this.hintCheckGfx.lineStyle(2, 0xaaaaaa, 1);
    this.hintCheckGfx.strokeRect(cx, cy, size, size);
    if (DISPLAY_SETTINGS.showHints) {
      this.hintCheckGfx.fillStyle(0x44dd44, 1);
      this.hintCheckGfx.fillRect(cx + 3, cy + 3, size - 6, size - 6);
    }
    this.hintValText.setText(DISPLAY_SETTINGS.showHints ? 'ON' : 'OFF');
  }

  drawTouchBtnsCheckbox() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = w / 2 - 70;
    const cy = h / 2 - 13;
    const size = 18;

    this.touchBtnsCheckGfx.clear();
    this.touchBtnsCheckGfx.lineStyle(2, 0xaaaaaa, 1);
    this.touchBtnsCheckGfx.strokeRect(cx, cy, size, size);
    if (DISPLAY_SETTINGS.touchButtons) {
      this.touchBtnsCheckGfx.fillStyle(0x44dd44, 1);
      this.touchBtnsCheckGfx.fillRect(cx + 3, cy + 3, size - 6, size - 6);
    }
    this.touchBtnsValText.setText(DISPLAY_SETTINGS.touchButtons ? 'ON' : 'OFF');
  }

  drawGraphicsControls() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const barX = w / 2 - 70;
    const barW = 200;
    const barH = 16;
    const checkSize = 18;

    // Lissage checkbox
    const scx = w / 2 - 70;
    const scy = h / 2 + 81;
    this.smoothCheckGfx.clear();
    this.smoothCheckGfx.lineStyle(2, 0xaaaaaa, 1);
    this.smoothCheckGfx.strokeRect(scx, scy, checkSize, checkSize);
    if (GRAPHICS_SETTINGS.smoothing) {
      this.smoothCheckGfx.fillStyle(0x44ddff, 1);
      this.smoothCheckGfx.fillRect(scx + 3, scy + 3, checkSize - 6, checkSize - 6);
    }
    this.smoothValText.setText(GRAPHICS_SETTINGS.smoothing ? 'ON' : 'OFF');

    // Vignette bar (0 → 1)
    this.vignetteBarBg.clear();
    this.vignetteBarBg.fillStyle(0x333333, 0.9);
    this.vignetteBarBg.fillRoundedRect(barX, h / 2 + 140, barW, barH, 4);
    this.vignetteBarFill.clear();
    this.vignetteBarFill.fillStyle(0xaa44ff, 1);
    const vw = Math.round(barW * GRAPHICS_SETTINGS.vignette);
    if (vw > 0) this.vignetteBarFill.fillRoundedRect(barX, h / 2 + 140, vw, barH, 4);
    this.vignetteValText.setText(Math.round(GRAPHICS_SETTINGS.vignette * 100) + '%');

    // Saturation bar (-1 → +1, centre = 0)
    // Display: map -1..1 to 0..100%
    this.satBarBg.clear();
    this.satBarBg.fillStyle(0x333333, 0.9);
    this.satBarBg.fillRoundedRect(barX, h / 2 + 198, barW, barH, 4);
    this.satBarFill.clear();
    const satNorm = (GRAPHICS_SETTINGS.saturation + 1) / 2; // 0..1
    const satColor = GRAPHICS_SETTINGS.saturation >= 0 ? 0xffcc00 : 0x8888cc;
    this.satBarFill.fillStyle(satColor, 1);
    const satW = Math.round(barW * satNorm);
    if (satW > 0) this.satBarFill.fillRoundedRect(barX, h / 2 + 198, satW, barH, 4);
    // Centre marker
    this.satBarBg.lineStyle(1, 0x888888, 0.8);
    this.satBarBg.lineBetween(barX + barW / 2, h / 2 + 198, barX + barW / 2, h / 2 + 198 + barH);
    const satPct = Math.round(GRAPHICS_SETTINGS.saturation * 100);
    this.satValText.setText((satPct >= 0 ? '+' : '') + satPct + '%');

    // Scanlines checkbox
    const scanCx = w / 2 - 70;
    const scanCy = h / 2 + 255;
    this.scanCheckGfx.clear();
    this.scanCheckGfx.lineStyle(2, 0xaaaaaa, 1);
    this.scanCheckGfx.strokeRect(scanCx, scanCy, checkSize, checkSize);
    if (GRAPHICS_SETTINGS.scanlines) {
      this.scanCheckGfx.fillStyle(0xff8844, 1);
      this.scanCheckGfx.fillRect(scanCx + 3, scanCy + 3, checkSize - 6, checkSize - 6);
    }
    this.scanValText.setText(GRAPHICS_SETTINGS.scanlines ? 'ON' : 'OFF');
  }

  updateOptionsArrow() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    // 8 navigable rows: 0=musique, 1=effets, 2=aide, 3=boutons tactiles, 4=lissage, 5=vignette, 6=saturation, 7=scanlines
    const yPositions = [
      h / 2 - 198,  // Musique
      h / 2 - 140,  // Effets
      h / 2 - 62,   // Aide
      h / 2 - 4,    // Boutons tactiles
      h / 2 + 90,   // Lissage
      h / 2 + 148,  // Vignette
      h / 2 + 206,  // Saturation
      h / 2 + 264,  // Scanlines
    ];
    this.optArrow.setPosition(w / 2 - 230, yPositions[this.optionsIndex]);
  }

  closeOptionsMenu() {
    this.showingOptions = false;
    this.optionsObjects.forEach(o => { if (o && o.destroy) o.destroy(); });
    this.optionsObjects = [];
    if (this.menuBgm) this.menuBgm.setVolume(AUDIO_SETTINGS.musicVolume);
  }

  closePersonnagesMenu() {
    this.showingPersonnages = false;
    if (this.persoAnimTimer) { this.persoAnimTimer.remove(); this.persoAnimTimer = null; }
    this.personnagesObjects.forEach(o => { if (o && o.destroy) o.destroy(); });
    this.personnagesObjects = [];
    this.persoListItems = [];
    this.persoChars = [];
  }

  update() {
    if (this.confirmed) return;

    // Cheat input active — block all menu navigation
    if (this.cheatActive) return;

    // Personnages overlay
    if (this.showingPersonnages) {
      if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
        this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
        this.closePersonnagesMenu();
        return;
      }
      const count = this.persoChars.length;
      if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
        this.selectPersoIndex((this.persoSelectedIndex + 1) % count);
        this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume });
      }
      if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
        this.selectPersoIndex((this.persoSelectedIndex - 1 + count) % count);
        this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume });
      }
      return;
    }

    // Options overlay
    if (this.showingOptions) {
      if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
        this.closeOptionsMenu();
        return;
      }
      const OPT_COUNT = 8;
      let navChanged = false;
      if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
        this.optionsIndex = (this.optionsIndex + 1) % OPT_COUNT; navChanged = true;
      }
      if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
        this.optionsIndex = (this.optionsIndex - 1 + OPT_COUNT) % OPT_COUNT; navChanged = true;
      }
      if (navChanged) {
        this.updateOptionsArrow();
        this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume });
      }

      const isRight = Phaser.Input.Keyboard.JustDown(this.keyRight);
      const isLeft  = Phaser.Input.Keyboard.JustDown(this.keyLeft);
      const isEnter = Phaser.Input.Keyboard.JustDown(this.keyEnter);

      // 0: Musique, 1: Effets — sliders audio
      if (this.optionsIndex <= 1) {
        const step = 0.05;
        if (isRight) {
          if (this.optionsIndex === 0) AUDIO_SETTINGS.musicVolume = Math.min(1, AUDIO_SETTINGS.musicVolume + step);
          else AUDIO_SETTINGS.sfxVolume = Math.min(1, AUDIO_SETTINGS.sfxVolume + step);
          this.drawOptionsBars(); saveSettings();
          if (this.menuBgm) this.menuBgm.setVolume(AUDIO_SETTINGS.musicVolume);
        }
        if (isLeft) {
          if (this.optionsIndex === 0) AUDIO_SETTINGS.musicVolume = Math.max(0, AUDIO_SETTINGS.musicVolume - step);
          else AUDIO_SETTINGS.sfxVolume = Math.max(0, AUDIO_SETTINGS.sfxVolume - step);
          this.drawOptionsBars(); saveSettings();
          if (this.menuBgm) this.menuBgm.setVolume(AUDIO_SETTINGS.musicVolume);
        }
      // 2: Aide — checkbox
      } else if (this.optionsIndex === 2) {
        if (isEnter || isLeft || isRight) {
          DISPLAY_SETTINGS.showHints = !DISPLAY_SETTINGS.showHints;
          this.drawHintCheckbox(); saveSettings();
          this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
        }
      // 3: Boutons tactiles — checkbox
      } else if (this.optionsIndex === 3) {
        if (isEnter || isLeft || isRight) {
          DISPLAY_SETTINGS.touchButtons = !DISPLAY_SETTINGS.touchButtons;
          this.drawTouchBtnsCheckbox(); saveSettings();
          this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
        }
      // 4: Lissage — checkbox
      } else if (this.optionsIndex === 4) {
        if (isEnter || isLeft || isRight) {
          GRAPHICS_SETTINGS.smoothing = !GRAPHICS_SETTINGS.smoothing;
          this.drawGraphicsControls(); saveSettings();
          applyGraphicsSettings(this);
          this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
        }
      // 5: Vignette — slider 0..1
      } else if (this.optionsIndex === 5) {
        const step = 0.05;
        if (isRight) { GRAPHICS_SETTINGS.vignette = Math.min(1, GRAPHICS_SETTINGS.vignette + step); }
        if (isLeft)  { GRAPHICS_SETTINGS.vignette = Math.max(0, GRAPHICS_SETTINGS.vignette - step); }
        if (isRight || isLeft) {
          this.drawGraphicsControls(); saveSettings();
          applyGraphicsSettings(this);
        }
      // 6: Saturation — slider -1..1
      } else if (this.optionsIndex === 6) {
        const step = 0.1;
        if (isRight) { GRAPHICS_SETTINGS.saturation = Math.min(1, +(GRAPHICS_SETTINGS.saturation + step).toFixed(1)); }
        if (isLeft)  { GRAPHICS_SETTINGS.saturation = Math.max(-1, +(GRAPHICS_SETTINGS.saturation - step).toFixed(1)); }
        if (isRight || isLeft) {
          this.drawGraphicsControls(); saveSettings();
          applyGraphicsSettings(this);
        }
      // 7: Scanlines — checkbox
      } else if (this.optionsIndex === 7) {
        if (isEnter || isLeft || isRight) {
          GRAPHICS_SETTINGS.scanlines = !GRAPHICS_SETTINGS.scanlines;
          this.drawGraphicsControls(); saveSettings();
          applyGraphicsSettings(this);
          this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
        }
      }
      return;
    }

    // Main menu navigation
    let changed = false;
    if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
      changed = true;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
      changed = true;
    }
    if (changed) {
      this.updateMenuHighlight();
      this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume });
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
      this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
      if (this.selectedIndex === 2) {
        this.showPersonnagesMenu();
        return;
      }
      if (this.selectedIndex === 3) {
        this.showOptionsMenu();
        return;
      }
      this.confirmed = true;
      if (this.menuBgm && this.menuBgm.isPlaying) this.menuBgm.stop();
      this.cameras.main.flash(200, 255, 255, 255);
      this.time.delayedCall(300, () => {
        if (this.selectedIndex === 0) {
          this.scene.start('SelectScene');
        } else {
          this.scene.start('DuelSelectScene');
        }
      });
    }
  }
}
