import EnemyWorkspace from './EnemyWorkspace.js';

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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

export class EnemyEditorPage {
    constructor(options = {}) {
        this.document = options.document || globalThis.document;
        this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
        this.workspaceFactory = options.workspaceFactory || ((raw, context) => new EnemyWorkspace(raw, context));
        this.defaultEnemyPath = options.defaultEnemyPath || 'assets/data/enemies.json';
        this.defaultSkillPath = options.defaultSkillPath || 'assets/data/skills_melee_v4_5.json';
        this.defaultLevelPath = options.defaultLevelPath || 'assets/data/levels.json';
        this.defaultMapPackPath = options.defaultMapPackPath || 'assets/data/level_map_pack_v1.json';
        this.defaultSourceUrl = options.defaultSourceUrl || '../assets/data/enemies.json';
        this.workspace = null;
        this.selectedEnemyId = null;
        this.context = {};
        this.elements = {};
    }

    bind() {
        [
            'status',
            'enemyPathInput',
            'loadEnemyBtn',
            'saveDraftBtn',
            'publishEnemyBtn',
            'createEnemyBtn',
            'duplicateEnemyBtn',
            'deleteEnemyBtn',
            'saveEnemyBtn',
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

        this.bindClick('loadEnemyBtn', () => this.loadDefault());
        this.bindClick('saveDraftBtn', () => this.saveDraft());
        this.bindClick('publishEnemyBtn', () => this.publishRuntime());
        this.bindClick('createEnemyBtn', () => this.createEnemy());
        this.bindClick('duplicateEnemyBtn', () => this.duplicateEnemy());
        this.bindClick('deleteEnemyBtn', () => this.deleteEnemy());
        this.bindClick('saveEnemyBtn', () => this.saveCurrentEnemy());
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
        if (this.elements.status) this.elements.status.textContent = message;
    }

    async loadDefault() {
        if (typeof this.fetchImpl !== 'function') throw new Error('缺少 fetch 实现。');
        const path = this.elements.enemyPathInput?.value || this.defaultEnemyPath;
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

    async readProjectJson(path) {
        const response = await this.fetchImpl(`/__skill_editor_file?path=${encodeURIComponent(path)}`, { cache: 'no-store' });
        if (!response?.ok) throw new Error(`加载失败：${response?.status || 'unknown'}`);
        return response.json();
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
        host.innerHTML = '';
        host.textContent = '';
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
        setValue('enemyIdInput', enemy.id);
        setValue('enemyNameInput', enemy.name);
        setValue('enemyRaceInput', enemy.race);
        setValue('enemyClassInput', enemy.class);
        setValue('enemyTagsInput', enemy.tags.join(', '));
        setValue('enemyDescriptionInput', enemy.description);
        setValue('enemyHpInput', enemy.stats.hp);
        setValue('enemyMaxHpInput', enemy.stats.maxHp);
        setValue('enemyApInput', enemy.stats.ap);
        setValue('enemySpeedInput', enemy.stats.speed);
        setValue('portraitRefInput', enemy.presentation.portraitRef || '');
        setValue('mapPortraitRefInput', enemy.presentation.mapPortraitRef || '');
        setValue('battleSpriteRefInput', enemy.presentation.battleSpriteRef || '');
        setValue('iconRefInput', enemy.presentation.iconRef || '');
        setValue('skillListInput', enemy.skills.join('\n'));
        this.renderBattleSpriteOptions(enemy.presentation.battleSpriteRef || '');
        this.renderPreview(enemy);
    }

    renderBattleSpriteOptions(selectedRef = '') {
        const select = this.elements.battleSpriteSelect;
        if (!select) return;
        select.innerHTML = '';
        select.textContent = '';

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

    saveCurrentEnemy() {
        const enemy = this.getCurrentEnemy();
        if (!enemy) return null;
        const nextEnemy = {
            ...enemy,
            name: this.elements.enemyNameInput?.value || enemy.name,
            race: this.elements.enemyRaceInput?.value || '',
            class: this.elements.enemyClassInput?.value || '',
            tags: splitTextList(this.elements.enemyTagsInput?.value || ''),
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
            skills: splitTextList(this.elements.skillListInput?.value || '')
        };
        this.workspace.updateEnemy(enemy.id, nextEnemy);
        this.renderAll();
        this.setStatus(`已保存当前敌人：${nextEnemy.name}`);
        return this.workspace.getEnemy(enemy.id);
    }

    createEnemy() {
        if (!this.workspace) return null;
        this.selectedEnemyId = this.workspace.createEnemy({ id: 'enemy_new', name: '新敌人' });
        this.renderAll();
        return this.selectedEnemyId;
    }

    duplicateEnemy() {
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
        const result = await this.writeProjectJson('assets/data/enemies.json', content);
        this.setStatus(`已发布到主流程：${result.path}`);
        return result;
    }
}

export { buildEnemyAuthoringPath };
export default EnemyEditorPage;
