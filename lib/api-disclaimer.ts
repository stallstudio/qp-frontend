// Corps du 403 servi par `middleware.ts` à une IP ou un user agent blacklisté
// sur les PAGES. Le même texte que celui des routes de données, servies par
// l'API Dispatch : les deux doivent dire la même chose au même robot.
//
// ⚠️ **Il RAPPELLE la mention d'usage, il ne dit pas seulement « bloqué ».**
// Une IP n'atterrit ici, en pratique, que parce qu'elle a exploité les données
// hors des termes annoncés en tête de chaque réponse — pas par accident. Un
// « Your IP address has been blocked » nu laissait croire à un incident
// technique et n'indiquait pas ce qu'il fallait corriger ; le blocage n'a
// d'effet dissuasif que s'il nomme la règle enfreinte et la voie de recours.
export const BLOCKED_MESSAGE =
  "Your IP address has been blocked due to unauthorized use of this data. This data is authorized exclusively for thrills.world and queue-park.com. Any other use, reproduction, redistribution, or integration requires prior written permission. To request access or contest this block, please contact us at contact@queue-park.com.";
