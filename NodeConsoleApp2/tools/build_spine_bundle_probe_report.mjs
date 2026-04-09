import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSpineBundle } from '../script/ui/presentation/spine/SpineBundleLoader.mjs';
import { classifyBundleFallback } from '../script/ui/presentation/spine/SpineBundleFallbackPolicy.mjs';

export const DEFAULT_SIBLING_BUNDLE_ROOT = '/home/wgw/CodexProject/NodeConsoleApp2-SpineAssets/workspace/exports/b1_official_samples';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, 'test-results');
const RUNTIME_ASSET_ROOT = 'spine_bundle_runtime_assets/characters';
const RUNTIME_ANIMATION_PRIORITY = ['walk', 'run', 'hoverboard', 'roar', 'jump', 'idle'];

function inferSourceMode(bundleRoot) {
  return bundleRoot.includes('/NodeConsoleApp2-SpineAssets/')
    ? 'sibling_repo'
    : 'fixture';
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractAtlasPageNames(atlasText) {
  const lines = atlasText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];
  return [lines[0]];
}

function chooseRuntimePreviewAnimation(animations = []) {
  if (!Array.isArray(animations) || animations.length === 0) return null;

  for (const preferred of RUNTIME_ANIMATION_PRIORITY) {
    const match = animations.find(animation => animation === preferred);
    if (match) return match;
  }

  return animations[0];
}

async function copyCharacterRuntimeAssets({ bundleRoot, outputRoot, character }) {
  const manifest = character.manifest;
  const characterAssetRoot = path.join(bundleRoot, 'characters', character.presentationId);
  const stagedCharacterRoot = path.join(
    outputRoot,
    'spine_bundle_runtime_assets',
    'characters',
    character.presentationId
  );
  const atlasSourcePath = path.join(characterAssetRoot, manifest.atlasFile);
  const atlasText = await fs.readFile(atlasSourcePath, 'utf8');
  const atlasPageNames = extractAtlasPageNames(atlasText);

  await fs.mkdir(stagedCharacterRoot, { recursive: true });
  await fs.copyFile(
    path.join(characterAssetRoot, manifest.skeletonFile),
    path.join(stagedCharacterRoot, manifest.skeletonFile)
  );
  await fs.copyFile(atlasSourcePath, path.join(stagedCharacterRoot, manifest.atlasFile));

  const resolvedTexturePages = atlasPageNames.length > 0 ? atlasPageNames : manifest.texturePages;
  for (const [index, textureFile] of resolvedTexturePages.entries()) {
    const sourceTexturePath = path.join(characterAssetRoot, textureFile);
    const fallbackTexturePath = path.join(
      characterAssetRoot,
      manifest.texturePages[index] ?? manifest.texturePages[0] ?? textureFile
    );
    await fs.copyFile(
      (await exists(sourceTexturePath)) ? sourceTexturePath : fallbackTexturePath,
      path.join(stagedCharacterRoot, textureFile)
    );
  }

  return {
    presentationId: character.presentationId,
    runtimeReady: true,
    characterRoot: `${RUNTIME_ASSET_ROOT}/${character.presentationId}`,
    skeletonUrl: `${RUNTIME_ASSET_ROOT}/${character.presentationId}/${manifest.skeletonFile}`,
    atlasUrl: `${RUNTIME_ASSET_ROOT}/${character.presentationId}/${manifest.atlasFile}`,
    textureUrls: resolvedTexturePages.map(
      textureFile => `${RUNTIME_ASSET_ROOT}/${character.presentationId}/${textureFile}`
    ),
    defaultAnimation: chooseRuntimePreviewAnimation(manifest.animations),
    animations: manifest.animations ?? [],
    defaultSkin: manifest.defaultSkin ?? null,
    scale: manifest.scaleProfile?.baseScale ?? 1,
    anchorProfile: manifest.anchorProfile ?? null
  };
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

  const runtimePreview = {
    assetRoot: RUNTIME_ASSET_ROOT,
    characters: []
  };

  for (const character of loaded.characters) {
    if (!character.assetsOk || !character.manifest) {
      runtimePreview.characters.push({
        presentationId: character.presentationId,
        runtimeReady: false,
        reason: character.errors?.[0]?.code ?? 'CHARACTER_RUNTIME_UNAVAILABLE'
      });
      continue;
    }

    runtimePreview.characters.push(
      await copyCharacterRuntimeAssets({
        bundleRoot: path.resolve(bundleRoot),
        outputRoot: resolvedOutputRoot,
        character
      })
    );
  }

  report.runtimePreview = runtimePreview;

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
