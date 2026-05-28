import React from 'react';
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="border-b border-zinc-800 bg-[#0a0a0c]">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 flex flex-col md:flex-row justify-between items-center">
        
        <Link href="/" className="text-white font-light tracking-widest uppercase text-sm hover:text-indigo-400">
          Maha Strategies
        </Link>

        <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-3 md:gap-6 text-[10px] sm:text-xs text-gray-400 font-mono tracking-widest uppercase">
          <Link href="/consulting" className="hover:text-white transition-colors">Consulting</Link>
          <Link href="/software" className="hover:text-white transition-colors">Software</Link>
          <Link href="/doctrine" className="hover:text-white transition-colors">Doctrine</Link>
          <Link href="/intelligence" className="text-indigo-400 hover:text-white transition-colors font-bold">Intelligence</Link>
          <Link href="/protocols" className="hover:text-white transition-colors">Protocols</Link>
          <Link href="/research" className="hover:text-white transition-colors">Research</Link>
          <Link href="/start" className="hover:text-white transition-colors">Start</Link>
          
          <a 
            href="https://publish.mahastrategies.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:text-white transition-colors text-zinc-500"
          >
            Publishing Node ↗
          </a>
        </div>

      </div>
    </nav>
  );
}