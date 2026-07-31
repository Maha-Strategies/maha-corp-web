import { Redis } from '@upstash/redis';
import crypto from 'crypto';
import { MCPServerConfig } from './types';

const redis = Redis.fromEnv();
const ENCRYPTION_KEY = process.env.MCP_ENCRYPTION_KEY || 'default-32-char-secret-key-000000'; // Must be 32 bytes

/**
 * Encrypts upstream API secrets prior to storing in Redis.
 */
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
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
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
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
    config: Omit<MCPServerConfig, 'id' | 'tenantId' | 'createdAt'>,
    rawSecret?: string
  ): Promise<MCPServerConfig> {
    const serverId = `mcp_srv_${crypto.randomBytes(8).toString('hex')}`;
    const serverConfig: MCPServerConfig = {
      ...config,
      id: serverId,
      tenantId,
      authSecretEncrypted: rawSecret ? encryptSecret(rawSecret) : undefined,
      createdAt: Date.now(),
    };

    const redisKey = `mcp:tenant:${tenantId}:servers`;
    await redis.hset(redisKey, { [serverId]: JSON.stringify(serverConfig) });

    return serverConfig;
  }

  /**
   * Retrieves a tenant-scoped MCP server config.
   */
  static async getServer(tenantId: string, serverId: string): Promise<MCPServerConfig | null> {
    const redisKey = `mcp:tenant:${tenantId}:servers`;
    const raw = await redis.hget<string>(redisKey, serverId);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  /**
   * Lists all MCP servers registered to a tenant.
   */
  static async listServers(tenantId: string): Promise<MCPServerConfig[]> {
    const redisKey = `mcp:tenant:${tenantId}:servers`;
    const hashData = await redis.hgetall<Record<string, string | MCPServerConfig>>(redisKey);
    if (!hashData) return [];

    return Object.values(hashData).map((val) =>
      typeof val === 'string' ? JSON.parse(val) : val
    );
  }
}