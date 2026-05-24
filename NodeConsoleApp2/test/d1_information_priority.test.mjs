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
      getLevelSelectMapModel() {
        return buildLevelSelectMapModel();
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

function buildLevelSelectMapModel() {
  return {
    schemaVersion: 'level_map_pack_v1',
    assetLibrary: {
      backgrounds: [
        {
          id: 'bg_map_glade_01',
          src: '../source/map/image_w2752_h1536_map-bg-01.jpeg',
          previewGradient: 'linear-gradient(180deg, #17324d, #3f9f84)'
        }
      ],
      nodeSkins: [
        { id: 'skin_story_battle', label: '战斗节点', shape: 'hex' }
      ],
      nodeArts: [
        {
          id: 'node_icon_elf_archer',
          src: '../source/scene_icon/level-node-05-elf-archer_1000.png'
        }
      ],
      portraits: []
    },
    overview: {
      chapterLabel: '第一章',
      chapterTitle: '幽暗森林',
      completedCount: 1,
      totalCount: 3,
      unlockedCount: 2
    },
    selectedNodeId: 'node_scout',
    recommendedNodeId: 'node_scout',
    map: {
      id: 'chapter_1_runtime',
      chapterLabel: '第一章',
      chapterTitle: '幽暗森林',
      name: '第一章地图',
      backgroundRef: 'bg_map_glade_01',
      space: { logicalWidth: 1600, logicalHeight: 900 },
      display: {
        viewportAspect: '16:9',
        backgroundFit: 'cover',
        nodeScale: 0.62,
        nodeAnchor: 'center',
        edgeAnchor: 'center',
        edgeLabelMode: 'midpoint'
      },
      nodes: [
        {
          id: 'node_edge',
          levelId: 'level_1_1',
          label: '1-1',
          title: '幽暗森林边缘',
          levelName: '幽暗森林边缘',
          kind: 'battle',
          status: 'completed',
          statusLabel: '已完成',
          isUnlocked: true,
          position: { x: 120, y: 240 },
          objectiveText: '建立第一波防线。',
          rewardPreview: ['KP +1'],
          artRefs: { nodeArt: 'node_icon_elf_archer' }
        },
        {
          id: 'node_scout',
          levelId: 'level_1_2_story',
          label: '1-2',
          title: '密林前哨',
          levelName: '密林前哨',
          kind: 'battle',
          status: 'recommended',
          statusLabel: '当前推荐',
          isUnlocked: true,
          position: { x: 480, y: 220 },
          objectiveText: '穿过前哨。',
          rewardPreview: ['金币 80'],
          artRefs: { nodeArt: 'node_icon_elf_archer' }
        },
        {
          id: 'node_gate',
          levelId: 'level_1_3_story',
          label: '1-3',
          title: '废墟关隘',
          levelName: '废墟关隘',
          kind: 'boss',
          status: 'unlocked',
          statusLabel: '已解锁',
          isUnlocked: true,
          selectLevelId: 'level_1_3_story',
          position: { x: 860, y: 260 },
          objectiveText: '进入章节首领战。',
          rewardPreview: ['KP +2'],
          artRefs: {}
        }
      ],
      edges: [
        { id: 'edge_1', fromNodeId: 'node_edge', toNodeId: 'node_scout', type: 'main', branchLabel: '林间路线' },
        { id: 'edge_2', fromNodeId: 'node_scout', toNodeId: 'node_gate', type: 'main', branchLabel: '废墟入口' }
      ]
    }
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
    assert.equal(kinds.includes('content-sources'), false, '主菜单不应再显示 content-sources 说明块');
    assert.equal(kinds.includes('main-flow'), false, '主菜单不应再显示 main-flow 说明块');
    assert.equal(kinds.includes('page-usage'), false, '主菜单不应再显示 page-usage 说明块');

    modal.renderLevelSelect();
    sections = Array.from(document.querySelectorAll('#modalBody .summary-section'));
    kinds = sections.map(node => node.getAttribute('data-summary-kind'));
    assert.ok(kinds.includes('story-progress'), '关卡选择页缺少 story-progress 摘要语义类');
    assert.equal(kinds.includes('prebattle-build'), false, '关卡选择页不应再显示 prebattle-build 说明块');
    assert.equal(kinds.includes('page-usage'), false, '关卡选择页不应再显示 page-usage 说明块');
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 欢迎页与主菜单会把主要动作放在说明块之前', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine({
      input: {
        login() {},
        loadGame() {},
        selectLevel() {},
        resumeGame() {}
      }
    });
    modal.bindDOM();

    modal.renderLogin();
    let firstBlock = document.querySelector('#modalBody > *');
    assert.ok(firstBlock?.classList.contains('modal-primary-actions'), '欢迎页第一块应是主要入口动作');
    assert.match(firstBlock?.textContent || '', /新游戏/);

    modal.renderMainMenu();
    firstBlock = document.querySelector('#modalBody > *');
    assert.ok(firstBlock?.classList.contains('menu-list'), '主菜单第一块应是可点击菜单动作');
    assert.match(firstBlock?.textContent || '', /关卡选择/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 显示和隐藏时会同步背景滚动锁定与语义状态', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine();
    modal.bindDOM();

    modal.renderLevelSelect();
    modal.show();
    assert.equal(document.body.classList.contains('modal-open'), true, '打开 modal 时应锁定背景滚动');
    assert.equal(document.getElementById('systemModal')?.getAttribute('aria-hidden'), 'false');
    assert.match(document.getElementById('modalTitle')?.textContent || '', /选择关卡/);

    modal.hide();
    assert.equal(document.body.classList.contains('modal-open'), false, '隐藏 modal 后应释放背景滚动');
    assert.equal(document.getElementById('systemModal')?.getAttribute('aria-hidden'), 'true');
    assert.equal(document.getElementById('modalTitle')?.textContent || '', '', '隐藏 modal 后不应残留旧标题');
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 关卡选择页使用宽面板与紧凑地图布局', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine();
    modal.bindDOM();

    modal.renderLevelSelect();

    assert.equal(document.querySelector('#systemModal .modal-panel')?.classList.contains('modal-panel--level-select'), true);
    assert.equal(document.getElementById('modalBody')?.classList.contains('modal-body--level-select'), true);
    assert.ok(document.querySelector('#modalBody > .level-select-layout'), '关卡选择页应使用专用宽布局容器');
    assert.ok(document.querySelector('#modalBody .level-select-runtime-map__stage'), '关卡选择页应以地图舞台作为主区域');
    assert.ok(document.querySelector('#modalBody .level-select-runtime-map__drawer'), '关卡选择页应提供关卡详情抽屉');
    assert.ok(document.querySelector('#modalBody .level-select-map-slot[data-summary-kind="story-progress"]'), '章节信息应放在地图承载区');
    assert.equal(document.querySelector('#modalBody .level-list-panel'), null, '大地图模式不应再渲染左侧当前章节列表');
    assert.equal(document.querySelector('#modalBody select'), null, '关卡选择不应依赖下拉菜单');
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 大地图详情抽屉压缩为进入前所需信息，不再渲染长说明', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine();
    modal.bindDOM();

    modal.renderLevelSelect();

    const drawer = document.querySelector('#modalBody .level-select-runtime-map__drawer');
    const drawerText = drawer?.textContent || '';
    assert.ok(drawer, '关卡选择页应使用详情抽屉承载当前节点信息');
    assert.match(drawerText, /密林前哨/);
    assert.match(drawerText, /1-2/);
    assert.match(drawerText, /金币 80/);
    assert.equal(document.querySelector('#modalBody .level-card'), null);
    assert.equal(drawer?.querySelector('details.level-card-extra-details'), null);
    assert.equal(drawer?.querySelector('.level-card-extra'), null);
    assert.doesNotMatch(drawerText, /章节节点|推进关系|首次通关反馈|重复通关收益|构筑提示|更多信息/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 关卡选择页以章节地图作为首屏主区域', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine();
    modal.bindDOM();

    modal.renderLevelSelect();

    const layout = document.querySelector('#modalBody > .level-select-layout');
    const layoutChildren = Array.from(layout?.children || []);
    const mapIndex = layoutChildren.findIndex(node => node.classList.contains('level-select-map-slot'));
    assert.ok(mapIndex >= 0, '关卡选择页缺少章节地图区域');
    assert.equal(layoutChildren.length, 1, '关卡选择首屏不应再并列渲染旧关卡列表');
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 会优先渲染运行时地图包节点，并只在确认按钮触发进入关卡', async () => {
  const dom = createSystemModalFixture();
  try {
    const selectedLevels = [];
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine({
      data: {
        ...buildSystemModalEngine().data,
        getLevelSelectMapModel() {
          return buildLevelSelectMapModel();
        }
      },
      input: {
        ...buildSystemModalEngine().input,
        selectLevel(levelId) {
          selectedLevels.push(levelId);
        }
      }
    });
    modal.bindDOM();

    modal.renderLevelSelect();

    const map = document.querySelector('#modalBody .level-select-runtime-map');
    const selectedNode = document.querySelector('#modalBody .level-map-node[data-node-id="node_scout"]');
    const lockedNode = document.querySelector('#modalBody .level-map-node[data-node-id="node_gate"]');
    assert.ok(map, '关卡选择页应渲染运行时地图包');
    assert.match(map?.textContent || '', /章节地图/);
    assert.match(map?.textContent || '', /密林前哨/);
    assert.equal(selectedNode?.getAttribute('data-selected'), 'true');
    assert.equal(lockedNode?.getAttribute('aria-disabled'), null);

    selectedNode?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    lockedNode?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.deepEqual(selectedLevels, []);

    document.querySelector('#modalBody [data-action="enter-level"]')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    assert.deepEqual(selectedLevels, ['level_1_3_story']);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('mock_ui_v11.css 为关卡选择提供 1920 首屏验收所需的宽面板布局', async () => {
  const css = await fs.readFile(path.join(projectRoot, 'mock_ui_v11.css'), 'utf8');
  assert.match(css, /\.modal-panel--level-select\s*\{[^}]*width:\s*min\(1660px,\s*calc\(100vw - 96px\)\)/s);
  assert.match(css, /\.modal-panel--level-select\s+\.modal-footer\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.modal-body--level-select\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.level-select-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.level-select-runtime-map\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+300px/s);
  assert.match(css, /\.level-select-runtime-map__stage\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/s);
  assert.match(css, /\.level-select-runtime-map__stage\s*\{[^}]*height:\s*100%/s);
  assert.match(css, /\.level-select-runtime-map__stage\s*\{[^}]*max-height:\s*100%/s);
  assert.match(css, /\.level-select-runtime-map__stage\s*\{[^}]*min-height:\s*0/s);
  assert.match(css, /\.level-select-runtime-map__surface\s*\{[^}]*background-color:/s);
  assert.match(css, /\.level-map-node\s*\{[^}]*width:\s*64px/s);
  assert.match(css, /\.level-map-node\s*\{[^}]*height:\s*64px/s);
  assert.match(css, /\.level-map-node__marker\s*\{/s);
  assert.match(css, /\.level-map-node__marker\s*\{[^}]*border-radius:\s*16px/s);
  assert.match(css, /\.level-map-node__marker\s*\{[^}]*border:\s*2px\s+solid\s+#16120c/s);
  assert.match(css, /\.level-map-node__marker\s*\{[^}]*#fffaf0/s);
  assert.match(css, /\.level-map-node__art\s*\{[^}]*inset:\s*6px/s);
  assert.match(css, /\.level-map-node__kind\s*\{[^}]*right:\s*-2px/s);
  assert.match(css, /\.level-map-node\[data-selected="true"\]\s+\.level-map-node__marker\s*\{[^}]*box-shadow:[^}]*0\s+0\s+0\s+3px\s+rgba\(255,\s*218,\s*107,/s);
  assert.doesNotMatch(css, /\.level-map-node\s*\{[^}]*width:\s*190px/s);
  assert.doesNotMatch(css, /\.level-map-node\.kind-[^{]+\.level-map-node__marker\s*\{[^}]*clip-path:/s);
  assert.doesNotMatch(css, /clip-path:\s*polygon/s);
  assert.doesNotMatch(css, /rgba\(239,\s*211,\s*146,\s*0\.86\)/s);
  assert.doesNotMatch(css, /\.level-map-node__plate\s*\{/s);
  assert.doesNotMatch(css, /\.level-map-node__title\s*\{/s);
  assert.doesNotMatch(css, /\.level-map-node__status\s*\{/s);
  assert.match(css, /\.level-map-drawer__meta-row\s*\{[^}]*grid-template-columns:\s*74px\s+minmax\(0,\s*1fr\)/s);
  assert.doesNotMatch(css, /\.level-map-node__caption\s*\{/s);
  assert.doesNotMatch(css, /\.level-map-node__pin\s*\{/s);
  assert.match(css, /\.level-map-edge\[data-active="true"\]\s*\{[^}]*stroke:\s*rgba\(112,\s*82,\s*42,/s);
  assert.doesNotMatch(css, /\.level-map-node\s*\{[^}]*border-radius:\s*18px/s);
});

test('mock_ui_v11.css 会在系统弹窗打开时锁定背景并隐藏底层注意力提示', async () => {
  const css = await fs.readFile(path.join(projectRoot, 'mock_ui_v11.css'), 'utf8');
  assert.match(css, /body\.modal-open\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /body\.modal-open\s+\.ui-attention-badge/s);
  assert.match(css, /body\.modal-open\s+\.battle-state-summary/s);
});

test('mock_ui_v11.html 提供主界面摘要条挂载点', async () => {
  const html = await fs.readFile(path.join(projectRoot, 'mock_ui_v11.html'), 'utf8');
  assert.match(html, /id="battleStateSummary"/);
});

test('mock_ui_v11.html 不再展示开发阶段策划沟通页脚', async () => {
  const html = await fs.readFile(path.join(projectRoot, 'mock_ui_v11.html'), 'utf8');
  assert.doesNotMatch(html, /示意图仅供策划沟通/);
  assert.doesNotMatch(html, /最终表现由 UI \/ 美术进一步设计/);
});

test('mock_ui_v11.html 不再展示开发阶段区域标签与演出配置读数', async () => {
  const html = await fs.readFile(path.join(projectRoot, 'mock_ui_v11.html'), 'utf8');
  assert.doesNotMatch(html, /class="area-tag"/);
  assert.doesNotMatch(html, /class="sub-area-tag"/);
  assert.doesNotMatch(html, /场景区|技能操作区域|状态摘要区域|战斗场景区域|行动顺序区域/);
  assert.doesNotMatch(html, /battle-presentation-meta/);
  assert.doesNotMatch(html, /演出配置资产/);
});

test('mock_ui_v11.html 不再把主界面摘要条插入场景区顶部', async () => {
  const html = await fs.readFile(path.join(projectRoot, 'mock_ui_v11.html'), 'utf8');
  const sceneWrapperIdx = html.indexOf('<section class="scene-wrapper">');
  const actionPanelIdx = html.indexOf('<section class="action-panel">');
  const summaryIdx = html.indexOf('id="battleStateSummary"');
  assert.notEqual(summaryIdx, -1, '缺少 #battleStateSummary');
  assert.ok(summaryIdx > actionPanelIdx, 'battleStateSummary 仍位于 action-panel 之前，会压缩主显示区');
  assert.ok(summaryIdx > sceneWrapperIdx, 'battleStateSummary 不应挂在 scene-wrapper 内部');
});
