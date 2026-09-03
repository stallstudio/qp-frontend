-- Colonne `isAdmin` sur les comptes du SITE PUBLIC (base USER_DATABASE_URL).
--
-- Elle autorise l'aperçu des parcs masqués (`parks.display = false`) à leur URL
-- normale : sans elle, un parc en préparation n'est visible de personne tant
-- qu'il n'est pas publié pour tout le monde.
--
-- ⚠️ Appliquée à la main plutôt que par `npm run user:push` : un `db push`
-- aligne la base sur le schéma ENTIER, alors qu'on ne veut toucher qu'à cette
-- colonne. Enchaîner avec `npm run user:generate` pour que le client connaisse
-- le champ.
--
-- ⚠️ `qp-frontend/.env` pointe sur la PRODUCTION (`qp-production`) : vérifier la
-- base sur laquelle on est connecté avant de lancer ceci.

ALTER TABLE users ADD COLUMN isAdmin TINYINT(1) NOT NULL DEFAULT 0;
