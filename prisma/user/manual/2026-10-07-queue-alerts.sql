-- Alertes par FILE (Single Rider, file virtuelle, Disney Premier Access…) sur
-- la base USER_DATABASE_URL.
--
-- Jusqu'ici une alerte visait l'attraction, c'est-à-dire sa file standby : une
-- seule par attraction et par utilisateur. On peut désormais en poser une par
-- file, et une nouvelle nature s'ajoute pour les créneaux : `slot`, « un
-- créneau commençant avant HH:mm est disponible ».
--
-- ⚠️ À appliquer AVANT de déployer le front qui nomme ces colonnes (main comme
-- dev). Tout est compatible avec le code déjà en production :
--   - `queueType` vaut `standby` par défaut : les alertes existantes et celles
--     que crée l'ancien code restent des alertes d'attraction ;
--   - la clé unique s'élargit à la file ; tant que toutes les lignes sont
--     `standby`, elle équivaut à l'ancienne ;
--   - la valeur d'enum `slot` n'est écrite que par le nouveau code, et le
--     correctif poussé sur main filtre partout sur `queueType = 'standby'`.
--
-- ⚠️ Appliquée à la main plutôt que par `npm run user:push`, comme
-- 2026-08-25-user-is-admin.sql : un `db push` aligne la base sur le schéma
-- ENTIER. Enchaîner avec `npm run user:generate`.
--
-- ⚠️ `qp-frontend/.env` pointe sur la PRODUCTION (`qp-production`) : vérifier la
-- base sur laquelle on est connecté. Si l'application de dev a sa propre base
-- utilisateurs, la migration s'y applique aussi.

ALTER TABLE alerts
  ADD COLUMN queueType VARCHAR(50) NOT NULL DEFAULT 'standby' AFTER rideId,
  ADD COLUMN slotBefore VARCHAR(5) NULL AFTER threshold,
  MODIFY COLUMN type ENUM('threshold','reopen','slot') NOT NULL DEFAULT 'threshold';

-- La nouvelle clé AVANT le retrait de l'ancienne. `alerts_userId_idx` porte
-- déjà la clé étrangère sur `userId`.
ALTER TABLE alerts ADD UNIQUE INDEX alerts_userId_rideId_queueType_key (userId, rideId, queueType);
ALTER TABLE alerts DROP INDEX alerts_userId_rideId_key;

ALTER TABLE alert_history
  ADD COLUMN queueType VARCHAR(50) NOT NULL DEFAULT 'standby' AFTER rideId,
  ADD COLUMN slotBefore VARCHAR(5) NULL AFTER threshold,
  MODIFY COLUMN type ENUM('threshold','reopen','slot') NOT NULL DEFAULT 'threshold';

-- Retour arrière (après avoir redéployé l'ancien front) :
--
-- DELETE FROM alert_history WHERE queueType <> 'standby';
-- DELETE FROM alerts WHERE queueType <> 'standby';
-- ALTER TABLE alerts ADD UNIQUE INDEX alerts_userId_rideId_key (userId, rideId);
-- ALTER TABLE alerts DROP INDEX alerts_userId_rideId_queueType_key;
-- ALTER TABLE alerts DROP COLUMN queueType, DROP COLUMN slotBefore,
--   MODIFY COLUMN type ENUM('threshold','reopen') NOT NULL DEFAULT 'threshold';
-- ALTER TABLE alert_history DROP COLUMN queueType, DROP COLUMN slotBefore,
--   MODIFY COLUMN type ENUM('threshold','reopen') NOT NULL DEFAULT 'threshold';
