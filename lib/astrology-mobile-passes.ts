import type { MobilePurchaseState } from './astrology-mobile-billing.ts'
import type { getRedis } from './redis.ts'
import { scopedRedisKey } from './redis-namespace.ts'
export type MobilePass = { receiptId: string; transactionId: string; expiresAt: number }
export function mobileAccountKey(userId:string,environment:string,suffix:string) { return scopedRedisKey(`astrology:mobile:${environment}:account:${userId}:${suffix}`) }
export function mobileReceiptKey(environment:string,receiptId:string) { return scopedRedisKey(`astrology:mobile:${environment}:receipt:${receiptId}`) }
export async function activeMobilePasses(userId:string,verified:MobilePurchaseState,redis:ReturnType<typeof getRedis>,revoked:Set<string>,now=Date.now()) {
 const records=Object.values(await redis.hgetall<Record<string,MobilePass>>(mobileAccountKey(userId,verified.environment,'passes'))??{})
 const receipts=new Set(verified.dossiers.map(row=>row.id))
 return records.filter(row=>receipts.has(row.receiptId)&&row.expiresAt>now&&!revoked.has(row.transactionId)).sort((a,b)=>a.expiresAt-b.expiresAt)
}
export const CLAIM_MOBILE_DOSSIER = `
local existing=redis.call('GET',KEYS[1]);
if existing then if existing~=ARGV[1] then return -1 end; return 0 end;
if redis.call('SISMEMBER',KEYS[4],ARGV[6])==1 then return -2 end;
redis.call('SET',KEYS[1],ARGV[1]);
redis.call('HSET',KEYS[2],ARGV[2],ARGV[3]);
redis.call('HSET',KEYS[3],ARGV[6],ARGV[4]);
redis.call('SET',KEYS[5],ARGV[5]);
return 1`
