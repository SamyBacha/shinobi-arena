// ============================================================
// Gotoku — personnage fantôme, trait : Esquive (jump_dodge)
// ============================================================

class GotokuCharacter extends CharacterDef {
  constructor() {
    super({
      name:       'Gotoku',
      folder:     'Gotoku',
      color:      '#66ccaa',
      imgBase:    'js/characters/Gotoku/img/',
      voicesBase: 'js/characters/Gotoku/sounds/',
      trait:      'jump_dodge',
      fx: {
        attack1: { folder: 'fx/slash/',         count: 8 },
        attack2: { folder: 'fx/slash_blue/',    count: 8 },
        attack3: { folder: 'fx/red_slash/',     count: 8 },
        special: { folder: 'fx/special_slash/', count: 8 },
      },
      sheets: {
        idle:    { file: 'Idle.png',     frames: 5 },
        run:     { file: 'Run.png',      frames: 7 },
        jump:    { file: 'Jump.png',     frames: 8 },
        attack1: { file: 'Attack_1.png', frames: 4 },
        attack2: { file: 'Attack_2.png', frames: 4 },
        attack3: { file: 'Attack_3.png', frames: 4 },
        hurt:    { file: 'Hurt.png',     frames: 3 },
        dead:    { file: 'Dead.png',     frames: 5 },
        shield:  { file: 'Scream.png',   frames: 4 },
      },
    });
  }
}
