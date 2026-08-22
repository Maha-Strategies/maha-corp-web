import { createServer } from 'node:http';
import { a2aAgentCard, handleA2ATask } from "../maha-a2a/index.js";
import { boundaryStatement, findCredentialFields, findUnboundedResponseStrings } from "../maha-transport/boundary.js";
/**
 * A local A2A HTTP server: a discoverable agent card and a task endpoint.
 *
 * Loopback by default and deliberately hard to widen. `host` exists because a
 * container sometimes needs 0.0.0.0, but binding anywhere other than a loopback
 * address requires `allowNonLoopback` to be passed explicitly — a reviewer
 * grepping for that flag finds every place exposure was chosen on purpose.
 */
export const A2A_CARD_PATH = '/.well-known/agent-card.json';
export const A2A_TASKS_PATH = '/tasks';
const MAX_BODY_BYTES = 262_144;
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);
const TASK_VERIFICATION = {
    taskEnvelope: 'locally_verified',
    policyBudget: 'locally_verified',
    replayIdentity: 'locally_verified',
    documentContents: 'trusted_pass_through',
    documentAuthenticity: 'not_established',
    downstreamExecution: 'not_established',
};
function boundary() {
    return boundaryStatement({ kind: 'http_loopback', verification: TASK_VERIFICATION });
}
export function createMahaA2AServer(options = {}) {
    const host = options.host ?? '127.0.0.1';
    return createServer((request, response) => {
        const send = (status, body) => {
            const payload = JSON.stringify(body);
            response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
            response.end(payload);
        };
        if (request.method === 'GET' && request.url === A2A_CARD_PATH) {
            const address = request.socket.localPort ?? options.port ?? 0;
            return send(200, { ...a2aAgentCard(`http://${host}:${address}`), boundary: boundary() });
        }
        if (request.method !== 'POST' || request.url !== A2A_TASKS_PATH) {
            return send(404, { error: { code: 'not_found', message: `This agent serves ${A2A_CARD_PATH} and ${A2A_TASKS_PATH}.` }, boundary: boundary() });
        }
        let raw = '';
        let aborted = false;
        request.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > MAX_BODY_BYTES && !aborted) {
                aborted = true;
                send(413, { error: { code: 'payload_too_large', message: `A task must be under ${MAX_BODY_BYTES} bytes.` }, boundary: boundary() });
                request.destroy();
            }
        });
        request.on('end', () => {
            if (aborted)
                return;
            let parsed;
            try {
                parsed = JSON.parse(raw);
            }
            catch {
                return send(400, { error: { code: 'invalid_json', message: 'The task body must be valid JSON.' }, boundary: boundary() });
            }
            // Credentials are refused at the transport too, not only in the handler,
            // so a credential never reaches application code in the first place.
            const offending = findCredentialFields(parsed, 'task');
            if (offending.length > 0) {
                return send(400, { error: { code: 'credential_rejected', message: `This agent never accepts credentials. Remove: ${offending.join(', ')}.` }, boundary: boundary() });
            }
            const result = { ...handleA2ATask(parsed), boundary: boundary() };
            const unbounded = findUnboundedResponseStrings(result);
            if (unbounded.length > 0) {
                return send(500, { error: { code: 'response_not_metadata', message: `Refused to return an unbounded string at ${unbounded[0].path}.` }, boundary: boundary() });
            }
            // The handler's own state decides the status: a rejected task is a
            // well-formed answer about an unacceptable request, not a server error.
            send(result.state === 'rejected' ? 400 : 200, result);
        });
    });
}
export async function startMahaA2AServer(options = {}) {
    const host = options.host ?? '127.0.0.1';
    if (!LOOPBACK.has(host) && options.allowNonLoopback !== true) {
        throw new Error(`Refusing to bind ${host}: pass allowNonLoopback to expose this server beyond loopback.`);
    }
    const server = createMahaA2AServer({ ...options, host });
    await new Promise((resolve) => server.listen(options.port ?? 0, host, resolve));
    const port = server.address().port;
    return {
        server, port, host,
        baseUrl: `http://${host}:${port}`,
        close: () => new Promise((resolve) => server.close(() => resolve())),
    };
}
//# sourceMappingURL=index.js.map