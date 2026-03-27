import Buff from './Buff.js';

export default class BuffManager {
	constructor(owner, registry, eventBus, options = {}) {
		this.owner = owner;
		this.registry = registry;
		this.eventBus = eventBus;
		this.ownerId = owner && owner.id ? owner.id : (options.ownerId || null);

		this._buffs = [];
		this._byId = new Map();
		this._dirty = true;
		this._cachedModifierTotals = Object.create(null);
	}

	getAll() {
		return this._buffs.slice();
	}

	has(buffId) {
		return this._byId.has(buffId);
	}

	getStacks(buffId) {
		const b = this._byId.get(buffId);
		return b ? b.stacks : 0;
	}

	add(buffId, options = {}) {
		const def = this.registry.getDefinition(buffId, options);
		if (!def) {
			this.eventBus?.emit?.('BUFF:WARN', { ownerId: this.ownerId, buffId, reason: 'definition_not_found' });
			return null;
		}

		const existing = this._byId.get(buffId);
		if (existing) {
			this._applyStack(existing, def, options);
			this._dirty = true;
			this.eventBus?.emit?.('BUFF:ADDED', { ownerId: this.ownerId, buffId, stacks: existing.stacks, remaining: existing.remaining, isRefresh: true });
			return existing;
		}

		const inst = new Buff(def, { ...options, ownerId: this.ownerId });
		this._buffs.push(inst);
		this._byId.set(buffId, inst);
		this._dirty = true;
		this.eventBus?.emit?.('BUFF:ADDED', { ownerId: this.ownerId, buffId, stacks: inst.stacks, remaining: inst.remaining });
		return inst;
	}

	remove(buffId, reason = 'manual') {
		const b = this._byId.get(buffId);
		if (!b) return false;

		this._byId.delete(buffId);
		const idx = this._buffs.indexOf(b);
		if (idx >= 0) this._buffs.splice(idx, 1);
		this._dirty = true;
		this.eventBus?.emit?.('BUFF:REMOVED', { ownerId: this.ownerId, buffId, reason });
		return true;
	}

	removeByTag(tag, reason = 'removeByTag') {
		const toRemove = this._buffs.filter(b => b.tags && b.tags.includes(tag)).map(b => b.id);
		toRemove.forEach(id => this.remove(id, reason));
		return toRemove.length;
	}

	removeByType(type, reason = 'removeByType') {
		const toRemove = this._buffs.filter(b => (b.definition?.type || b.type) === type).map(b => b.id);
		toRemove.forEach(id => this.remove(id, reason));
		return toRemove.length;
	}

	tickTurn() {
		for (const b of this._buffs) {
			b.tick();
		}
		const expired = this._buffs.filter(b => b.isExpired());
		for (const b of expired) {
			this.remove(b.id, 'expired');
		}
		if (expired.length > 0) this._dirty = true;
		return expired.map(b => b.id);
	}

	getEffectiveStat(statKey, baseValue = 0) {
		const totals = this._getModifierTotals();
		const mod = totals[statKey];
		if (!mod) return baseValue;

		// 先 flat 再 percent（保持与 buff_design.md 一致）
		const flat = mod.flat || 0;
		const percent = mod.percent || 0;
		const overwrite = (mod.overwrite !== undefined) ? mod.overwrite : undefined;

		if (overwrite !== undefined) return overwrite;

		return (baseValue + flat) * (1 + percent);
	}

	_getModifierTotals() {
		if (!this._dirty) return this._cachedModifierTotals;

		const totals = Object.create(null);
		for (const b of this._buffs) {
			const mods = b.definition?.statModifiers;
			if (!mods) continue;

			const entries = Array.isArray(mods)
				? mods
					.filter(Boolean)
					.map(m => [m.stat, m])
					.filter(entry => !!entry[0])
				: Object.entries(mods);

			for (const [stat, m] of entries) {
				if (!totals[stat]) {
					totals[stat] = { flat: 0, percent: 0, overwrite: undefined };
				}

				const type = m?.type;
				const value = Number(m?.value);
				if (!Number.isFinite(value) && type !== 'overwrite') continue;

				if (type === 'flat') {
					totals[stat].flat += (value * b.stacks);
				} else if (type === 'percent' || type === 'percent_base') {
					totals[stat].percent += (value * b.stacks);
				} else if (type === 'overwrite') {
					totals[stat].overwrite = m?.value;
				} else {
					this.eventBus?.emit?.('BUFF:WARN', {
						ownerId: this.ownerId,
						buffId: b.id,
						statKey: stat,
						type,
						value,
						reason: 'statModifier_type_not_supported'
					});
				}
			}
		}

		this._cachedModifierTotals = totals;
		this._dirty = false;
		return totals;
	}

	_applyStack(existing, def, options) {
		const lc = def.lifecycle || {};
		const strategy = options.stackStrategy || existing.stackStrategy || lc.stackStrategy || 'refresh';
		const maxStacks = (options.maxStacks !== undefined) ? options.maxStacks : (existing.maxStacks || lc.maxStacks || 1);
		const addStacks = options.stacks || 1;

		if (strategy === 'add') {
			existing.stacks = Math.min(maxStacks, existing.stacks + addStacks);
			// add 通常也刷新持续时间（可按需要改为 extend）
			if (!existing.isPermanent()) {
				existing.remaining = (lc.duration !== undefined) ? lc.duration : existing.duration;
			}
			return;
		}

		if (strategy === 'extend') {
			if (!existing.isPermanent()) {
				existing.remaining += ((options.extendBy !== undefined) ? options.extendBy : 1);
			}
			return;
		}

		if (strategy === 'replace') {
			// replace: 重置层数与持续时间
			existing.stacks = Math.min(maxStacks, addStacks);
			if (!existing.isPermanent()) {
				existing.remaining = (lc.duration !== undefined) ? lc.duration : existing.duration;
			}
			return;
		}

		// refresh: 保持层数不变，刷新持续时间
		if (!existing.isPermanent()) {
			existing.remaining = (lc.duration !== undefined) ? lc.duration : existing.duration;
		}
	}

	toJSON() {
		return this._buffs.map(b => ({
			id: b.id,
			remaining: b.remaining,
			stacks: b.stacks
		}));
	}

	fromJSON(buffList) {
		this._buffs = [];
		this._byId.clear();
		this._dirty = true;

		if (!Array.isArray(buffList)) return;

		for (const entry of buffList) {
			if (!entry || !entry.id) continue;
			const def = this.registry.getDefinition(entry.id);
			if (!def) continue;
			const b = new Buff(def, { ownerId: this.ownerId, stacks: entry.stacks || 1 });
			b.remaining = (entry.remaining !== undefined) ? entry.remaining : b.remaining;
			this._buffs.push(b);
			this._byId.set(b.id, b);
		}
	}
}
