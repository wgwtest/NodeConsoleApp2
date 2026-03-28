/**
 * @file UI_SystemModal.js
 * @description 系统模态窗口 UI 组件，负责主菜单、关卡选择、存档读档等界面的显示与交互。
 * 遵循 UI_design.md 中的接口规范与代码规范。
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

        const btn = document.createElement('button');
        btn.className = 'btn-primary';
        btn.textContent = '返回主菜单';
        btn.style.padding = '10px 30px';
        btn.style.fontSize = '1.2rem';
        btn.style.marginTop = '20px';
        btn.style.cursor = 'pointer';
        /* 简单样，实际应使用 CSS 类 */
        btn.style.background = '#1f2440';
        btn.style.color = '#fff';
        btn.style.border = '1px solid #7cf5d9';
        btn.style.borderRadius = '4px';
        
        btn.onclick = () => {
            if (this.engine.input && this.engine.input.confirmSettlement) {
                this.engine.input.confirmSettlement();
            }
        };

        container.appendChild(message);
        container.appendChild(subMsg);
        container.appendChild(btn);
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

        const btn = document.createElement('button');
        btn.className = 'btn-primary'; // 假设 CSS 中有此样式，或者复用 menu-btn
        btn.textContent = '开始冒险';
        btn.style.padding = '10px 30px';
        btn.style.fontSize = '1.2rem';
        btn.style.cursor = 'pointer';
        
        btn.onclick = () => {
            const username = input.value.trim();
            if (username && this.engine.input && this.engine.input.login) {
                this.engine.input.login(username);
            }
        };

        container.appendChild(input);
        container.appendChild(btn);
        this.dom.body.appendChild(container);
    }

    /**
     * 处理数据更新事件
     * @param {Object} updateData - { type, data }
     */
    handleDataUpdate(updateData) {
        const { type, data } = updateData;
        console.log(`[UI_SystemModal] Data update received: ${type}`);

        // 如果当前正在显示存档/读档界面，且收到了存档列表更新
        if (this.currentView === 'SAVE_LOAD' && type === 'SAVE_LIST') {
            this.renderSaveLoad(data);
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

        // 检查是否可以继续游戏（在战斗中，或有存档）
        const isInBattle = this.engine.fsm && (this.engine.fsm.currentState === 'BATTLE_LOOP' || this.engine.fsm.currentState === 'BATTLE_PREPARE');
        const hasSavedBattle = this.engine.data && this.engine.data.dataConfig && this.engine.data.dataConfig.runtime && this.engine.data.dataConfig.runtime.levelData;
        const canResume = isInBattle || hasSavedBattle;

        // 如果不能继续游戏，隐藏关闭按钮
        if (this.dom.closeBtn) {
            this.dom.closeBtn.style.display = canResume ? '' : 'none';
        }

        const menu = document.createElement('div');
        menu.className = 'menu-list';

        const items = [];

        if (canResume) {
            items.push({ label: '继续游戏', action: () => this.handleClose() });
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
            { label: '存档 / 读档', action: () => this.renderSaveLoad() },
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
        this.clearFooter(); // 主菜单通常不需要 Footer 按钮
    }

    /**
     * 渲染关卡选择视图
     */
    renderLevelSelect() {
        console.log('[UI_SystemModal] Rendering Level Select');
        this.currentView = 'LEVEL_SELECT';
        this.setTitle('选择关卡');
        this.clearContent();

        // 获取关卡数据 (假设 DataManager 有同步接口，或者通过 Engine 获取)
        let levels = [];
        // 修正：CoreEngine 中挂载的是 this.data
        if (this.engine.data && this.engine.data.getLevels) {
            levels = this.engine.data.getLevels();
            console.log('[UI_SystemModal] Loaded levels from DataManager:', levels);
        } else {
            console.warn('[UI_SystemModal] DataManager not found or getLevels missing. Using mock data.');
            // Fallback / Mock data
             levels = [
                { id: '1-1', name: '森林边缘', desc: 'Lv.1 - 史莱姆' },
                { id: '1-2', name: '幽暗密林', desc: 'Lv.3 - 狼群' }
            ];
        }

        if (levels.length === 0) {
            this.dom.body.innerHTML = '<p style="text-align:center; color:#888;">暂无可用关卡</p>';
        } else {
            const grid = document.createElement('div');
            grid.className = 'level-grid';
    
            levels.forEach(lvl => {
                const card = document.createElement('div');
                card.className = 'level-card';
                const levelDesc = lvl.description || lvl.desc || 'No description';
                // 假设 lvl 对象结构符合 UI 需求
                card.innerHTML = `<h4>${lvl.name || lvl.id}</h4><p>${levelDesc}</p>`;
                card.onclick = () => {
                    console.log(`[UI_SystemModal] Level card clicked: ${lvl.id}`);
                    if (this.engine.input && this.engine.input.selectLevel) {
                        this.engine.input.selectLevel(lvl.id);
                    } else {
                        console.error('[UI_SystemModal] engine.input.selectLevel is missing!');
                    }
                    // 注意：不需要手动 hide，因为 selectLevel 会触发 STATE_CHANGED -> BATTLE_PREPARE，从而触发 hide
                };
                grid.appendChild(card);
            });
    
            this.dom.body.appendChild(grid);
        }

        // Footer: 返回按钮
        this.renderFooterBackBtn(() => this.openMainMenu());
    }

    /**
     * 渲染存档/读档视图
     * @param {Array} [saveList] - 可选的存档列表数据，若不传则尝试获取
     */
    renderSaveLoad(saveList) {
        console.log('[UI_SystemModal] Rendering Save/Load');
        this.currentView = 'SAVE_LOAD';
        this.setTitle('存档 / 读档');
        this.clearContent();

        const slots = saveList || (this.engine.data && this.engine.data.getSaveList ? this.engine.data.getSaveList() : [
            { id: 1, date: '空', level: '-', hp: '-' },
            { id: 2, date: '空', level: '-', hp: '-' },
            { id: 3, date: '空', level: '-', hp: '-' }
        ]);

        slots.forEach(slot => {
            const el = document.createElement('div');
            el.className = 'save-slot';

            const info = document.createElement('div');
            info.className = 'save-slot-info';
            info.innerHTML = `<h4>存档位 ${slot.id}</h4><div class="save-slot-meta">${slot.date} | 关卡: ${slot.level}</div>`;

            const actions = document.createElement('div');
            actions.className = 'slot-actions';

            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn-primary';
            saveBtn.textContent = '保存';
            saveBtn.onclick = () => {
                if (this.engine.input && this.engine.input.saveGame) {
                    this.engine.input.saveGame(slot.id);
                }
                // 保存后通常会触发 DATA_UPDATE，从而刷新列表
            };

            const loadBtn = document.createElement('button');
            loadBtn.className = 'btn-primary';
            loadBtn.textContent = '读取';
            loadBtn.disabled = slot.date === '空';
            loadBtn.onclick = () => {
                if (this.engine.input && this.engine.input.loadGame) {
                    this.engine.input.loadGame(slot.id);
                }
                // 不再手动 hide，等待引擎状态变更或事件
            };

            actions.appendChild(saveBtn);
            actions.appendChild(loadBtn);

            el.appendChild(info);
            el.appendChild(actions);
            this.dom.body.appendChild(el);
        });

        this.renderFooterBackBtn(() => this.openMainMenu());
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
