/**
 * The substantial-page adapter is re-exported, not reimplemented. It is the
 * only supported way to turn a published substantial page into a dossier draft,
 * and duplicating it here would let the two drift apart.
 */
export {
  SUBSTANTIAL_PAGE_DOSSIER_ADAPTER_VERSION,
} from '../../../../lib/evidence-dossier/substantial-page-adapter.ts'
export * from '../../../../lib/evidence-dossier/substantial-page-adapter.ts'
