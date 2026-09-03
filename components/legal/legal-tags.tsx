import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";

// Rendus de balises partagés par les textes légaux traduits (namespace i18n
// `legal`, via `t.rich`). Les liens internes utilisent le `Link` localisé pour
// préserver la langue courante. Centralisé ici pour rester cohérent entre les
// trois pages (confidentialité, cookies, mentions légales).
export const legalTags = {
  b: (chunks: ReactNode) => <strong>{chunks}</strong>,
  i: (chunks: ReactNode) => <em>{chunks}</em>,
  c: (chunks: ReactNode) => <code>{chunks}</code>,
  mail: (chunks: ReactNode) => (
    <a href="mailto:contact@queue-park.com">{chunks}</a>
  ),
  mentions: (chunks: ReactNode) => (
    <Link href="/legal-notice">{chunks}</Link>
  ),
  cookies: (chunks: ReactNode) => <Link href="/cookies">{chunks}</Link>,
  profile: (chunks: ReactNode) => <Link href="/profile">{chunks}</Link>,
};
