// ============================================================
// Yokai — personnage caché, trait : Âme Vengeresse
// ============================================================

class YokaiCharacter extends CharacterDef {
  constructor() {
    super({
      name:       'Yokai',
      folder:     'Yokai',
      color:      '#cc44ff',
      imgBase:    'js/characters/Yokai/img/Karasu_tengu/',
      voicesBase: 'js/characters/Yokai/sounds/',
      fx: {},
      duelScale:  1.1,
      trait:      'life_restore',
      outfits: [
        { name: 'Karasu Tengu' },
        { name: 'Kitsune',
          folder: 'js/characters/Yokai/img/Kitsune/',
          sheets: {
            idle:    { file: 'Idle.png',     frames: 8  },
            idle2:   { file: 'Idle_2.png',   frames: 6  },
            walk:    { file: 'Walk.png',     frames: 8  },
            run:     { file: 'Run.png',      frames: 8  },
            jump:    { file: 'Jump.png',     frames: 10 },
            attack1: { file: 'Attack_1.png', frames: 10, frameRate: 18 },
            attack2: { file: 'Attack_2.png', frames: 10 },
            attack3: { file: 'Attack_3.png', frames: 7  },
            dead:    { file: 'Dead.png',     frames: 10 },
            hurt:    { file: 'Hurt.png',     frames: 2  },
            shield:  { file: 'Shield.png',   frames: 2  },
            fire1:   { file: 'Fire_1.png',   frames: 14, frameSize: 64 },
            fire2:   { file: 'Fire_2.png',   frames: 11, frameSize: 64 },
          },
          // Projectile x1 (3 mana) : cast attack3, projectile fire1
          // Projectile x2 (4 mana) : cast attack3 + attack2, projectile fire1 + fire2
          projectile1: { sheet: 'fire1', frameSize: 64, frames: 14 },
          projectile2: { sheet: 'fire2', frameSize: 64, frames: 11 },
        },
        { name: 'Yamabushi Tengu',
          folder: 'js/characters/Yokai/img/Yamabushi_tengu/',
          sheets: {
            idle:    { file: 'Idle.png',     frames: 6  },
            idle2:   { file: 'Idle_2.png',   frames: 5  },
            walk:    { file: 'Walk.png',     frames: 8  },
            run:     { file: 'Run.png',      frames: 8  },
            jump:    { file: 'Jump.png',     frames: 15 },
            attack1: { file: 'Attack_1.png', frames: 3  },
            attack2: { file: 'Attack_2.png', frames: 6  },
            attack3: { file: 'Attack_3.png', frames: 4  },
            dead:    { file: 'Dead.png',     frames: 6  },
            hurt:    { file: 'Hurt.png',     frames: 3  },
            shield:  { file: 'Shield.png',   frames: 3  },
          },
        },
      ],
      sheets: {
        idle:    { file: 'Idle.png',     frames: 6  },
        idle2:   { file: 'Idle_2.png',   frames: 5  },
        walk:    { file: 'Walk.png',     frames: 8  },
        run:     { file: 'Run.png',      frames: 8  },
        jump:    { file: 'Jump.png',     frames: 15 },
        attack1: { file: 'Attack_1.png', frames: 6  },
        attack2: { file: 'Attack_2.png', frames: 4  },
        attack3: { file: 'Attack_3.png', frames: 3  },
        dead:    { file: 'Dead.png',     frames: 6  },
        hurt:    { file: 'Hurt.png',     frames: 3  },
        shield:  { file: 'Shield.png',   frames: 3  },
      },
    });
  }
}
