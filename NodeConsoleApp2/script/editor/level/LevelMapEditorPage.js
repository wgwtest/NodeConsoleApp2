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
    if (kind === 'boss') return '首领节点';
    if (kind === 'event') return '事件节点';
    return '战斗节点';
}

function buildEdgePalette(edge) {
    const base = buildPalette(`${edge?.type || 'branch'}:${edge?.branchLabel || edge?.id || 'route'}`, edge?.type === 'merge' ? 60 : 76, edge?.type === 'merge' ? 50 : 58);
    return {
        line: base.secondary,
        halo: base.glow,
        labelFill: base.surface,
        labelStroke: base.border,
        labelText: base.text,
        legendGlow: base.mist
    };
}

export class LevelMapEditorPage {
    constructor(options = {}) {
        this.document = options.document || globalThis.document;
        this.window = options.window || this.document?.defaultView || globalThis.window;
        this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
        this.workspaceFactory = options.workspaceFactory;
        this.mapSourceUrl = options.mapSourceUrl || '../assets/data/level_map_pack_v1.example.json';
        this.levelSourceUrl = options.levelSourceUrl || '../assets/data/levels.json';
        this.ResizeObserverImpl = options.ResizeObserverImpl
            || this.window?.ResizeObserver
            || globalThis.ResizeObserver;

        this.workspace = null;
        this.selectedMapId = null;
        this.selectedNodeId = null;
        this.selectedEdgeId = null;
        this.inspectorMode = 'node';
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
            'loadDefaultBtn',
            'addNodeBtn',
            'removeNodeBtn',
            'saveNodeBtn',
            'addEdgeBtn',
            'removeEdgeBtn',
            'saveEdgeBtn',
            'saveMapBtn',
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
            'previewArchiveNote',
            'nodeInspectorBtn',
            'edgeInspectorBtn',
            'inspectorModeLabel',
            'nodeInspectorPanel',
            'edgeInspectorPanel',
            'backgroundSelect',
            'backgroundAssetPreview',
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
            'edgeTypeSelect',
            'edgeBranchLabelInput',
            'exportPreview'
        ];

        ids.forEach((id) => {
            this.elements[id] = this.document.getElementById(id);
        });

        this.bindAction('loadDefaultBtn', () => this.loadDefaultDocuments());
        this.bindAction('addNodeBtn', () => this.addNode());
        this.bindAction('removeNodeBtn', () => this.removeSelectedNode());
        this.bindAction('saveNodeBtn', () => this.saveCurrentNode());
        this.bindAction('addEdgeBtn', () => this.addEdge());
        this.bindAction('removeEdgeBtn', () => this.removeSelectedEdge());
        this.bindAction('saveEdgeBtn', () => this.saveCurrentEdge());
        this.bindAction('saveMapBtn', () => this.saveCurrentMapMeta());
        this.bindAction('nodeInspectorBtn', () => this.setInspectorMode('node'));
        this.bindAction('edgeInspectorBtn', () => this.setInspectorMode('edge'));

        this.document.addEventListener('mousemove', this.handleDocumentMouseMove);
        this.document.addEventListener('mouseup', this.handleDocumentMouseUp);
        this.window?.addEventListener?.('resize', this.handleViewportResize);
        this.bindCanvasResizeObserver();
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

    async loadDefaultDocuments() {
        if (typeof this.fetchImpl !== 'function') {
            throw new Error('缺少 fetch 实现，无法加载默认地图包。');
        }

        this.setStatus('正在加载地图包与关卡定义...');
        const [mapResponse, levelResponse] = await Promise.all([
            this.fetchImpl(this.mapSourceUrl, { cache: 'no-store' }),
            this.fetchImpl(this.levelSourceUrl, { cache: 'no-store' })
        ]);

        if (!mapResponse?.ok) {
            throw new Error(`地图包加载失败: ${mapResponse?.status || 'unknown'}`);
        }
        if (!levelResponse?.ok) {
            throw new Error(`关卡定义加载失败: ${levelResponse?.status || 'unknown'}`);
        }

        const [rawMapPack, rawLevels] = await Promise.all([
            mapResponse.json(),
            levelResponse.json()
        ]);

        this.loadDocuments(rawMapPack, rawLevels);
        this.setStatus('已加载地图包与关卡定义。');
    }

    loadDocuments(rawMapPack, rawLevels) {
        if (typeof this.workspaceFactory !== 'function') {
            throw new Error('缺少 workspaceFactory，无法创建地图编辑工作区。');
        }

        this.workspace = this.workspaceFactory(rawMapPack, rawLevels);
        const firstMap = this.workspace.listMaps()[0] || null;
        this.selectedMapId = firstMap?.id || null;
        this.selectedNodeId = firstMap?.nodes?.[0]?.id || null;
        this.selectedEdgeId = firstMap?.edges?.[0]?.id || null;
        this.inspectorMode = this.selectedNodeId ? 'node' : 'edge';
        this.renderAll();
    }

    getCurrentMap() {
        if (!this.workspace || !this.selectedMapId) return null;
        return this.workspace.getMap(this.selectedMapId);
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

    setStatus(text) {
        if (this.elements.status) {
            this.elements.status.textContent = text;
        }
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
        this.renderMapList();
        this.renderMapMeta();
        this.renderAvailableLevelsSummary();
        this.renderNodeList();
        this.renderEdgeList();
        this.renderValidationPanel();
        this.renderSelectedNode();
        this.renderSelectedEdge();
        this.renderInspectorMode();
        this.renderCanvas();
        this.renderExportPreview();
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

    renderMapList() {
        const host = this.elements.mapList;
        if (!host) return;
        host.innerHTML = '';

        if (!this.workspace) {
            host.textContent = '尚未加载地图包。';
            return;
        }

        this.workspace.listMaps().forEach((map) => {
            const button = createElement(this.document, 'button', 'map-list-item');
            button.type = 'button';
            button.textContent = `${map.id} | ${map.name}`;
            if (map.id === this.selectedMapId) {
                button.setAttribute('aria-current', 'true');
            }
            button.addEventListener('click', () => {
                this.selectedMapId = map.id;
                this.selectedNodeId = map.nodes[0]?.id || null;
                this.selectedEdgeId = map.edges[0]?.id || null;
                this.renderAll();
            });
            host.appendChild(button);
        });
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
                previewArchiveNote.textContent = 'WBS-3.2.3.1 历史验证资产：地图组织预览页已归档保留，不再作为当前编辑入口。';
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
                <div><strong>资源方案</strong><span>地图包 = JSON + image assets；maps 只保存 ref，图片路径集中维护在 assetLibrary。</span></div>
            `;
        }

        this.renderAssetPreviewCard(backgroundAssetPreview, '背景图资源', background);

        if (previewArchiveNote) {
            previewArchiveNote.textContent = 'WBS-3.2.3.1 历史验证资产：`level_map_selection_mock.html` 仅保留为归档验证页，不再作为当前编辑流程入口。';
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
        this.elements.edgeTypeSelect.value = edge.type;
        this.elements.edgeBranchLabelInput.value = edge.branchLabel || '';
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
        stage.style.backgroundImage = stageLayers.backgroundImage;
        stage.style.backgroundSize = stageLayers.backgroundSize;
        stage.style.backgroundPosition = stageLayers.backgroundPosition;
        stage.style.backgroundRepeat = stageLayers.backgroundRepeat;
        stage.style.aspectRatio = toCssAspectRatio(normalizeMapDisplay(map).viewportAspect);

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
            edgeGroup.setAttribute('data-edge-type', edge.type || 'branch');
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
            type: 'branch',
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
            type: this.elements.edgeTypeSelect.value.trim(),
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

    saveCurrentMapMeta() {
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
        this.renderAll();
    }
}

export default LevelMapEditorPage;
