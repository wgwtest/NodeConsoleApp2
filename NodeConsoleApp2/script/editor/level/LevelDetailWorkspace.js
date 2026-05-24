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

function toStringId(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeRewardValue(value) {
    return Math.max(0, toFiniteNumber(value, 0));
}

function createLevelId(mapId, nodeId) {
    return `level_${toStringId(mapId) || 'map'}_${toStringId(nodeId) || 'node'}`.replace(/[^a-zA-Z0-9_]+/g, '_');
}

function getFirstEnum(meta, enumKey, fallback) {
    const values = asArray(asObject(meta?.enums)[enumKey]);
    return values[0] || fallback;
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

function findLevelPrimaryPoolId(level) {
    const firstWave = asArray(level?.waves)[0] || null;
    return toStringId(firstWave?.enemyPoolId);
}

function normalizeEnemyDoc(enemiesDocument) {
    const source = asObject(enemiesDocument);
    return source.enemies && typeof source.enemies === 'object'
        ? source.enemies
        : source;
}

export class LevelDetailWorkspace {
    constructor({ mapDocument, levelsDocument, enemiesDocument } = {}) {
        this.mapDocument = clone(asObject(mapDocument));
        this.levelsDocument = normalizeLevelsDocument(levelsDocument);
        this.enemiesDocument = clone(normalizeEnemyDoc(enemiesDocument));
        this.reconcilePrimaryEnemyFields();
    }

    get maps() {
        return asArray(this.mapDocument.maps);
    }

    get chapters() {
        return asArray(this.mapDocument.chapters);
    }

    get stories() {
        return asArray(this.mapDocument.stories);
    }

    get levels() {
        return this.levelsDocument.levels;
    }

    get enemyPools() {
        return this.levelsDocument.enemyPools;
    }

    reconcilePrimaryEnemyFields() {
        Object.values(this.levels).forEach((level) => {
            const poolId = findLevelPrimaryPoolId(level);
            const pool = poolId ? this.enemyPools[poolId] : null;
            const firstMember = asArray(pool?.members)[0] || null;
            if (!level.primaryEnemy || typeof level.primaryEnemy !== 'object' || Array.isArray(level.primaryEnemy)) {
                level.primaryEnemy = {
                    templateId: toStringId(firstMember?.templateId)
                };
            } else {
                level.primaryEnemy.templateId = toStringId(level.primaryEnemy.templateId || firstMember?.templateId);
            }
        });
    }

    listNodeLevelSummaries({ storyId = '', chapterId = '', mapId = '' } = {}) {
        const chapterIds = new Set(
            this.chapters
                .filter(chapter => !storyId || chapter.storyId === storyId)
                .filter(chapter => !chapterId || chapter.id === chapterId)
                .map(chapter => chapter.id)
        );
        return this.maps
            .filter(map => !mapId || map.id === mapId)
            .filter(map => chapterIds.size === 0 || chapterIds.has(map.chapterId))
            .flatMap((map) => asArray(map.nodes).map((node) => {
                const levelId = toStringId(node.levelId);
                const level = levelId ? this.levels[levelId] : null;
                const chapter = this.getChapterForMap(map.id);
                return {
                    storyId: this.getStoryForChapter(chapter?.id)?.id || '',
                    chapterId: chapter?.id || map.chapterId || '',
                    mapId: map.id,
                    nodeId: node.id,
                    levelId,
                    nodeLabel: node.label || '',
                    title: node.title || level?.name || node.label || node.id,
                    hasLevelDetail: Boolean(level),
                    issueCount: this.validateNodeLevel(map.id, node.id).length
                };
            }));
    }

    getMap(mapId) {
        return this.maps.find(map => map.id === mapId) || null;
    }

    getChapterForMap(mapId) {
        const map = this.getMap(mapId);
        if (!map) return null;
        return this.chapters.find(chapter => chapter.id === map.chapterId) || null;
    }

    getStoryForChapter(chapterId) {
        const chapter = this.chapters.find(item => item.id === chapterId);
        if (!chapter) return null;
        return this.stories.find(story => story.id === chapter.storyId) || this.stories[0] || null;
    }

    getNode(mapId, nodeId) {
        const map = this.getMap(mapId);
        return asArray(map?.nodes).find(node => node.id === nodeId) || null;
    }

    getLevel(levelId) {
        return this.levels[levelId] || null;
    }

    getLevelForNode({ mapId, nodeId } = {}) {
        const node = this.getNode(mapId, nodeId);
        const levelId = toStringId(node?.levelId);
        return levelId ? this.getLevel(levelId) : null;
    }

    ensureLevelForNode({ mapId, nodeId } = {}) {
        const map = this.getMap(mapId);
        const node = this.getNode(mapId, nodeId);
        if (!map || !node) {
            throw new Error(`地图节点不存在: ${mapId || '-'} / ${nodeId || '-'}`);
        }
        const existingLevel = this.getLevelForNode({ mapId, nodeId });
        if (existingLevel) return existingLevel;

        const levelId = node.levelId || createLevelId(map.id, node.id);
        node.levelId = levelId;
        const chapter = this.getChapterForMap(map.id);
        const order = this.listNodeLevelSummaries({ mapId: map.id }).findIndex(item => item.nodeId === node.id) + 1;
        this.levels[levelId] = {
            id: levelId,
            name: node.title || node.label || levelId,
            description: '',
            flow: {
                kind: 'story',
                order: Math.max(1, order),
                chapterId: chapter?.id || map.chapterId || '',
                chapterOrder: toFiniteNumber(chapter?.order, 1),
                chapterLabel: chapter?.title || '',
                chapterTitle: chapter?.title || '',
                nodeLabel: node.label || '',
                objectiveText: node.objectiveText || '',
                unlockRules: this.inferUnlockRules(map, node.id)
            },
            selectionMeta: {
                difficultyLabel: node.difficultyLabel || '标准',
                enemyStyleTags: [],
                buildHint: ''
            },
            background: getFirstEnum(this.levelsDocument.meta, 'backgrounds', ''),
            primaryEnemy: { templateId: '' },
            battleRules: {
                slotLayoutId: getFirstEnum(this.levelsDocument.meta, 'slotLayoutIds', 'default_v1'),
                victoryCondition: { type: 'defeat_all_enemies' },
                failureCondition: { type: 'player_hp_zero' }
            },
            waves: [
                {
                    waveId: 'wave_1',
                    waveType: getFirstEnum(this.levelsDocument.meta, 'waveTypes', 'fixed'),
                    enemyPoolId: this.createPrimaryPoolId(levelId)
                }
            ],
            rewards: {
                exp: 0,
                gold: 0,
                kp: 0
            }
        };
        this.ensurePrimaryPool(levelId);
        return this.levels[levelId];
    }

    inferUnlockRules(map, nodeId) {
        const requiredNodeIds = asArray(map?.edges)
            .filter(edge => edge.toNodeId === nodeId)
            .map(edge => edge.fromNodeId)
            .filter(Boolean);
        if (requiredNodeIds.length === 0) {
            return { mode: 'always', requiredNodeIds: [] };
        }
        return {
            mode: 'after_nodes_cleared',
            requiredNodeIds
        };
    }

    createPrimaryPoolId(levelId) {
        return `pool_${levelId}_primary`;
    }

    ensurePrimaryPool(levelId) {
        const level = this.getLevel(levelId);
        if (!level) throw new Error(`关卡不存在: ${levelId}`);
        if (!Array.isArray(level.waves)) level.waves = [];
        if (!level.waves[0]) {
            level.waves[0] = {
                waveId: 'wave_1',
                waveType: getFirstEnum(this.levelsDocument.meta, 'waveTypes', 'fixed'),
                enemyPoolId: this.createPrimaryPoolId(levelId)
            };
        }
        if (!level.waves[0].enemyPoolId) {
            level.waves[0].enemyPoolId = this.createPrimaryPoolId(levelId);
        }
        const poolId = level.waves[0].enemyPoolId;
        if (!this.enemyPools[poolId]) {
            this.enemyPools[poolId] = {
                id: poolId,
                name: `${level.name || level.id}敌人`,
                members: []
            };
        }
        if (!Array.isArray(this.enemyPools[poolId].members)) {
            this.enemyPools[poolId].members = [];
        }
        if (!this.enemyPools[poolId].members[0]) {
            this.enemyPools[poolId].members[0] = { templateId: '', position: 1 };
        }
        return this.enemyPools[poolId];
    }

    getPrimaryEnemy(levelId) {
        const level = this.getLevel(levelId);
        if (!level) return { templateId: '' };
        const pool = this.ensurePrimaryPool(levelId);
        const member = asArray(pool.members)[0] || {};
        const templateId = toStringId(level.primaryEnemy?.templateId || member.templateId);
        return { templateId };
    }

    setPrimaryEnemy(levelId, templateId) {
        const level = this.getLevel(levelId);
        if (!level) throw new Error(`关卡不存在: ${levelId}`);
        const nextTemplateId = toStringId(templateId);
        level.primaryEnemy = { templateId: nextTemplateId };
        const pool = this.ensurePrimaryPool(levelId);
        pool.members[0] = {
            ...pool.members[0],
            templateId: nextTemplateId,
            position: pool.members[0]?.position ?? 1
        };
        return this.getPrimaryEnemy(levelId);
    }

    setBattleBackground(levelId, background) {
        const level = this.getLevel(levelId);
        if (!level) throw new Error(`关卡不存在: ${levelId}`);
        level.background = toStringId(background);
        return level.background;
    }

    updateLevelBasics(levelId, patch = {}) {
        const level = this.getLevel(levelId);
        if (!level) throw new Error(`关卡不存在: ${levelId}`);
        if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
            level.name = String(patch.name || '').trim() || level.id;
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
            level.description = String(patch.description || '');
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'difficultyLabel')) {
            level.selectionMeta = asObject(level.selectionMeta);
            level.selectionMeta.difficultyLabel = String(patch.difficultyLabel || '');
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'buildHint')) {
            level.selectionMeta = asObject(level.selectionMeta);
            level.selectionMeta.buildHint = String(patch.buildHint || '');
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'objectiveText')) {
            level.flow = asObject(level.flow);
            level.flow.objectiveText = String(patch.objectiveText || '');
        }
        return level;
    }

    updateRewards(levelId, patch = {}) {
        const level = this.getLevel(levelId);
        if (!level) throw new Error(`关卡不存在: ${levelId}`);
        level.rewards = {
            exp: normalizeRewardValue(patch.exp ?? level.rewards?.exp),
            gold: normalizeRewardValue(patch.gold ?? level.rewards?.gold),
            kp: normalizeRewardValue(patch.kp ?? level.rewards?.kp)
        };
        return clone(level.rewards);
    }

    exportMapDocument() {
        return clone(this.mapDocument);
    }

    exportAuthoringLevelsDocument() {
        return clone(this.levelsDocument);
    }

    exportRuntimeLevelsDocument() {
        Object.keys(this.levels).forEach((levelId) => {
            const primary = this.getPrimaryEnemy(levelId);
            this.setPrimaryEnemy(levelId, primary.templateId);
        });
        return clone(this.levelsDocument);
    }

    exportPackageBundle({
        packageId = '',
        packageTitle = '',
        packageStatus = 'authoring',
        assetManifest = null
    } = {}) {
        const resolvedPackageId = toStringId(packageId) || toStringId(this.mapDocument?.meta?.id) || 'story_pack_v1';
        const resolvedPackageTitle = String(packageTitle || this.mapDocument?.meta?.title || resolvedPackageId);
        const firstStory = this.stories[0] || null;
        const firstChapter = this.chapters.find(chapter => chapter.id === firstStory?.entryChapterId)
            || this.chapters[0]
            || null;
        const mapsJson = this.exportMapDocument();
        mapsJson.meta = {
            ...asObject(mapsJson.meta),
            id: resolvedPackageId,
            title: resolvedPackageTitle,
            status: packageStatus
        };

        return {
            packageJson: {
                $schemaVersion: 'level_map_package_v1',
                packageId: resolvedPackageId,
                packageVersion: '1.0.0',
                title: resolvedPackageTitle,
                status: packageStatus,
                entryStoryId: firstStory?.id || '',
                entryChapterId: firstChapter?.id || '',
                files: {
                    maps: 'maps.json',
                    levels: 'levels.json'
                },
                assets: {
                    basePath: 'assets/',
                    manifest: 'asset-manifest.json'
                },
                stories: clone(this.stories)
            },
            mapsJson,
            levelsJson: this.exportAuthoringLevelsDocument(),
            assetManifest: clone(assetManifest || asObject(this.mapDocument.assetManifest) || {})
        };
    }

    getKnownBattleBackgroundIds() {
        const enumBackgrounds = asArray(asObject(this.levelsDocument.meta?.enums).backgrounds);
        const library = asObject(this.mapDocument.assetLibrary);
        const libraryBackgrounds = [
            ...asArray(library.battleBackgrounds),
            ...asArray(library.backgrounds)
        ].map(item => item.id).filter(Boolean);
        return new Set([...enumBackgrounds, ...libraryBackgrounds]);
    }

    validateNodeLevel(mapId, nodeId) {
        const node = this.getNode(mapId, nodeId);
        if (!node) {
            return [{ code: 'missing_node', mapId, nodeId }];
        }
        const levelId = toStringId(node.levelId);
        if (!levelId) {
            return [{ code: 'missing_level_binding', mapId, nodeId }];
        }
        const level = this.getLevel(levelId);
        if (!level) {
            return [{ code: 'missing_level_detail', mapId, nodeId, levelId }];
        }
        return this.validateLevel(levelId, { mapId, nodeId });
    }

    validateLevel(levelId, context = {}) {
        const issues = [];
        const level = this.getLevel(levelId);
        if (!level) {
            return [{ code: 'missing_level_detail', levelId, ...context }];
        }
        const primaryEnemy = this.getPrimaryEnemy(levelId);
        if (!primaryEnemy.templateId) {
            issues.push({ code: 'missing_primary_enemy', levelId, ...context });
        } else if (!this.enemiesDocument[primaryEnemy.templateId]) {
            issues.push({
                code: 'missing_enemy_template',
                levelId,
                templateId: primaryEnemy.templateId,
                ...context
            });
        }
        const backgroundIds = this.getKnownBattleBackgroundIds();
        if (level.background && backgroundIds.size > 0 && !backgroundIds.has(level.background)) {
            issues.push({
                code: 'missing_battle_background',
                levelId,
                background: level.background,
                ...context
            });
        }
        ['exp', 'gold', 'kp'].forEach((rewardKey) => {
            const value = toFiniteNumber(level.rewards?.[rewardKey], Number.NaN);
            if (!Number.isFinite(value) || value < 0) {
                issues.push({ code: 'invalid_reward_value', levelId, rewardKey, ...context });
            }
        });
        return issues;
    }

    validatePackage() {
        const issues = [];
        const levelBindingCounts = new Map();
        this.maps.forEach((map) => {
            asArray(map.nodes).forEach((node) => {
                const levelId = toStringId(node.levelId);
                if (levelId) {
                    levelBindingCounts.set(levelId, (levelBindingCounts.get(levelId) || 0) + 1);
                }
                issues.push(...this.validateNodeLevel(map.id, node.id));
            });
        });
        levelBindingCounts.forEach((count, levelId) => {
            if (count > 1) {
                issues.push({ code: 'duplicate_level_binding', levelId, count });
            }
        });
        Object.keys(this.levels).forEach((levelId) => {
            if (!levelBindingCounts.has(levelId)) {
                issues.push({ code: 'orphan_level_detail', levelId });
            }
        });
        return issues;
    }
}

export default LevelDetailWorkspace;
