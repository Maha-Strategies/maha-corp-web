import type { ObservatoryResource } from './observatory.ts'
import { validateObservatoryResources } from './observatory.ts'

/**
 * Reviewable public allowlist. Adding a resource requires a pull request and a
 * stable HTTPS endpoint. This prevents the scheduled runner becoming an SSRF
 * primitive or an anonymous general-purpose scanner.
 *
 * Paid checks are false unless the resource operator explicitly opts in and a
 * reviewer supplies a hard base-unit ceiling through a separate secret-backed
 * runner. The default observatory sweep is entirely read-only.
 */
export const PUBLIC_X402_OBSERVATORY_RESOURCES: ObservatoryResource[] = [
  {
    id: 'maha-context-compiler',
    name: 'Maha Context Compiler',
    url: 'https://www.mahastrategies.com/api/v1/compress',
    operator: 'Maha Strategies LLC',
    request: { method: 'POST' },
    boundedSettlement: { enabled: false },
  },
]

validateObservatoryResources(PUBLIC_X402_OBSERVATORY_RESOURCES)
