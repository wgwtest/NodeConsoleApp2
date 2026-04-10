function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function toFiniteNumber(value, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

function splitTextList(value) {
    if (typeof value !== 'string') return [];
    return value
        .split(/[\n,，]/u)
        .map(item => item.trim())
        .filter(Boolean);
}

function parseEnemyMembersText(value) {
    return String(value || '')
        .split('\n')
        .map(item => item.trim())
        .filter(Boolean)
        .map((line, index) => {
            const [templateIdRaw, positionRaw] = line.split('@');
            return {
                templateId: String(templateIdRaw || '').trim(),
                position: toFiniteNumber(positionRaw, index + 1)
            };
        })
        .filter(member => member.templateId);
}

function formatEnemyMembersText(members) {
    return asArray(members)
        .map(member => `${member.templateId || ''}@${member.position ?? ''}`)
        .join('\n');
}

function createElement(doc, tagName, className = '') {
    const element = doc.createElement(tagName);
    if (className) {
        element.className = className;
    }
    return element;
}

export class LevelEditorPage {
    constructor(options = {}) {
        this.document = options.document || globalThis.document;
        this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
        this.workspaceFactory = options.workspaceFactory;
        this.defaultSourceUrl = options.defaultSourceUrl || '../assets/data/levels.json';
        this.overrideStore = options.overrideStore || {
            get() { return null; },
            set() { return null; },
            clear() { return true; }
        };
        this.createObjectURL = options.createObjectURL || (blob => globalThis.URL?.createObjectURL(blob));
        this.revokeObjectURL = options.revokeObjectURL || (url => globalThis.URL?.revokeObjectURL(url));

        this.workspace = null;
        this.selectedLevelId = null;
        this.selectedWaveIndex = 0;
        this.lastExportedDocument = null;
        this.elements = {};
    }

    bind() {
        const ids = [
            'status',
            'loadDefaultBtn',
            'addLevelBtn',
            'removeLevelBtn',
            'saveLevelBtn',
            'addWaveBtn',
            'removeWaveBtn',
            'saveWaveBtn',
            'exportBtn',
            'downloadBtn',
            'applyOverrideBtn',
            'clearOverrideBtn',
            'levelList',
            'validationList',
            'selectedLevelId',
            'levelIdInput',
            'levelNameInput',
            'levelDescriptionInput',
            'levelKindSelect',
            'levelOrderInput',
            'chapterIdInput',
            'chapterOrderInput',
            'chapterLabelInput',
            'chapterTitleInput',
            'nodeLabelInput',
            'objectiveTextInput',
            'nextLevelList',
            'backgroundInput',
            'slotLayoutIdInput',
            'difficultyLabelInput',
            'enemyStyleTagsInput',
            'buildHintInput',
            'rewardExpInput',
            'rewardGoldInput',
            'rewardKpInput',
            'waveList',
            'selectedWaveId',
            'waveIdInput',
            'waveTypeInput',
            'waveEnemyPoolIdInput',
            'enemyPoolNameInput',
            'enemyMembersInput',
            'exportOutput',
            'overrideStatus'
        ];

        ids.forEach((id) => {
            this.elements[id] = this.document.getElementById(id);
        });

        this.bindAction('loadDefaultBtn', () => this.loadDefaultPack());
        this.bindAction('addLevelBtn', () => this.addLevel());
        this.bindAction('removeLevelBtn', () => this.removeSelectedLevel());
        this.bindAction('saveLevelBtn', () => this.saveCurrentLevel());
        this.bindAction('addWaveBtn', () => this.addWave());
        this.bindAction('removeWaveBtn', () => this.removeSelectedWave());
        this.bindAction('saveWaveBtn', () => this.saveSelectedWave());
        this.bindAction('exportBtn', () => this.exportCurrentPack());
        this.bindAction('downloadBtn', () => this.downloadCurrentPack());
        this.bindAction('applyOverrideBtn', () => this.applyRuntimeOverride());
        this.bindAction('clearOverrideBtn', () => this.clearRuntimeOverride());
    }

    bindAction(id, handler) {
        this.elements[id]?.addEventListener('click', () => {
            try {
                const result = handler();
                if (result && typeof result.then === 'function') {
                    result.catch((error) => {
                        this.setStatus(`操作失败：${error.message}`);
                    });
                }
            } catch (error) {
                this.setStatus(`操作失败：${error.message}`);
            }
        });
    }

    async loadDefaultPack() {
        if (typeof this.fetchImpl !== 'function') {
            throw new Error('缺少 fetch 实现，无法加载默认关卡包。');
        }

        this.setStatus('正在加载默认关卡包...');
        const response = await this.fetchImpl(this.defaultSourceUrl, { cache: 'no-store' });
        if (!response || !response.ok) {
            throw new Error(`加载失败: ${response?.status || 'unknown'}`);
        }

        const rawDocument = await response.json();
        this.loadDocument(rawDocument);
        this.setStatus(`已从 ${this.defaultSourceUrl} 加载关卡包。`);
    }

    loadDocument(rawDocument) {
        if (typeof this.workspaceFactory !== 'function') {
            throw new Error('缺少 workspaceFactory，无法创建关卡编辑工作区。');
        }

        this.workspace = this.workspaceFactory(rawDocument);
        this.lastExportedDocument = null;
        const firstLevel = this.workspace.listLevels()[0] || null;
        this.selectedLevelId = firstLevel?.id || null;
        this.selectedWaveIndex = 0;
        this.renderAll();
        return this.workspace;
    }

    renderAll() {
        this.renderLevelList();
        this.renderValidationPanel();
        this.renderSelectedLevel();
        this.renderExportOutput();
    }

    getCurrentLevel() {
        if (!this.workspace || !this.selectedLevelId) return null;
        return this.workspace.getLevel(this.selectedLevelId);
    }

    getCurrentWave(level = null) {
        const currentLevel = level || this.getCurrentLevel();
        if (!currentLevel) return null;
        return asArray(currentLevel.waves)[this.selectedWaveIndex] || null;
    }

    getCurrentEnemyPool(wave = null) {
        if (!this.workspace) return null;
        const currentWave = wave || this.getCurrentWave();
        if (!currentWave?.enemyPoolId) return null;
        return this.workspace.getEnemyPool(currentWave.enemyPoolId);
    }

    renderLevelList() {
        const host = this.elements.levelList;
        if (!host) return;
        host.innerHTML = '';

        if (!this.workspace) {
            host.textContent = '尚未加载关卡包。';
            return;
        }

        this.workspace.listLevels().forEach((level) => {
            const button = createElement(this.document, 'button', 'level-list-item');
            button.type = 'button';
            button.dataset.levelId = level.id;
            button.textContent = `${level.id} | ${level.name} | ${level.flow.kind}`;
            if (level.id === this.selectedLevelId) {
                button.setAttribute('aria-current', 'true');
            }
            button.addEventListener('click', () => {
                this.selectedLevelId = level.id;
                this.selectedWaveIndex = 0;
                this.renderAll();
            });
            host.appendChild(button);
        });
    }

    renderValidationPanel() {
        const host = this.elements.validationList;
        if (!host) return;
        host.innerHTML = '';

        if (!this.workspace) {
            host.textContent = '尚未加载关卡包。';
            return;
        }

        const issues = this.workspace.validateDocument();
        if (!issues.length) {
            host.textContent = '未发现结构问题。';
            return;
        }

        const list = createElement(this.document, 'ul', 'validation-issues');
        issues.forEach((issue) => {
            const item = createElement(this.document, 'li');
            if (issue.code === 'missing_next_level') {
                item.textContent = `${issue.levelId} 指向了不存在的下一关 ${issue.nextLevelId}`;
            } else if (issue.code === 'missing_enemy_pool') {
                item.textContent = `${issue.levelId}/${issue.waveId} 引用了不存在的敌人池 ${issue.enemyPoolId}`;
            } else {
                item.textContent = JSON.stringify(issue);
            }
            list.appendChild(item);
        });
        host.appendChild(list);
    }

    renderSelectedLevel() {
        const level = this.getCurrentLevel();
        this.setValue('selectedLevelId', level ? `当前关卡：${level.id}` : '当前关卡：-');
        this.setValue('levelIdInput', level?.id || '');
        this.setValue('levelNameInput', level?.name || '');
        this.setValue('levelDescriptionInput', level?.description || '');
        this.setValue('levelKindSelect', level?.flow?.kind || 'story');
        this.setValue('levelOrderInput', level?.flow?.order ?? 0);
        this.setValue('chapterIdInput', level?.flow?.chapterId || '');
        this.setValue('chapterOrderInput', level?.flow?.chapterOrder ?? 1);
        this.setValue('chapterLabelInput', level?.flow?.chapterLabel || '');
        this.setValue('chapterTitleInput', level?.flow?.chapterTitle || '');
        this.setValue('nodeLabelInput', level?.flow?.nodeLabel || '');
        this.setValue('objectiveTextInput', level?.flow?.objectiveText || '');
        this.setValue('backgroundInput', level?.background || '');
        this.setValue('slotLayoutIdInput', level?.battleRules?.slotLayoutId || '');
        this.setValue('difficultyLabelInput', level?.selectionMeta?.difficultyLabel || '');
        this.setValue('enemyStyleTagsInput', asArray(level?.selectionMeta?.enemyStyleTags).join(', '));
        this.setValue('buildHintInput', level?.selectionMeta?.buildHint || '');
        this.setValue('rewardExpInput', level?.rewards?.exp ?? 0);
        this.setValue('rewardGoldInput', level?.rewards?.gold ?? 0);
        this.setValue('rewardKpInput', level?.rewards?.kp ?? 0);
        this.renderNextLevelList(level);
        this.renderWaveList(level);
        this.renderSelectedWave(level);
    }

    renderNextLevelList(level) {
        const host = this.elements.nextLevelList;
        if (!host) return;
        host.innerHTML = '';

        if (!this.workspace || !level) {
            host.textContent = '尚未选择关卡。';
            return;
        }

        if (level.flow.kind !== 'story') {
            host.textContent = '非 story 关卡无需维护 nextLevelIds。';
            return;
        }

        const storyLevels = this.workspace.listLevels({ kind: 'story' }).filter(item => item.id !== level.id);
        const currentNext = new Set(asArray(level.flow.nextLevelIds));
        if (!storyLevels.length) {
            host.textContent = '当前没有可连接的其他 story 关卡。';
            return;
        }

        storyLevels.forEach((candidate) => {
            const label = createElement(this.document, 'label', 'next-level-option');
            const checkbox = createElement(this.document, 'input');
            checkbox.type = 'checkbox';
            checkbox.value = candidate.id;
            checkbox.checked = currentNext.has(candidate.id);
            label.appendChild(checkbox);
            label.appendChild(this.document.createTextNode(` ${candidate.id} | ${candidate.name}`));
            host.appendChild(label);
        });
    }

    renderWaveList(level = null) {
        const host = this.elements.waveList;
        if (!host) return;
        host.innerHTML = '';

        const currentLevel = level || this.getCurrentLevel();
        if (!currentLevel) {
            host.textContent = '尚未选择关卡。';
            return;
        }

        asArray(currentLevel.waves).forEach((wave, index) => {
            const button = createElement(this.document, 'button', 'wave-list-item');
            button.type = 'button';
            button.textContent = `${wave.waveId} | ${wave.waveType} | ${wave.enemyPoolId}`;
            if (index === this.selectedWaveIndex) {
                button.setAttribute('aria-current', 'true');
            }
            button.addEventListener('click', () => {
                this.selectedWaveIndex = index;
                this.renderSelectedWave();
                this.renderWaveList();
            });
            host.appendChild(button);
        });
    }

    renderSelectedWave(level = null) {
        const currentLevel = level || this.getCurrentLevel();
        const currentWave = this.getCurrentWave(currentLevel);
        const currentPool = this.getCurrentEnemyPool(currentWave);

        this.setValue('selectedWaveId', currentWave ? `当前波次：${currentWave.waveId}` : '当前波次：-');
        this.setValue('waveIdInput', currentWave?.waveId || '');
        this.setValue('waveTypeInput', currentWave?.waveType || '');
        this.setValue('waveEnemyPoolIdInput', currentWave?.enemyPoolId || '');
        this.setValue('enemyPoolNameInput', currentPool?.name || '');
        this.setValue('enemyMembersInput', formatEnemyMembersText(currentPool?.members || []));
    }

    saveCurrentLevel() {
        const level = this.getCurrentLevel();
        if (!this.workspace || !level) return null;

        const kind = this.elements.levelKindSelect?.value || level.flow.kind || 'story';
        const nextLevelIds = this.collectCheckedNextLevelIds();
        const nextLevel = {
            ...level,
            name: this.elements.levelNameInput?.value?.trim() || level.name,
            description: this.elements.levelDescriptionInput?.value || '',
            flow: {
                ...level.flow,
                kind,
                order: toFiniteNumber(this.elements.levelOrderInput?.value, level.flow.order ?? 0)
            },
            background: this.elements.backgroundInput?.value?.trim() || '',
            battleRules: {
                ...asObject(level.battleRules),
                slotLayoutId: this.elements.slotLayoutIdInput?.value?.trim() || ''
            },
            selectionMeta: {
                difficultyLabel: this.elements.difficultyLabelInput?.value || '',
                enemyStyleTags: splitTextList(this.elements.enemyStyleTagsInput?.value || ''),
                buildHint: this.elements.buildHintInput?.value || ''
            },
            rewards: {
                exp: toFiniteNumber(this.elements.rewardExpInput?.value, 0),
                gold: toFiniteNumber(this.elements.rewardGoldInput?.value, 0),
                kp: toFiniteNumber(this.elements.rewardKpInput?.value, 0)
            }
        };

        if (kind === 'story') {
            nextLevel.flow.chapterId = this.elements.chapterIdInput?.value?.trim() || '';
            nextLevel.flow.chapterOrder = toFiniteNumber(this.elements.chapterOrderInput?.value, 1);
            nextLevel.flow.chapterLabel = this.elements.chapterLabelInput?.value || '';
            nextLevel.flow.chapterTitle = this.elements.chapterTitleInput?.value || '';
            nextLevel.flow.nodeLabel = this.elements.nodeLabelInput?.value || '';
            nextLevel.flow.objectiveText = this.elements.objectiveTextInput?.value || '';
            nextLevel.flow.nextLevelIds = nextLevelIds;
        } else {
            delete nextLevel.flow.chapterId;
            delete nextLevel.flow.chapterOrder;
            delete nextLevel.flow.chapterLabel;
            delete nextLevel.flow.chapterTitle;
            delete nextLevel.flow.nodeLabel;
            delete nextLevel.flow.objectiveText;
            delete nextLevel.flow.nextLevelIds;
        }

        this.workspace.updateLevel(level.id, nextLevel);
        this.lastExportedDocument = null;
        this.setStatus(`已保存关卡 ${level.id}。`);
        this.renderAll();
        return this.getCurrentLevel();
    }

    collectCheckedNextLevelIds() {
        return Array.from(this.elements.nextLevelList?.querySelectorAll('input[type="checkbox"]') || [])
            .filter(input => input.checked)
            .map(input => input.value);
    }

    saveSelectedWave() {
        const level = this.getCurrentLevel();
        const wave = this.getCurrentWave(level);
        if (!this.workspace || !level || !wave) return null;

        const nextPoolId = this.elements.waveEnemyPoolIdInput?.value?.trim() || wave.enemyPoolId;
        const nextPool = {
            id: nextPoolId,
            name: this.elements.enemyPoolNameInput?.value?.trim() || nextPoolId,
            members: parseEnemyMembersText(this.elements.enemyMembersInput?.value || '')
        };

        const existingPool = this.workspace.getEnemyPool(nextPoolId);
        if (existingPool) {
            this.workspace.replaceEnemyPool(nextPoolId, nextPool);
        } else {
            this.workspace.upsertEnemyPool(nextPoolId, nextPool);
        }

        const nextWaves = asArray(level.waves).map((item, index) => (
            index === this.selectedWaveIndex
                ? {
                    ...item,
                    waveId: this.elements.waveIdInput?.value?.trim() || item.waveId,
                    waveType: this.elements.waveTypeInput?.value?.trim() || item.waveType,
                    enemyPoolId: nextPoolId
                }
                : item
        ));

        this.workspace.updateLevel(level.id, {
            ...level,
            waves: nextWaves
        });
        this.lastExportedDocument = null;
        this.setStatus(`已保存 ${level.id} 的波次与敌人池。`);
        this.renderAll();
        return this.getCurrentWave();
    }

    addLevel() {
        if (!this.workspace) return null;
        const newLevelId = this.workspace.createLevel({
            kind: 'story',
            chapterId: this.getCurrentLevel()?.flow?.chapterId || 'story_chapter_1',
            chapterTitle: this.getCurrentLevel()?.flow?.chapterTitle || '未命名章节'
        });
        this.selectedLevelId = newLevelId;
        this.selectedWaveIndex = 0;
        this.lastExportedDocument = null;
        this.setStatus(`已创建关卡 ${newLevelId}。`);
        this.renderAll();
        return this.getCurrentLevel();
    }

    removeSelectedLevel() {
        const level = this.getCurrentLevel();
        if (!this.workspace || !level) return false;
        this.workspace.removeLevel(level.id);
        const nextLevel = this.workspace.listLevels()[0] || null;
        this.selectedLevelId = nextLevel?.id || null;
        this.selectedWaveIndex = 0;
        this.lastExportedDocument = null;
        this.setStatus(`已删除关卡 ${level.id}。`);
        this.renderAll();
        return true;
    }

    addWave() {
        const level = this.getCurrentLevel();
        if (!this.workspace || !level) return null;
        const nextIndex = asArray(level.waves).length;
        const nextWaveNumber = nextIndex + 1;
        const enemyPoolId = this.workspace.createUniqueEnemyPoolId(`pool_${level.id}_wave_${nextWaveNumber}`);
        this.workspace.upsertEnemyPool(enemyPoolId, {
            name: `${level.name} Wave ${nextWaveNumber} 敌人池`,
            members: []
        });
        this.workspace.updateLevel(level.id, {
            ...level,
            waves: [
                ...asArray(level.waves),
                {
                    waveId: `wave_${nextWaveNumber}`,
                    waveType: this.workspace.meta?.enums?.waveTypes?.[0] || 'fixed',
                    enemyPoolId
                }
            ]
        });
        this.selectedWaveIndex = nextIndex;
        this.lastExportedDocument = null;
        this.setStatus(`已为 ${level.id} 新增 wave_${nextWaveNumber}。`);
        this.renderAll();
        return this.getCurrentWave();
    }

    removeSelectedWave() {
        const level = this.getCurrentLevel();
        const wave = this.getCurrentWave(level);
        if (!this.workspace || !level || !wave) return false;

        const waves = asArray(level.waves);
        if (waves.length <= 1) {
            this.setStatus('每个关卡至少保留一个波次。');
            return false;
        }

        const nextWaves = waves.filter((_, index) => index !== this.selectedWaveIndex);
        this.workspace.updateLevel(level.id, {
            ...level,
            waves: nextWaves
        });
        if (!this.workspace.isEnemyPoolReferenced(wave.enemyPoolId)) {
            delete this.workspace.enemyPools[wave.enemyPoolId];
        }
        this.selectedWaveIndex = Math.max(0, this.selectedWaveIndex - 1);
        this.lastExportedDocument = null;
        this.setStatus(`已删除 ${level.id} 的波次 ${wave.waveId}。`);
        this.renderAll();
        return true;
    }

    exportCurrentPack() {
        if (!this.workspace) return null;
        this.lastExportedDocument = this.workspace.exportDocument();
        this.renderExportOutput();
        this.setStatus('已生成当前关卡包 JSON。');
        return clone(this.lastExportedDocument);
    }

    renderExportOutput() {
        if (!this.elements.exportOutput) return;
        const payload = this.lastExportedDocument || (this.workspace ? this.workspace.exportDocument() : null);
        this.elements.exportOutput.value = payload ? JSON.stringify(payload, null, 2) : '';
    }

    downloadCurrentPack() {
        const payload = this.exportCurrentPack();
        if (!payload) return null;
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const objectUrl = this.createObjectURL(blob);
        const anchor = createElement(this.document, 'a');
        anchor.href = objectUrl;
        anchor.download = 'levels.editor.export.json';
        anchor.click();
        this.revokeObjectURL(objectUrl);
        return objectUrl;
    }

    applyRuntimeOverride() {
        const payload = this.exportCurrentPack();
        if (!payload) return null;
        const stored = this.overrideStore.set('levels', payload);
        this.setOverrideStatus(`Runtime override active. contentKey=levels, selected=${this.selectedLevelId || '-'}`);
        return stored;
    }

    clearRuntimeOverride() {
        this.overrideStore.clear('levels');
        this.setOverrideStatus('Runtime override cleared. contentKey=levels');
        return true;
    }

    setValue(id, value) {
        const element = this.elements[id];
        if (!element) return;
        if ('value' in element) {
            element.value = value ?? '';
            return;
        }
        element.textContent = value ?? '';
    }

    setStatus(text) {
        if (this.elements.status) {
            this.elements.status.textContent = text;
        }
    }

    setOverrideStatus(text) {
        if (this.elements.overrideStatus) {
            this.elements.overrideStatus.textContent = text;
        }
    }
}

export default LevelEditorPage;
