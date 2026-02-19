// ============================================================
// Stage — classe représentant un stage de combat duel
// Approche DDD : chaque stage déclare ses propres assets
// ============================================================

class Stage {
  constructor({
    id,
    displayName,
    bgFile = 'bg.gif',
    isBossStage = false,
    bgm         = null,  // clé audio Phaser, null = bgm par défaut
  }) {
    this.id          = id;
    this._displayName = displayName;
    this.bgFile      = bgFile;
    this.isBossStage = isBossStage;
    this._bgm        = bgm;
  }

  // Chemin vers le dossier du stage
  get stageFolder() {
    return 'js/duel/stages/' + this.id + '/';
  }

  // Chemin complet vers le background
  get bgPath() {
    return this.stageFolder + this.bgFile;
  }

  // Clé audio BGM à utiliser (propre au stage ou fallback global)
  get musicKey() {
    if (this._bgm) return 'stage_bgm_' + this.id;
    return this.isBossStage ? 'duel_boss_bgm' : 'duel_bgm';
  }

  // Chemin vers le BGM propre au stage (null si utilise le BGM global)
  get bgmPath() {
    return this._bgm ? this.stageFolder + this._bgm : null;
  }

  get displayName() {
    return this._displayName;
  }

  // Clé texture Phaser pour la miniature
  get thumbKey() {
    return 'stage_thumb_' + this.id;
  }
}

// Catalogue des stages — chaque stage est déclaré dans son propre fichier
const STAGES = [];
