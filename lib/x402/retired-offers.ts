/** Exact retired experiment identities; never a prefix or a zero-usage heuristic. */
export const RETIRED_X402_PRODUCTS = Object.freeze([
  { id: 'book-edition-the-imagined-life', path: '/api/v1/books/the-imagined-life/edition', previousAmount: '3000000', replacement: '/api/v1/books/the-imagined-life/section' },
  { id: 'book-edition-the-volcanic-engine', path: '/api/v1/books/the-volcanic-engine/edition', previousAmount: '3500000', replacement: '/api/v1/books/the-volcanic-engine/section' },
])
export const retiredProductForPath = (path: string) => RETIRED_X402_PRODUCTS.find(product => product.path === path)
export function retiredProductResponse(path: string) {
  const retired = retiredProductForPath(path)
  if (!retired) throw new Error('unknown_retired_product')
  return Response.json({ error: { code: 'product_retired', message: 'This whole-book pricing experiment has ended. Do not sign or submit a payment for this URL.' },
    productId: retired.id, replacement: retired.replacement, catalogue: '/developers/x402-products', paymentAccepted: false },
  { status: 410, headers: { 'Cache-Control': 'no-store' } })
}
