/**
 * maha-context — evaluation CLI.
 *
 * Built for an architect assessing context control locally and for CI. Every
 * command is safe to run against a laptop with no credentials: nothing here
 * makes a provider call, and nothing prints a secret.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { GATEWAY_COMPILED_HEADER, GATEWAY_CONTRACT_VERSION, GATEWAY_INTERCEPTOR_TOKEN_HEADER, GATEWAY_MINIMUM_SECRET_LENGTH, GATEWAY_POLICY_VERSION, gatewayLimitsFrom, gatewaySecretFrom, } from "../integrations/gateway-context-gate.js";
const REDACTED = '[redacted]';
/**
 * Configuration health, without ever printing a secret.
 *
 * A secret is reported by presence and length class only. "Configured, 48
 * characters" tells an operator what they need; the value tells an attacker
 * what they need.
 */
export function doctor(environment = process.env) {
    const findings = [];
    const secret = gatewaySecretFrom(environment);
    if (!secret) {
        findings.push({ check: 'interceptor-secret', status: 'fail', detail: 'Neither MAHA_CONTEXT_INTERCEPTOR_SECRET nor WSO2_CONTEXT_INTERCEPTOR_SECRET is set.' });
    }
    else if (secret.length < GATEWAY_MINIMUM_SECRET_LENGTH) {
        findings.push({ check: 'interceptor-secret', status: 'fail', detail: `Configured but shorter than the ${GATEWAY_MINIMUM_SECRET_LENGTH}-character minimum, so every request will fail closed.` });
    }
    else {
        findings.push({ check: 'interceptor-secret', status: 'ok', detail: `Configured, ${secret.length} characters. Value ${REDACTED}.` });
    }
    const endpoint = environment.MAHA_COMPILER_URL?.trim();
    if (!endpoint) {
        findings.push({ check: 'compiler-endpoint', status: 'fail', detail: 'MAHA_COMPILER_URL is not set.' });
    }
    else {
        let parsed = null;
        try {
            parsed = new URL(endpoint);
        }
        catch {
            parsed = null;
        }
        if (!parsed) {
            findings.push({ check: 'compiler-endpoint', status: 'fail', detail: 'MAHA_COMPILER_URL is not a valid URL.' });
        }
        else if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
            findings.push({ check: 'compiler-endpoint', status: 'fail', detail: 'A non-local endpoint must use https.' });
        }
        else {
            findings.push({ check: 'compiler-endpoint', status: 'ok', detail: `${parsed.protocol}//${parsed.host}${parsed.pathname}` });
        }
    }
    const limits = gatewayLimitsFrom(environment);
    findings.push({ check: 'limits', status: 'ok', detail: `maxBodyBytes=${limits.maxBodyBytes} timeoutMs=${limits.timeoutMs} minimumCompileTokens=${limits.minimumCompileTokens}` });
    findings.push({ check: 'contract', status: 'ok', detail: `contract ${GATEWAY_CONTRACT_VERSION}, policy ${GATEWAY_POLICY_VERSION}` });
    return {
        status: findings.some((finding) => finding.status === 'fail') ? 'incomplete' : 'ok',
        findings,
        contractVersion: GATEWAY_CONTRACT_VERSION,
    };
}
/**
 * Compile one sanitized fixture against a configured endpoint.
 *
 * The result written to disk is evidence, not content: headers, outcome and
 * declared boundaries. The rewritten prompt is deliberately not persisted --
 * writing it would put source text in a file the caller may well commit.
 */
export async function compile(options) {
    const environment = options.environment ?? process.env;
    const health = doctor(environment);
    if (health.status !== 'ok') {
        throw new Error('Configuration is incomplete. Run `maha-context doctor` for the findings.');
    }
    const secret = gatewaySecretFrom(environment);
    const endpoint = environment.MAHA_COMPILER_URL.trim();
    const limits = gatewayLimitsFrom(environment);
    const raw = readFileSync(options.inputPath, 'utf8');
    if (Buffer.byteLength(raw, 'utf8') > limits.maxBodyBytes) {
        throw new Error(`Input exceeds the configured payload limit of ${limits.maxBodyBytes} bytes.`);
    }
    try {
        JSON.parse(raw);
    }
    catch {
        throw new Error('The input file is not valid JSON.');
    }
    const call = options.fetchImpl ?? fetch;
    const response = await call(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [GATEWAY_INTERCEPTOR_TOKEN_HEADER]: secret },
        body: raw,
        signal: AbortSignal.timeout(limits.timeoutMs),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        // The endpoint's message may quote caller input, so it is not echoed.
        throw new Error(`The compiler refused the request with HTTP ${response.status}.`);
    }
    if (payload?.outcome !== 'compiled' && payload?.outcome !== 'passthrough') {
        throw new Error('The compiler returned an unusable result.');
    }
    const headers = {};
    for (const name of [
        GATEWAY_COMPILED_HEADER, 'x-maha-input-hash', 'x-maha-output-hash',
        'x-maha-token-budget', 'x-maha-retained-passages', 'x-maha-source-coverage-bps', 'x-maha-policy-version',
    ]) {
        const value = response.headers.get(name);
        if (value)
            headers[name] = value;
    }
    const record = {
        contractVersion: GATEWAY_CONTRACT_VERSION,
        policyVersion: headers['x-maha-policy-version'] ?? GATEWAY_POLICY_VERSION,
        outcome: payload.outcome,
        ...(payload.reason ? { reason: payload.reason } : {}),
        headers,
        sourceTextRetained: false,
        credentialsRetained: false,
    };
    writeFileSync(options.outputPath, `${JSON.stringify(record, null, 2)}\n`);
    return record;
}
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
export function verify(record) {
    const findings = [];
    const add = (check, ok, verifiable, detail) => {
        findings.push({ check, status: ok ? 'ok' : 'fail', verifiable, detail });
    };
    const value = typeof record === 'object' && record !== null && !Array.isArray(record)
        ? record
        : null;
    if (!value) {
        return { status: 'invalid', findings: [{ check: 'shape', status: 'fail', verifiable: 'locally', detail: 'The evidence record must be a JSON object.' }] };
    }
    const headers = typeof value.headers === 'object' && value.headers !== null ? value.headers : {};
    const outcome = value.outcome;
    add('outcome', outcome === 'compiled' || outcome === 'passthrough', 'locally', `outcome=${String(outcome)}`);
    add('contract-version', typeof value.contractVersion === 'string' && value.contractVersion.length > 0, 'locally', String(value.contractVersion));
    add('policy-version', value.policyVersion === GATEWAY_POLICY_VERSION, 'locally', `expected ${GATEWAY_POLICY_VERSION}, found ${String(value.policyVersion)}`);
    add('retention-declared', value.sourceTextRetained === false && value.credentialsRetained === false, 'locally', 'sourceTextRetained and credentialsRetained must both be false');
    if (outcome === 'compiled') {
        for (const name of ['x-maha-input-hash', 'x-maha-output-hash']) {
            add(name, /^sha256:[0-9a-f]{64}$/.test(headers[name] ?? ''), 'locally', 'sha256:<64 lowercase hex>');
        }
        add('x-maha-compiled', headers[GATEWAY_COMPILED_HEADER] === 'true', 'locally', 'must be "true" on a compiled record');
        for (const name of ['x-maha-token-budget', 'x-maha-retained-passages', 'x-maha-source-coverage-bps']) {
            add(name, /^\d+$/.test(headers[name] ?? ''), 'locally', 'must be a non-negative integer');
        }
        const bps = Number(headers['x-maha-source-coverage-bps'] ?? -1);
        add('coverage-range', bps >= 0 && bps <= 10_000, 'locally', 'basis points must fall in 0..10000');
        // The hashes are well-formed. Whether they commit to the right bytes needs
        // the inputs, which an evidence record does not carry.
        findings.push({
            check: 'hash-binding', status: 'ok', verifiable: 'trusted-passthrough',
            detail: 'Hash format is checked here. Binding to the compiled bytes requires the original inputs and is not verifiable from this file.',
        });
    }
    else {
        add('passthrough-consistency', headers[GATEWAY_COMPILED_HEADER] === undefined, 'locally', 'a passthrough record must not claim x-maha-compiled');
    }
    return { status: findings.some((finding) => finding.status === 'fail') ? 'invalid' : 'ok', findings };
}
const GATEWAY_ARTIFACTS = {
    wso2: {
        path: 'integrations/wso2/README.md',
        must: [['neutral secret accepted', /MAHA_CONTEXT_INTERCEPTOR_SECRET/], ['evaluation credential stated', /evaluation credential/i]],
        mustNot: [],
    },
    kong: {
        path: 'integrations/kong/kong.declarative.yaml',
        must: [['secret read from environment', /secret_env:/], ['unroutable upstream', /\.invalid/]],
        mustNot: [['inline secret', /^\s*secret:\s*\S/m]],
    },
    apigee: {
        path: 'integrations/apigee/sharedflowbundle/policies/SC-MahaCompile.xml',
        must: [['credential from KVM', /\{private\.maha\.interceptor\.secret\}/], ['explicit timeout', /io\.timeout\.millis/]],
        mustNot: [['literal token', /Bearer\s+[A-Za-z0-9._-]{16,}/]],
    },
    cloudflare: {
        path: 'integrations/cloudflare-workers/wrangler.toml',
        must: [['secret via wrangler', /wrangler secret put MAHA_CONTEXT_INTERCEPTOR_SECRET/], ['unroutable placeholder', /\.invalid/]],
        mustNot: [['live route block', /^\s*\[\[routes\]\]/m]],
    },
};
/** Static validation only: reads files, deploys nothing, calls nothing. */
export function gatewayValidate(gateway, root = process.cwd()) {
    const spec = GATEWAY_ARTIFACTS[gateway];
    const checks = [];
    let source = '';
    try {
        source = readFileSync(`${root}/${spec.path}`, 'utf8');
        checks.push({ check: 'artifact-present', status: 'ok', detail: spec.path });
    }
    catch {
        return { gateway, status: 'invalid', checks: [{ check: 'artifact-present', status: 'fail', detail: `missing: ${spec.path}` }] };
    }
    for (const [check, pattern] of spec.must) {
        checks.push({ check, status: pattern.test(source) ? 'ok' : 'fail', detail: spec.path });
    }
    for (const [check, pattern] of spec.mustNot) {
        checks.push({ check: `no ${check}`, status: pattern.test(source) ? 'fail' : 'ok', detail: spec.path });
    }
    return { gateway, status: checks.some((entry) => entry.status === 'fail') ? 'invalid' : 'ok', checks };
}
export const GATEWAY_NAMES = ['wso2', 'kong', 'apigee', 'cloudflare'];
//# sourceMappingURL=index.js.map