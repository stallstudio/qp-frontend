# Configuration de l'API

## Configuration de la clé API

1. Créez un fichier `.env.local` à la racine du projet :

```bash
cp .env.local.example .env.local
```

2. Ajoutez votre clé API dans le fichier `.env.local` :

```env
QUEUE_TIMES_API_KEY=votre_cle_api_ici
```

## Structure de l'API

### Route API : `/api/parks/[parkId]`

Cette route sert de proxy pour protéger votre clé API. Elle appelle l'API externe et retourne les données du parc.

**Endpoint :** `GET /api/parks/[parkId]`

**Exemple de réponse attendue :**

```json
{
  "name": "WALIBI BELGIUM",
  "status": "PARK CURRENTLY OPEN",
  "hours": "PARK HOURS: 10H00 - 22H00",
  "lastUpdate": "14h06",
  "attractions": [
    {
      "name": "Kondaa",
      "waitTime": 45,
      "status": "OPEN"
    }
  ]
}
```

## Adaptation à votre API

Dans le fichier `/app/api/parks/[parkId]/route.ts`, modifiez :

1. **L'URL de l'API externe** (ligne ~19) :
   ```typescript
   const response = await fetch(
     `https://votre-api.com/parks/${parkId}`,
     // ...
   );
   ```

2. **Les headers d'authentification** si nécessaire

3. **La transformation des données** pour correspondre à l'interface `ParkData`

## Cache

- Les données sont mises en cache pendant 5 minutes (`revalidate: 300`)
- Vous pouvez ajuster cette valeur selon vos besoins
