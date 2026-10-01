import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://raven-hood.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  themeColor: "#fffdf7",
  title: "Raven — what's happening on Robinhood Chain",  description:
    "Raven watches the chain so you don't have to. Live graduations, trade flow, and wallet signals on Robinhood Chain.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: {
    title: "Raven — what's happening on Robinhood Chain",
    description:
      "Raven watches the chain so you don't have to. Live graduations, trade flow, and wallet signals.",
    url: siteUrl,
    siteName: "Raven",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Raven" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Raven — what's happening on Robinhood Chain",
    description: "Raven watches the chain so you don't have to.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
