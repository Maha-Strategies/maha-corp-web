export const dynamic = 'force-static'
export function GET() {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Maha Strategies — Agent Services</title></head><body>
<h1>Maha Strategies agent services</h1>
<p><a href="/index.json">Service menu (index.json)</a></p>
<p><a href="/.well-known/carp/seller.json">Seller profile</a> · <a href="/api/discovery/carp/catalog">Product catalogue</a></p>
<p>Discovery is free. Digital products use x402 under a separately approved budget and the live payment challenge. Physical listings are enquiry-only, not purchasable.</p>
</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } })
}
