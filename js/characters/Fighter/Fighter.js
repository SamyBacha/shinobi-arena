// ============================================================
// Fighter — personnage de base, trait : Endurance (+1 vie)
// ============================================================

class FighterCharacter extends CharacterDef {
  constructor() {
    super({
      name:       'Fighter',
      folder:     'Fighter',
      color:      '#e88a36',
      trait:      'extra_life',
      sfxStyle:   'punch',
      imgBase:    'js/characters/Fighter/img/',
      voicesBase: 'js/characters/Fighter/sounds/',
      fx: {
        attack1: { folder: 'fx/slash/',   count: 8 },
        attack2: { folder: 'fx/slash/',   count: 8 },
        attack3: { folder: 'fx/slash/',   count: 8 },
      },
      sheets: {
        idle:    { file: 'Idle.png',     frames: 6 },
        walk:    { file: 'Walk.png',     frames: 8 },
        run:     { file: 'Run.png',      frames: 8 },
        jump:    { file: 'Jump.png',     frames: 10 },
        attack1: { file: 'Attack_1.png', frames: 4 },
        attack2: { file: 'Attack_2.png', frames: 3 },
        attack3: { file: 'Attack_3.png', frames: 4 },
        dead:    { file: 'Dead.png',     frames: 3 },
        hurt:    { file: 'Hurt.png',     frames: 3 },
        shield:  { file: 'Shield.png',   frames: 2 },
      },
    });
  }

  get maxLifeBonus() { return 1; }
}
