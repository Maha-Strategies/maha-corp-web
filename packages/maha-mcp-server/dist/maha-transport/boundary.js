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
export const TRANSPORT_BOUNDARY_VERSION = '1.0.0';
const SHARED_LIMITATIONS = [
    'This is a local evaluation transport. It is not a deployed service and has no availability characteristics.',
    'A digest commits two parties to the same bytes. It does not establish that those bytes are true, authentic, or produced by any named party.',
    'No provider was contacted, so nothing here reflects provider behaviour or compatibility.',
    'Token counts are model-neutral estimates, not a provider tokenizer.',
    'No performance, concurrency, or load characteristic is measured or implied.',
];
export function boundaryStatement(input) {
    return {
        boundaryVersion: TRANSPORT_BOUNDARY_VERSION,
        transport: { kind: input.kind, networkExposure: input.kind === 'stdio' ? 'none' : 'loopback' },
        verification: { ...input.verification },
        credentialsAccepted: false,
        credentialsReturned: false,
        sourceTextReturned: false,
        providerCallsMade: 0,
        paymentsInitiated: false,
        limitations: [...SHARED_LIMITATIONS, ...(input.limitations ?? [])],
    };
}
/**
 * Whether a field name denotes a credential.
 *
 * Substring matching is wrong here, and expensively so: `token` appears inside
 * `minimumCompileTokens`, which the agent card publishes as a legitimate policy
 * field, and `credential` appears inside `credentialsAccepted`, which is the
 * boundary statement declaring that credentials are *not* accepted. A naive
 * pattern rejects a valid task and flags a page's own disclaimer.
 *
 * So this splits the name into words and decides on those. `token` alone is
 * ambiguous — a bearer token and a token budget share a word — and is treated
 * as a credential only in the shapes that actually name one.
 */
const CREDENTIAL_WORDS = new Set(['secret', 'credential', 'credentials', 'password', 'passwd', 'passphrase', 'authorization', 'bearer', 'cookie']);
/** Two-word forms that only mean a credential together. */
const CREDENTIAL_PAIRS = new Set(['api key', 'api secret', 'api token', 'access key', 'access token', 'auth token', 'refresh token', 'id token', 'session token', 'private key', 'client secret', 'signing key']);
/** Words that make a `token` a measurement rather than a credential. */
const MEASUREMENT_WORDS = new Set(['budget', 'count', 'limit', 'estimate', 'estimated', 'max', 'maximum', 'min', 'minimum', 'total', 'used', 'remaining', 'per']);
function words(key) {
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_\-.]+/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
}
export function isCredentialFieldName(key) {
    const parts = words(key);
    if (parts.some((part) => CREDENTIAL_WORDS.has(part)))
        return true;
    for (let index = 0; index < parts.length - 1; index += 1) {
        if (CREDENTIAL_PAIRS.has(`${parts[index]} ${parts[index + 1]}`))
            return true;
    }
    // A bare `token` or `tokens` with no measurement word anywhere in the name.
    if (parts.includes('token') || parts.includes('tokens')) {
        return !parts.some((part) => MEASUREMENT_WORDS.has(part));
    }
    return false;
}
/**
 * Finds credential-shaped fields.
 *
 * `stringValuesOnly` is for scanning responses: a boundary statement says
 * `credentialsAccepted: false`, and a boolean declaring the absence of a
 * credential is not a credential. A leaked secret is a string.
 */
export function findCredentialFields(value, path = '$', found = [], options = {}) {
    if (Array.isArray(value)) {
        value.forEach((entry, index) => findCredentialFields(entry, `${path}[${index}]`, found, options));
        return found;
    }
    if (value && typeof value === 'object') {
        for (const [key, entry] of Object.entries(value)) {
            const suspicious = isCredentialFieldName(key) && (!options.stringValuesOnly || typeof entry === 'string');
            if (suspicious)
                found.push(`${path}.${key}`);
            findCredentialFields(entry, `${path}.${key}`, found, options);
        }
    }
    return found;
}
/** Longest string a metadata response may carry before it could be prose. */
export const MAX_RESPONSE_STRING_LENGTH = 400;
export function findUnboundedResponseStrings(value, path = '$', found = []) {
    if (typeof value === 'string') {
        if (value.length > MAX_RESPONSE_STRING_LENGTH)
            found.push({ path, length: value.length });
        return found;
    }
    if (Array.isArray(value)) {
        value.forEach((entry, index) => findUnboundedResponseStrings(entry, `${path}[${index}]`, found));
        return found;
    }
    if (value && typeof value === 'object') {
        for (const [key, entry] of Object.entries(value))
            findUnboundedResponseStrings(entry, `${path}.${key}`, found);
    }
    return found;
}
//# sourceMappingURL=boundary.js.map