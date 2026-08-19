"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteThemeForPath } from '@/lib/site-theme';

export default function Navbar() {
  const pathname = usePathname();
  const theme = siteThemeForPath(pathname);
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen((open) => !open);

  // Prevent scrolling when the mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const primaryLinks = [
    { name: 'Evidence Audit', href: '/evidence-audit' },
    { name: 'Intelligence', href: '/intelligence' },
    { name: 'Knowledge', href: '/knowledge' },
    { name: 'Books', href: '/books' },
    { name: 'Apps', href: '/apps' },
    { name: 'Method', href: '/method' },
    { name: 'Auditor', href: '/audit' },
    { name: 'Developers', href: '/developers' },
    { name: 'Contact', href: '/contact' },
  ];

  const exploreLinks = [
    { name: 'Tools & API', href: '/tools' },
    { name: 'Developer Infrastructure', href: '/developers' },
    { name: 'About Maha', href: '/about' },
    { name: 'Celestial Reports', href: '/reports/celestial' },
    { name: 'MPS Standard', href: '/mps' },
    { name: 'Timing Board', href: '/operations/timing' },
    { name: 'Research', href: '/research' },
    { name: 'Case Studies', href: '/case-studies' },
    { name: 'Insights', href: '/insights' },
    { name: 'Policy', href: '/policy' },
    { name: 'Doctrine', href: '/doctrine' },
    { name: 'Protocols', href: '/protocols' },
    { name: 'Overclock Game', href: '/overclock' },
    { name: 'Maha OS', href: '/software' },
    { name: 'Cognitive Gateway', href: '/research/mcp' },
    { name: 'Enterprise MCP Gateway', href: '/enterprise-mcp-gateway' },
    { name: 'Context Compiler', href: '/context-compiler' },
    { name: 'WSO2 Gateway Integration', href: '/integrations/wso2' },
    { name: 'Context Pack Evaluator', href: '/context-pack-evaluator' },
    { name: 'Maha Navigator', href: '/navigator' },
    { name: 'x402 Conformance Observatory', href: '/x402-observatory' },
    { name: 'x402 Buyer Policy', href: '/x402-buyer-policy' },
    { name: 'Personal Protocols', href: '/start' },
  ];

  return (
    <>
      <nav data-theme={theme} className="site-chrome relative z-50 border-b border-[var(--chrome-border)] bg-[var(--chrome-surface)] text-[var(--chrome-text)] backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          
          {/* Logo */}
          <Link 
            href="/" 
            className="font-editorial z-50 text-base font-semibold tracking-[0.08em] uppercase text-[var(--chrome-text)] transition-opacity hover:opacity-65"
            onClick={() => setIsOpen(false)}
          >
            Maha Strategies
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden xl:flex items-center gap-5 text-[11px] text-[var(--chrome-muted)] font-mono tracking-[0.08em] uppercase">
            {primaryLinks.map((link) => (
              <Link key={link.name} href={link.href} className="hover:text-[var(--chrome-text)] transition-colors">
                {link.name}
              </Link>
            ))}
            <details className="relative">
              <summary className="list-none cursor-pointer hover:text-[var(--chrome-text)] transition-colors">Explore +</summary>
              <div className="absolute right-0 top-6 w-56 border border-[var(--chrome-border)] bg-[var(--chrome-surface)] p-3 shadow-xl">
                {exploreLinks.map((link) => (
                  <Link key={link.name} href={link.href} className="block px-3 py-2 text-[var(--chrome-muted)] hover:text-[var(--chrome-text)] hover:bg-[var(--chrome-hover)] transition-colors">
                    {link.name}
                  </Link>
                ))}
                <a href="https://publish.mahastrategies.com" target="_blank" rel="noopener noreferrer" className="block px-3 py-2 text-[var(--chrome-muted)] hover:text-[var(--chrome-text)] hover:bg-[var(--chrome-hover)] transition-colors">
                  Publishing Node ↗
                </a>
              </div>
            </details>
          </div>

          {/* Mobile Navigation Toggle */}
          <button 
            type="button"
            onClick={toggleMenu}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="xl:hidden font-mono text-xs uppercase tracking-widest text-[var(--chrome-muted)] hover:text-[var(--chrome-text)] transition-colors z-50"
          >
            {isOpen ? '[ CLOSE ]' : '[ MENU ]'}
          </button>
        </div>
      </nav>

      {/* Mobile Full-Screen Overlay */}
      {isOpen && (
        <div data-theme={theme} id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Primary navigation" className="site-chrome fixed inset-0 z-40 bg-[var(--chrome-surface)] pt-24 px-6 xl:hidden flex flex-col h-[100dvh] overflow-y-auto text-[var(--chrome-text)]">
          <div className="flex flex-col gap-6 text-sm text-[var(--chrome-muted)] font-mono tracking-widest uppercase mt-8">
            {primaryLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={toggleMenu}
                className="hover:text-[var(--chrome-text)] transition-colors border-b border-[var(--chrome-border)] pb-4"
              >
                {link.name}
              </Link>
            ))}
            <p className="pt-4 font-mono text-xs text-[var(--chrome-muted)] uppercase tracking-widest">Explore</p>
            {exploreLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href} 
                onClick={toggleMenu}
                className="hover:text-[var(--chrome-text)] transition-colors border-b border-[var(--chrome-border)] pb-4"
              >
                {link.name}
              </Link>
            ))}
            <a 
              href="https://publish.mahastrategies.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={toggleMenu}
              className="hover:text-[var(--chrome-text)] transition-colors text-[var(--chrome-muted)] border-b border-[var(--chrome-border)] pb-4 flex justify-between items-center"
            >
              <span>Publishing Node</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      )}
    </>
  );
}
