export class BattleAnimationDriver {
    constructor({ sceneRoot = null, fxLayer = null, enabled = true } = {}) {
        this.sceneRoot = sceneRoot;
        this.fxLayer = fxLayer || sceneRoot?.querySelector?.('.fx-layer') || null;
        this.enabled = enabled !== false;
        this._timers = new WeakMap();
    }

    setEnabled(enabled) {
        this.enabled = enabled !== false;
    }

    pulseClass(node, className, durationMs = 420) {
        if (!this.enabled || !node || !className) return;

        node.classList.remove(className);
        void node.offsetWidth;
        node.classList.add(className);

        let classTimers = this._timers.get(node);
        if (!classTimers) {
            classTimers = new Map();
            this._timers.set(node, classTimers);
        }

        const prevTimer = classTimers.get(className);
        if (prevTimer) {
            clearTimeout(prevTimer);
        }

        const timer = setTimeout(() => {
            node.classList.remove(className);
            classTimers.delete(className);
        }, durationMs);

        classTimers.set(className, timer);
    }

    pulseScene(className, durationMs = 520) {
        if (!this.enabled || !this.sceneRoot || !className) return;
        this.pulseClass(this.sceneRoot, className, durationMs);
    }

    pulseSceneTemplate(template = 'default', side = 'self', durationMs = 520) {
        if (!this.enabled) return;
        const normalizedTemplate = this._normalizeTemplate(template);
        const normalizedSide = this._normalizeSide(side);

        if (normalizedTemplate === 'melee' || normalizedTemplate === 'default') {
            this.pulseScene(normalizedSide === 'enemy' ? 'scene-beat-enemy' : 'scene-beat-self', durationMs);
            return;
        }

        if (normalizedTemplate === 'guard') {
            this.pulseScene('scene-impact', durationMs);
            return;
        }

        if (normalizedTemplate === 'heal' || normalizedTemplate === 'status') {
            this.pulseScene('scene-turn-announce', durationMs);
            return;
        }

        this.pulseScene(normalizedSide === 'enemy' ? 'scene-beat-enemy' : 'scene-beat-self', durationMs);
    }

    pulseSceneDirective(scenePulse = null, side = 'self', durationMs = 520) {
        const normalizedSide = this._normalizeSide(side);
        const normalizedPulse = String(scenePulse || '').trim().toLowerCase();

        if (
            normalizedPulse === 'enemy-beat'
            || normalizedPulse === 'enemy_beat'
            || normalizedPulse === 'enemy'
        ) {
            this.pulseScene('scene-beat-enemy', durationMs);
            return;
        }

        if (
            normalizedPulse === 'impact'
            || normalizedPulse === 'guard'
            || normalizedPulse === 'scene-impact'
        ) {
            this.pulseScene('scene-impact', durationMs);
            return;
        }

        if (
            normalizedPulse === 'turn-announce'
            || normalizedPulse === 'turn_announce'
            || normalizedPulse === 'turn'
            || normalizedPulse === 'heal'
            || normalizedPulse === 'status'
            || normalizedPulse === 'announce'
        ) {
            this.pulseScene('scene-turn-announce', durationMs);
            return;
        }

        this.pulseScene(normalizedSide === 'enemy' ? 'scene-beat-enemy' : 'scene-beat-self', durationMs);
    }

    createFloatText({ text, kind = 'damage', side = 'self', anchorEl = null } = {}) {
        if (!this.enabled || !this.fxLayer || text === undefined || text === null) {
            return null;
        }

        const normalizedKind = this._normalizeFloatKind(kind);
        const normalizedSide = this._normalizeSide(side);
        const el = document.createElement('div');
        el.className = `battle-float-text battle-float-text--${normalizedKind} battle-float-text--${normalizedSide}`;
        el.textContent = String(text);
        this._positionFloatText(el, anchorEl, normalizedSide);
        this.fxLayer.appendChild(el);

        const remove = () => {
            if (el.parentNode) {
                el.remove();
            }
        };

        el.addEventListener('animationend', remove, { once: true });
        setTimeout(remove, 1200);
        return el;
    }

    clearFloatTexts() {
        if (!this.fxLayer) return;
        this.fxLayer.querySelectorAll('.battle-float-text').forEach(el => el.remove());
    }

    _positionFloatText(el, anchorEl, side) {
        if (!el) return;

        const sceneRect = this.sceneRoot?.getBoundingClientRect?.();
        const anchorRect = anchorEl?.getBoundingClientRect?.();

        if (sceneRect && anchorRect && sceneRect.width > 0 && sceneRect.height > 0) {
            el.style.left = `${anchorRect.left - sceneRect.left + (anchorRect.width / 2)}px`;
            el.style.top = `${anchorRect.top - sceneRect.top + (anchorRect.height * 0.22)}px`;
            return;
        }

        el.dataset.floatSide = side;
    }

    _normalizeTemplate(template) {
        const value = String(template || '').trim().toLowerCase();
        if (value === 'melee' || value === 'guard' || value === 'heal' || value === 'status') {
            return value;
        }
        return 'default';
    }

    _normalizeFloatKind(kind) {
        const value = String(kind || '').trim().toLowerCase();
        if (value === 'damage' || value === 'armor' || value === 'heal') {
            return value;
        }
        if (value === 'guard') {
            return 'armor';
        }
        if (value === 'buff' || value === 'status') {
            return 'heal';
        }
        if (value === 'debuff') {
            return 'damage';
        }
        return 'damage';
    }

    _normalizeSide(side) {
        return side === 'enemy' ? 'enemy' : 'self';
    }
}
