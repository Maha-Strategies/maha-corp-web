import assert from 'node:assert/strict'
import test from 'node:test'
import { scanRpcLogs } from '../lib/x402/rpc-log-scan.ts'

async function collect<T>(iterator: AsyncIterable<T>) {
  const rows: T[] = []
  for await (const row of iterator) rows.push(row)
  return rows
}
const sleep = async () => {}

test('provider rate limits retry a fixed window instead of recursively creating more requests', async () => {
  const ranges: bigint[][] = [], delays: number[] = []
  await assert.rejects(collect(scanRpcLogs({ fromBlock: BigInt(0), toBlock: BigInt(499),
    sleep: async ms => { delays.push(ms) },
    getLogs: async (from, to) => { ranges.push([from, to]); throw new Error('rate limit exceeded; provider https://dashboard.blockpi.io') },
  })), /scan is incomplete/)
  assert.deepEqual(ranges, Array(3).fill([BigInt(0), BigInt(499)]))
  assert.deepEqual(delays, [2000, 4000])
})

test('RPC scan uses inclusive 500-block windows without gaps or duplicates', async () => {
  const ranges: bigint[][] = []
  const rows = await collect(scanRpcLogs({ fromBlock: BigInt(0), toBlock: BigInt(1000), sleep,
    getLogs: async (from, to) => { ranges.push([from, to]); return [from] } }))
  assert.deepEqual(ranges, [[BigInt(0), BigInt(499)], [BigInt(500), BigInt(999)], [BigInt(1000), BigInt(1000)]])
  assert.deepEqual(rows, [BigInt(0), BigInt(500), BigInt(1000)])
})

test('the reported 500-range provider error splits oversized windows instead of losing transfers', async () => {
  const accepted: bigint[][] = []
  const rows = await collect(scanRpcLogs({ fromBlock: BigInt(0), toBlock: BigInt(9000), maxBlocks: BigInt(9001), sleep,
    getLogs: async (from, to) => {
      if (to - from + BigInt(1) > BigInt(500)) throw new Error('eth_getLogs is limited to a 500 range')
      accepted.push([from, to]); return [from, to]
    } }))
  assert.equal(accepted[0][0], BigInt(0))
  assert.equal(accepted.at(-1)![1], BigInt(9000))
  for (let i = 0; i < accepted.length; i++) {
    assert.ok(accepted[i][1] - accepted[i][0] + BigInt(1) <= BigInt(500))
    if (i) assert.equal(accepted[i][0], accepted[i - 1][1] + BigInt(1))
  }
  assert.equal(rows.length, accepted.length * 2)
})

test('learns narrower provider windows for the rest of a long scan', async () => {
  let rejections = 0
  await collect(scanRpcLogs({ fromBlock: BigInt(0), toBlock: BigInt(1999), sleep,
    getLogs: async (from, to) => {
      if (to - from + BigInt(1) > BigInt(250)) { rejections++; throw new Error('limit of 250 blocks') }
      return []
    } }))
  assert.equal(rejections, 1)
})

test('RPC scan splits provider-rejected ranges and preserves order', async () => {
  const accepted: bigint[][] = []
  const rows = await collect(scanRpcLogs({ fromBlock: BigInt(10), toBlock: BigInt(17), sleep,
    getLogs: async (from, to) => {
      if (to - from + BigInt(1) > BigInt(2)) throw new Error('eth_getLogs is limited to a 2,000 range')
      accepted.push([from, to]); return [from, to]
    } }))
  assert.deepEqual(accepted, [[BigInt(10), BigInt(11)], [BigInt(12), BigInt(13)], [BigInt(14), BigInt(15)], [BigInt(16), BigInt(17)]])
  assert.deepEqual(rows, [BigInt(10), BigInt(11), BigInt(12), BigInt(13), BigInt(14), BigInt(15), BigInt(16), BigInt(17)])
})

test('RPC transient failures retry the same range with bounded backoff', async () => {
  let calls = 0
  const delays: number[] = []
  assert.deepEqual(await collect(scanRpcLogs({ fromBlock: BigInt(7), toBlock: BigInt(7),
    sleep: async (ms) => { delays.push(ms) }, getLogs: async () => { if (++calls < 3) throw new Error('unavailable'); return ['log'] } })), ['log'])
  assert.deepEqual(delays, [400, 800])
})

test('RPC scan never silently skips a failed subrange', async () => {
  let calls = 0
  await assert.rejects(collect(scanRpcLogs({ fromBlock: BigInt(0), toBlock: BigInt(3), maxBlocks: BigInt(2), sleep,
    getLogs: async (from) => { calls++; if (from === BigInt(2)) throw new Error('offline'); return ['first range'] } })), /scan is incomplete/)
  assert.equal(calls, 4)
})

test('RPC scan terminates on a rejected single block and rejects invalid limits', async () => {
  let calls = 0
  await assert.rejects(collect(scanRpcLogs({ fromBlock: BigInt(2), toBlock: BigInt(2), sleep,
    getLogs: async () => { calls++; throw new Error('too many results') } })), /scan is incomplete/)
  assert.equal(calls, 3)
  for (const settings of [{ maxBlocks: BigInt(0) }, { attempts: 0 }, { fromBlock: -BigInt(1) }, { toBlock: BigInt(0) }]) {
    await assert.rejects(collect(scanRpcLogs({ fromBlock: BigInt(1), toBlock: BigInt(1), getLogs: async () => [], ...settings })), /Invalid RPC/)
  }
})
