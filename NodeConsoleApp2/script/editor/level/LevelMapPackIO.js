import LevelMapWorkspace from './LevelMapWorkspace.js';

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function summarizeMapPack(document) {
    const maps = Array.isArray(document?.maps) ? document.maps : [];
    const assetLibrary = document?.assetLibrary || {};
    let nodeCount = 0;
    let edgeCount = 0;
    let previewModeCount = 0;
    maps.forEach((map) => {
        nodeCount += Array.isArray(map?.nodes) ? map.nodes.length : 0;
        edgeCount += Array.isArray(map?.edges) ? map.edges.length : 0;
        previewModeCount += Array.isArray(map?.previewModes) ? map.previewModes.length : 0;
    });

    return {
        mapCount: maps.length,
        nodeCount,
        edgeCount,
        previewModeCount,
        backgroundAssetCount: Array.isArray(assetLibrary.backgrounds) ? assetLibrary.backgrounds.length : 0,
        nodeArtAssetCount: Array.isArray(assetLibrary.nodeArts) ? assetLibrary.nodeArts.length : 0,
        portraitAssetCount: Array.isArray(assetLibrary.portraits) ? assetLibrary.portraits.length : 0
    };
}

function basenameFromPath(src) {
    const text = typeof src === 'string' ? src.trim() : '';
    if (!text) return '';
    return text.split(/[\\/]/u).filter(Boolean).pop() || '';
}

function mapAssetDependencies(items, groupName) {
    return (Array.isArray(items) ? items : [])
        .filter(item => item && typeof item === 'object' && item.id)
        .map((item) => {
            const source = item.src || item.thumbnailSrc || '';
            const fileName = basenameFromPath(source) || `${item.id}.asset`;
            return {
                id: item.id,
                label: item.label || item.id,
                source,
                packagePath: `assets/${groupName}/${fileName}`
            };
        });
}

function buildAssetManifest(assetLibrary) {
    const library = assetLibrary || {};
    return {
        backgrounds: mapAssetDependencies(library.backgrounds, 'backgrounds'),
        nodeArts: mapAssetDependencies(library.nodeArts, 'nodeArts'),
        portraits: mapAssetDependencies(library.portraits, 'portraits')
    };
}

export function analyzeLevelMapPack(rawDocument, options = {}) {
    const workspace = new LevelMapWorkspace(rawDocument, {
        levelsDocument: options.levelsDocument,
        levelIds: options.levelIds
    });
    const normalized = workspace.exportDocument();
    const issues = workspace.validateDocument();

    return {
        normalized,
        issues,
        issueCount: issues.length,
        summary: summarizeMapPack(normalized)
    };
}

export function buildLevelMapPackageExport(rawDocument, options = {}) {
    const workspace = new LevelMapWorkspace(rawDocument, {
        levelsDocument: options.levelsDocument,
        levelIds: options.levelIds
    });
    const mapsJson = workspace.exportDocument();
    const meta = mapsJson.meta || {};
    const packageId = typeof options.packageId === 'string' && options.packageId.trim()
        ? options.packageId.trim()
        : (meta.id || 'story_pack_v1');
    const title = typeof options.packageTitle === 'string' && options.packageTitle.trim()
        ? options.packageTitle.trim()
        : (meta.title || packageId);
    const assetManifest = buildAssetManifest(mapsJson.assetLibrary);
    const stories = Array.isArray(mapsJson.stories) ? mapsJson.stories : [];
    const chapters = Array.isArray(mapsJson.chapters) ? mapsJson.chapters : [];
    const entryStoryId = meta.entryStoryId || stories[0]?.id || '';
    const entryStory = stories.find(story => story.id === entryStoryId) || stories[0] || null;
    const packageJson = {
        $schemaVersion: 'level_map_package_v1',
        packageId,
        packageVersion: typeof options.packageVersion === 'string' && options.packageVersion.trim()
            ? options.packageVersion.trim()
            : '1.0.0',
        title,
        status: meta.status || 'draft',
        entryStoryId: entryStory?.id || '',
        entryChapterId: entryStory?.entryChapterId || chapters[0]?.id || '',
        files: {
            maps: 'maps.json'
        },
        assets: {
            basePath: 'assets/',
            manifest: 'asset-manifest.json'
        },
        stories: stories.map(story => ({
            id: story.id,
            title: story.title,
            entryChapterId: story.entryChapterId,
            chapterIds: Array.isArray(story.chapterIds) ? [...story.chapterIds] : []
        }))
    };

    return {
        packageJson,
        mapsJson,
        assetManifest
    };
}

export function runLevelMapPackRoundTrip(rawDocument, options = {}) {
    const before = analyzeLevelMapPack(rawDocument, options);
    const after = analyzeLevelMapPack(before.normalized, options);

    return {
        before,
        after,
        structuralMatch: JSON.stringify(before.summary) === JSON.stringify(after.summary),
        normalized: clone(after.normalized)
    };
}

export function formatLevelMapIssues(issues) {
    return (Array.isArray(issues) ? issues : []).map((issue) => ({
        code: issue.code || 'unknown_issue',
        mapId: issue.mapId || '',
        nodeId: issue.nodeId || '',
        edgeId: issue.edgeId || '',
        detail: issue.levelId
            || issue.entryNodeId
            || issue.backgroundRef
            || issue.nodeSkinRef
            || issue.nodeArtRef
            || issue.portraitRef
            || ''
    }));
}

export default {
    analyzeLevelMapPack,
    buildLevelMapPackageExport,
    runLevelMapPackRoundTrip,
    formatLevelMapIssues
};
