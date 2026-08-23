import Link from 'next/link'
import type { Metadata } from 'next'
import ArticleTableOfContents from '@/components/ArticleTableOfContents'
import { MAHA_ORGANIZATION_ID } from '@/lib/entity'

const SITE_URL = 'https://www.mahastrategies.com'
const URL = `${SITE_URL}/books/the-synthetic-self/how-large-language-models-learn`

export const metadata: Metadata = {
  title: 'How Do Large Language Models Learn? A Plain-English Guide',
  description:
    'How large language models learn: tokens, next-token prediction, loss, gradient descent, transformers, and post-training—plus why fluent AI is not automatically factual.',
  alternates: { canonical: '/books/the-synthetic-self/how-large-language-models-learn' },
  openGraph: {
    type: 'article',
    url: URL,
    title: 'How Do Large Language Models Learn?',
    description:
      'A plain-English guide to tokens, next-token prediction, training, transformers, and why fluency is not the same as truth.',
    images: [{ url: '/og-master.png', width: 1200, height: 630, alt: 'How Do Large Language Models Learn? — Maha Strategies' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How Do Large Language Models Learn?',
    description: 'A plain-English guide to how large language models are trained.',
    images: ['/og-master.png'],
    creator: '@mayonemaha',
  },
}

const sources = [
  {
    title: 'Attention Is All You Need',
    authors: 'Vaswani et al. (2017)',
    href: 'https://arxiv.org/abs/1706.03762',
    note: 'Introduced the Transformer architecture used throughout modern language modeling.',
  },
  {
    title: 'Language Models are Few-Shot Learners',
    authors: 'Brown et al. (2020)',
    href: 'https://arxiv.org/abs/2005.14165',
    note: 'A primary account of large-scale autoregressive language-model training and evaluation.',
  },
  {
    title: 'Training Language Models to Follow Instructions with Human Feedback',
    authors: 'Ouyang et al. (2022)',
    href: 'https://arxiv.org/abs/2203.02155',
    note: 'Documents supervised fine-tuning and preference-based post-training for instruction following.',
  },
  {
    title: 'TruthfulQA: Measuring How Models Mimic Human Falsehoods',
    authors: 'Lin, Hilton, and Evans (2021)',
    href: 'https://arxiv.org/abs/2109.07958',
    note: 'A benchmark examining factual truthfulness and imitative falsehoods in language-model answers.',
  },
]

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'How Do Large Language Models Learn? A Plain-English Guide',
  description:
    'How large language models learn: tokens, next-token prediction, loss, gradient descent, transformers, and post-training—plus why fluent AI is not automatically factual.',
  url: URL,
  mainEntityOfPage: URL,
  isPartOf: { '@id': `${SITE_URL}/books/the-synthetic-self#book` },
  author: { '@type': 'Person', name: 'Mayone Maha Rajan' },
  publisher: { '@id': MAHA_ORGANIZATION_ID },
  datePublished: '2026-07-16',
  dateModified: '2026-07-16',
  isAccessibleForFree: true,
  inLanguage: 'en',
  articleSection: 'AI explainer',
  about: [
    { '@type': 'Thing', name: 'Large language models' },
    { '@type': 'Thing', name: 'Machine learning' },
    { '@type': 'Thing', name: 'Artificial intelligence' },
  ],
  citation: sources.map((source) => source.href),
}

export default function HowLargeLanguageModelsLearnPage() {
  return (
    <main className="evidence-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <article className="evidence-container evidence-container--narrow">
        <Link href="/books/the-synthetic-self" className="inline-block font-mono text-xs text-[var(--status-sourced)] hover:text-[var(--text-primary)] tracking-widest uppercase transition-colors mb-12">
          ← The Synthetic Self
        </Link>

        <header className="border-b border-[var(--border-default)] pb-10 mb-12">
          <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-5">[ Plain-English AI guide ]</p>
          <h1 className="text-4xl sm:text-5xl font-light text-[var(--text-primary)] leading-[1.1] tracking-tight mb-6">How do large language models learn?</h1>
          <p className="text-xl text-[var(--text-secondary)] font-light leading-relaxed">
            They are trained to predict the next piece of text, then repeatedly adjusted to make better predictions. That simple objective, applied at vast scale, is the starting point—not the whole story—of modern generative AI.
          </p>
          <p className="mt-7 font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase">Mayone Maha Rajan · The Synthetic Self</p>
        </header>

        <ArticleTableOfContents contentId="article-content" />
        <div id="article-content" data-article-content className="prose prose-lg max-w-none prose-p:text-[var(--text-secondary)] prose-p:leading-[1.85] prose-p:mb-7 prose-strong:text-[var(--text-primary)] prose-a:text-[var(--status-sourced)] prose-a:no-underline hover:prose-a:text-[var(--text-primary)] prose-li:text-[var(--text-secondary)] prose-li:leading-relaxed">
          <h2>Short answer</h2>
          <p>
            A large language model (LLM) learns by seeing an immense number of text examples and trying to predict what comes next. When its prediction differs from the text that actually followed, a mathematical training process adjusts its internal parameters so a better prediction becomes slightly more likely next time. Repeat that process across enormous quantities of text, and the model becomes good at producing continuations that resemble useful human language.
          </p>
          <p>
            This is often called <strong>next-token prediction</strong>. It does not mean an LLM is merely guessing one isolated word at a time in the ordinary sense. Each new token becomes part of the context for the next one, allowing the model to build sentences, code, explanations, and longer arguments piece by piece.
          </p>

          <h2>1. Text is broken into tokens</h2>
          <p>
            A model does not receive a sentence as a human reader does. Its input is split into <strong>tokens</strong>: units that may be words, parts of words, punctuation, or other small pieces of text. A prompt is therefore a sequence of token IDs. The model’s immediate task is to estimate which token is most likely to come next, given the tokens already present.
          </p>
          <p>
            “The capital of France is” makes some continuations more likely than others. During training, the system can compare its probability distribution with the token that really followed in the training example. The comparison produces an error signal called <strong>loss</strong>.
          </p>

          <h2>2. The model improves through error correction</h2>
          <p>
            The loss is not a teacher’s explanation of why an answer was wrong. It is a number that measures how far the prediction was from the training example. An optimization method then changes the model’s adjustable values—its <strong>parameters</strong>—by very small amounts intended to reduce that loss.
          </p>
          <p>
            <strong>Gradient descent</strong> is the basic idea behind those changes: calculate the local direction that would lower the error, then take a small step in that direction. <strong>Backpropagation</strong> is the efficient bookkeeping that computes how a final error should affect many parameters inside a neural network. The process is repeated over and over on batches of examples.
          </p>
          <p>
            No one writes a separate rule for grammar, translation, persuasive prose, or every fact the model may later discuss. Many useful regularities are learned because representing them helps the system make better predictions. That is a mechanism, not a proof that the system understands language in the human sense.
          </p>

          <h2>3. Transformers help the model use context</h2>
          <p>
            Most modern LLMs use a family of neural-network designs called <strong>Transformers</strong>. Their central operation, attention, lets the model weigh relationships among tokens in the context when making the next prediction. It is one reason a model can connect a pronoun with an earlier noun, preserve a pattern in code, or respond to a detail that appeared earlier in a prompt.
          </p>
          <p>
            Attention is not a tiny person inside the model deciding what matters. It is a learned numerical mechanism for weighting information. The original Transformer paper introduced an architecture based on attention mechanisms rather than recurrent or convolutional layers; later language models adapted and scaled related designs for text generation. <a href={sources[0].href}>[1]</a>
          </p>

          <h2>4. Pretraining makes a language model; post-training makes an assistant</h2>
          <p>
            The long first stage is usually called <strong>pretraining</strong>. It gives a model broad predictive ability by exposing it to text at scale. A raw pretrained model is not automatically a useful conversational assistant; it may continue text in an unhelpful direction or fail to follow a request as a user expects.
          </p>
          <p>
            Builders commonly add <strong>post-training</strong>: further training on demonstrations of desired responses and on preferences about which responses are better. Reinforcement learning from human feedback (RLHF) is one well-known approach. The details differ by model and provider, but the important distinction remains: pretraining develops broad language-model capability; post-training tries to shape how that capability is used in conversation. <a href={sources[2].href}>[3]</a>
          </p>

          <h2>5. Why prediction can look like reasoning</h2>
          <p>
            To predict human writing well, a model has to capture many regularities found in human writing: syntax, common associations, the structure of arguments, styles of explanation, and patterns in code. That is why next-token prediction can produce behavior that looks startlingly competent. It can also solve some unfamiliar tasks from examples placed in its prompt, a behavior explored in large-scale language-model research. <a href={sources[1].href}>[2]</a>
          </p>
          <p>
            But an impressive answer is not, by itself, evidence that the model has grounded knowledge, independent judgment, or human-like understanding. Those are separate questions. A useful explanation should keep the training mechanism distinct from larger philosophical conclusions about minds.
          </p>

          <h2>6. Why fluent AI is not automatically factual</h2>
          <p>
            The basic training objective rewards a continuation that fits the context and training patterns. It is not, on its own, a live fact-checking system with direct access to the world. A model can therefore produce a coherent answer that is inaccurate, unsupported, or invented. Some products reduce that risk with retrieval, tools, source links, evaluations, and post-training, but those safeguards do not make verification unnecessary.
          </p>
          <p>
            This is not an incidental concern. TruthfulQA, a research benchmark, was designed to test whether language models reproduce common human falsehoods and found that imitating web text is not the same objective as being truthful. <a href={sources[3].href}>[4]</a> For consequential questions, check the underlying source rather than treating confident prose as evidence.
          </p>

          <h2>Where the book’s interpretation begins</h2>
          <p>
            <em>The Synthetic Self</em> calls a language model a “mirror of the human record.” That phrase is an <strong>interpretive lens</strong>, not a technical term. The established mechanism is simpler: models are optimized to capture predictive patterns in their training material, then often shaped further by human demonstrations and preferences. The book’s argument is that this mechanism has a human consequence: the systems can reproduce not only the useful patterns in our record, but also its omissions, contradictions, and distortions.
          </p>
          <p>
            Keeping that boundary visible is part of the point. We should neither mystify the machinery nor pretend that a description of the machinery settles every question about intelligence, responsibility, or value.
          </p>

          <h2>Frequently asked questions</h2>
          <h3>What is next-token prediction?</h3>
          <p>
            It is the task of estimating the most likely next token from the preceding context. In generation, the model repeatedly selects or samples a next token and adds it to the context, producing an answer one piece at a time.
          </p>
          <h3>What is gradient descent in simple terms?</h3>
          <p>
            It is an iterative error-reduction strategy. After measuring how wrong a prediction was, training computes a small change to the model’s parameters that should reduce similar error. It repeats that process many times rather than solving the entire problem in one step.
          </p>
          <h3>Do LLMs simply memorize the internet?</h3>
          <p>
            No. A model’s usual response process is not a search through a complete stored library of sentences. It learns distributed statistical patterns in its parameters, although models can retain some training examples and memorization is a real research and privacy concern. “Compression” is therefore a useful but incomplete analogy—not a literal description of a model as a zip file of the web.
          </p>
        </div>

        <section className="mt-16 pt-8 border-t border-[var(--border-default)]">
          <p className="font-mono text-xs text-[var(--status-sourced)] tracking-widest uppercase mb-5">[ Sources ]</p>
          <ol className="space-y-5">
            {sources.map((source, index) => (
              <li key={source.href} className="grid grid-cols-[1.5rem_1fr] gap-4 text-sm leading-relaxed">
                <span className="font-mono text-[var(--text-muted)]">{index + 1}</span>
                <div>
                  <a href={source.href} className="text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors">{source.title}</a>
                  <span className="text-[var(--text-muted)]"> · {source.authors}</span>
                  <p className="text-[var(--text-muted)] mt-1">{source.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-16 pt-8 border-t border-[var(--border-default)]">
          <p className="font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase mb-4">[ Continue reading ]</p>
          <div className="flex flex-col gap-3">
            <Link href="/books/the-synthetic-self/the-learning-machine" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Read Chapter 1: The Learning Machine ↗</Link>
            <Link href="/books/the-synthetic-self" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Return to The Synthetic Self ↗</Link>
          </div>
        </footer>
      </article>
    </main>
  )
}
