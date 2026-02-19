// ============================================================
// Yurei — personnage fantôme, trait : Double Recharge
// ============================================================

class YureiCharacter extends CharacterDef {
  constructor() {
    super({
      name:       'Yurei',
      folder:     'Yurei',
      color:      '#55aadd',
      imgBase:    'js/characters/Yurei/img/',
      voicesBase: 'js/characters/Yurei/sounds/',
      trait:      'double_charge',
      fx: {
        attack1: { folder: 'fx/slash/',         count: 8  },
        attack2: { folder: 'fx/slash_blue/',    count: 8  },
        attack3: { folder: 'fx/red_slash/',     count: 8  },
        special: { folder: 'fx/special_slash/', count: 8  },
        flames:  { folder: 'fx/flames/',        count: 10 },
      },
      sheets: {
        idle:    { file: 'Idle.png',     frames: 5 },
        run:     { file: 'Run.png',      frames: 5 },
        attack1: { file: 'Attack_1.png', frames: 4 },
        attack2: { file: 'Attack_2.png', frames: 4 },
        attack3: { file: 'Attack_3.png', frames: 7 },
        hurt:    { file: 'Hurt.png',     frames: 3 },
        dead:    { file: 'Dead.png',     frames: 4 },
        shield:  { file: 'Scream.png',   frames: 4 },
      },
    });
  }
}
