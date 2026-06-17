function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeString(value, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getRegistry(registry) {
    if (!registry || typeof registry.listAnimationSets !== 'function') {
        throw new Error('AnimationSetRegistry is required.');
    }
    return registry;
}

export function buildAnimationSetPickerModel(registry, options = {}) {
    const source = asObject(options);
    const selectedAnimationSetRef = normalizeString(source.selectedAnimationSetRef, '');
    const animationSets = getRegistry(registry).listAnimationSets({
        ownerType: normalizeString(source.ownerType, ''),
        ownerId: normalizeString(source.ownerId, '')
    });
    return {
        selectedAnimationSetRef,
        options: animationSets.map(animationSet => ({
            value: animationSet.id,
            label: animationSet.displayName || animationSet.id,
            ownerType: animationSet.ownerType,
            ownerId: animationSet.ownerId,
            clipCount: animationSet.clipCount,
            selected: animationSet.id === selectedAnimationSetRef
        }))
    };
}

export function buildAnimationClipPickerModel(registry, options = {}) {
    const source = asObject(options);
    const animationSetRef = normalizeString(source.animationSetRef, '');
    const selectedAnimationKey = normalizeString(source.selectedAnimationKey, '');
    const clips = getRegistry(registry).listClips(animationSetRef);
    return {
        animationSetRef,
        selectedAnimationKey,
        options: clips.map(clip => ({
            value: clip.key,
            label: clip.key,
            fps: clip.fps,
            loop: clip.loop,
            frameCount: clip.frameCount,
            selected: clip.key === selectedAnimationKey
        }))
    };
}

export function buildAnimationPreviewModel(registry, options = {}) {
    const source = asObject(options);
    const animationSetRef = normalizeString(source.animationSetRef, '');
    const animationKey = normalizeString(source.animationKey, '');
    const clip = getRegistry(registry).resolveClip(animationSetRef, animationKey);
    return {
        animationSetRef,
        animationKey,
        available: Boolean(clip),
        clip,
        validation: getRegistry(registry).validateAnimationRef(animationSetRef, animationKey)
    };
}

export function buildAnimationBindingTableModel(registry, options = {}) {
    const source = asObject(options);
    const animationSetRef = normalizeString(source.animationSetRef, '');
    const bindings = asObject(source.bindings);
    const rows = asArray(source.rows).map((row) => {
        const event = normalizeString(row.event, '');
        const animationKey = normalizeString(bindings[event], '');
        const validation = getRegistry(registry).validateAnimationRef(animationSetRef, animationKey);
        return {
            event,
            label: normalizeString(row.label, event),
            animationKey,
            valid: validation.ok,
            validation
        };
    });
    return {
        animationSetRef,
        rows
    };
}
