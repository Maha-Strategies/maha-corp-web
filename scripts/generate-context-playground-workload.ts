import { readFile, writeFile } from 'node:fs/promises'

const sources = [
  { id: 'borrowed-light-ch1', title: 'The Borrowed Light — Chapter 1', path: '../content/books/the-borrowed-light/chapter-1.md' },
  { id: 'unfinished-species-ch1', title: 'The Unfinished Species — Chapter 1', path: '../content/books/the-unfinished-species/chapter-1.md' },
  { id: 'orbital-mind-ch1', title: 'The Orbital Mind — Chapter 1', path: '../content/books/the-orbital-mind/chapter-1.md' },
  { id: 'imagined-life-ch1', title: 'The Imagined Life — Chapter 1', path: '../content/books/the-imagined-life/chapter-1.md' },
] as const

const documents = await Promise.all(sources.map(async (source) => ({
  id: source.id,
  title: source.title,
  text: await readFile(new URL(source.path, import.meta.url), 'utf8'),
})))

const destination = new URL('../content/recipes/context-compiler-playground-workload.json', import.meta.url)
await writeFile(destination, `${JSON.stringify(documents, null, 2)}\n`, 'utf8')
console.log(`Generated ${documents.length} playground documents at ${destination.pathname}.`)
