# ---- Base image ----
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Les NEXT_PUBLIC_* sont inlinés dans le bundle NAVIGATEUR au moment du `next build`.
# Dokploy les fournissait via le .env qu'il écrivait dans le contexte de build ; le
# build tournant désormais sur GitHub Actions, il faut des build-args explicites —
# sans eux, Google Analytics et le Web Push sortiraient vides, silencieusement.
# Corollaire : jamais de clé secrète ici, ces valeurs sont publiques.
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
# URL FACTICE, jamais contactée : `auth.ts` construit le PrismaAdapter à
# l'évaluation du module (getUserPrisma() y est appelé au niveau racine), donc la
# collecte des pages par `next build` lève sans cette variable. Aucune connexion
# n'est ouverte au build : toutes les routes concernées sont `force-dynamic`, et
# la vraie URL est injectée au runtime par Dokploy.
ARG USER_DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"
ENV USER_DATABASE_URL=$USER_DATABASE_URL
# Générer les DEUX clients Prisma : base principale (schéma par défaut) et base
# utilisateurs (config dédiée). Le build échoue sinon (import du client user).
RUN npx prisma generate
RUN npm run user:generate
RUN npm run build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat

# Copier les fichiers nécessaires pour standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]