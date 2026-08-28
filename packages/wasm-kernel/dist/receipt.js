export const KERNEL_RECEIPT_SCHEMA = 'maha-calculation-receipt/1.0';
export const KERNEL_CANONICALIZATION_VERSION = 'maha-dossier-canonical/1.0';
const DIGEST_FIELDS = new Set(['provenanceDigest', 'dossierDigest']);
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
function normalized(value) {
    if (value === null)
        return null;
    if (typeof value === 'string') {
        const nfc = value.normalize('NFC');
        if (!INSTANT.test(nfc))
            return nfc;
        const parsed = new Date(nfc);
        return Number.isNaN(parsed.getTime()) ? nfc : `${parsed.toISOString().slice(0, 19)}Z`;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            throw new Error('Non-finite number cannot be canonicalized.');
        return value;
    }
    if (typeof value === 'boolean')
        return value;
    if (value instanceof Date)
        return `${value.toISOString().slice(0, 19)}Z`;
    if (Array.isArray(value))
        return value.map(normalized);
    if (typeof value === 'object') {
        const source = value;
        const output = {};
        // Array.prototype.sort without a comparator uses stable UTF-16 code-unit
        // ordering. It is independent of ICU and the host's default locale.
        for (const key of Object.keys(source).sort()) {
            if (DIGEST_FIELDS.has(key) || source[key] === undefined)
                continue;
            output[key] = normalized(source[key]);
        }
        return output;
    }
    throw new Error(`Unsupported value of type ${typeof value} in canonicalization.`);
}
export const canonicalJson = (value) => JSON.stringify(normalized(value));
async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
export async function createCalculationReceipt(input) {
    if (input.canonicalizationVersion !== KERNEL_CANONICALIZATION_VERSION)
        throw new Error('Receipt canonicalization version does not match the dossier compiler.');
    if (!/^sha256:[a-f0-9]{64}$/.test(input.kernelSha256))
        throw new Error('kernelSha256 must be a SHA-256 digest.');
    for (const [name, digest] of [['conformanceSha256', input.conformanceSha256]]) {
        if (!/^sha256:[a-f0-9]{64}$/.test(digest))
            throw new Error(`${name} must be a SHA-256 digest.`);
    }
    if (!input.module || !input.operation || !input.precisionPolicy || !input.conformanceVersion)
        throw new Error('Receipt identity and precision fields are required.');
    if (input.arithmetic.integerModel !== 'signed-i64' || input.arithmetic.rounding !== 'nearest-ties-to-even' || input.arithmetic.overflow !== 'abort')
        throw new Error('Receipt arithmetic policy does not match the kernel ABI.');
    const inputSha256 = await sha256(canonicalJson({ constants: input.constants, inputs: input.inputs, units: input.units }));
    const outputSha256 = await sha256(canonicalJson({ output: input.output, uncertainty: input.uncertainty }));
    const snapshot = { schemaVersion: KERNEL_RECEIPT_SCHEMA, ...input, inputSha256, outputSha256 };
    return { ...snapshot, receiptSha256: await sha256(canonicalJson(snapshot)) };
}
export async function verifyCalculationReceipt(receipt) {
    try {
        const { receiptSha256, ...snapshot } = receipt;
        const expectedInput = await sha256(canonicalJson({ constants: receipt.constants, inputs: receipt.inputs, units: receipt.units }));
        const expectedOutput = await sha256(canonicalJson({ output: receipt.output, uncertainty: receipt.uncertainty }));
        return receipt.schemaVersion === KERNEL_RECEIPT_SCHEMA
            && receipt.canonicalizationVersion === KERNEL_CANONICALIZATION_VERSION
            && receipt.inputSha256 === expectedInput && receipt.outputSha256 === expectedOutput
            && receiptSha256 === await sha256(canonicalJson(snapshot));
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=receipt.js.map