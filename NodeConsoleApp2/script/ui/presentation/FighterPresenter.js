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
    constructor({ side, fighterRoot = null, hudRoot = null, animationDriver = null, presentationProfile = null } = {}) {
        this.side = side === 'enemy' ? 'enemy' : 'self';
        this.sideClass = this.side === 'enemy' ? 'enemy' : 'self';
        this.fighterRoot = fighterRoot;
        this.hudRoot = hudRoot;
        this.animationDriver = animationDriver instanceof BattleAnimationDriver
            ? animationDriver
            : new BattleAnimationDriver();
        this.presentationProfile = presentationProfile || null;

        this.spriteContainer = fighterRoot?.querySelector('.character-sprite-container') || fighterRoot || null;
        this.bodyLayer = this.spriteContainer?.querySelector?.('.sprite-layer.body') || null;
        this.frameSequenceLayer = this.spriteContainer?.querySelector?.('.sprite-frame-sequence') || null;
        this.frameSequenceState = null;
        this.frameSequencePreloadCache = new Map();
        this.frameSheetCache = new Map();
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

    setPresentationProfile(profile = null) {
        this.presentationProfile = profile || null;
        this.animationDriver?.setPresentationProfile?.(this.presentationProfile);
    }

    syncVisualState(snapshot) {
        if (!snapshot) return;
        this._syncHp(snapshot);
        this._syncArmor(snapshot.bodyParts);
        this._syncBattleSprite(snapshot.presentation);
        this._syncFrameAnimation(snapshot.presentation);
        if (this.fighterRoot) {
            this.fighterRoot.classList.add('is-idle');
        }
    }

    playAction() {
        this.animationDriver.pulseClass(this.fighterRoot, 'is-acting', this._duration('actionMs', 420));
        this.animationDriver.pulseClass(this.spriteContainer, 'is-striking', this._duration('actionMs', 420));
        this.animationDriver.pulseClass(this.shadow, 'is-shadow-surge', this._duration('shadowMs', 420));
    }

    playTemplate(template = 'default', context = {}) {
        const key = String(template || '').trim().toLowerCase();
        if (key === 'guard') {
            this._playGuardTemplate(context);
            return;
        }
        if (key === 'heal') {
            this._playHealTemplate(context);
            return;
        }
        if (key === 'status') {
            this._playStatusTemplate(context);
            return;
        }
        this.playAction();
    }

    playHit({ armorPart = null, damage = 0, armorDamage = 0 } = {}) {
        if (!damage && !armorDamage) return;
        this.animationDriver.pulseClass(this.fighterRoot, 'is-hit', this._duration('hitMs', 420));
        this.animationDriver.pulseClass(this.spriteContainer, 'is-hit-flash', this._duration('hitFlashMs', 420));
        if (armorPart) {
            this.pulseArmor(armorPart, 'hit');
        }
    }

    playHeal() {
        this.animationDriver.pulseClass(this.fighterRoot, 'is-heal', this._duration('healMs', 460));
        this.animationDriver.pulseClass(this.spriteContainer, 'is-heal-glow', this._duration('healGlowMs', 460));
    }

    pulseStatus(kind = 'buff') {
        const row = kind === 'debuff' ? this.debuffRow : this.buffRow;
        const className = kind === 'debuff' ? 'is-debuff-pulse' : 'is-buff-pulse';
        this.animationDriver.pulseClass(row, className, this._duration('statusMs', 560));
    }

    pulseArmor(partKey, mode = 'hit') {
        const row = this.armorRows.get(partKey);
        const className = mode === 'heal' ? 'is-armor-heal' : 'is-armor-hit';
        this.animationDriver.pulseClass(row, className, this._duration('armorMs', 560));
    }

    showFloatText(text, kind = 'damage') {
        return this.animationDriver.createFloatText({
            text,
            kind,
            side: this.sideClass,
            anchorEl: this.effectAnchor,
            durationMs: this._duration('floatTextMs', 950)
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

    _syncBattleSprite(presentation) {
        const spriteRef = typeof presentation?.battleSpriteRef === 'string'
            ? presentation.battleSpriteRef.trim()
            : '';
        if (!this.bodyLayer) return;

        if (!spriteRef) {
            delete this.bodyLayer.dataset.battleSpriteRef;
            this.bodyLayer.style.backgroundImage = '';
            this.bodyLayer.style.backgroundSize = '';
            this.bodyLayer.style.backgroundPosition = '';
            this.bodyLayer.style.backgroundRepeat = '';
            return;
        }

        this.bodyLayer.dataset.battleSpriteRef = spriteRef;
        this.bodyLayer.style.backgroundImage = `url("${spriteRef}")`;
        this.bodyLayer.style.backgroundSize = 'contain';
        this.bodyLayer.style.backgroundPosition = 'bottom center';
        this.bodyLayer.style.backgroundRepeat = 'no-repeat';
    }

    _syncFrameAnimation(presentation) {
        const resolved = this._resolveFrameAnimation(presentation);
        if (!resolved) {
            this._removeFrameSequenceLayer();
            return;
        }

        const { key, clip, start, end, fps } = resolved;
        if (this._hasFrameSheet(clip)) {
            this._syncFrameSheetAnimation({ key, clip, start, end, fps });
            return;
        }

        const firstFrameSrc = this._buildFrameSource(clip, start);
        if (!firstFrameSrc) {
            this._removeFrameSequenceLayer();
            return;
        }

        const layer = this._ensureFrameSequenceLayer('img');
        if (!layer) return;

        layer.dataset.animationKey = key;
        layer.dataset.frameStart = String(start);
        layer.dataset.frameEnd = String(end);
        layer.dataset.frameFps = String(fps);
        this._applyFrameLayerLayout(layer, clip);

        this._startFrameSequence({ key, clip, start, end, fps, layer });
    }

    _resolveFrameAnimation(presentation) {
        const frameAnimations = presentation?.frameAnimations;
        if (!frameAnimations || typeof frameAnimations !== 'object') return null;

        const requestedKey = typeof presentation?.defaultAnimation === 'string'
            ? presentation.defaultAnimation.trim()
            : '';
        const key = requestedKey && frameAnimations[requestedKey]
            ? requestedKey
            : Object.keys(frameAnimations)[0];
        const clip = key ? frameAnimations[key] : null;
        if (!clip || typeof clip !== 'object') return null;

        const start = Math.max(1, Math.floor(Number(clip.start ?? 1) || 1));
        const end = Math.max(start, Math.floor(Number(clip.end ?? start) || start));
        const fps = Math.max(1, Number(clip.fps ?? 12) || 12);
        return { key, clip, start, end, fps };
    }

    _ensureFrameSequenceLayer(tagName = 'img') {
        const desiredTag = String(tagName || 'img').toUpperCase();
        if (this.frameSequenceLayer?.parentNode) {
            if (!this.frameSequenceLayer.tagName || this.frameSequenceLayer.tagName === desiredTag) {
                return this.frameSequenceLayer;
            }
            this._removeFrameSequenceLayer();
        }
        if (!this.spriteContainer || !globalThis.document?.createElement) return null;

        const layer = document.createElement(tagName);
        layer.className = 'sprite-frame-sequence';
        if (tagName === 'img') {
            layer.alt = '';
            layer.draggable = false;
            layer.decoding = 'async';
            layer.loading = 'eager';
        }
        this.spriteContainer.appendChild(layer);
        this.frameSequenceLayer = layer;
        return layer;
    }

    _removeFrameSequenceLayer() {
        this._stopFrameSequence();
        this.frameSequenceLayer?.remove?.();
        this.frameSequenceLayer = null;
    }

    _hasFrameSheet(clip) {
        if (!clip || typeof clip !== 'object') return false;
        const sheetRef = typeof clip.sheetRef === 'string' ? clip.sheetRef.trim() : '';
        const frameWidth = Math.floor(Number(clip.frameWidth ?? 0) || 0);
        const frameHeight = Math.floor(Number(clip.frameHeight ?? 0) || 0);
        return Boolean(sheetRef && frameWidth > 0 && frameHeight > 0);
    }

    _syncFrameSheetAnimation({ key, clip, start, end, fps }) {
        const layer = this._ensureFrameSequenceLayer('canvas');
        if (!layer) return;

        const sheetRef = typeof clip.sheetRef === 'string' ? clip.sheetRef.trim() : '';
        const frameWidth = Math.max(1, Math.floor(Number(clip.frameWidth ?? 0) || 0));
        const frameHeight = Math.max(1, Math.floor(Number(clip.frameHeight ?? 0) || 0));
        const columns = Math.max(1, Math.floor(Number(clip.sheetColumns ?? clip.columns ?? 1) || 1));
        const rows = Math.max(1, Math.floor(Number(clip.sheetRows ?? clip.rows ?? Math.ceil((end - start + 1) / columns)) || 1));
        if (!sheetRef || frameWidth <= 0 || frameHeight <= 0) {
            this._removeFrameSequenceLayer();
            return;
        }

        layer.width = frameWidth;
        layer.height = frameHeight;
        layer.dataset.animationKey = key;
        layer.dataset.frameStart = String(start);
        layer.dataset.frameEnd = String(end);
        layer.dataset.frameFps = String(fps);
        layer.dataset.frameSheet = sheetRef;
        layer.dataset.frameSheetColumns = String(columns);
        layer.dataset.frameSheetRows = String(rows);
        this._applyFrameLayerLayout(layer, clip);

        this._startFrameSheetSequence({
            key,
            clip,
            start,
            end,
            fps,
            layer,
            sheetRef,
            frameWidth,
            frameHeight,
            columns
        });
    }

    _startFrameSheetSequence({ key, clip, start, end, fps, layer, sheetRef, frameWidth, frameHeight, columns }) {
        const signature = JSON.stringify({ key, start, end, fps, sheetRef, frameWidth, frameHeight, columns });
        if (this.frameSequenceState?.signature === signature) return;

        this._stopFrameSequence();
        layer.style.opacity = '0';
        layer.dataset.frameLoading = '1';
        delete layer.dataset.frameReady;
        delete layer.dataset.frameFirstReady;
        delete layer.dataset.frameError;

        const state = {
            signature,
            frame: start,
            lastTime: 0,
            rafId: null,
            loading: true,
            sheetImage: null
        };
        this.frameSequenceState = state;

        const drawFrame = (frameIndex) => {
            if (this.frameSequenceState !== state) return;
            const image = state.sheetImage;
            const context = typeof layer.getContext === 'function' ? layer.getContext('2d') : null;
            if (!image || !context) return;
            const offset = Math.max(0, frameIndex - start);
            const sx = (offset % columns) * frameWidth;
            const sy = Math.floor(offset / columns) * frameHeight;
            context.clearRect?.(0, 0, frameWidth, frameHeight);
            context.drawImage(image, sx, sy, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
        };

        const activate = (image) => {
            if (this.frameSequenceState !== state) return;
            state.sheetImage = image;
            state.loading = false;
            drawFrame(start);
            layer.style.opacity = '1';
            delete layer.dataset.frameLoading;
            layer.dataset.frameFirstReady = '1';
            layer.dataset.frameReady = '1';
            if (this.bodyLayer) {
                this.bodyLayer.style.backgroundImage = 'none';
            }

            if (typeof globalThis.requestAnimationFrame !== 'function') {
                return;
            }
            state.rafId = globalThis.requestAnimationFrame(tick);
        };

        const preload = this._preloadFrameSheet(sheetRef);
        if (preload?.then) {
            preload.then(activate).catch(error => {
                if (this.frameSequenceState !== state) return;
                console.warn('[FighterPresenter] Failed to preload frame sheet:', error);
                state.loading = false;
                layer.dataset.frameError = '1';
            });
        }

        if (typeof globalThis.requestAnimationFrame !== 'function') {
            return;
        }

        const frameMs = 1000 / fps;
        const tick = (time) => {
            if (this.frameSequenceState !== state || state.loading) return;
            if (!state.lastTime) state.lastTime = time;

            if (time - state.lastTime >= frameMs) {
                state.lastTime = time;
                state.frame = state.frame >= end ? start : state.frame + 1;
                drawFrame(state.frame);
            }

            state.rafId = globalThis.requestAnimationFrame(tick);
        };
    }

    _startFrameSequence({ key, clip, start, end, fps, layer }) {
        const signature = JSON.stringify({ key, start, end, fps, basePath: clip.basePath, filePattern: clip.filePattern });
        if (this.frameSequenceState?.signature === signature) return;

        this._stopFrameSequence();
        const sources = [];
        for (let frame = start; frame <= end; frame += 1) {
            const src = this._buildFrameSource(clip, frame);
            if (src) sources.push(src);
        }
        if (sources.length === 0) return;

        layer.src = sources[0];
        layer.style.opacity = '0';
        layer.dataset.frameLoading = '1';
        delete layer.dataset.frameReady;

        const state = {
            signature,
            frame: start,
            lastTime: 0,
            rafId: null,
            loading: true,
            firstFrameReady: false
        };
        this.frameSequenceState = state;

        const showFirstFrame = () => {
            if (this.frameSequenceState !== state) return;

            state.firstFrameReady = true;
            layer.src = sources[0];
            layer.style.opacity = '1';
            layer.dataset.frameFirstReady = '1';
            if (this.bodyLayer) {
                this.bodyLayer.style.backgroundImage = 'none';
            }
        };

        const activate = () => {
            if (this.frameSequenceState !== state) return;

            if (!state.firstFrameReady) {
                showFirstFrame();
            }
            state.loading = false;
            delete layer.dataset.frameLoading;
            layer.dataset.frameReady = '1';

            if (typeof globalThis.requestAnimationFrame !== 'function') {
                return;
            }

            state.rafId = globalThis.requestAnimationFrame(tick);
        };

        const firstFramePreload = this._preloadFrameSource(sources[0]);
        if (firstFramePreload?.then) {
            firstFramePreload.then(showFirstFrame).catch(error => {
                if (this.frameSequenceState !== state) return;
                console.warn('[FighterPresenter] Failed to preload first frame:', error);
                layer.dataset.frameError = '1';
            });
        } else {
            showFirstFrame();
        }

        const preload = this._preloadFrameSequence(sources);
        if (preload?.then) {
            preload.then(activate).catch(error => {
                if (this.frameSequenceState !== state) return;
                console.warn('[FighterPresenter] Failed to preload frame sequence:', error);
                state.loading = false;
                layer.dataset.frameError = '1';
            });
        } else {
            activate();
        }

        if (typeof globalThis.requestAnimationFrame !== 'function') {
            return;
        }

        const frameMs = 1000 / fps;
        const tick = (time) => {
            if (this.frameSequenceState !== state || state.loading) return;
            if (!state.lastTime) state.lastTime = time;

            if (time - state.lastTime >= frameMs) {
                state.lastTime = time;
                state.frame = state.frame >= end ? start : state.frame + 1;
                const frameSrc = this._buildFrameSource(clip, state.frame);
                if (frameSrc) layer.src = frameSrc;
            }

            state.rafId = globalThis.requestAnimationFrame(tick);
        };
    }

    _stopFrameSequence() {
        const state = this.frameSequenceState;
        if (state?.rafId && typeof globalThis.cancelAnimationFrame === 'function') {
            globalThis.cancelAnimationFrame(state.rafId);
        }
        this.frameSequenceState = null;
    }

    _preloadFrameSequence(sources) {
        if (typeof globalThis.Image !== 'function') return null;
        return Promise.all(sources.map(src => this._preloadFrameSource(src)));
    }

    _preloadFrameSheet(src) {
        if (typeof globalThis.Image !== 'function') return null;
        if (this.frameSheetCache.has(src)) {
            return this.frameSheetCache.get(src);
        }

        const promise = new Promise((resolve, reject) => {
            const image = new globalThis.Image();
            let settled = false;
            const settle = (callback, value) => {
                if (settled) return;
                settled = true;
                callback(value);
            };
            const resolveDecoded = () => {
                if (typeof image.decode === 'function') {
                    image.decode()
                        .then(() => settle(resolve, image))
                        .catch(error => settle(reject, error));
                    return;
                }
                settle(resolve, image);
            };

            image.onload = resolveDecoded;
            image.onerror = () => settle(reject, new Error(`Failed to load frame sheet: ${src}`));
            image.src = src;
            if (image.complete && image.naturalWidth > 0) {
                resolveDecoded();
            }
        });
        this.frameSheetCache.set(src, promise);
        return promise;
    }

    _preloadFrameSource(src) {
        if (typeof globalThis.Image !== 'function') return null;
        if (this.frameSequencePreloadCache.has(src)) {
            return this.frameSequencePreloadCache.get(src);
        }

        const promise = new Promise((resolve, reject) => {
            const image = new globalThis.Image();
            let settled = false;
            const settle = (callback, value) => {
                if (settled) return;
                settled = true;
                callback(value);
            };
            const resolveDecoded = () => {
                if (typeof image.decode === 'function') {
                    image.decode()
                        .then(() => settle(resolve, src))
                        .catch(error => settle(reject, error));
                    return;
                }
                settle(resolve, src);
            };

            image.onload = resolveDecoded;
            image.onerror = () => settle(reject, new Error(`Failed to load frame: ${src}`));
            image.src = src;
            if (image.complete && image.naturalWidth > 0) {
                resolveDecoded();
            }
        });
        this.frameSequencePreloadCache.set(src, promise);
        return promise;
    }

    _buildFrameSource(clip, frameIndex) {
        if (Array.isArray(clip.frames)) {
            return typeof clip.frames[frameIndex - 1] === 'string' ? clip.frames[frameIndex - 1] : '';
        }

        const basePath = typeof clip.basePath === 'string' ? clip.basePath.trim().replace(/[\\\/]+$/u, '') : '';
        const filePattern = typeof clip.filePattern === 'string' ? clip.filePattern.trim() : '';
        if (!basePath || !filePattern) return '';

        const fileName = filePattern.replace(/\{index\}/gu, String(frameIndex));
        return `${basePath}/${fileName}`;
    }

    _applyFrameLayerLayout(layer, clip) {
        if (!layer) return;
        const scale = Number(clip.scale ?? 1);
        const offsetX = Number(clip.offsetX ?? 0) || 0;
        const offsetY = Number(clip.offsetY ?? 0) || 0;
        layer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${Number.isFinite(scale) && scale > 0 ? scale : 1})`;
        layer.style.transformOrigin = 'center bottom';
    }

    _playGuardTemplate(context = {}) {
        this.animationDriver.pulseClass(this.fighterRoot, 'is-hit', this._duration('hitMs', 320));
        this.animationDriver.pulseClass(this.spriteContainer, 'is-hit-flash', this._duration('hitFlashMs', 280));
        const armorPart = context.armorPart || this._firstArmorPartKey();
        if (armorPart) {
            this.pulseArmor(armorPart, 'hit');
        }
        const guardText = context.text || context.floatText || '格挡';
        if (context.showFloatText !== false) {
            this.showFloatText(guardText, 'guard');
        }
    }

    _playHealTemplate(context = {}) {
        this.playHeal();
        const amount = Number(context.amount ?? context.value ?? 0) || 0;
        if (context.showFloatText === false) {
            return;
        }
        if (amount > 0) {
            this.showFloatText(`+${amount}`, 'heal');
            return;
        }
        this.showFloatText(context.text || '治疗', 'heal');
    }

    _playStatusTemplate(context = {}) {
        const statusKind = context.statusKind === 'debuff' ? 'debuff' : 'buff';
        this.pulseStatus(statusKind);
        if (context.showFloatText === false) {
            return;
        }
        const text = context.text || (statusKind === 'debuff' ? 'DEBUFF +' : 'BUFF +');
        this.showFloatText(text, statusKind);
    }

    _firstArmorPartKey() {
        for (const key of this.armorRows.keys()) {
            return key;
        }
        return null;
    }

    _duration(key, fallback) {
        const value = Number(this.presentationProfile?.motion?.durations?.[key]);
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }
}
