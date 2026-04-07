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

    createFloatText({ text, kind = 'damage', side = 'self', anchorEl = null } = {}) {
        if (!this.enabled || !this.fxLayer || text === undefined || text === null) {
            return null;
        }

        const el = document.createElement('div');
        el.className = `battle-float-text battle-float-text--${kind} battle-float-text--${side}`;
        el.textContent = String(text);
        this._positionFloatText(el, anchorEl, side);
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
}
