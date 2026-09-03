// Mention d'usage renvoyée par les routes de données publiques. Centralisée ici
// pour qu'une modification (contact, périmètre autorisé…) n'ait plus à être
// répercutée à l'identique dans chaque route.
export const DATA_DISCLAIMER =
  "This data is provided by the TWTS (Thrills Wait Times Service) and is strictly intended for authorized use only. Access and usage are exclusively permitted for thrills.world and queue-park.com. Any unauthorized access, use, reproduction, or distribution is strictly prohibited. If you wish to use or integrate this data, you must obtain prior written permission by contacting contact@queue-park.com. Unauthorized usage may result in immediate actions including permanent IP banning and revocation of access without notice. We actively monitor access to ensure compliance. By accessing this data, you agree to these terms.";

// Corps du 403 servi à une IP blacklistée.
//
// ⚠️ **Il RAPPELLE le `DATA_DISCLAIMER`, il ne dit pas seulement « bloqué ».**
// Une IP n'atterrit ici, en pratique, que parce qu'elle a exploité les données
// hors des termes annoncés en tête de chaque réponse — pas par accident. Un
// « Your IP address has been blocked » nu laissait croire à un incident
// technique et n'indiquait pas ce qu'il fallait corriger ; le blocage n'a
// d'effet dissuasif que s'il nomme la règle enfreinte et la voie de recours.
//
// ⚠️ `"Access denied"` et NON `"Forbidden"` : le libellé HTTP décrivait le code
// de statut, pas ce qui s'est passé. Vérifié avant de le changer — aucun client
// ne teste cette chaîne, elle n'est là que pour être lue par un humain.
export const BLOCKED_ERROR = "Access denied";
export const BLOCKED_MESSAGE =
  "Your IP address has been blocked due to unauthorized use of this data. This data is authorized exclusively for thrills.world and queue-park.com. Any other use, reproduction, redistribution, or integration requires prior written permission. To request access or contest this block, please contact us at contact@queue-park.com.";
