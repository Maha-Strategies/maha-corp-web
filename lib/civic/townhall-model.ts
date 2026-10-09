import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_MODEL, ANTHROPIC_MESSAGE_SETTINGS } from '../anthropic-model.ts'
import { TOWNHALL_SYSTEM_PROMPT, townhallTopicSchema, type TownhallRetrieval, type TownhallTopic } from './townhall-agent.ts'

/** Exact question and retrieved packet supplied to the model, separate from instructions. */
export function buildTownhallModelRequest(question: string, context: TownhallRetrieval) {
  return {
    system: `${TOWNHALL_SYSTEM_PROMPT}\n\nYour stage in this pipeline is intent classification only. The application constructs the final structured Markdown from the retrieved registry fields. Return exactly one label: proposal, simulation, tradeoffs, legislative-context, unknown. Use unknown if retrieved coverage is unestablished, the question needs evidence outside the packet, requests wrongdoing allegations or voting advice, or cannot be answered within the evidence limits. Do not write answer prose or add citations.`,
    content: JSON.stringify({ untrustedQuestion: question, retrievedRegistryContext: context }),
  }
}

/** Optional server-side intent classifier. It cannot supply answer prose or sources. */
export async function interpretTownhallQuestion(question: string, context: TownhallRetrieval): Promise<TownhallTopic> {
  if (!process.env.CIVIC_TOWNHALL_MODEL?.trim() || !process.env.ANTHROPIC_API_KEY) throw new Error('Town hall model is unconfigured.')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 10_000, maxRetries: 0 })
  const prompt = buildTownhallModelRequest(question, context)
  const result = await client.messages.create({ ...ANTHROPIC_MESSAGE_SETTINGS,
    model: ANTHROPIC_MODEL, max_tokens: 40,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.content }],
  })
  const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('').trim()
  return townhallTopicSchema.parse(text)
}
