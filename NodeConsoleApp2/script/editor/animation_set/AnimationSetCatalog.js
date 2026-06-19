function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeString(value, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function toFiniteNumber(value, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

function normalizeBoolean(value, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
}

function normalizeOffset(value) {
    const source = asObject(value);
    return {
        x: toFiniteNumber(source.x, 0),
        y: toFiniteNumber(source.y, 0)
    };
}

function extensionOf(ref) {
    const source = normalizeString(ref, '').split('?')[0].split('#')[0];
    const name = source.split('/').pop() || '';
    const match = name.match(/\.([a-z0-9]+)$/iu);
    return match ? match[1].toLowerCase() : '';
}

function isConsumableClip(clip) {
    return normalizeString(clip?.status, '') === 'ready'
        && Boolean(normalizeString(clip?.sheetRef, ''))
        && Boolean(normalizeString(clip?.manifestRef, ''));
}

function buildCatalogClip(key, clip) {
    const source = asObject(clip);
    return {
        key: normalizeString(source.key, key),
        sheetRef: normalizeString(source.sheetRef, ''),
        manifestRef: normalizeString(source.manifestRef, ''),
        frameWidth: toFiniteNumber(source.frameWidth, 0),
        frameHeight: toFiniteNumber(source.frameHeight, 0),
        columns: toFiniteNumber(source.columns ?? source.sheetColumns, 0),
        rows: toFiniteNumber(source.rows ?? source.sheetRows, 0),
        frameCount: toFiniteNumber(source.frameCount, 0),
        fps: toFiniteNumber(source.fps, 12),
        loop: normalizeBoolean(source.loop, false),
        returnTo: source.returnTo === null ? null : normalizeString(source.returnTo, ''),
        scale: toFiniteNumber(source.scale, 1),
        offset: normalizeOffset(source.offset),
        package: {
            kind: normalizeString(source.runtimePackage?.kind, 'spritesheet'),
            imageRef: normalizeString(source.runtimePackage?.imageRef, normalizeString(source.sheetRef, '')),
            manifestRef: normalizeString(source.runtimePackage?.manifestRef, normalizeString(source.manifestRef, '')),
            imageFormat: normalizeString(source.runtimePackage?.imageFormat, extensionOf(source.sheetRef) || 'png'),
            compression: normalizeString(source.runtimePackage?.compression, extensionOf(source.sheetRef) || 'png'),
            frameLayout: {
                frameWidth: toFiniteNumber(source.frameWidth, 0),
                frameHeight: toFiniteNumber(source.frameHeight, 0),
                columns: toFiniteNumber(source.columns ?? source.sheetColumns, 0),
                rows: toFiniteNumber(source.rows ?? source.sheetRows, 0),
                frameCount: toFiniteNumber(source.frameCount, 0)
            }
        },
        status: 'ready'
    };
}

function buildCatalogSet(animationSet) {
    const source = asObject(animationSet);
    const clips = {};
    Object.entries(asObject(source.clips)).forEach(([key, clip]) => {
        if (!isConsumableClip(clip)) return;
        const catalogClip = buildCatalogClip(key, clip);
        if (catalogClip.key) clips[catalogClip.key] = catalogClip;
    });
    const defaultAnimation = normalizeString(source.defaultAnimation, Object.keys(clips)[0] || '');
    return {
        id: normalizeString(source.id, ''),
        ownerType: normalizeString(source.ownerType, 'unknown'),
        ownerId: normalizeString(source.ownerId, ''),
        displayName: normalizeString(source.displayName, normalizeString(source.id, '')),
        defaultAnimation: clips[defaultAnimation] ? defaultAnimation : Object.keys(clips)[0] || '',
        status: Object.keys(clips).length ? 'ready' : 'empty',
        clipCount: Object.keys(clips).length,
        updatedAt: normalizeString(source.updatedAt, ''),
        clips
    };
}

export function buildAnimationCatalog(document = {}, options = {}) {
    const source = asObject(document);
    const generatedAt = normalizeString(options.generatedAt, new Date().toISOString());
    const animationSets = asArray(source.animationSets)
        .map(buildCatalogSet)
        .filter(animationSet => animationSet.id);
    return {
        schemaVersion: 1,
        meta: {
            id: 'animation_catalog_v1',
            name: 'Animation Catalog Interface',
            generatedAt
        },
        generatedFrom: {
            id: normalizeString(source.meta?.id, 'animation_sets_v1'),
            schemaVersion: toFiniteNumber(source.schemaVersion, 1)
        },
        animationSets
    };
}

export class AnimationSetRegistry {
    constructor(catalog = {}) {
        const source = asObject(catalog);
        this.schemaVersion = toFiniteNumber(source.schemaVersion, 1);
        this.meta = clone(asObject(source.meta));
        this.animationSets = asArray(source.animationSets)
            .map(buildCatalogSet)
            .filter(animationSet => animationSet.id);
    }

    listAnimationSets(filter = {}) {
        const ownerType = normalizeString(filter.ownerType, '');
        const ownerId = normalizeString(filter.ownerId, '');
        return this.animationSets.filter((animationSet) => {
            if (ownerType && animationSet.ownerType !== ownerType) return false;
            if (ownerId && animationSet.ownerId !== ownerId) return false;
            return true;
        });
    }

    getAnimationSet(animationSetRef) {
        const id = normalizeString(animationSetRef, '');
        return this.animationSets.find(animationSet => animationSet.id === id) || null;
    }

    findAnimationSetsByOwner(ownerType, ownerId) {
        return this.listAnimationSets({ ownerType, ownerId });
    }

    listClips(animationSetRef) {
        const animationSet = this.getAnimationSet(animationSetRef);
        return animationSet ? Object.values(animationSet.clips) : [];
    }

    getDefaultAnimation(animationSetRef) {
        return this.getAnimationSet(animationSetRef)?.defaultAnimation || '';
    }

    resolveClip(animationSetRef, animationKey = '') {
        const animationSet = this.getAnimationSet(animationSetRef);
        if (!animationSet) return null;
        const key = normalizeString(animationKey, animationSet.defaultAnimation);
        return animationSet.clips[key]
            || animationSet.clips[animationSet.defaultAnimation]
            || Object.values(animationSet.clips)[0]
            || null;
    }

    validateAnimationRef(animationSetRef, animationKey = '') {
        const animationSet = this.getAnimationSet(animationSetRef);
        if (!animationSet) {
            return {
                ok: false,
                reason: 'missing_animation_set',
                animationSetRef: normalizeString(animationSetRef, ''),
                animationKey: normalizeString(animationKey, '')
            };
        }
        const key = normalizeString(animationKey, animationSet.defaultAnimation);
        if (!animationSet.clips[key]) {
            return {
                ok: false,
                reason: 'missing_clip',
                animationSetRef: animationSet.id,
                animationKey: key
            };
        }
        return { ok: true };
    }
}

export default AnimationSetRegistry;
