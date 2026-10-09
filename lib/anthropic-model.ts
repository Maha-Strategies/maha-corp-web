import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'

/** Shared model boundary for all current Anthropic integrations. */
export const ANTHROPIC_MODEL = 'claude-sonnet-5-5'

// Preserve the bounded, text-only behavior of our previous non-thinking calls.
// Sonnet 5.5 otherwise enables thinking by default inside the output ceiling.
export const ANTHROPIC_MESSAGE_SETTINGS = {
  thinking: { type: 'between_tools' },
  output_config: { effort: 'medium' },
} as const satisfies Pick<MessageCreateParamsNonStreaming, 'thinking' | 'output_config'>

/** Published base rates, USD per million tokens (not customer-facing prices). */
export const ANTHROPIC_PRICING = { inputPerMillionUsd: 2, outputPerMillionUsd: 10 } as const
