import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');
const workspaceModulePath = path.join(projectRoot, 'script', 'editor', 'enemy', 'EnemyWorkspace.js');

async function importSourceModule(filePath) {
    assert.equal(fs.existsSync(filePath), true, `缺少源文件: ${filePath}`);
    const source = await fsp.readFile(filePath, 'utf8');
    const encoded = Buffer.from(source, 'utf8').toString('base64');
    return import(`data:text/javascript;base64,${encoded}`);
}

function buildFixtureEnemies() {
    return {
        goblin_story_headhunter: {
            id: 'goblin_story_headhunter',
            name: '哥布林追猎手',
            race: 'goblin',
            class: 'hunter',
            tags: ['story'],
            stats: { hp: 65, maxHp: 65, ap: 4, speed: 11 },
            bodyParts: {
                head: { current: 4, max: 4, weakness: 1.2 },
                chest: { current: 8, max: 8, weakness: 1 },
                abdomen: { current: 4, max: 4, weakness: 1.1 },
                arm: { current: 0, max: 0, weakness: 1 },
                leg: { current: 0, max: 0, weakness: 0.9 },
                left_arm: { current: 2, max: 2, weakness: 1 }
            },
            skills: ['skill_throw_stone', 'skill_missing'],
            presentation: {
                portraitRef: 'enemy_goblin_hunter',
                mapPortraitRef: 'enemy_goblin_hunter',
                battleSpriteRef: 'enemy_goblin_hunter_spine'
            },
            customField: { keep: true }
        }
    };
}

test('EnemyWorkspace normalizes enemies, preserves unknown fields, and exports record shape', async () => {
    const { EnemyWorkspace } = await importSourceModule(workspaceModulePath);
    const workspace = new EnemyWorkspace(buildFixtureEnemies());

    assert.deepEqual(workspace.listEnemies().map(enemy => enemy.id), ['goblin_story_headhunter']);
    const enemy = workspace.getEnemy('goblin_story_headhunter');
    assert.equal(enemy.presentation.mapPortraitRef, 'enemy_goblin_hunter');
    assert.deepEqual(enemy.customField, { keep: true });
    assert.equal(enemy.bodyParts.left_arm.current, 2);

    workspace.updateEnemy('goblin_story_headhunter', current => ({
        ...current,
        name: '哥布林追猎手·编辑后',
        stats: { ...current.stats, ap: 5 },
        presentation: { ...current.presentation, iconRef: 'enemy_goblin_hunter_icon' }
    }));

    const exported = workspace.exportDocument();
    assert.equal(exported.goblin_story_headhunter.name, '哥布林追猎手·编辑后');
    assert.equal(exported.goblin_story_headhunter.stats.ap, 5);
    assert.equal(exported.goblin_story_headhunter.presentation.iconRef, 'enemy_goblin_hunter_icon');
    assert.deepEqual(exported.goblin_story_headhunter.customField, { keep: true });
});

test('EnemyWorkspace validates skill, asset, body part, and level references', async () => {
    const { EnemyWorkspace } = await importSourceModule(workspaceModulePath);
    const workspace = new EnemyWorkspace(buildFixtureEnemies(), {
        skillCatalog: {
            skill_throw_stone: { id: 'skill_throw_stone', name: 'Throw Stone', costs: { ap: 2 } }
        },
        assetCatalog: {
            enemy_goblin_hunter: { id: 'enemy_goblin_hunter', src: 'assets/images/level_map/portraits/enemy_goblin_hunter.svg' }
        },
        levelsDocument: {
            enemyPools: {
                pool_story: {
                    members: [
                        { templateId: 'goblin_story_headhunter', position: 1 },
                        { templateId: 'missing_enemy_template', position: 2 }
                    ]
                }
            }
        }
    });

    const issues = workspace.validateDocument();
    const codes = issues.map(issue => issue.code).sort();
    assert(codes.includes('missing_skill_reference'));
    assert(codes.includes('legacy_body_part'));
    assert(codes.includes('missing_enemy_template_reference'));

    const summary = workspace.buildCatalogEntry('goblin_story_headhunter');
    assert.equal(summary.presentationSummary.resolvedMapPortraitSrc, 'assets/images/level_map/portraits/enemy_goblin_hunter.svg');
    assert.equal(summary.referenceSummary.levelCount, 1);
    assert.equal(summary.diagnosticsSummary.hasError, true);
});

test('EnemyWorkspace resolves default portrait assets for enemies without explicit presentation refs', async () => {
    const { EnemyWorkspace } = await importSourceModule(workspaceModulePath);
    const workspace = new EnemyWorkspace({
        goblin_01: {
            id: 'goblin_01',
            name: '哥布林战士',
            stats: { hp: 50, maxHp: 50, ap: 3, speed: 8 },
            bodyParts: {},
            skills: ['skill_bite']
        },
        orc_warrior: {
            id: 'orc_warrior',
            name: '兽人战士',
            stats: { hp: 120, maxHp: 120, ap: 4, speed: 8 },
            bodyParts: {},
            skills: ['skill_smash']
        },
        skeleton_guard_lvl4: {
            id: 'skeleton_guard_lvl4',
            name: '骷髅卫士 (Lv.4)',
            race: 'undead',
            class: 'defender',
            stats: { hp: 100, maxHp: 100, ap: 3, speed: 5 },
            bodyParts: {},
            skills: ['skill_shield_bash']
        }
    }, {
        assetCatalog: {
            enemy_goblin_warrior: { id: 'enemy_goblin_warrior', src: '../assets/images/level_map/portraits/enemy_goblin_warrior.svg' },
            enemy_orc_warrior: { id: 'enemy_orc_warrior', src: '../assets/images/level_map/portraits/enemy_orc_warrior.svg' },
            enemy_skeleton_guard: { id: 'enemy_skeleton_guard', src: '../assets/images/level_map/portraits/enemy_skeleton_guard.svg' }
        }
    });

    assert.equal(
        workspace.buildCatalogEntry('goblin_01').presentationSummary.resolvedMapPortraitSrc,
        '../assets/images/level_map/portraits/enemy_goblin_warrior.svg'
    );
    assert.equal(
        workspace.buildCatalogEntry('orc_warrior').presentationSummary.resolvedMapPortraitSrc,
        '../assets/images/level_map/portraits/enemy_orc_warrior.svg'
    );
    assert.equal(
        workspace.buildCatalogEntry('skeleton_guard_lvl4').presentationSummary.resolvedMapPortraitSrc,
        '../assets/images/level_map/portraits/enemy_skeleton_guard.svg'
    );
    assert.equal(
        workspace.validateEnemy('goblin_01').some(issue => issue.code === 'missing_enemy_portrait'),
        false
    );
});

test('EnemyWorkspace resolves built-in full-body character PNG refs as sprite assets', async () => {
    const { EnemyWorkspace } = await importSourceModule(workspaceModulePath);
    const spriteRef = '../source/character/敌人-001-状态001-正常状态.png';
    const workspace = new EnemyWorkspace({
        enemy_full_body: {
            id: 'enemy_full_body',
            name: '完整敌人立绘',
            stats: { hp: 80, maxHp: 80, ap: 3, speed: 8 },
            bodyParts: {},
            skills: ['skill_bite'],
            presentation: { battleSpriteRef: spriteRef }
        }
    }, {
        skillCatalog: { skill_bite: { id: 'skill_bite', name: 'Bite', costs: { ap: 1 } } }
    });

    assert.deepEqual(workspace.listCharacterSpriteAssets().map(asset => asset.id), [
        '../source/character/敌人-001-状态001-正常状态.png',
        '../source/character/敌人-001-状态002-丢失盾牌.png',
        '../source/character/敌人-001-状态003-盾牌破损.png',
        '../source/character/敌人-002-状态001-正常状态.png',
        '../source/character/敌人-003-状态001-正常状态.png',
        '../source/character/敌人-004-状态001-正常状态.png',
        '../source/character/敌人-005-状态001-正常状态.png'
    ]);
    assert.equal(workspace.resolveAsset(spriteRef).src, spriteRef);
    assert.equal(
        workspace.validateEnemy('enemy_full_body').some(issue => issue.code === 'missing_asset_reference'),
        false
    );
});

test('EnemyWorkspace keeps map portraits and backgrounds out of the battle sprite dropdown', async () => {
    const { EnemyWorkspace } = await importSourceModule(workspaceModulePath);
    const workspace = new EnemyWorkspace({}, {
        assetCatalog: {
            assetLibrary: {
                portraits: [
                    { id: 'enemy_map_portrait', src: '../assets/images/level_map/portraits/enemy_map_portrait.svg' }
                ],
                nodeArts: [
                    { id: 'node_icon_goblin_warrior', src: '../assets/images/level_map/node_icons/node_icon_goblin_warrior.png' }
                ],
                backgrounds: [
                    { id: 'bg_map_glade_01', src: '../source/map/image_w2752_h1536_map-bg-01.jpeg' }
                ],
                sprites: [
                    { id: 'enemy_custom_sprite', label: '自定义敌人原画', src: '../source/character/enemy_custom_sprite.png' }
                ]
            }
        }
    });

    const ids = workspace.listCharacterSpriteAssets().map(asset => asset.id);
    assert(ids.includes('enemy_custom_sprite'));
    assert(!ids.includes('enemy_map_portrait'));
    assert(!ids.includes('node_icon_goblin_warrior'));
    assert(!ids.includes('bg_map_glade_01'));
});

test('EnemyWorkspace creates and deletes enemies with reference protection', async () => {
    const { EnemyWorkspace } = await importSourceModule(workspaceModulePath);
    const workspace = new EnemyWorkspace(buildFixtureEnemies(), {
        levelsDocument: {
            enemyPools: {
                pool_story: { members: [{ templateId: 'goblin_story_headhunter', position: 1 }] }
            }
        }
    });

    const createdId = workspace.createEnemy({ id: 'goblin_story_headhunter', name: '复制敌人' });
    assert.equal(createdId, 'goblin_story_headhunter_2');
    assert.equal(workspace.getEnemy(createdId).name, '复制敌人');

    assert.throws(
        () => workspace.removeEnemy('goblin_story_headhunter'),
        /仍被引用/
    );

    assert.equal(workspace.removeEnemy(createdId), true);
});
