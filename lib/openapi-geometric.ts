export const GEOMETRIC_AI_RESEARCH_URL = 'https://research.mahastrategies.com/atlas/geometric-ai'

export type GeometricLieGroup = 'SO(3)' | 'SE(3)' | 'SU(N)'
export type BoundaryCondition = { kind: 'dirichlet' | 'neumann' | 'periodic' | 'mixed'; region: string; expression: string }
export type MeshTopology = { kind: 'point-cloud' | 'triangular-surface' | 'tetrahedral-volume' | 'structured-grid'; nodeCount: number; elementCount?: number; dimension: 2 | 3 }
export interface GeometricAiJobRequest { clientRequestId: string; manifold: { name: string; dimension: number; metric?: string; coordinateChart?: string }; symmetry: { group: GeometricLieGroup; representation: string }; boundaryConditions: BoundaryCondition[]; mesh: MeshTopology }
export interface GeometricAiJobResponse { mock: true; jobId: string; status: 'queued'; clientRequestId: string; inputHash: string; citations: Array<{ claimId: string; url: string; role: 'method-basis'; verificationBoundary: 'research-node' }>; sourceInputStored: false }

const requestSchema = {
  type: 'object', required: ['clientRequestId', 'manifold', 'symmetry', 'boundaryConditions', 'mesh'], properties: {
    clientRequestId: { type: 'string', minLength: 8, maxLength: 120 },
    manifold: { type: 'object', required: ['name', 'dimension'], properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, dimension: { type: 'integer', minimum: 1, maximum: 32 }, metric: { type: 'string', maxLength: 2000 }, coordinateChart: { type: 'string', maxLength: 500 } } },
    symmetry: { type: 'object', required: ['group', 'representation'], properties: { group: { type: 'string', enum: ['SO(3)', 'SE(3)', 'SU(N)'] }, representation: { type: 'string', minLength: 1, maxLength: 500 } } },
    boundaryConditions: { type: 'array', maxItems: 64, items: { type: 'object', required: ['kind', 'region', 'expression'], properties: { kind: { type: 'string', enum: ['dirichlet', 'neumann', 'periodic', 'mixed'] }, region: { type: 'string', minLength: 1, maxLength: 500 }, expression: { type: 'string', minLength: 1, maxLength: 2000 } } } },
    mesh: { type: 'object', required: ['kind', 'nodeCount', 'dimension'], properties: { kind: { type: 'string', enum: ['point-cloud', 'triangular-surface', 'tetrahedral-volume', 'structured-grid'] }, nodeCount: { type: 'integer', minimum: 1, maximum: 10000000 }, elementCount: { type: 'integer', minimum: 1, maximum: 100000000 }, dimension: { type: 'integer', enum: [2, 3] } } },
  },
} as const

export const geometricAiOpenApiPath = {
  '/api/v1/geometric-ai': { post: { tags: ['Maha Geometric AI (Mock)'], operationId: 'createMockGeometricAiJob', summary: 'Validate a geometry-constrained integration request and return a mock job', description: 'Integration stub only. The endpoint queues no compute and retains no submitted mesh, boundary, or manifold data. It returns a deterministic mock contract envelope.', requestBody: { required: true, content: { 'application/json': { schema: requestSchema } } }, responses: { '202': { description: 'Mock job accepted; no model execution has run.', headers: { 'X-Maha-API-Mode': { schema: { const: 'mock' } } }, content: { 'application/json': { schema: { type: 'object', required: ['mock', 'jobId', 'status', 'clientRequestId', 'inputHash', 'citations', 'sourceInputStored'], properties: { mock: { const: true }, jobId: { type: 'string', pattern: '^gai_[a-f0-9]{32}$' }, status: { const: 'queued' }, clientRequestId: { type: 'string' }, inputHash: { type: 'string', pattern: '^[a-f0-9]{64}$' }, citations: { type: 'array', minItems: 1, items: { type: 'object' } }, sourceInputStored: { const: false } } } } } }, '400': { description: 'Invalid geometric AI mock request.' }, '415': { description: 'Content-Type must be application/json.' } } } },
} as const
