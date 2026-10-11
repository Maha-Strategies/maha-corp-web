import { BOOK_PUBLICATIONS_DATE, type BookPublication } from '@/lib/book-publications'

export default function BookPublicationDetails({ book }: { book: BookPublication }) {
  return (
    <section id={book.slug} className="evidence-section scroll-mt-24" aria-label={`${book.title} published editions`}>
      <p className="evidence-kicker">Published editions · Mayone Maha Rajan</p>
      <h2 className="evidence-card-title mt-4">{book.title}</h2>
      <p className="evidence-copy mt-2">{book.subtitle}</p>
      <p className="evidence-copy mt-5">{book.description}</p>
      <p className="evidence-copy mt-4">{book.evidenceBoundary}</p>
      <ul className="mt-6 space-y-4">
        {book.editions.map((edition) => (
          <li key={edition.id} className="evidence-copy">
            <strong>{edition.platform} {edition.format === 'ebook' ? 'ebook' : 'paperback'}</strong>
            {' — '}{edition.statusLabel}.
            {edition.isbn && <span> ISBN {edition.isbn}.</span>}
            {edition.asin && <span> ASIN {edition.asin}.</span>}
            {edition.url && <a href={edition.url} className="evidence-link ml-2">{edition.platform === 'Amazon' ? 'Amazon listing' : 'Retailer links'} ↗</a>}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm text-[var(--text-secondary)]">Publisher status checked {BOOK_PUBLICATIONS_DATE}. Store availability varies by country; submissions remain pending until approved.</p>
      <ul className="mt-6 space-y-3">
        {book.relatedResources.map((resource) => (
          <li key={resource.url} className="evidence-copy"><a href={resource.url} className="evidence-link">{resource.title} ↗</a><span className="block mt-1 text-sm">{resource.relationship}</span></li>
        ))}
      </ul>
      {book.openWebEdition && <p className="evidence-copy mt-5"><a href={book.openWebEdition.url} className="evidence-link">Read the open web edition ↗</a> The web edition is a separate version; retailer editions may contain revisions.</p>}
    </section>
  )
}
