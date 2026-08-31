import { type CalculationReceipt, type CalculationReceiptInput } from './receipt.js';
export declare const EXECUTABLE_KERNEL_MODULE: "@maha/wasm-kernel";
export declare const EXECUTION_REQUEST_SCHEMA: "maha-wasm-execution-request/1.0";
export type ExecutableKernelOperation = 'normalize-angle-microdegrees' | 'layer-thermal-resistance-nanokelvin-per-watt' | 'temperature-rise-microkelvin' | 'interval-add';
export interface KernelManifest {
    schemaVersion: 'maha-wasm-kernel-manifest/1.0';
    kernelVersion: string;
    abi: 'wasm-i64-fixed-point';
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
    sourceSha256: string;
    conformanceVersion: string;
    conformanceSha256: string;
    uncertaintyConformanceSha256: string;
    kernelSha256: string;
}
export interface KernelExecutionRequest {
    schemaVersion: typeof EXECUTION_REQUEST_SCHEMA;
    operation: ExecutableKernelOperation;
    inputs: Readonly<Record<string, string>>;
    units: Readonly<Record<string, string>>;
    constants?: Readonly<Record<string, string>>;
}
export interface KernelArtifact {
    bytes: Uint8Array;
    manifest: KernelManifest;
}
export declare function verifyKernelArtifact(artifact: KernelArtifact): Promise<string[]>;
export declare function executeKernelRequest(request: KernelExecutionRequest, artifact: KernelArtifact): Promise<Pick<CalculationReceiptInput, 'output' | 'uncertainty'>>;
export declare function createExecutedCalculationReceipt(request: KernelExecutionRequest, artifact: KernelArtifact): Promise<CalculationReceipt>;
export declare function verifyExecutedCalculationReceipt(receipt: CalculationReceipt, artifact: KernelArtifact): Promise<string[]>;
//# sourceMappingURL=execution.d.ts.map