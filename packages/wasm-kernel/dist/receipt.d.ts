export declare const KERNEL_RECEIPT_SCHEMA: "maha-calculation-receipt/1.0";
export declare const KERNEL_CANONICALIZATION_VERSION: "maha-dossier-canonical/1.0";
export interface CalculationReceiptInput {
    canonicalizationVersion: typeof KERNEL_CANONICALIZATION_VERSION;
    module: string;
    operation: string;
    inputs: Readonly<Record<string, string>>;
    units: Readonly<Record<string, string>>;
    constants: Readonly<Record<string, string>>;
    output: Readonly<Record<string, string>>;
    uncertainty: Readonly<Record<string, string>>;
    precisionPolicy: string;
    kernelVersion: string;
    kernelSha256: string;
    conformanceVersion: string;
    runtime: 'wasm-i64-fixed-point';
    proofReferences?: readonly string[];
    witnessReceiptIds?: readonly string[];
    compiler: Readonly<{
        name: 'assemblyscript';
        version: string;
        flags: readonly string[];
    }>;
    arithmetic: Readonly<{
        integerModel: 'signed-i64';
        rounding: 'nearest-ties-to-even';
        overflow: 'abort';
    }>;
    conformanceSha256: string;
}
export interface CalculationReceipt extends CalculationReceiptInput {
    schemaVersion: typeof KERNEL_RECEIPT_SCHEMA;
    inputSha256: string;
    outputSha256: string;
    receiptSha256: string;
}
export declare const canonicalJson: (value: unknown) => string;
export declare function createCalculationReceipt(input: CalculationReceiptInput): Promise<CalculationReceipt>;
export declare function verifyCalculationReceipt(receipt: CalculationReceipt): Promise<boolean>;
//# sourceMappingURL=receipt.d.ts.map