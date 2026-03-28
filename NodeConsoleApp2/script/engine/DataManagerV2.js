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
            const sources = dataSources.sources || {};

            const fetchConfig = async (sourceKey) => {
                const filename = sources[sourceKey];
                if (!filename) {
                    throw new Error(`Missing source path for ${sourceKey}`);
                }
                const normalizedFile = normalizeUrl(filename, null);
                const url = basePath
                    ? (normalizedFile.startsWith('http') || normalizedFile.startsWith('/')
                        ? normalizedFile
                        : `${basePath}${normalizedFile}`)
                    : normalizedFile;
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status} loading ${url}`);
                }
                return await response.json();
            };

            // Load player first so we can decide which skill tree to load
            const [player, items, enemies, levels, buffs] = await Promise.all([
                fetchConfig('player'),
                fetchConfig('items'),
                fetchConfig('enemies'),
                fetchConfig('levels'),
                fetchConfig('buffs')
            ]);

            let slotLayouts = null;
            if (sources.slotLayouts) {
                try {
                    slotLayouts = await fetchConfig('slotLayouts');
                } catch (e) {
                    console.warn('?? [DataManager] Failed to load slotLayouts. Reason:', e.message);
                    slotLayouts = null;
                }
            }

            const playerSkills = player && player.default ? player.default.skills : null;
            if (!playerSkills || typeof playerSkills !== 'object' || Array.isArray(playerSkills)) {
                throw new Error('Player skills must be an object schema.');
            }

            const skillTreeId = playerSkills.skillTreeId;
            const skillsByTree = sources.skillsByTree || {};
            const skillsPath = (skillTreeId && skillsByTree && skillsByTree[skillTreeId])
                ? skillsByTree[skillTreeId]
                : sources.skills;

            if (!skillsPath) {
                throw new Error('Missing skills source path (sources.skills or sources.skillsByTree[skillTreeId]).');
            }

            const normalizedSkillsPath = normalizeUrl(skillsPath, null);
            const skillsUrl = basePath
                ? (normalizedSkillsPath.startsWith('http') || normalizedSkillsPath.startsWith('/')
                    ? normalizedSkillsPath
                    : `${basePath}${normalizedSkillsPath}`)
                : normalizedSkillsPath;
            const skillsResp = await fetch(skillsUrl);
            if (!skillsResp.ok) {
                throw new Error(`HTTP error ${skillsResp.status} loading ${skillsUrl}`);
            }
            const skills = await skillsResp.json();

            if (!skills || !Array.isArray(skills.skills)) {
                throw new Error('Skills data must provide a skills array (skills_melee_v4_5.json format).');
            }

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
                slotLayouts
            };

            console.log("? [DataManager] Configs successfully loaded from JSON files.", this.gameConfig);
        } catch (e) {
            // Fail fast: during development we want configuration/data issues to surface immediately
            // instead of silently falling back to mock data.
            console.error("[DataManager] Failed to load JSON configs. Aborting init.", e);
            this.gameConfig = {};
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
