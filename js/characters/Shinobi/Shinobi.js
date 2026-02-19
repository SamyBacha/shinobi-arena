// ============================================================
// Shinobi — personnage de base, trait : Riposte (counter)
// ============================================================

class ShinobiCharacter extends CharacterDef {
  constructor() {
    super({
      name:       'Shinobi',
      folder:     'Shinobi',
      color:      '#cc4444',
      trait:      'counter',
      imgBase:    'js/characters/Shinobi/img/',
      voicesBase: 'js/characters/Shinobi/sounds/',
      fx: {
        attack1: { folder: 'fx/slash/',         count: 8 },
        attack2: { folder: 'fx/slash_blue/',    count: 8 },
        attack3: { folder: 'fx/red_slash/',     count: 8 },
        special: { folder: 'fx/special_slash/', count: 8 },
      },
      sheets: {
        idle:    { file: 'Idle.png',     frames: 6 },
        walk:    { file: 'Walk.png',     frames: 8 },
        run:     { file: 'Run.png',      frames: 8 },
        jump:    { file: 'Jump.png',     frames: 12 },
        attack1: { file: 'Attack_1.png', frames: 5 },
        attack2: { file: 'Attack_2.png', frames: 3 },
        attack3: { file: 'Attack_3.png', frames: 4 },
        dead:    { file: 'Dead.png',     frames: 4 },
        hurt:    { file: 'Hurt.png',     frames: 2 },
        shield:  { file: 'Shield.png',   frames: 4 },
      },
    });
  }
}
