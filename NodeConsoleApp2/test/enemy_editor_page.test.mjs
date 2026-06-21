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
const decisionCanvasRendererModulePath = path.join(projectRoot, 'script', 'editor', 'enemy', 'decision', 'EnemyDecisionCanvasRenderer.js');
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
    if (source.includes('./EnemyDecisionCanvasRenderer.js') && fs.existsSync(decisionCanvasRendererModulePath)) {
        const canvasRendererEncoded = await encodeSourceModule(decisionCanvasRendererModulePath);
        source = source.replaceAll("'./EnemyDecisionCanvasRenderer.js'", `'data:text/javascript;base64,${canvasRendererEncoded}'`);
        source = source.replaceAll('"./EnemyDecisionCanvasRenderer.js"', `"data:text/javascript;base64,${canvasRendererEncoded}"`);
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
        this.width = 0;
        this.height = 0;
        this.__drawOperations = [];
        this.__canvasContext = null;
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

    removeEventListener(type, handler) {
        const handlers = this.listeners.get(type) || [];
        this.listeners.set(type, handlers.filter(item => item !== handler));
    }

    dispatchEvent(event) {
        const handlers = this.listeners.get(event.type) || [];
        handlers.forEach(handler => handler.call(this, event));
        return true;
    }

    getContext(type) {
        this.dataset.lastContextType = String(type);
        if (type !== '2d') return null;
        if (this.__canvasContext) return this.__canvasContext;
        const operations = this.__drawOperations;
        const record = method => (...args) => operations.push({ method, args });
        this.__canvasContext = {
            canvas: this,
            save: record('save'),
            restore: record('restore'),
            clearRect: record('clearRect'),
            scale: record('scale'),
            beginPath: record('beginPath'),
            closePath: record('closePath'),
            moveTo: record('moveTo'),
            lineTo: record('lineTo'),
            quadraticCurveTo: record('quadraticCurveTo'),
            bezierCurveTo: record('bezierCurveTo'),
            arc: record('arc'),
            rect: record('rect'),
            fill: record('fill'),
            stroke: record('stroke'),
            fillText: record('fillText'),
            strokeText: record('strokeText'),
            setLineDash: record('setLineDash'),
            translate: record('translate'),
            rotate: record('rotate'),
            measureText: text => ({ width: String(text ?? '').length * 8 })
        };
        return this.__canvasContext;
    }
}

class FakeDocument {
    constructor(fixtures) {
        this.elements = new Map();
        this.body = new FakeElement('body', this);
        this.listeners = new Map();
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

    addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(handler);
    }

    removeEventListener(type, handler) {
        const handlers = this.listeners.get(type) || [];
        this.listeners.set(type, handlers.filter(item => item !== handler));
    }

    dispatchEvent(event) {
        const handlers = this.listeners.get(event.type) || [];
        handlers.forEach(handler => handler.call(this, event));
        return true;
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

function findCanvasLayer(surface) {
    return surface?.children?.find(child => child.tagName === 'CANVAS' && String(child.className || '').includes('decision-canvas-layer')) || null;
}

function canvasDescendants(surface) {
    const result = [];
    const stack = [...(surface?.children || [])];
    while (stack.length) {
        const next = stack.shift();
        result.push(next);
        stack.push(...(next?.children || []));
    }
    return result;
}

function findCanvasElement(surface, predicate) {
    return canvasDescendants(surface).find(predicate) || null;
}

function findCanvasElements(surface, predicate) {
    return canvasDescendants(surface).filter(predicate);
}

function findInteractionLayer(surface) {
    return findCanvasElement(surface, child => String(child.className || '').includes('decision-interaction-layer'));
}

function canvasFillTexts(layer) {
    return (layer?.__drawOperations || [])
        .filter(operation => operation.method === 'fillText')
        .map(operation => String(operation.args?.[0] ?? ''));
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
    assert.match(html, /id=["']toggleDecisionFullscreenBtn["']/u, 'page missing enemy decision fullscreen toggle');
    for (const englishLabel of ['Add state', 'Add branch', 'Add action', 'Templates', 'Enemy skills', 'Graph issues', 'Inspector', 'Path preview']) {
        assert.doesNotMatch(html, new RegExp(`>${englishLabel}<`, 'u'), `enemy decision editor should not expose English label ${englishLabel}`);
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
    assert.equal(
        canvasFillTexts(findCanvasLayer(dom.window.document.getElementById('decisionGraphCanvas')))
            .some(text => /默认状态|行动/u.test(text)),
        true
    );
    assert.match(dom.window.document.getElementById('decisionPreviewTrace').textContent, /第 1 回合/u);

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
    assert.equal(canvasFillTexts(findCanvasLayer(canvas)).some(text => /默认状态/u.test(text)), true);
    assert.equal(canvasFillTexts(findCanvasLayer(canvas)).some(text => /skill_throw_stone/u.test(text)), true);
    assert.match(preview.textContent, /第 1 回合/u);
    assert.match(skillList.textContent, /skill_throw_stone/u);

    page.syncCurrentEnemyFromForm();
    const enemy = page.workspace.exportDocument().enemies.goblin_story_headhunter;

    assert.equal(enemy.enemyDecision.schemaVersion, 'enemy_decision_graph_v1');
    assert.equal('decisionModel' in enemy, false);
});

test('EnemyEditorPage renders the Rete workspace as the primary enemy decision editor', async () => {
    const html = await fsp.readFile(pageHtmlPath, 'utf8');

    for (const id of [
        'decisionWorkspaceModeEditBtn',
        'decisionWorkspaceModePreviewBtn',
        'decisionWorkspaceModeValidateBtn',
        'decisionWorkspaceModePublishBtn'
    ]) {
        assert.match(html, new RegExp(`id=["']${id}["']`), `page missing #${id}`);
    }
    assert.match(html, /\.decision-rete-workbench/u, 'page should define the Rete workbench surface');
    assert.match(html, /\.decision-inspect-preview/u, 'page should define an Inspect preview block');

    const { page, dom } = await createPageContext();
    const pack = buildWrappedEnemiesWithEnums();
    pack.enemies.goblin_story_headhunter.skills = ['skill_throw_stone', 'enemy_skill_rusty_shiv'];
    page.loadDocument(pack);
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const descendants = canvasDescendants(canvas);
    const workbench = descendants.find(child => String(child.className || '').includes('decision-rete-workbench'));
    const reteNodes = descendants.filter(child => String(child.className || '').includes('decision-rete-node'));
    const selectedNode = reteNodes.find(child => String(child.className || '').includes('is-selected'));
    const canvasLayer = findCanvasLayer(canvas);

    assert.equal(canvas.dataset.primaryEditor, 'rete');
    assert(workbench, 'Rete workbench should be rendered as the visible editing surface');
    assert.equal(reteNodes.length >= 4, true);
    assert.equal(reteNodes.some(node => /skill_throw_stone/u.test(node.textContent)), true);
    assert.equal(reteNodes.some(node => /enemy_skill_rusty_shiv/u.test(node.textContent)), true);
    assert(selectedNode, 'selected Rete node should be visible');
    assert(canvasLayer, 'activity canvas should still be generated for preview and conversion');
    assert.equal(canvasLayer.dataset.drawMode, 'canvas_activity_diagram');

    const inspector = dom.window.document.getElementById('decisionNodeInspector');
    assert.equal(canvasDescendants(inspector).some(child => String(child.className || '').includes('decision-inspect-field')), true);
    assert.equal(canvasDescendants(inspector).some(child => String(child.className || '').includes('decision-inspect-preview')), true);
    assert.match(inspector.textContent, /Inspect/u);
    assert.match(inspector.textContent, /回流状态|state_normal/u);
});

test('EnemyEditorPage toggles enemyDecision into an immersive fullscreen editor', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());

    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const decisionPanel = dom.window.document.getElementById('enemyDecisionPanel');
    const fullscreenToggle = dom.window.document.getElementById('toggleDecisionFullscreenBtn');
    const canvas = dom.window.document.getElementById('decisionGraphCanvas');

    assert.equal(decisionPanel.classList.contains('is-decision-fullscreen'), false);
    assert.equal(fullscreenToggle.textContent, '全屏编辑');
    assert.equal(fullscreenToggle.getAttribute('aria-pressed'), 'false');

    fullscreenToggle.dispatchEvent(new Event('click'));

    assert.equal(decisionPanel.classList.contains('is-decision-fullscreen'), true);
    assert.equal(dom.window.document.body.classList.contains('enemy-decision-fullscreen-active'), true);
    assert.equal(fullscreenToggle.textContent, '退出全屏');
    assert.equal(fullscreenToggle.getAttribute('aria-pressed'), 'true');
    assert.equal(canvasFillTexts(findCanvasLayer(canvas)).some(text => /skill_throw_stone/u.test(text)), true);

    page.syncCurrentEnemyFromForm();
    assert.equal(page.workspace.exportDocument().enemies.goblin_story_headhunter.enemyDecision.schemaVersion, 'enemy_decision_graph_v1');

    dom.window.document.dispatchEvent({ type: 'keydown', key: 'Escape' });

    assert.equal(decisionPanel.classList.contains('is-decision-fullscreen'), false);
    assert.equal(dom.window.document.body.classList.contains('enemy-decision-fullscreen-active'), false);
    assert.equal(fullscreenToggle.textContent, '全屏编辑');
    assert.equal(fullscreenToggle.getAttribute('aria-pressed'), 'false');
});

test('EnemyEditorPage decision graph supports dragging nodes and editing connections', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const stateHotspot = findCanvasElement(canvas, child => child.dataset?.nodeId === 'state_normal' && String(child.className || '').includes('decision-node-hotspot'));
    const canvasLayer = findCanvasLayer(canvas);

    assert(stateHotspot, 'state node should expose a transparent hotspot');
    assert(canvasLayer, 'graph surface should render a canvas drawing layer');
    assert.equal(canvasDescendants(canvas).some(child => String(child.className || '').includes('decision-node-card')), false);
    assert.equal(canvasFillTexts(canvasLayer).some(text => /状态|默认/u.test(text)), true);
    assert.equal(canvasDescendants(canvas).some(child => String(child.className || '').includes('decision-edge')), false);
    assert.equal(
        canvasLayer.__drawOperations.some(operation => operation.method === 'lineTo'),
        true,
        JSON.stringify({ contextReady: canvasLayer.dataset.contextReady, lastContextType: canvasLayer.dataset.lastContextType, operations: canvasLayer.__drawOperations.slice(0, 20) })
    );

    stateHotspot.dispatchEvent({
        type: 'mousedown',
        clientX: 100,
        clientY: 120,
        preventDefault() {}
    });
    dom.window.document.dispatchEvent({
        type: 'mousemove',
        clientX: 180,
        clientY: 170,
        preventDefault() {}
    });
    dom.window.document.dispatchEvent({ type: 'mouseup' });

    const movedDecision = page.decisionGraphEditor.getDecision();
    assert.equal(movedDecision.layout.nodes.state_normal.x, 340);
    assert.equal(movedDecision.layout.nodes.state_normal.y, 130);

    const branchButton = dom.window.document.getElementById('addDecisionBranchBtn');
    branchButton.dispatchEvent(new Event('click'));
    const branchId = page.decisionGraphEditor.selectedNodeId;
    const connectHandle = findCanvasElement(canvas, child => child.dataset?.connectFrom === 'state_normal' && String(child.className || '').includes('decision-node-port'));
    const branchHotspot = findCanvasElement(canvas, child => child.dataset?.nodeId === branchId && String(child.className || '').includes('decision-node-hotspot'));

    assert(connectHandle, 'source node should expose a connect handle');
    assert(branchHotspot, 'new branch should expose a transparent hotspot');
    connectHandle.dispatchEvent(new Event('click'));
    branchHotspot.dispatchEvent(new Event('click'));

    const connectedDecision = page.decisionGraphEditor.getDecision();
    assert.equal(connectedDecision.graph.edges.some(edge => edge.from === 'state_normal' && edge.to === branchId), true);
    const updatedCanvasLayer = findCanvasLayer(canvas);
    assert(updatedCanvasLayer, 'canvas layer should remain after adding a connection');
    assert.equal(Number(updatedCanvasLayer.dataset.edgeCount || 0) >= 2, true);
});

test('EnemyEditorPage Rete workspace nodes are draggable from their visible cards', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const actionCard = findCanvasElement(canvas, child => child.dataset?.nodeType === 'action' && String(child.className || '').includes('decision-rete-node'));
    const startDecision = page.decisionGraphEditor.getDecision();
    const startLayout = startDecision.layout.reteNodes[actionCard?.dataset?.nodeId] || {};

    assert(actionCard, 'action node should expose a visible Rete card');
    actionCard.dispatchEvent({
        type: 'mousedown',
        target: actionCard,
        clientX: 760,
        clientY: 250,
        preventDefault() {}
    });
    dom.window.document.dispatchEvent({
        type: 'mousemove',
        clientX: 830,
        clientY: 298,
        preventDefault() {}
    });
    dom.window.document.dispatchEvent({ type: 'mouseup' });

    const movedDecision = page.decisionGraphEditor.getDecision();
    assert.equal(movedDecision.layout.reteNodes[actionCard.dataset.nodeId].x, Number(startLayout.x) + 70);
    assert.equal(movedDecision.layout.reteNodes[actionCard.dataset.nodeId].y, Number(startLayout.y) + 48);
});

test('EnemyEditorPage Rete action end is a selectable and draggable system node', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const actionEndCard = findCanvasElement(canvas, child => child.dataset?.nodeType === 'actionEnd' && String(child.className || '').includes('decision-rete-node'));
    const actionEndId = actionEndCard?.dataset?.nodeId;
    const startDecision = page.decisionGraphEditor.getDecision();
    const startLayout = startDecision.layout.reteNodes[actionEndId] || {};

    assert(actionEndCard, 'action end should expose a visible Rete system card');
    assert.equal(actionEndId, '__action_end__');
    assert.equal(Number.isFinite(Number(startLayout.x)), true, 'action end layout should be persisted before dragging');
    assert.equal(Number.isFinite(Number(startLayout.y)), true, 'action end layout should be persisted before dragging');

    actionEndCard.dispatchEvent({
        type: 'mousedown',
        target: actionEndCard,
        clientX: 1120,
        clientY: 300,
        preventDefault() {}
    });
    dom.window.document.dispatchEvent({
        type: 'mousemove',
        clientX: 1164,
        clientY: 332,
        preventDefault() {}
    });
    dom.window.document.dispatchEvent({ type: 'mouseup' });

    const movedDecision = page.decisionGraphEditor.getDecision();
    assert.equal(movedDecision.layout.reteNodes[actionEndId].x, Number(startLayout.x) + 44);
    assert.equal(movedDecision.layout.reteNodes[actionEndId].y, Number(startLayout.y) + 32);
    assert.equal(page.decisionGraphEditor.selectedNodeId, actionEndId);

    const movedCard = findCanvasElement(canvas, child => child.dataset?.nodeId === actionEndId && String(child.className || '').includes('decision-rete-node'));
    movedCard.dispatchEvent(new Event('click'));
    const inspector = dom.window.document.getElementById('decisionNodeInspector');
    assert.match(inspector.textContent, /节点\s*行动结束/u);
    assert.match(inspector.textContent, /行动结束/u);
    assert.match(inspector.textContent, /系统/u);
});

test('EnemyEditorPage Rete workspace uses a left-to-right blueprint world', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const workbench = findCanvasElement(canvas, child => String(child.className || '').includes('decision-rete-workbench'));
    const edgeLayer = findCanvasElement(canvas, child => String(child.className || '').includes('decision-rete-connection-layer'));
    const decision = page.decisionGraphEditor.getDecision();
    const layout = decision.layout.reteNodes;

    assert.equal(decision.layout.reteLayoutVersion, 2);
    assert.equal(Number(workbench?.dataset?.worldWidth), 2400);
    assert.equal(Number(workbench?.dataset?.worldHeight), 1400);
    assert.equal(workbench?.style.width, '2400px');
    assert.equal(workbench?.style.height, '1400px');
    assert.equal(edgeLayer?.getAttribute('viewBox'), '0 0 2400 1400');
    const nodes = decision.graph.nodes;
    const stateNodes = nodes.filter(node => node.type === 'state');
    const branchNodes = nodes.filter(node => node.type === 'branch');
    const actionNodes = nodes.filter(node => node.type === 'action');
    assert.equal(layout.entry.x < Math.min(...stateNodes.map(node => layout[node.id].x)), true, JSON.stringify(layout));
    assert.equal(Math.max(...stateNodes.map(node => layout[node.id].x)) < Math.min(...branchNodes.map(node => layout[node.id].x)), true, JSON.stringify(layout));
    assert.equal(Math.max(...branchNodes.map(node => layout[node.id].x)) < Math.max(...actionNodes.map(node => layout[node.id].x)), true, JSON.stringify(layout));
    assert.equal(actionNodes.every(node => layout[node.id].x >= Math.max(...branchNodes.map(branch => layout[branch.id].x)), true), true, JSON.stringify(layout));
});

test('EnemyEditorPage Rete workspace shows action start and action end instead of merge loopbacks', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const startNode = findCanvasElement(canvas, child => child.dataset?.nodeType === 'entry' && String(child.className || '').includes('decision-rete-node'));
    const actionEndNode = findCanvasElement(canvas, child => child.dataset?.nodeType === 'actionEnd' && String(child.className || '').includes('decision-rete-node'));
    const mergeNode = findCanvasElement(canvas, child => child.dataset?.nodeType === 'merge' && String(child.className || '').includes('decision-rete-node'));
    const loopEdges = findCanvasElements(canvas, child => String(child.className || '').includes('decision-rete-edge--loop'));
    const endEdges = findCanvasElements(canvas, child => String(child.className || '').includes('decision-rete-edge--action-end'));
    const actionCount = page.decisionGraphEditor.getDecision().graph.nodes.filter(node => node.type === 'action').length;

    assert(startNode, 'Rete workspace should expose the per-turn action start node');
    assert.match(startNode.textContent, /行动开始/u);
    assert(actionEndNode, 'Rete workspace should expose a virtual action end node');
    assert.match(actionEndNode.textContent, /行动结束/u);
    assert.equal(String(actionEndNode.className || '').includes('decision-rete-node--action-end'), true);
    assert.equal(actionEndNode.style.width, startNode.style.width);
    assert.equal(actionEndNode.style.minHeight, startNode.style.minHeight);
    assert.equal(mergeNode, null);
    assert.equal(loopEdges.length, 0);
    assert.equal(endEdges.length, actionCount);
    assert.equal(endEdges.every(edge => edge.dataset?.to === '__action_end__'), true);
});

test('EnemyEditorPage Rete branch sockets are separate true and false output ports', async () => {
    const { page, dom } = await createPageContext();
    const pack = buildWrappedEnemiesWithEnums();
    pack.enemies.goblin_story_headhunter.skills = ['skill_throw_stone', 'enemy_skill_rusty_shiv'];
    page.loadDocument(pack);
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const branchId = page.decisionGraphEditor.getDecision().graph.nodes.find(node => node.type === 'branch')?.id;
    const trueSocket = findCanvasElement(canvas, child => child.dataset?.nodeId === branchId && child.dataset?.branch === 'true');
    const falseSocket = findCanvasElement(canvas, child => child.dataset?.nodeId === branchId && child.dataset?.branch === 'false');
    const trueEdge = findCanvasElement(canvas, child => child.dataset?.from === branchId && child.dataset?.branch === 'true');
    const falseEdge = findCanvasElement(canvas, child => child.dataset?.from === branchId && child.dataset?.branch === 'false');

    assert(trueSocket, 'branch should expose a true output port');
    assert(falseSocket, 'branch should expose a false output port');
    assert.notEqual(trueSocket.style.top, falseSocket.style.top);
    assert(trueEdge, 'true branch edge should be tagged with branch=true');
    assert(falseEdge, 'false branch edge should be tagged with branch=false');
    assert.notEqual(trueEdge.getAttribute('d').split(' C ')[0], falseEdge.getAttribute('d').split(' C ')[0]);
});

test('EnemyEditorPage Rete output sockets create edges by dragging to input sockets', async () => {
    const { page, dom } = await createPageContext();
    const pack = buildWrappedEnemiesWithEnums();
    pack.enemies.goblin_story_headhunter.skills = ['skill_throw_stone', 'enemy_skill_rusty_shiv'];
    page.loadDocument(pack);
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));
    page.decisionGraphEditor.addStateNode();
    const targetStateId = page.decisionGraphEditor.selectedNodeId;

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const branchId = page.decisionGraphEditor.getDecision().graph.nodes.find(node => node.type === 'branch')?.id;
    const sourceSocket = findCanvasElement(canvas, child => child.dataset?.nodeId === branchId && child.dataset?.branch === 'true');
    const targetSocket = findCanvasElement(canvas, child => child.dataset?.nodeId === targetStateId && child.dataset?.connectTo === targetStateId);
    assert(sourceSocket, 'source branch socket should exist');
    assert(targetSocket, 'target input socket should exist');

    sourceSocket.dispatchEvent({
        type: 'mousedown',
        target: sourceSocket,
        button: 0,
        clientX: 540,
        clientY: 320,
        preventDefault() {},
        stopPropagation() {}
    });
    dom.window.document.dispatchEvent({
        type: 'mousemove',
        clientX: 700,
        clientY: 360,
        preventDefault() {}
    });
    dom.window.document.dispatchEvent({
        type: 'mouseup',
        target: targetSocket,
        clientX: 700,
        clientY: 360,
        preventDefault() {}
    });

    const decision = page.decisionGraphEditor.getDecision();
    const trueEdges = decision.graph.edges.filter(edge => edge.from === branchId && edge.branch === 'true');
    assert.equal(trueEdges.length, 1);
    assert.equal(trueEdges[0].to, targetStateId);
    assert.equal(page.decisionGraphEditor.pendingConnectionFrom, '');
});

test('EnemyEditorPage Rete workspace supports panning the canvas background', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const workbench = findCanvasElement(canvas, child => String(child.className || '').includes('decision-rete-workbench'));
    assert(workbench, 'Rete workbench should receive background pan input');

    workbench.dispatchEvent({
        type: 'mousedown',
        target: workbench,
        button: 0,
        clientX: 420,
        clientY: 310,
        preventDefault() {}
    });
    dom.window.document.dispatchEvent({
        type: 'mousemove',
        clientX: 486,
        clientY: 354,
        preventDefault() {}
    });
    dom.window.document.dispatchEvent({ type: 'mouseup' });

    const decision = page.decisionGraphEditor.getDecision();
    const nextWorkbench = findCanvasElement(canvas, child => String(child.className || '').includes('decision-rete-workbench'));
    assert.equal(decision.layout.reteViewport.x, 66);
    assert.equal(decision.layout.reteViewport.y, 44);
    assert.match(nextWorkbench.style.transform, /translate\(66px, 44px\)/u);
});

test('EnemyEditorPage Rete workspace zoom controls scale the blueprint canvas', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const zoomInButton = dom.window.document.getElementById('zoomDecisionGraphInBtn');
    zoomInButton.dispatchEvent(new Event('click'));

    const zoomedDecision = page.decisionGraphEditor.getDecision();
    const zoomedWorkbench = findCanvasElement(canvas, child => String(child.className || '').includes('decision-rete-workbench'));
    assert.equal(zoomedDecision.layout.reteViewport.zoom, 1.15);
    assert.match(zoomedWorkbench.style.transform, /scale\(1\.15\)/u);

    const resetButton = dom.window.document.getElementById('resetDecisionGraphViewBtn');
    resetButton.dispatchEvent(new Event('click'));

    const resetDecision = page.decisionGraphEditor.getDecision();
    const resetWorkbench = findCanvasElement(canvas, child => String(child.className || '').includes('decision-rete-workbench'));
    assert.deepEqual(resetDecision.layout.reteViewport, { x: 0, y: 0, zoom: 1 });
    assert.match(resetWorkbench.style.transform, /scale\(1\)/u);
});

test('EnemyEditorPage Rete workspace supports wheel zoom on the canvas', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const workbench = findCanvasElement(canvas, child => String(child.className || '').includes('decision-rete-workbench'));
    assert(workbench, 'Rete workbench should receive wheel zoom input');

    let defaultPrevented = false;
    workbench.dispatchEvent({
        type: 'wheel',
        target: workbench,
        deltaY: -120,
        preventDefault() {
            defaultPrevented = true;
        }
    });

    const decision = page.decisionGraphEditor.getDecision();
    const nextWorkbench = findCanvasElement(canvas, child => String(child.className || '').includes('decision-rete-workbench'));
    assert.equal(defaultPrevented, true);
    assert.equal(decision.layout.reteViewport.zoom, 1.1);
    assert.match(nextWorkbench.style.transform, /scale\(1\.1\)/u);
});

test('EnemyEditorPage Rete workspace fit view uses the visible canvas size', async () => {
    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    canvas.getBoundingClientRect = () => ({ width: 960, height: 700 });
    const originalGetComputedStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({
        getPropertyValue(name) {
            return name === '--decision-rete-scale' ? '1' : '';
        }
    });

    try {
        dom.window.document.getElementById('fitDecisionGraphViewBtn').dispatchEvent(new Event('click'));
    } finally {
        globalThis.getComputedStyle = originalGetComputedStyle;
    }

    const decision = page.decisionGraphEditor.getDecision();
    const workbench = findCanvasElement(canvas, child => String(child.className || '').includes('decision-rete-workbench'));
    assert.deepEqual(decision.layout.reteViewport, { x: 0, y: 0, zoom: 0.38 });
    assert.match(workbench.style.transform, /scale\(0\.38\)/u);
});

test('enemy decision graph editor uses a three-column blueprint layout', async () => {
    const html = await fsp.readFile(pageHtmlPath, 'utf8');

    assert.match(html, /\.decision-graph-editor\s*\{[\s\S]*grid-template-columns:\s*220px minmax\(420px, 1fr\) 280px;/u);
    assert.match(html, /\.editor-panel\.is-decision-fullscreen\s*\{[\s\S]*position:\s*fixed;/u);
    assert.match(html, /\.editor-panel\.is-decision-fullscreen\s*\{[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\);/u);
    assert.match(html, /\.enemy-decision-fullscreen-active\s*\{[\s\S]*overflow:\s*hidden;/u);
    assert.match(html, /\.decision-graph-canvas/u);
    assert.match(html, /\.decision-canvas-layer/u);
    assert.match(html, /\.decision-node-hotspot/u);
    assert.doesNotMatch(html, /\.decision-node-card/u);
    assert.match(html, /\.decision-preview-trace/u);
    assert.match(html, /\.editor-body\s*\{[\s\S]*container-type:\s*inline-size;/u);

    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const canvasLayer = findCanvasLayer(canvas);
    assert.equal(canvas.children.length > 0, true);
    assert(canvasLayer, 'canvas layer should render before node cards');
    assert.equal(canvasDescendants(canvas).some(child => String(child.className || '').includes('decision-edge')), false);
    assert.equal(canvasDescendants(canvas).some(child => String(child.className || '').includes('decision-node-card')), false);
    assert.equal(canvasDescendants(canvas).some(child => String(child.className || '').includes('decision-node-hotspot')), true);
});

test('enemy decision graph editor renders an activity-diagram state machine in fullscreen', async () => {
    const html = await fsp.readFile(pageHtmlPath, 'utf8');

    assert.match(html, /\.decision-canvas-layer/u);
    assert.doesNotMatch(html, /\.decision-edge--loop/u);

    const { page, dom } = await createPageContext();
    page.loadDocument(buildWrappedEnemiesWithEnums());
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));
    page.decisionGraphEditor.setFullscreen(true);
    page.decisionGraphEditor.addBranchNode();

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const canvasLayer = findCanvasLayer(canvas);
    assert(canvasLayer, 'activity diagram should be drawn on canvas');
    assert.equal(canvasLayer.dataset.drawMode, 'canvas_activity_diagram');
    assert.equal(canvasLayer.dataset.hasMerge, 'false');
    assert.equal(Number(canvasLayer.dataset.drawnNodeCount || 0), page.decisionGraphEditor.getDecision().graph.nodes.length);
    assert.equal(Number(canvasLayer.dataset.loopEdgeCount || 0), 0);
    assert.equal(canvasFillTexts(canvasLayer).some(text => /skill_throw_stone|attack/u.test(text)), true);
    assert.equal(canvasFillTexts(canvasLayer).some(text => /条件判断/u.test(text)), true);
    assert.equal(
        canvasLayer.__drawOperations.some(operation => operation.method === 'quadraticCurveTo'),
        true,
        JSON.stringify({ contextReady: canvasLayer.dataset.contextReady, lastContextType: canvasLayer.dataset.lastContextType, operations: canvasLayer.__drawOperations.slice(0, 30) })
    );
    assert.equal(canvasDescendants(canvas).some(child => String(child.className || '').includes('decision-activity-scaffold')), false);
    assert.equal(canvasDescendants(canvas).some(child => String(child.className || '').includes('decision-edge')), false);
    assert.equal(canvasDescendants(canvas).some(child => String(child.className || '').includes('decision-node-card')), false);
    assert.equal(canvasDescendants(canvas).some(child => String(child.className || '').includes('decision-node-hotspot--entry')), true);
    assert.equal(canvasDescendants(canvas).some(child => String(child.className || '').includes('decision-node-hotspot--state')), true);
    assert.equal(canvasDescendants(canvas).some(child => String(child.className || '').includes('decision-node-hotspot--action')), true);
    assert.equal(canvasDescendants(canvas).some(child => String(child.className || '').includes('decision-node-hotspot--branch')), true);
    const branchCard = findCanvasElement(canvas, child => String(child.className || '').includes('decision-node-hotspot--branch'));
    const stateCard = findCanvasElement(canvas, child => String(child.className || '').includes('decision-node-hotspot--state'));
    const actionTops = canvasDescendants(canvas)
        .filter(child => String(child.className || '').includes('decision-node-hotspot--action'))
        .map(child => Number(String(child.style.top || '').replace('px', '')));
    const actionLefts = canvasDescendants(canvas)
        .filter(child => String(child.className || '').includes('decision-node-hotspot--action'))
        .map(child => Number(String(child.style.left || '').replace('px', '')));
    const branchTop = Number(String(branchCard?.style.top || '').replace('px', ''));
    const stateLeft = Number(String(stateCard?.style.left || '').replace('px', ''));
    assert.equal(
        actionTops.every(top => top > branchTop - 40),
        true,
        JSON.stringify({ branchTop, actionTops })
    );
    assert.equal(
        actionLefts.every(left => left > stateLeft + 330),
        true,
        JSON.stringify({ stateLeft, actionLefts })
    );
    assert.match(dom.window.document.getElementById('decisionPreviewTrace').textContent, /回流到 state_normal/u);
});

test('enemy decision graph editor meets the v3 canvas acceptance baseline', async () => {
    const html = await fsp.readFile(pageHtmlPath, 'utf8');
    for (const id of [
        'zoomDecisionGraphInBtn',
        'zoomDecisionGraphOutBtn',
        'resetDecisionGraphViewBtn',
        'rotateDecisionGraphBtn',
        'fitDecisionGraphViewBtn'
    ]) {
        assert.match(html, new RegExp(`id=["']${id}["']`), `page missing #${id}`);
    }

    const previousDevicePixelRatio = globalThis.devicePixelRatio;
    globalThis.devicePixelRatio = 1;
    try {
        const { page, dom } = await createPageContext();
        const pack = buildWrappedEnemiesWithEnums();
        pack.enemies.goblin_story_headhunter.skills = ['skill_throw_stone', 'enemy_skill_rusty_shiv'];
        page.loadDocument(pack);
        dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));
        page.decisionGraphEditor.setFullscreen(true);
        page.decisionGraphEditor.addBranchNode();
        page.decisionGraphEditor.addBranchNode();

        const decision = page.decisionGraphEditor.getDecision();
        const canvas = dom.window.document.getElementById('decisionGraphCanvas');
        let canvasLayer = findCanvasLayer(canvas);
        assert.equal(Number(canvasLayer.dataset.pixelRatio || 0) >= 2, true);
        assert.equal(canvasLayer.width, Number(canvasLayer.dataset.width) * Number(canvasLayer.dataset.pixelRatio));
        assert.equal(canvasLayer.height, Number(canvasLayer.dataset.height) * Number(canvasLayer.dataset.pixelRatio));

        const stateLayout = decision.layout.nodes.state_normal;
        const branchNodes = decision.graph.nodes.filter(node => node.type === 'branch');
        const actionNodes = decision.graph.nodes.filter(node => node.type === 'action');
        const branchLayouts = branchNodes.map(node => decision.layout.nodes[node.id]);
        const actionLayouts = actionNodes.map(node => decision.layout.nodes[node.id]);
        assert.equal(branchNodes.length >= 2, true);
        assert.equal(actionNodes.length >= 2, true);
        assert.equal(branchLayouts.every(layout => Math.abs(layout.x - stateLayout.x) <= 40), true);
        assert.equal(actionLayouts.every(layout => layout.x > stateLayout.x + 330), true);
        assert.equal(actionLayouts.every(layout => layout.y > stateLayout.y + 110), true);
        assert.equal(Number(canvasLayer.dataset.rightActionColumnCount || 0), actionNodes.length);
        assert.equal(Number(canvasLayer.dataset.decisionDiamondCount || 0), branchNodes.length);
        assert.equal(canvasLayer.dataset.prototypeBaseline, 'activity_v3');

        const branchHotspot = findCanvasElement(canvas, child => child.dataset?.nodeId === branchNodes[0].id);
        branchHotspot.dispatchEvent(new Event('click'));
        canvasLayer = findCanvasLayer(canvas);
        assert.equal(page.decisionGraphEditor.selectedNodeId, branchNodes[0].id);
        assert.equal(canvasLayer.dataset.selectedNodeId, branchNodes[0].id);
        assert.equal(Number(canvasLayer.dataset.nodeControlCount || 0) >= 4, true);

        page.decisionGraphEditor.zoomViewport(1.25);
        page.decisionGraphEditor.panViewport(72, -36);
        page.decisionGraphEditor.rotateViewport(6);
        canvasLayer = findCanvasLayer(canvas);
        const viewport = page.decisionGraphEditor.getViewport();
        assert.equal(viewport.zoom > 1, true);
        assert.equal(viewport.x, 72);
        assert.equal(viewport.y, -36);
        assert.equal(viewport.rotation, 6);
        assert.equal(canvasLayer.dataset.zoom, '1.25');
        assert.equal(canvasLayer.dataset.panX, '72');
        assert.equal(canvasLayer.dataset.rotation, '6');
        assert.equal(canvasLayer.__drawOperations.some(operation => operation.method === 'translate'), true);
        assert.equal(canvasLayer.__drawOperations.some(operation => operation.method === 'rotate'), true);
    } finally {
        if (previousDevicePixelRatio === undefined) {
            delete globalThis.devicePixelRatio;
        } else {
            globalThis.devicePixelRatio = previousDevicePixelRatio;
        }
    }
});

test('enemy decision graph editor keeps hit targets aligned through a shared interaction transform', async () => {
    const html = await fsp.readFile(pageHtmlPath, 'utf8');
    assert.match(html, /\.decision-interaction-layer/u, 'page should define a shared interaction layer');

    const { page, dom } = await createPageContext();
    const pack = buildWrappedEnemiesWithEnums();
    pack.enemies.goblin_story_headhunter.skills = ['skill_throw_stone', 'enemy_skill_rusty_shiv'];
    page.loadDocument(pack);
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));
    page.decisionGraphEditor.setFullscreen(true);
    page.decisionGraphEditor.fitViewport();
    page.decisionGraphEditor.zoomViewport(1.25);
    page.decisionGraphEditor.rotateViewport(6);

    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const interactionLayer = findInteractionLayer(canvas);
    const fallbackHotspot = findCanvasElement(canvas, child => child.dataset?.nodeId === 'action_fallback_throw' && String(child.className || '').includes('decision-node-hotspot'));
    const fallbackPort = findCanvasElement(canvas, child => child.dataset?.nodeId === 'action_fallback_throw' && String(child.className || '').includes('decision-node-port'));

    assert(interactionLayer, 'all hit targets should live in one transformed interaction layer');
    assert.equal(interactionLayer.dataset.transformOriginX, '520');
    assert.equal(interactionLayer.dataset.transformOriginY, '430');
    assert.match(interactionLayer.style.transform, /rotate\(6deg\)/u);
    assert.match(interactionLayer.style.transform, /scale\(1\.35\)/u);
    assert(fallbackHotspot, 'fallback action should expose a hit target');
    assert(fallbackPort, 'fallback action should expose a connection target');
    assert.equal(fallbackHotspot.parentNode, interactionLayer);
    assert.equal(fallbackPort.parentNode, interactionLayer);
    assert.equal(fallbackHotspot.style.transform || '', '');
    assert.equal(fallbackPort.style.transform || '', '');
});

test('enemy decision graph editor renders the approved v3 prototype structure by default', async () => {
    const { page, dom } = await createPageContext();
    const pack = buildWrappedEnemiesWithEnums();
    pack.enemies.goblin_story_headhunter.skills = ['skill_throw_stone', 'enemy_skill_rusty_shiv'];
    page.loadDocument(pack);
    dom.window.document.getElementById('enemyDecisionTab').dispatchEvent(new Event('click'));
    page.decisionGraphEditor.setFullscreen(true);

    const decision = page.decisionGraphEditor.getDecision();
    const canvas = dom.window.document.getElementById('decisionGraphCanvas');
    const canvasLayer = findCanvasLayer(canvas);
    const texts = canvasFillTexts(canvasLayer);
    const branches = decision.graph.nodes.filter(node => node.type === 'branch');
    const actions = decision.graph.nodes.filter(node => node.type === 'action');

    assert.deepEqual(branches.map(node => node.id), ['branch_low_hp', 'branch_far_target', 'branch_target_missing_bleed']);
    assert.deepEqual(actions.map(node => node.id), ['action_conservative_throw', 'action_far_throw', 'action_rusty_shiv', 'action_fallback_throw']);
    assert.equal(Number(canvasLayer.dataset.decisionDiamondCount || 0), 3);
    assert.equal(
        Number(canvasLayer.dataset.rightActionColumnCount || 0),
        3,
        JSON.stringify({
            dataset: canvasLayer.dataset,
            actionLayouts: actions.map(node => ({ id: node.id, layout: decision.layout.nodes[node.id] }))
        })
    );
    assert.equal(Number(canvasLayer.dataset.leftFallbackActionCount || 0), 1);
    assert.equal(Number(canvasLayer.dataset.loopEdgeCount || 0), 0);
    assert.equal(canvasLayer.dataset.returnLoopMode, 'next_turn_state_tags');
    assert.equal(canvasLayer.dataset.actionMergeMode, 'actions_to_action_end');
    ['HP <= 35%?', '距离 >= 2?', '目标未流血?', '保守投石', '远距投石', '锈刀划拉', '后备投石', '行动开始', '行动结束'].forEach((label) => {
        assert.equal(texts.some(text => text.includes(label)), true, `missing canvas label: ${label}`);
    });
    assert.equal(texts.some(text => text.includes('Merge')), false);
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
