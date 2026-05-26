import type { Metadata } from 'next'
import './globals.css'

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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
    <html lang="en" className="h-full antialiased">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(corporateEntityGraph) }} />
      </head>
      <body className="min-h-full flex flex-col bg-[#0a0a0c]">{children}</body>
    </html>
  )
}
