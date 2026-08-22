export declare const MCP_SERVER_NAME = "maha-context-control";
export declare const MCP_SERVER_VERSION = "0.1.0";
export type McpToolName = 'context_control.describe' | 'context_control.validate_request' | 'context_control.compile_sanitized' | 'context_control.verify_evidence' | 'context_control.gateway_status';
/** The complete dispatch table. There is no sixth entry, hidden or otherwise. */
export declare const MCP_TOOLS: readonly {
    name: McpToolName;
    description: string;
    inputSchema: Record<string, unknown>;
    readOnly: boolean;
}[];
/** Attached to every response, so a caller never has to infer the boundary. */
export declare const EVIDENCE_BOUNDARY: {
    readonly sourceTextReturned: false;
    readonly credentialsAccepted: false;
    readonly credentialsReturned: false;
    readonly providerCallsMade: 0;
    readonly limitations: readonly ["Token counts are model-neutral estimates, not provider tokenizer counts.", "Selection is extractive ranking and de-duplication. It does not verify claims.", "Structural verification checks format and consistency, not that a hash commits to bytes this tool never saw.", "Gateway status is static artifact validation, not a deployment check."];
};
export type McpToolResult = {
    ok: true;
    tool: McpToolName;
    result: unknown;
    boundary: typeof EVIDENCE_BOUNDARY;
} | {
    ok: false;
    tool: McpToolName;
    error: {
        code: string;
        message: string;
    };
    boundary: typeof EVIDENCE_BOUNDARY;
};
/**
 * Dispatch one tool call.
 *
 * A credential is never an argument: `compile_sanitized` reads the secret from
 * the environment, so a model driving this surface cannot supply, learn, or
 * exfiltrate one through a tool call.
 */
export declare function callMcpTool(name: string, args?: Record<string, unknown>, options?: {
    environment?: NodeJS.ProcessEnv;
    root?: string;
}): Promise<McpToolResult>;
/** The manifest an MCP client reads. */
export declare function mcpManifest(): Record<string, unknown>;
//# sourceMappingURL=index.d.ts.map