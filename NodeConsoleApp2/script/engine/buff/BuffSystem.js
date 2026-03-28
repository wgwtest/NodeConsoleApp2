export default class BuffSystem {
	constructor(eventBus, registry) {
		this.eventBus = eventBus;
		this.registry = registry;
		this._subscriptions = [];
		this._managers = new Set();

		this._actionLibrary = {
			damage: (ctx, effect) => this._act_damage(ctx, effect),
			DAMAGE_HP: (ctx, effect) => this._act_damage(ctx, effect),
			heal: (ctx, effect) => this._act_heal(ctx, effect),
			HEAL_HP: (ctx, effect) => this._act_heal(ctx, effect),
			HEAL_ARMOR: (ctx, effect) => this._act_healArmor(ctx, effect),
			applyBuff: (ctx, effect) => this._act_applyBuff(ctx, effect),
			APPLY_BUFF: (ctx, effect) => this._act_applyBuff(ctx, effect),
			skipTurn: (ctx, effect) => this._act_skipTurn(ctx, effect),
			SKIP_TURN: (ctx, effect) => this._act_skipTurn(ctx, effect),
			modifyAP: (ctx, effect) => this._act_modifyAP(ctx, effect),
			MODIFY_AP: (ctx, effect) => this._act_modifyAP(ctx, effect),
			absorbDamage: (ctx, effect) => this._act_absorbDamage(ctx, effect),
			modifyDamageTaken: (ctx, effect) => this._act_modifyDamageTaken(ctx, effect),
			setDamageTaken: (ctx, effect) => this._act_setDamageTaken(ctx, effect),
			attack: (ctx, effect) => this._act_attack(ctx, effect),
			ATTACK: (ctx, effect) => this._act_attack(ctx, effect),
			absorbToHeal: (ctx, effect) => this._act_absorbToHeal(ctx, effect),
			revive: (ctx, effect) => this._act_revive(ctx, effect),
			REMOVE_SELF: (ctx, effect) => this._act_removeSelf(ctx, effect),
			MODIFY_STAT_TEMP: (ctx, effect) => this._act_modifyStatTemp(ctx, effect),
			PREVENT_DAMAGE_HP: (ctx, effect) => this._act_preventDamageHp(ctx, effect),
			PREVENT_DAMAGE_ARMOR: (ctx, effect) => this._act_preventDamageArmor(ctx, effect),
			AP_COST_ADD: (ctx, effect) => this._act_modifyApCost(ctx, effect, 1),
			AP_COST_REDUCE: (ctx, effect) => this._act_modifyApCost(ctx, effect, -1)
		};
	}

	registerManager(buffManager) {
		if (!buffManager) return;
		this._managers.add(buffManager);
	}

	unregisterManager(buffManager) {
		this._managers.delete(buffManager);
	}

	start() {
		// 兼容当前引擎事件
		this._subscribe('TURN_START', this._onTurnStart.bind(this));
		this._subscribe('TURN_END', this._onTurnEnd.bind(this));
		this._subscribe('BATTLE_ATTACK_PRE', this._onAttackPre.bind(this));
		this._subscribe('BATTLE_ATTACK_POST', this._onAttackPost.bind(this));
		this._subscribe('BATTLE_TAKE_DAMAGE_PRE', this._onTakeDamagePre.bind(this));
		this._subscribe('BATTLE_TAKE_DAMAGE', this._onTakeDamage.bind(this));
		this._subscribe('BATTLE_DEFEND_POST', this._onDefendPost.bind(this));
		// Buff Editor / 测试器专用：行动尝试入口
		this._subscribe('BATTLE_ACTION_PRE', this._onActionPre.bind(this));
	}

	stop() {
		for (const unsub of this._subscriptions) {
			try { unsub(); } catch { /* noop */ }
		}
		this._subscriptions = [];
	}

	_subscribe(eventName, handler) {
		if (!this.eventBus?.on) return;
		const unsub = this.eventBus.on(eventName, handler);
		if (typeof unsub === 'function') this._subscriptions.push(unsub);
	}

	_onTurnStart(payload) {
		this._dispatchToAll('onTurnStart', { payload });
	}

	_onTurnEnd(payload) {
		this._dispatchToAll('onTurnEnd', { payload });
		for (const m of this._managers) m.tickTurn();
	}

	_onAttackPre(context) {
		// context: { attacker/target/... }（按 buff_design.md 的 pipeline 思路）
		this._dispatchToParticipants('onAttackPre', context);
	}

	_onAttackPost(context) {
		this._dispatchToParticipants('onAttackPost', context);
	}

	_onTakeDamagePre(context) {
		this._applyStatModifiersToContext(context);
		this._dispatchToParticipants('onTakeDamagePre', context);
	}

	_applyStatModifiersToContext(context) {
		if (!context || typeof context !== 'object') return;
		const attacker = context.attacker || context.source;
		const target = context.target;

		// attacker: damageDealtMult 													
		if (attacker?.buffs?.getEffectiveStat) {
			const dealtMult = attacker.buffs.getEffectiveStat('damageDealtMult', 0);
			if (Number.isFinite(dealtMult) && dealtMult !== 0) {
				context.damageDealtMult = (context.damageDealtMult || 0) + dealtMult;
			}
		}

		// target: damageTakenMult
		if (target?.buffs?.getEffectiveStat) {
			const takenMult = target.buffs.getEffectiveStat('damageTakenMult', 0);
			if (Number.isFinite(takenMult) && takenMult !== 0) {
				const base = (context.damageTakenMult || 1);
				context.damageTakenMult = base * (1 + takenMult);
			}
		}
	}

	_onTakeDamage(context) {
		this._dispatchToParticipants('onTakeDamage', context);
	}

	_onDefendPost(context) {
		this._dispatchToParticipants('onDefendPost', context);
	}

	_onActionPre(context) {
		this._dispatchToParticipants('onActionPre', context);
	}

	_dispatchToAll(triggerName, baseContext) {
		for (const m of this._managers) {
			this._processManager(m, triggerName, baseContext);
		}
	}

	_dispatchToParticipants(triggerName, context) {
		const attacker = context?.attacker || context?.source;
		const target = context?.target;

		for (const m of this._managers) {
			const owner = m.owner;
			if (owner && ((attacker && owner === attacker) || (target && owner === target))) {
				// Battle hooks intentionally share one mutable context object.
				// PREVENT_DAMAGE_* / shield / temp modifier effects need to write
				// back into the live damage pipeline rather than an isolated copy.
				this._processManager(m, triggerName, context);
			}
		}
	}

	_processManager(manager, triggerName, context) {
		const buffs = manager.getAll();
		for (const b of buffs) {
			const effects = b.definition?.effects;
			if (!Array.isArray(effects)) continue;

			for (const effect of effects) {
				if (!effect || effect.trigger !== triggerName) continue;
				const normalizedEffect = this._normalizeEffect(effect);

				const actionKey = normalizedEffect.action;
				const fn = this._actionLibrary[actionKey];
				if (!fn) {
					this.eventBus?.emit?.('BUFF:WARN', { ownerId: manager.ownerId, buffId: b.id, reason: 'action_not_supported', action: actionKey, trigger: triggerName });
					continue;
				}

				try {
					fn({ manager, buff: b, context }, normalizedEffect);
				} catch (err) {
					this.eventBus?.emit?.('BUFF:ERROR', { ownerId: manager.ownerId, buffId: b.id, trigger: triggerName, action: actionKey, error: String(err?.message || err) });
				}
			}
		}
	}

	_normalizeEffect(effect) {
		const payload = (effect && effect.payload && typeof effect.payload === 'object') ? effect.payload : {};
		return {
			...effect,
			value: Object.prototype.hasOwnProperty.call(payload, 'value') ? payload.value : effect.value,
			valueType: payload.valueType ?? effect.valueType,
			reason: payload.reason ?? effect.reason,
			params: effect.params ?? payload.params ?? payload
		};
	}

	_resolveTarget({ manager, context }, effectTarget) {
		if (effectTarget === 'self') return manager.owner;
		if (effectTarget === 'attacker') return context?.attacker || context?.source;
		if (effectTarget === 'target') return context?.target;
		return manager.owner;
	}

	_resolveValue(ctx, effect) {
		const v = effect.value;
		if (typeof v === 'number') return v;
		if (typeof v !== 'string') return 0;

		// 支持最小公式：允许引用 context / self.stats 等
		// 例如: "damageDealt * 0.2" / "maxHp * 0.05"
		const target = this._resolveTarget(ctx, effect.target);
		const self = ctx.manager.owner;
		const context = ctx.context || {};

		const scope = {
			context,
			self,
			target,
			// 兼容 buffs.json 里已有字段名
			damageDealt: context.damageDealt,
			damageTaken: context.damageTaken,
			maxHp: (self?.stats?.maxHp ?? self?.maxHp),
			hp: (self?.stats?.hp ?? self?.hp),
			ap: (self?.stats?.ap ?? self?.ap)
		};

		try {
			const fn = new Function('s', `with (s) { return (${v}); }`);
			const out = fn(scope);
			return Number.isFinite(out) ? out : 0;
		} catch {
			return 0;
		}
	}

	_act_damage(ctx, effect) {
		const target = this._resolveTarget(ctx, effect.target);
		if (!target) return;
		const amount = this._resolveValue(ctx, effect);
		if (!Number.isFinite(amount) || amount <= 0) return;

		// 只做最小实现：直接扣 hp（不走护甲/部位），复杂逻辑留给 CombatSystem pipeline。
		if (target.stats) {
			target.stats.hp = Math.max(0, target.stats.hp - amount);
		} else if (typeof target.hp === 'number') {
			target.hp = Math.max(0, target.hp - amount);
		}

		this.eventBus?.emit?.('BATTLE_LOG', { text: `[Buff] ${ctx.buff.id} dealt ${amount} damage to ${target.id || 'target'}` });
	}

	_act_heal(ctx, effect) {
		const target = this._resolveTarget(ctx, effect.target);
		if (!target) return;
		const amount = this._resolveValue(ctx, effect);
		if (!Number.isFinite(amount) || amount <= 0) return;

		if (target.stats) {
			const maxHp = target.stats.maxHp ?? target.stats.hp;
			target.stats.hp = Math.min(maxHp, target.stats.hp + amount);
		} else if (typeof target.hp === 'number') {
			target.hp = target.hp + amount;
		}

		this.eventBus?.emit?.('BATTLE_LOG', { text: `[Buff] ${ctx.buff.id} healed ${amount} HP for ${target.id || 'target'}` });
	}

	_act_applyBuff(ctx, effect) {
		const target = this._resolveTarget(ctx, effect.target);
		if (!target?.buffs) return;
		const buffId = effect.value;
		if (!buffId) return;
		target.buffs.add(buffId);
	}

	_act_skipTurn(ctx) {
		// 用 context 打标，交由 FSM/战斗回合处理
		ctx.context.skipTurn = true;
		if (ctx.manager?.owner) {
			ctx.manager.owner._skipTurn = true;
		}
	}

	_act_modifyAP(ctx, effect) {
		const target = this._resolveTarget(ctx, effect.target);
		if (!target) return;
		const amount = this._resolveValue(ctx, effect);
		if (!Number.isFinite(amount) || amount === 0) return;
		if (target.stats && typeof target.stats.ap === 'number') {
			target.stats.ap += amount;
		}
	}

	_act_absorbDamage(ctx, effect) {
		// 最小实现：写入 context.shieldPool（由伤害管线消耗）
		const amount = this._resolveValue(ctx, effect);
		if (!Number.isFinite(amount) || amount <= 0) return;
		ctx.context.shieldPool = (ctx.context.shieldPool || 0) + amount;
	}

	_pickArmorPart(target, preferredPart = null) {
		if (!target?.bodyParts || typeof target.bodyParts !== 'object') return null;
		if (preferredPart && target.bodyParts[preferredPart]) return preferredPart;

		const damaged = Object.entries(target.bodyParts)
			.filter(([, part]) => Number(part?.max ?? 0) > 0)
			.sort((a, b) => {
				const dmgA = (Number(a[1]?.max ?? 0) || 0) - (Number(a[1]?.current ?? 0) || 0);
				const dmgB = (Number(b[1]?.max ?? 0) || 0) - (Number(b[1]?.current ?? 0) || 0);
				return dmgB - dmgA;
			});

		return damaged.length > 0 ? damaged[0][0] : null;
	}

	_act_healArmor(ctx, effect) {
		const target = this._resolveTarget(ctx, effect.target);
		if (!target?.bodyParts) return;
		const amount = this._resolveValue(ctx, effect);
		if (!Number.isFinite(amount) || amount <= 0) return;

		const preferredPart = effect?.params?.part || ctx.context?.bodyPart || ctx.context?.targetPart || null;
		const partKey = this._pickArmorPart(target, preferredPart);
		if (!partKey || !target.bodyParts[partKey]) return;

		const part = target.bodyParts[partKey];
		const max = Number(part.max ?? 0) || 0;
		const current = Number(part.current ?? 0) || 0;
		part.current = Math.min(max, current + amount);
		part.status = part.current > 0 ? 'NORMAL' : (part.status || 'NORMAL');
	}

	_act_modifyDamageTaken(ctx, effect) {
		// 最小实现：写入 context.damageTakenMult
		const mult = effect.value;
		if (!Number.isFinite(mult) || mult <= 0) return;
		ctx.context.damageTakenMult = (ctx.context.damageTakenMult || 1) * mult;
	}

	_act_attack(ctx, effect) {
		if (ctx?.context?.isReactionAttack) return;

		const source = ctx?.manager?.owner;
		const target = this._resolveTarget(ctx, effect.target);
		if (!source || !target || source === target) return;

		const explicitDamage = this._resolveValue(ctx, effect);
		const params = effect?.params || {};
		const multiplier = Number(params.multiplier ?? effect?.multiplier ?? 1) || 1;

		this.eventBus?.emit?.('BUFF_ATTACK_REQUEST', {
			source,
			target,
			bodyPart: params.part || ctx?.context?.bodyPart || ctx?.context?.targetPart || null,
			damage: Number.isFinite(explicitDamage) && explicitDamage > 0 ? explicitDamage : undefined,
			multiplier,
			buffId: ctx?.buff?.id || null,
			buffName: ctx?.buff?.definition?.name || ctx?.buff?.id || null,
			reason: 'BUFF_ATTACK',
			context: ctx?.context || {}
		});
	}

	_act_absorbToHeal() {
		// 需要伤害管线支持：把即将造成的伤害转为治疗。
	}

	_act_revive() {
		// 需要死亡/结算管线支持
	}

	_act_removeSelf(ctx) {
		ctx.manager.remove(ctx.buff.id, 'consume');
	}

	_act_modifyStatTemp(ctx, effect) {
		// 统一写入 context.tempModifiers[stat]，由战斗管线读取
		const p = effect.params;
		if (!p || !p.stat) return;

		if (!ctx.context.tempModifiers) ctx.context.tempModifiers = Object.create(null);

		// value 可以是字符串（"+0.3"）或数字
		let raw = p.value;
		let num = 0;
		if (typeof raw === 'number') num = raw;
		else if (typeof raw === 'string') num = Number(raw);
		if (!Number.isFinite(num)) num = 0;

		ctx.context.tempModifiers[p.stat] = ctx.context.tempModifiers[p.stat] || [];
		ctx.context.tempModifiers[p.stat].push({ value: num, type: p.type || 'flat' });
	}

	_act_preventDamageHp(ctx) {
		ctx.context.preventHpDamage = true;
	}

	_act_preventDamageArmor(ctx) {
		ctx.context.preventArmorDamage = true;
	}

	_act_modifyApCost(ctx, effect, direction) {
		const target = this._resolveTarget(ctx, effect.target);
		if (!target) return;
		const amount = this._resolveValue(ctx, effect);
		if (!Number.isFinite(amount) || amount === 0) return;
		const delta = amount * direction;
		target._planningApCostFlatDelta = (Number(target._planningApCostFlatDelta ?? 0) || 0) + delta;
	}
}
