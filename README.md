# Portfolio

Ouvrir le site localement depuis ce dossier.

```sh
python3 -m http.server 4173 --directory dist
```

L’aperçu est disponible sur [localhost:4173](http://localhost:4173).

## Image du hero

Pour superposer une image au fond animé, place-la dans `dist/assets/` puis renseigne les attributs `data-src` et `alt` de l’élément `.hero-image` dans `dist/index.html`. Un PNG ou WebP transparent laisse apparaître les plaques autour de son sujet. Les propriétés CSS `--image-top`, `--image-left` et `--image-width` règlent le placement. Les variantes portant le suffixe `-mobile` s’appliquent sur petit écran.

## Fond 3D

Le hero lance automatiquement la scène Spline de [Fragment Studio](https://www.fragment.im/). Son cadrage s’adapte à la taille de la fenêtre en continu. Le défilement accélère les plaques, puis elles reviennent à leur vitesse normale.

Le moteur Spline et son module d’animation sont épinglés à la version 2.0.170. Lors d’une mise à jour, vérifier que le module utilisé dans `dist/portfolio.js` est celui qu’importe le nouveau moteur. L’animation CSS de secours répond aux mêmes commandes de vitesse et de pause.

## Carrés de projet

Chaque lien du menu `.project-index` dans `dist/index.html` associe la page d’un projet à sa couverture avec `data-cover`. La scène 3D répartit ces liens sur les carrés et les répète le long de sa boucle. Les liens `.plate-cover` servent aux carrés de l’animation CSS de secours.

Pour ajouter un projet, placer sa page dans `dist/projets/` et préparer une couverture carrée dans `dist/assets/`. La fiche peut montrer le visuel principal dans son format d’origine.

## Affiches

Pour ajouter une série dans la même case, ajouter les images dans `dist/assets/`, puis ajouter un bloc `<article class="poster-series">` à la page `dist/projets/affiches.html` avec un titre, un court texte et sa galerie. La couverture de la case reste `dist/assets/affiches-carre.webp`.
