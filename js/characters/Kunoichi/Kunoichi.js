// ============================================================
// Kunoichi — personnage caché, trait : Mimétisme
// ============================================================

class KunoichiCharacter extends CharacterDef {
  constructor() {
    super({
      name:       'Kunoichi',
      folder:     'Kunoichi',
      color:      '#e85d9a',
      imgBase:    'js/characters/Kunoichi/img/',
      voicesBase: 'js/characters/Kunoichi/sounds/',
      trait:      'mimicry',
      fx: {
        attack1: { folder: 'fx/slash/',       count: 8 },
        attack2: { folder: 'fx/slash_blue/',  count: 8 },
        attack3: { folder: 'fx/slash_blue/',  count: 8 },
      },
      sheets: {
        idle:    { file: 'Idle.png',     frames: 9 },
        walk:    { file: 'Walk.png',     frames: 8 },
        run:     { file: 'Run.png',      frames: 8 },
        jump:    { file: 'Jump.png',     frames: 10 },
        attack1: { file: 'Attack_1.png', frames: 6 },
        attack2: { file: 'Attack_2.png', frames: 8 },
        attack3: { file: 'Attack_2.png', frames: 8 },
        dead:    { file: 'Dead.png',     frames: 5 },
        hurt:    { file: 'Hurt.png',     frames: 2 },
        shield:  { file: 'Jump.png',     frames: 10 },
      },
    });
  }
}
