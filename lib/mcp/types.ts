export interface MCPServerConfig {
  id: string;
  tenantId: string;
  name: string;
  baseUrl: string; // e.g., "https://mcp.internal-enterprise.com/v1"
  authType: 'bearer' | 'hmac' | 'none';
  authSecretEncrypted?: string; // Encrypted upstream key/token
  allowedEngines: Array<'tensor-opt' | 'geometric-ai' | 'qec-compiler' | 'landscape-opt' | '*'>;
  status: 'active' | 'suspended';
  createdAt: number;
}

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string; // e.g. "tools/list", "tools/call", "resources/read"
  params?: Record<string, unknown>;
  id: string | number;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number;
}

export interface MCPProxyContext {
  tenantId: string;
  serverId: string;
  agentId?: string;
  traceId: string;
}