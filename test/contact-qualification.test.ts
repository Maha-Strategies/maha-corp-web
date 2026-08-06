import assert from 'node:assert/strict'
import test from 'node:test'

import { contactSourcePath, isLikelyCommercialSolicitation, optionalCampaignValue, parseContactReferralSource } from '../lib/contact-qualification.ts'

test('contact qualification captures bounded, non-identifying source metadata', () => {
  assert.equal(parseContactReferralSource('developer_directory'), 'developer_directory')
  assert.equal(parseContactReferralSource('unknown-network'), 'other')
  assert.equal(optionalCampaignValue('mcp-directory-july', 'utmCampaign'), 'mcp-directory-july')
  assert.throws(() => optionalCampaignValue('https://example.com/?email=a@example.com', 'utmCampaign'), /utmCampaign/)
  assert.equal(contactSourcePath('/contact'), '/contact')
  assert.equal(contactSourcePath('/evidence-audit'), '/evidence-audit')
  assert.equal(contactSourcePath('/other'), '/contact')
})

test('generic agency SEO pitches are screened out while a buyer request remains eligible', () => {
  assert.equal(isLikelyCommercialSolicitation({ question: 'We specialize in improving your visibility and traffic on search engines. Share your target keywords and we will send a full proposal.' }), true)
  assert.equal(isLikelyCommercialSolicitation({ question: 'Can you audit the citations in a manuscript before publication?', context: 'We need a claim-level review for a research report.' }), false)
})
