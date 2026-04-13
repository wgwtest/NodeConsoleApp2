export class UI_AttentionGuide {
    constructor(engine) {
        this.engine = engine;
        this.eventBus = engine?.eventBus;
        this.root = document.body;
        this.badge = document.getElementById('uiAttentionBadge');
        this.summary = document.getElementById('battleStateSummary');
        this.isSkillArmed = false;
        this.latestActionFeedback = null;

        if (!this.root) {
            throw new Error('[UI_AttentionGuide] document.body not found.');
        }
        if (!this.eventBus) {
            throw new Error('[UI_AttentionGuide] engine.eventBus is required.');
        }
        if (!this.badge) {
            throw new Error('[UI_AttentionGuide] #uiAttentionBadge not found.');
        }

        this.bindEvents();
        this.render();
    }

    bindEvents() {
        const refresh = () => this.render();
        const clearFeedbackAndRefresh = () => {
            this.latestActionFeedback = null;
            this.render();
        };
        this.eventBus.on('BATTLE_START', clearFeedbackAndRefresh);
        this.eventBus.on('BATTLE_UPDATE', clearFeedbackAndRefresh);
        this.eventBus.on('TURN_START', clearFeedbackAndRefresh);
        this.eventBus.on('TIMELINE_READY', clearFeedbackAndRefresh);
        this.eventBus.on('TIMELINE_START', clearFeedbackAndRefresh);
        this.eventBus.on('TIMELINE_FINISHED', clearFeedbackAndRefresh);
        this.eventBus.on('TIMELINE_PAUSE', refresh);
        this.eventBus.on('TIMELINE_RESUME', refresh);

        this.eventBus.on('UI:SKILL_ARMED_CHANGED', (payload) => {
            this.isSkillArmed = !!(payload && payload.isArmed);
            if (this.isSkillArmed) {
                this.latestActionFeedback = null;
            }
            this.render();
        });

        this.eventBus.on('UI:ACTION_FEEDBACK', (payload) => {
            this.latestActionFeedback = payload && typeof payload === 'object'
                ? {
                    level: payload.level || 'info',
                    title: payload.title || '当前反馈',
                    message: payload.message || '',
                    suggestion: payload.suggestion || ''
                }
                : null;
            this.render();
        });
    }

    render() {
        const snapshot = this.buildSnapshot();
        const battlePhase = snapshot.battlePhase;
        this.root.dataset.uiPhase = battlePhase;
        this.root.dataset.uiSkillArmed = this.isSkillArmed ? '1' : '0';
        const timelinePhase = snapshot.timelinePhase;
        this.root.dataset.uiTimelinePhase = timelinePhase;

        const phaseLabelMap = {
            idle: 'IDLE',
            planning: 'PLANNING',
            execution: 'EXECUTION'
        };
        const focusLabel = this.buildFocusLabel(snapshot);

        this.badge.textContent = `阶段：${phaseLabelMap[battlePhase] || battlePhase.toUpperCase()} · 焦点：${focusLabel}`;

        if (this.summary) {
            this.renderSummary(snapshot);
        }
    }

    buildSnapshot() {
        const battlePhase = String(this.engine?.battlePhase || 'IDLE').toLowerCase();
        const timelinePhase = String(this.engine?.timeline?.phase || 'IDLE').toLowerCase();
        const queue = Array.isArray(this.engine?.playerSkillQueue) ? this.engine.playerSkillQueue : [];
        const usedAp = queue.reduce((sum, action) => sum + (Number(action?.cost) || 0), 0);
        const playerStats = this.engine?.data?.playerData?.stats || {};
        const maxAp = Number(playerStats.maxAp ?? playerStats.ap ?? 0) || 0;
        const currentAp = Number(playerStats.ap ?? maxAp) || maxAp;
        const turn = Number(this.engine?.currentTurn) || 0;

        return {
            battlePhase,
            timelinePhase,
            queueLength: queue.length,
            usedAp,
            currentAp,
            maxAp,
            turn
        };
    }

    buildFocusLabel(snapshot) {
        if (snapshot.battlePhase === 'planning') {
            return this.isSkillArmed ? '技能槽位选择' : '技能规划';
        }
        if (snapshot.battlePhase === 'execution') {
            return '时间轴执行';
        }
        return '等待流程开始';
    }

    renderSummary(snapshot) {
        const objective = this.buildObjectiveSummary(snapshot);
        const status = this.buildStatusSummary(snapshot);
        const action = this.buildActionSummary(snapshot);
        const glossary = this.buildGlossarySummary();
        const feedback = this.buildFeedbackSummary(snapshot);

        this.summary.dataset.phase = snapshot.battlePhase;
        this.summary.innerHTML = '';
        this.summary.appendChild(this.createSummaryCard('当前目标', objective.value, objective.meta, objective.chips, { kind: 'objective' }));
        this.summary.appendChild(this.createSummaryCard('战斗态势', status.value, status.meta, status.chips, { kind: 'status' }));
        this.summary.appendChild(this.createSummaryCard('当前操作', action.value, action.meta, action.chips, { kind: 'action' }));
        this.summary.appendChild(this.createSummaryCard('机制术语', glossary.value, glossary.meta, glossary.chips, { kind: 'glossary', wide: true }));
        this.summary.appendChild(this.createSummaryCard('阻塞反馈', feedback.value, feedback.meta, feedback.chips, { kind: 'feedback' }));
    }

    createSummaryCard(label, value, meta, chips = [], options = {}) {
        const card = document.createElement('article');
        card.className = 'summary-card';
        if (options.wide) {
            card.classList.add('summary-card--wide');
        }
        if (options.kind) {
            card.dataset.summaryCard = options.kind;
        }

        const eyebrow = document.createElement('div');
        eyebrow.className = 'summary-card__eyebrow';
        eyebrow.textContent = label;

        const valueEl = document.createElement('div');
        valueEl.className = 'summary-card__value';
        valueEl.textContent = value;

        const metaEl = document.createElement('p');
        metaEl.className = 'summary-card__meta';
        metaEl.textContent = meta;

        card.appendChild(eyebrow);
        card.appendChild(valueEl);
        card.appendChild(metaEl);

        if (Array.isArray(chips) && chips.length > 0) {
            const chipRow = document.createElement('div');
            chipRow.className = 'summary-chip-row';
            chips.forEach(text => {
                const chip = document.createElement('span');
                chip.className = 'summary-chip';
                chip.textContent = text;
                chipRow.appendChild(chip);
            });
            card.appendChild(chipRow);
        }

        return card;
    }

    buildObjectiveSummary(snapshot) {
        if (snapshot.battlePhase === 'planning') {
            if (this.isSkillArmed) {
                return {
                    value: '把已选技能放入目标槽位',
                    meta: '当前已选中技能，点击高亮槽位完成部署；未放入槽位前不会进入执行阶段。',
                    chips: ['技能已选中', `第 ${snapshot.turn || '-'} 回合`]
                };
            }

            if (snapshot.queueLength > 0 && snapshot.timelinePhase === 'ready') {
                return {
                    value: '确认本回合规划并准备执行',
                    meta: '当前规划已经锁定为可执行状态，下一步是执行回合或重置重排。',
                    chips: [`已规划 ${snapshot.queueLength} 项`, `AP ${snapshot.usedAp} / ${snapshot.maxAp}`]
                };
            }

            return {
                value: '选择技能并部署到技能槽',
                meta: '先把本回合要用的技能放入槽位，再提交规划进入可执行状态。',
                chips: [`已规划 ${snapshot.queueLength} 项`, '尚未提交规划']
            };
        }

        if (snapshot.battlePhase === 'execution') {
            return {
                value: '观察执行结果并等待结算',
                meta: '执行阶段只负责播报结果，不再接受新的技能规划输入。',
                chips: [`第 ${snapshot.turn || '-'} 回合`, '执行阶段']
            };
        }

        return {
            value: '从游戏菜单进入关卡',
            meta: '当前还未进入战斗规划阶段，需要先开始冒险并选择关卡。',
            chips: ['未进入战斗', '等待流程开始']
        };
    }

    buildStatusSummary(snapshot) {
        if (snapshot.battlePhase === 'execution') {
            return {
                value: `第 ${snapshot.turn || '-'} 回合 · 时间轴执行中`,
                meta: '当前由时间轴逐项结算技能与敌人动作，主流程输入暂时锁定。',
                chips: [`时间轴 ${snapshot.timelinePhase.toUpperCase()}`, `已规划 ${snapshot.queueLength} 项`]
            };
        }

        const planningMeta = snapshot.maxAp > 0
            ? (
                snapshot.queueLength > 0
                    ? `当前规划已消耗 ${snapshot.usedAp} / ${snapshot.maxAp} AP。`
                    : `当前规划为空，AP 预算保持 ${snapshot.currentAp} / ${snapshot.maxAp}。`
            )
            : '当前尚未进入战斗，AP 预算会在进入关卡后显示。';

        return {
            value: `第 ${snapshot.turn || '-'} 回合 · 已规划 ${snapshot.queueLength} 项`,
            meta: planningMeta,
            chips: [
                `阶段 ${snapshot.battlePhase.toUpperCase()}`,
                `时间轴 ${snapshot.timelinePhase.toUpperCase()}`
            ]
        };
    }

    buildActionSummary(snapshot) {
        if (snapshot.battlePhase === 'planning') {
            if (this.isSkillArmed) {
                return {
                    value: '点击高亮槽位完成部署',
                    meta: '部署完成后可继续选技能，或提交规划进入可执行状态。',
                    chips: ['优先完成当前技能部署']
                };
            }

            if (snapshot.queueLength > 0 && snapshot.timelinePhase === 'ready') {
                return {
                    value: '可以执行回合，也可以重置重排',
                    meta: '本轮规划已经满足执行条件；若要改动，请先点重置。',
                    chips: ['执行回合', '重置']
                };
            }

            return {
                value: '先选技能，再部署到技能槽',
                meta: '当前尚未形成可执行规划；提交前请确认技能目标与消耗。',
                chips: ['技能按钮', '技能槽']
            };
        }

        if (snapshot.battlePhase === 'execution') {
            return {
                value: '等待自动结算并观察时间轴结果',
                meta: '这里的动画和时间轴只负责展示，不改变核心战斗规则。',
                chips: ['等待自动结算']
            };
        }

        return {
            value: '从游戏菜单开始冒险',
            meta: '系统菜单负责入口选择；进入关卡后才会出现可规划的技能操作。',
            chips: ['开始冒险', '关卡选择']
        };
    }

    buildGlossarySummary() {
        return {
            value: '先理解 AP、技能槽、部位、Buff / Debuff、时间轴',
            meta: 'AP 是本回合可部署的技能预算；技能槽代表技能实际部署位，部署后才会进入规划；部位决定攻击或防御聚焦点；Buff / Debuff 是增益与减益；时间轴是执行阶段的展示顺序。',
            chips: ['AP', '技能槽', '部位', 'Buff / Debuff', '时间轴']
        };
    }

    buildFeedbackSummary(snapshot) {
        const latest = this.latestActionFeedback;
        if (latest && (latest.title || latest.message || latest.suggestion)) {
            const chips = [];
            if (latest.level) {
                chips.push(`级别 ${String(latest.level).toUpperCase()}`);
            }
            if (latest.suggestion) {
                chips.push(latest.suggestion);
            }
            return {
                value: latest.title || '当前反馈',
                meta: latest.message || '请按当前提示继续。',
                chips
            };
        }

        if (snapshot.battlePhase === 'planning') {
            if (this.isSkillArmed) {
                return {
                    value: '技能已选中，等待部署',
                    meta: '先把当前技能放入高亮槽位；只有部署完成后，规划状态才会继续前进。',
                    chips: ['先部署技能', '再继续选技能']
                };
            }

            if (snapshot.timelinePhase === 'ready' && snapshot.queueLength > 0) {
                return {
                    value: '当前无阻塞，可以执行回合',
                    meta: '本回合规划已经锁定为可执行状态；如果要改动，先点“重置”，否则直接执行回合。',
                    chips: ['执行回合', '或重置重排']
                };
            }

            return {
                value: '尚未形成可执行规划',
                meta: '先从技能库选择技能，再把技能放入技能槽。提交规划后，“执行回合”才会解锁。',
                chips: ['先选技能', '再提交规划']
            };
        }

        if (snapshot.battlePhase === 'execution') {
            return {
                value: '执行阶段输入已锁定',
                meta: '当前正在自动结算；技能规划和重置会暂时锁定，等待本轮执行结束后再继续。',
                chips: ['等待自动结算']
            };
        }

        return {
            value: '当前不在战斗流程内',
            meta: '先从游戏菜单开始冒险并选择关卡；进入关卡后，才会出现技能规划与执行反馈。',
            chips: ['开始冒险', '关卡选择']
        };
    }
}
