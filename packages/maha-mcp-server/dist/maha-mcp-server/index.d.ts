import { Server } from '@modelcontextprotocol/sdk/server/index.js';
export type McpServerOptions = {
    /** Overridable for tests; defaults to the process environment. */
    environment?: NodeJS.ProcessEnv;
    root?: string;
};
export declare function createMahaMcpServer(options?: McpServerOptions): Server;
/** Starts the server on stdio. Returns when the transport closes. */
export declare function startMahaMcpStdioServer(options?: McpServerOptions): Promise<void>;
//# sourceMappingURL=index.d.ts.map