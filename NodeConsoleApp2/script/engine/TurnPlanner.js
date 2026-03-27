export default class TurnPlanner {
	constructor({ getSlotLayout, getPlayerId, getSkillConfig, getCurrentAp, getUsedAp }) {
		this._getSlotLayout = getSlotLayout;
		this._getPlayerId = getPlayerId;
		this._getSkillConfig = getSkillConfig;
		this._getCurrentAp = getCurrentAp;
		this._getUsedAp = getUsedAp;
       this._apBudget = {
			phase: 'AP_BUDGET_UNINITIALIZED',
			availableAp: 0,
			effectiveApCostBySkill: Object.create(null),
			plannedCost: 0,
			remaining: 0,
			ok: true
		};
		this.reset();
	}

	reset() {
		this.assigned = Object.create(null); // slotKey -> actionId
		this.actionsById = Object.create(null); // actionId -> action
		this.order = []; // actionId[]
		this.skillCounts = Object.create(null); // skillId -> count
       this.plannedBySkill = Object.create(null); // skillId -> action
		this.skillToSlots = Object.create(null); // skillId -> slotKey[]
		this._nextId = 1;
       this._resetApBudget();
	}

	_resetApBudget() {
		this._apBudget = {
			phase: 'AP_BUDGET_UNINITIALIZED',
			availableAp: 0,
			effectiveApCostBySkill: Object.create(null),
			plannedCost: 0,
			remaining: 0,
			ok: true
		};
	}

	enterPlanning({ availableAp, effectiveApCostBySkill }) {
		const ap = Number(availableAp);
		if (!Number.isFinite(ap) || ap < 0) {
			return { ok: false, reason: 'Invalid availableAp for planning.' };
		}
		if (!effectiveApCostBySkill || typeof effectiveApCostBySkill !== 'object') {
			return { ok: false, reason: 'effectiveApCostBySkill is required.' };
		}

		this._apBudget.phase = 'AP_BUDGET_READY';
		this._apBudget.availableAp = ap;
		this._apBudget.effectiveApCostBySkill = { ...effectiveApCostBySkill };
		this._apBudget.plannedCost = 0;
		this._apBudget.remaining = ap;
		this._apBudget.ok = true;
		return { ok: true };
	}

	recalcApBudgetForDraft({ planningDraftBySkill }) {
		if (this._apBudget.phase === 'AP_BUDGET_UNINITIALIZED') {
			return { ok: false, reason: 'AP budget not initialized (call enterPlanning first).' };
		}

		const root = planningDraftBySkill && typeof planningDraftBySkill === 'object' ? planningDraftBySkill : null;
		const skillIds = root ? Object.keys(root) : [];
		let plannedCost = 0;
		for (const skillId of skillIds) {
			const cost = Number(this._apBudget.effectiveApCostBySkill?.[skillId] ?? 0);
			plannedCost += Number.isFinite(cost) ? cost : 0;
		}
		const remaining = this._apBudget.availableAp - plannedCost;
		const ok = remaining >= 0;
		this._apBudget.plannedCost = plannedCost;
		this._apBudget.remaining = remaining;
		this._apBudget.ok = ok;
		this._apBudget.phase = ok ? 'AP_BUDGET_READY' : 'AP_BUDGET_INVALID';
		return { ok: true, plannedCost, remaining, withinBudget: ok };
	}

	getApBudgetState() {
		return { ...this._apBudget, effectiveApCostBySkill: { ...this._apBudget.effectiveApCostBySkill } };
	}

	makeSlotKey(side, part, index) {
		return `${side}:${part}:${index}`;
	}

	parseSlotKey(slotKey) {
		if (typeof slotKey !== 'string') return null;
		const m = slotKey.match(/^(self|enemy):([^:]+):(\d+)$/);
		if (!m) return null;
		return { side: m[1], part: m[2], index: Number(m[3]) };
	}

	_validateSlotKey(slotKey) {
		const parsed = this.parseSlotKey(slotKey);
		if (!parsed) return { ok: false, reason: 'Invalid slotKey format.' };
		const layout = this._getSlotLayout ? this._getSlotLayout() : null;
		if (!layout || !layout.slotCounts) return { ok: false, reason: 'Slot layout not available.' };
		const cap = Number(layout.slotCounts?.[parsed.part]?.[parsed.side] ?? 0);
		if (!Number.isFinite(cap) || cap <= 0) return { ok: false, reason: `No slot capacity for ${parsed.side}:${parsed.part}.` };
		if (parsed.index < 0 || parsed.index >= cap) return { ok: false, reason: `Slot index out of range for ${parsed.side}:${parsed.part} (cap ${cap}).` };
		return { ok: true, parsed };
	}

   _getSkillMaxPlacements(skillConfig, draft) {
        let n = 1;

		// Source of truth: target.selection.selectCount
		const sel = skillConfig?.target?.selection;
		const sc = Number(sel?.selectCount);
		if (Number.isFinite(sc) && sc > 0) n = Math.floor(sc);

		// Draft may include explicit selectedParts list; cap by its length when present.
		const parts = Array.isArray(draft?.selectionResult?.selectedParts) ? draft.selectionResult.selectedParts : null;
		if (parts && parts.length > 0) n = Math.min(n, parts.length);

		return n;
	}

	_rebuildSkillViews() {
		this.plannedBySkill = Object.create(null);
		this.skillToSlots = Object.create(null);
		for (const id of this.order) {
			const a = this.actionsById[id];
			if (!a || !a.skillId) continue;
			this.plannedBySkill[a.skillId] = a;
			if (!this.skillToSlots[a.skillId]) this.skillToSlots[a.skillId] = [];
			if (a.slotKey) this.skillToSlots[a.skillId].push(a.slotKey);
		}
	}

	_getActionCountForSkill(skillId) {
		return Number(this.skillCounts?.[skillId] ?? 0) || 0;
	}

	_findLastActionIdForSkill(skillId) {
		for (let i = this.order.length - 1; i >= 0; i--) {
			const id = this.order[i];
			const a = this.actionsById[id];
			if (a && a.skillId === skillId) return id;
		}
		return null;
	}

	_assignInternal(slotKey, action) {
		const actionId = `a_${this._nextId++}`;
		action.actionId = actionId;
		action.slotKey = slotKey;
		this.actionsById[actionId] = action;
		this.assigned[slotKey] = actionId;
		this.order.push(actionId);
		this.skillCounts[action.skillId] = this._getActionCountForSkill(action.skillId) + 1;
        this._rebuildSkillViews();
		return actionId;
	}

	unassign(slotKey) {
		const v = this._validateSlotKey(slotKey);
		if (!v.ok) return { ok: false, reason: v.reason };
		const actionId = this.assigned[slotKey];
		if (!actionId) return { ok: true, removed: false };
		const action = this.actionsById[actionId];
		delete this.assigned[slotKey];
		delete this.actionsById[actionId];
		this.order = this.order.filter(id => id !== actionId);
		if (action && action.skillId) {
			this.skillCounts[action.skillId] = Math.max(0, this._getActionCountForSkill(action.skillId) - 1);
		}
       this._rebuildSkillViews();
		return { ok: true, removed: true, actionId };
	}

	assign({ slotKey, skillId, targetId, bodyPart, cost, speed, replaceIfAlreadyPlaced }) {
		const v = this._validateSlotKey(slotKey);
		if (!v.ok) return { ok: false, reason: v.reason };
		if (this.assigned[slotKey]) return { ok: false, reason: 'Slot already occupied.' };
		const skillCfg = this._getSkillConfig ? this._getSkillConfig(skillId) : null;
		if (!skillCfg) return { ok: false, reason: `Unknown skill: ${skillId}` };

		const maxPlacements = this._getSkillMaxPlacements(skillCfg);
       const placed = this._getActionCountForSkill(skillId);

		// Single-placement skill: support "replace" semantics by auto-unassigning the previous slot.
		// This must happen BEFORE the max placement guard, otherwise placing into a new slot is blocked.
		if (replaceIfAlreadyPlaced && maxPlacements === 1 && placed >= 1) {
			const prevId = this._findLastActionIdForSkill(skillId);
			if (prevId) {
				const prevAction = this.actionsById[prevId];
				if (prevAction && prevAction.slotKey) this.unassign(prevAction.slotKey);
			}
		}

		const placedAfterReplace = this._getActionCountForSkill(skillId);
		if (placedAfterReplace >= maxPlacements) return { ok: false, reason: `Reached max placements for skill (${maxPlacements}).` };

		const currentAp = this._getCurrentAp ? this._getCurrentAp() : null;
		const usedAp = this._getUsedAp ? this._getUsedAp() : 0;
		if (typeof currentAp === 'number' && typeof cost === 'number' && currentAp < usedAp + cost) {
			return { ok: false, reason: 'Not enough AP.' };
		}

		const action = {
			source: 'PLAYER',
			sourceId: this._getPlayerId ? this._getPlayerId() : null,
			skillId,
			targetId,
			bodyPart,
			cost,
			speed,
			meta: { side: v.parsed.side, part: v.parsed.part, slotIndex: v.parsed.index }
		};

		const actionId = this._assignInternal(slotKey, action);
		return { ok: true, actionId };
	}

	planMany({ planningDraftBySkill, replace = true }) {
		const draftRoot = planningDraftBySkill && typeof planningDraftBySkill === 'object'
			? planningDraftBySkill
			: null;
		if (!draftRoot) return { ok: true, placed: 0, errors: [] };

		// Hard guard: AP budget must be initialized and within budget at commit time.
		if (this._apBudget.phase === 'AP_BUDGET_UNINITIALIZED') {
			return { ok: false, placed: 0, errors: [{ reason: 'AP budget not initialized (call enterPlanning first).' }] };
		}
		const apRes = this.recalcApBudgetForDraft({ planningDraftBySkill: draftRoot });
		if (!apRes.ok) {
			return { ok: false, placed: 0, errors: [{ reason: apRes.reason || 'AP budget calculation failed.' }] };
		}
		if (!this._apBudget.ok) {
			return {
				ok: false,
				placed: 0,
				errors: [{ reason: `Not enough AP (plannedCost=${this._apBudget.plannedCost}, availableAp=${this._apBudget.availableAp}).` }]
			};
		}

		const errors = [];
		let placed = 0;

		for (const [skillId, draft] of Object.entries(draftRoot)) {
			const skillCfg = this._getSkillConfig ? this._getSkillConfig(skillId) : null;
			if (!skillCfg) {
				errors.push({ skillId, reason: `Unknown skill: ${skillId}` });
				continue;
			}

			const slotKeys = Array.isArray(draft?.placedSlots) ? draft.placedSlots : [];
			if (slotKeys.length === 0) continue;

			if (replace) {
				const prevSlots = this.skillToSlots?.[skillId] || [];
				for (const sk of prevSlots) this.unassign(sk);
			}

			const maxPlacements = this._getSkillMaxPlacements(skillCfg, draft);
			const take = slotKeys.slice(0, maxPlacements);

			for (const slotKey of take) {
				const v = this._validateSlotKey(slotKey);
				if (!v.ok) {
					errors.push({ skillId, slotKey, reason: v.reason });
					continue;
				}
				if (this.assigned[slotKey]) {
					errors.push({ skillId, slotKey, reason: 'Slot already occupied.' });
					continue;
				}

				const cost = Number(draft?.cost ?? skillCfg?.cost ?? 0) || 0;
				const speed = Number(draft?.speed ?? skillCfg?.speed ?? 0) || 0;
				const action = {
					source: 'PLAYER',
					sourceId: this._getPlayerId ? this._getPlayerId() : null,
					skillId,
					targetId: draft?.targetId,
					bodyPart: v.parsed.part,
					cost,
					speed,
					selectionResult: {
						...(draft?.selectionResult || {}),
						selectedParts: Array.isArray(draft?.selectionResult?.selectedParts)
							? [...draft.selectionResult.selectedParts]
							: [v.parsed.part]
					},
					meta: { side: v.parsed.side, part: v.parsed.part, slotIndex: v.parsed.index }
				};

				const currentAp = this._getCurrentAp ? this._getCurrentAp() : null;
				const usedAp = this._getUsedAp ? this._getUsedAp() : 0;
				if (typeof currentAp === 'number' && currentAp < usedAp + cost) {
					errors.push({ skillId, slotKey, reason: 'Not enough AP.' });
					continue;
				}

				this._assignInternal(slotKey, action);
				placed++;
			}
		}

		return { ok: errors.length === 0, placed, errors };
	}

	getPlannedActions() {
		return this.order.map(id => this.actionsById[id]).filter(Boolean);
	}
}
