import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSpineBundle } from '../script/ui/presentation/spine/SpineBundleLoader.mjs';
import { classifyBundleFallback } from '../script/ui/presentation/spine/SpineBundleFallbackPolicy.mjs';

export const DEFAULT_SIBLING_BUNDLE_ROOT = '/home/wgw/CodexProject/NodeConsoleApp2-SpineAssets/workspace/exports/b1_official_samples';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, 'test-results');

function inferSourceMode(bundleRoot) {
  return bundleRoot.includes('/NodeConsoleApp2-SpineAssets/')
    ? 'sibling_repo'
    : 'fixture';
}

export async function buildSpineBundleProbeReport({
  bundleRoot = DEFAULT_SIBLING_BUNDLE_ROOT,
  outputRoot = DEFAULT_OUTPUT_ROOT
} = {}) {
  const loaded = await loadSpineBundle(bundleRoot);
  const hasSuccessfulCharacters = loaded.characters.some(entry => entry.assetsOk);
  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      mode: inferSourceMode(path.resolve(bundleRoot)),
      bundleRoot: path.resolve(bundleRoot)
    },
    bundle: loaded.bundle,
    characters: loaded.characters.map(entry => ({
      presentationId: entry.presentationId,
      assetsOk: entry.assetsOk,
      errors: entry.errors,
      fallback: classifyBundleFallback({
        bundleErrors: [],
        characterErrors: entry.errors,
        hasSuccessfulCharacters: false
      }),
      manifest: entry.manifest
        ? {
            presentationId: entry.manifest.presentationId,
            skeletonFile: entry.manifest.skeletonFile,
            atlasFile: entry.manifest.atlasFile,
            texturePages: entry.manifest.texturePages,
            defaultSkin: entry.manifest.defaultSkin,
            animations: entry.manifest.animations,
            slots: entry.manifest.slots,
            anchorProfile: entry.manifest.anchorProfile,
            scaleProfile: entry.manifest.scaleProfile
          }
        : null
    })),
    fallback: classifyBundleFallback({
      bundleErrors: loaded.bundle.errors,
      characterErrors: loaded.characterErrors,
      hasSuccessfulCharacters
    })
  };

  const resolvedOutputRoot = path.resolve(outputRoot);
  await fs.mkdir(resolvedOutputRoot, { recursive: true });

  const jsonPath = path.join(resolvedOutputRoot, 'spine_bundle_probe_report.json');
  const modulePath = path.join(resolvedOutputRoot, 'spine_bundle_probe_report.mjs');
  const classicScriptPath = path.join(resolvedOutputRoot, 'spine_bundle_probe_report.js');
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await fs.writeFile(
    modulePath,
    `export const probeReport = ${JSON.stringify(report, null, 2)};\n`,
    'utf8'
  );
  await fs.writeFile(
    classicScriptPath,
    `globalThis.__SPINE_BUNDLE_PROBE_REPORT__ = ${JSON.stringify(report, null, 2)};\n`,
    'utf8'
  );

  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bundleRoot = process.argv[2]
    ? path.resolve(process.argv[2])
    : DEFAULT_SIBLING_BUNDLE_ROOT;
  const report = await buildSpineBundleProbeReport({ bundleRoot });
  console.log(`PROBE REPORT OK mode=${report.source.mode} decision=${report.fallback.decision}`);
}
