import {
    cloneDecision,
    createDefaultDecisionTemplate,
    normalizeEnemyDecision,
    previewEnemyDecision,
    validateEnemyDecision
} from './EnemyDecisionGraphModel.js';

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function createElement(doc, tagName, className = '') {
    const element = doc.createElement(tagName);
    if (className) element.className = className;
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
    if (source.type === 'self_hp_ratio_lte') return `自身 HP <= ${source.value}`;
    if (source.type === 'self_hp_ratio_gte') return `自身 HP >= ${source.value}`;
    if (source.type === 'turn_number_modulo') return `回合 % ${source.mod} = ${source.equals}`;
    if (source.type === 'previous_action_is') return `上一行动是 ${source.actionId || '-'}`;
    return source.type;
}

function nodeTitle(node) {
    if (node.type === 'entry') return '入口';
    if (node.type === 'state') return translateLabel(node.label, '默认状态');
    if (node.type === 'branch') return translateLabel(node.label, '条件判断');
    if (node.type === 'action') return translateLabel(node.label || node.skillId, '行动');
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
        this.enemy = null;
        this.context = {};
        this.decision = null;
        this.selectedNodeId = '';
        this.fullscreen = false;
        this.pendingConnectionFrom = '';
        this.dragState = null;
        this.boundFullscreenKeydown = event => this.handleFullscreenKeydown(event);
        this.boundNodeDragMove = event => this.handleNodeDragMove(event);
        this.boundNodeDragEnd = () => this.endNodeDrag();
        this.bindActions();
        this.syncFullscreenState();
    }

    bindActions() {
        const bindings = [
            ['addState', () => this.addStateNode()],
            ['addBranch', () => this.addBranchNode()],
            ['addAction', () => this.addActionNode()],
            ['duplicateTemplate', () => this.duplicateTemplate()],
            ['deleteTemplate', () => this.deleteTemplate()],
            ['validate', () => this.renderIssues()],
            ['preview', () => this.renderPreview()]
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
        } else {
            this.document?.removeEventListener?.('keydown', this.boundFullscreenKeydown);
        }
        this.syncFullscreenState();
        return this.fullscreen;
    }

    isFullscreen() {
        return this.fullscreen;
    }

    syncFullscreenState() {
        this.root?.classList?.toggle?.('is-decision-fullscreen', this.fullscreen);
        this.document?.body?.classList?.toggle?.('enemy-decision-fullscreen-active', this.fullscreen);
        if (!this.fullscreenToggle) return;
        this.fullscreenToggle.textContent = this.fullscreen ? '退出全屏' : '全屏编辑';
        this.fullscreenToggle.setAttribute?.('aria-pressed', this.fullscreen ? 'true' : 'false');
        this.fullscreenToggle.title = this.fullscreen ? '退出敌人决策全屏编辑' : '进入敌人决策全屏编辑';
    }

    setEnemy(enemy = {}, context = {}) {
        this.enemy = enemy;
        this.context = {
            templates: {},
            resolveSkill: skillId => context.workspace?.resolveSkill?.(skillId) || context.resolveSkill?.(skillId) || null,
            ...context
        };
        this.decision = normalizeEnemyDecision({ enemy, templates: this.context.templates });
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
            const chip = createElement(this.document, 'span', 'decision-skill-chip');
            chip.textContent = skillId;
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
        const nodes = asArray(this.decision?.graph?.nodes);
        const edges = asArray(this.decision?.graph?.edges);
        this.renderEdges(nodes, edges);
        nodes.forEach((node) => {
            const card = createElement(this.document, 'div', `decision-node-card decision-node-card--${node.type}`);
            const layout = asObject(this.decision?.layout?.nodes?.[node.id]);
            const title = createElement(this.document, 'div', 'decision-node-title');
            const meta = createElement(this.document, 'div', 'decision-node-meta');
            const details = createElement(this.document, 'div', 'decision-node-detail');
            const handle = createElement(this.document, 'button', 'decision-connect-handle');
            card.dataset.nodeId = node.id;
            card.setAttribute?.('role', 'button');
            card.tabIndex = 0;
            card.style.left = `${Number(layout.x ?? 0)}px`;
            card.style.top = `${Number(layout.y ?? 0)}px`;
            title.textContent = nodeTitle(node);
            meta.textContent = nodeTypeLabel(node.type);
            details.textContent = [
                node.skillId || '',
                node.type === 'branch' ? conditionLabel(node.condition) : ''
            ].filter(Boolean).join('\n');
            handle.type = 'button';
            handle.textContent = this.pendingConnectionFrom === node.id ? '选择目标' : '连出';
            handle.dataset.connectFrom = node.id;
            handle.title = '从这个节点开始连线，再点击目标节点';
            if (node.id === this.selectedNodeId) card.className = `${card.className} is-selected`;
            if (node.id === this.pendingConnectionFrom) card.className = `${card.className} is-connecting`;
            handle.addEventListener('click', (event) => {
                event.stopPropagation?.();
                this.startConnection(node.id);
            });
            card.addEventListener('mousedown', (event) => this.beginNodeDrag(event, node.id));
            card.addEventListener('click', () => {
                if (this.pendingConnectionFrom && this.pendingConnectionFrom !== node.id) {
                    this.connectNodes(this.pendingConnectionFrom, node.id);
                    return;
                }
                this.selectedNodeId = node.id;
                this.renderCanvas();
                this.renderInspector();
            });
            card.appendChild(title);
            card.appendChild(meta);
            if (details.textContent) card.appendChild(details);
            card.appendChild(handle);
            this.canvas.appendChild(card);
        });
        refreshFakeText(this.canvas);
    }

    renderEdges(nodes, edges) {
        const nodeById = new Map(nodes.map(node => [node.id, node]));
        edges.forEach((edge) => {
            if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) return;
            const fromLayout = asObject(this.decision?.layout?.nodes?.[edge.from]);
            const toLayout = asObject(this.decision?.layout?.nodes?.[edge.to]);
            const fromX = Number(fromLayout.x ?? 0) + 178;
            const fromY = Number(fromLayout.y ?? 0) + 36;
            const toX = Number(toLayout.x ?? 0);
            const toY = Number(toLayout.y ?? 0) + 36;
            const dx = toX - fromX;
            const dy = toY - fromY;
            const length = Math.max(24, Math.sqrt(dx * dx + dy * dy));
            const line = createElement(this.document, 'button', 'decision-edge');
            line.type = 'button';
            line.dataset.edgeId = edge.id || '';
            line.dataset.edgeFrom = edge.from || '';
            line.dataset.edgeTo = edge.to || '';
            line.style.left = `${fromX}px`;
            line.style.top = `${fromY}px`;
            line.style.width = `${length}px`;
            line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
            line.title = `连线：${edge.from} -> ${edge.to}。点击删除。`;
            line.textContent = `${edge.from} -> ${edge.to}`;
            line.addEventListener('click', (event) => {
                event.stopPropagation?.();
                this.removeEdge(edge.id);
            });
            this.canvas.appendChild(line);
        });
    }

    renderInspector() {
        if (!this.inspector) return;
        clearElement(this.inspector);
        const node = asArray(this.decision?.graph?.nodes).find(item => item.id === this.selectedNodeId);
        if (!node) {
            this.inspector.textContent = '尚未选择节点。';
            return;
        }
        const title = createElement(this.document, 'h4');
        title.textContent = nodeTitle(node);
        const body = createElement(this.document, 'div', 'decision-inspector-body');
        body.textContent = [
            `id: ${node.id}`,
            `类型: ${nodeTypeLabel(node.type)}`,
            node.skillId ? `skillId: ${node.skillId}` : '',
            node.targetRule ? `目标规则: ${node.targetRule}` : '',
            node.condition ? `条件: ${conditionLabel(node.condition)}` : ''
        ].filter(Boolean).join('\n');
        this.inspector.appendChild(title);
        this.inspector.appendChild(body);
        refreshFakeText(this.inspector);
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
            return `第 ${trace.turn} 回合：${trace.visitedNodes.join(' -> ')} => ${action}${fallbacks ? ` | 兜底：${fallbacks}` : ''}`;
        }).join('\n');
    }

    addStateNode() {
        const graph = this.decision.graph;
        const id = uniqueNodeId(graph.nodes, 'state');
        graph.nodes.push({ id, type: 'state', label: '新状态' });
        this.decision.layout.nodes[id] = { x: 260, y: 160 + graph.nodes.length * 36 };
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
            condition: { type: 'self_hp_ratio_lte', value: 0.35 }
        });
        this.decision.layout.nodes[id] = { x: 440, y: 160 + graph.nodes.length * 36 };
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
            skillId,
            targetRule: 'player_weak_part'
        });
        this.decision.layout.nodes[id] = { x: 640, y: 160 + graph.nodes.length * 36 };
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

    beginNodeDrag(event = {}, nodeId) {
        if (event.target?.dataset?.connectFrom) return;
        const layout = asObject(this.decision?.layout?.nodes?.[nodeId]);
        this.dragState = {
            nodeId,
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
        this.moveNode(this.dragState.nodeId, this.dragState.originalX + dx, this.dragState.originalY + dy);
        event.preventDefault?.();
    }

    endNodeDrag() {
        this.document?.removeEventListener?.('mousemove', this.boundNodeDragMove);
        this.document?.removeEventListener?.('mouseup', this.boundNodeDragEnd);
        this.dragState = null;
    }

    moveNode(nodeId, x, y) {
        if (!this.decision?.layout) return false;
        if (!this.decision.layout.nodes) this.decision.layout.nodes = {};
        this.decision.layout.nodes[nodeId] = {
            x: Math.max(0, Math.round(Number(x) || 0)),
            y: Math.max(0, Math.round(Number(y) || 0))
        };
        this.renderCanvas();
        return true;
    }

    startConnection(nodeId) {
        this.pendingConnectionFrom = nodeId;
        this.selectedNodeId = nodeId;
        this.renderCanvas();
        this.renderInspector();
    }

    connectNodes(from, to) {
        if (!from || !to || from === to) return false;
        const graph = this.decision?.graph;
        if (!graph) return false;
        if (!Array.isArray(graph.edges)) graph.edges = [];
        if (graph.edges.some(edge => edge.from === from && edge.to === to)) {
            this.pendingConnectionFrom = '';
            this.renderCanvas();
            return false;
        }
        const source = asArray(graph.nodes).find(node => node.id === from);
        const edge = {
            id: uniqueEdgeId(graph.edges, from, to),
            from,
            to,
            priority: 100
        };
        if (source?.type === 'branch') {
            const existingBranches = new Set(graph.edges.filter(item => item.from === from).map(item => item.branch));
            edge.branch = existingBranches.has('true') && !existingBranches.has('false') ? 'false' : 'true';
        }
        graph.edges.push(edge);
        this.pendingConnectionFrom = '';
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
