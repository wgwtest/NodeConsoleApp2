import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

import { JSDOM } from 'jsdom';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function importSourceModule(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  let source = await fs.readFile(filePath, 'utf8');
  if (relativePath === 'script/ui/UI_TurnPanel.js') {
    source = source.replace(/^﻿?import EventBus from '\.\.\/engine\/EventBus\.js';\s*/u, '');
  }
  if (relativePath === 'script/ui/UI_SystemModal.js') {
    const viewSource = await fs.readFile(path.join(projectRoot, 'script/ui/LevelSelectMapView.js'), 'utf8');
    const viewEncoded = Buffer.from(viewSource, 'utf8').toString('base64');
    source = source.replace(
      /^﻿?import\s+\{\s*LevelSelectMapView\s*\}\s+from\s+'\.\/*LevelSelectMapView\.js';\s*/u,
      `import { LevelSelectMapView } from 'data:text/javascript;base64,${viewEncoded}';\n`
    );
  }
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function installDomGlobals(dom) {
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
  global.Event = dom.window.Event;
  global.CustomEvent = dom.window.CustomEvent;
}

function cleanupDomGlobals() {
  delete global.window;
  delete global.document;
  delete global.HTMLElement;
  delete global.Node;
  delete global.Event;
  delete global.CustomEvent;
}

function createMiniEventBus() {
  const listeners = new Map();
  return {
    on(event, callback) {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(callback);
      return () => {
        const next = (listeners.get(event) || []).filter(fn => fn !== callback);
        listeners.set(event, next);
      };
    },
    emit(event, payload) {
      for (const fn of listeners.get(event) || []) {
        fn(payload);
      }
    }
  };
}

function createAttentionGuideFixture() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <body>
      <div id="uiAttentionBadge"></div>
      <section id="battleStateSummary"></section>
    </body>
  `);
  installDomGlobals(dom);
  return dom;
}

function createTurnPanelFixture() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <body>
      <aside class="turn-panel">
        <button id="btnExecute" type="button">执行回合</button>
        <button id="btnReset" type="button">重置</button>
        <button id="btnMenu" type="button">设置</button>
      </aside>
      <div id="turnNumberLabel"></div>
    </body>
  `);
  installDomGlobals(dom);
  return dom;
}

function createSystemModalFixture() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <body>
      <div id="systemModal">
        <div class="modal-panel">
          <div id="modalTitle"></div>
          <div id="modalBody"></div>
          <div id="modalFooter"></div>
          <button id="modalCloseBtn" type="button"></button>
        </div>
      </div>
      <button id="systemMenuBtn" type="button"></button>
    </body>
  `);
  installDomGlobals(dom);
  return dom;
}

function buildAttentionGuideEngine() {
  return {
    eventBus: createMiniEventBus(),
    battlePhase: 'PLANNING',
    currentTurn: 1,
    playerSkillQueue: [],
    timeline: {
      phase: 'IDLE'
    },
    data: {
      playerData: {
        stats: {
          ap: 6,
          maxAp: 6
        }
      }
    }
  };
}

function buildTurnPanelEngine(eventBus) {
  return {
    eventBus,
    battlePhase: 'PLANNING',
    currentTurn: 1,
    playerSkillQueue: [],
    timeline: {
      phase: 'IDLE'
    },
    input: {
      commitTurn() {},
      resetTurn() {}
    }
  };
}

function buildSystemModalEngine() {
  return {
    fsm: { currentState: 'MAIN_MENU' },
    data: {
      dataConfig: {},
      playerData: {
        skills: {
          skillTreeId: 'player1',
          skillPoints: 3,
          learned: ['skill_throw_stone']
        }
      },
      getAcceptanceLevelSelectEntries() {
        return [];
      },
      getLevelContentSourceOverview() {
        return [];
      },
      getLevelSelectOverview() {
        return {
          chapterLabel: '第一章',
          chapterTitle: '幽暗森林',
          completedCount: 1,
          totalCount: 3,
          unlockedCount: 2,
          recommendedLevelId: 'level_1_2_story',
          recommendedLevelName: '密林前哨',
          currentNodeLabel: '1-2',
          currentObjectiveText: '穿过前哨，向废墟推进。',
          nextLockedLevelId: 'level_1_3_story',
          nextLockedLevelName: '废墟关隘',
          chapterNodes: [
            { id: 'level_1_1', name: '幽暗森林边缘', nodeLabel: '1-1', status: 'completed' },
            { id: 'level_1_2_story', name: '密林前哨', nodeLabel: '1-2', status: 'recommended' }
          ]
        };
      },
      getLevelSelectEntries() {
        return [
          {
            id: 'level_1_2_story',
            name: '密林前哨',
            description: '第二节点',
            isUnlocked: true,
            isCompleted: false
          }
        ];
      }
    },
    input: {
      selectLevel() {},
      loadGame() {},
      resumeGame() {}
    }
  };
}

test('UI_AttentionGuide 会渲染机制术语卡与默认阻塞反馈卡', async () => {
  const dom = createAttentionGuideFixture();
  try {
    const { UI_AttentionGuide } = await importSourceModule('script/ui/UI_AttentionGuide.js');
    const engine = buildAttentionGuideEngine();
    new UI_AttentionGuide(engine);

    const summary = document.getElementById('battleStateSummary');
    const text = summary?.textContent || '';
    const kinds = Array.from(summary?.querySelectorAll('[data-summary-card]') || [])
      .map(node => node.getAttribute('data-summary-card'));

    assert.match(text, /机制术语/);
    assert.match(text, /AP.*本回合可部署的技能预算/);
    assert.match(text, /技能槽.*部署后才会进入规划/);
    assert.match(text, /时间轴.*执行阶段的展示顺序/);
    assert.match(text, /阻塞反馈/);
    assert.match(text, /尚未形成可执行规划/);
    assert.ok(kinds.includes('glossary'), '缺少 glossary 语义卡');
    assert.ok(kinds.includes('feedback'), '缺少 feedback 语义卡');
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_AttentionGuide 会显示最近一次结构化阻塞反馈与建议动作', async () => {
  const dom = createAttentionGuideFixture();
  try {
    const { UI_AttentionGuide } = await importSourceModule('script/ui/UI_AttentionGuide.js');
    const engine = buildAttentionGuideEngine();
    const guide = new UI_AttentionGuide(engine);

    guide.eventBus.emit('UI:ACTION_FEEDBACK', {
      level: 'blocked',
      title: 'AP 不足',
      message: '当前 AP 预算不足，无法继续加入该技能。',
      suggestion: '先移除高消耗技能，或改用更低 AP 的技能。'
    });

    const text = document.getElementById('battleStateSummary')?.textContent || '';
    assert.match(text, /AP 不足/);
    assert.match(text, /当前 AP 预算不足，无法继续加入该技能/);
    assert.match(text, /先移除高消耗技能/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_TurnPanel 在按钮不可用时会暴露明确原因并发出结构化反馈', async () => {
  const dom = createTurnPanelFixture();
  try {
    const { default: UI_TurnPanel } = await importSourceModule('script/ui/UI_TurnPanel.js');
    const eventBus = createMiniEventBus();
    const feedback = [];
    eventBus.on('UI:ACTION_FEEDBACK', payload => feedback.push(payload));

    const panel = new UI_TurnPanel(buildTurnPanelEngine(eventBus));

    const execute = document.getElementById('btnExecute');
    const reset = document.getElementById('btnReset');

    assert.match(execute.getAttribute('title') || '', /请先提交规划/);
    assert.match(reset.getAttribute('title') || '', /当前没有可重置的规划/);

    execute.click();
    reset.click();

    assert.equal(feedback.length, 2, '缺少结构化阻塞反馈事件');
    assert.equal(feedback[0]?.title, '无法执行回合');
    assert.match(feedback[0]?.message || '', /请先提交规划/);
    assert.equal(feedback[1]?.title, '无法重置规划');
    assert.match(feedback[1]?.message || '', /当前没有可重置的规划/);
    void panel;
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_TurnPanel 会在回合控制区内渲染近按钮阻塞提示', async () => {
  const dom = createTurnPanelFixture();
  try {
    const { default: UI_TurnPanel } = await importSourceModule('script/ui/UI_TurnPanel.js');
    const eventBus = createMiniEventBus();
    new UI_TurnPanel(buildTurnPanelEngine(eventBus));

    const hint = document.querySelector('.turn-panel .turn-blocked-hint');
    assert.ok(hint, '回合控制区缺少近按钮阻塞提示');
    assert.equal(hint.getAttribute('aria-live'), 'polite');
    assert.match(hint.textContent || '', /请先提交规划/);

    eventBus.emit('BATTLE_UPDATE', {
      phase: 'PLANNING',
      queue: [{ skillId: 'skill_heal', cost: 2 }],
      turn: 1,
      timelinePhase: 'READY'
    });

    assert.match(hint.textContent || '', /可以执行回合/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 主菜单和关卡选择页不再渲染页面用途说明块', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine();
    modal.bindDOM();

    modal.renderMainMenu();
    let bodyText = document.getElementById('modalBody')?.textContent || '';
    let kinds = Array.from(document.querySelectorAll('#modalBody .summary-section'))
      .map(node => node.getAttribute('data-summary-kind'));
    assert.doesNotMatch(bodyText, /本页用途/);
    assert.doesNotMatch(bodyText, /只负责选择下一步操作/);
    assert.doesNotMatch(bodyText, /不会直接开始战斗结算/);
    assert.equal(kinds.includes('page-usage'), false, '主菜单不应再渲染 page-usage 摘要块');
    assert.equal(document.querySelector('#modalBody .modal-guide'), null);

    modal.renderLevelSelect();
    bodyText = document.getElementById('modalBody')?.textContent || '';
    kinds = Array.from(document.querySelectorAll('#modalBody .summary-section'))
      .map(node => node.getAttribute('data-summary-kind'));
    assert.doesNotMatch(bodyText, /本页用途/);
    assert.doesNotMatch(bodyText, /负责选择故事关卡并进入战斗规划/);
    assert.doesNotMatch(bodyText, /不会在这里修改技能树或作者工具数据/);
    assert.equal(kinds.includes('page-usage'), false, '关卡选择页不应再渲染 page-usage 摘要块');
    assert.equal(document.querySelector('#modalBody .modal-guide'), null);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('mock_ui_v11.css 以 1920x1080 为首验视口压缩战斗主体高度', async () => {
  const css = await fs.readFile(path.join(projectRoot, 'mock_ui_v11.css'), 'utf8');
  assert.match(css, /grid-template-rows:\s*500px\s+300px\s+152px/, '主流程行高应适配 1920x1080 一屏验收');
  assert.match(css, /\.timeline\s*\{[^}]*min-height:\s*104px/s, '时间轴高度应避免挤压战斗主体');
  assert.match(css, /\.turn-blocked-hint/s, '缺少近按钮阻塞提示样式');
});
