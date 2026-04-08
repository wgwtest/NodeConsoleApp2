import { BattleAnimationDriver } from './BattleAnimationDriver.js';
import { FighterPresenter } from './FighterPresenter.js';

const TEMPLATE_ALIASES = Object.freeze({
    melee: 'melee',
    attack: 'melee',
    strike: 'melee',
    physical: 'melee',
    guard: 'guard',
    defend: 'guard',
    defense: 'guard',
    block: 'guard',
    parry: 'guard',
    heal: 'heal',
    recovery: 'heal',
    support_heal: 'heal',
    status: 'status',
    buff: 'status',
    debuff: 'status',
    support: 'status'
});

function readNumericStat(entity, key) {
    const direct = entity?.[key];
    if (direct !== undefined) return Number(direct) || 0;
    const nested = entity?.stats?.[key];
    if (nested !== undefined) return Number(nested) || 0;
    return 0;
}

function normalizeStatuses(source) {
    if (!source) return [];
    if (Array.isArray(source)) return source;
    if (typeof source.getAll === 'function') return source.getAll();
    if (typeof source === 'object') return Object.values(source);
    return [];
}

function partitionStatuses(buffStatuses, debuffStatuses) {
    const buffs = normalizeStatuses(buffStatuses);
    const explicitDebuffs = normalizeStatuses(debuffStatuses);

    if (explicitDebuffs.length > 0) {
        return { buffs, debuffs: explicitDebuffs };
    }

    const nextBuffs = [];
    const nextDebuffs = [];
    buffs.forEach(status => {
        const kind = status?.definition?.type || status?.type || 'buff';
        if (kind === 'debuff') {
            nextDebuffs.push(status);
        } else {
            nextBuffs.push(status);
        }
    });
    return { buffs: nextBuffs, debuffs: nextDebuffs };
}

function normalizeBodyParts(entity) {
    const source = entity?.bodyParts || entity?.armor || entity?.equipment?.armor;
    if (!source || typeof source !== 'object') return {};

    const output = {};
    for (const [partKey, raw] of Object.entries(source)) {
        if (!raw || typeof raw !== 'object') continue;
        output[partKey] = {
            current: Number(raw.current ?? raw.armor ?? raw.durability ?? 0) || 0,
            max: Number(raw.max ?? raw.maxArmor ?? raw.maxDurability ?? 0) || 0
        };
    }
    return output;
}

function normalizeCombatant(entity, fallbackId) {
    if (!entity || typeof entity !== 'object') return null;
    const { buffs, debuffs } = partitionStatuses(entity.buffs, entity.debuffs);
    return {
        id: entity.id || fallbackId,
        hp: readNumericStat(entity, 'hp'),
        maxHp: readNumericStat(entity, 'maxHp'),
        buffsCount: buffs.length,
        debuffsCount: debuffs.length,
        bodyParts: normalizeBodyParts(entity)
    };
}

function normalizeTemplateValue(rawTemplate) {
    const normalized = String(rawTemplate || '').trim().toLowerCase();
    if (!normalized) return 'default';
    return TEMPLATE_ALIASES[normalized] || 'default';
}

function resolveTemplateFromEntry(entry, payload) {
    if (!entry && !payload) return 'default';
    const candidates = [
        entry?.presentationTemplate,
        entry?.template,
        entry?.skillCategory,
        entry?.category,
        entry?.meta?.presentationTemplate,
        entry?.meta?.template,
        entry?.meta?.skillCategory,
        entry?.meta?.category,
        payload?.presentationTemplate,
        payload?.template,
        payload?.skillCategory,
        payload?.category
    ];
    for (const candidate of candidates) {
        const key = normalizeTemplateValue(candidate);
        if (key !== 'default') return key;
    }
    return 'default';
}

function resolveStatusKindFromEntry(entry, payload) {
    const candidates = [
        entry?.statusKind,
        entry?.meta?.statusKind,
        entry?.meta?.statusType,
        payload?.statusKind,
        payload?.statusType
    ];
    for (const candidate of candidates) {
        if (String(candidate || '').toLowerCase() === 'debuff') {
            return 'debuff';
        }
        if (String(candidate || '').toLowerCase() === 'buff') {
            return 'buff';
        }
    }
    return 'buff';
}

export class BattlePresentationController {
    constructor({ root = null, sceneRoot = null, eventBus = null, enabled = true } = {}) {
        this.root = root || sceneRoot?.closest?.('.battle-row') || null;
        this.sceneRoot = sceneRoot || this.root?.querySelector?.('.battle-scene') || this.root || null;
        this.eventBus = eventBus;
        this.enabled = enabled !== false;
        this.snapshots = { self: null, enemy: null };
        this.sideByEntityId = new Map();
        this._connected = false;
        this._unsubscribers = [];

        const fxLayer = this.sceneRoot?.querySelector?.('.fx-layer') || null;
        this.animationDriver = new BattleAnimationDriver({
            sceneRoot: this.sceneRoot,
            fxLayer,
            enabled: this.enabled
        });

        this.presenters = {
            self: new FighterPresenter({
                side: 'self',
                fighterRoot: this.sceneRoot?.querySelector?.('.fighter.player-character') || this.root?.querySelector?.('.fighter.player-character') || null,
                hudRoot: this.root?.querySelector?.('.player-hud') || null,
                animationDriver: this.animationDriver
            }),
            enemy: new FighterPresenter({
                side: 'enemy',
                fighterRoot: this.sceneRoot?.querySelector?.('.fighter.enemy-character') || this.root?.querySelector?.('.fighter.enemy-character') || null,
                hudRoot: this.root?.querySelector?.('.enemy-hud') || null,
                animationDriver: this.animationDriver
            })
        };

        if (this.sceneRoot) {
            this.sceneRoot.classList.add('is-presentation-ready');
            this.sceneRoot.dataset.presentationEnabled = this.enabled ? '1' : '0';
        }
    }

    _announceScenePulse(className) {
        if (!this.enabled) return;
        this.animationDriver?.pulseScene?.(className);
    }

    static resolveActionTemplate(entry, payload = null) {
        return resolveTemplateFromEntry(entry, payload);
    }

    setEnabled(enabled) {
        this.enabled = enabled !== false;
        this.animationDriver.setEnabled(this.enabled);
        if (!this.enabled) {
            this._clearTransientState();
        }
        if (this.sceneRoot) {
            this.sceneRoot.dataset.presentationEnabled = this.enabled ? '1' : '0';
        }
    }

    setEventBus(eventBus) {
        if (this.eventBus === eventBus) return;
        this.disconnect();
        this.eventBus = eventBus;
    }

    connect() {
        if (this._connected || !this.eventBus?.on) return;
        this._connected = true;
        this._unsubscribers = [
            this.eventBus.on('BATTLE_START', payload => this.handleBattleStart(payload)),
            this.eventBus.on('BATTLE_UPDATE', payload => this.handleBattleUpdate(payload)),
            this.eventBus.on('TURN_START', payload => this.handleTurnStart(payload)),
            this.eventBus.on('TIMELINE_ENTRY_START', payload => this.handleTimelineEntryStart(payload)),
            this.eventBus.on('TIMELINE_ENTRY_END', payload => this.handleTimelineEntryEnd(payload)),
            this.eventBus.on('BATTLE_TAKE_DAMAGE', payload => this.handleBattleTakeDamage(payload))
        ].filter(Boolean);
    }

    disconnect() {
        this._connected = false;
        this._unsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
        this._unsubscribers = [];
    }

    handleBattleStart(payload) {
        this._resetTracking();
        this._clearTransientState();
        const enemies = payload?.enemies || payload?.level?.enemies || [];
        this._syncPayload({
            player: payload?.player,
            enemies
        }, false);
    }

    handleBattleUpdate(payload) {
        this._syncPayload(payload, true);
    }

    handleTurnStart() {
        this._clearTransientState();
        for (const presenter of Object.values(this.presenters)) {
            presenter?.fighterRoot?.classList?.add('is-idle');
        }
        this._announceScenePulse('scene-turn-announce');
    }

    handleTimelineEntryStart(payload) {
        if (!this.enabled) return;
        const entry = payload?.entry;
        const side = entry?.side === 'enemy' ? 'enemy' : 'self';
        const template = BattlePresentationController.resolveActionTemplate(entry, payload);
        const statusKind = resolveStatusKindFromEntry(entry, payload);
        this.presenters[side]?.playTemplate(template, { entry, payload, statusKind });
        this.animationDriver?.pulseSceneTemplate?.(template, side);
        if (this.sceneRoot) {
            this.sceneRoot.dataset.lastTemplate = template;
            this.sceneRoot.dataset.lastTemplateSide = side;
        }
    }

    handleTimelineEntryEnd(_payload) {
        // Transient classes self-clear on timer; no blocking cleanup needed here.
    }

    handleBattleTakeDamage(payload) {
        if (!this.enabled) return;
        const side = this._resolveSide(payload?.target, payload?.target?.id);
        if (!side) return;

        const presenter = this.presenters[side];
        const template = BattlePresentationController.resolveActionTemplate(payload?.entry, payload);
        const damage = Number(payload?.damageDealt ?? payload?.damage ?? 0) || 0;
        const armorDamage = Number(payload?.armorDamage ?? 0) || 0;
        const armorPart = payload?.targetPart || payload?.bodyPart || null;
        const blocked = payload?.isBlocked === true
            || payload?.result === 'blocked'
            || (template === 'guard' && damage <= 0);

        if (blocked) {
            presenter?.playTemplate('guard', {
                armorPart,
                text: payload?.blockText || '格挡',
                showFloatText: true
            });
            this.animationDriver?.pulseSceneTemplate?.('guard', side);
            if (this.sceneRoot) {
                this.sceneRoot.dataset.lastTemplate = 'guard';
                this.sceneRoot.dataset.lastTemplateSide = side;
            }
            return;
        }

        presenter?.playHit({ armorPart, damage, armorDamage });

        if (damage > 0) {
            presenter?.showFloatText(`-${damage}`, 'damage');
        }

        if (armorDamage > 0) {
            presenter?.showFloatText(`护甲 -${armorDamage}`, 'armor');
            presenter?.pulseArmor(armorPart, 'hit');
        }
        this.animationDriver?.pulseSceneTemplate?.('guard', side);
    }

    _syncPayload(payload, animateDiff) {
        if (!payload) return;

        const player = payload.player || null;
        const enemy = Array.isArray(payload.enemies) && payload.enemies.length > 0
            ? payload.enemies[0]
            : null;

        this._syncEntity('self', player, animateDiff);
        this._syncEntity('enemy', enemy, animateDiff);
    }

    _syncEntity(side, entity, animateDiff) {
        const next = normalizeCombatant(entity, side === 'self' ? 'player' : 'enemy');
        if (!next) return;

        this.sideByEntityId.set(next.id, side);
        const prev = this.snapshots[side];
        if (animateDiff && prev) {
            const hpDelta = next.hp - prev.hp;
            if (hpDelta > 0) {
                this.presenters[side]?.playTemplate('heal', { amount: hpDelta });
                this.animationDriver?.pulseSceneTemplate?.('heal', side);
            }

            if (next.buffsCount > prev.buffsCount) {
                this.presenters[side]?.playTemplate('status', { statusKind: 'buff' });
                this.animationDriver?.pulseSceneTemplate?.('status', side);
            }

            if (next.debuffsCount > prev.debuffsCount) {
                this.presenters[side]?.playTemplate('status', { statusKind: 'debuff' });
                this.animationDriver?.pulseSceneTemplate?.('status', side);
            }

            for (const [partKey, partState] of Object.entries(next.bodyParts || {})) {
                const prevState = prev.bodyParts?.[partKey];
                const delta = Number(partState?.current ?? 0) - Number(prevState?.current ?? 0);
                if (delta > 0) {
                    this.presenters[side]?.pulseArmor(partKey, 'heal');
                }
            }
        }

        this.presenters[side]?.syncVisualState(next);
        this.snapshots[side] = next;
    }

    _resetTracking() {
        this.snapshots = { self: null, enemy: null };
        this.sideByEntityId.clear();
    }

    _clearTransientState() {
        for (const presenter of Object.values(this.presenters)) {
            presenter?.clearTransientState();
        }
        this.animationDriver.clearFloatTexts();
    }

    _resolveSide(entity, explicitId = null) {
        const entityId = explicitId || entity?.id || null;
        if (entityId && this.sideByEntityId.has(entityId)) {
            return this.sideByEntityId.get(entityId);
        }
        if (entityId === 'player') return 'self';
        return entityId ? 'enemy' : null;
    }
}
