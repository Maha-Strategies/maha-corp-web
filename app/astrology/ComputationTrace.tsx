import type { ComputationRecord } from '../../lib/astrology-computation'
export default function ComputationTrace({records}:{records?:ComputationRecord[]}) {
 if(!records?.length)return null
 return <details><summary>Verified computation record · {records.length} tool calls</summary><p>These results were produced by Maha’s calculation tools. The surrounding explanation is AI-generated.</p>{records.map((record,index)=><details key={index}><summary>{record.tool}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:320,overflow:'auto'}}>{JSON.stringify({arguments:record.arguments,result:record.result},null,2)}</pre></details>)}</details>
}
