import EventBus from './EventBus.js';
import GameFSM from './GameFSM.js';
import GameLoop from './GameLoop.js';
import DataManager from './DataManagerV2.js';
import { BuffRegistry, BuffManager, BuffSystem } from './buff/index.js';
import TurnPlanner from './TurnPlanner.js';
import TimelineManager from './TimelineManager.js';
import EnemyActionPlanner from './EnemyActionPlanner.js';

class CoreEngine {
    constructor() {
        this.eventBus = EventBus;
        this.fsm = GameFSM;
        this.loop = GameLoop;
        this.data = DataManager;

		this.buffRegistry = new BuffRegistry();
		this.buffSystem = new BuffSystem(this.eventBus, this.buffRegistry);
        this.enemyPlanner = new EnemyActionPlanner({
            getSkillConfig: (skillId) => this.data.getSkillConfig(skillId)
        });

        this.turnPlanner = new TurnPlanner({
            getSlotLayout: () => this._getBattleSlotLayout(),
            getPlayerId: () => (this.data && this.data.playerData ? this.data.playerData.id : null),
            getSkillConfig: (skillId) => this.data.getSkillConfig(skillId),
            getCurrentAp: () => (this.data && this.data.playerData && this.data.playerData.stats ? this.data.playerData.stats.ap : 0),
            getUsedAp: () => (this.playerSkillQueue || []).reduce((sum, a) => sum + (Number(a.cost) || 0), 0)
        });

        this.timeline = new TimelineManager({
            eventBus: this.eventBus,
            executeEntry: async (entry) => this._executeTimelineEntry(entry)
        });
        
        this.input = {
            login: this.login.bind(this),
            selectLevel: this.selectLevel.bind(this),
            addSkillToQueue: this.addSkillToQueue.bind(this),
            removeSkillFromQueue: this.removeSkillFromQueue.bind(this),
         assignSkillToSlot: this.assignSkillToSlot.bind(this),
            unassignSlot: this.unassignSlot.bind(this),
            commitPlanning: this.commitPlanning.bind(this),
            commitTurn: this.commitTurn.bind(this),
            saveGame: this.saveGame.bind(this),
            loadGame: this.loadGame.bind(this),
            resumeGame: this.resumeGame.bind(this),
            backToTitle: this.backToTitle.bind(this),
            resetTurn: this.resetTurn.bind(this),
            confirmSettlement: this.confirmSettlement.bind(this),
            learnSkill: this.learnSkill.bind(this)
        };

        this.playerSkillQueue = [];
        this.enemySkillQueue = [];
        this.battlePhase = 'IDLE'; // IDLE, PLANNING, EXECUTION

        this._bindTimelineEvents();
        this._bindBuffBridgeEvents();

        this._battleSlotLayout = null;

        this.init();
    }

    _buildEffectiveApCostBySkill(skillIds) {
        const out = Object.create(null);
        const ids = Array.isArray(skillIds) ? skillIds : [];
        for (const id of ids) {
            const cfg = this.data.getSkillConfig(id);
            if (!cfg) continue;
            out[id] = this._getSkillApCostStrict(cfg, id, this.data.playerData);
        }
        return out;
    }

    _buildEffectiveApCostForAllSkills() {
        const catalog = typeof this.data?.getSkillCatalog === 'function'
            ? this.data.getSkillCatalog()
            : null;
        const ids = Array.isArray(catalog?.skillsList)
            ? catalog.skillsList.map(skill => skill.id).filter(Boolean)
            : [];
        const out = Object.create(null);
        for (const id of ids) {
            const cfg = this.data.getSkillConfig(id);
            if (!cfg) continue;
            out[id] = this._getSkillApCostStrict(cfg, id, this.data.playerData);
        }
        return out;
    }

    _getPlanningApCostModifier(actor) {
        return Number(actor?._planningApCostFlatDelta ?? 0) || 0;
    }

    _getSkillApCostStrict(skillConfig, skillIdForLog = null, actor = null) {
        const baseAp = Number(skillConfig?.costs?.ap);
        if (!Number.isFinite(baseAp) || baseAp < 0) {
            const name = skillConfig?.name ? ` (${skillConfig.name})` : '';
            const id = skillIdForLog || skillConfig?.id || 'unknown';
            throw new Error(`[CoreEngine] Invalid skill AP cost: skillId=${id}${name}. Expected skill.costs.ap number.`);
        }
        return Math.max(0, baseAp + this._getPlanningApCostModifier(actor));
    }

    _getEffectiveActorSpeed(actor, skillConfig = null) {
        const baseSpeed = Number(actor?.speed ?? actor?.stats?.speed ?? 0) || 0;
        const buffedSpeed = actor?.buffs?.getEffectiveStat
            ? actor.buffs.getEffectiveStat('speed', baseSpeed)
            : baseSpeed;
        const skillSpeed = Number(skillConfig?.speed ?? 0) || 0;
        return (Number(buffedSpeed) || 0) + skillSpeed;
    }

    _buildBattlePlayerSkills() {
        const base = this.data?.playerData?.skills;
        const learnedBase = Array.isArray(base?.learned) ? base.learned : [];
        const battleSkills = this.data?.currentLevelData?.battlePlayerSkills;
        const learnedAdd = Array.isArray(battleSkills?.learnedAdd) ? battleSkills.learnedAdd : [];

        if (learnedAdd.length === 0) {
            return base;
        }

        const mergedLearned = Array.from(new Set([...learnedBase, ...learnedAdd]));
        return {
            ...(base && typeof base === 'object' ? base : {}),
            learned: mergedLearned
        };
    }

    _buildBattlePlayerState() {
        const runtimeState = {
            buffs: [],
            tempStatModifiers: {},
            bodyParts: this.initializePlayerBodyParts(this.data.playerData)
        };
        const levelState = this.data?.currentLevelData?.battlePlayerState;
        if (!levelState || typeof levelState !== 'object') {
            return runtimeState;
        }

        if (levelState.bodyParts && typeof levelState.bodyParts === 'object') {
            for (const [partKey, override] of Object.entries(levelState.bodyParts)) {
                if (!override || typeof override !== 'object') continue;
                runtimeState.bodyParts[partKey] = {
                    ...(runtimeState.bodyParts[partKey] || {}),
                    ...JSON.parse(JSON.stringify(override))
                };
            }
        }

        return runtimeState;
    }

    _enterPlanningBudgetSnapshot() {
        const availableAp = Number(this.data?.playerData?.stats?.ap ?? 0) || 0;
      // Important: UI may present skills not strictly limited to `player.skills.learned`
        // (e.g. mock UI static buttons / debug injection). To keep the planning budget
        // consistent, build a cost map that covers all known skills.
        const effectiveApCostBySkill = this._buildEffectiveApCostForAllSkills();
        if (!effectiveApCostBySkill || Object.keys(effectiveApCostBySkill).length === 0) {
            this.eventBus.emit('BATTLE_LOG', { text: 'Planning init warning: effectiveApCostBySkill is empty (skills not loaded?)' });
        }
        const res = this.turnPlanner.enterPlanning({ availableAp, effectiveApCostBySkill });
        if (!res.ok) {
            this.eventBus.emit('BATTLE_LOG', { text: `Planning init failed: ${res.reason || 'unknown'}` });
        }
    }

    _bindTimelineEvents() {
        if (!this.eventBus || typeof this.eventBus.on !== 'function') {
            throw new Error('[CoreEngine] EventBus must support .on(event, handler).');
        }

        this.eventBus.on('TIMELINE_FINISHED', ({ roundId } = {}) => {
            if (this.fsm.currentState !== 'BATTLE_LOOP') return;
            if (this.battlePhase !== 'EXECUTION') return;
            if (roundId !== this.timeline.roundId) return;

            // Turn end hooks (DoT / duration tick)
            this.eventBus.emit('TURN_END', { turn: this.currentTurn });
            this.startTurn();
        });

        this.eventBus.on('TIMELINE_ERROR', ({ message, details } = {}) => {
            if (this.fsm.currentState !== 'BATTLE_LOOP') return;
            if (this.battlePhase !== 'EXECUTION') return;

            this.eventBus.emit('BATTLE_LOG', { text: `Timeline execute failed: ${message}` });
            this.emitBattleUpdate();
        });
    }

    _bindBuffBridgeEvents() {
        if (!this.eventBus || typeof this.eventBus.on !== 'function') return;

        this.eventBus.on('BUFF_ATTACK_REQUEST', (payload = {}) => {
            this._handleBuffAttackRequest(payload);
        });
    }

    // ----------------- Battle Rules: Slot Layout -----------------

    _getSlotLayoutsRoot() {
        return (this.data && this.data.gameConfig) ? this.data.gameConfig.slotLayouts : null;
    }

    _resolveSlotLayoutIdForCurrentBattle() {
        const levelId = this.data && this.data.currentLevelData ? this.data.currentLevelData.id : null;
        const levelCfg = levelId && this.data && typeof this.data.getLevelConfig === 'function'
            ? this.data.getLevelConfig(levelId)
            : null;
        const fromLevel = levelCfg && levelCfg.battleRules ? levelCfg.battleRules.slotLayoutId : null;
        const fromConfig = (this.data && this.data.dataConfig && this.data.dataConfig.battleRules)
            ? this.data.dataConfig.battleRules.slotLayoutId
            : null;
        const fromSourcesConfig = (this.data && this.data._dataSourcesVersion) // keep method side-effect free
            ? null
            : null;

        return fromLevel || fromConfig || 'default_v1';
    }

    _getBattleSlotLayout() {
        if (this._battleSlotLayout) return this._battleSlotLayout;

        const root = this._getSlotLayoutsRoot();
        const layoutId = this._resolveSlotLayoutIdForCurrentBattle();
        const layout = root && root.layouts ? root.layouts[layoutId] : null;
        this._battleSlotLayout = layout || null;
        return this._battleSlotLayout;
    }

    _getSlotCapacity(side, bodyPart) {
        const layout = this._getBattleSlotLayout();
        if (!layout || !layout.slotCounts) return Infinity;
        const row = layout.slotCounts[bodyPart];
        const cap = row && row[side] !== undefined ? Number(row[side]) : Infinity;
        return Number.isFinite(cap) ? cap : Infinity;
    }

    _getUsedSlotsCount(queue, side, bodyPart) {
        return (queue || []).filter(a => {
            const isSelf = (a.targetId === this.data.playerData.id);
            const aSide = isSelf ? 'self' : 'enemy';
            return aSide === side && a.bodyPart === bodyPart;
        }).length;
    }

    _resetTurnFlags() {
        if (this.data?.playerData) {
            this.data.playerData._skipTurn = false;
            this.data.playerData._planningApCostFlatDelta = 0;
        }

        const enemies = this.data?.currentLevelData?.enemies;
        if (!Array.isArray(enemies)) return;
        enemies.forEach(enemy => {
            enemy._skipTurn = false;
            enemy._planningApCostFlatDelta = 0;
        });
    }

    _isPlayerEntity(entity) {
        return !!entity && !!this.data?.playerData && entity.id === this.data.playerData.id;
    }

    _getEntityById(entityId) {
        if (!entityId) return null;
        if (this.data?.playerData?.id === entityId) return this.data.playerData;
        const enemies = this.data?.currentLevelData?.enemies;
        return Array.isArray(enemies) ? (enemies.find(enemy => enemy.id === entityId) || null) : null;
    }

    _getPlayerRuntimeBodyParts() {
        return this.data?.dataConfig?.runtime?.playerBattleState?.bodyParts || this.data?.playerData?.bodyParts || null;
    }

    _getEntityBodyParts(entity) {
        if (!entity) return null;
        if (this._isPlayerEntity(entity)) return this._getPlayerRuntimeBodyParts();
        return entity.bodyParts || null;
    }

    _getEntityCurrentHp(entity) {
        if (!entity) return 0;
        if (typeof entity.hp === 'number') return entity.hp;
        return Number(entity?.stats?.hp ?? 0) || 0;
    }

    _setEntityCurrentHp(entity, hp) {
        if (!entity) return;
        const maxHp = this._getEntityMaxHp(entity);
        const clamped = Math.max(0, Math.min(maxHp, Number(hp) || 0));
        if (typeof entity.hp === 'number') entity.hp = clamped;
        if (entity.stats && typeof entity.stats === 'object' && typeof entity.stats.hp === 'number') {
            entity.stats.hp = clamped;
        }
    }

    _getEntityMaxHp(entity) {
        if (!entity) return 0;
        if (typeof entity.maxHp === 'number') return entity.maxHp;
        return Number(entity?.stats?.maxHp ?? entity?.stats?.hp ?? 0) || 0;
    }

    _getEntityCurrentAp(entity) {
        return Number(entity?.stats?.ap ?? entity?.ap ?? 0) || 0;
    }

    _setEntityCurrentAp(entity, ap) {
        if (!entity) return;
        const value = Math.max(0, Number(ap) || 0);
        if (entity.stats && typeof entity.stats === 'object' && typeof entity.stats.ap === 'number') {
            entity.stats.ap = value;
        } else {
            entity.ap = value;
        }
    }

    _skillRequiresBodyPart(skillConfig) {
        const scope = skillConfig?.target?.scope;
        return scope === 'SCOPE_PART' || scope === 'SCOPE_MULTI_PARTS';
    }

    _validateSkillTargetSelection({ skillConfig, sourceId, targetId, bodyPart }) {
        const target = this._getEntityById(targetId);
        if (!target) return { ok: false, reason: `Invalid target: ${targetId}` };

        const subject = skillConfig?.target?.subject;
        if (subject === 'SUBJECT_SELF' && sourceId !== targetId) {
            return { ok: false, reason: `Skill ${skillConfig?.name || skillConfig?.id} must target self.` };
        }
        if (subject === 'SUBJECT_ENEMY' && sourceId === targetId) {
            return { ok: false, reason: `Skill ${skillConfig?.name || skillConfig?.id} must target enemy.` };
        }

        if (this._skillRequiresBodyPart(skillConfig)) {
            if (!bodyPart) {
                return { ok: false, reason: `Skill ${skillConfig?.name || skillConfig?.id} requires a target body part.` };
            }

            const bodyParts = this._getEntityBodyParts(target);
            if (!bodyParts || !bodyParts[bodyPart]) {
                return { ok: false, reason: `Invalid body part '${bodyPart}' for target.` };
            }
        }

        return { ok: true, target };
    }

    _getDefaultBodyPart(target, preferredPart = null) {
        const bodyParts = this._getEntityBodyParts(target);
        if (!bodyParts || typeof bodyParts !== 'object') return null;
        if (preferredPart && bodyParts[preferredPart]) return preferredPart;

        const candidates = Object.entries(bodyParts)
            .filter(([, part]) => Number(part?.max ?? 0) > 0 || Number(part?.current ?? 0) > 0);
        if (candidates.length === 0) return Object.keys(bodyParts)[0] || null;

        candidates.sort((a, b) => {
            const armorA = Number(a[1]?.current ?? 0) || 0;
            const armorB = Number(b[1]?.current ?? 0) || 0;
            if (armorA !== armorB) return armorA - armorB;

            const weakA = Number(a[1]?.weakness ?? 1) || 1;
            const weakB = Number(b[1]?.weakness ?? 1) || 1;
            return weakB - weakA;
        });

        return candidates[0][0];
    }

    learnSkill(skillId) {
        const player = this.data.playerData;
        if (!player) return;
        if (!player.skills || typeof player.skills !== 'object') player.skills = {};
        if (!Array.isArray(player.skills.learned)) player.skills.learned = [];
        if (typeof player.skills.skillPoints !== 'number') player.skills.skillPoints = 0;

        const def = this.data?.getSkillConfig ? this.data.getSkillConfig(skillId) : null;
        if (!def) {
            console.warn('[CoreEngine] learnSkill: skill not found:', skillId);
            return;
        }

        if (player.skills.learned.includes(skillId)) return;

        const prereqs = Array.isArray(def.prerequisites) ? def.prerequisites : [];
        const missing = prereqs.filter(p => !player.skills.learned.includes(p));
        if (missing.length > 0) {
            console.warn('[CoreEngine] learnSkill: missing prerequisites:', missing);
            return;
        }

        const cost = Number(def?.unlock?.cost?.kp) || 0;
        if (player.skills.skillPoints < cost) {
            console.warn('[CoreEngine] learnSkill: insufficient KP');
            return;
        }

        const exclusives = Array.isArray(def?.unlock?.exclusives) ? def.unlock.exclusives : [];
        if (exclusives.some(x => player.skills.learned.includes(x))) {
            console.warn('[CoreEngine] learnSkill: exclusive lock');
            return;
        }

        player.skills.skillPoints -= cost;
        player.skills.learned.push(skillId);

        this.eventBus.emit('DATA_UPDATE', { type: 'PLAYER_SKILLS', data: player.skills });
        this.data.saveGame();
    }

    async init() {
        console.log('Engine initializing...');
        this.fsm.changeState('INIT');
        
        await this.data.loadConfigs();
		this.buffRegistry.setDefinitions(
            typeof this.data?.getBuffDefinitions === 'function'
                ? this.data.getBuffDefinitions()
                : ((this.data.gameConfig && this.data.gameConfig.buffs) ? this.data.gameConfig.buffs : {})
        );
		this.buffSystem.start();
        
        this.loop.start();
        
        // 初始化后自动跳转到登录状态
        this.fsm.changeState('LOGIN');
        console.log('Engine initialized.');
    }

    // --- 输入处理程序 ---

    login(username) {
        if (this.fsm.currentState !== 'LOGIN') return;

        console.log(`User logging in: ${username}`);
        // 尝试先加载现有游戏
        if (!this.data.loadGame()) {
            this.data.createNewGame(username);
        }
        
        // 统一行为：登录后总是进入主菜单
        // 仅切换状态，具体显示逻辑（如是否显示“继续游戏”）由 UI 层根据数据决定
        this.fsm.changeState('MAIN_MENU');
        this.eventBus.emit('DATA_UPDATE', this.data.playerData);
    }

    // 强制创建新游戏，覆盖现有存档
    resetGame(username) {
        console.log(`Resetting game for user: ${username}`);
        this.data.createNewGame(username);
        
        // 如果我们在登录状态，转换到主菜单
        // 如果我们已经在游戏中，只需更新数据
        if (this.fsm.currentState === 'LOGIN') {
            this.fsm.changeState('MAIN_MENU');
        }
        
        this.eventBus.emit('DATA_UPDATE', this.data.playerData);
        this.eventBus.emit('BATTLE_LOG', { text: 'Game has been reset. New game started.' });
    }

    selectLevel(levelId) {
        if (this.fsm.currentState !== 'MAIN_MENU' && this.fsm.currentState !== 'LEVEL_SELECT') return;

        const levelData = this.data.instantiateLevel(levelId);
        if (!levelData) {
            console.error('Level not found:', levelId);
            return;
        }

        console.log(`Level selected: ${levelId}`);
        this.data.currentLevelData = levelData;
        this.fsm.changeState('BATTLE_PREPARE');
        
        // 暂时模拟立即进入战斗
        setTimeout(() => {
            this.startBattle();
        }, 500);
    }

    startBattle() {
        // Ensure BuffManager exists for player
        if (this.data.playerData) {
			if (!this.data.playerData.buffs) {
				this.data.playerData.buffs = new BuffManager(this.data.playerData, this.buffRegistry, this.eventBus);
				this.buffSystem.registerManager(this.data.playerData.buffs);
			}
		}

        // Reset Player State at start of battle (Design 3.3)
        if (this.data.playerData) {
            const p = this.data.playerData;
            // 1. Reset Stats
            if (p.stats) {
                p.stats.hp = p.stats.maxHp;
                p.stats.ap = p.stats.maxAp;
            }
            // 2. Reset Body Parts (Base)
            if (p.bodyParts) {
                for (const key in p.bodyParts) {
                    const part = p.bodyParts[key];
                    part.current = part.max || 0;
                    part.status = 'NORMAL';
                }
            }
            this.eventBus.emit('DATA_UPDATE', p);
        }

        this.currentTurn = 0;
        this.fsm.changeState('BATTLE_LOOP');
        
        // 初始化运行时数据结构
        if (!this.data.dataConfig.runtime) this.data.dataConfig.runtime = {};
        const runtime = this.data.dataConfig.runtime;

        // 1. 初始状态快照
        runtime.initialState = {
            enemies: JSON.parse(JSON.stringify(this.data.currentLevelData.enemies))
        };

        // 2. 历史记录
        runtime.history = [];

        // 3. 队列
        runtime.queues = {
            player: [],
            enemy: []
        };

        // 3.2 Planning state (slot-key based)
        runtime.planning = {
            player: {
                assigned: {},
                actionsById: {},
                order: [],
                skillCounts: {}
            }
        };

        // 3.1 Battle rules snapshot (slots)
        runtime.battleRules = runtime.battleRules || {};
        const slotLayoutId = this._resolveSlotLayoutIdForCurrentBattle();
        runtime.battleRules.slotLayoutId = slotLayoutId;
        const layoutRoot = this._getSlotLayoutsRoot();
        runtime.battleRules.slotLayout = (layoutRoot && layoutRoot.layouts && layoutRoot.layouts[slotLayoutId])
            ? JSON.parse(JSON.stringify(layoutRoot.layouts[slotLayoutId]))
            : null;

        this._battleSlotLayout = runtime.battleRules.slotLayout;

        // 4. 玩家临时状态
        runtime.playerBattleState = this._buildBattlePlayerState();
        this.data.playerData.bodyParts = runtime.playerBattleState.bodyParts;

        const playerWithRuntime = {
            ...this.data.playerData,
            skills: this._buildBattlePlayerSkills(),
            bodyParts: runtime.playerBattleState.bodyParts
        };

        this.eventBus.emit('BATTLE_START', { 
            player: playerWithRuntime, 
            level: this.data.currentLevelData 
        });

		// Ensure BuffManager exists for enemies
            if (this.data.currentLevelData && Array.isArray(this.data.currentLevelData.enemies)) {
			for (const enemy of this.data.currentLevelData.enemies) {
				if (!enemy.buffs) {
					enemy.buffs = new BuffManager(enemy, this.buffRegistry, this.eventBus);
					this.buffSystem.registerManager(enemy.buffs);
				}
                if (enemy.stats && typeof enemy.stats === 'object') {
                    enemy.stats.ap = Number(enemy.stats.maxAp ?? enemy.stats.ap ?? 0) || 0;
                }
			}
		}

        this.startTurn();
    }

    initializePlayerBodyParts(playerData) {
        // 1. Define standard 5 body parts
        const partNames = ['head', 'chest', 'abdomen', 'arm', 'leg'];
        let bodyParts = {};

        // Use defined bodyParts if available, deep copy to avoid mutation
        if (playerData.bodyParts) {
            bodyParts = JSON.parse(JSON.stringify(playerData.bodyParts));
        }

        // Ensure all parts exist and set defaults if missing
        partNames.forEach(name => {
            if (!bodyParts[name]) {
                bodyParts[name] = {
                    current: 0,
                    max: 0,
                    weakness: 1.0, 
                    status: 'NORMAL'
                };
                
                // Apply default weaknesses for generated parts
                if (name === 'head') bodyParts[name].weakness = 1.5;
                if (name === 'abdomen') bodyParts[name].weakness = 1.1;
            } else {
                 // Ensure fields
                 if (bodyParts[name].current === undefined) bodyParts[name].current = 0;
                 if (bodyParts[name].max === undefined) bodyParts[name].max = 0;
                 if (bodyParts[name].weakness === undefined) bodyParts[name].weakness = 1.0;
                 if (!bodyParts[name].status) bodyParts[name].status = 'NORMAL';
            }
        });

        // 2. Apply Equipment Buffs (Add on top of base values)
        if (playerData.equipment && this.data.gameConfig && this.data.gameConfig.items) {
            for (const [slot, itemId] of Object.entries(playerData.equipment)) {
                if (!itemId) continue;

                // Lookup item config
                const item = this.data.gameConfig.items[itemId];
                if (!item || !item.buffs) continue;

                // Process passive buffs (duration = -1)
                item.buffs.forEach(buff => {
                    if (buff.type === 'BUFF' && buff.effect === 'STAT_MOD' && buff.duration === -1) {
                        // Handle armor stats (e.g., "armor_head")
                        if (buff.stat && buff.stat.startsWith('armor_')) {
                            const partName = buff.stat.replace('armor_', '');
                            if (bodyParts[partName]) {
                                bodyParts[partName].max += buff.value;
                                bodyParts[partName].current += buff.value;
                            }
                        }
                        // Note: Other stats like attack/speed would be handled by a global stat manager,
                        // effectively modifying the player's runtime stats, not body parts.
                    }
                });
            }
        }
        
        return bodyParts;
    }

    resumeBattle() {
        const runtime = this.data.dataConfig.runtime;
        this.currentTurn = runtime.turn || 1;
        this.battlePhase = runtime.phase || 'PLANNING';

		// Ensure BuffManager exists for player after load
		if (this.data.playerData && !this.data.playerData.buffs) {
			this.data.playerData.buffs = new BuffManager(this.data.playerData, this.buffRegistry, this.eventBus);
			this.buffSystem.registerManager(this.data.playerData.buffs);
		}

        if (this.data.currentLevelData && Array.isArray(this.data.currentLevelData.enemies)) {
            for (const enemy of this.data.currentLevelData.enemies) {
                if (!enemy.buffs) {
                    enemy.buffs = new BuffManager(enemy, this.buffRegistry, this.eventBus);
                    this.buffSystem.registerManager(enemy.buffs);
                }
            }
        }
        
        // 恢复队列
        this.playerSkillQueue = runtime.queues ? (runtime.queues.player || []) : [];
        this.enemySkillQueue = runtime.queues ? (runtime.queues.enemy || []) : [];

        this.fsm.changeState('BATTLE_LOOP');
        
        // Prepare player object with runtime body parts
        const playerWithRuntime = {
            ...this.data.playerData,
            bodyParts: (runtime.playerBattleState) ? runtime.playerBattleState.bodyParts : {}
        };
        if (runtime.playerBattleState?.bodyParts) {
            this.data.playerData.bodyParts = runtime.playerBattleState.bodyParts;
        }

        this.eventBus.emit('BATTLE_START', { 
            player: playerWithRuntime, 
            level: this.data.currentLevelData 
        });
        
        console.log(`Resumed battle at Turn ${this.currentTurn}, Phase ${this.battlePhase}`);
        
        // 如果是在执行阶段恢复，可能需要继续执行或重新开始回合逻辑
        // 为了简单，如果是在执行阶段恢复，强制重置为规划阶段
        // 或者如果是结算后，只是恢复 UI 状态。
        
        this.emitBattleUpdate();
        this.eventBus.emit('BATTLE_LOG', { text: `Game Resumed. Turn ${this.currentTurn}.` });
    }

    resumeGame() {
        console.log('Resume Game requested.');
        if (this.fsm.currentState === 'MAIN_MENU') {
             if (this.data.dataConfig.runtime && this.data.dataConfig.runtime.levelData) {
                this.resumeBattle();
             } else {
                 console.warn('No saved battle to resume.');
             }
        } else if (this.fsm.currentState === 'BATTLE_LOOP' || this.fsm.currentState === 'BATTLE_PREPARE') {
            // Just close modal, handled by UI usually, but engine can emit event
            this.eventBus.emit('UI:CLOSE_MODAL');
        }
    }

    backToTitle() {
        console.log('Returning to title...');
        this.fsm.changeState('LOGIN');
        // Reset runtime data if needed, but keep global config?
        // For now, just switch state.
    }

    confirmSettlement() {
        if (this.fsm.currentState !== 'BATTLE_SETTLEMENT') return;
        console.log('Confirming settlement, returning to menu...');
        this.fsm.changeState('MAIN_MENU');
    }

    loadGame(slotId) {
        console.log(`Loading game (slot ${slotId})...`);
        if (this.data.loadGame(slotId)) {
            this.eventBus.emit('DATA_UPDATE', this.data.playerData);
            
            // Check if we should resume a battle
            if (this.data.dataConfig.runtime && this.data.dataConfig.runtime.levelData) {
                this.resumeBattle();
            } else {
                this.fsm.changeState('MAIN_MENU');
            }
        } else {
            this.eventBus.emit('BATTLE_LOG', { text: 'Failed to load game.' });
        }
    }

    saveGame(slotId) {
        // 保存前将当前战斗状态同步到 DataManager
        if (this.fsm.currentState === 'BATTLE_LOOP') {
            this.saveBattleState();
        } else {
            if (!this.data.dataConfig.runtime) this.data.dataConfig.runtime = {};
            // 如果不在战斗中，清除战斗运行时数据
            this.data.dataConfig.runtime.currentScene = this.fsm.currentState || 'MAIN_MENU';
            this.data.dataConfig.runtime.battleState = null;
            delete this.data.dataConfig.runtime.levelData;
            delete this.data.dataConfig.runtime.turn;
            delete this.data.dataConfig.runtime.phase;
            delete this.data.dataConfig.runtime.initialState;
            delete this.data.dataConfig.runtime.history;
            delete this.data.dataConfig.runtime.queues;
            delete this.data.dataConfig.runtime.playerTempState;
            this.data.currentLevelData = null;
        }
        
        this.data.saveGame();
        this.eventBus.emit('BATTLE_LOG', { text: 'Game Saved.' });
    }

    startTurn() {
        this.currentTurn++;
        console.log('Turn Started: ' + this.currentTurn);
        
        this.battlePhase = 'PLANNING';
        
        // 记录历史快照
        if (this.data.dataConfig.runtime) {
            if (!this.data.dataConfig.runtime.history) this.data.dataConfig.runtime.history = [];
            
            const snapshot = {
                player: { 
                    hp: this.data.playerData.stats.hp, 
                    ap: this.data.playerData.stats.ap 
                },
                enemies: this.data.currentLevelData.enemies.map(e => ({
                    id: e.id,
                    hp: e.hp,
                    pos: e.position || 0
                }))
            };

            this.currentHistoryEntry = {
                turn: this.currentTurn,
                timestamp: Date.now(),
                seed: 'mock_seed_' + Date.now(),
                snapshot: snapshot,
                systemEvents: [],
                actions: []
            };
            this.data.dataConfig.runtime.history.push(this.currentHistoryEntry);
        }

        this.saveBattleState();

        this.playerSkillQueue = [];
        this.enemySkillQueue = [];
        this.turnPlanner.reset();
        // IMPORTANT (strict): do NOT reset timeline here (reset would force IDLE inside
        // TIMELINE_FINISHED listener chains). Instead, clear entries for the new turn.
        if (this.timeline && typeof this.timeline.clearForNextTurn === 'function') {
            this.timeline.clearForNextTurn({ roundId: this.currentTurn });
        }
        this._syncPlannerToRuntime();

        // 重置 AP
        if (this.data.playerData) {
            this.data.playerData.stats.ap = this.data.playerData.stats.maxAp;
            this.eventBus.emit('DATA_UPDATE', this.data.playerData);
        }

        if (this.data.currentLevelData?.enemies) {
            this.data.currentLevelData.enemies.forEach(enemy => {
                if (enemy.stats && typeof enemy.stats === 'object') {
                    enemy.stats.ap = Number(enemy.stats.maxAp ?? enemy.stats.ap ?? 0) || 0;
                }
            });
        }

        this._resetTurnFlags();
        this.eventBus.emit('TURN_START', { turn: this.currentTurn });
        this.checkBattleStatus();
        if (this.fsm.currentState !== 'BATTLE_LOOP') return;

        // Planning-enter snapshot: initialize AP budget FSM once per planning phase.
        this._enterPlanningBudgetSnapshot();
        this.emitBattleUpdate();
        this.eventBus.emit('BATTLE_LOG', { text: `Turn ${this.currentTurn} started. Please configure skills.` });
    }

    addSkillToQueue(skillId, targetId, bodyPart) {
        if (this.fsm.currentState !== 'BATTLE_LOOP' || this.battlePhase !== 'PLANNING') return;

        const player = this.data.playerData;
        const skillConfig = this.data.getSkillConfig(skillId);
        
        if (!skillConfig) {
            this.eventBus.emit('BATTLE_LOG', { text: `Unknown skill: ${skillId}` });
            return;
        }

        const validation = this._validateSkillTargetSelection({
            skillConfig,
            sourceId: player.id,
            targetId,
            bodyPart
        });
        if (!validation.ok) {
            this.eventBus.emit('BATTLE_LOG', { text: validation.reason });
            return;
        }

        const cost = this._getSkillApCostStrict(skillConfig, skillId, player);

        // Slot capacity validation (core mechanic)
        const isSelfTarget = (targetId === this.data.playerData.id);
        const side = isSelfTarget ? 'self' : 'enemy';
        const capacity = this._getSlotCapacity(side, bodyPart);
        const used = this._getUsedSlotsCount(this.playerSkillQueue, side, bodyPart);
        if (used >= capacity) {
            this.eventBus.emit('BATTLE_LOG', { text: `No available slot for ${side}:${bodyPart} (capacity ${capacity}).` });
            return;
        }

        // 计算当前 AP 使用量
        const currentQueueCost = this.playerSkillQueue.reduce((sum, action) => sum + action.cost, 0);
        if (player.stats.ap < currentQueueCost + cost) {
            this.eventBus.emit('BATTLE_LOG', { text: `Not enough AP! Cannot add more skills.` });
            return;
        }

        const skillAction = {
            source: 'PLAYER',
            skillId,
            targetId,
            bodyPart,
            cost,
            speed: this._getEffectiveActorSpeed(player, skillConfig)
        };
        this.playerSkillQueue.push(skillAction);
        
        this.eventBus.emit('BATTLE_LOG', { text: `Added skill: ${skillConfig.name} (Cost: ${cost} AP)` });
        this.emitBattleUpdate();
    }

    // slotKey-based planning API
    assignSkillToSlot({ slotKey, skillId, targetId, bodyPart, replaceIfAlreadyPlaced = true }) {
        if (this.fsm.currentState !== 'BATTLE_LOOP' || this.battlePhase !== 'PLANNING') return;

        const skillConfig = this.data.getSkillConfig(skillId);
        if (!skillConfig) {
            this.eventBus.emit('BATTLE_LOG', { text: `Unknown skill: ${skillId}` });
            return;
        }

        const validation = this._validateSkillTargetSelection({
            skillConfig,
            sourceId: this.data.playerData.id,
            targetId,
            bodyPart
        });
        if (!validation.ok) {
            this.eventBus.emit('BATTLE_LOG', { text: validation.reason });
            return;
        }

        const cost = this._getSkillApCostStrict(skillConfig, skillId, this.data.playerData);
        const speed = this._getEffectiveActorSpeed(this.data.playerData, skillConfig);

        const res = this.turnPlanner.assign({
            slotKey,
            skillId,
            targetId,
            bodyPart,
            cost,
            speed,
            replaceIfAlreadyPlaced
        });

        if (!res.ok) {
            this.eventBus.emit('BATTLE_LOG', { text: res.reason || 'Cannot assign to slot.' });
            return;
        }

        this._freezePlannerToQueue();
        this._syncPlannerToRuntime();
        this.eventBus.emit('BATTLE_LOG', { text: `Placed skill: ${skillConfig.name}` });
        this.emitBattleUpdate();
    }

    // Draft-first planning API (batch commit)
    commitPlanning({ planningDraftBySkill }) {
        if (this.fsm.currentState !== 'BATTLE_LOOP' || this.battlePhase !== 'PLANNING') return;

        const drafts = planningDraftBySkill && typeof planningDraftBySkill === 'object'
            ? Object.values(planningDraftBySkill)
            : [];

        const normalized = Object.create(null);
       const apBudget = this.turnPlanner?.getApBudgetState ? this.turnPlanner.getApBudgetState() : null;
        for (const d of drafts) {
            if (!d || !d.skillId) continue;

            const skillConfig = this.data.getSkillConfig(d.skillId);
            if (!skillConfig) {
                this.eventBus.emit('BATTLE_LOG', { text: `Unknown skill: ${d.skillId}` });
                this.eventBus.emit('PLANNING_COMMIT_FAILED', { reason: `Unknown skill: ${d.skillId}`, skillId: d.skillId });
                return;
            }

            const cost = Number(apBudget?.effectiveApCostBySkill?.[d.skillId]);
            if (!Number.isFinite(cost)) {
                // Strict mode: AP budget snapshot must provide cost for all skills.
                // If missing, treat as hard data/config error.
                throw new Error(`[CoreEngine] Missing effective AP cost for skillId=${d.skillId} (planning budget not initialized correctly).`);
            }
            const speed = (this.data.playerData.stats.speed || 10) + (Number(skillConfig.speed) || 0);
            normalized[d.skillId] = {
                ...d,
                cost,
                speed
            };
        }

        const res = this.turnPlanner.planMany({ planningDraftBySkill: normalized });
        if (!res.ok) {
            const reason = Array.isArray(res.errors) && res.errors.length > 0
                ? (res.errors[0].reason || 'Cannot commit planning.')
                : (res.reason || 'Cannot commit planning.');
            this.eventBus.emit('BATTLE_LOG', { text: reason });
            this.eventBus.emit('PLANNING_COMMIT_FAILED', { reason, errors: res.errors || [] });
            return;
        }

        // Dev-only visibility: print submitted planning input/output to console for verification.
        try {
            const safeNormalized = JSON.parse(JSON.stringify(normalized));
            const planned = this.turnPlanner.getPlannedActions();
            const safePlanned = JSON.parse(JSON.stringify(planned));
            console.groupCollapsed('[Planning Commit]');
            console.log('input.planningDraftBySkill(normalized)=', safeNormalized);
            console.log('output.plannedActions=', safePlanned);
            console.groupEnd();
        } catch (e) {
            console.log('[Planning Commit] (log failed)', e);
        }

        this._freezePlannerToQueue();
        this._syncPlannerToRuntime();

        // Build timeline immediately so UI can preview the round order after planning commit.
        // This keeps "提交规划" (commit) decoupled from "执行" (playback).
        this.enemySkillQueue = this._buildEnemyPlans();

        const loadRes = this.timeline.loadRoundActions({
            roundId: this.currentTurn,
            selfPlans: this.playerSkillQueue,
            enemyPlans: this.enemySkillQueue,
            rules: { tieBreak: 'selfFirst' }
        });

        if (!loadRes.ok) {
            this.eventBus.emit('BATTLE_LOG', { text: `Timeline build failed: ${loadRes.reason}` });
            // Fail-fast: do not continue with an inconsistent preview state.
            return;
        }

        this.eventBus.emit('PLANNING_COMMITTED', {
            planningDraftBySkill: JSON.parse(JSON.stringify(normalized)),
            plannedActions: JSON.parse(JSON.stringify(this.turnPlanner.getPlannedActions()))
        });
        this.eventBus.emit('BATTLE_LOG', { text: 'Planning committed.' });
        this.emitBattleUpdate();
    }

    unassignSlot(slotKey) {
        if (this.fsm.currentState !== 'BATTLE_LOOP' || this.battlePhase !== 'PLANNING') return;
        const res = this.turnPlanner.unassign(slotKey);
        if (!res.ok) {
            this.eventBus.emit('BATTLE_LOG', { text: res.reason || 'Cannot unassign slot.' });
            return;
        }
        if (res.removed) {
            this._freezePlannerToQueue();
            this._syncPlannerToRuntime();
            this.eventBus.emit('BATTLE_LOG', { text: `Removed action from ${slotKey}` });
            this.emitBattleUpdate();
        }
    }

    _freezePlannerToQueue() {
        this.playerSkillQueue = this.turnPlanner.getPlannedActions().map(a => ({
            ...a
        }));
    }

    _syncPlannerToRuntime() {
        const rt = this.data && this.data.dataConfig ? this.data.dataConfig.runtime : null;
        if (!rt) return;
        if (!rt.planning) rt.planning = {};
        if (!rt.planning.player) rt.planning.player = {};
        rt.planning.player.assigned = { ...this.turnPlanner.assigned };
        rt.planning.player.actionsById = { ...this.turnPlanner.actionsById };
        rt.planning.player.order = [...this.turnPlanner.order];
        rt.planning.player.skillCounts = { ...this.turnPlanner.skillCounts };

        rt.planning.player.plannedBySkill = { ...this.turnPlanner.plannedBySkill };
        rt.planning.player.skillToSlots = { ...this.turnPlanner.skillToSlots };
    }

    removeSkillFromQueue(index) {
        console.error('[CoreEngine] Deprecated input.removeSkillFromQueue called. Use input.unassignSlot(slotKey).', { index });
        this.eventBus.emit('BATTLE_LOG', { text: '已禁用旧接口 removeSkillFromQueue，请使用槽位取消接口。' });
        this.eventBus.emit('PLANNING_COMMIT_FAILED', {
            reason: 'Deprecated API removeSkillFromQueue called.',
            api: 'removeSkillFromQueue'
        });
    }

    commitTurn() {
        if (this.fsm.currentState !== 'BATTLE_LOOP' || this.battlePhase !== 'PLANNING') return;

        const tlPhase = this.timeline.phase;
        if (tlPhase !== 'READY') {
            this.eventBus.emit('BATTLE_LOG', { text: `Cannot execute: timeline is not READY (phase=${tlPhase}). Please commit planning first.` });
            return;
        }

        console.log('Execute turn (timeline playback).');
        this.battlePhase = 'EXECUTION';
        this.saveBattleState();
        this.emitBattleUpdate();

        this.executeTurn();
    }

    async executeTurn() {
        this.eventBus.emit('BATTLE_LOG', { text: `--- Execution Phase ---` });

        const timelineRes = await this.timeline.start({
            canContinue: () => this.fsm.currentState === 'BATTLE_LOOP'
        });

        if (!timelineRes.ok) {
            // TimelineManager will emit TIMELINE_ERROR; keep host in EXECUTION and expose issue.
            this.eventBus.emit('BATTLE_LOG', { text: `Timeline start failed: ${timelineRes.reason}` });
            this.emitBattleUpdate();
            return;
        }

        // If paused, stay in EXECUTION and wait for UI to resume.
        if (this.fsm.currentState === 'BATTLE_LOOP' && this.timeline.phase === 'PAUSED') {
            this.eventBus.emit('BATTLE_LOG', { text: 'Timeline paused.' });
            this.emitBattleUpdate();
            return;
        }

        // If FINISHED, the authoritative turn-advance is handled by TIMELINE_FINISHED event.
        if (this.fsm.currentState === 'BATTLE_LOOP' && this.timeline.phase === 'FINISHED') {
            return;
        }

        if (this.fsm.currentState === 'BATTLE_LOOP') {
            throw new Error(`Timeline ended in unexpected phase=${this.timeline.phase}`);
        }
    }

    _executeTimelineEntry(entry) {
        if (!entry || !entry.sourceAction) {
            throw new Error('Invalid timeline entry: missing sourceAction.');
        }

        // 检查战斗是否已经结束
        if (this.fsm.currentState !== 'BATTLE_LOOP') {
            return { skipped: true, reason: 'Battle loop ended.' };
        }

        const action = entry.sourceAction;
        const actionOrder = this.timeline.currentIndex + 1;

        let result = null;
        const actor = this._getEntityById(action.sourceId) || (entry.side === 'self' ? this.data.playerData : null);
        if (actor?._skipTurn) {
            actor._skipTurn = false;
            const actorName = actor?.name || actor?.id || action.source || 'actor';
            result = { skipped: true, reason: 'skipTurn' };
            this.eventBus.emit('BATTLE_LOG', { text: `${actorName} skipped the action due to control.` });
        } else if (entry.side === 'self' || action.source === 'PLAYER') {
            result = this.executePlayerSkill(action);
        } else {
            result = this.executeEnemySkill(action);
        }

        if (this.currentHistoryEntry) {
            this.currentHistoryEntry.actions.push({
                order: actionOrder,
                ...action,
                result
            });
        }

        this.checkBattleStatus();
        return result;
    }

    _buildEnemyPlans() {
        const out = [];
        const enemies = this.data?.currentLevelData?.enemies;
        if (!Array.isArray(enemies)) return out;

        const playerRuntimeBodyParts = this._getPlayerRuntimeBodyParts();
        enemies.forEach(enemy => {
            if (this._getEntityCurrentHp(enemy) <= 0) return;
            const planned = this.enemyPlanner.planTurn({
                enemy,
                player: this.data.playerData,
                playerBodyParts: playerRuntimeBodyParts
            });
            if (planned) out.push(planned);
        });
        return out;
    }

    _resolveActionTarget({ actor, actionTarget, skillConfig, defaultTarget, defaultBodyPart }) {
        const binding = actionTarget?.binding || {};
        if (binding.mode !== 'explicit') {
            return {
                target: defaultTarget,
                bodyPart: defaultBodyPart
            };
        }

        const spec = actionTarget?.spec || {};
        const subject = spec.subject || skillConfig?.target?.subject;
        let target = defaultTarget;
        if (subject === 'SUBJECT_SELF') target = actor;
        else if (subject === 'SUBJECT_ENEMY') target = defaultTarget;

        const scope = spec.scope || skillConfig?.target?.scope;
        let bodyPart = null;
        if (scope === 'SCOPE_PART' || scope === 'SCOPE_MULTI_PARTS') {
            const selectedParts = Array.isArray(spec?.selection?.selectedParts) ? spec.selection.selectedParts : [];
            bodyPart = selectedParts[0] || defaultBodyPart || this._getDefaultBodyPart(target, null);
        }

        return { target, bodyPart };
    }

    _computeEffectAmount(effect, { actor, target, bodyPart }) {
        const amount = Number(effect?.amount ?? 0) || 0;
        const amountType = effect?.amountType || 'ABS';
        const targetParts = this._getEntityBodyParts(target);
        const part = bodyPart && targetParts ? targetParts[bodyPart] : null;
        const actorStats = actor?.stats || {};

        if (amountType === 'ABS') return amount;
        if (amountType === 'SCALING') {
            const statKey = effect?.scaling?.stat;
            const multiplier = Number(effect?.scaling?.multiplier ?? 0) || 0;
            return (Number(actorStats?.[statKey] ?? actor?.[statKey] ?? 0) || 0) * multiplier;
        }

        let base = 0;
        if (effect?.effectType === 'DMG_ARMOR' || effect?.effectType === 'ARMOR_ADD') {
            base = Number(part?.current ?? part?.max ?? 0) || 0;
            if (amountType === 'PCT_MAX') base = Number(part?.max ?? 0) || 0;
        } else {
            base = this._getEntityCurrentHp(target);
            if (amountType === 'PCT_MAX') base = this._getEntityMaxHp(target);
        }

        return base * (amount / 100);
    }

    _applyArmorDelta(target, bodyPart, delta) {
        const targetParts = this._getEntityBodyParts(target);
        if (!targetParts) return { bodyPart: null, armorDelta: 0 };

        const resolvedPart = this._getDefaultBodyPart(target, bodyPart);
        if (!resolvedPart || !targetParts[resolvedPart]) return { bodyPart: null, armorDelta: 0 };

        const part = targetParts[resolvedPart];
        const max = Number(part.max ?? 0) || 0;
        const current = Number(part.current ?? 0) || 0;
        const next = Math.max(0, Math.min(max, current + delta));
        part.current = next;
        part.status = next <= 0 ? 'BROKEN' : 'NORMAL';
        return {
            bodyPart: resolvedPart,
            armorDelta: next - current
        };
    }

    _applyHpDelta(target, delta) {
        const current = this._getEntityCurrentHp(target);
        this._setEntityCurrentHp(target, current + delta);
        return this._getEntityCurrentHp(target);
    }

    _collectArmorMitigationMultiplier(tempModifiers) {
        let armorMitMult = 1.0;
        const entries = tempModifiers?.armorMitigationMult;
        if (!Array.isArray(entries)) return armorMitMult;

        for (const item of entries) {
            if (item.type === 'percent_current') {
                armorMitMult *= (1 + item.value);
            } else if (item.type === 'flat') {
                armorMitMult += item.value;
            }
        }
        return armorMitMult;
    }

    _applyBattleDamage({ attacker, target, skillId, bodyPart, rawDamage, isReactionAttack = false, reactionMeta = null }) {
        const context = {
            attacker,
            target,
            skillId,
            bodyPart,
            rawDamage,
            isReactionAttack,
            reactionMeta,
            damageDealt: 0,
            damageTaken: 0,
            tempModifiers: Object.create(null)
        };
        this.eventBus.emit('BATTLE_ATTACK_PRE', context);

        let actualDamage = Number(context.rawDamage ?? rawDamage ?? 0) || 0;
        let armorDamage = 0;
        const targetPart = this._getDefaultBodyPart(target, bodyPart);
        const targetParts = this._getEntityBodyParts(target);
        const part = targetPart && targetParts ? targetParts[targetPart] : null;

        if (part?.weakness) {
            actualDamage = Math.floor(actualDamage * part.weakness);
        }

        context.damageTaken = actualDamage;
        this.eventBus.emit('BATTLE_TAKE_DAMAGE_PRE', context);

        if (part && Number(part.current ?? 0) > 0) {
            const armorMitMult = this._collectArmorMitigationMultiplier(context.tempModifiers);
            const mitigated = Math.ceil(actualDamage * armorMitMult);
            const currentArmor = Number(part.current ?? 0) || 0;
            if (currentArmor >= mitigated) {
                if (!context.preventArmorDamage) {
                    part.current -= mitigated;
                    armorDamage = mitigated;
                }
                actualDamage = 0;
            } else {
                actualDamage = Math.max(0, mitigated - currentArmor);
                if (!context.preventArmorDamage) {
                    armorDamage = currentArmor;
                    part.current = 0;
                    part.status = 'BROKEN';
                }
            }
        }

        context.damageTaken = actualDamage;
        if (context.damageTakenMult) {
            context.damageTaken = Math.floor(context.damageTaken * context.damageTakenMult);
        }
        if (context.shieldPool) {
            const absorbed = Math.min(context.shieldPool, context.damageTaken);
            context.damageTaken -= absorbed;
            context.shieldPool -= absorbed;
        }
        if (context.preventHpDamage) {
            context.damageTaken = 0;
        }

        actualDamage = context.damageTaken;
        if (actualDamage > 0) {
            this._applyHpDelta(target, -actualDamage);
        }

        context.damageDealt = actualDamage;
        context.armorDamage = armorDamage;
        context.targetPart = targetPart;
        context.targetHpRemaining = this._getEntityCurrentHp(target);
        this.eventBus.emit('BATTLE_TAKE_DAMAGE', context);
        this.eventBus.emit('BATTLE_ATTACK_POST', context);
        this.eventBus.emit('BATTLE_DEFEND_POST', context);

        return {
            isHit: true,
            damage: actualDamage,
            armorDamage,
            targetHpRemaining: this._getEntityCurrentHp(target),
            targetPart
        };
    }

    _applyArmorOnlyDamage({ attacker, target, skillId, bodyPart, rawArmorDamage, isReactionAttack = false, reactionMeta = null }) {
        const context = {
            attacker,
            target,
            skillId,
            bodyPart,
            rawDamage: rawArmorDamage,
            rawArmorDamage,
            armorOnly: true,
            isReactionAttack,
            reactionMeta,
            damageDealt: 0,
            damageTaken: 0,
            tempModifiers: Object.create(null)
        };
        this.eventBus.emit('BATTLE_ATTACK_PRE', context);

        let pendingArmorDamage = Math.max(0, Number(context.rawArmorDamage ?? rawArmorDamage ?? 0) || 0);
        const targetPart = this._getDefaultBodyPart(target, bodyPart);
        const targetParts = this._getEntityBodyParts(target);
        const part = targetPart && targetParts ? targetParts[targetPart] : null;

        context.damageTaken = pendingArmorDamage;
        this.eventBus.emit('BATTLE_TAKE_DAMAGE_PRE', context);

        pendingArmorDamage = Math.max(0, Number(context.damageTaken ?? pendingArmorDamage) || 0);
        let armorDamage = 0;
        if (part && Number(part.current ?? 0) > 0) {
            const currentArmor = Number(part.current ?? 0) || 0;
            const damageToArmor = Math.min(currentArmor, pendingArmorDamage);
            if (!context.preventArmorDamage) {
                part.current = Math.max(0, currentArmor - damageToArmor);
                armorDamage = damageToArmor;
                part.status = part.current <= 0 ? 'BROKEN' : 'NORMAL';
            }
        }

        context.damageTaken = 0;
        context.damageDealt = 0;
        context.armorDamage = armorDamage;
        context.targetPart = targetPart;
        context.targetHpRemaining = this._getEntityCurrentHp(target);
        this.eventBus.emit('BATTLE_TAKE_DAMAGE', context);
        this.eventBus.emit('BATTLE_ATTACK_POST', context);
        this.eventBus.emit('BATTLE_DEFEND_POST', context);

        return {
            isHit: true,
            damage: 0,
            armorDamage,
            targetHpRemaining: this._getEntityCurrentHp(target),
            targetPart
        };
    }

    _removeBuffsBySkillEffect(target, effect) {
        if (!target?.buffs) return { removed: 0 };
        const amount = Number(effect?.amount ?? 0) || 0;
        if (amount >= 100) {
            return { removed: target.buffs.removeByType('debuff', 'skill_effect_remove') };
        }
        return { removed: 0 };
    }

    _applySkillBuffRefs({ actor, defaultTarget, skillConfig }) {
        const applied = [];
        const refs = skillConfig?.buffRefs || {};
        const applyRows = Array.isArray(refs.apply) ? refs.apply : [];
        const removeRows = Array.isArray(refs.remove) ? refs.remove : [];

        for (const row of applyRows) {
            const target = row?.target === 'self' ? actor : defaultTarget;
            if (!target?.buffs || !row?.buffId) continue;
            const chance = Number(row?.chance ?? 1);
            if (Number.isFinite(chance) && chance < 1 && Math.random() > chance) continue;
            target.buffs.add(row.buffId, {
                duration: row.duration,
                params: row.params
            });
            applied.push({ kind: 'apply', buffId: row.buffId, targetId: target.id });
        }

        for (const row of removeRows) {
            const target = row?.target === 'self' ? actor : defaultTarget;
            if (!target?.buffs || !row?.buffId) continue;
            if (target.buffs.remove(row.buffId, 'skill_ref_remove')) {
                applied.push({ kind: 'remove', buffId: row.buffId, targetId: target.id });
            }
        }

        return applied;
    }

    _handleBuffAttackRequest(payload = {}) {
        if (this.fsm.currentState !== 'BATTLE_LOOP') return;

        const attacker = payload.source || payload.attacker || null;
        const target = payload.target || null;
        if (!attacker || !target) return;
        if (attacker === target) return;
        if (this._getEntityCurrentHp(attacker) <= 0 || this._getEntityCurrentHp(target) <= 0) return;

        const incomingContext = payload.context || {};
        const rawBaseDamage = Number(
            payload.damage
            ?? incomingContext.rawDamage
            ?? incomingContext.damageTaken
            ?? incomingContext.damageDealt
            ?? 0
        ) || 0;
        const multiplier = Number(payload.multiplier ?? 1) || 1;
        const resolvedDamage = Math.max(1, Math.round(rawBaseDamage * multiplier));
        const preferredPart = payload.bodyPart || incomingContext.bodyPart || incomingContext.targetPart || null;

        const outcome = this._applyBattleDamage({
            attacker,
            target,
            skillId: payload.skillId || payload.buffId || 'buff_attack',
            bodyPart: preferredPart,
            rawDamage: resolvedDamage,
            isReactionAttack: true,
            reactionMeta: {
                buffId: payload.buffId || null,
                reason: payload.reason || 'BUFF_ATTACK'
            }
        });

        const attackerName = attacker?.name || attacker?.id || 'Unknown';
        const targetName = target?.name || target?.id || 'Unknown';
        const buffLabel = payload.buffName || payload.buffId || 'buff attack';
        this.eventBus.emit('BATTLE_LOG', {
            text: `${attackerName} triggered ${buffLabel} and dealt ${Math.round(outcome.damage || 0)} HP to ${targetName}.`
        });

        if (this.data?.playerData) {
            this.eventBus.emit('DATA_UPDATE', this.data.playerData);
        }
        this.emitBattleUpdate();
        this.checkBattleStatus();
    }

    _executeSkillActions({ actor, action, skillConfig }) {
        const defaultTarget = this._getEntityById(action.targetId);
        if (!defaultTarget && skillConfig?.target?.subject !== 'SUBJECT_SELF') {
            return { ok: false, reason: `Target ${action.targetId} not found.` };
        }

        const actionContext = {
            actor,
            source: actor,
            target: defaultTarget,
            actionType: 'SKILL',
            skillId: skillConfig.id,
            bodyPart: action.bodyPart,
            cancelled: false,
            cancelReason: null,
            skipTurn: false
        };
        this.eventBus.emit('BATTLE_ACTION_PRE', actionContext);
        if (actionContext.cancelled || actionContext.skipTurn) {
            if (actionContext.skipTurn && actor) actor._skipTurn = false;
            return {
                ok: true,
                skipped: true,
                logs: [`${skillConfig.name} was cancelled${actionContext.cancelReason ? ` (${actionContext.cancelReason})` : ''}.`],
                actions: [],
                buffResults: []
            };
        }

        const logs = [];
        const results = [];
        const actions = Array.isArray(skillConfig?.actions) ? skillConfig.actions : [];

        for (const actionDef of actions) {
            const resolved = this._resolveActionTarget({
                actor,
                actionTarget: actionDef?.target,
                skillConfig,
                defaultTarget,
                defaultBodyPart: action.bodyPart
            });
            const target = resolved.target;
            if (!target) continue;

            const effect = actionDef?.effect || {};
            const bodyPart = effect?.partOverride?.parts?.[0] || resolved.bodyPart;
            const repeat = Math.max(1, Number(effect?.repeat?.count ?? 1) || 1);

            for (let i = 0; i < repeat; i++) {
                switch (effect.effectType) {
                case 'DMG_HP': {
                    const rawDamage = this._computeEffectAmount(effect, { actor, target, bodyPart });
                    const bypassArmor = target === actor && !bodyPart;
                    const outcome = bypassArmor
                        ? {
                            isHit: true,
                            damage: rawDamage,
                            armorDamage: 0,
                            targetHpRemaining: this._applyHpDelta(target, -rawDamage)
                        }
                        : this._applyBattleDamage({ attacker: actor, target, skillId: skillConfig.id, bodyPart, rawDamage });
                    results.push(outcome);
                    logs.push(`${skillConfig.name} dealt ${Math.round(outcome.damage || 0)} HP to ${target.name || target.id}.`);
                    break;
                }
                case 'DMG_ARMOR': {
                    const amount = this._computeEffectAmount(effect, { actor, target, bodyPart });
                    const outcome = this._applyArmorOnlyDamage({
                        attacker: actor,
                        target,
                        skillId: skillConfig.id,
                        bodyPart,
                        rawArmorDamage: amount
                    });
                    results.push({
                        isHit: true,
                        damage: 0,
                        armorDamage: Math.abs(outcome.armorDamage || 0),
                        targetPart: outcome.targetPart,
                        targetHpRemaining: this._getEntityCurrentHp(target)
                    });
                    logs.push(`${skillConfig.name} damaged ${target.name || target.id}'s armor on ${outcome.targetPart || 'unknown'} by ${Math.round(Math.abs(outcome.armorDamage || 0))}.`);
                    break;
                }
                case 'HEAL': {
                    const amount = this._computeEffectAmount(effect, { actor, target, bodyPart });
                    const currentHp = this._applyHpDelta(target, amount);
                    results.push({ isHit: true, heal: amount, targetHpRemaining: currentHp });
                    logs.push(`${skillConfig.name} healed ${target.name || target.id} for ${Math.round(amount)} HP.`);
                    break;
                }
                case 'ARMOR_ADD': {
                    const amount = this._computeEffectAmount(effect, { actor, target, bodyPart });
                    const outcome = this._applyArmorDelta(target, bodyPart, amount);
                    results.push({ isHit: true, armorGain: outcome.armorDelta, targetPart: outcome.bodyPart });
                    logs.push(`${skillConfig.name} restored ${Math.round(outcome.armorDelta || 0)} armor on ${target.name || target.id}${outcome.bodyPart ? `:${outcome.bodyPart}` : ''}.`);
                    break;
                }
                case 'AP_GAIN': {
                    const amount = this._computeEffectAmount(effect, { actor, target, bodyPart });
                    const currentAp = this._getEntityCurrentAp(target);
                    this._setEntityCurrentAp(target, currentAp + amount);
                    results.push({ isHit: true, apGain: amount, targetAp: this._getEntityCurrentAp(target) });
                    logs.push(`${skillConfig.name} granted ${Math.round(amount)} AP to ${target.name || target.id}.`);
                    break;
                }
                case 'BUFF_REMOVE': {
                    const outcome = this._removeBuffsBySkillEffect(target, effect);
                    results.push({ isHit: true, removedBuffs: outcome.removed });
                    logs.push(`${skillConfig.name} removed ${outcome.removed} buffs from ${target.name || target.id}.`);
                    break;
                }
                default:
                    logs.push(`${skillConfig.name} has unsupported effectType ${effect.effectType}.`);
                    break;
                }
            }
        }

        const buffResults = this._applySkillBuffRefs({ actor, defaultTarget, skillConfig });
        buffResults.forEach(item => {
            logs.push(`${skillConfig.name} ${item.kind === 'apply' ? 'applied' : 'removed'} ${item.buffId} on ${item.targetId}.`);
        });

        return {
            ok: true,
            logs,
            actions: results,
            buffResults
        };
    }

    executePlayerSkill(action) {
        const player = this.data.playerData;
        const skillConfig = this.data.getSkillConfig(action.skillId);
        if (!skillConfig) return null;

        const result = this._executeSkillActions({ actor: player, action, skillConfig });
        if (!result?.ok) {
            this.eventBus.emit('BATTLE_LOG', { text: result?.reason || `Player failed to use ${action.skillId}.` });
            return result;
        }

        if (!result.skipped) {
            this._setEntityCurrentAp(player, this._getEntityCurrentAp(player) - (Number(action.cost) || 0));
        }

        result.logs.forEach(text => this.eventBus.emit('BATTLE_LOG', { text: `Player: ${text}` }));
        this.eventBus.emit('DATA_UPDATE', player);
        this.emitBattleUpdate();
        return result;
    }

    executeEnemySkill(action) {
        const enemy = this._getEntityById(action.sourceId);
        const skillConfig = this.data.getSkillConfig(action.skillId);
        if (!enemy || !skillConfig) return null;
        if (this._getEntityCurrentHp(this.data.playerData) <= 0) return { isHit: false, reason: 'dead' };

        const result = this._executeSkillActions({ actor: enemy, action, skillConfig });
        if (!result?.ok) {
            this.eventBus.emit('BATTLE_LOG', { text: result?.reason || `${enemy.id} failed to use ${action.skillId}.` });
            return result;
        }

        if (!result.skipped) {
            const enemyCost = this._getSkillApCostStrict(skillConfig, action.skillId, enemy);
            this._setEntityCurrentAp(enemy, this._getEntityCurrentAp(enemy) - enemyCost);
        }

        result.logs.forEach(text => this.eventBus.emit('BATTLE_LOG', { text: `${enemy.name || enemy.id}: ${text}` }));
        this.eventBus.emit('DATA_UPDATE', this.data.playerData);
        this.emitBattleUpdate();
        return result;
    }

    checkBattleStatus() {
        if (!this.data.currentLevelData || !this.data.currentLevelData.enemies) return;

        const enemies = this.data.currentLevelData.enemies;
        const player = this.data.playerData;

        // 检查胜利
        if (enemies.every(e => e.hp <= 0)) {
            this.endBattle(true);
            return;
        }

        // 检查失败
        if (player.stats.hp <= 0) {
            this.endBattle(false);
            return;
        }
    }

    endBattle(isVictory) {
        this.timeline.stop();
        const result = isVictory ? 'Victory' : 'Defeat';
        this.eventBus.emit('BATTLE_LOG', { text: `Battle Ended: ${result}!` });
        
        //  DataManager ???
        if (this.data.dataConfig.runtime) {
            this.data.dataConfig.runtime.currentScene = 'MAIN_MENU';
            this.data.dataConfig.runtime.battleState = null;
            delete this.data.dataConfig.runtime.levelData;
            delete this.data.dataConfig.runtime.turn;
            delete this.data.dataConfig.runtime.phase;
            delete this.data.dataConfig.runtime.initialState;
            delete this.data.dataConfig.runtime.history;
            delete this.data.dataConfig.runtime.queues;
            delete this.data.dataConfig.runtime.playerTempState;
        }
        this.data.currentLevelData = null;
        this.data.saveGame(); // ???

        this.fsm.changeState('BATTLE_SETTLEMENT', { victory: isVictory });
        this.eventBus.emit('BATTLE_END', { victory: isVictory });
    }

    resetTurn() {
        if (this.battlePhase !== 'PLANNING') {
            this.eventBus.emit('BATTLE_LOG', { text: `Cannot reset turn during ${this.battlePhase} phase.` });
            return;
        }

        // Clear planning (slots), queues, and timeline preview.
        this.turnPlanner.reset();
        this.playerSkillQueue = [];
        this.enemySkillQueue = [];
        this.timeline.reset();
        this._syncPlannerToRuntime();
        this._enterPlanningBudgetSnapshot();

        this.eventBus.emit('BATTLE_LOG', { text: 'Turn planning and timeline cleared.' });
        this.emitBattleUpdate();
    }
    
    saveBattleState() {
        if (this.fsm.currentState === 'BATTLE_LOOP') {
            if (!this.data.dataConfig.runtime) this.data.dataConfig.runtime = {};
            const runtime = this.data.dataConfig.runtime;
            runtime.currentScene = 'BATTLE_LOOP';
            runtime.turn = this.currentTurn;
            runtime.phase = this.battlePhase;
            runtime.battleState = {
                active: true,
                timelinePhase: this.timeline ? this.timeline.phase : 'IDLE'
            };
            
            // 保存队列
            if (!runtime.queues) runtime.queues = {};
            runtime.queues.player = this.playerSkillQueue;
            runtime.queues.enemy = this.enemySkillQueue;
        }
    }

    emitBattleUpdate() {
        // Merge runtime bodyParts into player data for UI
        let playerPayload = this.data.playerData;
        if (this.data.dataConfig.runtime && this.data.dataConfig.runtime.playerBattleState) {
             playerPayload = {
                 ...this.data.playerData,
                 bodyParts: this.data.dataConfig.runtime.playerBattleState.bodyParts
             };
        }

        this.eventBus.emit('BATTLE_UPDATE', {
            player: playerPayload,
            enemies: this.data.currentLevelData ? this.data.currentLevelData.enemies : [],
            turn: this.currentTurn,
            phase: this.battlePhase,
            timelinePhase: this.timeline ? this.timeline.phase : undefined,
            queue: this.playerSkillQueue
        });
    }
}

// 创建单例实例
const engineInstance = new CoreEngine();

// 挂载到 window 方便调试 (可选，但在本项目中为了兼容性保留)
window.Engine = engineInstance;

// 默认导出实例
export default engineInstance;

// 具名导出类 (用于测试或特殊需求)
export { CoreEngine };
