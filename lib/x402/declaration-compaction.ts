// Shrinks a discovery declaration so a standard full-echo x402 v2 client can
// carry it back inside PAYMENT-SIGNATURE.
//
// The conflict this resolves is structural, not cosmetic. x402 v2 asks a payer
// to echo the declaration it was served; Vercel caps a request header at 16 KB;
// and a complete Bazaar declaration for a richly documented offer is 10-18 KB
// of JSON before base64 inflates it by a third. Measured on the real client:
// 16,232 characters for entry compression, 26,920 for deep evaluation, 10,376
// for the MPS audit, against a 16,384 parser limit. Two of the three offers
// were literally unpayable by a conforming client, and the failure arrived as
// `payment_header_too_large` on a payload the payer had assembled correctly
// from our own challenge.
//
// The fix is to put a *complete but compact* declaration in the challenge and
// publish the full one at a stable URL. Compaction is mechanical rather than
// hand-written so the inline and hosted forms cannot drift: there is one
// authored schema per offer, and this derives the other.
//
// What is preserved: every required field, every type, every enum and const,
// the top-level shape, and a callable input example. What is dropped: prose
// descriptions, format patterns, and the interior of deeply nested
// subschemas -- all of which a catalog can fetch from `declarationUrl`.

type Schema = Record<string, unknown>

/** Depth past which a subschema collapses to its bare type. */
const KEEP_STRUCTURE_TO_DEPTH = 1

/**
 * Longest string kept in a compacted *output* example.
 *
 * Input examples are never compacted -- see compactExample's note. Truncating
 * one would make it uncallable, and a crawler that pays and then replays a
 * broken example gets a 400 for a request our own declaration told it to send.
 */
const MAX_EXAMPLE_STRING = 64

/** Most array items kept in a compacted example. */
const MAX_EXAMPLE_ITEMS = 1

const DROPPED_KEYWORDS = new Set(['description', 'title', 'default', 'pattern'])

function isSchema(value: unknown): value is Schema {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * A looser schema that the same example still satisfies.
 *
 * Looser is the safe direction. A compacted schema accepts everything the full
 * schema accepts, so an example validated against the full schema validates
 * against this one too, and a client that reads only the inline form is never
 * told a valid request is invalid. The reverse -- a tighter inline schema --
 * would reject payloads the endpoint actually accepts.
 *
 * `additionalProperties: false` is dropped wherever properties are collapsed,
 * because keeping it while removing the properties it constrains would turn a
 * permissive schema into one that rejects every real payload.
 */
export function compactSchema(schema: Schema, depth = 0): Schema {
  const output: Schema = {}

  for (const [keyword, value] of Object.entries(schema)) {
    if (DROPPED_KEYWORDS.has(keyword)) continue

    // Non-scalar response examples are deliberately reduced to one item.
    // A fixed-cardinality full schema (for example, the five-run ladder)
    // would otherwise reject the compact example it accompanies. Lowering
    // only the inline minimum is a safe loosening; the complete hosted schema
    // remains the endpoint contract and retains the authored cardinality.
    if (keyword === 'minItems' && typeof value === 'number' && value > MAX_EXAMPLE_ITEMS) {
      output.minItems = MAX_EXAMPLE_ITEMS
      continue
    }

    if (keyword === 'properties' && isSchema(value)) {
      if (depth >= KEEP_STRUCTURE_TO_DEPTH) continue
      const properties: Schema = {}
      for (const [name, subSchema] of Object.entries(value)) {
        if (isSchema(subSchema)) properties[name] = compactSchema(subSchema, depth + 1)
      }
      output.properties = properties
      continue
    }

    if (keyword === 'items' && isSchema(value)) {
      if (depth >= KEEP_STRUCTURE_TO_DEPTH) continue
      output.items = compactSchema(value, depth + 1)
      continue
    }

    if (keyword === 'additionalProperties') {
      // Only meaningful alongside the properties it bounds.
      if (value === false && depth >= KEEP_STRUCTURE_TO_DEPTH) continue
      if (isSchema(value)) {
        if (depth >= KEEP_STRUCTURE_TO_DEPTH) continue
        output.additionalProperties = compactSchema(value, depth + 1)
        continue
      }
      output.additionalProperties = value
      continue
    }

    output[keyword] = value
  }

  // A collapsed object must not keep requiring fields it no longer describes,
  // and must not forbid the ones it dropped.
  if (depth >= KEEP_STRUCTURE_TO_DEPTH) {
    delete output.required
    delete output.additionalProperties
  }

  return output
}

/**
 * Shortens a *response* example without changing its shape.
 *
 * Only ever applied to output examples. An input example must stay callable:
 * the deep-evaluation contract requires each evidence span to be an exact
 * substring of its document, so truncating the document text silently breaks
 * the example a crawler is told to replay -- it would pay, call, and receive a
 * 400 for a payload our own declaration handed it. Input examples are
 * therefore published verbatim and are small enough to afford that.
 */
export function compactExample(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_EXAMPLE_STRING ? `${value.slice(0, MAX_EXAMPLE_STRING)}…` : value
  }
  if (Array.isArray(value)) {
    // An array of short strings is kept whole. These are enumerations --
    // `warningCodes` is the machine-readable limitations list -- and truncating
    // one drops meaning an agent branches on while saving a few dozen bytes.
    // Compaction is supposed to remove restatable detail, not the parts of the
    // contract that only exist in this list.
    const scalarList = value.every((item) => typeof item === 'string' && item.length <= 64)
    if (scalarList) return [...value]
    return value.slice(0, MAX_EXAMPLE_ITEMS).map((item) => compactExample(item, depth + 1))
  }
  if (isSchema(value)) {
    const output: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) output[key] = compactExample(entry, depth + 1)
    return output
  }
  return value
}

/**
 * The ceiling the whole exercise exists to stay under.
 *
 * 16,384 is the parser's limit, matching Vercel's per-header ceiling. The
 * budget is deliberately well below it: a declaration that fits exactly today
 * breaks the day someone adds a field, and the symptom is an unpayable offer
 * rather than a failing build.
 */
export const PAYMENT_HEADER_LIMIT = 16_384
export const PAYMENT_HEADER_BUDGET = 12_288
