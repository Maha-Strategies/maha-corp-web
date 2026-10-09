import { test } from 'node:test'
import assert from 'node:assert/strict'
import { atlasTopics, atlasSources, filterTopics } from '../lib/unfinished-atlas.ts'
import { getUnfinishedSpeciesSection } from '../lib/unfinished-species.ts'
import { retrieveAtlasContext, sourceGuide, handleAtlasCompanion } from '../lib/unfinished-atlas-companion.ts'

function request(body: unknown, headers: Record<string,string> = {}) {
  return new Request('https://example.test/api/unfinished-species/companion',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})
}
test('every brief has real chapter and source references, and visible evidence boundaries', () => {
  assert.equal(atlasTopics.length,10)
  assert.equal(new Set(atlasTopics.map(topic => topic.slug)).size,10)
  for (const topic of atlasTopics) {
    assert.ok(getUnfinishedSpeciesSection(topic.chapter))
    for (const source of topic.sources) assert.match(atlasSources[source].url,/^https:\/\//)
    for (const field of ['established','inferred','speculative','boundary','next'] as const) assert.ok(topic[field].length > 30)
  }
  assert.ok(filterTopics('crispr').some(topic => topic.slug === 'gene-editing'))
  assert.ok(filterTopics('', 'Model','Speculative').every(topic => topic.category === 'Model' && topic.register === 'Speculative'))
  assert.equal(filterTopics('', 'All', 'All',['epigenetics']).length,1)
})
test('retrieval finds relevant sources without inventing evidence for an unmatched question', () => {
  const proteins = retrieveAtlasContext('What can AlphaFold do with protein structure?')
  assert.equal(proteins.topics[0].slug,'protein-structure')
  assert.ok(proteins.sources.some(source => source.url.includes('s41586-024-07487-w')))
  const guide = sourceGuide('Does epigenetics rewrite DNA?')
  assert.equal(guide.mode,'source-guide')
  assert.match(guide.answer,/thoughts can rewrite DNA/)
  assert.ok(guide.sources.some(source => source.excerpt))
  assert.equal(sourceGuide('xyzzy quux gobbledygook').sources.length,0)
  assert.match(sourceGuide('xyzzy quux gobbledygook').answer,/could not find/)
})
test('source-guide works without providers and does not invoke generation', async () => {
  const response = await handleAtlasCompanion(request({question:'protein folding',mode:'source-guide'}),{generate:async () => { throw new Error('must not generate') }})
  assert.equal(response.status,200)
  assert.equal((await response.json()).mode,'source-guide')
  assert.match(response.headers.get('cache-control') || '',/no-store/)
})
test('bad bodies, oversized payloads, invalid topics and cross-origin requests are rejected', async () => {
  for (const body of [null, [], {question:'',mode:'source-guide'}, {question:'a'.repeat(1501),mode:'source-guide'}, {question:'protein',mode:'source-guide',topic:'missing'}, {question:'protein',mode:'other'}]) assert.equal((await handleAtlasCompanion(request(body))).status,400)
  assert.equal((await handleAtlasCompanion(request({question:'a'.repeat(9000),mode:'source-guide'}))).status,413)
  assert.equal((await handleAtlasCompanion(request({question:'protein',mode:'source-guide'},{Origin:'https://other.test'}))).status,403)
  assert.equal((await handleAtlasCompanion(request({question:'protein',mode:'source-guide'},{Origin:'https://public.test',Host:'public.test'}))).status,200)
  assert.equal((await handleAtlasCompanion(request({question:'protein',mode:'source-guide'},{Origin:'null'}))).status,403)
  const malformed = new Request('https://example.test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'})
  assert.equal((await handleAtlasCompanion(malformed)).status,400)
  const notJson = new Request('https://example.test/api',{method:'POST',body:'protein'})
  assert.equal((await handleAtlasCompanion(notJson)).status,415)
})
test('AI mode enforces consent, configuration and capacity before generation', async () => {
  const body = {question:'protein folding',mode:'ai',consent:true}
  assert.equal((await handleAtlasCompanion(request({...body,consent:false}),{enabled:() => true})).status,400)
  assert.equal((await handleAtlasCompanion(request(body),{enabled:() => false})).status,503)
  assert.equal((await handleAtlasCompanion(request(body),{enabled:() => true,reserve:async () => false,generate:async () => {throw new Error('must not generate')}})).status,429)
  assert.equal((await handleAtlasCompanion(request(body),{enabled:() => true,reserve:async () => {throw new Error('unavailable')},generate:async () => 'unused'})).status,503)
  const success = await handleAtlasCompanion(request(body),{enabled:() => true,reserve:async () => true,generate:async (_question,context) => 'A structural hypothesis [1]. ' + context.topics[0].boundary})
  assert.equal(success.status,200)
  assert.equal((await success.json()).mode,'ai-generated')
  assert.equal((await handleAtlasCompanion(request({...body,question:'quux xyzzy'}),{enabled:() => true})).status,422)
})
