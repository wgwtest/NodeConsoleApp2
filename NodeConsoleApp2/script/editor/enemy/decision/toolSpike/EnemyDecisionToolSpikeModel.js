const TOOL_SOURCE = Object.freeze({
    logicflow: 'https://github.com/didi/LogicFlow',
    maxgraph: 'https://github.com/maxGraph/maxGraph',
    rete: 'https://retejs.org/'
});

function node(id, type, label, subtitle, x, y, width, height, extra = {}) {
    return { id, type, label, subtitle, x, y, width, height, ...extra };
}

function edge(id, from, to, label = '', kind = 'flow', extra = {}) {
    return { id, from, to, label, kind, ...extra };
}

const ACTIVITY_AUTO_LAYOUT = Object.freeze({
    trunkX: 560,
    rightActionX: 892,
    leftActionX: 234,
    leftLoopX: 66,
    rightMergeRails: Object.freeze({
        edge_conservative_merge: 1044,
        edge_far_merge: 1018,
        edge_shiv_merge: 992
    }),
    canvasWidth: 1140,
    canvasHeight: 940
});

const ACTIVITY_NODE_PLACEMENTS = Object.freeze({
    entry: Object.freeze({ x: 560, y: 72, width: 100, height: 100 }),
    state_normal: Object.freeze({ x: 560, y: 172, width: 250, height: 66 }),
    branch_low_hp: Object.freeze({ x: 560, y: 304, width: 60, height: 100 }),
    action_conservative_throw: Object.freeze({ x: 892, y: 304, width: 226, height: 72 }),
    branch_far_target: Object.freeze({ x: 560, y: 430, width: 60, height: 100 }),
    action_far_throw: Object.freeze({ x: 892, y: 430, width: 226, height: 72 }),
    branch_target_missing_bleed: Object.freeze({ x: 560, y: 556, width: 60, height: 100 }),
    action_rusty_shiv: Object.freeze({ x: 892, y: 556, width: 226, height: 72 }),
    action_fallback_throw: Object.freeze({ x: 234, y: 556, width: 226, height: 72 }),
    merge: Object.freeze({ x: 560, y: 700, width: 60, height: 100 }),
    end_turn: Object.freeze({ x: 560, y: 796, width: 246, height: 56 }),
    end: Object.freeze({ x: 560, y: 884, width: 100, height: 100 })
});

function roundPoint(point) {
    return {
        x: Math.round(point.x),
        y: Math.round(point.y)
    };
}

function port(nodesById, nodeId, side) {
    const item = nodesById[nodeId];
    if (!item) return { x: 0, y: 0 };
    const halfWidth = (Number(item.width) || 160) / 2;
    const halfHeight = (Number(item.height) || 60) / 2;
    if (side === 'top') return { x: item.x, y: item.y - halfHeight };
    if (side === 'bottom') return { x: item.x, y: item.y + halfHeight };
    if (side === 'left') return { x: item.x - halfWidth, y: item.y };
    if (side === 'right') return { x: item.x + halfWidth, y: item.y };
    return { x: item.x, y: item.y };
}

function routeVertical(nodesById, fromId, toId) {
    return [port(nodesById, fromId, 'bottom'), port(nodesById, toId, 'top')];
}

function routeHorizontal(nodesById, fromId, toId, fromSide = 'right', toSide = 'left') {
    return [port(nodesById, fromId, fromSide), port(nodesById, toId, toSide)];
}

function routeRightActionToMerge(nodesById, fromId, railX) {
    const start = port(nodesById, fromId, 'right');
    const end = port(nodesById, 'merge', 'right');
    return [
        start,
        { x: railX, y: start.y },
        { x: railX, y: end.y },
        end
    ];
}

function routeLeftActionToMerge(nodesById, fromId) {
    const start = port(nodesById, fromId, 'bottom');
    const end = port(nodesById, 'merge', 'left');
    const laneY = Math.max(start.y + 86, end.y);
    return [
        start,
        { x: start.x, y: laneY },
        { x: end.x, y: laneY },
        end
    ];
}

export function createActivityAutoLayout(scenario) {
    const sourceNodes = Array.isArray(scenario?.nodes) ? scenario.nodes : [];
    const sourceEdges = Array.isArray(scenario?.edges) ? scenario.edges : [];
    const edgeIds = new Set(sourceEdges.map(item => item.id));
    const nodesById = {};

    sourceNodes.forEach(item => {
        const placement = ACTIVITY_NODE_PLACEMENTS[item.id] || {};
        nodesById[item.id] = {
            ...item,
            ...placement,
            width: placement.width || item.width || 160,
            height: placement.height || item.height || 60
        };
    });

    const edgeRoutes = {};
    const addRoute = (edgeId, points) => {
        if (!edgeIds.has(edgeId)) return;
        edgeRoutes[edgeId] = points.map(roundPoint);
    };

    addRoute('edge_entry_state', routeVertical(nodesById, 'entry', 'state_normal'));
    addRoute('edge_state_low_hp', routeVertical(nodesById, 'state_normal', 'branch_low_hp'));
    addRoute('edge_low_hp_true', routeHorizontal(nodesById, 'branch_low_hp', 'action_conservative_throw'));
    addRoute('edge_low_hp_false', routeVertical(nodesById, 'branch_low_hp', 'branch_far_target'));
    addRoute(
        'edge_conservative_merge',
        routeRightActionToMerge(nodesById, 'action_conservative_throw', ACTIVITY_AUTO_LAYOUT.rightMergeRails.edge_conservative_merge)
    );
    addRoute('edge_far_true', routeHorizontal(nodesById, 'branch_far_target', 'action_far_throw'));
    addRoute('edge_far_false', routeVertical(nodesById, 'branch_far_target', 'branch_target_missing_bleed'));
    addRoute(
        'edge_far_merge',
        routeRightActionToMerge(nodesById, 'action_far_throw', ACTIVITY_AUTO_LAYOUT.rightMergeRails.edge_far_merge)
    );
    addRoute('edge_bleed_true', routeHorizontal(nodesById, 'branch_target_missing_bleed', 'action_rusty_shiv'));
    addRoute('edge_bleed_false', routeHorizontal(nodesById, 'branch_target_missing_bleed', 'action_fallback_throw', 'left', 'right'));
    addRoute(
        'edge_shiv_merge',
        routeRightActionToMerge(nodesById, 'action_rusty_shiv', ACTIVITY_AUTO_LAYOUT.rightMergeRails.edge_shiv_merge)
    );
    addRoute('edge_fallback_merge', routeLeftActionToMerge(nodesById, 'action_fallback_throw'));
    addRoute('edge_merge_end_turn', routeVertical(nodesById, 'merge', 'end_turn'));
    addRoute('edge_end_turn_end', routeVertical(nodesById, 'end_turn', 'end'));

    if (edgeIds.has('loop_next_turn_state')) {
        const start = port(nodesById, 'end_turn', 'left');
        const end = port(nodesById, 'state_normal', 'left');
        edgeRoutes.loop_next_turn_state = [
            start,
            { x: ACTIVITY_AUTO_LAYOUT.leftLoopX, y: start.y },
            { x: ACTIVITY_AUTO_LAYOUT.leftLoopX, y: end.y },
            end
        ].map(roundPoint);
    }

    return {
        nodesById,
        edgeRoutes,
        rails: {
            trunkX: ACTIVITY_AUTO_LAYOUT.trunkX,
            rightActionX: ACTIVITY_AUTO_LAYOUT.rightActionX,
            leftActionX: ACTIVITY_AUTO_LAYOUT.leftActionX,
            leftLoopX: ACTIVITY_AUTO_LAYOUT.leftLoopX,
            rightMergeRails: { ...ACTIVITY_AUTO_LAYOUT.rightMergeRails }
        },
        canvas: {
            width: ACTIVITY_AUTO_LAYOUT.canvasWidth,
            height: ACTIVITY_AUTO_LAYOUT.canvasHeight
        }
    };
}

export function createDecisionToolSpikeScenario() {
    const nodes = [
        node('entry', 'entry', '入口', '本回合进入决策', 560, 72, 74, 74),
        node('state_normal', 'state', '默认状态', 'currentState = state_normal', 560, 172, 250, 66),
        node('branch_low_hp', 'branch', 'HP <= 35%?', 'self_hp_ratio_lte', 560, 304, 182, 96),
        node('action_conservative_throw', 'action', '保守投石', 'skill_throw_stone', 892, 304, 226, 72, { skillId: 'skill_throw_stone' }),
        node('branch_far_target', 'branch', '距离 >= 2?', 'target_distance_gte', 560, 430, 182, 96),
        node('action_far_throw', 'action', '远距投石', 'skill_throw_stone', 892, 430, 226, 72, { skillId: 'skill_throw_stone' }),
        node('branch_target_missing_bleed', 'branch', '目标未流血?', 'target_missing_bleed', 560, 556, 190, 100),
        node('action_rusty_shiv', 'action', '锈刀划拉', 'enemy_skill_rusty_shiv', 892, 556, 226, 72, { skillId: 'enemy_skill_rusty_shiv' }),
        node('action_fallback_throw', 'action', '后备投石', 'fallback action', 234, 556, 226, 72, { skillId: 'skill_throw_stone' }),
        node('merge', 'merge', 'Merge', '选择本回合行动', 560, 700, 106, 78),
        node('end_turn', 'endTurn', 'End Turn', '输出 trace 与 nextState', 560, 796, 246, 56),
        node('end', 'end', 'End', '本回合结束', 560, 884, 70, 70)
    ];

    const edges = [
        edge('edge_entry_state', 'entry', 'state_normal'),
        edge('edge_state_low_hp', 'state_normal', 'branch_low_hp'),
        edge('edge_low_hp_true', 'branch_low_hp', 'action_conservative_throw', 'true: 低血量'),
        edge('edge_low_hp_false', 'branch_low_hp', 'branch_far_target', 'false'),
        edge('edge_conservative_merge', 'action_conservative_throw', 'merge'),
        edge('edge_far_true', 'branch_far_target', 'action_far_throw', 'true: 远距'),
        edge('edge_far_false', 'branch_far_target', 'branch_target_missing_bleed', 'false'),
        edge('edge_far_merge', 'action_far_throw', 'merge'),
        edge('edge_bleed_true', 'branch_target_missing_bleed', 'action_rusty_shiv', 'true'),
        edge('edge_bleed_false', 'branch_target_missing_bleed', 'action_fallback_throw', 'false'),
        edge('edge_shiv_merge', 'action_rusty_shiv', 'merge'),
        edge('edge_fallback_merge', 'action_fallback_throw', 'merge'),
        edge('edge_merge_end_turn', 'merge', 'end_turn'),
        edge('edge_end_turn_end', 'end_turn', 'end'),
        edge('loop_next_turn_state', 'end_turn', 'state_normal', 'nextState: state_normal', 'loop', { lane: 0 })
    ];

    const scenario = {
        title: '敌人决策工具选型原型',
        summary: '同一份敌人状态机语义分别交给 LogicFlow、maxGraph、Rete.js 渲染，比较活动图表现、拖拽缩放、连线编辑和后续扩展成本。',
        enemy: {
            name: '腐锈投石兵',
            state: 'state_normal',
            skills: [
                { id: 'skill_throw_stone', name: '远距投石' },
                { id: 'enemy_skill_rusty_shiv', name: '锈刀割裂' }
            ]
        },
        tools: [
            {
                id: 'logicflow',
                name: 'LogicFlow',
                source: TOOL_SOURCE.logicflow,
                role: '业务流程图优先',
                verdict: '最贴近活动图/状态机编辑器。',
                strengths: ['原生流程图模型', '自定义节点和插件体系', '对当前原生 JS 页面改造成本较低'],
                risks: ['复杂业务面板仍要自建属性栏', '节点外观需要二次定制']
            },
            {
                id: 'maxgraph',
                name: 'maxGraph',
                source: TOOL_SOURCE.maxgraph,
                role: '专业 diagram editor',
                verdict: '能力最强，但工程接入更重。',
                strengths: ['传统图编辑能力成熟', '边路由、选择、缩放、图操作能力强', '适合做 draw.io 级别编辑器'],
                risks: ['官方更推荐 bundler 集成', 'API 面更大，封装成本高']
            },
            {
                id: 'rete',
                name: 'Rete.js',
                source: TOOL_SOURCE.rete,
                role: '视觉编程/蓝图语义',
                verdict: '适合可执行蓝图，不是天然 UML 活动图。',
                strengths: ['控制流/数据流语义强', '节点、socket、connection 模型清晰', '未来可接执行引擎'],
                risks: ['通常需要 React/Vue/Lit 渲染插件', '要做成活动图样式需要较多自定义']
            }
        ],
        nodes,
        edges,
        canvas: {
            width: 1180,
            height: 980,
            gridSize: 24
        }
    };

    const autoLayout = createActivityAutoLayout(scenario);
    scenario.nodes = scenario.nodes.map(item => ({
        ...item,
        ...autoLayout.nodesById[item.id]
    }));
    scenario.edges = scenario.edges.map(item => ({
        ...item,
        points: autoLayout.edgeRoutes[item.id] || []
    }));
    scenario.canvas = {
        ...scenario.canvas,
        width: autoLayout.canvas.width,
        height: autoLayout.canvas.height
    };
    scenario.autoLayout = autoLayout;
    return scenario;
}

export function nodeKind(nodeType) {
    if (nodeType === 'entry') return '开始';
    if (nodeType === 'state') return '状态';
    if (nodeType === 'branch') return '判断';
    if (nodeType === 'action') return '行动';
    if (nodeType === 'merge') return '合流';
    if (nodeType === 'endTurn') return '回合结束';
    if (nodeType === 'end') return '结束';
    return '节点';
}

export function getNodeCenter(node) {
    return { x: Number(node.x) || 0, y: Number(node.y) || 0 };
}

export function getNodeBox(node) {
    const width = Number(node.width) || 160;
    const height = Number(node.height) || 60;
    return {
        x: Math.round((Number(node.x) || 0) - width / 2),
        y: Math.round((Number(node.y) || 0) - height / 2),
        width,
        height
    };
}
