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

function conditionLabel(condition = {}) {
    const source = asObject(condition);
    if (!source.type || source.type === 'always') return 'always';
    if (source.type === 'self_hp_ratio_lte') return `self HP <= ${source.value}`;
    if (source.type === 'self_hp_ratio_gte') return `self HP >= ${source.value}`;
    if (source.type === 'turn_number_modulo') return `turn % ${source.mod} = ${source.equals}`;
    if (source.type === 'previous_action_is') return `previous action is ${source.actionId || '-'}`;
    return source.type;
}

function nodeTitle(node) {
    if (node.type === 'entry') return 'Entry';
    if (node.type === 'state') return node.label || 'Normal';
    if (node.type === 'branch') return node.label || 'Condition';
    if (node.type === 'action') return node.label || node.skillId || 'Action';
    return node.id || 'Node';
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
        this.boundFullscreenKeydown = event => this.handleFullscreenKeydown(event);
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
            button.textContent = `${template.name || template.id} r${template.revision || 1}`;
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
            this.skillList.textContent = 'No enemy skills bound.';
            return;
        }
        refreshFakeText(this.skillList);
    }

    renderCanvas() {
        if (!this.canvas) return;
        clearElement(this.canvas);
        const nodes = asArray(this.decision?.graph?.nodes);
        nodes.forEach((node) => {
            const card = createElement(this.document, 'button', `decision-node-card decision-node-card--${node.type}`);
            const layout = asObject(this.decision?.layout?.nodes?.[node.id]);
            card.type = 'button';
            card.dataset.nodeId = node.id;
            card.style.left = `${Number(layout.x ?? 0)}px`;
            card.style.top = `${Number(layout.y ?? 0)}px`;
            card.textContent = [
                nodeTitle(node),
                node.type,
                node.skillId || '',
                node.type === 'branch' ? conditionLabel(node.condition) : ''
            ].filter(Boolean).join('\n');
            if (node.id === this.selectedNodeId) card.className = `${card.className} is-selected`;
            card.addEventListener('click', () => {
                this.selectedNodeId = node.id;
                this.renderCanvas();
                this.renderInspector();
            });
            this.canvas.appendChild(card);
        });
        refreshFakeText(this.canvas);
    }

    renderInspector() {
        if (!this.inspector) return;
        clearElement(this.inspector);
        const node = asArray(this.decision?.graph?.nodes).find(item => item.id === this.selectedNodeId);
        if (!node) {
            this.inspector.textContent = 'No node selected.';
            return;
        }
        const title = createElement(this.document, 'h4');
        title.textContent = nodeTitle(node);
        const body = createElement(this.document, 'div', 'decision-inspector-body');
        body.textContent = [
            `id: ${node.id}`,
            `type: ${node.type}`,
            node.skillId ? `skillId: ${node.skillId}` : '',
            node.targetRule ? `targetRule: ${node.targetRule}` : '',
            node.condition ? `condition: ${conditionLabel(node.condition)}` : ''
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
            ? issues.map(issue => `${issue.severity}: ${issue.code} ${issue.fieldPath || ''}`).join('\n')
            : 'No graph issues.';
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
            const action = trace.selectedSkillId || trace.selectedActionNodeId || 'none';
            const fallbacks = trace.fallbacks.map(item => item.reason).join(', ');
            return `Turn ${trace.turn}: ${trace.visitedNodes.join(' -> ')} => ${action}${fallbacks ? ` | ${fallbacks}` : ''}`;
        }).join('\n');
    }

    addStateNode() {
        const graph = this.decision.graph;
        const id = uniqueNodeId(graph.nodes, 'state');
        graph.nodes.push({ id, type: 'state', label: 'New State' });
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
            label: 'Condition',
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
            label: skillId || 'Action',
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
}

export default EnemyDecisionGraphEditor;
