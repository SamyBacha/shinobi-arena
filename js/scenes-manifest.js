// ============================================================
// Scenes manifest — STAGES est déclaré statiquement dans
// js/duel/Stage.js (approche DDD).
// GIF_SCENES est maintenu pour compatibilité avec le code existant.
// ============================================================

// Nom du stage boss final (utilisé dans DuelScene)
const BOSS_GIF = 'finalfight';

// Dérivé de STAGES pour compatibilité (utilisé dans DuelScene via stageIndex)
// Sera peuplé après le chargement de Stage.js
let GIF_SCENES = [];

function initScenes() {
  GIF_SCENES = STAGES.map(s => s.id);
}
