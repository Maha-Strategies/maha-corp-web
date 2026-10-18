import { appendFile, readFile, writeFile, mkdir } from 'node:fs/promises'
import { classifyDiscoveryReport, discoveryMonitorMatrix, discoveryMonitorBatches, type MonitorOffer } from '../lib/x402/discovery-monitor.ts'
import { diagnoseX402Endpoint, DEFAULT_BAZAAR_URL } from '../lib/x402/doctor.ts'
import { createMerchantCatalogueReader } from '../lib/x402/merchant-catalog.ts'
import { checkBookDiscoveryContract } from '../lib/x402/book-discovery-monitor.ts'

const mode = process.argv[2]
if (mode === 'matrix') {
  const response = await fetch('https://www.mahastrategies.com/.well-known/x402-public-manifest.json', {
    redirect: 'error', signal: AbortSignal.timeout(20_000), headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Public manifest unavailable: HTTP ${response.status}`)
  const modular=await fetch('https://www.mahastrategies.com/.well-known/x402.json',{redirect:'error',signal:AbortSignal.timeout(20000)})
  if(!modular.ok)throw Error('Modular manifest unavailable; monitoring coverage is incomplete')
  const matrix = JSON.stringify(discoveryMonitorBatches(discoveryMonitorMatrix(await response.json(),await modular.json())))
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `matrix=${matrix}\n`)
  console.log(matrix)
} else if(mode==='batch'){
  const offers=JSON.parse(process.env.OFFERS_JSON??'null') as MonitorOffer[]
  if(!Array.isArray(offers)||!offers.length||offers.length>50)throw Error('Invalid monitoring batch')
  // Revalidate untrusted matrix input before issuing any request.
  discoveryMonitorMatrix({offers:offers.map(o=>({id:o.offer,status:'active',method:o.method,canonicalResource:o.subject,payment:{protocol:'x402'}}))})
  const readCatalogue=createMerchantCatalogueReader({baseUrl:DEFAULT_BAZAAR_URL,timeoutMs:20000})
  const results:unknown[]=[],counts:Record<string,number>={},pending=[...offers]
  await mkdir('discovery-reports',{recursive:true})
  await Promise.all(Array.from({length:Math.min(4,pending.length)},async()=>{
    for(let offer=pending.shift();offer;offer=pending.shift()){
      if(offer.offer.startsWith('book-bundle-v2-')){
        try{const report=await checkBookDiscoveryContract(offer.subject);counts.book_contract_only=(counts.book_contract_only??0)+1;results.push({offer:offer.offer,...report})}
        catch{counts.contract_failure=(counts.contract_failure??0)+1;results.push({offer:offer.offer,classification:'contract_failure',paidCalls:0})}
        continue
      }
      let report:unknown=null
      try{report=await diagnoseX402Endpoint({endpoint:offer.subject,request:{method:offer.method},timeoutMs:10000,readCatalogue})}catch{/* Report missing, never assert absence. */}
      const classification=classifyDiscoveryReport(report,offer.subject,'success',offer.expectedIndexed!==false)
      counts[classification]=(counts[classification]??0)+1;results.push({offer:offer.offer,classification,report})
    }
  }))
  const clean=Object.entries(counts).every(([key])=>key==='clean'||key==='expected_unindexed'||key==='book_contract_only')
  const classification=clean?'clean':'attention'
  await writeFile('discovery-reports/report.json',JSON.stringify({counts,results,paidCalls:0},null,2))
  const summary=JSON.stringify(counts)
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`classification=${classification}\nsummary=${summary}\n`)
  console.log(JSON.stringify({classification,counts,checked:results.length,paidCalls:0}))
  if(!clean)process.exitCode=1
} else if (mode === 'classify') {
  let report: unknown = null
  try { report = JSON.parse(await readFile(process.env.REPORT!, 'utf8')) } catch { /* Missing/invalid output is monitor failure. */ }
  const classification = classifyDiscoveryReport(report, process.env.SUBJECT ?? '', process.env.DOCTOR_OUTCOME ?? '')
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `classification=${classification}\n`)
  console.log(classification)
} else throw new Error('Expected matrix or classify')
