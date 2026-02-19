// ============================================================
// Character Select Scene — Carrousel
// ============================================================
class SelectScene extends Phaser.Scene {
  constructor() { super('SelectScene'); }

  preload() {
    [...Object.values(CHARACTERS), ...Object.values(HIDDEN_CHARACTERS)].forEach(char => {
      const key = 'select_' + char.folder + '_idle';
      this.load.spritesheet(key, char.assetFolder + 'Idle.png', { frameWidth: char.frameSize, frameHeight: char.frameSize });
    });
    if (!this.cache.audio.exists('menu_click')) this.load.audio('menu_click', 'music/sfx_menu_click.mp3');
    if (!this.cache.audio.exists('menu_nav'))   this.load.audio('menu_nav',   'music/sfx_menu_nav.mp3');
  }

  create() {
    applyGraphicsSettings(this);
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    this.cameras.main.setBackgroundColor('#0e0e1a');
    this.confirmed = false;

    this.chars = [
      ...Object.values(CHARACTERS),
      ...(CHEAT_SETTINGS.villageUnlocked ? [HIDDEN_CHARACTERS.Kunoichi, HIDDEN_CHARACTERS.Ninja_Peasant] : []),
    ];
    this.selectedIndex = 0;

    // Title
    this.add.text(w / 2, h * 0.10, 'CHOOSE YOUR FIGHTER', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    // Carrousel container
    this.carouselY = h * 0.50;
    this.centerX   = w / 2;

    // Create sprites for all chars
    this.carouselItems = this.chars.map((char) => {
      const animKey = 'select_anim_' + char.folder;
      if (!this.anims.exists(animKey)) {
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers('select_' + char.folder + '_idle', { start: 0, end: char.sheets.idle.frames - 1 }),
          frameRate: 8, repeat: -1,
        });
      }
      const sprite = this.add.sprite(0, this.carouselY, 'select_' + char.folder + '_idle', 0);
      sprite.setOrigin(0.5, 0.75);
      sprite.play(animKey);
      return { sprite, char };
    });

    // Cadre autour du perso central
    this.frameGfx = this.add.graphics().setDepth(3);

    // Shadow ellipse under center char
    this.shadowGfx = this.add.graphics();

    // Name text
    this.nameText = this.add.text(w / 2, h * 0.72, '', {
      fontSize: '28px', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(5);

    // Trait text
    this.traitText = this.add.text(w / 2, h * 0.79, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#aaddaa',
      stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: 500 }, align: 'center',
    }).setOrigin(0.5).setDepth(5);

    // Arrows
    this.arrowLeft  = this.add.text(w * 0.12, this.carouselY - 20, '◀', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true });
    this.arrowRight = this.add.text(w * 0.88, this.carouselY - 20, '▶', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true });

    this.arrowLeft.on('pointerdown',  () => this.navigate(-1));
    this.arrowRight.on('pointerdown', () => this.navigate(1));

    // Confirm button hint
    this.add.text(w / 2, h * 0.88, 'ENTER ou clic : Confirmer  |  ESPACE : Détails', {
      fontSize: '14px', fontFamily: 'monospace', color: '#777799',
    }).setOrigin(0.5);
    this.add.text(w / 2, h * 0.93, '←→ : Naviguer  |  SHIFT: Attack  |  SPACE: Jump en jeu', {
      fontSize: '13px', fontFamily: 'monospace', color: '#555577',
    }).setOrigin(0.5);

    // Click on center sprite to confirm
    this.input.on('pointerdown', (ptr) => {
      const cx = this.centerX;
      const cy = this.carouselY;
      if (Math.abs(ptr.x - cx) < 90 && Math.abs(ptr.y - cy) < 120) {
        this.confirmSelection();
      }
    });

    // Keys
    this.keyLeft  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyQ     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.keyD     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyA     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyEsc   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.detailVisible = false;
    this.detailObjects = [];

    this.layoutCarousel();
  }

  navigate(dir) {
    if (this.confirmed) return;
    this.selectedIndex = (this.selectedIndex + dir + this.chars.length) % this.chars.length;
    this.sound.play('menu_nav', { volume: AUDIO_SETTINGS.sfxVolume });
    this.layoutCarousel();
    this.updateDetail();
  }

  layoutCarousel() {
    const w  = this.cameras.main.width;
    const n  = this.chars.length;
    const cx = this.centerX;
    const cy = this.carouselY;

    // Positions relatives : -2 -1 0 +1 +2
    const slots = [-2, -1, 0, 1, 2];
    const slotX  = [cx - 340, cx - 190, cx, cx + 190, cx + 340];
    const slotScale  = [0.7, 1.1, 2.2, 1.1, 0.7];
    const slotAlpha  = [0.3, 0.6, 1.0, 0.6, 0.3];
    const slotDepth  = [1,   2,   4,   2,   1  ];

    this.carouselItems.forEach((item, i) => {
      // distance de i par rapport au centre (selectedIndex), circular
      let dist = i - this.selectedIndex;
      if (dist >  n / 2) dist -= n;
      if (dist < -n / 2) dist += n;

      const slotIdx = slots.indexOf(dist);
      if (slotIdx === -1) {
        // hors des 5 slots visibles : invisible
        item.sprite.setVisible(false);
        return;
      }
      item.sprite.setVisible(true);
      const targetX     = slotX[slotIdx];
      const targetScale = slotScale[slotIdx];
      const targetAlpha = slotAlpha[slotIdx];
      const targetDepth = slotDepth[slotIdx];

      this.tweens.add({
        targets: item.sprite,
        x: targetX, scaleX: targetScale, scaleY: targetScale, alpha: targetAlpha,
        duration: 180, ease: 'Power2',
      });
      item.sprite.setDepth(targetDepth);
    });

    // Shadow
    this.shadowGfx.clear();
    this.shadowGfx.fillStyle(0x000000, 0.35);
    this.shadowGfx.fillEllipse(cx, cy + 60, 180, 28);
    this.shadowGfx.setDepth(3);

    // Cadre
    const char = this.chars[this.selectedIndex];
    const fw = 180, fh = 240;
    const charColor = Phaser.Display.Color.HexStringToColor(char.color).color;
    this.frameGfx.clear();
    this.frameGfx.fillStyle(0x000000, 0.25);
    this.frameGfx.fillRoundedRect(cx - fw / 2, cy - fh / 2, fw, fh, 10);
    this.frameGfx.lineStyle(3, charColor, 0.9);
    this.frameGfx.strokeRoundedRect(cx - fw / 2, cy - fh / 2, fw, fh, 10);
    this.nameText.setText(char.name.toUpperCase()).setColor(char.color);
    const traitObj = char.trait ? TRAIT_LABELS[char.trait] : null;
    this.traitText.setText(traitObj ? traitObj.short : '');
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

    this._detailBg = this.add.graphics().setDepth(20);
    this._detailTitle = this.add.text(w / 2, panY + 18, '', {
      fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(21);
    this._detailTraitName = this.add.text(w / 2, panY + 44, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffdd88',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(21);
    this._detailTraitDesc = this.add.text(w / 2, panY + 64, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#bbccbb',
      stroke: '#000000', strokeThickness: 2,
      wordWrap: { width: panW - 24 }, align: 'center',
    }).setOrigin(0.5, 0).setDepth(21);
    this._detailHint = this.add.text(w / 2, panY + panH - 16, 'ESPACE / ÉCHAP : fermer', {
      fontSize: '11px', fontFamily: 'monospace', color: '#445544',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(21);

    this.detailObjects = [this._detailBg, this._detailTitle, this._detailTraitName, this._detailTraitDesc, this._detailHint];
    this._detailPanX = panX; this._detailPanY = panY; this._detailPanW = panW; this._detailPanH = panH;
    this.updateDetail();
  }

  updateDetail() {
    if (!this.detailVisible) return;
    const char = this.chars[this.selectedIndex];
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

    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.detailVisible ? this.hideDetail() : this.showDetail();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      if (this.detailVisible) { this.hideDetail(); return; }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyRight) || Phaser.Input.Keyboard.JustDown(this.keyD)) this.navigate(1);
    if (Phaser.Input.Keyboard.JustDown(this.keyLeft)  || Phaser.Input.Keyboard.JustDown(this.keyQ) || Phaser.Input.Keyboard.JustDown(this.keyA)) this.navigate(-1);
    if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) this.confirmSelection();
  }

  confirmSelection() {
    if (this.confirmed) return;
    this.confirmed = true;
    this.sound.play('menu_click', { volume: AUDIO_SETTINGS.sfxVolume });
    this.cameras.main.flash(300, 255, 255, 255);
    this.time.delayedCall(600, () => {
      this.scene.start('GameScene', { character: this.chars[this.selectedIndex].folder });
    });
  }
}
