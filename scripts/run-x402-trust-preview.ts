import { fetchAndEvaluateX402TrustPreview } from '../lib/x402/trust-preview.ts'

const roleArgument = process.argv.find((argument) => argument.startsWith('--role='))?.slice('--role='.length)
if (roleArgument !== undefined && !['best', 'median', 'worst'].includes(roleArgument)) {
  throw new Error('Use --role=best, --role=median, or --role=worst.')
}

const result = await fetchAndEvaluateX402TrustPreview({ role: roleArgument as 'best' | 'median' | 'worst' | undefined })
console.log(JSON.stringify(result, null, 2))
if (!result.ok) process.exitCode = 1
