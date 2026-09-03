"use client";

import { useEffect } from "react";

// Dernier filet : une erreur dans le LAYOUT racine lui-même. Ici ni providers,
// ni traductions, ni CSS applicatif garanti — ce composant doit rendre son
// propre <html>/<body> et rester volontairement autonome (styles en ligne).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
          Une erreur est survenue
        </h1>
        <p style={{ margin: 0, color: "#a1a1aa", maxWidth: "32rem" }}>
          Queue Park n&apos;a pas pu afficher cette page. Réessayez dans un
          instant.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            cursor: "pointer",
            borderRadius: "9999px",
            border: "none",
            background: "#fa6847",
            color: "#ffffff",
            padding: "0.6rem 1.4rem",
            fontSize: "0.95rem",
            fontWeight: 500,
          }}
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
