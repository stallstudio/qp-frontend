import type { DefaultSession } from "next-auth";

// Expose `user.id` et `user.isAdmin` sur la session (remplis par le callback
// session dans auth.ts).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Aperçu des parcs masqués (`parks.display = false`). */
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}
