import type { X402Offer } from './offers.ts'
import { BUYER_BRIEF_ID, BUYER_BRIEF_PATH, BUYER_BRIEF_AMOUNT, BUYER_BRIEF_VERSION, BUYER_BRIEF_TERMS_HASH } from './buyer-brief-contract.ts'
export const BUYER_BRIEF_OFFER: X402Offer = {
  id: BUYER_BRIEF_ID, method:'POST', path:BUYER_BRIEF_PATH, amount:BUYER_BRIEF_AMOUNT,
  description:'Prepared CABEZON Buyer-Brief Pack: new CABEZON acceptance exercise, approval-change and omission checks, incident/recovery runbook, dated public-source snapshots and acceptance report. Assisted seller-authored pilot for one service; not independent endorsement. Version-bound archive delivery with secret-bound recovery without repayment. Activation requires agreed terms and verified deployment.',
  serviceName:'Maha CABEZON Buyer-Brief Pack', tags:['cabezon','buyer-runbook','evidence','x402'], concurrencyCap:2,
  status:'available', availability:{payableInProduction:true,blockedBy:[]},
  requiresIdempotency:true, maxRequestBytes:2048,
  capabilityBoundaries:['Prepared seller-authored artifact; no customized live analysis.','No accuracy certification, independent endorsement, video or later paid API calls.','Payment, archive delivery and buyer acceptance are separate.','Keep the 32-byte recovery secret private; its possession plus matching paid order grants archive recovery.'],
  retention:{fullSourceTextStored:false,verbatimExcerptsRetained:false,retainedFields:['payer','order ID','input hash','resource','amount','payment transaction','settlement state'],note:'Order metadata is held in the existing payment admission ledger. The raw recovery secret is not persisted; the prepared public-source artifact is retained for recovery.'},
  discovery:{
    input:{clientRequestId:'octopus-order-example',version:BUYER_BRIEF_VERSION,bundleHash:'sha256:'+'0'.repeat(64),termsHash:BUYER_BRIEF_TERMS_HASH,recoverySecret:'GENERATE_32_RANDOM_BYTES_AS_64_LOWERCASE_HEX'},
    inputSchema:{type:'object',additionalProperties:false,required:['clientRequestId','version','bundleHash','termsHash','recoverySecret'],properties:{clientRequestId:{type:'string',pattern:'^[A-Za-z0-9_-]{8,120}$'},version:{const:BUYER_BRIEF_VERSION},bundleHash:{type:'string',pattern:'^sha256:[a-f0-9]{64}$',description:'Use the exact GET contract value, not the placeholder.'},termsHash:{const:BUYER_BRIEF_TERMS_HASH},recoverySecret:{type:'string',description:'Generate a fresh cryptographically random 32-byte value locally. Never use a published example or put it in a URL.'}}},
    output:{productId:BUYER_BRIEF_ID,version:BUYER_BRIEF_VERSION,delivery:'inline_base64_archive',archive:{filename:'maha-buyer-brief-v2.tar.gz',base64:'',sha256:'sha256:'+'0'.repeat(64),bytes:0,exampleOnly:true},orderId:'octopus-order-example',transaction:'0x'+'0'.repeat(64),acceptance:'buyer_review_required'},
    outputSchema:{type:'object',required:['productId','version','delivery','archive','orderId','transaction','acceptance'],properties:{productId:{const:BUYER_BRIEF_ID},version:{const:BUYER_BRIEF_VERSION},delivery:{const:'inline_base64_archive'},archive:{type:'object'},orderId:{type:'string'},transaction:{type:'string'},acceptance:{const:'buyer_review_required'}}},
    requiredHeaders:{'x-maha-idempotency-key':{preimage:'clientRequestId',algorithm:'identity',format:'8-120 ASCII letters/digits/underscore/hyphen'},'x-maha-input-hash':{preimage:'UTF-8 JSON.stringify({clientRequestId,version,bundleHash,termsHash,recoverySecret}) in exactly this key order, no whitespace',algorithm:'SHA-256',format:'sha256:<lowercase hex>'}},
  },
}
