import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import { mahaEntityGraphJsonLd } from '@/lib/entity';
import "./globals.css";

// FIXED: Removed the invalid backslashes from string literals
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="alternate" type="application/atom+xml" title="Maha Strategies — Intelligence & Explainers" href="/feed.xml" />
        <script 
          type="application/ld+json" 
          dangerouslySetInnerHTML={{ __html: JSON.stringify(mahaEntityGraphJsonLd).replace(/</g, '\\u003c') }}
        />
      </head>
      <body className="bg-[#0a0a0c] text-[#e0e0e0] h-full flex flex-col antialiased">
        <Navbar />
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
