import assert from 'node:assert/strict'
import test from 'node:test'

import { siteThemeForPath } from '../lib/site-theme.ts'

test('public routes use the Evidence Paper shell', () => {
  assert.equal(siteThemeForPath('/'), 'paper')
  assert.equal(siteThemeForPath('/developers'), 'paper')
  assert.equal(siteThemeForPath('/context-compiler'), 'paper')
  assert.equal(siteThemeForPath('/audit'), 'paper')
})

test('operator routes retain their dense operator surface independently of color mode', () => {
  assert.equal(siteThemeForPath('/admin'), 'operator')
  assert.equal(siteThemeForPath('/admin/billing'), 'operator')
  assert.equal(siteThemeForPath('/dashboard'), 'operator')
  assert.equal(siteThemeForPath('/operations/timing'), 'operator')
})

test('similar public route names do not inherit operator mode', () => {
  assert.equal(siteThemeForPath('/administration-guide'), 'paper')
  assert.equal(siteThemeForPath('/dashboard-overview'), 'paper')
})
