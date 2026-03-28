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
            levels: normalizePathEntry(inputRegistry.levels, fallbackSources.levels, 'levels'),
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

    saveGame() {
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
            localStorage.setItem('save_game', json);
            console.log('Game saved.');
        }
    }

    loadGame() {
        const json = localStorage.getItem('save_game');
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
                bodyParts: playerTemplate.bodyParts ? JSON.parse(JSON.stringify(playerTemplate.bodyParts)) : undefined,
                equipment: JSON.parse(JSON.stringify(playerTemplate.equipment)),
                inventory: [...playerTemplate.inventory],
            },
            progress: {
                unlockedLevels: ['level_1_1'],
                completedQuests: [],
                flags: {}
            }
        };

        this.dataConfig.runtime = {
            currentScene: "MAIN_MENU",
            battleState: null
        };

        this.saveGame();
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
                items,
                enemies,
                levels,
                player,
                buffs: this._unwrapBuffDefinitions(buffs),
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

            console.log("? [DataManager] Configs successfully loaded from JSON files.", this.gameConfig);
        } catch (e) {
            // Fail fast: during development we want configuration/data issues to surface immediately
            // instead of silently falling back to mock data.
            console.error("[DataManager] Failed to load JSON configs. Aborting init.", e);
            this.gameConfig = {};
            this.contentRegistry = null;
            this.contentPacks = null;
            throw e;
        }
    }

    loadMockConfigs() {
        throw new Error('[DataManager] Mock mode has been removed. Fix data loading errors instead of falling back.');
    }

    getSkillConfig(skillId) {
        if (!this.gameConfig.skills) return null;

        const direct = this.gameConfig.skills[skillId];
        if (direct) return direct;

        const aliasId = this._enemySkillAliases[skillId];
        if (!aliasId) return null;

        const aliased = this.gameConfig.skills[aliasId];
        if (!aliased) return null;

        return {
            ...aliased,
            id: skillId,
            runtimeAliasOf: aliasId
        };
    }

    // Instantiate a level from config, creating runtime enemy instances
    instantiateLevel(levelId) {
        const levelConfig = this.gameConfig.levels[levelId];
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
        return this.gameConfig.levels[levelId];
    }

    /**
     * »ñÈ¡ËùÓÐ¹Ø¿¨ÁÐ±í
     * @returns {Array} ¹Ø¿¨¶ÔÏóÊý×é
     */
    getLevels() {
        if (!this.gameConfig || !this.gameConfig.levels) {
            return [];
        }
        return Object.values(this.gameConfig.levels);
    }
}

export default new DataManager();
