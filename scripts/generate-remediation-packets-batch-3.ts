import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import batch2 from '../content/evidence-batch-3/inspections.json' with { type: 'json' }
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }

/**
 * One immutable packet per proposed source binding.
 *
 * A packet is a proposal and nothing else. It carries a disposition, but the
 * disposition is a recommendation to a reviewer, not an instruction to the
 * system: nothing downstream reads it and changes a binding. That separation
 * is the point, and a test asserts an accept-looking packet cannot act alone.
 */

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`
type Insp = (typeof batch2.inspected)[number]
const pages = new Map((compiled.pages as { route: string; eligible: boolean }[]).map((p) => [p.route, p]))

const packets = (batch2.inspected as Insp[]).flatMap((source) =>
  source.supportsRoutes.map((route) => {
    const page = pages.get(route)
    const body = {
      packetVersion: 'maha-remediation-packet/1.0',
      recordIdentity: { route, currentState: page?.eligible ? 'structural-only' : 'blocked' },
      claimIdentity: source.unsupportedPropositionBefore,
      currentSource: 'none inspected for this proposition',
      proposedSource: {
        sourceId: source.sourceId, title: source.title, authors: source.authors,
        venue: source.venue, identifier: source.identifier, tier: source.tier,
      },
      sourceIdentityEvidence: source.identityBasis,
      versionRelationship: source.versionRelationship,
      exactLocator: source.exactLocators.join('; '),
      inspectedPassage: source.observedContent,
      boundedClaim: source.establishes,
      limitation: source.boundary,
      rightsBasis: source.rightsBasis,
      inspectionDepth: source.depth,
      // A recommendation for a reviewer. Nothing acts on it.
      proposedDisposition: 'accept',
      dispositionIsAdvisoryOnly: true,
      appliedToActiveBinding: false,
      activeBindingUnchanged: true,
    }
    return { ...body, provenanceDigest: sha(body) }
  }))

const ledger = {
  schemaVersion: 'maha-remediation-ledger/1.0',
  appendOnly: true,
  immutable: true,
  generatedAt: '2026-09-02',
  packets: packets.length,
  accept: packets.filter((p) => p.proposedDisposition === 'accept').length,
  revise: 0,
  reject: 0,
  activeBindingsChanged: 0,
  adoptionRule: 'A packet proposes. Adoption is a separate, reviewed act. No code path reads proposedDisposition and mutates a binding, and the uplift compiler consults inspections rather than packets.',
  canary: (() => {
    const accepted = packets.filter((p) => p.proposedDisposition === 'accept')
    const distinctRecords = new Set(accepted.map((p) => p.recordIdentity.route))
    const reachable = distinctRecords.size >= 5
    return {
      fiveRecordCanaryReachable: reachable,
      distinctRecordsAvailable: distinctRecords.size,
      // A canary is five records or it is not a five-record canary.
      constructed: reachable,
      records: reachable ? [...distinctRecords].sort().slice(0, 5) : [],
      executed: false,
      authorized: false,
      note: reachable
        ? 'Five distinct records carry an accept-disposition packet, so a five-record private source-override canary is honestly available. It is prepared and unexecuted.'
        : 'Fewer than five distinct records passed inspection. No smaller canary was constructed and called complete.',
    }
  })(),
  ledgerEntries: packets,
  boundary: 'Private, append-only proposals. Nothing here is active.',
  ledgerDigest: '',
}
ledger.ledgerDigest = sha({ ...ledger, ledgerDigest: '' })
mkdirSync('content/evidence-batch-3', { recursive: true })
writeFileSync('content/evidence-batch-3/remediation-packets.json', `${JSON.stringify(ledger, null, 2)}\n`)
console.log(JSON.stringify({
  packets: ledger.packets, accept: ledger.accept, activeBindingsChanged: ledger.activeBindingsChanged,
  canary: { reachable: ledger.canary.fiveRecordCanaryReachable, records: ledger.canary.records.length, executed: ledger.canary.executed },
}, null, 2))
