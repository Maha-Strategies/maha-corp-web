import { z } from 'zod'
import { input, records, id, digest, utc, count, text, spec, hash, otherHash, time, finding as f, metric as m, unique, type AuditSpec } from './batch5-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
const prefix = 'meeting-records-'
const decision = { id: 'd1', meetingId: 'm1', agendaItemId: 'a1', sourceRevision: hash, decisionDigest: hash, offsetMs: 100, ownerRole: 'research' }
const shape = { meetingId: id, agendaItemId: id, sourceRevision: digest, decisionDigest: digest, offsetMs: count, ownerRole: z.enum(['research', 'engineering', 'business', 'unassigned']) }
export const BATCH6_MEETINGS: AuditSpec[] = [
  spec(prefix + 'provenance-edge-audit', 'Check decision-to-segment edges for meeting/revision/digest bindings and declared offset containment. No transcript, consent check or claim that the segment supports an agreement.',
    input({ decisions: records({ meetingId: id, revision: digest }), segments: records({ meetingId: id, revision: digest, contentDigest: digest, startMs: count, endMs: count }), edges: records({ decisionId: id, segmentId: id, segmentDigest: digest, decisionAtMs: count }) }),
    { decisions: [{ id: 'd1', meetingId: 'm1', revision: hash }], segments: [{ id: 's1', meetingId: 'm1', revision: hash, contentDigest: hash, startMs: 0, endMs: 1000 }], edges: [{ id: 'e1', decisionId: 'd1', segmentId: 's1', segmentDigest: hash, decisionAtMs: 100 }] },
    { decisions: [{ id: 'd1', meetingId: 'm1', revision: hash }], segments: [{ id: 's1', meetingId: 'm1', revision: hash, contentDigest: hash, startMs: 0, endMs: 1000 }], edges: [{ id: 'e1', decisionId: 'd1', segmentId: 's1', segmentDigest: otherHash, decisionAtMs: 100 }] },
    ['meeting-edge-digest-mismatch', 'meeting-edge-endpoint-missing', 'meeting-edge-frame-mismatch', 'meeting-edge-offset-outside-segment'], ['bound-decision-edges'], i => {
      unique(i.decisions.map(r => r.id)); unique(i.segments.map(r => r.id)); unique(i.edges.map(r => r.id)); if (i.segments.some(r => r.endMs < r.startMs)) throw Error('segment_window_inverted')
      const d = new Map(i.decisions.map(r => [r.id, r])), s = new Map(i.segments.map(r => [r.id, r])); let bound = 0
      const findings = i.edges.flatMap(r => { const dv = d.get(r.decisionId), sv = s.get(r.segmentId); if (!dv || !sv) return [f('meeting-edge-endpoint-missing', r.id)]; if (dv.meetingId !== sv.meetingId || dv.revision !== sv.revision) return [f('meeting-edge-frame-mismatch', r.id)]; if (sv.contentDigest !== r.segmentDigest) return [f('meeting-edge-digest-mismatch', r.id)]; if (r.decisionAtMs < sv.startMs || r.decisionAtMs >= sv.endMs) return [f('meeting-edge-offset-outside-segment', r.id)]; bound++; return [] })
      return { findings, metrics: [m('bound-decision-edges', 'meeting', bound)] }
    }),
  spec(prefix + 'scope-boundary-audit', 'Filter supplied meeting records by exact meeting/revision, allowed agenda IDs and caller-declared half-open time window. No recording access, participant identity or completeness inference.',
    input({ meetingId: id, revision: digest, agendaIds: z.array(id).min(1).max(32), startsAt: utc, endsAt: utc, records: records({ meetingId: id, revision: digest, agendaItemId: id, observedAt: utc }) }),
    { meetingId: 'm1', revision: hash, agendaIds: ['a1'], startsAt: time, endsAt: '2026-01-02T00:00:00.000Z', records: [{ id: 'r1', meetingId: 'm1', revision: hash, agendaItemId: 'a1', observedAt: time }] },
    { meetingId: 'm1', revision: hash, agendaIds: ['a1'], startsAt: time, endsAt: '2026-01-02T00:00:00.000Z', records: [{ id: 'r1', meetingId: 'm2', revision: hash, agendaItemId: 'a1', observedAt: time }] },
    ['meeting-record-outside-frame', 'meeting-agenda-outside-scope', 'meeting-record-outside-time'], ['in-scope-records'], i => {
      if (i.endsAt <= i.startsAt) throw Error('meeting_scope_window_inverted'); unique(i.agendaIds); unique(i.records.map(r => r.id)); let inside = 0
      const findings = i.records.flatMap(r => { const issues = [...(r.meetingId !== i.meetingId || r.revision !== i.revision ? [f('meeting-record-outside-frame', r.id)] : []), ...(!i.agendaIds.includes(r.agendaItemId) ? [f('meeting-agenda-outside-scope', r.id)] : []), ...(r.observedAt < i.startsAt || r.observedAt >= i.endsAt ? [f('meeting-record-outside-time', r.id)] : [])]; if (!issues.length) inside++; return issues })
      return { findings, metrics: [m('in-scope-records', 'meeting', inside)] }
    }),
  spec(prefix + 'export-semantic-parity', 'Compare closed nonpersonal meeting decision projections by stable ID, agenda, revision, digest, offset and owner-role labels. Ignores row order; no natural-language equivalence or agreement verification.',
    input({ exportLabel: text, before: records(shape, 0), after: records(shape, 0) }), { exportLabel: 'declared-export', before: [decision], after: [decision] },
    { exportLabel: 'declared-export', before: [decision], after: [{ ...decision, offsetMs: 101 }] },
    ['meeting-export-projection-changed', 'meeting-export-record-missing', 'meeting-export-record-added'], ['identical-projections'], i => {
      unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id)); const a = new Map(i.after.map(r => [r.id, r])), b = new Map(i.before.map(r => [r.id, r])); let same = 0
      const findings = i.before.flatMap(r => { const v = a.get(r.id); if (!v) return [f('meeting-export-record-missing', r.id)]; if (demandDigest(r) !== demandDigest(v)) return [f('meeting-export-projection-changed', r.id)]; same++; return [] })
      findings.push(...i.after.filter(r => !b.has(r.id)).map(r => f('meeting-export-record-added', r.id))); return { findings, metrics: [m('identical-projections', 'meeting', same)] }
    }),
]
