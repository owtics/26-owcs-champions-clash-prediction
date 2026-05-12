import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXTAUTH_URL ??
  "https://26-owcs-champions-clash-prediction.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "OWTICS.GG Prediction",
  description: "OWCS Champions Clash Pick'em & Prediction Leaderboard",
  icons: {
    icon: "/logos/site/favicon.ico",
    shortcut: "/logos/site/favicon.ico",
  },
  openGraph: {
    title: "OWTICS.GG Prediction",
    description: "OWCS Champions Clash Pick'em & Prediction Leaderboard",
    images: [{ url: "/logos/tournament/champions-clash.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "OWTICS.GG Prediction",
    description: "OWCS Champions Clash Pick'em & Prediction Leaderboard",
    images: ["/logos/tournament/champions-clash.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
