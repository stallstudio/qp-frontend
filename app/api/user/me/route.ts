import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getUserPrisma } from "@/lib/user-prisma";
import { getPreferences } from "@/lib/user-account";
import { groupFavorites } from "@/lib/user-favorites";
import type { UserProfile } from "@/types/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Profil complet de l'utilisateur connecté : préférences, favoris et compteurs.
// Point d'entrée unique du UserProvider au chargement / à la connexion.
export async function GET() {
  const { userId, response } = await requireUserId();
  if (!userId) return response || NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getUserPrisma();

  const [user, prefs, favorites, activeRideAlerts, activeShowReminders] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, image: true },
      }),
      getPreferences(userId),
      prisma.favorite.findMany({
        where: { userId },
        select: { type: true, key: true },
      }),
      prisma.alert.count({ where: { userId, active: true } }),
      // Les rappels de spectacle comptent aussi comme des alertes actives : une
      // ligne `show_reminders` n'existe QUE tant qu'elle est en attente (le cron
      // la supprime à l'envoi), donc pas de filtre à appliquer ici.
      prisma.showReminder.count({ where: { userId } }),
    ]);

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const grouped = groupFavorites(favorites);

  const profile: UserProfile = {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    preferences: prefs.preferences,
    preferencesInitialized: prefs.initialized,
    favorites: grouped,
    counts: {
      favorites: favorites.length,
      activeAlerts: activeRideAlerts + activeShowReminders,
    },
  };

  return NextResponse.json(profile);
}
