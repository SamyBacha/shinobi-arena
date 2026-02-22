// ============================================================
// CharacterDef — classe de base
// ============================================================

class CharacterDef {
  constructor({
    name,
    folder,
    color,
    trait         = null,
    sheets        = {},
    imgBase       = null,
    voicesBase    = null,
    frameSize     = null,
    duelScale     = 1.0,
    selectOffsetY = 0,
    attackChain   = null,
    projectile    = null,
    sfxStyle      = 'sword',  // 'sword' | 'punch'
    fx            = null,     // { attack1, attack2, attack3, special } — chemins relatifs à fxFolder
    outfits       = null,     // [{ name: 'Default', enabled: true, sounds: { sfxStyle: 'sword', voices: 'path/', attackSfx: 'path/file.mp3' } }, ...]
  }) {
    this.name          = name;
    this.folder        = folder;
    this.color         = color;
    this.trait         = trait;
    this.sheets        = sheets;
    this._imgBase      = imgBase;
    this._voicesBase   = voicesBase;
    this.frameSize     = frameSize || FRAME_SIZE;
    this.duelScale     = duelScale;
    this.selectOffsetY = selectOffsetY;
    this.attackChain   = attackChain;
    this.projectile    = projectile;
    this.sfxStyle      = sfxStyle;
    this._fx           = fx;
    this._outfits      = outfits;
  }

  // Chemin de base des assets image
  get imgBase() {
    return this._imgBase || IMG_BASE;
  }

  // Chemin complet vers le dossier sprites du personnage
  get assetFolder() {
    // Si imgBase est déjà le chemin complet vers img/ (format DDD), l'utiliser directement
    if (this._imgBase) return this._imgBase;
    return IMG_BASE + this.folder + '/';
  }

  // Chemin vers les fichiers voix du personnage
  get voicesFolder() {
    return this._voicesBase || 'voices/';
  }

  // Dossier racine pour les FX du personnage (les sous-dossiers fx/slash/ etc. sont dans info.folder)
  get fxFolder() {
    return this.assetFolder;
  }

  // Outfits alternatifs — filtrés sur enabled !== false (toujours au moins [{ name: 'Default' }])
  get outfits() {
    const all = this._outfits || [{ name: 'Default' }];
    return all.filter(o => o.enabled !== false);
  }

  // FX d'attaque déclarés par le personnage
  // Chaque entrée est un objet { folder, count } ou null (fallback global)
  get fx() {
    return this._fx || {};
  }

  // Scale duel calculé
  get effectiveDuelScale() {
    return DUEL_PLAYER_SCALE * (FRAME_SIZE / this.frameSize) * this.duelScale;
  }

  // Clé pour les fichiers voix
  get voiceKey() {
    return this.folder.replace(/\s+/g, '_');
  }

  // Clé son d'attaque
  get attackSfxKey() {
    return this.sfxStyle === 'punch' ? 'duel_punch' : 'duel_sword';
  }

  // Bonus de vies en duel (trait extra_life → +1)
  get maxLifeBonus() {
    return 0;
  }
}
