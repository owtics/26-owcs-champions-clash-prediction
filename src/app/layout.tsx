import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXTAUTH_URL ??
  "https://26-owcs-champions-clash-prediction.vercel.app";

const normalizedSiteUrl = siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;

const previewImage =
  `${normalizedSiteUrl}/logos/tournament/champions-clash.png`;

export const metadata: Metadata = {
  metadataBase: new URL(normalizedSiteUrl),

  title: "OWTICS.GG Pick'Ems",
  description: "OWCS Champions Clash Pick'em & Prediction Leaderboard",

  icons: {
    icon: "/logos/site/favicon.ico",
    shortcut: "/logos/site/favicon.ico",
    apple: "/logos/site/favicon.ico",
  },

  openGraph: {
    type: "website",
    url: normalizedSiteUrl,
    siteName: "OWTICS.GG Pick'Ems",
    title: "OWTICS.GG Pick'Ems",
    description: "OWCS Champions Clash Pick'em & Prediction Leaderboard",
    images: [
      {
        url: previewImage,
        width: 1200,
        height: 630,
        alt: "OWTICS.GG Pick'Ems preview image",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "OWTICS.GG Pick'Ems",
    description: "OWCS Champions Clash Pick'em & Prediction Leaderboard",
    images: [previewImage],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-brand-bg text-brand-text antialiased min-h-screen">
        <Providers>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}