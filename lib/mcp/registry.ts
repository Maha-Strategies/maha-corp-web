import { Redis } from '@upstash/redis';
import crypto from 'crypto';
import { MCPServerConfig, MCPServerSummary, MCPToolDiscovery } from './types';
import { assertPublicUpstreamHost, parsePublicUpstreamUrl } from '../mcp-gateway';
import { scopedRedisKey } from '../redis-namespace';
import { traceRedisQuery } from '../observability/telemetry';

const redis = Redis.fromEnv();

function encryptionKey(): Buffer {
  const value = process.env.MCP_ENCRYPTION_KEY
  if (!value) throw new Error('MCP encryption is not configured.')
  if (/^[a-f0-9]{64}$/i.test(value)) return Buffer.from(value, 'hex')
  if (Buffer.byteLength(value, 'utf8') === 32) return Buffer.from(value, 'utf8')
  throw new Error('MCP encryption is not configured.')
}

/**
 * Encrypts upstream API secrets prior to storing in Redis.
 */
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts upstream secrets for outbound proxy calls.
 */
export function decryptSecret(cipherText: string): string {
  const [ivHex, authTagHex, encryptedText] = cipherText.split(':');
  if (!ivHex || !authTagHex || !encryptedText || !/^[a-f0-9]+$/i.test(ivHex) || !/^[a-f0-9]+$/i.test(authTagHex) || !/^[a-f0-9]+$/i.test(encryptedText)) throw new Error('Stored MCP credential is malformed.')
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  if (iv.length !== 16 || authTag.length !== 16) throw new Error('Stored MCP credential is malformed.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export class MCPRegistry {
  /**
   * Registers a new upstream MCP server for a tenant.
   */
  static async registerServer(
    tenantId: string,
    config: Omit<MCPServerConfig, 'id' | 'tenantId' | 'createdAt' | 'discovery'>,
    rawSecret?: string
  ): Promise<MCPServerConfig> {
    const baseUrl = parsePublicUpstreamUrl(config.baseUrl)
    await assertPublicUpstreamHost(baseUrl)
    const serverId = `mcp_srv_${crypto.randomBytes(8).toString('hex')}`;
    const serverConfig: MCPServerConfig = {
      ...config, baseUrl,
      id: serverId,
      tenantId,
      authSecretEncrypted: rawSecret ? encryptSecret(rawSecret) : undefined,
      createdAt: Date.now(),
      discovery: { status: 'pending', tools: [] },
    };

    const redisKey = scopedRedisKey(`mcp:tenant:${tenantId}:servers`);
    await traceRedisQuery('HSET', () => redis.hset(redisKey, { [serverId]: JSON.stringify(serverConfig) }));

    return serverConfig;
  }

  /**
   * Retrieves a tenant-scoped MCP server config.
   */
  static async getServer(tenantId: string, serverId: string): Promise<MCPServerConfig | null> {
    const redisKey = scopedRedisKey(`mcp:tenant:${tenantId}:servers`);
    const raw = await traceRedisQuery('HGET', () => redis.hget<string>(redisKey, serverId));
    if (!raw) return null;
    return this.normalize(typeof raw === 'string' ? JSON.parse(raw) : raw);
  }

  /**
   * Lists all MCP servers registered to a tenant.
   */
  static async listServers(tenantId: string): Promise<MCPServerConfig[]> {
    const redisKey = scopedRedisKey(`mcp:tenant:${tenantId}:servers`);
    const hashData = await traceRedisQuery('HGETALL', () => redis.hgetall<Record<string, string | MCPServerConfig>>(redisKey));
    if (!hashData) return [];

    return Object.values(hashData).map((val) => this.normalize(
      typeof val === 'string' ? JSON.parse(val) : val
    ));
  }

  static async updateDiscovery(tenantId: string, serverId: string, discovery: MCPToolDiscovery): Promise<MCPServerConfig | null> {
    const server = await this.getServer(tenantId, serverId)
    if (!server) return null
    const updated = { ...server, discovery }
    await traceRedisQuery('HSET', () => redis.hset(scopedRedisKey(`mcp:tenant:${tenantId}:servers`), { [serverId]: JSON.stringify(updated) }))
    return updated
  }

  static summarize(server: MCPServerConfig): MCPServerSummary {
    return {
      serverId: server.id,
      name: server.name,
      baseUrl: server.baseUrl,
      createdAt: server.createdAt,
      status: server.status,
      discovery: server.discovery,
    }
  }

  private static normalize(server: MCPServerConfig): MCPServerConfig {
    return { ...server, discovery: server.discovery ?? { status: 'pending', tools: [] } }
  }
}
