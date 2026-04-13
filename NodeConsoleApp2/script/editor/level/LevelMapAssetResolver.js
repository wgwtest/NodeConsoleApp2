function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeAssetEntry(item) {
    const source = asObject(item);
    return {
        id: typeof source.id === 'string' ? source.id.trim() : '',
        label: typeof source.label === 'string' ? source.label.trim() : '',
        src: typeof source.src === 'string' ? source.src.trim() : '',
        thumbnailSrc: typeof source.thumbnailSrc === 'string' ? source.thumbnailSrc.trim() : '',
        previewGradient: typeof source.previewGradient === 'string' ? source.previewGradient : '',
        shape: typeof source.shape === 'string' ? source.shape.trim() : ''
    };
}

export function normalizeLevelMapAssetLibrary(rawLibrary) {
    const source = asObject(rawLibrary);
    return {
        backgrounds: asArray(source.backgrounds).map(normalizeAssetEntry).filter((item) => item.id),
        nodeSkins: asArray(source.nodeSkins).map(normalizeAssetEntry).filter((item) => item.id),
        nodeArts: asArray(source.nodeArts).map(normalizeAssetEntry).filter((item) => item.id),
        portraits: asArray(source.portraits).map(normalizeAssetEntry).filter((item) => item.id)
    };
}

export function findLevelMapAsset(collection, assetId) {
    if (!assetId) return null;
    return asArray(collection).find((item) => item.id === assetId) || null;
}

export function getLevelMapAssetImage(asset) {
    return asset?.src || asset?.thumbnailSrc || '';
}

export function getLevelMapAssetLabel(asset, fallbackId = '') {
    if (!asset) return fallbackId || '';
    return asset.label || asset.id || fallbackId || '';
}

export function buildStageImageLayers(map, assetLibrary) {
    const normalized = normalizeLevelMapAssetLibrary(assetLibrary);
    const background = findLevelMapAsset(normalized.backgrounds, map?.backgroundRef || '');
    const backgroundImage = getLevelMapAssetImage(background);
    const previewGradient = background?.previewGradient || 'linear-gradient(180deg, rgba(8, 17, 28, 0.34), rgba(8, 17, 28, 0.14))';
    const backgroundFit = typeof map?.display?.backgroundFit === 'string' && map.display.backgroundFit.trim()
        ? map.display.backgroundFit.trim()
        : 'cover';
    const layers = [
        'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.16), transparent 18%)',
        'linear-gradient(180deg, rgba(12, 16, 24, 0.18), rgba(12, 16, 24, 0.42))',
        previewGradient
    ];
    if (backgroundImage) {
        layers.unshift(`url("${backgroundImage}")`);
    }
    return {
        background,
        backgroundImage: layers.join(', '),
        backgroundSize: backgroundImage ? `${backgroundFit}, auto, auto, auto` : 'auto, auto, auto',
        backgroundPosition: backgroundImage ? 'center center, center, center, center' : 'center, center, center',
        backgroundRepeat: backgroundImage ? 'no-repeat, no-repeat, no-repeat, no-repeat' : 'no-repeat, no-repeat, no-repeat'
    };
}

export function resolveNodeVisualAssets(node, assetLibrary) {
    const normalized = normalizeLevelMapAssetLibrary(assetLibrary);
    const nodeArt = findLevelMapAsset(normalized.nodeArts, node?.artRefs?.nodeArt || '');
    const portrait = findLevelMapAsset(normalized.portraits, node?.artRefs?.portrait || '');
    const nodeSkin = findLevelMapAsset(normalized.nodeSkins, node?.nodeSkinRef || '');
    return {
        nodeArt,
        portrait,
        nodeSkin,
        nodeArtImage: getLevelMapAssetImage(nodeArt),
        portraitImage: getLevelMapAssetImage(portrait)
    };
}

export default {
    normalizeLevelMapAssetLibrary,
    findLevelMapAsset,
    getLevelMapAssetImage,
    getLevelMapAssetLabel,
    buildStageImageLayers,
    resolveNodeVisualAssets
};
