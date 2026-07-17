import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

// Email de connexion « magic link ». Reprend l'architecture des templates de
// l'administration (react-email + objet `translations` + getEmailSubject +
// bannière/styles inline). Sans mot de passe : un seul lien à usage unique.

const translations = {
  fr: {
    subject: "Votre lien de connexion Queue Park",
    preview: "Connectez-vous à Queue Park en un clic",
    greeting: "Bonjour,",
    intro:
      "Cliquez sur le bouton ci-dessous pour vous connecter à votre compte Queue Park. Ce lien est valable une seule fois et expire prochainement.",
    button: "Se connecter",
    fallback:
      "Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :",
    ignore:
      "Vous n'avez pas demandé cette connexion ? Ignorez simplement cet email, aucun compte ne sera créé ou modifié.",
    teamSignature: "L'équipe Queue Park",
    footer: "Cet email vous a été envoyé suite à une demande de connexion sur Queue Park.",
  },
  en: {
    subject: "Your Queue Park sign-in link",
    preview: "Sign in to Queue Park in one click",
    greeting: "Hello,",
    intro:
      "Click the button below to sign in to your Queue Park account. This link can be used once and expires soon.",
    button: "Sign in",
    fallback: "If the button doesn't work, copy and paste this link into your browser:",
    ignore:
      "Didn't request this sign-in? Simply ignore this email — no account will be created or changed.",
    teamSignature: "The Queue Park Team",
    footer: "This email was sent following a sign-in request on Queue Park.",
  },
};

type Lang = keyof typeof translations;

function resolveLang(locale: string): Lang {
  return locale === "fr" ? "fr" : "en";
}

export function getMagicLinkSubject(locale: string): string {
  return translations[resolveLang(locale)].subject;
}

interface MagicLinkEmailProps {
  url: string;
  locale: string;
}

export default function MagicLinkEmail({
  url = "https://queue-park.com",
  locale = "en",
}: MagicLinkEmailProps) {
  const t = translations[resolveLang(locale)];

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://queue-park.com/mail_cover.png"
            width="600"
            alt="Queue Park"
            style={banner}
          />

          <Section style={contentSection}>
            <Text style={greeting}>{t.greeting}</Text>
            <Text style={paragraph}>{t.intro}</Text>

            <Section style={buttonWrapper}>
              <Button href={url} style={button}>
                {t.button}
              </Button>
            </Section>

            <Text style={fallbackLabel}>{t.fallback}</Text>
            <Link href={url} style={fallbackLink}>
              {url}
            </Link>

            <Text style={ignoreText}>{t.ignore}</Text>
            <Text style={signature}>{t.teamSignature}</Text>
          </Section>

          <Section style={footerSection}>
            <Text style={footer}>{t.footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  maxWidth: "600px",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
};

const banner: React.CSSProperties = {
  display: "block",
  width: "100%",
};

const contentSection: React.CSSProperties = {
  padding: "32px 40px",
};

const greeting: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#1a1a1a",
  marginBottom: "4px",
};

const paragraph: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#4a4a4a",
};

const buttonWrapper: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "28px 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#fa6b48",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 32px",
  display: "inline-block",
};

const fallbackLabel: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  margin: "0 0 4px 0",
};

const fallbackLink: React.CSSProperties = {
  fontSize: "13px",
  color: "#fa6b48",
  wordBreak: "break-all" as const,
};

const ignoreText: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "22px",
  color: "#6b7280",
  marginTop: "24px",
};

const signature: React.CSSProperties = {
  fontSize: "14px",
  color: "#4a4a4a",
  marginTop: "16px",
};

const footerSection: React.CSSProperties = {
  backgroundColor: "#f8f9fa",
  padding: "20px 40px",
  textAlign: "center" as const,
};

const footer: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  margin: "0",
};
