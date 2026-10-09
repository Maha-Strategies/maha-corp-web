import { readFile, readdir, stat, mkdir, rename } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve, join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'
import { parse as parseYaml } from 'yaml'

const root = resolve('plugins/maha-context-review')
const manifest = JSON.parse(await readFile(join(root, 'plugin.json'), 'utf8'))
const mcp = JSON.parse(await readFile(join(root, 'mcp.json'), 'utf8'))
const extension = manifest.extensions['com.openai']
if (manifest.name !== 'maha-context-review' || Object.keys(mcp.mcpServers).length !== 1) throw new Error('Unexpected plugin identity/server count.')
if (extension.review.test_cases.positive.length !== 5 || extension.review.test_cases.negative.length !== 3) throw new Error('Review needs five positive and three negative cases.')
if (extension.interface.shortDescription.length > 30) throw new Error('Subtitle exceeds 30 characters.')
const files = []
async function inventory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error('Plugin package cannot contain symlinks.')
    if (entry.isDirectory()) await inventory(path)
    else files.push(relative(root, path))
  }
}
await inventory(root)
const skill = await readFile(join(root, 'skills/context-review/SKILL.md'), 'utf8')
const frontmatter = /^---\n([\s\S]*?)\n---/.exec(skill)
if (!frontmatter) throw new Error('Skill frontmatter is missing.')
const skillMetadata = parseYaml(frontmatter[1])
if (!skillMetadata || typeof skillMetadata.name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillMetadata.name) || skillMetadata.name.length > 64 || typeof skillMetadata.description !== 'string' || !skillMetadata.description.trim() || skillMetadata.description.length > 1024 || /[<>]/.test(skillMetadata.description) || /\[TODO:/.test(skill)) throw new Error('Skill metadata or instructions fail validation.')
if (Object.keys(skillMetadata).some(key => !['name', 'description', 'license', 'allowed-tools', 'metadata'].includes(key))) throw new Error('Unsupported skill frontmatter field.')
const allowed = ['plugin.json', 'mcp.json', 'assets/logo.svg', 'skills/context-review/SKILL.md']
if (files.some(file => !allowed.includes(file)) || files.length !== allowed.length) throw new Error('Unexpected or missing packaged files. Use the explicit allowlist.')
for (const file of files) {
  if ((await stat(join(root, file))).size > 5 * 1024 * 1024) throw new Error('Package asset exceeds 5 MiB.')
  const text = await readFile(join(root, file), 'utf8')
  if (/-----BEGIN .*PRIVATE KEY|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}|\bAKIA[A-Z0-9]{16}\b/.test(text)) throw new Error('Potential secret in package.')
}
for (const path of [extension.interface.logo, extension.interface.composerIcon, extension.onboardingSkill]) {
  if (!path.startsWith('./') || !files.includes(path.slice(2))) throw new Error('Manifest references an absent or unsafe file.')
}
const outputDirectory = resolve('artifacts/openai-marketplace')
await mkdir(outputDirectory, { recursive: true })
const archive = join(outputDirectory, `maha-context-review-${manifest.version}.zip`)
const temporaryArchive = join(outputDirectory, `.context-review-${randomUUID()}.zip`)
// Archives contain only the reviewed allowlist, never the workspace or credentials.
execFileSync('zip', ['-q', temporaryArchive, ...files.sort()], { cwd: root })
await rename(temporaryArchive, archive)
console.log(JSON.stringify({ archive, files: files.sort(), publicSubmissionStatus: 'not_submitted', missing: ['publisher verification', 'live HTTPS deployment and domain challenge', 'ChatGPT desktop/mobile testing', 'review video URL', 'review approval'] }, null, 2))
