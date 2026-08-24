import { revalidatePath } from 'next/cache'

import type { EpistemicCanonicalRelease } from './epistemic-release.ts'

export function revalidateEpistemicReleasePaths(release: EpistemicCanonicalRelease): string[] {
  const paths = [
    release.canonicalPath,
    `${release.canonicalPath}/provenance.json`,
    `/knowledge/${release.domainSlug}`,
    `/knowledge/${release.domainSlug}/registry`,
    '/knowledge',
    '/knowledge/epistemic-system/releases',
    '/knowledge/epistemic-system/releases/registry.json',
    `/knowledge/epistemic-system/releases/${release.releaseId}/provenance.json`,
    '/sitemap.xml',
    '/llms.txt',
  ]
  for (const path of paths) revalidatePath(path)
  return paths
}
