import type { CalculationReceipt } from './receipt.js';
import { type KernelArtifact, type KernelExecutionRequest } from './execution.js';
export declare const DOSSIER_CALCULATION_ATTACHMENT_SCHEMA: "maha-dossier-calculation-attachment/1.0";
export interface DossierCalculationAttachment {
    schemaVersion: typeof DOSSIER_CALCULATION_ATTACHMENT_SCHEMA;
    dossierId: string;
    claimIds: readonly string[];
    receipt: CalculationReceipt;
    mediaType: 'application/ld+json';
    jsonLd: Readonly<Record<string, unknown>>;
    executionRequest?: KernelExecutionRequest;
}
export interface ExecutionBoundDossierCalculationAttachment extends DossierCalculationAttachment {
    executionRequest: KernelExecutionRequest;
}
export declare function attachCalculationReceiptToDossier(input: {
    dossierId: string;
    claimIds: readonly string[];
    receipt: CalculationReceipt;
}): Promise<DossierCalculationAttachment>;
export declare function executeAndAttachCalculationToDossier(input: {
    dossierId: string;
    claimIds: readonly string[];
    request: KernelExecutionRequest;
    artifact: KernelArtifact;
}): Promise<ExecutionBoundDossierCalculationAttachment>;
export declare const KERNEL_ATTACHMENT_ENCODING: "maha-calculation-receipt/1.0+json";
export declare const serializeDossierCalculationAttachment: (attachment: DossierCalculationAttachment) => string;
//# sourceMappingURL=dossier.d.ts.map