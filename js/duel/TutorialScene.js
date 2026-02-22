// ============================================================
// TutorialScene — écran d'intro qui lance un vrai DuelScene
//                 en mode tutoriel scripté
// ============================================================
class TutorialScene extends Phaser.Scene {
  constructor() { super('TutorialScene'); }

  preload() {}

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // ── Background panel ──
    const panelW = 740;
    const panelH = 440;
    const panelX = w / 2 - panelW / 2;
    const panelY = h / 2 - panelH / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.88);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 14);
    bg.lineStyle(2, 0x445566, 0.8);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 14);
    bg.setDepth(10);

    // ── Title ──
    this.add.text(w / 2, panelY + 28, 'TUTORIEL', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffcc00',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5, 0).setDepth(11);

    this.add.text(w / 2, panelY + 72, 'Apprenez les mécaniques de base en 8 tours', {
      fontSize: '15px', fontFamily: 'monospace', color: '#aaaacc',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(11);

    // ── Scenario table ──
    const rows = [
      ['Tour 1', 'Rechargez', 'Gagner du mana'],
      ['Tour 2', 'Rechargez encore', 'Avoir 2 mana'],
      ['Tour 3', 'Protégez-vous', 'Parer une attaque (l\'IA frappe)'],
      ['Tour 4', 'Frappez ×1', 'Attaquer avec 1 mana'],
      ['Tour 5', 'Rechargez', 'Reconstituer le mana'],
      ['Tour 6', 'Frappez ×2', 'Super attaque x2 (double-tap 3)'],
      ['Tour 7', 'Rechargez', 'Préparer le KO'],
      ['Tour 8', 'Frappez ×3', 'KO final (triple-tap 3)'],
    ];

    const tableX = panelX + 30;
    let rowY = panelY + 110;
    const rowH = 28;

    // Header
    this.add.text(tableX, rowY, 'Tour', {
      fontSize: '12px', fontFamily: 'monospace', color: '#667799', fontStyle: 'bold',
    }).setDepth(11);
    this.add.text(tableX + 70, rowY, 'Votre action', {
      fontSize: '12px', fontFamily: 'monospace', color: '#667799', fontStyle: 'bold',
    }).setDepth(11);
    this.add.text(tableX + 270, rowY, 'Enseignement', {
      fontSize: '12px', fontFamily: 'monospace', color: '#667799', fontStyle: 'bold',
    }).setDepth(11);
    rowY += 20;

    rows.forEach(([tour, action, enseignement]) => {
      this.add.text(tableX, rowY, tour, {
        fontSize: '13px', fontFamily: 'monospace', color: '#aaaacc',
      }).setDepth(11);
      this.add.text(tableX + 70, rowY, action, {
        fontSize: '13px', fontFamily: 'monospace', color: '#ffdd88',
      }).setDepth(11);
      this.add.text(tableX + 270, rowY, enseignement, {
        fontSize: '13px', fontFamily: 'monospace', color: '#88bbdd',
      }).setDepth(11);
      rowY += rowH;
    });

    // ── Controls reminder ──
    this.add.text(w / 2, panelY + panelH - 72, '1/A : Recharger   |   2/Z : Protéger   |   3/E : Frapper (×1  ×2  ×3)', {
      fontSize: '12px', fontFamily: 'monospace', color: '#556677',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(11);

    // ── Prompts ──
    const startTxt = this.add.text(w / 2, panelY + panelH - 42, 'ENTER : Commencer le tutoriel', {
      fontSize: '16px', fontFamily: 'monospace', color: '#44ff88',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(11);
    startTxt.setInteractive({ useHandCursor: true });
    startTxt.on('pointerover', () => startTxt.setColor('#aaffcc'));
    startTxt.on('pointerout',  () => startTxt.setColor('#44ff88'));
    startTxt.on('pointerdown', () => this._startTutorial());

    const backTxt = this.add.text(w / 2, panelY + panelH - 18, 'ESC : Retour au menu', {
      fontSize: '12px', fontFamily: 'monospace', color: '#667799',
    }).setOrigin(0.5, 0).setDepth(11);
    backTxt.setInteractive({ useHandCursor: true });
    backTxt.on('pointerover', () => backTxt.setColor('#aabbcc'));
    backTxt.on('pointerout',  () => backTxt.setColor('#667799'));
    backTxt.on('pointerdown', () => this.scene.start('DuelSelectScene'));

    // ── Keys ──
    const K = Phaser.Input.Keyboard.KeyCodes;
    this._keyEnter = this.input.keyboard.addKey(K.ENTER);
    this._keyEsc   = this.input.keyboard.addKey(K.ESC);
    this._skipFrame = true;

    // Android back button
    window.history.pushState({ scene: 'TutorialScene' }, '');
    this._backHandler = () => {
      window.history.pushState({ scene: 'TutorialScene' }, '');
      this.scene.start('DuelSelectScene');
    };
    window.addEventListener('popstate', this._backHandler);
    this.events.once('shutdown', () => {
      window.removeEventListener('popstate', this._backHandler);
    });
  }

  update() {
    if (this._skipFrame) { this._skipFrame = false; return; }

    if (Phaser.Input.Keyboard.JustDown(this._keyEsc)) {
      this.scene.start('DuelSelectScene');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this._keyEnter)) {
      this._startTutorial();
    }
  }

  _startTutorial() {
    const fighterDef = Object.values(CHARACTERS).find(c => c.folder === 'Fighter');
    const stageIdx   = STAGES.findIndex(s => s.id === 'old_dojo') + 1;
    this.scene.start('DuelScene', {
      p1: fighterDef,
      p2: fighterDef,
      p2Color: '#ff4422',
      vsAI: true,
      stageIndex: stageIdx || 1,
      tutorialMode: true,
    });
  }
}
