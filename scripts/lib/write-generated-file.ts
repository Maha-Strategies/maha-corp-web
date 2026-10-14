import { renameSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

/** Complete generated replacements only; never use for immutable capture records. */
export function writeGeneratedFile(path: string, contents: string): void {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporaryPath, contents, { flag: 'wx' })
    renameSync(temporaryPath, path)
  } finally { rmSync(temporaryPath, { force: true }) }
}
