import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="border-b border-zinc-800 bg-[#0a0a0c]">
      <div className="max-w-4xl mx-auto px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <Link href="/" className="text-white font-light tracking-widest uppercase text-sm hover:text-indigo-400 transition-colors">
          Maha Strategies
        </Link>
        <div className="flex gap-6 text-xs font-semibold tracking-widest uppercase text-zinc-500">
          <Link href="/consulting" className="hover:text-white transition-colors">Consulting</Link>
          <Link href="/software" className="hover:text-white transition-colors">Software</Link>
          <Link href="/doctrine" className="hover:text-white transition-colors">Doctrine</Link>
          <a href="https://publish.mahastrategies.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-white transition-colors">
            Publishing Node ↗
          </a>
        </div>
      </div>
    </nav>
  )
}