import { z } from 'zod'
import { input, records, id, digest, utc, count, field, list, spec, hash, otherHash, time, later, finding as f, metric as m, unique, cycles, type AuditSpec, type Finding } from './batch5-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
const prefix = 'meeting-records-'
const role = z.enum(['research', 'engineering', 'business', 'unassigned'])
const decision = { id: 'd1', meetingId: 'meeting1', agendaItemId: 'a1', sourceSegmentId: 's1', decisionDigest: hash, ownerRole: 'research' }
const projection = { meetingId: id, agendaItemId: id, sourceSegmentId: id, decisionDigest: digest, ownerRole: role }
const scalar = { name: 'decisionDigest', type: 'text', required: true, nullable: false }
export const BATCH5_MEETINGS: AuditSpec[] = [
  spec(prefix + 'required-field-coverage', 'Find missing agenda, source-segment and decision-digest metadata. Accepts only declared public/synthetic nonpersonal records, not names, transcript text or evidence that a decision was actually agreed.',
    input({ decisions: records({ agendaItemId: id.nullable(), sourceSegmentId: id.nullable(), decisionDigest: digest.nullable() }) }),
    { decisions: [{ id: 'd1', agendaItemId: 'a1', sourceSegmentId: 's1', decisionDigest: hash }] },
    { decisions: [{ id: 'd1', agendaItemId: null, sourceSegmentId: 's1', decisionDigest: hash }] },
    ['meeting-agenda-binding-missing', 'meeting-source-segment-missing', 'meeting-decision-digest-missing'], ['missing-decision-fields'], i => {
      unique(i.decisions.map(r => r.id)); const findings = i.decisions.flatMap(r => [...(r.agendaItemId === null ? [f('meeting-agenda-binding-missing', r.id)] : []), ...(r.sourceSegmentId === null ? [f('meeting-source-segment-missing', r.id)] : []), ...(r.decisionDigest === null ? [f('meeting-decision-digest-missing', r.id)] : [])])
      return { findings, metrics: [m('missing-decision-fields', 'meeting', findings.length)] }
    }),
  spec(prefix + 'duplicate-record-identities', 'Group repeated decision IDs within a meeting and source revision, distinguishing matching from conflicting decision projections. Different source revisions remain separate records.',
    input({ decisions: records({ ...projection, sourceRevision: digest }) }),
    { decisions: [{ ...decision, sourceRevision: hash }] }, { decisions: [{ ...decision, sourceRevision: hash }, { ...decision, sourceRevision: hash }] },
    ['meeting-identical-decision-duplicate', 'meeting-conflicting-decision-projection'], ['decision-identity-groups'], i => {
      const groups = new Map<string, typeof i.decisions>(); for (const r of i.decisions) { const key = demandDigest([r.meetingId, r.sourceRevision, r.id]); groups.set(key, [...(groups.get(key) ?? []), r]) }
      return { findings: [...groups.values()].filter(g => g.length > 1).map(g => f(new Set(g.map(r => demandDigest(r))).size === 1 ? 'meeting-identical-decision-duplicate' : 'meeting-conflicting-decision-projection', ...g.map(r => r.id))), metrics: [m('decision-identity-groups', 'meeting', groups.size)] }
    }),
  spec(prefix + 'unit-label-consistency', 'Check meeting segment offset/duration/count units against their declared quantities and repeated metric identities. No guessed conversion, transcript inspection or speech timing validation.',
    input({ measurements: records({ metricId: id, quantity: z.enum(['offset', 'duration', 'count']), unit: z.enum(['s', 'ms', 'count']) }) }),
    { measurements: [{ id: 'r1', metricId: 'start', quantity: 'offset', unit: 'ms' }] },
    { measurements: [{ id: 'r1', metricId: 'start', quantity: 'offset', unit: 'count' }] },
    ['meeting-quantity-unit-mismatch', 'meeting-metric-unit-conflict'], ['checked-measurements'], i => {
      unique(i.measurements.map(r => r.id)); const findings = i.measurements.filter(r => r.quantity === 'count' ? r.unit !== 'count' : r.unit === 'count').map(r => f('meeting-quantity-unit-mismatch', r.id)), groups = new Map<string, typeof i.measurements>()
      for (const r of i.measurements) groups.set(r.metricId, [...(groups.get(r.metricId) ?? []), r])
      for (const g of groups.values()) if (new Set(g.map(r => r.quantity + ':' + r.unit)).size > 1) findings.push(f('meeting-metric-unit-conflict', ...g.map(r => r.id)))
      return { findings, metrics: [m('checked-measurements', 'meeting', i.measurements.length)] }
    }),
  spec(prefix + 'timestamp-order-audit', 'Check supplied meeting/segment time windows for reversed intervals, outside-meeting segments and chronological regressions. No recording access or trusted timestamp assertion.',
    input({ startedAt: utc, endedAt: utc, segments: records({ startsAt: utc, endsAt: utc }) }),
    { startedAt: time, endedAt: later, segments: [{ id: 's1', startsAt: time, endsAt: later }] },
    { startedAt: time, endedAt: later, segments: [{ id: 's1', startsAt: later, endsAt: time }] },
    ['meeting-segment-window-inverted', 'meeting-segment-outside-window', 'meeting-segment-order-regression'], ['checked-segments'], i => {
      if (i.endedAt < i.startedAt) throw Error('meeting_window_inverted'); unique(i.segments.map(r => r.id)); const findings: Finding[] = []
      i.segments.forEach((r, j) => { if (r.endsAt < r.startsAt) findings.push(f('meeting-segment-window-inverted', r.id)); if (r.startsAt < i.startedAt || r.endsAt > i.endedAt) findings.push(f('meeting-segment-outside-window', r.id)); if (j && r.startsAt < i.segments[j - 1].startsAt) findings.push(f('meeting-segment-order-regression', i.segments[j - 1].id, r.id)) })
      return { findings, metrics: [m('checked-segments', 'meeting', i.segments.length)] }
    }),
  spec(prefix + 'revision-delta-map', 'Compare closed decision metadata between two source revisions, reporting digest, agenda, source-segment and owner-role changes. No transcript processing, agreement inference or person identity.',
    input({ beforeRevision: digest, afterRevision: digest, before: records(projection), after: records(projection, 0) }),
    { beforeRevision: hash, afterRevision: otherHash, before: [decision], after: [decision] },
    { beforeRevision: hash, afterRevision: otherHash, before: [decision], after: [{ ...decision, decisionDigest: otherHash }] },
    ['meeting-decision-fields-changed', 'meeting-decision-removed', 'meeting-decision-added', 'meeting-revision-not-advanced'], ['unchanged-decisions'], i => {
      unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id)); const a = new Map(i.after.map(r => [r.id, r])), b = new Map(i.before.map(r => [r.id, r])); let same = 0
      const findings = i.before.flatMap(r => { const v = a.get(r.id); if (!v) return [f('meeting-decision-removed', r.id)]; if (demandDigest(r) !== demandDigest(v)) return [f('meeting-decision-fields-changed', r.id)]; same++; return [] })
      findings.push(...i.after.filter(r => !b.has(r.id)).map(r => f('meeting-decision-added', r.id))); if (i.beforeRevision === i.afterRevision) findings.push(f('meeting-revision-not-advanced', 'meeting'))
      return { findings, metrics: [m('unchanged-decisions', 'meeting', same)] }
    }),
  spec(prefix + 'source-coverage-map', 'Bind decision metadata to supplied segment digests, source revisions and meeting IDs. Matching metadata is not proof that a recording supports a decision or that attendees consented.',
    input({ segments: records({ meetingId: id, sourceRevision: digest, contentDigest: digest }, 0), decisions: records({ meetingId: id, sourceSegmentId: id, sourceRevision: digest, segmentDigest: digest }) }),
    { segments: [{ id: 's1', meetingId: 'm1', sourceRevision: hash, contentDigest: hash }], decisions: [{ id: 'd1', meetingId: 'm1', sourceSegmentId: 's1', sourceRevision: hash, segmentDigest: hash }] },
    { segments: [], decisions: [{ id: 'd1', meetingId: 'm1', sourceSegmentId: 's1', sourceRevision: hash, segmentDigest: hash }] },
    ['meeting-bound-segment-missing', 'meeting-source-frame-mismatch', 'meeting-source-pin-mismatch'], ['bound-decisions'], i => {
      unique(i.segments.map(r => r.id)); unique(i.decisions.map(r => r.id)); const s = new Map(i.segments.map(r => [r.id, r])); let bound = 0
      const findings = i.decisions.flatMap(r => { const v = s.get(r.sourceSegmentId); if (!v) return [f('meeting-bound-segment-missing', r.id)]; if (v.meetingId !== r.meetingId) return [f('meeting-source-frame-mismatch', r.id)]; if (v.sourceRevision !== r.sourceRevision || v.contentDigest !== r.segmentDigest) return [f('meeting-source-pin-mismatch', r.id)]; bound++; return [] })
      return { findings, metrics: [m('bound-decisions', 'meeting', bound)] }
    }),
  spec(prefix + 'identifier-crosswalk-audit', 'Resolve supplied agenda aliases to declared agenda IDs and meeting frames; report absent or cross-meeting targets. No natural-language topic matching or participant data.',
    input({ agenda: records({ meetingId: id }), aliases: records({ targetAgendaId: id, meetingId: id }) }),
    { agenda: [{ id: 'a1', meetingId: 'm1' }], aliases: [{ id: 'old1', targetAgendaId: 'a1', meetingId: 'm1' }] },
    { agenda: [{ id: 'a1', meetingId: 'm1' }], aliases: [{ id: 'old1', targetAgendaId: 'a1', meetingId: 'm2' }] },
    ['meeting-agenda-alias-frame-mismatch', 'meeting-agenda-alias-target-missing'], ['bound-agenda-aliases'], i => {
      unique(i.agenda.map(r => r.id)); unique(i.aliases.map(r => r.id)); const a = new Map(i.agenda.map(r => [r.id, r])); let bound = 0
      const findings = i.aliases.flatMap(r => { const v = a.get(r.targetAgendaId); if (!v) return [f('meeting-agenda-alias-target-missing', r.id)]; if (v.meetingId !== r.meetingId) return [f('meeting-agenda-alias-frame-mismatch', r.id)]; bound++; return [] })
      return { findings, metrics: [m('bound-agenda-aliases', 'meeting', bound)] }
    }),
  spec(prefix + 'reference-integrity-map', 'Audit declared decision-parent links for missing decisions, cycles and cross-meeting references. Does not infer decision authority, enforce commitments or create tasks.',
    input({ decisions: records({ meetingId: id, parentId: id.nullable() }) }),
    { decisions: [{ id: 'd1', meetingId: 'm1', parentId: null }] },
    { decisions: [{ id: 'd1', meetingId: 'm1', parentId: 'missing' }] },
    ['meeting-decision-parent-missing', 'meeting-decision-cycle', 'meeting-decision-parent-frame-mismatch'], ['decision-parent-links'], i => {
      const cyclic = cycles(i.decisions), decisions = new Map(i.decisions.map(r => [r.id, r]))
      return { findings: i.decisions.flatMap(r => { const p = r.parentId ? decisions.get(r.parentId) : undefined; return [...(r.parentId && !p ? [f('meeting-decision-parent-missing', r.id)] : []), ...(cyclic.has(r.id) ? [f('meeting-decision-cycle', r.id)] : []), ...(p && p.meetingId !== r.meetingId ? [f('meeting-decision-parent-frame-mismatch', r.id)] : [])] }), metrics: [m('decision-parent-links', 'meeting', i.decisions.filter(r => r.parentId !== null).length)] }
    }),
  spec(prefix + 'condition-coverage-map', 'Compare role-level meeting review requirements with approved/rejected/unknown declarations. This is checklist metadata, not verified participant identity, consent or authorization.',
    input({ requiredRoles: list(role, 1, 4), reviews: records({ role, state: z.enum(['approved', 'rejected', 'unknown']) }, 0) }),
    { requiredRoles: ['research'], reviews: [{ id: 'r1', role: 'research', state: 'approved' }] },
    { requiredRoles: ['research'], reviews: [] },
    ['meeting-role-review-missing', 'meeting-role-review-undetermined', 'meeting-role-review-rejected', 'meeting-role-review-conflict'], ['declared-approved-roles'], i => {
      unique(i.requiredRoles); unique(i.reviews.map(r => r.id)); const findings = []; let approved = 0
      for (const k of i.requiredRoles) { const states = new Set(i.reviews.filter(r => r.role === k).map(r => r.state)); if (!states.size) findings.push(f('meeting-role-review-missing', k)); else if (states.size > 1) findings.push(f('meeting-role-review-conflict', k)); else if (states.has('unknown')) findings.push(f('meeting-role-review-undetermined', k)); else if (states.has('rejected')) findings.push(f('meeting-role-review-rejected', k)); else approved++ }
      return { findings, metrics: [m('declared-approved-roles', 'meeting', approved)] }
    }),
  spec(prefix + 'declared-bound-audit', 'Check declared meeting segment offsets and durations against a caller-supplied millisecond window using exact second/millisecond conversion. No audio/video access or recording verification.',
    input({ windowMs: count, segments: records({ offset: count, duration: count, unit: z.enum(['s', 'ms']) }) }),
    { windowMs: 1000, segments: [{ id: 's1', offset: 0, duration: 1, unit: 's' }] },
    { windowMs: 1000, segments: [{ id: 's1', offset: 1, duration: 1, unit: 's' }] },
    ['meeting-segment-end-exceeds-bound'], ['maximum-declared-end-ms'], i => {
      unique(i.segments.map(r => r.id)); const ends = i.segments.map(r => ({ id: r.id, end: (BigInt(r.offset) + BigInt(r.duration)) * BigInt(r.unit === 's' ? 1000 : 1) }))
      return { findings: ends.filter(r => r.end > BigInt(i.windowMs)).map(r => f('meeting-segment-end-exceeds-bound', r.id)), metrics: [m('maximum-declared-end-ms', 'meeting', ends.reduce((n, r) => r.end > n ? r.end : n, 0n))] }
    }),
  spec(prefix + 'missingness-cooccurrence', 'Count joint absence of decision digest, source-segment and nonpersonal owner-role labels. Reports missing metadata without inferring agreement or identifying attendees.',
    input({ decisions: records({ decisionDigest: digest.nullable(), sourceSegmentId: id.nullable(), ownerRole: role.nullable() }) }),
    { decisions: [{ id: 'd1', decisionDigest: hash, sourceSegmentId: 's1', ownerRole: 'research' }] },
    { decisions: [{ id: 'd1', decisionDigest: null, sourceSegmentId: null, ownerRole: 'research' }] },
    ['meeting-joint-missingness'], ['decision-source-nulls', 'decision-role-nulls', 'source-role-nulls'], i => {
      unique(i.decisions.map(r => r.id)); const pairs = [['decisionDigest', 'sourceSegmentId', 'decision-source-nulls'], ['decisionDigest', 'ownerRole', 'decision-role-nulls'], ['sourceSegmentId', 'ownerRole', 'source-role-nulls']] as const
      return { findings: i.decisions.filter(r => (['decisionDigest', 'sourceSegmentId', 'ownerRole'] as const).filter(k => r[k] === null).length >= 2).map(r => f('meeting-joint-missingness', r.id)), metrics: pairs.map(([a, b, k]) => m(k, 'meeting', i.decisions.filter(r => r[a] === null && r[b] === null).length)) }
    }),
  spec(prefix + 'schema-directionality', 'Compare closed meeting extraction fields and declared offset units for request incompatibilities. No general schema execution, transcript transformation or compatibility guarantee for undeclared fields.',
    input({ beforeOffsetUnit: z.enum(['s', 'ms']), afterOffsetUnit: z.enum(['s', 'ms']), before: list(field, 1, 32), after: list(field, 0, 32) }),
    { beforeOffsetUnit: 'ms', afterOffsetUnit: 'ms', before: [scalar], after: [scalar] },
    { beforeOffsetUnit: 'ms', afterOffsetUnit: 's', before: [scalar], after: [scalar] },
    ['meeting-offset-unit-changed', 'meeting-field-removed', 'meeting-field-type-changed', 'meeting-nullability-narrowed', 'meeting-field-newly-required'], ['extraction-contract-breaks'], i => {
      unique(i.before.map(r => r.name)); unique(i.after.map(r => r.name)); const a = new Map(i.after.map(r => [r.name, r])), b = new Map(i.before.map(r => [r.name, r])), findings = []
      if (i.beforeOffsetUnit !== i.afterOffsetUnit) findings.push(f('meeting-offset-unit-changed', 'offset'))
      for (const r of i.before) { const v = a.get(r.name); if (!v) findings.push(f('meeting-field-removed', r.name)); else { if (v.type !== r.type) findings.push(f('meeting-field-type-changed', r.name)); if (r.nullable && !v.nullable) findings.push(f('meeting-nullability-narrowed', r.name)); if (!r.required && v.required) findings.push(f('meeting-field-newly-required', r.name)) } }
      for (const r of i.after) if (!b.has(r.name) && r.required) findings.push(f('meeting-field-newly-required', r.name))
      return { findings, metrics: [m('extraction-contract-breaks', 'meeting', findings.length)] }
    }),
  spec(prefix + 'record-sequence-diff', 'Compare supplied meeting segment sequence and content digests across two extracts, preserving relative order of shared segments. No speaker identification, transcription or inferred conversational causality.',
    input({ before: records({ contentDigest: digest }, 0), after: records({ contentDigest: digest }, 0) }),
    { before: [{ id: 's1', contentDigest: hash }], after: [{ id: 's1', contentDigest: hash }] },
    { before: [{ id: 's1', contentDigest: hash }], after: [{ id: 's1', contentDigest: otherHash }] },
    ['meeting-segment-content-changed', 'meeting-segment-added', 'meeting-segment-removed', 'meeting-shared-segment-order-changed'], ['shared-segment-count'], i => {
      unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id)); const a = new Map(i.after.map(r => [r.id, r])), b = new Map(i.before.map(r => [r.id, r]))
      const findings = [...i.before.flatMap(r => !a.has(r.id) ? [f('meeting-segment-removed', r.id)] : a.get(r.id)!.contentDigest !== r.contentDigest ? [f('meeting-segment-content-changed', r.id)] : []), ...i.after.filter(r => !b.has(r.id)).map(r => f('meeting-segment-added', r.id))]
      const before = i.before.filter(r => a.has(r.id)).map(r => r.id), after = i.after.filter(r => b.has(r.id)).map(r => r.id)
      if (demandDigest(before) !== demandDigest(after)) findings.push(f('meeting-shared-segment-order-changed', ...before))
      return { findings, metrics: [m('shared-segment-count', 'meeting', before.length)] }
    }),
]
