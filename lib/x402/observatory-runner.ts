import { diagnoseX402Endpoint, type DoctorOptions, type DoctorReport } from './doctor.ts'
import { observationFromDoctor, validateObservatoryResources, type ObservatoryObservation, type ObservatoryResource } from './observatory.ts'

export type ObservatoryDoctor = (options: DoctorOptions) => Promise<DoctorReport>

export async function runObservatorySweep(input: {
  resources: ObservatoryResource[]
  diagnose?: ObservatoryDoctor
  observedAt?: string
}): Promise<ObservatoryObservation[]> {
  validateObservatoryResources(input.resources)
  const diagnose = input.diagnose ?? diagnoseX402Endpoint
  const observations: ObservatoryObservation[] = []
  for (const resource of input.resources) {
    if (resource.boundedSettlement.enabled) {
      throw new Error(`Paid observatory checks require a separately reviewed paid-probe adapter: ${resource.id}`)
    }
    const report = await diagnose({ endpoint: resource.url, request: resource.request })
    observations.push(observationFromDoctor({ resource, report, observedAt: input.observedAt }))
  }
  return observations
}
