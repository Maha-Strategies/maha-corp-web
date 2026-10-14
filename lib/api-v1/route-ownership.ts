import paths from '../../content/api-v1/route-ownership.json' with { type: 'json' }
const paidPaths = new Set(paths)
const freePaths = new Set(['/api/v1/discovery/search', '/api/v1/discovery/describe'])
export function ownsModularApiPath(path: string) {
  return paidPaths.has(path) || freePaths.has(path) || /^\/api\/v1\/mcp\/(context|verify|compute|celestial|intel|library)$/.test(path)
}
