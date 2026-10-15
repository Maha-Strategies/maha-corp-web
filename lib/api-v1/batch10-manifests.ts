import { id, digest, hash } from './batch5-core.ts'
import { LICENSE_RECORD_AUDITS, recordAuditSuite } from './batch9-record-suite.ts'

const remainingLicenseActions = ['schema-directionality', 'record-sequence-diff', 'provenance-edge-audit', 'scope-boundary-audit', 'export-semantic-parity']
export const BATCH10_LICENSES = LICENSE_RECORD_AUDITS.filter(s => remainingLicenseActions.some(a => s.id === 'license-records-' + a))

export const BATCH10_PACKAGES = recordAuditSuite({
  category: 'package-manifests', noun: 'caller-supplied package release and file-inventory manifests',
  boundary: 'Manifest revision lineage only, not a resolved package dependency graph. No registry lookup, download, installation, code execution, vulnerability scan, publisher authentication or software-safety certification.',
  pins: { publisherRef: id, packageRef: id, manifestRevision: digest, fileSetDigest: digest, scopeRef: id },
  sample: { id: 'package1', publisherRef: 'publisher1', packageRef: 'package-at-version1', manifestRevision: hash, fileSetDigest: hash, scopeRef: 'public-metadata' },
  owner: 'publisherRef', subject: 'packageRef', revision: 'manifestRevision', content: 'fileSetDigest', units: ['bytes', 'KiB', 'KB'], unitMeaning: 'declared unpacked package size',
}).filter(s => s.id !== 'package-manifests-identifier-crosswalk-audit').map(s => ({ ...s,
  description: s.description.replace('issuer/subject or producer/work pins', 'publisher/package/revision/file-inventory pins') }))
