// ============================================================
// Scenes Loader — récupère dynamiquement tous les GIFs de
// img/world/scenes/ via un fetch du listing du dossier.
// GIF_SCENES est une Promise résolue avant le démarrage du jeu.
// ============================================================

// Nom du GIF utilisé pour le boss final — à mettre à jour si renommé
const BOSS_GIF = 'finalfight.gif';

let GIF_SCENES = [];

async function loadGifScenes() {
  try {
    const res  = await fetch('img/world/scenes/');
    const html = await res.text();
    const parser = new DOMParser();
    const doc  = parser.parseFromString(html, 'text/html');
    const links = Array.from(doc.querySelectorAll('a[href]'));
    GIF_SCENES = links
      .map(a => a.getAttribute('href'))
      .filter(href => /\.gif$/i.test(href))
      .map(href => href.split('/').pop()); // juste le nom de fichier
  } catch (e) {
    console.warn('loadGifScenes: impossible de lister img/world/scenes/', e);
    GIF_SCENES = [];
  }
}
