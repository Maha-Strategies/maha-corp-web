/**
 * The boundary vocabulary every transport response carries.
 *
 * Two questions an architect asks of any result: what did you actually check,
 * and what did you take my word for. A response that answers neither is a
 * response you have to trust, which is the opposite of what this stack is for.
 *
 * `locally_verified` means this process computed or checked the value.
 * `trusted_pass_through` means a caller supplied it and nothing here confirmed
 * it. The distinction is never inferred — every field is labelled at the point
 * it is produced.
 */
export declare const TRANSPORT_BOUNDARY_VERSION = "1.0.0";
export type VerificationGrade = 'locally_verified' | 'trusted_pass_through' | 'not_established';
export type BoundaryStatement = {
    boundaryVersion: typeof TRANSPORT_BOUNDARY_VERSION;
    /** Where this process ran. Loopback means nothing left the machine. */
    transport: {
        kind: 'stdio' | 'http_loopback';
        networkExposure: 'none' | 'loopback';
    };
    /** Named, per field, so a reader never has to guess which is which. */
    verification: Record<string, VerificationGrade>;
    credentialsAccepted: false;
    credentialsReturned: false;
    sourceTextReturned: false;
    providerCallsMade: 0;
    paymentsInitiated: false;
    /** Things this response does not establish, stated rather than implied. */
    limitations: readonly string[];
};
export declare function boundaryStatement(input: {
    kind: BoundaryStatement['transport']['kind'];
    verification: Record<string, VerificationGrade>;
    limitations?: readonly string[];
}): BoundaryStatement;
export declare function isCredentialFieldName(key: string): boolean;
/**
 * Finds credential-shaped fields.
 *
 * `stringValuesOnly` is for scanning responses: a boundary statement says
 * `credentialsAccepted: false`, and a boolean declaring the absence of a
 * credential is not a credential. A leaked secret is a string.
 */
export declare function findCredentialFields(value: unknown, path?: string, found?: string[], options?: {
    stringValuesOnly?: boolean;
}): string[];
/** Longest string a metadata response may carry before it could be prose. */
export declare const MAX_RESPONSE_STRING_LENGTH = 400;
export declare function findUnboundedResponseStrings(value: unknown, path?: string, found?: {
    path: string;
    length: number;
}[]): {
    path: string;
    length: number;
}[];
//# sourceMappingURL=boundary.d.ts.map