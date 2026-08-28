/**
 * Canonicalization is the root of every digest in a dossier package, so it is
 * re-exported rather than reimplemented. It sorts object keys, applies Unicode
 * NFC normalization, normalizes instants to UTC second precision, and excludes
 * digest fields from their own input.
 */
export {
  CANONICALIZATION_VERSION,
  EMPTY_PAYLOAD_SHA256,
  canonicalJson,
  canonicalize,
  isPlaceholderDigest,
  passageDigest,
  provenanceDigest,
  sha256Hex,
} from '../../../lib/evidence-dossier/digest.ts'

export { serializeDossier, serializeDossierCanonical } from '../../../lib/evidence-dossier/serialize.ts'
