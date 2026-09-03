import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Footer from "@/components/ui/footer";

// Squelette de la page profil, calqué sur ProfilePageClient : en-tête, carte à
// onglets avec 3 vignettes de stats, barre d'onglets, puis deux containers de
// section (alertes actives / historique). Affiché tant que la session charge.
export default function ProfileSkeleton() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-3 sm:px-4 lg:max-w-6xl">
      <main className="mt-4 flex flex-1 flex-col gap-1">
        {/* En-tête */}
        <div className="mb-3 space-y-2 px-1">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>

        <Card className="w-full gap-0 rounded-4xl p-2.5 sm:p-4">
          {/* 3 vignettes de stats */}
          <div className="grid grid-cols-3 gap-2 p-1 pb-3 sm:gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 sm:flex-row sm:gap-3 sm:px-4"
              >
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-10" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>

          {/* Barre d'onglets */}
          <Skeleton className="h-10 w-full rounded-3xl" />

          {/* Deux containers de section (icône + titre + contenu). */}
          <div className="flex flex-col gap-4 p-2 pt-5 sm:p-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-3xl border p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-2xl" />
                  <Skeleton className="h-7 w-44" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
