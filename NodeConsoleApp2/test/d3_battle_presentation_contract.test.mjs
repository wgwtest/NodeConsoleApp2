import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const repoRoot = path.resolve(import.meta.dirname, '..');
const presentationDir = path.join(repoRoot, 'script', 'ui', 'presentation');
const dataManagerPath = path.join(repoRoot, 'script', 'engine', 'DataManagerV2.js');
const contentPackOverrideStorePath = path.join(repoRoot, 'script', 'tooling', 'ContentPackOverrideStore.js');
const currentEnemyPackPath = path.join(repoRoot, 'assets', 'enemy_packs', 'current', 'enemies.json');
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

async function importFreshDataManagerModule() {
    const contentPackOverrideStoreUrl = moduleUrl(readUtf8(contentPackOverrideStorePath));
    let source = readUtf8(dataManagerPath);
    source = rewriteImport(source, '../tooling/ContentPackOverrideStore.js', contentPackOverrideStoreUrl);
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
        this.children = [];
        this.parentNode = null;
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
        if (this._selectors.has(selector)) return this._selectors.get(selector);
        if (selector === '.sprite-frame-sequence') {
            return this.children.find(child => child.className === 'sprite-frame-sequence') || null;
        }
        return null;
    }

    querySelectorAll(selector) {
        return this._selectorAll.get(selector) || [];
    }

    closest() {
        return null;
    }

    appendChild(node) {
        this.children.push(node);
        node.parentNode = this;
        return node;
    }

    remove() {
        if (!this.parentNode) return;
        this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
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

test('FighterPresenter mounts default walk frame sequence for the player', async () => {
    const originalDocument = globalThis.document;
    globalThis.document = {
        createElement(tagName) {
            const node = new FakeNode('');
            node.tagName = String(tagName).toUpperCase();
            node.setAttribute = (name, value) => {
                node[name] = String(value);
            };
            return node;
        }
    };

    try {
        const { FighterPresenter } = await importFighterPresenterModule();
        const fighter = createFighterFixture('player-character');
        const presenter = new FighterPresenter({
            side: 'self',
            fighterRoot: fighter.root,
            hudRoot: new FakeNode('player-hud')
        });

        presenter.syncVisualState({
            id: 'player',
            hp: 100,
            maxHp: 100,
            bodyParts: {},
            presentation: {
                battleSpriteRef: '../source/character/walk/walk_1.png',
                defaultAnimation: 'walk',
                frameAnimations: {
                    walk: {
                        basePath: '../source/character/walk',
                        filePattern: 'walk_{index}.png',
                        start: 1,
                        end: 61,
                        fps: 12,
                        loop: true
                    }
                }
            }
        });

        const frameLayer = fighter.container.querySelector('.sprite-frame-sequence');
        assert.ok(frameLayer, 'expected frame sequence layer to be mounted');
        assert.equal(frameLayer.dataset.animationKey, 'walk');
        assert.equal(frameLayer.dataset.frameStart, '1');
        assert.equal(frameLayer.dataset.frameEnd, '61');
        assert.equal(frameLayer.dataset.frameFps, '12');
        assert.equal(frameLayer.src, '../source/character/walk/walk_1.png');
        assert.equal(fighter.body.style.backgroundImage, 'none');
    } finally {
        globalThis.document = originalDocument;
    }
});

test('BattlePresentationController forwards player frame sequence presentation', async () => {
    const originalDocument = globalThis.document;
    globalThis.document = {
        createElement(tagName) {
            const node = new FakeNode('');
            node.tagName = String(tagName).toUpperCase();
            node.setAttribute = (name, value) => {
                node[name] = String(value);
            };
            return node;
        }
    };

    try {
        const { BattlePresentationController } = await importBattlePresentationControllerModule();
        const fixture = createBattleRowFixture();
        const controller = new BattlePresentationController({
            root: fixture.root,
            sceneRoot: fixture.scene
        });

        controller.handleBattleStart({
            player: {
                id: 'player',
                hp: 100,
                maxHp: 100,
                bodyParts: {},
                buffs: [],
                presentation: {
                    battleSpriteRef: '../source/character/walk/walk_1.png',
                    defaultAnimation: 'walk',
                    frameAnimations: {
                        walk: {
                            basePath: '../source/character/walk',
                            filePattern: 'walk_{index}.png',
                            start: 1,
                            end: 61,
                            fps: 12,
                            loop: true
                        }
                    }
                }
            },
            enemies: []
        });

        const frameLayer = fixture.player.container.querySelector('.sprite-frame-sequence');
        assert.ok(frameLayer, 'expected player frame sequence layer to be mounted');
        assert.equal(frameLayer.dataset.animationKey, 'walk');
        assert.equal(frameLayer.src, '../source/character/walk/walk_1.png');
    } finally {
        globalThis.document = originalDocument;
    }
});

test('DataManagerV2 copies default player frame presentation into new-game player data', async () => {
    const { default: dataManager } = await importFreshDataManagerModule();
    const presentation = {
        battleSpriteRef: '../source/character/walk/walk_1.png',
        defaultAnimation: 'walk',
        frameAnimations: {
            walk: {
                basePath: '../source/character/walk',
                filePattern: 'walk_{index}.png',
                start: 1,
                end: 61,
                fps: 12,
                loop: true,
                scale: 2.1
            }
        }
    };

    dataManager.gameConfig = {
        player: {
            default: {
                stats: { hp: 100, maxHp: 100, ap: 4, maxAp: 6 },
                skills: { skillTreeId: 'melee_v4_5', skillPoints: 0, learned: [] },
                resources: { exp: 0, gold: 0 },
                bodyParts: {},
                equipment: {},
                inventory: [],
                presentation
            }
        }
    };

    const player = dataManager.createNewGame('Tester');

    assert.deepEqual(player.presentation, presentation);
    assert.notEqual(player.presentation, presentation);
});

test('Current enemy pack battle sprite refs point at existing character art', () => {
    const pack = JSON.parse(readUtf8(currentEnemyPackPath));
    const enemies = Array.isArray(pack?.enemies)
        ? pack.enemies
        : Object.values(pack && typeof pack === 'object' ? pack : {});
    assert.ok(enemies.length > 0, 'current enemy pack should contain enemies');

    const badRefs = [];
    for (const enemy of enemies) {
        const ref = typeof enemy?.presentation?.battleSpriteRef === 'string'
            ? enemy.presentation.battleSpriteRef
            : '';
        if (!ref || ref.includes('??')) {
            badRefs.push(`${enemy?.id || 'unknown'}:${ref || '<missing>'}`);
            continue;
        }

        const normalizedRef = ref.replace(/^\.\.\//u, '');
        const filePath = path.join(repoRoot, normalizedRef);
        if (!fs.existsSync(filePath)) {
            badRefs.push(`${enemy?.id || 'unknown'}:${ref}`);
        }
    }

    assert.deepEqual(badRefs, []);
});

test('DataManagerV2 backfills default frame presentation for saved player data', async () => {
    const { default: dataManager } = await importFreshDataManagerModule();
    const presentation = {
        battleSpriteRef: '../source/character/walk/walk_1.png',
        defaultAnimation: 'walk',
        frameAnimations: {
            walk: {
                basePath: '../source/character/walk',
                filePattern: 'walk_{index}.png',
                start: 1,
                end: 61,
                fps: 12,
                loop: true,
                scale: 2.1
            }
        }
    };

    dataManager.gameConfig = {
        player: {
            default: {
                stats: { hp: 100, maxHp: 100, ap: 4, maxAp: 6 },
                skills: { skillTreeId: 'melee_v4_5', skillPoints: 0, learned: [] },
                resources: { exp: 0, gold: 0 },
                bodyParts: {},
                equipment: {},
                inventory: [],
                presentation
            }
        }
    };
    dataManager.dataConfig.global = {
        player: {
            id: 'saved_player',
            name: 'Saved',
            stats: { hp: 80, maxHp: 100 }
        }
    };

    const player = dataManager.playerData;

    assert.deepEqual(player.presentation, presentation);
    assert.notEqual(player.presentation, presentation);
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
