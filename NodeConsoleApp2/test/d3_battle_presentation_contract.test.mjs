import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const repoRoot = path.resolve(import.meta.dirname, '..');
const presentationDir = path.join(repoRoot, 'script', 'ui', 'presentation');
const controllerPath = path.join(presentationDir, 'BattlePresentationController.js');
const presenterPath = path.join(presentationDir, 'FighterPresenter.js');
const animationDriverPath = path.join(presentationDir, 'BattleAnimationDriver.js');
const configPath = path.join(presentationDir, 'BattlePresentationConfig.js');
const assetStorePath = path.join(presentationDir, 'BattlePresentationAssetStore.js');

function readUtf8(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function moduleUrl(source) {
    return `data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`;
}

function rewriteImport(source, request, replacementUrl) {
    const escaped = request.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return source.replace(new RegExp(`from ['"]${escaped}['"]`, 'gu'), `from '${replacementUrl}'`);
}

function readAssetStoreForDataModule() {
    return readUtf8(assetStorePath).replace(
        /new URL\(['"]\.\.\/\.\.\/\.\.\/assets\/data\/battle_presentation_profiles_v1\.json['"],\s*import\.meta\.url\)\.href/u,
        "'/assets/data/battle_presentation_profiles_v1.json'"
    );
}

function buildFighterPresenterModuleUrl() {
    const animationDriverUrl = moduleUrl(readUtf8(animationDriverPath));
    let source = readUtf8(presenterPath);
    source = rewriteImport(source, './BattleAnimationDriver.js', animationDriverUrl);
    return moduleUrl(source);
}

async function importFighterPresenterModule() {
    return import(buildFighterPresenterModuleUrl());
}

async function importBattlePresentationControllerModule() {
    const animationDriverUrl = moduleUrl(readUtf8(animationDriverPath));
    const assetStoreUrl = moduleUrl(readAssetStoreForDataModule());
    const configUrl = moduleUrl(readUtf8(configPath));
    const fighterPresenterUrl = buildFighterPresenterModuleUrl();
    let source = readUtf8(controllerPath);
    source = rewriteImport(source, './BattleAnimationDriver.js', animationDriverUrl);
    source = rewriteImport(source, './BattlePresentationAssetStore.js', assetStoreUrl);
    source = rewriteImport(source, './BattlePresentationConfig.js', configUrl);
    source = rewriteImport(source, './FighterPresenter.js', fighterPresenterUrl);
    return import(moduleUrl(source));
}

class FakeStyle {
    constructor() {
        this.properties = new Map();
    }

    setProperty(name, value) {
        this.properties.set(name, String(value));
    }

    getPropertyValue(name) {
        return this.properties.get(name) || '';
    }
}

class FakeClassList {
    constructor(node) {
        this.node = node;
        this.values = new Set(String(node.className || '').split(/\s+/u).filter(Boolean));
    }

    add(...names) {
        names.forEach(name => this.values.add(name));
        this.node.className = [...this.values].join(' ');
    }

    remove(...names) {
        names.forEach(name => this.values.delete(name));
        this.node.className = [...this.values].join(' ');
    }

    contains(name) {
        return this.values.has(name);
    }
}

class FakeNode {
    constructor(className = '') {
        this.className = className;
        this.classList = new FakeClassList(this);
        this.dataset = {};
        this.style = new FakeStyle();
        this._selectors = new Map();
        this._selectorAll = new Map();
    }

    setQuery(selector, node) {
        this._selectors.set(selector, node);
        return node;
    }

    setQueryAll(selector, nodes) {
        this._selectorAll.set(selector, nodes);
    }

    querySelector(selector) {
        return this._selectors.has(selector) ? this._selectors.get(selector) : null;
    }

    querySelectorAll(selector) {
        return this._selectorAll.get(selector) || [];
    }

    closest() {
        return null;
    }
}

function createFighterFixture(className) {
    const root = new FakeNode(`fighter ${className}`);
    const container = new FakeNode('character-sprite-container');
    const body = new FakeNode('sprite-layer body');
    root.setQuery('.character-sprite-container', container);
    root.setQuery('.character-shadow', new FakeNode('character-shadow'));
    root.setQuery('.effect-anchor', new FakeNode('effect-anchor'));
    container.setQuery('.sprite-layer.body', body);
    return { root, container, body };
}

function createBattleRowFixture() {
    const root = new FakeNode('battle-row');
    const scene = new FakeNode('battle-scene');
    const player = createFighterFixture('player-character');
    const enemy = createFighterFixture('enemy-character');

    root.setQuery('.battle-scene', scene);
    root.setQuery('.player-hud', new FakeNode('player-hud'));
    root.setQuery('.enemy-hud', new FakeNode('enemy-hud'));
    root.setQuery('[data-role="battle-presentation-meta"]', null);
    scene.setQuery('.fx-layer', new FakeNode('fx-layer'));
    scene.setQuery('.fighter.player-character', player.root);
    scene.setQuery('.fighter.enemy-character', enemy.root);

    return { root, scene, player, enemy };
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

test('FighterPresenter 会按 battleSpriteRef 更新敌人完整原画图层，并在缺省时清回默认图', async () => {
    const { FighterPresenter } = await importFighterPresenterModule();
    const fighter = createFighterFixture('enemy-character');
    const presenter = new FighterPresenter({
        side: 'enemy',
        fighterRoot: fighter.root,
        hudRoot: new FakeNode('enemy-hud')
    });
    const spriteRef = '../source/character/敌人-005-状态001-正常状态.png';

    presenter.syncVisualState({
        id: 'enemy_1',
        hp: 90,
        maxHp: 90,
        bodyParts: {},
        presentation: { battleSpriteRef: spriteRef }
    });

    assert.equal(fighter.body.dataset.battleSpriteRef, spriteRef);
    assert.match(fighter.body.style.backgroundImage, /敌人-005-状态001-正常状态\.png/u);
    assert.equal(fighter.body.style.backgroundSize, 'contain');
    assert.equal(fighter.body.style.backgroundPosition, 'bottom center');
    assert.equal(fighter.body.style.backgroundRepeat, 'no-repeat');

    presenter.syncVisualState({
        id: 'enemy_1',
        hp: 90,
        maxHp: 90,
        bodyParts: {},
        presentation: {}
    });

    assert.equal(fighter.body.dataset.battleSpriteRef, undefined);
    assert.equal(fighter.body.style.backgroundImage, '');
});

test('BattlePresentationController 会把敌人模板里的 battleSpriteRef 传到敌人展示层', async () => {
    const { BattlePresentationController } = await importBattlePresentationControllerModule();
    const fixture = createBattleRowFixture();
    const spriteRef = '../source/character/敌人-004-状态001-正常状态.png';
    const controller = new BattlePresentationController({
        root: fixture.root,
        sceneRoot: fixture.scene
    });

    controller.handleBattleStart({
        player: { id: 'player', hp: 120, maxHp: 120, bodyParts: {}, buffs: [] },
        enemies: [{
            id: 'enemy_1',
            hp: 100,
            maxHp: 100,
            bodyParts: {},
            buffs: [],
            presentation: { battleSpriteRef: spriteRef }
        }]
    });

    assert.equal(fixture.enemy.body.dataset.battleSpriteRef, spriteRef);
    assert.match(fixture.enemy.body.style.backgroundImage, /敌人-004-状态001-正常状态\.png/u);
});
