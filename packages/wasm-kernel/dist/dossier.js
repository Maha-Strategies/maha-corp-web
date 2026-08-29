import { canonicalJson, verifyCalculationReceipt } from './receipt.js';
import { createExecutedCalculationReceipt, verifyExecutedCalculationReceipt, } from './execution.js';
export const DOSSIER_CALCULATION_ATTACHMENT_SCHEMA = 'maha-dossier-calculation-attachment/1.0';
export async function attachCalculationReceiptToDossier(input) {
    if (!input.dossierId.trim() || input.claimIds.length === 0 || input.claimIds.some((id) => !id.trim()))
        throw new Error('A dossier calculation attachment requires a dossier and at least one claim.');
    if (new Set(input.claimIds).size !== input.claimIds.length)
        throw new Error('Dossier calculation claim ids must be unique.');
    if (!await verifyCalculationReceipt(input.receipt))
        throw new Error('Calculation receipt digest or schema is invalid.');
    const claimIds = [...input.claimIds].sort();
    return {
        schemaVersion: DOSSIER_CALCULATION_ATTACHMENT_SCHEMA,
        dossierId: input.dossierId,
        claimIds,
        receipt: input.receipt,
        mediaType: 'application/ld+json',
        jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'MathSolver',
            name: `${input.receipt.module}.${input.receipt.operation}`,
            identifier: input.receipt.receiptSha256,
            isPartOf: input.dossierId,
            encodingFormat: KERNEL_ATTACHMENT_ENCODING,
            potentialAction: claimIds.map((claimId) => ({ '@type': 'AssessAction', object: claimId })),
        },
    };
}
export async function executeAndAttachCalculationToDossier(input) {
    const receipt = await createExecutedCalculationReceipt(input.request, input.artifact);
    const findings = await verifyExecutedCalculationReceipt(receipt, input.artifact);
    if (findings.length)
        throw new Error(`Executed calculation could not be independently recomputed: ${findings.join(',')}`);
    return { ...await attachCalculationReceiptToDossier({ dossierId: input.dossierId, claimIds: input.claimIds, receipt }), executionRequest: input.request };
}
export const KERNEL_ATTACHMENT_ENCODING = 'maha-calculation-receipt/1.0+json';
export const serializeDossierCalculationAttachment = (attachment) => `${canonicalJson(attachment)}\n`;
//# sourceMappingURL=dossier.js.map