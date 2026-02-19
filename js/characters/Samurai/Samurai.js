// ============================================================
// Samurai — personnage de base, trait : Lame Aiguisée (attack_x4)
// ============================================================

class SamuraiCharacter extends CharacterDef {
  constructor() {
    super({
      name:        'Samurai',
      folder:      'Samurai',
      color:       '#7a6aaf',
      trait:       'attack_x4',
      attackChain: ['attack1', 'attack2', 'attack3', 'attack1'],
      imgBase:     'js/characters/Samurai/img/',
      voicesBase:  'js/characters/Samurai/sounds/',
      fx: {
        attack1: { folder: 'fx/slash/',        count: 8  },
        attack2: { folder: 'fx/slash_blue/',   count: 8  },
        attack3: { folder: 'fx/red_slash/',    count: 8  },
        special: { folder: 'fx/special_slash/', count: 8 },
        flames:  { folder: 'fx/flames/',       count: 10 },
      },
      sheets: {
        idle:    { file: 'Idle.png',     frames: 6 },
        walk:    { file: 'Walk.png',     frames: 8 },
        run:     { file: 'Run.png',      frames: 8 },
        jump:    { file: 'Jump.png',     frames: 12 },
        attack1: { file: 'Attack_1.png', frames: 6 },
        attack2: { file: 'Attack_2.png', frames: 4 },
        attack3: { file: 'Attack_3.png', frames: 3 },
        dead:    { file: 'Dead.png',     frames: 3 },
        hurt:    { file: 'Hurt.png',     frames: 2 },
        shield:  { file: 'Shield.png',   frames: 2 },
      },
    });
  }
}
