import React from "react";
import { Geist, Geist_Mono } from "next/font/google";

const b_sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const b_mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export default function WhitepaperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${b_sans.variable} ${b_mono.variable} antialiased bg-[#0a0a0c]`}>
      {children}
    </div>
  );
}