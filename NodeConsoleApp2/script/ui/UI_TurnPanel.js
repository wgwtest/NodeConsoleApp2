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

        if (!this.btnExecute || !this.btnReset || !this.btnMenu) {
            console.warn('UI_TurnPanel: One or more buttons not found in DOM.');
            return;
        }

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
            if (this.isLocked()) return;
            // 4.7.3: Play sound/animation (optional placeholder)
            this.engine.input.commitTurn();
        });

        this.btnReset.addEventListener('click', () => {
            if (this.isLocked()) return;
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

        // Apply State: Reset Button
        this.setButtonState(this.btnReset, canReset);

        // Menu is always active (neutral)
    }

    setButtonState(btn, isActive) {
        if (isActive) {
            btn.removeAttribute('disabled');
            btn.classList.remove('disabled');
        } else {
            btn.setAttribute('disabled', 'true');
            btn.classList.add('disabled');
        }
    }
}
