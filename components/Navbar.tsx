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

  const navLinks = [
    { name: 'Consulting', href: '/consulting' },
    { name: 'Software', href: '/software' },
    { name: 'Doctrine', href: '/doctrine' },
    { name: 'Intelligence', href: '/intelligence' },
    { name: 'Protocols', href: '/protocols' },
    { name: 'Research', href: '/research' },
    { name: 'Start', href: '/start' },
  ];

  return (
    <>
      <nav className="border-b border-zinc-800 bg-[#0a0a0c] relative z-50">
        <div className="max-w-4xl mx-auto px-6 py-5 flex justify-between items-center">
          
          {/* Logo */}
          <Link 
            href="/" 
            className="text-white font-light tracking-widest uppercase text-sm hover:text-indigo-400 transition-colors z-50"
            onClick={() => setIsOpen(false)}
          >
            Maha Strategies
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6 text-[10px] text-gray-400 font-mono tracking-widest uppercase">
            {navLinks.map((link) => (
              <Link key={link.name} href={link.href} className="hover:text-white transition-colors">
                {link.name}
              </Link>
            ))}
            <a 
              href="https://publish.mahastrategies.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-white transition-colors text-zinc-500"
            >
              Publishing Node ↗
            </a>
          </div>

          {/* Mobile Navigation Toggle */}
          <button 
            onClick={toggleMenu}
            className="md:hidden font-mono text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white transition-colors z-50 focus:outline-none"
          >
            {isOpen ? '[ CLOSE ]' : '[ MENU ]'}
          </button>
        </div>
      </nav>

      {/* Mobile Full-Screen Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-[#0a0a0c] pt-24 px-6 md:hidden flex flex-col h-[100dvh] overflow-y-auto">
          <div className="flex flex-col gap-6 text-sm text-zinc-400 font-mono tracking-widest uppercase mt-8">
            {navLinks.map((link) => (
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