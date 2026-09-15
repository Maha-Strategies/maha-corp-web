import { existsSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Lets node's test runner import proxy.ts and route handlers directly.
 *
 * Application modules use the `@/` alias and extensionless relative imports,
 * which only the Next build resolves. This maps both onto files in the
 * repository and leaves every package import to Node. Import this module
 * before dynamically importing the application code under test.
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const isFile = (path: string) => existsSync(path) && statSync(path).isFile()

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/server') return next('next/server.js', context)
    const parent = context.parentURL?.startsWith('file:') ? fileURLToPath(context.parentURL) : ''
    if (parent.includes('/node_modules/')) return next(specifier, context)
    const base = specifier.startsWith('@/')
      ? resolve(ROOT, specifier.slice(2))
      : specifier.startsWith('.') && parent ? resolve(dirname(parent), specifier) : null
    if (base && !isFile(base)) {
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        if (isFile(candidate)) return next(pathToFileURL(candidate).href, context)
      }
    }
    if (base && specifier.startsWith('@/')) return next(pathToFileURL(base).href, context)
    return next(specifier, context)
  },
})
