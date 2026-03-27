/**
 * @file UI_SkillTreeModal.js
 * @description Skill Tree UI view hosted inside System Modal.
 * High cohesion: encapsulates rendering, state derivation, and user interactions.
 * Low coupling: depends only on an engine facade (eventBus/input/data) and a DOM mount.
 */

const NODE_W = 83;
const NODE_H = 83;
const NODE_MARGIN = 10;

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

/**
 * @typedef {Object} SkillTreeStatus
 * @property {'LEARNED'|'LEARNABLE'|'LOCKED'|'INSUFFICIENT_KP'|'EXCLUSIVE_LOCK'} kind
 * @property {string[]} missingPrereqs
 * @property {number} kpCost
 * @property {string[]} exclusivesHit
 */

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

		this._dom = {
			root: null,
			header: null,
			title: null,
			kp: null,
          headerActions: null,
			headerButtons: null,
			btnResetAll: null,
            btnResetSelection: null,
			btnStageLearn: null,
			btnCommitAndClose: null,
			content: null,
			canvasWrap: null,
			transformLayer: null,
			svg: null,
			nodeLayer: null,
			detail: null,
			footer: null,
			btnClose: null
		};

		this._pan = { x: 0, y: 0 };
		this._zoom = 1;
		this._isPanning = false;
		this._lastMouse = null;

		this._bound = {
			onMouseMove: this._onMouseMove.bind(this),
			onMouseUp: this._onMouseUp.bind(this),
			onWheel: this._onWheel.bind(this)
		};
	}

	init(engine) {
		this.engine = engine;
	}

	/**
	 * Mount this view into SystemModal body.
	 * @param {HTMLElement} mount
	 * @param {{ title?: string, onClose?: () => void }} [options]
	 */
	mountTo(mount, options = {}) {
		this.mount = mount;
		this.onClose = typeof options.onClose === 'function' ? options.onClose : null;

		this._renderShell(options.title || '技能树');
		this._loadDataFromEngine();
     this._initSessionState();
		this._renderAll();
	}

	refreshFromEngine(payload) {
		const type = payload && typeof payload === 'object' ? payload.type : null;
		if (type && type !== 'PLAYER_SKILLS') return;
		this._loadDataFromEngine();
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
			header: null,
			title: null,
			kp: null,
          headerActions: null,
			headerButtons: null,
			btnResetAll: null,
            btnResetSelection: null,
			btnStageLearn: null,
			btnCommitAndClose: null,
			content: null,
			canvasWrap: null,
			transformLayer: null,
			svg: null,
			nodeLayer: null,
			detail: null,
			footer: null,
			btnClose: null
		};
       this._sessionSnapshot = null;
     this._stagedLearned = new Set();
		this._isDirty = false;
	}

	// ----------------- Data -----------------

	_loadDataFromEngine() {
		const skills = safeGet(this.engine, ['data', 'gameConfig', 'skills'], Object.create(null));
		this._skillsMap = skills || Object.create(null);
		this._skillsList = Object.values(this._skillsMap);

		// Default selection: first learned, else first skill
		const learned = this._getLearned();
		this._selectedSkillId = learned[0] || (this._skillsList[0] ? this._skillsList[0].id : null);
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

	_updateDirtyState() {
      if (!this._sessionSnapshot) {
			this._isDirty = false;
			return;
		}

     const snapshotSelected = this._sessionSnapshot.selectedSkillId;
		this._isDirty = this._stagedLearned.size > 0 || this._selectedSkillId !== snapshotSelected;
	}

   _restoreSnapshotState() {
		if (!this._sessionSnapshot) return;
		this._selectedSkillId = this._sessionSnapshot.selectedSkillId;
     this._stagedLearned = new Set();
		this._updateDirtyState();
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

	_getSkillById(skillId) {
		return this._skillsMap ? this._skillsMap[skillId] : undefined;
	}

	_getNodePos(skill) {
		const x = Number(skill?.editorMeta?.x);
		const y = Number(skill?.editorMeta?.y);
		if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };

		// Fallback: deterministic grid layout by index
		const idx = this._skillsList.findIndex(s => s.id === skill.id);
		const col = idx % 4;
		const row = Math.floor(idx / 4);
		return { x: 40 + col * (NODE_W + 40), y: 40 + row * (NODE_H + 30) };
	}

	/**
	 * @param {string} skillId
	 * @returns {SkillTreeStatus}
	 */
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

	// ----------------- Rendering -----------------

	_renderShell(titleText) {
		this._detachGlobalListeners();
		if (!this.mount) return;

		const root = el('div', 'ui-skilltree');

		const header = el('div', 'ui-skilltree__header');
		const title = el('div', 'ui-skilltree__title', titleText);
		const kp = el('div', 'ui-skilltree__kp', '可用 KP: 0');
      const headerActions = el('div', 'ui-skilltree__headerActions');
		const headerButtons = el('div', 'ui-skilltree__headerButtons');
		const btnResetAll = el('button', 'ui-skilltree__headerBtn ui-skilltree__headerBtn--danger', '重置所有技能');
        const btnResetSelection = el('button', 'ui-skilltree__headerBtn', '撤销未提交更改');
		const btnCommitAndClose = el('button', 'ui-skilltree__headerBtn ui-skilltree__headerBtn--primary', '提交并关闭');
		btnResetAll.type = 'button';
		btnResetSelection.type = 'button';
        btnCommitAndClose.type = 'button';

		btnResetAll.addEventListener('click', () => this._handleResetAllSkills());
		btnResetSelection.addEventListener('click', () => this._handleResetSelection());
        btnCommitAndClose.addEventListener('click', () => this._handleCommitAndClose());

		headerButtons.appendChild(btnResetAll);
		headerButtons.appendChild(btnResetSelection);
     headerButtons.appendChild(btnCommitAndClose);
		headerActions.appendChild(kp);
		headerActions.appendChild(headerButtons);
		header.appendChild(title);
		header.appendChild(headerActions);

		const content = el('div', 'ui-skilltree__content');
		const canvasWrap = el('div', 'ui-skilltree__canvasWrap');
		const transformLayer = el('div', 'ui-skilltree__transform');

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.classList.add('ui-skilltree__connections');
		svg.innerHTML = [
			'<defs>',
			'<marker id="ui-skilltree-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">',
			'<polygon points="0 0, 10 3.5, 0 7" fill="#666" />',
			'</marker>',
			'</defs>'
		].join('');

		const nodeLayer = el('div', 'ui-skilltree__nodes');

		transformLayer.appendChild(svg);
		transformLayer.appendChild(nodeLayer);
		canvasWrap.appendChild(transformLayer);

		const detail = el('div', 'ui-skilltree__detail');
		content.appendChild(canvasWrap);
		content.appendChild(detail);

		const footer = el('div', 'ui-skilltree__footer');
        footer.style.display = 'none';

		root.appendChild(header);
		root.appendChild(content);
		root.appendChild(footer);

		this.mount.innerHTML = '';
		this.mount.appendChild(root);

		this._dom = {
			root,
			header,
			title,
			kp,
            headerActions,
			headerButtons,
			btnResetAll,
			btnResetSelection,
            btnStageLearn: null,
			btnCommitAndClose,
			content,
			canvasWrap,
			transformLayer,
			svg,
			nodeLayer,
			detail,
			footer,
        btnClose: null
		};

		this._bindCanvasInteractions();
		this._attachGlobalListeners();
	}

	_renderAll() {
		this._renderHeader();
		this._renderNodes();
		this._renderConnections();
		this._renderDetail();
		this._applyTransform();
	}

	_renderHeader() {
        if (this._dom.kp) this._dom.kp.textContent = `可用 KP: ${this._getRemainingKp()}`;
		const learned = this._sessionSnapshot ? this._sessionSnapshot.learned : this._getLearned();
		const hasSelection = !!this._selectedSkillId;
		const status = hasSelection ? this._getStatus(this._selectedSkillId) : null;

		if (this._dom.btnResetAll) this._dom.btnResetAll.disabled = learned.length === 0;
       if (this._dom.btnResetSelection) this._dom.btnResetSelection.disabled = !this._isDirty;
		if (this._dom.btnCommitAndClose) this._dom.btnCommitAndClose.disabled = this._stagedLearned.size === 0;
		if (this._dom.btnStageLearn) this._dom.btnStageLearn.disabled = !hasSelection || status?.kind !== 'LEARNABLE';
	}

	_renderNodes() {
		if (!this._dom.nodeLayer) return;
		this._dom.nodeLayer.innerHTML = '';

		for (const skill of this._skillsList) {
			const pos = this._getNodePos(skill);
			const status = this._getStatus(skill.id);

           const kindClass = String(status.kind || '').toLowerCase();
			const node = el('button', `ui-skilltree__node ui-skilltree__node--${kindClass}`);
			node.type = 'button';
         node.style.left = `${pos.x}px`;
			node.style.top = `${pos.y}px`;
			node.dataset.skillId = skill.id;

			const name = el('div', 'ui-skilltree__nodeName', skill.name || skill.id);
			const meta = el('div', 'ui-skilltree__nodeMeta');
			const cost = Number(skill?.unlock?.cost?.kp) || 0;
			meta.textContent = cost > 0 ? `KP ${cost}` : 'KP 0';

			node.appendChild(name);
			node.appendChild(meta);

			if (skill.id === this._selectedSkillId) node.classList.add('is-selected');

			node.addEventListener('click', (e) => {
				e.stopPropagation();
				this._selectSkill(skill.id);
			});

			this._dom.nodeLayer.appendChild(node);
		}
	}

	_renderConnections() {
		if (!this._dom.svg) return;
		const defs = this._dom.svg.querySelector('defs')?.outerHTML || '';
		this._dom.svg.innerHTML = defs;

		for (const skill of this._skillsList) {
			for (const parentId of toArray(skill.prerequisites)) {
				const parent = this._getSkillById(parentId);
				if (!parent) continue;
				this._drawConnection(parent, skill);
			}
		}
	}

	_drawConnection(sourceSkill, targetSkill) {
		const s = this._getNodePos(sourceSkill);
		const t = this._getNodePos(targetSkill);

		const start = { x: s.x + NODE_W / 2, y: s.y + NODE_H };
		const end = { x: t.x + NODE_W / 2, y: t.y };
		const midY = (start.y + end.y) / 2;

		const points = [
			[start.x, start.y],
			[start.x, midY],
			[end.x, midY],
			[end.x, end.y]
		];

		const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
		polyline.setAttribute('points', points.map(p => `${p[0]},${p[1]}`).join(' '));
		polyline.setAttribute('class', 'ui-skilltree__line');
		polyline.setAttribute('marker-end', 'url(#ui-skilltree-arrow)');
		this._dom.svg.appendChild(polyline);
	}

	_renderDetail() {
		if (!this._dom.detail) return;
		this._dom.detail.innerHTML = '';

		if (!this._selectedSkillId) {
			this._dom.detail.appendChild(el('div', 'ui-skilltree__hint', '未选择技能'));
			return;
		}

		const skill = this._getSkillById(this._selectedSkillId);
		if (!skill) {
			this._dom.detail.appendChild(el('div', 'ui-skilltree__hint', '技能不存在'));
			return;
		}

		const status = this._getStatus(skill.id);
     const learned = this._getSessionLearned();

		const h = el('div', 'ui-skilltree__detailTitle', skill.name || skill.id);
		const desc = el('div', 'ui-skilltree__detailDesc', skill.description || '');

		const kpCost = Number(skill?.unlock?.cost?.kp) || 0;
		const costRow = el('div', 'ui-skilltree__detailRow');
		costRow.appendChild(el('div', 'ui-skilltree__label', 'KP 消耗'));
		costRow.appendChild(el('div', 'ui-skilltree__value', String(kpCost)));

		const prereqs = unique(toArray(skill.prerequisites));
		const preRow = el('div', 'ui-skilltree__detailRow');
		preRow.appendChild(el('div', 'ui-skilltree__label', '前置'));
		preRow.appendChild(el('div', 'ui-skilltree__value', prereqs.length ? prereqs.map(id => learned.includes(id) ? `${id} ✓` : id).join(', ') : '(无)'));

		const statusRow = el('div', 'ui-skilltree__detailRow');
		statusRow.appendChild(el('div', 'ui-skilltree__label', '状态'));
		statusRow.appendChild(el('div', 'ui-skilltree__value', status.kind));

     const btnArea = el('div', 'ui-skilltree__actions');
		const btnLearn = el('button', 'menu-btn', '学习');
		btnLearn.disabled = status.kind !== 'LEARNABLE';
		btnLearn.addEventListener('click', () => this._handleStageLearn(skill.id));
		this._dom.btnStageLearn = btnLearn;

		const hint = el('div', 'ui-skilltree__detailHint');
		if (status.kind === 'LOCKED') hint.textContent = `缺少前置：${status.missingPrereqs.join(', ')}`;
		else if (status.kind === 'INSUFFICIENT_KP') hint.textContent = `KP 不足：需要 ${status.kpCost}`;
		else if (status.kind === 'EXCLUSIVE_LOCK') hint.textContent = `互斥锁定：已学习 ${status.exclusivesHit.join(', ')}`;
		else if (status.kind === 'LEARNED') hint.textContent = '已学习';
		else if (status.kind === 'PENDING') hint.textContent = '已暂存（待提交）';

		btnArea.appendChild(btnLearn);

		this._dom.detail.appendChild(h);
		this._dom.detail.appendChild(desc);
		this._dom.detail.appendChild(costRow);
		this._dom.detail.appendChild(preRow);
		this._dom.detail.appendChild(statusRow);
		this._dom.detail.appendChild(btnArea);
		this._dom.detail.appendChild(hint);
	}

	// ----------------- Actions -----------------

	_selectSkill(skillId) {
		this._selectedSkillId = skillId;
		this._updateDirtyState();
		this._renderNodes();
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

		const basePoints = this._sessionSnapshot ? this._sessionSnapshot.skillPoints : this._getSkillPoints();
		const baseLearned = this._sessionSnapshot ? this._sessionSnapshot.learned : this._getLearned();
		const nextPoints = basePoints - this._getStagedCostKp();
		if (nextPoints < 0) return;

		const nextLearned = unique([...toArray(baseLearned), ...Array.from(this._stagedLearned)]);
		skillsObj.learned = nextLearned;
		skillsObj.skillPoints = nextPoints;

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

	_handleClose() {
		if (this.onClose) this.onClose();
	}

	// ----------------- Canvas interactions (pan/zoom) -----------------

	_bindCanvasInteractions() {
		if (!this._dom.canvasWrap) return;
		this._dom.canvasWrap.addEventListener('mousedown', (e) => {
			if (e.button !== 0) return;
			this._isPanning = true;
			this._lastMouse = { x: e.clientX, y: e.clientY };
		});
		this._dom.canvasWrap.addEventListener('click', () => {
			// click empty area clears selection
			this._selectedSkillId = null;
            this._pendingSelection = new Set();
			this._updateDirtyState();
			this._renderNodes();
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
		const delta = -e.deltaY;
		const factor = delta > 0 ? 1.1 : 0.9;
		const next = Math.max(0.3, Math.min(2.0, this._zoom * factor));
		this._zoom = next;
		this._applyTransform();
	}

	_applyTransform() {
		if (!this._dom.transformLayer) return;
		this._dom.transformLayer.style.transform = `translate(${this._pan.x}px, ${this._pan.y}px) scale(${this._zoom})`;
	}
}
