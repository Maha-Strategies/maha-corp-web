import { buildBookPublications, BOOK_PUBLICATIONS_PATH, BOOK_PUBLICATIONS_SCHEMA_PATH } from '../../../lib/book-publications.ts'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(buildBookPublications(), {
    headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      Link: `<${BOOK_PUBLICATIONS_SCHEMA_PATH}>; rel="describedby", <${BOOK_PUBLICATIONS_PATH}>; rel="alternate"; type="text/html"`,
    },
  })
}
