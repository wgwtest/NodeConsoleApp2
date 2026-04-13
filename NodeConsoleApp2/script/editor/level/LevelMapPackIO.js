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
    runLevelMapPackRoundTrip,
    formatLevelMapIssues
};
