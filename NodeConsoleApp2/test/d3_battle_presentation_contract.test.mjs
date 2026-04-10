import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const presentationDir = path.join(repoRoot, 'script', 'ui', 'presentation');
const controllerPath = path.join(presentationDir, 'BattlePresentationController.js');
const presenterPath = path.join(presentationDir, 'FighterPresenter.js');
const animationDriverPath = path.join(presentationDir, 'BattleAnimationDriver.js');
const configPath = path.join(presentationDir, 'BattlePresentationConfig.js');

function readUtf8(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

test('BattlePresentationController 依赖的展示配置文件必须存在', () => {
    const controllerSource = readUtf8(controllerPath);

    assert.match(
        controllerSource,
        /from ['"]\.\/BattlePresentationConfig\.js['"]/,
        'BattlePresentationController 未声明展示配置依赖'
    );
    assert.equal(
        fs.existsSync(configPath),
        true,
        'BattlePresentationConfig.js 缺失，会导致 mock_ui_v11.html 运行时 404'
    );
});

test('FighterPresenter 仍暴露模板驱动入口', () => {
    const presenterSource = readUtf8(presenterPath);

    assert.match(
        presenterSource,
        /playTemplate\s*\(/,
        'FighterPresenter 缺少 playTemplate，BattlePresentationController 无法按模板驱动角色表现'
    );
});

test('BattleAnimationDriver 仍暴露场景脉冲入口', () => {
    const driverSource = readUtf8(animationDriverPath);

    assert.match(
        driverSource,
        /pulseSceneDirective\s*\(/,
        'BattleAnimationDriver 缺少 pulseSceneDirective，场景脉冲无法由展示控制器触发'
    );
});
