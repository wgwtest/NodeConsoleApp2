function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function getNodeStatus(nodeId, mode) {
    const completed = new Set(asArray(mode?.completedNodeIds));
    const unlocked = new Set(asArray(mode?.unlockedNodeIds));
    if (completed.has(nodeId)) return 'completed';
    if (unlocked.has(nodeId)) return 'unlocked';
    return 'locked';
}

function getBackgroundPreview(map, assetLibrary) {
    const backgroundRef = map?.backgroundRef || '';
    const background = asArray(assetLibrary?.backgrounds).find(item => item.id === backgroundRef);
    return background?.previewGradient || 'linear-gradient(135deg, #10263a 0%, #244a5a 50%, #d1a85f 100%)';
}

function normalizeMapPack(source) {
    const pack = asObject(source);
    const maps = asArray(pack.maps).map((map) => ({
        id: String(map.id || '').trim(),
        name: String(map.name || '').trim(),
        chapterId: String(map.chapterId || '').trim(),
        chapterLabel: String(map.chapterLabel || '').trim(),
        chapterTitle: String(map.chapterTitle || '').trim(),
        backgroundRef: String(map.backgroundRef || '').trim(),
        entryNodeId: String(map.entryNodeId || '').trim(),
        nodes: asArray(map.nodes).map((node) => ({
            id: String(node.id || '').trim(),
            levelId: String(node.levelId || '').trim(),
            label: String(node.label || '').trim(),
            title: String(node.title || '').trim(),
            kind: String(node.kind || 'battle').trim(),
            nodeSkinRef: String(node.nodeSkinRef || '').trim(),
            iconLabel: String(node.iconLabel || '').trim(),
            x: Number(node.x) || 0,
            y: Number(node.y) || 0,
            objectiveText: String(node.objectiveText || '').trim(),
            difficultyLabel: String(node.difficultyLabel || '').trim(),
            rewardPreview: asArray(node.rewardPreview).map(item => String(item || '').trim()).filter(Boolean),
            artRefs: clone(asObject(node.artRefs))
        })),
        edges: asArray(map.edges).map((edge) => ({
            id: String(edge.id || '').trim(),
            fromNodeId: String(edge.fromNodeId || '').trim(),
            toNodeId: String(edge.toNodeId || '').trim(),
            branchLabel: String(edge.branchLabel || '').trim(),
            type: String(edge.type || 'branch').trim()
        })),
        previewModes: asArray(map.previewModes).map((mode) => ({
            id: String(mode.id || '').trim(),
            label: String(mode.label || '').trim(),
            description: String(mode.description || '').trim(),
            focusNodeId: String(mode.focusNodeId || '').trim(),
            unlockedNodeIds: asArray(mode.unlockedNodeIds).map(id => String(id || '').trim()).filter(Boolean),
            completedNodeIds: asArray(mode.completedNodeIds).map(id => String(id || '').trim()).filter(Boolean)
        }))
    })).filter(map => map.id);

    return {
        schemaVersion: String(pack.$schemaVersion || '').trim(),
        meta: clone(asObject(pack.meta)),
        assetLibrary: clone(asObject(pack.assetLibrary)),
        maps
    };
}

function createElement(doc, tagName, className = '') {
    const element = doc.createElement(tagName);
    if (className) {
        element.className = className;
    }
    return element;
}

export class LevelMapPreviewPage {
    constructor(options = {}) {
        this.document = options.document || globalThis.document;
        this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
        this.defaultSourceUrl = options.defaultSourceUrl || '../assets/data/level_map_pack_v1.example.json';
        this.elements = {};
        this.pack = null;
        this.activeMapId = null;
        this.activeModeId = null;
        this.selectedNodeId = null;
    }

    bind() {
        const ids = [
            'status',
            'reloadBtn',
            'modeButtons',
            'mapStage',
            'mapCanvas',
            'mapHeading',
            'mapModeDescription',
            'packMeta',
            'nodeInspector',
            'handoffPayload',
            'packPreview',
            'relationshipList'
        ];

        ids.forEach((id) => {
            this.elements[id] = this.document.getElementById(id);
        });

        this.elements.reloadBtn?.addEventListener('click', () => {
            this.loadDefaultPack().catch((error) => this.setStatus(`加载失败：${error.message}`));
        });
    }

    async loadDefaultPack() {
        if (typeof this.fetchImpl !== 'function') {
            throw new Error('缺少 fetch 实现，无法加载地图预览包。');
        }

        this.setStatus('正在加载地图预览包...');
        const response = await this.fetchImpl(this.defaultSourceUrl, { cache: 'no-store' });
        if (!response || !response.ok) {
            throw new Error(`加载失败：${response?.status || 'unknown'}`);
        }

        const raw = await response.json();
        this.loadDocument(raw);
        this.setStatus(`已加载地图预览包：${this.defaultSourceUrl}`);
    }

    loadDocument(rawDocument) {
        this.pack = normalizeMapPack(rawDocument);
        const firstMap = this.pack.maps[0] || null;
        if (!firstMap) {
            throw new Error('地图预览包缺少 maps[0]');
        }

        this.activeMapId = firstMap.id;
        this.activeModeId = firstMap.previewModes[0]?.id || null;
        this.selectedNodeId = firstMap.entryNodeId || firstMap.nodes[0]?.id || null;
        this.renderAll();
    }

    getActiveMap() {
        return this.pack?.maps?.find(map => map.id === this.activeMapId) || null;
    }

    getActiveMode() {
        const map = this.getActiveMap();
        return map?.previewModes?.find(mode => mode.id === this.activeModeId) || null;
    }

    getSelectedNode() {
        const map = this.getActiveMap();
        return map?.nodes?.find(node => node.id === this.selectedNodeId) || null;
    }

    setStatus(text) {
        if (this.elements.status) {
            this.elements.status.textContent = text;
        }
    }

    renderAll() {
        this.renderPackMeta();
        this.renderModeButtons();
        this.renderMap();
        this.renderInspector();
        this.renderPackPreview();
        this.renderRelationshipList();
    }

    renderPackMeta() {
        if (!this.elements.packMeta || !this.pack) return;
        const map = this.getActiveMap();
        this.elements.packMeta.innerHTML = `
            <div class="meta-line"><strong>Schema</strong><span>${escapeHtml(this.pack.schemaVersion || '-')}</span></div>
            <div class="meta-line"><strong>Owner Node</strong><span>${escapeHtml(this.pack.meta?.ownerNode || '-')}</span></div>
            <div class="meta-line"><strong>当前地图</strong><span>${escapeHtml(map?.chapterLabel || '')} ${escapeHtml(map?.chapterTitle || '')}</span></div>
            <div class="meta-note">${escapeHtml(asArray(this.pack.meta?.notes).join(' '))}</div>
        `;
    }

    renderModeButtons() {
        const host = this.elements.modeButtons;
        const heading = this.elements.mapHeading;
        const description = this.elements.mapModeDescription;
        const map = this.getActiveMap();
        const mode = this.getActiveMode();
        if (!host || !map) return;

        host.innerHTML = '';
        if (heading) {
            heading.textContent = `${map.chapterLabel} · ${map.chapterTitle} · ${map.name}`;
        }
        if (description) {
            description.textContent = mode?.description || '当前未设置预览模式。';
        }

        map.previewModes.forEach((item) => {
            const button = createElement(this.document, 'button', 'mode-button');
            button.type = 'button';
            button.textContent = item.label || item.id;
            button.title = item.description || item.label || item.id;
            if (item.id === this.activeModeId) {
                button.setAttribute('data-active', 'true');
            }
            button.addEventListener('click', () => {
                this.activeModeId = item.id;
                this.selectedNodeId = item.focusNodeId || this.selectedNodeId;
                this.renderAll();
            });
            host.appendChild(button);
        });
    }

    renderMap() {
        const stage = this.elements.mapStage;
        const host = this.elements.mapCanvas;
        const map = this.getActiveMap();
        const mode = this.getActiveMode();
        if (!host || !map) return;

        host.innerHTML = '';
        if (stage) {
            stage.style.background = getBackgroundPreview(map, this.pack.assetLibrary);
        }

        const svg = createElement(this.document, 'svg', 'map-edges');
        svg.setAttribute('viewBox', '0 0 760 460');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        const nodeMap = new Map(map.nodes.map(node => [node.id, node]));
        map.edges.forEach((edge) => {
            const fromNode = nodeMap.get(edge.fromNodeId);
            const toNode = nodeMap.get(edge.toNodeId);
            if (!fromNode || !toNode) return;

            const fromStatus = getNodeStatus(fromNode.id, mode);
            const toStatus = getNodeStatus(toNode.id, mode);
            const line = createElement(this.document, 'path', `map-edge is-${edge.type}`);
            const midX = Math.round((fromNode.x + toNode.x) / 2);
            const pathValue = `M ${fromNode.x} ${fromNode.y} C ${midX} ${fromNode.y}, ${midX} ${toNode.y}, ${toNode.x} ${toNode.y}`;
            line.setAttribute('d', pathValue);
            if (fromStatus !== 'locked' && toStatus !== 'locked') {
                line.setAttribute('data-active', 'true');
            }
            svg.appendChild(line);

            if (edge.branchLabel) {
                const label = createElement(this.document, 'text', 'map-edge-label');
                label.setAttribute('x', String(midX));
                label.setAttribute('y', String(Math.round((fromNode.y + toNode.y) / 2) - 10));
                label.setAttribute('text-anchor', 'middle');
                label.textContent = edge.branchLabel;
                svg.appendChild(label);
            }
        });

        host.appendChild(svg);

        map.nodes.forEach((node) => {
            const status = getNodeStatus(node.id, mode);
            const button = createElement(this.document, 'button', `map-node is-${status} kind-${node.kind}`);
            button.type = 'button';
            button.style.left = `${node.x}px`;
            button.style.top = `${node.y}px`;
            if (node.id === this.selectedNodeId) {
                button.setAttribute('data-selected', 'true');
            }
            button.innerHTML = `
                <span class="map-node__label">${escapeHtml(node.label)}</span>
                <strong class="map-node__title">${escapeHtml(node.title)}</strong>
                <span class="map-node__meta">${escapeHtml(node.iconLabel || node.kind)}</span>
            `;
            button.addEventListener('click', () => {
                this.selectedNodeId = node.id;
                this.renderInspector();
                this.renderMap();
            });
            host.appendChild(button);
        });
    }

    renderInspector() {
        const host = this.elements.nodeInspector;
        const payloadHost = this.elements.handoffPayload;
        const node = this.getSelectedNode();
        const mode = this.getActiveMode();
        const map = this.getActiveMap();
        if (!host || !node || !map) return;

        const status = getNodeStatus(node.id, mode);
        host.innerHTML = `
            <div class="inspector-chip status-${status}">${escapeHtml(status === 'completed' ? '已完成' : status === 'unlocked' ? '已解锁' : '未解锁')}</div>
            <h3>${escapeHtml(node.label)} · ${escapeHtml(node.title)}</h3>
            <p class="inspector-copy">${escapeHtml(node.objectiveText)}</p>
            <div class="inspector-grid">
                <div><strong>绑定关卡</strong><span>${escapeHtml(node.levelId)}</span></div>
                <div><strong>节点类型</strong><span>${escapeHtml(node.kind)}</span></div>
                <div><strong>难度标签</strong><span>${escapeHtml(node.difficultyLabel || '-')}</span></div>
                <div><strong>节点素材</strong><span>${escapeHtml(node.artRefs?.nodeArt || '-')}</span></div>
                <div><strong>立绘素材</strong><span>${escapeHtml(node.artRefs?.portrait || '-')}</span></div>
                <div><strong>背景引用</strong><span>${escapeHtml(map.backgroundRef || '-')}</span></div>
            </div>
            <div class="inspector-subtitle">奖励预览</div>
            <div class="chip-row">
                ${asArray(node.rewardPreview).map(item => `<span class="reward-chip">${escapeHtml(item)}</span>`).join('')}
            </div>
        `;

        if (payloadHost) {
            payloadHost.textContent = JSON.stringify({
                selectedLevelId: node.levelId,
                sourceMapId: map.id,
                sourceNodeId: node.id,
                previewModeId: mode?.id || null
            }, null, 2);
        }
    }

    renderPackPreview() {
        if (!this.elements.packPreview || !this.pack) return;
        this.elements.packPreview.textContent = JSON.stringify(this.pack, null, 2);
    }

    renderRelationshipList() {
        const host = this.elements.relationshipList;
        const map = this.getActiveMap();
        if (!host || !map) return;
        host.innerHTML = `
            <li>地图层负责节点、边、背景图和素材引用。</li>
            <li>三个预览按钮只是同一张地图的推进快照，不是主流程玩法按钮。</li>
            <li>点击节点后只输出 <code>selectedLevelId</code> 与地图上下文，不直接进入战斗逻辑。</li>
            <li>未来正式地图编辑器会独立维护这份地图包，而主流程只消费选择结果。</li>
        `;
    }
}

export default LevelMapPreviewPage;
