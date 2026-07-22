import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import Footer from "@/components/ui/footer";

// Coquille sobre et partagée par les pages légales (mentions légales,
// confidentialité, cookies) : conteneur étroit lisible + retour accueil + footer.
export default function LegalPage({
  title,
  updated,
  backLabel = "Queue Park",
  children,
}: {
  title: string;
  updated?: string;
  // Libellé du lien de retour (par défaut la marque ; les pages passent le
  // « Retour à l'accueil » traduit, comme le header du profil).
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-3 sm:px-4 lg:max-w-6xl">
      {/* Largeur de cadre alignée sur l'accueil (max-w-4xl / lg:max-w-6xl) pour
          harmoniser les marges ; le texte reste borné (max-w-3xl) pour la lisibilité. */}
      <main className="mt-8 w-full max-w-3xl flex-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>

        <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
        {updated && (
          <p className="mt-1 text-sm text-muted-foreground">{updated}</p>
        )}

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
