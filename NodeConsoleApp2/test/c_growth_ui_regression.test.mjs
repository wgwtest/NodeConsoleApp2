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
  if (relativePath === 'script/ui/UI_SkillPanel.js') {
    source = source.replace(/^﻿?import EventBus from '\.\.\/engine\/EventBus\.js';\s*/u, '');
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

function createSkillPanelFixture() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <body>
      <section class="skill-panel">
        <div class="skill-pool-column">
          <div class="skill-sort-bar"></div>
          <div class="skill-grid-view"></div>
        </div>
        <div class="action-matrix-container">
          <div class="matrix-row" data-row-part="head">
            <div class="enemy-zone">
              <button class="slot-placeholder" data-part="head" data-target-type="enemy" data-slot-index="0"></button>
            </div>
          </div>
          <div class="matrix-row" data-row-part="chest">
            <div class="enemy-zone">
              <button class="slot-placeholder" data-part="chest" data-target-type="enemy" data-slot-index="0"></button>
            </div>
          </div>
          <div class="matrix-row" data-row-part="abdomen">
            <div class="enemy-zone">
              <button class="slot-placeholder" data-part="abdomen" data-target-type="enemy" data-slot-index="0"></button>
            </div>
          </div>
        </div>
      </section>
      <aside class="skill-detail-column">
        <div id="detailName"></div>
        <div id="detailMeta"></div>
        <div id="detailEffect"></div>
        <div id="detailTarget"></div>
        <div id="detailCosts"></div>
        <div id="detailSpeed"></div>
        <div id="detailBuffs"></div>
        <div id="detailTip"></div>
        <div id="detailTags"></div>
        <div id="apMeter"><div id="apMeterSlots"></div><div id="apMeterValue"></div></div>
      </aside>
    </body>
  `);
  installDomGlobals(dom);
  return dom;
}

function buildSystemModalEngine(overrides = {}) {
  return {
    fsm: { currentState: 'MAIN_MENU' },
    data: {
      dataConfig: {},
      playerData: {
        skills: {
          skillTreeId: 'player1',
          skillPoints: 2,
          learned: []
        }
      },
      getLevelSelectEntries() {
        return [];
      },
      getAcceptanceLevelSelectEntries() {
        return [];
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
          },
          {
            kind: 'authoring',
            title: '作者样本',
            entryLabel: '作者样本工具页',
            count: 2,
            isRuntimeEntry: false,
            description: '独立工具页，不属于主流程。'
          }
        ];
      },
      getSkillConfig(skillId) {
        const names = {
          skill_heal: { id: 'skill_heal', name: '治疗术' },
          skill_block: { id: 'skill_block', name: '盾墙' },
          skill_throw_stone: { id: 'skill_throw_stone', name: '投石' }
        };
        return names[skillId] || null;
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

test('UI_SystemModal 主菜单会显示最近成长来源与最近学习结果', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine({
      data: {
        playerData: {
          skills: {
            skillTreeId: 'player1',
            skillPoints: 2,
            learned: ['skill_guard', 'skill_heal', 'skill_block']
          }
        },
        dataConfig: {
          global: {
            progress: {
              lastSettlement: {
                levelName: '第一关',
                rewards: { exp: 100, gold: 50, kp: 1 }
              },
              lastLearnAction: {
                learnedCount: 2,
                learnedSkillNames: ['治疗术', '盾墙'],
                spentKp: 3,
                remainingKp: 2
              }
            }
          }
        },
        getAcceptanceLevelSelectEntries() {
          return [];
        },
        getLevelContentSourceOverview() {
          return [];
        }
      }
    });
    modal.bindDOM();

    modal.renderMainMenu();

    const bodyText = document.getElementById('modalBody')?.textContent || '';
    assert.match(bodyText, /最近成长来源/);
    assert.match(bodyText, /第一关/);
    assert.match(bodyText, /\+1 KP/);
    assert.match(bodyText, /最近学习结果/);
    assert.match(bodyText, /治疗术、盾墙/);
    assert.match(bodyText, /消耗 3 KP/);
    assert.match(bodyText, /剩余 2 KP/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 主菜单会显示内容入口说明', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine();
    modal.bindDOM();

    modal.renderMainMenu();

    const bodyText = document.getElementById('modalBody')?.textContent || '';
    assert.match(bodyText, /内容入口说明/);
    assert.match(bodyText, /作者样本工具页/);
    assert.match(bodyText, /不属于主流程/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 关卡选择页会显示关前构筑摘要与章节推进信息', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine({
      data: {
        playerData: {
          skills: {
            skillTreeId: 'player1',
            skillPoints: 2,
            learned: ['skill_heal', 'skill_block', 'skill_throw_stone']
          }
        },
        dataConfig: {
          global: {
            progress: {
              lastLearnAction: {
                learnedCount: 1,
                learnedSkillIds: ['skill_throw_stone'],
                learnedSkillNames: ['投石'],
                spentKp: 1,
                remainingKp: 2
              }
            }
          }
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
        },
        getSkillConfig(skillId) {
          const names = {
            skill_heal: { id: 'skill_heal', name: '治疗术' },
            skill_block: { id: 'skill_block', name: '盾墙' },
            skill_throw_stone: { id: 'skill_throw_stone', name: '投石' }
          };
          return names[skillId] || null;
        }
      }
    });
    modal.bindDOM();

    modal.renderLevelSelect();

    const bodyText = document.getElementById('modalBody')?.textContent || '';
    assert.match(bodyText, /章节推进总览/);
    assert.match(bodyText, /当前推荐/);
    assert.match(bodyText, /密林前哨/);
    assert.match(bodyText, /章节节点/);
    assert.match(bodyText, /推进关系/);
    assert.match(bodyText, /关前构筑摘要/);
    assert.match(bodyText, /当前技能池/);
    assert.match(bodyText, /3 项/);
    assert.match(bodyText, /投石/);
    assert.match(bodyText, /重复通关收益/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 结算页会区分首次通关反馈与重复通关收益', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine();
    modal.bindDOM();

    modal.renderBattleSettlement({
      victory: true,
      settlement: {
        levelName: '幽暗森林边缘',
        firstClear: false,
        rewards: { exp: 100, gold: 50, kp: 1 },
        playerAfter: {
          resources: { exp: 220, gold: 140 },
          skillPoints: 12
        }
      }
    });
    let bodyText = document.getElementById('modalBody')?.textContent || '';
    assert.match(bodyText, /重复通关收益/);
    assert.match(bodyText, /不再解锁新章节/);

    modal.renderBattleSettlement({
      victory: true,
      settlement: {
        levelName: '幽暗森林边缘',
        firstClear: true,
        nextLevelName: '密林前哨',
        rewards: { exp: 100, gold: 50, kp: 1 },
        playerAfter: {
          resources: { exp: 320, gold: 190 },
          skillPoints: 13
        }
      }
    });
    bodyText = document.getElementById('modalBody')?.textContent || '';
    assert.match(bodyText, /首次通关反馈/);
    assert.match(bodyText, /已解锁下一关：密林前哨/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillPanel 会显示最近学习带来的本局新增技能提示', async () => {
  const dom = createSkillPanelFixture();
  try {
    const { default: UI_SkillPanel } = await importSourceModule('script/ui/UI_SkillPanel.js');
    const panel = new UI_SkillPanel({
      eventBus: createMiniEventBus(),
      data: {
        playerData: {
          id: 'player_1',
          stats: { ap: 6, maxAp: 6 },
          skills: {
            skillTreeId: 'player1',
            skillPoints: 1,
            learned: ['skill_heal', 'skill_throw_stone']
          }
        },
        dataConfig: {
          global: {
            progress: {
              lastSettlement: {
                levelId: 'level_1_1',
                settledAt: '2026-04-08T10:00:00.000Z'
              },
              lastLearnAction: {
                learnedCount: 1,
                learnedSkillIds: ['skill_throw_stone'],
                learnedSkillNames: ['投石'],
                spentKp: 1,
                remainingKp: 1,
                committedAt: '2026-04-08T10:05:00.000Z'
              }
            }
          }
        },
        getSkillConfig(id) {
          const map = {
            skill_heal: {
              id: 'skill_heal',
              name: '治疗',
              costs: { ap: 2 },
              target: { subject: 'SUBJECT_SELF', scope: 'SCOPE_ENTITY', selection: { mode: 'single', selectCount: 1 } }
            },
            skill_throw_stone: {
              id: 'skill_throw_stone',
              name: '投石',
              costs: { ap: 1 },
              target: { subject: 'SUBJECT_ENEMY', scope: 'SCOPE_PART', selection: { mode: 'single', selectCount: 1, candidateParts: ['head'] } }
            }
          };
          return map[id] || null;
        }
      },
      playerSkillQueue: [],
      turnPlanner: {
        getApBudgetState() {
          return {
            phase: 'AP_BUDGET_READY',
            availableAp: 6,
            plannedCost: 0,
            remaining: 6,
            ok: true
          };
        }
      }
    });

    panel.onBattleStart({
      player: {
        skills: {
          skillTreeId: 'player1',
          skillPoints: 1,
          learned: ['skill_heal', 'skill_throw_stone']
        }
      },
      level: {
        enemies: [{ id: 'enemy_1', bodyParts: { head: { max: 10 }, chest: { max: 10 }, abdomen: { max: 10 } } }]
      }
    });

    const text = panel.root?.textContent || '';
    assert.match(text, /本局新增技能/);
    assert.match(text, /投石/);
    assert.match(text, /自动加入技能池/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal 提交后会写入最近学习结果', async () => {
  const dom = new JSDOM('<!DOCTYPE html><body></body>');
  installDomGlobals(dom);
  try {
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.engine = {
      saveGame() {},
      data: {
        playerData: {
          skills: {
            skillTreeId: 'player1',
            learned: ['skill_guard'],
            skillPoints: 5
          }
        },
        dataConfig: {
          global: {
            progress: {}
          }
        }
      },
      eventBus: createMiniEventBus()
    };
    modal._skillsMap = {
      skill_guard: { id: 'skill_guard', name: '格挡', unlock: { cost: { kp: 1 } } },
      skill_heal: { id: 'skill_heal', name: '治疗术', unlock: { cost: { kp: 2 } } },
      skill_block: { id: 'skill_block', name: '盾墙', unlock: { cost: { kp: 1 } } }
    };
    modal._skillsList = Object.values(modal._skillsMap);
    modal._sessionSnapshot = {
      skillPoints: 5,
      learned: ['skill_guard'],
      selectedSkillId: 'skill_heal'
    };
    modal._stagedLearned = new Set(['skill_heal', 'skill_block']);
    modal._handleClose = () => {};

    modal._handleCommitAndClose();

    const lastLearnAction = modal.engine.data.dataConfig.global.progress.lastLearnAction;
    assert.ok(lastLearnAction);
    assert.equal(lastLearnAction.skillTreeId, 'player1');
    assert.equal(lastLearnAction.learnedCount, 2);
    assert.equal(lastLearnAction.spentKp, 3);
    assert.equal(lastLearnAction.remainingKp, 2);
    assert.deepEqual(lastLearnAction.learnedSkillNames, ['治疗术', '盾墙']);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});
