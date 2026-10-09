-- Favoris sur TOUS les POI (restaurants, boutiques, hôtels, services) sur la
-- base USER_DATABASE_URL.
--
-- Jusqu'ici l'étoile ne valait que pour les parcs, les attractions et les
-- spectacles. Chaque nouvelle famille a son type, comme `ride` et `show` : le
-- profil compte et liste ainsi chaque famille séparément.
--
-- ⚠️ À appliquer AVANT de déployer le front qui écrit ces valeurs (dev). Sans
-- elle, l'étoile d'un restaurant s'allume puis s'éteint : l'écriture est
-- refusée par l'enum et le front revient à l'état précédent.
--
-- ⚠️ Le code en production (main) n'écrit jamais ces valeurs, mais il les LIT
-- s'il en trouve : un restaurant mis en favori depuis le site de dev. Son
-- `groupFavorites` range alors tout type inconnu avec les attractions — le
-- restaurant apparaît sous sa clé brute parmi les attractions favorites du
-- profil de production, jusqu'au déploiement de la v4.
-- NON VÉRIFIÉ : que le client Prisma de main accepte de lire une valeur d'enum
-- que son schéma ne déclare pas. S'il la refusait, c'est toute la liste de
-- favoris de ce compte qui ne se chargerait plus en production. Tant que ce
-- n'est pas tranché, ne pas mettre de restaurant en favori depuis le site de
-- dev avec un compte qui sert aussi en production.
--
-- ⚠️ Appliquée à la main plutôt que par `npm run user:push`, comme les
-- précédentes : un `db push` aligne la base sur le schéma ENTIER. Enchaîner
-- avec `npm run user:generate`.
--
-- ⚠️ `qp-frontend/.env` pointe sur la PRODUCTION (`qp-production`) : vérifier
-- la base sur laquelle on est connecté.

ALTER TABLE favorites
  MODIFY COLUMN type ENUM('park','ride','show','restaurant','shop','hotel','service') NOT NULL;

-- Retour arrière (après avoir redéployé l'ancien front) :
--
-- DELETE FROM favorites WHERE type IN ('restaurant','shop','hotel','service');
-- ALTER TABLE favorites MODIFY COLUMN type ENUM('park','ride','show') NOT NULL;
