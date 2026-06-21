import {
    createActivityAutoLayout,
    createDecisionToolSpikeScenario,
    getNodeBox,
    nodeKind
} from './EnemyDecisionToolSpikeModel.js';

const CDN = Object.freeze({
    logicflowCss: 'https://cdn.jsdelivr.net/npm/@logicflow/core@latest/dist/style/index.css',
    logicflowJs: 'https://cdn.jsdelivr.net/npm/@logicflow/core@2.2.3/dist/index.min.js',
    maxgraph: 'https://cdn.jsdelivr.net/npm/@maxgraph/core@0.23.0/+esm',
    rete: 'rete',
    reteArea: 'rete-area-plugin',
    reteConnection: 'https://esm.sh/rete-connection-plugin@2.0.5?external=rete,rete-area-plugin',
    reteLit: 'https://esm.sh/@retejs/lit-plugin@2.0.7?external=rete,rete-area-plugin&deps=@babel/runtime@7.28.4'
});

function byId(id) {
    return document.getElementById(id);
}

function clearElement(element) {
    if (!element) return;
    if (typeof element.replaceChildren === 'function') element.replaceChildren();
    else element.innerHTML = '';
}

function appendText(parent, tagName, text, className = '') {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
}

function loadStyleOnce(href) {
    if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`样式加载失败: ${href}`));
        document.head.appendChild(link);
    });
}

function loadScriptOnce(src, globalCheck) {
    if (typeof globalCheck === 'function' && globalCheck()) return Promise.resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
        return new Promise((resolve, reject) => {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`脚本加载失败: ${src}`)), { once: true });
        });
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
        document.head.appendChild(script);
    });
}

function setStatus(toolId, status, detail = '') {
    const statusNode = byId(`${toolId}Status`);
    if (!statusNode) return;
    statusNode.textContent = detail ? `${status} - ${detail}` : status;
    statusNode.dataset.state = status.includes('失败') ? 'error' : 'ok';
}

function logicFlowType(node) {
    if (node.type === 'entry' || node.type === 'end') return 'circle';
    if (node.type === 'branch' || node.type === 'merge') return 'diamond';
    return 'rect';
}

function logicFlowNodeText(node) {
    if (node.type === 'entry' || node.type === 'end') return node.label;
    if (node.type === 'branch' || node.type === 'merge') return node.label;
    return `${node.label}\n${node.subtitle || nodeKind(node.type)}`;
}

function applyActivityLayoutToScenario(scenario) {
    const autoLayout = createActivityAutoLayout(scenario);
    scenario.nodes = scenario.nodes.map(item => ({
        ...item,
        ...autoLayout.nodesById[item.id]
    }));
    scenario.edges = scenario.edges.map(item => ({
        ...item,
        points: autoLayout.edgeRoutes[item.id] || item.points || []
    }));
    scenario.canvas = {
        ...scenario.canvas,
        width: autoLayout.canvas.width,
        height: autoLayout.canvas.height
    };
    scenario.autoLayout = autoLayout;
    return autoLayout;
}

function createLogicFlowGraphData(scenario) {
    const autoLayout = scenario.autoLayout || applyActivityLayoutToScenario(scenario);
    return {
        nodes: scenario.nodes.map(item => {
            const data = {
                id: item.id,
                type: logicFlowType(item),
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height,
                text: {
                    value: logicFlowNodeText(item),
                    x: item.x,
                    y: item.y
                },
                properties: {
                    toolNodeType: item.type,
                    width: item.width,
                    height: item.height
                }
            };
            if (item.type === 'entry' || item.type === 'end') {
                data.r = Math.round(Math.min(item.width, item.height) / 2);
            }
            if (item.type === 'branch' || item.type === 'merge') {
                data.rx = Math.round(item.width / 2);
                data.ry = Math.round(item.height / 2);
            }
            return data;
        }),
        edges: scenario.edges.map(item => {
            const points = item.points?.length ? item.points : autoLayout.edgeRoutes[item.id];
            const edgeData = {
                id: item.id,
                type: 'polyline',
                sourceNodeId: item.from,
                targetNodeId: item.to,
                text: item.label ? { value: item.label } : undefined,
                properties: {
                    kind: item.kind,
                    routeLocked: Boolean(points?.length)
                }
            };
            if (points?.length >= 2) {
                edgeData.startPoint = points[0];
                edgeData.endPoint = points[points.length - 1];
                edgeData.pointsList = points;
            }
            return edgeData;
        })
    };
}

function applyLogicFlowActivityLayout(lf, scenario) {
    applyActivityLayoutToScenario(scenario);
    lf.render(createLogicFlowGraphData(scenario));
    if (typeof lf.zoom === 'function') {
        lf.zoom(0.82);
    }
    return scenario.autoLayout;
}

function decorateLogicFlowEdges(surface, scenario) {
    const decorate = () => {
        const edgeGroups = Array.from(surface.querySelectorAll('g.lf-edge'));
        scenario.edges.forEach((edge, index) => {
            const group = edgeGroups[index];
            if (!group) return;
            group.dataset.edgeId = edge.id;
            group.classList.toggle('is-loop-edge', edge.kind === 'loop');
        });
    };
    requestAnimationFrame(() => requestAnimationFrame(decorate));
}

function createFallbackSvg(container, scenario, tool, reason) {
    clearElement(container);
    container.classList.add('spike-fallback-canvas');
    const warning = document.createElement('div');
    warning.className = 'tool-warning';
    warning.textContent = `${tool.name} 未能加载真实库，当前显示降级 SVG 结构图。原因：${reason}`;
    container.appendChild(warning);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${scenario.canvas.width} ${scenario.canvas.height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${tool.name} 降级状态机图`);
    container.appendChild(svg);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <marker id="${tool.id}-arrow" markerWidth="12" markerHeight="12" refX="9" refY="3.5" orient="auto">
            <path d="M0,0 L10,3.5 L0,7 Z" fill="#2d3b34"></path>
        </marker>
        <marker id="${tool.id}-loop-arrow" markerWidth="12" markerHeight="12" refX="9" refY="3.5" orient="auto">
            <path d="M0,0 L10,3.5 L0,7 Z" fill="#a8493d"></path>
        </marker>`;
    svg.appendChild(defs);

    const nodeMap = new Map(scenario.nodes.map(node => [node.id, { ...node }]));

    function drawEdges() {
        svg.querySelectorAll('.fallback-edge').forEach(edge => edge.remove());
        scenario.edges.forEach(edge => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.classList.add('fallback-edge', `fallback-edge--${edge.kind}`);
            const fromY = from.y + (from.height || 60) / 2;
            const toY = to.y - (to.height || 60) / 2;
            if (edge.kind === 'loop') {
                const rail = 62 + Number(edge.lane || 0) * 28;
                path.setAttribute('d', `M${from.x},${from.y + 36} C${rail},${from.y + 36} ${rail},${to.y} ${to.x - 132},${to.y}`);
                path.setAttribute('marker-end', `url(#${tool.id}-loop-arrow)`);
            } else {
                const midY = Math.round((fromY + toY) / 2);
                path.setAttribute('d', `M${from.x},${fromY} L${from.x},${midY} L${to.x},${midY} L${to.x},${toY}`);
                path.setAttribute('marker-end', `url(#${tool.id}-arrow)`);
            }
            svg.insertBefore(path, svg.firstChild?.nextSibling || null);
        });
    }

    function drawNodes() {
        svg.querySelectorAll('.fallback-node').forEach(item => item.remove());
        nodeMap.forEach(node => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('fallback-node', `fallback-node--${node.type}`);
            group.setAttribute('tabindex', '0');
            group.dataset.nodeId = node.id;
            const box = getNodeBox(node);
            if (node.type === 'branch' || node.type === 'merge') {
                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                polygon.setAttribute('points', `${node.x},${box.y} ${box.x + box.width},${node.y} ${node.x},${box.y + box.height} ${box.x},${node.y}`);
                group.appendChild(polygon);
            } else if (node.type === 'entry' || node.type === 'end') {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', String(node.x));
                circle.setAttribute('cy', String(node.y));
                circle.setAttribute('r', String(Math.min(box.width, box.height) / 2));
                group.appendChild(circle);
            } else {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', String(box.x));
                rect.setAttribute('y', String(box.y));
                rect.setAttribute('width', String(box.width));
                rect.setAttribute('height', String(box.height));
                rect.setAttribute('rx', node.type === 'endTurn' ? '20' : '9');
                group.appendChild(rect);
            }
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', String(node.x));
            label.setAttribute('y', String(node.y - 4));
            label.textContent = node.label;
            group.appendChild(label);
            if (node.subtitle && node.type !== 'entry' && node.type !== 'end') {
                const subtitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                subtitle.classList.add('fallback-subtitle');
                subtitle.setAttribute('x', String(node.x));
                subtitle.setAttribute('y', String(node.y + 18));
                subtitle.textContent = node.subtitle;
                group.appendChild(subtitle);
            }
            let dragStart = null;
            group.addEventListener('pointerdown', event => {
                group.setPointerCapture?.(event.pointerId);
                dragStart = { x: event.clientX, y: event.clientY, nodeX: node.x, nodeY: node.y };
            });
            group.addEventListener('pointermove', event => {
                if (!dragStart) return;
                node.x = dragStart.nodeX + (event.clientX - dragStart.x);
                node.y = dragStart.nodeY + (event.clientY - dragStart.y);
                drawEdges();
                drawNodes();
            });
            group.addEventListener('pointerup', () => {
                dragStart = null;
            });
            svg.appendChild(group);
        });
    }

    drawEdges();
    drawNodes();
}

async function renderLogicFlow(container, scenario, tool) {
    setStatus(tool.id, '加载中', '读取 LogicFlow CDN');
    await loadStyleOnce(CDN.logicflowCss).catch(error => {
        console.warn(error.message);
    });
    await loadScriptOnce(CDN.logicflowJs, () => window.LogicFlow || window.Core?.LogicFlow);
    const LogicFlowCtor = window.LogicFlow?.default
        || window.LogicFlow
        || window.Core?.LogicFlow
        || window.Core?.default;
    if (typeof LogicFlowCtor !== 'function') {
        throw new Error('LogicFlow 构造器未暴露到 window.Core.LogicFlow');
    }

    clearElement(container);
    container.classList.add('logicflow-canvas');
    const toolbar = document.createElement('div');
    toolbar.className = 'logicflow-toolbar';
    const autoLayoutButton = document.createElement('button');
    autoLayoutButton.type = 'button';
    autoLayoutButton.textContent = '应用活动图自动排版';
    toolbar.appendChild(autoLayoutButton);
    const layoutNote = document.createElement('span');
    layoutNote.textContent = '主干垂直 / 行动走侧栏 / 回流走外侧';
    toolbar.appendChild(layoutNote);
    const surface = document.createElement('div');
    surface.className = 'logicflow-surface';
    container.append(toolbar, surface);

    const lf = new LogicFlowCtor({
        container: surface,
        grid: { size: 24, visible: true, type: 'mesh' },
        keyboard: { enabled: true },
        stopScrollGraph: false,
        stopZoomGraph: false,
        adjustEdgeStartAndEnd: false
    });
    lf.setTheme?.({
        rect: {
            radius: 9,
            stroke: '#385f88',
            fill: '#e9f3f6',
            strokeWidth: 2
        },
        circle: {
            stroke: '#13211c',
            fill: '#f6faf8',
            strokeWidth: 2
        },
        diamond: {
            stroke: '#c07a22',
            fill: '#fffdf8',
            strokeWidth: 2
        },
        polyline: {
            stroke: '#6b6251',
            strokeWidth: 2
        },
        text: {
            color: '#12221c',
            fontSize: 14,
            fontWeight: 800
        }
    });

    applyLogicFlowActivityLayout(lf, scenario);
    decorateLogicFlowEdges(surface, scenario);
    autoLayoutButton.addEventListener('click', () => {
        applyLogicFlowActivityLayout(lf, scenario);
        decorateLogicFlowEdges(surface, scenario);
        setStatus(tool.id, '运行中', '已重新应用活动图自动排版');
    });
    lf.__applyActivityAutoLayout = () => {
        const layout = applyLogicFlowActivityLayout(lf, scenario);
        decorateLogicFlowEdges(surface, scenario);
        return layout;
    };
    lf.on?.('node:click', ({ data }) => {
        setStatus(tool.id, '运行中', `选中 ${data?.text?.value || data?.id}`);
    });
    setStatus(tool.id, '运行中', '真实 LogicFlow 实例，已应用活动图自动排版，可拖拽、缩放、选择、编辑连线');
    return lf;
}

function maxGraphStyle(node) {
    if (node.type === 'entry' || node.type === 'end') {
        return {
            shape: 'ellipse',
            fillColor: node.type === 'entry' ? '#14221d' : '#f6faf8',
            strokeColor: '#14221d',
            fontColor: node.type === 'entry' ? '#ffffff' : '#14221d',
            fontStyle: 1,
            fontSize: 15
        };
    }
    if (node.type === 'branch' || node.type === 'merge') {
        return {
            shape: 'rhombus',
            fillColor: '#fffdf8',
            strokeColor: '#c37b20',
            strokeWidth: 2,
            fontStyle: 1,
            fontSize: 14,
            whiteSpace: 'wrap'
        };
    }
    if (node.type === 'state') {
        return {
            shape: 'rectangle',
            rounded: true,
            arcSize: 12,
            fillColor: '#e5f2ec',
            strokeColor: '#277158',
            strokeWidth: 2,
            fontStyle: 1,
            whiteSpace: 'wrap'
        };
    }
    if (node.type === 'endTurn') {
        return {
            shape: 'rectangle',
            rounded: true,
            arcSize: 30,
            fillColor: '#20322b',
            strokeColor: '#20322b',
            fontColor: '#ffffff',
            fontStyle: 1
        };
    }
    return {
        shape: 'rectangle',
        rounded: true,
        arcSize: 10,
        fillColor: '#e7f2fb',
        strokeColor: '#456d96',
        strokeWidth: 2,
        fontStyle: 1,
        whiteSpace: 'wrap'
    };
}

async function renderMaxGraph(container, scenario, tool) {
    setStatus(tool.id, '加载中', '读取 maxGraph ESM');
    const { Graph, InternalEvent, RubberBandHandler } = await import(CDN.maxgraph);
    clearElement(container);
    InternalEvent.disableContextMenu(container);
    const graph = new Graph(container);
    graph.setPanning(true);
    graph.setConnectable(true);
    graph.setCellsResizable(true);
    graph.setCellsEditable(false);
    graph.setAllowDanglingEdges(false);
    new RubberBandHandler(graph);
    const cells = new Map();

    graph.batchUpdate(() => {
        scenario.nodes.forEach(item => {
            const box = getNodeBox(item);
            const label = item.subtitle && item.type !== 'entry' && item.type !== 'end'
                ? `${item.label}\n${item.subtitle}`
                : item.label;
            const cell = graph.insertVertex({
                id: item.id,
                value: label,
                position: [box.x, box.y],
                size: [box.width, box.height],
                style: maxGraphStyle(item)
            });
            cells.set(item.id, cell);
        });
        scenario.edges.forEach(item => {
            const source = cells.get(item.from);
            const target = cells.get(item.to);
            if (!source || !target) return;
            graph.insertEdge({
                id: item.id,
                source,
                target,
                value: item.label,
                style: {
                    edgeStyle: 'orthogonalEdgeStyle',
                    rounded: false,
                    endArrow: 'block',
                    strokeColor: item.kind === 'loop' ? '#ad4d40' : '#7c6848',
                    strokeWidth: item.kind === 'loop' ? 2 : 2,
                    dashed: item.kind === 'loop',
                    fontColor: item.kind === 'loop' ? '#8e3d33' : '#44534b',
                    fontStyle: 1
                }
            });
        });
    });
    graph.zoomTo(0.9);
    graph.getView?.().setTranslate?.(60, 28);
    setStatus(tool.id, '运行中', '真实 maxGraph 实例，可框选、拖拽、缩放、改边路由');
    return graph;
}

function reteOutputKey(edge) {
    if (edge.from.startsWith('branch_')) return edge.label.startsWith('true') ? 'true' : 'false';
    return 'out';
}

function retePosition(item) {
    const overrides = {
        entry: { x: 520, y: 20 },
        state_normal: { x: 520, y: 150 },
        branch_low_hp: { x: 520, y: 330 },
        action_conservative_throw: { x: 880, y: 330 },
        branch_far_target: { x: 520, y: 540 },
        action_far_throw: { x: 880, y: 540 },
        branch_target_missing_bleed: { x: 520, y: 750 },
        action_rusty_shiv: { x: 880, y: 750 },
        action_fallback_throw: { x: 160, y: 750 },
        merge: { x: 520, y: 980 },
        end_turn: { x: 520, y: 1160 },
        end: { x: 520, y: 1320 }
    };
    return overrides[item.id] || { x: item.x, y: item.y };
}

function hasRetePort(collection, key) {
    if (!collection) return false;
    if (typeof collection.has === 'function') return collection.has(key);
    return Object.prototype.hasOwnProperty.call(collection, key);
}

async function renderRete(container, scenario, tool) {
    setStatus(tool.id, '加载中', '读取 Rete/Lit 插件');
    const [
        { NodeEditor, ClassicPreset },
        { AreaPlugin, AreaExtensions },
        { ConnectionPlugin, Presets: ConnectionPresets },
        { LitPlugin, Presets: LitPresets }
    ] = await Promise.all([
        import(CDN.rete),
        import(CDN.reteArea),
        import(CDN.reteConnection),
        import(CDN.reteLit)
    ]);
    clearElement(container);
    const socket = new ClassicPreset.Socket('flow');
    const editor = new NodeEditor();
    const area = new AreaPlugin(container);
    const connection = new ConnectionPlugin();
    const render = new LitPlugin();

    render.addPreset(LitPresets.classic.setup());
    connection.addPreset(ConnectionPresets.classic.setup());
    editor.use(area);
    area.use(connection);
    area.use(render);
    AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
        accumulating: AreaExtensions.accumulateOnCtrl()
    });

    const nodes = new Map();
    for (const item of scenario.nodes) {
        const reteNode = new ClassicPreset.Node(`${nodeKind(item.type)} / ${item.label}`);
        if (item.type !== 'entry') {
            reteNode.addInput('in', new ClassicPreset.Input(socket, '入'));
        }
        if (item.type === 'branch') {
            reteNode.addOutput('true', new ClassicPreset.Output(socket, 'true'));
            reteNode.addOutput('false', new ClassicPreset.Output(socket, 'false'));
        } else if (item.type !== 'end') {
            reteNode.addOutput('out', new ClassicPreset.Output(socket, '出'));
        }
        if (item.subtitle && item.type !== 'entry' && item.type !== 'end') {
            reteNode.addControl('meta', new ClassicPreset.InputControl('text', {
                initial: item.subtitle,
                readonly: true
            }));
        }
        await editor.addNode(reteNode);
        const position = retePosition(item);
        await area.translate(reteNode.id, { x: position.x - 118, y: position.y - 42 });
        nodes.set(item.id, reteNode);
    }

    for (const item of scenario.edges) {
        if (item.kind === 'loop') continue;
        const source = nodes.get(item.from);
        const target = nodes.get(item.to);
        if (!source || !target || !hasRetePort(target.inputs, 'in')) continue;
        const outputKey = reteOutputKey(item);
        if (!hasRetePort(source.outputs, outputKey)) continue;
        await editor.addConnection(new ClassicPreset.Connection(source, outputKey, target, 'in'));
    }

    await AreaExtensions.zoomAt(area, editor.getNodes());
    await area.area.zoom(0.5, 0, 0);
    await area.area.translate(560, 34);
    setStatus(tool.id, '运行中', '真实 Rete.js 实例，可拖拽节点和 socket 连线；形态更偏蓝图');
    return { editor, area };
}

function renderToolMeta(container, tool) {
    clearElement(container);
    appendText(container, 'h3', tool.name);
    appendText(container, 'p', tool.verdict, 'tool-verdict');
    const source = document.createElement('a');
    source.href = tool.source;
    source.target = '_blank';
    source.rel = 'noreferrer';
    source.textContent = tool.source;
    source.className = 'tool-source';
    container.appendChild(source);
    appendText(container, 'h4', '强项');
    const strengths = document.createElement('ul');
    tool.strengths.forEach(item => appendText(strengths, 'li', item));
    container.appendChild(strengths);
    appendText(container, 'h4', '风险');
    const risks = document.createElement('ul');
    tool.risks.forEach(item => appendText(risks, 'li', item));
    container.appendChild(risks);
}

function renderScenarioAside(scenario) {
    byId('spikeTitle').textContent = scenario.title;
    byId('spikeSummary').textContent = scenario.summary;
    byId('enemyName').textContent = scenario.enemy.name;
    byId('enemyState').textContent = scenario.enemy.state;
    const skillList = byId('enemySkills');
    clearElement(skillList);
    scenario.enemy.skills.forEach(skill => appendText(skillList, 'span', `${skill.id} / ${skill.name}`, 'skill-pill'));
}

function renderTabButtons(scenario, page) {
    const tabRoot = byId('candidateTabs');
    clearElement(tabRoot);
    scenario.tools.forEach(tool => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'candidate-tab';
        button.dataset.toolId = tool.id;
        button.textContent = `${tool.name} · ${tool.role}`;
        button.addEventListener('click', () => page.activate(tool.id));
        tabRoot.appendChild(button);
    });
}

export class EnemyDecisionToolSpikePage {
    constructor(options = {}) {
        this.scenario = options.scenario || createDecisionToolSpikeScenario();
        this.instances = new Map();
        this.activeToolId = this.scenario.tools[0]?.id || 'logicflow';
    }

    bind() {
        renderScenarioAside(this.scenario);
        renderTabButtons(this.scenario, this);
        this.scenario.tools.forEach(tool => {
            renderToolMeta(byId(`${tool.id}Meta`), tool);
        });
        byId('initAllBtn')?.addEventListener('click', () => this.initAll());
        this.activate(this.activeToolId);
        window.enemyDecisionToolSpike = this;
    }

    async activate(toolId) {
        this.activeToolId = toolId;
        document.querySelectorAll('.candidate-tab').forEach(button => {
            button.classList.toggle('is-active', button.dataset.toolId === toolId);
        });
        document.querySelectorAll('.candidate-panel').forEach(panel => {
            panel.hidden = panel.dataset.toolId !== toolId;
        });
        await this.ensureTool(toolId);
    }

    async initAll() {
        for (const tool of this.scenario.tools) {
            await this.ensureTool(tool.id);
        }
    }

    applyLogicFlowAutoLayout() {
        const instance = this.instances.get('logicflow');
        if (!instance || instance.fallback) return null;
        return applyLogicFlowActivityLayout(instance, this.scenario);
    }

    async ensureTool(toolId) {
        if (this.instances.has(toolId)) return this.instances.get(toolId);
        const tool = this.scenario.tools.find(item => item.id === toolId);
        const container = byId(`${toolId}Mount`);
        if (!tool || !container) return null;
        try {
            let instance = null;
            if (toolId === 'logicflow') instance = await renderLogicFlow(container, this.scenario, tool);
            else if (toolId === 'maxgraph') instance = await renderMaxGraph(container, this.scenario, tool);
            else if (toolId === 'rete') instance = await renderRete(container, this.scenario, tool);
            this.instances.set(toolId, instance);
            return instance;
        } catch (error) {
            setStatus(toolId, '加载失败', error?.message || String(error));
            createFallbackSvg(container, this.scenario, tool, error?.message || String(error));
            this.instances.set(toolId, { fallback: true, error });
            return null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const page = new EnemyDecisionToolSpikePage();
    page.bind();
});
