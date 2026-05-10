import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Champions Clash – 승부예측",
  description: "Champions Clash 토너먼트 브라켓 승부예측에 참여하고 순위표에서 경쟁하세요.",
  icons: {
    icon: "/logos/site/favicon.ico",
    shortcut: "/logos/site/favicon.ico",
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
