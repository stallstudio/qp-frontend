import type { DefaultSession } from "next-auth";

// Expose `user.id` sur la session (rempli par le callback session dans auth.ts).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
