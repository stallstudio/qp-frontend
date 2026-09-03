import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import ResendProvider from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { cookies } from "next/headers";
import { render } from "@react-email/components";
import { getUserPrisma } from "@/lib/user-prisma";
import { getResend, LOGIN_FROM_EMAIL } from "@/lib/resend";
import MagicLinkEmail, { getMagicLinkSubject } from "@/emails/magic-link";
import { routing } from "@/i18n/routing";

// Authentification Queue Park (Auth.js v5), sans mot de passe :
//  - Google OAuth
//  - Magic link envoyé par email (provider Resend, template maison réutilisant
//    l'architecture d'emails de l'administration)
// Sessions stockées en base UTILISATEURS via le PrismaAdapter (table sessions).

// Détecte la langue de l'email depuis le cookie next-intl posé côté site, pour
// envoyer le magic link dans la langue de navigation (fallback: locale par défaut).
async function detectEmailLocale(): Promise<string> {
  try {
    const store = await cookies();
    const cookieLocale = store.get("NEXT_LOCALE")?.value;
    if (
      cookieLocale &&
      routing.locales.includes(cookieLocale as (typeof routing.locales)[number])
    ) {
      return cookieLocale;
    }
  } catch {
    // cookies() indisponible hors requête : on retombe sur la locale par défaut.
  }
  return routing.defaultLocale;
}

// Google renvoie le nom COMPLET (« Prénom Nom »). On ne conserve que le prénom
// dans `name` : l'interface s'adresse à l'utilisateur par son prénom, ton plus
// personnel. `given_name` est la source fiable (il peut être composé, on le
// garde tel quel) ; à défaut on prend le premier mot du nom complet.
function googleFirstName(profile?: {
  name?: string | null;
  given_name?: string | null;
}): string | undefined {
  const given = profile?.given_name?.trim();
  if (given) return given;
  const full = profile?.name?.trim();
  if (!full) return undefined;
  return full.split(/\s+/)[0];
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Le client de la base utilisateurs est généré sur un chemin custom : on le
  // passe tel quel à l'adapter (structurellement compatible), cast pour éviter
  // une divergence nominale de types avec le PrismaClient de @prisma/client.
  adapter: PrismaAdapter(
    getUserPrisma() as unknown as Parameters<typeof PrismaAdapter>[0],
  ),
  // Nécessaire derrière un reverse-proxy (déploiement Docker/Dokploy).
  trustHost: true,
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
      // Profil normalisé utilisé par l'adapter À LA CRÉATION du compte : même
      // forme que celui d'Auth.js, au nom près (prénom seul).
      profile(profile) {
        return {
          id: profile.sub,
          // Pas de nom fourni par Google : on laisse vide, l'UI retombe
          // d'elle-même sur l'e-mail.
          name: googleFirstName(profile) ?? null,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
    ResendProvider({
      apiKey: process.env.RESEND_API_KEY,
      from: LOGIN_FROM_EMAIL,
      // Lien de connexion valable 30 minutes.
      maxAge: 60 * 30,
      async sendVerificationRequest({ identifier: email, url }) {
        const locale = await detectEmailLocale();
        // On rend l'email en HTML nous-mêmes (import statique de `render`) plutôt
        // que de passer `react:` à Resend, dont le rendu interne repose sur un
        // require dynamique que le bundler Next n'inclut pas.
        const element = MagicLinkEmail({ url, locale });
        const [html, text] = await Promise.all([
          render(element),
          render(element, { plainText: true }),
        ]);
        const { error } = await getResend().emails.send({
          from: LOGIN_FROM_EMAIL,
          to: email,
          subject: getMagicLinkSubject(locale),
          html,
          text,
        });
        if (error) {
          throw new Error(`Resend error: ${error.message}`);
        }
      },
    }),
  ],
  callbacks: {
    // Un compte créé par magic link n'a ni nom ni photo (le provider email n'en
    // fournit pas), et l'UI retombe alors sur l'e-mail. Quand ce même compte se
    // connecte ensuite via Google (fusion par email grâce à
    // `allowDangerousEmailAccountLinking`), Auth.js NE met PAS à jour le nom/photo
    // de l'utilisateur existant. On le fait donc ici, en relisant l'enregistrement
    // EN BASE par e-mail (source de vérité fiable, contrairement à l'objet `user`
    // reçu qui, au moment de la liaison, peut déjà porter le nom Google en mémoire
    // sans qu'il soit persisté). On ne remplit que ce qui manque réellement.
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        // Selon la normalisation d'Auth.js, la photo Google arrive sous `picture`
        // (profil OIDC brut) ou `image` (profil normalisé) : on lit les deux.
        const google = profile as
          | {
              name?: string;
              given_name?: string;
              email?: string;
              picture?: string;
              image?: string;
            }
          | undefined;
        // On lit le nom/photo depuis PLUSIEURS sources : le profil OIDC brut
        // (`name`/`picture`), le profil normalisé (`image`) et l'objet `user`
        // normalisé par Auth.js — selon le flux, la donnée n'arrive pas toujours
        // au même endroit.
        // Prénom uniquement, ici aussi : sans ça la connexion suivante
        // réécrirait le nom complet par-dessus.
        const googleName =
          googleFirstName(google) ??
          googleFirstName({ name: user?.name }) ??
          undefined;
        const googleImage =
          google?.picture ?? google?.image ?? user?.image ?? undefined;
        const email = user?.email ?? google?.email;
        if (email && (googleName || googleImage)) {
          try {
            const db = getUserPrisma();
            const existing = await db.user.findUnique({ where: { email } });
            if (existing) {
              // Google fait AUTORITÉ pour la photo (l'app ne permet pas de la
              // modifier). On écrase donc dès que Google fournit une valeur
              // DIFFÉRENTE — et pas seulement « si le champ est vide ». Sans ça,
              // un compte créé par magic link dont un correctif précédent avait
              // rempli une photo restait bloqué sur l'ancienne valeur.
              const data: { name?: string; image?: string } = {};
              // ...SAUF pour le nom, désormais modifiable depuis le profil : on
              // ne le remplace que s'il est vide ou s'il porte encore une valeur
              // VENUE de Google (nom complet d'avant, ou prénom déjà appliqué).
              // Un nom choisi par l'utilisateur n'est jamais écrasé.
              const nameFromGoogle =
                !existing.name ||
                existing.name === google?.name ||
                existing.name === googleName;
              if (googleName && nameFromGoogle && existing.name !== googleName)
                data.name = googleName;
              if (googleImage && existing.image !== googleImage)
                data.image = googleImage;
              if (Object.keys(data).length > 0) {
                await db.user.update({ where: { id: existing.id }, data });
              }
            }
          } catch {
            // Non bloquant : la connexion réussit même si la maj du profil échoue.
          }
        }
      }
      return true;
    },
    // Sessions "database" : on expose l'id utilisateur côté session pour les
    // routes API (autorisation des données du compte).
    session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        // `isAdmin` autorise l'aperçu des parcs masqués (voir lib/auth-helpers).
        // La stratégie est "database" : `user` EST la ligne relue en base à
        // chaque requête, le drapeau ne coûte donc aucune requête de plus et un
        // retrait prend effet sans attendre une reconnexion. Le cast contourne
        // `AdapterUser`, qui ne connaît que les champs standard d'Auth.js.
        session.user.isAdmin =
          (user as { isAdmin?: boolean }).isAdmin === true;
      }
      return session;
    },
  },
});
