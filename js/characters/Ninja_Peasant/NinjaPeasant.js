// ============================================================
// Ninja Peasant — personnage caché, trait : Déguisement
// ============================================================

class NinjaPeasantCharacter extends CharacterDef {
  constructor() {
    super({
      name:          'Peasant',
      folder:        'Ninja_Peasant',
      color:         '#8bc34a',
      imgBase:       'js/characters/Ninja_Peasant/img/',
      voicesBase:    'js/characters/Ninja_Peasant/sounds/',
      fx: {
        attack1: { folder: 'fx/slash/',       count: 8  },
        attack2: { folder: 'fx/slash_blue/',  count: 8  },
        attack3: { folder: 'fx/slash_blue/',  count: 8  },
        flames:  { folder: 'fx/flames/',      count: 10 },
      },
      frameSize:     96,
      duelScale:     0.85,
      selectOffsetY: 20,
      trait:         'disguise',
      sheets: {
        idle:    { file: 'Idle.png',     frames: 6 },
        walk:    { file: 'Walk.png',     frames: 8 },
        run:     { file: 'Run.png',      frames: 6 },
        jump:    { file: 'Jump.png',     frames: 8 },
        attack1: { file: 'Attack_1.png', frames: 6 },
        attack2: { file: 'Attack_2.png', frames: 4 },
        attack3: { file: 'Attack_2.png', frames: 4 },
        dead:    { file: 'Dead.png',     frames: 4 },
        hurt:    { file: 'Hurt.png',     frames: 2 },
        shield:  { file: 'Disguise.png', frames: 9 },
      },
    });
  }
}
