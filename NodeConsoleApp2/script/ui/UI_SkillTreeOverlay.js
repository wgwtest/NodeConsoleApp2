/**
 * @file UI_SkillTreeOverlay.js
 * @description SkillTree Overlay host (方案B). Owns overlay container show/hide.
 */

import { UI_SkillTreeModal } from './UI_SkillTreeModal.js';

export class UI_SkillTreeOverlay {
	constructor() {
		this.engine = null;
		this.view = null;
		this._lastFocus = null;
		this.dom = {
			backdrop: null,
			panel: null,
			body: null,
			closeBtn: null,
		};

		this._onKeyDown = this._onKeyDown.bind(this);
	}

	init(engine) {
		this.engine = engine;
		this._bindDOM();
		this._bindEvents();
		this.hide();
	}

	_bindDOM() {
		this.dom.backdrop = document.getElementById('skillTreeOverlay');
		this.dom.panel = this.dom.backdrop ? this.dom.backdrop.querySelector('.overlay-panel') : null;
		this.dom.body = document.getElementById('skillTreeBody');
		this.dom.closeBtn = document.getElementById('skillTreeCloseBtn');

		if (this.dom.closeBtn) {
			this.dom.closeBtn.setAttribute('aria-label', '直接关闭技能树并返回上一页');
			this.dom.closeBtn.setAttribute('title', '直接关闭技能树并返回上一页');
			this.dom.closeBtn.addEventListener('click', () => this.hide());
		}

		// Optional: click backdrop to close
		if (this.dom.backdrop) {
			this.dom.backdrop.addEventListener('mousedown', (e) => {
				if (e.target === this.dom.backdrop) {
					this.hide();
				}
			});
		}
	}

	_bindEvents() {
		if (!this.engine || !this.engine.eventBus) return;
		this.engine.eventBus.on('UI:OPEN_SKILL_TREE', (payload) => this.show(payload));
		this.engine.eventBus.on('UI:CLOSE_SKILL_TREE', () => this.hide());
      this.engine.eventBus.on('DATA_UPDATE', (payload) => {
			if (!this.isVisible()) return;
			if (this.view && typeof this.view.refreshFromEngine === 'function') {
				this.view.refreshFromEngine(payload);
			}
		});
	}

	isVisible() {
		return !!(this.dom.backdrop && this.dom.backdrop.classList.contains('visible'));
	}

	show(payload = {}) {
		if (!this.dom.backdrop || !this.dom.body) return;
		this._lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		this._syncCloseButtonLabel(payload?.source);

		if (!this.view) {
			this.view = new UI_SkillTreeModal();
			this.view.init(this.engine);
		}

		this.dom.body.innerHTML = '';
		this.view.mountTo(this.dom.body, {
			title: '技能树',
			onClose: () => this.hide(),
		});

		this.dom.backdrop.classList.add('visible');
		this.dom.backdrop.hidden = false;
		this.dom.backdrop.inert = false;
		this.dom.backdrop.setAttribute('aria-hidden', 'false');
		document.addEventListener('keydown', this._onKeyDown);
		if (this.dom.closeBtn) this.dom.closeBtn.focus();

		// Optional focus skill
		if (payload && payload.focusSkillId) {
			// current implementation doesn't expose a public focus API
		}
	}

	hide() {
		if (!this.dom.backdrop) return;
		if (this.dom.backdrop.contains(document.activeElement)) {
			const fallback = this._lastFocus && document.contains(this._lastFocus)
				? this._lastFocus
				: document.getElementById('btnOpenSkillTree')
					|| document.getElementById('btnExecute')
					|| document.body;
			if (fallback && typeof fallback.focus === 'function') {
				fallback.focus();
			}
		}
		this.dom.backdrop.classList.remove('visible');
		this.dom.backdrop.hidden = true;
		this.dom.backdrop.inert = true;
		this.dom.backdrop.setAttribute('aria-hidden', 'true');
		document.removeEventListener('keydown', this._onKeyDown);
	}

	_refresh() {
     if (this.view && typeof this.view.refreshFromEngine === 'function') {
			this.view.refreshFromEngine();
		}
	}

	_onKeyDown(e) {
		if (e.key === 'Escape') {
			this.hide();
		}
	}

	_syncCloseButtonLabel(source) {
		if (!this.dom.closeBtn) return;
		const sourceMap = {
			MAIN_MENU: '直接关闭技能树并返回游戏菜单',
			SETTLEMENT: '直接关闭技能树并返回游戏菜单',
			BATTLE_LOOP: '直接关闭技能树并返回战斗',
			BATTLE_PREPARE: '直接关闭技能树并返回战斗'
		};
		const label = sourceMap[source] || '直接关闭技能树并返回上一页';
		this.dom.closeBtn.setAttribute('aria-label', label);
		this.dom.closeBtn.setAttribute('title', label);
	}
}
