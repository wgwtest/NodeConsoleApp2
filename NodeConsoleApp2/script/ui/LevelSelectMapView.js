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

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function findAsset(collection, assetId) {
    if (!assetId) return null;
    return asArray(collection).find(asset => asset?.id === assetId) || null;
}

function getAssetImage(asset) {
    return asset?.src || asset?.thumbnailSrc || '';
}

function normalizeViewportAspect(value, fallback = '16:9') {
    const text = typeof value === 'string' ? value.trim() : '';
    return /^\d+\s*:\s*\d+$/u.test(text) ? text.replace(/\s+/gu, '') : fallback;
}

function toCssAspectRatio(value, fallback = '16:9') {
    return normalizeViewportAspect(value, fallback).replace(':', ' / ');
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
        nodeScale: Math.min(2, Math.max(0.1, toFiniteNumber(source.nodeScale, 0.6))),
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

function normalizeNodePosition(node) {
    const source = asObject(node);
    const position = asObject(source.position);
    return {
        x: toFiniteNumber(position.x, toFiniteNumber(source.x, 0)),
        y: toFiniteNumber(position.y, toFiniteNumber(source.y, 0))
    };
}

function getCanvasMetrics(host, map, fallbackSize = { width: 960, height: 540 }) {
    const rect = typeof host?.getBoundingClientRect === 'function'
        ? host.getBoundingClientRect()
        : null;
    const width = Math.max(1, Math.round(host?.clientWidth || rect?.width || fallbackSize.width));
    const height = Math.max(1, Math.round(host?.clientHeight || rect?.height || fallbackSize.height));
    return {
        width,
        height,
        space: normalizeMapSpace(map),
        display: normalizeMapDisplay(map)
    };
}

function projectPoint(point, metrics) {
    const position = normalizeNodePosition({ position: point });
    return {
        x: Math.round((position.x / metrics.space.logicalWidth) * metrics.width),
        y: Math.round((position.y / metrics.space.logicalHeight) * metrics.height)
    };
}

function getNodeVisualSize(display) {
    return 168 * display.nodeScale;
}

function resolveNodeFrame(projectedPoint, display) {
    const size = getNodeVisualSize(display);
    const half = size / 2;
    const topLeft = display.nodeAnchor === 'top-left'
        ? { x: projectedPoint.x, y: projectedPoint.y }
        : { x: projectedPoint.x - half, y: projectedPoint.y - half };
    const center = display.nodeAnchor === 'top-left'
        ? { x: projectedPoint.x + half, y: projectedPoint.y + half }
        : { x: projectedPoint.x, y: projectedPoint.y };
    return { topLeft, center };
}

function resolveEdgeAnchorPoint(nodeFrame, display) {
    return display.edgeAnchor === 'top-left' ? nodeFrame.topLeft : nodeFrame.center;
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatZoom(value) {
    return clampNumber(value, 0.5, 1.8).toFixed(2);
}

function buildStageImageLayers(map, assetLibrary) {
    const background = findAsset(assetLibrary?.backgrounds, map?.backgroundRef || '');
    const backgroundImage = getAssetImage(background);
    const previewGradient = background?.previewGradient || 'linear-gradient(180deg, rgba(8, 17, 28, 0.34), rgba(8, 17, 28, 0.14))';
    const display = normalizeMapDisplay(map);
    const layers = [
        'radial-gradient(circle at 20% 18%, rgba(255,255,255,0.14), transparent 18%)',
        'linear-gradient(180deg, rgba(7, 10, 16, 0.18), rgba(7, 10, 16, 0.48))',
        previewGradient
    ];
    if (backgroundImage) {
        layers.unshift(`url("${backgroundImage}")`);
    }
    return {
        backgroundImage: layers.join(', '),
        backgroundSize: backgroundImage ? `${display.backgroundFit}, auto, auto, auto` : 'auto, auto, auto',
        backgroundPosition: backgroundImage ? 'center center, center, center, center' : 'center, center, center',
        backgroundRepeat: backgroundImage ? 'no-repeat, no-repeat, no-repeat, no-repeat' : 'no-repeat, no-repeat, no-repeat'
    };
}

function createElement(doc, tagName, className = '') {
    const element = doc.createElement(tagName);
    if (className) element.className = className;
    return element;
}

function createSvgElement(doc, tagName, className = '') {
    const element = doc.createElementNS('http://www.w3.org/2000/svg', tagName);
    if (className) element.setAttribute('class', className);
    return element;
}

function buildNodePayload(map, node) {
    return {
        mapId: map?.id || '',
        nodeId: node?.id || '',
        levelId: node?.selectLevelId || node?.levelId || '',
        sourceLevelId: node?.levelId || ''
    };
}

function resolveNodeTitle(node) {
    return node?.levelName || node?.title || node?.levelId || '';
}

export class LevelSelectMapView {
    constructor(options = {}) {
        this.document = options.document || globalThis.document;
        this.window = this.document?.defaultView || globalThis.window || null;
        this.onSelectNode = typeof options.onSelectNode === 'function' ? options.onSelectNode : null;
        this.onConfirmNode = typeof options.onConfirmNode === 'function' ? options.onConfirmNode : null;
        this.onSelectMap = typeof options.onSelectMap === 'function' ? options.onSelectMap : null;
        this.currentMapId = '';
        this.selectedNodeId = '';
        this._host = null;
        this._model = null;
        this._activeMap = null;
        this._root = null;
        this._viewport = null;
        this._surface = null;
        this._drawer = null;
        this._confirmButton = null;
        this._dragState = null;
        this._viewState = {
            zoom: 1,
            panX: 0,
            panY: 0
        };
        this._bound = {
            onWindowMouseMove: this._handleViewportMouseMove.bind(this),
            onWindowMouseUp: this._handleViewportMouseUp.bind(this)
        };
    }

    getRuntimeMaps(model) {
        const currentMap = model?.map || null;
        const maps = asArray(model?.maps);
        if (maps.length > 0) return maps;
        if (!currentMap) return [];
        return [{
            id: currentMap.id || '',
            name: currentMap.name || '',
            chapterId: currentMap.chapterId || '',
            chapterLabel: currentMap.chapterLabel || '',
            chapterTitle: currentMap.chapterTitle || '',
            backgroundRef: currentMap.backgroundRef || '',
            nodeCount: asArray(currentMap.nodes).length,
            unlockedNodeCount: asArray(currentMap.nodes).filter(node => node.isUnlocked).length,
            completedNodeCount: asArray(currentMap.nodes).filter(node => node.isCompleted).length,
            isActive: true
        }];
    }

    resolveActiveMap(model) {
        const maps = this.getRuntimeMaps(model);
        const currentMap = model?.map || null;
        const activeMapId = this.currentMapId
            || maps.find(map => map.isActive)?.id
            || currentMap?.id
            || maps[0]?.id
            || '';
        const activeSummary = maps.find(map => map.id === activeMapId) || maps[0] || null;
        const candidateMap = activeSummary?.id === currentMap?.id
            ? currentMap
            : asArray(model?.mapPackMaps).find(map => map.id === activeSummary?.id);
        return {
            maps,
            activeMapId: activeSummary?.id || currentMap?.id || '',
            map: candidateMap || currentMap
        };
    }

    resolveDefaultNode(map, model) {
        if (!map || !Array.isArray(map.nodes)) return null;
        return map.nodes.find(node => node.id === this.selectedNodeId)
            || map.nodes.find(node => node.id === model?.selectedNodeId)
            || map.nodes.find(node => node.id === model?.recommendedNodeId)
            || map.nodes.find(node => node.status === 'recommended')
            || map.nodes.find(node => node.status === 'unlocked')
            || map.nodes.find(node => node.status === 'completed')
            || map.nodes[0]
            || null;
    }

    renderMapSwitcher(root, maps, activeMapId) {
        if (maps.length <= 1) return null;
        const switcher = createElement(this.document, 'div', 'level-map-switcher');
        switcher.setAttribute('role', 'tablist');
        switcher.setAttribute('aria-label', '地图切换');
        maps.forEach((map, index) => {
            const button = createElement(this.document, 'button', 'level-map-switcher__button');
            button.type = 'button';
            button.setAttribute('role', 'tab');
            button.dataset.mapId = map.id || '';
            button.dataset.index = String(index + 1);
            button.setAttribute('aria-pressed', map.id === activeMapId ? 'true' : 'false');
            button.setAttribute('aria-selected', map.id === activeMapId ? 'true' : 'false');
            button.innerHTML = `
                <span class="level-map-switcher__chapter">${escapeHtml(map.chapterLabel || map.name || map.id)}</span>
                <strong>${escapeHtml(map.chapterTitle || map.name || '')}</strong>
                <span class="level-map-switcher__progress">${escapeHtml(map.unlockedNodeCount ?? 0)}/${escapeHtml(map.nodeCount ?? 0)}</span>
            `;
            button.addEventListener('click', () => {
                if (!map.id || map.id === activeMapId) return;
                this.currentMapId = map.id;
                this.selectedNodeId = '';
                this._resetViewport();
                if (this.onSelectMap) {
                    this.onSelectMap({ mapId: map.id });
                }
                this.render(this._host || root.parentElement, {
                    ...root.__levelSelectMapModel,
                    map: root.__levelSelectMapModel?.mapPackMaps?.find(item => item.id === map.id)
                        || root.__levelSelectMapModel?.map
                });
            });
            switcher.appendChild(button);
        });
        root.appendChild(switcher);
        return switcher;
    }

    renderControls(root) {
        const controls = createElement(this.document, 'div', 'level-select-runtime-map__controls');
        const items = [
            ['zoom-out', '−', '缩小地图'],
            ['fit-viewport', '◎', '适配视图'],
            ['zoom-in', '+', '放大地图']
        ];
        items.forEach(([action, label, ariaLabel]) => {
            const button = createElement(this.document, 'button', 'level-map-control');
            button.type = 'button';
            button.dataset.action = action;
            button.textContent = label;
            button.setAttribute('aria-label', ariaLabel);
            button.title = ariaLabel;
            button.addEventListener('click', () => {
                if (action === 'zoom-in') this._setZoom(this._viewState.zoom + 0.1);
                if (action === 'zoom-out') this._setZoom(this._viewState.zoom - 0.1);
                if (action === 'fit-viewport') this._resetViewport();
            });
            controls.appendChild(button);
        });
        root.appendChild(controls);
        return controls;
    }

    render(host, model) {
        if (!host) return null;
        this._detachGlobalListeners();
        host.innerHTML = '';
        this._host = host;
        const normalizedModel = {
            ...asObject(model),
            mapPackMaps: asArray(model?.mapPackMaps)
        };
        if (normalizedModel.map && normalizedModel.mapPackMaps.length === 0) {
            normalizedModel.mapPackMaps = [normalizedModel.map];
        }

        const active = this.resolveActiveMap(normalizedModel);
        const map = active.map;
        if (!map || !Array.isArray(map.nodes) || map.nodes.length === 0) {
            return this.renderEmpty(host);
        }

        const selectedNode = this.resolveDefaultNode(map, normalizedModel);
        this.selectedNodeId = selectedNode?.id || '';
        this._model = {
            ...normalizedModel,
            map,
            maps: active.maps,
            mapPackMaps: normalizedModel.mapPackMaps,
            selectedNodeId: this.selectedNodeId
        };
        this._activeMap = map;

        const root = createElement(this.document, 'section', 'level-select-runtime-map summary-section');
        root.dataset.summaryKind = 'story-progress';
        root.dataset.mapId = map.id || '';
        root.dataset.zoom = formatZoom(this._viewState.zoom);
        root.__levelSelectMapModel = this._model;
        this._root = root;

        const overview = asObject(model?.overview);
        const heading = [map.chapterLabel || overview.chapterLabel, map.chapterTitle || overview.chapterTitle]
            .filter(Boolean)
            .join(' · ');
        root.innerHTML = `
            <div class="level-select-runtime-map__header">
                <div>
                    <div class="level-select-runtime-map__eyebrow">章节地图</div>
                    <h3>${escapeHtml(heading || map.name || '故事地图')}</h3>
                </div>
                <div class="level-select-runtime-map__metrics" aria-label="章节进度">
                    <span>${escapeHtml(overview.completedCount ?? map.nodes.filter(node => node.isCompleted).length)} / ${escapeHtml(overview.totalCount ?? map.nodes.length)} 已完成</span>
                    <span>${escapeHtml(overview.unlockedCount ?? map.nodes.filter(node => node.isUnlocked).length)} / ${escapeHtml(overview.totalCount ?? map.nodes.length)} 已解锁</span>
                </div>
            </div>
        `;

        this.renderMapSwitcher(root, active.maps, active.activeMapId);

        const stage = createElement(this.document, 'div', 'level-select-runtime-map__stage');
        const viewport = createElement(this.document, 'div', 'level-select-runtime-map__viewport');
        const surface = createElement(this.document, 'div', 'level-select-runtime-map__surface');
        viewport.appendChild(surface);
        stage.appendChild(viewport);
        root.appendChild(stage);
        this._viewport = viewport;
        this._surface = surface;

        this.renderControls(stage);

        const drawer = createElement(this.document, 'aside', 'level-select-runtime-map__drawer');
        drawer.setAttribute('aria-label', '关卡详情');
        drawer.innerHTML = `
            <div class="level-map-drawer__status"></div>
            <div class="level-map-drawer__label"></div>
            <h4 class="level-map-drawer__title"></h4>
            <p class="level-map-drawer__objective"></p>
            <div class="level-map-drawer__chips"></div>
            <button type="button" class="level-map-drawer__enter" data-action="enter-level" aria-label="进入关卡" title="进入关卡">进入关卡</button>
        `;
        this._drawer = drawer;
        this._confirmButton = drawer.querySelector('[data-action="enter-level"]');
        this._confirmButton?.addEventListener('click', () => this._confirmSelectedNode());
        root.appendChild(drawer);

        host.appendChild(root);
        this.renderStage(stage, viewport, surface, this._model);
        this._bindViewportInteractions();
        this._attachGlobalListeners();
        this._applyTransform();
        this._renderSelection();
        return root;
    }

    renderEmpty(host) {
        const empty = createElement(this.document, 'section', 'level-select-runtime-map summary-section');
        empty.dataset.summaryKind = 'story-progress';
        empty.innerHTML = `
            <div class="level-select-runtime-map__header">
                <div>
                    <div class="level-select-runtime-map__eyebrow">章节地图</div>
                    <h3>故事地图</h3>
                </div>
            </div>
        `;
        host.appendChild(empty);
        return empty;
    }

    renderStage(stage, viewport, surface, model) {
        const map = model.map;
        const metrics = getCanvasMetrics(viewport, map);
        const display = metrics.display;
        const layers = buildStageImageLayers(map, model.assetLibrary);

        stage.style.backgroundImage = layers.backgroundImage;
        stage.style.backgroundSize = layers.backgroundSize;
        stage.style.backgroundPosition = layers.backgroundPosition;
        stage.style.backgroundRepeat = layers.backgroundRepeat;
        stage.style.aspectRatio = toCssAspectRatio(display.viewportAspect);
        surface.style.width = `${metrics.width}px`;
        surface.style.height = `${metrics.height}px`;

        const svg = createSvgElement(this.document, 'svg', 'level-map-edges');
        svg.setAttribute('viewBox', `0 0 ${metrics.width} ${metrics.height}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        surface.appendChild(svg);

        const nodeMap = new Map(map.nodes.map(node => [node.id, node]));
        const projectedNodeMap = new Map(map.nodes.map(node => {
            const projectedPoint = projectPoint(node.position, metrics);
            return [node.id, resolveNodeFrame(projectedPoint, display)];
        }));

        asArray(map.edges).forEach((edge) => {
            const fromNode = nodeMap.get(edge.fromNodeId);
            const toNode = nodeMap.get(edge.toNodeId);
            const fromFrame = projectedNodeMap.get(edge.fromNodeId);
            const toFrame = projectedNodeMap.get(edge.toNodeId);
            if (!fromNode || !toNode || !fromFrame || !toFrame) return;

            const fromPoint = resolveEdgeAnchorPoint(fromFrame, display);
            const toPoint = resolveEdgeAnchorPoint(toFrame, display);
            const midX = Math.round((fromPoint.x + toPoint.x) / 2);
            const midY = Math.round((fromPoint.y + toPoint.y) / 2);
            const path = createSvgElement(this.document, 'path', `level-map-edge is-${edge.type || 'main'}`);
            path.setAttribute('d', `M ${fromPoint.x} ${fromPoint.y} C ${midX} ${fromPoint.y}, ${midX} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`);
            if (fromNode.status !== 'locked' && toNode.status !== 'locked') {
                path.setAttribute('data-active', 'true');
            }
            svg.appendChild(path);

            if (edge.branchLabel && display.edgeLabelMode !== 'none') {
                const label = createSvgElement(this.document, 'text', 'level-map-edge-label');
                label.setAttribute('x', String(midX));
                label.setAttribute('y', String(midY - 8));
                label.setAttribute('text-anchor', 'middle');
                label.textContent = edge.branchLabel;
                svg.appendChild(label);
            }
        });

        map.nodes.forEach((node) => {
            const projected = projectPoint(node.position, metrics);
            const button = createElement(this.document, 'button', `level-map-node is-${node.status || 'locked'} kind-${node.kind || 'battle'}`);
            const nodeArt = findAsset(model.assetLibrary?.nodeArts, node.artRefs?.nodeArt || '');
            const artImage = getAssetImage(nodeArt);
            button.type = 'button';
            button.dataset.nodeId = node.id || '';
            button.dataset.levelId = node.levelId || '';
            button.style.left = `${projected.x}px`;
            button.style.top = `${projected.y}px`;
            button.style.setProperty('--node-scale', String(display.nodeScale));
            button.style.setProperty('--node-inverse-scale', String(1 / display.nodeScale));
            button.style.transform = display.nodeAnchor === 'top-left'
                ? `translate(0px, 0px) scale(${display.nodeScale})`
                : `translate(-50%, -50%) scale(${display.nodeScale})`;
            button.setAttribute('aria-label', `${node.label || ''} ${resolveNodeTitle(node)} ${node.statusLabel || ''}`.trim());
            if (!node.isUnlocked && !node.selectLevelId) {
                button.disabled = true;
                button.setAttribute('aria-disabled', 'true');
            } else {
                button.addEventListener('click', (event) => {
                    event.stopPropagation();
                    this._selectNode(node.id);
                });
            }
            button.innerHTML = `
                <span class="level-map-node__pin" aria-hidden="true">
                    <span class="level-map-node__art"></span>
                    <span class="level-map-node__ring"></span>
                </span>
                <span class="level-map-node__caption">
                    <span class="level-map-node__label">${escapeHtml(node.label || '')}</span>
                    <strong class="level-map-node__title">${escapeHtml(resolveNodeTitle(node))}</strong>
                    <span class="level-map-node__status">${escapeHtml(node.statusLabel || '')}</span>
                </span>
            `;
            if (artImage) {
                const art = button.querySelector('.level-map-node__art');
                if (art) {
                    art.style.backgroundImage = `linear-gradient(180deg, rgba(255, 238, 180, 0.05), rgba(22, 13, 6, 0.28)), url("${artImage}")`;
                    art.style.backgroundSize = 'cover';
                    art.style.backgroundPosition = 'center';
                }
            }
            surface.appendChild(button);
        });
    }

    _getSelectedNode() {
        const nodes = asArray(this._activeMap?.nodes);
        return nodes.find(node => node.id === this.selectedNodeId) || nodes[0] || null;
    }

    _selectNode(nodeId) {
        const node = asArray(this._activeMap?.nodes).find(item => item.id === nodeId);
        if (!node) return;
        this.selectedNodeId = node.id || '';
        this._renderSelection();
        if (this.onSelectNode) {
            this.onSelectNode(buildNodePayload(this._activeMap, node));
        }
    }

    _confirmSelectedNode() {
        const node = this._getSelectedNode();
        if (!node || (!node.isUnlocked && !node.selectLevelId)) return;
        if (this.onConfirmNode) {
            this.onConfirmNode(buildNodePayload(this._activeMap, node));
        }
    }

    _renderSelection() {
        const node = this._getSelectedNode();
        this._root?.querySelectorAll('.level-map-node').forEach((button) => {
            const isSelected = button.dataset.nodeId === node?.id;
            if (isSelected) {
                button.setAttribute('data-selected', 'true');
            } else {
                button.removeAttribute('data-selected');
            }
        });

        if (!this._drawer || !node) return;
        const status = this._drawer.querySelector('.level-map-drawer__status');
        const label = this._drawer.querySelector('.level-map-drawer__label');
        const title = this._drawer.querySelector('.level-map-drawer__title');
        const objective = this._drawer.querySelector('.level-map-drawer__objective');
        const chips = this._drawer.querySelector('.level-map-drawer__chips');
        const canEnter = Boolean(node.isUnlocked || node.selectLevelId);
        if (status) {
            status.className = `level-map-drawer__status is-${escapeHtml(node.status || 'locked')}`;
            status.textContent = node.statusLabel || '未解锁';
        }
        if (label) label.textContent = node.label || '';
        if (title) title.textContent = resolveNodeTitle(node);
        if (objective) objective.textContent = node.objectiveText || node.levelDescription || '';
        if (chips) {
            const rewardChips = asArray(node.rewardPreview).map(item => `<span>${escapeHtml(item)}</span>`).join('');
            const difficultyChip = node.difficultyLabel ? `<span>${escapeHtml(node.difficultyLabel)}</span>` : '';
            chips.innerHTML = `${difficultyChip}${rewardChips}`;
        }
        if (this._confirmButton) {
            this._confirmButton.disabled = !canEnter;
            if (canEnter) {
                this._confirmButton.removeAttribute('aria-disabled');
            } else {
                this._confirmButton.setAttribute('aria-disabled', 'true');
            }
        }
    }

    _bindViewportInteractions() {
        if (!this._viewport) return;
        this._viewport.addEventListener('mousedown', (event) => {
            if (event.button !== 0) return;
            if (event.target?.closest?.('.level-map-node')) return;
            this._dragState = {
                x: event.clientX,
                y: event.clientY
            };
        });
        this._viewport.addEventListener('wheel', (event) => {
            event.preventDefault();
            this._setZoom(this._viewState.zoom + (event.deltaY < 0 ? 0.1 : -0.1));
        }, { passive: false });
    }

    _attachGlobalListeners() {
        if (!this.window) return;
        this.window.addEventListener('mousemove', this._bound.onWindowMouseMove);
        this.window.addEventListener('mouseup', this._bound.onWindowMouseUp);
    }

    _detachGlobalListeners() {
        if (!this.window) return;
        this.window.removeEventListener('mousemove', this._bound.onWindowMouseMove);
        this.window.removeEventListener('mouseup', this._bound.onWindowMouseUp);
    }

    _handleViewportMouseMove(event) {
        if (!this._dragState) return;
        const dx = event.clientX - this._dragState.x;
        const dy = event.clientY - this._dragState.y;
        this._dragState = { x: event.clientX, y: event.clientY };
        this._viewState.panX += dx;
        this._viewState.panY += dy;
        this._applyTransform();
    }

    _handleViewportMouseUp() {
        this._dragState = null;
    }

    _setZoom(value) {
        this._viewState.zoom = clampNumber(Number(value) || 1, 0.5, 1.8);
        this._applyTransform();
    }

    _resetViewport() {
        this._viewState = {
            zoom: 1,
            panX: 0,
            panY: 0
        };
        this._applyTransform();
    }

    _applyTransform() {
        if (this._surface) {
            this._surface.style.transform = `translate(${this._viewState.panX}px, ${this._viewState.panY}px) scale(${this._viewState.zoom})`;
        }
        if (this._root) {
            this._root.dataset.zoom = formatZoom(this._viewState.zoom);
        }
    }
}

export default LevelSelectMapView;
