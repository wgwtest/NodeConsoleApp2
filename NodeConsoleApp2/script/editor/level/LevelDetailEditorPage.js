import LevelDetailWorkspace from './LevelDetailWorkspace.js';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/gu, '&amp;')
        .replace(/</gu, '&lt;')
        .replace(/>/gu, '&gt;')
        .replace(/"/gu, '&quot;')
        .replace(/'/gu, '&#039;');
}

function getEnemyDictionary(enemiesDocument) {
    const source = asObject(enemiesDocument);
    return source.enemies && typeof source.enemies === 'object'
        ? source.enemies
        : source;
}

function normalizePackageId(mapDocument) {
    return mapDocument?.meta?.id || 'story_pack_v1';
}

export class LevelDetailEditorPage {
    constructor(options = {}) {
        this.document = options.document || globalThis.document;
        this.window = options.window || this.document?.defaultView || globalThis.window;
        this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
        this.mapSourceUrl = options.mapSourceUrl || '../assets/map_packs/authoring/story_pack_v1/package.json';
        this.levelSourceUrl = options.levelSourceUrl || '../assets/data/levels.json';
        this.enemySourceUrl = options.enemySourceUrl || '../assets/data/enemies.json';
        this.workspaceFactory = options.workspaceFactory || ((rawMap, rawLevels, rawEnemies) => new LevelDetailWorkspace({
            mapDocument: rawMap,
            levelsDocument: rawLevels,
            enemiesDocument: rawEnemies
        }));
        this.elements = {};
        this.workspace = null;
        this.enemiesDocument = {};
        this.selectedMapId = '';
        this.selectedNodeId = '';
        this.packageId = 'story_pack_v1';
        this.packageTitle = '故事关卡地图 Authoring 工作包';
        this.assetManifest = {};
        this.packageSource = null;
        this.initialSelection = this.getSelectionFromLocation();
    }

    bind() {
        [
            'levelDetailStatus',
            'packageIdText',
            'nodePathText',
            'authoringPathText',
            'runtimePathText',
            'packageSummaryText',
            'chapterMapList',
            'currentMapNodeCountText',
            'nodeTreeList',
            'levelNameInput',
            'difficultyLabelInput',
            'nodeLabelInput',
            'levelDescriptionInput',
            'buildHintInput',
            'enemyTemplateSelect',
            'enemySummary',
            'battleBackgroundSelect',
            'rewardExpInput',
            'rewardGoldInput',
            'rewardKpInput',
            'bindingSummary',
            'issueList',
            'runtimeProjection',
            'fileWriteList',
            'nodeIdText',
            'levelIdText',
            'mapContextText',
            'saveAuthoringPackageBtn',
            'publishRuntimePackageBtn',
            'loadAuthoringPackageBtn',
            'downloadPackageBtn',
            'backToMapEditorBtn'
        ].forEach((id) => {
            this.elements[id] = this.document.getElementById(id);
        });

        this.elements.enemyTemplateSelect?.addEventListener('change', () => {
            this.updateCurrentEnemy(this.elements.enemyTemplateSelect.value);
        });
        this.elements.battleBackgroundSelect?.addEventListener('change', () => {
            const level = this.getCurrentLevel();
            if (!level) return;
            this.workspace.setBattleBackground(level.id, this.elements.battleBackgroundSelect.value);
            this.renderInspector();
            this.setStatus(`已切换战斗背景：${this.elements.battleBackgroundSelect.value}`);
        });
        [
            'levelNameInput',
            'difficultyLabelInput',
            'nodeLabelInput',
            'levelDescriptionInput',
            'buildHintInput'
        ].forEach((id) => {
            this.elements[id]?.addEventListener('change', () => this.saveCurrentBasics());
        });
        [
            'rewardExpInput',
            'rewardGoldInput',
            'rewardKpInput'
        ].forEach((id) => {
            this.elements[id]?.addEventListener('change', () => this.updateCurrentRewards());
        });
        this.bindAction('loadAuthoringPackageBtn', () => this.loadDefaultDocuments());
        this.bindAction('saveAuthoringPackageBtn', () => this.saveAuthoringPackage());
        this.bindAction('publishRuntimePackageBtn', () => this.publishRuntimePackage());
        this.bindAction('downloadPackageBtn', () => this.downloadPackageFiles());
        this.bindAction('backToMapEditorBtn', () => {
            if (this.window?.location) {
                this.window.location.href = './level_map_editor_v1.html';
            }
        });
    }

    bindAction(id, handler) {
        this.elements[id]?.addEventListener('click', () => {
            try {
                const result = handler();
                if (result && typeof result.then === 'function') {
                    result.catch((error) => this.setStatus(`操作失败：${error.message}`));
                }
            } catch (error) {
                this.setStatus(`操作失败：${error.message}`);
            }
        });
    }

    resolveRelativeUrl(filePath, baseUrl) {
        if (!filePath || typeof filePath !== 'string') return filePath;
        if (/^https?:\/\//iu.test(filePath) || filePath.startsWith('/')) return filePath;
        if (!baseUrl) return filePath;
        const baseText = String(baseUrl);
        const baseDirectory = baseText.includes('/')
            ? baseText.slice(0, baseText.lastIndexOf('/') + 1)
            : '';
        return `${baseDirectory}${filePath}`;
    }

    getSelectionFromLocation() {
        const search = this.window?.location?.search || '';
        const params = new URLSearchParams(search);
        return {
            mapId: params.get('mapId') || '',
            nodeId: params.get('nodeId') || ''
        };
    }

    async fetchJson(url, label) {
        const response = await this.fetchImpl(url, { cache: 'no-store' });
        if (!response?.ok) {
            throw new Error(`${label}加载失败: ${response?.status || 'unknown'}`);
        }
        return response.json();
    }

    async loadDefaultDocuments() {
        if (typeof this.fetchImpl !== 'function') {
            throw new Error('缺少 fetch 实现，无法加载关卡详情编辑器默认数据。');
        }
        this.setStatus('正在加载故事地图包、关卡详情与敌人模板...');
        const rawPackageSource = await this.fetchJson(this.mapSourceUrl, '地图包入口');
        let rawMapPack = rawPackageSource;
        let rawLevels = null;
        let rawAssetManifest = {};
        if (rawPackageSource?.$schemaVersion === 'level_map_package_v1') {
            this.packageSource = rawPackageSource;
            this.packageId = rawPackageSource.packageId || this.packageId;
            this.packageTitle = rawPackageSource.title || this.packageTitle;
            if (rawPackageSource?.files?.maps) {
                rawMapPack = await this.fetchJson(
                    this.resolveRelativeUrl(rawPackageSource.files.maps, this.mapSourceUrl),
                    '地图包数据'
                );
            }
            if (rawPackageSource?.files?.levels) {
                rawLevels = await this.fetchJson(
                    this.resolveRelativeUrl(rawPackageSource.files.levels, this.mapSourceUrl),
                    '关卡详情'
                );
            }
            if (rawPackageSource?.assets?.manifest) {
                rawAssetManifest = await this.fetchJson(
                    this.resolveRelativeUrl(rawPackageSource.assets.manifest, this.mapSourceUrl),
                    '地图包资源清单'
                );
            }
        }
        if (!rawLevels) {
            rawLevels = await this.fetchJson(this.levelSourceUrl, '关卡详情');
        }
        const rawEnemies = await this.fetchJson(this.enemySourceUrl, '敌人模板');
        this.assetManifest = rawAssetManifest || {};
        this.loadDocuments(rawMapPack, rawLevels, rawEnemies, {
            packageSource: rawPackageSource,
            assetManifest: rawAssetManifest
        });
        this.setStatus('已加载故事地图包、关卡详情与敌人模板。');
    }

    loadDocuments(rawMapPack, rawLevels, rawEnemies = {}, metadata = {}) {
        this.packageSource = metadata.packageSource || this.packageSource;
        this.assetManifest = metadata.assetManifest || this.assetManifest || {};
        this.packageId = this.packageSource?.packageId || normalizePackageId(rawMapPack);
        this.packageTitle = this.packageSource?.title || rawMapPack?.meta?.title || this.packageTitle || this.packageId;
        this.enemiesDocument = getEnemyDictionary(rawEnemies);
        this.workspace = this.workspaceFactory(rawMapPack, rawLevels, rawEnemies);
        const summaries = this.workspace.listNodeLevelSummaries();
        const requestedSummary = summaries.find((summary) => (
            (!this.initialSelection.mapId || summary.mapId === this.initialSelection.mapId)
            && (!this.initialSelection.nodeId || summary.nodeId === this.initialSelection.nodeId)
        )) || null;
        const firstSummary = requestedSummary || summaries[0] || null;
        this.selectedMapId = firstSummary?.mapId || '';
        this.selectedNodeId = firstSummary?.nodeId || '';
        if (this.selectedMapId && this.selectedNodeId) {
            this.workspace.ensureLevelForNode({ mapId: this.selectedMapId, nodeId: this.selectedNodeId });
        }
        this.renderAll();
        this.setStatus('已加载故事地图包、关卡详情与敌人模板。');
    }

    setStatus(text) {
        if (this.elements.levelDetailStatus) {
            this.elements.levelDetailStatus.textContent = text;
        }
    }

    renderAll() {
        this.renderTopbar();
        this.renderChapterMapTree();
        this.renderNodeTree();
        this.renderLevelDetail();
        this.renderInspector();
    }

    renderTopbar() {
        const authoringPath = `assets/map_packs/authoring/${this.packageId}/package.json`;
        const runtimePath = `assets/map_packs/current/${this.packageId}/package.json`;
        if (this.elements.packageIdText) this.elements.packageIdText.textContent = this.packageId;
        if (this.elements.authoringPathText) this.elements.authoringPathText.textContent = authoringPath;
        if (this.elements.runtimePathText) this.elements.runtimePathText.textContent = runtimePath;

        const chapter = this.workspace?.getChapterForMap(this.selectedMapId);
        const map = this.workspace?.getMap(this.selectedMapId);
        const node = this.workspace?.getNode(this.selectedMapId, this.selectedNodeId);
        if (this.elements.nodePathText) {
            this.elements.nodePathText.textContent = [
                chapter?.title || '-',
                map?.name || '-',
                node?.label || node?.id || '-'
            ].join(' / ');
        }
    }

    getPrimaryMapForChapter(chapterId) {
        if (!this.workspace) return [];
        const chapter = this.workspace.chapters.find(item => item.id === chapterId) || null;
        const maps = this.workspace.maps.filter(map => map.chapterId === chapterId);
        const chapterMapIds = asArray(chapter?.mapIds);
        const preferredMapId = chapter?.entryMapId || chapterMapIds[0] || '';
        if (!preferredMapId) return maps[0] || null;
        const byId = new Map(maps.map(map => [map.id, map]));
        return byId.get(preferredMapId) || this.workspace.getMap(preferredMapId) || maps[0] || null;
    }

    getMapNodeSummaries(mapId = this.selectedMapId) {
        if (!this.workspace || !mapId) return [];
        return this.workspace.listNodeLevelSummaries({ mapId });
    }

    renderChapterMapTree() {
        const host = this.elements.chapterMapList;
        if (!host || !this.workspace) return;

        if (this.elements.packageSummaryText) {
            const storyCount = this.workspace.stories.length || 1;
            this.elements.packageSummaryText.textContent = `${storyCount} 个故事 / ${this.workspace.chapters.length} 个章节 / ${this.workspace.maps.length} 张地图`;
        }

        const chapters = [...this.workspace.chapters].sort((left, right) => {
            const orderDelta = Number(left.order || 0) - Number(right.order || 0);
            return orderDelta || String(left.title || left.id).localeCompare(String(right.title || right.id), 'zh-CN');
        });
        const chapterMapIds = new Set(chapters.map(chapter => this.getPrimaryMapForChapter(chapter.id)?.id).filter(Boolean));
        const orphanMaps = this.workspace.maps.filter(map => !chapterMapIds.has(map.id));
        const html = [
            ...chapters.map((chapter, index) => {
                const map = this.getPrimaryMapForChapter(chapter.id);
                return `
                    ${map ? this.renderMapRow(map, chapter, index) : ''}
                `;
            }),
            orphanMaps.length ? `
                ${orphanMaps.map(map => this.renderMapRow(map, null, null)).join('')}
            ` : ''
        ].join('');
        host.innerHTML = html || '<p class="muted">地图包内还没有章节和地图。</p>';
        host.querySelectorAll('.map-row').forEach((button) => {
            button.addEventListener('click', () => this.selectMap(button.dataset.mapId));
        });
    }

    renderMapRow(map, chapter, chapterIndex = null) {
        const selected = map.id === this.selectedMapId;
        const nodeCount = asArray(map.nodes).length;
        const indexText = chapterIndex === null ? '--' : String(chapterIndex + 1).padStart(2, '0');
        return `
            <button class="map-row${selected ? ' is-selected' : ''}" type="button" data-map-id="${escapeHtml(map.id)}">
                <span class="chapter-index">${escapeHtml(indexText)}</span>
                <span>
                    <strong>${escapeHtml(chapter?.title || map.chapterId || '未归档章节')}</strong>
                    <span class="muted">${escapeHtml(map.name || map.title || map.id)} / ${escapeHtml(map.id)} / ${escapeHtml(nodeCount)} 节点</span>
                </span>
            </button>
        `;
    }

    renderNodeTree() {
        const host = this.elements.nodeTreeList;
        if (!host || !this.workspace) return;
        const summaries = this.getMapNodeSummaries();
        if (this.elements.currentMapNodeCountText) {
            this.elements.currentMapNodeCountText.textContent = `${summaries.length} 个节点`;
        }
        if (summaries.length === 0) {
            host.innerHTML = '<p class="muted">当前地图还没有节点。</p>';
            return;
        }
        host.innerHTML = summaries.map((summary) => {
            const selected = summary.mapId === this.selectedMapId && summary.nodeId === this.selectedNodeId;
            const status = summary.hasLevelDetail ? (summary.issueCount > 0 ? '需检查' : 'OK') : '未创建';
            return `
                <button class="node-row${selected ? ' is-selected' : ''}" type="button" data-map-id="${escapeHtml(summary.mapId)}" data-node-id="${escapeHtml(summary.nodeId)}">
                    <span class="node-badge">${escapeHtml(summary.nodeLabel || summary.nodeId)}</span>
                    <span>${escapeHtml(summary.title)}</span>
                    <em>${escapeHtml(status)}</em>
                </button>
            `;
        }).join('');
        host.querySelectorAll('.node-row').forEach((button) => {
            button.addEventListener('click', () => {
                this.selectNode(button.dataset.mapId, button.dataset.nodeId);
            });
        });
    }

    getCurrentLevel() {
        if (!this.workspace || !this.selectedMapId || !this.selectedNodeId) return null;
        return this.workspace.ensureLevelForNode({
            mapId: this.selectedMapId,
            nodeId: this.selectedNodeId
        });
    }

    getCurrentEnemy() {
        const level = this.getCurrentLevel();
        const templateId = level ? this.workspace.getPrimaryEnemy(level.id).templateId : '';
        return templateId ? this.enemiesDocument[templateId] || null : null;
    }

    selectNode(mapId, nodeId) {
        this.selectedMapId = mapId || '';
        this.selectedNodeId = nodeId || '';
        this.workspace.ensureLevelForNode({ mapId: this.selectedMapId, nodeId: this.selectedNodeId });
        this.renderAll();
        this.setStatus(`已切换节点：${this.selectedNodeId}`);
    }

    selectMap(mapId, preferredNodeId = '') {
        if (!this.workspace) return;
        const summaries = this.getMapNodeSummaries(mapId);
        if (summaries.length === 0) {
            this.selectedMapId = mapId || '';
            this.selectedNodeId = '';
            this.renderAll();
            this.setStatus(`已切换地图：${this.selectedMapId || '-'}`);
            return;
        }
        const nextSummary = summaries.find(summary => summary.nodeId === preferredNodeId)
            || summaries.find(summary => summary.nodeId === this.selectedNodeId)
            || summaries[0];
        this.selectedMapId = nextSummary.mapId;
        this.selectedNodeId = nextSummary.nodeId;
        this.workspace.ensureLevelForNode({ mapId: this.selectedMapId, nodeId: this.selectedNodeId });
        this.renderAll();
        this.setStatus(`已切换地图：${this.selectedMapId}`);
    }

    renderLevelDetail() {
        if (!this.workspace) return;
        const level = this.getCurrentLevel();
        const node = this.workspace.getNode(this.selectedMapId, this.selectedNodeId);
        if (!level || !node) return;

        if (this.elements.levelNameInput) this.elements.levelNameInput.value = level.name || '';
        if (this.elements.difficultyLabelInput) this.elements.difficultyLabelInput.value = level.selectionMeta?.difficultyLabel || '';
        if (this.elements.nodeLabelInput) this.elements.nodeLabelInput.value = level.flow?.nodeLabel || node.label || '';
        if (this.elements.levelDescriptionInput) this.elements.levelDescriptionInput.value = level.description || '';
        if (this.elements.buildHintInput) this.elements.buildHintInput.value = level.selectionMeta?.buildHint || '';
        if (this.elements.rewardExpInput) this.elements.rewardExpInput.value = String(level.rewards?.exp ?? 0);
        if (this.elements.rewardGoldInput) this.elements.rewardGoldInput.value = String(level.rewards?.gold ?? 0);
        if (this.elements.rewardKpInput) this.elements.rewardKpInput.value = String(level.rewards?.kp ?? 0);
        if (this.elements.nodeIdText) this.elements.nodeIdText.textContent = node.id;
        if (this.elements.levelIdText) this.elements.levelIdText.textContent = level.id;

        this.renderEnemySelect(level);
        this.renderBackgroundSelect(level);
        this.renderEnemySummary();
        this.renderTopbar();
    }

    renderEnemySelect(level) {
        const select = this.elements.enemyTemplateSelect;
        if (!select) return;
        const primary = this.workspace.getPrimaryEnemy(level.id);
        const options = Object.values(this.enemiesDocument)
            .filter(enemy => enemy?.id)
            .sort((left, right) => String(left.name || left.id).localeCompare(String(right.name || right.id), 'zh-CN'));
        select.innerHTML = [
            '<option value="">未选择敌人</option>',
            ...options.map(enemy => `<option value="${escapeHtml(enemy.id)}">${escapeHtml(enemy.name || enemy.id)} / ${escapeHtml(enemy.id)}</option>`)
        ].join('');
        select.value = primary.templateId || '';
    }

    renderBackgroundSelect(level) {
        const select = this.elements.battleBackgroundSelect;
        if (!select) return;
        const backgroundIds = [...this.workspace.getKnownBattleBackgroundIds()];
        select.innerHTML = backgroundIds.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`).join('');
        select.value = level.background || backgroundIds[0] || '';
    }

    renderEnemySummary() {
        const host = this.elements.enemySummary;
        if (!host) return;
        const enemy = this.getCurrentEnemy();
        if (!enemy) {
            host.innerHTML = '<strong>未选择敌人</strong><span>本关仍缺少敌人模板。</span>';
            return;
        }
        const stats = asObject(enemy.stats);
        host.innerHTML = `
            <strong>${escapeHtml(enemy.name || enemy.id)}</strong>
            <span>${escapeHtml(enemy.race || '-')} / ${escapeHtml(enemy.class || '-')} / 单敌人</span>
            <div class="stat-strip">
                <b>HP ${escapeHtml(stats.hp ?? 0)}</b>
                <b>AP ${escapeHtml(stats.ap ?? 0)}</b>
                <b>SPD ${escapeHtml(stats.speed ?? 0)}</b>
                <b>技能 ${escapeHtml(asArray(enemy.skills).length)}</b>
            </div>
        `;
    }

    renderInspector() {
        const level = this.getCurrentLevel();
        const node = this.workspace?.getNode(this.selectedMapId, this.selectedNodeId);
        if (!level || !node) return;
        if (this.elements.bindingSummary) {
            this.elements.bindingSummary.innerHTML = `
                <div><dt>nodeId</dt><dd id="nodeIdText">${escapeHtml(node.id)}</dd></div>
                <div><dt>levelId</dt><dd id="levelIdText">${escapeHtml(level.id)}</dd></div>
                <div><dt>mapId</dt><dd>${escapeHtml(this.selectedMapId)}</dd></div>
                <div><dt>package</dt><dd>${escapeHtml(this.packageId)}</dd></div>
            `;
            this.elements.nodeIdText = this.document.getElementById('nodeIdText');
            this.elements.levelIdText = this.document.getElementById('levelIdText');
        }
        const issues = this.workspace.validatePackage();
        if (this.elements.issueList) {
            this.elements.issueList.innerHTML = issues.length
                ? issues.slice(0, 4).map(issue => `
                    <div class="issue ${issue.code.includes('missing') ? 'issue-error' : 'issue-warn'}">
                        <strong>${issue.code.includes('missing') ? '阻断' : '警告'}</strong>
                        <span>${escapeHtml(this.formatIssue(issue))}</span>
                    </div>
                `).join('')
                : '<div class="issue issue-ok"><strong>通过</strong><span>当前包未发现阻断问题</span></div>';
        }
        const primary = this.workspace.getPrimaryEnemy(level.id);
        if (this.elements.runtimeProjection) {
            const poolId = this.workspace.exportRuntimeLevelsDocument().levels[level.id].waves[0].enemyPoolId;
            this.elements.runtimeProjection.innerHTML = `
                <div class="projection-box"><code>primaryEnemy.templateId</code><span>${escapeHtml(primary.templateId || '未选择')}</span></div>
                <div class="projection-arrow">生成</div>
                <div class="projection-box muted"><code>waves[0].enemyPoolId</code><span>${escapeHtml(poolId)}</span></div>
            `;
        }
        if (this.elements.fileWriteList) {
            this.elements.fileWriteList.innerHTML = ['package.json', 'maps.json', 'levels.json', 'asset-manifest.json']
                .map(file => `<li>${escapeHtml(file)}</li>`)
                .join('');
        }
    }

    normalizePackageDirectory(value = '') {
        const text = String(value || '').trim().replace(/\\/g, '/');
        const normalized = text || `assets/map_packs/current/${this.packageId || 'story_pack_v1'}/`;
        return normalized.endsWith('/') ? normalized : `${normalized}/`;
    }

    getAuthoringPackageDirectory() {
        return this.normalizePackageDirectory(`assets/map_packs/authoring/${this.packageId || 'story_pack_v1'}/`);
    }

    getRuntimePackageDirectory() {
        return this.normalizePackageDirectory(`assets/map_packs/current/${this.packageId || 'story_pack_v1'}/`);
    }

    buildPackageBundle(status = 'authoring') {
        if (!this.workspace || typeof this.workspace.exportPackageBundle !== 'function') {
            throw new Error('当前工作区不支持故事地图包导出。');
        }
        return this.workspace.exportPackageBundle({
            packageId: this.packageId,
            packageTitle: this.packageTitle,
            packageStatus: status,
            assetManifest: this.assetManifest
        });
    }

    buildPackageExportFiles(status = 'authoring') {
        const bundle = this.buildPackageBundle(status);
        return [
            {
                fileName: 'package.json',
                content: JSON.stringify(bundle.packageJson, null, 2)
            },
            {
                fileName: 'maps.json',
                content: JSON.stringify(bundle.mapsJson, null, 2)
            },
            {
                fileName: 'levels.json',
                content: JSON.stringify(bundle.levelsJson, null, 2)
            },
            {
                fileName: 'asset-manifest.json',
                content: JSON.stringify(bundle.assetManifest, null, 2)
            }
        ];
    }

    async writePackageViaApi(endpoint, targetDirectory, statusPrefix, packageStatus) {
        if (typeof this.fetchImpl !== 'function') {
            throw new Error('缺少 fetch 实现，无法写入故事地图包目录。');
        }
        const normalizedDirectory = this.normalizePackageDirectory(targetDirectory);
        const response = await this.fetchImpl(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetDirectory: normalizedDirectory,
                files: this.buildPackageExportFiles(packageStatus)
            })
        });
        if (!response?.ok) {
            let message = response?.status ? `HTTP ${response.status}` : 'unknown';
            try {
                const payload = await response.json();
                if (payload?.error) message = payload.error;
            } catch (error) {
                // Keep the HTTP status when response body is not JSON.
            }
            throw new Error(message);
        }
        this.setStatus(`${statusPrefix}：${normalizedDirectory}package.json`);
    }

    async saveAuthoringPackage() {
        await this.writePackageViaApi(
            '/api/level-map-packs/save',
            this.getAuthoringPackageDirectory(),
            '已保存工作稿',
            'authoring'
        );
    }

    async publishRuntimePackage() {
        await this.writePackageViaApi(
            '/api/level-map-packs/publish',
            this.getRuntimePackageDirectory(),
            '已发布到主流程',
            'runtime'
        );
    }

    downloadTextFile(fileName, content) {
        if (!this.document || typeof this.document.createElement !== 'function') return;
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = this.document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        this.document.body?.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    downloadPackageFiles() {
        const files = this.buildPackageExportFiles('authoring');
        files.forEach(file => this.downloadTextFile(file.fileName, file.content));
        this.setStatus(`已生成 ${files.length} 个故事包文件下载：package.json / maps.json / levels.json / asset-manifest.json。`);
    }

    formatIssue(issue) {
        const labels = {
            missing_primary_enemy: '缺少本关敌人',
            missing_enemy_template: `${issue.templateId || '敌人模板'} 不存在`,
            missing_battle_background: `${issue.background || '战斗背景'} 不存在`,
            missing_level_binding: `${issue.nodeId || '节点'} 未绑定关卡`,
            missing_level_detail: `${issue.levelId || '关卡'} 缺少详情`,
            orphan_level_detail: `${issue.levelId || '关卡'} 未被地图节点引用`
        };
        return labels[issue.code] || issue.code;
    }

    saveCurrentBasics() {
        const level = this.getCurrentLevel();
        if (!level) return;
        this.workspace.updateLevelBasics(level.id, {
            name: this.elements.levelNameInput?.value || '',
            description: this.elements.levelDescriptionInput?.value || '',
            difficultyLabel: this.elements.difficultyLabelInput?.value || '',
            buildHint: this.elements.buildHintInput?.value || ''
        });
        level.flow.nodeLabel = this.elements.nodeLabelInput?.value || level.flow.nodeLabel || '';
        this.renderNodeTree();
        this.renderInspector();
        this.setStatus('已保存当前关卡基础信息。');
    }

    updateCurrentEnemy(templateId) {
        const level = this.getCurrentLevel();
        if (!level) return;
        this.workspace.setPrimaryEnemy(level.id, templateId);
        this.renderEnemySummary();
        this.renderInspector();
        this.setStatus(`已切换本关敌人：${templateId || '未选择'}`);
    }

    updateCurrentRewards() {
        const level = this.getCurrentLevel();
        if (!level) return;
        this.workspace.updateRewards(level.id, {
            exp: this.elements.rewardExpInput?.value,
            gold: this.elements.rewardGoldInput?.value,
            kp: this.elements.rewardKpInput?.value
        });
        this.renderInspector();
        this.setStatus('已更新关卡奖励。');
    }
}

export default LevelDetailEditorPage;
