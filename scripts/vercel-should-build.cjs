#!/usr/bin/env node
/**
 * Defense in depth for Git-triggered deployments: Vercel's ignoreCommand uses
 * exit 0 to SKIP. All automatic builds are disabled in vercel.json too.
 *
 * Do not infer spending approval from a branch, changed file or environment
 * variable. An approved release uses an explicitly invoked local/prebuilt
 * upload; this Git ignore step must never authorize another build.
 * createDeployments controls GitHub deployment records, NOT Vercel builds.
 */
console.log('Skipping automatic Git build: explicit user-approved manual deployment required.')
process.exit(0)
