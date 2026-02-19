// ============================================================
// Onre — personnage fantôme, trait : Contre-attaque (flight)
// ============================================================

class OnreCharacter extends CharacterDef {
  constructor() {
    super({
      name:       'Onre',
      folder:     'Onre',
      color:      '#cc77ff',
      imgBase:    'js/characters/Onre/img/',
      voicesBase: 'js/characters/Onre/sounds/',
      trait:      'flight',
      fx: {
        attack1: { folder: 'fx/slash/',         count: 8  },
        attack2: { folder: 'fx/slash_blue/',    count: 8  },
        attack3: { folder: 'fx/red_slash/',     count: 8  },
        special: { folder: 'fx/special_slash/', count: 8  },
        flames:  { folder: 'fx/flames/',        count: 10 },
      },
      sheets: {
        idle:    { file: 'Idle.png',     frames: 6 },
        walk:    { file: 'Walk.png',     frames: 7 },
        run:     { file: 'Run.png',      frames: 7 },
        attack1: { file: 'Attack_1.png', frames: 5 },
        attack2: { file: 'Attack_2.png', frames: 4 },
        attack3: { file: 'Attack_3.png', frames: 4 },
        hurt:    { file: 'Hurt.png',     frames: 3 },
        dead:    { file: 'Dead.png',     frames: 6 },
        shield:  { file: 'Scream.png',   frames: 7 },
        flight:  { file: 'Flight.png',   frames: 6 },
      },
    });
  }
}
