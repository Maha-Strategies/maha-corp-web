import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

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
  description: 'Securing autonomy across the modern stack. AI hardware consulting, sovereign digital infrastructure, and agentic publishing.',
  alternates: { canonical: 'https://www.mahastrategies.com' },
  openGraph: {
    title: 'Maha Strategies LLC | Systemic Sovereignty',
    description: 'Securing autonomy across the modern stack. Architecting infrastructure, interface, and intellect.',
    url: 'https://www.mahastrategies.com',
    siteName: 'Maha Strategies LLC',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Maha Strategies LLC | Systemic Sovereignty',
    description: 'Securing autonomy across the modern stack.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  // The Master Corporate Entity Graph
  const corporateEntityGraph = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Maha Strategies LLC",
    "url": "https://www.mahastrategies.com",
    "description": "A research and engineering firm specializing in AI hardware consulting, sovereign digital infrastructure, and cognitive defense software.",
    "founder": {
      "@type": "Person",
      "name": "Mayone Maha Rajan",
      "jobTitle": "Managing Director"
    },
    "brand": [
      {
        "@type": "Brand",
        "name": "Agentic Book Publishing",
        "url": "https://publish.mahastrategies.com"
      },
      {
        "@type": "SoftwareApplication",
        "name": "Maha OS: Sovereign Ecosystem",
        "applicationCategory": "HealthAndFitnessApplication",
        "operatingSystem": "Android"
      }
    ]
  };

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(corporateEntityGraph) }} />
        <script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://www.mahastrategies.com/#organization",
          "name": "Maha Strategies LLC",
          "url": "https://www.mahastrategies.com",
          "founder": {
            "@id": "https://www.mahastrategies.com/#founder"
          }
        },
        {
          "@type": "Person",
          "@id": "https://www.mahastrategies.com/#founder",
          "name": "Mayone Maha Rajan",
          "jobTitle": "Managing Director",
          "worksFor": {
            "@id": "https://www.mahastrategies.com/#organization"
          }
        },
        {
          "@type": "Book",
          "@id": "https://www.mahastrategies.com/#book",
          "name": "The Maha Principle",
          "alternativeHeadline": "Reclaiming Biological Sovereignty",
          "author": {
            "@id": "https://www.mahastrategies.com/#founder"
          },
          "numberOfPages": 320,
          "wordCount": 81015,
          "url": "https://publish.mahastrategies.com",
          "publisher": {
            "@id": "https://www.mahastrategies.com/#organization"
          }
        }
      ]
    })
  }}
/>
      </head>
      <body className="min-h-full flex flex-col bg-[#0a0a0c]">
        <Navbar />
        <main className="flex-grow">
          {children}
        </main>
      </body>
    </html>
  );
}