"use client";

import { SessionProvider } from "next-auth/react";

// Fournit le contexte de session Auth.js aux composants clients (useSession).
export default function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
