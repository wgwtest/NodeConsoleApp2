import EventBus from '../engine/EventBus.js';

/**
 * UI_SkillPanel
 * Manages the interaction for Skill Selection, Action Queue Planning, and Detail View.
 * Follows the "Skill -> Slot" interaction pattern designed in 16-战斗界面(UI_design)-设计说明.md 4.6.
 */
export default class UI_SkillPanel {
    constructor(engine) {
        this.engine = engine;
        // Fix: Ensure eventBus property is available or use this.engine.eventBus
        this.eventBus = engine.eventBus; 
        
        // -- DOM Query --
        this.root = document.querySelector('.skill-panel');
        if (!this.root) {
            console.warn('UI_SkillPanel: Root element .skill-panel not found.');
            return;
        }

        this.poolContainer = this.root.querySelector('.skill-grid-view');
        this.matrixContainer = this.root.querySelector('.action-matrix-container');
        // Detail panel might be inside or outside, assuming structure based on design
        this.detailPanel = document.querySelector('.skill-detail-column'); // Wrapper
        
        this.detailName = document.getElementById('detailName');
        this.detailMeta = document.getElementById('detailMeta');
        this.detailEffect = document.getElementById('detailEffect');
        this.detailTarget = document.getElementById('detailTarget');
        this.detailCosts = document.getElementById('detailCosts');
        this.detailSpeed = document.getElementById('detailSpeed');
        this.detailBuffs = document.getElementById('detailBuffs');
        this.detailTip = document.getElementById('detailTip');
        this.detailTags = document.getElementById('detailTags');

        this.apMeter = document.getElementById('apMeter');
        this.apMeterSlots = document.getElementById('apMeterSlots');
        this.apMeterValue = document.getElementById('apMeterValue');
        this.learnFeedbackBanner = null;

        // -- State --
        this.selectedSkill = null; // Object or ID
        this.cachedSkills = [];    // Loaded from DataManager

        // Draft-first planning (UI-local). Keyed by skillId.
        this.planningDraftBySkill = Object.create(null);

        // UI-only preview queue built from draft (so user sees placements before commit)
        this.draftQueue = [];

        // Deterministic icon cache (avoid icon changing across re-renders)
        this._skillIconCache = new Map();

        // Edit mode: prevents accidental modification of already-placed slots while a skill is armed.
        // When enabled, clicking filled slots will remove that slot assignment instead of being locked.
        this.isEditMode = false;

        // -- Bind --
        this.bindEvents();
        this.bindEngineEvents();
        this.bindGlobalDismiss();

        this._ensureEditModeToggle();
        this._ensurePlanningCommitButton();
        this._ensureLearnFeedbackBanner();
        this._emitArmedState();

        console.log('UI_SkillPanel initialized.');
    }

    _calcApBudget() {
        const player = this.engine?.data?.playerData;
        const cur = Number(player?.stats?.ap ?? 0);
        const max = Number(player?.stats?.maxAp ?? 0);

        const budget = this.engine?.turnPlanner?.getApBudgetState?.();
        if (budget && budget.phase && budget.phase !== 'AP_BUDGET_UNINITIALIZED') {
            const available = Number(budget.availableAp ?? 0) || 0;
            const plannedCost = Number(budget.plannedCost ?? 0) || 0;
            const remaining = Number(budget.remaining ?? (available - plannedCost)) || 0;
            return {
                current: available,
                max: Number.isFinite(max) ? max : 0,
                used: plannedCost,
                remaining: Math.max(0, remaining),
                withinBudget: !!budget.ok,
                mode: 'planningBudget'
            };
        }

        const used = (this.engine?.playerSkillQueue || []).reduce((sum, item) => sum + (Number(item?.cost) || 0), 0);
        const remaining = Math.max(0, cur - used);
        return {
            current: Number.isFinite(cur) ? cur : 0,
            max: Number.isFinite(max) ? max : 0,
            used: Number.isFinite(used) ? used : 0,
            remaining,
            withinBudget: true,
            mode: 'playerStats'
        };
    }

    _recalcPlanningApBudget() {
        const planner = this.engine?.turnPlanner;
        if (!planner?.recalcApBudgetForDraft) return { ok: true };
        return planner.recalcApBudgetForDraft({ planningDraftBySkill: this.planningDraftBySkill });
    }

    renderApMeter() {
        if (!this.apMeter || !this.apMeterSlots || !this.apMeterValue) return;

        const { current, max, used, remaining } = this._calcApBudget();
        const slotCount = 10;
        const cap = Math.max(0, Math.min(max || slotCount, slotCount));
        const filled = cap > 0 ? Math.max(0, Math.min(cap, Math.round((remaining / (max || cap)) * cap))) : 0;

        this.apMeterSlots.innerHTML = '';
        for (let i = 0; i < slotCount; i++) {
            const el = document.createElement('span');
            el.className = 'ap-meter__slot';
            if (i < cap) {
                el.classList.add(i < filled ? 'is-on' : 'is-off');
            } else {
                el.classList.add('is-na');
            }
            this.apMeterSlots.appendChild(el);
        }

        this.apMeterValue.textContent = `${remaining} / ${current || max || '-'}`;
        this.apMeter.dataset.apCurrent = String(current);
        this.apMeter.dataset.apMax = String(max);
        this.apMeter.dataset.apUsed = String(used);
        this.apMeter.dataset.apRemaining = String(remaining);
    }

    _ensurePlanningCommitButton() {
        const bar = this.root ? this.root.querySelector('.skill-sort-bar') : null;
        if (!bar) return;

        let btn = bar.querySelector('#btnCommitPlanning');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sort-btn';
            btn.id = 'btnCommitPlanning';
            btn.textContent = '提交规划';
            bar.appendChild(btn);
        }

        btn.addEventListener('click', () => {
            if (this.engine?.input?.commitPlanning) {
                this.engine.input.commitPlanning({ planningDraftBySkill: this.planningDraftBySkill });
            }
        });
    }

    _ensureLearnFeedbackBanner() {
        const host = this.root?.querySelector('.skill-pool-column') || this.root;
        if (!host) return null;

        let banner = host.querySelector('.skill-learn-feedback');
        if (!banner) {
            banner = document.createElement('section');
            banner.className = 'skill-learn-feedback';
            banner.hidden = true;
            banner.style.padding = '10px 12px';
            banner.style.marginBottom = '10px';
            banner.style.borderRadius = '12px';
            banner.style.border = '1px solid rgba(124, 245, 217, 0.32)';
            banner.style.background = 'linear-gradient(180deg, rgba(20, 30, 48, 0.94), rgba(16, 22, 38, 0.82))';
            banner.style.boxShadow = '0 8px 18px rgba(0, 0, 0, 0.22)';

            const title = document.createElement('div');
            title.className = 'skill-learn-feedback__title';
            title.style.fontSize = '0.82rem';
            title.style.fontWeight = '700';
            title.style.color = '#d8fff2';
            title.style.marginBottom = '4px';

            const body = document.createElement('div');
            body.className = 'skill-learn-feedback__body';
            body.style.fontSize = '0.78rem';
            body.style.lineHeight = '1.55';
            body.style.color = '#dfe7ff';

            banner.appendChild(title);
            banner.appendChild(body);

            const anchor = host.querySelector('.skill-grid-view') || host.firstChild;
            host.insertBefore(banner, anchor || null);
        }

        this.learnFeedbackBanner = banner;
        return banner;
    }

    _resolvePendingLearnBattleFeedback() {
        const progress = this.engine?.data?.dataConfig?.global?.progress;
        const lastLearnAction = (progress && typeof progress.lastLearnAction === 'object') ? progress.lastLearnAction : null;
        if (!lastLearnAction) return null;

        const learnAtRaw = typeof lastLearnAction.committedAt === 'string' ? lastLearnAction.committedAt : '';
        const settlementAtRaw = typeof progress?.lastSettlement?.settledAt === 'string' ? progress.lastSettlement.settledAt : '';
        const learnAt = Date.parse(learnAtRaw);
        const settlementAt = Date.parse(settlementAtRaw);
        const hasLearnTimestamp = Number.isFinite(learnAt);
        const hasSettlementTimestamp = Number.isFinite(settlementAt);

        if (hasLearnTimestamp && hasSettlementTimestamp && learnAt <= settlementAt) {
            return null;
        }

        const learnedIds = Array.isArray(lastLearnAction.learnedSkillIds)
            ? lastLearnAction.learnedSkillIds.filter(skillId => typeof skillId === 'string' && skillId.trim().length > 0)
            : [];
        const namedSkills = Array.isArray(lastLearnAction.learnedSkillNames)
            ? lastLearnAction.learnedSkillNames
                .filter(name => typeof name === 'string' && name.trim().length > 0)
                .map(name => name.trim())
            : [];
        const availableSkillIds = new Set(
            Array.isArray(this.cachedSkills)
                ? this.cachedSkills
                    .map(skill => (typeof skill?.id === 'string' ? skill.id.trim() : ''))
                    .filter(Boolean)
                : []
        );
        const visibleIds = learnedIds.filter(skillId => availableSkillIds.has(skillId));
        const resolvedVisibleNames = visibleIds.map(skillId => {
            const skill = this.engine?.data?.getSkillConfig ? this.engine.data.getSkillConfig(skillId) : null;
            const name = typeof skill?.name === 'string' ? skill.name.trim() : '';
            return name || skillId;
        });
        const names = (namedSkills.length > 0 ? namedSkills : resolvedVisibleNames).filter(Boolean);
        const visibleNames = names.length > 0 ? names : resolvedVisibleNames;

        if (visibleNames.length === 0 && learnedIds.length > 0 && namedSkills.length === 0) {
            return null;
        }
        if (visibleNames.length === 0 && learnedIds.length === 0 && namedSkills.length === 0) {
            return null;
        }

        const spentKp = Number.isFinite(lastLearnAction.spentKp) ? Number(lastLearnAction.spentKp) : 0;
        const remainingKp = Number.isFinite(lastLearnAction.remainingKp) ? Number(lastLearnAction.remainingKp) : 0;

        return {
            title: '本局新增技能',
            body: `${visibleNames.join('、')} 已自动加入技能池，本局可直接用于规划；最近学习消耗 ${spentKp} KP，当前剩余 ${remainingKp} KP。`
        };
    }

    renderLearnFeedbackBanner() {
        const banner = this._ensureLearnFeedbackBanner();
        if (!banner) return;

        const feedback = this._resolvePendingLearnBattleFeedback();
        if (!feedback) {
            banner.hidden = true;
            banner.dataset.visible = '0';
            return;
        }

        const titleEl = banner.querySelector('.skill-learn-feedback__title');
        const bodyEl = banner.querySelector('.skill-learn-feedback__body');
        if (titleEl) titleEl.textContent = feedback.title;
        if (bodyEl) bodyEl.textContent = feedback.body;
        banner.hidden = false;
        banner.dataset.visible = '1';
    }

    _getSkillSlotLabel(skill) {
        if (!skill) return '?';
        const name = String(skill.name || '').trim();
        if (!name) return '?';

        // Prefer 2-char abbreviation for readability; fallback to 1.
        // Chinese: first 2 chars; Latin: first 2 letters uppercased.
        const latin = name.match(/[A-Za-z0-9]+/g);
        if (latin && latin.length) {
            const token = latin[0];
            return token.slice(0, 2).toUpperCase();
        }

        return name.length >= 2 ? name.slice(0, 2) : name.slice(0, 1);
    }

    _pickSkillIcon(skill) {
        if (!skill) return '⚔️';

        const id = skill.id || '';
        if (id && this._skillIconCache.has(id)) return this._skillIconCache.get(id);

        const name = String(skill.name || '').toLowerCase();
        const desc = String(skill.description || skill.desc || '').toLowerCase();
        const tags = Array.isArray(skill.tags) ? skill.tags.map(t => String(t).toLowerCase()) : [];
        const typeLabel = String(this.getSkillTypeLabel(skill) || '').toLowerCase();

        const hay = [name, desc, typeLabel, ...tags].join(' ');

        const rules = [
            { re: /(he(al|al))|治疗|恢复|regen|revive|复活|药/, icon: '✨' },
            { re: /(shield|block|guard|defen)|护盾|格挡|防御|减伤|免伤/, icon: '🛡️' },
            { re: /(taunt|provoke)|嘲讽/, icon: '📢' },
            { re: /(stun|daze)|眩晕|击晕/, icon: '💫' },
            { re: /(bleed)|流血/, icon: '🩸' },
            { re: /(poison)|中毒|毒/, icon: '☠️' },
            { re: /(burn|fire)|燃烧|火/, icon: '🔥' },
            { re: /(ice|frost|freeze)|冰|冻结|霜/, icon: '🧊' },
            { re: /(thunder|lightning|electric)|雷|电/, icon: '⚡' },
            { re: /(wind)|风/, icon: '🌪️' },
            { re: /(earth|stone)|土|岩/, icon: '🪨' },
            { re: /(holy|light)|圣|光/, icon: '🌟' },
            { re: /(shadow|dark)|暗|影/, icon: '🌑' },
            { re: /(stealth|hide)|潜行|隐身/, icon: '🥷' },
            { re: /(buff)|增益|强化|提升/, icon: '📈' },
            { re: /(debuff)|减益|削弱|降低/, icon: '📉' },
            { re: /(summon)|召唤/, icon: '🧙' },
            { re: /(bow|arrow)|弓|箭/, icon: '🏹' },
            { re: /(gun)|枪|弹/, icon: '🔫' },
            { re: /(dagger|knife)|匕首|短刀|刀/, icon: '🗡️' },
            { re: /(sword|slash)|剑|斩|劈|砍/, icon: '⚔️' },
            { re: /(axe)|斧/, icon: '🪓' },
            { re: /(hammer|mace)|锤|槌/, icon: '🔨' },
            { re: /(spear|lance)|枪|矛|戟/, icon: '🔱' },
            { re: /(punch|fist)|拳|掌/, icon: '👊' },
            { re: /(kick)|踢|腿法/, icon: '🦵' },
            { re: /(dash|step|move|retreat)|冲刺|突进|位移|后撤|闪避/, icon: '💨' },
            { re: /(focus|aim)|专注|瞄准/, icon: '🎯' }
        ];

        let icon = null;
        for (const r of rules) {
            if (r.re.test(hay)) {
                icon = r.icon;
                break;
            }
        }

        if (!icon) {
            if (typeLabel.includes('def')) icon = '🛡️';
            else if (typeLabel.includes('sup') || typeLabel.includes('heal')) icon = '✨';
            else icon = '⚔️';
        }

        if (id) this._skillIconCache.set(id, icon);
        return icon;
    }

    _ensureEditModeToggle() {
        const bar = this.root ? this.root.querySelector('.skill-sort-bar') : null;
        if (!bar) return;

        let btn = bar.querySelector('#btnToggleEditMode');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sort-btn';
            btn.id = 'btnToggleEditMode';
            bar.appendChild(btn);
        }

        const render = () => {
            btn.textContent = this.isEditMode ? '编辑模式：开' : '编辑模式：关';
            btn.classList.toggle('active', this.isEditMode);
        };

        render();
        btn.addEventListener('click', () => {
            this.isEditMode = !this.isEditMode;
            render();
        });
    }

    bindGlobalDismiss() {
        // Click-on-blank dismiss: if a skill is currently selected (armed), clicking anywhere
        // outside actionable UI (skill buttons / slots / overlays) will exit selection.
        // Use capture phase so we can observe the click even if inner handlers stop propagation.
        document.addEventListener('click', (e) => {
            if (!this.selectedSkill) return;
            const target = e.target;
            if (!target) return;

            // Do not dismiss when interacting with skill buttons or slots
            if (target.closest('.skill-icon-button')) return;
            if (target.closest('.slot-placeholder')) return;

            // Do not dismiss when interacting with overlays/modals (e.g. skill tree)
            if (target.closest('.overlay-backdrop') || target.closest('.overlay-panel')) return;
            if (target.closest('.modal-backdrop') || target.closest('.modal-panel')) return;

            this._clearSkillSelection();
        }, true);
    }

    _clearSkillSelection() {
        if (this.poolContainer) {
            const btn = this.poolContainer.querySelector('.skill-icon-button.active');
            if (btn) btn.classList.remove('active');
        }
        this.selectedSkill = null;
        this.clearHighlights();
        this._emitArmedState();
    }

    _emitArmedState() {
        this.eventBus?.emit?.('UI:SKILL_ARMED_CHANGED', {
            isArmed: !!this.selectedSkill,
            skillId: this.selectedSkill ? this.selectedSkill.id : null
        });
    }

    bindEvents() {
        // Skill Pool Click Delegation
        if (this.poolContainer) {
            this.poolContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.skill-icon-button');
                if (btn && !btn.disabled && !btn.classList.contains('disabled')) {
                    this.onSkillClick(btn);
                }
            });

            // Hover for details
            this.poolContainer.addEventListener('mouseover', (e) => {
                const btn = e.target.closest('.skill-icon-button');
                if (btn) this.showDetail(btn.dataset.id); 
            });
            this.poolContainer.addEventListener('mouseout', () => {
                // Revert to selected skill detail or empty
                if (this.selectedSkill) {
                    this.showDetail(this.selectedSkill.id);
                } else {
                    // Maybe clear? Keep last? For now keep last.
                }
            });
        }

        // Matrix Click Delegation
        if (this.matrixContainer) {
            this.matrixContainer.addEventListener('click', (e) => {
                const slot = e.target.closest('.slot-placeholder');
                if (slot) {
                    // Check if it's a filled slot (action removal) or empty slot (action add)
                    if (slot.classList.contains('filled')) {
                        // Draft-preview slots are rendered as "filled" but should still be toggleable
                        // during planning (multi-select cancel / single-select toggle).
                        const occupiedSkillId = slot.dataset.occupiedSkillId;
                        const isDraft = slot.dataset.queueIndex === 'draft' || slot.dataset.isDraft === '1';
                        if (this.selectedSkill && isDraft && occupiedSkillId === this.selectedSkill.id) {
                            this.onEmptySlotClick(slot);
                        } else {
                            this.onFilledSlotClick(slot);
                        }
                    } else {
                        this.onEmptySlotClick(slot);
                    }
                }
            });

            // Hover logic for queued items
             this.matrixContainer.addEventListener('mouseover', (e) => {
                const slot = e.target.closest('.slot-placeholder.filled');
                if (slot) {
                     // Could show prediction details here
                }
            });
        }

    }

    bindEngineEvents() {
        this.eventBus.on('BATTLE_START', this.onBattleStart.bind(this));
        this.eventBus.on('BATTLE_UPDATE', this.onBattleUpdate.bind(this));
        this.eventBus.on('TURN_START', this.onTurnStart.bind(this));
        // If engine emits specific event for AP change
        this.eventBus.on('PLAYER_STATS_UPDATED', this.updateSkillAvailability.bind(this));
        this.eventBus.on('DATA_UPDATE', this.onDataUpdate.bind(this));

        this.eventBus.on('PLANNING_COMMITTED', () => {
            this.planningDraftBySkill = Object.create(null);
            this.draftQueue = [];
            this._clearSkillSelection();
        });

        this.eventBus.on('PLANNING_COMMIT_FAILED', (payload) => {
            const reason = payload && typeof payload === 'object' ? payload.reason : 'unknown';
            console.error('[UI_SkillPanel] Planning commit failed:', reason, payload);
            this.eventBus?.emit?.('BATTLE_LOG', { text: `规划提交失败：${reason}` });
        });
    }

    // --- Event Handlers ---

    onBattleStart(data) {
        // data.player, data.level(enemy)
        const skills = data.player.skills;
        const skillIds = Array.isArray(skills) ? skills : (Array.isArray(skills?.learned) ? skills.learned : []);
        // Use engine.data to fetch configs
        this.cachedSkills = skillIds.map(id => this.engine.data.getSkillConfig(id)).filter(s => s);
        
        // Initialize Matrix Rows (Missing Parts Logic)
        this.buildMatrixFromBattleRules();
        this.initMatrixRows(data.level.enemies[0]); // Assume single enemy focus for MVP
        
        this.renderSkillPool();
        this.clearMatrix();
        this.selectedSkill = null;
        this.renderApMeter();
        this.renderLearnFeedbackBanner();
    }

    _getSlotSpecFromElement(slotElement) {
        if (!slotElement) return null;
        const part = slotElement.dataset.part;
        const targetType = slotElement.dataset.targetType;
        const slotIndex = Number(slotElement.dataset.slotIndex);
        if (!part || !targetType || !Number.isFinite(slotIndex)) return null;
        return { part, targetType, slotIndex };
    }

    buildMatrixFromBattleRules() {
        if (!this.matrixContainer) return;

        const layout = this.engine?.data?.dataConfig?.runtime?.battleRules?.slotLayout
            || this.engine?.data?.gameConfig?.slotLayouts?.layouts?.[(this.engine?.data?.dataConfig?.battleRules?.slotLayoutId) || 'default_v1']
            || null;

        const rows = Array.isArray(layout?.rows) ? layout.rows : null;
        const slotCounts = layout?.slotCounts && typeof layout.slotCounts === 'object' ? layout.slotCounts : null;
        if (!rows || !slotCounts) return;

        const makeZoneSlots = (zoneEl, part, targetType, count) => {
            zoneEl.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const slot = document.createElement('div');
                slot.className = 'slot-placeholder';
                slot.dataset.part = part;
                slot.dataset.targetType = targetType;
                slot.dataset.slotIndex = String(i);
                zoneEl.appendChild(slot);
            }
        };

        const maxSelf = Math.max(0, ...rows.map(p => Number(slotCounts?.[p]?.self ?? 0) || 0));
        const maxEnemy = Math.max(0, ...rows.map(p => Number(slotCounts?.[p]?.enemy ?? 0) || 0));

        this.matrixContainer.style.setProperty('--matrix-self-max', String(maxSelf));
        this.matrixContainer.style.setProperty('--matrix-enemy-max', String(maxEnemy));

        this.matrixContainer.innerHTML = '';
        rows.forEach(part => {
            const row = document.createElement('div');
            row.className = 'matrix-row';
            row.dataset.rowPart = part;

            const selfZone = document.createElement('div');
            selfZone.className = 'matrix-zone self-zone';
            const enemyZone = document.createElement('div');
            enemyZone.className = 'matrix-zone enemy-zone';

            const label = document.createElement('div');
            label.className = 'matrix-label';
            label.textContent = this.formatPartLabel(part);

            const selfCount = Number(slotCounts?.[part]?.self ?? 0) || 0;
            const enemyCount = Number(slotCounts?.[part]?.enemy ?? 0) || 0;
            makeZoneSlots(selfZone, part, 'self', selfCount);
            makeZoneSlots(enemyZone, part, 'enemy', enemyCount);

            row.appendChild(selfZone);
            row.appendChild(label);
            row.appendChild(enemyZone);
            this.matrixContainer.appendChild(row);
        });
    }

    formatPartLabel(part) {
        const map = {
            head: '头部',
            chest: '胸部',
            abdomen: '腹部',
            arm: '手部',
            leg: '腿部',
            global: '通用'
        };
        return map[part] || part;
    }

    onTurnStart() {
        this.selectedSkill = null;
        this.clearHighlights();
        this.planningDraftBySkill = Object.create(null);
        this.draftQueue = [];
        this._emitArmedState();
        // Matrix cleared via Engine BATTLE_UPDATE usually, but let's be safe
        this.updateSkillAvailability();
        this.renderApMeter();
    }

    onBattleUpdate(data) {
        // Refresh Queue Visualization based on engine state
        // Engine might pass 'queues' in data, or we access engine instance
        const committed = this.engine.playerSkillQueue || [];
        const merged = [...committed];
        if (Array.isArray(this.draftQueue) && this.draftQueue.length > 0) {
            merged.push(...this.draftQueue);
        }
        this.renderMatrixQueue(merged);
        this.updateSkillAvailability();
        this.renderApMeter();
    }

    onDataUpdate(payload) {
        const type = payload && typeof payload === 'object' ? payload.type : null;
        if (type && type !== 'PLAYER_SKILLS') return;

        // Generic DATA_UPDATE events during battle are usually HP/AP/body-part refreshes.
        // Rebuilding the skill pool from global playerData here would drop any level-scoped
        // battle skill injection that was already provided by BATTLE_START payload.
        if (!type && this.engine?.fsm?.currentState === 'BATTLE_LOOP') {
            this.updateSkillAvailability();
            this.renderApMeter();
            return;
        }

        const player = this.engine?.data?.playerData;
        if (!player || !player.skills) return;

        this.refreshSkillsFromPlayer(player);
        this.renderSkillPool();
        this.renderApMeter();
        this.renderLearnFeedbackBanner();
    }

    refreshSkillsFromPlayer(player) {
        const skills = player?.skills;
        const skillIds = Array.isArray(skills) ? skills : (Array.isArray(skills?.learned) ? skills.learned : []);
        this.cachedSkills = skillIds.map(id => this.engine.data.getSkillConfig(id)).filter(s => s);

        if (this.selectedSkill && !this.cachedSkills.find(s => s.id === this.selectedSkill.id)) {
            this.selectedSkill = null;
            this.clearHighlights();
            this._emitArmedState();
        }
    }

    onSkillClick(btn) {
        const skillId = btn.dataset.id;
        
        // Toggle Selection
        if (this.selectedSkill && this.selectedSkill.id === skillId) {
            this.selectedSkill = null;
            btn.classList.remove('active');
            this.clearHighlights();
            this._emitArmedState();
        } else {
            // Deselect previous
            if (this.selectedSkill) {
                const prevBtn = this.poolContainer.querySelector(`.skill-icon-button[data-id="${this.selectedSkill.id}"]`);
                if (prevBtn) prevBtn.classList.remove('active');
            }
            
            this.selectedSkill = this.cachedSkills.find(s => s.id === skillId);
            btn.classList.add('active');
            
            this.showDetail(skillId);
            this.highlightValidSlots();
            this._emitArmedState();
        }
    }

    onEmptySlotClick(slotElement) {
        if (!this.selectedSkill) return;
        if (!slotElement.classList.contains('highlight-valid')) return; // Only allow mapped slots

        const spec = this._getSlotSpecFromElement(slotElement);
        if (!spec) return;

        const { part, targetType, slotIndex } = spec;
        
        // Resolve Target ID
        // Simplified Logic: 
        // If targetType == 'self', targetId = player.id
        // If targetType == 'enemy', targetId = currentSelectedEnemy.id
        
        const playerId = this.engine.data.playerData.id;
        // Assume first enemy for MVP or get from Selection Manager
        const enemyId = this.engine.data.currentLevelData && this.engine.data.currentLevelData.enemies[0] ? this.engine.data.currentLevelData.enemies[0].id : null; 

        if (!enemyId && targetType === 'enemy') {
            console.warn('No enemy found.');
            return;
        }


        const finalTargetId = (targetType === 'self') ? playerId : enemyId;

        const slotKey = this._makeSlotKey(part, targetType, slotIndex);

        // Draft-first: store into UI draft, commit later at PLANNING_COMMIT.
        // Engine batch commit expects `placedSlots`.
        const id = this.selectedSkill.id;
        const prev = this.planningDraftBySkill[id];
        const prevSlots = Array.isArray(prev?.placedSlots) ? prev.placedSlots : [];

        const targetInfo = this.getSkillTarget(this.selectedSkill);
        if (!targetInfo) {
            this.eventBus?.emit?.('BATTLE_LOG', { text: `技能配置错误：${this.selectedSkill?.id || 'unknown'} 缺少合法 target。` });
            return;
        }
        const mode = String(targetInfo?.selection?.mode || 'single');
     let sc = Number(targetInfo?.selection?.selectCount ?? 1);
        if (!Number.isFinite(sc) || sc <= 0) sc = 1;
        const isSingle = (mode === 'single') || (sc <= 1);

        let nextSlots = [];
        if (isSingle) {
            // Single-select: replace; clicking the same slot toggles cancel.
            if (prevSlots.length === 1 && prevSlots[0] === slotKey) {
                nextSlots = [];
            } else {
                nextSlots = [slotKey];
            }
        } else {
            // Multi-select: toggle remove; add only up to selectCount.
            if (prevSlots.includes(slotKey)) {
                nextSlots = prevSlots.filter(k => k !== slotKey);
            } else if (prevSlots.length >= sc) {
                this.eventBus?.emit?.('BATTLE_LOG', { text: `已达上限：该技能最多选择 ${sc} 个槽位。` });
                return;
            } else {
                nextSlots = [...prevSlots, slotKey];
            }
        }

        // Apply draft mutation first...
        if (nextSlots.length === 0) {
            delete this.planningDraftBySkill[id];
        } else {
            const selectedParts = nextSlots
                .map(slot => this.engine?.turnPlanner?.parseSlotKey?.(slot)?.part)
                .filter(Boolean);
            this.planningDraftBySkill[id] = {
                skillId: id,
                placedSlots: nextSlots,
                targetId: finalTargetId,
                bodyPart: part,
                selectionResult: {
                    selectedParts
                }
            };
        }

        // ...then recompute planning AP budget (skill-per-turn) and block over-budget drafts.
        const apRes = this._recalcPlanningApBudget();
        const budget = this.engine?.turnPlanner?.getApBudgetState?.();
        if (budget && budget.phase === 'AP_BUDGET_INVALID') {
            // Rollback the last change (fail-fast; avoid inconsistent preview).
            if (prevSlots.length === 0) {
                delete this.planningDraftBySkill[id];
            } else {
                this.planningDraftBySkill[id] = {
                    skillId: id,
                    placedSlots: prevSlots,
                    targetId: prev?.targetId ?? finalTargetId,
                    bodyPart: prev?.bodyPart ?? part,
                    selectionResult: prev?.selectionResult ?? {
                        selectedParts: prevSlots
                            .map(slot => this.engine?.turnPlanner?.parseSlotKey?.(slot)?.part)
                            .filter(Boolean)
                    }
                };
            }
            this._recalcPlanningApBudget();
            this.eventBus?.emit?.('BATTLE_LOG', { text: `AP 预算不足：无法加入该技能（plannedCost=${budget.plannedCost}, availableAp=${budget.availableAp}）。` });
            this.renderApMeter();
            return;
        }

        this._rebuildDraftQueue();
        this.renderMatrixQueue([...(this.engine.playerSkillQueue || []), ...this.draftQueue]);
        this.renderApMeter();

        this.eventBus?.emit?.('BATTLE_LOG', { text: `已加入草稿：${this.selectedSkill.name || this.selectedSkill.id}（待提交）` });
        
        // Visual feedback handled by BATTLE_UPDATE event re-rendering matrix
    }

    onFilledSlotClick(slotElement) {
        // Option B: existing placements are locked while a skill is armed, to avoid accidental edits.
        // Editing/removal requires explicitly enabling Edit Mode.
        if (this.selectedSkill && !this.isEditMode) {
            this.eventBus?.emit?.('BATTLE_LOG', { text: '已占用槽位已锁定（选择了技能时）。如需修改，请先开启“编辑模式”。' });
            return;
        }

        const spec = this._getSlotSpecFromElement(slotElement);
        if (!spec) return;
        const slotKey = this._makeSlotKey(spec.part, spec.targetType, spec.slotIndex);

        if (this.engine?.input?.unassignSlot) {
            this.engine.input.unassignSlot(slotKey);
        } else {
            console.error('[UI_SkillPanel] Missing engine.input.unassignSlot, cannot remove slot assignment.', { slotKey });
            this.eventBus?.emit?.('BATTLE_LOG', { text: '移除失败：引擎未提供 unassignSlot 接口。' });
        }
    }

    // --- Render Logic ---

    // Configure Rows based on enemy anatomy
    initMatrixRows(enemyData) {
        if (!this.matrixContainer) return;
        const rows = this.matrixContainer.querySelectorAll('.matrix-row');

        rows.forEach(row => {
            const part = row.dataset.rowPart;
            if (part === 'global') return; // Always valid

            const partData = enemyData.bodyParts && enemyData.bodyParts[part] ? enemyData.bodyParts[part] : null;
            const maxVal = partData ? (partData.max !== undefined ? partData.max : (partData.maxArmor || 0)) : 0;
            const isVisible = maxVal > 0;

            // We only disable the Enemy Zone if part is missing
            const enemyZone = row.querySelector('.enemy-zone');
            if (enemyZone) {
                if (!isVisible) {
                    row.classList.add('enemy-part-missing'); 
                    this.disableZone(enemyZone);
                } else {
                    row.classList.remove('enemy-part-missing');
                    this.enableZone(enemyZone);
                }
            }
        });
    }
    
    disableZone(zoneEl) {
        zoneEl.classList.add('disabled-zone');
        // Clear slots
    }
    enableZone(zoneEl) {
        zoneEl.classList.remove('disabled-zone');
    }

    renderSkillPool() {
        if (!this.poolContainer) return;
        this.poolContainer.innerHTML = '';

        this.cachedSkills.forEach(skill => {
            const btn = document.createElement('button');
            const skillType = this.getSkillTypeLabel(skill);

            // Add rarity class if available, default to common
            const rarityClass = skill.rarity ? `rarity-${skill.rarity.toLowerCase()}` : 'rarity-common';

            btn.className = `skill-icon-button ${rarityClass} type-${skillType.toLowerCase()}`;
            if (this.selectedSkill && this.selectedSkill.id === skill.id) btn.classList.add('active');

            btn.dataset.id = skill.id;
            // Store data for tooltip/sorting
            btn.dataset.cost = this.getSkillApCost(skill);
            btn.dataset.target = this.formatTargetLabel(skill);

            // Create AP Badge
            const badgeAp = document.createElement('span');
            badgeAp.className = 'skill-badge-ap';
            badgeAp.textContent = this.getSkillApCost(skill);

            // Create Center Icon
            const iconCenter = document.createElement('span');
            iconCenter.className = 'skill-icon-center';
            iconCenter.textContent = skill.icon || this._pickSkillIcon(skill);

            // Create Name Bar
            const nameBar = document.createElement('span');
            nameBar.className = 'skill-name-bar';
            nameBar.textContent = skill.name || '未知技能';

            btn.appendChild(badgeAp);
            btn.appendChild(iconCenter);
            btn.appendChild(nameBar);

            this.poolContainer.appendChild(btn);
        });

        this.updateSkillAvailability();
        this.renderApMeter();
    }

    // Gray out skills if AP not enough
    updateSkillAvailability() {
        const currentAP = this.engine.data.playerData.stats.ap; // This AP usually resets each turn
        // Wait, engine logic: AP is deducted when executing? 
        // CoreEngine line 343: checks AP against (currentQueueCost + skillCost).
        
        // Calculate used AP in queue
        const usedAP = (this.engine.playerSkillQueue || []).reduce((sum, item) => sum + item.cost, 0);
        const remainingAP = currentAP - usedAP;

        const btns = this.poolContainer.querySelectorAll('.skill-icon-button');
        btns.forEach(btn => {
            const skill = this.cachedSkills.find(s => s.id === btn.dataset.id);
            if (!skill) return;

            if (this.getSkillApCost(skill) > remainingAP) {
                btn.classList.add('disabled');
                btn.disabled = true;
            } else {
                btn.classList.remove('disabled');
                btn.disabled = false;
            }
        });

        this.renderApMeter();
    }

    sortSkills(criteria) {
        // Simplistic sort re-render
        if (criteria === 'cost') {
            this.cachedSkills.sort((a, b) => a.cost - b.cost);
        } else if (criteria === 'target') {
            this.cachedSkills.sort((a, b) => a.targetType.localeCompare(b.targetType));
        }
        this.renderSkillPool();
    }

    // Fill Matrix from Queue
    renderMatrixQueue(queue) {
        this.clearMatrixSlots(); // Just clear content, keep structure

        // Re-populate
        queue.forEach((action, index) => {
            // Prefer rendering by slotKey to preserve exact placements.
            const slotKey = action && typeof action.slotKey === 'string' ? action.slotKey : null;
            if (slotKey && this.engine?.turnPlanner?.parseSlotKey) {
                const parsed = this.engine.turnPlanner.parseSlotKey(slotKey);
                if (parsed) {
                    const row = this.matrixContainer.querySelector(`.matrix-row[data-row-part="${parsed.part}"]`);
                    const zone = row ? row.querySelector(`.matrix-zone.${parsed.side}-zone`) : null;
                    const slotEl = zone ? zone.querySelector(`.slot-placeholder[data-slot-index="${parsed.index}"]`) : null;
                    if (slotEl) {
                        this.fillSlot(slotEl, action, index);
                        return;
                    }
                }
            }

            console.error('[UI_SkillPanel] Invalid planned action: missing or unparsable slotKey.', action);
            this.eventBus?.emit?.('BATTLE_LOG', { text: `渲染失败：技能 ${action?.skillId || 'unknown'} 缺少有效 slotKey。` });
        });
    }

    fillSlot(slotEl, action, queueIndex) {
        slotEl.classList.add('filled');
        if (action && action.__draft) {
            slotEl.dataset.queueIndex = 'draft';
            slotEl.dataset.isDraft = '1';
        } else {
            slotEl.dataset.queueIndex = queueIndex;
            delete slotEl.dataset.isDraft;
        }

        const isSelf = (action.targetId === this.engine.data.playerData.id);
        const targetTypeStr = isSelf ? 'self' : 'enemy';
        slotEl.dataset.occupiedSkillId = action.skillId;
        slotEl.dataset.occupiedTargetType = targetTypeStr;
        slotEl.dataset.occupiedPart = action.bodyPart;
        slotEl.dataset.occupiedSlotKey = this._makeSlotKey(action.bodyPart, targetTypeStr, Number(slotEl.dataset.slotIndex));

        // Find skill icon
        const skill = this.cachedSkills.find(s => s.id === action.skillId);
        const skillType = (skill && typeof skill.type === 'string') ? skill.type.toLowerCase() : null;
        slotEl.textContent = skill ? (skill.icon || this._getSkillSlotLabel(skill)) : '?';
        if (skill?.name) slotEl.title = skill.name;
        slotEl.classList.add(skillType ? `type-${skillType}` : 'type-neutral');
    }

    clearMatrixSlots() {
        const slots = this.matrixContainer.querySelectorAll('.slot-placeholder');
        slots.forEach(s => {
            s.classList.remove('filled', 'type-offense', 'type-defense', 'type-neutral', 'type-magic');
            s.textContent = '';
            delete s.dataset.queueIndex;
            delete s.dataset.isDraft;
            delete s.dataset.occupiedSkillId;
            delete s.dataset.occupiedTargetType;
            delete s.dataset.occupiedPart;
            delete s.dataset.occupiedSlotKey;
        });
    }

    _makeSlotKey(part, targetType, slotIndex) {
        return `${targetType}:${part}:${slotIndex}`;
    }

    _rebuildDraftQueue() {
        this.draftQueue = [];
        if (!this.planningDraftBySkill || typeof this.planningDraftBySkill !== 'object') return;

        for (const d of Object.values(this.planningDraftBySkill)) {
            if (!d || !d.skillId) continue;
            const placedSlots = Array.isArray(d.placedSlots) ? d.placedSlots : [];
            for (const slotKey of placedSlots) {
                const parsed = this.engine?.turnPlanner?.parseSlotKey
                    ? this.engine.turnPlanner.parseSlotKey(slotKey)
                    : null;
                if (!parsed) continue;

                const action = {
                    source: 'PLAYER',
                    skillId: d.skillId,
                    targetId: d.targetId,
                    bodyPart: parsed.part,
                    cost: 0,
                    speed: 0,
                    slotKey,
                    __draft: true
                };
                this.draftQueue.push(action);
            }
        }
    }
    
    clearMatrix() {
        this.clearMatrixSlots();
        // Also resets disabled states if logic requires
    }

    // --- Interaction Feedback ---

    highlightValidSlots() {
        this.clearHighlights();
        if (!this.selectedSkill) return;

        const s = this.selectedSkill;
        const targetInfo = this.getSkillTarget(s);
        if (!targetInfo) {
            this.eventBus?.emit?.('BATTLE_LOG', { text: `技能配置错误：${s?.id || 'unknown'} 缺少合法 target。` });
            return;
        }
        const isFriendly = targetInfo.subject === 'SUBJECT_SELF';
        const targetZoneClass = isFriendly ? 'self-zone' : 'enemy-zone';
        const isGlobal = targetInfo.scope === 'SCOPE_ENTITY';
        const selection = targetInfo.selection || {};
        const candidateParts = Array.isArray(selection.candidateParts) ? selection.candidateParts : [];
        const selectedParts = Array.isArray(selection.selectedParts) ? selection.selectedParts : [];
        const allowedParts = selectedParts.length > 0
            ? new Set(selectedParts)
            : (candidateParts.length > 0 ? new Set(candidateParts) : null);
        const fixedPart = selection.part
            || (allowedParts && allowedParts.size === 1 ? Array.from(allowedParts)[0] : null);

        const rows = this.matrixContainer.querySelectorAll('.matrix-row');
        rows.forEach(row => {
            const rowPart = row.dataset.rowPart;
            
            // If Global Skill -> Only highlight Global Row
            if (isGlobal) {
                if (rowPart !== 'global') return;
            } else {
                // If Part Skill -> Skip Global Row
                if (rowPart === 'global') return;
                if (fixedPart && rowPart !== fixedPart) return;
                if (allowedParts && !allowedParts.has(rowPart)) return;
            }

            // Check if row is disabled (Missing Part)
            if (row.classList.contains('enemy-part-missing')) {
                // If it's a Hostile skill targeting a missing part -> Skip
                if (!isFriendly) return;
                // If Friendly skill (e.g. Heal own head), usually OK unless Player missing head?
                // For MVP assume Player Parts always exist.
            }

            const zone = row.querySelector(`.${targetZoneClass}`);
            if (!zone || zone.classList.contains('disabled-zone')) return;
                
            // Highlight empty slots
            const emptySlots = Array.from(zone.querySelectorAll('.slot-placeholder:not(.filled)'));
            emptySlots.forEach(slot => slot.classList.add('highlight-valid'));
        });
    }

    clearHighlights() {
        const slots = this.matrixContainer.querySelectorAll('.slot-placeholder');
        slots.forEach(s => s.classList.remove('highlight-valid'));
    }

    showDetail(skillId) {
        const skill = this.cachedSkills.find(s => s.id === skillId);
        if (!skill) return;

        if (this.detailName) this.detailName.textContent = skill.name;
        if (this.detailMeta) this.detailMeta.textContent = `${this.getSkillTypeLabel(skill)} · AP ${this.getSkillApCost(skill)} · 速度 ${this.formatSpeedText(skill)}`;
        if (this.detailEffect) this.detailEffect.innerHTML = `<strong>效果</strong>：${skill.description || '无'}`;
        if (this.detailTarget) this.detailTarget.innerHTML = `<strong>范围</strong>：${this.formatTargetText(skill)}`;
        if (this.detailCosts) this.detailCosts.innerHTML = `<strong>消耗</strong>：${this.formatCostText(skill)}`;
        if (this.detailSpeed) this.detailSpeed.innerHTML = `<strong>速度</strong>：${this.formatSpeedText(skill)}`;
        if (this.detailBuffs) this.detailBuffs.innerHTML = `<strong>Buff</strong>：${this.formatBuffRefsText(skill)}`;
    }

    formatSpeedText(skill) {
        if (skill && typeof skill.speed !== 'undefined') return String(skill.speed);
        if (skill && typeof skill.initiative !== 'undefined') return String(skill.initiative);
        return '-';
    }

    getSkillTypeLabel(skill) {
        if (skill && skill.type) return skill.type;
        const tags = Array.isArray(skill?.tags) ? skill.tags : [];
        if (tags.includes('HEAL')) return 'HEAL';
        if (tags.includes('DMG_HP') || tags.includes('DMG_ARMOR') || tags.includes('PIERCE')) return 'DAMAGE';
        if (tags.includes('ARMOR_ADD')) return 'DEFENSE';
        if (tags.includes('BUFF_APPLY') || tags.includes('BUFF_REMOVE')) return 'BUFF';
        return 'SKILL';
    }

    getSkillApCost(skill) {
        if (skill.costs && skill.costs.ap !== undefined) return skill.costs.ap;
        if (skill.cost !== undefined) return skill.cost;
        return 0;
    }

    getSkillTarget(skill) {
        if (!skill?.target || typeof skill.target !== 'object') {
            console.error('[UI_SkillPanel] Invalid skill target config: missing target object.', skill);
            return null;
        }

        const subject = skill.target.subject;
        const scope = skill.target.scope;
        const selection = skill.target.selection || {};

        if (!subject || (scope !== 'SCOPE_ENTITY' && scope !== 'SCOPE_PART' && scope !== 'SCOPE_MULTI_PARTS')) {
            console.error('[UI_SkillPanel] Invalid skill target config: invalid subject/scope.', skill);
            return null;
        }

        if (selection.mode && selection.mode !== 'single' && selection.mode !== 'multiple') {
            console.error('[UI_SkillPanel] Invalid skill target config: invalid selection.mode.', skill);
            return null;
        }

        return {
            subject,
            scope,
            selection: {
                ...selection,
                candidateParts: Array.isArray(selection.candidateParts) ? selection.candidateParts : [],
                selectedParts: Array.isArray(selection.selectedParts) ? selection.selectedParts : []
            }
        };
    }

    formatTargetLabel(skill) {
        const target = this.getSkillTarget(skill);
        if (!target) return 'INVALID_TARGET';
        const subject = target.subject === 'SUBJECT_SELF' ? 'SELF' : 'ENEMY';
        const scope = target.scope === 'SCOPE_ENTITY'
            ? 'ENTITY'
            : (target.scope === 'SCOPE_MULTI_PARTS' ? 'MULTI_PARTS' : 'PART');
        return `${subject}_${scope}`;
    }

    formatTargetText(skill) {
        const target = this.getSkillTarget(skill);
        if (!target) return '目标配置错误';
        const subject = target.subject === 'SUBJECT_SELF' ? '自身' : '敌方';
        const scopeMap = {
            SCOPE_ENTITY: '本体',
            SCOPE_PART: '部位',
            SCOPE_MULTI_PARTS: '多部位'
        };
        const selectionMode = target.selection && target.selection.mode ? target.selection.mode : '';
        const parts = Array.isArray(target.selection?.selectedParts) && target.selection.selectedParts.length > 0
            ? target.selection.selectedParts
            : (Array.isArray(target.selection?.candidateParts) ? target.selection.candidateParts : []);
        const part = target.selection && target.selection.part
            ? `（${target.selection.part}）`
            : (parts.length > 0 ? `（${parts.join(', ')}）` : '');
        return `${subject} · ${scopeMap[target.scope] || target.scope} ${selectionMode}${part}`.trim();
    }

    formatCostText(skill) {
        const parts = [];
        parts.push(`AP ${this.getSkillApCost(skill)}`);
        if (skill.costs && skill.costs.partSlot) {
            const partSlot = skill.costs.partSlot;
            parts.push(`${partSlot.part || '-'} x${partSlot.slotCost || 1}`);
        }
        return parts.join(' / ');
    }

    formatRequirementText(skill) {
        if (!skill.requirements) return '-';
        return JSON.stringify(skill.requirements);
    }

    getBuffDisplayName(buffId) {
        if (!buffId) return '';
        const buffMap = (typeof this.engine?.data?.getBuffDefinitions === 'function')
            ? this.engine.data.getBuffDefinitions()
            : (this.engine?.data?.gameConfig?.buffs || null);
        const buff = buffMap && typeof buffMap === 'object' ? buffMap[buffId] : null;
        return buff?.name || buffId;
    }

    formatBuffRefsText(skill) {
        if (!skill.buffRefs) return '-';
        const mapRows = (rows = []) => rows.map(row => this.getBuffDisplayName(row?.buffId)).filter(Boolean).join(',');
        const parts = [];
        if (skill.buffRefs.apply && skill.buffRefs.apply.length) {
            parts.push(`施加:${mapRows(skill.buffRefs.apply)}`);
        }
        if (skill.buffRefs.applySelf && skill.buffRefs.applySelf.length) {
            parts.push(`自施:${mapRows(skill.buffRefs.applySelf)}`);
        }
        if (skill.buffRefs.remove && skill.buffRefs.remove.length) {
            parts.push(`移除:${mapRows(skill.buffRefs.remove)}`);
        }
        return parts.join(' | ') || '-';
    }
}
