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
        if (this.dom.closeBtn) this.dom.closeBtn.style.display = 'none';

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
        }

        const settlementFeedback = this._describeSettlementProgressFeedback(settlement);
        if (settlementFeedback) {
            const feedbackPanel = document.createElement('div');
            feedbackPanel.style.width = '100%';
            feedbackPanel.style.maxWidth = '420px';
            feedbackPanel.style.padding = '14px 16px';
            feedbackPanel.style.border = '1px solid rgba(124,245,217,0.2)';
            feedbackPanel.style.borderRadius = '8px';
            feedbackPanel.style.background = 'rgba(10, 16, 29, 0.9)';

            const feedbackTitle = document.createElement('div');
            feedbackTitle.style.fontSize = '0.92rem';
            feedbackTitle.style.fontWeight = '700';
            feedbackTitle.style.marginBottom = '8px';
            feedbackTitle.textContent = settlementFeedback.label;

            const feedbackText = document.createElement('p');
            feedbackText.style.margin = '0';
            feedbackText.style.fontSize = '0.9rem';
            feedbackText.style.lineHeight = '1.6';
            feedbackText.style.color = '#dfe7ff';
            feedbackText.textContent = settlementFeedback.text;

            feedbackPanel.appendChild(feedbackTitle);
            feedbackPanel.appendChild(feedbackText);
            container.appendChild(feedbackPanel);
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
        if (this.dom.closeBtn) this.dom.closeBtn.style.display = 'none';

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '20px';
        container.style.padding = '40px';
        container.style.alignItems = 'center';

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
        tip.textContent = hasAnySave
            ? '“新游戏”会创建新的自动存档；“读取存档”用于读取自动存档或手动槽位。'
            : '当前没有可读取的本地存档，请先创建新游戏。';

        container.appendChild(input);
        actionRow.appendChild(newGameBtn);
        actionRow.appendChild(loadBtn);
        container.appendChild(actionRow);
        container.appendChild(tip);
        this.dom.body.appendChild(container);
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

        // 关卡选择页需要在学习后立即刷新关前构筑摘要
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
        if (this.dom.backdrop) {
            this.dom.backdrop.classList.remove('visible');
            this.dom.backdrop.hidden = true;
            this.dom.backdrop.setAttribute('aria-hidden', 'true');
        }
        this.currentView = null;
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
        const isInBattle = this.engine.fsm && (this.engine.fsm.currentState === 'BATTLE_LOOP' || this.engine.fsm.currentState === 'BATTLE_PREPARE');
        const hasSavedBattle = this.engine.data && this.engine.data.dataConfig && this.engine.data.dataConfig.runtime && this.engine.data.dataConfig.runtime.levelData;
        const canResume = isInBattle || hasSavedBattle;

        // 如果不能返回战斗，隐藏关闭按钮
        if (this.dom.closeBtn) {
            this.dom.closeBtn.style.display = canResume ? '' : 'none';
        }

        const menu = document.createElement('div');
        menu.className = 'menu-list';
        const growthSummary = this._buildMainMenuGrowthSummary();

        const items = [];
        const acceptanceEntries = (this.engine.data && this.engine.data.getAcceptanceLevelSelectEntries)
            ? this.engine.data.getAcceptanceLevelSelectEntries()
            : [];

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
            ...(acceptanceEntries.length > 0 ? [{
                label: '验收样本',
                action: () => this.renderAcceptanceLevelSelect()
            }] : []),
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

        if (growthSummary) {
            this.dom.body.appendChild(growthSummary);
        }
        this.dom.body.appendChild(menu);
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
        summary.className = 'menu-growth-summary';
        summary.style.padding = '14px 16px';
        summary.style.marginBottom = '14px';
        summary.style.borderRadius = '10px';
        summary.style.border = '1px solid rgba(124, 245, 217, 0.25)';
        summary.style.background = 'rgba(18, 23, 38, 0.92)';
        summary.style.color = '#dfe7ff';

        const title = document.createElement('div');
        title.textContent = '成长摘要';
        title.style.fontSize = '0.96rem';
        title.style.fontWeight = '700';
        title.style.marginBottom = '8px';

        const tip = document.createElement('p');
        tip.textContent = '在进入关卡前先确认当前知识点和已学技能，再决定这局要走什么构筑方向。';
        tip.style.margin = '0 0 12px';
        tip.style.fontSize = '0.88rem';
        tip.style.lineHeight = '1.5';
        tip.style.color = '#cfe8ff';

        const statGrid = document.createElement('div');
        statGrid.style.display = 'grid';
        statGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(140px, 1fr))';
        statGrid.style.gap = '10px';

        const createStatCard = (label, value) => {
            const card = document.createElement('div');
            card.style.padding = '10px 12px';
            card.style.borderRadius = '8px';
            card.style.background = 'rgba(255, 255, 255, 0.04)';
            card.style.border = '1px solid rgba(255, 255, 255, 0.05)';

            const labelEl = document.createElement('div');
            labelEl.textContent = label;
            labelEl.style.fontSize = '0.8rem';
            labelEl.style.color = '#8fb0d6';
            labelEl.style.marginBottom = '4px';

            const valueEl = document.createElement('div');
            valueEl.textContent = value;
            valueEl.style.fontSize = '1.1rem';
            valueEl.style.fontWeight = '700';

            card.appendChild(labelEl);
            card.appendChild(valueEl);
            return card;
        };

        statGrid.appendChild(createStatCard('知识点 KP', Number.isFinite(skillPoints) ? String(skillPoints) : '0'));
        statGrid.appendChild(createStatCard('已学技能', String(learned.length)));

        summary.appendChild(title);
        summary.appendChild(tip);
        summary.appendChild(statGrid);

        const detailStack = document.createElement('div');
        detailStack.style.display = 'grid';
        detailStack.style.gap = '10px';
        detailStack.style.marginTop = '12px';

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
        card.style.padding = '10px 12px';
        card.style.borderRadius = '8px';
        card.style.background = 'rgba(255, 255, 255, 0.04)';
        card.style.border = '1px solid rgba(255, 255, 255, 0.05)';

        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        labelEl.style.fontSize = '0.8rem';
        labelEl.style.color = '#8fb0d6';
        labelEl.style.marginBottom = '4px';

        const valueEl = document.createElement('div');
        valueEl.textContent = text;
        valueEl.style.fontSize = '0.9rem';
        valueEl.style.lineHeight = '1.6';
        valueEl.style.color = '#dfe7ff';

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

    _buildPreBattleBuildSummaryData() {
        const playerSkills = this.engine?.data?.playerData?.skills;
        const progress = this.engine?.data?.dataConfig?.global?.progress;
        const learnedSkillIds = Array.isArray(playerSkills?.learned)
            ? playerSkills.learned.filter(skillId => typeof skillId === 'string' && skillId.trim().length > 0)
            : [];
        const learnedSkillNames = learnedSkillIds.map(skillId => this._resolveSkillDisplayName(skillId));
        const previewNames = learnedSkillNames.slice(0, 4).filter(Boolean);
        const remainingCount = Math.max(0, learnedSkillNames.length - previewNames.length);

        const lastLearnAction = (progress && typeof progress.lastLearnAction === 'object')
            ? progress.lastLearnAction
            : null;
        const recentSkillIds = Array.isArray(lastLearnAction?.learnedSkillIds)
            ? lastLearnAction.learnedSkillIds.filter(skillId => typeof skillId === 'string' && skillId.trim().length > 0)
            : [];
        const recentSkillNames = Array.isArray(lastLearnAction?.learnedSkillNames)
            ? lastLearnAction.learnedSkillNames
                .filter(name => typeof name === 'string' && name.trim().length > 0)
                .map(name => name.trim())
            : [];
        const resolvedRecentNames = recentSkillNames.length > 0
            ? recentSkillNames
            : recentSkillIds.map(skillId => this._resolveSkillDisplayName(skillId)).filter(Boolean);

        return {
            skillPoints: Number.isFinite(playerSkills?.skillPoints) ? Number(playerSkills.skillPoints) : 0,
            learnedSkillIds,
            learnedSkillNames,
            totalCount: learnedSkillIds.length,
            previewNames,
            remainingCount,
            lastLearnAction,
            recentSkillNames: resolvedRecentNames
        };
    }

    _buildPreBattleBuildSummarySection() {
        const summaryData = this._buildPreBattleBuildSummaryData();
        const section = document.createElement('section');
        section.className = 'prebattle-build-summary';
        section.style.padding = '14px 16px';
        section.style.marginBottom = '16px';
        section.style.borderRadius = '10px';
        section.style.border = '1px solid rgba(124, 245, 217, 0.25)';
        section.style.background = 'rgba(18, 23, 38, 0.92)';
        section.style.color = '#dfe7ff';

        const title = document.createElement('div');
        title.textContent = '关前构筑摘要';
        title.style.fontSize = '0.96rem';
        title.style.fontWeight = '700';
        title.style.marginBottom = '8px';

        const tip = document.createElement('p');
        tip.textContent = '当前版本会在进入本局时自动带入全部已学技能；这里的重点是先确认当前技能池和最近学习带来的新增差异。';
        tip.style.margin = '0 0 12px';
        tip.style.fontSize = '0.88rem';
        tip.style.lineHeight = '1.6';
        tip.style.color = '#cfe8ff';

        const detailStack = document.createElement('div');
        detailStack.style.display = 'grid';
        detailStack.style.gap = '10px';

        const skillPoolText = summaryData.previewNames.length > 0
            ? `${summaryData.totalCount} 项：${summaryData.previewNames.join('、')}${summaryData.remainingCount > 0 ? ` 等 ${summaryData.totalCount} 项` : ''}`
            : `${summaryData.totalCount} 项`;

        detailStack.appendChild(this._createGrowthSummaryDetail(
            '当前技能池',
            skillPoolText
        ));
        detailStack.appendChild(this._createGrowthSummaryDetail(
            '预装配说明',
            '本版本无单独预装配步骤，进入关卡后会自动带入全部已学技能。'
        ));
        detailStack.appendChild(this._createGrowthSummaryDetail(
            '最近学习带来的技能池差异',
            this._describePreBattleSkillDiff(summaryData)
        ));

        section.appendChild(title);
        section.appendChild(tip);
        section.appendChild(detailStack);
        return section;
    }

    _describePreBattleSkillDiff(summaryData) {
        const data = (summaryData && typeof summaryData === 'object') ? summaryData : this._buildPreBattleBuildSummaryData();
        const recentNames = Array.isArray(data.recentSkillNames) ? data.recentSkillNames.filter(Boolean) : [];
        const spentKp = Number.isFinite(data?.lastLearnAction?.spentKp) ? Number(data.lastLearnAction.spentKp) : 0;
        const remainingKp = Number.isFinite(data?.lastLearnAction?.remainingKp) ? Number(data.lastLearnAction.remainingKp) : 0;

        if (recentNames.length === 0) {
            return '暂无最近学习差异；当前技能池会直接沿用全部已学技能。';
        }

        return `最近学习新增：${recentNames.join('、')}。本轮无额外预装配步骤，进入关卡后即可在技能池中使用；本次学习消耗 ${spentKp} KP，剩余 ${remainingKp} KP。`;
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

    _buildLevelCardExtraHtml(level) {
        const flow = (level && typeof level.flow === 'object' && level.flow)
            ? level.flow
            : null;
        const selectionMeta = (level && typeof level.selectionMeta === 'object' && level.selectionMeta)
            ? level.selectionMeta
            : null;
        const progression = (level && typeof level.progression === 'object' && level.progression)
            ? level.progression
            : null;
        const rewardPreview = this._buildLevelRewardPreview(level?.rewards);
        const sections = [];

        if (flow?.chapterLabel || flow?.chapterTitle || flow?.nodeLabel) {
            const chapterParts = [flow.chapterLabel, flow.chapterTitle, flow.nodeLabel].filter(Boolean);
            sections.push(`
                <div class="level-card-block">
                    <div class="level-card-block-title">章节节点</div>
                    <div class="level-card-inline">${this._escapeHtml(chapterParts.join(' · '))}</div>
                </div>
            `);
        }

        if (progression?.stateLabel || progression?.unlockHint) {
            sections.push(`
                <div class="level-card-block">
                    <div class="level-card-block-title">推进关系</div>
                    ${progression?.stateLabel ? `<div class="level-card-inline">${this._escapeHtml(progression.stateLabel)}</div>` : ''}
                    ${progression?.unlockHint ? `<p class="level-card-hint">${this._escapeHtml(progression.unlockHint)}</p>` : ''}
                </div>
            `);
        }

        if (selectionMeta?.difficultyLabel) {
            sections.push(`
                <div class="level-card-block">
                    <div class="level-card-block-title">难度</div>
                    <div class="level-card-inline">${this._escapeHtml(selectionMeta.difficultyLabel)}</div>
                </div>
            `);
        }

        if (Array.isArray(selectionMeta?.enemyStyleTags) && selectionMeta.enemyStyleTags.length > 0) {
            const tagsHtml = selectionMeta.enemyStyleTags
                .map(tag => `<span class="level-chip">${this._escapeHtml(tag)}</span>`)
                .join('');
            sections.push(`
                <div class="level-card-block">
                    <div class="level-card-block-title">敌人风格</div>
                    <div class="level-chip-row">${tagsHtml}</div>
                </div>
            `);
        }

        if (rewardPreview.length > 0) {
            const rewardsHtml = rewardPreview
                .map(([label, value]) => `<span class="level-chip level-chip-reward">${label} ${this._escapeHtml(value)}</span>`)
                .join('');
            sections.push(`
                <div class="level-card-block">
                    <div class="level-card-block-title">奖励预览</div>
                    <div class="level-chip-row">${rewardsHtml}</div>
                </div>
            `);
        }

        if (level?.clearFeedback) {
            const clearFeedback = level.clearFeedback;
            const modeText = clearFeedback.currentMode === 'repeat' ? '当前已进入重复通关阶段' : '当前仍处于首次通关阶段';
            sections.push(`
                <div class="level-card-block">
                    <div class="level-card-block-title">首次通关反馈</div>
                    <p class="level-card-hint">${this._escapeHtml(clearFeedback.firstClearText || '首次通关会更新章节推进。')}</p>
                </div>
                <div class="level-card-block">
                    <div class="level-card-block-title">重复通关收益</div>
                    <p class="level-card-hint">${this._escapeHtml(clearFeedback.repeatClearText || '重复通关仍获得常规资源奖励。')}</p>
                    <div class="level-card-inline" style="margin-top:8px;">${this._escapeHtml(modeText)}</div>
                </div>
            `);
        }

        if (selectionMeta?.buildHint) {
            sections.push(`
                <div class="level-card-block">
                    <div class="level-card-block-title">构筑提示</div>
                    <p class="level-card-hint">${this._escapeHtml(selectionMeta.buildHint)}</p>
                </div>
            `);
        }

        return sections.length > 0
            ? `<div class="level-card-extra">${sections.join('')}</div>`
            : '';
    }

    _buildLevelSelectOverviewSection(overview) {
        const data = (overview && typeof overview === 'object') ? overview : null;
        if (!data) return null;

        const section = document.createElement('section');
        section.className = 'story-progress-panel';
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
            <div class="story-progress-eyebrow">章节推进总览</div>
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
            ${nodeChipsHtml ? `<div class="story-progress-node-row">${nodeChipsHtml}</div>` : ''}
        `;
        return section;
    }

    _renderLevelCardsView(levels, options = {}) {
        const {
            view = 'LEVEL_SELECT',
            title = '选择关卡',
            introText = '',
            emptyText = '暂无可用关卡',
            buildSummary = null,
            overview = null
        } = options;

        this.currentView = view;
        this.setTitle(title);
        this.clearContent();

        if (introText) {
            const hint = document.createElement('p');
            hint.style.margin = '0 0 16px';
            hint.style.color = '#cfe8ff';
            hint.style.fontSize = '0.92rem';
            hint.style.whiteSpace = 'pre-line';
            hint.textContent = introText;
            this.dom.body.appendChild(hint);
        }

        const overviewSection = this._buildLevelSelectOverviewSection(overview);
        if (overviewSection instanceof HTMLElement) {
            this.dom.body.appendChild(overviewSection);
        }

        if (buildSummary instanceof HTMLElement) {
            this.dom.body.appendChild(buildSummary);
        }

        if (!Array.isArray(levels) || levels.length === 0) {
            const empty = document.createElement('p');
            empty.style.textAlign = 'center';
            empty.style.color = '#888';
            empty.textContent = emptyText;
            this.dom.body.appendChild(empty);
            this.renderFooterBackBtn(() => this.openMainMenu());
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'level-grid';

        levels.forEach(lvl => {
            const card = document.createElement('div');
            card.className = 'level-card';
            const levelDesc = lvl.description || lvl.desc || 'No description';
            const stateTags = [];
            if (lvl.isCompleted) stateTags.push('已完成');
            if (lvl.isUnlocked === false) stateTags.push('未解锁');
            const stateLine = stateTags.length > 0
                ? `<div class="level-card-state" style="margin-top:8px; font-size:0.82rem; color:${lvl.isUnlocked === false ? '#ff9dbb' : '#7cf5d9'};">${stateTags.join(' · ')}</div>`
                : '';
            const extraHtml = this._buildLevelCardExtraHtml(lvl);
            card.innerHTML = `
                <h4>${this._escapeHtml(lvl.name || lvl.id)}</h4>
                <p>${this._escapeHtml(levelDesc)}</p>
                ${stateLine}
                ${extraHtml}
            `;

            if (lvl.isUnlocked === false) {
                card.setAttribute('aria-disabled', 'true');
                card.style.opacity = '0.55';
                card.style.cursor = 'not-allowed';
                card.onclick = () => {
                    console.warn(`[UI_SystemModal] Level card is locked: ${lvl.id}`);
                };
                grid.appendChild(card);
                return;
            }

            card.onclick = () => {
                console.log(`[UI_SystemModal] Level card clicked: ${lvl.id}`);
                if (this.engine.input && this.engine.input.selectLevel) {
                    this.engine.input.selectLevel(lvl.id);
                } else {
                    console.error('[UI_SystemModal] engine.input.selectLevel is missing!');
                }
            };
            grid.appendChild(card);
        });

        this.dom.body.appendChild(grid);
        this.renderFooterBackBtn(() => this.openMainMenu());
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
            emptyText: '暂无可用关卡',
            overview,
            buildSummary: this._buildPreBattleBuildSummarySection()
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
            introText: [
                '本页用于人工验收样本，不影响故事推进。',
                '敌人行为样本建议优先不部署攻击技能，或只部署“等待”，再提交规划并执行。',
                '修甲 / 回血 / 弱点追击分别对应：先补残甲、先回低血量、先压迫玩家头部弱点。',
                '这些样本是对 story 关卡敌人行为的稳定复核入口，不替代正常推进。'
            ].join('\n'),
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

        this.renderFooterBackBtn(() => {
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
        
        this.dom.body.innerHTML = '<p style="text-align:center; color:#888;">设置功能开发中...</p>';
        
        this.renderFooterBackBtn(() => this.openMainMenu());
    }

    // --- Helper Methods ---

    setTitle(text) {
        if (this.dom.title) this.dom.title.textContent = text;
    }

    clearContent() {
        if (this.dom.body) this.dom.body.innerHTML = '';
    }

    clearFooter() {
        if (this.dom.footer) this.dom.footer.innerHTML = '';
    }

    renderFooterBackBtn(callback) {
        this.clearFooter();
        if (!this.dom.footer) return;

        const backBtn = document.createElement('button');
        backBtn.className = 'btn-primary';
        backBtn.textContent = '返回';
        backBtn.onclick = callback;
        this.dom.footer.appendChild(backBtn);
    }
}
