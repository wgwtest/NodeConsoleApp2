import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');
const pageModulePath = path.join(projectRoot, 'script', 'editor', 'enemy', 'EnemyEditorPage.js');
const workspaceModulePath = path.join(projectRoot, 'script', 'editor', 'enemy', 'EnemyWorkspace.js');
const decisionModelModulePath = path.join(projectRoot, 'script', 'editor', 'enemy', 'decision', 'EnemyDecisionGraphModel.js');
const decisionEditorModulePath = path.join(projectRoot, 'script', 'editor', 'enemy', 'decision', 'EnemyDecisionGraphEditor.js');
const pageHtmlPath = path.join(projectRoot, 'test', 'enemy_editor_v1.html');

async function encodeSourceModule(filePath) {
    let source = await fsp.readFile(filePath, 'utf8');
    if (source.includes('./decision/EnemyDecisionGraphModel.js')) {
        const modelEncoded = await encodeSourceModule(decisionModelModulePath);
        source = source.replaceAll("'./decision/EnemyDecisionGraphModel.js'", `'data:text/javascript;base64,${modelEncoded}'`);
        source = source.replaceAll('"./decision/EnemyDecisionGraphModel.js"', `"data:text/javascript;base64,${modelEncoded}"`);
    }
    if (source.includes('./EnemyDecisionGraphModel.js')) {
        const modelEncoded = await encodeSourceModule(decisionModelModulePath);
        source = source.replaceAll("'./EnemyDecisionGraphModel.js'", `'data:text/javascript;base64,${modelEncoded}'`);
        source = source.replaceAll('"./EnemyDecisionGraphModel.js"', `"data:text/javascript;base64,${modelEncoded}"`);
    }
    if (source.includes('./decision/EnemyDecisionGraphEditor.js') && fs.existsSync(decisionEditorModulePath)) {
        const editorEncoded = await encodeSourceModule(decisionEditorModulePath);
        source = source.replaceAll("'./decision/EnemyDecisionGraphEditor.js'", `'data:text/javascript;base64,${editorEncoded}'`);
        source = source.replaceAll('"./decision/EnemyDecisionGraphEditor.js"', `"data:text/javascript;base64,${editorEncoded}"`);
    }
    return Buffer.from(source, 'utf8').toString('base64');
}

async function importSourceModule(filePath) {
    assert.equal(fs.existsSync(filePath), true, `缺少源文件: ${filePath}`);
    let source = await fsp.readFile(filePath, 'utf8');
    if (source.includes('./EnemyWorkspace.js')) {
        const workspaceEncoded = await encodeSourceModule(workspaceModulePath);
        source = source.replace("'./EnemyWorkspace.js'", `'data:text/javascript;base64,${workspaceEncoded}'`);
    }
    if (source.includes('./decision/EnemyDecisionGraphModel.js')) {
        const modelEncoded = await encodeSourceModule(decisionModelModulePath);
        source = source.replace("'./decision/EnemyDecisionGraphModel.js'", `'data:text/javascript;base64,${modelEncoded}'`);
    }
    if (source.includes('./decision/EnemyDecisionGraphEditor.js') && fs.existsSync(decisionEditorModulePath)) {
        const editorEncoded = await encodeSourceModule(decisionEditorModulePath);
        source = source.replace("'./decision/EnemyDecisionGraphEditor.js'", `'data:text/javascript;base64,${editorEncoded}'`);
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

    contains(name) {
        return this.classes.has(name);
    }

    toggle(name, force) {
        const shouldAdd = force === undefined ? !this.classes.has(name) : Boolean(force);
        if (shouldAdd) {
            this.add(name);
        } else {
            this.remove(name);
        }
        return shouldAdd;
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
        this.multiple = false;
        this.selected = false;
        this.checked = false;
    }

    appendChild(child) {
        child.parentNode = this;
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
        if (name === 'hidden') this.hidden = true;
    }

    getAttribute(name) {
        if (name === 'src') return this.src || this.attributes.get(name) || null;
        return this.attributes.get(name) || null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
        if (name === 'src') this.src = '';
        if (name === 'hidden') this.hidden = false;
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
    constructor(fixtures) {
        this.elements = new Map();
        fixtures.forEach(fixture => {
            const id = typeof fixture === 'string' ? fixture : fixture.id;
            const tagName = typeof fixture === 'string' ? 'div' : fixture.tagName;
            const element = new FakeElement(tagName, this);
            element.id = id;
            element.multiple = Boolean(fixture.multiple);
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

function collectElementsFromHtml(html) {
    return [...html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*\bid=["']([^"']+)["'][^>]*)>/giu)]
        .map(match => ({
            tagName: match[1],
            id: match[3],
            multiple: /\bmultiple\b/iu.test(match[2])
        }));
}

function findChildByDataset(row, key, value) {
    const stack = [...(row?.children || [])];
    while (stack.length) {
        const next = stack.shift();
        if (next?.dataset?.[key] === value) return next;
        stack.push(...(next?.children || []));
    }
    return null;
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
            },
            capabilities: [
                {
                    type: 'basic_attack',
                    cadence: 'every_turn',
                    pressure: 'early_hp_pressure',
                    counterplay: ['guard', 'fast_kill']
                }
            ],
            intentModel: {
                visible: true,
                pattern: ['attack', 'bleed', 'attack'],
                fallback: 'attack'
            },
            decisionModel: {
                mode: 'intent_priority_table',
                intentTimeline: ['attack', 'bleed', 'attack'],
                fallbackIntent: 'attack',
                actions: [
                    {
                        priority: 100,
                        when: { always: true },
                        intent: 'attack',
                        skillId: 'skill_throw_stone',
                        targetRule: 'player_weak_part',
                        telegraph: false,
                        fallbackIntent: 'attack'
                    }
                ]
            },
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

function buildWrappedEnemiesWithEnums() {
    return {
        $schemaVersion: 'enemies_v2_1',
        meta: {
            enums: {
                races: ['goblin', 'orc'],
                classes: ['hunter', 'support'],
                tags: ['story', 'pressure_bleed', 'role_fast'],
                capabilityTypes: ['basic_attack', 'telegraph_countdown'],
                capabilityCadences: ['every_turn', 'windup_1_turn'],
                capabilityPressures: ['early_hp_pressure', 'readable_burst'],
                counterplay: ['fast_kill', 'guard', 'interrupt'],
                intentTokens: ['attack', 'bleed', 'heavy_attack', 'recover', 'telegraph'],
                decisionModelModes: ['intent_priority_table'],
                decisionTargetRules: ['self', 'player', 'player_weak_part', 'fixed_part:head'],
                decisionWhenTypes: ['always', 'self_hp_lte', 'self_hp_gte', 'previous_intent', 'turn_modulo'],
                enemySkillIds: ['skill_throw_stone', 'enemy_skill_rusty_shiv']
            },
            enumDescriptions: {
                capabilityCadences: {
                    every_turn: '设计节奏：可持续出现；不是运行时触发器。',
                    windup_1_turn: '设计节奏：先预兆一回合。'
                },
                capabilityPressures: {
                    early_hp_pressure: '战斗压力：稳定磨血。',
                    readable_burst: '单关压力：可读爆发。'
                },
                counterplay: {
                    fast_kill: '快速击杀以缩短磨血。',
                    guard: '防御或格挡。',
                    interrupt: '打断预兆。'
                }
            }
        },
        enemies: buildEnemies()
    };
}

function createPageFixture() {
    const html = fs.readFileSync(pageHtmlPath, 'utf8');
    const document = new FakeDocument(collectElementsFromHtml(html));
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
    for (const tabId of ['identity', 'stats', 'capabilities', 'enemyDecision', 'assets']) {
        assert.match(html, new RegExp(`data-editor-tab=["']${tabId}["']`), `page missing ${tabId} tab`);
        assert.match(html, new RegExp(`data-editor-panel=["']${tabId}["']`), `page missing ${tabId} panel`);
    }
    for (const tabId of ['intent', 'decision', 'pressure']) {
        assert.doesNotMatch(html, new RegExp(`data-editor-tab=["']${tabId}["']`), `page should not expose ${tabId} tab`);
        assert.doesNotMatch(html, new RegExp(`data-editor-panel=["']${tabId}["']`), `page should not expose ${tabId} panel`);
    }
    assert.doesNotMatch(html, /data-editor-tab=["']pressure["']/u, 'page should not expose pressure tab');
    assert.doesNotMatch(html, /data-editor-panel=["']pressure["']/u, 'page should not expose pressure panel');
    for (const id of ['capabilitiesJsonInput', 'decisionTemplateList', 'decisionSkillList', 'decisionGraphCanvas', 'decisionNodeInspector', 'decisionGraphIssues', 'decisionPreviewTrace']) {
        assert.match(html, new RegExp(`id=["']${id}["']`), `page missing #${id}`);
    }
    for (const id of ['intentModelJsonInput', 'decisionModelJsonInput', 'runPressureJsonInput', 'statePersistenceJsonInput']) {
        assert.doesNotMatch(html, new RegExp(`id=["']${id}["']`), `page should not expose #${id}`);
    }
    assert.doesNotMatch(html, /id=["']saveEnemyBtn["']/u, '页面不应再暴露“保存当前敌人”按钮');
    for (const id of ['capabilityList', 'addCapabilityBtn']) {
        assert.match(html, new RegExp(`id=["']${id}["']`), `page missing #${id}`);
    }
    for (const id of ['intentPatternList', 'addIntentTokenBtn', 'intentFallbackInput', 'decisionModeInput', 'decisionActionList', 'addDecisionActionBtn', 'runPressureTypeInput', 'runPressureDamageBudgetInput', 'runPressureCarryoverImpactInput', 'runPressureCounterplayInput', 'stateCarryOverInput', 'stateClearAfterBattleInput']) {
        assert.doesNotMatch(html, new RegExp(`id=["']${id}["']`), `page should not expose #${id}`);
    }
});

test('EnemyEditorPage switches design tabs and exports enemyDecision instead of legacy behavior fields', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildEnemies());

    const identityPanel = dom.window.document.getElementById('identityPanel');
    const capabilitiesPanel = dom.window.document.getElementById('capabilitiesPanel');
    const decisionPanel = dom.window.document.getElementById('enemyDecisionPanel');
    const capabilitiesTab = dom.window.document.getElementById('capabilitiesTab');
    const decisionTab = dom.window.document.getElementById('enemyDecisionTab');

    assert.equal(identityPanel.hidden, false);
    assert.equal(capabilitiesPanel.hidden, true);
    assert.equal(decisionPanel.hidden, true);
    assert.match(dom.window.document.getElementById('capabilitiesJsonInput').value, /basic_attack/);
    assert.equal(dom.window.document.getElementById('intentModelJsonInput'), null);
    assert.equal(dom.window.document.getElementById('decisionModelJsonInput'), null);

    capabilitiesTab.dispatchEvent(new Event('click'));

    assert.equal(identityPanel.hidden, true);
    assert.equal(capabilitiesPanel.hidden, false);
    assert.equal(capabilitiesTab.getAttribute('aria-selected'), 'true');

    decisionTab.dispatchEvent(new Event('click'));
    assert.equal(capabilitiesPanel.hidden, true);
    assert.equal(decisionPanel.hidden, false);
    assert.equal(decisionTab.getAttribute('aria-selected'), 'true');
    assert.match(dom.window.document.getElementById('decisionGraphCanvas').textContent, /Normal|Action/u);
    assert.match(dom.window.document.getElementById('decisionPreviewTrace').textContent, /Turn 1/u);

    dom.window.document.getElementById('capabilitiesJsonInput').value = JSON.stringify([
        {
            type: 'telegraph_countdown',
            cadence: 'windup_2_turns',
            pressure: 'delayed_high_damage',
            counterplay: ['guard']
        }
    ], null, 2);

    page.syncCurrentEnemyFromForm();
    const exported = page.workspace.exportDocument();
    const enemy = exported.goblin_story_headhunter || exported.enemies?.goblin_story_headhunter;

    assert.equal(enemy.capabilities[0].type, 'telegraph_countdown');
    assert.equal(enemy.enemyDecision.schemaVersion, 'enemy_decision_graph_v1');
    assert.equal('intentModel' in enemy, false);
    assert.equal('decisionModel' in enemy, false);
    assert.equal('runPressure' in enemy, false);
    assert.equal('statePersistence' in enemy, false);
});

test('EnemyEditorPage drives identity controls from enemy pack enums', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());

    const raceSelect = dom.window.document.getElementById('enemyRaceInput');
    const classSelect = dom.window.document.getElementById('enemyClassInput');
    const tagSelect = dom.window.document.getElementById('enemyTagsInput');

    assert.equal(raceSelect.tagName, 'SELECT');
    assert.equal(classSelect.tagName, 'SELECT');
    assert.equal(tagSelect.tagName, 'SELECT');
    assert.equal(tagSelect.multiple, true);
    assert.deepEqual(raceSelect.children.map(option => option.value), ['', 'goblin', 'orc']);
    assert.deepEqual(classSelect.children.map(option => option.value), ['', 'hunter', 'support']);
    assert.deepEqual(tagSelect.children.map(option => option.value), ['story', 'pressure_bleed', 'role_fast']);
    assert.deepEqual(tagSelect.children.filter(option => option.selected).map(option => option.value), ['story']);

    raceSelect.value = 'orc';
    classSelect.value = 'support';
    tagSelect.children.forEach(option => {
        option.selected = option.value === 'pressure_bleed' || option.value === 'role_fast';
    });

    page.syncCurrentEnemyFromForm();
    const exported = page.workspace.exportDocument();
    const enemy = exported.enemies.goblin_story_headhunter;

    assert.equal(enemy.race, 'orc');
    assert.equal(enemy.class, 'support');
    assert.deepEqual(enemy.tags, ['pressure_bleed', 'role_fast']);
});

test('EnemyEditorPage renders capabilities as editable lists and keeps enemyDecision separate', async () => {
    const { page, dom } = await createPageContext();
    const wrapped = buildWrappedEnemiesWithEnums();
    page.loadDocument({
        ...wrapped,
        meta: {
            ...wrapped.meta,
            enums: {
                ...wrapped.meta.enums,
                capabilityTypes: ['basic_attack', 'telegraph_countdown'],
                intentTokens: ['attack', 'bleed', 'heavy_attack', 'recover', 'telegraph']
            }
        }
    });

    const capabilityList = dom.window.document.getElementById('capabilityList');

    assert.equal(capabilityList.children.length, 1);
    assert.equal(findChildByDataset(capabilityList.children[0], 'capabilityField', 'type').value, 'basic_attack');
    assert.equal(findChildByDataset(capabilityList.children[0], 'capabilityField', 'cadence').tagName, 'SELECT');
    assert.equal(findChildByDataset(capabilityList.children[0], 'capabilityField', 'pressure').tagName, 'SELECT');
    assert.equal(
        findChildByDataset(capabilityList.children[0], 'capabilityField', 'cadence').children
            .some(option => option.textContent.includes('不是运行时触发器')),
        true
    );
    assert.equal(
        findChildByDataset(capabilityList.children[0], 'capabilityField', 'pressure').children
            .some(option => option.textContent.includes('稳定磨血')),
        true
    );
    const counterplayGroup = findChildByDataset(capabilityList.children[0], 'capabilityField', 'counterplay');
    assert.equal(counterplayGroup.tagName, 'DIV');
    assert.match(capabilityList.children[0].textContent, /设计节奏/);
    assert.match(capabilityList.children[0].textContent, /非运行时触发/);
    assert.match(capabilityList.children[0].textContent, /玩家反制/);
    assert.equal(counterplayGroup.children.some(child => child.textContent.includes('fast_kill')), true);
    assert.match(capabilityList.textContent, /basic_attack/);
    assert.match(capabilityList.textContent, /快速击杀以缩短磨血/);
    assert.equal(dom.window.document.getElementById('intentPatternList'), null);
    assert.equal(dom.window.document.getElementById('intentFallbackInput'), null);

    findChildByDataset(capabilityList.children[0], 'capabilityField', 'type').value = 'telegraph_countdown';
    findChildByDataset(capabilityList.children[0], 'capabilityField', 'cadence').value = 'windup_1_turn';
    findChildByDataset(capabilityList.children[0], 'capabilityField', 'pressure').value = 'readable_burst';
    findChildByDataset(capabilityList.children[0], 'capabilityField', 'counterplay').children.forEach(chip => {
        const checkbox = chip.children.find(child => child.tagName === 'INPUT');
        checkbox.checked = checkbox.value === 'guard' || checkbox.value === 'interrupt';
    });

    page.syncCurrentEnemyFromForm();
    const enemy = page.workspace.exportDocument().enemies.goblin_story_headhunter;

    assert.deepEqual(enemy.capabilities[0], {
        type: 'telegraph_countdown',
        cadence: 'windup_1_turn',
        pressure: 'readable_burst',
        counterplay: ['guard', 'interrupt']
    });
    assert.equal(enemy.enemyDecision.schemaVersion, 'enemy_decision_graph_v1');
    assert.equal('intentModel' in enemy, false);
});

test('EnemyEditorPage renders enemyDecision as a graph editor with preview', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());

    const decisionTab = dom.window.document.getElementById('enemyDecisionTab');
    const decisionPanel = dom.window.document.getElementById('enemyDecisionPanel');
    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const preview = dom.window.document.getElementById('decisionPreviewTrace');
    const skillList = dom.window.document.getElementById('decisionSkillList');

    decisionTab.dispatchEvent(new Event('click'));

    assert.equal(decisionPanel.hidden, false);
    assert.match(canvas.textContent, /Normal/u);
    assert.match(canvas.textContent, /skill_throw_stone/u);
    assert.match(preview.textContent, /Turn 1/u);
    assert.match(skillList.textContent, /skill_throw_stone/u);

    page.syncCurrentEnemyFromForm();
    const enemy = page.workspace.exportDocument().enemies.goblin_story_headhunter;

    assert.equal(enemy.enemyDecision.schemaVersion, 'enemy_decision_graph_v1');
    assert.equal('decisionModel' in enemy, false);
});

test('enemy decision graph editor uses a three-column blueprint layout', async () => {
    const html = await fsp.readFile(pageHtmlPath, 'utf8');

    assert.match(html, /\.decision-graph-editor\s*\{[\s\S]*grid-template-columns:\s*220px minmax\(420px, 1fr\) 280px;/u);
    assert.match(html, /\.decision-graph-canvas/u);
    assert.match(html, /\.decision-node-card/u);
    assert.match(html, /\.decision-preview-trace/u);
    assert.match(html, /\.editor-body\s*\{[\s\S]*container-type:\s*inline-size;/u);

    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    assert.equal(canvas.children.length > 0, true);
    assert.match(canvas.children[0].className, /\bdecision-node-card\b/u);
});

test('EnemyEditorPage omits enemy-level run pressure and cross-level persistence controls', async () => {
    const { page, dom } = await createPageContext();
    const legacyPack = buildWrappedEnemiesWithEnums();
    legacyPack.enemies.goblin_story_headhunter.runPressure = {
        type: 'hp_attrition',
        expectedDamageBudget: 12,
        counterplay: ['fast_kill']
    };
    legacyPack.enemies.goblin_story_headhunter.statePersistence = {
        carryOver: ['hp', 'armor'],
        clearAfterBattle: ['bleed', 'poison']
    };
    page.loadDocument(legacyPack);

    for (const id of [
        'pressureTab',
        'pressurePanel',
        'runPressureTypeInput',
        'runPressureDamageBudgetInput',
        'runPressureCarryoverImpactInput',
        'runPressureCounterplayInput',
        'runPressureJsonInput',
        'stateCarryOverInput',
        'stateClearAfterBattleInput',
        'statePersistenceJsonInput'
    ]) {
        assert.equal(dom.window.document.getElementById(id), null, `page should not expose #${id}`);
    }

    page.syncCurrentEnemyFromForm();
    const enemy = page.workspace.exportDocument().enemies.goblin_story_headhunter;
    assert.equal('runPressure' in enemy, false);
    assert.equal('statePersistence' in enemy, false);
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

test('EnemyEditorPage saves authoring drafts and publishes enemyDecision runtime packs', async () => {
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
    assert.equal(JSON.parse(writes[0].content).goblin_story_headhunter.name, '保存工作稿自动写入');
    assert.equal(
        JSON.parse(writes[0].content).goblin_story_headhunter.presentation.battleSpriteRef,
        '../source/character/敌人-005-状态001-正常状态.png'
    );
    assert.equal('intentModel' in JSON.parse(writes[0].content).goblin_story_headhunter, false);
    assert.equal('decisionModel' in JSON.parse(writes[0].content).goblin_story_headhunter, false);
    assert.equal(writes[1].path, 'assets/enemy_packs/current/enemies.json');
    assert.equal('intentModel' in JSON.parse(writes[1].content).goblin_story_headhunter, false);
    assert.equal('decisionModel' in JSON.parse(writes[1].content).goblin_story_headhunter, false);
    assert.equal(JSON.parse(writes[1].content).goblin_story_headhunter.enemyDecision.schemaVersion, 'enemy_decision_graph_v1');
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
