import EnemyWorkspace from './EnemyWorkspace.js';
import { EnemyDecisionGraphEditor } from './decision/EnemyDecisionGraphEditor.js';

const runtimeEnemyPath = 'assets/enemy_packs/current/enemies.json';
const legacyRuntimeEnemyPath = 'assets/data/enemies.json';

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function splitTextList(value) {
    return String(value || '')
        .split(/[\n,，]/u)
        .map(item => item.trim())
        .filter(Boolean);
}

function toNumber(value, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

function uniqueTextList(values) {
    const seen = new Set();
    const result = [];
    asArray(values).forEach((item) => {
        const value = String(item || '').trim();
        if (!value || seen.has(value)) return;
        seen.add(value);
        result.push(value);
    });
    return result;
}

function readSelectValues(element) {
    if (!element) return [];
    if (element.multiple) {
        return Array.from(element.selectedOptions || element.children || [])
            .filter(option => option.selected)
            .map(option => option.value)
            .filter(Boolean);
    }
    return element.value ? [element.value] : [];
}

function getChildByDataset(row, key, value) {
    const stack = [...(row?.children || [])];
    while (stack.length) {
        const next = stack.shift();
        if (next?.dataset?.[key] === value) return next;
        stack.push(...(next?.children || []));
    }
    return null;
}

function readCheckedValues(container) {
    return Array.from(container?.children || [])
        .map(child => Array.from(child.children || []).find(item => item.tagName === 'INPUT'))
        .filter(input => input?.checked)
        .map(input => input.value)
        .filter(Boolean);
}

function formatJson(value, fallback) {
    const source = value === undefined ? fallback : value;
    return JSON.stringify(source ?? fallback, null, 2);
}

function parseJsonField(value, fallback) {
    const text = String(value || '').trim();
    if (!text) return fallback;
    return JSON.parse(text);
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function buildEnemyAuthoringPath(date = new Date()) {
    const stamp = [
        date.getFullYear(),
        pad2(date.getMonth() + 1),
        pad2(date.getDate())
    ].join('') + '_' + [
        pad2(date.getHours()),
        pad2(date.getMinutes()),
        pad2(date.getSeconds())
    ].join('');
    return `assets/enemy_packs/authoring/enemies_${stamp}.json`;
}

function createElement(doc, tagName, className = '') {
    const element = doc.createElement(tagName);
    if (className) element.className = className;
    return element;
}

function clearElement(element) {
    if (!element) return;
    if (typeof element.replaceChildren === 'function') {
        element.replaceChildren();
        return;
    }
    element.innerHTML = '';
    element.textContent = '';
}

function createLabeledControl(doc, label, control) {
    const wrapper = createElement(doc, 'div', 'capability-cell');
    const caption = createElement(doc, 'span', 'capability-label');
    caption.textContent = label;
    wrapper.appendChild(caption);
    wrapper.appendChild(control);
    return wrapper;
}

function renderSelectOptions(doc, select, values, selectedValues = [], options = {}) {
    if (!select) return;
    const selected = new Set(uniqueTextList(selectedValues));
    const sourceValues = uniqueTextList([...asArray(values), ...selected]);
    clearElement(select);

    if (options.includeEmpty) {
        const option = createElement(doc, 'option');
        option.value = '';
        option.textContent = options.emptyLabel || '';
        select.appendChild(option);
    }

    sourceValues.forEach((value) => {
        const option = createElement(doc, 'option');
        option.value = value;
        option.textContent = typeof options.labelFormatter === 'function'
            ? options.labelFormatter(value)
            : value;
        option.selected = selected.has(value);
        select.appendChild(option);
    });

    if (select.multiple) return;
    select.value = selectedValues[0] || '';
}

function normalizeEnemyLibraryPath(value) {
    return String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/u, '');
}

function isEnemyLibraryPath(filePath) {
    const normalized = normalizeEnemyLibraryPath(filePath);
    const fileName = normalized.split('/').pop() || '';
    return normalized === runtimeEnemyPath
        || normalized === legacyRuntimeEnemyPath
        || /^enemies(?:_\d{8}_\d{6})?\.json$/u.test(fileName);
}

function isEnemyAuthoringPath(filePath) {
    return normalizeEnemyLibraryPath(filePath).startsWith('assets/enemy_packs/authoring/');
}

function sortEnemyLibraryPaths(left, right) {
    if (left === runtimeEnemyPath) return -1;
    if (right === runtimeEnemyPath) return 1;
    if (left === legacyRuntimeEnemyPath) return 1;
    if (right === legacyRuntimeEnemyPath) return -1;
    const leftAuthoring = isEnemyAuthoringPath(left);
    const rightAuthoring = isEnemyAuthoringPath(right);
    if (leftAuthoring && !rightAuthoring) return -1;
    if (!leftAuthoring && rightAuthoring) return 1;
    return String(right).localeCompare(String(left), 'zh-CN');
}

export class EnemyEditorPage {
    constructor(options = {}) {
        this.document = options.document || globalThis.document;
        this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
        this.workspaceFactory = options.workspaceFactory || ((raw, context) => new EnemyWorkspace(raw, context));
        this.defaultEnemyPath = options.defaultEnemyPath || runtimeEnemyPath;
        this.defaultSkillPath = options.defaultSkillPath || 'assets/data/skills_enemy_v1.json';
        this.defaultLevelPath = options.defaultLevelPath || 'assets/data/levels.json';
        this.defaultMapPackPath = options.defaultMapPackPath || 'assets/data/level_map_pack_v1.json';
        this.defaultSourceUrl = options.defaultSourceUrl || '../assets/enemy_packs/current/enemies.json';
        this.workspace = null;
        this.selectedEnemyId = null;
        this.context = {};
        this.elements = {};
        this.decisionGraphEditor = null;
        this.statusVersion = 0;
    }

    bind() {
        [
            'status',
            'enemyLibrarySelect',
            'refreshEnemyLibraryBtn',
            'openSelectedEnemyLibraryBtn',
            'enemyPathInput',
            'loadEnemyBtn',
            'saveDraftBtn',
            'publishEnemyBtn',
            'createEnemyBtn',
            'duplicateEnemyBtn',
            'deleteEnemyBtn',
            'enemyList',
            'issueList',
            'enemyIdInput',
            'enemyNameInput',
            'enemyRaceInput',
            'enemyClassInput',
            'enemyTagsInput',
            'enemyDescriptionInput',
            'enemyHpInput',
            'enemyMaxHpInput',
            'enemyApInput',
            'enemySpeedInput',
            'identityTab',
            'statsTab',
            'capabilitiesTab',
            'enemyDecisionTab',
            'assetsTab',
            'identityPanel',
            'statsPanel',
            'capabilitiesPanel',
            'enemyDecisionPanel',
            'assetsPanel',
            'capabilitiesJsonInput',
            'capabilityList',
            'addCapabilityBtn',
            'decisionTemplateList',
            'decisionSkillList',
            'decisionGraphCanvas',
            'decisionNodeInspector',
            'decisionGraphIssues',
            'decisionPreviewTrace',
            'addDecisionStateBtn',
            'addDecisionBranchBtn',
            'addDecisionGraphActionBtn',
            'duplicateDecisionTemplateBtn',
            'deleteDecisionTemplateBtn',
            'validateDecisionGraphBtn',
            'previewDecisionGraphBtn',
            'portraitRefInput',
            'mapPortraitRefInput',
            'battleSpriteSelect',
            'battleSpriteRefInput',
            'iconRefInput',
            'skillListInput',
            'mapPreviewName',
            'mapPreviewId',
            'mapPreviewPortrait',
            'artPreviewPortrait',
            'artPreviewState',
            'mapPreviewStats',
            'mapPreviewTags',
            'referenceList',
            'bodyPartSummary',
            'exportOutput'
        ].forEach((id) => {
            this.elements[id] = this.document.getElementById(id);
        });

        this.decisionGraphEditor = new EnemyDecisionGraphEditor({
            document: this.document,
            root: this.elements.enemyDecisionPanel,
            templateList: this.elements.decisionTemplateList,
            skillList: this.elements.decisionSkillList,
            canvas: this.elements.decisionGraphCanvas,
            inspector: this.elements.decisionNodeInspector,
            issueList: this.elements.decisionGraphIssues,
            previewTrace: this.elements.decisionPreviewTrace,
            actions: {
                addState: this.elements.addDecisionStateBtn,
                addBranch: this.elements.addDecisionBranchBtn,
                addAction: this.elements.addDecisionGraphActionBtn,
                duplicateTemplate: this.elements.duplicateDecisionTemplateBtn,
                deleteTemplate: this.elements.deleteDecisionTemplateBtn,
                validate: this.elements.validateDecisionGraphBtn,
                preview: this.elements.previewDecisionGraphBtn
            }
        });

        this.bindClick('loadEnemyBtn', () => this.loadDefault());
        this.bindClick('refreshEnemyLibraryBtn', () => this.refreshEnemyLibraryFiles({ quiet: false }));
        this.bindClick('openSelectedEnemyLibraryBtn', () => this.loadSelectedEnemyLibrary());
        this.bindClick('saveDraftBtn', () => this.saveDraft());
        this.bindClick('publishEnemyBtn', () => this.publishRuntime());
        this.bindClick('createEnemyBtn', () => this.createEnemy());
        this.bindClick('duplicateEnemyBtn', () => this.duplicateEnemy());
        this.bindClick('deleteEnemyBtn', () => this.deleteEnemy());
        ['identity', 'stats', 'capabilities', 'enemyDecision', 'assets'].forEach((tabId) => {
            this.elements[`${tabId}Tab`]?.addEventListener('click', () => this.activateEditorTab(tabId));
        });
        this.bindClick('addCapabilityBtn', () => this.addCapabilityRow());
        this.elements.battleSpriteSelect?.addEventListener('change', () => {
            if (this.elements.battleSpriteRefInput) {
                this.elements.battleSpriteRefInput.value = this.elements.battleSpriteSelect.value || '';
            }
            const enemy = this.getCurrentEnemy();
            if (!enemy || !this.workspace) return;
            this.renderPreview({
                ...enemy,
                presentation: {
                    ...enemy.presentation,
                    battleSpriteRef: this.elements.battleSpriteSelect.value || ''
                }
            });
        });
        this.elements.enemyLibrarySelect?.addEventListener('change', () => {
            if (this.elements.enemyPathInput) {
                this.elements.enemyPathInput.value = this.elements.enemyLibrarySelect.value || '';
            }
        });
        this.refreshEnemyLibraryFiles?.({ quiet: true }).catch(() => {});
        this.activateEditorTab('identity');
    }

    bindClick(id, handler) {
        this.elements[id]?.addEventListener('click', () => {
            try {
                const result = handler();
                if (result && typeof result.then === 'function') {
                    result.catch(error => this.setStatus(`操作失败：${error.message}`));
                }
            } catch (error) {
                this.setStatus(`操作失败：${error.message}`);
            }
        });
    }

    setStatus(message) {
        this.statusVersion += 1;
        if (this.elements.status) this.elements.status.textContent = message;
    }

    setStatusIfUnchanged(message, version) {
        if (this.statusVersion !== version) return false;
        this.setStatus(message);
        return true;
    }

    activateEditorTab(tabId = 'identity') {
        ['identity', 'stats', 'capabilities', 'enemyDecision', 'assets'].forEach((id) => {
            const tab = this.elements[`${id}Tab`];
            const panel = this.elements[`${id}Panel`];
            const active = id === tabId;
            if (tab) {
                tab.classList?.toggle('active', active);
                tab.setAttribute?.('aria-selected', active ? 'true' : 'false');
            }
            if (panel) {
                if (active) {
                    panel.removeAttribute?.('hidden');
                    panel.hidden = false;
                } else {
                    panel.setAttribute?.('hidden', 'hidden');
                    panel.hidden = true;
                }
            }
        });
    }

    async loadDefault(options = {}) {
        if (typeof this.fetchImpl !== 'function') throw new Error('缺少 fetch 实现。');
        const path = options.preferRecent
            ? await this.resolveDefaultEnemyLibraryPath()
            : (this.elements.enemyPathInput?.value || this.defaultEnemyPath);
        const [enemyBody, skillDoc, levelsDocument, mapPackDocument] = await Promise.all([
            this.readProjectJson(path),
            this.readProjectJson(this.defaultSkillPath).catch(() => null),
            this.readProjectJson(this.defaultLevelPath).catch(() => null),
            this.readProjectJson(this.defaultMapPackPath).catch(() => null)
        ]);
        const rawDocument = JSON.parse(enemyBody.content);
        const mapPack = mapPackDocument ? JSON.parse(mapPackDocument.content) : {};
        this.loadDocument(rawDocument, {
            skillCatalog: skillDoc ? JSON.parse(skillDoc.content) : {},
            levelsDocument: levelsDocument ? JSON.parse(levelsDocument.content) : {},
            mapPack,
            assetCatalog: mapPack
        });
        this.setStatus(`已加载 ${enemyBody.path || path}`);
    }

    async resolveDefaultEnemyLibraryPath() {
        const files = await this.refreshEnemyLibraryFiles({ quiet: true });
        const recentAuthoring = files.find(isEnemyAuthoringPath);
        const selectedPath = recentAuthoring || files[0] || this.defaultEnemyPath;
        if (this.elements.enemyPathInput) this.elements.enemyPathInput.value = selectedPath;
        if (this.elements.enemyLibrarySelect) this.elements.enemyLibrarySelect.value = selectedPath;
        return selectedPath;
    }

    async readProjectJson(path) {
        const response = await this.fetchImpl(`/__skill_editor_file?path=${encodeURIComponent(path)}`, { cache: 'no-store' });
        if (!response?.ok) throw new Error(`加载失败：${response?.status || 'unknown'}`);
        return response.json();
    }

    async listProjectJsonSiblings(path) {
        if (typeof this.fetchImpl !== 'function') throw new Error('缺少 fetch 实现。');
        const response = await this.fetchImpl(`/__skill_editor_file?path=${encodeURIComponent(path)}&list=1`, { cache: 'no-store' });
        if (!response?.ok) throw new Error(`列表加载失败：${response?.status || 'unknown'}`);
        return response.json();
    }

    async refreshEnemyLibraryFiles(options = {}) {
        const quiet = Boolean(options.quiet);
        const statusVersion = this.statusVersion;
        const currentPath = normalizeEnemyLibraryPath(this.elements.enemyPathInput?.value || this.defaultEnemyPath);
        const found = new Set([this.defaultEnemyPath, currentPath].filter(Boolean));
        const listTargets = [
            this.defaultEnemyPath,
            'assets/enemy_packs/authoring/enemies.json'
        ];

        for (const target of listTargets) {
            try {
                const body = await this.listProjectJsonSiblings(target);
                asArray(body.files)
                    .map(normalizeEnemyLibraryPath)
                    .filter(isEnemyLibraryPath)
                    .forEach(filePath => found.add(filePath));
            } catch (error) {
                // Keep the explicitly known enemy paths usable even if a directory is absent.
            }
        }

        const files = [...found].filter(isEnemyLibraryPath).sort(sortEnemyLibraryPaths);
        this.renderEnemyLibraryOptions(files, currentPath);
        if (!quiet) {
            this.setStatusIfUnchanged(files.length ? `已刷新敌人库列表：${files.length} 个` : '未找到可打开的敌人库。', statusVersion);
        }
        return files;
    }

    renderEnemyLibraryOptions(files, selectedPath = '') {
        const select = this.elements.enemyLibrarySelect;
        if (!select) return;
        clearElement(select);
        files.forEach((filePath) => {
            const option = createElement(this.document, 'option');
            option.value = filePath;
            option.textContent = filePath;
            select.appendChild(option);
        });
        select.value = files.includes(selectedPath) ? selectedPath : (files[0] || '');
        if (this.elements.enemyPathInput && select.value) {
            this.elements.enemyPathInput.value = select.value;
        }
    }

    async loadSelectedEnemyLibrary() {
        const selectedPath = this.elements.enemyLibrarySelect?.value || this.elements.enemyPathInput?.value || this.defaultEnemyPath;
        if (this.elements.enemyPathInput) this.elements.enemyPathInput.value = selectedPath;
        return this.loadDefault();
    }

    loadDocument(rawDocument, context = {}) {
        this.context = context;
        this.workspace = this.workspaceFactory(rawDocument, context);
        this.selectedEnemyId = this.workspace.listEnemies()[0]?.id || null;
        this.renderAll();
        return this.workspace;
    }

    renderAll() {
        this.renderEnemyList();
        this.renderSelectedEnemy();
        this.renderIssues();
        this.renderExportOutput();
    }

    getCurrentEnemy() {
        if (!this.workspace || !this.selectedEnemyId) return null;
        return this.workspace.getEnemy(this.selectedEnemyId);
    }

    renderEnemyList() {
        const host = this.elements.enemyList;
        if (!host) return;
        clearElement(host);
        if (!this.workspace) {
            host.textContent = '尚未加载敌人库。';
            return;
        }
        this.workspace.listEnemies().forEach((enemy) => {
            const button = createElement(this.document, 'button', 'enemy-list-item');
            button.type = 'button';
            button.textContent = `${enemy.name} | ${enemy.id}`;
            button.dataset.enemyId = enemy.id;
            if (enemy.id === this.selectedEnemyId) button.setAttribute('aria-current', 'true');
            button.addEventListener('click', () => {
                this.syncCurrentEnemyFromForm();
                this.selectedEnemyId = enemy.id;
                this.renderAll();
            });
            host.appendChild(button);
        });
    }

    renderSelectedEnemy() {
        const enemy = this.getCurrentEnemy();
        if (!enemy) return;
        const setValue = (id, value) => {
            if (this.elements[id]) this.elements[id].value = value ?? '';
        };
        this.renderIdentityEnumControls(enemy);
        setValue('enemyIdInput', enemy.id);
        setValue('enemyNameInput', enemy.name);
        setValue('enemyDescriptionInput', enemy.description);
        setValue('enemyHpInput', enemy.stats.hp);
        setValue('enemyMaxHpInput', enemy.stats.maxHp);
        setValue('enemyApInput', enemy.stats.ap);
        setValue('enemySpeedInput', enemy.stats.speed);
        setValue('capabilitiesJsonInput', formatJson(enemy.capabilities, []));
        this.renderCapabilityList(enemy.capabilities);
        this.decisionGraphEditor?.setEnemy(enemy, {
            workspace: this.workspace,
            templates: this.workspace?.getDecisionGraphTemplates?.() || {}
        });
        setValue('portraitRefInput', enemy.presentation.portraitRef || '');
        setValue('mapPortraitRefInput', enemy.presentation.mapPortraitRef || '');
        setValue('battleSpriteRefInput', enemy.presentation.battleSpriteRef || '');
        setValue('iconRefInput', enemy.presentation.iconRef || '');
        setValue('skillListInput', enemy.skills.join('\n'));
        this.renderBattleSpriteOptions(enemy.presentation.battleSpriteRef || '');
        this.renderPreview(enemy);
    }

    getEnemyEnumValues(enumKey) {
        if (typeof this.workspace?.getEnumValues === 'function') {
            return this.workspace.getEnumValues(enumKey);
        }
        return [];
    }

    getEnemyEnumDescription(enumKey, enumValue) {
        if (typeof this.workspace?.getEnumDescription === 'function') {
            return this.workspace.getEnumDescription(enumKey, enumValue);
        }
        return '';
    }

    formatEnumOption(enumKey, value) {
        const description = this.getEnemyEnumDescription(enumKey, value);
        return description ? `${value} | ${description}` : value;
    }

    renderIdentityEnumControls(enemy) {
        renderSelectOptions(this.document, this.elements.enemyRaceInput, this.getEnemyEnumValues('races'), [enemy.race], {
            includeEmpty: true
        });
        renderSelectOptions(this.document, this.elements.enemyClassInput, this.getEnemyEnumValues('classes'), [enemy.class], {
            includeEmpty: true
        });
        renderSelectOptions(this.document, this.elements.enemyTagsInput, this.getEnemyEnumValues('tags'), enemy.tags);
    }

    describeToken(token) {
        const descriptions = {
            armor_attack: '护甲压制：攻击同时消耗护甲资源。',
            armor_phase: '护甲阶段：进入或维持护甲相关节奏。',
            attack: '普通攻击：稳定造成生命压力。',
            bind: '束缚：限制行动或制造低 AP 压力。',
            bleed: '流血：制造本场战斗内的持续掉血压力。',
            burst: '爆发：短窗口内的高伤害。',
            cash_out: '兑现：消耗标记或前置状态造成收益。',
            control: '控制：打断、限制或改变玩家节奏。',
            control_phase: '控制阶段：连续施加节奏限制。',
            counter: '反击：惩罚无准备进攻。',
            exposed: '暴露：给玩家反制窗口。',
            guard: '防御：降低玩家输出或保护关键目标。',
            heal: '治疗：延长战斗，检查爆发能力。',
            heavy_attack: '重击：高伤害，通常需要预判或防御。',
            lifesteal: '吸血：用伤害回复自身。',
            mark: '标记：设置后续兑现条件。',
            poison: '中毒：制造本场战斗内的持续掉血压力。',
            pressure: '施压：通用进攻或资源压力。',
            punish: '惩罚：针对错误节奏造成额外代价。',
            recover: '恢复：休整、降压或给玩家窗口。',
            repair: '修复：回血、修甲或清理负面状态。',
            setup: '准备：建立下一回合威胁。',
            slow: '迟缓：降低行动效率。',
            stance: '架势：进入反击、防御或特殊状态。',
            telegraph: '预兆：提前展示危险动作。',
            terminal: '终结：循环末端或处决动作。',
            vulnerable: '易伤：制造后续伤害窗口。'
        };
        return descriptions[token] || `${token}：未配置中文说明。`;
    }

    describeCounterplay(token) {
        const enumDescription = this.getEnemyEnumDescription('counterplay', token);
        if (enumDescription) return enumDescription;
        const descriptions = {
            armor: '叠甲承压',
            armor_up: '提前补甲',
            basic_guard: '基础防御',
            burst: '爆发击杀',
            burst_window: '抓爆发窗口',
            cleanse: '净化状态',
            fast_kill: '快速击杀',
            guard: '防御减伤',
            healing: '治疗续航',
            interrupt: '打断预兆',
            low_ap_actions: '低 AP 行动',
            low_ap_defense: '低 AP 防御',
            stable_output: '稳定输出'
        };
        return descriptions[token] || token;
    }

    describeCapabilityType(type) {
        const enumDescription = this.getEnemyEnumDescription('capabilityTypes', type);
        if (enumDescription) return enumDescription;
        const descriptions = {
            armor_break: '破甲：削弱玩家护甲，制造跨关护甲压力。',
            armor_repair: '修甲：恢复自身护甲，检查玩家持续输出。',
            basic_attack: '基础攻击：稳定制造生命压力。',
            bleed_apply: '流血施加：本场战斗内持续掉血。',
            counter_stance: '反击架势：惩罚无准备进攻。',
            high_damage: '高伤害：制造爆发防御检查。',
            lifesteal: '吸血：攻击后回复自身。',
            mark_and_cashout: '标记兑现：先设置状态，再集中结算伤害。',
            phase_shift: '阶段切换：改变战斗节奏或能力组。',
            poison_apply: '中毒施加：本场战斗内持续掉血。',
            self_cleanse: '自我净化：移除自身负面状态。',
            self_heal: '自我治疗：延长战斗，检查爆发窗口。',
            slow_or_bind: '减速/束缚：限制玩家行动效率。',
            support_aura: '支援光环：强化同伴或改变场面。',
            telegraph_countdown: '倒计时预兆：提前暴露高威胁动作。'
        };
        return descriptions[type] || `${type || '-'}：未配置中文说明。`;
    }

    describeCapabilityCadence(cadence) {
        return this.getEnemyEnumDescription('capabilityCadences', cadence)
            || `${cadence || '-'}：设计节奏标签，不是运行时触发器。`;
    }

    describeCapabilityPressure(pressure) {
        return this.getEnemyEnumDescription('capabilityPressures', pressure)
            || `${pressure || '-'}：设计压力分类。`;
    }

    updateCapabilityHelp(row) {
        const type = getChildByDataset(row, 'capabilityField', 'type')?.value || '';
        const counterplay = readCheckedValues(getChildByDataset(row, 'capabilityField', 'counterplay'));
        const cadence = getChildByDataset(row, 'capabilityField', 'cadence')?.value || '';
        const pressure = getChildByDataset(row, 'capabilityField', 'pressure')?.value || '';
        const help = getChildByDataset(row, 'capabilityField', 'description');
        if (!help) return;
        const counters = counterplay.length
            ? counterplay.map(item => `${item}=${this.describeCounterplay(item)}`).join(' / ')
            : 'none';
        help.textContent = `${this.describeCapabilityType(type)} Cadence: ${this.describeCapabilityCadence(cadence)} Pressure: ${this.describeCapabilityPressure(pressure)} Counterplay: ${counters}`;
        if (!row.nodeType) {
            row.textContent = Array.from(row.children || []).map(child => child.textContent || '').join('\n');
        }
        if (row.parentNode && !row.parentNode.nodeType) {
            row.parentNode.textContent = Array.from(row.parentNode.children || []).map(child => child.textContent || '').join('\n');
        }
    }

    renderCapabilityList(capabilities = []) {
        const host = this.elements.capabilityList;
        if (!host) return;
        clearElement(host);
        asArray(capabilities).forEach((capability) => this.addCapabilityRow(capability));
    }

    addCapabilityRow(capability = {}) {
        const host = this.elements.capabilityList;
        if (!host) return null;
        const row = createElement(this.document, 'div', 'capability-row');
        const type = createElement(this.document, 'select');
        type.dataset.capabilityField = 'type';
        renderSelectOptions(this.document, type, this.getEnemyEnumValues('capabilityTypes'), [capability.type || ''], {
            includeEmpty: true,
            labelFormatter: value => this.formatEnumOption('capabilityTypes', value)
        });

        const cadence = createElement(this.document, 'select');
        cadence.dataset.capabilityField = 'cadence';
        renderSelectOptions(this.document, cadence, this.getEnemyEnumValues('capabilityCadences'), [capability.cadence || ''], {
            includeEmpty: true,
            labelFormatter: value => this.formatEnumOption('capabilityCadences', value)
        });

        const pressure = createElement(this.document, 'select');
        pressure.dataset.capabilityField = 'pressure';
        renderSelectOptions(this.document, pressure, this.getEnemyEnumValues('capabilityPressures'), [capability.pressure || ''], {
            includeEmpty: true,
            labelFormatter: value => this.formatEnumOption('capabilityPressures', value)
        });

        const counterplay = createElement(this.document, 'div', 'check-chip-group');
        counterplay.dataset.capabilityField = 'counterplay';
        const selectedCounterplay = new Set(asArray(capability.counterplay));
        this.getEnemyEnumValues('counterplay').forEach((value) => {
            const chip = createElement(this.document, 'label', 'check-chip');
            const checkbox = createElement(this.document, 'input');
            checkbox.type = 'checkbox';
            checkbox.value = value;
            checkbox.checked = selectedCounterplay.has(value);
            const text = createElement(this.document, 'span');
            text.textContent = `${value} | ${this.describeCounterplay(value)}`;
            chip.appendChild(checkbox);
            chip.appendChild(text);
            counterplay.appendChild(chip);
        });
        counterplay.title = asArray(capability.counterplay).map(item => this.describeCounterplay(item)).join(' / ');

        const help = createElement(this.document, 'div', 'capability-help');
        help.dataset.capabilityField = 'description';

        const remove = createElement(this.document, 'button', 'secondary');
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.addEventListener('click', () => {
            row.remove?.();
            if (!row.parentNode && host.children.includes?.(row)) {
                host.children = host.children.filter(child => child !== row);
            }
        });

        row.appendChild(createLabeledControl(this.document, '能力类型', type));
        row.appendChild(createLabeledControl(this.document, '设计节奏（非运行时触发）', cadence));
        row.appendChild(createLabeledControl(this.document, '压力分类（诊断）', pressure));
        row.appendChild(createLabeledControl(this.document, '玩家反制方式', counterplay));
        row.appendChild(remove);
        row.appendChild(help);
        [type, cadence, pressure, ...Array.from(counterplay.children || []).map(chip => Array.from(chip.children || []).find(item => item.tagName === 'INPUT'))].forEach((input) => {
            input.addEventListener('input', () => this.updateCapabilityHelp(row));
            input.addEventListener('change', () => this.updateCapabilityHelp(row));
        });
        host.appendChild(row);
        this.updateCapabilityHelp(row);
        return row;
    }

    readCapabilityList() {
        return Array.from(this.elements.capabilityList?.children || [])
            .map((row) => ({
                type: getChildByDataset(row, 'capabilityField', 'type')?.value || '',
                cadence: getChildByDataset(row, 'capabilityField', 'cadence')?.value || '',
                pressure: getChildByDataset(row, 'capabilityField', 'pressure')?.value || '',
                counterplay: readCheckedValues(getChildByDataset(row, 'capabilityField', 'counterplay'))
            }))
            .filter(item => item.type || item.cadence || item.pressure || item.counterplay.length);
    }

    renderBattleSpriteOptions(selectedRef = '') {
        const select = this.elements.battleSpriteSelect;
        if (!select) return;
        clearElement(select);

        const emptyOption = createElement(this.document, 'option');
        emptyOption.value = '';
        emptyOption.textContent = '未选择原画';
        select.appendChild(emptyOption);

        const assets = typeof this.workspace?.listCharacterSpriteAssets === 'function'
            ? this.workspace.listCharacterSpriteAssets()
            : [];
        assets.forEach((asset) => {
            const option = createElement(this.document, 'option');
            option.value = asset.id;
            option.textContent = asset.label || asset.id;
            select.appendChild(option);
        });
        select.value = selectedRef || '';
    }

    renderPreview(enemy) {
        const summary = this.workspace.buildCatalogEntry(enemy.id);
        const basePresentation = summary.presentationSummary;
        const draftSpriteRef = asObject(enemy.presentation).battleSpriteRef || '';
        const draftSprite = draftSpriteRef ? this.workspace.resolveAsset(draftSpriteRef) : null;
        const presentation = {
            ...basePresentation,
            battleSpriteRef: draftSpriteRef,
            resolvedBattleSpriteRef: draftSprite?.id || draftSpriteRef,
            resolvedBattleSpriteSrc: draftSprite?.src || ''
        };
        const mapSrc = presentation.resolvedMapPortraitSrc;
        const artSrc = presentation.resolvedBattleSpriteSrc;
        if (this.elements.mapPreviewName) this.elements.mapPreviewName.textContent = enemy.name;
        if (this.elements.mapPreviewId) this.elements.mapPreviewId.textContent = `templateId: ${enemy.id}`;
        if (this.elements.mapPreviewPortrait) {
            if (mapSrc) {
                this.elements.mapPreviewPortrait.setAttribute('src', mapSrc);
                this.elements.mapPreviewPortrait.removeAttribute?.('hidden');
            } else {
                this.elements.mapPreviewPortrait.removeAttribute?.('src');
                this.elements.mapPreviewPortrait.setAttribute?.('hidden', 'hidden');
            }
        }
        if (this.elements.artPreviewPortrait) {
            if (artSrc) {
                this.elements.artPreviewPortrait.setAttribute('src', artSrc);
                this.elements.artPreviewPortrait.removeAttribute?.('hidden');
            } else {
                this.elements.artPreviewPortrait.removeAttribute?.('src');
                this.elements.artPreviewPortrait.setAttribute?.('hidden', 'hidden');
            }
        }
        if (this.elements.artPreviewState) {
            this.elements.artPreviewState.textContent = artSrc
                ? `${presentation.resolvedBattleSpriteRef || ''} · ${artSrc}`
                : '未绑定完整原画';
        }
        if (this.elements.mapPreviewStats) {
            this.elements.mapPreviewStats.textContent = `HP ${enemy.stats.hp}/${enemy.stats.maxHp} · AP ${enemy.stats.ap} · SPD ${enemy.stats.speed}`;
        }
        if (this.elements.mapPreviewTags) {
            this.elements.mapPreviewTags.textContent = [enemy.race, enemy.class, ...enemy.skills].filter(Boolean).join(' / ');
        }
        if (this.elements.referenceList) {
            const refs = this.workspace.getLevelReferences(enemy.id);
            this.elements.referenceList.textContent = refs.length
                ? refs.map(ref => `${ref.poolId}@${ref.position ?? '-'}`).join('\n')
                : '未被关卡敌人池引用。';
        }
        if (this.elements.bodyPartSummary) {
            this.elements.bodyPartSummary.textContent = summary.bodyPartSummary
                .map(part => `${part.part} ${part.current}/${part.max} weak ${part.weakness}`)
                .join('\n');
        }
    }

    buildCurrentEnemyFromForm(enemy) {
        const baseEnemy = asObject(enemy);
        let capabilities = enemy.capabilities;
        try {
            const capabilityJsonChanged = String(this.elements.capabilitiesJsonInput?.value || '').trim()
                !== formatJson(enemy.capabilities, []).trim();
            capabilities = capabilityJsonChanged
                ? parseJsonField(this.elements.capabilitiesJsonInput?.value, [])
                : this.readCapabilityList();
        } catch (error) {
            this.setStatus(`设计 JSON 解析失败：${error.message}`);
        }

        const skills = splitTextList(this.elements.skillListInput?.value || '');
        return {
            ...baseEnemy,
            name: this.elements.enemyNameInput?.value || enemy.name,
            race: readSelectValues(this.elements.enemyRaceInput)[0] || '',
            class: readSelectValues(this.elements.enemyClassInput)[0] || '',
            tags: this.elements.enemyTagsInput?.multiple
                ? readSelectValues(this.elements.enemyTagsInput)
                : splitTextList(this.elements.enemyTagsInput?.value || ''),
            description: this.elements.enemyDescriptionInput?.value || '',
            stats: {
                hp: toNumber(this.elements.enemyHpInput?.value, enemy.stats.hp),
                maxHp: toNumber(this.elements.enemyMaxHpInput?.value, enemy.stats.maxHp),
                ap: toNumber(this.elements.enemyApInput?.value, enemy.stats.ap),
                speed: toNumber(this.elements.enemySpeedInput?.value, enemy.stats.speed)
            },
            presentation: {
                ...asObject(enemy.presentation),
                portraitRef: this.elements.portraitRefInput?.value || '',
                mapPortraitRef: this.elements.mapPortraitRefInput?.value || '',
                battleSpriteRef: this.elements.battleSpriteSelect?.value || this.elements.battleSpriteRefInput?.value || '',
                iconRef: this.elements.iconRefInput?.value || ''
            },
            skills,
            capabilities: asArray(capabilities),
            enemyDecision: this.decisionGraphEditor?.getDecision() || enemy.enemyDecision
        };
    }

    syncCurrentEnemyFromForm() {
        const enemy = this.getCurrentEnemy();
        if (!enemy) return null;
        const nextEnemy = this.buildCurrentEnemyFromForm(enemy);
        this.workspace.updateEnemy(enemy.id, nextEnemy);
        return this.workspace.getEnemy(enemy.id);
    }

    saveCurrentEnemy() {
        const nextEnemy = this.syncCurrentEnemyFromForm();
        if (!nextEnemy) return null;
        this.renderAll();
        this.setStatus(`已保存当前敌人：${nextEnemy.name}`);
        return nextEnemy;
    }

    createEnemy() {
        if (!this.workspace) return null;
        this.syncCurrentEnemyFromForm();
        this.selectedEnemyId = this.workspace.createEnemy({ id: 'enemy_new', name: '新敌人' });
        this.renderAll();
        return this.selectedEnemyId;
    }

    duplicateEnemy() {
        this.syncCurrentEnemyFromForm();
        const enemy = this.getCurrentEnemy();
        if (!enemy) return null;
        const newId = this.workspace.createEnemy({ id: enemy.id, name: `${enemy.name} 副本`, race: enemy.race, class: enemy.class });
        this.workspace.updateEnemy(newId, current => ({
            ...enemy,
            ...current,
            id: newId,
            name: `${enemy.name} 副本`
        }));
        this.selectedEnemyId = newId;
        this.renderAll();
        return newId;
    }

    deleteEnemy() {
        if (!this.workspace || !this.selectedEnemyId) return false;
        this.syncCurrentEnemyFromForm();
        this.workspace.removeEnemy(this.selectedEnemyId);
        this.selectedEnemyId = this.workspace.listEnemies()[0]?.id || null;
        this.renderAll();
        return true;
    }

    renderIssues() {
        const host = this.elements.issueList;
        if (!host) return;
        if (!this.workspace) {
            host.textContent = '尚未加载敌人库。';
            return;
        }
        const issues = this.workspace.validateDocument();
        host.textContent = issues.length
            ? issues.map(issue => `${issue.severity}: ${issue.code} ${issue.enemyId || ''} ${issue.fieldPath || ''}`).join('\n')
            : '未发现问题。';
    }

    renderExportOutput() {
        if (!this.elements.exportOutput) return;
        this.elements.exportOutput.value = this.workspace
            ? JSON.stringify(this.workspace.exportDocument(), null, 2)
            : '';
    }

    buildExportContent() {
        if (!this.workspace) throw new Error('尚未加载敌人库。');
        this.syncCurrentEnemyFromForm();
        return JSON.stringify(this.workspace.exportDocument(), null, 2);
    }

    async writeProjectJson(path, content) {
        if (typeof this.fetchImpl !== 'function') throw new Error('缺少 fetch 实现。');
        const response = await this.fetchImpl('/__skill_editor_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content })
        });
        if (!response?.ok) throw new Error(`写入失败：${response?.status || 'unknown'}`);
        return response.json();
    }

    async saveDraft() {
        const content = this.buildExportContent();
        const result = await this.writeProjectJson(buildEnemyAuthoringPath(), content);
        this.setStatus(`已保存工作稿：${result.path}`);
        return result;
    }

    async publishRuntime() {
        const content = this.buildExportContent();
        const result = await this.writeProjectJson(runtimeEnemyPath, content);
        this.setStatus(`已发布敌人包：${result.path}`);
        return result;
    }
}

export { buildEnemyAuthoringPath };
export default EnemyEditorPage;
