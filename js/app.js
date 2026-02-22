// ============================================================
// Game config
// ============================================================
loadSettings();
initScenes();

const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 1280,
    height: 720,
    transparent: true,
    pixelArt: !GRAPHICS_SETTINGS.smoothing,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: GRAVITY },
        // debug: false
      }
    },
    scene: [MenuScene, SelectScene, DuelSelectScene, GameScene, DuelScene, TutorialScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };

new Phaser.Game(config);
