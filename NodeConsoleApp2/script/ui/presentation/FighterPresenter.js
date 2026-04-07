import { BattleAnimationDriver } from './BattleAnimationDriver.js';

function findStatusRow(root, expectedLabel, fallbackIndex) {
    if (!root) return null;

    const rows = Array.from(root.querySelectorAll('.status-row'));
    const matched = rows.find(row => {
        const label = row.querySelector('.status-label')?.textContent?.trim()?.toUpperCase?.();
        return label === expectedLabel;
    });

    if (matched) return matched;
    return rows[fallbackIndex] || null;
}

export class FighterPresenter {
    constructor({ side, fighterRoot = null, hudRoot = null, animationDriver = null } = {}) {
        this.side = side === 'enemy' ? 'enemy' : 'self';
        this.sideClass = this.side === 'enemy' ? 'enemy' : 'self';
        this.fighterRoot = fighterRoot;
        this.hudRoot = hudRoot;
        this.animationDriver = animationDriver instanceof BattleAnimationDriver
            ? animationDriver
            : new BattleAnimationDriver();

        this.spriteContainer = fighterRoot?.querySelector('.character-sprite-container') || fighterRoot || null;
        this.shadow = fighterRoot?.querySelector('.character-shadow') || null;
        this.effectAnchor = fighterRoot?.querySelector('.effect-anchor') || fighterRoot || null;
        this.hpBar = hudRoot?.querySelector('.bar.hp span') || null;
        this.buffRow = findStatusRow(hudRoot, 'BUFF', 0);
        this.debuffRow = findStatusRow(hudRoot, 'DEBUFF', 1);
        this.armorRows = new Map(
            Array.from(hudRoot?.querySelectorAll('.armor-row[data-key]') || [])
                .map(row => [row.dataset.key, row])
        );
    }

    syncVisualState(snapshot) {
        if (!snapshot) return;
        this._syncHp(snapshot);
        this._syncArmor(snapshot.bodyParts);
        if (this.fighterRoot) {
            this.fighterRoot.classList.add('is-idle');
        }
    }

    playAction() {
        this.animationDriver.pulseClass(this.fighterRoot, 'is-acting', 420);
        this.animationDriver.pulseClass(this.spriteContainer, 'is-striking', 420);
        this.animationDriver.pulseClass(this.shadow, 'is-shadow-surge', 420);
    }

    playHit({ armorPart = null, damage = 0, armorDamage = 0 } = {}) {
        if (!damage && !armorDamage) return;
        this.animationDriver.pulseClass(this.fighterRoot, 'is-hit', 420);
        this.animationDriver.pulseClass(this.spriteContainer, 'is-hit-flash', 420);
        if (armorPart) {
            this.pulseArmor(armorPart, 'hit');
        }
    }

    playHeal() {
        this.animationDriver.pulseClass(this.fighterRoot, 'is-heal', 460);
        this.animationDriver.pulseClass(this.spriteContainer, 'is-heal-glow', 460);
    }

    pulseStatus(kind = 'buff') {
        const row = kind === 'debuff' ? this.debuffRow : this.buffRow;
        const className = kind === 'debuff' ? 'is-debuff-pulse' : 'is-buff-pulse';
        this.animationDriver.pulseClass(row, className, 560);
    }

    pulseArmor(partKey, mode = 'hit') {
        const row = this.armorRows.get(partKey);
        const className = mode === 'heal' ? 'is-armor-heal' : 'is-armor-hit';
        this.animationDriver.pulseClass(row, className, 560);
    }

    showFloatText(text, kind = 'damage') {
        return this.animationDriver.createFloatText({
            text,
            kind,
            side: this.sideClass,
            anchorEl: this.effectAnchor
        });
    }

    clearTransientState() {
        this.fighterRoot?.classList?.remove('is-acting', 'is-hit', 'is-heal');
        this.spriteContainer?.classList?.remove('is-striking', 'is-hit-flash', 'is-heal-glow');
        this.shadow?.classList?.remove('is-shadow-surge');
        this.buffRow?.classList?.remove('is-buff-pulse');
        this.debuffRow?.classList?.remove('is-debuff-pulse');
        for (const row of this.armorRows.values()) {
            row?.classList?.remove('is-armor-hit', 'is-armor-heal');
        }
    }

    _syncHp(snapshot) {
        if (!this.hpBar) return;
        const hp = Number(snapshot.hp ?? 0) || 0;
        const maxHp = Number(snapshot.maxHp ?? 0) || 0;
        const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
        this.hpBar.style.width = `${pct}%`;
        this.hpBar.dataset.hp = String(hp);
        this.hpBar.dataset.maxHp = String(maxHp);
    }

    _syncArmor(bodyParts) {
        if (!bodyParts || typeof bodyParts !== 'object') return;

        for (const [partKey, row] of this.armorRows.entries()) {
            const data = bodyParts[partKey];
            if (!data || typeof data !== 'object') continue;

            const current = Number(data.current ?? data.armor ?? data.durability ?? 0) || 0;
            const max = Number(data.max ?? data.maxArmor ?? data.maxDurability ?? 0) || 0;
            const bar = row.querySelector('.armor-bar span');
            if (bar) {
                const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
                bar.style.width = `${pct}%`;
                bar.dataset.current = String(current);
                bar.dataset.max = String(max);
            }
        }
    }
}
