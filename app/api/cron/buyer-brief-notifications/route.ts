import { timingSafeEqual } from 'node:crypto'
import { deliverBriefNotices } from '../../../../lib/x402/buyer-brief-notifications.ts'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
export async function GET(request:Request) {
  const expected=process.env.CRON_SECRET,supplied=request.headers.get('authorization')
  if(!expected||!supplied||Buffer.byteLength(supplied)!==Buffer.byteLength(`Bearer ${expected}`)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(`Bearer ${expected}`)))return Response.json({error:'unauthorized'},{status:401})
  try{const result=await deliverBriefNotices();return Response.json(result,{status:result.failed||result.manualReview?503:200,headers:{'Cache-Control':'no-store'}})}
  catch(error){
    const allowed=['notifications_unconfigured','notification_claim_failed','notification_ack_failed','notification_backlog_unknown']
    const reason=error instanceof Error&&allowed.includes(error.message)?error.message:'unclassified'
    console.error('[BUYER_BRIEF_NOTIFICATION_DISPATCH_FAILED]',reason)
    return Response.json({error:'notification_dispatch_failed'},{status:503})
  }
}
export const POST=GET
