# What a machine buyer gets when it buys a book

Draft for review. Nothing here is implemented and no offer is created.

## The premise, checked

I started this expecting the hard question to be *how much of the book do we
give an unauthenticated agent*. It is not, and the reason matters.

`app/api/books/[id]/content/route.ts` says the paid payload is the structured
AST, and that the same text is free on the public web. I doubted that — the
landing page for The Orbital Mind renders about 1,600 words against an AST of
roughly 68,700 — and checking showed the doubt was misplaced. The book is an
open web edition published across **23 public chapter routes**; two sampled
chapters alone serve 7,762 and 2,898 words. Seven books have such editions.

So the words are already free. What is sold is not the text.

**The product is the form, not the content.** An agent paying for the AST is
buying 167 stable, addressable chunks it can cite, diff and cache — not access
to prose it could have scraped from 23 pages for nothing.

That single fact removes the risk I raised before drafting. Selling a book to a
machine does not distribute the asset, because the asset is already published.
It also constrains what may honestly be charged for, which is the rest of this
document.

## Only three books have a payload at all

The middle tier cannot be offered for every book, and this decides which two can
be published before any price is chosen.

| Book | Public sections | AST chunks |
|---|---|---|
| The Orbital Mind | 23 | 167 |
| The Synthetic Self | — | 107 |
| The Imagined Life | — | 100 |
| The Cosmic Recursion | — | **none** |
| The Maha Principle | — | **none** |
| The Volcanic Engine | — | **none** |
| The Borrowed Light | — | **none** |

Four of the seven open editions have no structured AST. For those, the
addressable-form tier has no payload — there is nothing to deliver that is not
already on the public chapter pages, so the only honest offer is metadata.

**If either book you are publishing is one of those four, its machine tier is
metadata-only until an AST is built.** Selling an addressable form that does not
exist is the one failure this document is meant to prevent.

## What each tier may and may not include

The existing x402 ladder runs 0.001 to 1.00 USDC across seven offers. Books are
a new product class and should not simply be slotted at an existing price: with
seven offers already live, a shared price makes the ledger unable to say which
product sold, and it reports `unattributable` rather than guessing.

| Tier | What is delivered | What it is not |
|---|---|---|
| **Metadata** | Identity, chapter list, chunk count, version, licence terms, digests. No prose. | Not a licence to reproduce. A catalogue entry conveys no more right to copy than a library card. |
| **Addressable AST** | The structured form with stable chunk identifiers, for one book. Available only where an AST exists — 167, 107 and 100 chunks for the three that have one. | Not exclusivity, not a redistribution right, and not new content — the same words are on the public chapter pages. |
| **Cross-book retrieval** | Chunk-addressable access across several books under one entitlement. | Not a corpus licence, and not permission to train on the text. |

Each tier is strictly additive in *form*, never in *text*. There is no tier at
which a machine receives words a human could not read free. If a future tier
would breach that, it is not a book tier — it is a different product and needs
its own boundary.

## What no tier conveys

These are the refusals, and they are the substance of the offer rather than
disclaimers appended to it.

- **No redistribution.** Buying the addressable form does not permit republishing
  the text, in whole or in part, in any form including a derived dataset.
- **No training right.** Payment for retrieval is not consent to train. If a
  training licence is ever offered it must be a separate, named product with its
  own price and its own terms, because a buyer cannot infer it from silence.
- **No exclusivity.** The same AST is available to every entitled buyer, and the
  same prose is available to everyone.
- **No warranty of correctness.** The AST reproduces the book. It does not
  certify that the book is right about anything.
- **No permanence.** A chunk identifier is stable within a version. A revised
  edition is a new version, and the ledger records that rather than silently
  renumbering.

## What has to be decided before an offer is written

Four questions I cannot answer from the repository, listed because writing an
offer without them would be guessing:

1. **Distinct prices.** Each book tier needs a price no existing offer uses, or
   the settlement ledger cannot attribute the sale. Seven prices are taken:
   1,000 / 5,000 / 10,000 / 50,000 / 100,000 / 500,000 / 1,000,000 base units.
2. **Per-book or per-catalogue.** Two books are being published. Whether an
   entitlement covers one book or the shelf changes both the price and the
   licence text.
3. **Quota shape.** The existing licence precedent
   (`MCP_EVIDENCE_LICENSE_PLANS`) uses `monthlyQuotaUnits` and `allowedTools`.
   A book entitlement should follow it rather than invent a second shape — but
   what a "unit" is for a book (a chunk? a whole-AST fetch? a day?) is a product
   decision.
4. **Whether an x402 payment can create an entitlement at all.** Today books are
   gated by `authorizeBookEntitlement` against a bearer token issued through
   Stripe checkout. An agent paying on-chain has no account. Either x402
   settlement mints a scoped credential, or the machine tier is metadata-only.
   This is the largest open question and it is an architecture decision, not a
   pricing one.

## What this does not decide

Whether either book *should* be sold to machines at all. That is a commercial
judgement. This document says only what may honestly be offered if the answer
is yes, and where the offer would overclaim if written carelessly.
