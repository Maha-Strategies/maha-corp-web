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
  discovery: MCPToolDiscovery;
}

export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolDiscovery {
  status: 'pending' | 'ready' | 'error';
  tools: MCPToolDefinition[];
  discoveredAt?: number;
  error?: string;
}

export interface MCPServerSummary {
  serverId: string;
  name: string;
  baseUrl: string;
  createdAt: number;
  status: 'active' | 'suspended';
  discovery: MCPToolDiscovery;
}

export interface MCPSlaPolicy {
  requestsPerMinute: number;
  timeoutMs: number;
  failureThreshold: number;
  cooldownMs: number;
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
  id: string | number | null;
}

export interface MCPProxyContext {
  tenantId: string;
  serverId: string;
  agentId?: string;
  traceId: string;
}
