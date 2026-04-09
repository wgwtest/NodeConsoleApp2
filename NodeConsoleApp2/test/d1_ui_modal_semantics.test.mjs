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
      getLevelSelectEntries() {
        return [
          {
            id: 'level_1',
            name: '第一关',
            description: '主线入口',
            isUnlocked: true,
            isCompleted: false
          }
        ];
      }
    },
    input: {
      resumeGame() {},
      selectLevel() {}
    },
    ...overrides
  };
}

function createSkillTreeFixture() {
  const dom = new JSDOM('<!DOCTYPE html><body><div id="mount"></div></body>');
  installDomGlobals(dom);
  return dom;
}

function buildSkillTreeEngine() {
  return {
    data: {
      playerData: {
        skills: {
          skillPoints: 3,
          learned: []
        }
      },
      getSkillCatalog() {
        return {
          skillsMap: {
            skill_a: {
              id: 'skill_a',
              name: '样本技能',
              description: '用于 D1.2 语义测试。',
              unlock: { cost: { kp: 1 } },
              prerequisites: [],
              editorMeta: { x: 40, y: 40 }
            }
          },
          skillsList: [
            {
              id: 'skill_a',
              name: '样本技能',
              description: '用于 D1.2 语义测试。',
              unlock: { cost: { kp: 1 } },
              prerequisites: [],
              editorMeta: { x: 40, y: 40 }
            }
          ]
        };
      }
    },
    eventBus: { emit() {} }
  };
}

test('UI_SystemModal 关卡选择页使用明确的返回游戏菜单语义', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine();
    modal.bindDOM();

    modal.renderLevelSelect();

    const footerText = document.getElementById('modalFooter')?.textContent || '';
    const bodyText = document.getElementById('modalBody')?.textContent || '';
    assert.match(footerText, /返回游戏菜单/);
    assert.match(bodyText, /点击关卡.*直接进入/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 存档页会按来源显示明确返回目标', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine();
    modal.bindDOM();

    modal.renderSaveLoad([], '', {
      returnView: 'LOGIN',
      title: '读取存档'
    });

    const footerText = document.getElementById('modalFooter')?.textContent || '';
    const bodyText = document.getElementById('modalBody')?.textContent || '';
    assert.match(footerText, /返回欢迎页/);
    assert.match(bodyText, /读取后会直接进入存档对应的页面/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SystemModal 在可恢复战斗时为关闭按钮标注返回战斗语义', async () => {
  const dom = createSystemModalFixture();
  try {
    const { UI_SystemModal } = await importSourceModule('script/ui/UI_SystemModal.js');
    const modal = new UI_SystemModal();
    modal.engine = buildSystemModalEngine({
      fsm: { currentState: 'BATTLE_LOOP' },
      data: {
        dataConfig: {
          runtime: {
            levelData: { levelId: 'level_1' }
          }
        },
        getAcceptanceLevelSelectEntries() {
          return [];
        }
      }
    });
    modal.bindDOM();

    modal.renderMainMenu();

    const closeBtn = document.getElementById('modalCloseBtn');
    assert.ok(closeBtn, '缺少关闭按钮');
    assert.match(closeBtn.getAttribute('aria-label') || '', /关闭并返回战斗/);
    assert.match(closeBtn.getAttribute('title') || '', /关闭并返回战斗/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});

test('UI_SkillTreeModal 会解释提交并关闭与直接关闭的差别', async () => {
  const dom = createSkillTreeFixture();
  try {
    const { UI_SkillTreeModal } = await importSourceModule('script/ui/UI_SkillTreeModal.js');
    const modal = new UI_SkillTreeModal();
    modal.init(buildSkillTreeEngine());
    modal.mountTo(document.getElementById('mount'), {
      title: '技能树 / 构筑',
      onClose() {}
    });

    const text = document.getElementById('mount')?.textContent || '';
    assert.match(text, /提交并关闭.*保存本次学习/);
    assert.match(text, /直接关闭.*不提交未保存更改/);
  } finally {
    dom.window.close();
    cleanupDomGlobals();
  }
});
