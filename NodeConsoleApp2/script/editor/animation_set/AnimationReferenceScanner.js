function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeString(value, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeRefPath(value) {
    return normalizeString(value, '')
        .replace(/\\/g, '/')
        .replace(/^(\.\/)+/u, '')
        .replace(/^(\.\.\/)+/u, '')
        .toLowerCase();
}

function basename(value) {
    return normalizeRefPath(value).split('/').pop() || '';
}

function parseContent(content) {
    if (typeof content === 'string') {
        try {
            return JSON.parse(content);
        } catch {
            return null;
        }
    }
    return content;
}

function shouldSkipSourcePath(path) {
    const normalized = normalizeRefPath(path);
    return normalized.endsWith('assets/data/animation_sets_v1.json')
        || normalized.endsWith('assets/data/animation_catalog_v1.json');
}

function getAnimationSets(source) {
    if (Array.isArray(source?.animationSets)) return source.animationSets;
    if (Array.isArray(source?.workspace?.animationSets)) return source.workspace.animationSets;
    if (Array.isArray(source?.document?.animationSets)) return source.document.animationSets;
    return [];
}

function buildClipIndexes(animationSets) {
    const setById = new Map();
    const clipByAssetRef = new Map();
    const clipByAssetName = new Map();
    animationSets.forEach((animationSet) => {
        if (!animationSet?.id) return;
        setById.set(animationSet.id, animationSet);
        Object.values(asObject(animationSet.clips)).forEach((clip) => {
            if (!clip?.key) return;
            [clip.sheetRef, clip.manifestRef].forEach((ref) => {
                const normalized = normalizeRefPath(ref);
                if (!normalized) return;
                const match = { animationSet, clip };
                clipByAssetRef.set(normalized, match);
                const name = basename(normalized);
                if (!name) return;
                const current = clipByAssetName.get(name);
                if (!current) {
                    clipByAssetName.set(name, match);
                } else if (current.clip !== clip || current.animationSet !== animationSet) {
                    clipByAssetName.set(name, null);
                }
            });
        });
    });
    return { setById, clipByAssetRef, clipByAssetName };
}

function sourceIdFromPath(pathParts) {
    return pathParts[0] || '';
}

function deriveFrameAnimationKey(pathParts, fallback = '') {
    const index = pathParts.lastIndexOf('frameAnimations');
    if (index >= 0 && pathParts[index + 1]) return pathParts[index + 1];
    return fallback;
}

function buildDirectReference({ source, sourceId, fieldPath, value, setById }) {
    const animationSetRef = normalizeString(value.animationSetRef, '');
    if (!animationSetRef) return null;
    const animationSet = setById.get(animationSetRef) || null;
    const animationKey = normalizeString(
        value.animationKey,
        normalizeString(value.defaultAnimation, animationSet?.defaultAnimation || '')
    );
    const clip = animationSet ? asObject(animationSet.clips)[animationKey] || null : null;
    return {
        type: 'animation_ref',
        sourcePath: source.path || '',
        sourceKind: source.kind || '',
        sourceId,
        fieldPath,
        animationSetRef,
        animationKey,
        clipKey: clip?.key || animationKey,
        ownerType: animationSet?.ownerType || '',
        ownerId: animationSet?.ownerId || '',
        status: !animationSet ? 'missing_set' : clip || !animationKey ? 'ok' : 'missing_clip'
    };
}

function buildLegacyReference({ source, sourceId, fieldPath, pathParts, value, clipByAssetRef, clipByAssetName }) {
    const assetRef = normalizeString(value.sheetRef, normalizeString(value.manifestRef, ''));
    const normalized = normalizeRefPath(assetRef);
    const match = clipByAssetRef.get(normalized) || clipByAssetName.get(basename(normalized));
    if (!match) return null;
    const animationKey = deriveFrameAnimationKey(pathParts, match.clip.key);
    return {
        type: 'legacy_sheet',
        sourcePath: source.path || '',
        sourceKind: source.kind || '',
        sourceId,
        fieldPath,
        animationSetRef: match.animationSet.id,
        animationKey,
        clipKey: match.clip.key,
        ownerType: match.animationSet.ownerType || '',
        ownerId: match.animationSet.ownerId || '',
        status: 'ok'
    };
}

function referenceKey(reference) {
    return [
        reference.type,
        reference.sourcePath,
        reference.sourceId,
        reference.fieldPath,
        reference.animationSetRef,
        reference.animationKey,
        reference.clipKey
    ].join('|');
}

export function scanAnimationReferences(options = {}) {
    const animationSets = getAnimationSets(options);
    const { setById, clipByAssetRef, clipByAssetName } = buildClipIndexes(animationSets);
    const references = [];
    const seen = new Set();

    function push(reference) {
        if (!reference) return;
        const key = referenceKey(reference);
        if (seen.has(key)) return;
        seen.add(key);
        references.push(reference);
    }

    function walk(value, source, pathParts = [], context = {}) {
        if (Array.isArray(value)) {
            value.forEach((item, index) => walk(item, source, [...pathParts, String(index)], context));
            return;
        }
        if (!value || typeof value !== 'object') return;

        const objectValue = asObject(value);
        const sourceId = normalizeString(objectValue.id, context.sourceId || sourceIdFromPath(pathParts));
        const fieldPath = pathParts.join('.');
        push(buildDirectReference({ source, sourceId, fieldPath, value: objectValue, setById }));
        push(buildLegacyReference({ source, sourceId, fieldPath, pathParts, value: objectValue, clipByAssetRef, clipByAssetName }));

        Object.entries(objectValue).forEach(([key, child]) => {
            walk(child, source, [...pathParts, key], { sourceId });
        });
    }

    asArray(options.sources).forEach((source) => {
        if (shouldSkipSourcePath(source?.path)) return;
        const content = parseContent(source?.content);
        if (content === null || content === undefined) return;
        walk(content, asObject(source));
    });

    return references;
}

export function filterReferencesForAnimationSet(references = [], animationSetId = '') {
    const id = normalizeString(animationSetId, '');
    if (!id) return [];
    return asArray(references).filter(reference => reference.animationSetRef === id);
}

export function filterReferencesForClip(references = [], animationSetId = '', clipKey = '') {
    const id = normalizeString(animationSetId, '');
    const key = normalizeString(clipKey, '');
    if (!id || !key) return [];
    return asArray(references).filter(reference => (
        reference.animationSetRef === id
        && (reference.clipKey === key || reference.animationKey === key)
    ));
}
