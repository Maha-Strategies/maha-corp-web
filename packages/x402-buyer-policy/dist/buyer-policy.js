/**
 * Vendor-neutral buyer controls for x402 clients.
 *
 * This module never discovers resources, holds keys, signs authorizations, or
 * submits payments. It produces an auditable decision immediately before a
 * wallet is invoked, and verifies the evidence returned after settlement.
 */
export const BUYER_POLICY_SCHEMA_VERSION = '1.0.0';
const CAIP_2 = /^[a-z0-9]+:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const TRANSACTION = /^0x[a-fA-F0-9]{64}$/;
const BOUNDED_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$/;
function deny(code, message) {
    return { allowed: false, code, message };
}
function parsePositiveInteger(value) {
    if (!/^[1-9][0-9]*$/.test(value))
        return null;
    try {
        return BigInt(value);
    }
    catch {
        return null;
    }
}
function parseNonNegativeInteger(value) {
    if (!/^(?:0|[1-9][0-9]*)$/.test(value))
        return null;
    try {
        return BigInt(value);
    }
    catch {
        return null;
    }
}
function normalizedIdentifier(value, network) {
    return network.startsWith('eip155:') ? value.toLowerCase() : value;
}
function canonicalResource(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.hash)
            return null;
        return url.toString();
    }
    catch {
        return null;
    }
}
function assetRule(policy, requirement) {
    return policy.assetRules.find((candidate) => candidate.network === requirement.network
        && normalizedIdentifier(candidate.asset, candidate.network) === normalizedIdentifier(requirement.asset, requirement.network)) ?? null;
}
function validatePolicy(policy) {
    if (policy.schemaVersion !== BUYER_POLICY_SCHEMA_VERSION)
        return 'Unsupported buyer policy schemaVersion.';
    if (!BOUNDED_ID.test(policy.policyId) || !policy.policyVersion.trim())
        return 'policyId or policyVersion is invalid.';
    if (policy.approvedSchemes.length === 0 || policy.approvedResources.length === 0 || policy.approvedPayees.length === 0 || policy.assetRules.length === 0)
        return 'Buyer policy allowlists cannot be empty.';
    if (policy.approvedResources.some((resource) => !canonicalResource(resource)))
        return 'Every approved resource must be an exact public HTTPS URL without credentials or fragments.';
    for (const rule of policy.assetRules) {
        const call = parsePositiveInteger(rule.maxAmountPerCall);
        const task = parsePositiveInteger(rule.maxAmountPerTask);
        const approval = rule.humanApprovalAbove === undefined ? null : parseNonNegativeInteger(rule.humanApprovalAbove);
        if (!CAIP_2.test(rule.network) || !rule.asset || !call || !task || call > task)
            return 'Buyer policy asset limits are invalid.';
        if (rule.network.startsWith('eip155:') && !EVM_ADDRESS.test(rule.asset))
            return 'An EVM asset must be a contract address.';
        if (rule.humanApprovalAbove !== undefined && (approval === null || approval > call))
            return 'humanApprovalAbove must be non-negative and no greater than maxAmountPerCall.';
    }
    const assetRuleIds = policy.assetRules.map((rule) => `${rule.network}:${normalizedIdentifier(rule.asset, rule.network)}`);
    if (new Set(assetRuleIds).size !== assetRuleIds.length)
        return 'Buyer policy asset rules must be unique by network and asset.';
    if (typeof policy.settlement.requirePaymentResponse !== 'boolean' || typeof policy.settlement.requireOnchainConfirmation !== 'boolean')
        return 'Settlement evidence controls must be boolean.';
    if (!policy.settlement.requirePaymentResponse && !policy.settlement.requireOnchainConfirmation)
        return 'At least one settlement evidence control must be required.';
    return null;
}
function approvalCovers(input, policy, amount, now) {
    const approval = input.approval;
    if (!approval)
        return false;
    const resource = canonicalResource(approval.resource);
    const expiresAt = Date.parse(approval.expiresAt);
    const maxAmount = parsePositiveInteger(approval.maxAmount);
    return BOUNDED_ID.test(approval.approvalId)
        && approval.policyId === policy.policyId
        && approval.taskId === input.taskId
        && resource === canonicalResource(input.requestedResource)
        && approval.network === input.requirement.network
        && normalizedIdentifier(approval.asset, approval.network) === normalizedIdentifier(input.requirement.asset, input.requirement.network)
        && normalizedIdentifier(approval.payee, approval.network) === normalizedIdentifier(input.requirement.payTo, input.requirement.network)
        && maxAmount !== null
        && maxAmount >= amount
        && Number.isFinite(expiresAt)
        && expiresAt > now.getTime();
}
/** Pure preflight. It does not reserve the task budget or claim a nonce. */
export function evaluatePaymentIntent(policy, input, now = new Date(), approvalAuthenticated = false) {
    const policyError = validatePolicy(policy);
    if (policyError)
        return deny('invalid_policy', policyError);
    if (!BOUNDED_ID.test(input.taskId) || !BOUNDED_ID.test(input.authorizationId))
        return deny('invalid_intent', 'taskId and authorizationId must be bounded stable identifiers.');
    const requestedResource = canonicalResource(input.requestedResource);
    const declaredResource = canonicalResource(input.declaredResource);
    if (!requestedResource || !declaredResource)
        return deny('invalid_intent', 'Requested and declared resources must be exact public HTTPS URLs.');
    if (!policy.approvedResources.map(canonicalResource).includes(requestedResource))
        return deny('resource_not_approved', 'The requested resource is not allowlisted.');
    if (requestedResource !== declaredResource)
        return deny('resource_mismatch', 'The live challenge is bound to a different resource.');
    const requirement = input.requirement;
    if (!policy.approvedSchemes.includes(requirement.scheme))
        return deny('unsupported_scheme', 'The payment scheme is not approved.');
    const rule = assetRule(policy, requirement);
    if (!rule) {
        const networkKnown = policy.assetRules.some((candidate) => candidate.network === requirement.network);
        return deny(networkKnown ? 'asset_not_approved' : 'network_not_approved', networkKnown ? 'The asset is not approved on this network.' : 'The network is not approved.');
    }
    if (requirement.network.startsWith('eip155:') && (!EVM_ADDRESS.test(requirement.payTo) || !EVM_ADDRESS.test(requirement.asset)))
        return deny('invalid_intent', 'The EVM asset or payee is malformed.');
    const payee = normalizedIdentifier(requirement.payTo, requirement.network);
    if (!policy.approvedPayees.some((candidate) => normalizedIdentifier(candidate, requirement.network) === payee))
        return deny('payee_not_approved', 'The payee is not allowlisted.');
    const amount = parsePositiveInteger(requirement.amount);
    const callLimit = parsePositiveInteger(rule.maxAmountPerCall);
    if (!amount)
        return deny('invalid_amount', 'The amount must be a positive integer in asset base units.');
    if (amount > callLimit)
        return deny('call_limit_exceeded', 'The payment exceeds the per-call ceiling.');
    if (policy.requireValidatedSchema && input.schema.status !== 'valid')
        return deny('schema_not_validated', 'A valid discovery schema is required before signing.');
    const approvalThreshold = rule.humanApprovalAbove === undefined ? null : parseNonNegativeInteger(rule.humanApprovalAbove);
    if (approvalThreshold !== null && amount > approvalThreshold) {
        if (!input.approval)
            return deny('human_approval_required', 'This amount requires scoped human approval.');
        if (!approvalCovers(input, policy, amount, now))
            return deny('human_approval_invalid', 'The human approval is expired or does not bind every payment term.');
        if (!approvalAuthenticated)
            return deny('human_approval_required', 'The scoped approval must be authenticated by a trusted verifier.');
    }
    return {
        allowed: true,
        code: 'allowed',
        policyId: policy.policyId,
        policyVersion: policy.policyVersion,
        taskId: input.taskId,
        authorizationId: input.authorizationId,
        resource: requestedResource,
        scheme: requirement.scheme,
        network: requirement.network,
        asset: requirement.asset,
        payee: requirement.payTo,
        amount: requirement.amount,
        ...(input.schema.digest ? { schemaDigest: input.schema.digest } : {}),
    };
}
/**
 * Final pre-signing gate. A wallet must only be invoked after this returns
 * allowed. The ledger enforces per-task spend and nonce uniqueness atomically.
 */
export async function authorizePayment(input) {
    let decision = evaluatePaymentIntent(input.policy, input.intent, input.now);
    if (!decision.allowed && decision.code === 'human_approval_required' && input.intent.approval && input.verifyHumanApproval) {
        const authenticated = await input.verifyHumanApproval(input.intent.approval);
        if (!authenticated)
            return deny('human_approval_invalid', 'The trusted approval verifier rejected this approval.');
        decision = evaluatePaymentIntent(input.policy, input.intent, input.now, true);
    }
    if (!decision.allowed)
        return decision;
    const rule = assetRule(input.policy, input.intent.requirement);
    const reserved = await input.ledger.reserve({
        policyId: decision.policyId,
        taskId: decision.taskId,
        authorizationId: decision.authorizationId,
        network: decision.network,
        asset: decision.asset,
        amount: decision.amount,
        maxAmountPerTask: rule.maxAmountPerTask,
    });
    if (!reserved.reserved) {
        return deny(reserved.reason, reserved.reason === 'authorization_replayed'
            ? 'This authorization identity has already been reserved.'
            : 'The payment would exceed the task budget.');
    }
    return decision;
}
function settlementDenial(code, message) {
    return { ...deny(code, message), verified: false };
}
/** Verifies transport and chain evidence against the exact authorized terms. */
export function verifySettlement(input) {
    const { policy, authorization, payer, receipt, onchain } = input;
    if (policy.settlement.requirePaymentResponse && !receipt)
        return settlementDenial('receipt_missing', 'PAYMENT-RESPONSE is required.');
    if (receipt) {
        if (receipt.success !== true)
            return settlementDenial('receipt_unsuccessful', 'The receipt does not report successful settlement.');
        if (receipt.network !== authorization.network)
            return settlementDenial('receipt_network_mismatch', 'The receipt network differs from the authorized network.');
        if (normalizedIdentifier(receipt.payer ?? '', authorization.network) !== normalizedIdentifier(payer, authorization.network))
            return settlementDenial('receipt_payer_mismatch', 'The receipt payer differs from the signing wallet.');
        if (!TRANSACTION.test(receipt.transaction ?? ''))
            return settlementDenial('receipt_transaction_invalid', 'The receipt transaction identifier is missing or malformed.');
    }
    if (policy.settlement.requireOnchainConfirmation && !onchain)
        return settlementDenial('settlement_evidence_missing', 'Independent on-chain settlement evidence is required.');
    if (onchain?.status === 'indeterminate')
        return settlementDenial('settlement_indeterminate', `On-chain settlement is indeterminate: ${onchain.reason}`);
    if (onchain?.status === 'contradicted')
        return settlementDenial('settlement_contradicted', `On-chain evidence contradicts settlement: ${onchain.reason}`);
    if (onchain?.status === 'confirmed') {
        const identifiersMatch = (!receipt?.transaction || onchain.transaction.toLowerCase() === receipt.transaction.toLowerCase())
            && onchain.network === authorization.network
            && normalizedIdentifier(onchain.asset, onchain.network) === normalizedIdentifier(authorization.asset, authorization.network)
            && normalizedIdentifier(onchain.payer, onchain.network) === normalizedIdentifier(payer, authorization.network)
            && normalizedIdentifier(onchain.payTo, onchain.network) === normalizedIdentifier(authorization.payee, authorization.network);
        if (!identifiersMatch)
            return settlementDenial('settlement_mismatch', 'On-chain evidence does not bind to the authorized transaction terms.');
        const settledAmount = parsePositiveInteger(onchain.amount);
        if (!settledAmount || settledAmount < BigInt(authorization.amount))
            return settlementDenial('settlement_underpaid', 'The confirmed transfer is smaller than the authorized amount.');
    }
    const transaction = receipt?.transaction ?? (onchain?.status === 'confirmed' ? onchain.transaction : undefined);
    if (!transaction)
        return settlementDenial('settlement_evidence_missing', 'No verifiable settlement transaction was supplied.');
    return {
        verified: true,
        code: 'allowed',
        transaction,
        network: authorization.network,
        payer,
        amount: authorization.amount,
        onchain: onchain?.status === 'confirmed',
    };
}
/** Claims the confirmed transaction so one receipt cannot satisfy two tasks. */
export async function verifyAndRecordSettlement(input) {
    const decision = verifySettlement(input);
    if (!decision.verified)
        return decision;
    if (!await input.ledger.claimSettlement(decision.transaction.toLowerCase())) {
        return settlementDenial('settlement_replayed', 'This settlement transaction has already been consumed.');
    }
    return decision;
}
/**
 * Reference ledger for examples and single-process agents. It is not a
 * distributed production ledger and intentionally says so in its name.
 */
export function createInMemoryBuyerPolicyLedger() {
    const authorizations = new Set();
    const settlements = new Set();
    const taskSpend = new Map();
    return {
        async reserve(input) {
            const authorizationKey = `${input.policyId}:${input.authorizationId}`;
            const taskKey = `${input.policyId}:${input.taskId}:${input.network}:${normalizedIdentifier(input.asset, input.network)}`;
            const spentBefore = taskSpend.get(taskKey) ?? BigInt(0);
            if (authorizations.has(authorizationKey))
                return { reserved: false, reason: 'authorization_replayed', spentBefore: spentBefore.toString() };
            const spentAfter = spentBefore + BigInt(input.amount);
            if (spentAfter > BigInt(input.maxAmountPerTask))
                return { reserved: false, reason: 'task_limit_exceeded', spentBefore: spentBefore.toString() };
            authorizations.add(authorizationKey);
            taskSpend.set(taskKey, spentAfter);
            return { reserved: true, spentAfter: spentAfter.toString() };
        },
        async claimSettlement(transaction) {
            const key = transaction.toLowerCase();
            if (settlements.has(key))
                return false;
            settlements.add(key);
            return true;
        },
    };
}
//# sourceMappingURL=buyer-policy.js.map