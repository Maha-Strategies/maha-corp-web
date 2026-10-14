import { endpointByRoute } from './endpoints.registry.ts'
import { productionEndpointByRoute } from './production-release.ts'
import { apiFailure, API_HEADERS, with402Payment, type PaymentDependencies } from './with402Payment.ts'
export function createEndpointRouter(dependencies: PaymentDependencies = {}) {
  const routes = new Map<string, ReturnType<typeof with402Payment>>()
  return (request: Request) => {
    const env = dependencies.environment ?? process.env
    const local = ['test', 'development'].includes(env.NODE_ENV ?? '') && !env.VERCEL && !env.VERCEL_ENV
    const u = new URL(request.url), e = (local ? endpointByRoute : productionEndpointByRoute)(request.method, u.pathname)
    if (!e) return Promise.resolve(apiFailure('unknown_endpoint_or_method', 404))
    let handler = routes.get(e.id)
    // The gateway constructs the handler with the registry amount. An omitted
    // price must never fall back to a legacy price or break a new typed adapter.
    if (!handler) { handler = with402Payment(e, undefined, dependencies); routes.set(e.id, handler) }
    return handler(request)
  }
}
export const dispatchEndpoint = createEndpointRouter()
export const endpointOptions = () => new Response(null, { status: 204, headers: API_HEADERS })
