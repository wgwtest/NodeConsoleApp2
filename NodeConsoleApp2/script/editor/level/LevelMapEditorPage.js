import {
    buildStageImageLayers,
    findLevelMapAsset,
    getLevelMapAssetImage,
    getLevelMapAssetLabel,
    resolveNodeVisualAssets
} from './LevelMapAssetResolver.js';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toFiniteNumber(value, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

function normalizeMapSpace(map) {
    const source = asObject(map?.space);
    return {
        logicalWidth: Math.max(1, toFiniteNumber(source.logicalWidth, 1600)),
        logicalHeight: Math.max(1, toFiniteNumber(source.logicalHeight, 900))
    };
}

function normalizeMapDisplay(map) {
    const source = asObject(map?.display);
    return {
        viewportAspect: typeof source.viewportAspect === 'string' && source.viewportAspect.trim()
            ? source.viewportAspect.trim()
            : '16:9',
        backgroundFit: typeof source.backgroundFit === 'string' && source.backgroundFit.trim()
            ? source.backgroundFit.trim()
            : 'cover',
        nodeScale: Math.max(0.1, toFiniteNumber(source.nodeScale, 0.6)),
        nodeAnchor: typeof source.nodeAnchor === 'string' && source.nodeAnchor.trim()
            ? source.nodeAnchor.trim()
            : 'center',
        edgeAnchor: typeof source.edgeAnchor === 'string' && source.edgeAnchor.trim()
            ? source.edgeAnchor.trim()
            : 'center',
        edgeLabelMode: typeof source.edgeLabelMode === 'string' && source.edgeLabelMode.trim()
            ? source.edgeLabelMode.trim()
            : 'midpoint'
    };
}

function clampNodeScale(value, fallback = 0.6) {
    return Math.min(2, Math.max(0.1, toFiniteNumber(value, fallback)));
}

function normalizeViewportAspect(value, fallback = '16:9') {
    const text = typeof value === 'string' ? value.trim() : '';
    return /^\d+\s*:\s*\d+$/u.test(text) ? text.replace(/\s+/gu, '') : fallback;
}

function toCssAspectRatio(value, fallback = '16:9') {
    const normalized = normalizeViewportAspect(value, fallback);
    return normalized.replace(':', ' / ');
}

function toAspectRatioNumber(value, fallback = '16:9') {
    const [width, height] = normalizeViewportAspect(value, fallback)
        .split(':')
        .map(part => Math.max(1, toFiniteNumber(part, 1)));
    return width / height;
}

function getEditorNodeVisualSize(display) {
    return 68 * clampNodeScale(display?.nodeScale, 0.6);
}

function normalizeNodePosition(node) {
    const source = asObject(node);
    const position = asObject(source.position);
    return {
        x: toFiniteNumber(position.x, toFiniteNumber(source.x, 0)),
        y: toFiniteNumber(position.y, toFiniteNumber(source.y, 0))
    };
}

function getCanvasMetrics(host, map, fallbackSize = { width: 920, height: 520 }) {
    const rect = typeof host?.getBoundingClientRect === 'function'
        ? host.getBoundingClientRect()
        : null;
    const width = Math.max(1, Math.round(host?.clientWidth || rect?.width || fallbackSize.width));
    const height = Math.max(1, Math.round(host?.clientHeight || rect?.height || fallbackSize.height));
    const space = normalizeMapSpace(map);
    const display = normalizeMapDisplay(map);
    return {
        width,
        height,
        rect: rect || { left: 0, top: 0, width, height },
        space,
        display
    };
}

function projectPoint(point, metrics) {
    const position = normalizeNodePosition({ position: point });
    return {
        x: Math.round((position.x / metrics.space.logicalWidth) * metrics.width),
        y: Math.round((position.y / metrics.space.logicalHeight) * metrics.height)
    };
}

function unprojectPoint(point, metrics) {
    return {
        x: Math.round((toFiniteNumber(point?.x, 0) / metrics.width) * metrics.space.logicalWidth),
        y: Math.round((toFiniteNumber(point?.y, 0) / metrics.height) * metrics.space.logicalHeight)
    };
}

function resolveProjectedNodeFrame(projectedPoint, display) {
    const size = getEditorNodeVisualSize(display);
    const half = size / 2;
    const nodeAnchor = display?.nodeAnchor || 'center';
    const topLeft = nodeAnchor === 'top-left'
        ? { x: projectedPoint.x, y: projectedPoint.y }
        : { x: projectedPoint.x - half, y: projectedPoint.y - half };
    const center = nodeAnchor === 'top-left'
        ? { x: projectedPoint.x + half, y: projectedPoint.y + half }
        : { x: projectedPoint.x, y: projectedPoint.y };
    return {
        size,
        half,
        topLeft,
        center
    };
}

function resolveEdgeAnchorPoint(nodeFrame, display) {
    const edgeAnchor = display?.edgeAnchor || 'center';
    return edgeAnchor === 'top-left'
        ? nodeFrame.topLeft
        : nodeFrame.center;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function splitTextList(value) {
    return String(value || '')
        .split(/[\n,，]/u)
        .map(item => item.trim())
        .filter(Boolean);
}

function createElement(doc, tagName, className = '') {
    const element = doc.createElement(tagName);
    if (className) {
        element.className = className;
    }
    return element;
}

function createSvgElement(doc, tagName, className = '') {
    const element = doc.createElementNS('http://www.w3.org/2000/svg', tagName);
    if (className) {
        element.setAttribute('class', className);
    }
    return element;
}

function buildEdgeGeometry(fromPoint, toPoint) {
    const midX = Math.round((fromPoint.x + toPoint.x) / 2);
    const midY = Math.round((fromPoint.y + toPoint.y) / 2);
    const offsetY = fromPoint.y === toPoint.y
        ? -34
        : Math.round(Math.max(22, Math.min(54, Math.abs(toPoint.y - fromPoint.y) * 0.24))) * (toPoint.y > fromPoint.y ? -1 : 1);

    return {
        path: `M ${fromPoint.x} ${fromPoint.y} C ${midX} ${fromPoint.y}, ${midX} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`,
        labelX: midX,
        labelY: midY + offsetY
    };
}

function buildEdgeLabel(edge, fromNode, toNode) {
    return edge.branchLabel || `${fromNode.label || fromNode.id} -> ${toNode.label || toNode.id}`;
}

function hashString(value) {
    const text = String(value || '');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash);
}

function buildPalette(key, saturation = 72, lightness = 56) {
    const hash = hashString(key);
    const hue = hash % 360;
    const hueShift = (hue + 38) % 360;
    return {
        primary: `hsl(${hue} ${saturation}% ${lightness}%)`,
        secondary: `hsl(${hueShift} ${Math.max(48, saturation - 16)}% ${Math.max(28, lightness - 18)}%)`,
        glow: `hsla(${hue} ${saturation}% ${Math.min(76, lightness + 8)}% / 0.34)`,
        border: `hsla(${hue} ${Math.max(42, saturation - 22)}% ${Math.max(26, lightness - 24)}% / 0.46)`,
        surface: `hsla(${hue} ${Math.max(46, saturation - 8)}% ${Math.min(92, lightness + 30)}% / 0.86)`,
        mist: `hsla(${hueShift} ${Math.max(42, saturation - 20)}% ${Math.min(82, lightness + 12)}% / 0.32)`,
        text: `hsl(${hueShift} ${Math.max(44, saturation - 22)}% ${Math.max(18, lightness - 28)}%)`
    };
}

function getNodeKindLabel(kind) {
    if (kind === 'main') return '主线节点';
    if (kind === 'branch') return '分支节点';
    if (kind === 'supply') return '补给节点';
    if (kind === 'elite') return '精英节点';
    if (kind === 'boss') return '首领节点';
    if (kind === 'event') return '事件节点';
    return '战斗节点';
}

function getNodeKindSymbol(kind) {
    if (kind === 'branch') return '✦';
    if (kind === 'supply' || kind === 'event') return '☩';
    if (kind === 'elite') return '◆';
    if (kind === 'boss') return '♛';
    return '⚔';
}

function getBodyPartLabel(partId) {
    if (partId === 'head') return '头部';
    if (partId === 'chest') return '胸部';
    if (partId === 'abdomen') return '腹部';
    if (partId === 'arm') return '手臂';
    if (partId === 'leg') return '腿部';
    return partId;
}

function buildEdgePalette(edge) {
    return {
        line: 'rgba(70, 55, 34, 0.86)',
        halo: 'rgba(246, 224, 173, 0.32)',
        labelFill: 'rgba(245, 233, 205, 0.92)',
        labelStroke: 'rgba(79, 61, 35, 0.24)',
        labelText: 'rgb(62, 45, 25)',
        legendGlow: 'rgba(246, 224, 173, 0.20)'
    };
}

export class LevelMapEditorPage {
    constructor(options = {}) {
        this.document = options.document || globalThis.document;
        this.window = options.window || this.document?.defaultView || globalThis.window;
        this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
        this.workspaceFactory = options.workspaceFactory;
        this.mapSourceUrl = options.mapSourceUrl || '../assets/map_packs/authoring/story_pack_v1/package.json';
        this.levelSourceUrl = options.levelSourceUrl || '../assets/data/levels.json';
        this.enemySourceUrl = options.enemySourceUrl || '../assets/enemy_packs/current/enemies.json';
        this.navigateTo = options.navigateTo || ((url) => {
            if (typeof this.window?.location?.assign === 'function') {
                this.window.location.assign(url);
                return;
            }
            if (this.window?.location) {
                this.window.location.href = url;
            }
        });
        this.ResizeObserverImpl = options.ResizeObserverImpl
            || this.window?.ResizeObserver
            || globalThis.ResizeObserver;

        this.workspace = null;
        this.levelsDocument = null;
        this.enemiesDocument = null;
        this.selectedStoryId = null;
        this.selectedChapterId = null;
        this.selectedMapId = null;
        this.selectedNodeId = null;
        this.selectedEdgeId = null;
        this.inspectorMode = 'node';
        this.pendingBackgroundRef = null;
        this.packageDirectoryHandle = null;
        this.dragState = null;
        this.elements = {};
        this.canvasResizeObserver = null;
        this.lastCanvasSizeKey = '';
        this.handleDocumentMouseMove = this.handleDocumentMouseMove.bind(this);
        this.handleDocumentMouseUp = this.handleDocumentMouseUp.bind(this);
        this.handleViewportResize = this.handleViewportResize.bind(this);
    }

    bind() {
        const ids = [
            'status',
            'newPackageBtn',
            'newPackageInlineBtn',
            'loadDefaultBtn',
            'addNodeBtn',
            'removeNodeBtn',
            'saveNodeBtn',
            'editLevelDetailBtn',
            'addEdgeBtn',
            'removeEdgeBtn',
            'saveEdgeBtn',
            'saveMapBtn',
            'publishMapBtn',
            'exportMapBtn',
            'addStoryBtn',
            'addChapterBtn',
            'addMapBtn',
            'duplicateMapBtn',
            'removeMapBtn',
            'chapterTitleInput',
            'mapNameInput',
            'storyList',
            'chapterList',
            'mapList',
            'nodeList',
            'edgeList',
            'validationList',
            'mapHeading',
            'mapMeta',
            'packFacts',
            'routeLegend',
            'availableLevelsSummary',
            'mapStage',
            'mapCanvas',
            'currentLevelEnemyPanel',
            'previewArchiveNote',
            'nodeInspectorBtn',
            'edgeInspectorBtn',
            'inspectorModeLabel',
            'nodeInspectorPanel',
            'edgeInspectorPanel',
            'backgroundSelect',
            'backgroundAssetPreview',
            'openBackgroundPickerBtn',
            'entryNodeSelect',
            'backgroundFitSelect',
            'logicalWidthInput',
            'logicalHeightInput',
            'viewportAspectSelect',
            'nodeScaleInput',
            'edgeLabelModeSelect',
            'nodeAnchorSelect',
            'edgeAnchorSelect',
            'selectedNodeId',
            'nodeIdInput',
            'nodeLevelIdSelect',
            'nodeLabelInput',
            'nodeTitleInput',
            'nodeKindSelect',
            'nodeSkinSelect',
            'nodeArtSelect',
            'nodePortraitSelect',
            'nodeXInput',
            'nodeYInput',
            'nodeObjectiveInput',
            'nodeDifficultyInput',
            'nodeRewardInput',
            'nodeAssetPreview',
            'nodePortraitPreview',
            'selectedEdgeId',
            'edgeIdInput',
            'edgeFromSelect',
            'edgeToSelect',
            'edgeBranchLabelInput',
            'exportPreview',
            'packageIdInput',
            'packageTitleInput',
            'authoringPackageDirectoryInput',
            'runtimePackageDirectoryInput',
            'packageDirectoryInput',
            'authoringPackagePathPreview',
            'runtimePackagePathPreview',
            'packagePathPreview',
            'mapSettingsDialog',
            'confirmMapSettingsBtn',
            'cancelMapSettingsBtn',
            'backgroundPickerDialog',
            'backgroundPickerList',
            'confirmBackgroundPickerBtn',
            'cancelBackgroundPickerBtn',
            'exportMapDialog',
            'selectPackageDirectoryBtn',
            'downloadPackageFilesBtn',
            'writePackageDirectoryBtn',
            'cancelExportMapBtn'
        ];

        ids.forEach((id) => {
            this.elements[id] = this.document.getElementById(id);
        });

        this.bindAction('loadDefaultBtn', () => this.loadDefaultDocuments());
        this.bindAction('newPackageBtn', () => this.createNewPackage());
        this.bindAction('newPackageInlineBtn', () => this.createNewPackage());
        this.bindAction('addNodeBtn', () => this.addNode());
        this.bindAction('removeNodeBtn', () => this.removeSelectedNode());
        this.bindAction('saveNodeBtn', () => this.saveCurrentNode());
        this.bindAction('editLevelDetailBtn', () => this.openSelectedNodeLevelDetail());
        this.bindAction('addEdgeBtn', () => this.addEdge());
        this.bindAction('removeEdgeBtn', () => this.removeSelectedEdge());
        this.bindAction('saveEdgeBtn', () => this.saveCurrentEdge());
        this.bindAction('addStoryBtn', () => this.addStory());
        this.bindAction('addChapterBtn', () => this.addChapter());
        this.bindAction('addMapBtn', () => this.addMap());
        this.bindAction('duplicateMapBtn', () => this.duplicateSelectedMap());
        this.bindAction('removeMapBtn', () => this.removeSelectedMap());
        this.bindAction('saveMapBtn', () => this.saveAuthoringPackage());
        this.bindAction('publishMapBtn', () => this.publishRuntimePackage());
        this.bindAction('confirmMapSettingsBtn', () => this.applyCurrentMapSettings());
        this.bindAction('cancelMapSettingsBtn', () => this.closeDialog('mapSettingsDialog'));
        this.bindAction('openBackgroundPickerBtn', () => this.openBackgroundPickerDialog());
        this.bindAction('confirmBackgroundPickerBtn', () => this.confirmBackgroundPicker());
        this.bindAction('cancelBackgroundPickerBtn', () => this.closeDialog('backgroundPickerDialog'));
        this.bindAction('exportMapBtn', () => this.openExportMapDialog());
        this.bindAction('selectPackageDirectoryBtn', () => this.selectPackageDirectory());
        this.bindAction('downloadPackageFilesBtn', () => this.downloadPackageFiles());
        this.bindAction('writePackageDirectoryBtn', () => this.writePackageDirectory());
        this.bindAction('cancelExportMapBtn', () => this.closeDialog('exportMapDialog'));
        this.bindAction('nodeInspectorBtn', () => this.setInspectorMode('node'));
        this.bindAction('edgeInspectorBtn', () => this.setInspectorMode('edge'));
        this.bindLiveMapSettings();

        this.document.addEventListener('mousemove', this.handleDocumentMouseMove);
        this.document.addEventListener('mouseup', this.handleDocumentMouseUp);
        this.window?.addEventListener?.('resize', this.handleViewportResize);
        this.bindCanvasResizeObserver();
    }

    bindLiveMapSettings() {
        [
            'backgroundSelect',
            'entryNodeSelect',
            'backgroundFitSelect',
            'logicalWidthInput',
            'logicalHeightInput',
            'viewportAspectSelect',
            'nodeScaleInput',
            'edgeLabelModeSelect',
            'nodeAnchorSelect',
            'edgeAnchorSelect'
        ].forEach((id) => {
            const element = this.elements[id];
            if (!element) return;
            const eventName = element.tagName === 'INPUT' ? 'input' : 'change';
            element.addEventListener(eventName, () => this.applyCurrentMapSettings({ silent: true }));
        });

        ['packageIdInput', 'authoringPackageDirectoryInput', 'runtimePackageDirectoryInput', 'packageDirectoryInput'].forEach((id) => {
            this.elements[id]?.addEventListener('input', () => this.syncPackagePathPreview());
        });
    }

    bindCanvasResizeObserver() {
        if (!this.ResizeObserverImpl || !this.elements.mapCanvas) return;
        this.canvasResizeObserver?.disconnect?.();
        this.canvasResizeObserver = new this.ResizeObserverImpl(() => {
            this.refreshCanvasProjectionIfSizeChanged();
        });
        this.canvasResizeObserver.observe(this.elements.mapCanvas);
    }

    handleViewportResize() {
        this.refreshCanvasProjectionIfSizeChanged();
    }

    refreshCanvasProjectionIfSizeChanged() {
        const host = this.elements.mapCanvas;
        const map = this.getCurrentMap();
        if (!host || !map) return;

        const metrics = getCanvasMetrics(host, map, { width: 920, height: 520 });
        const nextKey = `${metrics.width}x${metrics.height}`;
        if (nextKey === this.lastCanvasSizeKey) {
            return;
        }

        this.renderCanvas();
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

    buildLevelDetailUrl(mapId = this.selectedMapId, nodeId = this.selectedNodeId) {
        const params = new URLSearchParams();
        if (mapId) params.set('mapId', mapId);
        if (nodeId) params.set('nodeId', nodeId);
        const query = params.toString();
        return `./level_detail_editor_v1.html${query ? `?${query}` : ''}`;
    }

    openSelectedNodeLevelDetail() {
        if (!this.selectedMapId || !this.selectedNodeId) {
            this.setStatus('请先选择一个地图节点，再进入关卡详情。');
            return;
        }
        const url = this.buildLevelDetailUrl();
        this.navigateTo(url);
    }

    async loadDefaultDocuments() {
        if (typeof this.fetchImpl !== 'function') {
            throw new Error('缺少 fetch 实现，无法加载默认地图包。');
        }

        this.setStatus('正在加载地图包、关卡定义与敌人模板...');
        const [mapResponse, levelResponse, enemyResponse] = await Promise.all([
            this.fetchImpl(this.mapSourceUrl, { cache: 'no-store' }),
            this.fetchImpl(this.levelSourceUrl, { cache: 'no-store' }),
            this.fetchImpl(this.enemySourceUrl, { cache: 'no-store' })
        ]);

        if (!mapResponse?.ok) {
            throw new Error(`地图包加载失败: ${mapResponse?.status || 'unknown'}`);
        }
        if (!levelResponse?.ok) {
            throw new Error(`关卡定义加载失败: ${levelResponse?.status || 'unknown'}`);
        }
        if (!enemyResponse?.ok) {
            throw new Error(`敌人模板加载失败: ${enemyResponse?.status || 'unknown'}`);
        }

        const [rawMapSource, rawLevels, rawEnemies] = await Promise.all([
            mapResponse.json(),
            levelResponse.json(),
            enemyResponse.json()
        ]);
        let rawMapPack = rawMapSource;
        if (rawMapSource?.$schemaVersion === 'level_map_package_v1' && rawMapSource?.files?.maps) {
            const mapsUrl = this.resolveRelativeUrl(rawMapSource.files.maps, this.mapSourceUrl);
            const mapsResponse = await this.fetchImpl(mapsUrl, { cache: 'no-store' });
            if (!mapsResponse?.ok) {
                throw new Error(`地图包数据加载失败: ${mapsResponse?.status || 'unknown'}`);
            }
            rawMapPack = await mapsResponse.json();
        }

        this.loadDocuments(rawMapPack, rawLevels, rawEnemies);
        this.setStatus('已加载地图包、关卡定义与敌人模板。');
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

    loadDocuments(rawMapPack, rawLevels, rawEnemies = null) {
        if (typeof this.workspaceFactory !== 'function') {
            throw new Error('缺少 workspaceFactory，无法创建地图编辑工作区。');
        }

        this.levelsDocument = rawLevels;
        this.enemiesDocument = rawEnemies || this.enemiesDocument || {};
        this.workspace = this.workspaceFactory(rawMapPack, rawLevels);
        const firstStory = this.workspace.listStories?.()[0] || null;
        const firstChapter = firstStory
            ? this.workspace.listChapters(firstStory.id)[0] || null
            : this.workspace.listChapters?.()[0] || null;
        const firstMap = firstChapter
            ? this.workspace.listMaps().find(map => firstChapter.mapIds.includes(map.id)) || this.workspace.listMaps()[0] || null
            : this.workspace.listMaps()[0] || null;
        this.selectedStoryId = firstStory?.id || firstChapter?.storyId || null;
        this.selectedChapterId = firstChapter?.id || firstMap?.chapterId || null;
        this.selectedMapId = firstMap?.id || null;
        this.selectedNodeId = firstMap?.nodes?.[0]?.id || null;
        this.selectedEdgeId = firstMap?.edges?.[0]?.id || null;
        this.inspectorMode = this.selectedNodeId ? 'node' : 'edge';
        this.renderAll();
    }

    buildNewPackageDocument() {
        return this.workspace?.constructor?.createNewPackageDocument?.({
            packageId: this.getPackageIdFromForm(),
            packageTitle: this.getPackageTitleFromForm(),
            baseDocument: this.workspace?.exportDocument?.() || {},
            levelsDocument: this.levelsDocument || {}
        }) || null;
    }

    createNewPackage() {
        if (typeof this.workspaceFactory !== 'function') {
            throw new Error('缺少 workspaceFactory，无法创建地图编辑工作区。');
        }

        const rawMapPack = this.buildNewPackageDocument();
        this.loadDocuments(rawMapPack, this.levelsDocument || {});
        this.setPackageDirectoryDefaults(rawMapPack.meta.id);
        this.setStatus(`已新建故事包：${rawMapPack.meta.id}`);
    }

    getCurrentMap() {
        if (!this.workspace || !this.selectedMapId) return null;
        return this.workspace.getMap(this.selectedMapId);
    }

    getCurrentStory() {
        if (!this.workspace || !this.selectedStoryId || typeof this.workspace.listStories !== 'function') return null;
        return this.workspace.listStories().find(story => story.id === this.selectedStoryId) || null;
    }

    getCurrentChapter() {
        if (!this.workspace || !this.selectedChapterId || typeof this.workspace.listChapters !== 'function') return null;
        return this.workspace.listChapters().find(chapter => chapter.id === this.selectedChapterId) || null;
    }

    syncSelectionToMap(mapId) {
        const map = this.workspace?.getMap(mapId);
        if (!map) return;
        const chapter = this.workspace.listChapters?.().find(item => item.id === map.chapterId) || null;
        const story = chapter
            ? this.workspace.listStories?.().find(item => item.id === chapter.storyId) || null
            : null;
        this.selectedStoryId = story?.id || this.selectedStoryId;
        this.selectedChapterId = chapter?.id || map.chapterId || this.selectedChapterId;
        this.selectedMapId = map.id;
        this.selectedNodeId = map.nodes?.[0]?.id || null;
        this.selectedEdgeId = map.edges?.[0]?.id || null;
        this.inspectorMode = this.selectedNodeId ? 'node' : 'edge';
    }

    getCurrentNode(map = null) {
        const currentMap = map || this.getCurrentMap();
        if (!currentMap || !this.selectedNodeId) return null;
        return asArray(currentMap.nodes).find(node => node.id === this.selectedNodeId) || null;
    }

    getCurrentEdge(map = null) {
        const currentMap = map || this.getCurrentMap();
        if (!currentMap || !this.selectedEdgeId) return null;
        return asArray(currentMap.edges).find(edge => edge.id === this.selectedEdgeId) || null;
    }

    getLevelDefinition(levelId) {
        const levels = asObject(this.levelsDocument?.levels || this.levelsDocument);
        return levels[levelId] || null;
    }

    getEnemyTemplate(templateId) {
        const enemies = asObject(this.enemiesDocument?.enemies || this.enemiesDocument);
        return enemies[templateId] || null;
    }

    getEnemyTemplateOptions() {
        const enemies = asObject(this.enemiesDocument?.enemies || this.enemiesDocument);
        return Object.values(enemies)
            .filter(enemy => enemy && typeof enemy.id === 'string' && enemy.id.trim())
            .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), 'zh-CN'));
    }

    getEnemyPoolForLevel(level) {
        const firstWave = asArray(level?.waves)[0] || null;
        const poolId = firstWave?.enemyPoolId || '';
        const enemyPools = asObject(this.levelsDocument?.enemyPools);
        return poolId && enemyPools[poolId] ? enemyPools[poolId] : null;
    }

    getPrimaryEnemyForCurrentNode() {
        const map = this.getCurrentMap();
        const node = this.getCurrentNode(map);
        const level = this.getLevelDefinition(node?.levelId);
        const wave = asArray(level?.waves)[0] || null;
        const pool = this.getEnemyPoolForLevel(level);
        const member = asArray(pool?.members)[0] || null;
        const templateId = member?.templateId || '';
        const enemy = this.getEnemyTemplate(templateId);
        return {
            map,
            node,
            level,
            wave,
            pool,
            member,
            templateId,
            enemy
        };
    }

    ensurePrimaryEnemyPoolForLevel(level) {
        if (!level || !this.levelsDocument) return null;
        if (!Array.isArray(level.waves)) {
            level.waves = [];
        }
        if (!level.waves[0]) {
            level.waves[0] = {
                waveId: 'wave_1',
                waveType: 'fixed',
                enemyPoolId: ''
            };
        }
        const wave = level.waves[0];
        if (!wave.enemyPoolId) {
            wave.enemyPoolId = `pool_${level.id || 'level'}_primary`;
        }
        if (!this.levelsDocument.enemyPools || typeof this.levelsDocument.enemyPools !== 'object' || Array.isArray(this.levelsDocument.enemyPools)) {
            this.levelsDocument.enemyPools = {};
        }
        if (!this.levelsDocument.enemyPools[wave.enemyPoolId]) {
            this.levelsDocument.enemyPools[wave.enemyPoolId] = {
                id: wave.enemyPoolId,
                name: `${level.name || level.id || '当前关卡'}敌人池`,
                members: []
            };
        }
        const pool = this.levelsDocument.enemyPools[wave.enemyPoolId];
        if (!Array.isArray(pool.members)) {
            pool.members = [];
        }
        if (!pool.members[0]) {
            pool.members[0] = { templateId: '', position: 1 };
        }
        return pool;
    }

    updateCurrentLevelPrimaryEnemyTemplate(templateId) {
        const enemy = this.getEnemyTemplate(templateId);
        const map = this.getCurrentMap();
        const node = this.getCurrentNode(map);
        const level = this.getLevelDefinition(node?.levelId);
        if (!node || !level || !enemy) {
            this.setStatus('无法切换本关敌人：当前节点、关卡或敌人模板不存在。');
            return false;
        }

        const pool = this.ensurePrimaryEnemyPoolForLevel(level);
        if (!pool) {
            this.setStatus('无法切换本关敌人：当前关卡缺少敌人池。');
            return false;
        }

        pool.members[0] = {
            ...pool.members[0],
            templateId,
            position: pool.members[0].position ?? 1
        };
        this.setStatus(`已切换本关敌人：${node.id} / ${level.id} -> ${enemy.name || enemy.id}。`);
        this.renderAll();
        return true;
    }

    setStatus(text) {
        if (this.elements.status) {
            this.elements.status.textContent = text;
        }
    }

    showDialog(id) {
        const dialog = this.elements[id];
        if (!dialog) return;
        if (typeof dialog.showModal === 'function') {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
    }

    closeDialog(id) {
        const dialog = this.elements[id];
        if (!dialog) return;
        if (typeof dialog.close === 'function') {
            dialog.close();
        } else {
            dialog.removeAttribute('open');
        }
    }

    openMapSettingsDialog() {
        if (!this.workspace || !this.selectedMapId) return;
        this.showDialog('mapSettingsDialog');
    }

    openExportMapDialog() {
        if (!this.workspace) return;
        this.syncPackagePathPreview();
        this.showDialog('exportMapDialog');
    }

    closeExportDialogWithStatus(text) {
        this.closeDialog('exportMapDialog');
        this.setStatus(text);
    }

    normalizePackageDirectory(value = '') {
        const text = String(value || '').trim().replace(/\\/g, '/');
        const fallback = 'assets/map_packs/current/story_pack_v1/';
        const normalized = text || fallback;
        return normalized.endsWith('/') ? normalized : `${normalized}/`;
    }

    getAuthoringPackageDirectoryFromForm() {
        const fallback = `assets/map_packs/authoring/${this.getPackageIdFromForm()}/`;
        return this.normalizePackageDirectory(this.elements.authoringPackageDirectoryInput?.value || fallback);
    }

    getRuntimePackageDirectoryFromForm() {
        const fallback = `assets/map_packs/current/${this.getPackageIdFromForm()}/`;
        return this.normalizePackageDirectory(this.elements.runtimePackageDirectoryInput?.value || fallback);
    }

    getPackageIdFromForm() {
        const fallback = this.workspace?.meta?.id || 'story_pack_v1';
        return this.elements.packageIdInput?.value?.trim() || fallback;
    }

    getPackageTitleFromForm() {
        const fallback = this.workspace?.meta?.title || this.getPackageIdFromForm();
        return this.elements.packageTitleInput?.value?.trim() || fallback;
    }

    getPackageDirectoryFromForm() {
        return this.normalizePackageDirectory(this.elements.packageDirectoryInput?.value);
    }

    setPackageDirectoryDefaults(packageId) {
        const safePackageId = String(packageId || 'story_pack_v1').trim() || 'story_pack_v1';
        if (this.elements.authoringPackageDirectoryInput) {
            this.elements.authoringPackageDirectoryInput.value = `assets/map_packs/authoring/${safePackageId}/`;
        }
        if (this.elements.runtimePackageDirectoryInput) {
            this.elements.runtimePackageDirectoryInput.value = `assets/map_packs/current/${safePackageId}/`;
        }
        if (this.elements.packageDirectoryInput) {
            this.elements.packageDirectoryInput.value = `assets/map_packs/current/${safePackageId}/`;
        }
        this.syncPackagePathPreview();
    }

    syncPackagePathPreview() {
        const authoringDirectory = this.getAuthoringPackageDirectoryFromForm();
        const runtimeDirectory = this.getRuntimePackageDirectoryFromForm();
        const directory = this.getPackageDirectoryFromForm();
        if (this.elements.authoringPackageDirectoryInput) {
            this.elements.authoringPackageDirectoryInput.value = authoringDirectory;
        }
        if (this.elements.runtimePackageDirectoryInput) {
            this.elements.runtimePackageDirectoryInput.value = runtimeDirectory;
        }
        if (this.elements.packageDirectoryInput) {
            this.elements.packageDirectoryInput.value = directory;
        }
        if (this.elements.authoringPackagePathPreview) {
            this.elements.authoringPackagePathPreview.textContent = `${authoringDirectory}package.json`;
        }
        if (this.elements.runtimePackagePathPreview) {
            this.elements.runtimePackagePathPreview.textContent = `${runtimeDirectory}package.json`;
        }
        if (this.elements.packagePathPreview) {
            this.elements.packagePathPreview.textContent = `${directory}package.json`;
        }
    }

    buildPackageBundleFromForm() {
        if (!this.workspace || typeof this.workspace.exportPackageBundle !== 'function') {
            throw new Error('当前工作区不支持目录式地图包导出。');
        }
        this.syncPackagePathPreview();
        return this.workspace.exportPackageBundle({
            packageId: this.getPackageIdFromForm(),
            packageTitle: this.getPackageTitleFromForm()
        });
    }

    buildPackageExportFiles(bundle = null) {
        const packageBundle = bundle || this.buildPackageBundleFromForm();
        return [
            {
                fileName: 'package.json',
                content: JSON.stringify(packageBundle.packageJson, null, 2)
            },
            {
                fileName: 'maps.json',
                content: JSON.stringify(packageBundle.mapsJson, null, 2)
            },
            {
                fileName: 'levels.json',
                content: JSON.stringify(packageBundle.levelsJson || this.levelsDocument || {}, null, 2)
            },
            {
                fileName: 'asset-manifest.json',
                content: JSON.stringify(packageBundle.assetManifest, null, 2)
            }
        ];
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
        const files = this.buildPackageExportFiles();
        files.forEach(file => this.downloadTextFile(file.fileName, file.content));
        this.setStatus(`已生成 ${files.length} 个包文件下载：package.json / maps.json / levels.json / asset-manifest.json。`);
    }

    async writePackageViaApi(endpoint, targetDirectory, statusPrefix) {
        if (typeof this.fetchImpl !== 'function') {
            throw new Error('缺少 fetch 实现，无法写入地图包目录。');
        }
        const files = this.buildPackageExportFiles();
        let response = null;
        try {
            response = await this.fetchImpl(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    targetDirectory: this.normalizePackageDirectory(targetDirectory),
                    files
                })
            });
        } catch (error) {
            throw new Error(`保存接口不可用：请确认后端服务已启动，并从 http://127.0.0.1:3121/test/level_map_editor_v1.html 打开地图编辑器。启动命令：PowerShell 使用 $env:PORT='3121'; node app.js，Bash 使用 PORT=3121 node app.js。原始错误：${error.message}`);
        }
        if (!response?.ok) {
            let message = response?.status ? `HTTP ${response.status}` : 'unknown';
            try {
                const payload = await response.json();
                if (payload?.error) {
                    message = payload.error;
                }
            } catch (error) {
                // Keep the HTTP status when response body is not JSON.
            }
            throw new Error(message);
        }
        this.setStatus(`${statusPrefix}：${this.normalizePackageDirectory(targetDirectory)}package.json`);
    }

    async saveAuthoringPackage() {
        await this.writePackageViaApi(
            '/api/level-map-packs/save',
            this.getAuthoringPackageDirectoryFromForm(),
            '已保存工作稿'
        );
        this.setStatus(`已保存工作稿：${this.getAuthoringPackageDirectoryFromForm()}package.json / maps.json / levels.json / asset-manifest.json`);
    }

    async publishRuntimePackage() {
        await this.writePackageViaApi(
            '/api/level-map-packs/publish',
            this.getRuntimePackageDirectoryFromForm(),
            '已发布到主流程'
        );
        this.setStatus(`已发布到主流程：${this.getRuntimePackageDirectoryFromForm()}package.json / maps.json / levels.json / asset-manifest.json`);
    }

    async selectPackageDirectory() {
        const picker = this.window?.showDirectoryPicker || globalThis.showDirectoryPicker;
        if (typeof picker !== 'function') {
            this.setStatus('当前浏览器不支持直接选择目录；请使用“下载包文件”后放入目标目录。');
            return null;
        }
        this.packageDirectoryHandle = await picker.call(this.window);
        const directoryName = this.packageDirectoryHandle?.name || this.getPackageIdFromForm();
        if (this.elements.packageIdInput && directoryName) {
            this.elements.packageIdInput.value = directoryName;
        }
        if (this.elements.packageDirectoryInput && directoryName) {
            this.elements.packageDirectoryInput.value = this.normalizePackageDirectory(`assets/map_packs/current/${directoryName}`);
        }
        this.syncPackagePathPreview();
        this.setStatus(`已选择包目录：${directoryName}`);
        return this.packageDirectoryHandle;
    }

    async writePackageDirectory() {
        if (!this.packageDirectoryHandle) {
            await this.selectPackageDirectory();
        }
        if (!this.packageDirectoryHandle) return;
        const files = this.buildPackageExportFiles();
        for (const file of files) {
            const fileHandle = await this.packageDirectoryHandle.getFileHandle(file.fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(file.content);
            await writable.close();
        }
        this.setStatus(`已写入所选包目录：${files.map(file => file.fileName).join(' / ')}。`);
    }

    renderAssetPreviewCard(host, title, asset) {
        if (!host) return;
        if (!asset) {
            host.innerHTML = `
                <div class="asset-preview-card is-empty">
                    <div class="asset-preview-card__thumb"></div>
                    <div class="asset-preview-card__meta">
                        <strong>${escapeHtml(title)}</strong>
                        <span>未绑定图片资源</span>
                    </div>
                </div>
            `;
            return;
        }

        const image = getLevelMapAssetImage(asset);
        host.innerHTML = `
            <div class="asset-preview-card">
                <div class="asset-preview-card__thumb" style="${image ? `background-image: url('${escapeHtml(image)}');` : ''}"></div>
                <div class="asset-preview-card__meta">
                    <strong>${escapeHtml(title)}</strong>
                    <span>${escapeHtml(getLevelMapAssetLabel(asset, asset.id))}</span>
                    <code>${escapeHtml(image || asset.id)}</code>
                </div>
            </div>
        `;
    }

    renderAll() {
        this.renderStoryList();
        this.renderChapterList();
        this.renderMapList();
        this.renderMapMeta();
        this.renderAvailableLevelsSummary();
        this.renderNodeList();
        this.renderEdgeList();
        this.renderValidationPanel();
        this.renderSelectedNode();
        this.renderSelectedEdge();
        this.renderInspectorMode();
        this.renderBackgroundPickerList();
        this.renderCanvas();
        this.renderCurrentLevelEnemyPanel();
        this.renderExportPreview();
        this.syncPackagePathPreview();
    }

    setInspectorMode(mode, options = {}) {
        this.inspectorMode = mode === 'edge' ? 'edge' : 'node';
        if (options.render !== false) {
            this.renderInspectorMode();
        }
    }

    renderInspectorMode() {
        const isNodeMode = this.inspectorMode !== 'edge';
        if (this.elements.inspectorModeLabel) {
            this.elements.inspectorModeLabel.textContent = isNodeMode ? 'node' : 'edge';
        }
        if (this.elements.nodeInspectorBtn) {
            this.elements.nodeInspectorBtn.setAttribute('aria-pressed', isNodeMode ? 'true' : 'false');
        }
        if (this.elements.edgeInspectorBtn) {
            this.elements.edgeInspectorBtn.setAttribute('aria-pressed', isNodeMode ? 'false' : 'true');
        }
        if (this.elements.nodeInspectorPanel) {
            this.elements.nodeInspectorPanel.hidden = !isNodeMode;
        }
        if (this.elements.edgeInspectorPanel) {
            this.elements.edgeInspectorPanel.hidden = isNodeMode;
        }
    }

    renderStoryList() {
        const host = this.elements.storyList;
        if (!host) return;
        host.innerHTML = '';

        if (!this.workspace || typeof this.workspace.listStories !== 'function') {
            host.textContent = '尚未加载故事包。';
            return;
        }

        const story = this.workspace.listStories()[0] || null;
        const packageId = this.getPackageIdFromForm();
        if (!story) {
            host.textContent = '当前地图包尚未建立故事信息。';
            return;
        }

        const item = createElement(this.document, 'div', 'story-list-item');
        item.setAttribute('aria-current', 'true');
        item.innerHTML = `
            <strong>${escapeHtml(story.title || story.id)}</strong>
            <span>一个地图包对应一个故事</span>
            <code>${escapeHtml(packageId)} / ${escapeHtml(story.id)}</code>
        `;
        host.appendChild(item);
        this.applyAdaptiveListHeight(host, 1, {
            minHeight: 112,
            rowHeight: 46,
            padding: 16,
            maxViewportRatio: 0.18,
            hardMax: 140
        });
    }

    applyAdaptiveListHeight(host, itemCount, options = {}) {
        if (!host) return;
        const minHeight = Math.max(0, Number(options.minHeight) || 112);
        const rowHeight = Math.max(24, Number(options.rowHeight) || 44);
        const padding = Math.max(0, Number(options.padding) || 16);
        const hardMax = Math.max(minHeight, Number(options.hardMax) || 280);
        const maxViewportRatio = Math.max(0.05, Math.min(1, Number(options.maxViewportRatio) || 0.26));
        const viewportHeight = Math.max(
            0,
            Number(this.window?.innerHeight)
            || Number(this.document?.documentElement?.clientHeight)
            || 0
        );
        const viewportCap = viewportHeight ? Math.round(viewportHeight * maxViewportRatio) : hardMax;
        const contentHeight = padding + Math.max(1, itemCount) * rowHeight;
        const nextHeight = Math.max(minHeight, Math.min(hardMax, viewportCap, contentHeight));
        host.style.maxHeight = `${nextHeight}px`;
        host.style.overflowY = 'auto';
    }

    scrollSelectedListItemIntoView(host) {
        const selected = host?.querySelector?.('[aria-current="true"]');
        if (!selected || typeof selected.scrollIntoView !== 'function') {
            return;
        }
        selected.scrollIntoView({ block: 'nearest' });
    }

    renderChapterList() {
        const host = this.elements.chapterList;
        if (!host) return;
        host.innerHTML = '';

        if (!this.workspace || typeof this.workspace.listChapters !== 'function') {
            host.textContent = '尚未加载章节。';
            return;
        }

        const chapters = this.selectedStoryId
            ? this.workspace.listChapters(this.selectedStoryId)
            : this.workspace.listChapters();
        if (!chapters.length) {
            host.textContent = '当前故事暂无章节。';
            return;
        }

        chapters.forEach((chapter) => {
            const button = createElement(this.document, 'button', 'chapter-list-item');
            button.type = 'button';
            button.textContent = `${chapter.title || chapter.id} | ${chapter.mapIds.length} 张地图`;
            if (chapter.id === this.selectedChapterId) {
                button.setAttribute('aria-current', 'true');
            }
            button.addEventListener('click', () => {
                this.selectedChapterId = chapter.id;
                this.selectedStoryId = chapter.storyId || this.selectedStoryId;
                const map = this.workspace.listMaps().find(item => chapter.mapIds.includes(item.id)) || null;
                if (map) {
                    this.syncSelectionToMap(map.id);
                } else {
                    this.selectedMapId = null;
                    this.selectedNodeId = null;
                    this.selectedEdgeId = null;
                }
                this.renderAll();
            });
            host.appendChild(button);
        });
        this.applyAdaptiveListHeight(host, chapters.length, {
            minHeight: 128,
            rowHeight: 46,
            padding: 18,
            maxViewportRatio: 0.25,
            hardMax: 300
        });
        this.scrollSelectedListItemIntoView(host);
    }

    renderMapList() {
        const host = this.elements.mapList;
        if (!host) return;
        host.innerHTML = '';

        if (!this.workspace) {
            host.textContent = '尚未加载地图包。';
            return;
        }

        const chapter = this.getCurrentChapter();
        const maps = chapter
            ? this.workspace.listMaps().filter(map => chapter.mapIds.includes(map.id))
            : this.workspace.listMaps();
        if (!maps.length) {
            host.textContent = '当前章节暂无地图。';
            return;
        }

        maps.forEach((map) => {
            const button = createElement(this.document, 'button', 'map-list-item');
            button.type = 'button';
            button.textContent = `${map.id} | ${map.name}`;
            if (map.id === this.selectedMapId) {
                button.setAttribute('aria-current', 'true');
            }
            button.addEventListener('click', () => {
                this.syncSelectionToMap(map.id);
                this.renderAll();
            });
            host.appendChild(button);
        });
        this.applyAdaptiveListHeight(host, maps.length, {
            minHeight: 128,
            rowHeight: 46,
            padding: 18,
            maxViewportRatio: 0.25,
            hardMax: 300
        });
        this.scrollSelectedListItemIntoView(host);
    }

    renderMapMeta() {
        const heading = this.elements.mapHeading;
        const host = this.elements.mapMeta;
        const packFacts = this.elements.packFacts;
        const previewArchiveNote = this.elements.previewArchiveNote;
        const backgroundSelect = this.elements.backgroundSelect;
        const backgroundAssetPreview = this.elements.backgroundAssetPreview;
        const entryNodeSelect = this.elements.entryNodeSelect;
        const backgroundFitSelect = this.elements.backgroundFitSelect;
        const logicalWidthInput = this.elements.logicalWidthInput;
        const logicalHeightInput = this.elements.logicalHeightInput;
        const viewportAspectSelect = this.elements.viewportAspectSelect;
        const nodeScaleInput = this.elements.nodeScaleInput;
        const edgeLabelModeSelect = this.elements.edgeLabelModeSelect;
        const nodeAnchorSelect = this.elements.nodeAnchorSelect;
        const edgeAnchorSelect = this.elements.edgeAnchorSelect;
        const map = this.getCurrentMap();
        if (!backgroundSelect || !entryNodeSelect) return;

        if (host) {
            host.innerHTML = '';
        }
        if (packFacts) {
            packFacts.innerHTML = '';
        }
        if (backgroundAssetPreview) {
            backgroundAssetPreview.innerHTML = '';
        }
        backgroundSelect.innerHTML = '';
        entryNodeSelect.innerHTML = '';
        if (backgroundFitSelect) {
            backgroundFitSelect.value = 'cover';
        }
        if (logicalWidthInput) {
            logicalWidthInput.value = '1600';
        }
        if (logicalHeightInput) {
            logicalHeightInput.value = '900';
        }
        if (viewportAspectSelect) {
            viewportAspectSelect.value = '16:9';
        }
        if (nodeScaleInput) {
            nodeScaleInput.value = '0.6';
        }
        if (edgeLabelModeSelect) {
            edgeLabelModeSelect.value = 'midpoint';
        }
        if (nodeAnchorSelect) {
            nodeAnchorSelect.value = 'center';
        }
        if (edgeAnchorSelect) {
            edgeAnchorSelect.value = 'center';
        }

        if (!map || !this.workspace) {
            if (heading) heading.textContent = '';
            if (previewArchiveNote) {
                previewArchiveNote.textContent = '收起抽屉可放大地图';
            }
            return;
        }

        const background = findLevelMapAsset(this.workspace.getBackgroundOptions(), map.backgroundRef);
        const display = normalizeMapDisplay(map);
        const space = normalizeMapSpace(map);

        if (heading) {
            heading.textContent = '';
        }
        if (host) {
            host.innerHTML = '';
        }

        if (packFacts) {
            packFacts.innerHTML = `
                <div><strong>Map ID</strong><span>${escapeHtml(map.id)}</span></div>
                <div><strong>Owner</strong><span>${escapeHtml(this.workspace.meta?.ownerNode || '-')}</span></div>
                <div><strong>Nodes / Edges</strong><span>${escapeHtml(asArray(map.nodes).length)} / ${escapeHtml(asArray(map.edges).length)}</span></div>
            `;
        }

        this.renderAssetPreviewCard(backgroundAssetPreview, '背景图资源', background);

        if (previewArchiveNote) {
            previewArchiveNote.textContent = '收起抽屉可放大地图';
        }

        this.workspace.getBackgroundOptions().forEach((background) => {
            const option = createElement(this.document, 'option');
            option.value = background.id;
            option.textContent = `${background.id} | ${background.label || background.id}`;
            if (background.id === map.backgroundRef) {
                option.selected = true;
            }
            backgroundSelect.appendChild(option);
        });

        map.nodes.forEach((node) => {
            const option = createElement(this.document, 'option');
            option.value = node.id;
            option.textContent = `${node.id} | ${node.label || node.title}`;
            if (node.id === map.entryNodeId) {
                option.selected = true;
            }
            entryNodeSelect.appendChild(option);
        });

        if (backgroundFitSelect) {
            backgroundFitSelect.value = display.backgroundFit;
        }
        if (logicalWidthInput) {
            logicalWidthInput.value = String(space.logicalWidth);
        }
        if (logicalHeightInput) {
            logicalHeightInput.value = String(space.logicalHeight);
        }
        if (viewportAspectSelect) {
            viewportAspectSelect.value = display.viewportAspect;
        }
        if (nodeScaleInput) {
            nodeScaleInput.value = String(display.nodeScale);
        }
        if (edgeLabelModeSelect) {
            edgeLabelModeSelect.value = display.edgeLabelMode;
        }
        if (nodeAnchorSelect) {
            nodeAnchorSelect.value = display.nodeAnchor;
        }
        if (edgeAnchorSelect) {
            edgeAnchorSelect.value = display.edgeAnchor;
        }
    }

    renderAvailableLevelsSummary() {
        const host = this.elements.availableLevelsSummary;
        if (!host || !this.workspace) return;
        host.textContent = this.workspace.getLevelIds().join(', ');
    }

    renderRouteLegend() {
        const host = this.elements.routeLegend;
        if (!host) return;
        host.innerHTML = '';
    }

    renderNodeList() {
        const host = this.elements.nodeList;
        if (!host) return;
        host.innerHTML = '';
        const map = this.getCurrentMap();
        if (!map) {
            host.textContent = '尚未选择地图。';
            return;
        }

        map.nodes.forEach((node) => {
            const button = createElement(this.document, 'button', 'node-list-item');
            button.type = 'button';
            button.textContent = `${node.id} | ${node.label} | ${node.levelId}`;
            if (node.id === this.selectedNodeId) {
                button.setAttribute('aria-current', 'true');
            }
            button.addEventListener('click', () => {
                this.selectedNodeId = node.id;
                this.setInspectorMode('node', { render: false });
                this.renderAll();
            });
            host.appendChild(button);
        });
        this.scrollSelectedListItemIntoView(host);
    }

    renderEdgeList() {
        const host = this.elements.edgeList;
        if (!host) return;
        host.innerHTML = '';
        const map = this.getCurrentMap();
        if (!map) {
            host.textContent = '尚未选择地图。';
            return;
        }

        map.edges.forEach((edge) => {
            const button = createElement(this.document, 'button', 'edge-list-item');
            button.type = 'button';
            button.textContent = `${edge.id} | ${edge.fromNodeId} -> ${edge.toNodeId}`;
            if (edge.id === this.selectedEdgeId) {
                button.setAttribute('aria-current', 'true');
            }
            button.addEventListener('click', () => {
                this.selectedEdgeId = edge.id;
                this.setInspectorMode('edge', { render: false });
                this.renderAll();
            });
            host.appendChild(button);
        });
        this.scrollSelectedListItemIntoView(host);
    }

    renderValidationPanel() {
        const host = this.elements.validationList;
        if (!host || !this.workspace) return;
        host.innerHTML = '';
        const issues = this.workspace.validateDocument();
        if (!issues.length) {
            host.textContent = '未发现结构问题。';
            return;
        }

        const list = createElement(this.document, 'ul', 'validation-issues');
        issues.forEach((issue) => {
            const item = createElement(this.document, 'li');
            item.textContent = `${issue.code} | ${issue.mapId || ''} | ${issue.nodeId || issue.edgeId || issue.entryNodeId || issue.levelId || issue.backgroundRef || issue.nodeArtRef || issue.portraitRef || ''}`;
            list.appendChild(item);
        });
        host.appendChild(list);
    }

    renderBackgroundPickerList() {
        const host = this.elements.backgroundPickerList;
        if (!host) return;
        host.innerHTML = '';
        if (!this.workspace) {
            host.textContent = '尚未加载背景资源库。';
            return;
        }

        const currentBackgroundRef = this.elements.backgroundSelect?.value
            || this.getCurrentMap()?.backgroundRef
            || '';
        this.workspace.getBackgroundOptions().forEach((background) => {
            const button = createElement(this.document, 'button', 'background-option');
            const image = getLevelMapAssetImage(background);
            button.type = 'button';
            button.dataset.backgroundId = background.id;
            button.innerHTML = `
                <span class="background-option__preview" style="${image ? `background-image: url('${escapeHtml(image)}');` : ''}"></span>
                <strong>${escapeHtml(background.id)}</strong>
                <span>${escapeHtml(background.label || background.id)}</span>
                <code>${escapeHtml(image || background.id)}</code>
            `;
            if (background.id === (this.pendingBackgroundRef || currentBackgroundRef)) {
                button.setAttribute('aria-current', 'true');
            }
            button.addEventListener('click', () => {
                this.pendingBackgroundRef = background.id;
                this.renderBackgroundPickerList();
            });
            host.appendChild(button);
        });
    }

    openBackgroundPickerDialog() {
        const map = this.getCurrentMap();
        if (!map || !this.workspace) return;
        this.pendingBackgroundRef = this.elements.backgroundSelect?.value || map.backgroundRef;
        this.renderBackgroundPickerList();
        this.showDialog('backgroundPickerDialog');
    }

    confirmBackgroundPicker() {
        if (!this.workspace || !this.pendingBackgroundRef) {
            this.closeDialog('backgroundPickerDialog');
            return;
        }
        if (this.elements.backgroundSelect) {
            this.elements.backgroundSelect.value = this.pendingBackgroundRef;
        }
        this.pendingBackgroundRef = null;
        this.closeDialog('backgroundPickerDialog');
        this.applyCurrentMapSettings({ silent: true });
    }

    renderSelectedNode() {
        const map = this.getCurrentMap();
        const node = this.getCurrentNode(map);
        const nodeLevelSelect = this.elements.nodeLevelIdSelect;
        const nodeSkinSelect = this.elements.nodeSkinSelect;
        const nodeArtSelect = this.elements.nodeArtSelect;
        const nodePortraitSelect = this.elements.nodePortraitSelect;
        if (!nodeLevelSelect || !nodeSkinSelect || !nodeArtSelect || !nodePortraitSelect) return;

        nodeLevelSelect.innerHTML = '';
        nodeSkinSelect.innerHTML = '';
        nodeArtSelect.innerHTML = '';
        nodePortraitSelect.innerHTML = '';

        if (!map || !node || !this.workspace) return;

        this.elements.selectedNodeId.textContent = node.id;
        this.elements.nodeIdInput.value = node.id;
        this.workspace.getLevelIds().forEach((levelId) => {
            const option = createElement(this.document, 'option');
            option.value = levelId;
            option.textContent = levelId;
            if (levelId === node.levelId) {
                option.selected = true;
            }
            nodeLevelSelect.appendChild(option);
        });
        this.workspace.getNodeSkinOptions().forEach((skin) => {
            const option = createElement(this.document, 'option');
            option.value = skin.id;
            option.textContent = `${skin.id} | ${skin.label || skin.id}`;
            if (skin.id === node.nodeSkinRef) {
                option.selected = true;
            }
            nodeSkinSelect.appendChild(option);
        });
        this.workspace.getNodeArtOptions().forEach((asset) => {
            const option = createElement(this.document, 'option');
            option.value = asset.id;
            option.textContent = `${asset.id} | ${asset.label || asset.id}`;
            if (asset.id === node.artRefs?.nodeArt) {
                option.selected = true;
            }
            nodeArtSelect.appendChild(option);
        });
        this.workspace.getPortraitOptions().forEach((asset) => {
            const option = createElement(this.document, 'option');
            option.value = asset.id;
            option.textContent = `${asset.id} | ${asset.label || asset.id}`;
            if (asset.id === node.artRefs?.portrait) {
                option.selected = true;
            }
            nodePortraitSelect.appendChild(option);
        });

        this.elements.nodeLabelInput.value = node.label;
        this.elements.nodeTitleInput.value = node.title;
        this.elements.nodeKindSelect.value = node.kind;
        this.elements.nodeXInput.value = String(node.position?.x ?? 0);
        this.elements.nodeYInput.value = String(node.position?.y ?? 0);
        this.elements.nodeObjectiveInput.value = node.objectiveText || '';
        this.elements.nodeDifficultyInput.value = node.difficultyLabel || '';
        this.elements.nodeRewardInput.value = asArray(node.rewardPreview).join('\n');

        const assets = resolveNodeVisualAssets(node, this.workspace.assetLibrary);
        this.renderAssetPreviewCard(this.elements.nodeAssetPreview, '节点素材图', assets.nodeArt);
        this.renderAssetPreviewCard(this.elements.nodePortraitPreview, '立绘图', assets.portrait);
    }

    renderSelectedEdge() {
        const map = this.getCurrentMap();
        const edge = this.getCurrentEdge(map);
        const edgeFromSelect = this.elements.edgeFromSelect;
        const edgeToSelect = this.elements.edgeToSelect;
        if (!edgeFromSelect || !edgeToSelect) return;

        edgeFromSelect.innerHTML = '';
        edgeToSelect.innerHTML = '';

        if (!map) return;

        map.nodes.forEach((node) => {
            const fromOption = createElement(this.document, 'option');
            fromOption.value = node.id;
            fromOption.textContent = `${node.id} | ${node.label || node.title}`;
            if (node.id === edge?.fromNodeId) {
                fromOption.selected = true;
            }
            edgeFromSelect.appendChild(fromOption);

            const toOption = createElement(this.document, 'option');
            toOption.value = node.id;
            toOption.textContent = `${node.id} | ${node.label || node.title}`;
            if (node.id === edge?.toNodeId) {
                toOption.selected = true;
            }
            edgeToSelect.appendChild(toOption);
        });

        if (!edge) return;
        this.elements.selectedEdgeId.textContent = edge.id;
        this.elements.edgeIdInput.value = edge.id;
        this.elements.edgeBranchLabelInput.value = edge.branchLabel || '';
    }

    renderCurrentLevelEnemyPanel() {
        const host = this.elements.currentLevelEnemyPanel;
        if (!host) return;

        const binding = this.getPrimaryEnemyForCurrentNode();
        const { node, level, pool, templateId, enemy } = binding;
        if (!node) {
            host.innerHTML = `
                <div class="current-enemy-panel__empty">
                    <strong>本关敌人</strong>
                    <span>尚未选择地图节点。</span>
                </div>
            `;
            return;
        }

        if (!level) {
            host.innerHTML = `
                <div class="current-enemy-panel__empty">
                    <strong>本关敌人</strong>
                    <span>${escapeHtml(node.id)} 未绑定可用 levelId：${escapeHtml(node.levelId || '-')}</span>
                </div>
            `;
            return;
        }

        if (!enemy) {
            host.innerHTML = `
                <div class="current-enemy-panel__empty">
                    <strong>本关敌人</strong>
                    <span>${escapeHtml(level.id)} 的首波敌人模板未找到：${escapeHtml(templateId || '未配置')}</span>
                </div>
            `;
            return;
        }

        const stats = asObject(enemy.stats);
        const skills = asArray(enemy.skills);
        const parts = asObject(enemy.bodyParts);
        const difficulty = level.selectionMeta?.difficultyLabel || node.difficultyLabel || '-';
        const enemyOptions = this.getEnemyTemplateOptions();
        const enemyOptionsHtml = enemyOptions
            .map((option) => `
                <option value="${escapeHtml(option.id)}"${option.id === templateId ? ' selected' : ''}>${escapeHtml(option.name || option.id)} / ${escapeHtml(option.id)}</option>
            `)
            .join('');
        const bodyPartRows = ['head', 'chest', 'abdomen', 'arm', 'leg']
            .map((partId) => {
                const part = asObject(parts[partId]);
                return `
                    <div class="enemy-part">
                        <strong>${escapeHtml(getBodyPartLabel(partId))} ${escapeHtml(part.current ?? 0)}/${escapeHtml(part.max ?? 0)}</strong>
                        <span>弱点 ${escapeHtml(part.weakness ?? 1)}</span>
                    </div>
                `;
            })
            .join('');
        const skillChips = skills.length
            ? skills.map(skill => `<span>${escapeHtml(skill)}</span>`).join('')
            : '<span>无技能</span>';

        host.innerHTML = `
            <div class="current-enemy-panel__head">
                <div>
                    <span class="section-kicker">当前节点关卡</span>
                    <h3>本关敌人</h3>
                </div>
                <div class="current-enemy-panel__controls">
                    <label class="current-enemy-picker">
                        <span>敌人模板</span>
                        <select id="currentEnemyTemplateSelect" aria-label="本关敌人模板">
                            ${enemyOptionsHtml}
                        </select>
                    </label>
                    <div class="current-enemy-panel__binding">
                        <span>${escapeHtml(node.id)} / ${escapeHtml(level.name || node.title || node.label || '-')}</span>
                        <code>${escapeHtml(node.levelId || '-')}</code>
                    </div>
                </div>
            </div>
            <div class="current-enemy-card">
                <div class="enemy-identity">
                    <strong>${escapeHtml(enemy.name || enemy.id)}</strong>
                    <span>${escapeHtml(enemy.race || '-')} / ${escapeHtml(enemy.class || '-')} / 难度 ${escapeHtml(difficulty)}</span>
                    <code>${escapeHtml(templateId || enemy.id)}${pool?.id ? ` · ${escapeHtml(pool.id)}` : ''}</code>
                </div>
                <div class="enemy-stats">
                    <div><strong>HP ${escapeHtml(stats.hp ?? 0)} / ${escapeHtml(stats.maxHp ?? stats.hp ?? 0)}</strong><span>生命</span></div>
                    <div><strong>AP ${escapeHtml(stats.ap ?? 0)}</strong><span>行动点</span></div>
                    <div><strong>${escapeHtml(stats.speed ?? 0)}</strong><span>速度</span></div>
                    <div><strong>${escapeHtml(skills.length)}</strong><span>技能数</span></div>
                </div>
                <div class="enemy-skills">${skillChips}</div>
                <div class="enemy-parts">${bodyPartRows}</div>
            </div>
        `;

        const enemyTemplateSelect = host.querySelector('#currentEnemyTemplateSelect');
        enemyTemplateSelect?.addEventListener('change', () => {
            this.updateCurrentLevelPrimaryEnemyTemplate(enemyTemplateSelect.value);
        });
    }

    renderCanvas() {
        const stage = this.elements.mapStage;
        const host = this.elements.mapCanvas;
        const map = this.getCurrentMap();
        if (!host || !stage) return;
        host.innerHTML = '';

        if (!map || !this.workspace) {
            stage.style.backgroundImage = '';
            return;
        }

        const stageLayers = buildStageImageLayers(map, this.workspace.assetLibrary);
        const display = normalizeMapDisplay(map);
        stage.style.backgroundImage = stageLayers.backgroundImage;
        stage.style.backgroundSize = stageLayers.backgroundSize;
        stage.style.backgroundPosition = stageLayers.backgroundPosition;
        stage.style.backgroundRepeat = stageLayers.backgroundRepeat;
        stage.style.aspectRatio = toCssAspectRatio(display.viewportAspect);
        stage.style.setProperty('--map-aspect-ratio', toAspectRatioNumber(display.viewportAspect).toFixed(6));

        const svg = createSvgElement(this.document, 'svg', 'map-edge-layer');
        const metrics = getCanvasMetrics(host, map, { width: 920, height: 520 });
        const canvasWidth = metrics.width;
        const canvasHeight = metrics.height;
        this.lastCanvasSizeKey = `${canvasWidth}x${canvasHeight}`;
        svg.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
        svg.setAttribute('width', String(canvasWidth));
        svg.setAttribute('height', String(canvasHeight));
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        const nodeMap = new Map(map.nodes.map(node => [node.id, node]));
        const projectedNodeMap = new Map(map.nodes.map(node => {
            const projectedPoint = projectPoint(node.position, metrics);
            return [node.id, resolveProjectedNodeFrame(projectedPoint, metrics.display)];
        }));

        map.edges.forEach((edge) => {
            const fromNode = nodeMap.get(edge.fromNodeId);
            const toNode = nodeMap.get(edge.toNodeId);
            const fromFrame = projectedNodeMap.get(edge.fromNodeId);
            const toFrame = projectedNodeMap.get(edge.toNodeId);
            if (!fromNode || !toNode || !fromFrame || !toFrame) return;
            const fromPoint = resolveEdgeAnchorPoint(fromFrame, metrics.display);
            const toPoint = resolveEdgeAnchorPoint(toFrame, metrics.display);
            const edgeGeometry = buildEdgeGeometry(fromPoint, toPoint);
            const edgeLabel = buildEdgeLabel(edge, fromNode, toNode);
            const edgePalette = buildEdgePalette(edge);
            const edgeGroup = createSvgElement(this.document, 'g', 'map-edge-group');
            edgeGroup.setAttribute('data-edge-id', edge.id);
            edgeGroup.style.setProperty('--edge-route', edgePalette.line);
            edgeGroup.style.setProperty('--edge-halo', edgePalette.halo);
            edgeGroup.style.setProperty('--edge-label-fill', edgePalette.labelFill);
            edgeGroup.style.setProperty('--edge-label-stroke', edgePalette.labelStroke);
            edgeGroup.style.setProperty('--edge-label-text', edgePalette.labelText);
            if (edge.id === this.selectedEdgeId) {
                edgeGroup.setAttribute('aria-current', 'true');
            }

            const haloPath = createSvgElement(this.document, 'path', 'map-edge-halo');
            haloPath.setAttribute('d', edgeGeometry.path);

            const path = createSvgElement(this.document, 'path', 'map-edge');
            path.setAttribute('d', edgeGeometry.path);

            const hitPath = createSvgElement(this.document, 'path', 'map-edge-hit');
            hitPath.setAttribute('d', edgeGeometry.path);

            const labelGroup = createSvgElement(this.document, 'g', 'map-edge-label');
            labelGroup.setAttribute('transform', `translate(${edgeGeometry.labelX} ${edgeGeometry.labelY})`);

            const labelWidth = String(Math.max(88, 32 + edgeLabel.length * 14));
            const labelPill = createSvgElement(this.document, 'rect', 'map-edge-label-pill');
            labelPill.setAttribute('x', String(Math.round(-Number(labelWidth) / 2)));
            labelPill.setAttribute('y', '-16');
            labelPill.setAttribute('width', labelWidth);
            labelPill.setAttribute('height', '32');
            labelPill.setAttribute('rx', '16');

            const labelText = createSvgElement(this.document, 'text', 'map-edge-label-text');
            labelText.setAttribute('text-anchor', 'middle');
            labelText.setAttribute('dominant-baseline', 'middle');
            labelText.textContent = edgeLabel;

            const selectEdge = (event) => {
                event?.stopPropagation?.();
                this.selectEdge(edge.id);
            };

            [edgeGroup, path, hitPath, labelGroup].forEach((element) => {
                element.addEventListener('click', selectEdge);
            });

            edgeGroup.appendChild(haloPath);
            edgeGroup.appendChild(path);
            edgeGroup.appendChild(hitPath);
            if (metrics.display.edgeLabelMode !== 'none') {
                labelGroup.appendChild(labelPill);
                labelGroup.appendChild(labelText);
                edgeGroup.appendChild(labelGroup);
            }
            svg.appendChild(edgeGroup);
        });
        host.appendChild(svg);

        map.nodes.forEach((node) => {
            const button = createElement(this.document, 'button', `map-node kind-${node.kind || 'battle'}`);
            const visualAssets = resolveNodeVisualAssets(node, this.workspace.assetLibrary);
            const nodePalette = buildPalette(node.artRefs?.nodeArt || node.id, 68, 58);
            const projectedPoint = projectPoint(node.position, metrics);
            button.type = 'button';
            button.dataset.nodeId = node.id;
            button.setAttribute('aria-label', `${node.label || node.id} ${node.title || node.levelId || ''}`.trim());
            button.style.left = `${projectedPoint.x}px`;
            button.style.top = `${projectedPoint.y}px`;
            button.style.setProperty('--node-glow', nodePalette.glow);
            button.style.setProperty('--node-border', nodePalette.border);
            button.style.setProperty('--node-accent', nodePalette.secondary);
            button.style.setProperty('--node-scale', String(metrics.display.nodeScale));
            button.style.transform = metrics.display.nodeAnchor === 'top-left'
                ? `translate(0px, 0px) scale(${metrics.display.nodeScale})`
                : `translate(-50%, -50%) scale(${metrics.display.nodeScale})`;
            button.innerHTML = `
                <span class="map-node__sprite"></span>
                <span class="map-node__kind-mark" aria-hidden="true">${escapeHtml(getNodeKindSymbol(node.kind))}</span>
                <span class="map-node__label">${escapeHtml(node.label || node.id)}</span>
            `;
            const artLayer = button.querySelector('.map-node__sprite');
            if (artLayer) {
                const artImage = getLevelMapAssetImage(visualAssets.nodeArt);
                artLayer.style.backgroundImage = artImage ? `url("${artImage}")` : '';
            }
            if (node.id === this.selectedNodeId) {
                button.setAttribute('aria-current', 'true');
            }
            button.addEventListener('click', () => {
                this.selectedNodeId = node.id;
                this.setInspectorMode('node', { render: false });
                this.renderAll();
            });
            button.addEventListener('mousedown', (event) => {
                this.beginNodeDrag(node.id, event);
            });
            host.appendChild(button);
        });
    }

    selectEdge(edgeId) {
        this.selectedEdgeId = edgeId;
        this.setInspectorMode('edge', { render: false });
        this.renderAll();
    }

    renderExportPreview() {
        if (!this.elements.exportPreview || !this.workspace) return;
        this.elements.exportPreview.value = JSON.stringify(this.workspace.exportDocument(), null, 2);
    }

    addStory() {
        this.setStatus('一个地图包对应一个故事；请新建地图包来创建另一条故事线。');
        this.renderAll();
    }

    ensureSelectedStoryId() {
        const story = this.workspace?.listStories?.()[0] || null;
        if (!story) {
            return '';
        }
        this.selectedStoryId = story.id;
        return story.id;
    }

    addChapter() {
        if (!this.workspace || typeof this.workspace.createChapter !== 'function') return;
        const storyId = this.ensureSelectedStoryId();
        if (!storyId) return;
        const chapters = this.workspace.listChapters(storyId);
        const title = this.elements.chapterTitleInput?.value?.trim() || `新章节 ${chapters.length + 1}`;
        const chapterId = this.workspace.createChapter(storyId, { title });
        this.selectedChapterId = chapterId;
        this.selectedMapId = null;
        this.selectedNodeId = null;
        this.selectedEdgeId = null;
        if (this.elements.chapterTitleInput) {
            this.elements.chapterTitleInput.value = '';
        }
        this.renderAll();
    }

    addMap() {
        if (!this.workspace || typeof this.workspace.createMap !== 'function') return;
        if (!this.selectedChapterId) {
            this.addChapter();
        }
        if (!this.selectedChapterId) return;
        const maps = this.workspace.listMaps();
        const name = this.elements.mapNameInput?.value?.trim() || `新地图 ${maps.length + 1}`;
        const mapId = this.workspace.createMap(this.selectedChapterId, { name });
        if (this.elements.mapNameInput) {
            this.elements.mapNameInput.value = '';
        }
        this.syncSelectionToMap(mapId);
        this.renderAll();
    }

    duplicateSelectedMap() {
        if (!this.workspace || !this.selectedMapId || typeof this.workspace.duplicateMap !== 'function') return;
        const mapId = this.workspace.duplicateMap(this.selectedMapId, {
            chapterId: this.selectedChapterId || this.getCurrentMap()?.chapterId
        });
        this.syncSelectionToMap(mapId);
        this.renderAll();
    }

    removeSelectedMap() {
        if (!this.workspace || !this.selectedMapId || typeof this.workspace.removeMap !== 'function') return;
        const chapterId = this.selectedChapterId || this.getCurrentMap()?.chapterId || '';
        const removedMapId = this.selectedMapId;
        this.workspace.removeMap(removedMapId);
        const chapter = chapterId
            ? this.workspace.listChapters?.().find(item => item.id === chapterId) || null
            : null;
        const nextMap = chapter
            ? this.workspace.listMaps().find(item => chapter.mapIds.includes(item.id)) || null
            : this.workspace.listMaps()[0] || null;
        if (nextMap) {
            this.syncSelectionToMap(nextMap.id);
        } else {
            this.selectedMapId = null;
            this.selectedNodeId = null;
            this.selectedEdgeId = null;
            this.selectedChapterId = chapter?.id || this.selectedChapterId;
        }
        this.renderAll();
    }

    addNode() {
        if (!this.workspace || !this.selectedMapId) return;
        this.selectedNodeId = this.workspace.createNode(this.selectedMapId, {});
        this.setInspectorMode('node', { render: false });
        this.renderAll();
    }

    removeSelectedNode() {
        if (!this.workspace || !this.selectedMapId || !this.selectedNodeId) return;
        this.workspace.removeNode(this.selectedMapId, this.selectedNodeId);
        const currentMap = this.getCurrentMap();
        this.selectedNodeId = currentMap?.nodes?.[0]?.id || null;
        this.selectedEdgeId = currentMap?.edges?.[0]?.id || null;
        this.setInspectorMode(this.selectedNodeId ? 'node' : 'edge', { render: false });
        this.renderAll();
    }

    saveCurrentNode() {
        if (!this.workspace || !this.selectedMapId || !this.selectedNodeId) return;
        const nodeId = this.selectedNodeId;
        this.workspace.updateNode(this.selectedMapId, nodeId, () => ({
            id: this.elements.nodeIdInput.value.trim() || nodeId,
            levelId: this.elements.nodeLevelIdSelect.value.trim(),
            label: this.elements.nodeLabelInput.value.trim(),
            title: this.elements.nodeTitleInput.value.trim(),
            kind: this.elements.nodeKindSelect.value.trim(),
            nodeSkinRef: this.elements.nodeSkinSelect.value.trim(),
            artRefs: {
                nodeArt: this.elements.nodeArtSelect.value.trim(),
                portrait: this.elements.nodePortraitSelect.value.trim()
            },
            position: {
                x: Number(this.elements.nodeXInput.value),
                y: Number(this.elements.nodeYInput.value)
            },
            objectiveText: this.elements.nodeObjectiveInput.value,
            difficultyLabel: this.elements.nodeDifficultyInput.value,
            rewardPreview: splitTextList(this.elements.nodeRewardInput.value)
        }));
        const currentMap = this.getCurrentMap();
        const savedNode = currentMap?.nodes?.find(node => node.id === this.elements.nodeIdInput.value.trim()) || null;
        if (savedNode) {
            this.selectedNodeId = savedNode.id;
        }
        this.setInspectorMode('node', { render: false });
        this.renderAll();
    }

    moveSelectedNodeTo(x, y) {
        if (!this.workspace || !this.selectedMapId || !this.selectedNodeId) return;
        this.workspace.moveNode(this.selectedMapId, this.selectedNodeId, { x, y });
        this.renderAll();
    }

    beginNodeDrag(nodeId, event) {
        if (!this.workspace || !this.selectedMapId) return;
        const map = this.getCurrentMap();
        const node = asArray(map?.nodes).find(item => item.id === nodeId);
        if (!node) return;

        const metrics = getCanvasMetrics(this.elements.mapCanvas, map, { width: 920, height: 520 });
        const projected = projectPoint(node.position, metrics);
        this.dragState = {
            nodeId,
            offsetX: projected.x - (event.clientX - metrics.rect.left),
            offsetY: projected.y - (event.clientY - metrics.rect.top)
        };
        this.selectedNodeId = nodeId;
        event.preventDefault();
    }

    handleDocumentMouseMove(event) {
        if (!this.dragState || !this.workspace || !this.selectedMapId) return;
        const map = this.getCurrentMap();
        const metrics = getCanvasMetrics(this.elements.mapCanvas, map, { width: 920, height: 520 });
        const projectedPoint = {
            x: Math.round(event.clientX - metrics.rect.left + this.dragState.offsetX),
            y: Math.round(event.clientY - metrics.rect.top + this.dragState.offsetY)
        };
        const logicalPoint = unprojectPoint(projectedPoint, metrics);
        this.workspace.moveNode(this.selectedMapId, this.dragState.nodeId, logicalPoint);
        this.selectedNodeId = this.dragState.nodeId;
        this.renderAll();
    }

    handleDocumentMouseUp() {
        this.dragState = null;
    }

    addEdge() {
        if (!this.workspace || !this.selectedMapId) return;
        const map = this.getCurrentMap();
        if (!map?.nodes?.length) return;
        const fallbackFrom = map.nodes[0].id;
        const fallbackTo = map.nodes[Math.min(1, map.nodes.length - 1)].id || fallbackFrom;
        this.selectedEdgeId = this.workspace.createEdge(this.selectedMapId, {
            fromNodeId: fallbackFrom,
            toNodeId: fallbackTo,
            branchLabel: ''
        });
        this.setInspectorMode('edge', { render: false });
        this.renderAll();
    }

    removeSelectedEdge() {
        if (!this.workspace || !this.selectedMapId || !this.selectedEdgeId) return;
        this.workspace.removeEdge(this.selectedMapId, this.selectedEdgeId);
        const currentMap = this.getCurrentMap();
        this.selectedEdgeId = currentMap?.edges?.[0]?.id || null;
        this.setInspectorMode(currentMap?.edges?.length ? 'edge' : 'node', { render: false });
        this.renderAll();
    }

    saveCurrentEdge() {
        if (!this.workspace || !this.selectedMapId || !this.selectedEdgeId) return;
        const edgeId = this.selectedEdgeId;
        this.workspace.updateEdge(this.selectedMapId, edgeId, () => ({
            id: this.elements.edgeIdInput.value.trim() || edgeId,
            fromNodeId: this.elements.edgeFromSelect.value.trim(),
            toNodeId: this.elements.edgeToSelect.value.trim(),
            branchLabel: this.elements.edgeBranchLabelInput.value.trim()
        }));
        const currentMap = this.getCurrentMap();
        const savedEdge = currentMap?.edges?.find(edge => edge.id === this.elements.edgeIdInput.value.trim()) || null;
        if (savedEdge) {
            this.selectedEdgeId = savedEdge.id;
        }
        this.setInspectorMode('edge', { render: false });
        this.renderAll();
    }

    applyCurrentMapSettings(options = {}) {
        if (!this.workspace || !this.selectedMapId) return;
        this.workspace.updateMap(this.selectedMapId, (map) => ({
            ...map,
            backgroundRef: this.elements.backgroundSelect?.value || map.backgroundRef,
            entryNodeId: this.elements.entryNodeSelect?.value || map.entryNodeId,
            space: {
                ...normalizeMapSpace(map),
                logicalWidth: Math.max(1, Math.round(toFiniteNumber(this.elements.logicalWidthInput?.value, normalizeMapSpace(map).logicalWidth))),
                logicalHeight: Math.max(1, Math.round(toFiniteNumber(this.elements.logicalHeightInput?.value, normalizeMapSpace(map).logicalHeight)))
            },
            display: {
                ...normalizeMapDisplay(map),
                viewportAspect: normalizeViewportAspect(this.elements.viewportAspectSelect?.value, normalizeMapDisplay(map).viewportAspect),
                backgroundFit: this.elements.backgroundFitSelect?.value || normalizeMapDisplay(map).backgroundFit,
                nodeScale: clampNodeScale(this.elements.nodeScaleInput?.value, normalizeMapDisplay(map).nodeScale),
                edgeLabelMode: this.elements.edgeLabelModeSelect?.value || normalizeMapDisplay(map).edgeLabelMode,
                nodeAnchor: this.elements.nodeAnchorSelect?.value || normalizeMapDisplay(map).nodeAnchor,
                edgeAnchor: this.elements.edgeAnchorSelect?.value || normalizeMapDisplay(map).edgeAnchor
            }
        }));
        if (!options.silent) {
            this.closeDialog('mapSettingsDialog');
        }
        this.renderAll();
    }

    saveCurrentMapMeta() {
        this.applyCurrentMapSettings();
    }
}

export default LevelMapEditorPage;
