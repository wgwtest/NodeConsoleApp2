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
        const normalizedKind = source.kind || 'story';
        const parsedChapterOrder = Number(source.chapterOrder);
        const chapterOrder = Number.isFinite(parsedChapterOrder)
            ? parsedChapterOrder
            : (normalizedKind === 'story' ? 1 : null);
        const chapterLabel = typeof source.chapterLabel === 'string'
            ? source.chapterLabel.trim()
            : '';
        const chapterTitle = typeof source.chapterTitle === 'string'
            ? source.chapterTitle.trim()
            : '';
        const nodeLabel = typeof source.nodeLabel === 'string'
            ? source.nodeLabel.trim()
            : '';
        const objectiveText = typeof source.objectiveText === 'string'
            ? source.objectiveText.trim()
            : '';
        return {
            kind: normalizedKind,
            order: Number.isFinite(parsedOrder) ? parsedOrder : fallbackOrder,
            chapterId: typeof source.chapterId === 'string' && source.chapterId.trim()
                ? source.chapterId.trim()
                : '',
            chapterOrder,
            chapterLabel: chapterLabel || (normalizedKind === 'story' && Number.isFinite(chapterOrder) ? `第${chapterOrder}章` : ''),
            chapterTitle,
            nodeLabel: nodeLabel || (normalizedKind === 'story' && Number.isFinite(chapterOrder) && Number.isFinite(Number.isFinite(parsedOrder) ? parsedOrder : fallbackOrder)
                ? `${chapterOrder}-${Number.isFinite(parsedOrder) ? parsedOrder : fallbackOrder}`
                : ''),
            objectiveText
        };
    }

    _getStoryChapterKey(flow) {
        const source = (flow && typeof flow === 'object') ? flow : {};
        if (source.chapterId) return source.chapterId;
        const chapterOrder = Number(source.chapterOrder);
        if (Number.isFinite(chapterOrder)) return `story_chapter_${chapterOrder}`;
        return 'story_chapter_1';
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

    _buildStoryLevelSelectModel() {
        if (this.dataConfig.global) {
            this.dataConfig.global.progress = this._normalizeProgress(this.dataConfig.global.progress);
        }

        const progress = this.dataConfig.global?.progress;
        const unlockedLevels = Array.isArray(progress?.unlockedLevels) ? progress.unlockedLevels : [];
        const completedLevels = Array.isArray(progress?.completedLevels) ? progress.completedLevels : [];
        const baseEntries = this._getStoryLevelsList().map(level => {
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

        if (baseEntries.length === 0) {
            return {
                entries: [],
                overview: null
            };
        }

        const recommendedEntry = baseEntries.find(entry => entry.isUnlocked && !entry.isCompleted) || null;
        const lastUnlockedEntry = [...baseEntries].reverse().find(entry => entry.isUnlocked) || baseEntries[0];
        const nextLockedEntry = baseEntries.find(entry => !entry.isUnlocked) || null;
        const currentFocusEntry = recommendedEntry || lastUnlockedEntry || baseEntries[0];
        const currentChapterKey = this._getStoryChapterKey(currentFocusEntry?.flow);
        const chapterEntries = baseEntries.filter(entry => this._getStoryChapterKey(entry.flow) === currentChapterKey);
        const completedCount = chapterEntries.filter(entry => entry.isCompleted).length;
        const unlockedCount = chapterEntries.filter(entry => entry.isUnlocked).length;
        const resolveEntryStatus = entry => {
            if (entry.isCompleted) return 'completed';
            if (recommendedEntry && entry.id === recommendedEntry.id) return 'recommended';
            if (entry.isUnlocked) return 'unlocked';
            return 'locked';
        };

        const entries = baseEntries.map((entry, index) => {
            const previousEntry = baseEntries[index - 1] || null;
            const status = resolveEntryStatus(entry);
            let stateLabel = '后续节点';
            let unlockHint = '完成上一节点后解锁。';

            if (status === 'completed') {
                stateLabel = '已完成节点';
                unlockHint = '已完成；可重复挑战补资源。';
            } else if (status === 'recommended') {
                stateLabel = '当前推荐';
                unlockHint = '当前已解锁，建议优先推进章节主线。';
            } else if (status === 'unlocked') {
                stateLabel = '已解锁节点';
                unlockHint = '当前已解锁，可自由挑战。';
            } else if (previousEntry?.name) {
                unlockHint = `完成 ${previousEntry.name} 后解锁。`;
            }

            return {
                ...entry,
                progression: {
                    status,
                    stateLabel,
                    unlockHint
                }
            };
        });

        const focusFlow = (currentFocusEntry && currentFocusEntry.flow) ? currentFocusEntry.flow : {};
        const currentObjectiveText = recommendedEntry?.flow?.objectiveText
            || recommendedEntry?.selectionMeta?.buildHint
            || (nextLockedEntry
                ? `完成 ${lastUnlockedEntry?.name || '上一节点'} 后解锁 ${nextLockedEntry.name}。`
                : '当前章节已全部完成，可重复挑战补资源。');
        const overview = {
            chapterId: currentChapterKey,
            chapterLabel: focusFlow.chapterLabel || '第一章',
            chapterTitle: focusFlow.chapterTitle || '',
            completedCount,
            totalCount: chapterEntries.length,
            unlockedCount,
            recommendedLevelId: recommendedEntry?.id || null,
            recommendedLevelName: recommendedEntry?.name || null,
            currentNodeLabel: (recommendedEntry?.flow?.nodeLabel || focusFlow.nodeLabel || ''),
            currentObjectiveText,
            nextLockedLevelId: nextLockedEntry?.id || null,
            nextLockedLevelName: nextLockedEntry?.name || null,
            chapterNodes: chapterEntries.map(entry => ({
                id: entry.id,
                name: entry.name,
                nodeLabel: entry.flow?.nodeLabel || '',
                status: resolveEntryStatus(entry)
            }))
        };

        return {
            entries,
            overview
        };
    }

    getLevelSelectEntries() {
        return this._buildStoryLevelSelectModel().entries;
    }

    getLevelSelectOverview() {
        return this._buildStoryLevelSelectModel().overview;
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

    getLevelContentSourceOverview() {
        const storyCount = this._getStoryLevelsList().length;
        const acceptanceCount = this._getAcceptanceLevelsList().length;

        return [
            {
                kind: 'story',
                title: '故事关卡',
                entryLabel: '关卡选择',
                count: storyCount,
                isRuntimeEntry: true,
                description: '正式推进内容，会进入成长、结算与解锁闭环。',
                source: 'levels.json flow.kind=story'
            },
            {
                kind: 'acceptance',
                title: '验收样本',
                entryLabel: '验收样本',
                count: acceptanceCount,
                isRuntimeEntry: true,
                description: '人工复核入口，用于稳定观察敌人行为与验收样本链路，不推进故事主线。',
                source: 'levels.json flow.kind=acceptance'
            },
            {
                kind: 'authoring',
                title: '作者样本',
                entryLabel: '作者样本工具页',
                count: 3,
                isRuntimeEntry: false,
                description: '只存在于工具页，用于作者编辑关卡 pack、验证覆写注入与运行时消费；不属于故事推进关卡，也不属于验收样本入口。',
                source: 'test/level_editor_v1.html + test/level_editor_io_test.html + test/level_runtime_probe.html',
                pages: [
                    'test/level_editor_v1.html',
                    'test/level_editor_io_test.html',
                    'test/level_runtime_probe.html'
                ]
            }
        ];
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

    _normalizeSkillSelection(selection) {
        const source = (selection && typeof selection === 'object' && !Array.isArray(selection))
            ? selection
            : {};
        const normalizeParts = (parts) => Array.isArray(parts)
            ? parts
                .map(part => (typeof part === 'string' ? part.trim() : ''))
                .filter(Boolean)
            : [];
        const parsedCount = Number(source.selectCount);

        return {
            mode: typeof source.mode === 'string' && source.mode.trim()
                ? source.mode.trim()
                : null,
            candidateParts: normalizeParts(source.candidateParts),
            selectedParts: normalizeParts(source.selectedParts),
            selectCount: Number.isFinite(parsedCount) ? parsedCount : null
        };
    }

    _normalizeSkillBuffRefs(buffRefs) {
        const source = (buffRefs && typeof buffRefs === 'object' && !Array.isArray(buffRefs))
            ? buffRefs
            : {};
        const normalizeList = (items) => Array.isArray(items)
            ? items
                .filter(item => item && typeof item === 'object')
                .map(item => JSON.parse(JSON.stringify(item)))
            : [];

        return {
            apply: normalizeList(source.apply),
            remove: normalizeList(source.remove)
        };
    }

    _collectSkillActionEffectTypes(actions) {
        const source = Array.isArray(actions) ? actions : [];
        const seen = new Set();
        const effectTypes = [];

        source.forEach(action => {
            const effectType = typeof action?.effect?.effectType === 'string'
                ? action.effect.effectType.trim()
                : '';
            if (!effectType || seen.has(effectType)) return;
            seen.add(effectType);
            effectTypes.push(effectType);
        });

        return effectTypes;
    }

    _buildSkillRuntimeFlags(summary) {
        const requirementKeys = Object.keys(summary?.requirements || {});
        const selection = summary?.target?.selection || {};
        const buffApplyCount = Array.isArray(summary?.buffRefs?.apply) ? summary.buffRefs.apply.length : 0;
        const buffRemoveCount = Array.isArray(summary?.buffRefs?.remove) ? summary.buffRefs.remove.length : 0;
        const actionEffectTypes = Array.isArray(summary?.actionEffectTypes) ? summary.actionEffectTypes : [];

        return {
            isAlias: Boolean(summary?.runtimeAliasOf),
            isPartTargeted: summary?.target?.scope === 'SCOPE_PART',
            isMultiParts: summary?.target?.scope === 'SCOPE_MULTI_PARTS'
                || selection.mode === 'multiple'
                || (Number(selection.selectCount) > 1),
            isBuffDriven: actionEffectTypes.length === 0 && (buffApplyCount > 0 || buffRemoveCount > 0),
            isConditional: requirementKeys.length > 0,
            consumesPartSlot: Boolean(summary?.costs?.partSlot?.part)
        };
    }

    getSkillContractSummary(skillId) {
        const skill = this.getSkillConfig(skillId);
        if (!skill) return null;

        const target = (skill.target && typeof skill.target === 'object') ? skill.target : {};
        const selection = this._normalizeSkillSelection(target.selection);
        const buffRefs = this._normalizeSkillBuffRefs(skill.buffRefs);
        const actionEffectTypes = this._collectSkillActionEffectTypes(skill.actions);
        const tags = Array.isArray(skill.tags)
            ? skill.tags
                .map(tag => (typeof tag === 'string' ? tag.trim() : ''))
                .filter(Boolean)
            : [];

        const summary = {
            id: skill.id,
            runtimeAliasOf: skill.runtimeAliasOf || null,
            name: typeof skill.name === 'string' ? skill.name : skill.id,
            description: typeof skill.description === 'string' ? skill.description : '',
            tags,
            target: {
                subject: typeof target.subject === 'string' ? target.subject : null,
                scope: typeof target.scope === 'string' ? target.scope : null,
                selection
            },
            requirements: (skill.requirements && typeof skill.requirements === 'object' && !Array.isArray(skill.requirements))
                ? JSON.parse(JSON.stringify(skill.requirements))
                : {},
            costs: (skill.costs && typeof skill.costs === 'object' && !Array.isArray(skill.costs))
                ? JSON.parse(JSON.stringify(skill.costs))
                : {},
            actionEffectTypes,
            buffRefs
        };

        summary.runtimeFlags = this._buildSkillRuntimeFlags(summary);
        return summary;
    }

    getSkillContractCatalog(options = {}) {
        const includeAliases = options && options.includeAliases === true;
        const catalog = this.getSkillCatalog() || {};
        const entries = [];
        const seen = new Set();
        const pushSummary = (skillId) => {
            if (!skillId || seen.has(skillId)) return;
            const summary = this.getSkillContractSummary(skillId);
            if (!summary) return;
            seen.add(skillId);
            entries.push(summary);
        };

        (catalog.skillsList || []).forEach(skill => pushSummary(skill?.id));

        if (includeAliases) {
            Object.keys(this._enemySkillAliases || {}).forEach(aliasId => pushSummary(aliasId));
        }

        return {
            selectedTreeId: catalog.selectedTreeId || null,
            schemaVersion: catalog.schemaVersion || null,
            meta: catalog.meta || null,
            entries,
            entriesMap: Object.fromEntries(entries.map(entry => [entry.id, entry]))
        };
    }

    getSkillContractIssues(skillId) {
        const summary = typeof skillId === 'string' ? this.getSkillContractSummary(skillId) : skillId;
        if (!summary || typeof summary !== 'object') return [];

        const issues = [];
        const selection = summary.target?.selection || {};
        const candidateCount = Array.isArray(selection.candidateParts) ? selection.candidateParts.length : 0;
        const selectCount = Number.isFinite(selection.selectCount) ? selection.selectCount : null;
        const tagSet = new Set(Array.isArray(summary.tags) ? summary.tags : []);
        const subjectTags = ['SUBJECT_SELF', 'SUBJECT_ENEMY', 'SUBJECT_BOTH']
            .filter(tag => tagSet.has(tag));
        const scopeTags = ['SCOPE_ENTITY', 'SCOPE_PART', 'SCOPE_MULTI_PARTS']
            .filter(tag => tagSet.has(tag));
        const comparableEffectTags = new Set(['DMG_HP', 'DMG_ARMOR', 'HEAL', 'AP_GAIN', 'SPEED', 'BUFF_APPLY', 'BUFF_REMOVE']);
        const derivedEffectTags = new Set();

        (summary.actionEffectTypes || []).forEach(effectType => {
            if (comparableEffectTags.has(effectType)) {
                derivedEffectTags.add(effectType);
            }
        });
        if ((summary.buffRefs?.apply || []).length > 0) {
            derivedEffectTags.add('BUFF_APPLY');
        }
        if ((summary.buffRefs?.remove || []).length > 0) {
            derivedEffectTags.add('BUFF_REMOVE');
        }

        if (selectCount !== null && candidateCount > 0 && selectCount > candidateCount) {
            issues.push({
                code: 'selection_count_exceeds_candidates',
                message: `selectCount(${selectCount}) 超过 candidateParts(${candidateCount})。`,
                selectCount,
                candidateCount
            });
        }

        if (selection.mode === 'single' && selectCount !== null && selectCount !== 1) {
            issues.push({
                code: 'single_selection_count_invalid',
                message: `single 模式的 selectCount 应为 1，当前为 ${selectCount}。`,
                selectCount
            });
        }

        if (subjectTags.length > 0 && summary.target?.subject && !subjectTags.includes(summary.target.subject)) {
            issues.push({
                code: 'tag_subject_mismatch',
                message: `SUBJECT 标签与 target.subject 不一致：tags=${subjectTags.join(',')} target=${summary.target.subject}`,
                targetSubject: summary.target.subject,
                tags: subjectTags
            });
        }

        if (scopeTags.length > 0 && summary.target?.scope && !scopeTags.includes(summary.target.scope)) {
            issues.push({
                code: 'tag_scope_mismatch',
                message: `SCOPE 标签与 target.scope 不一致：tags=${scopeTags.join(',')} target=${summary.target.scope}`,
                targetScope: summary.target.scope,
                tags: scopeTags
            });
        }

        Array.from(tagSet)
            .filter(tag => comparableEffectTags.has(tag))
            .forEach(tag => {
                if (!derivedEffectTags.has(tag)) {
                    issues.push({
                        code: 'unexpected_effect_tag',
                        tag,
                        message: `标签 ${tag} 无法从 actions / buffRefs 中直接推导。`
                    });
                }
            });

        Array.from(derivedEffectTags).forEach(tag => {
            if (!tagSet.has(tag)) {
                issues.push({
                    code: 'missing_effect_tag',
                    tag,
                    message: `actions / buffRefs 已体现 ${tag}，但 tags 中缺失。`
                });
            }
        });

        return issues;
    }

    getSkillContractRemediationHistory() {
        const fixedAt = '2026-04-11 09:10:19 +0800';
        const reason = '原配置里存在 selectCount 越界，或 single 模式的选择数量不是 1，导致规划阶段的选择语义不稳定。';
        const remediation = '以 candidateParts 为上限收敛 selectCount，并把 single 模式统一修正为 selectCount = 1。';
        return [
            'skill_block',
            'skill_aegis',
            'skill_hold_the_line_copy_1769790933469',
            'skill_shockwave_copy_1770041956468',
            'skill_bone_repair',
            'skill_escape'
        ].map(skillId => ({
            skillId,
            ownerNode: 'WBS-3.3.3',
            fixedAt,
            issueCodes: ['selection_count_exceeds_candidates', 'single_selection_count_invalid'],
            reason,
            remediation
        }));
    }

    _describeSkillContractIssues(issues) {
        const list = Array.isArray(issues) ? issues : [];
        if (list.length === 0) {
            return '当前未发现契约异常。';
        }

        const labelMap = {
            selection_count_exceeds_candidates: 'selectCount 超过 candidateParts 上限',
            single_selection_count_invalid: 'single 模式的 selectCount 不是 1',
            tag_subject_mismatch: 'SUBJECT 标签与 target.subject 不一致',
            tag_scope_mismatch: 'SCOPE 标签与 target.scope 不一致',
            unexpected_effect_tag: 'tags 声称存在某效果，但 actions / buffRefs 无法直接推导',
            missing_effect_tag: 'actions / buffRefs 已体现某效果，但 tags 未同步'
        };

        return Array.from(new Set(list.map(issue => labelMap[issue.code] || issue.message || issue.code))).join('；');
    }

    _recommendSkillContractFixFromIssues(issues) {
        const list = Array.isArray(issues) ? issues : [];
        if (list.length === 0) {
            return '无需修改。';
        }

        const codes = new Set(list.map(issue => issue.code));
        const steps = [];
        if (codes.has('selection_count_exceeds_candidates') || codes.has('single_selection_count_invalid')) {
            steps.push('收敛 target.selection.selectCount，使其不超过 candidateParts；single 模式固定为 1');
        }
        if (codes.has('tag_subject_mismatch') || codes.has('tag_scope_mismatch')) {
            steps.push('以 target.subject / target.scope 为准，删除或修正漂移的 SUBJECT_* / SCOPE_* 标签');
        }
        if (codes.has('unexpected_effect_tag') || codes.has('missing_effect_tag')) {
            steps.push('以 actions / buffRefs 为事实来源，移除过时效果标签或补齐缺失标签');
        }
        return steps.join('；');
    }

    getSkillContractStatusBoard(options = {}) {
        const includeAliases = options && options.includeAliases === true;
        const catalog = this.getSkillContractCatalog({ includeAliases });
        const entries = Array.isArray(catalog?.entries) ? catalog.entries : [];
        const historyList = this.getSkillContractRemediationHistory();
        const historyBySkill = new Map();
        historyList.forEach(item => {
            if (!item || !item.skillId) return;
            if (!historyBySkill.has(item.skillId)) {
                historyBySkill.set(item.skillId, []);
            }
            historyBySkill.get(item.skillId).push(item);
        });

        const statusWeight = {
            '未修复': 0,
            '已修复': 1,
            '正常': 2
        };

        const rows = entries
            .filter(entry => includeAliases || !entry?.runtimeFlags?.isAlias)
            .map(entry => {
                const issues = this.getSkillContractIssues(entry);
                const history = historyBySkill.get(entry.id) || [];
                const lastHistory = history.length > 0 ? history[history.length - 1] : null;
                const resolvedIssueCodes = new Set(
                    history.flatMap(item => Array.isArray(item?.issueCodes) ? item.issueCodes : [])
                );
                const unresolvedResolvedIssues = issues.filter(issue => resolvedIssueCodes.has(issue.code));
                const remainingIssues = issues.filter(issue => !resolvedIssueCodes.has(issue.code));
                const status = unresolvedResolvedIssues.length > 0
                    ? '未修复'
                    : (history.length > 0
                        ? '已修复'
                        : (issues.length > 0 ? '未修复' : '正常'));

                const reasonParts = [];
                const remediationParts = [];

                if (status === '正常') {
                    reasonParts.push('当前未发现契约异常。');
                    remediationParts.push('无需修改。');
                } else if (status === '已修复') {
                    reasonParts.push(String(lastHistory?.reason || '当前节点已完成正式修复。'));
                    remediationParts.push(String(lastHistory?.remediation || '已完成修复。'));
                    if (remainingIssues.length > 0) {
                        reasonParts.push(`仍有后续批次问题：${this._describeSkillContractIssues(remainingIssues)}`);
                        remediationParts.push(`后续修改方向：${this._recommendSkillContractFixFromIssues(remainingIssues)}`);
                    }
                } else {
                    if (unresolvedResolvedIssues.length > 0) {
                        reasonParts.push(`已登记修复的问题仍未完全收口：${this._describeSkillContractIssues(unresolvedResolvedIssues)}`);
                        remediationParts.push(`优先回归已登记修复项：${this._recommendSkillContractFixFromIssues(unresolvedResolvedIssues)}`);
                    }

                    const activeIssues = remainingIssues.length > 0 ? remainingIssues : issues;
                    if (activeIssues.length > 0) {
                        reasonParts.push(this._describeSkillContractIssues(activeIssues));
                        remediationParts.push(this._recommendSkillContractFixFromIssues(activeIssues));
                    }
                }

                return {
                    skillId: entry.id,
                    skillName: entry.name,
                    runtimeAliasOf: entry.runtimeAliasOf || null,
                    status,
                    fixedAt: status === '已修复' ? String(lastHistory?.fixedAt || '') : '',
                    issueCodes: issues.map(issue => issue.code),
                    reason: reasonParts.filter(Boolean).join('；'),
                    remediation: remediationParts.filter(Boolean).join('；')
                };
            })
            .sort((a, b) => {
                const byStatus = (statusWeight[a.status] ?? 99) - (statusWeight[b.status] ?? 99);
                if (byStatus !== 0) return byStatus;
                return String(a.skillId).localeCompare(String(b.skillId));
            });

        const counts = rows.reduce((acc, row) => {
            acc.total += 1;
            if (row.status === '正常') acc.normal += 1;
            if (row.status === '已修复') acc.fixed += 1;
            if (row.status === '未修复') acc.open += 1;
            return acc;
        }, { total: 0, normal: 0, fixed: 0, open: 0 });

        return {
            ownerNode: 'WBS-3.3.3',
            selectedTreeId: catalog?.selectedTreeId || null,
            schemaVersion: catalog?.schemaVersion || null,
            counts,
            rows
        };
    }

    getSkillContractRemediationBatches(options = {}) {
        const includeAliases = options && options.includeAliases === true;
        const catalog = this.getSkillContractCatalog({ includeAliases });
        const entries = Array.isArray(catalog?.entries) ? catalog.entries : [];
        const historyList = this.getSkillContractRemediationHistory();
        const batchDefinitions = [
            {
                id: 'batch_structure_selection',
                title: '首批结构选择异常',
                ownerNode: 'WBS-3.3.3',
                issueCodes: ['selection_count_exceeds_candidates', 'single_selection_count_invalid'],
                description: '优先关闭 selectCount 越界与 single 模式计数错误，避免污染 UI 选择语义与规划阶段。'
            },
            {
                id: 'batch_target_tags',
                title: '主体 / 范围标签一致性',
                ownerNode: 'WBS-3.3.3',
                issueCodes: ['tag_subject_mismatch', 'tag_scope_mismatch'],
                description: '继续收口 SUBJECT / SCOPE 标签与 target 声明的一致性。'
            },
            {
                id: 'batch_effect_tags',
                title: '动作效果标签一致性',
                ownerNode: 'WBS-3.3.3',
                issueCodes: ['unexpected_effect_tag', 'missing_effect_tag'],
                description: '最后清理 tags 与 actions / buffRefs 之间的效果标签漂移。'
            }
        ];

        const issueRows = [];
        entries.forEach(entry => {
            const issues = this.getSkillContractIssues(entry);
            issues.forEach(issue => {
                issueRows.push({
                    skillId: entry.id,
                    skillName: entry.name,
                    runtimeAliasOf: entry.runtimeAliasOf || null,
                    code: issue.code,
                    message: issue.message
                });
            });
        });

        const batches = batchDefinitions.map(definition => {
            const rows = issueRows.filter(row => definition.issueCodes.includes(row.code));
            const openSkills = Array.from(new Map(rows.map(row => [row.skillId, {
                skillId: row.skillId,
                skillName: row.skillName,
                runtimeAliasOf: row.runtimeAliasOf || null
            }])).values());
            const fixedSkills = Array.from(new Map(
                historyList
                    .filter(item => Array.isArray(item.issueCodes) && item.issueCodes.some(code => definition.issueCodes.includes(code)))
                    .map(item => [item.skillId, {
                        skillId: item.skillId,
                        skillName: this.getSkillConfig(item.skillId)?.name || item.skillId,
                        runtimeAliasOf: this.getSkillConfig(item.skillId)?.runtimeAliasOf || null,
                        fixedAt: item.fixedAt
                    }])
            ).values());
            const isClosed = rows.length === 0;
            const affectedSkills = isClosed ? fixedSkills : openSkills;
            const closedAt = isClosed
                ? (fixedSkills.map(item => item.fixedAt).filter(Boolean).sort().slice(-1)[0] || '')
                : '';
            return {
                ...definition,
                status: isClosed ? 'closed' : 'open',
                closedAt,
                openIssueCount: rows.length,
                affectedSkillCount: affectedSkills.length,
                affectedSkills,
                issues: rows
            };
        });

        return {
            ownerNode: 'WBS-3.3.3',
            selectedTreeId: catalog?.selectedTreeId || null,
            totalEntryCount: entries.length,
            batches
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
