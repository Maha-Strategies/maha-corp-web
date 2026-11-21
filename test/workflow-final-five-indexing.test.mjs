import {test} from 'node:test'
import assert from 'node:assert/strict'
import {CAP,TARGETS,budget,contract,listingMatches,exactFromSurfaces,sequence,requirePassingDelivery} from '../scripts/run-workflow-final-five.mjs'
test('frozen batch cannot exceed cap or authorize any target twice',()=>{
  assert.equal(CAP,390900n)
  assert.deepEqual(TARGETS.map(e=>[e.id,e.amount]),[
    ["workflow-publication-metadata-diligence-v1","194950"],
    ["workflow-trial-registry-evidence-handoff","195950"],
  ])
  assert.equal(TARGETS.some(e=>e.id==='workflow-research-reference-maintenance-v1'),false)
  assert.throws(()=>budget().reserve({id:'workflow-celestial-timing-plan-review-v1',amount:'214993'}),/duplicate_or_unapproved/)
  assert.throws(()=>budget().reserve({id:'workflow-extractive-source-handoff-v1',amount:'244950'}),/duplicate_or_unapproved/)
  const cap=budget()
  for(const e of TARGETS)cap.reserve(e)
  assert.equal(cap.authorized,CAP)
  assert.throws(()=>cap.reserve(TARGETS[0]),/duplicate_or_unapproved/)
  assert.throws(()=>budget().reserve({...TARGETS[0]}),/duplicate_or_unapproved/)
  assert.throws(()=>contract(TARGETS[0]).validateInput({planHash:TARGETS[0].planHash,nonpersonalMetadata:true}),/unpinned_input/)
})
test('no next purchase until exact listing; no automatic repayment; already listed skipped',async()=>{
  const changes=[]
  await assert.rejects(sequence(TARGETS,async e=>e===TARGETS[0],async e=>changes.push(['purchase',e.id]),
    async e=>{changes.push(['verify listing',e.id]);return false},async(e,s)=>changes.push([s,e.id])),/settled_listing_unconfirmed_do_not_repay/)
  assert.deepEqual(changes,[['already_listed_no_payment',TARGETS[0].id],['purchase',TARGETS[1].id],['verify listing',TARGETS[1].id]])
  changes.length=0
  await assert.rejects(sequence(TARGETS,async()=>false,async e=>{changes.push(e.id);throw Error('unknown_payment')},async()=>true),/unknown_payment/)
  assert.deepEqual(changes,[TARGETS[0].id])
})
test('listing must agree on exact URL, method, chain, asset, amount, and payee',()=>{
  const e=TARGETS[0],row={resource:'https://www.mahastrategies.com'+e.path,extensions:{bazaar:{info:{input:{method:'POST'}}}},accepts:[{
    amount:e.amount,scheme:'exact',network:'eip155:8453',asset:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',payTo:'0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'}]}
  assert.equal(listingMatches(row,e),true)
  assert.equal(exactFromSurfaces(e,undefined,[row]),true)
  assert.equal(exactFromSurfaces(e,row,[]),true)
  assert.equal(exactFromSurfaces(e,undefined,[{...row,resource:row.resource+'-other'}]),false)
  assert.throws(()=>exactFromSurfaces(e,undefined,[{...row,accepts:[{...row.accepts[0],amount:'1'}]}]),/existing_listing_terms_conflict/)
  assert.equal(listingMatches({...row,resource:row.resource+'-other'},e),false)
  assert.equal(listingMatches({...row,accepts:[{...row.accepts[0],amount:'1'}]},e),false)
  assert.equal(listingMatches({...row,extensions:{}},e),false)
})
test('a missing first listing prevents the second purchase; a verified first listing releases it',async()=>{
  for(const firstListed of [false,true]){
    const events=[]
    const [first,second]=TARGETS
    const run=sequence(TARGETS,async()=>false,async e=>events.push('buy:'+e.id),async e=>{
      events.push('lookup:'+e.id)
      return e===second || firstListed
    })
    if(firstListed) await run
    else await assert.rejects(run,/settled_listing_unconfirmed_do_not_repay/)
    assert.deepEqual(events,['buy:'+first.id,'lookup:'+first.id,...(firstListed?['buy:'+second.id,'lookup:'+second.id]:[])])
  }
})
test('when both exact listings already exist there is no purchase',async()=>{
  await sequence(TARGETS,async()=>true,()=>assert.fail('unexpected payment'),()=>assert.fail('unexpected paid-listing check'))
})
test('a paid hold cannot be counted as a successful workflow or trigger another purchase',()=>{
  assert.doesNotThrow(()=>requirePassingDelivery({overallStatus:'REQUIREMENTS_SATISFIED'}))
  assert.throws(()=>requirePassingDelivery({overallStatus:'HELD'}),/paid_nonpassing_workflow_do_not_repay/)
  assert.throws(()=>requirePassingDelivery(null),/paid_nonpassing_workflow_do_not_repay/)
})
import {validUnsignedChallenge} from '../scripts/run-workflow-final-five.mjs'
test('unsigned quotes require HTTP 402 and a nonempty header strictly below 8000 bytes',()=>{
  assert.equal(validUnsignedChallenge(402,'x'.repeat(7999)),true)
  for(const [status,value] of [[302,'x'],[200,'x'],[402,''],[402,null],[402,'x'.repeat(8000)]])
    assert.equal(validUnsignedChallenge(status,value),false)
})
