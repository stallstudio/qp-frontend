import type { Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./twemoji-amazing.css";
import { ThemeProvider } from "../components/theme-provider";
import { Toaster } from "sonner";
import NextTopLoader from "nextjs-toploader";
import { GoogleAnalytics } from "../components/google-analytics";

// theme-color adaptatif : la barre du navigateur suit le thème clair/sombre.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* ⚠️ `font-sans` est INDISPENSABLE. Tailwind pose la police sur
          `<html>`, via `--font-sans` → `--font-geist-sans` ; or next/font ne
          déclare cette variable que sur `<body>`. Sans cette classe, la
          variable est vide au niveau de `<html>` et tout le site retombait sur
          la police système (Segoe UI, San Francisco) — Geist était téléchargé
          sans jamais s'afficher (corrigé le 2026-10-07). */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <GoogleAnalytics />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Toaster />
        <NextTopLoader color="#fa6847" />
      </body>
    </html>
  );
}
