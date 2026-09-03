# Améliorations de la prévision

## 1. Prévision dispo plus tôt

Permettre de voir une prévision avant l'ouverture du parc, basée uniquement sur l'historique des jours précédents (à partir de minuit si parc déjà fermé, sinon à partir de 1h après la fermeture du parc - exemple : si parc ferme à 01h00, alors prédictions dispo à partir de 02h00).

**Garde-fous :**
- Afficher une indice de confiance, mais juste genre : faible, moyenne, haute
- N'activer que si suffisamment d'historique est disponible
- Préciser que la prévision sera mise à jour à l'ouverture

## 2. Adapter la prévision au type de jour et prise en compte des vacances scolaires

Tenir compte du fait que les weekends sont généralement plus chargés que les jours de semaine en calculant des profils distincts.
Adapter la prévision aux périodes de vacances scolaires où l'affluence est plus forte, prendre en compte les vacances scolaires du pays dans lequel se trouve le parc mais aussi ceux à côté.
Voir si une API gratuite et publique existe pour récupérer ses infos.

## 3. Intégrer la météo

Ajuster la prévision en fonction de la météo prévue (pluie = moins chargé, soleil = plus chargé, mais trop chaud (canicule) = moins chargé aussi) ainsi que la température.
Voir si une API gratuite et publique existe pour récupérer ses infos.

Si on arrive à faire ça, il pourrait être bien aussi de prendre en compte cet élement dans @tw-waittimes-worker et faire un appel automatiquement par jour en fonction de la ville ou se trouve le parc, ensuite stocker en db, afin d'avoir la température minimum et max : genre "— °C - —°C". Cela pourra également être affiché sur les pages des parcs dans @qp-frontend afin d'informer les utilisateurs de la météo prévue pour le jour. Et pareil pour obtenir la météo prévue : pluie, neige, soleil, soleil fort, soleil & nuage, nuageux, vent, orage, etc. Et comme ça on peut mettre un petit icone a cote des températures pour afficher tout ça proprement. 

## 5. Détecter les événements spéciaux (optionnel : a voir de la faisailité de la chose et qu'est-ce que tu proposes)

Identifier les événements spéciaux (concerts, festivals, Halloween, Noël) qui augmentent l'affluence. 

## 6. Segmenter par type d'attraction (optionnel: on récuperera cette donnée plus tard sur Thrills.world également)

Adapter les profils historiques au type d'attraction (family, thrill, water, show) car ils ont des fréquentations différentes.