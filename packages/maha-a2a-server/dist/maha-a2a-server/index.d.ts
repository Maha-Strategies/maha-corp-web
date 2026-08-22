import { type Server as HttpServer } from 'node:http';
/**
 * A local A2A HTTP server: a discoverable agent card and a task endpoint.
 *
 * Loopback by default and deliberately hard to widen. `host` exists because a
 * container sometimes needs 0.0.0.0, but binding anywhere other than a loopback
 * address requires `allowNonLoopback` to be passed explicitly — a reviewer
 * grepping for that flag finds every place exposure was chosen on purpose.
 */
export declare const A2A_CARD_PATH = "/.well-known/agent-card.json";
export declare const A2A_TASKS_PATH = "/tasks";
export type A2AServerOptions = {
    port?: number;
    host?: string;
    /** Required to bind anywhere other than loopback. Absent means loopback only. */
    allowNonLoopback?: boolean;
};
export type StartedA2AServer = {
    server: HttpServer;
    port: number;
    host: string;
    baseUrl: string;
    close: () => Promise<void>;
};
export declare function createMahaA2AServer(options?: A2AServerOptions): HttpServer;
export declare function startMahaA2AServer(options?: A2AServerOptions): Promise<StartedA2AServer>;
//# sourceMappingURL=index.d.ts.map