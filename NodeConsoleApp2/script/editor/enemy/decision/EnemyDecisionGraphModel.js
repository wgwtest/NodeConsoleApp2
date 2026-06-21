const SCHEMA_VERSION = 'enemy_decision_graph_v1';
const MAX_TURN_STEPS = 32;

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

export function cloneDecision(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function uniqueText(value, fallback = '') {
    const next = String(value ?? '').trim();
    return next || fallback;
}

function normalizeNumber(value, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

function normalizeCondition(condition = {}) {
    const source = asObject(condition);
    if (Object.keys(source).length === 0 || source.type === 'always') {
        return { type: 'always' };
    }
    if (source.type === 'self_hp_ratio_lte') {
        return { type: 'self_hp_ratio_lte', value: normalizeNumber(source.value, 1) };
    }
    if (source.type === 'self_hp_ratio_gte') {
        return { type: 'self_hp_ratio_gte', value: normalizeNumber(source.value, 0) };
    }
    if (source.type === 'turn_number_modulo') {
        return {
            type: 'turn_number_modulo',
            mod: normalizeNumber(source.mod, 1),
            equals: normalizeNumber(source.equals, 0)
        };
    }
    if (source.type === 'previous_action_is') {
        return { type: 'previous_action_is', actionId: uniqueText(source.actionId) };
    }
    if (source.type === 'target_distance_gte') {
        return { type: 'target_distance_gte', value: normalizeNumber(source.value, 0) };
    }
    if (source.type === 'target_missing_status') {
        return { type: 'target_missing_status', status: uniqueText(source.status, 'bleed') };
    }
    return { type: 'always' };
}

function isAlwaysCondition(condition = {}) {
    return normalizeCondition(condition).type === 'always';
}

function safeNodeId(prefix, value, index) {
    const body = uniqueText(value, `${prefix}_${index}`)
        .toLowerCase()
        .replace(/[^a-z0-9_:-]+/gu, '_')
        .replace(/:+/gu, '_')
        .replace(/^_+|_+$/gu, '');
    return `${prefix}_${body || index}`;
}

function findSkillId(skillIds, patterns = [], fallbackIndex = 0) {
    const matched = skillIds.find(skillId => patterns.some(pattern => pattern.test(skillId)));
    return matched || skillIds[Math.min(fallbackIndex, Math.max(0, skillIds.length - 1))] || '';
}

function buildActivityDecision(enemy = {}, skillIds = []) {
    const throwSkillId = findSkillId(skillIds, [/throw/iu, /stone/iu, /投石/u], 0);
    const bleedSkillId = findSkillId(skillIds, [/bleed/iu, /rusty/iu, /shiv/iu, /锈/u], 1);
    if (!throwSkillId || !bleedSkillId || throwSkillId === bleedSkillId) return null;

    const nodes = [
        { id: 'entry', type: 'entry', label: 'Start' },
        {
            id: 'state_normal',
            type: 'state',
            label: '默认状态',
            description: 'Activity-diagram default state.',
            fallbackNodeId: 'action_fallback_throw'
        },
        {
            id: 'branch_low_hp',
            type: 'branch',
            label: 'HP <= 35%?',
            condition: { type: 'self_hp_ratio_lte', value: 0.35 }
        },
        {
            id: 'branch_far_target',
            type: 'branch',
            label: '距离 >= 2?',
            condition: { type: 'target_distance_gte', value: 2 }
        },
        {
            id: 'branch_target_missing_bleed',
            type: 'branch',
            label: '目标未流血?',
            condition: { type: 'target_missing_status', status: 'bleed' }
        },
        {
            id: 'action_conservative_throw',
            type: 'action',
            label: '保守投石',
            skillId: throwSkillId,
            targetRule: 'player_weak_part',
            nextStateId: 'state_normal',
            telegraph: false
        },
        {
            id: 'action_far_throw',
            type: 'action',
            label: '远距投石',
            skillId: throwSkillId,
            targetRule: 'player_weak_part',
            nextStateId: 'state_normal',
            telegraph: false
        },
        {
            id: 'action_rusty_shiv',
            type: 'action',
            label: '锈刀划拉',
            skillId: bleedSkillId,
            targetRule: 'player_weak_part',
            nextStateId: 'state_normal',
            telegraph: false
        },
        {
            id: 'action_fallback_throw',
            type: 'action',
            label: '后备投石',
            skillId: throwSkillId,
            targetRule: 'player_weak_part',
            nextStateId: 'state_normal',
            telegraph: false
        }
    ];
    const edges = [
        { id: 'edge_entry_state_normal', from: 'entry', to: 'state_normal', priority: 100 },
        { id: 'edge_state_normal_branch_low_hp', from: 'state_normal', to: 'branch_low_hp', priority: 100 },
        { id: 'edge_branch_low_hp_conservative_throw', from: 'branch_low_hp', to: 'action_conservative_throw', branch: 'true', priority: 100 },
        { id: 'edge_branch_low_hp_far_target', from: 'branch_low_hp', to: 'branch_far_target', branch: 'false', priority: 90 },
        { id: 'edge_branch_far_target_far_throw', from: 'branch_far_target', to: 'action_far_throw', branch: 'true', priority: 100 },
        { id: 'edge_branch_far_target_missing_bleed', from: 'branch_far_target', to: 'branch_target_missing_bleed', branch: 'false', priority: 90 },
        { id: 'edge_branch_missing_bleed_rusty_shiv', from: 'branch_target_missing_bleed', to: 'action_rusty_shiv', branch: 'true', priority: 100 },
        { id: 'edge_branch_missing_bleed_fallback_throw', from: 'branch_target_missing_bleed', to: 'action_fallback_throw', branch: 'false', priority: 90 }
    ];
    const layoutNodes = {
        entry: { x: 482, y: 24 },
        state_normal: { x: 410, y: 132 },
        branch_low_hp: { x: 436, y: 278 },
        branch_far_target: { x: 436, y: 404 },
        branch_target_missing_bleed: { x: 436, y: 530 },
        action_conservative_throw: { x: 760, y: 250 },
        action_far_throw: { x: 760, y: 378 },
        action_rusty_shiv: { x: 760, y: 506 },
        action_fallback_throw: { x: 196, y: 506 }
    };

    return {
        schemaVersion: SCHEMA_VERSION,
        templateId: '',
        templateRevision: 0,
        slotBindings: {},
        graph: {
            entryNodeId: 'entry',
            initialStateId: 'state_normal',
            nodes,
            edges
        },
        layout: {
            activityDiagramVersion: 3,
            viewport: { x: 0, y: 0, zoom: 1, rotation: 0 },
            nodes: layoutNodes
        }
    };
}

function buildSkillDrivenDecision(enemy = {}) {
    const nodes = [
        { id: 'entry', type: 'entry', label: 'Start' },
        {
            id: 'state_normal',
            type: 'state',
            label: 'Normal',
            description: 'Migrated default decision state.'
        }
    ];
    const edges = [
        { id: 'edge_entry_state_normal', from: 'entry', to: 'state_normal', priority: 100 }
    ];
    const layoutNodes = {
        entry: { x: 40, y: 80 },
        state_normal: { x: 260, y: 80 }
    };
    const skillIds = asArray(enemy.skills).map(skillId => uniqueText(skillId)).filter(Boolean);
    const activityDecision = buildActivityDecision(enemy, skillIds);
    if (activityDecision) return activityDecision;

    skillIds.forEach((skillId, index) => {
        const actionId = safeNodeId('action', skillId, index + 1);
        nodes.push({
            id: actionId,
            type: 'action',
            label: skillId,
            skillId,
            targetRule: 'player_weak_part',
            nextStateId: 'state_normal',
            telegraph: false
        });
        layoutNodes[actionId] = { x: 620, y: 48 + index * 132 };

        if (index === 0) nodes[1].fallbackNodeId = actionId;

        edges.push({
            id: `edge_state_normal_${actionId}`,
            from: 'state_normal',
            to: actionId,
            priority: 100 - index * 10
        });
    });

    return {
        schemaVersion: SCHEMA_VERSION,
        templateId: '',
        templateRevision: 0,
        slotBindings: {},
        graph: {
            entryNodeId: 'entry',
            initialStateId: 'state_normal',
            nodes,
            edges
        },
        layout: {
            viewport: { x: 0, y: 0, zoom: 1, rotation: 0 },
            nodes: layoutNodes
        }
    };
}

export function createDefaultDecisionTemplate() {
    const graph = {
        entryNodeId: 'entry',
        initialStateId: 'state_normal',
        nodes: [
            { id: 'entry', type: 'entry', label: 'Start' },
            {
                id: 'state_normal',
                type: 'state',
                label: 'Normal',
                description: 'Template default decision state.',
                fallbackNodeId: 'action_basic_attack'
            },
            {
                id: 'action_basic_attack',
                type: 'action',
                label: 'Basic Attack',
                skillSlotId: 'slot_basic_attack',
                targetRule: 'player_weak_part',
                nextStateId: 'state_normal',
                telegraph: false
            }
        ],
        edges: [
            { id: 'edge_entry_state_normal', from: 'entry', to: 'state_normal', priority: 100 },
            { id: 'edge_state_normal_action_basic_attack', from: 'state_normal', to: 'action_basic_attack', priority: 100 }
        ]
    };

    return {
        id: 'tpl_basic_aggressor',
        name: 'Basic Aggressor',
        schemaVersion: SCHEMA_VERSION,
        revision: 1,
        slots: [
            {
                id: 'slot_basic_attack',
                label: 'Basic Attack',
                required: true,
                expectedTags: ['attack']
            }
        ],
        graph
    };
}

function normalizeExistingDecision(decision) {
    const source = asObject(decision);
    const graph = asObject(source.graph);
    const initialStateId = uniqueText(graph.initialStateId, 'state_normal');
    const nodes = asArray(graph.nodes).map((node) => {
        const next = { ...asObject(node) };
        if (next.type === 'action' && !uniqueText(next.nextStateId)) {
            next.nextStateId = initialStateId;
        }
        return next;
    });
    return {
        schemaVersion: source.schemaVersion || SCHEMA_VERSION,
        templateId: uniqueText(source.templateId),
        templateRevision: normalizeNumber(source.templateRevision, 0),
        slotBindings: { ...asObject(source.slotBindings) },
        graph: {
            entryNodeId: uniqueText(graph.entryNodeId, 'entry'),
            initialStateId,
            nodes,
            edges: asArray(graph.edges).map(edge => ({ ...asObject(edge) }))
        },
        layout: {
            activityDiagramVersion: normalizeNumber(source.layout?.activityDiagramVersion, 0),
            viewport: { x: 0, y: 0, zoom: 1, rotation: 0, ...asObject(source.layout?.viewport) },
            nodes: { ...asObject(source.layout?.nodes) }
        }
    };
}

export function normalizeEnemyDecision({ enemy = {} } = {}) {
    if (enemy?.enemyDecision && typeof enemy.enemyDecision === 'object') {
        const existing = normalizeExistingDecision(enemy.enemyDecision);
        if (existing.graph.nodes.length > 0) {
            if (existing.layout.activityDiagramVersion === 3) return existing;
            const skillIds = asArray(enemy.skills).map(skillId => uniqueText(skillId)).filter(Boolean);
            const upgraded = buildActivityDecision(enemy, skillIds);
            if (upgraded) return upgraded;
            return existing;
        }
    }
    return buildSkillDrivenDecision(enemy);
}

function buildGraphIndex(decision) {
    const graph = asObject(decision?.graph);
    const nodes = asArray(graph.nodes);
    const edges = asArray(graph.edges);
    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const edgesByFrom = new Map();
    edges.forEach(edge => {
        if (!edgesByFrom.has(edge.from)) edgesByFrom.set(edge.from, []);
        edgesByFrom.get(edge.from).push(edge);
    });
    edgesByFrom.forEach(list => {
        list.sort((left, right) => normalizeNumber(right.priority, 0) - normalizeNumber(left.priority, 0));
    });
    return { graph, nodes, edges, nodeById, edgesByFrom };
}

function resolveActionSkill(action, decision) {
    if (action.skillId) return uniqueText(action.skillId);
    if (action.skillSlotId) return uniqueText(decision?.slotBindings?.[action.skillSlotId]);
    return '';
}

function skillConfigFromResolved(resolved) {
    if (!resolved) return null;
    if (resolved.skill) return resolved.skill;
    return resolved;
}

export function validateEnemyDecision({ decision, enemy = {}, resolveSkill = () => null } = {}) {
    const source = normalizeExistingDecision(decision || {});
    const { graph, nodes, edges, nodeById, edgesByFrom } = buildGraphIndex(source);
    const issues = [];
    const seen = new Set();
    const enemySkills = new Set(asArray(enemy.skills));

    nodes.forEach((node, index) => {
        if (!node.id) {
            issues.push({ severity: 'error', code: 'missing_node_id', fieldPath: `graph.nodes[${index}].id` });
            return;
        }
        if (seen.has(node.id)) {
            issues.push({ severity: 'error', code: 'duplicate_node_id', fieldPath: `graph.nodes.${node.id}` });
        }
        seen.add(node.id);
    });

    const entryNodes = nodes.filter(node => node.type === 'entry');
    if (entryNodes.length === 0) issues.push({ severity: 'error', code: 'missing_entry_node', fieldPath: 'graph.nodes' });
    if (entryNodes.length > 1) issues.push({ severity: 'error', code: 'multiple_entry_nodes', fieldPath: 'graph.nodes' });
    if (!nodeById.has(graph.initialStateId)) {
        issues.push({ severity: 'error', code: 'missing_initial_state', fieldPath: 'graph.initialStateId' });
    }

    edges.forEach((edge, index) => {
        if (!nodeById.has(edge.from)) {
            issues.push({ severity: 'error', code: 'edge_missing_from_node', fieldPath: `graph.edges[${index}].from` });
        }
        if (!nodeById.has(edge.to)) {
            issues.push({ severity: 'error', code: 'edge_missing_to_node', fieldPath: `graph.edges[${index}].to` });
        }
    });

    nodes.forEach(node => {
        const outgoing = edgesByFrom.get(node.id) || [];
        if (node.type === 'entry' && !outgoing.some(edge => nodeById.get(edge.to)?.type === 'state')) {
            issues.push({ severity: 'error', code: 'entry_must_connect_state', fieldPath: `graph.nodes.${node.id}` });
        }
        if (node.type === 'state' && outgoing.length === 0 && !node.fallbackNodeId) {
            issues.push({ severity: 'error', code: 'state_missing_exit', fieldPath: `graph.nodes.${node.id}` });
        }
        if (node.type === 'branch') {
            if (!outgoing.some(edge => edge.branch === 'true')) {
                issues.push({ severity: 'error', code: 'branch_missing_true_exit', fieldPath: `graph.nodes.${node.id}` });
            }
            if (!outgoing.some(edge => edge.branch === 'false')) {
                issues.push({ severity: 'error', code: 'branch_missing_false_exit', fieldPath: `graph.nodes.${node.id}` });
            }
        }
        if (node.type === 'action') {
            const skillId = resolveActionSkill(node, source);
            const resolved = skillId ? resolveSkill(skillId) : null;
            if (!skillId || !enemySkills.has(skillId) || !resolved) {
                issues.push({ severity: 'error', code: 'missing_skill_binding', fieldPath: `graph.nodes.${node.id}.skillId`, refId: skillId });
            }
            const nextState = uniqueText(node.nextStateId);
            if (!nextState) {
                issues.push({ severity: 'error', code: 'action_missing_next_state', fieldPath: `graph.nodes.${node.id}.nextStateId` });
            } else if (nodeById.get(nextState)?.type !== 'state') {
                issues.push({ severity: 'error', code: 'action_next_state_must_be_state', fieldPath: `graph.nodes.${node.id}.nextStateId`, refId: nextState });
            }
        }
    });

    if (hasSingleTurnLoopRisk(source)) {
        issues.push({ severity: 'error', code: 'single_turn_loop_detected', fieldPath: 'graph.edges' });
    }

    return issues;
}

function hasSingleTurnLoopRisk(decision) {
    const { nodeById, edgesByFrom } = buildGraphIndex(decision);
    const visiting = new Set();
    const visited = new Set();

    function visit(nodeId) {
        const node = nodeById.get(nodeId);
        if (!node || node.type === 'action') return false;
        if (visiting.has(nodeId)) return true;
        if (visited.has(nodeId)) return false;
        visiting.add(nodeId);
        const outgoing = edgesByFrom.get(nodeId) || [];
        for (const edge of outgoing) {
            if (visit(edge.to)) return true;
        }
        visiting.delete(nodeId);
        visited.add(nodeId);
        return false;
    }

    return visit(decision?.graph?.initialStateId);
}

function evaluateCondition(condition, context) {
    const source = normalizeCondition(condition);
    if (source.type === 'always') return true;
    const enemy = asObject(context.enemy);
    const stats = asObject(enemy.stats);
    const hp = normalizeNumber(enemy.hp ?? stats.hp, 0);
    const maxHp = normalizeNumber(enemy.maxHp ?? stats.maxHp, hp || 1);
    const hpRatio = maxHp > 0 ? hp / maxHp : 1;
    if (source.type === 'self_hp_ratio_lte') return hpRatio <= normalizeNumber(source.value, 1);
    if (source.type === 'self_hp_ratio_gte') return hpRatio >= normalizeNumber(source.value, 0);
    if (source.type === 'turn_number_modulo') {
        const mod = Math.max(1, Math.trunc(normalizeNumber(source.mod, 1)));
        const equals = Math.trunc(normalizeNumber(source.equals, 0));
        return (Math.trunc(normalizeNumber(context.turn, 1)) % mod) === equals;
    }
    if (source.type === 'previous_action_is') {
        return uniqueText(context.previousActionId) === uniqueText(source.actionId);
    }
    if (source.type === 'target_distance_gte') {
        const target = asObject(context.target);
        const distance = normalizeNumber(context.targetDistance ?? target.distance, 0);
        return distance >= normalizeNumber(source.value, 0);
    }
    if (source.type === 'target_missing_status') {
        const target = asObject(context.target);
        const statuses = new Set([
            ...asArray(context.targetStatuses),
            ...asArray(target.statuses),
            ...asArray(target.statusIds)
        ].map(item => uniqueText(item)).filter(Boolean));
        return !statuses.has(uniqueText(source.status, 'bleed'));
    }
    return false;
}

function chooseNextEdge(node, edges, conditionResult = null) {
    if (node.type === 'branch') {
        const branch = conditionResult ? 'true' : 'false';
        return edges.find(edge => edge.branch === branch) || null;
    }
    return edges[0] || null;
}

export function previewEnemyDecision({ decision, enemy = {}, resolveSkill = () => null, turns = 4, context = {} } = {}) {
    const source = normalizeExistingDecision(decision || normalizeEnemyDecision({ enemy }));
    const { nodeById, edgesByFrom } = buildGraphIndex(source);
    const traces = [];
    let currentStateId = source.graph.initialStateId;
    let previousActionId = context.previousActionId || '';

    for (let turn = 1; turn <= Math.max(1, Math.trunc(turns)); turn += 1) {
        const trace = {
            turn,
            startStateId: currentStateId,
            visitedNodes: [],
            conditionResults: [],
            selectedActionNodeId: null,
            selectedSkillId: null,
            nextStateId: null,
            endStateId: currentStateId,
            fallbacks: [],
            warnings: []
        };
        let nodeId = currentStateId;

        for (let step = 0; step < MAX_TURN_STEPS; step += 1) {
            const node = nodeById.get(nodeId);
            if (!node) {
                trace.warnings.push({ code: 'missing_node', nodeId });
                break;
            }
            trace.visitedNodes.push(node.id);

            if (node.type === 'action') {
                const skillId = resolveActionSkill(node, source);
                const resolved = skillId ? resolveSkill(skillId) : null;
                const skill = skillConfigFromResolved(resolved);
                const ap = normalizeNumber(enemy?.ap ?? enemy?.stats?.ap, 0);
                const cost = normalizeNumber(skill?.costs?.ap ?? skill?.cost, 0);
                trace.selectedActionNodeId = node.id;
                trace.selectedSkillId = skillId || null;
                if (!skillId || !resolved) {
                    trace.fallbacks.push({ nodeId: node.id, reason: 'missing_skill_binding' });
                } else if (cost > ap) {
                    trace.fallbacks.push({ nodeId: node.id, reason: 'skill_ap_too_high' });
                }
                previousActionId = node.id;
                const nextStateId = uniqueText(node.nextStateId, currentStateId);
                if (nodeById.get(nextStateId)?.type === 'state') {
                    currentStateId = nextStateId;
                } else {
                    trace.warnings.push({ code: 'invalid_next_state', nodeId: node.id, nextStateId });
                }
                trace.nextStateId = nextStateId;
                trace.endStateId = currentStateId;
                break;
            }

            const outgoing = edgesByFrom.get(node.id) || [];
            let conditionResult = null;
            if (node.type === 'branch') {
                conditionResult = evaluateCondition(node.condition, { ...asObject(context), enemy, turn, previousActionId });
                trace.conditionResults.push({ nodeId: node.id, result: conditionResult });
            }
            const edge = chooseNextEdge(node, outgoing, conditionResult);
            if (edge) {
                nodeId = edge.to;
                continue;
            }
            if (node.fallbackNodeId) {
                trace.fallbacks.push({ nodeId: node.id, reason: 'node_fallback' });
                nodeId = node.fallbackNodeId;
                continue;
            }
            trace.warnings.push({ code: 'dead_end', nodeId: node.id });
            trace.endStateId = currentStateId;
            break;
        }

        if (!trace.selectedActionNodeId && trace.visitedNodes.length >= MAX_TURN_STEPS) {
            trace.warnings.push({ code: 'single_turn_loop_detected' });
        }
        traces.push(trace);
    }

    return { traces };
}

export { SCHEMA_VERSION };
