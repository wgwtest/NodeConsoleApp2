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

const ACTIVITY_NODE_SIZE = {
    entry: { width: 76, height: 76 },
    state: { width: 220, height: 82 },
    branch: { width: 168, height: 136 },
    action: { width: 220, height: 86 }
};

const CANVAS_LAYOUT = {
    minWidth: 1040,
    minHeight: 900,
    loopRailX: 74,
    centerX: 520,
    viewOriginY: 430,
    mergeGap: 28,
    endTurnGap: 70,
    endGap: 64,
    minMergeY: 650
};

const COLORS = {
    ink: '#17221d',
    muted: '#66736c',
    line: 'rgba(83, 101, 93, 0.52)',
    green: '#1f7b58',
    greenLine: 'rgba(31, 123, 88, 0.74)',
    amber: '#a96c1d',
    amberLine: 'rgba(169, 108, 29, 0.72)',
    blueLine: 'rgba(171, 85, 72, 0.68)',
    red: '#a13a2b',
    stateFill: '#fbfefc',
    actionFill: '#f2f9fb',
    branchFill: '#fffaf1',
    shadow: 'rgba(27, 36, 31, 0.09)'
};

function activityKind(node = {}) {
    if (node.type === 'entry') return 'entry';
    if (node.type === 'branch') return 'branch';
    if (node.type === 'action') return 'action';
    return 'state';
}

export function getActivityNodeSize(node = {}) {
    return ACTIVITY_NODE_SIZE[activityKind(node)] || ACTIVITY_NODE_SIZE.state;
}

export function getActivityNodeBounds(node = {}, layout = {}) {
    const size = getActivityNodeSize(node);
    const x = Number(layout.x ?? 0);
    const y = Number(layout.y ?? 0);
    return {
        x,
        y,
        width: size.width,
        height: size.height,
        centerX: x + size.width / 2,
        centerY: y + size.height / 2,
        top: y,
        right: x + size.width,
        bottom: y + size.height
    };
}

export function getActivityPortBounds(node = {}, layout = {}) {
    const bounds = getActivityNodeBounds(node, layout);
    if (activityKind(node) === 'entry') return { x: bounds.centerX - 11, y: bounds.bottom - 11, width: 22, height: 22 };
    return { x: bounds.right - 10, y: bounds.centerY - 11, width: 22, height: 22 };
}

function edgeKind(edge = {}, source = {}, target = {}) {
    if (edge.kind === 'loop' || edge.fromPort === 'nextState' || (source.type === 'action' && target.type === 'state')) return 'loop';
    if (edge.branch === 'true') return 'true';
    if (edge.branch === 'false') return 'false';
    if (edge.fromPort === 'fallback') return 'fallback';
    return 'flow';
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
    if (source.type === 'self_hp_ratio_lte') return `自身 HP <= ${source.value}`;
    if (source.type === 'self_hp_ratio_gte') return `自身 HP >= ${source.value}`;
    if (source.type === 'turn_number_modulo') return `回合 % ${source.mod} = ${source.equals}`;
    if (source.type === 'previous_action_is') return `上一行动是 ${source.actionId || '-'}`;
    if (source.type === 'target_distance_gte') return `距离 >= ${source.value}`;
    if (source.type === 'target_missing_status') return `目标未${source.status === 'bleed' ? '流血' : uniqueText(source.status, '-')}`;
    return source.type;
}

function nodeTitle(node = {}) {
    if (node.type === 'entry') return '行动开始';
    if (node.type === 'state') return translateLabel(node.label, '默认状态');
    if (node.type === 'branch') return translateLabel(node.label, '条件判断');
    if (node.type === 'action') return translateLabel(node.displayLabel || node.label || node.skillId, '行动');
    return translateLabel(node.id, '节点');
}

function nodeMeta(node = {}) {
    const labels = {
        entry: '每回合',
        state: '状态',
        branch: '条件判断',
        action: '技能行动'
    };
    return labels[node.type] || '节点';
}

function nodeDetails(node = {}, initialStateId = '') {
    return [
        node.skillId || '',
        node.type === 'branch' ? conditionLabel(node.condition) : '',
        node.type === 'action' ? `下一回合 ${uniqueText(node.nextStateId, initialStateId || '当前状态')}` : ''
    ].filter(Boolean);
}

function scaffoldMetrics(nodes = [], layoutNodes = {}, initialStateId = '') {
    const bounds = nodes.map(node => getActivityNodeBounds(node, asObject(layoutNodes[node.id])));
    const maxBottom = Math.max(380, ...bounds.map(item => item.bottom));
    const maxRight = Math.max(CANVAS_LAYOUT.minWidth, ...bounds.map(item => item.right + 220));
    const initialState = nodes.find(node => node.id === initialStateId) || nodes.find(node => node.type === 'state');
    const initialBounds = initialState
        ? getActivityNodeBounds(initialState, asObject(layoutNodes[initialState.id]))
        : { centerY: 184 };
    const mergeY = Math.max(CANVAS_LAYOUT.minMergeY, maxBottom + CANVAS_LAYOUT.mergeGap);
    const endTurnY = mergeY + CANVAS_LAYOUT.endTurnGap;
    const endY = endTurnY + CANVAS_LAYOUT.endGap;
    return {
        centerX: CANVAS_LAYOUT.centerX,
        loopRailX: CANVAS_LAYOUT.loopRailX,
        loopTop: Math.max(96, initialBounds.centerY),
        viewportOriginX: CANVAS_LAYOUT.centerX,
        viewportOriginY: CANVAS_LAYOUT.viewOriginY,
        mergeY,
        endTurnY,
        endY,
        width: Math.max(CANVAS_LAYOUT.minWidth, maxRight),
        height: Math.max(CANVAS_LAYOUT.minHeight, endY + 110)
    };
}

function setCanvasSize(canvas, width, height) {
    const ratio = Math.max(2, Number(globalThis.devicePixelRatio || 1));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.dataset.pixelRatio = String(ratio);
    return ratio;
}

function strokeArrow(ctx, fromX, fromY, toX, toY, color) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - Math.cos(angle - 0.55) * 9, toY - Math.sin(angle - 0.55) * 9);
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - Math.cos(angle + 0.55) * 9, toY - Math.sin(angle + 0.55) * 9);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.1;
    ctx.stroke();
    ctx.restore();
}

function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function diamondPath(ctx, centerX, centerY, width, height) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - height / 2);
    ctx.lineTo(centerX + width / 2, centerY);
    ctx.lineTo(centerX, centerY + height / 2);
    ctx.lineTo(centerX - width / 2, centerY);
    ctx.closePath();
}

function fillAndStroke(ctx, fill, stroke, lineWidth = 2) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

function drawShadow(ctx) {
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
}

function drawArrowedPolyline(ctx, points, color, dashed = false) {
    if (points.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (dashed) ctx.setLineDash([6, 7]);
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.stroke();
    if (dashed) ctx.setLineDash([]);
    const from = points[points.length - 2];
    const to = points[points.length - 1];
    strokeArrow(ctx, from.x, from.y, to.x, to.y, color);
    ctx.restore();
}

function drawFlowEdge(ctx, sourceBounds, targetBounds, kind) {
    const color = kind === 'true'
        ? COLORS.greenLine
        : kind === 'false' || kind === 'fallback'
            ? COLORS.amberLine
            : COLORS.line;
    if (targetBounds.x > sourceBounds.right + 80) {
        const from = { x: sourceBounds.right, y: sourceBounds.centerY };
        const to = { x: targetBounds.x, y: targetBounds.centerY };
        drawArrowedPolyline(ctx, [from, to], color);
        if (kind === 'true' || kind === 'false') {
            ctx.save();
            ctx.fillStyle = color;
            ctx.font = '800 11px "Microsoft YaHei", sans-serif';
            ctx.fillText(kind, from.x + 18, from.y - 8);
            ctx.restore();
        }
        return;
    }
    if (targetBounds.right < sourceBounds.x - 80) {
        const from = { x: sourceBounds.x, y: sourceBounds.centerY };
        const to = { x: targetBounds.right, y: targetBounds.centerY };
        drawArrowedPolyline(ctx, [from, to], color);
        if (kind === 'true' || kind === 'false') {
            ctx.save();
            ctx.fillStyle = color;
            ctx.font = '800 11px "Microsoft YaHei", sans-serif';
            ctx.fillText(kind, Math.min(from.x, to.x) + 18, from.y - 8);
            ctx.restore();
        }
        return;
    }
    const from = { x: sourceBounds.centerX, y: sourceBounds.bottom };
    const to = { x: targetBounds.centerX, y: targetBounds.top };
    const midY = Math.round((from.y + to.y) / 2);
    if (Math.abs(from.x - to.x) < 8) {
        drawArrowedPolyline(ctx, [from, to], color);
    } else {
        drawArrowedPolyline(ctx, [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to], color);
    }
    if (kind === 'true' || kind === 'false') {
        ctx.save();
        ctx.fillStyle = color;
        ctx.font = '800 11px "Microsoft YaHei", sans-serif';
        ctx.fillText(kind, from.x + 14, Math.round((from.y + to.y) / 2) - 8);
        ctx.restore();
    }
}

function drawLoopEdge(ctx, sourceBounds, targetBounds, metrics, loopIndex = 0) {
    const yOffset = Number(loopIndex || 0) * 18;
    const railX = metrics.loopRailX + yOffset;
    const from = { x: sourceBounds.x, y: sourceBounds.centerY };
    const target = { x: targetBounds.x, y: targetBounds.centerY };
    const elbowRadius = 24;
    ctx.save();
    ctx.strokeStyle = COLORS.blueLine;
    ctx.lineWidth = 2.1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(railX + elbowRadius, from.y);
    ctx.quadraticCurveTo(railX, from.y, railX, from.y + (target.y > from.y ? elbowRadius : -elbowRadius));
    ctx.lineTo(railX, target.y - elbowRadius);
    ctx.quadraticCurveTo(railX, target.y, railX + elbowRadius, target.y);
    ctx.lineTo(target.x - 10, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
    strokeArrow(ctx, railX + elbowRadius, target.y, target.x - 10, target.y, COLORS.blueLine);
    ctx.restore();
}

function actionColumns(nodes = [], layoutNodes = {}, metrics = CANVAS_LAYOUT) {
    const columns = { right: [], left: [] };
    nodes.filter(node => node.type === 'action').forEach((node) => {
        const bounds = getActivityNodeBounds(node, asObject(layoutNodes[node.id]));
        const item = { node, bounds };
        if (bounds.centerX < metrics.centerX - 80) {
            columns.left.push(item);
        } else {
            columns.right.push(item);
        }
    });
    return columns;
}

function hasReturnLoop(nodes = [], edges = [], initialStateId = '') {
    return false;
}

function drawActionEndEdges(ctx, columns, metrics) {
    const endY = metrics.endTurnY + 27;
    const endLeft = metrics.centerX - 110;
    const endRight = metrics.centerX + 110;
    const drawColumn = (items, side) => {
        if (!items.length) return;
        const laneX = side === 'right'
            ? Math.max(...items.map(item => item.bounds.right)) + 28
            : Math.min(...items.map(item => item.bounds.x)) - 28;
        const targetX = side === 'right' ? endRight : endLeft;
        const color = side === 'right' ? COLORS.amberLine : 'rgba(58, 64, 51, 0.86)';
        items.forEach((item) => {
            const from = { x: item.bounds.centerX, y: item.bounds.bottom };
            drawArrowedPolyline(ctx, [
                from,
                { x: laneX, y: from.y },
                { x: laneX, y: endY },
                { x: targetX, y: endY }
            ], color);
        });
    };
    drawColumn(columns.right, 'right');
    drawColumn(columns.left, 'left');
}

function drawOuterReturnLoop(ctx, targetBounds, metrics) {
    const railX = metrics.loopRailX;
    const targetY = targetBounds.centerY;
    const startY = metrics.endTurnY + 54;
    const elbow = 26;

    ctx.save();
    ctx.strokeStyle = COLORS.blueLine;
    ctx.lineWidth = 2.15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([7, 8]);
    ctx.beginPath();
    ctx.moveTo(metrics.centerX - 86, startY);
    ctx.lineTo(railX + elbow, startY);
    ctx.quadraticCurveTo(railX, startY, railX, startY - elbow);
    ctx.lineTo(railX, targetY + elbow);
    ctx.quadraticCurveTo(railX, targetY, railX + elbow, targetY);
    ctx.lineTo(targetBounds.x - 10, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
    strokeArrow(ctx, railX + elbow, targetY, targetBounds.x - 10, targetY, COLORS.blueLine);
    ctx.fillStyle = 'rgba(36, 72, 109, 0.72)';
    ctx.font = '800 12px "Microsoft YaHei", sans-serif';
    ctx.fillText('Action.nextState 回流', railX + 16, Math.max(130, targetY + 24));
    ctx.restore();
}

function drawScaffoldBase(ctx, metrics) {
    ctx.save();
    ctx.strokeStyle = 'rgba(91, 111, 101, 0.16)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(metrics.centerX, 106);
    ctx.lineTo(metrics.centerX, metrics.endY + 36);
    ctx.stroke();

    ctx.restore();
}

function drawTerminalFlow(ctx, metrics) {
    ctx.save();
    roundedRectPath(ctx, metrics.centerX - 110, metrics.endTurnY, 220, 54, 24);
    fillAndStroke(ctx, '#26352f', '#26352f', 1.7);
    ctx.fillStyle = '#fff';
    ctx.font = '800 12px "Microsoft YaHei", sans-serif';
    ctx.fillText('行动结束', metrics.centerX - 28, metrics.endTurnY + 34);

    ctx.beginPath();
    ctx.arc(metrics.centerX, metrics.endY + 36, 34, 0, Math.PI * 2);
    fillAndStroke(ctx, '#fff', '#26352f', 3);
    ctx.beginPath();
    ctx.arc(metrics.centerX, metrics.endY + 36, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#26352f';
    ctx.fill();
    ctx.restore();
}

function fitText(ctx, text, maxWidth) {
    const source = String(text ?? '');
    if (!source) return '';
    if (ctx.measureText(source).width <= maxWidth) return source;
    let next = source;
    while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) {
        next = next.slice(0, -1);
    }
    return `${next}…`;
}

function drawText(ctx, text, x, y, maxWidth, options = {}) {
    ctx.fillStyle = options.color || COLORS.ink;
    ctx.font = options.font || '650 13px "Microsoft YaHei", sans-serif';
    ctx.fillText(fitText(ctx, text, maxWidth), x, y);
}

function drawPort(ctx, node, layout) {
    if (node.type === 'entry') return;
    const port = getActivityPortBounds(node, layout);
    const centerX = port.x + port.width / 2;
    const centerY = port.y + port.height / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
    fillAndStroke(ctx, '#ffffff', 'rgba(31, 123, 88, 0.54)', 1.6);
    ctx.fillStyle = COLORS.green;
    ctx.font = '800 16px "Microsoft YaHei", sans-serif';
    ctx.fillText('+', centerX - 4, centerY + 5);
    ctx.restore();
}

function drawNodeControls(ctx, node, layout) {
    if (node.type === 'entry') return 0;
    const bounds = getActivityNodeBounds(node, layout);
    const controls = [
        { x: bounds.x - 7, y: bounds.y - 7 },
        { x: bounds.right - 7, y: bounds.y - 7 },
        { x: bounds.x - 7, y: bounds.bottom - 7 },
        { x: bounds.right - 7, y: bounds.bottom - 7 }
    ];
    ctx.save();
    controls.forEach((control) => {
        roundedRectPath(ctx, control.x, control.y, 14, 14, 4);
        fillAndStroke(ctx, '#ffffff', COLORS.red, 2);
    });
    ctx.restore();
    return controls.length;
}

function drawEntryNode(ctx, node, layout, state) {
    const bounds = getActivityNodeBounds(node, layout);
    ctx.save();
    drawShadow(ctx);
    ctx.beginPath();
    ctx.arc(bounds.centerX, bounds.centerY, bounds.width / 2, 0, Math.PI * 2);
    fillAndStroke(ctx, '#14201b', '#14201b', 2.4);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#fff';
    ctx.font = '800 15px "Microsoft YaHei", sans-serif';
    ctx.fillText(nodeTitle(node), bounds.centerX - 15, bounds.centerY + 5);
    if (state.selected || state.connecting) {
        ctx.beginPath();
        ctx.arc(bounds.centerX, bounds.centerY, bounds.width / 2 + 8, 0, Math.PI * 2);
        ctx.strokeStyle = state.connecting ? COLORS.green : COLORS.red;
        ctx.lineWidth = 2.4;
        ctx.stroke();
    }
    ctx.restore();
}

function drawRectNode(ctx, node, layout, state, initialStateId) {
    const bounds = getActivityNodeBounds(node, layout);
    const isAction = node.type === 'action';
    ctx.save();
    drawShadow(ctx);
    roundedRectPath(ctx, bounds.x, bounds.y, bounds.width, bounds.height, 16);
    fillAndStroke(
        ctx,
        isAction ? COLORS.actionFill : COLORS.stateFill,
        state.selected ? COLORS.red : state.connecting ? COLORS.green : (isAction ? 'rgba(42, 94, 130, 0.34)' : 'rgba(31, 123, 88, 0.35)'),
        state.selected || state.connecting ? 2.3 : 1.25
    );
    ctx.shadowColor = 'transparent';
    drawText(ctx, nodeTitle(node), bounds.x + 12, bounds.y + 24, bounds.width - 24, {
        font: '800 17px "Microsoft YaHei", sans-serif'
    });
    drawText(ctx, nodeMeta(node), bounds.x + 12, bounds.y + 43, bounds.width - 24, {
        color: COLORS.muted,
        font: '650 11px "Microsoft YaHei", sans-serif'
    });
    nodeDetails(node, initialStateId).slice(0, 2).forEach((line, index) => {
        drawText(ctx, line, bounds.x + 12, bounds.y + 60 + index * 15, bounds.width - 24, {
            color: COLORS.ink,
            font: '650 11px "Microsoft YaHei", sans-serif'
        });
    });
    drawPort(ctx, node, layout);
    ctx.restore();
}

function drawBranchNode(ctx, node, layout, state) {
    const bounds = getActivityNodeBounds(node, layout);
    ctx.save();
    drawShadow(ctx);
    diamondPath(ctx, bounds.centerX, bounds.centerY, bounds.width, bounds.height);
    fillAndStroke(
        ctx,
        COLORS.branchFill,
        state.selected ? COLORS.red : state.connecting ? COLORS.green : 'rgba(169, 108, 29, 0.62)',
        state.selected || state.connecting ? 2.4 : 1.7
    );
    ctx.shadowColor = 'transparent';
    drawText(ctx, nodeTitle(node), bounds.x + 30, bounds.y + 53, bounds.width - 60, {
        font: '800 16px "Microsoft YaHei", sans-serif'
    });
    drawText(ctx, nodeMeta(node), bounds.x + 32, bounds.y + 72, bounds.width - 64, {
        color: COLORS.muted,
        font: '650 11px "Microsoft YaHei", sans-serif'
    });
    drawText(ctx, conditionLabel(node.condition), bounds.x + 30, bounds.y + 92, bounds.width - 60, {
        font: '650 11px "Microsoft YaHei", sans-serif'
    });
    drawPort(ctx, node, layout);
    ctx.restore();
}

function drawNode(ctx, node, layout, options = {}) {
    const state = {
        selected: node.id === options.selectedNodeId,
        connecting: node.id === options.pendingConnectionFrom
    };
    if (node.type === 'entry') {
        drawEntryNode(ctx, node, layout, state);
    } else if (node.type === 'branch') {
        drawBranchNode(ctx, node, layout, state);
    } else {
        drawRectNode(ctx, node, layout, state, options.initialStateId || '');
    }
}

export class EnemyDecisionCanvasRenderer {
    constructor(options = {}) {
        this.document = options.document || globalThis.document;
    }

    createLayer(container) {
        const layer = this.document.createElement('canvas');
        layer.className = 'decision-canvas-layer';
        layer.setAttribute?.('aria-hidden', 'true');
        container.appendChild(layer);
        return layer;
    }

    render(options = {}) {
        const container = options.container;
        if (!container) return null;
        const nodes = asArray(options.nodes);
        const edges = asArray(options.edges);
        const layoutNodes = asObject(options.layoutNodes);
        const viewport = normalizeViewport(options.viewport);
        const metrics = scaffoldMetrics(nodes, layoutNodes, options.initialStateId || '');
        const layer = this.createLayer(container);
        const ctx = layer.getContext?.('2d');
        const columns = actionColumns(nodes, layoutNodes, metrics);
        const returnLoop = hasReturnLoop(nodes, edges, options.initialStateId || '');
        layer.dataset.contextReady = ctx ? 'true' : 'false';
        layer.dataset.drawMode = 'canvas_activity_diagram';
        layer.dataset.prototypeBaseline = 'activity_v3';
        layer.dataset.nodeCount = String(nodes.length);
        layer.dataset.drawnNodeCount = ctx ? String(nodes.length) : '0';
        layer.dataset.drawnNodeIds = nodes.map(node => node.id).join(',');
        layer.dataset.edgeCount = String(edges.length);
        layer.dataset.loopEdgeCount = returnLoop ? '1' : '0';
        layer.dataset.rightActionColumnCount = String(columns.right.length);
        layer.dataset.leftFallbackActionCount = String(columns.left.length);
        layer.dataset.decisionDiamondCount = String(nodes.filter(node => node.type === 'branch').length);
        layer.dataset.returnLoopMode = 'next_turn_state_tags';
        layer.dataset.actionMergeMode = 'actions_to_action_end';
        layer.dataset.selectedNodeId = options.selectedNodeId || '';
        layer.dataset.nodeControlCount = nodes.some(node => node.id === options.selectedNodeId) ? '4' : '0';
        layer.dataset.zoom = String(viewport.zoom);
        layer.dataset.panX = String(viewport.x);
        layer.dataset.panY = String(viewport.y);
        layer.dataset.rotation = String(viewport.rotation);
        layer.dataset.hasMerge = 'false';
        layer.dataset.width = String(metrics.width);
        layer.dataset.height = String(metrics.height);
        if (!ctx) return layer;

        const ratio = setCanvasSize(layer, metrics.width, metrics.height);
        ctx.save();
        ctx.scale(ratio, ratio);
        ctx.clearRect(0, 0, metrics.width, metrics.height);
        ctx.translate(viewport.x, viewport.y);
        ctx.translate(metrics.viewportOriginX, metrics.viewportOriginY);
        ctx.rotate((viewport.rotation * Math.PI) / 180);
        ctx.scale(viewport.zoom, viewport.zoom);
        ctx.translate(-metrics.viewportOriginX, -metrics.viewportOriginY);
        drawScaffoldBase(ctx, metrics);

        const nodeById = new Map(nodes.map(node => [node.id, node]));
        edges.forEach((edge) => {
            const source = nodeById.get(edge.from);
            const target = nodeById.get(edge.to);
            if (!source || !target) return;
            const sourceBounds = getActivityNodeBounds(source, asObject(layoutNodes[source.id]));
            const targetBounds = getActivityNodeBounds(target, asObject(layoutNodes[target.id]));
            const kind = edgeKind(edge, source, target);
            if (kind === 'loop') {
                return;
            }
            drawFlowEdge(ctx, sourceBounds, targetBounds, kind);
        });

        drawActionEndEdges(ctx, columns, metrics);

        nodes.forEach((node) => {
            drawNode(ctx, node, asObject(layoutNodes[node.id]), options);
        });
        nodes.forEach((node) => {
            if (node.id === options.selectedNodeId) {
                drawNodeControls(ctx, node, asObject(layoutNodes[node.id]));
            }
        });
        drawTerminalFlow(ctx, metrics);
        ctx.restore();
        return layer;
    }
}

export default EnemyDecisionCanvasRenderer;
