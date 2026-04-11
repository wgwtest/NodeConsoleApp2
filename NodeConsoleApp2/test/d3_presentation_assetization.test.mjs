import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const assetStorePath = path.join(repoRoot, 'script', 'ui', 'presentation', 'BattlePresentationAssetStore.js');
const controllerPath = path.join(repoRoot, 'script', 'ui', 'presentation', 'BattlePresentationController.js');
const battleRowPath = path.join(repoRoot, 'script', 'ui', 'UI_BattleRow.js');
const assetJsonPath = path.join(repoRoot, 'assets', 'data', 'battle_presentation_profiles_v1.json');
const configuratorPath = path.join(repoRoot, 'test', 'battle_presentation_configurator.html');
const mockCssPath = path.join(repoRoot, 'mock_ui_v11.css');

function readUtf8(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

test('BattlePresentationAssetStore 提供展示配置资产读写入口', () => {
    assert.equal(fs.existsSync(assetStorePath), true, 'BattlePresentationAssetStore.js 缺失');
    const source = readUtf8(assetStorePath);

    assert.match(source, /BATTLE_PRESENTATION_PROFILE_STORAGE_KEY/, '缺少展示配置 workspace 存储键');
    assert.match(source, /loadBattlePresentationProfile\s*\(/, '缺少 loadBattlePresentationProfile');
    assert.match(source, /saveBattlePresentationProfileWorkspace\s*\(/, '缺少 saveBattlePresentationProfileWorkspace');
    assert.match(source, /clearBattlePresentationProfileWorkspace\s*\(/, '缺少 clearBattlePresentationProfileWorkspace');
});

test('BattlePresentationController 与 UI_BattleRow 会消费展示配置资产', () => {
    const controllerSource = readUtf8(controllerPath);
    const battleRowSource = readUtf8(battleRowPath);

    assert.match(controllerSource, /applyPresentationProfile\s*\(/, 'BattlePresentationController 缺少 applyPresentationProfile');
    assert.match(battleRowSource, /loadBattlePresentationProfile\s*\(/, 'UI_BattleRow 未装载展示配置资产');
    assert.match(battleRowSource, /applyPresentationProfile\s*\(/, 'UI_BattleRow 未把配置资产应用到 BattlePresentationController');
});

test('默认展示配置资产文件存在且包含基础结构', () => {
    assert.equal(fs.existsSync(assetJsonPath), true, 'battle_presentation_profiles_v1.json 缺失');
    const json = JSON.parse(readUtf8(assetJsonPath));

    assert.equal(typeof json?.schemaVersion, 'number', '展示配置资产缺少 schemaVersion');
    assert.equal(typeof json?.meta?.id, 'string', '展示配置资产缺少 meta.id');
    assert.equal(typeof json?.activeProfileId, 'string', '展示配置资产缺少 activeProfileId');
    assert.equal(Array.isArray(json?.profiles), true, '展示配置资产缺少 profiles 数组');
    assert.equal(json.profiles.length > 0, true, '展示配置资产至少应包含一个 profile');
});

test('battle_presentation_configurator 提供可理解的展示参数工具说明', () => {
    assert.equal(fs.existsSync(configuratorPath), true, 'battle_presentation_configurator.html 缺失');
    const html = readUtf8(configuratorPath);

    for (const requiredText of [
        '动画参数配置器',
        '只改展示参数',
        '不会改伤害、Buff 结果或敌人行为',
        '写入浏览器 workspace',
        '导出 JSON',
        'battle_presentation_probe.html',
        'mock_ui_v11.html'
    ]) {
        assert.match(html, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `battle_presentation_configurator 缺少说明：${requiredText}`);
    }
});

test('battle_presentation_configurator 把参数编辑与实时预览放在同一工作区，并移除镜头冲击按钮', () => {
    const html = readUtf8(configuratorPath);

    assert.match(html, /参数编辑与实时预览同屏/, '配置器未说明参数编辑与实时预览同屏');
    assert.doesNotMatch(html, /id="btnPreviewImpact"/, '配置器仍保留镜头冲击按钮');
    assert.doesNotMatch(html, /镜头冲击/, '配置器仍向人工验收暴露镜头冲击入口');
});

test('battle-scene 的 scene-impact 不再通过位移制造屏幕晃动', () => {
    const css = readUtf8(mockCssPath);
    const animationMatch = css.match(/\.battle-scene\.scene-impact\s*\{[^}]*animation:\s*([a-zA-Z0-9_-]+)/);

    assert.ok(animationMatch, '缺少 .battle-scene.scene-impact 动画配置');

    const keyframesName = animationMatch[1];
    const keyframesMatch = css.match(new RegExp(`@keyframes\\s+${keyframesName}\\s*\\{([\\s\\S]*?)\\n\\}`));

    assert.ok(keyframesMatch, `缺少 ${keyframesName} 的 keyframes 定义`);
    assert.doesNotMatch(keyframesMatch[1], /translate\(/, 'scene-impact 仍通过 translate 触发屏幕晃动');
});
