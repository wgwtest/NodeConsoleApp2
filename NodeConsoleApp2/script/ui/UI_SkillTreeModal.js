/**
 * @file UI_SkillTreeModal.js
 * @description Runtime skill tree view. Owns rendering, path focus, staged learning, and commit actions.
 */

const NODE_W = 112;
const NODE_H = 82;
const STRUCTURE_NODE_W = 74;
const STRUCTURE_NODE_H = 48;
const FIT_VIEW_W = 1000;
const FIT_VIEW_H = 680;
const FIT_PADDING = 76;
const MIN_READABLE_ZOOM = 0.42;
const LOD_STRUCTURE_MAX_ZOOM = 0.82;
const LOD_READING_MIN_ZOOM = 0.86;
const EDITOR_NODE_W = 72;
const EDITOR_NODE_H = 72;
const CANVAS_PADDING = 220;
const GRID_SIZE = 100;
const CONNECTION_MARGIN = 12;
const ANCHOR_HYSTERESIS_PX = 14;

const ROUTE_DEFS = Object.freeze([
	{
		id: 'guard',
		label: '稳固前线',
		desc: '护甲、格挡、反击',
		keywords: ['block', 'guard', 'iron', 'hold', 'fortify', 'aegis', 'regroup', 'armor', 'heal', '修理', '护甲', '铁', '重拳', '堡垒', '防御', '受击', '治疗']
	},
	{
		id: 'break',
		label: '破甲重击',
		desc: '高伤、处决、震击',
		keywords: ['heavy', 'skull', 'execute', 'earthquake', 'ragnarok', 'swing', 'shockwave', '裂颅', '重锤', '斩首', '震击', '黄昏', '光脚', '光头']
	},
	{
		id: 'blood',
		label: '流血连段',
		desc: '撕裂、吸血、爆发',
		keywords: ['slice', 'thrust', 'tear', 'bleed', 'blood', 'burst', 'vamp', '锯齿', '剑砍', '撕裂', '吸血', '迸发', '转进', '鲜血']
	}
]);

const STATUS_LABELS = Object.freeze({
	LEARNED: '已学习',
	LEARNABLE: '可学习',
	LOCKED: '缺少前置',
	INSUFFICIENT_KP: 'KP 不足',
	EXCLUSIVE_LOCK: '互斥锁定',
	PENDING: '待提交'
});

function el(tag, className, text) {
	const n = document.createElement(tag);
	if (className) n.className = className;
	if (text !== undefined) n.textContent = text;
	return n;
}

function unique(arr) {
	return Array.from(new Set(arr));
}

function toArray(v) {
	return Array.isArray(v) ? v : [];
}

function safeGet(obj, path, fallback) {
	let cur = obj;
	for (const k of path) {
		if (!cur || typeof cur !== 'object') return fallback;
		cur = cur[k];
	}
	return cur === undefined ? fallback : cur;
}

function cloneSerializable(value) {
	if (value === undefined) return undefined;
	return JSON.parse(JSON.stringify(value));
}

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}

function hasText(value, terms) {
	const haystack = String(value || '').toLowerCase();
	return terms.some(term => haystack.includes(String(term).toLowerCase()));
}

export class UI_SkillTreeModal {
	constructor() {
		this.engine = null;
		this.mount = null;
		this.onClose = null;

		this._skillsMap = Object.create(null);
		this._skillsList = [];
		this._selectedSkillId = null;
		this._sessionSnapshot = null;
		this._stagedLearned = new Set();
		this._isDirty = false;

		this._pan = { x: 0, y: 0 };
		this._zoom = 1;
		this._isPanning = false;
		this._lastMouse = null;
		this._layout = { minX: 0, minY: 0, maxX: FIT_VIEW_W, maxY: FIT_VIEW_H };
		this._surface = { width: FIT_VIEW_W, height: FIT_VIEW_H };
		this._nodePositions = new Map();
		this._edgeAnchorCache = new Map();
		this._lodMode = 'structure';

		this._dom = {
			root: null,
			kp: null,
			learnedCount: null,
			btnClose: null,
			routeRail: null,
			btnResetAll: null,
			btnResetSelection: null,
			btnCommitAndClose: null,
			btnStageLearn: null,
			content: null,
			canvasMeta: null,
			canvasWrap: null,
			transformLayer: null,
			canvas: null,
			nodeLayer: null,
			detail: null,
			footer: null
		};

		this._bound = {
			onMouseMove: this._onMouseMove.bind(this),
			onMouseUp: this._onMouseUp.bind(this),
			onWheel: this._onWheel.bind(this)
		};
	}

	init(engine) {
		this.engine = engine;
	}

	mountTo(mount, options = {}) {
		this.mount = mount;
		this.onClose = typeof options.onClose === 'function' ? options.onClose : null;
		this._loadDataFromEngine();
		this._initSessionState();
		this._fitToNodes();
		this._renderShell(options.title || '技能树 / 构筑');
		this._renderAll();
	}

	refreshFromEngine(payload) {
		const type = payload && typeof payload === 'object' ? payload.type : null;
		if (type && type !== 'PLAYER_SKILLS') return;
		this._loadDataFromEngine();
		this._fitToNodes();
		this._renderAll();
	}

	destroy() {
		this._detachGlobalListeners();
		if (this._dom.root && this._dom.root.parentNode) {
			this._dom.root.parentNode.removeChild(this._dom.root);
		}
		this.mount = null;
		this._dom = {
			root: null,
			kp: null,
			learnedCount: null,
			btnClose: null,
			routeRail: null,
			btnResetAll: null,
			btnResetSelection: null,
			btnCommitAndClose: null,
			btnStageLearn: null,
			content: null,
			canvasMeta: null,
			canvasWrap: null,
			transformLayer: null,
			canvas: null,
			nodeLayer: null,
			detail: null,
			footer: null
		};
		this._sessionSnapshot = null;
		this._stagedLearned = new Set();
		this._isDirty = false;
	}

	// ----------------- Data -----------------

	_loadDataFromEngine() {
		const catalog = typeof this.engine?.data?.getSkillCatalog === 'function'
			? this.engine.data.getSkillCatalog()
			: null;
		const skillsMap = catalog?.skillsMap || safeGet(this.engine, ['data', 'gameConfig', 'skills'], Object.create(null));
		const rawSkillsList = Array.isArray(catalog?.skillsList) ? catalog.skillsList : Object.values(skillsMap || Object.create(null));
		this._skillsMap = skillsMap || Object.create(null);
		this._skillsList = rawSkillsList.filter(skill => this._shouldRenderSkillNode(skill));

		const learned = this._getLearned();
		const firstLearnable = this._skillsList.find(skill => this._getStatus(skill.id).kind === 'LEARNABLE');
		this._selectedSkillId = learned.find(id => this._skillsList.some(skill => skill.id === id))
			|| firstLearnable?.id
			|| this._skillsList[0]?.id
			|| null;
	}

	_shouldRenderSkillNode(skill) {
		if (!skill || typeof skill !== 'object') return false;
		if (skill.editorMeta?.hiddenInSkillTree === true) return false;
		return true;
	}

	_initSessionState() {
		this._sessionSnapshot = {
			skillPoints: this._getSkillPoints(),
			learned: this._getLearned(),
			selectedSkillId: this._selectedSkillId
		};
		this._stagedLearned = new Set();
		this._isDirty = false;
	}

	_getPlayerSkillsObj() {
		const p = safeGet(this.engine, ['data', 'playerData'], null);
		return p && p.skills && typeof p.skills === 'object' ? p.skills : null;
	}

	_getSkillPoints() {
		const skillsObj = this._getPlayerSkillsObj();
		return typeof skillsObj?.skillPoints === 'number' ? skillsObj.skillPoints : 0;
	}

	_getLearned() {
		const skillsObj = this._getPlayerSkillsObj();
		return unique(toArray(skillsObj?.learned));
	}

	_getSessionLearned() {
		const base = this._sessionSnapshot ? this._sessionSnapshot.learned : this._getLearned();
		return unique([...toArray(base), ...Array.from(this._stagedLearned)]);
	}

	_getStagedCostKp() {
		let sum = 0;
		for (const id of this._stagedLearned) {
			sum += Number(this._getSkillById(id)?.unlock?.cost?.kp) || 0;
		}
		return sum;
	}

	_getRemainingKp() {
		const base = this._sessionSnapshot ? this._sessionSnapshot.skillPoints : this._getSkillPoints();
		return base - this._getStagedCostKp();
	}

	_getSkillById(skillId) {
		return this._skillsMap ? this._skillsMap[skillId] : undefined;
	}

	_getNodePos(skill) {
		const cached = this._nodePositions.get(skill?.id);
		if (cached) return cached;
		return this._getRawNodePos(skill);
	}

	_getRawNodePos(skill) {
		const x = Number(skill?.editorMeta?.x);
		const y = Number(skill?.editorMeta?.y);
		if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };

		const idx = this._skillsList.findIndex(s => s.id === skill.id);
		const col = idx % 4;
		const row = Math.floor(idx / 4);
		return { x: 120 + col * 190, y: 120 + row * 160 };
	}

	_rebuildRuntimeNodePositions() {
		this._nodePositions = new Map();
		for (const skill of this._skillsList) {
			this._nodePositions.set(skill.id, this._getRawNodePos(skill));
		}
	}

	_getStatus(skillId) {
		const skill = this._getSkillById(skillId);
		const learned = this._getSessionLearned();
		const kp = this._getRemainingKp();

		const prereqs = unique(toArray(skill?.prerequisites));
		const missingPrereqs = prereqs.filter(p => !learned.includes(p));
		const kpCost = Number(skill?.unlock?.cost?.kp) || 0;
		const exclusives = unique(toArray(skill?.unlock?.exclusives));
		const exclusivesHit = exclusives.filter(x => learned.includes(x));

		if (this._stagedLearned.has(skillId)) {
			return { kind: 'PENDING', missingPrereqs: [], kpCost, exclusivesHit: [] };
		}
		if (toArray(this._sessionSnapshot?.learned).includes(skillId)) {
			return { kind: 'LEARNED', missingPrereqs: [], kpCost, exclusivesHit: [] };
		}
		if (exclusivesHit.length > 0) {
			return { kind: 'EXCLUSIVE_LOCK', missingPrereqs, kpCost, exclusivesHit };
		}
		if (missingPrereqs.length > 0) {
			return { kind: 'LOCKED', missingPrereqs, kpCost, exclusivesHit: [] };
		}
		if (kp < kpCost) {
			return { kind: 'INSUFFICIENT_KP', missingPrereqs: [], kpCost, exclusivesHit: [] };
		}
		return { kind: 'LEARNABLE', missingPrereqs: [], kpCost, exclusivesHit: [] };
	}

	_updateDirtyState() {
		if (!this._sessionSnapshot) {
			this._isDirty = false;
			return;
		}
		this._isDirty = this._stagedLearned.size > 0 || this._selectedSkillId !== this._sessionSnapshot.selectedSkillId;
	}

	_syncLodMode() {
		const previous = this._lodMode || 'structure';
		if (this._zoom >= LOD_READING_MIN_ZOOM) {
			this._lodMode = 'reading';
		} else if (this._zoom <= LOD_STRUCTURE_MAX_ZOOM) {
			this._lodMode = 'structure';
		} else if (!this._lodMode) {
			this._lodMode = 'structure';
		}

		if (this._dom.root) {
			this._dom.root.dataset.lod = this._lodMode;
			this._dom.root.classList.toggle('ui-skilltree--structure', this._lodMode === 'structure');
			this._dom.root.classList.toggle('ui-skilltree--reading', this._lodMode === 'reading');
		}
		return previous !== this._lodMode;
	}

	_restoreSnapshotState() {
		if (!this._sessionSnapshot) return;
		this._selectedSkillId = this._sessionSnapshot.selectedSkillId;
		this._stagedLearned = new Set();
		this._updateDirtyState();
	}

	// ----------------- Tree semantics -----------------

	_getRouteForSkill(skill) {
		const text = `${skill?.id || ''} ${skill?.name || ''} ${skill?.description || ''}`;
		const route = ROUTE_DEFS.find(def => hasText(text, def.keywords));
		return route?.id || 'break';
	}

	_getRouteSummary() {
		const summary = new Map(ROUTE_DEFS.map(route => [route.id, { ...route, count: 0, learnable: 0 }]));
		for (const skill of this._skillsList) {
			const routeId = this._getRouteForSkill(skill);
			const item = summary.get(routeId) || summary.get('break');
			item.count += 1;
			if (this._getStatus(skill.id).kind === 'LEARNABLE') item.learnable += 1;
		}
		return Array.from(summary.values());
	}

	_getRelatedSkillIds(skillId) {
		if (!skillId) return new Set();
		const related = new Set([skillId]);
		const walkParents = (id) => {
			const skill = this._getSkillById(id);
			for (const parentId of toArray(skill?.prerequisites)) {
				if (!related.has(parentId)) {
					related.add(parentId);
					walkParents(parentId);
				}
			}
		};
		const walkChildren = (id) => {
			for (const child of this._skillsList) {
				if (toArray(child.prerequisites).includes(id) && !related.has(child.id)) {
					related.add(child.id);
					walkChildren(child.id);
				}
			}
		};
		walkParents(skillId);
		walkChildren(skillId);
		return related;
	}

	_getDownstreamSkills(skillId) {
		const result = [];
		const seen = new Set();
		const visit = (id) => {
			for (const skill of this._skillsList) {
				if (toArray(skill.prerequisites).includes(id) && !seen.has(skill.id)) {
					seen.add(skill.id);
					result.push(skill);
					visit(skill.id);
				}
			}
		};
		visit(skillId);
		return result;
	}

	_getPrereqNames(skill) {
		return toArray(skill?.prerequisites).map(id => this._getSkillById(id)?.name || id);
	}

	_getStatusLabel(kind) {
		return STATUS_LABELS[kind] || kind || '未知';
	}

	_getStatusHint(skill, status) {
		if (status.kind === 'LOCKED') {
			return `缺少前置：${status.missingPrereqs.map(id => this._getSkillById(id)?.name || id).join('、')}`;
		}
		if (status.kind === 'INSUFFICIENT_KP') return `KP 不足：需要 ${status.kpCost}`;
		if (status.kind === 'EXCLUSIVE_LOCK') return `互斥锁定：已学习 ${status.exclusivesHit.map(id => this._getSkillById(id)?.name || id).join('、')}`;
		if (status.kind === 'LEARNED') return '能力已进入战斗技能池。';
		if (status.kind === 'PENDING') return '已暂存，提交并关闭后保存。';
		const downstream = this._getDownstreamSkills(skill.id).slice(0, 3).map(s => s.name || s.id);
		return downstream.length
			? `学习后可推进：${downstream.join('、')}`
			: '学习后立即进入当前构筑。';
	}

	_fitToNodes() {
		if (!this._skillsList.length) {
			this._layout = { minX: 0, minY: 0, maxX: FIT_VIEW_W, maxY: FIT_VIEW_H };
			this._surface = { width: FIT_VIEW_W, height: FIT_VIEW_H };
			this._pan = { x: 0, y: 0 };
			this._zoom = 1;
			return;
		}
		this._rebuildRuntimeNodePositions();

		const boxes = this._skillsList.map(skill => {
			const pos = this._getNodePos(skill);
			return {
				left: pos.x,
				top: pos.y,
				right: pos.x + NODE_W,
				bottom: pos.y + NODE_H
			};
		});
		const minX = Math.min(...boxes.map(box => box.left));
		const minY = Math.min(...boxes.map(box => box.top));
		const maxX = Math.max(...boxes.map(box => box.right));
		const maxY = Math.max(...boxes.map(box => box.bottom));
		this._layout = { minX, minY, maxX, maxY };
		this._surface = {
			width: Math.ceil(maxX + CANVAS_PADDING),
			height: Math.ceil(maxY + CANVAS_PADDING)
		};

		const treeW = Math.max(1, maxX - minX);
		const treeH = Math.max(1, maxY - minY);
		const viewW = FIT_VIEW_W - FIT_PADDING * 2;
		const viewH = FIT_VIEW_H - FIT_PADDING * 2;
		const fit = Math.min(viewW / treeW, viewH / treeH);
		this._zoom = clamp(fit, MIN_READABLE_ZOOM, 1.05);
		this._pan = {
			x: Math.round((FIT_VIEW_W - treeW * this._zoom) / 2 - minX * this._zoom),
			y: Math.round((FIT_VIEW_H - treeH * this._zoom) / 2 - minY * this._zoom)
		};
	}

	// ----------------- Rendering -----------------

	_renderShell(titleText) {
		this._detachGlobalListeners();
		if (!this.mount) return;

		const root = el('div', 'ui-skilltree');

		const topbar = el('div', 'ui-skilltree__topbar');
		const titleGroup = el('div', 'ui-skilltree__titleGroup');
		const mark = el('div', 'ui-skilltree__mark', '技');
		const titleTextWrap = el('div', 'ui-skilltree__titleText');
		const title = el('div', 'ui-skilltree__title', titleText);
		const subtitle = el('div', 'ui-skilltree__subtitle');
		const learnedCount = el('span', 'ui-skilltree__learnedCount', '已学习 0 / 0');
		const guide = el('span', 'ui-skilltree__guide', '提交并关闭会保存本次学习并返回上一页；直接关闭不提交未保存更改，只返回上一页。');
		subtitle.appendChild(learnedCount);
		subtitle.appendChild(guide);
		titleTextWrap.appendChild(title);
		titleTextWrap.appendChild(subtitle);
		titleGroup.appendChild(mark);
		titleGroup.appendChild(titleTextWrap);

		const actions = el('div', 'ui-skilltree__topActions');
		const kp = el('div', 'ui-skilltree__kp', '可用 KP 0');
		const btnClose = el('button', 'ui-skilltree__topBtn ui-skilltree__topBtn--close', '直接关闭');
		const btnResetAll = el('button', 'ui-skilltree__topBtn ui-skilltree__topBtn--danger', '重置所有技能');
		const btnResetSelection = el('button', 'ui-skilltree__topBtn', '撤销暂存');
		const btnCommitAndClose = el('button', 'ui-skilltree__topBtn ui-skilltree__topBtn--primary', '提交并关闭');
		for (const btn of [btnClose, btnResetAll, btnResetSelection, btnCommitAndClose]) btn.type = 'button';
		btnClose.setAttribute('aria-label', '直接关闭技能树并返回上一页');
		btnClose.addEventListener('click', () => this._handleClose());
		btnResetAll.addEventListener('click', () => this._handleResetAllSkills());
		btnResetSelection.addEventListener('click', () => this._handleResetSelection());
		btnCommitAndClose.addEventListener('click', () => this._handleCommitAndClose());
		actions.appendChild(kp);
		actions.appendChild(btnClose);
		actions.appendChild(btnResetAll);
		actions.appendChild(btnResetSelection);
		actions.appendChild(btnCommitAndClose);
		topbar.appendChild(titleGroup);
		topbar.appendChild(actions);

		const content = el('div', 'ui-skilltree__content');
		const routeRail = el('aside', 'ui-skilltree__routeRail');
		const canvasWrap = el('section', 'ui-skilltree__canvasViewport');
		canvasWrap.setAttribute('aria-label', '技能树画布');
		const canvasMeta = el('div', 'ui-skilltree__canvasMeta', '拖拽平移 · 滚轮缩放 · 双击回到全图');
		const transformLayer = el('div', 'ui-skilltree__transform');
		transformLayer.style.width = `${this._surface.width}px`;
		transformLayer.style.height = `${this._surface.height}px`;
		const canvas = el('canvas', 'ui-skilltree__connections');
		canvas.width = this._surface.width;
		canvas.height = this._surface.height;
		canvas.setAttribute('aria-hidden', 'true');
		const nodeLayer = el('div', 'ui-skilltree__nodes');
		transformLayer.appendChild(canvas);
		transformLayer.appendChild(nodeLayer);
		canvasWrap.appendChild(canvasMeta);
		canvasWrap.appendChild(transformLayer);

		const detail = el('aside', 'ui-skilltree__decisionPanel');
		content.appendChild(routeRail);
		content.appendChild(canvasWrap);
		content.appendChild(detail);

		const footer = el('div', 'ui-skilltree__footer');
		footer.style.display = 'none';
		root.appendChild(topbar);
		root.appendChild(content);
		root.appendChild(footer);

		this.mount.innerHTML = '';
		this.mount.appendChild(root);

		this._dom = {
			root,
			kp,
			learnedCount,
			btnClose,
			routeRail,
			btnResetAll,
			btnResetSelection,
			btnCommitAndClose,
			btnStageLearn: null,
			content,
			canvasMeta,
			canvasWrap,
			transformLayer,
			canvas,
			nodeLayer,
			detail,
			footer
		};

		this._bindCanvasInteractions();
		this._attachGlobalListeners();
	}

	_renderAll() {
		this._syncLodMode();
		this._renderHeader();
		this._renderRoutes();
		this._renderNodes();
		this._renderConnections();
		this._renderDetail();
		this._applyTransform();
	}

	_renderHeader() {
		if (this._dom.kp) this._dom.kp.textContent = `可用 KP ${this._getRemainingKp()}`;
		if (this._dom.learnedCount) {
			const learnedVisible = this._getSessionLearned().filter(id => this._skillsList.some(skill => skill.id === id));
			this._dom.learnedCount.textContent = `已学习 ${learnedVisible.length} / ${this._skillsList.length}`;
		}
		if (this._dom.canvasMeta) {
			this._dom.canvasMeta.textContent = this._lodMode === 'reading'
				? `局部阅读态 · LOD 高（zoom ≥ ${LOD_READING_MIN_ZOOM.toFixed(2)}） · 拖拽平移 · 滚轮缩放 · 双击回到全图`
				: `全局结构态 · LOD 低（zoom < ${LOD_READING_MIN_ZOOM.toFixed(2)}） · 拖拽平移 · 滚轮缩放 · 双击回到全图`;
		}
		const learned = this._sessionSnapshot ? this._sessionSnapshot.learned : this._getLearned();
		const hasSelection = !!this._selectedSkillId;
		const status = hasSelection ? this._getStatus(this._selectedSkillId) : null;

		if (this._dom.btnResetAll) this._dom.btnResetAll.disabled = learned.length === 0;
		if (this._dom.btnResetSelection) this._dom.btnResetSelection.disabled = this._stagedLearned.size === 0;
		if (this._dom.btnCommitAndClose) this._dom.btnCommitAndClose.disabled = this._stagedLearned.size === 0;
		if (this._dom.btnStageLearn) this._dom.btnStageLearn.disabled = !hasSelection || status?.kind !== 'LEARNABLE';
	}

	_renderRoutes() {
		if (!this._dom.routeRail) return;
		this._dom.routeRail.innerHTML = '';
		this._dom.routeRail.appendChild(el('h2', 'ui-skilltree__railTitle', '构筑路线'));
		const list = el('div', 'ui-skilltree__routeList');
		const selected = this._getSkillById(this._selectedSkillId);
		const selectedRoute = this._getRouteForSkill(selected);
		for (const route of this._getRouteSummary()) {
			const card = el('button', `ui-skilltree__routeCard ui-skilltree__routeCard--${route.id}`);
			card.type = 'button';
			if (route.id === selectedRoute) card.classList.add('is-active');
			card.innerHTML = `<i></i><span><b>${route.label}</b><small>${route.desc} · ${route.count} 个节点 · ${route.learnable} 个可学</small></span>`;
			const firstSkill = this._skillsList.find(skill => this._getRouteForSkill(skill) === route.id);
			card.addEventListener('click', () => {
				if (!firstSkill) return;
				this._selectSkill(firstSkill.id);
			});
			list.appendChild(card);
		}
		this._dom.routeRail.appendChild(list);

		const legend = el('div', 'ui-skilltree__legend');
		for (const [className, text] of [
			['learned', '已学习：能力已进入战斗技能池'],
			['learnable', '可学习：满足前置与 KP'],
			['locked', '锁定：缺少前置或资源'],
			['blood', '分支：选择后影响路线']
		]) {
			const row = el('div', 'ui-skilltree__legendRow');
			row.innerHTML = `<i class="${className}"></i><span>${text}</span>`;
			legend.appendChild(row);
		}
		this._dom.routeRail.appendChild(legend);
	}

	_renderNodes() {
		if (!this._dom.nodeLayer) return;
		this._dom.nodeLayer.innerHTML = '';
		const focused = this._getRelatedSkillIds(this._selectedSkillId);
		const hasFocus = !!this._selectedSkillId;
		const isReadingMode = this._lodMode === 'reading';
		if (this._dom.transformLayer) {
			this._dom.transformLayer.style.width = `${this._surface.width}px`;
			this._dom.transformLayer.style.height = `${this._surface.height}px`;
		}
		if (this._dom.nodeLayer) {
			this._dom.nodeLayer.style.width = `${this._surface.width}px`;
			this._dom.nodeLayer.style.height = `${this._surface.height}px`;
		}

		for (const skill of this._skillsList) {
			const pos = this._getNodePos(skill);
			const status = this._getStatus(skill.id);
			const kindClass = String(status.kind || '').toLowerCase();
			const route = this._getRouteForSkill(skill);
			const node = el('button', `ui-skilltree__node ui-skilltree__node--${kindClass} ui-skilltree__node--route-${route}`);
			node.type = 'button';
			node.style.left = `${pos.x}px`;
			node.style.top = `${pos.y}px`;
			node.dataset.skillId = skill.id;
			node.dataset.route = route;
			node.dataset.status = status.kind;
			node.classList.toggle('ui-skilltree__node--compact', !isReadingMode);
			if (skill.id === this._selectedSkillId) node.classList.add('is-selected');
			if (focused.has(skill.id)) node.classList.add('is-path-focus');
			else if (hasFocus) node.classList.add('is-dimmed');

			const icon = el('div', 'ui-skilltree__nodeIcon', this._getRouteIcon(route));
			const name = el('div', 'ui-skilltree__nodeName', skill.name || skill.id);
			node.appendChild(icon);
			node.appendChild(name);
			if (isReadingMode) {
				const meta = el('div', 'ui-skilltree__nodeMeta', this._getStatusMeta(status));
				node.appendChild(meta);
			}
			node.addEventListener('click', (e) => {
				e.stopPropagation();
				this._selectSkill(skill.id);
			});
			this._dom.nodeLayer.appendChild(node);
		}
	}

	_renderConnections() {
		const canvas = this._dom.canvas;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		if (canvas.width !== this._surface.width) canvas.width = this._surface.width;
		if (canvas.height !== this._surface.height) canvas.height = this._surface.height;
		canvas.style.width = `${this._surface.width}px`;
		canvas.style.height = `${this._surface.height}px`;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		this._drawGrid(ctx, canvas.width, canvas.height);

		const focused = this._getRelatedSkillIds(this._selectedSkillId);
		const hasFocus = !!this._selectedSkillId;
		let edgeCount = 0;
		let focusedEdgeCount = 0;

		for (const skill of this._skillsList) {
			for (const parentId of toArray(skill.prerequisites)) {
				const parent = this._getSkillById(parentId);
				if (!parent || !this._skillsList.some(item => item.id === parent.id)) continue;
				const edgeFocused = focused.has(parent.id) && focused.has(skill.id);
				this._drawConnection(ctx, parent, skill, {
					focused: edgeFocused,
					dimmed: hasFocus && !edgeFocused
				});
				edgeCount += 1;
				if (edgeFocused) focusedEdgeCount += 1;
			}
		}
		canvas.dataset.edgeCount = String(edgeCount);
		canvas.dataset.focusedEdgeCount = String(focusedEdgeCount);
	}

	_drawGrid(ctx, width, height) {
		ctx.save();
		ctx.strokeStyle = 'rgba(255,255,255,0.035)';
		ctx.lineWidth = 1;
		for (let x = 0; x <= width; x += GRID_SIZE) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
		}
		for (let y = 0; y <= height; y += GRID_SIZE) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.stroke();
		}
		ctx.restore();
	}

	_snapToGridLine(value) {
		return Math.round(value / GRID_SIZE) * GRID_SIZE;
	}

	_getAdaptiveAnchors(sourceSkill, targetSkill) {
		const s = this._getNodePos(sourceSkill);
		const t = this._getNodePos(targetSkill);
		const nodeSize = this._getRenderedNodeSize();
		const sCenterY = s.y + nodeSize.height / 2;
		const tCenterY = t.y + nodeSize.height / 2;
		const key = `${sourceSkill.id}->${targetSkill.id}`;
		const prev = this._edgeAnchorCache?.get(key);
		const dy = sCenterY - tCenterY;
		let verticalDir;
		if (prev && Math.abs(dy) < ANCHOR_HYSTERESIS_PX) {
			verticalDir = prev;
		} else {
			verticalDir = sCenterY <= tCenterY ? 'down' : 'up';
		}
		if (!this._edgeAnchorCache) this._edgeAnchorCache = new Map();
		this._edgeAnchorCache.set(key, verticalDir);
		if (verticalDir === 'down') {
			return [
				{ x: s.x + nodeSize.width / 2, y: s.y + nodeSize.height, dir: 'bottom' },
				{ x: t.x + nodeSize.width / 2, y: t.y, dir: 'top' }
			];
		}
		return [
			{ x: s.x + nodeSize.width / 2, y: s.y, dir: 'top' },
			{ x: t.x + nodeSize.width / 2, y: t.y + nodeSize.height, dir: 'bottom' }
		];
	}

	_drawConnection(ctx, sourceSkill, targetSkill, options = {}) {
		const [start, end] = this._getAdaptiveAnchors(sourceSkill, targetSkill);
		const leaveY = start.dir === 'bottom' ? start.y + CONNECTION_MARGIN : start.y - CONNECTION_MARGIN;
		const enterY = end.dir === 'top' ? end.y - CONNECTION_MARGIN : end.y + CONNECTION_MARGIN;
		const midY = this._snapToGridLine((leaveY + enterY) / 2);
		const points = [
			[start.x, start.y],
			[start.x, leaveY],
			[end.x, midY],
			[end.x, enterY],
			[end.x, end.y]
		];
		const alpha = options.dimmed ? 0.22 : 1;
		const stroke = options.focused ? `rgba(232, 198, 111, ${0.92 * alpha})` : `rgba(130, 146, 143, ${0.62 * alpha})`;
		ctx.save();
		ctx.strokeStyle = stroke;
		ctx.lineWidth = options.focused ? 4 : 2.5;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		if (options.dimmed) ctx.setLineDash([8, 10]);
		ctx.beginPath();
		ctx.moveTo(points[0][0], points[0][1]);
		for (const point of points.slice(1)) {
			ctx.lineTo(point[0], point[1]);
		}
		ctx.stroke();
		ctx.setLineDash([]);
		this._drawArrowHead(ctx, points.at(-2), points.at(-1), stroke, options.focused ? 10 : 8);
		ctx.restore();
	}

	_drawArrowHead(ctx, from, to, color, size) {
		const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
		ctx.save();
		ctx.fillStyle = color;
		ctx.translate(to[0], to[1]);
		ctx.rotate(angle);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(-size, -size * 0.45);
		ctx.lineTo(-size, size * 0.45);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	_getRenderedNodeSize() {
		return { width: STRUCTURE_NODE_W, height: STRUCTURE_NODE_H };
	}

	_renderDetail() {
		if (!this._dom.detail) return;
		this._dom.detail.innerHTML = '';

		this._dom.detail.appendChild(el('h2', 'ui-skilltree__detailHeading', '当前选择'));
		if (!this._selectedSkillId) {
			this._dom.detail.appendChild(el('div', 'ui-skilltree__hint', '选择一个技能查看构筑影响。'));
			return;
		}

		const skill = this._getSkillById(this._selectedSkillId);
		if (!skill) {
			this._dom.detail.appendChild(el('div', 'ui-skilltree__hint', '技能不存在'));
			return;
		}

		const status = this._getStatus(skill.id);
		const prereqNames = this._getPrereqNames(skill);
		const downstream = this._getDownstreamSkills(skill.id);
		const downstreamNames = downstream.slice(0, 4).map(item => item.name || item.id);

		const card = el('section', 'ui-skilltree__detailCard');
		card.appendChild(el('h3', 'ui-skilltree__detailTitle', skill.name || skill.id));
		card.appendChild(el('p', 'ui-skilltree__detailDesc', skill.description || '暂无描述。'));
		this._dom.detail.appendChild(card);

		const stats = el('div', 'ui-skilltree__statGrid');
		for (const [label, value] of [
			['消耗', `${Number(skill?.unlock?.cost?.kp) || 0} KP`],
			['状态', this._getStatusLabel(status.kind)],
			['前置', prereqNames.length ? prereqNames.join('、') : '无'],
			['解锁后续', downstreamNames.length ? downstreamNames.join('、') : '无']
		]) {
			const item = el('div', 'ui-skilltree__stat');
			item.appendChild(el('span', '', label));
			item.appendChild(el('b', '', value));
			stats.appendChild(item);
		}
		this._dom.detail.appendChild(stats);

		this._dom.detail.appendChild(el('div', 'ui-skilltree__impact', this._getStatusHint(skill, status)));

		const chain = el('div', 'ui-skilltree__chain');
		const chainItems = [
			...toArray(skill.prerequisites).map(id => ({ id, label: this._getSkillById(id)?.name || id, state: '前置' })),
			{ id: skill.id, label: skill.name || skill.id, state: '当前' },
			...downstream.slice(0, 3).map(item => ({ id: item.id, label: item.name || item.id, state: '后续' }))
		];
		chainItems.forEach((item, index) => {
			const row = el('button', 'ui-skilltree__chainItem');
			row.type = 'button';
			if (item.id === skill.id) row.classList.add('is-current');
			row.innerHTML = `<i>${index + 1}</i><span>${item.label}</span><b>${item.state}</b>`;
			row.addEventListener('click', () => this._selectSkill(item.id));
			chain.appendChild(row);
		});
		this._dom.detail.appendChild(chain);

		const actionArea = el('div', 'ui-skilltree__actions');
		const btnLearn = el('button', 'ui-skilltree__learnBtn', `暂存学习：${skill.name || skill.id}`);
		btnLearn.type = 'button';
		btnLearn.disabled = status.kind !== 'LEARNABLE';
		btnLearn.addEventListener('click', () => this._handleStageLearn(skill.id));
		this._dom.btnStageLearn = btnLearn;
		const btnFocus = el('button', 'ui-skilltree__secondaryBtn', '只查看影响路径');
		btnFocus.type = 'button';
		btnFocus.addEventListener('click', () => this._selectSkill(skill.id));
		actionArea.appendChild(btnLearn);
		actionArea.appendChild(btnFocus);
		this._dom.detail.appendChild(actionArea);
	}

	_getRouteIcon(route) {
		if (route === 'guard') return '+';
		if (route === 'blood') return '血';
		return '×';
	}

	_getStatusMeta(status) {
		if (status.kind === 'LEARNED') return '已学';
		if (status.kind === 'PENDING') return '待提交';
		if (status.kind === 'LOCKED') return '前置';
		if (status.kind === 'INSUFFICIENT_KP') return `需 ${status.kpCost}`;
		if (status.kind === 'EXCLUSIVE_LOCK') return '互斥';
		return `KP ${status.kpCost}`;
	}

	// ----------------- Actions -----------------

	_selectSkill(skillId) {
		this._selectedSkillId = skillId;
		this._updateDirtyState();
		this._renderRoutes();
		this._renderNodes();
		this._renderConnections();
		this._renderDetail();
		this._renderHeader();
	}

	_handleStageLearn(skillId) {
		const status = this._getStatus(skillId);
		if (status.kind !== 'LEARNABLE') return;
		this._stagedLearned.add(skillId);
		this._updateDirtyState();
		this._renderAll();
	}

	_handleCommitAndClose() {
		if (this._stagedLearned.size === 0) return;
		const skillsObj = this._getPlayerSkillsObj();
		if (!skillsObj) return;

		const stagedSkillIds = Array.from(this._stagedLearned);
		const basePoints = this._sessionSnapshot ? this._sessionSnapshot.skillPoints : this._getSkillPoints();
		const baseLearned = this._sessionSnapshot ? this._sessionSnapshot.learned : this._getLearned();
		const nextPoints = basePoints - this._getStagedCostKp();
		if (nextPoints < 0) return;

		const nextLearned = unique([...toArray(baseLearned), ...stagedSkillIds]);
		skillsObj.learned = nextLearned;
		skillsObj.skillPoints = nextPoints;
		this._storeLastLearnAction({
			skillTreeId: skillsObj.skillTreeId ?? null,
			learnedSkillIds: stagedSkillIds,
			learnedSkillNames: stagedSkillIds.map(skillId => this._getSkillById(skillId)?.name || skillId),
			learnedCount: stagedSkillIds.length,
			spentKp: this._getStagedCostKp(),
			remainingKp: nextPoints,
			committedAt: new Date().toISOString()
		});

		if (this.engine?.eventBus) {
			this.engine.eventBus.emit('DATA_UPDATE', { type: 'PLAYER_SKILLS', data: skillsObj });
		}
		if (typeof this.engine?.saveGame === 'function') {
			this.engine.saveGame();
		} else if (this.engine?.data && typeof this.engine.data.saveGame === 'function') {
			this.engine.data.saveGame();
		}

		this._stagedLearned = new Set();
		this._initSessionState();
		this._renderAll();
		this._handleClose();
	}

	_handleResetSelection() {
		this._restoreSnapshotState();
		this._renderAll();
	}

	_handleResetAllSkills() {
		const skillsObj = this._getPlayerSkillsObj();
		if (!skillsObj) return;
		const learned = this._getLearned();
		if (learned.length === 0) return;

		const refund = learned.reduce((sum, skillId) => {
			const cost = Number(this._getSkillById(skillId)?.unlock?.cost?.kp) || 0;
			return sum + cost;
		}, 0);

		skillsObj.learned = [];
		skillsObj.skillPoints = (Number(skillsObj.skillPoints) || 0) + refund;
		this._selectedSkillId = this._skillsList[0] ? this._skillsList[0].id : null;
		this._initSessionState();

		if (this.engine?.eventBus) {
			this.engine.eventBus.emit('DATA_UPDATE', { type: 'PLAYER_SKILLS', data: skillsObj });
		}
		if (typeof this.engine?.saveGame === 'function') {
			this.engine.saveGame();
		} else if (this.engine?.data && typeof this.engine.data.saveGame === 'function') {
			this.engine.data.saveGame();
		}

		this._renderAll();
	}

	_storeLastLearnAction(lastLearnAction) {
		const dataManager = this.engine?.data;
		if (!dataManager) return;

		if (typeof dataManager.recordSkillTreeLearnAction === 'function') {
			dataManager.recordSkillTreeLearnAction(lastLearnAction);
			return;
		}

		if (!dataManager.dataConfig || typeof dataManager.dataConfig !== 'object') {
			dataManager.dataConfig = {};
		}
		if (!dataManager.dataConfig.global || typeof dataManager.dataConfig.global !== 'object') {
			dataManager.dataConfig.global = {};
		}
		const sourceProgress = (dataManager.dataConfig.global.progress && typeof dataManager.dataConfig.global.progress === 'object')
			? dataManager.dataConfig.global.progress
			: {};
		dataManager.dataConfig.global.progress = {
			...sourceProgress,
			lastLearnAction: cloneSerializable(lastLearnAction)
		};
	}

	_handleClose() {
		if (this.onClose) this.onClose();
	}

	// ----------------- Canvas interactions -----------------

	_bindCanvasInteractions() {
		if (!this._dom.canvasWrap) return;
		this._dom.canvasWrap.addEventListener('mousedown', (e) => {
			if (e.button !== 0) return;
			this._isPanning = true;
			this._lastMouse = { x: e.clientX, y: e.clientY };
		});
		this._dom.canvasWrap.addEventListener('dblclick', () => {
			this._fitToNodes();
			this._applyTransform();
		});
		this._dom.canvasWrap.addEventListener('click', (e) => {
			if (e.target !== this._dom.canvasWrap) return;
			this._selectedSkillId = null;
			this._updateDirtyState();
			this._renderRoutes();
			this._renderNodes();
			this._renderConnections();
			this._renderDetail();
			this._renderHeader();
		});
		this._dom.canvasWrap.addEventListener('wheel', this._bound.onWheel, { passive: false });
	}

	_attachGlobalListeners() {
		window.addEventListener('mousemove', this._bound.onMouseMove);
		window.addEventListener('mouseup', this._bound.onMouseUp);
	}

	_detachGlobalListeners() {
		window.removeEventListener('mousemove', this._bound.onMouseMove);
		window.removeEventListener('mouseup', this._bound.onMouseUp);
		if (this._dom.canvasWrap) this._dom.canvasWrap.removeEventListener('wheel', this._bound.onWheel);
	}

	_onMouseMove(e) {
		if (!this._isPanning || !this._lastMouse) return;
		const dx = e.clientX - this._lastMouse.x;
		const dy = e.clientY - this._lastMouse.y;
		this._lastMouse = { x: e.clientX, y: e.clientY };
		this._pan.x += dx;
		this._pan.y += dy;
		this._applyTransform();
	}

	_onMouseUp() {
		this._isPanning = false;
		this._lastMouse = null;
	}

	_onWheel(e) {
		e.preventDefault();
		const factor = -e.deltaY > 0 ? 1.1 : 0.9;
		this._zoom = clamp(this._zoom * factor, 0.35, 1.8);
		const lodChanged = this._syncLodMode();
		if (lodChanged) {
			this._renderNodes();
			this._renderConnections();
			this._renderHeader();
		}
		this._applyTransform();
	}

	_applyTransform() {
		if (!this._dom.transformLayer) return;
		this._dom.transformLayer.style.transform = `translate(${this._pan.x}px, ${this._pan.y}px) scale(${this._zoom})`;
	}
}
