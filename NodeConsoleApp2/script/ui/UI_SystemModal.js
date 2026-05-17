/**
 * @file UI_SystemModal.js
 * @description 系统模态窗口 UI 组件，负责主菜单、关卡选择、存档读档等界面的显示与交互。
 * 遵循 16-战斗界面(UI_design)-设计说明.md 中的接口规范与代码规范。
 */

export class UI_SystemModal {
    /**
     * 构造函数
     */
    constructor() {
        // DOM 元素缓存
        this.dom = {
            backdrop: null,
            panel: null,
            title: null,
            body: null,
            footer: null,
            closeBtn: null,
            menuBtn: null
        };

        // 当前视图状态
        this.currentView = null;
        this.saveLoadStatusMessage = '';
        this.saveLoadReturnView = 'MAIN_MENU';
        this.saveLoadTitle = '存档 / 读档';

        // 引擎引用 (仅用于发送指令和监听事件)
        this.engine = null;

      // Skill Tree is hosted by dedicated overlay (方案B). SystemModal does not own it.
    }

    /**
     * 初始化组件
     * @param {Object} engine - 游戏引擎实例，需包含 eventBus, input 和 dataManager(可选，用于同步获取数据)
     */
    init(engine) {
        console.log('[UI_SystemModal] Initializing...');
        this.engine = engine;
        this.bindDOM();
        this.bindEvents();

        // 初始隐藏
        this.hide();

        // 检查引擎当前状态，如果已经在 LOGIN 或 LEVEL_SELECT 等状态，立即显示对应 UI
        if (this.engine.fsm) {
            console.log(`[UI_SystemModal] Checking initial engine state: ${this.engine.fsm.currentState}`);
            this.handleStateChange({ to: this.engine.fsm.currentState });
        }
    }

    /**
     * 绑定 DOM 元素
     * @private
     */
    bindDOM() {
        this.dom.backdrop = document.getElementById('systemModal');
        this.dom.panel = this.dom.backdrop?.querySelector('.modal-panel') || document.querySelector('.modal-panel');
        this.dom.title = document.getElementById('modalTitle');
        this.dom.body = document.getElementById('modalBody');
        this.dom.footer = document.getElementById('modalFooter');
        this.dom.closeBtn = document.getElementById('modalCloseBtn');
        this.dom.menuBtn = document.getElementById('systemMenuBtn');

        // 绑定关闭按钮事件
        if (this.dom.closeBtn) {
            this.dom.closeBtn.addEventListener('click', () => this.handleClose());
        }

        // 绑定菜单按钮事件
        if (this.dom.menuBtn) {
            this.dom.menuBtn.addEventListener('click', () => this.openMainMenu());
        }
    }

    /**
     * 绑定引擎事件
     * @private
     */
    bindEvents() {
        if (!this.engine || !this.engine.eventBus) return;

        // 监听状态变更
        this.engine.eventBus.on('STATE_CHANGED', this.handleStateChange.bind(this));

        // 监听数据更新 (如存档列表更新)
        this.engine.eventBus.on('DATA_UPDATE', this.handleDataUpdate.bind(this));

        // 监听 UI 请求打开模态框
        this.engine.eventBus.on('UI:OPEN_MODAL', this.handleOpenModal.bind(this));

        // 技能树由独立 Overlay 处理（见 UI_SkillTreeOverlay）。

        // 监听关闭模态框请求
        this.engine.eventBus.on('UI:CLOSE_MODAL', () => this.hide());
    }


    /**
     * 处理状态变更事件
     * @param {Object} stateData - { from, to }
     */
    handleStateChange(stateData) {
        const { to, params } = stateData;
        console.log(`[UI_SystemModal] State changed to: ${to}`);

        if (to === 'LEVEL_SELECT') {
            this.renderLevelSelect();
            this.show();
        } else if (to === 'BATTLE_LOOP' || to === 'BATTLE_PREPARE') {
            this.hide();
        } else if (to === 'LOGIN') {
            this.renderLogin();
            this.show();
        } else if (to === 'MAIN_MENU') {
            this.renderMainMenu();
            this.show();
        } else if (to === 'BATTLE_SETTLEMENT') {
            this.renderBattleSettlement(params);
            this.show();
        }
    }

    /**
     * 渲染战斗结算视图
     * @param {Object} params - { victory: boolean }
     */
    renderBattleSettlement(params) {
        console.log('[UI_SystemModal] Rendering Battle Settlement');
        this.currentView = 'BATTLE_SETTLEMENT';
        const isVictory = params && params.victory;
        const settlement = params && params.settlement ? params.settlement : null;
        
        this.setTitle(isVictory ? '战斗胜利' : '战斗失败');
        this.clearContent();
        this.clearFooter();

        // 隐藏关闭按钮，强制用户点击确认
        this._setCloseButtonState({ visible: false });

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '20px';
        container.style.padding = '40px';
        container.style.alignItems = 'center';
        container.style.color = '#fff';

        const message = document.createElement('h2');
        message.style.fontSize = '1.5rem';
        message.style.color = isVictory ? '#4cd964' : '#ff3b30';
        message.textContent = isVictory 
            ? 'VICTORY!' 
            : 'DEFEAT...';
            
        const subMsg = document.createElement('p');
        subMsg.textContent = isVictory 
            ? '战斗结束，你赢得了胜利。' 
            : '战斗结束，请重新来过。';

        container.appendChild(message);
        container.appendChild(subMsg);

        if (settlement) {
            const levelInfo = document.createElement('div');
            levelInfo.style.fontSize = '0.95rem';
            levelInfo.style.opacity = '0.85';
            levelInfo.textContent = `关卡：${settlement.levelName || settlement.levelId || '未知关卡'}`;
            container.appendChild(levelInfo);
        }

        const rewardItems = [
            {
                label: '经验',
                delta: Number(settlement?.rewards?.exp) || 0,
                total: Number(settlement?.playerAfter?.resources?.exp)
            },
            {
                label: '金币',
                delta: Number(settlement?.rewards?.gold) || 0,
                total: Number(settlement?.playerAfter?.resources?.gold)
            },
            {
                label: '知识点 KP',
                delta: Number(settlement?.rewards?.kp) || 0,
                total: Number(settlement?.playerAfter?.skillPoints)
            }
        ];

        if (settlement) {
            const rewardPanel = document.createElement('div');
            rewardPanel.style.width = '100%';
            rewardPanel.style.maxWidth = '420px';
            rewardPanel.style.padding = '16px';
            rewardPanel.style.border = '1px solid rgba(124,245,217,0.35)';
            rewardPanel.style.borderRadius = '8px';
            rewardPanel.style.background = 'rgba(18, 23, 38, 0.92)';

            const rewardTitle = document.createElement('div');
            rewardTitle.style.fontSize = '0.95rem';
            rewardTitle.style.fontWeight = '700';
            rewardTitle.style.marginBottom = '12px';
            rewardTitle.textContent = isVictory ? '本局奖励' : '本局结果';
            rewardPanel.appendChild(rewardTitle);

            rewardItems.forEach(item => {
                if (!Number.isFinite(item.total) && item.delta === 0) return;
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.alignItems = 'center';
                row.style.padding = '6px 0';
                row.style.borderTop = '1px solid rgba(255,255,255,0.06)';

                const label = document.createElement('span');
                label.textContent = item.label;

                const value = document.createElement('span');
                const totalText = Number.isFinite(item.total) ? ` / 累计 ${item.total}` : '';
                value.textContent = `${item.delta >= 0 ? '+' : ''}${item.delta}${totalText}`;

                row.appendChild(label);
                row.appendChild(value);
                rewardPanel.appendChild(row);
            });

            if (settlement.firstClear) {
                const firstClearTag = document.createElement('div');
                firstClearTag.style.marginTop = '12px';
                firstClearTag.style.color = '#7cf5d9';
                firstClearTag.style.fontSize = '0.9rem';
                firstClearTag.textContent = '首次通关';
                rewardPanel.appendChild(firstClearTag);
            }

            container.appendChild(rewardPanel);

            const progressFeedback = this._describeSettlementProgressFeedback(settlement);
            if (progressFeedback) {
                const progressPanel = document.createElement('div');
                progressPanel.style.width = '100%';
                progressPanel.style.maxWidth = '420px';
                progressPanel.style.padding = '16px';
                progressPanel.style.border = '1px solid rgba(124,245,217,0.22)';
                progressPanel.style.borderRadius = '8px';
                progressPanel.style.background = 'rgba(18, 23, 38, 0.78)';

                const progressTitle = document.createElement('div');
                progressTitle.style.fontSize = '0.95rem';
                progressTitle.style.fontWeight = '700';
                progressTitle.style.marginBottom = '8px';
                progressTitle.textContent = progressFeedback.label;

                const progressText = document.createElement('p');
                progressText.style.margin = '0';
                progressText.style.fontSize = '0.9rem';
                progressText.style.lineHeight = '1.6';
                progressText.style.color = '#dfe7ff';
                progressText.textContent = progressFeedback.text;

                progressPanel.appendChild(progressTitle);
                progressPanel.appendChild(progressText);
                container.appendChild(progressPanel);
            }
        }

        const actionRow = document.createElement('div');
        actionRow.style.display = 'flex';
        actionRow.style.flexWrap = 'wrap';
        actionRow.style.justifyContent = 'center';
        actionRow.style.gap = '12px';
        actionRow.style.marginTop = '20px';

        const createActionButton = (label, onClick) => {
            const btn = document.createElement('button');
            btn.className = 'btn-primary';
            btn.textContent = label;
            btn.style.padding = '10px 24px';
            btn.style.fontSize = '1rem';
            btn.style.cursor = 'pointer';
            btn.style.background = '#1f2440';
            btn.style.color = '#fff';
            btn.style.border = '1px solid #7cf5d9';
            btn.style.borderRadius = '4px';
            btn.onclick = onClick;
            return btn;
        };

        actionRow.appendChild(createActionButton('再次挑战', () => {
            if (this.engine.input && this.engine.input.selectLevel && settlement?.levelId) {
                this.engine.input.selectLevel(settlement.levelId);
            }
        }));

        if (settlement?.nextLevelId) {
            actionRow.appendChild(createActionButton(`前往下一关${settlement?.nextLevelName ? `：${settlement.nextLevelName}` : ''}`, () => {
                if (this.engine.input && this.engine.input.selectLevel) {
                    this.engine.input.selectLevel(settlement.nextLevelId);
                }
            }));
        }

        if (isVictory) {
            actionRow.appendChild(createActionButton('前往技能树 / 构筑', () => {
                if (this.engine.input && this.engine.input.confirmSettlement) {
                    this.engine.input.confirmSettlement();
                }
                this.openSkillTree('SETTLEMENT', { defer: true });
            }));
        }

        actionRow.appendChild(createActionButton('返回主菜单', () => {
            if (this.engine.input && this.engine.input.confirmSettlement) {
                this.engine.input.confirmSettlement();
            }
        }));

        container.appendChild(actionRow);
        this.dom.body.appendChild(container);
    }

    /**
     * 渲染登录视图
     */
    renderLogin() {
        console.log('[UI_SystemModal] Rendering Login');
        this.currentView = 'LOGIN';
        this.setTitle('欢迎');
        this.clearContent();
        this.clearFooter();

        // 隐藏关闭按钮，强制用户登录
        this._setCloseButtonState({ visible: false });

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '请输入玩家名称';
        input.value = 'Player1';
        input.style.padding = '10px';
        input.style.fontSize = '1.2rem';
        input.style.width = '200px';
        input.style.textAlign = 'center';
        input.style.background = '#1f2440';
        input.style.color = '#fff';
        input.style.border = '1px solid #7cf5d9';
        input.style.borderRadius = '4px';

        const actionRow = document.createElement('div');
        actionRow.style.display = 'flex';
        actionRow.style.gap = '12px';
        actionRow.style.flexWrap = 'wrap';
        actionRow.style.justifyContent = 'center';

        const hasAnySave = Boolean(this.engine?.data?.hasAnySave && this.engine.data.hasAnySave());

        const newGameBtn = document.createElement('button');
        newGameBtn.className = 'btn-primary';
        newGameBtn.textContent = '新游戏';
        newGameBtn.style.padding = '10px 30px';
        newGameBtn.style.fontSize = '1.2rem';
        newGameBtn.style.cursor = 'pointer';
        
        newGameBtn.onclick = () => {
            const username = input.value.trim();
            if (username && this.engine.input && this.engine.input.login) {
                this.engine.input.login(username);
            }
        };

        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn-primary';
        loadBtn.textContent = '读取存档';
        loadBtn.style.padding = '10px 30px';
        loadBtn.style.fontSize = '1.2rem';
        loadBtn.style.cursor = 'pointer';
        loadBtn.disabled = !hasAnySave;
        loadBtn.onclick = () => {
            if (!hasAnySave) return;
            this.renderSaveLoad(undefined, '', {
                returnView: 'LOGIN',
                title: '读取存档'
            });
        };

        const tip = document.createElement('p');
        tip.style.margin = '0';
        tip.style.fontSize = '0.88rem';
        tip.style.color = '#cfe8ff';
        tip.style.textAlign = 'center';
        tip.textContent = hasAnySave ? '' : '当前没有可读取的本地存档。';

        const primaryActions = document.createElement('section');
        primaryActions.className = 'modal-primary-actions';
        primaryActions.appendChild(input);
        actionRow.appendChild(newGameBtn);
        actionRow.appendChild(loadBtn);
        primaryActions.appendChild(actionRow);
        primaryActions.appendChild(tip);
        this.dom.body.appendChild(primaryActions);
    }

    /**
     * 处理数据更新事件
     * @param {Object} updateData - { type, data }
     */
    handleDataUpdate(updateData) {
        const { type, data, message } = updateData || {};
        console.log(`[UI_SystemModal] Data update received: ${type}`);

        // 如果当前正在显示存档/读档界面，且收到了存档列表更新
        if (this.currentView === 'SAVE_LOAD' && type === 'SAVE_LIST') {
            this.renderSaveLoad(data, message || '', {
                returnView: this.saveLoadReturnView,
                title: this.saveLoadTitle
            });
            return;
        }

        // 主菜单需要在技能学习提交后立即刷新成长摘要
        if (this.currentView === 'MAIN_MENU' && type === 'PLAYER_SKILLS') {
            this.renderMainMenu();
            return;
        }

        // 关卡选择页需要在技能学习提交后立即刷新关卡状态
        if (this.currentView === 'LEVEL_SELECT' && type === 'PLAYER_SKILLS') {
            this.renderLevelSelect();
        }
    }

    /**
     * 处理打开模态框请求
     * @param {Object} request - { view }
     */
    handleOpenModal(request) {
        const { view } = request;
        console.log(`[UI_SystemModal] Open modal request: ${view}`);
        if (view === 'SETTINGS') {
            this.renderSettings();
            this.show();
        }
    }

    /**
     * 处理关闭操作
     */
    handleClose() {
        console.log('[UI_SystemModal] Closing modal...');
        
        // 如果在登录界面，不允许关闭
        if (this.currentView === 'LOGIN') return;

        // 尝试恢复游戏
        if (this.engine.input && this.engine.input.resumeGame) {
            this.engine.input.resumeGame();
        } else {
            this.hide();
        }
    }

    /**
     * 显示模态框
     */
    show() {
        console.log('[UI_SystemModal] Showing modal');
        if (document.body) {
            document.body.classList.add('modal-open');
        }
        if (this.dom.backdrop) {
            this.dom.backdrop.classList.add('visible');
            this.dom.backdrop.hidden = false;
            this.dom.backdrop.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * 隐藏模态框
     */
    hide() {
        console.log('[UI_SystemModal] Hiding modal');
        if (document.body) {
            document.body.classList.remove('modal-open');
        }
        if (this.dom.backdrop) {
            this.dom.backdrop.classList.remove('visible');
            this.dom.backdrop.hidden = true;
            this.dom.backdrop.setAttribute('aria-hidden', 'true');
        }
        this.setTitle('');
        this.currentView = null;
        this.clearContent();
        this.clearFooter();
    }

    /**
     * 打开主菜单
     */
    openMainMenu() {
        console.log('[UI_SystemModal] Opening Main Menu');
        this.renderMainMenu();
        this.show();
    }

    /**
     * 渲染主菜单视图
     */
    renderMainMenu() {
        console.log('[UI_SystemModal] Rendering Main Menu');
        this.currentView = 'MAIN_MENU';
        this.setTitle('游戏菜单');
        this.clearContent();

        // 检查是否可以返回当前战斗（在战斗中，或当前内存已带战斗 runtime）
        const canResume = this._canResumeBattle();

        this._setCloseButtonState({
            visible: canResume,
            label: '关闭并返回战斗'
        });

        const menu = document.createElement('div');
        menu.className = 'menu-list';
        const growthSummary = this._buildMainMenuGrowthSummary();

        const items = [];
        if (canResume) {
            items.push({ label: '返回战斗', action: () => this.handleClose() });
        }

        items.push(
            { label: '关卡选择', action: () => {
                // 切换到关卡选择状态，引擎会触发 STATE_CHANGED -> LEVEL_SELECT -> renderLevelSelect
                // 但目前 CoreEngine.selectLevel 只是选择关卡，没有单独的 "进入关卡选择界面" 的指令
                // 我们可以直接调用 renderLevelSelect，或者如果引擎有 changeState('LEVEL_SELECT') 更好
                // 这里假设直接渲染视图，或者调用引擎方法（如果存在）
                // 由于 CoreEngine.selectLevel 是“选择并开始”，我们需要一个“进入选择界面”的方法
                // 暂时直接渲染视图
                this.renderLevelSelect();
            }},
            { label: '技能树 / 构筑', action: () => this.openSkillTreeFromMainMenu() },
            { label: '存档 / 读档', action: () => this.renderSaveLoad(undefined, '', { returnView: 'MAIN_MENU', title: '存档 / 读档' }) },
            { label: '设置', action: () => this.renderSettings() },
            { label: '注销', action: () => {
                if (this.engine.input && this.engine.input.backToTitle) {
                    this.engine.input.backToTitle();
                }
            }}
        );

        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'menu-btn';
            btn.textContent = item.label;
            btn.onclick = item.action;
            menu.appendChild(btn);
        });

        this.dom.body.appendChild(menu);
        if (growthSummary) {
            this.dom.body.appendChild(growthSummary);
        }
        this.clearFooter(); // 主菜单通常不需要 Footer 按钮
    }

    _buildMainMenuGrowthSummary() {
        const playerSkills = this.engine?.data?.playerData?.skills;
        const progress = this.engine?.data?.dataConfig?.global?.progress;
        const lastSettlement = progress?.lastSettlement;
        const lastLearnAction = progress?.lastLearnAction;
        const learned = Array.isArray(playerSkills?.learned) ? playerSkills.learned : [];
        const skillPoints = Number(playerSkills?.skillPoints);
        const summary = document.createElement('section');
        summary.className = 'summary-section summary-section--growth';
        summary.dataset.summaryKind = 'growth';

        const title = document.createElement('div');
        title.className = 'summary-section__title';
        title.textContent = '成长摘要';

        const statGrid = document.createElement('div');
        statGrid.className = 'summary-metric-grid';

        const createStatCard = (label, value) => {
            const card = document.createElement('div');
            card.className = 'summary-metric-card';

            const labelEl = document.createElement('div');
            labelEl.className = 'summary-metric-card__label';
            labelEl.textContent = label;

            const valueEl = document.createElement('div');
            valueEl.className = 'summary-metric-card__value';
            valueEl.textContent = value;

            card.appendChild(labelEl);
            card.appendChild(valueEl);
            return card;
        };

        statGrid.appendChild(createStatCard('知识点 KP', Number.isFinite(skillPoints) ? String(skillPoints) : '0'));
        statGrid.appendChild(createStatCard('已学技能', String(learned.length)));

        summary.appendChild(title);
        summary.appendChild(statGrid);

        const detailStack = document.createElement('div');
        detailStack.className = 'summary-detail-stack';

        detailStack.appendChild(this._createGrowthSummaryDetail(
            '最近成长来源',
            this._describeLastSettlement(lastSettlement)
        ));
        detailStack.appendChild(this._createGrowthSummaryDetail(
            '最近学习结果',
            this._describeLastLearnAction(lastLearnAction)
        ));

        summary.appendChild(detailStack);
        return summary;
    }

    _createGrowthSummaryDetail(label, text) {
        const card = document.createElement('div');
        card.className = 'summary-detail-card';

        const labelEl = document.createElement('div');
        labelEl.className = 'summary-detail-card__label';
        labelEl.textContent = label;

        const valueEl = document.createElement('div');
        valueEl.className = 'summary-detail-card__value';
        valueEl.textContent = text;

        card.appendChild(labelEl);
        card.appendChild(valueEl);
        return card;
    }

    _describeLastSettlement(lastSettlement) {
        if (!lastSettlement || typeof lastSettlement !== 'object') {
            return '暂无最近结算记录';
        }

        const levelName = lastSettlement.levelName || lastSettlement.levelId || '未知关卡';
        const rewards = lastSettlement.rewards || {};
        const rewardParts = [];
        if (Number.isFinite(rewards.kp)) rewardParts.push(`${rewards.kp >= 0 ? '+' : ''}${rewards.kp} KP`);
        if (Number.isFinite(rewards.exp)) rewardParts.push(`${rewards.exp >= 0 ? '+' : ''}${rewards.exp} 经验`);
        if (Number.isFinite(rewards.gold)) rewardParts.push(`${rewards.gold >= 0 ? '+' : ''}${rewards.gold} 金币`);
        const rewardText = rewardParts.length > 0 ? rewardParts.join(' / ') : '无奖励变动';
        const firstClearText = lastSettlement.firstClear ? '，首次通关' : '';
        return `${levelName}：${rewardText}${firstClearText}`;
    }

    _describeLastLearnAction(lastLearnAction) {
        if (!lastLearnAction || typeof lastLearnAction !== 'object') {
            return '暂无最近学习记录';
        }

        const learnedNames = Array.isArray(lastLearnAction.learnedSkillNames)
            ? lastLearnAction.learnedSkillNames.filter(name => typeof name === 'string' && name.trim().length > 0)
            : [];
        const learnedCount = Number(lastLearnAction.learnedCount) || learnedNames.length;
        const learnedText = learnedNames.length > 0
            ? learnedNames.join('、')
            : `新学 ${learnedCount} 项`;
        const spentKp = Number.isFinite(lastLearnAction.spentKp) ? lastLearnAction.spentKp : 0;
        const remainingKp = Number.isFinite(lastLearnAction.remainingKp) ? lastLearnAction.remainingKp : 0;
        return `${learnedText}，消耗 ${spentKp} KP，剩余 ${remainingKp} KP`;
    }

    _describeSettlementProgressFeedback(settlement) {
        if (!settlement || typeof settlement !== 'object') {
            return null;
        }

        if (settlement.firstClear) {
            const nextLabel = settlement.nextLevelName || settlement.nextLevelId || '';
            const text = nextLabel
                ? `本次为首次通关，已解锁下一关：${nextLabel}。`
                : '本次为首次通关，当前章节推进已更新。';
            return {
                label: '首次通关反馈',
                text
            };
        }

        if (settlement.victory === false) {
            return null;
        }

        return {
            label: '重复通关收益',
            text: '本次仍获得常规资源奖励，但不再解锁新章节。'
        };
    }

    _resolveSkillDisplayName(skillId) {
        if (typeof skillId !== 'string' || skillId.trim().length === 0) {
            return '';
        }
        const normalizedId = skillId.trim();
        const skillConfig = this.engine?.data?.getSkillConfig
            ? this.engine.data.getSkillConfig(normalizedId)
            : null;
        const skillName = typeof skillConfig?.name === 'string' ? skillConfig.name.trim() : '';
        return skillName || normalizedId;
    }

    openSkillTreeFromMainMenu() {
        this.openSkillTree('MAIN_MENU');
    }

    openSkillTree(source = 'UNKNOWN', options = {}) {
        if (this.engine?.eventBus?.emit) {
            const emitOpen = () => {
                this.engine.eventBus.emit('UI:OPEN_SKILL_TREE', { source });
            };
            if (options.defer) {
                window.setTimeout(emitOpen, 0);
            } else {
                emitOpen();
            }
        } else {
            console.warn('[UI_SystemModal] eventBus.emit is missing, cannot open skill tree');
        }
    }

    _escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _buildLevelRewardPreview(rewards) {
        const source = (rewards && typeof rewards === 'object') ? rewards : {};
        const entries = [
            ['EXP', Number(source.exp) || 0],
            ['GOLD', Number(source.gold) || 0],
            ['KP', Number(source.kp) || 0]
        ];
        return entries.filter(([, value]) => value > 0);
    }

    _getLevelFlow(level) {
        return (level && typeof level.flow === 'object' && level.flow) ? level.flow : {};
    }

    _getLevelSelectionMeta(level) {
        return (level && typeof level.selectionMeta === 'object' && level.selectionMeta) ? level.selectionMeta : {};
    }

    _resolveLevelStatus(level) {
        if (level?.isCompleted) return 'completed';
        if (level?.isUnlocked === false) return 'locked';
        const status = typeof level?.progression?.status === 'string' ? level.progression.status : '';
        if (status) return status;
        if (level?.progression?.stateLabel === '当前推荐') return 'recommended';
        return 'unlocked';
    }

    _resolveLevelStatusLabel(level) {
        const status = this._resolveLevelStatus(level);
        if (status === 'completed') return '已完成';
        if (status === 'locked') return '未解锁';
        if (status === 'recommended') return '当前推荐';
        return level?.progression?.stateLabel || '已解锁';
    }

    _buildLevelRewardChipsHtml(level) {
        return this._buildLevelRewardPreview(level?.rewards)
            .map(([label, value]) => `<span class="level-chip level-chip-reward">${this._escapeHtml(label)} ${this._escapeHtml(value)}</span>`)
            .join('');
    }

    _buildCompactLevelMetaChipsHtml(level) {
        const selectionMeta = this._getLevelSelectionMeta(level);
        const chips = [];
        if (selectionMeta.difficultyLabel) {
            chips.push(`<span class="level-chip level-chip--difficulty">${this._escapeHtml(selectionMeta.difficultyLabel)}</span>`);
        }
        if (Array.isArray(selectionMeta.enemyStyleTags)) {
            selectionMeta.enemyStyleTags.slice(0, 2).forEach(tag => {
                if (tag) chips.push(`<span class="level-chip">${this._escapeHtml(tag)}</span>`);
            });
        }
        return chips.join('');
    }

    _createLevelCard(level) {
        const card = document.createElement('button');
        const status = this._resolveLevelStatus(level);
        const flow = this._getLevelFlow(level);
        const levelDesc = level.description || level.desc || '';
        const nodeLabel = flow.nodeLabel || level.id || '';
        const rewardHtml = this._buildLevelRewardChipsHtml(level);
        const metaHtml = this._buildCompactLevelMetaChipsHtml(level);
        card.type = 'button';
        card.className = `level-card level-card--compact is-${status}`;
        card.dataset.levelId = level.id || '';
        card.dataset.levelStatus = status;
        card.innerHTML = `
            <div class="level-card-topline">
                <span class="level-card-node">${this._escapeHtml(nodeLabel)}</span>
                <span class="level-card-status">${this._escapeHtml(this._resolveLevelStatusLabel(level))}</span>
            </div>
            <h4>${this._escapeHtml(level.name || level.id)}</h4>
            ${levelDesc ? `<p class="level-card-desc">${this._escapeHtml(levelDesc)}</p>` : ''}
            ${metaHtml ? `<div class="level-chip-row level-card-meta-row">${metaHtml}</div>` : ''}
            ${rewardHtml ? `<div class="level-chip-row level-card-reward-row">${rewardHtml}</div>` : ''}
        `;

        if (level.isUnlocked === false) {
            card.disabled = true;
            card.setAttribute('aria-disabled', 'true');
            return card;
        }

        card.onclick = () => {
            console.log(`[UI_SystemModal] Level card clicked: ${level.id}`);
            if (this.engine.input && this.engine.input.selectLevel) {
                this.engine.input.selectLevel(level.id);
            } else {
                console.error('[UI_SystemModal] engine.input.selectLevel is missing!');
            }
        };
        return card;
    }

    _renderLevelCardsView(levels, options = {}) {
        const {
            view = 'LEVEL_SELECT',
            title = '选择关卡',
            emptyText = '暂无可用关卡',
            backLabel = '返回游戏菜单',
            overview = null
        } = options;

        this.currentView = view;
        this.setTitle(title);
        this.clearContent();
        this._setCloseButtonState({
            visible: this._canResumeBattle(),
            label: '关闭并返回战斗'
        });

        if (!Array.isArray(levels) || levels.length === 0) {
            const empty = document.createElement('p');
            empty.style.textAlign = 'center';
            empty.style.color = '#888';
            empty.textContent = emptyText;
            this.dom.body.appendChild(empty);
            this.renderFooterBackBtn(backLabel, () => this.openMainMenu());
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'level-grid';
        levels.forEach(lvl => {
            grid.appendChild(this._createLevelCard(lvl));
        });

        if (view === 'LEVEL_SELECT') {
            const layout = document.createElement('div');
            layout.className = 'level-select-layout';

            const listPanel = document.createElement('section');
            listPanel.className = 'level-list-panel';
            const listHeader = document.createElement('div');
            listHeader.className = 'level-list-header';
            listHeader.innerHTML = `
                <div>
                    <div class="level-list-kicker">关卡</div>
                    <div class="level-list-title">当前章节</div>
                </div>
                <span class="level-list-count">${this._escapeHtml(levels.filter(level => level.isUnlocked !== false).length)} / ${this._escapeHtml(levels.length)} 可选</span>
            `;
            listPanel.appendChild(listHeader);
            listPanel.appendChild(grid);
            layout.appendChild(listPanel);

            const overviewSection = this._buildLevelSelectOverviewSection(overview, levels);
            if (overviewSection instanceof HTMLElement) {
                layout.appendChild(overviewSection);
            }
            this.dom.body.appendChild(layout);
        } else {
            this.dom.body.appendChild(grid);
        }

        this.renderFooterBackBtn(backLabel, () => this.openMainMenu());
    }

    _buildLevelSelectOverviewSection(overview, levels = []) {
        const firstLevel = Array.isArray(levels) ? levels[0] : null;
        const firstFlow = this._getLevelFlow(firstLevel);
        const fallbackNodes = Array.isArray(levels)
            ? levels.map(level => ({
                id: level?.id,
                name: level?.name || level?.id,
                nodeLabel: this._getLevelFlow(level).nodeLabel || '',
                status: this._resolveLevelStatus(level)
            }))
            : [];
        const data = (overview && typeof overview === 'object') ? overview : {
            chapterLabel: firstFlow.chapterLabel || '',
            chapterTitle: firstFlow.chapterTitle || '故事推进',
            completedCount: fallbackNodes.filter(node => node.status === 'completed').length,
            totalCount: fallbackNodes.length,
            unlockedCount: fallbackNodes.filter(node => node.status !== 'locked').length,
            recommendedLevelName: firstLevel?.name || '',
            currentNodeLabel: firstFlow.nodeLabel || '',
            currentObjectiveText: firstFlow.objectiveText || '',
            nextLockedLevelName: '',
            chapterNodes: fallbackNodes
        };

        const section = document.createElement('section');
        section.className = 'level-select-map-slot story-progress-panel summary-section summary-section--story-progress';
        section.dataset.summaryKind = 'story-progress';
        const heading = [data.chapterLabel, data.chapterTitle].filter(Boolean).join(' · ');
        const recommendedText = data.recommendedLevelName
            ? `${data.currentNodeLabel ? `${data.currentNodeLabel} ` : ''}${data.recommendedLevelName}`
            : '当前章节已无未完成节点';
        const nextUnlockText = data.nextLockedLevelName
            ? `后续解锁：${data.nextLockedLevelName}`
            : '后续解锁：当前章节已全部可见';
        const nodeChipsHtml = Array.isArray(data.chapterNodes)
            ? data.chapterNodes
                .map(node => {
                    const labelParts = [node?.nodeLabel, node?.name].filter(Boolean);
                    const statusClass = typeof node?.status === 'string' ? node.status : 'locked';
                    return `<span class="story-progress-node is-${this._escapeHtml(statusClass)}">${this._escapeHtml(labelParts.join(' '))}</span>`;
                })
                .join('')
            : '';

        section.innerHTML = `
            <div class="story-progress-eyebrow">章节地图</div>
            <h3>${this._escapeHtml(heading || '故事推进')}</h3>
            <div class="story-progress-metrics">
                <span class="story-progress-metric">已完成 ${this._escapeHtml(data.completedCount)} / ${this._escapeHtml(data.totalCount)}</span>
                <span class="story-progress-metric">已解锁 ${this._escapeHtml(data.unlockedCount)} / ${this._escapeHtml(data.totalCount)}</span>
            </div>
            <div class="story-progress-focus">
                <div class="story-progress-focus-title">当前推荐</div>
                <div class="story-progress-focus-value">${this._escapeHtml(recommendedText)}</div>
                <p class="story-progress-focus-hint">${this._escapeHtml(data.currentObjectiveText || '')}</p>
                <div class="story-progress-focus-next">${this._escapeHtml(nextUnlockText)}</div>
            </div>
            ${nodeChipsHtml ? `<div class="story-map-track">${nodeChipsHtml}</div>` : ''}
        `;
        return section;
    }

    /**
     * 渲染关卡选择视图
     */
    renderLevelSelect() {
        console.log('[UI_SystemModal] Rendering Level Select');
        // 获取关卡数据 (假设 DataManager 有同步接口，或者通过 Engine 获取)
        let levels = [];
        let overview = null;
        // 修正：CoreEngine 中挂载的是 this.data
        if (this.engine.data && this.engine.data.getLevelSelectEntries) {
            levels = this.engine.data.getLevelSelectEntries();
            console.log('[UI_SystemModal] Loaded selectable levels from DataManager:', levels);
            if (this.engine.data.getLevelSelectOverview) {
                overview = this.engine.data.getLevelSelectOverview();
            }
        } else if (this.engine.data && this.engine.data.getLevels) {
            levels = this.engine.data.getLevels().map(level => ({
                ...level,
                isUnlocked: true,
                isCompleted: false
            }));
            console.log('[UI_SystemModal] Loaded levels from DataManager:', levels);
        } else {
            console.warn('[UI_SystemModal] DataManager not found or getLevels missing. Using mock data.');
            // Fallback / Mock data
             levels = [
                { id: '1-1', name: '森林边缘', desc: 'Lv.1 - 史莱姆', isUnlocked: true, isCompleted: false },
                { id: '1-2', name: '幽暗密林', desc: 'Lv.3 - 狼群', isUnlocked: false, isCompleted: false }
            ];
        }

        this._renderLevelCardsView(levels, {
            view: 'LEVEL_SELECT',
            title: '选择关卡',
            backLabel: '返回游戏菜单',
            emptyText: '暂无可用关卡',
            overview
        });
    }

    renderAcceptanceLevelSelect() {
        console.log('[UI_SystemModal] Rendering Acceptance Level Select');
        const levels = (this.engine.data && this.engine.data.getAcceptanceLevelSelectEntries)
            ? this.engine.data.getAcceptanceLevelSelectEntries()
            : [];
        console.log('[UI_SystemModal] Loaded acceptance levels from DataManager:', levels);

        this._renderLevelCardsView(levels, {
            view: 'ACCEPTANCE_LEVEL_SELECT',
            title: '选择验收样本',
            backLabel: '返回游戏菜单',
            emptyText: '当前没有可用的验收样本'
        });
    }

    /**
     * 渲染存档/读档视图
     * @param {Array} [saveList] - 可选的存档列表数据，若不传则尝试获取
     */
    renderSaveLoad(saveList, statusMessage = '', options = {}) {
        console.log('[UI_SystemModal] Rendering Save/Load');
        this.currentView = 'SAVE_LOAD';
        this.saveLoadStatusMessage = statusMessage || '';
        this.saveLoadReturnView = options.returnView || this.saveLoadReturnView || 'MAIN_MENU';
        this.saveLoadTitle = options.title || this.saveLoadTitle || '存档 / 读档';
        this.setTitle(this.saveLoadTitle);
        this.clearContent();
        this._setCloseButtonState({
            visible: this._canResumeBattle(),
            label: '关闭并返回战斗'
        });

        const returnMeta = this._getReturnViewMeta(this.saveLoadReturnView);

        const slots = saveList || (this.engine.data && this.engine.data.getSaveList ? this.engine.data.getSaveList() : [
            { id: 'auto', slotType: 'auto', title: '自动存档', date: '空', level: '-', turn: '-', isEmpty: true },
            { id: 1, slotType: 'manual', title: '手动槽位 1', date: '空', level: '-', turn: '-', isEmpty: true },
            { id: 2, slotType: 'manual', title: '手动槽位 2', date: '空', level: '-', turn: '-', isEmpty: true },
            { id: 3, slotType: 'manual', title: '手动槽位 3', date: '空', level: '-', turn: '-', isEmpty: true }
        ]);

        if (this.saveLoadStatusMessage) {
            const status = document.createElement('div');
            status.className = 'save-load-status';
            status.textContent = this.saveLoadStatusMessage;
            status.style.marginBottom = '12px';
            status.style.padding = '10px 12px';
            status.style.borderRadius = '8px';
            status.style.background = 'rgba(124,245,217,0.12)';
            status.style.border = '1px solid rgba(124,245,217,0.28)';
            status.style.color = '#dffef6';
            status.style.fontSize = '0.92rem';
            this.dom.body.appendChild(status);
        }

        slots.forEach(slot => {
            const el = document.createElement('div');
            el.className = 'save-slot';
            const isAutoSlot = slot?.slotType === 'auto' || slot?.id === 'auto';
            const slotTitle = slot?.title || (isAutoSlot ? '自动存档' : `手动槽位 ${slot.id}`);

            const info = document.createElement('div');
            info.className = 'save-slot-info';
            const turnSuffix = slot.turn !== undefined && slot.turn !== null && slot.turn !== '-'
                ? ` | 回合: ${slot.turn}`
                : '';
            info.innerHTML = `<h4>${slotTitle}</h4><div class="save-slot-meta">${slot.date} | 关卡: ${slot.level}${turnSuffix}</div>`;

            const actions = document.createElement('div');
            actions.className = 'slot-actions';

            if (!isAutoSlot) {
                const saveBtn = document.createElement('button');
                saveBtn.className = 'btn-primary';
                saveBtn.textContent = '保存';
                saveBtn.onclick = () => {
                    if (this.engine.input && this.engine.input.saveGame) {
                        this.engine.input.saveGame(slot.id);
                    }
                    // 保存后通常会触发 DATA_UPDATE，从而刷新列表
                };
                actions.appendChild(saveBtn);
            }

            const loadBtn = document.createElement('button');
            loadBtn.className = 'btn-primary';
            loadBtn.textContent = '读取';
            loadBtn.disabled = slot.isEmpty === true || slot.date === '空';
            loadBtn.onclick = () => {
                if (this.engine.input && this.engine.input.loadGame) {
                    this.engine.input.loadGame(slot.id);
                }
                // 不再手动 hide，等待引擎状态变更或事件
            };

            actions.appendChild(loadBtn);

            el.appendChild(info);
            el.appendChild(actions);
            this.dom.body.appendChild(el);
        });

        this.renderFooterBackBtn(returnMeta.label, () => {
            if (this.saveLoadReturnView === 'LOGIN') {
                this.renderLogin();
                return;
            }
            this.openMainMenu();
        });
    }

    /**
     * 渲染设置视图
     */
    renderSettings() {
        console.log('[UI_SystemModal] Rendering Settings');
        this.currentView = 'SETTINGS';
        this.setTitle('设置');
        this.clearContent();
        this._setCloseButtonState({
            visible: this._canResumeBattle(),
            label: '关闭并返回战斗'
        });

        const placeholder = document.createElement('p');
        placeholder.style.textAlign = 'center';
        placeholder.style.color = '#888';
        placeholder.textContent = '暂无可调整选项';
        this.dom.body.appendChild(placeholder);
        
        this.renderFooterBackBtn('返回游戏菜单', () => this.openMainMenu());
    }

    // --- Helper Methods ---

    setTitle(text) {
        if (this.dom.title) this.dom.title.textContent = text;
    }

    clearContent() {
        if (!this.dom.body) return;
        this.dom.body.innerHTML = '';
        const isLevelSelect = this.currentView === 'LEVEL_SELECT';
        this.dom.body.classList.toggle('modal-body--level-select', isLevelSelect);
        this.dom.panel?.classList.toggle('modal-panel--level-select', isLevelSelect);
        this.dom.backdrop?.classList.toggle('modal-backdrop--level-select', isLevelSelect);
    }

    clearFooter() {
        if (this.dom.footer) this.dom.footer.innerHTML = '';
    }

    _canResumeBattle() {
        const isInBattle = this.engine?.fsm && (
            this.engine.fsm.currentState === 'BATTLE_LOOP'
            || this.engine.fsm.currentState === 'BATTLE_PREPARE'
        );
        const hasSavedBattle = this.engine?.data?.dataConfig?.runtime?.levelData;
        return Boolean(isInBattle || hasSavedBattle);
    }

    _setCloseButtonState({ visible, label = '' } = {}) {
        if (!this.dom.closeBtn) return;
        this.dom.closeBtn.style.display = visible ? '' : 'none';
        if (visible && label) {
            this.dom.closeBtn.setAttribute('aria-label', label);
            this.dom.closeBtn.setAttribute('title', label);
        } else {
            this.dom.closeBtn.removeAttribute('aria-label');
            this.dom.closeBtn.removeAttribute('title');
        }
    }

    _getReturnViewMeta(returnView) {
        if (returnView === 'LOGIN') {
            return {
                label: '返回欢迎页'
            };
        }

        return {
            label: '返回游戏菜单'
        };
    }

    renderFooterBackBtn(label, callback) {
        this.clearFooter();
        if (!this.dom.footer) return;

        const backBtn = document.createElement('button');
        backBtn.className = 'btn-primary';
        backBtn.textContent = label;
        backBtn.onclick = callback;
        this.dom.footer.appendChild(backBtn);
    }
}
