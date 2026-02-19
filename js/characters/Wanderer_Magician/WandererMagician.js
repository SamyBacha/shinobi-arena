// ============================================================
// Wanderer Magician — personnage caché, trait : Garde Arcanique
// ============================================================

class WandererMagicianCharacter extends CharacterDef {
  constructor() {
    super({
      name:       'Magician',
      folder:     'Wanderer Magican',
      color:      '#55bbff',
      imgBase:    'js/characters/Wanderer_Magician/img/',
      voicesBase: 'js/characters/Wanderer_Magician/sounds/',
      fx: {
        attack1: { folder: 'fx/blue_attack/', count: 10 },
        attack2: { folder: 'fx/blue_attack/', count: 10 },
        attack3: { folder: 'fx/blue_attack/', count: 10 },
        special: { folder: 'fx/slash_blue/',  count: 8  },
        flames:  { folder: 'fx/flames/',      count: 10 },
      },
      duelScale:  1.4,
      trait:      'magic_shield',
      projectile: { sheet: 'charge1', frameSize: 64, frames: 9 },
      sheets: {
        idle:         { file: 'Idle.png',         frames: 8 },
        walk:         { file: 'Walk.png',         frames: 7 },
        run:          { file: 'Run.png',          frames: 8 },
        jump:         { file: 'Jump.png',         frames: 8 },
        attack1:      { file: 'Attack_1.png',     frames: 7 },
        attack2:      { file: 'Attack_2.png',     frames: 9 },
        attack3:      { file: 'Attack_2.png',     frames: 9 },
        dead:         { file: 'Dead.png',         frames: 4 },
        hurt:         { file: 'Hurt.png',         frames: 4 },
        shield:       { file: 'Magic_arrow.png',  frames: 6 },
        magic_sphere: { file: 'Magic_sphere.png', frames: 16 },
        charge1:      { file: 'Charge_1.png',     frames: 9 },
      },
    });
  }
}
