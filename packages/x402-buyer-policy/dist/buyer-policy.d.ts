/**
 * Vendor-neutral buyer controls for x402 clients.
 *
 * This module never discovers resources, holds keys, signs authorizations, or
 * submits payments. It produces an auditable decision immediately before a
 * wallet is invoked, and verifies the evidence returned after settlement.
 */
export declare const BUYER_POLICY_SCHEMA_VERSION: "1.0.0";
export type PaymentRequirementLike = {
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds?: number;
};
export type BuyerAssetRule = {
    network: string;
    asset: string;
    maxAmountPerCall: string;
    maxAmountPerTask: string;
    /** Amounts above this value require a separately issued, scoped approval. */
    humanApprovalAbove?: string;
};
export type BuyerPolicy = {
    schemaVersion: typeof BUYER_POLICY_SCHEMA_VERSION;
    policyId: string;
    policyVersion: string;
    approvedSchemes: string[];
    approvedResources: string[];
    approvedPayees: string[];
    assetRules: BuyerAssetRule[];
    requireValidatedSchema: boolean;
    settlement: {
        requirePaymentResponse: boolean;
        requireOnchainConfirmation: boolean;
    };
};
export type SchemaEvidence = {
    status: 'valid' | 'invalid' | 'not_checked';
    /** Optional digest from the validator. The policy does not trust a digest as
     * a substitute for the status supplied by that validator. */
    digest?: string;
};
export type HumanApproval = {
    approvalId: string;
    policyId: string;
    taskId: string;
    resource: string;
    network: string;
    asset: string;
    payee: string;
    maxAmount: string;
    expiresAt: string;
};
export type PaymentIntent = {
    taskId: string;
    /** URL the agent intends to call. */
    requestedResource: string;
    /** URL bound into the live x402 challenge. */
    declaredResource: string;
    requirement: PaymentRequirementLike;
    schema: SchemaEvidence;
    /** Unique identity for the authorization that will be signed. */
    authorizationId: string;
    approval?: HumanApproval;
};
export type BuyerPolicyCode = 'allowed' | 'invalid_policy' | 'invalid_intent' | 'unsupported_scheme' | 'resource_not_approved' | 'resource_mismatch' | 'network_not_approved' | 'asset_not_approved' | 'payee_not_approved' | 'invalid_amount' | 'call_limit_exceeded' | 'task_limit_exceeded' | 'schema_not_validated' | 'human_approval_required' | 'human_approval_invalid' | 'authorization_replayed' | 'receipt_missing' | 'receipt_unsuccessful' | 'receipt_network_mismatch' | 'receipt_payer_mismatch' | 'receipt_transaction_invalid' | 'settlement_evidence_missing' | 'settlement_indeterminate' | 'settlement_contradicted' | 'settlement_mismatch' | 'settlement_underpaid' | 'settlement_replayed';
export type PolicyDenial = {
    allowed: false;
    code: Exclude<BuyerPolicyCode, 'allowed'>;
    message: string;
};
export type PaymentAuthorization = {
    allowed: true;
    code: 'allowed';
    policyId: string;
    policyVersion: string;
    taskId: string;
    authorizationId: string;
    resource: string;
    scheme: string;
    network: string;
    asset: string;
    payee: string;
    amount: string;
    schemaDigest?: string;
};
export type PaymentPolicyDecision = PaymentAuthorization | PolicyDenial;
export type BudgetReservation = {
    policyId: string;
    taskId: string;
    authorizationId: string;
    network: string;
    asset: string;
    amount: string;
    maxAmountPerTask: string;
};
export type BudgetReservationResult = {
    reserved: true;
    spentAfter: string;
} | {
    reserved: false;
    reason: 'authorization_replayed' | 'task_limit_exceeded';
    spentBefore: string;
};
/**
 * Production adapters must make reserve() atomic. A database transaction,
 * Redis script, or durable-object mutation should claim authorizationId and
 * increment the task budget as one operation.
 */
export interface BuyerPolicyLedger {
    reserve(input: BudgetReservation): Promise<BudgetReservationResult>;
    claimSettlement(transaction: string): Promise<boolean>;
}
/** Verifies authenticity outside agent-controlled input (signature, operator
 * control plane, hardware approval, or another trusted authorization source). */
export type HumanApprovalVerifier = (approval: HumanApproval) => Promise<boolean>;
export type PaymentReceiptLike = {
    success: boolean;
    transaction?: string;
    network?: string;
    payer?: string;
};
export type OnchainSettlementEvidence = {
    status: 'confirmed';
    transaction: string;
    network: string;
    asset: string;
    payer: string;
    payTo: string;
    amount: string;
    blockNumber?: number;
} | {
    status: 'contradicted';
    reason: string;
} | {
    status: 'indeterminate';
    reason: string;
};
export type VerifiedSettlement = {
    verified: true;
    code: 'allowed';
    transaction: string;
    network: string;
    payer: string;
    amount: string;
    onchain: boolean;
};
export type SettlementDecision = VerifiedSettlement | (PolicyDenial & {
    verified: false;
});
/** Pure preflight. It does not reserve the task budget or claim a nonce. */
export declare function evaluatePaymentIntent(policy: BuyerPolicy, input: PaymentIntent, now?: Date, approvalAuthenticated?: boolean): PaymentPolicyDecision;
/**
 * Final pre-signing gate. A wallet must only be invoked after this returns
 * allowed. The ledger enforces per-task spend and nonce uniqueness atomically.
 */
export declare function authorizePayment(input: {
    policy: BuyerPolicy;
    intent: PaymentIntent;
    ledger: BuyerPolicyLedger;
    verifyHumanApproval?: HumanApprovalVerifier;
    now?: Date;
}): Promise<PaymentPolicyDecision>;
/** Verifies transport and chain evidence against the exact authorized terms. */
export declare function verifySettlement(input: {
    policy: BuyerPolicy;
    authorization: PaymentAuthorization;
    payer: string;
    receipt?: PaymentReceiptLike | null;
    onchain?: OnchainSettlementEvidence | null;
}): SettlementDecision;
/** Claims the confirmed transaction so one receipt cannot satisfy two tasks. */
export declare function verifyAndRecordSettlement(input: {
    policy: BuyerPolicy;
    authorization: PaymentAuthorization;
    payer: string;
    receipt?: PaymentReceiptLike | null;
    onchain?: OnchainSettlementEvidence | null;
    ledger: BuyerPolicyLedger;
}): Promise<SettlementDecision>;
/**
 * Reference ledger for examples and single-process agents. It is not a
 * distributed production ledger and intentionally says so in its name.
 */
export declare function createInMemoryBuyerPolicyLedger(): BuyerPolicyLedger;
//# sourceMappingURL=buyer-policy.d.ts.map