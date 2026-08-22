export type DoctorFinding = {
    check: string;
    status: 'ok' | 'warn' | 'fail';
    detail: string;
};
export type DoctorReport = {
    status: 'ok' | 'incomplete';
    findings: DoctorFinding[];
    contractVersion: string;
};
/**
 * Configuration health, without ever printing a secret.
 *
 * A secret is reported by presence and length class only. "Configured, 48
 * characters" tells an operator what they need; the value tells an attacker
 * what they need.
 */
export declare function doctor(environment?: NodeJS.ProcessEnv): DoctorReport;
export type EvidenceRecord = {
    contractVersion: string;
    policyVersion: string;
    outcome: 'compiled' | 'passthrough';
    reason?: string;
    headers: Record<string, string>;
    sourceTextRetained: false;
    credentialsRetained: false;
};
/**
 * Compile one sanitized fixture against a configured endpoint.
 *
 * The result written to disk is evidence, not content: headers, outcome and
 * declared boundaries. The rewritten prompt is deliberately not persisted --
 * writing it would put source text in a file the caller may well commit.
 */
export declare function compile(options: {
    inputPath: string;
    outputPath: string;
    environment?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
}): Promise<EvidenceRecord>;
export type VerifyFinding = {
    check: string;
    status: 'ok' | 'fail';
    verifiable: 'locally' | 'trusted-passthrough';
    detail: string;
};
export type VerifyReport = {
    status: 'ok' | 'invalid';
    findings: VerifyFinding[];
};
/**
 * Verify an evidence record's structure.
 *
 * The distinction this reports is the important one. Shape, hash formatting,
 * budget consistency and failure-state coherence are checkable here. Whether a
 * hash actually commits to the bytes a model received is not: that requires
 * the inputs, which this file deliberately does not contain. Values in the
 * second class are labelled `trusted-passthrough` rather than reported as
 * verified.
 */
export declare function verify(record: unknown): VerifyReport;
export type GatewayName = 'wso2' | 'kong' | 'apigee' | 'cloudflare';
export type GatewayValidation = {
    gateway: GatewayName;
    status: 'ok' | 'invalid';
    checks: {
        check: string;
        status: 'ok' | 'fail';
        detail: string;
    }[];
};
/** Static validation only: reads files, deploys nothing, calls nothing. */
export declare function gatewayValidate(gateway: GatewayName, root?: string): GatewayValidation;
export declare const GATEWAY_NAMES: readonly GatewayName[];
//# sourceMappingURL=index.d.ts.map