/**
 * Application-owned controls for an AgentCore Payments x402 purchase.
 *
 * The model may request a resource and purpose. Application code supplies the
 * policy, approval, request identities, payer, payment-session adapter, and
 * settlement verifier. This module never holds a wallet key and never retries
 * a paid request.
 */
import { createHash } from 'node:crypto';
import { authorizePayment, verifyAndRecordSettlement, } from "./buyer-policy.js";
export const AGENTCORE_ADAPTER_VERSION = '0.1.0';
/** Dependency-free function-tool declaration for the Responses API or Agents SDK. */
export const CONTROLLED_X402_FETCH_TOOL = {
    type: 'function',
    name: 'x402_fetch',
    description: 'Request one application-approved paid resource for an approved business purpose.',
    parameters: {
        type: 'object',
        properties: {
            resource_url: { type: 'string', format: 'uri' },
            purpose: { type: 'string' },
        },
        required: ['resource_url', 'purpose'],
        additionalProperties: false,
    },
    strict: true,
};
export class ControlledCommerceError extends Error {
    code;
    auditEvents;
    constructor(code, message, auditEvents, options) {
        super(message, options);
        this.name = 'ControlledCommerceError';
        this.code = code;
        this.auditEvents = auditEvents.map((event) => ({ ...event }));
    }
}
const BOUNDED_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$/;
const PURPOSE = /^[a-z][a-z0-9_.:-]{2,99}$/;
function sha256(value) {
    return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
function copyAudit(events) {
    return events.map((event) => ({ ...event }));
}
/** Parses the only two fields a model is allowed to propose. */
export function parseAgentPurchaseArguments(value) {
    let parsed = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        }
        catch {
            throw new Error('The x402_fetch arguments are not valid JSON.');
        }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('The x402_fetch arguments must be an object.');
    const record = parsed;
    const keys = Object.keys(record).sort();
    if (keys.length !== 2 || keys[0] !== 'purpose' || keys[1] !== 'resource_url')
        throw new Error('The model may provide only resource_url and purpose.');
    if (typeof record.resource_url !== 'string' || typeof record.purpose !== 'string')
        throw new Error('resource_url and purpose must be strings.');
    let resource;
    try {
        resource = new URL(record.resource_url);
    }
    catch {
        throw new Error('resource_url must be an absolute URL.');
    }
    if (resource.protocol !== 'https:' || resource.username || resource.password || resource.hash)
        throw new Error('resource_url must be public HTTPS without credentials or a fragment.');
    if (!PURPOSE.test(record.purpose))
        throw new Error('purpose must be a bounded machine identifier.');
    return { resourceUrl: resource.toString(), purpose: record.purpose };
}
function isAuthorization(decision) {
    return decision.allowed === true;
}
function isVerifiedSettlement(decision) {
    return decision.verified === true;
}
/**
 * Creates one economic tool capability. The returned purchase function can be
 * invoked at most once, even when its first call is denied. A new agent run
 * must create a new tool capability.
 */
export function createAgentCoreControlledCommerceTool(config) {
    let used = false;
    return {
        async purchase(request, control) {
            const audit = [];
            const record = (eventType, outcome, code) => {
                audit.push({ sequence: audit.length + 1, eventType, outcome, ...(code ? { code } : {}) });
            };
            const fail = (code, message, cause) => {
                throw new ControlledCommerceError(code, message, copyAudit(audit), cause instanceof Error ? { cause } : undefined);
            };
            if (used)
                fail('access_count_invalid', 'This economic tool capability permits exactly one invocation.');
            used = true;
            record('request_received', 'completed');
            if (!BOUNDED_ID.test(control.requestId) || !BOUNDED_ID.test(control.taskId) || !BOUNDED_ID.test(control.authorizationId) || !BOUNDED_ID.test(control.idempotencyKey)) {
                fail('invalid_control', 'Application-owned request, task, authorization, and idempotency identities must be bounded stable identifiers.');
            }
            if (!PURPOSE.test(request.purpose) || !config.approvedPurposes.includes(request.purpose)) {
                record('policy_denied', 'denied', 'purpose_not_approved');
                fail('purpose_not_approved', 'The requested business purpose is not approved.');
            }
            const duration = config.sessionDurationSeconds ?? 300;
            if (!Number.isInteger(duration) || duration < 30 || duration > 900) {
                fail('payment_session_invalid', 'Payment sessions must last between 30 and 900 seconds.');
            }
            const challenge = await config.merchant.inspect(request.resourceUrl).catch((error) => fail('merchant_delivery_failed', 'The merchant challenge could not be inspected.', error));
            record('challenge_inspected', 'completed');
            const now = (config.now ?? (() => new Date()))();
            const decision = await authorizePayment({
                policy: config.policy,
                ledger: config.ledger,
                intent: {
                    taskId: control.taskId,
                    authorizationId: control.authorizationId,
                    requestedResource: request.resourceUrl,
                    declaredResource: challenge.declaredResource,
                    requirement: challenge.requirement,
                    schema: challenge.schema,
                    ...(control.approval ? { approval: control.approval } : {}),
                },
                verifyHumanApproval: config.verifyHumanApproval,
                now,
            });
            if (!isAuthorization(decision)) {
                record('policy_denied', 'denied', decision.code);
                fail(decision.code, decision.message);
            }
            const authorization = decision;
            record('policy_allowed', 'allowed');
            let session = null;
            let completed = null;
            let failure = null;
            try {
                session = await config.payments.createSession({
                    requestId: control.requestId,
                    purpose: request.purpose,
                    resource: authorization.resource,
                    network: authorization.network,
                    asset: authorization.asset,
                    payee: authorization.payee,
                    maximumAmount: authorization.amount,
                    expiresAt: new Date(now.getTime() + duration * 1000).toISOString(),
                }).catch((error) => fail('payment_session_invalid', 'The bounded payment session could not be created.', error));
                if (!session || !('handle' in session) || session.handle === null || session.handle === undefined) {
                    fail('payment_session_invalid', 'AgentCore Payments returned no usable session handle.');
                }
                record('session_created', 'completed');
                const proof = await config.payments.createPaymentProof({
                    session,
                    authorization,
                    idempotencyKey: control.idempotencyKey,
                }).catch((error) => fail('payment_proof_invalid', 'The bounded payment proof could not be created.', error));
                if (!proof || typeof proof.paymentHeader !== 'string' || proof.paymentHeader.trim().length < 8) {
                    fail('payment_proof_invalid', 'AgentCore Payments returned no usable payment proof.');
                }
                record('proof_created', 'completed');
                const paid = await config.merchant.redeem({
                    resourceUrl: authorization.resource,
                    paymentHeader: proof.paymentHeader,
                    idempotencyKey: control.idempotencyKey,
                }).catch((error) => fail('merchant_delivery_failed', 'The paid merchant request failed.', error));
                if (paid.status !== 200)
                    fail('merchant_delivery_failed', `The paid merchant request returned HTTP ${paid.status}.`);
                record('merchant_accepted', 'completed');
                let onchain;
                try {
                    onchain = await config.confirmSettlement({ authorization, receipt: paid.receipt });
                }
                catch {
                    onchain = { status: 'indeterminate', reason: 'settlement_verifier_failed' };
                }
                const settlement = await verifyAndRecordSettlement({
                    policy: config.policy,
                    authorization,
                    payer: config.payer,
                    receipt: paid.receipt,
                    onchain,
                    ledger: config.ledger,
                });
                if (!isVerifiedSettlement(settlement))
                    fail(settlement.code, settlement.message);
                const verified = settlement;
                record('settlement_verified', 'completed');
                completed = {
                    status: 'completed',
                    report: paid.report,
                    receiptReference: sha256(verified.transaction.toLowerCase()),
                    responseHash: sha256(paid.responseBytes),
                    amount: verified.amount,
                    network: verified.network,
                    settlementVerified: true,
                    auditEvents: [],
                };
            }
            catch (error) {
                failure = error instanceof ControlledCommerceError
                    ? error
                    : new ControlledCommerceError('merchant_delivery_failed', 'The controlled purchase failed.', copyAudit(audit), error instanceof Error ? { cause: error } : undefined);
            }
            finally {
                if (session) {
                    try {
                        await config.payments.deleteSession(session);
                        record('session_deleted', 'completed');
                    }
                    catch (error) {
                        record('session_cleanup_failed', 'failed', 'session_cleanup_failed');
                        failure = new ControlledCommerceError('session_cleanup_failed', 'The bounded payment session could not be deleted; operator recovery is required before another run.', copyAudit(audit), error instanceof Error ? { cause: error } : undefined);
                    }
                }
            }
            if (failure) {
                throw new ControlledCommerceError(failure.code, failure.message, copyAudit(audit), failure.cause instanceof Error ? { cause: failure.cause } : undefined);
            }
            if (completed === null) {
                throw new ControlledCommerceError('merchant_delivery_failed', 'The controlled purchase ended without a deliverable.', copyAudit(audit));
            }
            const evidence = completed;
            return { ...evidence, auditEvents: copyAudit(audit) };
        },
    };
}
// The AgentCore adapter is also a standalone package entry point. Re-exporting
// the canonical engine avoids maintaining a second policy implementation.
export * from "./buyer-policy.js";
//# sourceMappingURL=agentcore.js.map