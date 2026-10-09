import test from 'node:test'
import assert from 'node:assert/strict'
import {generateGeminiAstrologyAnswer,GEMINI_ASTROLOGY_MODEL} from '../lib/astrology-gemini.ts'
import {handleAstrologyChat,buildAstrologyChatContext,type AstrologyChatInput} from '../lib/astrology-chat.ts'
const input:AstrologyChatInput={engine:'gemini',consentToGoogle:true,question:'Explain the traditional meaning of the second house.',history:[{role:'user',content:'Explain whole-sign houses.'},{role:'assistant',content:'Each sign corresponds to a house.'}],example:true,chart:null}
test('Gemini is stateless, bounded and grounded; credentials and thought steps never become answer text',async()=>{
 const before=process.env.ASTROLOGY_GEMINI_API_KEY;process.env.ASTROLOGY_GEMINI_API_KEY='fixture-private-key'
 try{
  const fetcher:typeof fetch=async(url,init)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1/interactions');assert.equal(new Headers(init?.headers).get('x-goog-api-key'),'fixture-private-key');assert.equal(String(url).includes('fixture-private-key'),false);const body=JSON.parse(String(init?.body));assert.equal(body.model,GEMINI_ASTROLOGY_MODEL);assert.equal(body.store,false);assert.equal(body.background,false);assert.equal(body.tools,undefined);assert.equal(body.previous_interaction_id,undefined);assert.equal(body.generation_config.thinking_level,'low');assert.deepEqual(body.input.map((s:{type:string})=>s.type),['user_input','model_output','user_input']);assert.ok(body.system_instruction.includes('Server-calculated context:'));return Response.json({status:'completed',steps:[{type:'thought',content:[{type:'text',text:'Private thought'}]},{type:'model_output',content:[{type:'text',text:'Traditionally, the second house concerns resources and speech.'}]}]})}
  const answer=await generateGeminiAstrologyAnswer(input,buildAstrologyChatContext(input),new AbortController().signal,'Fixture instructions',fetcher)
  assert.equal(answer.provider,'google');assert.equal(answer.model,'gemini-3.8-flash');assert.equal(answer.answer.includes('Private thought'),false)
  for(const body of [{status:'failed',steps:[]},{status:'completed',steps:[]},{status:'completed',steps:[{type:'model_output',content:[{type:'text',text:'x'.repeat(24001)}]}]}])await assert.rejects(generateGeminiAstrologyAnswer(input,buildAstrologyChatContext(input),new AbortController().signal,'Fixture',async()=>Response.json(body)))
 }finally{if(before===undefined)delete process.env.ASTROLOGY_GEMINI_API_KEY;else process.env.ASTROLOGY_GEMINI_API_KEY=before}
})
test('Google-specific consent is checked before consulting quota or provider',async()=>{
 let reserved=false
 const response=await handleAstrologyChat(new Request('https://maha.example/api/astrology/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...input,consentToGoogle:false,consentToOpenAi:true})}),{enabled:()=>true,consultation:async()=>{reserved=true;throw Error('must not reserve')}})
 assert.equal(response.status,400);assert.equal(reserved,false)
})
