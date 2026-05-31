import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');
const pageModulePath = path.join(projectRoot, 'script', 'editor', 'enemy', 'EnemyEditorPage.js');
const workspaceModulePath = path.join(projectRoot, 'script', 'editor', 'enemy', 'EnemyWorkspace.js');
const pageHtmlPath = path.join(projectRoot, 'test', 'enemy_editor_v1.html');

async function importSourceModule(filePath) {
    assert.equal(fs.existsSync(filePath), true, `缺少源文件: ${filePath}`);
    let source = await fsp.readFile(filePath, 'utf8');
    if (source.includes('./EnemyWorkspace.js')) {
        const workspaceSource = await fsp.readFile(workspaceModulePath, 'utf8');
        const workspaceEncoded = Buffer.from(workspaceSource, 'utf8').toString('base64');
        source = source.replace("'./EnemyWorkspace.js'", `'data:text/javascript;base64,${workspaceEncoded}'`);
    }
    const encoded = Buffer.from(source, 'utf8').toString('base64');
    return import(`data:text/javascript;base64,${encoded}`);
}

class FakeClassList {
    constructor(element) {
        this.element = element;
        this.classes = new Set();
    }

    add(...names) {
        names.forEach(name => this.classes.add(name));
        this.element.className = [...this.classes].join(' ');
    }

    remove(...names) {
        names.forEach(name => this.classes.delete(name));
        this.element.className = [...this.classes].join(' ');
    }
}

class FakeElement {
    constructor(tagName = 'div', ownerDocument = null) {
        this.tagName = tagName.toUpperCase();
        this.ownerDocument = ownerDocument;
        this.children = [];
        this.attributes = new Map();
        this.dataset = {};
        this.className = '';
        this.classList = new FakeClassList(this);
        this.style = {};
        this.listeners = new Map();
        this.value = '';
        this.textContent = '';
        this.innerHTML = '';
        this.src = '';
        this.type = '';
    }

    appendChild(child) {
        this.children.push(child);
        this.textContent = this.children.map(item => item.textContent || '').join('\n');
        return child;
    }

    replaceChildren(...children) {
        this.children = children;
        this.textContent = children.map(child => child.textContent || '').join('');
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'src') this.src = String(value);
        if (name === 'class') this.className = String(value);
    }

    getAttribute(name) {
        if (name === 'src') return this.src || this.attributes.get(name) || null;
        return this.attributes.get(name) || null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
        if (name === 'src') this.src = '';
    }

    addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(handler);
    }

    dispatchEvent(event) {
        const handlers = this.listeners.get(event.type) || [];
        handlers.forEach(handler => handler.call(this, event));
        return true;
    }
}

class FakeDocument {
    constructor(ids) {
        this.elements = new Map();
        ids.forEach(id => {
            const element = new FakeElement('div', this);
            element.id = id;
            this.elements.set(id, element);
        });
    }

    getElementById(id) {
        return this.elements.get(id) || null;
    }

    createElement(tagName) {
        return new FakeElement(tagName, this);
    }
}

function collectIdsFromHtml(html) {
    return [...html.matchAll(/id=["']([^"']+)["']/gu)].map(match => match[1]);
}

function installDomGlobals(document) {
    global.document = document;
    global.HTMLElement = FakeElement;
    global.Event = class Event {
        constructor(type) {
            this.type = type;
        }
    };
}

function cleanupDomGlobals() {
    delete global.document;
    delete global.HTMLElement;
    delete global.Event;
}

function buildEnemies() {
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
                leg: { current: 0, max: 0, weakness: 0.9 }
            },
            skills: ['skill_throw_stone'],
            presentation: {
                portraitRef: 'enemy_goblin_hunter',
                mapPortraitRef: 'enemy_goblin_hunter',
                battleSpriteRef: 'enemy_goblin_hunter_spine'
            }
        },
        goblin_story_medic: {
            id: 'goblin_story_medic',
            name: '哥布林药师',
            race: 'goblin',
            class: 'support',
            stats: { hp: 54, maxHp: 54, ap: 5, speed: 9 },
            bodyParts: {},
            skills: [],
            presentation: { portraitRef: 'enemy_goblin_medic' }
        }
    };
}

function createPageFixture() {
    const html = fs.readFileSync(pageHtmlPath, 'utf8');
    const document = new FakeDocument(collectIdsFromHtml(html));
    installDomGlobals(document);
    return { window: { document }, document };
}

async function createPageContext(fetchImpl = async () => ({ ok: true, json: async () => ({}) })) {
    const [{ EnemyEditorPage }, { EnemyWorkspace }] = await Promise.all([
        importSourceModule(pageModulePath),
        importSourceModule(workspaceModulePath)
    ]);
    const dom = createPageFixture();
    const page = new EnemyEditorPage({
        document: dom.window.document,
        fetchImpl,
        workspaceFactory: (raw, context) => new EnemyWorkspace(raw, context)
    });
    page.bind();
    return { dom, page };
}

test.afterEach(() => {
    cleanupDomGlobals();
});

test('enemy editor page fixture contains required authoring controls', async () => {
    assert.equal(fs.existsSync(pageHtmlPath), true, '缺少敌人编辑器页面');
    const html = await fsp.readFile(pageHtmlPath, 'utf8');
    for (const id of [
        'enemyLibrarySelect',
        'refreshEnemyLibraryBtn',
        'openSelectedEnemyLibraryBtn',
        'loadEnemyBtn',
        'saveDraftBtn',
        'publishEnemyBtn',
        'enemyList',
        'enemyNameInput',
        'portraitRefInput',
        'battleSpriteSelect',
        'mapPreviewPortrait',
        'issueList'
    ]) {
        assert.match(html, new RegExp(`id=["']${id}["']`), `页面缺少 #${id}`);
    }
    assert.doesNotMatch(html, /id=["']saveEnemyBtn["']/u, '页面不应再暴露“保存当前敌人”按钮');
});

test('EnemyEditorPage renders enemies and keeps current form changes in workspace before switching', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildEnemies(), {
        skillCatalog: { skill_throw_stone: { id: 'skill_throw_stone', name: 'Throw Stone', costs: { ap: 2 } } },
        assetCatalog: { enemy_goblin_hunter: { id: 'enemy_goblin_hunter', src: '../assets/images/level_map/portraits/enemy_goblin_hunter.svg' } },
        levelsDocument: { enemyPools: { pool_story: { members: [{ templateId: 'goblin_story_headhunter' }] } } }
    });

    assert.match(dom.window.document.getElementById('enemyList').textContent, /哥布林追猎手/);
    assert.equal(dom.window.document.getElementById('enemyList').children.length, 2);
    assert.equal(dom.window.document.getElementById('enemyNameInput').value, '哥布林追猎手');
    assert.equal(dom.window.document.getElementById('mapPreviewPortrait').getAttribute('src'), '../assets/images/level_map/portraits/enemy_goblin_hunter.svg');
    assert.equal(dom.window.document.getElementById('artPreviewPortrait').getAttribute('src'), null);
    assert.equal(dom.window.document.getElementById('artPreviewPortrait').getAttribute('hidden'), 'hidden');
    assert.equal(dom.window.document.getElementById('artPreviewState').textContent, '未绑定完整原画');

    dom.window.document.getElementById('enemyNameInput').value = '哥布林追猎手·编辑后';
    dom.window.document.getElementById('enemyApInput').value = '5';
    dom.window.document.getElementById('portraitRefInput').value = 'enemy_goblin_hunter_alt';
    dom.window.document.getElementById('enemyList').children[1].dispatchEvent(new Event('click'));

    const exported = page.workspace.exportDocument();
    assert.equal(exported.goblin_story_headhunter.name, '哥布林追猎手·编辑后');
    assert.equal(exported.goblin_story_headhunter.stats.ap, 5);
    assert.equal(exported.goblin_story_headhunter.presentation.portraitRef, 'enemy_goblin_hunter_alt');
    assert.equal(page.selectedEnemyId, 'goblin_story_medic');
});

test('EnemyEditorPage uses battle sprite dropdown as the primary art selector', async () => {
    const { page, dom } = await createPageContext();
    const spriteRef = '../source/character/敌人-001-状态001-正常状态.png';
    const alternateSpriteRef = '../source/character/敌人-001-状态003-盾牌破损.png';
    page.loadDocument({
        goblin_story_headhunter: {
            ...buildEnemies().goblin_story_headhunter,
            presentation: {
                portraitRef: 'enemy_goblin_hunter',
                mapPortraitRef: 'enemy_goblin_hunter',
                battleSpriteRef: spriteRef
            }
        }
    }, {
        skillCatalog: { skill_throw_stone: { id: 'skill_throw_stone', name: 'Throw Stone', costs: { ap: 2 } } },
        assetCatalog: {
            enemy_goblin_hunter: { id: 'enemy_goblin_hunter', src: '../assets/images/level_map/portraits/enemy_goblin_hunter.svg' },
            [spriteRef]: { id: spriteRef, src: spriteRef },
            [alternateSpriteRef]: { id: alternateSpriteRef, src: alternateSpriteRef }
        }
    });

    const select = dom.window.document.getElementById('battleSpriteSelect');
    const options = select.children.map(option => option.value);
    assert(options.includes(spriteRef));
    assert(options.includes(alternateSpriteRef));

    assert.equal(dom.window.document.getElementById('artPreviewPortrait').getAttribute('src'), spriteRef);
    assert.equal(dom.window.document.getElementById('mapPreviewPortrait').getAttribute('src'), '../assets/images/level_map/portraits/enemy_goblin_hunter.svg');

    select.value = alternateSpriteRef;
    select.dispatchEvent(new Event('change'));
    assert.equal(dom.window.document.getElementById('artPreviewPortrait').getAttribute('src'), alternateSpriteRef);

    await page.saveDraft();

    const exported = page.workspace.exportDocument();
    assert.equal(exported.goblin_story_headhunter.presentation.battleSpriteRef, alternateSpriteRef);
    assert.equal(dom.window.document.getElementById('artPreviewPortrait').getAttribute('src'), alternateSpriteRef);
});

test('EnemyEditorPage loads enemy skill pack as the default skill reference source', async () => {
    const reads = new Map([
        ['assets/enemy_packs/current/enemies.json', buildEnemies()],
        ['assets/data/skills_enemy_v1.json', {
            skills: [{ id: 'skill_throw_stone', name: '投石', costs: { ap: 2 } }]
        }],
        ['assets/data/levels.json', { enemyPools: {} }],
        ['assets/data/level_map_pack_v1.json', { assetLibrary: {} }]
    ]);
    const requestedPaths = [];
    const fetchImpl = async (url) => {
        const parsed = new URL(String(url), 'http://127.0.0.1:3101');
        const filePath = parsed.searchParams.get('path');
        requestedPaths.push(filePath);
        assert(reads.has(filePath), `unexpected read ${filePath}`);
        return {
            ok: true,
            status: 200,
            json: async () => ({
                ok: true,
                path: filePath,
                content: JSON.stringify(reads.get(filePath), null, 2)
            })
        };
    };
    const { page } = await createPageContext(fetchImpl);

    await page.loadDefault();

    assert(requestedPaths.includes('assets/data/skills_enemy_v1.json'));
    assert(!requestedPaths.includes('assets/data/skills_melee_v4_5.json'));
    assert.equal(
        page.workspace.validateEnemy('goblin_story_headhunter').some(issue => issue.code === 'missing_skill_reference'),
        false
    );
});

test('EnemyEditorPage saves draft and publishes runtime enemy JSON through project file API', async () => {
    const writes = [];
    const fetchImpl = async (url, options = {}) => {
        if (String(url).includes('/__skill_editor_file') && options.method === 'POST') {
            const body = JSON.parse(options.body);
            writes.push(body);
            return { ok: true, status: 200, json: async () => ({ ok: true, path: body.path }) };
        }
        throw new Error(`unexpected fetch ${url}`);
    };
    const { page, dom } = await createPageContext(fetchImpl);
    page.loadDocument(buildEnemies());
    dom.window.document.getElementById('enemyNameInput').value = '保存工作稿自动写入';
    dom.window.document.getElementById('battleSpriteSelect').value = '../source/character/敌人-005-状态001-正常状态.png';

    await page.saveDraft();
    await page.publishRuntime();

    assert.equal(writes.length, 2);
    assert.match(writes[0].path, /^assets\/enemy_packs\/authoring\/enemies_\d{8}_\d{6}\.json$/);
    assert.equal(writes[1].path, 'assets/enemy_packs/current/enemies.json');
    assert.equal(JSON.parse(writes[0].content).goblin_story_headhunter.name, '保存工作稿自动写入');
    assert.equal(
        JSON.parse(writes[1].content).goblin_story_headhunter.presentation.battleSpriteRef,
        '../source/character/敌人-005-状态001-正常状态.png'
    );
});

test('EnemyEditorPage refreshes and loads enemy libraries from the toolbar dropdown', async () => {
    const reads = new Map([
        ['assets/enemy_packs/current/enemies.json', {
            runtime_enemy: {
                id: 'runtime_enemy',
                name: '运行时敌人',
                stats: { hp: 10, maxHp: 10, ap: 1, speed: 1 },
                bodyParts: {},
                skills: []
            }
        }],
        ['assets/enemy_packs/authoring/enemies_20260524_210829.json', {
            draft_enemy: {
                id: 'draft_enemy',
                name: '工作稿敌人',
                stats: { hp: 20, maxHp: 20, ap: 2, speed: 2 },
                bodyParts: {},
                skills: []
            }
        }],
        ['assets/data/skills_enemy_v1.json', { skills: [] }],
        ['assets/data/levels.json', { enemyPools: {} }],
        ['assets/data/level_map_pack_v1.json', { assetLibrary: {} }]
    ]);
    const fetchImpl = async (url) => {
        const parsed = new URL(String(url), 'http://127.0.0.1:3101');
        const filePath = parsed.searchParams.get('path');
        if (parsed.searchParams.get('list') === '1') {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    ok: true,
                    path: filePath,
                    files: filePath.startsWith('assets/enemy_packs/current/')
                        ? ['assets/enemy_packs/current/enemies.json']
                        : ['assets/enemy_packs/authoring/enemies_20260524_210829.json']
                })
            };
        }
        assert(reads.has(filePath), `unexpected read ${filePath}`);
        return {
            ok: true,
            status: 200,
            json: async () => ({
                ok: true,
                path: filePath,
                content: JSON.stringify(reads.get(filePath), null, 2)
            })
        };
    };
    const { page, dom } = await createPageContext(fetchImpl);

    const files = await page.refreshEnemyLibraryFiles();
    const select = dom.window.document.getElementById('enemyLibrarySelect');
    assert.deepEqual(files, [
        'assets/enemy_packs/current/enemies.json',
        'assets/enemy_packs/authoring/enemies_20260524_210829.json'
    ]);
    assert.deepEqual(select.children.map(option => option.value), files);

    select.value = 'assets/enemy_packs/authoring/enemies_20260524_210829.json';
    await page.loadSelectedEnemyLibrary();

    assert.equal(dom.window.document.getElementById('enemyPathInput').value, 'assets/enemy_packs/authoring/enemies_20260524_210829.json');
    assert.equal(page.workspace.getEnemy('draft_enemy').name, '工作稿敌人');
});

test('EnemyEditorPage default startup loads the newest enemy authoring draft when available', async () => {
    const reads = new Map([
        ['assets/enemy_packs/current/enemies.json', {
            runtime_enemy: {
                id: 'runtime_enemy',
                name: '运行时敌人',
                stats: { hp: 10, maxHp: 10, ap: 1, speed: 1 },
                bodyParts: {},
                skills: []
            }
        }],
        ['assets/enemy_packs/authoring/enemies_20260524_210829.json', {
            old_draft_enemy: {
                id: 'old_draft_enemy',
                name: '旧工作稿敌人',
                stats: { hp: 20, maxHp: 20, ap: 2, speed: 2 },
                bodyParts: {},
                skills: []
            }
        }],
        ['assets/enemy_packs/authoring/enemies_20260524_222540.json', {
            newest_draft_enemy: {
                id: 'newest_draft_enemy',
                name: '最近工作稿敌人',
                stats: { hp: 30, maxHp: 30, ap: 3, speed: 3 },
                bodyParts: {},
                skills: []
            }
        }],
        ['assets/data/skills_enemy_v1.json', { skills: [] }],
        ['assets/data/levels.json', { enemyPools: {} }],
        ['assets/data/level_map_pack_v1.json', { assetLibrary: {} }]
    ]);
    const requestedPaths = [];
    const fetchImpl = async (url) => {
        const parsed = new URL(String(url), 'http://127.0.0.1:3101');
        const filePath = parsed.searchParams.get('path');
        if (parsed.searchParams.get('list') === '1') {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    ok: true,
                    path: filePath,
                    files: filePath.startsWith('assets/enemy_packs/current/')
                        ? ['assets/enemy_packs/current/enemies.json']
                        : [
                            'assets/enemy_packs/authoring/enemies_20260524_210829.json',
                            'assets/enemy_packs/authoring/enemies_20260524_222540.json'
                        ]
                })
            };
        }
        requestedPaths.push(filePath);
        assert(reads.has(filePath), `unexpected read ${filePath}`);
        return {
            ok: true,
            status: 200,
            json: async () => ({
                ok: true,
                path: filePath,
                content: JSON.stringify(reads.get(filePath), null, 2)
            })
        };
    };
    const { page, dom } = await createPageContext(fetchImpl);

    await page.loadDefault({ preferRecent: true });

    assert.equal(requestedPaths[0], 'assets/enemy_packs/authoring/enemies_20260524_222540.json');
    assert.equal(dom.window.document.getElementById('enemyPathInput').value, 'assets/enemy_packs/authoring/enemies_20260524_222540.json');
    assert.equal(dom.window.document.getElementById('status').textContent, '已加载 assets/enemy_packs/authoring/enemies_20260524_222540.json');
    assert.equal(page.workspace.getEnemy('newest_draft_enemy').name, '最近工作稿敌人');
});

test('EnemyEditorPage loads enemy, skill, and level reference sources together', async () => {
    const reads = new Map([
        ['assets/enemy_packs/current/enemies.json', {
            goblin_01: {
                id: 'goblin_01',
                name: '哥布林战士',
                stats: { hp: 50, maxHp: 50, ap: 3, speed: 8 },
                bodyParts: {},
                skills: ['skill_bite']
            },
            ...buildEnemies()
        }],
        ['assets/data/skills_enemy_v1.json', {
            skills: [{ id: 'skill_skull_cracker', name: 'Skull Cracker', costs: { ap: 2 } }]
        }],
        ['assets/data/levels.json', {
            enemyPools: {
                pool_story: {
                    members: [
                        { templateId: 'goblin_01', position: 0 },
                        { templateId: 'goblin_story_headhunter', position: 1 }
                    ]
                }
            }
        }],
        ['assets/data/level_map_pack_v1.json', {
            assetLibrary: {
                portraits: [
                    {
                        id: 'enemy_goblin_warrior',
                        label: '哥布林战士',
                        src: '../assets/images/level_map/portraits/enemy_goblin_warrior.svg'
                    }
                ]
            }
        }]
    ]);
    const fetchImpl = async (url) => {
        const parsed = new URL(String(url), 'http://127.0.0.1:3101');
        const filePath = parsed.searchParams.get('path');
        assert(reads.has(filePath), `unexpected read ${filePath}`);
        return {
            ok: true,
            status: 200,
            json: async () => ({
                ok: true,
                path: filePath,
                content: JSON.stringify(reads.get(filePath), null, 2)
            })
        };
    };
    const { page, dom } = await createPageContext(fetchImpl);

    await page.loadDefault();

    assert.equal(dom.window.document.getElementById('status').textContent, '已加载 assets/enemy_packs/current/enemies.json');
    assert.equal(dom.window.document.getElementById('mapPreviewName').textContent, '哥布林战士');
    assert.equal(
        dom.window.document.getElementById('mapPreviewPortrait').getAttribute('src'),
        '../assets/images/level_map/portraits/enemy_goblin_warrior.svg'
    );
    assert.match(dom.window.document.getElementById('referenceList').textContent, /pool_story@0/);
    assert.equal(
        page.workspace.validateEnemy('goblin_story_headhunter').some(issue => issue.code === 'missing_skill_reference'),
        false,
        'skill_throw_stone should resolve through the runtime enemy skill alias table'
    );
});
