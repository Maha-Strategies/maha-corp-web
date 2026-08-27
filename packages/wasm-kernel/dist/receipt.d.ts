export declare const KERNEL_RECEIPT_SCHEMA: "maha-calculation-receipt/1.0";
export interface CalculationReceiptInput {
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
}
export interface CalculationReceipt extends CalculationReceiptInput {
    schemaVersion: typeof KERNEL_RECEIPT_SCHEMA;
    receiptSha256: string;
}
export declare const canonicalJson: (value: unknown) => string;
export declare function createCalculationReceipt(input: CalculationReceiptInput): Promise<CalculationReceipt>;
export declare function verifyCalculationReceipt(receipt: CalculationReceipt): Promise<boolean>;
//# sourceMappingURL=receipt.d.ts.map