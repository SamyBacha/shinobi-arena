# ⚔️ Shinobi Arena

Un jeu de combat japonais mêlant **plateforme en monde ouvert** et **duels au tour par tour**, entièrement jouable dans le navigateur.

---

## 🎮 Modes de jeu

### Aventure
Parcours un monde généré aléatoirement, affronte des ennemis en chemin et accumule le score le plus loin possible. Double-tape pour courir, enchaîne les combos, saute les pièges.

### Duel — Joueur vs Joueur
Deux joueurs sur le même clavier. Choisissez vos personnages, choisissez votre arène, et affrontez-vous en combat tactique au tour par tour.

### Duel — Joueur vs IA
Affronte le CPU. Si tu gagnes, la sélection des personnages se relance pour un nouveau match.

### Arcade
Enchaîne les adversaires dans un ordre fixe jusqu'au boss final — le **Wanderer Magician** — dans son arène spéciale avec musique et effets d'éclairs.

---

## 🥷 Personnages

| Personnage | Capacité spéciale |
|---|---|
| **Fighter** | Commence avec 5 vies au lieu de 3 |
| **Samurai** | Chaque attaque inflige +1 dégât bonus — frappe jusqu'à x4 |
| **Shinobi** | Riposte — réduit les dégâts reçus d'1 lors d'un choc frappe/frappe |
| **Gotoku** | Esquive — si attaqué pendant une recharge, réduit les dégâts d'1 |
| **Onre** | Contre-attaque — se protéger avec une charge = riposte automatique |
| **Yurei** | Double recharge — chaque recharge donne 2 charges |
| **Kunoichi** | Mimétisme — copier l'action adverse rapporte +1 charge bonus |
| **Ninja Peasant** | Déguisement — garde/garde = +1 vie ; garde/recharge adverse = attaque surprise |
| **Wanderer Magician** | Garde Arcanique — se protéger si attaqué donne +1 mana + contre-attaque ; projectile via touche 4/R (J1) ou 0 (J2) |
| **Yokai** | Âme Vengeresse (Karasu/Yamabushi) — commence avec 1 mana ; 4 recharges consécutives = +1 vie. Kitsune — frappe x1 corps à corps, projectile x1 (3 mana) ou x2 (4 mana), pas de soin |

> Certains personnages sont verrouillés. Voir les **codes secrets** ci-dessous.

---

## ⚡ Règles du duel

Chaque joueur choisit une action en secret, puis les deux se révèlent simultanément :

| Action | Coût | Effet |
|---|---|---|
| **Recharger** | — | Gagne 1 mana (ou 2 avec Yurei) |
| **Protéger** | — | Bloque une attaque (réduit les dégâts d'un projectile à 1 vie) |
| **Frapper x1/x2/x3** | 1/2/3 mana | Retire 1/2/3 vies à l'adversaire |
| **Projectile** *(Magician, Kitsune)* | 4 mana (Kitsune: 3/4) | Retire **2 vies** ; si l'adversaire se protège : **1 vie** |

- Projectile vs Projectile → les deux projectiles s'annulent au milieu, aucun dégât, perte de mana seulement
- Attaque vs Attaque → les deux prennent des dégâts
- Attaque vs Protection → dégâts bloqués
- Attaque vs Recharge → l'adversaire prend des dégâts et sa recharge échoue

Le dernier debout gagne !

### Kitsune (outfit Yokai)
- Frappe corps à corps limité à x1 (animation Attack_1, portée à distance)
- Projectile x1 à 3 mana : animation Attack_3 + projectile Fire_1
- Projectile x2 à 4 mana : Attack_3 + Fire_1, puis Attack_2 + Fire_2
- Toutes les attaques s'effectuent à distance

---

## 🎹 Contrôles

### Joueur 1
| Touche | Action |
|---|---|
| `←` `→` | Déplacer |
| `↑` | Sauter |
| `Z` | Attaquer |
| `1` ou `A` | Recharger (duel) |
| `2` ou `Z` | Protéger (duel) |
| `3` ou `E` | Frapper (duel — appuyer plusieurs fois pour x2/x3) |
| `4` ou `R` | Projectile (duel — personnages éligibles uniquement) |
| `ENTER` | Valider |
| `ESC` | Pause / Retour |

### Joueur 2 (duel local)
| Touche | Action |
|---|---|
| `7` | Recharger |
| `8` | Protéger |
| `9` | Frapper (appuyer plusieurs fois pour x2/x3) |
| `0` | Projectile (personnages éligibles uniquement) |

---

## 🔓 Codes secrets

Dans le menu principal, clique sur **"Code secret..."** en bas de l'écran, tape le code et appuie sur `ENTER`.

| Code | Effet |
|---|---|
| `ghost` | Débloque Gotoku, Onre et Yurei |
| `village` | Débloque Kunoichi et Ninja Peasant |
| `magik` | Débloque le Wanderer Magician |
| `yokai` | Débloque les Yokai (Karasu Tengu, Kitsune, Yamabushi Tengu) |
| `badaboom` | Débloque **tous** les personnages d'un coup |
| `finalfight` | Active le mode boss final direct en Arcade |

---

## 🏟️ Arènes

Le jeu dispose de plus de 20 arènes animées : dojos, temples, toits, prairies, ruines en flammes, nuit sous la pluie… L'arène du boss final (`finalfight`) est réservée au combat contre le Magician.

---

## ⚙️ Lancer le jeu

```bash
npm install
npm start
```

Le jeu s'ouvre automatiquement dans le navigateur sur `http://localhost:8080`.

---

## 🛠️ Technologies

- [Phaser 3](https://phaser.io/) — moteur de jeu WebGL/Canvas
- JavaScript ES6
- Webpack 5
- Sprites pixel art, animations GIF, audio MP3
