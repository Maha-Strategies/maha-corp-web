import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
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
  title: 'Maha Strategies LLC | Systemic Sovereignty',
  description: 'Foundational frameworks and strategic research equipping elite actors to resist narrative capture and defend their cognitive baseline.',
  metadataBase: new URL('https://www.mahastrategies.com'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Maha Strategies LLC',
    description: 'The architecture of independence. Cognitive defense and custom silicon infrastructure.',
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
    title: 'Maha Strategies LLC',
    description: 'The architecture of independence. Cognitive defense and custom silicon infrastructure.',
    images: ['/og-master.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // UNIFIED MASTER SCHEMA ENGINE
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.mahastrategies.com/#organization",
        "name": "Maha Strategies LLC",
        "url": "https://www.mahastrategies.com",
        "logo": "https://www.mahastrategies.com/logo.png",
        "sameAs": []
      },
      {
        "@type": "Person",
        "@id": "https://www.mayonemaharajan.com/#person",
        "name": "Mayone Maha Rajan",
        "url": "https://www.mayonemaharajan.com",
        "jobTitle": "Managing Director",
        "worksFor": {
          "@id": "https://www.mahastrategies.com/#organization"
        }
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://www.mahastrategies.com/#software",
        "name": "Maha OS: Sovereign Ecosystem",
        "applicationCategory": "HealthAndFitnessApplication",
        "operatingSystem": "Android",
        "url": "https://play.google.com/store/apps/details?id=com.maha.os",
        "author": {
          "@id": "https://www.mahastrategies.com/#organization"
        }
      },
      {
        "@type": "Book",
        "@id": "https://www.mahastrategies.com/#book",
        "name": "The Maha Principle: Reclaiming Biological Sovereignty",
        "author": {
          "@id": "https://www.mayonemaharajan.com/#person"
        },
        "publisher": {
          "@id": "https://www.mahastrategies.com/#organization"
        },
        "numberOfPages": 300,
        "wordCount": 81015,
        "url": "https://publish.mahastrategies.com"
      }
    ]
  };

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script 
          type="application/ld+json" 
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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