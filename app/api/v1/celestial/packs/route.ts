import { CELESTIAL_INTERPRETATION_PACKS, resolveInterpretationPack } from '@/lib/celestial-enterprise/contracts'
import { celestialError, celestialJson, openEnterpriseGate, readCelestialBody } from '@/lib/celestial-enterprise/route-support'
import { digestOf } from '@/lib/celestial-hypotheses/canonical'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const gate = await openEnterpriseGate(request, 'reports:read')
  if (!gate.ok) return gate.response
  const { data } = await gate.client.from('celestial_organization_packs').select('pack_id, version, installed_at').eq('organization_id', gate.principal.tenantId)
  const installed = new Map((data ?? []).map((row) => [`${row.pack_id}@${row.version}`, row.installed_at]))
  return celestialJson({ packs: CELESTIAL_INTERPRETATION_PACKS.map((pack) => ({ ...pack, packSha256: digestOf(pack), immutableVersion: true, installed: pack.packId === 'facts-only' || installed.has(`${pack.packId}@${pack.version}`), installedAt: installed.get(`${pack.packId}@${pack.version}`) ?? null })) })
}

export async function POST(request: Request) {
  const gate = await openEnterpriseGate(request, 'packs:install')
  if (!gate.ok) return gate.response
  const body = await readCelestialBody(request)
  if (!body.ok) return body.response
  const input = body.value && typeof body.value === 'object' ? body.value as Record<string, unknown> : {}
  try {
    const pack = resolveInterpretationPack(String(input.packId ?? ''), String(input.version ?? ''), String(input.reportType ?? 'individual-birth') as 'individual-birth' | 'corporate-event')
    const { error } = await gate.client.from('celestial_organization_packs').upsert({ organization_id: gate.principal.tenantId, pack_id: pack.packId, version: pack.version, installed_by_member_id: gate.principal.memberId }, { onConflict: 'organization_id,pack_id' })
    return error ? celestialError('pack_install_failed', 'The pack could not be installed.', 502) : celestialJson({ packId: pack.packId, version: pack.version, packSha256: pack.packSha256, installed: true })
  } catch { return celestialError('invalid_pack', 'The pack version is unavailable for the requested report type.', 400) }
}
