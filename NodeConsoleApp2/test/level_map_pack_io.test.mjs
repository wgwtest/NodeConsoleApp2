import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');
const ioModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelMapPackIO.js');
const workspaceModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelMapWorkspace.js');
const assetResolverModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelMapAssetResolver.js');
const validPackPath = path.join(projectRoot, 'assets', 'data', 'level_map_pack_v1.example.json');
const invalidPackPath = path.join(projectRoot, 'assets', 'data', 'level_map_pack_v1.invalid.example.json');
const levelsPath = path.join(projectRoot, 'assets', 'data', 'levels.json');
const ioPagePath = path.join(projectRoot, 'test', 'level_map_editor_io_test.html');
const regressionRunnerPath = path.join(projectRoot, 'test', 'codex_regression_runner.html');

async function importSourceModule(filePath) {
    assert.equal(fs.existsSync(filePath), true, `缺少源文件: ${filePath}`);
    let source = await fsp.readFile(filePath, 'utf8');
    if (source.includes('./LevelMapWorkspace.js')) {
        const workspaceSource = await fsp.readFile(workspaceModulePath, 'utf8');
        const assetResolverSource = await fsp.readFile(assetResolverModulePath, 'utf8');
        const assetResolverEncoded = Buffer.from(assetResolverSource, 'utf8').toString('base64');
        const workspacePatched = workspaceSource.includes('./LevelMapAssetResolver.js')
            ? workspaceSource.replace(
                "'./LevelMapAssetResolver.js'",
                `'data:text/javascript;base64,${assetResolverEncoded}'`
            )
            : workspaceSource;
        const workspaceEncoded = Buffer.from(workspacePatched, 'utf8').toString('base64');
        source = source.replace(
            "'./LevelMapWorkspace.js'",
            `'data:text/javascript;base64,${workspaceEncoded}'`
        );
    }
    if (source.includes('./LevelMapAssetResolver.js')) {
        const assetResolverSource = await fsp.readFile(assetResolverModulePath, 'utf8');
        const assetResolverEncoded = Buffer.from(assetResolverSource, 'utf8').toString('base64');
        source = source.replace(
            "'./LevelMapAssetResolver.js'",
            `'data:text/javascript;base64,${assetResolverEncoded}'`
        );
    }
    const encoded = Buffer.from(source, 'utf8').toString('base64');
    return import(`data:text/javascript;base64,${encoded}`);
}

async function readJson(filePath) {
    assert.equal(fs.existsSync(filePath), true, `缺少文件: ${filePath}`);
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
}

test('LevelMapPackIO 能分析合法地图包并给出零问题摘要', async () => {
    const { analyzeLevelMapPack } = await importSourceModule(ioModulePath);
    const [rawMapPack, levelsDocument] = await Promise.all([
        readJson(validPackPath),
        readJson(levelsPath)
    ]);

    const report = analyzeLevelMapPack(rawMapPack, { levelsDocument });

    assert.equal(report.issueCount, 0);
    assert.equal(report.issues.length, 0);
    assert.equal(report.summary.mapCount >= 1, true);
    assert.equal(report.summary.nodeCount >= 1, true);
    assert.equal(report.summary.edgeCount >= 1, true);
    assert.equal(report.normalized.$schemaVersion, 'level_map_pack_v1');
    assert.equal(Array.isArray(report.normalized.assetLibrary?.nodeArts), true);
    assert.equal(Array.isArray(report.normalized.assetLibrary?.portraits), true);
    assert.equal(report.normalized.assetLibrary?.backgrounds?.[0]?.src?.includes('../source/map/'), true);
});

test('正式地图包样例默认使用 source 目录中的背景图与节点素材图', async () => {
    const rawMapPack = await readJson(validPackPath);
    const backgrounds = rawMapPack.assetLibrary?.backgrounds || [];
    const nodeArts = rawMapPack.assetLibrary?.nodeArts || [];
    const firstMap = rawMapPack.maps?.[0] || {};

    assert.equal(backgrounds.length >= 1, true);
    assert.equal(nodeArts.length >= 1, true);
    assert.equal(backgrounds.every((item) => typeof item.src === 'string' && item.src.includes('../source/map/')), true);
    assert.equal(nodeArts.every((item) => typeof item.src === 'string' && item.src.includes('../source/scene_icon/')), true);
    assert.equal(backgrounds.some((item) => typeof item.src === 'string' && item.src.endsWith('.jpeg')), true);
    assert.equal(nodeArts.some((item) => typeof item.src === 'string' && item.src.endsWith('.png')), true);
    assert.deepEqual(firstMap.space, { logicalWidth: 1600, logicalHeight: 900 });
    assert.equal(firstMap.display?.viewportAspect, '16:9');
    assert.equal(firstMap.display?.nodeScale, 0.6);
    assert.equal(typeof firstMap.nodes?.[0]?.position?.x, 'number');
    assert.equal(typeof firstMap.nodes?.[0]?.position?.y, 'number');
});

test('LevelMapPackIO 能识别非法地图包中的关键问题码', async () => {
    const { analyzeLevelMapPack } = await importSourceModule(ioModulePath);
    const [rawMapPack, levelsDocument] = await Promise.all([
        readJson(invalidPackPath),
        readJson(levelsPath)
    ]);

    const report = analyzeLevelMapPack(rawMapPack, { levelsDocument });
    const issueCodes = new Set(report.issues.map(issue => issue.code));

    assert.equal(report.issueCount >= 6, true);
    assert.equal(issueCodes.has('missing_entry_node'), true);
    assert.equal(issueCodes.has('missing_level_ref'), true);
    assert.equal(issueCodes.has('missing_node_ref'), true);
    assert.equal(issueCodes.has('missing_background_ref'), true);
    assert.equal(issueCodes.has('missing_node_art_ref'), true);
    assert.equal(issueCodes.has('missing_portrait_ref'), true);
});

test('LevelMapPackIO 能执行 round-trip 检查并保持合法样例结构稳定', async () => {
    const { runLevelMapPackRoundTrip } = await importSourceModule(ioModulePath);
    const [rawMapPack, levelsDocument] = await Promise.all([
        readJson(validPackPath),
        readJson(levelsPath)
    ]);

    const report = runLevelMapPackRoundTrip(rawMapPack, { levelsDocument });

    assert.equal(report.before.issueCount, 0);
    assert.equal(report.after.issueCount, 0);
    assert.deepEqual(report.before.summary, report.after.summary);
    assert.equal(report.structuralMatch, true);
});

test('LevelMapPackIO 能导出目录式地图包入口与资源依赖清单', async () => {
    const { buildLevelMapPackageExport } = await importSourceModule(ioModulePath);
    const [rawMapPack, levelsDocument] = await Promise.all([
        readJson(validPackPath),
        readJson(levelsPath)
    ]);

    const bundle = buildLevelMapPackageExport(rawMapPack, {
        levelsDocument,
        packageId: 'story_pack_v1',
        packageTitle: '故事地图包 v1'
    });

    assert.equal(bundle.packageJson.$schemaVersion, 'level_map_package_v1');
    assert.equal(bundle.packageJson.packageId, 'story_pack_v1');
    assert.equal(bundle.packageJson.title, '故事地图包 v1');
    assert.equal(bundle.packageJson.files.maps, 'maps.json');
    assert.equal(bundle.packageJson.assets.basePath, 'assets/');
    assert.deepEqual(bundle.packageJson.stories.map(story => story.id), ['story_default']);
    assert.equal(bundle.mapsJson.$schemaVersion, 'level_map_pack_v1');
    assert.equal(Array.isArray(bundle.mapsJson.stories), true);
    assert.equal(Array.isArray(bundle.mapsJson.chapters), true);
    assert.equal(bundle.assetManifest.backgrounds.length >= 1, true);
    assert.equal(bundle.assetManifest.nodeArts.length >= 1, true);
    assert.equal(bundle.assetManifest.backgrounds[0].source.includes('../source/map/'), true);
    assert.equal(bundle.assetManifest.nodeArts[0].packagePath.startsWith('assets/nodeArts/'), true);
});

test('level_map_editor_io_test.html 会明确页面用途、样例类型和与 3.2.3.2 的关系', async () => {
    assert.equal(fs.existsSync(ioPagePath), true, 'level_map_editor_io_test.html 缺失');
    const html = await fsp.readFile(ioPagePath, 'utf8');

    for (const requiredText of [
        '地图包导入导出与校验',
        '这是个啥工具',
        '为什么点这些按钮',
        'JSON + image assets',
        '背景图资源',
        '节点素材图',
        '立绘图',
        '合法样例',
        '非法样例',
        'round-trip',
        'level_map_editor_v1.html',
        'WBS-3.2.3.2',
        'WBS-3.2.3.3'
    ]) {
        assert.match(
            html,
            new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            `level_map_editor_io_test.html 缺少说明：${requiredText}`
        );
    }
});

test('codex_regression_runner.html 会把 WBS-3.2.3.3 纳入共享回归范围', async () => {
    assert.equal(fs.existsSync(regressionRunnerPath), true, 'codex_regression_runner.html 缺失');
    const html = await fsp.readFile(regressionRunnerPath, 'utf8');

    for (const requiredText of [
        'WBS-3.2.3.3',
        'level_map_editor_io_test 提供地图包导入导出与校验入口'
    ]) {
        assert.match(
            html,
            new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            `codex_regression_runner.html 缺少 3.2.3.3 回归接入：${requiredText}`
        );
    }
});
