import { handlers } from "@/auth";

// Auth.js (Google + magic link). Runtime Node : le PrismaAdapter et l'adapter
// MariaDB ne tournent pas en edge.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
