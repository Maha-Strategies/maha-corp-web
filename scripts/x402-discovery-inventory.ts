// Clean-run inventory entrypoint: Node built-ins and dependency-free metadata
// validation only. Must work before npm ci; never imports Doctor/book parsers.
import {appendFile} from 'node:fs/promises'
import {discoveryMonitorMatrix,discoveryMonitorBatches} from '../lib/x402/discovery-monitor.ts'
export async function loadDiscoveryInventory(request:typeof fetch=fetch){
 const read=async(path:string)=>{
  const response=await request('https://www.mahastrategies.com'+path,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{accept:'application/json'}})
  if(!response.ok)throw Error('Public discovery inventory unavailable')
  return response.json()
 }
 return discoveryMonitorBatches(discoveryMonitorMatrix(await read('/.well-known/x402-public-manifest.json'),await read('/.well-known/x402.json')))
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
 const matrix=JSON.stringify(await loadDiscoveryInventory())
 if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'matrix='+matrix+'\n')
 console.log(matrix)
}
