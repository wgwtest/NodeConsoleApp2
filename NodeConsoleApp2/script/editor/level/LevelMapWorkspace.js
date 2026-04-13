import { normalizeLevelMapAssetLibrary } from './LevelMapAssetResolver.js';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function toFiniteNumber(value, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

function uniqueStringList(value) {
    const seen = new Set();
    const result = [];
    asArray(value).forEach((item) => {
        const next = typeof item === 'string' ? item.trim() : '';
        if (!next || seen.has(next)) return;
        seen.add(next);
        result.push(next);
    });
    return result;
}

function normalizeMapSpace(space) {
    const source = asObject(space);
    return {
        logicalWidth: Math.max(1, toFiniteNumber(source.logicalWidth, 1600)),
        logicalHeight: Math.max(1, toFiniteNumber(source.logicalHeight, 900))
    };
}

function normalizeMapDisplay(display) {
    const source = asObject(display);
    return {
        viewportAspect: typeof source.viewportAspect === 'string' && source.viewportAspect.trim()
            ? source.viewportAspect.trim()
            : '16:9',
        backgroundFit: typeof source.backgroundFit === 'string' && source.backgroundFit.trim()
            ? source.backgroundFit.trim()
            : 'cover',
        nodeScale: Math.max(0.1, toFiniteNumber(source.nodeScale, 0.6)),
        nodeAnchor: typeof source.nodeAnchor === 'string' && source.nodeAnchor.trim()
            ? source.nodeAnchor.trim()
            : 'center',
        edgeAnchor: typeof source.edgeAnchor === 'string' && source.edgeAnchor.trim()
            ? source.edgeAnchor.trim()
            : 'center',
        edgeLabelMode: typeof source.edgeLabelMode === 'string' && source.edgeLabelMode.trim()
            ? source.edgeLabelMode.trim()
            : 'midpoint'
    };
}

function normalizeNodePosition(index, node) {
    const source = asObject(node);
    const position = asObject(source.position);
    return {
        x: toFiniteNumber(position.x, toFiniteNumber(source.x, 120 + index * 120)),
        y: toFiniteNumber(position.y, toFiniteNumber(source.y, 220))
    };
}

function normalizeNode(index, node, fallbackLevelId = '') {
    const source = asObject(node);
    const artRefs = asObject(source.artRefs);
    const position = normalizeNodePosition(index, source);
    return {
        id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `node_${index + 1}`,
        levelId: typeof source.levelId === 'string' && source.levelId.trim() ? source.levelId.trim() : fallbackLevelId,
        label: typeof source.label === 'string' && source.label.trim() ? source.label.trim() : `节点 ${index + 1}`,
        title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : `未命名节点 ${index + 1}`,
        kind: typeof source.kind === 'string' && source.kind.trim() ? source.kind.trim() : 'battle',
        nodeSkinRef: typeof source.nodeSkinRef === 'string' ? source.nodeSkinRef.trim() : '',
        iconLabel: typeof source.iconLabel === 'string' ? source.iconLabel.trim() : '',
        position,
        objectiveText: typeof source.objectiveText === 'string' ? source.objectiveText : '',
        difficultyLabel: typeof source.difficultyLabel === 'string' ? source.difficultyLabel : '',
        rewardPreview: asArray(source.rewardPreview).map(item => String(item || '').trim()).filter(Boolean),
        artRefs: {
            nodeArt: typeof artRefs.nodeArt === 'string' ? artRefs.nodeArt.trim() : '',
            portrait: typeof artRefs.portrait === 'string' ? artRefs.portrait.trim() : ''
        }
    };
}

function normalizeEdge(index, edge) {
    const source = asObject(edge);
    return {
        id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `edge_${index + 1}`,
        fromNodeId: typeof source.fromNodeId === 'string' ? source.fromNodeId.trim() : '',
        toNodeId: typeof source.toNodeId === 'string' ? source.toNodeId.trim() : '',
        type: typeof source.type === 'string' && source.type.trim() ? source.type.trim() : 'branch',
        branchLabel: typeof source.branchLabel === 'string' ? source.branchLabel.trim() : ''
    };
}

function normalizePreviewMode(index, mode) {
    const source = asObject(mode);
    return {
        id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `preview_${index + 1}`,
        label: typeof source.label === 'string' && source.label.trim() ? source.label.trim() : `预览模式 ${index + 1}`,
        description: typeof source.description === 'string' ? source.description : '',
        focusNodeId: typeof source.focusNodeId === 'string' ? source.focusNodeId.trim() : '',
        unlockedNodeIds: uniqueStringList(source.unlockedNodeIds),
        completedNodeIds: uniqueStringList(source.completedNodeIds)
    };
}

function normalizeMap(index, map, availableLevelIds = []) {
    const source = asObject(map);
    const fallbackLevelId = availableLevelIds[0] || '';
    const nodes = asArray(source.nodes).map((node, nodeIndex) => normalizeNode(nodeIndex, node, fallbackLevelId));
    const entryNodeId = typeof source.entryNodeId === 'string' && source.entryNodeId.trim()
        ? source.entryNodeId.trim()
        : nodes[0]?.id || '';

    return {
        id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `map_${index + 1}`,
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : `未命名地图 ${index + 1}`,
        chapterId: typeof source.chapterId === 'string' ? source.chapterId.trim() : '',
        chapterLabel: typeof source.chapterLabel === 'string' ? source.chapterLabel : '',
        chapterTitle: typeof source.chapterTitle === 'string' ? source.chapterTitle : '',
        space: normalizeMapSpace(source.space),
        display: normalizeMapDisplay(source.display),
        backgroundRef: typeof source.backgroundRef === 'string' ? source.backgroundRef.trim() : '',
        entryNodeId,
        nodes,
        edges: asArray(source.edges).map((edge, edgeIndex) => normalizeEdge(edgeIndex, edge)),
        previewModes: asArray(source.previewModes).map((mode, modeIndex) => normalizePreviewMode(modeIndex, mode))
    };
}

function createUniqueId(existingIds, prefix) {
    let index = 1;
    while (existingIds.has(`${prefix}_${index}`)) {
        index += 1;
    }
    return `${prefix}_${index}`;
}

export class LevelMapWorkspace {
    constructor(rawDocument, options = {}) {
        const source = asObject(rawDocument);
        const levelsDocument = asObject(options.levelsDocument);
        this.availableLevelIds = uniqueStringList(options.levelIds || Object.keys(asObject(levelsDocument.levels)));
        this.schemaVersion = typeof source.$schemaVersion === 'string' && source.$schemaVersion.trim()
            ? source.$schemaVersion.trim()
            : 'level_map_pack_v1';
        this.meta = clone(asObject(source.meta));
        this.assetLibrary = normalizeLevelMapAssetLibrary(source.assetLibrary);
        this.maps = asArray(source.maps).map((map, index) => normalizeMap(index, map, this.availableLevelIds));
    }

    exportDocument() {
        return {
            $schemaVersion: this.schemaVersion,
            meta: clone(this.meta),
            assetLibrary: clone(this.assetLibrary),
            maps: clone(this.maps)
        };
    }

    listMaps() {
        return this.maps.map(map => clone(map));
    }

    getMap(mapId) {
        const map = this.maps.find(item => item.id === mapId);
        return map ? clone(map) : null;
    }

    getLevelIds() {
        return [...this.availableLevelIds];
    }

    getBackgroundOptions() {
        return clone(this.assetLibrary.backgrounds);
    }

    getNodeSkinOptions() {
        return clone(this.assetLibrary.nodeSkins);
    }

    getNodeArtOptions() {
        return clone(this.assetLibrary.nodeArts);
    }

    getPortraitOptions() {
        return clone(this.assetLibrary.portraits);
    }

    updateMap(mapId, updater) {
        const index = this.maps.findIndex(item => item.id === mapId);
        if (index < 0) {
            throw new Error(`地图不存在: ${mapId}`);
        }

        const current = clone(this.maps[index]);
        const next = updater(current);
        this.maps[index] = normalizeMap(index, next, this.availableLevelIds);
        return this.getMap(mapId);
    }

    createNode(mapId, options = {}) {
        let createdNodeId = '';
        this.updateMap(mapId, (map) => {
            const existingIds = new Set(map.nodes.map(node => node.id));
            createdNodeId = typeof options.id === 'string' && options.id.trim() && !existingIds.has(options.id.trim())
                ? options.id.trim()
                : createUniqueId(existingIds, 'node');
            const fallbackLevelId = options.levelId || this.availableLevelIds[0] || '';
            const node = normalizeNode(map.nodes.length, {
                ...options,
                id: createdNodeId,
                levelId: fallbackLevelId
            }, fallbackLevelId);
            map.nodes.push(node);
            if (!map.entryNodeId) {
                map.entryNodeId = createdNodeId;
            }
            return map;
        });
        return createdNodeId;
    }

    updateNode(mapId, nodeId, updater) {
        return this.updateMap(mapId, (map) => {
            map.nodes = map.nodes.map((node, index) => {
                if (node.id !== nodeId) return node;
                return normalizeNode(index, updater(clone(node)), this.availableLevelIds[0] || '');
            });
            return map;
        });
    }

    moveNode(mapId, nodeId, position) {
        return this.updateNode(mapId, nodeId, (node) => ({
            ...node,
            position: {
                x: toFiniteNumber(position?.x, node.position?.x),
                y: toFiniteNumber(position?.y, node.position?.y)
            }
        }));
    }

    removeNode(mapId, nodeId) {
        return this.updateMap(mapId, (map) => {
            map.nodes = map.nodes.filter(node => node.id !== nodeId);
            map.edges = map.edges.filter(edge => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId);
            if (map.entryNodeId === nodeId) {
                map.entryNodeId = map.nodes[0]?.id || '';
            }
            map.previewModes = map.previewModes.map((mode, index) => normalizePreviewMode(index, {
                ...mode,
                focusNodeId: mode.focusNodeId === nodeId ? (map.entryNodeId || map.nodes[0]?.id || '') : mode.focusNodeId,
                unlockedNodeIds: mode.unlockedNodeIds.filter(id => id !== nodeId),
                completedNodeIds: mode.completedNodeIds.filter(id => id !== nodeId)
            }));
            return map;
        });
    }

    createEdge(mapId, options = {}) {
        let createdEdgeId = '';
        this.updateMap(mapId, (map) => {
            const existingIds = new Set(map.edges.map(edge => edge.id));
            createdEdgeId = typeof options.id === 'string' && options.id.trim() && !existingIds.has(options.id.trim())
                ? options.id.trim()
                : createUniqueId(existingIds, 'edge');
            map.edges.push(normalizeEdge(map.edges.length, {
                ...options,
                id: createdEdgeId
            }));
            return map;
        });
        return createdEdgeId;
    }

    updateEdge(mapId, edgeId, updater) {
        return this.updateMap(mapId, (map) => {
            map.edges = map.edges.map((edge, index) => {
                if (edge.id !== edgeId) return edge;
                return normalizeEdge(index, updater(clone(edge)));
            });
            return map;
        });
    }

    removeEdge(mapId, edgeId) {
        return this.updateMap(mapId, (map) => {
            map.edges = map.edges.filter(edge => edge.id !== edgeId);
            return map;
        });
    }

    setBackgroundRef(mapId, backgroundRef) {
        return this.updateMap(mapId, (map) => ({
            ...map,
            backgroundRef: typeof backgroundRef === 'string' ? backgroundRef.trim() : ''
        }));
    }

    setEntryNodeId(mapId, nodeId) {
        return this.updateMap(mapId, (map) => ({
            ...map,
            entryNodeId: typeof nodeId === 'string' ? nodeId.trim() : ''
        }));
    }

    validateDocument() {
        const issues = [];
        const knownLevelIds = new Set(this.availableLevelIds);
        const knownBackgroundIds = new Set(this.assetLibrary.backgrounds.map(item => item.id));
        const knownSkinIds = new Set(this.assetLibrary.nodeSkins.map(item => item.id));
        const knownNodeArtIds = new Set(this.assetLibrary.nodeArts.map(item => item.id));
        const knownPortraitIds = new Set(this.assetLibrary.portraits.map(item => item.id));

        this.maps.forEach((map) => {
            const nodeIds = new Set(map.nodes.map(node => node.id));
            if (!map.entryNodeId || !nodeIds.has(map.entryNodeId)) {
                issues.push({
                    code: 'missing_entry_node',
                    mapId: map.id,
                    entryNodeId: map.entryNodeId
                });
            }

            map.nodes.forEach((node) => {
                if (node.levelId && knownLevelIds.size > 0 && !knownLevelIds.has(node.levelId)) {
                    issues.push({
                        code: 'missing_level_ref',
                        mapId: map.id,
                        nodeId: node.id,
                        levelId: node.levelId
                    });
                }
                if (node.nodeSkinRef && !knownSkinIds.has(node.nodeSkinRef)) {
                    issues.push({
                        code: 'missing_node_skin_ref',
                        mapId: map.id,
                        nodeId: node.id,
                        nodeSkinRef: node.nodeSkinRef
                    });
                }
                if (node.artRefs?.nodeArt && !knownNodeArtIds.has(node.artRefs.nodeArt)) {
                    issues.push({
                        code: 'missing_node_art_ref',
                        mapId: map.id,
                        nodeId: node.id,
                        nodeArtRef: node.artRefs.nodeArt
                    });
                }
                if (node.artRefs?.portrait && !knownPortraitIds.has(node.artRefs.portrait)) {
                    issues.push({
                        code: 'missing_portrait_ref',
                        mapId: map.id,
                        nodeId: node.id,
                        portraitRef: node.artRefs.portrait
                    });
                }
            });

            if (map.backgroundRef && !knownBackgroundIds.has(map.backgroundRef)) {
                issues.push({
                    code: 'missing_background_ref',
                    mapId: map.id,
                    backgroundRef: map.backgroundRef
                });
            }

            map.edges.forEach((edge) => {
                if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
                    issues.push({
                        code: 'missing_node_ref',
                        mapId: map.id,
                        edgeId: edge.id,
                        fromNodeId: edge.fromNodeId,
                        toNodeId: edge.toNodeId
                    });
                }
            });
        });

        return issues;
    }
}

export default LevelMapWorkspace;
