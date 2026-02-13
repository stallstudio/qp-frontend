import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";
import { Toaster } from "sonner";
import NextTopLoader from "nextjs-toploader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Queue Park - Live Theme Park Wait Times",
    template: "%s | Queue Park",
  },
  description:
    "Real-time wait times for over 100 theme parks worldwide. Track attraction queues, plan your visit, and maximize your fun with live data directly from park APIs.",
  keywords: [
    "theme park wait times",
    "amusement park queues",
    "roller coaster wait times",
    "theme park app",
    "live wait times",
    "attraction queues",
    "Disney wait times",
    "Universal wait times",
    "Six Flags wait times",
    "theme park planning",
  ],
  authors: [{ name: "Lilian G." }, { name: "Gaspard D." }],
  creator: "Queue Park",
  publisher: "Queue Park",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://queue-park.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://queue-park.com",
    title: "Queue Park - Live Theme Park Wait Times",
    description:
      "Real-time wait times for over 100 theme parks worldwide. Track attraction queues and plan your visit with live data.",
    siteName: "Queue Park",
    images: [
      {
        url: "/header.jpg",
        width: 1200,
        height: 630,
        alt: "Queue Park - Theme Park Wait Times",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Queue Park - Live Theme Park Wait Times",
    description:
      "Real-time wait times for over 100 theme parks worldwide. Track attraction queues and plan your visit.",
    images: ["/header.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
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
