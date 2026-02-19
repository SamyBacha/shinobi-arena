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
| **Fighter** | Commence avec 4 vies au lieu de 3 |
| **Samurai** | Chaque attaque inflige +1 dégât bonus — frappe jusqu'à x4 |
| **Shinobi** | Riposte — réduit les dégâts reçus d'1 lors d'un choc frappe/frappe |
| **Gotoku** | Esquive — si attaqué pendant une recharge, réduit les dégâts d'1 |
| **Onre** | Contre-attaque — se protéger avec une charge = riposte automatique |
| **Yurei** | Double recharge — chaque recharge donne 2 charges |
| **Kunoichi** | Mimétisme — copier l'action adverse rapporte +1 charge bonus |
| **Ninja Peasant** | Déguisement — garde/garde = +1 vie ; garde/recharge adverse = attaque surprise |
| **Wanderer Magician** | Garde Arcanique — se protéger recharge ; 3 charges = attaque magique à distance |

> Certains personnages sont verrouillés. Voir les **codes secrets** ci-dessous.

---

## ⚡ Règles du duel

Chaque joueur choisit une action en secret, puis les deux se révèlent simultanément :

| Action | Effet |
|---|---|
| **Recharger** | Gagne 1 charge (ou 2 avec Yurei) |
| **Protéger** | Bloque une attaque |
| **Frapper x1/x2/x3** | Dépense des charges, retire des vies à l'adversaire |

- Attaque vs Attaque → les deux prennent des dégâts
- Attaque vs Protection → dégâts bloqués
- Attaque vs Recharge → l'adversaire prend des dégâts et sa recharge échoue

Le dernier debout gagne !

---

## 🎹 Contrôles

### Joueur 1
| Touche | Action |
|---|---|
| `←` `→` | Déplacer |
| `↑` | Sauter |
| `Z` | Attaquer |
| `1` | Recharger (duel) |
| `2` | Protéger (duel) |
| `3` | Frapper (duel) |
| `ENTER` | Valider |
| `ESC` | Pause / Retour |

### Joueur 2 (duel local)
| Touche | Action |
|---|---|
| `7` | Recharger |
| `8` | Protéger |
| `9` | Frapper |

---

## 🔓 Codes secrets

Dans le menu principal, clique sur **"Code secret..."** en bas de l'écran, tape le code et appuie sur `ENTER`.

| Code | Effet |
|---|---|
| `ghost` | Débloque Gotoku, Onre et Yurei |
| `village` | Débloque Kunoichi et Ninja Peasant |
| `magik` | Débloque le Wanderer Magician |
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
