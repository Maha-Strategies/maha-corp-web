import test from 'node:test'
import assert from 'node:assert/strict'
import { executeAstrologyComputation,generateComputationAnswer } from '../lib/astrology-computation.ts'
import { handleAstrologyChat,buildAstrologyChatContext,type AstrologyChatInput } from '../lib/astrology-chat.ts'
const input:AstrologyChatInput={question:'Compute 7 times 8.',history:[],example:true,chart:null,engine:'computation',consentToOpenAi:true}
const grounded=buildAstrologyChatContext(input)
test('computation tools reject arbitrary execution, untrusted fields and invalid arithmetic',()=>{
 assert.deepEqual(executeAstrologyComputation('arithmetic',{operation:'multiply',left:7,right:8},grounded).result,{value:56,method:'IEEE-754 finite arithmetic',exactDecimalArithmetic:false})
 for(const args of [{operation:'divide',left:1,right:0},{operation:'add',left:Infinity,right:1},{operation:'add',left:1e13,right:1},{operation:'add',left:1,right:1,code:'process.env'}])assert.throws(()=>executeAstrologyComputation('arithmetic',args,grounded))
 assert.throws(()=>executeAstrologyComputation('shell',{},grounded))
 assert.throws(()=>executeAstrologyComputation('chart_geometry',{},grounded))
 assert.throws(()=>executeAstrologyComputation('selected_comparison',{userId:'another-user'},grounded))
})
test('OpenAI round trip preserves reasoning and returns actual executed results without response storage',async()=>{
 const oldKey=process.env.ASTROLOGY_OPENAI_API_KEY,oldModel=process.env.ASTROLOGY_OPENAI_MODEL
 process.env.ASTROLOGY_OPENAI_API_KEY='fixture-not-live';process.env.ASTROLOGY_OPENAI_MODEL='fixture-model'
 try{
 let requests=0
 const fetcher:typeof fetch=async(url,init)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(String(init?.body));assert.equal(body.store,false);assert.equal(body.parallel_tool_calls,false);assert.ok(body.tools.every((t:{strict:boolean})=>t.strict))
  assert.equal(body.tools.some((t:{name:string})=>t.name==='selected_transit'),false)
  if(++requests===1)return Response.json({status:'completed',output:[{type:'reasoning',id:'rs_fixture',summary:[]},{type:'function_call',call_id:'call_fixture',name:'arithmetic',arguments:JSON.stringify({operation:'multiply',left:7,right:8})}]})
  assert.ok(body.input.some((i:{type:string})=>i.type==='reasoning'));assert.equal(JSON.parse(body.input.at(-1).output).value,56)
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'The computed product is 56.'}]}]})
 }
 const result=await generateComputationAnswer(input,grounded,new AbortController().signal,'Fixture instructions',fetcher)
 assert.equal(result.answer,'The computed product is 56.');assert.equal(result.computations.length,1);assert.equal(requests,2)
 await assert.rejects(generateComputationAnswer(input,grounded,new AbortController().signal,'Fixture',async()=>Response.json({status:'completed',output:[{type:'function_call',call_id:'x',name:'selected_transit',arguments:'{}'}]})),/Invalid computation/)
 let calls=0
 await assert.rejects(generateComputationAnswer(input,grounded,new AbortController().signal,'Fixture',async()=>{calls++;return Response.json({status:'completed',output:[{type:'function_call',call_id:`x${calls}`,name:'arithmetic',arguments:'{"operation":"add","left":1,"right":2}'}]})}),/budget/)
 assert.equal(calls,3)
 }finally{if(oldKey===undefined)delete process.env.ASTROLOGY_OPENAI_API_KEY;else process.env.ASTROLOGY_OPENAI_API_KEY=oldKey;if(oldModel===undefined)delete process.env.ASTROLOGY_OPENAI_MODEL;else process.env.ASTROLOGY_OPENAI_MODEL=oldModel}
})
test('provider-specific consent precedes quota reservation; failures refund a consultation',async()=>{
 const request=(payload:AstrologyChatInput)=>new Request('https://maha.example/api/astrology/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
 let reserved=0,finished:boolean|undefined
 const deps={enabled:()=>true,capacity:async()=>'accepted' as const,consultation:async()=>{reserved++;return {entitlement:{isSubscriber:false},finish:async(success:boolean)=>{finished=success}}},generate:async()=>{throw new Error('Fixture provider failure')}}
 assert.equal((await handleAstrologyChat(request({...input,consentToOpenAi:false}),deps)).status,400);assert.equal(reserved,0)
 assert.equal((await handleAstrologyChat(request(input),deps)).status,502);assert.equal(reserved,1);assert.equal(finished,false)
})
