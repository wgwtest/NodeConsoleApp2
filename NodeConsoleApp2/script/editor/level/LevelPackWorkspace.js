function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
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

function toFiniteNumber(value, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

function compareLevels(left, right) {
    const leftFlow = asObject(left?.flow);
    const rightFlow = asObject(right?.flow);
    const leftKind = leftFlow.kind || 'story';
    const rightKind = rightFlow.kind || 'story';
    const kindPriority = {
        story: 0,
        acceptance: 1
    };

    if (leftKind !== rightKind) {
        const leftPriority = Object.prototype.hasOwnProperty.call(kindPriority, leftKind) ? kindPriority[leftKind] : 99;
        const rightPriority = Object.prototype.hasOwnProperty.call(kindPriority, rightKind) ? kindPriority[rightKind] : 99;
        if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
        }
        return leftKind.localeCompare(rightKind, 'zh-CN');
    }

    if (leftKind === 'story') {
        const chapterOrderDiff = toFiniteNumber(leftFlow.chapterOrder, 0) - toFiniteNumber(rightFlow.chapterOrder, 0);
        if (chapterOrderDiff !== 0) return chapterOrderDiff;
    }

    const orderDiff = toFiniteNumber(leftFlow.order, 0) - toFiniteNumber(rightFlow.order, 0);
    if (orderDiff !== 0) return orderDiff;

    return String(left?.id || '').localeCompare(String(right?.id || ''), 'zh-CN');
}

function normalizeWave(wave, index, defaultWaveType) {
    const source = asObject(wave);
    return {
        waveId: typeof source.waveId === 'string' && source.waveId.trim() ? source.waveId.trim() : `wave_${index + 1}`,
        waveType: typeof source.waveType === 'string' && source.waveType.trim() ? source.waveType.trim() : defaultWaveType,
        enemyPoolId: typeof source.enemyPoolId === 'string' ? source.enemyPoolId.trim() : ''
    };
}

function normalizeEnemyPool(poolId, pool) {
    const source = asObject(pool);
    return {
        id: poolId,
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : poolId,
        members: asArray(source.members).map((member, index) => {
            const sourceMember = asObject(member);
            return {
                templateId: typeof sourceMember.templateId === 'string' ? sourceMember.templateId.trim() : '',
                position: toFiniteNumber(sourceMember.position, index + 1)
            };
        })
    };
}

function normalizeLevel(levelId, level, defaults = {}) {
    const source = asObject(level);
    const flow = asObject(source.flow);
    const selectionMeta = asObject(source.selectionMeta);
    const battleRules = asObject(source.battleRules);
    const rewards = asObject(source.rewards);
    const battlePlayerState = asObject(source.battlePlayerState);
    const battlePlayerSkills = asObject(source.battlePlayerSkills);
    const flowKind = typeof flow.kind === 'string' && flow.kind.trim() ? flow.kind.trim() : 'story';

    const normalized = {
        id: levelId,
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : levelId,
        description: typeof source.description === 'string' ? source.description : '',
        flow: {
            kind: flowKind,
            order: toFiniteNumber(flow.order, defaults.order ?? 0)
        },
        background: typeof source.background === 'string' && source.background.trim()
            ? source.background.trim()
            : defaults.background,
        battleRules: {
            slotLayoutId: typeof battleRules.slotLayoutId === 'string' && battleRules.slotLayoutId.trim()
                ? battleRules.slotLayoutId.trim()
                : defaults.slotLayoutId
        },
        waves: asArray(source.waves).map((wave, index) => normalizeWave(wave, index, defaults.waveType)),
        rewards: {
            exp: toFiniteNumber(rewards.exp, 0),
            gold: toFiniteNumber(rewards.gold, 0),
            kp: toFiniteNumber(rewards.kp, 0)
        }
    };

    if (flowKind === 'story') {
        normalized.flow.chapterId = typeof flow.chapterId === 'string' && flow.chapterId.trim()
            ? flow.chapterId.trim()
            : defaults.chapterId;
        normalized.flow.chapterOrder = toFiniteNumber(flow.chapterOrder, defaults.chapterOrder ?? 1);
        normalized.flow.chapterLabel = typeof flow.chapterLabel === 'string' ? flow.chapterLabel : defaults.chapterLabel;
        normalized.flow.chapterTitle = typeof flow.chapterTitle === 'string' ? flow.chapterTitle : defaults.chapterTitle;
        normalized.flow.nodeLabel = typeof flow.nodeLabel === 'string' ? flow.nodeLabel : '';
        normalized.flow.objectiveText = typeof flow.objectiveText === 'string' ? flow.objectiveText : '';
        normalized.flow.nextLevelIds = uniqueStringList(flow.nextLevelIds);
    } else if (Array.isArray(flow.nextLevelIds)) {
        normalized.flow.nextLevelIds = uniqueStringList(flow.nextLevelIds);
    }

    if (Object.keys(selectionMeta).length > 0 || flowKind === 'story') {
        normalized.selectionMeta = {
            difficultyLabel: typeof selectionMeta.difficultyLabel === 'string' ? selectionMeta.difficultyLabel : '',
            enemyStyleTags: asArray(selectionMeta.enemyStyleTags).filter(tag => typeof tag === 'string' && tag.trim()).map(tag => tag.trim()),
            buildHint: typeof selectionMeta.buildHint === 'string' ? selectionMeta.buildHint : ''
        };
    }

    if (Object.keys(battlePlayerState).length > 0) {
        normalized.battlePlayerState = clone(battlePlayerState);
    }

    if (Object.keys(battlePlayerSkills).length > 0) {
        normalized.battlePlayerSkills = clone(battlePlayerSkills);
    }

    if (normalized.waves.length === 0) {
        normalized.waves = [normalizeWave({}, 0, defaults.waveType)];
    }

    return normalized;
}

function buildDefaultFlowDefaults(meta) {
    const enums = asObject(meta.enums);
    return {
        waveType: asArray(enums.waveTypes)[0] || 'fixed',
        slotLayoutId: asArray(enums.slotLayoutIds)[0] || 'default_v1',
        background: asArray(enums.backgrounds)[0] || '',
        chapterId: 'story_chapter_1',
        chapterOrder: 1,
        chapterLabel: '第一章',
        chapterTitle: '未命名章节'
    };
}

export class LevelPackWorkspace {
    constructor(rawDocument) {
        const source = asObject(rawDocument);
        this.meta = clone(asObject(source.meta));
        this.schemaVersion = typeof source.$schemaVersion === 'string' && source.$schemaVersion.trim()
            ? source.$schemaVersion.trim()
            : 'levels_v1_wrapped';
        this.defaults = buildDefaultFlowDefaults(this.meta);
        this.enemyPools = {};
        this.levels = {};

        const rawEnemyPools = asObject(source.enemyPools);
        Object.keys(rawEnemyPools).forEach((poolId) => {
            this.enemyPools[poolId] = normalizeEnemyPool(poolId, rawEnemyPools[poolId]);
        });

        const rawLevels = asObject(source.levels);
        const explicitNextLevelFlags = new Map();
        Object.keys(rawLevels).forEach((levelId) => {
            explicitNextLevelFlags.set(levelId, Array.isArray(rawLevels[levelId]?.flow?.nextLevelIds));
            this.levels[levelId] = normalizeLevel(levelId, rawLevels[levelId], this.defaults);
        });

        this.applyDerivedStoryLinks(explicitNextLevelFlags);
    }

    applyDerivedStoryLinks(explicitFlags = new Map()) {
        const storyLevels = this.listLevels({ kind: 'story' });
        const byChapter = new Map();

        storyLevels.forEach((level) => {
            const chapterId = level.flow.chapterId || '__default_story_chapter__';
            if (!byChapter.has(chapterId)) byChapter.set(chapterId, []);
            byChapter.get(chapterId).push(level);
        });

        byChapter.forEach((levels) => {
            levels.sort(compareLevels);
            levels.forEach((level, index) => {
                if (explicitFlags.get(level.id)) return;
                const nextLevel = levels[index + 1];
                this.levels[level.id].flow.nextLevelIds = nextLevel ? [nextLevel.id] : [];
            });
        });
    }

    exportDocument() {
        return {
            $schemaVersion: this.schemaVersion,
            meta: clone(this.meta),
            enemyPools: clone(this.enemyPools),
            levels: clone(this.levels)
        };
    }

    listLevels({ kind = null } = {}) {
        return Object.values(this.levels)
            .filter((level) => !kind || level.flow.kind === kind)
            .sort(compareLevels)
            .map(level => clone(level));
    }

    listEnemyPools() {
        return Object.values(this.enemyPools)
            .sort((left, right) => left.id.localeCompare(right.id, 'zh-CN'))
            .map(pool => clone(pool));
    }

    getLevel(levelId) {
        return this.levels[levelId] ? clone(this.levels[levelId]) : null;
    }

    getEnemyPool(poolId) {
        return this.enemyPools[poolId] ? clone(this.enemyPools[poolId]) : null;
    }

    getLevelIds() {
        return this.listLevels().map(level => level.id);
    }

    createLevel(options = {}) {
        const kind = typeof options.kind === 'string' && options.kind.trim() ? options.kind.trim() : 'story';
        const levelId = this.createUniqueLevelId(options.id, kind);
        const levelName = typeof options.name === 'string' && options.name.trim() ? options.name.trim() : `新关卡 ${levelId}`;
        const nextOrder = this.getNextOrder(kind, options.chapterId);
        const enemyPoolId = this.createUniqueEnemyPoolId(`pool_${levelId}_wave_1`);
        const flow = {
            kind,
            order: nextOrder
        };

        if (kind === 'story') {
            flow.chapterId = typeof options.chapterId === 'string' && options.chapterId.trim()
                ? options.chapterId.trim()
                : this.defaults.chapterId;
            flow.chapterOrder = toFiniteNumber(options.chapterOrder, this.defaults.chapterOrder);
            flow.chapterLabel = typeof options.chapterLabel === 'string' ? options.chapterLabel : this.defaults.chapterLabel;
            flow.chapterTitle = typeof options.chapterTitle === 'string' ? options.chapterTitle : this.defaults.chapterTitle;
            flow.nodeLabel = typeof options.nodeLabel === 'string' ? options.nodeLabel : '';
            flow.objectiveText = typeof options.objectiveText === 'string' ? options.objectiveText : '';
            flow.nextLevelIds = [];
        }

        this.enemyPools[enemyPoolId] = normalizeEnemyPool(enemyPoolId, {
            name: `${levelName} Wave 1 敌人池`,
            members: []
        });

        this.levels[levelId] = normalizeLevel(levelId, {
            id: levelId,
            name: levelName,
            description: typeof options.description === 'string' ? options.description : '',
            flow,
            selectionMeta: {
                difficultyLabel: kind === 'story' ? '标准' : '',
                enemyStyleTags: [],
                buildHint: ''
            },
            background: this.defaults.background,
            battleRules: {
                slotLayoutId: this.defaults.slotLayoutId
            },
            waves: [
                {
                    waveId: 'wave_1',
                    waveType: this.defaults.waveType,
                    enemyPoolId
                }
            ],
            rewards: {
                exp: 0,
                gold: 0,
                kp: 0
            }
        }, this.defaults);

        return levelId;
    }

    removeLevel(levelId) {
        if (!this.levels[levelId]) return false;
        const removedLevel = this.levels[levelId];
        delete this.levels[levelId];

        Object.values(this.levels).forEach((level) => {
            if (Array.isArray(level.flow?.nextLevelIds)) {
                level.flow.nextLevelIds = level.flow.nextLevelIds.filter(nextLevelId => nextLevelId !== levelId);
            }
        });

        asArray(removedLevel.waves).forEach((wave) => {
            const poolId = typeof wave.enemyPoolId === 'string' ? wave.enemyPoolId : '';
            if (poolId && !this.isEnemyPoolReferenced(poolId)) {
                delete this.enemyPools[poolId];
            }
        });

        return true;
    }

    updateLevel(levelId, updater) {
        const current = this.levels[levelId];
        if (!current) {
            throw new Error(`Unknown level: ${levelId}`);
        }

        const next = typeof updater === 'function'
            ? updater(clone(current))
            : { ...clone(current), ...asObject(updater) };

        this.levels[levelId] = normalizeLevel(levelId, next, this.defaults);
        return this.getLevel(levelId);
    }

    setNextLevelIds(levelId, nextLevelIds) {
        return this.updateLevel(levelId, (level) => ({
            ...level,
            flow: {
                ...level.flow,
                nextLevelIds: uniqueStringList(nextLevelIds).filter(nextId => nextId !== levelId)
            }
        }));
    }

    upsertEnemyPool(poolId, nextPool) {
        const nextId = this.createUniqueEnemyPoolId(poolId, poolId);
        this.enemyPools[nextId] = normalizeEnemyPool(nextId, nextPool);
        return this.getEnemyPool(nextId);
    }

    replaceEnemyPool(poolId, updater) {
        const current = this.enemyPools[poolId];
        if (!current) {
            throw new Error(`Unknown enemy pool: ${poolId}`);
        }
        const nextPool = typeof updater === 'function'
            ? updater(clone(current))
            : { ...clone(current), ...asObject(updater) };
        this.enemyPools[poolId] = normalizeEnemyPool(poolId, nextPool);
        return this.getEnemyPool(poolId);
    }

    validateDocument() {
        const issues = [];

        Object.values(this.levels).forEach((level) => {
            const nextLevelIds = uniqueStringList(level.flow?.nextLevelIds);
            nextLevelIds.forEach((nextLevelId) => {
                if (!this.levels[nextLevelId]) {
                    issues.push({
                        code: 'missing_next_level',
                        levelId: level.id,
                        nextLevelId
                    });
                }
            });

            asArray(level.waves).forEach((wave) => {
                if (!wave.enemyPoolId || !this.enemyPools[wave.enemyPoolId]) {
                    issues.push({
                        code: 'missing_enemy_pool',
                        levelId: level.id,
                        waveId: wave.waveId,
                        enemyPoolId: wave.enemyPoolId || ''
                    });
                }
            });
        });

        return issues;
    }

    getNextOrder(kind, chapterId = null) {
        const relatedLevels = this.listLevels({ kind })
            .filter((level) => kind !== 'story' || !chapterId || level.flow.chapterId === chapterId);
        const maxOrder = relatedLevels.reduce((currentMax, level) => Math.max(currentMax, toFiniteNumber(level.flow.order, 0)), 0);
        return maxOrder + 1;
    }

    isEnemyPoolReferenced(poolId) {
        return Object.values(this.levels).some(level => asArray(level.waves).some(wave => wave.enemyPoolId === poolId));
    }

    createUniqueLevelId(preferredId = null, kind = 'story') {
        const base = typeof preferredId === 'string' && preferredId.trim()
            ? preferredId.trim()
            : `level_${kind}_${Object.keys(this.levels).length + 1}`;
        let candidate = base;
        let suffix = 2;
        while (this.levels[candidate]) {
            candidate = `${base}_${suffix}`;
            suffix += 1;
        }
        return candidate;
    }

    createUniqueEnemyPoolId(preferredId = null, baseHint = null) {
        const rawBase = typeof preferredId === 'string' && preferredId.trim()
            ? preferredId.trim()
            : (typeof baseHint === 'string' && baseHint.trim() ? baseHint.trim() : `pool_${Object.keys(this.enemyPools).length + 1}`);
        let candidate = rawBase;
        let suffix = 2;
        while (this.enemyPools[candidate]) {
            candidate = `${rawBase}_${suffix}`;
            suffix += 1;
        }
        return candidate;
    }
}

export default LevelPackWorkspace;
