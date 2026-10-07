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
  title: "Raven — what's happening on Solana",  description:
    "Raven watches the chain so you don't have to. Live graduations, trade flow, and wallet signals on Solana.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: {
    title: "Raven — what's happening on Solana",
    description:
      "Raven watches the chain so you don't have to. Live graduations, trade flow, and wallet signals.",
    url: siteUrl,
    siteName: "Raven",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Raven" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Raven — what's happening on Solana",
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
      suppressHydrationWarning
    >
      {/* Set the theme class before first paint — avoids a dawn/night flash. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('raven-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
        }}
      />
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
