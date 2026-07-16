"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

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

  const primaryLinks = [
    { name: 'Consulting', href: '/consulting' },
    { name: 'Intelligence', href: '/intelligence' },
    { name: 'Method', href: '/method' },
    { name: 'Auditor', href: '/audit' },
    { name: 'Contact', href: '/contact' },
  ];

  const exploreLinks = [
    { name: 'The Synthetic Self', href: '/books/the-synthetic-self' },
    { name: 'The Unfinished Species', href: '/books/the-unfinished-species' },
    { name: 'MPS Standard', href: '/mps' },
    { name: 'Research', href: '/research' },
    { name: 'Policy', href: '/policy' },
    { name: 'Doctrine', href: '/doctrine' },
    { name: 'Protocols', href: '/protocols' },
    { name: 'Maha OS', href: '/software' },
    { name: 'Cognitive Gateway', href: '/research/mcp' },
    { name: 'Personal Protocols', href: '/start' },
  ];

  return (
    <>
      <nav className="border-b border-zinc-800 bg-[#0a0a0c] relative z-50">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          
          {/* Logo */}
          <Link 
            href="/" 
            className="text-white font-light tracking-widest uppercase text-sm hover:text-indigo-400 transition-colors z-50"
            onClick={() => setIsOpen(false)}
          >
            Maha Strategies
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden xl:flex items-center gap-6 text-[10px] text-gray-400 font-mono tracking-widest uppercase">
            {primaryLinks.map((link) => (
              <Link key={link.name} href={link.href} className="hover:text-white transition-colors">
                {link.name}
              </Link>
            ))}
            <details className="relative">
              <summary className="list-none cursor-pointer hover:text-white transition-colors">Explore +</summary>
              <div className="absolute right-0 top-6 w-52 border border-zinc-800 bg-[#0a0a0c] p-3 shadow-2xl">
                {exploreLinks.map((link) => (
                  <Link key={link.name} href={link.href} className="block px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors">
                    {link.name}
                  </Link>
                ))}
                <a href="https://publish.mahastrategies.com" target="_blank" rel="noopener noreferrer" className="block px-3 py-2 text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors">
                  Publishing Node ↗
                </a>
              </div>
            </details>
          </div>

          {/* Mobile Navigation Toggle */}
          <button 
            onClick={toggleMenu}
            className="xl:hidden font-mono text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white transition-colors z-50 focus:outline-none"
          >
            {isOpen ? '[ CLOSE ]' : '[ MENU ]'}
          </button>
        </div>
      </nav>

      {/* Mobile Full-Screen Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-[#0a0a0c] pt-24 px-6 xl:hidden flex flex-col h-[100dvh] overflow-y-auto">
          <div className="flex flex-col gap-6 text-sm text-zinc-400 font-mono tracking-widest uppercase mt-8">
            {primaryLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={toggleMenu}
                className="hover:text-white transition-colors border-b border-zinc-900 pb-4"
              >
                {link.name}
              </Link>
            ))}
            <p className="pt-4 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">Explore</p>
            {exploreLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href} 
                onClick={toggleMenu}
                className="hover:text-white transition-colors border-b border-zinc-900 pb-4"
              >
                {link.name}
              </Link>
            ))}
            <a 
              href="https://publish.mahastrategies.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={toggleMenu}
              className="hover:text-white transition-colors text-zinc-500 border-b border-zinc-900 pb-4 flex justify-between items-center"
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
