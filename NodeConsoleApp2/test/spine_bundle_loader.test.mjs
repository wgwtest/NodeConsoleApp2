import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

import { loadSpineBundle } from '../script/ui/presentation/spine/SpineBundleLoader.mjs';
import { classifyBundleFallback } from '../script/ui/presentation/spine/SpineBundleFallbackPolicy.mjs';
import { buildSpineBundleProbeReport } from '../tools/build_spine_bundle_probe_report.mjs';

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, 'utf8');
}

async function createBundleFixture(root) {
  const bundleRoot = path.join(root, 'b1_official_samples');
  const spineboyRoot = path.join(bundleRoot, 'characters', 'spineboy');
  const raptorRoot = path.join(bundleRoot, 'characters', 'raptor');

  await writeJson(path.join(bundleRoot, 'bundle_manifest.json'), {
    schemaVersion: 'spine_bundle_manifest_v1',
    bundleId: 'b1_official_samples',
    bundleVersion: '0.1.0',
    generatedAt: '2026-04-07T12:24:08.367Z',
    sourceCatalog: {
      schemaVersion: 'presentation_catalog_v1',
      generatedAt: '2026-04-07T12:24:08.367Z'
    },
    characters: [
      {
        presentationId: 'spineboy',
        characterManifest: 'characters/spineboy/character_manifest.json'
      },
      {
        presentationId: 'raptor',
        characterManifest: 'characters/raptor/character_manifest.json'
      }
    ]
  });

  await writeJson(path.join(spineboyRoot, 'character_manifest.json'), {
    schemaVersion: 'spine_character_manifest_v1',
    presentationId: 'spineboy',
    skeletonFile: 'spineboy.json',
    atlasFile: 'spineboy.atlas',
    texturePages: ['spineboy.png'],
    defaultSkin: 'default',
    animations: ['idle', 'walk'],
    slots: ['head', 'torso'],
    anchorProfile: { x: 0.5, y: 1 },
    scaleProfile: { baseScale: 1 }
  });

  await writeJson(path.join(raptorRoot, 'character_manifest.json'), {
    schemaVersion: 'spine_character_manifest_v1',
    presentationId: 'raptor',
    skeletonFile: 'raptor.json',
    atlasFile: 'raptor.atlas',
    texturePages: ['raptor.png'],
    defaultSkin: 'default',
    animations: ['walk', 'roar'],
    slots: ['neck', 'jaw'],
    anchorProfile: { x: 0.5, y: 1 },
    scaleProfile: { baseScale: 1 }
  });

  await fs.writeFile(path.join(spineboyRoot, 'spineboy.json'), '{}', 'utf8');
  await writeText(
    path.join(spineboyRoot, 'spineboy.atlas'),
    ['spineboy-pma.png', 'size: 1024, 256', 'filter: Linear, Linear', 'pma: true'].join('\n')
  );
  await fs.writeFile(path.join(spineboyRoot, 'spineboy.png'), 'png', 'utf8');

  await fs.writeFile(path.join(raptorRoot, 'raptor.json'), '{}', 'utf8');
  await writeText(
    path.join(raptorRoot, 'raptor.atlas'),
    ['raptor-pma.png', 'size: 1024, 512', 'filter: Linear, Linear', 'pma: true'].join('\n')
  );
  await fs.writeFile(path.join(raptorRoot, 'raptor.png'), 'png', 'utf8');

  return bundleRoot;
}

test('loadSpineBundle 正常读取样本 bundle 并输出角色摘要', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'spine-bundle-load-'));
  const bundleRoot = await createBundleFixture(tmpRoot);

  const loaded = await loadSpineBundle(bundleRoot);

  assert.equal(loaded.bundle.ok, true);
  assert.equal(loaded.bundle.bundleId, 'b1_official_samples');
  assert.equal(loaded.characters.length, 2);
  assert.equal(loaded.characters[0].assetsOk, true);
});

test('classifyBundleFallback 在 bundle 缺失时输出全局回退，在角色缺失时输出单角色回退', async () => {
  const allFallback = classifyBundleFallback({
    bundleErrors: [{ code: 'BUNDLE_NOT_FOUND' }],
    characterErrors: []
  });
  assert.equal(allFallback.decision, 'fallback_static_all');

  const charFallback = classifyBundleFallback({
    bundleErrors: [],
    characterErrors: [{ code: 'CHARACTER_ASSET_MISSING', presentationId: 'raptor' }]
  });
  assert.equal(charFallback.decision, 'fallback_static_character');
});

test('buildSpineBundleProbeReport 生成报告文件并保留角色回退结论', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'spine-bundle-report-'));
  const bundleRoot = await createBundleFixture(tmpRoot);
  const brokenAsset = path.join(bundleRoot, 'characters', 'raptor', 'raptor.atlas');
  const outputRoot = path.join(tmpRoot, 'test-results');

  await fs.rm(brokenAsset);

  const report = await buildSpineBundleProbeReport({ bundleRoot, outputRoot });

  assert.equal(report.bundle.ok, true);
  assert.equal(report.characters.length, 2);
  assert.equal(
    report.characters.find(entry => entry.presentationId === 'raptor').fallback.decision,
    'fallback_static_character'
  );
  assert.equal(await exists(path.join(outputRoot, 'spine_bundle_probe_report.json')), true);
  assert.equal(await exists(path.join(outputRoot, 'spine_bundle_probe_report.mjs')), true);
  assert.equal(await exists(path.join(outputRoot, 'spine_bundle_probe_report.js')), true);

  const classicScript = await fs.readFile(
    path.join(outputRoot, 'spine_bundle_probe_report.js'),
    'utf8'
  );
  assert.match(classicScript, /globalThis\.__SPINE_BUNDLE_PROBE_REPORT__/);
});

test('buildSpineBundleProbeReport 为浏览器动态播放导出可访问的 runtime 资产', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'spine-bundle-runtime-'));
  const bundleRoot = await createBundleFixture(tmpRoot);
  const brokenAsset = path.join(bundleRoot, 'characters', 'raptor', 'raptor.atlas');
  const outputRoot = path.join(tmpRoot, 'test-results');

  await fs.rm(brokenAsset);

  const report = await buildSpineBundleProbeReport({ bundleRoot, outputRoot });
  const spineboyRuntime = report.runtimePreview?.characters?.find(
    entry => entry.presentationId === 'spineboy'
  );
  const raptorRuntime = report.runtimePreview?.characters?.find(
    entry => entry.presentationId === 'raptor'
  );

  assert.ok(spineboyRuntime, 'expected runtime entry for spineboy');
  assert.equal(spineboyRuntime.runtimeReady, true);
  assert.equal(spineboyRuntime.defaultAnimation, 'walk');
  assert.match(
    spineboyRuntime.skeletonUrl,
    /^spine_bundle_runtime_assets\/characters\/spineboy\/spineboy\.json$/
  );
  assert.match(
    spineboyRuntime.atlasUrl,
    /^spine_bundle_runtime_assets\/characters\/spineboy\/spineboy\.atlas$/
  );
  assert.equal(
    await exists(
      path.join(
        outputRoot,
        'spine_bundle_runtime_assets',
        'characters',
        'spineboy',
        'spineboy.json'
      )
    ),
    true
  );
  assert.equal(
    await exists(
      path.join(
        outputRoot,
        'spine_bundle_runtime_assets',
        'characters',
        'spineboy',
        'spineboy.atlas'
      )
    ),
    true
  );
  assert.equal(
    await exists(
      path.join(
        outputRoot,
        'spine_bundle_runtime_assets',
        'characters',
        'spineboy',
        'spineboy-pma.png'
      )
    ),
    true
  );
  assert.equal(raptorRuntime.runtimeReady, false);
});

test('buildSpineBundleProbeReport 在 bundle 缺失时输出 reject_static_all 诊断', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'spine-bundle-missing-'));
  const missingRoot = path.join(tmpRoot, 'missing-bundle');
  const outputRoot = path.join(tmpRoot, 'test-results');

  const report = await buildSpineBundleProbeReport({ bundleRoot: missingRoot, outputRoot });

  assert.equal(report.bundle.ok, false);
  assert.equal(report.fallback.decision, 'fallback_static_all');
  assert.equal(report.bundle.errors[0].code, 'BUNDLE_NOT_FOUND');
});

test('spine_bundle_probe.html 使用 file 协议可加载的 classic script 报告入口', async () => {
  const htmlPath = path.resolve(
    import.meta.dirname,
    'spine_bundle_probe.html'
  );
  const html = await fs.readFile(htmlPath, 'utf8');

  assert.match(html, /<script src="\.\.\/test-results\/spine_bundle_probe_report\.js"><\/script>/);
  assert.doesNotMatch(html, /import\s+\{\s*probeReport\s*\}\s+from\s+'\.\.\/test-results\/spine_bundle_probe_report\.mjs'/);
});

test('spine_bundle_probe.html 的内联脚本可以被解析', async () => {
  const htmlPath = path.resolve(
    import.meta.dirname,
    'spine_bundle_probe.html'
  );
  const html = await fs.readFile(htmlPath, 'utf8');
  const scriptMatches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)];
  const inlineScript = scriptMatches.at(-1)?.[1];

  assert.ok(inlineScript, 'expected inline script block');
  assert.doesNotThrow(() => new vm.Script(inlineScript));
});

test('spine_bundle_probe.html 暴露动态播放区和官方 Spine player 资源入口', async () => {
  const htmlPath = path.resolve(
    import.meta.dirname,
    'spine_bundle_probe.html'
  );
  const html = await fs.readFile(htmlPath, 'utf8');

  assert.match(
    html,
    /<link rel="stylesheet" href="\.\.\/node_modules\/@esotericsoftware\/spine-player\/dist\/spine-player\.css">/
  );
  assert.match(
    html,
    /<script src="\.\.\/node_modules\/@esotericsoftware\/spine-player\/dist\/iife\/spine-player\.js"><\/script>/
  );
  assert.match(html, /<h2>Dynamic Playback<\/h2>/);
  assert.match(html, /probeReport\.runtimePreview/);
  assert.match(html, /js-animation-select/);
  assert.match(html, /js-playback-toggle/);
  assert.match(html, /js-preset-button/);
  assert.match(html, /URLSearchParams/);
  assert.match(html, /animation_\$\{entry\.presentationId\}/);
  assert.match(html, /playerRegistry/);
  assert.match(html, /const playbackPresetCatalog =/);
  assert.match(html, /spineboy:\s*\[/);
  assert.match(html, /raptor:\s*\[/);
  assert.match(html, /applyPlaybackPreset/);
});

test('spine_bundle_showcase.html 提供聚焦演示页和快捷动作入口', async () => {
  const htmlPath = path.resolve(
    import.meta.dirname,
    'spine_bundle_showcase.html'
  );
  const html = await fs.readFile(htmlPath, 'utf8');
  const scriptMatches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)];
  const inlineScript = scriptMatches.at(-1)?.[1];

  assert.match(html, /<title>Spine Bundle Showcase<\/title>/);
  assert.match(
    html,
    /<link rel="stylesheet" href="\.\.\/node_modules\/@esotericsoftware\/spine-player\/dist\/spine-player\.css">/
  );
  assert.match(
    html,
    /<script src="\.\.\/node_modules\/@esotericsoftware\/spine-player\/dist\/iife\/spine-player\.js"><\/script>/
  );
  assert.match(html, /<script src="\.\.\/test-results\/spine_bundle_probe_report\.js"><\/script>/);
  assert.match(html, /<h1>Spine Bundle Showcase<\/h1>/);
  assert.match(html, /showcase-stage/);
  assert.match(html, /js-showcase-player/);
  assert.match(html, /js-preset-button/);
  assert.match(html, /const playbackPresetCatalog =/);
  assert.match(html, /renderShowcase/);
  assert.match(html, /URLSearchParams/);
  assert.match(html, /spine_bundle_probe\.html/);
  assert.ok(inlineScript, 'expected inline script block');
  assert.doesNotThrow(() => new vm.Script(inlineScript));
});
