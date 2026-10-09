/** Conservative public Base RPC limit, counted inclusively. */
export const RPC_LOG_MAX_BLOCKS = BigInt(500)

export async function* scanRpcLogs<T>(options: {
  fromBlock: bigint
  toBlock: bigint
  getLogs: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>
  maxBlocks?: bigint
  attempts?: number
  sleep?: (milliseconds: number) => Promise<void>
}): AsyncGenerator<T> {
  const maxBlocks = options.maxBlocks ?? RPC_LOG_MAX_BLOCKS
  let learnedMaxBlocks = maxBlocks
  const attempts = options.attempts ?? 3
  if (maxBlocks < BigInt(1) || !Number.isInteger(attempts) || attempts < 1) throw new Error('Invalid RPC scan limits.')
  if (options.fromBlock < BigInt(0) || options.toBlock < options.fromBlock) throw new Error('Invalid RPC scan bounds.')
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  async function read(from: bigint, to: bigint): Promise<T[]> {
    let lastError: unknown
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try { return await options.getLogs(from, to) } catch (error) {
        lastError = error
        const message = error instanceof Error ? error.message : String(error)
        // A rate-limit message can contain a provider hostname such as blockpi
        // or echoed fromBlock parameters. It must not trigger recursive splitting.
        const throttled = /rate.?limit|request limit reached|too many requests|high consumption|quota|HTTP\s*429/i.test(message)
        const rangeRejected = /(?:block|query|request)?\s*range.*(?:limit|exceed|large|wide|not supported)|limit.*(?:block|range)|too many (?:results|logs)|response size|query returned more/i.test(message)
        if (rangeRejected && !throttled && from < to) {
          const middle = (from + to) / BigInt(2)
          const smaller = middle - from + BigInt(1)
          if (smaller < learnedMaxBlocks) learnedMaxBlocks = smaller
          return [...await read(from, middle), ...await read(middle + BigInt(1), to)]
        }
        if (attempt + 1 < attempts) await sleep((throttled ? 2000 : 400) * (attempt + 1))
      }
    }
    // Never skip a failed range: an incomplete scan must not look like no sales.
    // Do not include provider URLs or credentials in this public diagnostic.
    throw new Error(`Could not read blocks ${from}-${to}. Settlement scan is incomplete.`, { cause: lastError })
  }

  for (let from = options.fromBlock; from <= options.toBlock;) {
    const end = from + learnedMaxBlocks - BigInt(1)
    const to = end < options.toBlock ? end : options.toBlock
    for (const log of await read(from, to)) yield log
    from = to + BigInt(1)
  }
}
