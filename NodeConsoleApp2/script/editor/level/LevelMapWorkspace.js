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

function normalizeStory(index, story, fallbackChapterIds = []) {
    const source = asObject(story);
    const chapterIds = uniqueStringList(source.chapterIds || fallbackChapterIds);
    const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `story_${index + 1}`;
    const entryChapterId = typeof source.entryChapterId === 'string' && source.entryChapterId.trim()
        ? source.entryChapterId.trim()
        : chapterIds[0] || '';
    return {
        id,
        title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : `未命名故事 ${index + 1}`,
        summary: typeof source.summary === 'string' ? source.summary : '',
        entryChapterId,
        chapterIds
    };
}

function normalizeChapter(index, chapter, fallbackStoryId = 'story_default', fallbackMapIds = []) {
    const source = asObject(chapter);
    const mapIds = uniqueStringList(source.mapIds || fallbackMapIds);
    const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `chapter_${index + 1}`;
    const entryMapId = typeof source.entryMapId === 'string' && source.entryMapId.trim()
        ? source.entryMapId.trim()
        : mapIds[0] || '';
    const order = Math.max(1, Math.round(toFiniteNumber(source.order, index + 1)));
    return {
        id,
        storyId: typeof source.storyId === 'string' && source.storyId.trim() ? source.storyId.trim() : fallbackStoryId,
        title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : `未命名章节 ${index + 1}`,
        order,
        description: typeof source.description === 'string' ? source.description : '',
        entryMapId,
        mapIds
    };
}

function buildLegacyStructure(meta, maps) {
    const chapterMap = new Map();
    maps.forEach((map, index) => {
        const chapterId = map.chapterId || `chapter_${index + 1}`;
        map.chapterId = chapterId;
        if (!chapterMap.has(chapterId)) {
            chapterMap.set(chapterId, {
                id: chapterId,
                storyId: 'story_default',
                title: map.chapterTitle || map.chapterLabel || map.name || `未命名章节 ${chapterMap.size + 1}`,
                order: chapterMap.size + 1,
                description: '',
                entryMapId: map.id,
                mapIds: []
            });
        }
        chapterMap.get(chapterId).mapIds.push(map.id);
    });

    const chapters = Array.from(chapterMap.values()).map((chapter, index) => normalizeChapter(index, chapter, 'story_default', chapter.mapIds));
    const story = normalizeStory(0, {
        id: 'story_default',
        title: typeof meta?.title === 'string' && meta.title.trim() ? meta.title.trim() : '默认故事',
        summary: '',
        entryChapterId: chapters[0]?.id || '',
        chapterIds: chapters.map(chapter => chapter.id)
    }, chapters.map(chapter => chapter.id));
    return {
        stories: [story],
        chapters
    };
}

function createUniqueId(existingIds, prefix) {
    let index = 1;
    while (existingIds.has(`${prefix}_${index}`)) {
        index += 1;
    }
    return `${prefix}_${index}`;
}

function basenameFromPath(src) {
    const text = typeof src === 'string' ? src.trim() : '';
    if (!text) return '';
    return text.split(/[\\/]/u).filter(Boolean).pop() || '';
}

function mapAssetDependencies(items, groupName) {
    return asArray(items)
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
    const library = asObject(assetLibrary);
    return {
        backgrounds: mapAssetDependencies(library.backgrounds, 'backgrounds'),
        nodeArts: mapAssetDependencies(library.nodeArts, 'nodeArts'),
        portraits: mapAssetDependencies(library.portraits, 'portraits')
    };
}

function normalizeLevelsDocument(levelsDocument) {
    const source = asObject(levelsDocument);
    return {
        $schemaVersion: typeof source.$schemaVersion === 'string' && source.$schemaVersion.trim()
            ? source.$schemaVersion.trim()
            : 'levels_v1_wrapped',
        meta: clone(asObject(source.meta)),
        enemyPools: clone(asObject(source.enemyPools)),
        levels: clone(asObject(source.levels))
    };
}

export class LevelMapWorkspace {
    static createNewPackageDocument(options = {}) {
        const packageId = typeof options.packageId === 'string' && options.packageId.trim()
            ? options.packageId.trim()
            : 'story_pack_v1';
        const packageTitle = typeof options.packageTitle === 'string' && options.packageTitle.trim()
            ? options.packageTitle.trim()
            : packageId;
        const baseDocument = asObject(options.baseDocument);
        const levelsDocument = asObject(options.levelsDocument);
        const assetLibrary = normalizeLevelMapAssetLibrary(baseDocument.assetLibrary);
        const firstLevelId = Object.keys(asObject(levelsDocument.levels))[0] || '';
        const firstBackgroundRef = assetLibrary.backgrounds[0]?.id || '';
        const firstNodeSkinRef = assetLibrary.nodeSkins[0]?.id || '';
        const firstNodeArtRef = assetLibrary.nodeArts[0]?.id || '';

        return {
            $schemaVersion: 'level_map_pack_v1',
            meta: {
                id: packageId,
                title: packageTitle,
                status: 'draft'
            },
            stories: [
                {
                    id: 'story_default',
                    title: packageTitle,
                    summary: '',
                    entryChapterId: 'chapter_1',
                    chapterIds: ['chapter_1']
                }
            ],
            chapters: [
                {
                    id: 'chapter_1',
                    storyId: 'story_default',
                    title: '第一章',
                    order: 1,
                    description: '',
                    entryMapId: 'map_chapter_1',
                    mapIds: ['map_chapter_1']
                }
            ],
            assetLibrary,
            maps: [
                {
                    id: 'map_chapter_1',
                    name: '第一章地图',
                    chapterId: 'chapter_1',
                    chapterLabel: '第一章',
                    chapterTitle: '第一章',
                    space: {
                        logicalWidth: 1600,
                        logicalHeight: 900
                    },
                    display: {
                        viewportAspect: '16:9',
                        backgroundFit: 'cover',
                        nodeScale: 0.6,
                        nodeAnchor: 'center',
                        edgeAnchor: 'center',
                        edgeLabelMode: 'midpoint'
                    },
                    backgroundRef: firstBackgroundRef,
                    entryNodeId: 'node_1',
                    nodes: [
                        {
                            id: 'node_1',
                            levelId: firstLevelId,
                            label: '1-1',
                            title: '入口节点',
                            kind: 'main',
                            nodeSkinRef: firstNodeSkinRef,
                            iconLabel: '入口',
                            position: {
                                x: 280,
                                y: 450
                            },
                            objectiveText: '',
                            difficultyLabel: '标准',
                            rewardPreview: [],
                            artRefs: {
                                nodeArt: firstNodeArtRef,
                                portrait: ''
                            }
                        }
                    ],
                    edges: [],
                    previewModes: []
                }
            ]
        };
    }

    constructor(rawDocument, options = {}) {
        const source = asObject(rawDocument);
        const levelsDocument = asObject(options.levelsDocument);
        this.levelsDocument = normalizeLevelsDocument(levelsDocument);
        this.availableLevelIds = uniqueStringList(options.levelIds || Object.keys(asObject(levelsDocument.levels)));
        this.schemaVersion = typeof source.$schemaVersion === 'string' && source.$schemaVersion.trim()
            ? source.$schemaVersion.trim()
            : 'level_map_pack_v1';
        this.meta = clone(asObject(source.meta));
        this.assetLibrary = normalizeLevelMapAssetLibrary(source.assetLibrary);
        this.maps = asArray(source.maps).map((map, index) => normalizeMap(index, map, this.availableLevelIds));
        const legacyStructure = buildLegacyStructure(this.meta, this.maps);
        this.chapters = asArray(source.chapters).length
            ? asArray(source.chapters).map((chapter, index) => normalizeChapter(index, chapter, 'story_default'))
            : legacyStructure.chapters;
        this.stories = asArray(source.stories).length
            ? asArray(source.stories).map((story, index) => normalizeStory(index, story))
            : legacyStructure.stories;
        this.reconcileStoryStructure();
    }

    exportDocument() {
        return {
            $schemaVersion: this.schemaVersion,
            meta: clone(this.meta),
            stories: clone(this.stories),
            chapters: clone(this.chapters),
            assetLibrary: clone(this.assetLibrary),
            maps: clone(this.maps)
        };
    }

    exportPackageBundle(options = {}) {
        const mapsJson = this.exportDocument();
        const meta = asObject(mapsJson.meta);
        const stories = asArray(mapsJson.stories);
        const chapters = asArray(mapsJson.chapters);
        const packageId = typeof options.packageId === 'string' && options.packageId.trim()
            ? options.packageId.trim()
            : (meta.id || 'story_pack_v1');
        const title = typeof options.packageTitle === 'string' && options.packageTitle.trim()
            ? options.packageTitle.trim()
            : (meta.title || packageId);
        const entryStoryId = meta.entryStoryId || stories[0]?.id || '';
        const entryStory = stories.find(story => story.id === entryStoryId) || stories[0] || null;

        return {
            packageJson: {
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
                    maps: 'maps.json',
                    levels: 'levels.json'
                },
                assets: {
                    basePath: 'assets/',
                    manifest: 'asset-manifest.json'
                },
                stories: stories.map(story => ({
                    id: story.id,
                    title: story.title,
                    entryChapterId: story.entryChapterId,
                    chapterIds: asArray(story.chapterIds).map(chapterId => String(chapterId))
                }))
            },
            mapsJson,
            levelsJson: clone(this.levelsDocument),
            assetManifest: buildAssetManifest(mapsJson.assetLibrary)
        };
    }

    reconcileStoryStructure() {
        const mapIds = new Set(this.maps.map(map => map.id));
        const chapterIds = new Set(this.chapters.map(chapter => chapter.id));
        const primaryStory = this.stories[0] || normalizeStory(0, {
            id: 'story_default',
            title: this.meta.title || '默认故事'
        });
        const primaryStoryId = primaryStory.id;
        this.maps.forEach((map) => {
            if (!map.chapterId || !chapterIds.has(map.chapterId)) {
                const fallbackChapter = this.chapters[0] || normalizeChapter(0, { id: 'chapter_default', title: '默认章节' });
                if (!chapterIds.has(fallbackChapter.id)) {
                    this.chapters.push(fallbackChapter);
                    chapterIds.add(fallbackChapter.id);
                }
                map.chapterId = fallbackChapter.id;
            }
        });
        this.chapters = this.chapters.map((chapter, index) => {
            const next = normalizeChapter(index, {
                ...chapter,
                storyId: primaryStoryId
            }, primaryStoryId);
            const explicitMapIds = next.mapIds.filter(mapId => mapIds.has(mapId));
            const ownedMapIds = this.maps.filter(map => map.chapterId === next.id).map(map => map.id);
            next.mapIds = uniqueStringList([...explicitMapIds, ...ownedMapIds]);
            next.entryMapId = next.mapIds.includes(next.entryMapId) ? next.entryMapId : (next.mapIds[0] || '');
            return next;
        });

        const knownChapterIds = new Set(this.chapters.map(chapter => chapter.id));
        const chapterIdsForStory = this.chapters.map(chapter => chapter.id).filter(chapterId => knownChapterIds.has(chapterId));
        const nextStory = normalizeStory(0, {
            ...primaryStory,
            chapterIds: uniqueStringList([...primaryStory.chapterIds, ...chapterIdsForStory])
        }, chapterIdsForStory);
        nextStory.entryChapterId = nextStory.chapterIds.includes(nextStory.entryChapterId)
            ? nextStory.entryChapterId
            : (nextStory.chapterIds[0] || '');
        this.stories = [nextStory];
    }

    listStories() {
        return this.stories.map(story => clone(story));
    }

    listChapters(storyId = '') {
        const chapters = storyId
            ? this.chapters.filter(chapter => chapter.storyId === storyId)
            : this.chapters;
        return chapters.map(chapter => clone(chapter));
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

    createStory(options = {}) {
        if (this.stories.length >= 1) {
            throw new Error('一个地图包只能承载一个故事；请新建地图包来创建另一条故事线。');
        }
        const existingIds = new Set(this.stories.map(story => story.id));
        const storyId = typeof options.id === 'string' && options.id.trim() && !existingIds.has(options.id.trim())
            ? options.id.trim()
            : createUniqueId(existingIds, 'story');
        this.stories.push(normalizeStory(this.stories.length, {
            ...options,
            id: storyId,
            chapterIds: []
        }));
        return storyId;
    }

    createChapter(storyId, options = {}) {
        const story = this.stories.find(item => item.id === storyId);
        if (!story) {
            throw new Error(`故事不存在: ${storyId}`);
        }
        const existingIds = new Set(this.chapters.map(chapter => chapter.id));
        const chapterId = typeof options.id === 'string' && options.id.trim() && !existingIds.has(options.id.trim())
            ? options.id.trim()
            : createUniqueId(existingIds, 'chapter');
        const chapter = normalizeChapter(this.chapters.length, {
            ...options,
            id: chapterId,
            storyId,
            mapIds: []
        }, storyId);
        this.chapters.push(chapter);
        story.chapterIds = uniqueStringList([...story.chapterIds, chapterId]);
        if (!story.entryChapterId) {
            story.entryChapterId = chapterId;
        }
        return chapterId;
    }

    createMap(chapterId, options = {}) {
        const chapter = this.chapters.find(item => item.id === chapterId);
        if (!chapter) {
            throw new Error(`章节不存在: ${chapterId}`);
        }
        const existingIds = new Set(this.maps.map(map => map.id));
        const mapId = typeof options.id === 'string' && options.id.trim() && !existingIds.has(options.id.trim())
            ? options.id.trim()
            : createUniqueId(existingIds, 'map');
        const firstLevelId = this.availableLevelIds[0] || '';
        const defaultNode = normalizeNode(0, {
            id: 'node_1',
            levelId: firstLevelId,
            label: '1',
            title: '新节点',
            kind: 'main',
            position: { x: 240, y: 450 }
        }, firstLevelId);
        const map = normalizeMap(this.maps.length, {
            id: mapId,
            name: options.name || `新地图 ${this.maps.length + 1}`,
            chapterId,
            chapterTitle: chapter.title,
            backgroundRef: options.backgroundRef || this.assetLibrary.backgrounds[0]?.id || '',
            entryNodeId: options.entryNodeId || defaultNode.id,
            nodes: options.nodes || [defaultNode],
            edges: options.edges || [],
            space: options.space,
            display: options.display,
            previewModes: options.previewModes
        }, this.availableLevelIds);
        this.maps.push(map);
        chapter.mapIds = uniqueStringList([...chapter.mapIds, mapId]);
        if (!chapter.entryMapId) {
            chapter.entryMapId = mapId;
        }
        return mapId;
    }

    duplicateMap(mapId, options = {}) {
        const sourceMap = this.maps.find(map => map.id === mapId);
        if (!sourceMap) {
            throw new Error(`地图不存在: ${mapId}`);
        }
        const chapterId = options.chapterId || sourceMap.chapterId;
        const existingIds = new Set(this.maps.map(map => map.id));
        const copiedMapId = typeof options.id === 'string' && options.id.trim() && !existingIds.has(options.id.trim())
            ? options.id.trim()
            : createUniqueId(existingIds, `${sourceMap.id}_copy`);
        return this.createMap(chapterId, {
            ...clone(sourceMap),
            ...options,
            id: copiedMapId,
            name: options.name || `${sourceMap.name} 副本`
        });
    }

    removeMap(mapId) {
        const map = this.maps.find(item => item.id === mapId);
        if (!map) return false;
        this.maps = this.maps.filter(item => item.id !== mapId);
        this.chapters = this.chapters.map((chapter, index) => normalizeChapter(index, {
            ...chapter,
            mapIds: chapter.mapIds.filter(id => id !== mapId),
            entryMapId: chapter.entryMapId === mapId ? '' : chapter.entryMapId
        }, chapter.storyId));
        this.reconcileStoryStructure();
        return true;
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
        const normalized = normalizeMap(index, next, this.availableLevelIds);
        this.maps[index] = normalized;
        if (normalized.id !== mapId) {
            this.chapters = this.chapters.map((chapter, chapterIndex) => normalizeChapter(chapterIndex, {
                ...chapter,
                mapIds: chapter.mapIds.map(id => id === mapId ? normalized.id : id),
                entryMapId: chapter.entryMapId === mapId ? normalized.id : chapter.entryMapId
            }, chapter.storyId));
        }
        this.reconcileStoryStructure();
        return this.getMap(normalized.id);
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
