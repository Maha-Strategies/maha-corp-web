/** Read saved buyer-side captures only. No wallet, HTTP client, provider or environment loader. */
import { readFile } from 'node:fs/promises'
import { checkBuyerDelivery } from '../lib/x402/buyer-delivery-check.ts'

async function main() {
  const args = process.argv.slice(2)
  const names = ['--capture', '--request', '--response', '--expected-capture-sha256']
  if (args.length !== 8 || names.some((name) => args.filter((arg) => arg === name).length !== 1)
    || args.some((arg, i) => i % 2 === 0 && !names.includes(arg))) {
    throw new Error('Usage: check-x402-buyer-delivery --capture capture.json --request request.json --response response.json --expected-capture-sha256 sha256:<trusted capture-file digest>')
  }
  const arg = (name: string) => args[args.indexOf(name) + 1]!
  const [captureBytes, requestBytes, responseBytes] = await Promise.all([
    readFile(arg('--capture')), readFile(arg('--request')), readFile(arg('--response')),
  ])
  const result = checkBuyerDelivery({ captureBytes, requestBytes, responseBytes, expectedCaptureSha256: arg('--expected-capture-sha256') })
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.state === 'payload_verified' ? 0 : result.state === 'pending' ? 2 : 1
}
main().catch(() => { console.error('Delivery check could not run. Check arguments and local capture files; no payment was attempted.'); process.exitCode = 1 })
