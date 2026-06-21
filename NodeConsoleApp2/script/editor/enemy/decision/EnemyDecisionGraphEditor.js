import {
    cloneDecision,
    conditionReadSummary,
    createDefaultDecisionTemplate,
    decisionConditionDefinition,
    decisionConditionOptions,
    decisionSubjectOptions,
    decisionTargetQueryOption,
    decisionTargetQueryOptions,
    describeActionSemantics,
    normalizeEnemyDecision,
    normalizeCondition,
    normalizeSubjectRef,
    normalizeTargetQuery,
    previewEnemyDecision,
    skillTargetLabel,
    subjectRefLabel,
    targetQueryLabel,
    validateEnemyDecision
} from './EnemyDecisionGraphModel.js';
import {
    EnemyDecisionCanvasRenderer,
    getActivityNodeSize,
    getActivityPortBounds
} from './EnemyDecisionCanvasRenderer.js';

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function uniqueText(value, fallback = '') {
    const next = String(value ?? '').trim();
    return next || fallback;
}

function createElement(doc, tagName, className = '') {
    const element = doc.createElement(tagName);
    if (className) element.className = className;
    return element;
}

function createSvgElement(doc, tagName, className = '') {
    const element = typeof doc.createElementNS === 'function'
        ? doc.createElementNS('http://www.w3.org/2000/svg', tagName)
        : doc.createElement(tagName);
    if (className) element.setAttribute?.('class', className);
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

function refreshFakeText(element) {
    if (!element || element.nodeType) return;
    element.textContent = Array.from(element.children || [])
        .map(child => child.textContent || '')
        .join('\n');
}

function uniqueNodeId(nodes, prefix) {
    const used = new Set(nodes.map(node => node.id));
    let index = 1;
    let candidate = `${prefix}_${index}`;
    while (used.has(candidate)) {
        index += 1;
        candidate = `${prefix}_${index}`;
    }
    return candidate;
}

function uniqueEdgeId(edges, from, to) {
    const used = new Set(edges.map(edge => edge.id));
    let index = 1;
    let candidate = `edge_${from}_${to}`.replace(/[^a-z0-9_:-]+/giu, '_');
    while (used.has(candidate)) {
        index += 1;
        candidate = `edge_${from}_${to}_${index}`.replace(/[^a-z0-9_:-]+/giu, '_');
    }
    return candidate;
}

function clampNumber(value, min, max, fallback = min) {
    const next = Number(value);
    if (!Number.isFinite(next)) return fallback;
    return Math.min(max, Math.max(min, next));
}

function normalizeViewport(viewport = {}) {
    const source = asObject(viewport);
    return {
        x: Math.round(Number(source.x) || 0),
        y: Math.round(Number(source.y) || 0),
        zoom: Number(clampNumber(source.zoom, 0.45, 2.75, 1).toFixed(2)),
        rotation: Math.round(Number(source.rotation) || 0)
    };
}

function translateLabel(value, fallback = '') {
    const text = String(value || '').trim();
    const labels = {
        Entry: '入口',
        Start: '入口',
        Normal: '默认状态',
        Condition: '条件判断',
        Action: '行动',
        'Basic Attack': '基础攻击',
        'Basic Aggressor': '基础进攻模板',
        'New State': '新状态'
    };
    return labels[text] || text || fallback;
}

function conditionLabel(condition = {}) {
    const source = asObject(condition);
    if (!source.type || source.type === 'always') return '始终成立';
    const fallbackSubject = source.type === 'target_distance_gte' || source.type === 'target_missing_status'
        ? 'target.current'
        : 'actor.self';
    const subject = subjectRefLabel(source.subjectRef || { resolverId: fallbackSubject });
    if (source.type === 'self_hp_ratio_lte') return `${subject} HP <= ${source.value}`;
    if (source.type === 'self_hp_ratio_gte') return `${subject} HP >= ${source.value}`;
    if (source.type === 'turn_number_modulo') return `回合 % ${source.mod} = ${source.equals}`;
    if (source.type === 'previous_action_is') return `上一行动是 ${source.actionId || '-'}`;
    if (source.type === 'target_distance_gte') return `${subject} 距离 >= ${source.value}`;
    if (source.type === 'target_missing_status') return `${subject} 未处于 ${source.status || '-'}`;
    return source.type;
}

function nodeTitle(node) {
    if (node.type === 'entry') return '入口';
    if (node.type === 'actionEnd') return '行动结束';
    if (node.type === 'state') return translateLabel(node.label, '默认状态');
    if (node.type === 'branch') return translateLabel(node.label, '条件判断');
    if (node.type === 'action') return translateLabel(node.displayLabel || node.label || node.skillId, '行动');
    return translateLabel(node.id, '节点');
}

function nodeTypeLabel(type) {
    const labels = {
        entry: '入口',
        state: '状态',
        branch: '分支',
        action: '行动'
    };
    return labels[type] || type || '节点';
}

function issueLabel(issue = {}) {
    const labels = {
        missing_node_id: '缺少节点 ID',
        duplicate_node_id: '节点 ID 重复',
        missing_entry_node: '缺少入口节点',
        multiple_entry_nodes: '入口节点超过一个',
        missing_initial_state: '缺少初始状态',
        edge_missing_from_node: '连线起点不存在',
        edge_missing_to_node: '连线终点不存在',
        entry_must_connect_state: '入口必须连接到状态',
        state_missing_exit: '状态缺少出口',
        branch_missing_true_exit: '分支缺少 true 出口',
        branch_missing_false_exit: '分支缺少 false 出口',
        missing_skill_binding: '行动未绑定有效技能',
        action_missing_actor_ref: '行动缺少行动者主语',
        action_missing_target_query: '行动缺少目标解析',
        action_target_query_incompatible_with_skill: '目标解析与技能目标约束不匹配',
        action_target_part_not_allowed: '目标部位不在技能候选范围内',
        action_missing_next_state: '行动缺少回流状态',
        action_next_state_must_be_state: '行动回流目标必须是状态节点',
        single_turn_loop_detected: '检测到单回合循环风险'
    };
    return labels[issue.code] || issue.code || '未知问题';
}

function severityLabel(severity) {
    const labels = {
        error: '错误',
        warn: '警告',
        warning: '警告',
        info: '提示'
    };
    return labels[severity] || severity || '提示';
}

function fallbackLabel(reason) {
    const labels = {
        missing_skill_binding: '技能绑定缺失',
        skill_ap_too_high: 'AP 不足',
        node_fallback: '使用节点兜底',
        dead_end: '路径中断'
    };
    return labels[reason] || reason;
}

function skillDisplayName(resolved, fallback = '') {
    const source = asObject(resolved);
    const skill = asObject(source.skill || resolved);
    return uniqueText(skill.name || skill.displayName || source.name || fallback, fallback);
}

const STANDARD_TARGET_PARTS = ['head', 'chest', 'abdomen', 'arm', 'leg'];

function bodyPartLabel(partId = '') {
    const labels = {
        head: '头部',
        chest: '胸部',
        abdomen: '腹部',
        arm: '手臂',
        leg: '腿部'
    };
    return labels[partId] || partId;
}

const ACTIVITY_LAYOUT = {
    centerX: 520,
    loopRailX: 74,
    actionColumnX: 760,
    viewOriginY: 430,
    startY: 30,
    stateY: 132,
    stateGap: 150,
    branchStartY: 280,
    branchGap: 126,
    actionStartY: 270,
    actionGap: 126,
    mainGap: 18,
    mergeGap: 72,
    endTurnGap: 86,
    endGap: 78,
    minMergeY: 690
};

const ACTIVITY_NODE_SIZE = {
    entry: { width: 76, height: 76 },
    state: { width: 220, height: 82 },
    branch: { width: 168, height: 136 },
    action: { width: 220, height: 86 }
};

const ACTIVITY_LAYOUT_VERSION = 3;

const RETE_LAYOUT_VERSION = 2;
const RETE_WORLD = {
    width: 2400,
    height: 1400,
    startX: 90,
    centerY: 420,
    entryToState: 230,
    columnGap: 310
};
const RETE_ACTION_END_NODE_ID = '__action_end__';

function normalizeReteViewport(viewport = {}) {
    const source = asObject(viewport);
    return {
        x: Math.round(Number(source.x) || 0),
        y: Math.round(Number(source.y) || 0),
        zoom: Number(clampNumber(source.zoom, 0.35, 2.5, 1).toFixed(2))
    };
}

function reteViewportTransformStyle(viewport = {}) {
    const source = normalizeReteViewport(viewport);
    return `translate(${source.x}px, ${source.y}px) scale(${source.zoom}) scale(var(--decision-rete-scale, 1))`;
}

function activityKind(node = {}) {
    if (node.type === 'entry') return 'entry';
    if (node.type === 'branch') return 'branch';
    if (node.type === 'action') return 'action';
    if (node.type === 'actionEnd') return 'actionEnd';
    return 'state';
}

function activityNodeSize(node = {}) {
    return ACTIVITY_NODE_SIZE[activityKind(node)] || ACTIVITY_NODE_SIZE.state;
}

function activityLabel(node = {}) {
    const labels = {
        entry: '开始',
        state: '状态',
        branch: '判断',
        action: '行动'
    };
    return labels[activityKind(node)] || '节点';
}

function activityPosition(node, typeIndex, counts = {}) {
    const kind = activityKind(node);
    const size = activityNodeSize(node);
    const centerX = ACTIVITY_LAYOUT.centerX;
    const stateIndex = Math.max(0, typeIndex);
    const branchIndex = Math.max(0, typeIndex);
    const actionIndex = Math.max(0, typeIndex);
    const yByKind = {
        entry: ACTIVITY_LAYOUT.startY,
        state: ACTIVITY_LAYOUT.stateY + stateIndex * ACTIVITY_LAYOUT.stateGap,
        branch: ACTIVITY_LAYOUT.branchStartY + branchIndex * ACTIVITY_LAYOUT.branchGap,
        action: ACTIVITY_LAYOUT.actionStartY + actionIndex * ACTIVITY_LAYOUT.actionGap
    };
    const xByKind = {
        entry: Math.round(centerX - size.width / 2),
        state: Math.round(centerX - ACTIVITY_NODE_SIZE.state.width / 2),
        branch: Math.round(centerX - ACTIVITY_NODE_SIZE.branch.width / 2),
        action: ACTIVITY_LAYOUT.actionColumnX
    };
    return {
        x: xByKind[kind] ?? Math.round(centerX - size.width / 2),
        y: Math.round(yByKind[kind] ?? ACTIVITY_LAYOUT.stateY)
    };
}

function viewportTransformStyle(viewport = {}) {
    const source = normalizeViewport(viewport);
    return `translate(${source.x}px, ${source.y}px) rotate(${source.rotation}deg) scale(${source.zoom})`;
}

function inverseViewportDelta(dx = 0, dy = 0, viewport = {}) {
    const source = normalizeViewport(viewport);
    const zoom = source.zoom || 1;
    const radians = (source.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
        x: (dx * cos + dy * sin) / zoom,
        y: (-dx * sin + dy * cos) / zoom
    };
}

function edgeKind(edge = {}, source = {}, target = {}) {
    if (edge.kind === 'actionEnd' || target.type === 'actionEnd') return 'action-end';
    if (edge.kind === 'loop' || edge.fromPort === 'nextState' || (source.type === 'action' && target.type === 'state')) return 'loop';
    if (edge.branch === 'true') return 'true';
    if (edge.branch === 'false') return 'false';
    if (edge.fromPort === 'fallback') return 'fallback';
    return 'flow';
}

export class EnemyDecisionGraphEditor {
    constructor(options = {}) {
        this.document = options.document || globalThis.document;
        this.root = options.root || null;
        this.templateList = options.templateList || null;
        this.skillList = options.skillList || null;
        this.canvas = options.canvas || null;
        this.inspector = options.inspector || null;
        this.issueList = options.issueList || null;
        this.previewTrace = options.previewTrace || null;
        this.fullscreenToggle = options.fullscreenToggle || null;
        this.actions = options.actions || {};
        this.canvasRenderer = options.canvasRenderer || new EnemyDecisionCanvasRenderer({ document: this.document });
        this.enemy = null;
        this.context = {};
        this.decision = null;
        this.selectedNodeId = '';
        this.fullscreen = false;
        this.workspaceMode = 'edit';
        this.viewport = normalizeViewport();
        this.pendingConnectionFrom = '';
        this.pendingConnection = null;
        this.connectionDragState = null;
        this.dragState = null;
        this.retePanState = null;
        this.boundFullscreenKeydown = event => this.handleFullscreenKeydown(event);
        this.boundNodeDragMove = event => this.handleNodeDragMove(event);
        this.boundNodeDragEnd = () => this.endNodeDrag();
        this.boundRetePanMove = event => this.handleRetePanMove(event);
        this.boundRetePanEnd = () => this.endRetePan();
        this.boundConnectionDragMove = event => this.handleConnectionDragMove(event);
        this.boundConnectionDragEnd = event => this.endConnectionDrag(event);
        this.bindActions();
        this.syncFullscreenState();
        this.syncWorkspaceModeState();
    }

    bindActions() {
        const bindings = [
            ['addState', () => this.addStateNode()],
            ['addBranch', () => this.addBranchNode()],
            ['addAction', () => this.addActionNode()],
            ['duplicateTemplate', () => this.duplicateTemplate()],
            ['deleteTemplate', () => this.deleteTemplate()],
            ['validate', () => {
                this.setWorkspaceMode('validate');
                this.renderIssues();
            }],
            ['preview', () => {
                this.setWorkspaceMode('preview');
                this.renderPreview();
            }],
            ['zoomIn', () => this.zoomReteViewport(1.15)],
            ['zoomOut', () => this.zoomReteViewport(1 / 1.15)],
            ['resetView', () => this.resetReteViewport()],
            ['fitView', () => this.fitReteViewport()],
            ['rotate', () => this.rotateViewport(6)],
            ['viewEdit', () => this.setWorkspaceMode('edit')],
            ['viewPreview', () => {
                this.setWorkspaceMode('preview');
                this.renderPreview();
            }],
            ['viewValidate', () => {
                this.setWorkspaceMode('validate');
                this.renderIssues();
            }],
            ['viewPublish', () => {
                this.setWorkspaceMode('publish');
                this.renderIssues();
            }]
        ];
        bindings.forEach(([key, handler]) => {
            this.actions[key]?.addEventListener?.('click', handler);
        });
        this.fullscreenToggle?.addEventListener?.('click', () => this.toggleFullscreen());
    }

    handleFullscreenKeydown(event = {}) {
        if (event.key === 'Escape' && this.fullscreen) {
            this.setFullscreen(false);
        }
    }

    toggleFullscreen() {
        return this.setFullscreen(!this.fullscreen);
    }

    setFullscreen(enabled) {
        const next = Boolean(enabled);
        if (this.fullscreen === next) {
            this.syncFullscreenState();
            return this.fullscreen;
        }

        this.fullscreen = next;
        if (this.fullscreen) {
            this.document?.addEventListener?.('keydown', this.boundFullscreenKeydown);
            this.applyActivityLayout();
        } else {
            this.document?.removeEventListener?.('keydown', this.boundFullscreenKeydown);
        }
        this.syncFullscreenState();
        this.renderCanvas();
        this.renderPreview();
        return this.fullscreen;
    }

    isFullscreen() {
        return this.fullscreen;
    }

    getViewport() {
        return { ...this.viewport };
    }

    setViewport(nextViewport = {}) {
        this.viewport = normalizeViewport({ ...this.viewport, ...asObject(nextViewport) });
        if (this.decision?.layout) {
            this.decision.layout.viewport = { ...this.viewport };
        }
        this.renderCanvas();
        return this.getViewport();
    }

    zoomViewport(factor = 1) {
        const multiplier = Number(factor);
        const nextZoom = this.viewport.zoom * (Number.isFinite(multiplier) ? multiplier : 1);
        return this.setViewport({ zoom: nextZoom });
    }

    panViewport(x = 0, y = 0) {
        return this.setViewport({
            x: this.viewport.x + Math.round(Number(x) || 0),
            y: this.viewport.y + Math.round(Number(y) || 0)
        });
    }

    rotateViewport(delta = 0) {
        return this.setViewport({ rotation: this.viewport.rotation + Math.round(Number(delta) || 0) });
    }

    resetViewport() {
        return this.setViewport({ x: 0, y: 0, zoom: 1, rotation: 0 });
    }

    fitViewport() {
        return this.setViewport({ x: 0, y: 0, zoom: this.fullscreen ? 1.08 : 0.92, rotation: 0 });
    }

    syncFullscreenState() {
        this.root?.classList?.toggle?.('is-decision-fullscreen', this.fullscreen);
        this.document?.body?.classList?.toggle?.('enemy-decision-fullscreen-active', this.fullscreen);
        if (!this.fullscreenToggle) return;
        this.fullscreenToggle.textContent = this.fullscreen ? '退出全屏' : '全屏编辑';
        this.fullscreenToggle.setAttribute?.('aria-pressed', this.fullscreen ? 'true' : 'false');
        this.fullscreenToggle.title = this.fullscreen ? '退出敌人决策全屏编辑' : '进入敌人决策全屏编辑';
    }

    setWorkspaceMode(mode = 'edit') {
        const allowed = new Set(['edit', 'preview', 'validate', 'publish']);
        this.workspaceMode = allowed.has(mode) ? mode : 'edit';
        this.syncWorkspaceModeState();
        this.renderCanvas();
        this.renderInspector();
        return this.workspaceMode;
    }

    syncWorkspaceModeState() {
        const buttonByMode = {
            edit: this.actions.viewEdit,
            preview: this.actions.viewPreview,
            validate: this.actions.viewValidate,
            publish: this.actions.viewPublish
        };
        Object.entries(buttonByMode).forEach(([mode, button]) => {
            button?.setAttribute?.('aria-pressed', mode === this.workspaceMode ? 'true' : 'false');
        });
        if (this.canvas) {
            this.canvas.dataset.workspaceMode = this.workspaceMode;
            this.canvas.dataset.primaryEditor = 'rete';
        }
    }

    setEnemy(enemy = {}, context = {}) {
        this.enemy = enemy;
        this.context = {
            templates: {},
            resolveSkill: skillId => context.workspace?.resolveSkill?.(skillId) || context.resolveSkill?.(skillId) || null,
            ...context
        };
        this.decision = normalizeEnemyDecision({ enemy, templates: this.context.templates });
        this.viewport = normalizeViewport(this.decision.layout?.viewport);
        if (this.decision.layout) {
            this.decision.layout.viewport = { ...this.viewport };
        }
        const stateNode = asArray(this.decision.graph?.nodes).find(node => node.type === 'state');
        this.selectedNodeId = stateNode?.id || this.decision.graph?.entryNodeId || '';
        this.render();
    }

    getDecision() {
        return cloneDecision(this.decision || normalizeEnemyDecision({ enemy: this.enemy || {} }));
    }

    syncFromDom() {
        return this.getDecision();
    }

    destroy() {
        this.setFullscreen(false);
        this.endNodeDrag();
        this.endRetePan();
        this.enemy = null;
        this.context = {};
        this.decision = null;
    }

    render() {
        this.renderTemplates();
        this.renderSkills();
        this.renderCanvas();
        this.renderInspector();
        this.renderIssues();
        this.renderPreview();
    }

    renderTemplates() {
        if (!this.templateList) return;
        clearElement(this.templateList);
        const templates = {
            tpl_basic_aggressor: createDefaultDecisionTemplate(),
            ...asObject(this.context.templates)
        };
        Object.values(templates).forEach((template) => {
            const button = createElement(this.document, 'button', 'decision-template-item secondary');
            button.type = 'button';
            button.textContent = `${translateLabel(template.name, template.id)} 版本 ${template.revision || 1}`;
            button.dataset.templateId = template.id;
            if (template.id === this.decision?.templateId) button.setAttribute?.('aria-current', 'true');
            button.addEventListener('click', () => {
                this.decision.templateId = template.id;
                this.decision.templateRevision = template.revision || 1;
                this.renderTemplates();
            });
            this.templateList.appendChild(button);
        });
        refreshFakeText(this.templateList);
    }

    renderSkills() {
        if (!this.skillList) return;
        clearElement(this.skillList);
        asArray(this.enemy?.skills).forEach((skillId) => {
            const resolved = this.context.resolveSkill?.(skillId);
            const skill = asObject(asObject(resolved).skill || resolved);
            const chip = createElement(this.document, 'div', 'decision-skill-chip');
            const title = createElement(this.document, 'span', 'decision-skill-chip-title');
            title.textContent = skillDisplayName(resolved, skillId);
            const meta = createElement(this.document, 'span', 'decision-skill-chip-meta');
            meta.textContent = [
                skillId,
                skill.target ? skillTargetLabel(skill) : '目标约束未解析'
            ].filter(Boolean).join(' · ');
            chip.appendChild(title);
            chip.appendChild(meta);
            this.skillList.appendChild(chip);
        });
        if (asArray(this.enemy?.skills).length === 0) {
            this.skillList.textContent = '当前敌人未绑定技能。';
            return;
        }
        refreshFakeText(this.skillList);
    }

    renderCanvas() {
        if (!this.canvas) return;
        clearElement(this.canvas);
        this.syncWorkspaceModeState();
        const nodes = asArray(this.decision?.graph?.nodes);
        const edges = asArray(this.decision?.graph?.edges);
        const visualNodes = nodes.map((node) => {
            if (node.type !== 'action') return node;
            const skillId = uniqueText(node.skillId);
            const resolved = skillId ? this.context.resolveSkill?.(skillId) : null;
            const authoredLabel = uniqueText(node.label);
            const resolvedLabel = skillDisplayName(resolved, skillId);
            return {
                ...node,
                displayLabel: authoredLabel && authoredLabel !== skillId ? authoredLabel : resolvedLabel
            };
        });
        const visualEdges = this.buildVisualEdges(visualNodes, edges);
        const canvasLayer = this.canvasRenderer.render({
            container: this.canvas,
            nodes: visualNodes,
            edges: visualEdges,
            layoutNodes: asObject(this.decision?.layout?.nodes),
            initialStateId: this.decision?.graph?.initialStateId || '',
            selectedNodeId: this.selectedNodeId,
            pendingConnectionFrom: this.pendingConnectionFrom,
            viewport: this.viewport
        });
        const transform = viewportTransformStyle(this.viewport);
        const transformOrigin = `${ACTIVITY_LAYOUT.centerX}px ${ACTIVITY_LAYOUT.viewOriginY}px`;
        const interactionLayer = createElement(this.document, 'div', 'decision-interaction-layer');
        interactionLayer.dataset.transformOriginX = String(ACTIVITY_LAYOUT.centerX);
        interactionLayer.dataset.transformOriginY = String(ACTIVITY_LAYOUT.viewOriginY);
        interactionLayer.style.width = canvasLayer?.style?.width || `${canvasLayer?.dataset?.width || 1200}px`;
        interactionLayer.style.height = canvasLayer?.style?.height || `${canvasLayer?.dataset?.height || 900}px`;
        interactionLayer.style.transform = transform;
        interactionLayer.style.transformOrigin = transformOrigin;
        this.canvas.appendChild(interactionLayer);
        visualNodes.forEach((node) => {
            const kind = activityKind(node);
            const layout = asObject(this.decision?.layout?.nodes?.[node.id]);
            const size = getActivityNodeSize(node);
            const selectedClass = node.id === this.selectedNodeId ? ' is-selected' : '';
            const connectingClass = node.id === this.pendingConnectionFrom ? ' is-connecting' : '';
            const hotspot = createElement(
                this.document,
                'button',
                `decision-node-hotspot decision-node-hotspot--${kind}${selectedClass}${connectingClass}`
            );
            hotspot.type = 'button';
            hotspot.dataset.nodeId = node.id;
            hotspot.dataset.nodeType = node.type || '';
            hotspot.setAttribute?.(
                'aria-label',
                `${nodeTitle(node)}，${nodeTypeLabel(node.type)}，${activityLabel(node)}`
            );
            hotspot.title = `${nodeTitle(node)}：点击选择，拖拽移动。`;
            hotspot.style.left = `${Number(layout.x ?? 0)}px`;
            hotspot.style.top = `${Number(layout.y ?? 0)}px`;
            hotspot.style.width = `${size.width}px`;
            hotspot.style.height = `${size.height}px`;
            hotspot.addEventListener('mousedown', (event) => this.beginNodeDrag(event, node.id));
            hotspot.addEventListener('click', () => {
                if (this.pendingConnectionFrom && this.pendingConnectionFrom !== node.id) {
                    this.connectNodes(this.pendingConnectionFrom, node.id);
                    return;
                }
                this.selectedNodeId = node.id;
                this.renderCanvas();
                this.renderInspector();
            });
            interactionLayer.appendChild(hotspot);

            if (node.type === 'entry') return;
            const portLayout = getActivityPortBounds(node, layout);
            const port = createElement(this.document, 'button', 'decision-node-port');
            port.type = 'button';
            port.dataset.connectFrom = node.id;
            port.dataset.nodeId = node.id;
            port.setAttribute?.('aria-label', `从 ${nodeTitle(node)} 连出`);
            port.title = '从这个节点开始连线，再点击目标节点';
            port.style.left = `${portLayout.x}px`;
            port.style.top = `${portLayout.y}px`;
            port.style.width = `${portLayout.width}px`;
            port.style.height = `${portLayout.height}px`;
            port.addEventListener('click', (event) => {
                event.stopPropagation?.();
                this.startConnection(node.id);
            });
            interactionLayer.appendChild(port);
        });
        const reteLayoutNodes = this.ensureReteLayoutNodes(visualNodes, asObject(this.decision?.layout?.nodes));
        this.renderReteWorkbench({
            container: this.canvas,
            nodes: visualNodes,
            edges: visualEdges,
            layoutNodes: reteLayoutNodes,
            initialStateId: this.decision?.graph?.initialStateId || ''
        });
        refreshFakeText(this.canvas);
    }

    renderReteWorkbench({ container, nodes = [], edges = [], layoutNodes = {}, initialStateId = '' } = {}) {
        if (!container) return;
        const workbench = createElement(this.document, 'div', 'decision-rete-workbench');
        const viewport = normalizeReteViewport(this.decision?.layout?.reteViewport);
        const actionEndNode = this.createReteActionEndPreview(nodes, layoutNodes);
        if (actionEndNode && this.decision?.layout) {
            if (!this.decision.layout.reteNodes) this.decision.layout.reteNodes = layoutNodes;
            const savedLayout = asObject(this.decision.layout.reteNodes[actionEndNode.node.id]);
            const hasSavedLayout = Number.isFinite(Number(savedLayout.x)) && Number.isFinite(Number(savedLayout.y));
            if (!hasSavedLayout) this.decision.layout.reteNodes[actionEndNode.node.id] = { ...actionEndNode.layout };
        }
        const savedActionEndLayout = asObject(this.decision?.layout?.reteNodes?.[actionEndNode?.node?.id]);
        const hasSavedActionEndLayout = Number.isFinite(Number(savedActionEndLayout.x)) && Number.isFinite(Number(savedActionEndLayout.y));
        const renderNodes = actionEndNode ? [...nodes, actionEndNode.node] : nodes;
        const renderLayoutNodes = actionEndNode
            ? { ...layoutNodes, [actionEndNode.node.id]: hasSavedActionEndLayout ? savedActionEndLayout : actionEndNode.layout }
            : layoutNodes;
        workbench.dataset.primaryEditor = 'rete';
        workbench.dataset.workspaceMode = this.workspaceMode;
        workbench.dataset.worldWidth = String(RETE_WORLD.width);
        workbench.dataset.worldHeight = String(RETE_WORLD.height);
        workbench.style.width = `${RETE_WORLD.width}px`;
        workbench.style.height = `${RETE_WORLD.height}px`;
        workbench.dataset.zoom = String(viewport.zoom);
        workbench.style.transform = reteViewportTransformStyle(viewport);
        workbench.style.transformOrigin = '0 0';
        workbench.addEventListener('mousedown', event => this.beginRetePan(event));
        workbench.addEventListener('wheel', event => this.handleReteWheel(event));

        const edgeLayer = createSvgElement(this.document, 'svg', 'decision-rete-connection-layer');
        edgeLayer.setAttribute?.('viewBox', `0 0 ${RETE_WORLD.width} ${RETE_WORLD.height}`);
        edgeLayer.setAttribute?.('width', String(RETE_WORLD.width));
        edgeLayer.setAttribute?.('height', String(RETE_WORLD.height));
        edgeLayer.setAttribute?.('aria-hidden', 'true');
        this.renderReteEdges(edgeLayer, renderNodes, edges, renderLayoutNodes);
        this.renderPendingReteConnection(edgeLayer, renderNodes, renderLayoutNodes);
        workbench.appendChild(edgeLayer);

        renderNodes.forEach((node) => {
            const layout = asObject(renderLayoutNodes[node.id]);
            workbench.appendChild(this.createReteNode(node, layout, initialStateId));
        });

        container.appendChild(workbench);
    }

    renderReteEdges(edgeLayer, nodes = [], edges = [], layoutNodes = {}) {
        const nodeById = new Map(nodes.map(node => [node.id, node]));
        edges.forEach((edge) => {
            const source = nodeById.get(edge.from);
            const target = nodeById.get(edge.to);
            if (!source || !target) return;
            const kind = edgeKind(edge, source, target);
            const path = createSvgElement(this.document, 'path', `decision-rete-edge decision-rete-edge--${kind}`);
            path.dataset.edgeId = edge.id || '';
            path.dataset.from = edge.from || '';
            path.dataset.to = edge.to || '';
            if (edge.branch) path.dataset.branch = edge.branch;
            if (edge.fromPort) path.dataset.fromPort = edge.fromPort;
            if (edge.toPort) path.dataset.toPort = edge.toPort;
            if (edge.nextStateId) path.dataset.nextStateId = edge.nextStateId;
            path.setAttribute?.('d', this.reteEdgePath({
                source: this.reteNodeFrame(source, asObject(layoutNodes[source.id])),
                target: this.reteNodeFrame(target, asObject(layoutNodes[target.id])),
                kind,
                loopIndex: Number(edge.loopIndex) || 0,
                edge,
                sourceNode: source,
                targetNode: target
            }));
            edgeLayer.appendChild(path);
        });
    }

    renderPendingReteConnection(edgeLayer, nodes = [], layoutNodes = {}) {
        if (!this.pendingConnectionFrom) return;
        const source = nodes.find(node => node.id === this.pendingConnectionFrom);
        if (!source) return;
        const sourceFrame = this.reteNodeFrame(source, asObject(layoutNodes[source.id]));
        const sourcePoint = this.retePortPoint({
            node: source,
            frame: sourceFrame,
            direction: 'out',
            branch: this.pendingConnection?.branch || ''
        });
        const targetPoint = this.connectionDragState?.currentPoint || {
            x: sourcePoint.x + 160,
            y: sourcePoint.y
        };
        const path = createSvgElement(this.document, 'path', 'decision-rete-edge decision-rete-edge--pending');
        path.dataset.pendingConnection = 'true';
        path.dataset.from = source.id || '';
        if (this.pendingConnection?.branch) path.dataset.branch = this.pendingConnection.branch;
        const deltaX = Math.max(90, Math.abs(targetPoint.x - sourcePoint.x) * 0.46);
        path.setAttribute?.('d', [
            `M ${sourcePoint.x} ${sourcePoint.y}`,
            `C ${sourcePoint.x + deltaX} ${sourcePoint.y}, ${targetPoint.x - deltaX} ${targetPoint.y}, ${targetPoint.x} ${targetPoint.y}`
        ].join(' '));
        edgeLayer.appendChild(path);
    }

    createReteNode(node, layout = {}, initialStateId = '') {
        const kind = node.type === 'actionEnd' ? 'action-end' : activityKind(node);
        const selectedClass = node.id === this.selectedNodeId ? ' is-selected' : '';
        const connectingClass = node.id === this.pendingConnectionFrom ? ' is-connecting' : '';
        const targetClass = this.pendingConnectionFrom && !node.virtual && node.id !== this.pendingConnectionFrom ? ' is-connect-target' : '';
        const card = createElement(
            this.document,
            'div',
            `decision-rete-node decision-rete-node--${kind}${selectedClass}${connectingClass}${targetClass}`
        );
        const frame = this.reteNodeFrame(node, layout);
        card.dataset.nodeId = node.id || '';
        card.dataset.nodeType = node.type || '';
        card.style.left = `${frame.x}px`;
        card.style.top = `${frame.y}px`;
        card.style.width = `${frame.width}px`;
        card.style.minHeight = `${frame.height}px`;
        card.setAttribute?.('role', 'button');
        card.setAttribute?.('tabindex', '0');
        card.setAttribute?.('aria-label', `${this.reteNodeTitle(node)}，${this.reteNodeTypeLabel(node)}`);

        const head = createElement(this.document, 'div', 'decision-rete-node-head');
        const title = createElement(this.document, 'span', 'decision-rete-title');
        title.textContent = this.reteNodeTitle(node);
        const tag = createElement(this.document, 'span', 'decision-rete-tag');
        tag.textContent = this.reteNodeTypeLabel(node);
        head.appendChild(title);
        head.appendChild(tag);

        const body = createElement(this.document, 'div', 'decision-rete-node-body');
        this.reteNodeDetails(node, initialStateId).forEach(([label, value]) => {
            const row = createElement(this.document, 'div', 'decision-rete-detail');
            const key = createElement(this.document, 'span', 'decision-rete-detail-key');
            key.textContent = label;
            const text = createElement(this.document, 'span', 'decision-rete-detail-value');
            text.textContent = value;
            row.appendChild(key);
            row.appendChild(text);
            body.appendChild(row);
        });

        card.appendChild(head);
        card.appendChild(body);
        this.appendReteSockets(card, node);

        if (node.virtual) return card;
        card.addEventListener('mousedown', (event) => {
            if (event.target?.dataset?.socket) return;
            event.stopPropagation?.();
            this.beginNodeDrag(event, node.id, { layout: 'rete' });
        });
        card.addEventListener('click', (event) => {
            if (event.target?.dataset?.socket) return;
            if (this.pendingConnectionFrom && this.pendingConnectionFrom !== node.id) {
                this.connectNodes(this.pendingConnectionFrom, node.id, this.pendingConnection || {});
                return;
            }
            this.selectedNodeId = node.id;
            this.renderCanvas();
            this.renderInspector();
        });
        return card;
    }

    appendReteSockets(card, node) {
        if (node.type !== 'entry') {
            card.appendChild(this.createReteSocket({
                node,
                direction: 'in',
                className: 'decision-rete-socket decision-rete-socket--in',
                label: '连入'
            }));
        }
        if (node.type === 'branch') {
            card.appendChild(this.createReteSocket({
                node,
                direction: 'out',
                branch: 'true',
                className: 'decision-rete-socket decision-rete-socket--true',
                label: 'true'
            }));
            card.appendChild(this.createReteSocket({
                node,
                direction: 'out',
                branch: 'false',
                className: 'decision-rete-socket decision-rete-socket--false',
                label: 'false'
            }));
            return;
        }
        if (node.type !== 'actionEnd') {
            card.appendChild(this.createReteSocket({
                node,
                direction: 'out',
                className: 'decision-rete-socket decision-rete-socket--out',
                label: '连出'
            }));
        }
    }

    createReteSocket({ node, direction, branch = '', className, label }) {
        const socket = createElement(this.document, 'button', className);
        socket.type = 'button';
        socket.dataset.socket = direction;
        socket.dataset.nodeId = node.id || '';
        socket.dataset.port = branch || direction;
        Object.assign(socket.style, this.reteSocketStyle(node, direction, branch));
        socket.textContent = direction === 'out' ? '+' : '';
        socket.title = direction === 'out'
            ? `${label}：从 ${this.reteNodeTitle(node)} 开始连线`
            : `${label}：连接到 ${this.reteNodeTitle(node)}`;
        socket.setAttribute?.('aria-label', socket.title);
        if (direction === 'out') {
            socket.dataset.connectFrom = node.id || '';
            if (branch) socket.dataset.branch = branch;
            socket.addEventListener('click', (event) => {
                event.stopPropagation?.();
                this.startConnection(node.id, { branch });
            });
            socket.addEventListener('mousedown', (event) => this.beginConnectionDrag(event, node.id, { branch }));
        } else {
            socket.dataset.connectTo = node.id || '';
            socket.addEventListener('click', (event) => {
                event.stopPropagation?.();
                if (this.pendingConnectionFrom && this.pendingConnectionFrom !== node.id) {
                    this.connectNodes(this.pendingConnectionFrom, node.id, this.pendingConnection || {});
                    return;
                }
                this.selectedNodeId = node.id;
                this.renderCanvas();
                this.renderInspector();
            });
        }
        socket.addEventListener('mousedown', event => event.stopPropagation?.());
        return socket;
    }

    reteSocketStyle(node = {}, direction = 'out', branch = '') {
        if (direction === 'in') {
            return {
                left: '-9px',
                top: node.type === 'actionEnd' ? '30px' : '24px'
            };
        }
        if (node.type === 'branch') {
            return {
                right: '-9px',
                top: branch === 'false' ? '80px' : '36px'
            };
        }
        return {
            right: '-9px',
            top: node.type === 'entry' ? '30px' : '48px'
        };
    }

    reteNodeFrame(node = {}, layout = {}) {
        const size = this.reteNodeSize(node);
        return {
            x: Math.max(0, Math.round(Number(layout.x) || 0)),
            y: Math.max(0, Math.round(Number(layout.y) || 0)),
            width: size.width,
            height: size.height
        };
    }

    reteNodeSize(node = {}) {
        if (node.type === 'entry' || node.type === 'actionEnd') return { width: 118, height: 78 };
        if (node.type === 'branch') return { width: 250, height: 124 };
        return { width: 238, height: 112 };
    }

    retePortPoint({ node = {}, frame = {}, direction = 'out', branch = '' } = {}) {
        const isInput = direction === 'in';
        if (node.type === 'branch' && !isInput) {
            const offset = branch === 'false' ? 0.72 : 0.38;
            return { x: frame.x + frame.width, y: frame.y + frame.height * offset };
        }
        if (node.type === 'actionEnd') {
            return { x: frame.x, y: frame.y + frame.height / 2 };
        }
        if (isInput) {
            return { x: frame.x, y: frame.y + Math.min(34, frame.height * 0.32) };
        }
        return { x: frame.x + frame.width, y: frame.y + frame.height / 2 };
    }

    reteEdgePath({ source, target, kind = 'flow', loopIndex = 0, edge = {}, sourceNode = {}, targetNode = {} }) {
        const start = this.retePortPoint({
            node: sourceNode,
            frame: source,
            direction: 'out',
            branch: edge.branch || edge.fromPort || ''
        });
        const end = this.retePortPoint({
            node: targetNode,
            frame: target,
            direction: 'in',
            branch: edge.toPort || ''
        });
        const startX = start.x;
        const startY = start.y;
        const endX = end.x;
        const endY = end.y;
        if (kind === 'loop') {
            const railX = Math.max(64, Math.min(source.x, target.x) - 150 - loopIndex * 24);
            return [
                `M ${startX} ${startY}`,
                `C ${startX - 76} ${startY}, ${railX} ${startY}, ${railX} ${(startY + endY) / 2}`,
                `C ${railX} ${endY}, ${endX - 72} ${endY}, ${endX} ${endY}`
            ].join(' ');
        }
        const deltaX = Math.max(90, Math.abs(endX - startX) * 0.46);
        return [
            `M ${startX} ${startY}`,
            `C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`
        ].join(' ');
    }

    reteNodeTitle(node = {}) {
        if (node.type === 'entry') return '行动开始';
        if (node.type === 'actionEnd') return '行动结束';
        return nodeTitle(node);
    }

    reteNodeTypeLabel(node = {}) {
        if (node.type === 'entry' || node.type === 'actionEnd') return '系统';
        return nodeTypeLabel(node.type);
    }

    actionSemantics(node = {}) {
        return describeActionSemantics({
            action: node,
            decision: this.decision,
            enemy: this.enemy || {},
            resolveSkill: skillId => this.context.resolveSkill?.(skillId)
        });
    }

    reteNodeDetails(node = {}, initialStateId = '') {
        if (node.type === 'entry') {
            return [
                ['调用', '每回合进入一次'],
                ['输出', uniqueText(initialStateId, 'state_normal')]
            ];
        }
        if (node.type === 'branch') {
            const condition = asObject(node.condition);
            const fallbackSubject = condition.type === 'target_distance_gte' || condition.type === 'target_missing_status'
                ? 'target.current'
                : 'actor.self';
            const subject = subjectRefLabel(condition.subjectRef || { resolverId: fallbackSubject });
            return [
                ['主语', subject],
                ['条件', conditionLabel(node.condition)],
                ['true', '进入右侧行动'],
                ['false', '继续下一判断']
            ];
        }
        if (node.type === 'action') {
            const semantics = this.actionSemantics(node);
            return [
                ['行动者', semantics.actorLabel],
                ['技能', semantics.skillLabel],
                ['目标解析', semantics.targetLabel],
                ['合法性', semantics.legalityLabel]
            ];
        }
        if (node.type === 'actionEnd') {
            return [
                ['结束', '本回合行动结束'],
                ['下一回合', '由行动节点写入状态']
            ];
        }
        return [
            ['状态', uniqueText(node.id, initialStateId || 'state_normal')],
            ['回流目标', uniqueText(node.id, initialStateId || 'state_normal')]
        ];
    }

    createReteActionEndPreview(nodes = [], layoutNodes = {}) {
        const actionNodes = nodes.filter(node => node.type === 'action');
        if (actionNodes.length === 0) return null;
        const actionFrames = actionNodes.map(node => this.reteNodeFrame(node, asObject(layoutNodes[node.id])));
        const maxRight = actionFrames.reduce((current, frame) => Math.max(current, frame.x + frame.width), RETE_WORLD.startX);
        const averageY = actionFrames.reduce((sum, frame) => sum + frame.y + frame.height / 2, 0) / Math.max(1, actionFrames.length);
        const maxY = nodes.reduce((current, node) => {
            const frame = this.reteNodeFrame(node, asObject(layoutNodes[node.id]));
            return Math.max(current, frame.y + frame.height);
        }, ACTIVITY_LAYOUT.branchStartY);
        const defaultLayout = {
            x: Math.min(RETE_WORLD.width - 320, Math.max(maxRight + 220, RETE_WORLD.startX + 1240)),
            y: Math.min(RETE_WORLD.height - 180, Math.max(90, Math.min(maxY + 60, Math.round(averageY - 56))))
        };
        const savedLayout = asObject(layoutNodes[RETE_ACTION_END_NODE_ID]);
        const hasSavedLayout = Number.isFinite(Number(savedLayout.x)) && Number.isFinite(Number(savedLayout.y));
        return {
            node: {
                id: RETE_ACTION_END_NODE_ID,
                type: 'actionEnd',
                label: '行动结束',
                system: true,
                terminal: true
            },
            layout: hasSavedLayout ? { x: Number(savedLayout.x), y: Number(savedLayout.y) } : defaultLayout
        };
    }

    ensureReteLayoutNodes(nodes = [], activityLayoutNodes = {}) {
        if (!this.decision?.layout) return {};
        const shouldRebuild = this.decision.layout.reteLayoutVersion !== RETE_LAYOUT_VERSION
            || !this.decision.layout.reteNodes
            || typeof this.decision.layout.reteNodes !== 'object';
        if (shouldRebuild) {
            this.decision.layout.reteNodes = {};
        }
        this.decision.layout.reteLayoutVersion = RETE_LAYOUT_VERSION;
        this.decision.layout.reteViewport = normalizeReteViewport(this.decision.layout.reteViewport);
        const reteNodes = this.decision.layout.reteNodes;
        const indexes = { entry: 0, state: 0, branch: 0, action: 0 };
        const counts = { entry: 0, state: 0, branch: 0, action: 0 };
        nodes.forEach((node) => {
            counts[activityKind(node)] += 1;
        });
        nodes.forEach((node) => {
            const kind = activityKind(node);
            const index = indexes[kind] || 0;
            indexes[kind] = index + 1;
            if (reteNodes[node.id]) return;
            reteNodes[node.id] = this.defaultRetePosition(node, index, counts, asObject(activityLayoutNodes[node.id]));
        });
        return reteNodes;
    }

    defaultRetePosition(node = {}, typeIndex = 0, counts = {}, activityLayout = {}) {
        const kind = activityKind(node);
        if (kind === 'entry') return { x: RETE_WORLD.startX, y: RETE_WORLD.centerY - 44 };
        if (kind === 'state') return { x: RETE_WORLD.startX + RETE_WORLD.entryToState, y: RETE_WORLD.centerY - 52 };
        if (kind === 'branch') {
            return {
                x: RETE_WORLD.startX + RETE_WORLD.entryToState + 320 + typeIndex * RETE_WORLD.columnGap,
                y: RETE_WORLD.centerY - 190 + typeIndex * 150
            };
        }
        if (kind === 'action') {
            const isFallback = Number(activityLayout.x) > 0 && Number(activityLayout.x) < ACTIVITY_LAYOUT.centerX - 120;
            if (isFallback) {
                return {
                    x: RETE_WORLD.startX + RETE_WORLD.entryToState + 320 + (counts.branch + 1) * RETE_WORLD.columnGap,
                    y: RETE_WORLD.centerY + 310
                };
            }
            return {
                x: RETE_WORLD.startX + RETE_WORLD.entryToState + 640 + typeIndex * RETE_WORLD.columnGap,
                y: RETE_WORLD.centerY - 210 + typeIndex * 150
            };
        }
        return { x: RETE_WORLD.startX + RETE_WORLD.entryToState, y: RETE_WORLD.centerY + Number(typeIndex || 0) * 132 };
    }

    applyActivityLayout(options = {}) {
        const force = Boolean(options.force);
        if (!this.decision?.layout || (!force && this.decision.layout.activityDiagramVersion === ACTIVITY_LAYOUT_VERSION)) return;
        if (!this.decision.layout.nodes) this.decision.layout.nodes = {};
        this.decision.layout.viewport = { ...this.viewport };
        const counts = { entry: 0, state: 0, branch: 0, action: 0 };
        asArray(this.decision?.graph?.nodes).forEach((node) => {
            counts[activityKind(node)] += 1;
        });
        const indexes = { entry: 0, state: 0, branch: 0, action: 0 };
        asArray(this.decision?.graph?.nodes).forEach((node) => {
            const kind = activityKind(node);
            const index = indexes[kind] || 0;
            this.decision.layout.nodes[node.id] = activityPosition(node, index, counts);
            indexes[kind] = index + 1;
        });
        this.decision.layout.activityDiagramVersion = ACTIVITY_LAYOUT_VERSION;
    }

    buildVisualEdges(nodes, edges) {
        const nodeById = new Map(nodes.map(node => [node.id, node]));
        const visualEdges = [...edges];
        nodes.filter(node => node.type === 'action').forEach((node) => {
            const nextStateId = uniqueText(node.nextStateId, this.decision?.graph?.initialStateId || '');
            if (!nextStateId || nodeById.get(nextStateId)?.type !== 'state') return;
            visualEdges.push({
                id: `action_end_${node.id}`,
                from: node.id,
                to: RETE_ACTION_END_NODE_ID,
                kind: 'actionEnd',
                fromPort: 'actionEnd',
                toPort: 'actionEnd',
                nextStateId,
                visualOnly: true
            });
        });
        return visualEdges;
    }

    rebuildAutoBranchFlow() {
        const graph = this.decision?.graph;
        if (!graph) return false;
        const nodes = asArray(graph.nodes);
        const branches = nodes.filter(node => node.type === 'branch');
        const actions = nodes.filter(node => node.type === 'action');
        if (branches.length === 0 || actions.length === 0) return false;
        const initialStateId = uniqueText(graph.initialStateId, 'state_normal');
        const actionIds = new Set(actions.map(action => action.id));
        graph.edges = asArray(graph.edges).filter(edge => {
            if (edge.autoBranchFlow) return false;
            if (edge.from === initialStateId && actionIds.has(edge.to)) return false;
            return true;
        });
        const used = new Set(graph.edges.map(edge => `${edge.from}->${edge.to}:${edge.branch || ''}`));
        const addAutoEdge = (from, to, patch = {}) => {
            if (!from || !to) return;
            const key = `${from}->${to}:${patch.branch || ''}`;
            if (used.has(key)) return;
            used.add(key);
            graph.edges.push({
                id: uniqueEdgeId(graph.edges, from, to),
                from,
                to,
                priority: Number(patch.priority ?? 50),
                autoBranchFlow: true,
                ...patch
            });
        };

        let sourceId = initialStateId;
        branches.forEach((branch, index) => {
            addAutoEdge(sourceId, branch.id, {
                branch: sourceId === initialStateId ? undefined : 'false',
                priority: 100 - index * 10
            });
            const action = actions[Math.min(index, actions.length - 1)];
            if (action) {
                addAutoEdge(branch.id, action.id, { branch: 'true', priority: 100 - index * 10 });
            }
            sourceId = branch.id;
        });

        const finalBranch = branches[branches.length - 1];
        const fallbackAction = actions[Math.min(branches.length, actions.length - 1)] || actions[0];
        if (finalBranch && fallbackAction) {
            addAutoEdge(finalBranch.id, fallbackAction.id, { branch: 'false', priority: 10 });
        }
        return true;
    }

    graphNodeById(nodeId = '') {
        return asArray(this.decision?.graph?.nodes).find(node => node.id === nodeId) || null;
    }

    updateGraphNode(nodeId = '', updater = () => {}) {
        const node = this.graphNodeById(nodeId);
        if (!node) return;
        updater(node);
        this.render();
    }

    createInspectSelect(field, selectedValue, options = [], onChange = () => {}, config = {}) {
        const select = createElement(this.document, 'select', 'decision-inspect-control');
        select.dataset.decisionField = field;
        select.value = String(selectedValue ?? '');
        if (config.disabled) {
            select.disabled = true;
            select.setAttribute?.('disabled', 'disabled');
        }
        options.forEach((option) => {
            const item = asObject(option);
            const value = String(item.value ?? item.id ?? item.resolverId ?? item.type ?? '');
            const element = createElement(this.document, 'option');
            element.value = value;
            element.textContent = String(item.label ?? value);
            if (value === select.value) element.selected = true;
            if (item.disabled) {
                element.disabled = true;
                element.setAttribute?.('disabled', 'disabled');
            }
            select.appendChild(element);
        });
        select.addEventListener('change', () => onChange(select.value));
        return select;
    }

    createInspectInput(field, value, onChange = () => {}, attrs = {}) {
        const input = createElement(this.document, 'input', 'decision-inspect-control');
        input.dataset.decisionField = field;
        input.type = attrs.type || 'text';
        input.value = String(value ?? '');
        ['min', 'max', 'step', 'placeholder'].forEach((key) => {
            if (attrs[key] !== undefined) input.setAttribute?.(key, attrs[key]);
        });
        input.addEventListener('change', () => onChange(input.value));
        input.addEventListener('input', () => onChange(input.value));
        return input;
    }

    subjectOptionLabel(resolverId = '') {
        const option = decisionSubjectOptions().find(item => item.resolverId === resolverId);
        return option?.label || subjectRefLabel({ resolverId });
    }

    buildConditionDefault(type = 'always') {
        const definition = decisionConditionDefinition(type);
        const params = Object.fromEntries(asArray(definition.params).map(param => [param.name, param.defaultValue]));
        const subjectRef = definition.subjectPolicy?.defaultResolverId
            && !['system', 'battle', 'memory'].includes(definition.subjectPolicy.defaultResolverId)
            ? { resolverId: definition.subjectPolicy.defaultResolverId }
            : undefined;
        if (type === 'self_hp_ratio_lte' || type === 'self_hp_ratio_gte') {
            return normalizeCondition({ type, value: Number(params.value ?? 0.5), subjectRef });
        }
        if (type === 'turn_number_modulo') {
            return normalizeCondition({ type, mod: Number(params.mod ?? 2), equals: Number(params.equals ?? 0) });
        }
        if (type === 'previous_action_is') {
            const firstActionId = asArray(this.decision?.graph?.nodes).find(node => node.type === 'action')?.id || '';
            return normalizeCondition({ type, actionId: params.actionId || firstActionId });
        }
        return normalizeCondition({ type: 'always' });
    }

    conditionSubjectOptions(condition = {}) {
        const normalized = normalizeCondition(condition);
        const definition = decisionConditionDefinition(normalized.type);
        const allowed = asArray(definition.subjectPolicy?.allowedResolverIds);
        const fallback = normalized.subjectRef?.resolverId || definition.subjectPolicy?.defaultResolverId || '';
        const ids = allowed.length ? allowed : [fallback].filter(id => !['system', 'battle', 'memory'].includes(id));
        return ids.map(resolverId => ({
            value: resolverId,
            label: this.subjectOptionLabel(resolverId)
        }));
    }

    renderBranchInspectorControls(node = {}) {
        const condition = normalizeCondition(node.condition);
        const definition = decisionConditionDefinition(condition.type);
        this.appendInspectField('读取输入', conditionReadSummary(condition));
        const conditionOptions = decisionConditionOptions()
            .map(item => ({ value: item.type, label: item.label }));
        this.appendInspectControl(
            'Condition（条件）',
            this.createInspectSelect('conditionType', condition.type, conditionOptions, (value) => {
                this.updateGraphNode(node.id, (target) => {
                    target.condition = this.buildConditionDefault(value);
                    target.label = decisionConditionDefinition(value).label;
                });
            })
        );

        const subjectOptions = this.conditionSubjectOptions(condition);
        if (subjectOptions.length > 0) {
            this.appendInspectControl(
                'SubjectRef（判断主语）',
                this.createInspectSelect(
                    'conditionSubject',
                    condition.subjectRef?.resolverId || subjectOptions[0].value,
                    subjectOptions,
                    (value) => {
                        this.updateGraphNode(node.id, (target) => {
                            target.condition = normalizeCondition({
                                ...asObject(target.condition),
                                subjectRef: normalizeSubjectRef({ resolverId: value }, value)
                            });
                        });
                    },
                    { disabled: subjectOptions.length <= 1 }
                )
            );
        }

        asArray(definition.params).forEach((param) => {
            if (param.type === 'number') {
                const field = param.name === 'value' ? 'conditionValue' : `condition_${param.name}`;
                this.appendInspectControl(
                    param.label || param.name,
                    this.createInspectInput(field, condition[param.name] ?? param.defaultValue, (value) => {
                        this.updateGraphNode(node.id, (target) => {
                            target.condition = normalizeCondition({
                                ...asObject(target.condition),
                                [param.name]: Number(value)
                            });
                        });
                    }, {
                        type: 'number',
                        min: param.min,
                        max: param.max,
                        step: param.step
                    })
                );
            }
            if (param.type === 'actionId') {
                const actionOptions = asArray(this.decision?.graph?.nodes)
                    .filter(item => item.type === 'action')
                    .map(item => ({ value: item.id, label: nodeTitle(item) }));
                this.appendInspectControl(
                    param.label || '行动节点',
                    this.createInspectSelect('conditionActionId', condition.actionId || actionOptions[0]?.value || '', actionOptions, (value) => {
                        this.updateGraphNode(node.id, (target) => {
                            target.condition = normalizeCondition({
                                ...asObject(target.condition),
                                actionId: value
                            });
                        });
                    })
                );
            }
        });
    }

    targetQueryFromResolver(resolverId = '', currentQuery = {}) {
        const option = decisionTargetQueryOption(resolverId) || decisionTargetQueryOptions()[0];
        const params = {
            ...asObject(option.params),
            ...asObject(currentQuery?.params)
        };
        if (option.resolverId === 'player.fixedPart') {
            params.partId = uniqueText(params.partId, 'head');
        }
        const legacyTargetRule = option.resolverId === 'player.fixedPart'
            ? `fixed_part:${params.partId}`
            : option.legacyTargetRule;
        return {
            targetRule: legacyTargetRule,
            targetQuery: normalizeTargetQuery({
                resolverId: option.resolverId,
                subjectRef: { resolverId: option.subjectResolverId },
                params,
                expectedSkillTarget: option.expectedSkillTarget,
                legacyTargetRule
            }, legacyTargetRule)
        };
    }

    renderActionInspectorControls(node = {}) {
        const currentTargetQuery = normalizeTargetQuery(node.targetQuery, node.targetRule);
        this.appendInspectField('读取输入', 'actorRef, skillRef, targetQuery, skillLegality');
        const actorOptions = decisionSubjectOptions()
            .filter(option => option.resolverId !== 'memory.previousTarget')
            .map(option => ({ value: option.resolverId, label: option.label }));
        this.appendInspectControl(
            'ActorRef（行动者）',
            this.createInspectSelect('actorRef', node.actorRef?.resolverId || 'actor.self', actorOptions, (value) => {
                this.updateGraphNode(node.id, (target) => {
                    target.actorRef = normalizeSubjectRef({ resolverId: value }, value);
                });
            })
        );

        const skillIds = asArray(this.enemy?.skills).map(skillId => uniqueText(skillId)).filter(Boolean);
        const skillOptions = skillIds.map((skillId) => ({
            value: skillId,
            label: skillDisplayName(this.context.resolveSkill?.(skillId), skillId)
        }));
        this.appendInspectControl(
            'SkillRef（技能）',
            this.createInspectSelect('skillRef', uniqueText(node.skillId || node.skillRef?.skillId), skillOptions, (value) => {
                this.updateGraphNode(node.id, (target) => {
                    target.skillId = value;
                    target.skillRef = { mode: 'skillId', skillId: value };
                    target.label = skillDisplayName(this.context.resolveSkill?.(value), value);
                });
            })
        );

        const targetOptions = decisionTargetQueryOptions()
            .map(option => ({ value: option.resolverId, label: option.label }));
        this.appendInspectControl(
            'TargetQuery（目标解析）',
            this.createInspectSelect('targetQuery', currentTargetQuery.resolverId, targetOptions, (value) => {
                this.updateGraphNode(node.id, (target) => {
                    const next = this.targetQueryFromResolver(value, target.targetQuery);
                    target.targetRule = next.targetRule;
                    target.targetQuery = next.targetQuery;
                });
            })
        );

        if (currentTargetQuery.resolverId === 'player.fixedPart') {
            const partOptions = STANDARD_TARGET_PARTS.map(partId => ({ value: partId, label: bodyPartLabel(partId) }));
            this.appendInspectControl(
                '目标部位',
                this.createInspectSelect('targetPartId', uniqueText(currentTargetQuery.params?.partId, 'head'), partOptions, (value) => {
                    this.updateGraphNode(node.id, (target) => {
                        const next = this.targetQueryFromResolver('player.fixedPart', {
                            ...asObject(target.targetQuery),
                            params: { ...asObject(target.targetQuery?.params), partId: value }
                        });
                        target.targetRule = next.targetRule;
                        target.targetQuery = next.targetQuery;
                    });
                })
            );
        }

        const stateOptions = asArray(this.decision?.graph?.nodes)
            .filter(item => item.type === 'state')
            .map(item => ({ value: item.id, label: `${nodeTitle(item)} · ${item.id}` }));
        this.appendInspectControl(
            '回流状态',
            this.createInspectSelect('nextStateId', uniqueText(node.nextStateId, this.decision?.graph?.initialStateId || 'state_normal'), stateOptions, (value) => {
                this.updateGraphNode(node.id, (target) => {
                    target.nextStateId = value;
                });
            })
        );
    }

    renderInspector() {
        if (!this.inspector) return;
        clearElement(this.inspector);
        const node = asArray(this.decision?.graph?.nodes).find(item => item.id === this.selectedNodeId)
            || this.systemNodeForId(this.selectedNodeId);
        if (!node) {
            const empty = createElement(this.document, 'div', 'decision-inspect-preview');
            empty.textContent = 'Inspect\n尚未选择节点。';
            this.inspector.appendChild(empty);
            refreshFakeText(this.inspector);
            return;
        }

        const title = createElement(this.document, 'h4');
        title.textContent = 'Inspect';
        this.inspector.appendChild(title);
        this.appendInspectField('节点', nodeTitle(node));
        this.appendInspectField('id', node.id);
        this.appendInspectField('类型', node.system ? this.reteNodeTypeLabel(node) : nodeTypeLabel(node.type));
        if (node.system) this.appendInspectField('职责', node.type === 'actionEnd' ? '一次决策流程的结束边界' : '一次决策流程的开始边界');
        if (node.condition) {
            const condition = asObject(node.condition);
            const fallbackSubject = condition.type === 'target_distance_gte' || condition.type === 'target_missing_status'
                ? 'target.current'
                : 'actor.self';
            this.appendInspectField('主语', subjectRefLabel(condition.subjectRef || { resolverId: fallbackSubject }));
            this.appendInspectField('条件', conditionLabel(condition));
            this.renderBranchInspectorControls(node);
        }
        let actionSemantics = null;
        if (node.type === 'action') {
            actionSemantics = this.actionSemantics(node);
            this.appendInspectField('行动者', actionSemantics.actorLabel);
            this.appendInspectField('技能', actionSemantics.skillLabel);
            this.appendInspectField('skillId', actionSemantics.skillId || uniqueText(node.skillId, '未绑定技能'));
            this.appendInspectField('目标解析', actionSemantics.targetLabel);
            this.appendInspectField('技能目标约束', actionSemantics.skillTargetLabel);
            this.appendInspectField('候选部位', actionSemantics.candidatePartsLabel);
            this.appendInspectField('合法性', actionSemantics.legalityLabel);
            this.renderActionInspectorControls(node);
        } else {
            if (node.skillId) this.appendInspectField('skillId', node.skillId);
            if (node.targetRule) this.appendInspectField('目标规则', node.targetRule);
        }
        if (!node.system) this.appendInspectField('回流状态', uniqueText(node.nextStateId, this.decision?.graph?.initialStateId || node.id || 'state_normal'));

        const preview = createElement(this.document, 'div', 'decision-inspect-preview');
        preview.textContent = [
            `预览: ${nodeTitle(node)}`,
            node.type === 'branch' ? `判断 ${conditionLabel(node.condition)} 后从 true / false 出口继续。` : '',
            node.type === 'action' ? `由 ${actionSemantics?.actorLabel || '自身'} 执行 ${actionSemantics?.skillLabel || uniqueText(node.skillId, '未绑定技能')}，目标解析为 ${actionSemantics?.targetLabel || targetQueryLabel(node.targetQuery)}，合法性：${actionSemantics?.legalityLabel || '未检查'}，然后回流到 ${uniqueText(node.nextStateId, this.decision?.graph?.initialStateId || 'state_normal')}。` : '',
            node.type === 'state' ? `作为 ${uniqueText(node.id, 'state_normal')} 的状态入口或回流目标。` : '',
            node.type === 'entry' ? '一次敌人决策从行动开始进入当前状态。' : '',
            node.type === 'actionEnd' ? '所有本回合可执行路径最终收束到行动结束。' : ''
        ].filter(Boolean).join('\n');
        this.inspector.appendChild(preview);
        refreshFakeText(this.inspector);
    }

    systemNodeForId(nodeId) {
        if (nodeId === RETE_ACTION_END_NODE_ID) {
            return {
                id: RETE_ACTION_END_NODE_ID,
                type: 'actionEnd',
                label: '行动结束',
                system: true,
                terminal: true
            };
        }
        return null;
    }

    appendInspectField(label, value) {
        const row = createElement(this.document, 'div', 'decision-inspect-field');
        const key = createElement(this.document, 'span', 'decision-inspect-label');
        key.textContent = label;
        const text = createElement(this.document, 'span', 'decision-inspect-value');
        text.textContent = String(value ?? '');
        row.appendChild(key);
        row.appendChild(text);
        this.inspector.appendChild(row);
    }

    appendInspectControl(label, control) {
        const row = createElement(this.document, 'label', 'decision-inspect-field decision-inspect-field--control');
        const key = createElement(this.document, 'span', 'decision-inspect-label');
        key.textContent = label;
        row.appendChild(key);
        row.appendChild(control);
        this.inspector.appendChild(row);
    }

    renderIssues() {
        if (!this.issueList) return;
        const issues = validateEnemyDecision({
            decision: this.decision,
            enemy: this.enemy || {},
            resolveSkill: skillId => this.context.resolveSkill?.(skillId)
        });
        this.issueList.textContent = issues.length
            ? issues.map(issue => `${severityLabel(issue.severity)}：${issueLabel(issue)}${issue.fieldPath ? `（${issue.fieldPath}）` : ''}`).join('\n')
            : '未发现图问题。';
    }

    renderPreview() {
        if (!this.previewTrace) return;
        const result = previewEnemyDecision({
            decision: this.decision,
            enemy: this.enemy || {},
            resolveSkill: skillId => this.context.resolveSkill?.(skillId),
            turns: 4
        });
        this.previewTrace.textContent = result.traces.map((trace) => {
            const action = trace.selectedSkillId || trace.selectedActionNodeId || '无';
            const fallbacks = trace.fallbacks.map(item => fallbackLabel(item.reason)).join('，');
            const nextState = trace.nextStateId ? ` | 回流到 ${trace.nextStateId}` : '';
            return `第 ${trace.turn} 回合：${trace.visitedNodes.join(' -> ')} => ${action}${nextState}${fallbacks ? ` | 兜底：${fallbacks}` : ''}`;
        }).join('\n');
    }

    addStateNode() {
        const graph = this.decision.graph;
        const id = uniqueNodeId(graph.nodes, 'state');
        graph.nodes.push({ id, type: 'state', label: '新状态' });
        if (this.fullscreen) {
            this.applyActivityLayout({ force: true });
        } else {
            this.decision.layout.nodes[id] = { x: 260, y: 160 + graph.nodes.length * 36 };
        }
        this.selectedNodeId = id;
        this.render();
    }

    addBranchNode() {
        const graph = this.decision.graph;
        const id = uniqueNodeId(graph.nodes, 'branch');
        graph.nodes.push({
            id,
            type: 'branch',
            label: '条件判断',
            condition: {
                type: 'self_hp_ratio_lte',
                value: 0.35,
                subjectRef: { resolverId: 'actor.self' }
            }
        });
        if (this.fullscreen) {
            this.applyActivityLayout({ force: true });
        } else {
            this.decision.layout.nodes[id] = { x: 440, y: 160 + graph.nodes.length * 36 };
        }
        this.rebuildAutoBranchFlow();
        this.selectedNodeId = id;
        this.render();
    }

    addActionNode() {
        const graph = this.decision.graph;
        const id = uniqueNodeId(graph.nodes, 'action');
        const skillId = asArray(this.enemy?.skills)[0] || '';
        graph.nodes.push({
            id,
            type: 'action',
            label: skillId || '行动',
            actorRef: { resolverId: 'actor.self' },
            skillRef: { mode: 'skillId', skillId },
            skillId,
            targetRule: 'player_weak_part',
            targetQuery: {
                resolverId: 'player.weakestArmorPart',
                subjectRef: { resolverId: 'battle.player.main' },
                params: {},
                expectedSkillTarget: { subject: 'SUBJECT_ENEMY', scope: 'SCOPE_PART' },
                legacyTargetRule: 'player_weak_part'
            },
            nextStateId: uniqueText(graph.initialStateId, 'state_normal')
        });
        if (this.fullscreen) {
            this.applyActivityLayout({ force: true });
        } else {
            this.decision.layout.nodes[id] = { x: 640, y: 160 + graph.nodes.length * 36 };
        }
        this.rebuildAutoBranchFlow();
        this.selectedNodeId = id;
        this.render();
    }

    duplicateTemplate() {
        this.decision.templateId = `${this.decision.templateId || 'custom'}_copy`;
        this.decision.templateRevision = Number(this.decision.templateRevision || 0) + 1;
        this.renderTemplates();
    }

    deleteTemplate() {
        this.decision.templateId = '';
        this.decision.templateRevision = 0;
        this.renderTemplates();
    }

    beginNodeDrag(event = {}, nodeId, options = {}) {
        if (event.target?.dataset?.connectFrom) return;
        const layoutChannel = options.layout === 'rete' ? 'rete' : 'activity';
        const layout = layoutChannel === 'rete'
            ? asObject(this.decision?.layout?.reteNodes?.[nodeId])
            : asObject(this.decision?.layout?.nodes?.[nodeId]);
        this.dragState = {
            nodeId,
            layoutChannel,
            layoutScale: layoutChannel === 'rete' ? this.currentReteScale() : 1,
            startX: Number(event.clientX ?? 0),
            startY: Number(event.clientY ?? 0),
            originalX: Number(layout.x ?? 0),
            originalY: Number(layout.y ?? 0)
        };
        this.selectedNodeId = nodeId;
        event.preventDefault?.();
        this.document?.addEventListener?.('mousemove', this.boundNodeDragMove);
        this.document?.addEventListener?.('mouseup', this.boundNodeDragEnd);
    }

    handleNodeDragMove(event = {}) {
        if (!this.dragState) return;
        const dx = Number(event.clientX ?? this.dragState.startX) - this.dragState.startX;
        const dy = Number(event.clientY ?? this.dragState.startY) - this.dragState.startY;
        const graphDelta = this.dragState.layoutChannel === 'rete'
            ? { x: dx / (this.dragState.layoutScale || 1), y: dy / (this.dragState.layoutScale || 1) }
            : inverseViewportDelta(dx, dy, this.viewport);
        this.moveNode(
            this.dragState.nodeId,
            this.dragState.originalX + graphDelta.x,
            this.dragState.originalY + graphDelta.y,
            { layout: this.dragState.layoutChannel }
        );
        event.preventDefault?.();
    }

    endNodeDrag() {
        this.document?.removeEventListener?.('mousemove', this.boundNodeDragMove);
        this.document?.removeEventListener?.('mouseup', this.boundNodeDragEnd);
        this.dragState = null;
    }

    moveNode(nodeId, x, y, options = {}) {
        if (!this.decision?.layout) return false;
        const layoutChannel = options.layout === 'rete' ? 'rete' : 'activity';
        const layoutKey = layoutChannel === 'rete' ? 'reteNodes' : 'nodes';
        if (!this.decision.layout[layoutKey]) this.decision.layout[layoutKey] = {};
        this.decision.layout[layoutKey][nodeId] = {
            x: Math.max(0, Math.round(Number(x) || 0)),
            y: Math.max(0, Math.round(Number(y) || 0))
        };
        this.renderCanvas();
        return true;
    }

    currentReteScale() {
        return this.readReteBaseScale() * (this.getReteViewport().zoom || 1);
    }

    readReteBaseScale() {
        const reader = globalThis.getComputedStyle;
        if (typeof reader !== 'function' || !this.canvas) return 1;
        const value = reader(this.canvas).getPropertyValue('--decision-rete-scale');
        const scale = Number(value);
        return Number.isFinite(scale) && scale > 0 ? scale : 1;
    }

    getReteViewport() {
        return normalizeReteViewport(this.decision?.layout?.reteViewport);
    }

    setReteViewport(nextViewport = {}) {
        if (!this.decision?.layout) return normalizeReteViewport();
        this.decision.layout.reteViewport = normalizeReteViewport({
            ...this.getReteViewport(),
            ...asObject(nextViewport)
        });
        this.renderCanvas();
        return this.getReteViewport();
    }

    zoomReteViewport(factor = 1) {
        const multiplier = Number(factor);
        const viewport = this.getReteViewport();
        return this.setReteViewport({
            zoom: viewport.zoom * (Number.isFinite(multiplier) ? multiplier : 1)
        });
    }

    resetReteViewport() {
        return this.setReteViewport({ x: 0, y: 0, zoom: 1 });
    }

    fitReteViewport() {
        const rect = this.canvas?.getBoundingClientRect?.();
        const visibleWidth = Number(rect?.width ?? this.canvas?.clientWidth ?? 0);
        const visibleHeight = Number(rect?.height ?? this.canvas?.clientHeight ?? 0);
        const baseScale = this.readReteBaseScale();
        const fallbackZoom = this.fullscreen ? 0.56 : 0.72;
        const fittedZoom = visibleWidth > 0 && visibleHeight > 0 && baseScale > 0
            ? Math.min(
                visibleWidth / (RETE_WORLD.width * baseScale),
                visibleHeight / (RETE_WORLD.height * baseScale)
            ) * 0.94
            : fallbackZoom;
        return this.setReteViewport({
            x: 0,
            y: 0,
            zoom: fittedZoom
        });
    }

    beginRetePan(event = {}) {
        if (event.button !== undefined && event.button !== 0) return;
        const target = event.target;
        const targetClass = String(target?.className || '');
        const isNodeTarget = Boolean(target?.dataset?.nodeId || target?.dataset?.socket)
            || targetClass.includes('decision-rete-node')
            || (typeof target?.closest === 'function' && Boolean(target.closest('.decision-rete-node')));
        if (isNodeTarget) return;
        const viewport = this.getReteViewport();
        this.retePanState = {
            startX: Number(event.clientX ?? 0),
            startY: Number(event.clientY ?? 0),
            originalX: viewport.x,
            originalY: viewport.y
        };
        event.preventDefault?.();
        this.document?.addEventListener?.('mousemove', this.boundRetePanMove);
        this.document?.addEventListener?.('mouseup', this.boundRetePanEnd);
    }

    handleRetePanMove(event = {}) {
        if (!this.retePanState) return;
        const dx = Number(event.clientX ?? this.retePanState.startX) - this.retePanState.startX;
        const dy = Number(event.clientY ?? this.retePanState.startY) - this.retePanState.startY;
        this.setReteViewport({
            x: this.retePanState.originalX + dx,
            y: this.retePanState.originalY + dy
        });
        event.preventDefault?.();
    }

    endRetePan() {
        this.document?.removeEventListener?.('mousemove', this.boundRetePanMove);
        this.document?.removeEventListener?.('mouseup', this.boundRetePanEnd);
        this.retePanState = null;
    }

    handleReteWheel(event = {}) {
        const deltaY = Number(event.deltaY ?? 0);
        if (!Number.isFinite(deltaY) || deltaY === 0) return;
        this.zoomReteViewport(deltaY < 0 ? 1.1 : 1 / 1.1);
        event.preventDefault?.();
    }

    eventToRetePoint(event = {}) {
        const rect = this.canvas?.getBoundingClientRect?.() || { left: 0, top: 0 };
        const viewport = this.getReteViewport();
        const scale = this.currentReteScale() || 1;
        return {
            x: (Number(event.clientX ?? 0) - Number(rect.left ?? 0) - viewport.x) / scale,
            y: (Number(event.clientY ?? 0) - Number(rect.top ?? 0) - viewport.y) / scale
        };
    }

    beginConnectionDrag(event = {}, nodeId, options = {}) {
        if (event.button !== undefined && event.button !== 0) return;
        event.stopPropagation?.();
        event.preventDefault?.();
        this.startConnection(nodeId, options);
        this.connectionDragState = {
            from: nodeId,
            branch: uniqueText(options.branch),
            currentPoint: this.eventToRetePoint(event)
        };
        this.document?.addEventListener?.('mousemove', this.boundConnectionDragMove);
        this.document?.addEventListener?.('mouseup', this.boundConnectionDragEnd);
        this.renderCanvas();
    }

    handleConnectionDragMove(event = {}) {
        if (!this.connectionDragState) return;
        this.connectionDragState.currentPoint = this.eventToRetePoint(event);
        event.preventDefault?.();
        this.renderCanvas();
    }

    resolveConnectionTarget(target) {
        if (!target) return '';
        if (target.dataset?.connectTo) return target.dataset.connectTo;
        if (target.dataset?.socket === 'in' && target.dataset?.nodeId) return target.dataset.nodeId;
        if (target.dataset?.nodeId && !target.dataset?.connectFrom) return target.dataset.nodeId;
        if (typeof target.closest === 'function') {
            const socket = target.closest('[data-connect-to]');
            if (socket?.dataset?.connectTo) return socket.dataset.connectTo;
            const node = target.closest('[data-node-id]');
            if (node?.dataset?.nodeId && !node?.dataset?.connectFrom) return node.dataset.nodeId;
        }
        return '';
    }

    endConnectionDrag(event = {}) {
        const targetId = this.resolveConnectionTarget(event.target);
        const from = this.connectionDragState?.from || this.pendingConnectionFrom;
        const options = {
            ...(this.pendingConnection || {}),
            branch: this.connectionDragState?.branch || this.pendingConnection?.branch || ''
        };
        this.document?.removeEventListener?.('mousemove', this.boundConnectionDragMove);
        this.document?.removeEventListener?.('mouseup', this.boundConnectionDragEnd);
        this.connectionDragState = null;
        if (targetId && from && targetId !== from) {
            this.connectNodes(from, targetId, options);
            event.preventDefault?.();
            return;
        }
        this.pendingConnectionFrom = '';
        this.pendingConnection = null;
        this.renderCanvas();
        event.preventDefault?.();
    }

    startConnection(nodeId, options = {}) {
        this.pendingConnectionFrom = nodeId;
        this.pendingConnection = {
            from: nodeId,
            branch: uniqueText(options.branch)
        };
        this.selectedNodeId = nodeId;
        this.renderCanvas();
        this.renderInspector();
    }

    connectNodes(from, to, options = {}) {
        if (!from || !to || from === to) return false;
        const graph = this.decision?.graph;
        if (!graph) return false;
        if (!Array.isArray(graph.edges)) graph.edges = [];
        const source = asArray(graph.nodes).find(node => node.id === from);
        const requestedBranch = uniqueText(options.branch);
        const branch = source?.type === 'branch'
            ? uniqueText(requestedBranch, '')
            : '';
        if (graph.edges.some(edge => edge.from === from && edge.to === to && (!branch || edge.branch === branch))) {
            this.pendingConnectionFrom = '';
            this.pendingConnection = null;
            this.renderCanvas();
            return false;
        }
        if (source?.type === 'branch' && branch) {
            graph.edges = graph.edges.filter(edge => !(edge.from === from && edge.branch === branch));
        }
        const edge = {
            id: uniqueEdgeId(graph.edges, from, to),
            from,
            to,
            priority: 100
        };
        if (source?.type === 'branch') {
            const existingBranches = new Set(graph.edges.filter(item => item.from === from).map(item => item.branch));
            edge.branch = branch || (existingBranches.has('true') && !existingBranches.has('false') ? 'false' : 'true');
        }
        graph.edges.push(edge);
        this.pendingConnectionFrom = '';
        this.pendingConnection = null;
        this.selectedNodeId = to;
        this.render();
        return true;
    }

    removeEdge(edgeId) {
        const graph = this.decision?.graph;
        if (!graph || !Array.isArray(graph.edges)) return false;
        const before = graph.edges.length;
        graph.edges = graph.edges.filter(edge => edge.id !== edgeId);
        if (graph.edges.length === before) return false;
        this.render();
        return true;
    }
}

export default EnemyDecisionGraphEditor;
