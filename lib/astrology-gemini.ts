import { z } from 'zod'
import type { AstrologyChatInput, buildAstrologyChatContext } from './astrology-chat.ts'
export const GEMINI_ASTROLOGY_MODEL = 'gemini-3.8-flash'
export function geminiAstrologyConfigured() { return Boolean(process.env.ASTROLOGY_GEMINI_API_KEY?.trim()) }
const responseSchema=z.object({status:z.string(),steps:z.array(z.object({type:z.string(),content:z.array(z.object({type:z.string(),text:z.string().optional()})).optional()}))})
/** Stateless, server-only Google API connection; never executes model-written code. */
export async function generateGeminiAstrologyAnswer(input:AstrologyChatInput,grounded:ReturnType<typeof buildAstrologyChatContext>,signal:AbortSignal,instructions:string,fetcher:typeof fetch=fetch) {
 const key=process.env.ASTROLOGY_GEMINI_API_KEY?.trim()
 if(!key)throw new Error('Gemini astrology is not configured.')
 const steps=[...input.history,{role:'user' as const,content:input.question}].map(m=>({type:m.role==='assistant'?'model_output':'user_input',content:[{type:'text',text:m.content}]}))
 const response=await fetcher('https://generativelanguage.googleapis.com/v1/interactions',{method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},signal:AbortSignal.any([signal,AbortSignal.timeout(45000)]),body:JSON.stringify({model:GEMINI_ASTROLOGY_MODEL,store:false,background:false,input:steps,generation_config:{max_output_tokens:6000,thinking_level:'low'},system_instruction:instructions+'\nServer-calculated context:\n'+JSON.stringify(grounded.context)})})
 if(!response.ok)throw new Error('Gemini astrology request failed.')
 const body=responseSchema.parse(await response.json())
 if(body.status!=='completed')throw new Error('Incomplete Gemini answer.')
 const answer=body.steps.flatMap(step=>step.type==='model_output'?(step.content??[]).filter(c=>c.type==='text'&&typeof c.text==='string').map(c=>c.text):[]).join('\n').trim()
 if(!answer||answer.length>24000)throw new Error('Empty or excessive Gemini answer.')
 return {answer,computations:[],provider:'google' as const,model:GEMINI_ASTROLOGY_MODEL}
}
