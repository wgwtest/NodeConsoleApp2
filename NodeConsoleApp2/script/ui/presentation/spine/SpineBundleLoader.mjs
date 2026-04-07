import fs from 'node:fs/promises';
import path from 'node:path';

import { classifyBundleFallback } from './SpineBundleFallbackPolicy.mjs';

const SUPPORTED_BUNDLE_SCHEMA = 'spine_bundle_manifest_v1';
const SUPPORTED_CHARACTER_SCHEMA = 'spine_character_manifest_v1';

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function createError(code, message, extra = {}) {
  return {
    code,
    message,
    ...extra
  };
}

export async function loadSpineBundle(bundleRoot) {
  const resolvedBundleRoot = path.resolve(bundleRoot);
  const bundleManifestPath = path.join(resolvedBundleRoot, 'bundle_manifest.json');
  const bundleErrors = [];
  const characters = [];

  if (!(await exists(bundleManifestPath))) {
    return {
      bundleRoot: resolvedBundleRoot,
      bundle: {
        ok: false,
        bundleId: null,
        bundleVersion: null,
        schemaVersion: null,
        manifestPath: bundleManifestPath,
        errors: [
          createError(
            'BUNDLE_NOT_FOUND',
            `bundle_manifest.json 缺失: ${bundleManifestPath}`
          )
        ]
      },
      characters: [],
      characterErrors: []
    };
  }

  const bundleManifest = await readJson(bundleManifestPath);
  if (bundleManifest?.schemaVersion !== SUPPORTED_BUNDLE_SCHEMA) {
    bundleErrors.push(
      createError(
        'BUNDLE_SCHEMA_UNSUPPORTED',
        `不支持的 bundle schemaVersion: ${bundleManifest?.schemaVersion ?? 'unknown'}`,
        {
          schemaVersion: bundleManifest?.schemaVersion ?? null
        }
      )
    );
  }

  const characterEntries = Array.isArray(bundleManifest?.characters)
    ? bundleManifest.characters
    : [];

  for (const item of characterEntries) {
    const presentationId = item?.presentationId || null;
    const characterManifestPath = item?.characterManifest
      ? path.join(resolvedBundleRoot, item.characterManifest)
      : null;
    const characterErrors = [];
    let manifest = null;

    if (!characterManifestPath || !(await exists(characterManifestPath))) {
      characterErrors.push(
        createError(
          'CHARACTER_MANIFEST_MISSING',
          `character_manifest 缺失: ${characterManifestPath || 'unknown'}`,
          { presentationId, manifestPath: characterManifestPath }
        )
      );
    } else {
      manifest = await readJson(characterManifestPath);

      if (manifest?.schemaVersion !== SUPPORTED_CHARACTER_SCHEMA) {
        characterErrors.push(
          createError(
            'CHARACTER_SCHEMA_UNSUPPORTED',
            `不支持的 character schemaVersion: ${manifest?.schemaVersion ?? 'unknown'}`,
            {
              presentationId,
              schemaVersion: manifest?.schemaVersion ?? null
            }
          )
        );
      }

      const characterDir = path.dirname(characterManifestPath);
      const requiredFiles = [];
      if (manifest?.skeletonFile) {
        requiredFiles.push({
          kind: 'skeleton',
          filePath: path.join(characterDir, manifest.skeletonFile),
          fileName: manifest.skeletonFile
        });
      }
      if (manifest?.atlasFile) {
        requiredFiles.push({
          kind: 'atlas',
          filePath: path.join(characterDir, manifest.atlasFile),
          fileName: manifest.atlasFile
        });
      }
      for (const texture of Array.isArray(manifest?.texturePages) ? manifest.texturePages : []) {
        requiredFiles.push({
          kind: 'texture',
          filePath: path.join(characterDir, texture),
          fileName: texture
        });
      }

      for (const requiredFile of requiredFiles) {
        if (!(await exists(requiredFile.filePath))) {
          characterErrors.push(
            createError(
              'CHARACTER_ASSET_MISSING',
              `角色资源缺失: ${requiredFile.fileName}`,
              {
                presentationId,
                assetKind: requiredFile.kind,
                assetFile: requiredFile.fileName
              }
            )
          );
        }
      }
    }

    characters.push({
      presentationId,
      manifestPath: characterManifestPath,
      manifest,
      errors: characterErrors,
      assetsOk: characterErrors.length === 0,
      fallback: classifyBundleFallback({
        bundleErrors: [],
        characterErrors,
        hasSuccessfulCharacters: false
      })
    });
  }

  const characterErrors = characters.flatMap(entry =>
    entry.errors.map(error => ({
      ...error,
      presentationId: error.presentationId || entry.presentationId
    }))
  );

  return {
    bundleRoot: resolvedBundleRoot,
    bundle: {
      ok: bundleErrors.length === 0,
      bundleId: bundleManifest?.bundleId ?? null,
      bundleVersion: bundleManifest?.bundleVersion ?? null,
      schemaVersion: bundleManifest?.schemaVersion ?? null,
      manifestPath: bundleManifestPath,
      charactersCount: characterEntries.length,
      errors: bundleErrors
    },
    characters,
    characterErrors
  };
}
