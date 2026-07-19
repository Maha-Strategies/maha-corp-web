import assert from 'node:assert/strict'
import test from 'node:test'

import { chunkMarkdown, readBookAst, readBookMarkdown } from '../lib/content.ts'

test('chunkMarkdown splits at H1/H2 boundaries and captures bodies', () => {
  const markdown = [
    '# The Imagined Life',
    '',
    'Opening line.',
    '',
    '## Contents',
    'a · b · c',
    '',
    '# Chapter 1 — What Happens',
    'The measurable architecture of sleep.',
    '### deeper heading stays in body',
    'more text',
  ].join('\n')

  const { title, chunks } = chunkMarkdown(markdown)
  assert.equal(title, 'The Imagined Life')
  assert.equal(chunks.length, 3)
  assert.equal(chunks[0].depth, 1)
  assert.equal(chunks[0].heading, 'The Imagined Life')
  assert.equal(chunks[0].content, 'Opening line.')
  assert.equal(chunks[1].depth, 2)
  assert.equal(chunks[1].anchor, 'contents')
  assert.equal(chunks[2].heading, 'Chapter 1 — What Happens')
  assert.match(chunks[2].content, /deeper heading stays in body/) // H3 is not a split point
  assert.ok(chunks[2].wordCount > 0)
})

test('readBookMarkdown rejects unknown and path-traversal slugs', () => {
  assert.equal(readBookMarkdown('not-a-book'), null)
  assert.equal(readBookMarkdown('../../etc/passwd'), null)
  assert.equal(readBookMarkdown('the-orbital-mind'), null) // known book, but no master file at the canonical path
})

test('readBookAst reads the real launch book end-to-end', () => {
  const ast = readBookAst('the-imagined-life')
  assert.ok(ast, 'the-imagined-life master markdown should be readable')
  assert.equal(ast.slug, 'the-imagined-life')
  assert.equal(ast.title, 'The Imagined Life')
  assert.ok(ast.chunkCount > 10, 'the book should chunk into many sections')
  assert.equal(ast.chunkCount, ast.chunks.length)
  assert.ok(ast.chunks.every((chunk) => chunk.depth === 1 || chunk.depth === 2))
})
