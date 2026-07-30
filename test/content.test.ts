import assert from 'node:assert/strict'
import test from 'node:test'

import { chunkMarkdown, parseMarkdownBlocks, readBookAst, readBookMarkdown } from '../lib/content.ts'

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
})

test('parseMarkdownBlocks maps headings, paragraphs, lists, and rules', () => {
  const md = [
    '# Title',
    '',
    '## Section',
    'First line',
    'joined with second.',
    '',
    '- item one',
    '- item **two**',
    '',
    '---',
    '',
    'A closing *paragraph*.',
  ].join('\n')

  const blocks = parseMarkdownBlocks(md)
  assert.deepEqual(blocks[0], { type: 'heading', level: 1, text: 'Title' })
  assert.deepEqual(blocks[1], { type: 'heading', level: 2, text: 'Section' })
  assert.deepEqual(blocks[2], { type: 'paragraph', text: 'First line joined with second.' })
  assert.deepEqual(blocks[3], { type: 'list', items: ['item one', 'item **two**'] })
  assert.deepEqual(blocks[4], { type: 'hr' })
  assert.deepEqual(blocks[5], { type: 'paragraph', text: 'A closing *paragraph*.' })
})

test('parseMarkdownBlocks can skip the leading H1 (page header shows the title)', () => {
  const blocks = parseMarkdownBlocks('# Duplicate Title\n\nBody.', { skipFirstH1: true })
  assert.equal(blocks.find((b) => b.type === 'heading' && b.text === 'Duplicate Title'), undefined)
  assert.deepEqual(blocks[0], { type: 'paragraph', text: 'Body.' })
})

test('parseMarkdownBlocks on the real book yields many blocks with no raw heading markers', () => {
  const md = readBookMarkdown('the-imagined-life')
  assert.ok(md)
  const blocks = parseMarkdownBlocks(md, { skipFirstH1: true })
  assert.ok(blocks.length > 100)
  assert.ok(blocks.some((b) => b.type === 'heading'))
  assert.ok(blocks.some((b) => b.type === 'paragraph'))
  // No block text should still contain a leading '#' heading marker.
  assert.ok(!blocks.some((b) => (b.type === 'paragraph' || b.type === 'heading') && /^#/.test(b.text)))
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
