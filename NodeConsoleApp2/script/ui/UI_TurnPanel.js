import EventBus from '../engine/EventBus.js';

/**
 * UI_TurnPanel
 * Manages the Turn Control interactions: Execute, Reset, and System Menu.
 * Implements logic defined in 16-战斗界面(UI_design)-设计说明.md Section 4.7.
 */
export default class UI_TurnPanel {
    constructor(engine) {
        this.engine = engine;
        this.eventBus = engine.eventBus;

        // -- DOM Query --
        // Buttons are identified by IDs in mock_ui_v10.html
        this.btnExecute = document.getElementById('btnExecute');
        this.btnReset = document.getElementById('btnReset');
        this.btnMenu = document.getElementById('btnMenu');
        this.turnNumberLabel = document.getElementById('turnNumberLabel');
        this.blockedHint = null;

        if (!this.btnExecute || !this.btnReset || !this.btnMenu) {
            console.warn('UI_TurnPanel: One or more buttons not found in DOM.');
            return;
        }

        this.blockedHint = this.ensureBlockedHint();

        // -- Bind Events --
        this.bindDOMEvents();
        this.bindEngineEvents();

        console.log('UI_TurnPanel initialized.');
        
        // Initial State Render
        // We can simulate an empty update to set initial button states
        this.render({
            phase: this.engine.battlePhase || 'IDLE',
            queue: this.engine.playerSkillQueue || [],
            turn: this.engine.currentTurn || 0,
            timelinePhase: this.engine.timeline ? this.engine.timeline.phase : undefined
        });
    }

    bindDOMEvents() {
        this.btnExecute.addEventListener('click', () => {
            if (this.btnExecute.classList.contains('disabled')) {
                this.emitBlockedFeedback('execute');
                return;
            }
            // 4.7.3: Play sound/animation (optional placeholder)
            this.engine.input.commitTurn();
        });

        this.btnReset.addEventListener('click', () => {
            if (this.btnReset.classList.contains('disabled')) {
                this.emitBlockedFeedback('reset');
                return;
            }
            this.engine.input.resetTurn();
        });

        this.btnMenu.addEventListener('click', () => {
            // System menu is always available
            this.eventBus.emit('UI:OPEN_MODAL', { view: 'MAIN_MENU' });
        });
    }

    bindEngineEvents() {
        this.eventBus.on('BATTLE_UPDATE', (data) => this.render(data));
        this.eventBus.on('BATTLE_START', (data) => {
            this.render({ phase: 'PLANNING', queue: [] });
        });
        // Listen to phase changes if they are separate events? 
        // CoreEngine emits BATTLE_UPDATE on commitTurn (via state change usually? No, commitTurn calls emitBattleUpdate but phase changes in FSM)
        // Actually CoreEngine.startTurn sets phase to PLANNING and calls emitBattleUpdate.
    }

    isLocked() {
        return this.btnExecute.classList.contains('disabled');
    }

    /**
     * Updates button states based on game state.
     * @param {Object} data - payload from BATTLE_UPDATE
     */
    render(data) {
        const phase = data.phase;
        const queueLength = (data.queue || []).length;
        const timelinePhase = data.timelinePhase;

        if (this.turnNumberLabel) {
            const t = Number(data.turn);
            this.turnNumberLabel.textContent = Number.isFinite(t) && t > 0 ? String(t) : '-';
        }

        // Logic 4.7.2
        let canExecute = false;
        let canReset = false;

        if (phase === 'PLANNING') {
            // Execute = start timeline playback. Only enabled when timeline is already built (READY/PAUSED).
            const tlPhase = data.timelinePhase;
            const canRunTimeline = tlPhase === 'READY';
            canExecute = canRunTimeline;
            canReset = queueLength > 0 || canRunTimeline;
        } else if (phase === 'EXECUTION') {
            // Everything disabled during execution (Spectator Mode)
            canExecute = false;
            canReset = false;
        }

        // Apply State: Execute Button
        this.setButtonState(this.btnExecute, canExecute);
        const executeReason = this.describeBlockedState('execute', {
            phase,
            queueLength,
            timelinePhase
        });
        this.setButtonHint(this.btnExecute, canExecute, executeReason);

        // Apply State: Reset Button
        this.setButtonState(this.btnReset, canReset);
        this.setButtonHint(this.btnReset, canReset, this.describeBlockedState('reset', {
            phase,
            queueLength,
            timelinePhase
        }));
        this.renderBlockedHint({
            canExecute,
            executeReason,
            phase,
            timelinePhase
        });

        // Menu is always active (neutral)
    }

    ensureBlockedHint() {
        const host = this.btnExecute?.closest('.turn-panel') || this.btnExecute?.parentElement;
        if (!host) return null;

        let hint = host.querySelector('.turn-blocked-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.className = 'turn-blocked-hint';
            hint.setAttribute('aria-live', 'polite');
            hint.setAttribute('role', 'status');

            const buttons = host.querySelector('.turn-buttons');
            if (buttons && buttons.parentElement === host) {
                buttons.insertAdjacentElement('afterend', hint);
            } else {
                host.appendChild(hint);
            }
        }
        return hint;
    }

    renderBlockedHint({ canExecute, executeReason, phase, timelinePhase } = {}) {
        if (!this.blockedHint) return;
        if (canExecute) {
            this.blockedHint.textContent = '当前无阻塞，可以执行回合。';
            this.blockedHint.dataset.level = 'ready';
            return;
        }

        const reason = executeReason || this.describeBlockedState('execute', { phase, timelinePhase });
        this.blockedHint.textContent = reason || '当前暂不可执行回合。';
        this.blockedHint.dataset.level = 'blocked';
    }

    setButtonState(btn, isActive) {
        if (isActive) {
            btn.removeAttribute('aria-disabled');
            btn.classList.remove('disabled');
        } else {
            btn.setAttribute('aria-disabled', 'true');
            btn.classList.add('disabled');
        }
    }

    setButtonHint(btn, isActive, reason) {
        if (!btn) return;
        if (isActive) {
            btn.removeAttribute('title');
            btn.removeAttribute('data-disabled-reason');
            return;
        }
        if (reason) {
            btn.setAttribute('title', reason);
            btn.dataset.disabledReason = reason;
        }
    }

    describeBlockedState(kind, snapshot = {}) {
        const phase = snapshot.phase || this.engine?.battlePhase || 'IDLE';
        const queueLength = Number(snapshot.queueLength ?? this.engine?.playerSkillQueue?.length ?? 0) || 0;
        const timelinePhase = snapshot.timelinePhase || this.engine?.timeline?.phase;

        if (kind === 'execute') {
            if (phase === 'EXECUTION') {
                return '当前正在执行阶段，请等待自动结算完成。';
            }
            if (timelinePhase === 'READY') {
                return '';
            }
            return '请先提交规划，形成可执行时间轴。';
        }

        if (phase === 'EXECUTION') {
            return '当前正在执行阶段，暂时不能重置规划。';
        }
        if (queueLength <= 0 && timelinePhase !== 'READY') {
            return '当前没有可重置的规划。';
        }
        return '';
    }

    emitBlockedFeedback(kind) {
        const message = this.describeBlockedState(kind, {
            phase: this.engine?.battlePhase,
            queueLength: this.engine?.playerSkillQueue?.length ?? 0,
            timelinePhase: this.engine?.timeline?.phase
        });

        if (!message) return;

        const payload = kind === 'execute'
            ? {
                level: 'blocked',
                title: '无法执行回合',
                message,
                suggestion: '先选择技能并部署到技能槽，再点击“提交规划”。'
            }
            : {
                level: 'blocked',
                title: '无法重置规划',
                message,
                suggestion: '先完成一次规划，或等待执行阶段结束后再重置。'
            };

        this.eventBus?.emit?.('UI:ACTION_FEEDBACK', payload);
        this.eventBus?.emit?.('BATTLE_LOG', { text: `${payload.title}：${payload.message}` });
    }
}
