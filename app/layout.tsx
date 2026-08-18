import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { mahaEntityGraphJsonLd } from '@/lib/entity';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: 'Maha Strategies | Verified Research Briefs',
  description: 'Decision-ready research and independent analysis from Maha Strategies.',
  metadataBase: new URL('https://www.mahastrategies.com'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Maha Strategies | Verified Research Briefs',
    description: 'Decision-ready research and independent analysis from Maha Strategies.',
    url: 'https://www.mahastrategies.com',
    siteName: 'Maha Strategies',
    images: [
      {
        url: '/og-master.png',
        width: 1200,
        height: 630,
        alt: 'Maha Strategies LLC - Systemic Sovereignty',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Maha Strategies | Verified Research Briefs',
    description: 'Decision-ready research and independent analysis from Maha Strategies.',
    images: ['/og-master.png'],
  },
  other: {
    'base:app_id': '6a75654b6aef320a4609ad64',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}>
      <head>
        <link rel="alternate" type="application/atom+xml" title="Maha Strategies — Intelligence & Explainers" href="/feed.xml" />
        <link rel="alternate" type="text/plain" title="Maha Strategies machine-readable site guide" href="/llms.txt" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(mahaEntityGraphJsonLd).replace(/</g, '\\u003c') }}
        />
      </head>
      <body className="site-body h-full flex flex-col antialiased">
        <Navbar />
        <div className="flex-1">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
