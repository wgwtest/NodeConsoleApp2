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

export class LevelSelectMapView {
    constructor(options = {}) {
        this.document = options.document || globalThis.document;
        this.onSelectNode = typeof options.onSelectNode === 'function' ? options.onSelectNode : null;
    }

    render(host, model) {
        if (!host) return null;
        host.innerHTML = '';
        const map = model?.map;
        if (!map || !Array.isArray(map.nodes) || map.nodes.length === 0) {
            return this.renderEmpty(host);
        }

        const root = createElement(this.document, 'section', 'level-select-runtime-map summary-section');
        root.dataset.summaryKind = 'story-progress';
        root.dataset.mapId = map.id || '';

        const overview = asObject(model.overview);
        const heading = [map.chapterLabel || overview.chapterLabel, map.chapterTitle || overview.chapterTitle]
            .filter(Boolean)
            .join(' · ');
        const activeNode = map.nodes.find(node => node.id === model.selectedNodeId)
            || map.nodes.find(node => node.id === model.recommendedNodeId)
            || map.nodes.find(node => node.status === 'recommended')
            || map.nodes.find(node => node.status === 'unlocked')
            || map.nodes[0];

        root.innerHTML = `
            <div class="level-select-runtime-map__header">
                <div>
                    <div class="level-select-runtime-map__eyebrow">章节地图</div>
                    <h3>${escapeHtml(heading || map.name || '故事地图')}</h3>
                </div>
                <div class="level-select-runtime-map__metrics" aria-label="章节进度">
                    <span>${escapeHtml(overview.completedCount ?? 0)} / ${escapeHtml(overview.totalCount ?? map.nodes.length)} 已完成</span>
                    <span>${escapeHtml(overview.unlockedCount ?? map.nodes.filter(node => node.isUnlocked).length)} / ${escapeHtml(overview.totalCount ?? map.nodes.length)} 已解锁</span>
                </div>
            </div>
        `;

        const stage = createElement(this.document, 'div', 'level-select-runtime-map__stage');
        const canvas = createElement(this.document, 'div', 'level-select-runtime-map__canvas');
        stage.appendChild(canvas);
        root.appendChild(stage);

        const detail = createElement(this.document, 'div', 'level-select-runtime-map__detail');
        detail.innerHTML = `
            <span class="level-map-detail-status is-${escapeHtml(activeNode?.status || 'locked')}">${escapeHtml(activeNode?.statusLabel || '未解锁')}</span>
            <strong>${escapeHtml(activeNode?.label || '')} ${escapeHtml(activeNode?.levelName || activeNode?.title || '')}</strong>
            <span>${escapeHtml(activeNode?.objectiveText || '')}</span>
        `;
        root.appendChild(detail);

        host.appendChild(root);
        this.renderStage(stage, canvas, model);
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

    renderStage(stage, canvas, model) {
        const map = model.map;
        const metrics = getCanvasMetrics(canvas, map);
        const display = metrics.display;
        const layers = buildStageImageLayers(map, model.assetLibrary);

        stage.style.backgroundImage = layers.backgroundImage;
        stage.style.backgroundSize = layers.backgroundSize;
        stage.style.backgroundPosition = layers.backgroundPosition;
        stage.style.backgroundRepeat = layers.backgroundRepeat;
        stage.style.aspectRatio = toCssAspectRatio(display.viewportAspect);

        const svg = createSvgElement(this.document, 'svg', 'level-map-edges');
        svg.setAttribute('viewBox', `0 0 ${metrics.width} ${metrics.height}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        canvas.appendChild(svg);

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
            button.style.transform = display.nodeAnchor === 'top-left'
                ? `translate(0px, 0px) scale(${display.nodeScale})`
                : `translate(-50%, -50%) scale(${display.nodeScale})`;
            button.setAttribute('aria-label', `${node.label || ''} ${node.levelName || node.title || ''} ${node.statusLabel || ''}`.trim());
            if (node.id === model.selectedNodeId || node.id === model.recommendedNodeId) {
                button.setAttribute('data-selected', 'true');
            }
            if (!node.isUnlocked) {
                button.disabled = true;
                button.setAttribute('aria-disabled', 'true');
            } else if (this.onSelectNode) {
                button.addEventListener('click', () => {
                    this.onSelectNode({
                        mapId: map.id || '',
                        nodeId: node.id || '',
                        levelId: node.levelId || ''
                    });
                });
            }
            button.innerHTML = `
                <span class="level-map-node__label">${escapeHtml(node.label || '')}</span>
                <strong class="level-map-node__title">${escapeHtml(node.levelName || node.title || '')}</strong>
                <span class="level-map-node__status">${escapeHtml(node.statusLabel || '')}</span>
            `;
            if (artImage) {
                button.style.backgroundImage = `linear-gradient(180deg, rgba(9, 12, 18, 0.02), rgba(9, 12, 18, 0.34)), url("${artImage}")`;
                button.style.backgroundSize = 'cover';
                button.style.backgroundPosition = 'center';
            }
            canvas.appendChild(button);
        });
    }
}

export default LevelSelectMapView;
