import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

import { JSDOM } from 'jsdom';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function importSourceModule(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  const source = await fs.readFile(filePath, 'utf8');
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function installDomGlobals(dom) {
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
}

function cleanupDomGlobals() {
  delete global.window;
  delete global.document;
  delete global.HTMLElement;
  delete global.Node;
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

function createSystemModalFixture() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <body>
      <div id="systemModal" hidden aria-hidden="true">
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

function buildSystemModalEngine(overrides = {}) {
  return {
    fsm: { currentState: 'MAIN_MENU' },
    data: {
      dataConfig: {
        global: {
          progress: {
            lastSettlement: {
              levelName: '幽暗森林边缘',
              rewards: { exp: 100, gold: 50, kp: 1 }
            },
            lastLearnAction: {
              learnedCount: 1,
              learnedSkillNames: ['投石'],
              spentKp: 1,
              remainingKp: 2
            }
          }
        }
      },
      playerData: {
        skills: {
          skillTreeId: 'player1',
          skillPoints: 2,
          learned: ['skill_throw_stone', 'skill_heal']
        }
      },
      getLevelContentSourceOverview() {
        return [
          {
            kind: 'story',
            title: '故事关卡',
            entryLabel: '关卡选择',
            count: 1,
            isRuntimeEntry: true,
            description: '正式推进内容。'
          }
        ];
      },
      getAcceptanceLevelSelectEntries() {
        return [];
      },
      getSkillConfig(skillId) {
        const names = {
          skill_throw_stone: { id: 'skill_throw_stone', name: '投石' },
          skill_heal: { id: 'skill_heal', name: '治疗术' }
        };
        return names[skillId] || null;
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
            { id: 'level_1_2_story', name: '密林前哨', nodeLabel: '1-2', status: 'recommended' },
            { id: 'level_1_3_story', name: '废墟关隘', nodeLabel: '1-3', status: 'locked' }
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
            isCompleted: false,
            flow: {
              kind: 'story',
              chapterLabel: '第一章',
              chapterTitle: '幽暗森林',
              nodeLabel: '1-2'
            },
            progression: {
              stateLabel: '当前推荐',
              unlockHint: '当前已解锁，建议优先推进。'
            },
            rewards: { exp: 100, gold: 50, kp: 1 },
            clearFeedback: {
              currentMode: 'first_clear',
              firstClearText: '首次通关将解锁下一关：废墟关隘。',
              repeatClearText: '重复通关仍获得常规资源奖励，但不再解锁新章节。'
            }
          }
        ];
      }
    },
    input: {
      selectLevel() {},
      loadGame() {},
      confirmSettlement() {},
      resumeGame() {}
    },
    ...overrides
  };
}

test('UI_AttentionGuide 会渲染主界面摘要条并给出规划提示', async () => {
  const dom = createAttentionGuideFixture();
  try {
    const { UI_AttentionGuide } = await importSourceModule('script/ui/UI_AttentionGuide.js');
    const engine = buildAttentionGuideEngine();
    new UI_AttentionGuide(engine);

    const badgeText = document.getElementById('uiAttentionBadge')?.textContent || '';
    const summaryText = document.getElementById('battleStateSummary')?.textContent || '';

    assert.match(badgeText, /阶段：PLANNING/);
    assert.match(summaryText, /当前目标/);
    assert.match(summaryText, /战斗态势/);
    assert.match(summaryText, /当前操作/);
    assert.match(summaryText, /选择技能并部署到技能槽/);
    assert.match(summaryText, /尚未提交规划/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_AttentionGuide 会随队列与时间线状态刷新摘要条', async () => {
  const dom = createAttentionGuideFixture();
  try {
    const { UI_AttentionGuide } = await importSourceModule('script/ui/UI_AttentionGuide.js');
    const engine = buildAttentionGuideEngine();
    const guide = new UI_AttentionGuide(engine);

    engine.playerSkillQueue = [
      { skillId: 'skill_throw_stone', cost: 1 },
      { skillId: 'skill_heal', cost: 2 }
    ];
    engine.timeline.phase = 'READY';
    guide.eventBus.emit('BATTLE_UPDATE', {
      phase: 'PLANNING',
      queue: engine.playerSkillQueue,
      timelinePhase: 'READY'
    });

    let summaryText = document.getElementById('battleStateSummary')?.textContent || '';
    assert.match(summaryText, /已规划 2 项/);
    assert.match(summaryText, /可以执行回合/);

    engine.battlePhase = 'EXECUTION';
    engine.timeline.phase = 'PLAYING';
    guide.eventBus.emit('TIMELINE_START', { roundId: 1 });

    summaryText = document.getElementById('battleStateSummary')?.textContent || '';
    assert.match(summaryText, /时间轴执行中/);
    assert.match(summaryText, /等待自动结算/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 主菜单与关卡选择页会挂统一摘要语义类', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine();
    modal.bindDOM();

    modal.renderMainMenu();
    let sections = Array.from(document.querySelectorAll('#modalBody .summary-section'));
    let kinds = sections.map(node => node.getAttribute('data-summary-kind'));
    assert.ok(kinds.includes('growth'), '主菜单缺少 growth 摘要语义类');
    assert.ok(kinds.includes('content-sources'), '主菜单缺少 content-sources 摘要语义类');

    modal.renderLevelSelect();
    sections = Array.from(document.querySelectorAll('#modalBody .summary-section'));
    kinds = sections.map(node => node.getAttribute('data-summary-kind'));
    assert.ok(kinds.includes('story-progress'), '关卡选择页缺少 story-progress 摘要语义类');
    assert.ok(kinds.includes('prebattle-build'), '关卡选择页缺少 prebattle-build 摘要语义类');
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('mock_ui_v11.html 提供主界面摘要条挂载点', async () => {
  const html = await fs.readFile(path.join(projectRoot, 'mock_ui_v11.html'), 'utf8');
  assert.match(html, /id="battleStateSummary"/);
});

test('mock_ui_v11.html 不再把主界面摘要条插入场景区顶部', async () => {
  const html = await fs.readFile(path.join(projectRoot, 'mock_ui_v11.html'), 'utf8');
  const sceneWrapperIdx = html.indexOf('<section class="scene-wrapper labeled-block">');
  const actionPanelIdx = html.indexOf('<section class="action-panel labeled-block">');
  const summaryIdx = html.indexOf('id="battleStateSummary"');
  assert.notEqual(summaryIdx, -1, '缺少 #battleStateSummary');
  assert.ok(summaryIdx > actionPanelIdx, 'battleStateSummary 仍位于 action-panel 之前，会压缩主显示区');
  assert.ok(summaryIdx > sceneWrapperIdx, 'battleStateSummary 不应挂在 scene-wrapper 内部');
});
