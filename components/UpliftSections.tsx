import { upliftFor } from '@/lib/legacy-uplift-runtime'
import { unreadItems } from '@/lib/reader-section-deduplication'

/**
 * Renders the uplift for a legacy page, or nothing.
 *
 * Every item shown here was already stored by the page's own family. Nothing
 * is generated, summarised or rephrased, so a section only appears when there
 * was already something behind it.
 */
export function UpliftSections({ route, alreadyRendered = [] }: { route: string; alreadyRendered?: readonly string[] }) {
  const uplift = upliftFor(route)
  if (!uplift || uplift.sections.length === 0) return null
  const sections = uplift.sections.map((section) => ({ ...section, items: unreadItems(section.items, alreadyRendered) })).filter((section) => section.items.length > 0)
  if (sections.length === 0) return null

  return (
    <div className="mt-14 space-y-10 border-t border-zinc-800 pt-12">
      {sections.map((section) => (
        <section key={`${section.dimension}:${section.heading}`}>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-teal-300">{section.heading}</h2>
          <ul className="mt-4 space-y-3">
            {section.items.map((item) => (
              <li key={item} className="border-l border-zinc-700 pl-3 text-sm leading-6 text-zinc-400">
                {/* Related records are routes. Rendering the raw path would
                    show the reader a string they have to retype. */}
                {section.dimension === 'related-records'
                  ? <a href={item} className="text-teal-300 underline-offset-4 hover:underline">{item}</a>
                  : item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
