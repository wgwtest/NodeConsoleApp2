import { buildContentPackOverrideKey, getContentPackOverride } from '../tooling/ContentPackOverrideStore.js';

const LEGACY_SAVE_STORAGE_KEY = 'save_game';
const LAST_SAVE_SLOT_STORAGE_KEY = 'save_game_last_slot';
const SAVE_SLOT_STORAGE_PREFIX = 'save_game_slot_';
const SAVE_SLOT_COUNT = 3;
const AUTO_SAVE_SLOT_ID = 'auto';

class DataManager {
    constructor() {
        this.dataConfig = {
            version: "1.0.0",
            timestamp: 0,
            global: null,
            runtime: null,
            settings: {
                audio: { bgmVolume: 0.8, sfxVolume: 1.0 },
                display: { showDamageNumbers: true }
            }
        };
        this.gameConfig = {}; // To store static configs like items, skills
        this._currentLevelConfig = null; // Runtime cache for current level static config
        this._dataSourcesVersion = null;
        this.contentRegistry = null;
        this.contentPacks = null;
        this.skillCatalog = null;
        this.buffCatalog = null;
        this.levelCatalog = null;
        this._enemySkillAliases = {
            skill_bite: 'skill_heavy_swing',
            skill_throw_stone: 'skill_skull_cracker',
            skill_smash: 'skill_hold_the_line',
            skill_warcry: 'skill_fortify',
            skill_heavy_smash: 'skill_execute',
            skill_rage: 'skill_1770396871360',
            skill_cleave: 'skill_earthquake',
            skill_ankle_bite: 'skill_artery_slice_copy_1769789197982',
            skill_escape: 'skill_shockwave_copy_1770041956468',
            skill_shield_bash: 'skill_skull_cracker',
            skill_bone_repair: 'skill_block'
        };
    }

    get dataSourcesVersion() {
        return this._dataSourcesVersion;
    }

    _unwrapBuffDefinitions(rawBuffs) {
        if (!rawBuffs || typeof rawBuffs !== 'object') return {};
        if (rawBuffs.buffs && typeof rawBuffs.buffs === 'object') return rawBuffs.buffs;
        return rawBuffs;
    }

    _unwrapLevelDefinitions(rawLevels) {
        if (!rawLevels || typeof rawLevels !== 'object') return {};
        if (rawLevels.levels && typeof rawLevels.levels === 'object') return rawLevels.levels;
        return rawLevels;
    }

    _getLevelEnemyPools(rawLevels) {
        if (!rawLevels || typeof rawLevels !== 'object') return {};
        return (rawLevels.enemyPools && typeof rawLevels.enemyPools === 'object')
            ? rawLevels.enemyPools
            : {};
    }

    _expandLevelEnemyPools(rawLevels) {
        const levels = this._unwrapLevelDefinitions(rawLevels);
        const enemyPools = this._getLevelEnemyPools(rawLevels);
        const expanded = Object.create(null);

        for (const [levelId, levelDef] of Object.entries(levels)) {
            const nextLevel = JSON.parse(JSON.stringify(levelDef || {}));
            const waves = Array.isArray(levelDef?.waves) ? levelDef.waves : [];
            nextLevel.waves = waves.map((wave, waveIndex) => {
                const nextWave = JSON.parse(JSON.stringify(wave || {}));
                const poolId = typeof nextWave.enemyPoolId === 'string' ? nextWave.enemyPoolId : null;
                const pool = poolId ? enemyPools[poolId] : null;
                const members = Array.isArray(pool?.members)
                    ? pool.members
                    : (Array.isArray(nextWave.enemies) ? nextWave.enemies : []);

                nextWave.waveId = nextWave.waveId || `wave_${waveIndex + 1}`;
                nextWave.waveType = nextWave.waveType || 'fixed';
                nextWave.enemies = members.map((member, memberIndex) => {
                    const cloned = JSON.parse(JSON.stringify(member || {}));
                    if (cloned.position === undefined || cloned.position === null || cloned.position === '') {
                        cloned.position = memberIndex + 1;
                    }
                    return cloned;
                });
                return nextWave;
            });
            expanded[levelId] = nextLevel;
        }

        return expanded;
    }

    _buildContentRegistry(dataSources) {
        const fallbackSources = (dataSources && typeof dataSources.sources === 'object') ? dataSources.sources : {};
        const inputRegistry = (dataSources && typeof dataSources.contentRegistry === 'object' && dataSources.contentRegistry)
            ? dataSources.contentRegistry
            : {};

        const cloneEntry = (entry) => (entry && typeof entry === 'object' ? JSON.parse(JSON.stringify(entry)) : null);
        const normalizePathEntry = (entry, fallbackPath, defaultKind, extra = {}) => {
            if (typeof entry === 'string') {
                return {
                    kind: defaultKind,
                    path: entry,
                    ...extra
                };
            }

            if (entry && typeof entry === 'object') {
                return {
                    kind: entry.kind || defaultKind,
                    ...cloneEntry(entry),
                    ...extra
                };
            }

            if (typeof fallbackPath === 'string' && fallbackPath.length > 0) {
                return {
                    kind: defaultKind,
                    path: fallbackPath,
                    ...extra
                };
            }

            return null;
        };

        const registry = {
            player: normalizePathEntry(inputRegistry.player, fallbackSources.player, 'player'),
            items: normalizePathEntry(inputRegistry.items, fallbackSources.items, 'items'),
            enemies: normalizePathEntry(inputRegistry.enemies, fallbackSources.enemies, 'enemies'),
            levels: normalizePathEntry(inputRegistry.levels, fallbackSources.levels, 'levels', { rootKey: 'levels' }),
            buffs: normalizePathEntry(inputRegistry.buffs, fallbackSources.buffs, 'buffs', { rootKey: 'buffs' }),
            slotLayouts: normalizePathEntry(inputRegistry.slotLayouts, fallbackSources.slotLayouts, 'slotLayouts', { required: false })
        };

        const skillsEntry = normalizePathEntry(inputRegistry.skills, fallbackSources.skills, 'skills', { rootKey: 'skills' }) || {
            kind: 'skills',
            path: fallbackSources.skills || null,
            rootKey: 'skills'
        };
        const inputSkillsByTree = (skillsEntry && skillsEntry.byTree && typeof skillsEntry.byTree === 'object')
            ? skillsEntry.byTree
            : ((fallbackSources.skillsByTree && typeof fallbackSources.skillsByTree === 'object') ? fallbackSources.skillsByTree : {});
        const normalizedByTree = {};
        for (const [treeId, treeEntry] of Object.entries(inputSkillsByTree)) {
            const normalizedTreeEntry = normalizePathEntry(treeEntry, null, 'skills');
            if (normalizedTreeEntry && normalizedTreeEntry.path) {
                normalizedByTree[treeId] = normalizedTreeEntry;
            }
        }
        skillsEntry.byTree = normalizedByTree;
        registry.skills = skillsEntry;

        return registry;
    }

    _getContentRegistryEntry(contentKey, options = {}) {
        if (!this.contentRegistry || typeof this.contentRegistry !== 'object') return null;
        const entry = this.contentRegistry[contentKey];
        if (!entry) return null;

        if (contentKey === 'skills' && options.skillTreeId && entry.byTree && entry.byTree[options.skillTreeId]) {
            const treeEntry = entry.byTree[options.skillTreeId];
            return {
                ...entry,
                ...treeEntry,
                basePath: entry.path,
                selectedTreeId: options.skillTreeId
            };
        }

        return entry;
    }

    _validateContentPack(contentKey, entry, rawPack) {
        if (!entry || !rawPack || typeof rawPack !== 'object') {
            throw new Error(`[DataManager] Invalid content pack for ${contentKey}.`);
        }

        const schemaVersion = entry.schemaVersion || null;
        if (schemaVersion && rawPack.$schemaVersion && rawPack.$schemaVersion !== schemaVersion) {
            throw new Error(`[DataManager] ${contentKey} schemaVersion mismatch. expected=${schemaVersion}, actual=${rawPack.$schemaVersion}`);
        }

        switch (contentKey) {
            case 'skills':
                if (!Array.isArray(rawPack.skills)) {
                    throw new Error('Skills data must provide a skills array.');
                }
                break;
            case 'buffs':
                if (!rawPack.buffs || typeof rawPack.buffs !== 'object') {
                    throw new Error('Buffs data must provide a buffs object.');
                }
                break;
            case 'levels':
                if (!rawPack.levels || typeof rawPack.levels !== 'object') {
                    throw new Error('Levels data must provide a levels object.');
                }
                if (!rawPack.enemyPools || typeof rawPack.enemyPools !== 'object') {
                    throw new Error('Levels data must provide an enemyPools object.');
                }
                break;
            default:
                break;
        }
    }

    _buildContentPackMeta(contentKey, entry, rawPack) {
        return {
            kind: entry.kind || contentKey,
            path: entry.path || null,
            schemaVersion: rawPack && typeof rawPack === 'object' ? (rawPack.$schemaVersion || entry.schemaVersion || null) : (entry.schemaVersion || null),
            rootKey: entry.rootKey || null,
            selectedTreeId: entry.selectedTreeId || null,
            meta: (rawPack && typeof rawPack === 'object') ? (rawPack.meta || null) : null
        };
    }

    _getContentPackOverride(contentKey, entry = null) {
        const scopeId = entry && entry.selectedTreeId ? entry.selectedTreeId : null;
        return getContentPackOverride(contentKey, scopeId);
    }

    _normalizeSkills(skills, playerTemplate) {
        const tpl = (playerTemplate && typeof playerTemplate.skills === 'object' && !Array.isArray(playerTemplate.skills))
            ? playerTemplate.skills
            : null;
        const source = (skills && typeof skills === 'object' && !Array.isArray(skills)) ? skills : tpl;
        if (source && typeof source === 'object' && !Array.isArray(source)) {
            const learned = Array.isArray(source.learned) ? source.learned : [];
            return {
                skillTreeId: source.skillTreeId ?? null,
                skillPoints: Number.isFinite(source.skillPoints) ? source.skillPoints : 0,
                learned: [...learned]
            };
        }

        return {
            skillTreeId: null,
            skillPoints: 0,
            learned: []
        };
    }

    _normalizePlayerResources(resources, playerTemplate = null) {
        const tpl = (playerTemplate && typeof playerTemplate.resources === 'object' && !Array.isArray(playerTemplate.resources))
            ? playerTemplate.resources
            : null;
        const source = (resources && typeof resources === 'object' && !Array.isArray(resources)) ? resources : tpl;
        return {
            exp: Number.isFinite(source?.exp) ? source.exp : 0,
            gold: Number.isFinite(source?.gold) ? source.gold : 0
        };
    }

    _normalizeLastLearnAction(lastLearnAction) {
        const source = (lastLearnAction && typeof lastLearnAction === 'object' && !Array.isArray(lastLearnAction))
            ? lastLearnAction
            : null;
        if (!source) return null;

        const normalizeStringList = (input) => Array.isArray(input)
            ? input
                .map(value => (typeof value === 'string' ? value.trim() : ''))
                .filter(Boolean)
            : [];

        const learnedSkillIds = normalizeStringList(source.learnedSkillIds);
        const learnedSkillNames = normalizeStringList(source.learnedSkillNames);
        const skillTreeId = (typeof source.skillTreeId === 'string' && source.skillTreeId.trim().length > 0)
            ? source.skillTreeId.trim()
            : null;
        const learnedCount = Number.isFinite(source.learnedCount)
            ? Math.max(0, Number(source.learnedCount) || 0)
            : Math.max(learnedSkillIds.length, learnedSkillNames.length);
        const spentKp = Number.isFinite(source.spentKp) ? Number(source.spentKp) || 0 : 0;
        const remainingKp = Number.isFinite(source.remainingKp) ? Number(source.remainingKp) || 0 : 0;
        const committedAt = (typeof source.committedAt === 'string' && source.committedAt.trim().length > 0)
            ? source.committedAt.trim()
            : null;

        if (!skillTreeId && learnedCount === 0 && learnedSkillIds.length === 0 && learnedSkillNames.length === 0 && spentKp === 0 && remainingKp === 0 && !committedAt) {
            return null;
        }

        return {
            skillTreeId,
            learnedSkillIds,
            learnedSkillNames,
            learnedCount,
            spentKp,
            remainingKp,
            committedAt
        };
    }

    _normalizeProgress(progress) {
        const source = (progress && typeof progress === 'object' && !Array.isArray(progress)) ? progress : {};
        const unlockedLevels = Array.isArray(source.unlockedLevels) && source.unlockedLevels.length > 0
            ? [...source.unlockedLevels]
            : ['level_1_1'];
        const completedQuests = Array.isArray(source.completedQuests) ? [...source.completedQuests] : [];
        const completedLevels = Array.isArray(source.completedLevels) ? [...source.completedLevels] : [];
        const flags = (source.flags && typeof source.flags === 'object' && !Array.isArray(source.flags))
            ? JSON.parse(JSON.stringify(source.flags))
            : {};

        return {
            unlockedLevels,
            completedQuests,
            completedLevels,
            flags,
            lastSettlement: source.lastSettlement ? JSON.parse(JSON.stringify(source.lastSettlement)) : null,
            lastLearnAction: this._normalizeLastLearnAction(source.lastLearnAction)
        };
    }

    recordSkillTreeLearnAction(lastLearnAction) {
        if (!this.dataConfig.global) return null;
        this.dataConfig.global.progress = this._normalizeProgress(this.dataConfig.global.progress);
        const progress = this.dataConfig.global.progress;
        progress.lastLearnAction = this._normalizeLastLearnAction(lastLearnAction);
        return progress.lastLearnAction;
    }

    _normalizeBattleRewards(rewards) {
        const source = (rewards && typeof rewards === 'object' && !Array.isArray(rewards)) ? rewards : {};
        return {
            exp: Number.isFinite(source.exp) ? source.exp : 0,
            gold: Number.isFinite(source.gold) ? source.gold : 0,
            kp: Number.isFinite(source.kp) ? source.kp : 0
        };
    }

    _normalizeLevelSelectionMeta(selectionMeta) {
        const source = (selectionMeta && typeof selectionMeta === 'object' && !Array.isArray(selectionMeta))
            ? selectionMeta
            : {};
        const enemyStyleTags = Array.isArray(source.enemyStyleTags)
            ? source.enemyStyleTags
                .map(tag => (typeof tag === 'string' ? tag.trim() : ''))
                .filter(Boolean)
            : [];
        const normalized = {
            difficultyLabel: typeof source.difficultyLabel === 'string' ? source.difficultyLabel.trim() : '',
            enemyStyleTags,
            buildHint: typeof source.buildHint === 'string' ? source.buildHint.trim() : ''
        };

        if (!normalized.difficultyLabel && normalized.enemyStyleTags.length === 0 && !normalized.buildHint) {
            return null;
        }

        return normalized;
    }

    _buildSkillCatalog(skillsMap, options = {}) {
        const map = (skillsMap && typeof skillsMap === 'object') ? skillsMap : Object.create(null);
        const list = Object.values(map);
        const packMeta = options.packMeta || this.getSkillPackMeta();
        const selectedTreeId = options.selectedTreeId
            || packMeta?.selectedTreeId
            || this.playerData?.skills?.skillTreeId
            || this.gameConfig?.player?.default?.skills?.skillTreeId
            || null;

        return {
            skillsMap: map,
            skillsList: list,
            selectedTreeId,
            schemaVersion: packMeta?.schemaVersion || null,
            meta: packMeta?.meta || null
        };
    }

    _buildBuffCatalog(buffsMap, options = {}) {
        const map = (buffsMap && typeof buffsMap === 'object') ? buffsMap : Object.create(null);
        const list = Object.values(map);
        const packMeta = options.packMeta || this.getBuffPackMeta();

        return {
            buffsMap: map,
            buffsList: list,
            schemaVersion: packMeta?.schemaVersion || null,
            meta: packMeta?.meta || null
        };
    }

    _buildLevelCatalog(levelsMap, options = {}) {
        const map = (levelsMap && typeof levelsMap === 'object') ? levelsMap : Object.create(null);
        const list = Object.values(map);
        const packMeta = options.packMeta || (typeof this.getLevelPackMeta === 'function' ? this.getLevelPackMeta() : null);

        return {
            levelsMap: map,
            levelsList: list,
            schemaVersion: packMeta?.schemaVersion || null,
            meta: packMeta?.meta || null
        };
    }

    get playerData() {
        return this.dataConfig.global ? this.dataConfig.global.player : null;
    }

    get currentLevelData() {
        return this._currentLevelConfig;
    }

    set currentLevelData(val) {
        this._currentLevelConfig = val;
    }

    // --- Persistence ---

    _normalizeSaveSlotId(slotId) {
        const numeric = Number(slotId);
        if (!Number.isInteger(numeric)) return null;
        if (numeric < 1 || numeric > SAVE_SLOT_COUNT) return null;
        return numeric;
    }

    _isAutoSaveSlot(slotId) {
        if (slotId === null || slotId === undefined) return true;
        if (typeof slotId === 'string' && slotId.toLowerCase() === AUTO_SAVE_SLOT_ID) return true;
        return false;
    }

    _getSlotStorageKey(slotId) {
        const normalized = this._normalizeSaveSlotId(slotId);
        return normalized ? `${SAVE_SLOT_STORAGE_PREFIX}${normalized}` : null;
    }

    _hasDedicatedSlotSave() {
        for (let slotId = 1; slotId <= SAVE_SLOT_COUNT; slotId++) {
            const key = this._getSlotStorageKey(slotId);
            if (key && localStorage.getItem(key)) {
                return true;
            }
        }
        return false;
    }

    _readSaveJson(slotId = null) {
        if (this._isAutoSaveSlot(slotId)) {
            return localStorage.getItem(LEGACY_SAVE_STORAGE_KEY);
        }

        const normalized = this._normalizeSaveSlotId(slotId);
        if (normalized) {
            const slotKey = this._getSlotStorageKey(normalized);
            const slotJson = slotKey ? localStorage.getItem(slotKey) : null;
            if (slotJson) return slotJson;
            return null;
        }
        return null;
    }

    _formatSaveTimestamp(timestamp) {
        if (!Number.isFinite(timestamp) || timestamp <= 0) return '空';
        try {
            return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
        } catch {
            return new Date(timestamp).toISOString();
        }
    }

    _extractSaveSlotMeta(slotId) {
        const isAuto = this._isAutoSaveSlot(slotId);
        const json = this._readSaveJson(slotId);
        const normalizedId = isAuto ? AUTO_SAVE_SLOT_ID : this._normalizeSaveSlotId(slotId);
        const title = isAuto ? '自动存档' : `手动槽位 ${normalizedId}`;
        if (!json) {
            return {
                id: normalizedId,
                slotType: isAuto ? 'auto' : 'manual',
                title,
                date: '空',
                level: '-',
                scene: '-',
                turn: '-',
                isEmpty: true
            };
        }

        try {
            const parsed = JSON.parse(json);
            const runtime = (parsed && typeof parsed.runtime === 'object') ? parsed.runtime : {};
            const levelName = runtime?.levelData?.name || runtime?.levelData?.id || (runtime?.currentScene === 'MAIN_MENU' ? '主菜单' : '-');
            const turn = Number.isFinite(runtime?.turn) ? runtime.turn : '-';
            return {
                id: normalizedId,
                slotType: isAuto ? 'auto' : 'manual',
                title,
                date: this._formatSaveTimestamp(Number(parsed?.timestamp)),
                level: levelName,
                scene: runtime?.currentScene || '-',
                turn,
                isEmpty: false
            };
        } catch {
            return {
                id: normalizedId,
                slotType: isAuto ? 'auto' : 'manual',
                title,
                date: '损坏',
                level: '-',
                scene: '-',
                turn: '-',
                isEmpty: true
            };
        }
    }

    getSaveList() {
        const list = [this._extractSaveSlotMeta(AUTO_SAVE_SLOT_ID)];
        for (let slotId = 1; slotId <= SAVE_SLOT_COUNT; slotId++) {
            list.push(this._extractSaveSlotMeta(slotId));
        }
        return list;
    }

    hasAnySave() {
        if (localStorage.getItem(LEGACY_SAVE_STORAGE_KEY)) {
            return true;
        }
        return this._hasDedicatedSlotSave();
    }

    saveGame(slotId = null) {
        const isAutoSlot = this._isAutoSaveSlot(slotId);
        const normalizedSlotId = isAutoSlot ? null : this._normalizeSaveSlotId(slotId);
        if (!isAutoSlot && slotId !== null && slotId !== undefined && !normalizedSlotId) {
            return false;
        }

        if (this.dataConfig.global) {
            // Sync runtime data before saving
            if (!this.dataConfig.runtime) {
                this.dataConfig.runtime = {};
            }
            
            // Save current level state (including enemies HP)
            if (this._currentLevelConfig) {
                this.dataConfig.runtime.levelData = this._currentLevelConfig;
            } else {
                delete this.dataConfig.runtime.levelData;
            }

            this.dataConfig.timestamp = Date.now();
            if (this._dataSourcesVersion) {
                this.dataConfig.dataSourcesVersion = this._dataSourcesVersion;
            }
            const json = JSON.stringify(this.dataConfig);
            localStorage.setItem(LEGACY_SAVE_STORAGE_KEY, json);

            if (normalizedSlotId) {
                const slotKey = this._getSlotStorageKey(normalizedSlotId);
                if (slotKey) {
                    localStorage.setItem(slotKey, json);
                    localStorage.setItem(LAST_SAVE_SLOT_STORAGE_KEY, String(normalizedSlotId));
                }
            }

            console.log('Game saved.');
            return true;
        }
        return false;
    }

    loadGame(slotId = null) {
        const isAutoSlot = this._isAutoSaveSlot(slotId);
        const normalizedSlotId = isAutoSlot ? null : this._normalizeSaveSlotId(slotId);
        if (!isAutoSlot && slotId !== null && slotId !== undefined && !normalizedSlotId) {
            return false;
        }
        const json = this._readSaveJson(normalizedSlotId);
        if (json) {
            try {
                const parsed = JSON.parse(json);
                const playerTemplate = (this.gameConfig && this.gameConfig.player && this.gameConfig.player.default)
                    ? this.gameConfig.player.default
                    : null;
                
                if (!parsed.version || !parsed.global) {
                    return false;
                }

                // Version guard: invalidate saves created from different data sources config
                const saveSourcesVer = parsed.dataSourcesVersion || null;
                if (this._dataSourcesVersion && saveSourcesVer && saveSourcesVer !== this._dataSourcesVersion) {
                    console.warn(`?? [DataManager] Save dataSourcesVersion mismatch. save=${saveSourcesVer}, current=${this._dataSourcesVersion}. Ignoring save.`);
                    return false;
                }

                this.dataConfig = parsed;

                // Restore runtime level data
                if (this.dataConfig.runtime && this.dataConfig.runtime.levelData) {
                    this._currentLevelConfig = this.dataConfig.runtime.levelData;
                } else {
                    this._currentLevelConfig = null;
                }

                // Migration/Normalization: skills schema (object) + backward compatibility
                if (this.playerData) {
                    this.playerData.skills = this._normalizeSkills(this.playerData.skills, playerTemplate);
                    this.playerData.resources = this._normalizePlayerResources(this.playerData.resources, playerTemplate);
                }
                if (this.dataConfig.global) {
                    this.dataConfig.global.progress = this._normalizeProgress(this.dataConfig.global.progress);
                }

                localStorage.setItem(LEGACY_SAVE_STORAGE_KEY, json);
                if (!isAutoSlot && normalizedSlotId) {
                    localStorage.setItem(LAST_SAVE_SLOT_STORAGE_KEY, String(normalizedSlotId));
                }
                
                console.log('Game loaded.');
                return true;
            } catch (e) {
                console.error("Failed to load save game:", e);
                return false;
            }
        }
        return false;
    }

    createNewGame(username) {
        const playerTemplate = (this.gameConfig && this.gameConfig.player && this.gameConfig.player.default) 
            ? this.gameConfig.player.default 
            : null;
        if (!playerTemplate) {
            throw new Error('Missing player default config.');
        }

        this.dataConfig.global = {
            player: {
                id: `player_${Date.now()}`,
                name: username,
                stats: { ...playerTemplate.stats },
                skills: this._normalizeSkills(playerTemplate.skills, playerTemplate),
                resources: this._normalizePlayerResources(playerTemplate.resources, playerTemplate),
                bodyParts: playerTemplate.bodyParts ? JSON.parse(JSON.stringify(playerTemplate.bodyParts)) : undefined,
                equipment: JSON.parse(JSON.stringify(playerTemplate.equipment)),
                inventory: [...playerTemplate.inventory],
            },
            progress: this._normalizeProgress({
                unlockedLevels: ['level_1_1'],
                completedQuests: [],
                flags: {}
            })
        };

        this.dataConfig.runtime = {
            currentScene: "MAIN_MENU",
            battleState: null
        };

        console.log('New game created.');
        return this.playerData;
    }

    // --- Asset Loading ---

    async loadConfigs() {
        try {
            const normalizeUrl = (input, base = null) => {
                if (!input || typeof input !== 'string') return input;
                if (/^https?:\/\//i.test(input)) return input;
                if (input.startsWith('/')) return input;
                if (base) {
                    try {
                        return new URL(input, base).toString();
                    } catch {
                        // fall through
                    }
                }
                if (input.startsWith('./')) return `/${input.slice(2)}`;
                if (input.startsWith('../')) return input;
                return input;
            };

            // Try to fetch JSON files via data sources config
            // Note: This requires the app to be served via HTTP/HTTPS. 
            // If running from file://, this will likely fail and fall back to mock data.
            const configUrl = (typeof window !== 'undefined' && window.DATA_CONFIG_URL)
                ? window.DATA_CONFIG_URL
                : '/assets/data/config.json';

            const normalizedConfigUrl = normalizeUrl(configUrl, (typeof window !== 'undefined' && window.location)
                ? window.location.href
                : null);

            const configResponse = await fetch(normalizedConfigUrl);
            if (!configResponse.ok) {
                throw new Error(`HTTP error ${configResponse.status} loading ${normalizedConfigUrl}`);
            }

            const dataSources = await configResponse.json();
            this._dataSourcesVersion = dataSources && typeof dataSources.version === 'string' ? dataSources.version : null;
            const originBase = (typeof window !== 'undefined' && window.location)
                ? `${window.location.origin}/`
                : null;
            const basePath = normalizeUrl(dataSources.basePath || '', originBase) || '';
            const registry = this._buildContentRegistry(dataSources);
            this.contentRegistry = registry;

            const fetchContentPack = async (contentKey, options = {}) => {
                const entry = this._getContentRegistryEntry(contentKey, options);
                if (!entry || !entry.path) {
                    if (entry && entry.required === false) {
                        return null;
                    }
                    throw new Error(`Missing content registry path for ${contentKey}`);
                }
                const overrideRawPack = this._getContentPackOverride(contentKey, entry);
                if (overrideRawPack) {
                    this._validateContentPack(contentKey, entry, overrideRawPack);
                    return {
                        raw: overrideRawPack,
                        entry,
                        meta: {
                            ...this._buildContentPackMeta(contentKey, entry, overrideRawPack),
                            source: 'override',
                            overrideKey: buildContentPackOverrideKey(contentKey, entry.selectedTreeId || null)
                        }
                    };
                }
                const normalizedFile = normalizeUrl(entry.path, null);
                const url = basePath
                    ? (normalizedFile.startsWith('http') || normalizedFile.startsWith('/')
                        ? normalizedFile
                        : `${basePath}${normalizedFile}`)
                    : normalizedFile;
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status} loading ${url}`);
                }
                const rawPack = await response.json();
                this._validateContentPack(contentKey, entry, rawPack);
                return {
                    raw: rawPack,
                    entry,
                    meta: this._buildContentPackMeta(contentKey, entry, rawPack)
                };
            };

            // Load player first so we can decide which skill tree to load
            const playerPack = await fetchContentPack('player');
            const player = playerPack.raw;

            const [itemsPack, enemiesPack, levelsPack, buffsPack, slotLayoutsPack] = await Promise.all([
                fetchContentPack('items'),
                fetchContentPack('enemies'),
                fetchContentPack('levels'),
                fetchContentPack('buffs'),
                fetchContentPack('slotLayouts').catch((e) => {
                    console.warn('?? [DataManager] Failed to load slotLayouts. Reason:', e.message);
                    return null;
                })
            ]);

            const items = itemsPack.raw;
            const enemies = enemiesPack.raw;
            const levels = levelsPack.raw;
            const buffs = buffsPack.raw;
            const slotLayouts = slotLayoutsPack ? slotLayoutsPack.raw : null;
            const expandedLevels = this._expandLevelEnemyPools(levels);

            const playerSkills = player && player.default ? player.default.skills : null;
            if (!playerSkills || typeof playerSkills !== 'object' || Array.isArray(playerSkills)) {
                throw new Error('Player skills must be an object schema.');
            }

            const skillTreeId = playerSkills.skillTreeId;
            const skillsPack = await fetchContentPack('skills', { skillTreeId });
            const skills = skillsPack.raw;

            const skillsMap = Object.create(null);
            skills.skills.forEach(skill => {
                if (skill && skill.id) {
                    skillsMap[skill.id] = skill;
                }
            });
            
            // Validate basic structure
            if (!skills || !items || !enemies || !levels || !player || !buffs) {
                 throw new Error("One or more config files are empty or invalid.");
            }

            this.gameConfig = {
                skills: skillsMap,
                skillCatalog: this._buildSkillCatalog(skillsMap, {
                    packMeta: skillsPack.meta,
                    selectedTreeId: skillTreeId
                }),
                items,
                enemies,
                levels: expandedLevels,
                levelCatalog: this._buildLevelCatalog(expandedLevels, {
                    packMeta: levelsPack.meta
                }),
                player,
                buffs: this._unwrapBuffDefinitions(buffs),
                buffCatalog: this._buildBuffCatalog(this._unwrapBuffDefinitions(buffs), {
                    packMeta: buffsPack.meta
                }),
                buffMeta: (buffs && typeof buffs === 'object') ? (buffs.meta || null) : null,
                slotLayouts,
                contentRegistry: registry,
                contentPacks: {
                    player: playerPack.meta,
                    items: itemsPack.meta,
                    enemies: enemiesPack.meta,
                    levels: levelsPack.meta,
                    skills: skillsPack.meta,
                    buffs: buffsPack.meta,
                    slotLayouts: slotLayoutsPack ? slotLayoutsPack.meta : null
                }
            };
            this.contentPacks = this.gameConfig.contentPacks;
            this.skillCatalog = this.gameConfig.skillCatalog;
            this.buffCatalog = this.gameConfig.buffCatalog;
            this.levelCatalog = this.gameConfig.levelCatalog;

            console.log("? [DataManager] Configs successfully loaded from JSON files.", this.gameConfig);
        } catch (e) {
            // Fail fast: during development we want configuration/data issues to surface immediately
            // instead of silently falling back to mock data.
            console.error("[DataManager] Failed to load JSON configs. Aborting init.", e);
            this.gameConfig = {};
            this.contentRegistry = null;
            this.contentPacks = null;
            this.skillCatalog = null;
            this.buffCatalog = null;
            this.levelCatalog = null;
            throw e;
        }
    }

    loadMockConfigs() {
        throw new Error('[DataManager] Mock mode has been removed. Fix data loading errors instead of falling back.');
    }

    getSkillPackMeta() {
        return (this.contentPacks && this.contentPacks.skills) ? this.contentPacks.skills : null;
    }

    getCurrentSkillTreeId() {
        return this.getSkillCatalog()?.selectedTreeId || null;
    }

    getSkillCatalog() {
        if (this.skillCatalog && typeof this.skillCatalog === 'object') {
            return this.skillCatalog;
        }

        if (this.gameConfig && this.gameConfig.skillCatalog && typeof this.gameConfig.skillCatalog === 'object') {
            this.skillCatalog = this.gameConfig.skillCatalog;
            return this.skillCatalog;
        }

        const skillsMap = (this.gameConfig && this.gameConfig.skills && typeof this.gameConfig.skills === 'object')
            ? this.gameConfig.skills
            : Object.create(null);

        this.skillCatalog = this._buildSkillCatalog(skillsMap);
        if (this.gameConfig && typeof this.gameConfig === 'object') {
            this.gameConfig.skillCatalog = this.skillCatalog;
        }
        return this.skillCatalog;
    }

    getBuffPackMeta() {
        return (this.contentPacks && this.contentPacks.buffs) ? this.contentPacks.buffs : null;
    }

    getBuffCatalog() {
        if (this.buffCatalog && typeof this.buffCatalog === 'object') {
            return this.buffCatalog;
        }

        if (this.gameConfig && this.gameConfig.buffCatalog && typeof this.gameConfig.buffCatalog === 'object') {
            this.buffCatalog = this.gameConfig.buffCatalog;
            return this.buffCatalog;
        }

        const buffsMap = (this.gameConfig && this.gameConfig.buffs && typeof this.gameConfig.buffs === 'object')
            ? this.gameConfig.buffs
            : Object.create(null);

        this.buffCatalog = this._buildBuffCatalog(buffsMap);
        if (this.gameConfig && typeof this.gameConfig === 'object') {
            this.gameConfig.buffCatalog = this.buffCatalog;
        }
        return this.buffCatalog;
    }

    getBuffDefinitions() {
        return this.getBuffCatalog()?.buffsMap || Object.create(null);
    }

    getLevelPackMeta() {
        return (this.contentPacks && this.contentPacks.levels) ? this.contentPacks.levels : null;
    }

    getLevelCatalog() {
        if (this.levelCatalog && typeof this.levelCatalog === 'object') {
            return this.levelCatalog;
        }

        if (this.gameConfig && this.gameConfig.levelCatalog && typeof this.gameConfig.levelCatalog === 'object') {
            this.levelCatalog = this.gameConfig.levelCatalog;
            return this.levelCatalog;
        }

        const levelsMap = (this.gameConfig && this.gameConfig.levels && typeof this.gameConfig.levels === 'object')
            ? this.gameConfig.levels
            : Object.create(null);

        this.levelCatalog = this._buildLevelCatalog(levelsMap);
        if (this.gameConfig && typeof this.gameConfig === 'object') {
            this.gameConfig.levelCatalog = this.levelCatalog;
        }
        return this.levelCatalog;
    }

    getLevelDefinitions() {
        return this.getLevelCatalog()?.levelsMap || Object.create(null);
    }

    _getLevelFlow(levelConfig, fallbackOrder = null) {
        const source = (levelConfig && typeof levelConfig.flow === 'object') ? levelConfig.flow : {};
        const parsedOrder = Number(source.order);
        return {
            kind: source.kind || 'story',
            order: Number.isFinite(parsedOrder) ? parsedOrder : fallbackOrder
        };
    }

    _getLevelsListByKind(kind) {
        const levels = Object.values(this.getLevelDefinitions() || {});
        return levels
            .filter(level => this._getLevelFlow(level).kind === kind)
            .sort((a, b) => {
                const orderA = Number(this._getLevelFlow(a, Number.MAX_SAFE_INTEGER).order);
                const orderB = Number(this._getLevelFlow(b, Number.MAX_SAFE_INTEGER).order);
                if (orderA !== orderB) return orderA - orderB;
                return String(a?.id || '').localeCompare(String(b?.id || ''));
            });
    }

    _getStoryLevelsList() {
        return this._getLevelsListByKind('story');
    }

    _getAcceptanceLevelsList() {
        return this._getLevelsListByKind('acceptance');
    }

    getNextStoryLevelId(levelId) {
        if (!levelId) return null;
        const storyLevels = this._getStoryLevelsList();
        const currentIndex = storyLevels.findIndex(level => level?.id === levelId);
        if (currentIndex < 0) return null;
        return storyLevels[currentIndex + 1]?.id || null;
    }

    _buildLevelClearFeedback(level, { isCompleted = false } = {}) {
        const levelId = level?.id || null;
        const nextLevelId = this.getNextStoryLevelId(levelId);
        const nextLevelConfig = nextLevelId ? this.getLevelConfig(nextLevelId) : null;
        const nextLevelName = nextLevelConfig?.name || nextLevelId || null;
        const firstClearText = nextLevelName
            ? `首次通关将解锁下一关：${nextLevelName}。`
            : '首次通关将完成当前章节，不再有新的故事关卡解锁。';

        return {
            currentMode: isCompleted ? 'repeat' : 'first_clear',
            firstClearText,
            repeatClearText: '重复通关仍获得常规资源奖励，但不再解锁新章节。',
            nextLevelId,
            nextLevelName
        };
    }

    getLevelSelectEntries() {
        if (this.dataConfig.global) {
            this.dataConfig.global.progress = this._normalizeProgress(this.dataConfig.global.progress);
        }

        const progress = this.dataConfig.global?.progress;
        const unlockedLevels = Array.isArray(progress?.unlockedLevels) ? progress.unlockedLevels : [];
        const completedLevels = Array.isArray(progress?.completedLevels) ? progress.completedLevels : [];

        return this._getStoryLevelsList().map(level => {
            const isCompleted = completedLevels.includes(level.id);
            return {
                id: level.id,
                name: level.name || level.id,
                description: level.description || '',
                flow: this._getLevelFlow(level),
                selectionMeta: this._normalizeLevelSelectionMeta(level.selectionMeta),
                rewards: this._normalizeBattleRewards(level.rewards),
                clearFeedback: this._buildLevelClearFeedback(level, { isCompleted }),
                isUnlocked: unlockedLevels.includes(level.id),
                isCompleted
            };
        });
    }

    getAcceptanceLevelSelectEntries() {
        return this._getAcceptanceLevelsList().map(level => ({
            id: level.id,
            name: level.name || level.id,
            description: level.description || '',
            flow: this._getLevelFlow(level),
            isUnlocked: true,
            isCompleted: false
        }));
    }

    getSkillConfig(skillId) {
        const skillsMap = this.getSkillCatalog()?.skillsMap;
        if (!skillsMap) return null;

        const direct = skillsMap[skillId];
        if (direct) return direct;

        const aliasId = this._enemySkillAliases[skillId];
        if (!aliasId) return null;

        const aliased = skillsMap[aliasId];
        if (!aliased) return null;

        return {
            ...aliased,
            id: skillId,
            runtimeAliasOf: aliasId
        };
    }

    // Instantiate a level from config, creating runtime enemy instances
    instantiateLevel(levelId) {
        const levelConfig = typeof this.getLevelConfig === 'function'
            ? this.getLevelConfig(levelId)
            : ((this.gameConfig && this.gameConfig.levels && typeof this.gameConfig.levels === 'object')
                ? (this.gameConfig.levels[levelId] || null)
                : null);
        if (!levelConfig) return null;

        // Deep copy basic level info
        const runtimeLevel = {
            id: levelConfig.id,
            name: levelConfig.name,
            enemies: []
        };

        if (levelConfig.description) runtimeLevel.description = levelConfig.description;
        if (levelConfig.battleRules) runtimeLevel.battleRules = JSON.parse(JSON.stringify(levelConfig.battleRules));
        if (levelConfig.battlePlayerSkills) {
            runtimeLevel.battlePlayerSkills = JSON.parse(JSON.stringify(levelConfig.battlePlayerSkills));
        }
        if (levelConfig.battlePlayerState) {
            runtimeLevel.battlePlayerState = JSON.parse(JSON.stringify(levelConfig.battlePlayerState));
        }

        // Instantiate enemies from the first wave (simple support for now)
        if (levelConfig.waves && levelConfig.waves.length > 0) {
            const wave = levelConfig.waves[0];
            wave.enemies.forEach((enemyRef, index) => {
                const template = this.gameConfig.enemies[enemyRef.templateId];
                if (template) {
                    const enemyInstance = JSON.parse(JSON.stringify(template)); // Deep copy template
                    enemyInstance.instanceId = `${template.id}_${index}_${Date.now()}`; // Unique ID
                    enemyInstance.id = enemyInstance.instanceId; // Map instanceId to id for compatibility
                    
                    // Initialize Runtime Stats
                    enemyInstance.hp = template.stats.hp;
                    enemyInstance.maxHp = template.stats.maxHp;
                    enemyInstance.speed = template.stats.speed;
                    if (enemyInstance.stats && typeof enemyInstance.stats === 'object') {
                        const baseAp = Number(enemyInstance.stats.ap ?? 0) || 0;
                        enemyInstance.stats.ap = baseAp;
                        enemyInstance.stats.maxAp = Number(enemyInstance.stats.maxAp ?? baseAp) || baseAp;
                    }
                    
                    // Initialize Body Parts Runtime State
                    if (enemyInstance.bodyParts) {
                        for (let partKey in enemyInstance.bodyParts) {
                            const partData = enemyInstance.bodyParts[partKey];
                            const maxVal = (partData.max !== undefined) ? partData.max : (partData.maxArmor || 0);
                            const configuredCurrent = (partData.current !== undefined) ? partData.current : maxVal;

                            partData.max = maxVal;
                            partData.current = Math.max(0, Math.min(maxVal, configuredCurrent));
                            partData.status = partData.status || 'NORMAL';
                        }
                    }
                    
                    runtimeLevel.enemies.push(enemyInstance);
                }
            });
        }

        return runtimeLevel;
    }

    getLevelConfig(levelId) {
        const levelsMap = typeof this.getLevelDefinitions === 'function'
            ? this.getLevelDefinitions()
            : ((this.gameConfig && this.gameConfig.levels && typeof this.gameConfig.levels === 'object')
                ? this.gameConfig.levels
                : Object.create(null));
        return levelsMap[levelId] || null;
    }

    getLevelRewards(levelId) {
        return this._normalizeBattleRewards(this.getLevelConfig(levelId)?.rewards);
    }

    applyBattleSettlement({ levelId = null, victory = false } = {}) {
        const player = this.playerData;
        const playerTemplate = (this.gameConfig && this.gameConfig.player && this.gameConfig.player.default)
            ? this.gameConfig.player.default
            : null;
        if (!player) {
            return {
                levelId,
                levelName: levelId || '未知关卡',
                victory: Boolean(victory),
                rewards: this._normalizeBattleRewards(null),
                firstClear: false,
                playerBefore: {
                    resources: this._normalizePlayerResources(null, playerTemplate),
                    skillPoints: 0
                },
                playerAfter: {
                    resources: this._normalizePlayerResources(null, playerTemplate),
                    skillPoints: 0
                }
            };
        }

        player.skills = this._normalizeSkills(player.skills, playerTemplate);
        player.resources = this._normalizePlayerResources(player.resources, playerTemplate);
        if (this.dataConfig.global) {
            this.dataConfig.global.progress = this._normalizeProgress(this.dataConfig.global.progress);
        }

        const progress = this.dataConfig.global?.progress;
        const levelConfig = levelId ? this.getLevelConfig(levelId) : null;
        const baseRewards = Boolean(victory)
            ? this._normalizeBattleRewards(levelConfig?.rewards)
            : this._normalizeBattleRewards(null);
        const beforeResources = JSON.parse(JSON.stringify(player.resources));
        const beforeSkillPoints = Number(player.skills?.skillPoints) || 0;
        const alreadyCompleted = Boolean(levelId) && Array.isArray(progress?.completedLevels)
            ? progress.completedLevels.includes(levelId)
            : false;
        const nextStoryLevelId = victory ? this.getNextStoryLevelId(levelId) : null;
        const newUnlocks = [];

        if (victory) {
            player.resources.exp += baseRewards.exp;
            player.resources.gold += baseRewards.gold;
            player.skills.skillPoints += baseRewards.kp;
            if (levelId && progress && Array.isArray(progress.completedLevels) && !progress.completedLevels.includes(levelId)) {
                progress.completedLevels.push(levelId);
            }
            if (nextStoryLevelId && progress && Array.isArray(progress.unlockedLevels) && !progress.unlockedLevels.includes(nextStoryLevelId)) {
                progress.unlockedLevels.push(nextStoryLevelId);
                newUnlocks.push(nextStoryLevelId);
            }
        }

        const nextLevelConfig = nextStoryLevelId ? this.getLevelConfig(nextStoryLevelId) : null;

        const settlement = {
            levelId,
            levelName: levelConfig?.name || levelId || '未知关卡',
            victory: Boolean(victory),
            settledAt: new Date().toISOString(),
            rewards: baseRewards,
            firstClear: Boolean(victory && levelId && !alreadyCompleted),
            nextLevelId: nextStoryLevelId,
            nextLevelName: nextLevelConfig?.name || null,
            newUnlocks,
            playerBefore: {
                resources: beforeResources,
                skillPoints: beforeSkillPoints
            },
            playerAfter: {
                resources: JSON.parse(JSON.stringify(player.resources)),
                skillPoints: Number(player.skills?.skillPoints) || 0
            }
        };

        if (progress) {
            progress.lastSettlement = JSON.parse(JSON.stringify(settlement));
        }

        return settlement;
    }

    /**
     * »ñÈ¡ËùÓÐ¹Ø¿¨ÁÐ±í
     * @returns {Array} ¹Ø¿¨¶ÔÏóÊý×é
     */
    getLevels() {
        if (typeof this.getLevelCatalog === 'function') {
            return this.getLevelCatalog()?.levelsList || [];
        }
        if (!this.gameConfig || !this.gameConfig.levels) {
            return [];
        }
        return Object.values(this.gameConfig.levels);
    }
}

export default new DataManager();
