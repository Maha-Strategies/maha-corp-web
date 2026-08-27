export const KERNEL_RECEIPT_SCHEMA = 'maha-calculation-receipt/1.0';
function normalized(value) {
    if (typeof value === 'string')
        return value.normalize('NFC');
    if (Array.isArray(value))
        return value.map(normalized);
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, normalized(entry)]));
    return value;
}
export const canonicalJson = (value) => JSON.stringify(normalized(value));
async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
export async function createCalculationReceipt(input) {
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
    const { receiptSha256, ...snapshot } = receipt;
    const expectedInput = await sha256(canonicalJson({ constants: receipt.constants, inputs: receipt.inputs, units: receipt.units }));
    const expectedOutput = await sha256(canonicalJson({ output: receipt.output, uncertainty: receipt.uncertainty }));
    return receipt.schemaVersion === KERNEL_RECEIPT_SCHEMA && receipt.inputSha256 === expectedInput && receipt.outputSha256 === expectedOutput && receiptSha256 === await sha256(canonicalJson(snapshot));
}
//# sourceMappingURL=receipt.js.map