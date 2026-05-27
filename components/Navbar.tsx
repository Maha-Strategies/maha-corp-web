import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="border-b border-zinc-800 bg-[#0a0a0c]">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-5 md:gap-4">
        <Link href="/" className="text-white font-light tracking-widest uppercase text-sm hover:text-indigo-400 transition-colors text-center">
          Maha Strategies
        </Link>
        <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-3 md:gap-6 text-[10px] sm:text-xs font-semibold tracking-widest uppercase text-zinc-500">
          <Link href="/consulting" className="hover:text-white transition-colors">Consulting</Link>
          <Link href="/software" className="hover:text-white transition-colors">Software</Link>
          <Link href="/doctrine" className="hover:text-white transition-colors">Doctrine</Link>
          <Link href="/protocols" className="hover:text-white transition-colors">Protocols</Link>
          <Link href="/research" className="hover:text-white transition-colors">Research</Link>
          <a href="https://publish.mahastrategies.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-white transition-colors">
            Publishing Node ↗
          </a>
        </div>
      </div>
    </nav>
  )
}