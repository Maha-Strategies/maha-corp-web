/**
 * Application-owned controls for an AgentCore Payments x402 purchase.
 *
 * The model may request a resource and purpose. Application code supplies the
 * policy, approval, request identities, payer, payment-session adapter, and
 * settlement verifier. This module never holds a wallet key and never retries
 * a paid request.
 */
import { type BuyerPolicy, type BuyerPolicyCode, type BuyerPolicyLedger, type HumanApproval, type HumanApprovalVerifier, type OnchainSettlementEvidence, type PaymentAuthorization, type PaymentReceiptLike, type PaymentRequirementLike, type SchemaEvidence } from './buyer-policy.ts';
export declare const AGENTCORE_ADAPTER_VERSION: "0.1.0";
/** Dependency-free function-tool declaration for the Responses API or Agents SDK. */
export declare const CONTROLLED_X402_FETCH_TOOL: {
    readonly type: "function";
    readonly name: "x402_fetch";
    readonly description: "Request one application-approved paid resource for an approved business purpose.";
    readonly parameters: {
        readonly type: "object";
        readonly properties: {
            readonly resource_url: {
                readonly type: "string";
                readonly format: "uri";
            };
            readonly purpose: {
                readonly type: "string";
            };
        };
        readonly required: readonly ["resource_url", "purpose"];
        readonly additionalProperties: false;
    };
    readonly strict: true;
};
export type AgentPurchaseRequest = {
    /** The model may propose these two fields. Everything else is application-owned. */
    resourceUrl: string;
    purpose: string;
};
export type ApplicationPurchaseControl = {
    requestId: string;
    taskId: string;
    authorizationId: string;
    idempotencyKey: string;
    approval?: HumanApproval;
};
export type MerchantChallenge = {
    declaredResource: string;
    requirement: PaymentRequirementLike;
    schema: SchemaEvidence;
};
export type MerchantPaidResponse<Report> = {
    status: number;
    report: Report;
    /** Exact response bytes, hashed for application evidence without retaining content. */
    responseBytes: Uint8Array;
    receipt?: PaymentReceiptLike | null;
};
export interface AgentCoreMerchantAdapter<Report> {
    inspect(resourceUrl: string): Promise<MerchantChallenge>;
    redeem(input: {
        resourceUrl: string;
        paymentHeader: string;
        idempotencyKey: string;
    }): Promise<MerchantPaidResponse<Report>>;
}
export type AgentCorePaymentSessionRequest = {
    requestId: string;
    purpose: string;
    resource: string;
    network: string;
    asset: string;
    payee: string;
    maximumAmount: string;
    expiresAt: string;
};
export type AgentCorePaymentSession = {
    /** Opaque provider state. It is never returned to the model or audit output. */
    handle: unknown;
};
export interface AgentCorePaymentsAdapter {
    createSession(input: AgentCorePaymentSessionRequest): Promise<AgentCorePaymentSession>;
    createPaymentProof(input: {
        session: AgentCorePaymentSession;
        authorization: PaymentAuthorization;
        idempotencyKey: string;
    }): Promise<{
        paymentHeader: string;
    }>;
    deleteSession(session: AgentCorePaymentSession): Promise<void>;
}
export type CommerceAuditEventType = 'request_received' | 'challenge_inspected' | 'policy_allowed' | 'policy_denied' | 'session_created' | 'proof_created' | 'merchant_accepted' | 'settlement_verified' | 'session_deleted' | 'session_cleanup_failed';
export type CommerceAuditEvent = {
    sequence: number;
    eventType: CommerceAuditEventType;
    outcome: 'allowed' | 'denied' | 'completed' | 'failed';
    code?: string;
};
export type AgentPurchaseEvidence<Report> = {
    status: 'completed';
    report: Report;
    receiptReference: string;
    responseHash: string;
    amount: string;
    network: string;
    settlementVerified: true;
    auditEvents: CommerceAuditEvent[];
};
export type AgentCoreControlledCommerceConfig<Report> = {
    policy: BuyerPolicy;
    ledger: BuyerPolicyLedger;
    approvedPurposes: string[];
    payer: string;
    merchant: AgentCoreMerchantAdapter<Report>;
    payments: AgentCorePaymentsAdapter;
    confirmSettlement(input: {
        authorization: PaymentAuthorization;
        receipt?: PaymentReceiptLike | null;
    }): Promise<OnchainSettlementEvidence>;
    verifyHumanApproval?: HumanApprovalVerifier;
    now?: () => Date;
    /** Short-lived by design. The adapter refuses values above fifteen minutes. */
    sessionDurationSeconds?: number;
};
export type ControlledCommerceErrorCode = BuyerPolicyCode | 'access_count_invalid' | 'purpose_not_approved' | 'invalid_control' | 'payment_session_invalid' | 'payment_proof_invalid' | 'merchant_delivery_failed' | 'session_cleanup_failed';
export declare class ControlledCommerceError extends Error {
    readonly code: ControlledCommerceErrorCode;
    readonly auditEvents: CommerceAuditEvent[];
    constructor(code: ControlledCommerceErrorCode, message: string, auditEvents: CommerceAuditEvent[], options?: ErrorOptions);
}
/** Parses the only two fields a model is allowed to propose. */
export declare function parseAgentPurchaseArguments(value: string | unknown): AgentPurchaseRequest;
/**
 * Creates one economic tool capability. The returned purchase function can be
 * invoked at most once, even when its first call is denied. A new agent run
 * must create a new tool capability.
 */
export declare function createAgentCoreControlledCommerceTool<Report>(config: AgentCoreControlledCommerceConfig<Report>): {
    purchase(request: AgentPurchaseRequest, control: ApplicationPurchaseControl): Promise<AgentPurchaseEvidence<Report>>;
};
export * from './buyer-policy.ts';
//# sourceMappingURL=agentcore.d.ts.map